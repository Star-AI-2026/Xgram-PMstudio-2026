import { useEffect, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { callStatusLabel, useCall } from "@/lib/calls";
import { formatDuration } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

/** Full-screen call surface: incoming ringer, live call controls and outcome. */
export function CallOverlay() {
  const { call, acceptCall, rejectCall, endCall, toggleMute, toggleSpeaker } = useCall();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (call?.status !== "connected") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [call?.status]);

  if (!call) return null;

  const ringing = call.status === "incoming";
  const live = call.status === "connected" || call.status === "reconnecting";
  const elapsed = call.connectedAt ? Math.floor((now - call.connectedAt) / 1000) : 0;
  const closed = ["ended", "cancelled", "rejected", "missed", "failed"].includes(call.status);

  return (
    <div className="fixed inset-0 z-[60] flex animate-in fade-in flex-col items-center justify-between bg-background/95 px-5 py-10 backdrop-blur-xl sm:py-14">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="relative flex">
          {!closed && !live ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" aria-hidden />
          ) : null}
          <UserAvatar
            name={call.peer.name}
            src={call.peer.avatarUrl}
            className={cn("size-28 text-3xl sm:size-32", live && "ring-2 ring-success/60")}
          />
        </span>

        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{call.peer.name}</h2>
          {call.peer.username ? (
            <p className="text-sm text-muted-foreground">@{call.peer.username}</p>
          ) : null}
          <p
            className={cn(
              "mt-3 text-sm font-medium",
              call.status === "connected" && "text-success",
              (call.status === "failed" || call.status === "rejected" || call.status === "missed") && "text-destructive",
              call.status === "reconnecting" && "text-muted-foreground",
            )}
          >
            {callStatusLabel(call.status)}
          </p>
          {call.connectedAt ? (
            <p className="mt-1 font-mono text-lg tabular-nums">{formatDuration(elapsed)}</p>
          ) : null}
          {call.muted && live ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <MicOff className="size-3.5" /> Microphone muted
            </p>
          ) : null}
        </div>
      </div>

      {ringing ? (
        <div className="flex w-full max-w-sm items-center justify-around">
          <div className="flex flex-col items-center gap-2">
            <Button
              size="icon"
              variant="destructive"
              className="size-16 rounded-full sm:size-[68px]"
              onClick={() => void rejectCall()}
              aria-label="Reject call"
            >
              <PhoneOff className="size-6" />
            </Button>
            <span className="text-xs text-muted-foreground">Reject</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              size="icon"
              className="size-16 animate-pulse rounded-full bg-success text-primary-foreground hover:bg-success/90 sm:size-[68px]"
              onClick={() => void acceptCall()}
              aria-label="Accept call"
            >
              <Phone className="size-6" />
            </Button>
            <span className="text-xs text-muted-foreground">Accept</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            size="icon"
            variant={call.muted ? "default" : "secondary"}
            className="size-14 rounded-full sm:size-16"
            onClick={toggleMute}
            disabled={closed}
            aria-label={call.muted ? "Unmute microphone" : "Mute microphone"}
          >
            {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </Button>
          <Button
            size="icon"
            variant={call.speakerOn ? "secondary" : "default"}
            className="size-14 rounded-full sm:size-16"
            onClick={toggleSpeaker}
            disabled={closed}
            aria-label={call.speakerOn ? "Turn speaker off" : "Turn speaker on"}
          >
            {call.speakerOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="size-16 rounded-full sm:size-[68px]"
            onClick={() => void endCall("ended")}
            aria-label="End call"
          >
            <PhoneOff className="size-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
