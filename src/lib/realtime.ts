import { supabase } from "@/integrations/supabase/client";

type ChannelOptions = Parameters<typeof supabase.channel>[1];

/**
 * supabase.channel(name) returns an already-registered channel with the same
 * topic. If that one is still subscribed (cleanup is async), adding listeners
 * throws "cannot add callbacks after subscribe()". This drops any previous
 * channel with the same topic first, so shared broadcast/presence topics can be
 * re-created safely on every mount.
 */
export function freshChannel(name: string, options?: ChannelOptions) {
  const topic = `realtime:${name}`;
  const realtime = supabase.realtime as unknown as { _remove?: (c: unknown) => void };
  for (const existing of supabase.getChannels()) {
    if (existing.topic !== topic) continue;
    void supabase.removeChannel(existing).catch(() => undefined);
    realtime._remove?.(existing); // drop it from the registry right away
  }
  return options ? supabase.channel(name, options) : supabase.channel(name);
}
