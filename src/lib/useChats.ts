import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchChatSummaries, type ChatSummary } from "@/lib/xgram";

/** Loads the signed-in user's conversations and keeps them fresh in real time. */
export function useChats() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (strict = false) => {
    if (!user) return;
    try {
      setSummaries(await fetchChatSummaries(user.id));
    } catch {
      if (strict) throw new Error("Conversations synchronization failed");
      // Ignore transient fetch errors; the next realtime event retries.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  // Reliable recovery also covers missed moderation events and reconnects.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  return { summaries, loading, refresh };
}
