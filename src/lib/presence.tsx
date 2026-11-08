import { freshChannel } from "@/lib/realtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/xgram";

/**
 * Single source of truth for:
 *  - who is currently online (Supabase Realtime Presence, one shared channel)
 *  - the freshest version of every profile the UI has seen (Realtime postgres changes)
 *
 * Both live here so the app opens exactly one subscription of each kind.
 */

type PresenceContextValue = {
  onlineIds: ReadonlySet<string>;
  isUserOnline: (userId: string | null | undefined) => boolean;
  /** Returns the freshest known copy of a profile (name, avatar, bio…). */
  live: <T extends Profile | null | undefined>(profile: T) => T;
  liveById: (userId: string | null | undefined) => Profile | null;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

const IDLE_TIMEOUT = 120_000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Presence ------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setOnlineIds(new Set());
      return;
    }

    const channel = freshChannel("xgram-presence", {
      config: { presence: { key: user.id } },
    });

    const syncOnline = () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    };

    const track = () =>
      void channel.track({ user_id: user.id, online: true, last_seen: new Date().toISOString() });

    channel
      .on("presence", { event: "sync" }, syncOnline)
      .on("presence", { event: "join" }, syncOnline)
      .on("presence", { event: "leave" }, syncOnline)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") track();
      });

    // Heartbeat keeps both presence and the stored "last seen" fresh.
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") track();
      void supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    }, 40_000);

    const clearIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearIdle();
        track();
      } else {
        clearIdle();
        idleTimerRef.current = setTimeout(() => void channel.untrack(), IDLE_TIMEOUT);
      }
    };

    const onLeave = () => {
      void channel.untrack();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      clearIdle();
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      void channel.untrack().finally(() => void supabase.removeChannel(channel));
    };
  }, [user]);

  // ---- Live profile updates ------------------------------------------------
  useEffect(() => {
    if (!user) {
      setProfiles(new Map());
      return;
    }
    const channel = supabase
      .channel(`xgram-profiles-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const row = payload.new as Profile | null;
        if (!row?.id) return;
        setProfiles((prev) => {
          const next = new Map(prev);
          next.set(row.id, row);
          return next;
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const isUserOnline = useCallback(
    (userId: string | null | undefined) => Boolean(userId && onlineIds.has(userId)),
    [onlineIds],
  );

  const live = useCallback(
    <T extends Profile | null | undefined>(profile: T): T => {
      if (!profile) return profile;
      const fresh = profiles.get(profile.id);
      if (!fresh) return profile;
      return { ...profile, ...fresh } as T;
    },
    [profiles],
  );

  const liveById = useCallback(
    (userId: string | null | undefined) => (userId ? (profiles.get(userId) ?? null) : null),
    [profiles],
  );

  const value = useMemo(
    () => ({ onlineIds, isUserOnline, live, liveById }),
    [onlineIds, isUserOnline, live, liveById],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used inside PresenceProvider");
  return ctx;
}
