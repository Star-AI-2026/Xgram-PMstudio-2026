import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchChatSummaries, fetchMessageReads } from "@/lib/xgram";
import { XgramLogo } from "@/components/XgramLogo";

type NetworkState = "online" | "offline" | "connecting" | "updating" | "ready";
const CONNECTING_MS = 5000;
const CHECK_MS = 2500;

function Dots() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-[xgram-dot_1.2s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:animate-none"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </span>
  );
}

export function NetworkStatusOverlay() {
  const { t, dir } = useI18n();
  const { user, loading, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [state, setState] = useState<NetworkState>("offline");
  const authRef = useRef({ user, loading, refreshProfile });
  authRef.current = { user, loading, refreshProfile };
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const authWaiters = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (!loading) {
      for (const wake of authWaiters.current) wake();
      authWaiters.current.clear();
    }
  }, [loading]);

  // One mounted controller owns all phases, timers and listeners. A generation
  // invalidates results from requests that could not be cancelled by the client.
  useEffect(() => {
    let generation = 0;
    let stopped = false;
    let phase: NetworkState = "offline";
    let active = false;
    let checking = false;
    let controller: AbortController | null = null;
    let monitor: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setInterval> | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const show = (next: NetworkState) => { phase = next; setState(next); };
    const delay = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new Error("Interrupted")); return; }
      const timer = setTimeout(() => { timers.delete(timer); signal.removeEventListener("abort", abort); resolve(); }, ms);
      timers.add(timer);
      const abort = () => { clearTimeout(timer); timers.delete(timer); reject(new Error("Interrupted")); };
      signal.addEventListener("abort", abort, { once: true });
    });
    const reachable = async (signal: AbortSignal) => {
      const timeout = AbortSignal.timeout(8000);
      const response = await fetch(`${import.meta.env['VITE_SUPABASE_URL']}/auth/v1/health`, {
        headers: { apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] },
        cache: "no-store",
        signal: AbortSignal.any([signal, timeout]),
      });
      if (!response.ok) throw new Error("Backend unavailable");
    };
    const stopWork = () => {
      generation++;
      controller?.abort();
      controller = null;
      active = false;
      checking = false;
      if (monitor) clearInterval(monitor);
      monitor = undefined;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const wake of authWaiters.current) wake();
      authWaiters.current.clear();
    };
    const offline = () => {
      if (stopped) return;
      stopWork();
      show("offline");
    };
    const waitForAuth = async (signal: AbortSignal) => {
      if (!authRef.current.loading) return;
      await new Promise<void>((resolve, reject) => {
        const wake = () => { signal.removeEventListener("abort", abort); resolve(); };
        const abort = () => { authWaiters.current.delete(wake); reject(new Error("Interrupted")); };
        authWaiters.current.add(wake);
        signal.addEventListener("abort", abort, { once: true });
        if (!authRef.current.loading) { authWaiters.current.delete(wake); wake(); }
      });
      if (signal.aborted) throw new Error("Interrupted");
    };
    const start = async () => {
      if (stopped || active || phase === "online" || phase === "ready" || !navigator.onLine) { if (!navigator.onLine) offline(); return; }
      active = true;
      const id = ++generation;
      const signal = (controller = new AbortController()).signal;
      const valid = () => !stopped && !signal.aborted && generation === id && navigator.onLine;
      try {
        // An online flag alone is insufficient. Probe the real backend before
        // starting the five-second Connecting clock.
        await reachable(signal);
        if (!valid()) return;
        show("connecting");
        const startedAt = performance.now();
        monitor = setInterval(() => {
          if (checking || !valid()) { if (!navigator.onLine) offline(); return; }
          checking = true;
          void reachable(signal).catch(() => { if (valid()) offline(); }).finally(() => { checking = false; });
        }, CHECK_MS);
        // Session recovery starts during Connecting, but Updating is never
        // shown early. Failure during either phase returns to Waiting.
        const sessionCheck = (async () => {
          await waitForAuth(signal);
          if (!valid()) throw new Error("Interrupted");
          if (authRef.current.user) {
            const { error } = await supabase.auth.getUser();
            if (error) throw error;
          }
          if (!valid()) throw new Error("Interrupted");
          supabase.realtime.connect();
        })();
        // Observe errors immediately, even when the five-second timer is still running.
        void sessionCheck.catch(() => { if (valid()) offline(); });
        await delay(Math.max(0, CONNECTING_MS - (performance.now() - startedAt)), signal);
        if (!valid()) return;
        show("updating");
        await sessionCheck;
        if (!valid()) return;
        const currentUser = authRef.current.user;
        if (currentUser) {
          const path = pathRef.current;
          const chatId = path.startsWith("/chats/") ? path.split("/")[2] : undefined;
          const sync: Promise<unknown>[] = [
            authRef.current.refreshProfile(),
            fetchChatSummaries(currentUser.id, signal),
            Promise.resolve(supabase.from("calls").select("id,status,updated_at")
              .or(`caller_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).limit(100).abortSignal(signal)
              .then(({ error }) => { if (error) throw error; })),
            queryClient.refetchQueries({ type: "active" }),
          ];
          if (chatId) {
            sync.push(Promise.resolve(supabase.from("messages").select("id").eq("chat_id", chatId)
              .order("created_at", { ascending: false }).limit(500).abortSignal(signal)
              .then(({ error }) => { if (error) throw error; })));
            sync.push(fetchMessageReads(chatId).then(() => undefined));
          }
          await Promise.all(sync);
          if (!valid()) return;
          const pending: Promise<unknown>[] = [];
          window.dispatchEvent(new CustomEvent("xgram:resync", {
            detail: { waitUntil: (task: Promise<unknown>) => pending.push(task) },
          }));
          await Promise.all(pending);
          if (!valid()) return;
          await queryClient.invalidateQueries({ refetchType: "active" });
          if (!valid()) return;
        }
        // A successful sync still needs a reachable server before revealing the app.
        await reachable(signal);
        if (!valid()) return;
        if (monitor) clearInterval(monitor);
        monitor = undefined;
        show("ready");
        await delay(650, signal); // Brand reveal, not part of Updating.
        if (valid()) show("online");
      } catch {
        if (valid()) offline();
      } finally {
        if (generation === id) active = false;
      }
    };
    const online = () => { if (!stopped) void start(); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    retry = setInterval(() => {
      if (phase === "offline" && navigator.onLine) void start();
    }, 3000);
    if (navigator.onLine) void start();
    else offline();
    return () => {
      stopped = true;
      stopWork();
      if (retry) clearInterval(retry);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [queryClient]);

  const label = state === "offline" ? t("network.waiting")
    : state === "updating" ? t("network.updating")
      : state === "ready" ? "Xgram" : t("network.connecting");

  const isReady = state === "ready" || state === "online";

  return (
    <span
      role="status"
      aria-live="polite"
      dir={isReady ? "ltr" : dir}
      className="inline-flex min-h-8 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap"
    >
      {isReady ? (
        // The Xgram symbol replaces the letter "X"; do not print a second X
        // or duplicate the icon on either side of the wordmark.
        <XgramLogo size={28} withWordmark wordmarkText="gram" className="gap-0.5" />
      ) : (
        <>
          <span className="truncate text-sm font-semibold text-foreground sm:text-base">
            {label}
          </span>
          <Dots />
        </>
      )}
    </span>
  );
}
