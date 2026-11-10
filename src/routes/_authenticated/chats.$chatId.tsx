import { freshChannel } from "@/lib/realtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Search, X, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Composer } from "@/components/chat/Composer";
import { MessageBubble, type MessageStatus, type ReactionSummary } from "@/components/chat/MessageBubble";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupProfileDialog } from "@/components/chat/GroupProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { uploadMedia } from "@/lib/media";
import { getCachedChatSnapshot, saveCachedChatSnapshot } from "@/lib/local-cache";
import { usePresence } from "@/lib/presence";
import {
  fetchMessageReads,
  markMessagesAsRead,
  formatTime,
  type Chat,
  type ChatMember,
  type Message,
  type MessageRead,
  type Profile,
} from "@/lib/xgram";

export const Route = createFileRoute("/_authenticated/chats/$chatId")({
  head: () => ({
    meta: [
      { title: "Conversation — Xgram" },
      { name: "description", content: "View your private Xgram conversation." },
      { property: "og:title", content: "Conversation — Xgram" },
      { property: "og:description", content: "View your private Xgram conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatView,
});

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type ActivityKind = "typing" | "recording";
type Activity = { name: string; kind: ActivityKind; expires: number };

/** Live activity (typing / recording) is broadcast only — never stored in the database. */
const ACTIVITY_TTL = 4500;

function ChatView() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId" });
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isUserOnline, live } = usePresence();

  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reads, setReads] = useState<MessageRead[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const activityChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheHydratedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    const cacheKey = user ? `${user.id}:${chatId}` : null;
    if (user && cacheHydratedFor.current !== cacheKey) {
      cacheHydratedFor.current = cacheKey;
      const cached = await getCachedChatSnapshot(user.id, chatId);
      if (cached) {
        setChat(cached.chat);
        setMembers(cached.members);
        setMessages(cached.messages);
        setProfiles(new Map(cached.profiles.map((item) => [item.id, item])));
        setLoading(false);
      }
    }

    const [chatRes, memberRes, messageRes] = await Promise.all([
      supabase.from("chats").select("*").eq("id", chatId).maybeSingle(),
      supabase.from("chat_members").select("*").eq("chat_id", chatId),
      supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true }).limit(500),
    ]);
    for (const result of [chatRes, memberRes, messageRes]) {
      if (result.error) throw result.error;
    }

    const chatRow = (chatRes.data as Chat | null) ?? null;
    const memberRows = (memberRes.data ?? []) as ChatMember[];
    const messageRows = (messageRes.data ?? []) as Message[];

    setChat(chatRow);
    setMembers(memberRows);
    setMessages(messageRows);

    const ids = Array.from(new Set(memberRows.map((m) => m.user_id)));
    let profileRows: Profile[] = [];
    if (ids.length) {
      const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
      if (error) throw error;
      profileRows = (data ?? []) as Profile[];
    }
    setProfiles(new Map(profileRows.map((p) => [p.id, p])));

    if (messageRows.length) {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageRows.map((m) => m.id));
      if (error) throw error;
      setReactions((data ?? []) as Reaction[]);
    } else {
      setReactions([]);
    }

    setReads(await fetchMessageReads(chatId));

    if (user && chatRow) {
      void saveCachedChatSnapshot(user.id, chatId, {
        chat: chatRow,
        members: memberRows,
        messages: messageRows,
        profiles: profileRows,
        savedAt: Date.now(),
      });
    }

    setLoading(false);
  }, [chatId, user?.id]);

  useEffect(() => {
    setLoading(true);
    setReplyTo(null);
    setEditing(null);
    setActivity({});
    void load();
  }, [load]);

  useEffect(() => {
    const resync = (event: Event) => {
      const task = load();
      (event as CustomEvent<{ waitUntil?: (task: Promise<unknown>) => void }>).detail?.waitUntil?.(task);
    };
    window.addEventListener("xgram:resync", resync);
    return () => window.removeEventListener("xgram:resync", resync);
  }, [load]);

  // Realtime messages, reactions, read state and live activity.
  useEffect(() => {
    // Database changes: unique topic per mount so a re-run never reuses a channel
    // that is still subscribed (supabase.channel() returns existing topics).
    const dbChannel = supabase
      .channel(`chat-db-${chatId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        () => void load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` }, () => void load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reads", filter: `chat_id=eq.${chatId}` },
        () => {
          void fetchMessageReads(chatId)
            .then(setReads)
            .catch(() => undefined);
        },
      )
      .subscribe();

    // Live activity is broadcast and needs a topic shared by every member.
    const channel = freshChannel(`chat-${chatId}`)
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const data = payload as { id?: string; name?: string; kind?: ActivityKind | "idle" };
        if (!data.id || data.id === user?.id) return;
        setActivity((prev) => {
          const next = { ...prev };
          if (!data.kind || data.kind === "idle") delete next[data.id!];
          else next[data.id!] = { name: data.name ?? "Someone", kind: data.kind, expires: Date.now() + ACTIVITY_TTL };
          return next;
        });
      })
      .subscribe();

    activityChannel.current = channel;
    return () => {
      activityChannel.current = null;
      void supabase.removeChannel(dbChannel);
      // Leaving the chat clears any indicator we were showing to others.
      void channel
        .send({ type: "broadcast", event: "activity", payload: { id: user?.id, kind: "idle" } })
        .catch(() => undefined);
      void supabase.removeChannel(channel);
    };
  }, [chatId, load, user?.id]);

  // Drop stale indicators when a peer disconnects without sending "idle".
  useEffect(() => {
    const timer = setInterval(() => {
      setActivity((prev) => {
        const now = Date.now();
        const entries = Object.entries(prev).filter(([, value]) => value.expires > now);
        if (entries.length === Object.keys(prev).length) return prev;
        return Object.fromEntries(entries);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Persist read receipts in the database for every message rendered in this chat.
  useEffect(() => {
    if (!user || !messages.length) return;
    const unreadFromOthers = messages.some(
      (m) => m.sender_id !== user.id && !reads.some((r) => r.message_id === m.id && r.user_id === user.id),
    );
    if (!unreadFromOthers) return;
    void markMessagesAsRead(chatId)
      .then(() => fetchMessageReads(chatId))
      .then(setReads)
      .catch(() => undefined);
  }, [messages, reads, chatId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activity]);

  const otherMemberCount = useMemo(
    () => members.filter((m) => m.user_id !== user?.id).length,
    [members, user?.id],
  );

  const readerCountByMessage = useMemo(() => {
    const map = new Map<string, number>();
    for (const read of reads) {
      if (read.user_id === user?.id) continue;
      map.set(read.message_id, (map.get(read.message_id) ?? 0) + 1);
    }
    return map;
  }, [reads, user?.id]);

  /** ✓ = stored, ✓✓ = read by every other participant. */
  const messageStatus = useCallback(
    (message: Message): MessageStatus => {
      if (otherMemberCount === 0) return "sent";
      const readers = readerCountByMessage.get(message.id) ?? 0;
      return readers >= otherMemberCount ? "read" : "delivered";
    },
    [otherMemberCount, readerCountByMessage],
  );

  const peer = useMemo(() => {
    if (chat?.type !== "direct") return null;
    const other = members.find((m) => m.user_id !== user?.id);
    return other ? live(profiles.get(other.user_id) ?? null) : null;
  }, [chat?.type, members, profiles, user?.id, live]);

  const isSaved = chat?.type === "direct" && members.length === 1;
  const title = isSaved
    ? t("chat.savedMessages")
    : chat?.type === "direct"
      ? (peer?.display_name ?? "Conversation")
      : (chat?.title ?? "Untitled");

  const peerOnline = isUserOnline(peer?.id);
  const presenceLine = isSaved
    ? t("chat.personalSpace")
    : chat?.type === "direct"
      ? peerOnline
        ? t("chat.online")
        : peer?.last_seen
          ? `${t("chat.lastSeen")} ${formatTime(peer.last_seen)}`
          : t("chat.lastSeenRecently")
      : `${members.length} ${t("chat.members")}`;

  // Recording wins over typing, typing wins over the presence line.
  const activityLine = useMemo(() => {
    const entries = Object.values(activity);
    const recording = entries.find((entry) => entry.kind === "recording");
    if (recording) return `${recording.name} ${t("chat.recording")}`;
    const typing = entries.find((entry) => entry.kind === "typing");
    if (typing) return `${typing.name} ${t("chat.typing")}`;
    return null;
  }, [activity, t]);

  const visibleMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((message) => (message.content ?? "").toLowerCase().includes(term));
  }, [messages, search]);

  const sendActivity = useCallback(
    (kind: ActivityKind | "idle") => {
      activityChannel.current?.send({
        type: "broadcast",
        event: "activity",
        payload: { id: user?.id, name: profile?.display_name ?? "Someone", kind },
      });
    },
    [user?.id, profile?.display_name],
  );

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      sendActivity("typing");
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => sendActivity("idle"), 2500);
  }, [sendActivity]);

  const handleRecordingChange = useCallback(
    (recording: boolean) => sendActivity(recording ? "recording" : "idle"),
    [sendActivity],
  );

  useEffect(
    () => () => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    },
    [],
  );

  const send = async ({ content, file }: { content: string; file?: File | undefined }) => {
    if (!user) return;

    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    sendActivity("idle");

    if (editing) {
      const { error } = await supabase
        .from("messages")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      setEditing(null);
      if (error) throw error;
      await load();
      return;
    }

    let attachment: { path: string; name: string; type: string } | null = null;
    if (file) attachment = await uploadMedia(file, user.id);

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: user.id,
      content: content || null,
      reply_to: replyTo?.id ?? null,
      attachment_url: attachment?.path ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
    });
    setReplyTo(null);
    if (error) throw error;
    await load();
  };

  const react = async (message: Message, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(
      (r) => r.message_id === message.id && r.user_id === user.id && r.emoji === emoji,
    );
    const { error } = existing
      ? await supabase.from("message_reactions").delete().eq("id", existing.id)
      : await supabase.from("message_reactions").insert({ message_id: message.id, user_id: user.id, emoji });
    if (error) toast.error("Reaction failed", { description: error.message });
    else await load();
  };

  const remove = async (message: Message) => {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: null, attachment_url: null })
      .eq("id", message.id);
    if (error) toast.error("Could not delete", { description: error.message });
    else await load();
  };

  const pin = async (message: Message) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_pinned: !message.is_pinned })
      .eq("id", message.id);
    if (error) toast.error("Could not pin", { description: error.message });
    else await load();
  };

  if (loading) {
    return (
      <div className="xgram-chat-view flex h-full items-center justify-center bg-chat-canvas">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="xgram-chat-view flex h-full flex-col items-center justify-center gap-3 bg-chat-canvas text-center">
        <p className="text-sm text-muted-foreground">{t("chat.unavailable")}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/chats" })}>
          {t("chat.backToChats")}
        </Button>
      </div>
    );
  }

  return (
    <div className="xgram-chat-view flex h-[100dvh] min-h-0 flex-col bg-chat-canvas">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <Button asChild size="icon" variant="ghost" className="size-9 md:hidden" aria-label={t("common.back")}>
          <Link to="/chats">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </Button>
        <UserAvatar
          name={title}
          src={chat.type === "direct" ? peer?.avatar_url : chat.photo_url}
          className="size-10"
          online={peerOnline}
          showPresence={chat.type === "direct" && !isSaved}
        />
        <div
          className={chat.type === "direct" ? "min-w-0 flex-1" : "min-w-0 flex-1 cursor-pointer"}
          onClick={() => {
            if (chat.type !== "direct") setInfoOpen(true);
          }}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold"><span className="truncate">{title}</span>{(chat.type === "direct" ? peer?.is_verified : chat.type === "channel" && chat.is_verified) ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" /> : null}</p>
          <p
            className={cnPresence(Boolean(activityLine), peerOnline && chat.type === "direct" && !isSaved)}
          >
            {activityLine ? null : peerOnline && chat.type === "direct" && !isSaved ? (
              <span className="inline-block size-1.5 rounded-full bg-success align-middle" />
            ) : null}
            {activityLine ?? presenceLine}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="size-9" onClick={() => setSearchOpen((v) => !v)} aria-label={t("common.search")}>
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </Button>
      </header>
      {chat.type !== "direct" ? (
        <GroupProfileDialog
          open={infoOpen}
          onOpenChange={setInfoOpen}
          chat={chat}
          members={members}
          profiles={Object.fromEntries(profiles)}
          onChanged={() => void load()}
        />
      ) : null}

      {searchOpen ? (
        <div className="border-b border-border bg-card px-3 py-2">
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("chat.searchInChat")}
            className="rounded-full"
          />
        </div>
      ) : null}

      <div className="xgram-message-canvas scroll-slim flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-4">
        {visibleMessages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {search ? t("chat.noSearchResults") : t("chat.noMessages")}
          </p>
        ) : (
          visibleMessages.map((message, index) => {
            const previous = visibleMessages[index - 1];
            const own = message.sender_id === user?.id;
            const grouped: ReactionSummary[] = Object.values(
              reactions
                .filter((r) => r.message_id === message.id)
                .reduce<Record<string, ReactionSummary>>((acc, r) => {
                  const entry = acc[r.emoji] ?? { emoji: r.emoji, count: 0, mine: false };
                  entry.count += 1;
                  if (r.user_id === user?.id) entry.mine = true;
                  acc[r.emoji] = entry;
                  return acc;
                }, {}),
            );

            return (
              <MessageBubble
                key={message.id}
                message={message}
                sender={live(profiles.get(message.sender_id) ?? null)}
                own={own}
                status={messageStatus(message)}
                showAvatar={previous?.sender_id !== message.sender_id}
                replyTo={messages.find((m) => m.id === message.reply_to) ?? null}
                reactions={grouped}
                onReply={setReplyTo}
                onEdit={setEditing}
                onDelete={(m) => void remove(m)}
                onPin={(m) => void pin(m)}
                onReact={(m, emoji) => void react(m, emoji)}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        onSend={send}
        onTyping={broadcastTyping}
        onRecordingChange={handleRecordingChange}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
      />
    </div>
  );
}

function cnPresence(isActivity: boolean, isOnlineNow: boolean) {
  const base = "flex items-center gap-1.5 truncate text-xs";
  if (isActivity) return `${base} text-primary`;
  return `${base} ${isOnlineNow ? "text-success" : "text-muted-foreground"}`;
}
