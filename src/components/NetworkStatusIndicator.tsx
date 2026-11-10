import { useCallback, useEffect, useRef, useState } from "react";

import { XgramLogo } from "@/components/XgramLogo";
import { useI18n } from "@/lib/i18n";

type NetworkPhase = "waiting" | "connecting" | "updating" | "ready";

function Dots() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1 rounded-full bg-current animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
  );
}

/** A compact, non-blocking network indicator shown in the chat-list header. */
export function NetworkStatusIndicator({ loading }: { loading: boolean }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<NetworkPhase>("waiting");
  const phaseRef = useRef<NetworkPhase>("waiting");
  const reachableRef = useRef(false);

  const updatePhase = useCallback((next: NetworkPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    let disposed = false;
    let activeController: AbortController | null = null;
    let retryTimer: ReturnType<typeof setInterval> | undefined;

    const checkBackend = async (showConnecting: boolean) => {
      if (disposed) return;
      if (!navigator.onLine) {
        reachableRef.current = false;
        updatePhase("waiting");
        return;
      }

      if (showConnecting || !reachableRef.current) updatePhase("connecting");
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const baseUrl = import.meta.env["VITE_SUPABASE_URL"];
        const apiKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!baseUrl || !apiKey) throw new Error("Network configuration is unavailable");

        const response = await fetch(`${baseUrl}/auth/v1/health`, {
          method: "GET",
          headers: { apikey: apiKey },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Backend is unavailable");
        if (disposed) return;

        reachableRef.current = true;
        // Do not replace the final logo on quiet background health checks.
        if (phaseRef.current !== "ready") updatePhase("updating");
      } catch {
        if (disposed) return;
        reachableRef.current = false;
        updatePhase("waiting");
      } finally {
        clearTimeout(timeout);
        if (activeController === controller) activeController = null;
      }
    };

    const onOnline = () => void checkBackend(true);
    const onOffline = () => {
      reachableRef.current = false;
      activeController?.abort();
      updatePhase("waiting");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void checkBackend(true);

    // Retry only when the browser/backend is unavailable; normal operation stays quiet.
    retryTimer = setInterval(() => {
      if (!navigator.onLine || !reachableRef.current) void checkBackend(true);
      else void checkBackend(false);
    }, 15000);

    return () => {
      disposed = true;
      activeController?.abort();
      if (retryTimer) clearInterval(retryTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [updatePhase]);

  useEffect(() => {
    if (phase !== "updating" || loading) return;
    const timer = setTimeout(() => updatePhase("ready"), 550);
    return () => clearTimeout(timer);
  }, [phase, loading, updatePhase]);

  useEffect(() => {
    if (loading && phase === "ready" && reachableRef.current) updatePhase("updating");
  }, [loading, phase, updatePhase]);

  if (phase === "ready") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center" title="Xgram" aria-label="Xgram">
        <XgramLogo size={25} />
      </span>
    );
  }

  const label = phase === "waiting"
    ? t("network.waiting")
    : phase === "updating"
      ? t("network.updating")
      : t("network.connecting");

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-w-0 max-w-[132px] shrink items-center gap-1.5 overflow-hidden text-[10px] font-medium leading-tight text-muted-foreground sm:max-w-[160px] sm:text-[11px]"
      title={label}
    >
      <span className="truncate">{label}</span>
      <Dots />
    </span>
  );
}
