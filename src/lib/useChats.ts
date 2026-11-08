import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getCachedChatSummaries, saveCachedChatSummaries } from "@/lib/local-cache";
import { fetchChatSummaries, type ChatSummary } from "@/lib/xgram";

/** Loads cached conversations immediately, then reconciles them with Supabase. */
export function useChats() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const activeUserId = useRef<string | null>(user?.id ?? null);
  activeUserId.current = user?.id ?? null;

  const refresh = useCallback(async (strict = false) => {
    if (!user) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    try {
      const fresh = await fetchChatSummaries(user.id);
      if (activeUserId.current !== user.id) return;
      setSummaries(fresh);
      void saveCachedChatSummaries(user.id, fresh);
    } catch {
      if (strict) throw new Error("Conversations synchronization failed");
      // Keep the last known local copy during temporary network failures.
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Hydrate from this account's local cache before the first network round-trip.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSummaries([]);

    if (!user) {
      setLoading(false);
      return () => { active = false; };
    }

    void getCachedChatSummaries(user.id).then(async (cached) => {
      if (!active) return;
      if (cached) setSummaries(cached);
      setLoading(false);
      await refresh();
    });
    return () => { active = false; };
  }, [user?.id, refresh]);

  useEffect(() => {
    const resync = (event: Event) => {
      const task = refresh(true);
      (event as CustomEvent<{ waitUntil?: (task: Promise<unknown>) => void }>).detail?.waitUntil?.(task);
    };
    window.addEventListener("xgram:resync", resync);
    return () => window.removeEventListener("xgram:resync", resync);
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-list-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  // Periodic reconciliation is a fallback for missed realtime events.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  return { summaries, loading, refresh };
}
