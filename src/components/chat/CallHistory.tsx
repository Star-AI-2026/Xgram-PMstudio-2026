import { useCallback, useEffect, useState } from "react";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDuration } from "@/lib/webrtc";
import { cn } from "@/lib/utils";

export type CallRow = {
  id: string;
  chat_id: string;
  caller_id: string;
  receiver_id: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}, ${time}`;
}

/** Recent voice calls for one conversation. */
export function CallHistory({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(25);
    setCalls((data ?? []) as CallRow[]);
  }, [chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`calls-history-${chatId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: `chat_id=eq.${chatId}` }, () =>
        void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, load]);

  if (!calls.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">No calls in this chat yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {calls.map((row) => {
        const outgoing = row.caller_id === user?.id;
        const missed = ["missed", "rejected", "failed", "cancelled"].includes(row.status);
        const duration =
          row.answered_at && row.ended_at
            ? Math.floor((new Date(row.ended_at).getTime() - new Date(row.answered_at).getTime()) / 1000)
            : 0;
        const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;

        return (
          <li key={row.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                missed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {row.status === "cancelled"
                  ? outgoing
                    ? "Outgoing call · Cancelled"
                    : "Incoming call · Cancelled"
                  : missed
                    ? row.status === "rejected"
                      ? outgoing
                        ? "Declined call"
                        : "Rejected call"
                      : row.status === "failed"
                        ? "Failed call"
                        : outgoing
                          ? "No answer"
                          : "Missed call"
                    : outgoing
                      ? "Outgoing call"
                      : "Incoming call"}
              </p>
              <p className="text-xs text-muted-foreground">{dateLabel(row.started_at)}</p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {duration > 0 ? formatDuration(duration) : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
