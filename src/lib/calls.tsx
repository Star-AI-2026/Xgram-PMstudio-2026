import { freshChannel } from "@/lib/realtime";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { createPeerConnection, getMicrophoneStream, stopStream } from "@/lib/webrtc";
import { startRinging } from "@/lib/ringtone";

export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "incoming"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "cancelled"
  | "rejected"
  | "missed"
  | "failed";

export type CallPeer = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

export type ActiveCall = {
  id: string;
  chatId: string;
  peer: CallPeer;
  direction: "outgoing" | "incoming";
  status: CallStatus;
  connectedAt: number | null;
  muted: boolean;
  speakerOn: boolean;
};

type SignalPayload = {
  from: string;
  callId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  peer?: CallPeer;
  chatId?: string;
};

type CallContextValue = {
  call: ActiveCall | null;
  startCall: (input: { chatId: string; peer: CallPeer }) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: (reason?: "ended" | "failed" | "missed" | "cancelled") => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

const RING_TIMEOUT_MS = 35_000;

/** Statuses that close a call for good — no ringing may survive them. */
const TERMINAL_STATUSES = ["ended", "cancelled", "rejected", "missed", "failed"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

function isTerminal(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [call, setCall] = useState<ActiveCall | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const ringerRef = useRef<{ stop: () => void } | null>(null);
  const ringerCallIdRef = useRef<string | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const busyRef = useRef(false);
  /** Calls already resolved locally — late signals for them are ignored. */
  const closedCallsRef = useRef<Set<string>>(new Set());

  callRef.current = call;

  const stopRinging = useCallback(() => {
    ringerRef.current?.stop();
    ringerRef.current = null;
    ringerCallIdRef.current = null;
  }, []);

  /** Ringtone manager: one tone per call id, never duplicated. */
  const startRingingFor = useCallback(
    (callId: string, direction: "incoming" | "outgoing") => {
      if (ringerCallIdRef.current === callId && ringerRef.current) return;
      stopRinging();
      ringerCallIdRef.current = callId;
      ringerRef.current = startRinging(direction);
    },
    [stopRinging],
  );

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  /** Tears down every media/peer/channel resource for the current call. */
  const teardown = useCallback(() => {
    stopRinging();
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    pendingCandidates.current = [];

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onnegotiationneeded = null;
      try {
        pc.getSenders().forEach((sender) => sender.track?.stop());
        pc.getReceivers().forEach((receiver) => receiver.track?.stop());
        pc.close();
      } catch {
        /* ignore */
      }
    }

    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    const channel = signalChannelRef.current;
    signalChannelRef.current = null;
    if (channel) void supabase.removeChannel(channel);

    busyRef.current = false;
  }, [stopRinging]);

  const updateCall = useCallback((patch: Partial<ActiveCall>) => {
    setCall((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const persist = useCallback(
    async (callId: string, patch: TablesUpdate<"calls">) => {
      if (!user) return;
      await supabase.from("calls").update(patch).eq("id", callId);
    },
    [user],
  );

  const sendSignal = useCallback(
    (event: string, payload: Omit<SignalPayload, "from" | "callId"> & { callId?: string }) => {
      const active = callRef.current;
      const callId = payload.callId ?? active?.id;
      if (!callId || !user) return;
      void signalChannelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...payload, callId, from: user.id } satisfies SignalPayload,
      });
    },
    [user],
  );

  /**
   * Single place where a call reaches a terminal state locally: stops the
   * ringtone/timers, releases WebRTC and shows the outcome briefly.
   */
  const closeLocally = useCallback(
    (callId: string, finalStatus: TerminalStatus) => {
      const active = callRef.current;
      if (!active || active.id !== callId) return;
      closedCallsRef.current.add(callId);
      stopRinging();
      clearRingTimeout();
      setCall({ ...active, status: finalStatus, connectedAt: null });
      teardown();
      clearTimerRef.current = setTimeout(() => {
        setCall((prev) => (prev && prev.id === callId ? null : prev));
        clearTimerRef.current = null;
      }, 2000);
    },
    [clearRingTimeout, stopRinging, teardown],
  );

  /** Closes the call locally and, when we initiated the closure, tells the peer. */
  const finish = useCallback(
    async (requested: TerminalStatus, notifyPeer: boolean) => {
      const active = callRef.current;
      if (!active || closedCallsRef.current.has(active.id)) return;

      // Hanging up an outgoing call that was never answered is a cancellation.
      const finalStatus: TerminalStatus =
        requested === "ended" && active.direction === "outgoing" && !active.connectedAt ? "cancelled" : requested;

      if (notifyPeer) {
        sendSignal(finalStatus === "rejected" ? "call_rejected" : "call_ended", {
          callId: active.id,
          reason: finalStatus,
        });
      }

      if (user) {
        void persist(active.id, {
          status: finalStatus,
          ended_at: new Date().toISOString(),
          ended_by: user.id,
        });
      }

      closeLocally(active.id, finalStatus);
    },
    [closeLocally, persist, sendSignal, user],
  );


  /** Builds the RTCPeerConnection, wires ICE + remote audio + state handling. */
  const setupPeer = useCallback(
    async (callId: string) => {
      if (closedCallsRef.current.has(callId)) throw new Error("Call already ended");
      const stream = await getMicrophoneStream();
      if (closedCallsRef.current.has(callId)) {
        stopStream(stream);
        throw new Error("Call already ended");
      }
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      const remote = new MediaStream();
      remoteStreamRef.current = remote;

      pc.ontrack = (event) => {
        event.streams[0]?.getAudioTracks().forEach((track) => remote.addTrack(track));
        if (audioRef.current) {
          audioRef.current.srcObject = remote;
          void audioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("ice_candidate", { callId, candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          stopRinging();
          clearRingTimeout();
          setCall((prev) =>
            prev && prev.id === callId
              ? { ...prev, status: "connected", connectedAt: prev.connectedAt ?? Date.now() }
              : prev,
          );
        } else if (state === "disconnected") {
          setCall((prev) => (prev && prev.id === callId ? { ...prev, status: "reconnecting" } : prev));
        } else if (state === "failed") {
          void finish("failed", true);
        }
      };

      return pc;
    },
    [clearRingTimeout, finish, sendSignal, stopRinging],
  );

  const applyPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingCandidates.current;
    pendingCandidates.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore late candidates */
      }
    }
  }, []);

  /** Subscribes to the private signaling channel scoped to a single call id. */
  const openSignalChannel = useCallback(
    (callId: string) => {
      const channel = freshChannel(`xgram-call-${callId}`, { config: { broadcast: { self: false } } });

      channel
        .on("broadcast", { event: "call_accepted" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id) return;
          const active = callRef.current;
          if (!active || active.id !== callId || active.direction !== "outgoing") return;
          stopRinging();
          clearRingTimeout();
          updateCall({ status: "connecting" });
          void (async () => {
            try {
              const pc = pcRef.current ?? (await setupPeer(callId));
              const offer = await pc.createOffer({ offerToReceiveAudio: true });
              await pc.setLocalDescription(offer);
              sendSignal("offer", { callId, sdp: offer });
            } catch {
              void finish("failed", true);
            }
          })();
        })
        .on("broadcast", { event: "offer" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id || !data.sdp) return;
          void (async () => {
            try {
              const pc = pcRef.current;
              if (!pc) return;
              await pc.setRemoteDescription(data.sdp!);
              await applyPendingCandidates();
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal("answer", { callId, sdp: answer });
              updateCall({ status: "connecting" });
            } catch {
              void finish("failed", true);
            }
          })();
        })
        .on("broadcast", { event: "answer" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id || !data.sdp) return;
          void (async () => {
            try {
              await pcRef.current?.setRemoteDescription(data.sdp!);
              await applyPendingCandidates();
            } catch {
              void finish("failed", true);
            }
          })();
        })
        .on("broadcast", { event: "ice_candidate" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id || !data.candidate) return;
          const pc = pcRef.current;
          if (pc?.remoteDescription) {
            void pc.addIceCandidate(data.candidate).catch(() => {});
          } else {
            pendingCandidates.current.push(data.candidate);
          }
        })
        .on("broadcast", { event: "call_rejected" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id) return;
          closeLocally(callId, "rejected");
        })
        .on("broadcast", { event: "call_ended" }, ({ payload }) => {
          const data = payload as SignalPayload;
          if (data.from === user?.id) return;
          const reason = data.reason ?? "ended";
          closeLocally(callId, isTerminal(reason) ? reason : "ended");
        })
        .subscribe();

      signalChannelRef.current = channel;
      return channel;
    },
    [
      applyPendingCandidates,
      clearRingTimeout,
      closeLocally,
      finish,
      sendSignal,
      setupPeer,
      stopRinging,
      updateCall,
      user?.id,
    ],
  );

  /**
   * Database fallback: whichever side misses a broadcast (slow network, tab
   * asleep, channel not joined yet) still sees the final status land here.
   */
  useEffect(() => {
    if (!call) return;
    const callId = call.id;
    const channel = supabase
      .channel(`xgram-call-db-${callId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        ({ new: row }) => {
          const status = (row as { status?: string }).status ?? "";
          if (isTerminal(status)) closeLocally(callId, status);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [call?.id, closeLocally]);

  /** Personal channel: receives incoming call invitations. */
  useEffect(() => {
    if (!user) return;
    const channel = freshChannel(`xgram-call-user-${user.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "call_started" }, ({ payload }) => {
        const data = payload as SignalPayload;
        if (!data.callId || !data.peer || !data.chatId) return;
        const callId = data.callId;
        if (closedCallsRef.current.has(callId)) return;

        if (busyRef.current || callRef.current) {
          // Already busy: politely decline on the caller's channel.
          const temp = supabase.channel(`xgram-call-${callId}`);
          temp.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              void temp
                .send({
                  type: "broadcast",
                  event: "call_rejected",
                  payload: { from: user.id, callId, reason: "busy" } satisfies SignalPayload,
                })
                .finally(() => void supabase.removeChannel(temp));
            }
          });
          return;
        }

        busyRef.current = true;
        // Join the per-call channel right away so a cancellation reaches us
        // while we are still ringing, not only after we answer.
        openSignalChannel(callId);

        void (async () => {
          // Confirm the call is still live before making any noise.
          const { data: row } = await supabase.from("calls").select("status").eq("id", callId).maybeSingle();
          const dbStatus = row?.status ?? "ringing";
          if (isTerminal(dbStatus) || closedCallsRef.current.has(callId)) {
            closedCallsRef.current.add(callId);
            teardown();
            return;
          }

          setCall({
            id: callId,
            chatId: data.chatId!,
            peer: data.peer!,
            direction: "incoming",
            status: "incoming",
            connectedAt: null,
            muted: false,
            speakerOn: true,
          });
          startRingingFor(callId, "incoming");

          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = setTimeout(() => {
            const active = callRef.current;
            if (active && active.id === callId && active.status === "incoming") {
              void persist(callId, { status: "missed", ended_at: new Date().toISOString() });
              closeLocally(callId, "missed");
            }
          }, RING_TIMEOUT_MS);
        })();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, closeLocally, openSignalChannel, persist, startRingingFor, teardown]);


  const startCall = useCallback(
    async ({ chatId, peer }: { chatId: string; peer: CallPeer }) => {
      if (!user) return;
      if (callRef.current) {
        toast.error("You're already in a call");
        return;
      }

      // Fresh call: drop any leftover timers/state from the previous one.
      clearRingTimeout();
      busyRef.current = true;
      let callId = "";
      try {
        const { data, error } = await supabase
          .from("calls")
          .insert({ chat_id: chatId, caller_id: user.id, receiver_id: peer.id, kind: "audio", status: "ringing" })
          .select("id")
          .single();
        if (error) throw error;
        callId = data.id as string;

        setCall({
          id: callId,
          chatId,
          peer,
          direction: "outgoing",
          status: "calling",
          connectedAt: null,
          muted: false,
          speakerOn: true,
        });

        await setupPeer(callId);
        openSignalChannel(callId);

        const invite = supabase.channel(`xgram-call-user-${peer.id}`);
        invite.subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          void invite
            .send({
              type: "broadcast",
              event: "call_started",
              payload: {
                from: user.id,
                callId,
                chatId,
                peer: {
                  id: user.id,
                  name: profile?.display_name ?? "Xgram user",
                  username: profile?.username ?? null,
                  avatarUrl: profile?.avatar_url ?? null,
                },
              } satisfies SignalPayload,
            })
            .finally(() => void supabase.removeChannel(invite));
        });

        updateCall({ status: "ringing" });
        startRingingFor(callId, "outgoing");

        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          const active = callRef.current;
          if (active && active.id === callId && (active.status === "ringing" || active.status === "calling")) {
            void finish("missed", true);
          }
        }, RING_TIMEOUT_MS);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Call could not be started";
        const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        toast.error(denied ? "Microphone access denied" : "Call failed", {
          description: denied ? "Allow microphone access in your browser to make calls." : message,
        });
        if (callId) void persist(callId, { status: "failed", ended_at: new Date().toISOString(), ended_by: user.id });
        setCall(null);
        teardown();
      }
    },
    [user, profile, setupPeer, openSignalChannel, updateCall, clearRingTimeout, finish, persist, teardown],
  );

  const acceptCall = useCallback(async () => {
    const active = callRef.current;
    if (!active || active.direction !== "incoming" || !user) return;
    if (closedCallsRef.current.has(active.id)) return;
    stopRinging();
    clearRingTimeout();
    updateCall({ status: "connecting" });

    try {
      // Race guard: the caller may have cancelled while we were answering.
      const { data: row } = await supabase.from("calls").select("status").eq("id", active.id).maybeSingle();
      const dbStatus = row?.status ?? "ringing";
      if (isTerminal(dbStatus) || closedCallsRef.current.has(active.id)) {
        closeLocally(active.id, isTerminal(dbStatus) ? dbStatus : "ended");
        return;
      }

      await setupPeer(active.id);
      if (!signalChannelRef.current) openSignalChannel(active.id);
      // Give the channel a beat to subscribe before announcing acceptance.
      setTimeout(() => sendSignal("call_accepted", { callId: active.id }), 350);
      void persist(active.id, { status: "accepted", answered_at: new Date().toISOString() });
    } catch (error) {
      if (closedCallsRef.current.has(active.id)) return;
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      toast.error(denied ? "Microphone access denied" : "Could not answer the call", {
        description: denied ? "Allow microphone access in your browser to answer calls." : undefined,
      });
      await finish("failed", true);
    }
  }, [
    user,
    stopRinging,
    clearRingTimeout,
    updateCall,
    setupPeer,
    openSignalChannel,
    sendSignal,
    persist,
    finish,
    closeLocally,
  ]);

  const rejectCall = useCallback(async () => {
    await finish("rejected", true);
  }, [finish]);

  const endCall = useCallback(
    async (reason: "ended" | "failed" | "missed" | "cancelled" = "ended") => {
      await finish(reason, true);
    },
    [finish],
  );


  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !(callRef.current?.muted ?? false);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    updateCall({ muted: next });
  }, [updateCall]);

  const toggleSpeaker = useCallback(() => {
    const next = !(callRef.current?.speakerOn ?? true);
    if (audioRef.current) audioRef.current.volume = next ? 1 : 0;
    updateCall({ speakerOn: next });
  }, [updateCall]);

  // Hang up cleanly when the tab closes or reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (callRef.current) void finish("ended", true);
    };
    window.addEventListener("pagehide", handler);
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      window.removeEventListener("beforeunload", handler);
    };
  }, [finish]);

  // Network loss during an active call.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const offline = () => {
      const active = callRef.current;
      if (active && (active.status === "connected" || active.status === "connecting")) {
        updateCall({ status: "reconnecting" });
      }
    };
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, [updateCall]);

  // Signing out ends any live call.
  useEffect(() => {
    if (!user && callRef.current) {
      setCall(null);
      teardown();
    }
  }, [user, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  const value = useMemo<CallContextValue>(
    () => ({ call, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleSpeaker }),
    [call, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleSpeaker],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

export function callStatusLabel(status: CallStatus) {
  switch (status) {
    case "calling":
      return "Calling…";
    case "ringing":
      return "Ringing…";
    case "incoming":
      return "Incoming voice call";
    case "connecting":
      return "Connecting…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "rejected":
      return "Call declined";
    case "missed":
      return "Missed call";
    case "failed":
      return "Call failed";
    case "cancelled":
      return "Call cancelled";
    case "ended":
      return "Call ended";
    default:
      return "";
  }
}
