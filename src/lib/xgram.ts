import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  is_verified: boolean;
  language?: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type ChatType = "direct" | "group" | "channel";

export type ChatPermission = "everyone" | "admins";

export type Chat = {
  id: string;
  type: ChatType;
  title: string | null;
  description: string | null;
  photo_url: string | null;
  username: string | null;
  is_public: boolean;
  is_verified?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  send_messages_policy?: ChatPermission;
  send_media_policy?: ChatPermission;
  send_files_policy?: ChatPermission;
  send_links_policy?: ChatPermission;
};


export type ChatMember = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
  last_read_at: string;
  joined_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  reply_to: string | null;
  is_pinned: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type ChatSummary = {
  chat: Chat;
  membership: ChatMember;
  peer: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
  title: string;
  avatarUrl: string | null;
  isVerified: boolean;
};

export function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 90_000;
}

export function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function formatLastSeen(lastSeen: string | null | undefined) {
  if (!lastSeen) return "offline";
  if (isOnline(lastSeen)) return "online";
  return `last seen ${formatTime(lastSeen)}`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Loads every conversation the signed-in user belongs to, with peer, last message and unread count. */
export async function fetchChatSummaries(userId: string, signal?: AbortSignal): Promise<ChatSummary[]> {
  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select("*")
    .eq("user_id", userId)
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw error;
  const rows = (memberships ?? []) as ChatMember[];
  if (rows.length === 0) return [];

  const chatIds = rows.map((m) => m.chat_id);

  const [chatsRes, othersRes, messagesRes, unreadRes] = await Promise.all([
    supabase.from("chats").select("*").in("id", chatIds).abortSignal(signal ?? new AbortController().signal),
    supabase.from("chat_members").select("*").in("chat_id", chatIds).neq("user_id", userId).abortSignal(signal ?? new AbortController().signal),
    supabase
      .from("messages")
      .select("*")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false })
      .limit(600).abortSignal(signal ?? new AbortController().signal),
    supabase.rpc("unread_counts").abortSignal(signal ?? new AbortController().signal),
  ]);

  for (const result of [chatsRes, othersRes, messagesRes, unreadRes]) {
    if (result.error) throw result.error;
  }

  const chats = (chatsRes.data ?? []) as Chat[];
  const others = (othersRes.data ?? []) as ChatMember[];
  const messages = (messagesRes.data ?? []) as Message[];
  const unreadByChat = new Map<string, number>(
    ((unreadRes.data ?? []) as { chat_id: string; unread_count: number }[]).map((row) => [
      row.chat_id,
      Number(row.unread_count),
    ]),
  );

  const peerIds = Array.from(new Set(others.map((m) => m.user_id)));
  let profiles: Profile[] = [];
  if (peerIds.length) {
    const { data, error: profilesError } = await supabase.from("profiles").select("*").in("id", peerIds).abortSignal(signal ?? new AbortController().signal);
    if (profilesError) throw profilesError;
    profiles = (data ?? []) as Profile[];
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return chats
    .flatMap((chat) => {
      const membership = rows.find((m) => m.chat_id === chat.id);
      if (!membership) return [];
      const chatMessages = messages.filter((m) => m.chat_id === chat.id);
      const lastMessage = chatMessages[0] ?? null;
      const peerMember = others.find((m) => m.chat_id === chat.id);
      const peer = chat.type === "direct" && peerMember ? (profileById.get(peerMember.user_id) ?? null) : null;
      // Unread is always derived from the database (per-message read receipts).
      const unreadCount = unreadByChat.get(chat.id) ?? 0;

      return [{
        chat,
        membership,
        peer,
        lastMessage,
        unreadCount,
        title: chat.type === "direct" ? (peer?.display_name ?? "Saved Messages") : (chat.title ?? "Untitled"),
        avatarUrl: chat.type === "direct" ? (peer?.avatar_url ?? null) : chat.photo_url,
        isVerified: chat.type === "direct" ? Boolean(peer?.is_verified) : chat.type === "channel" && Boolean(chat.is_verified),
      } satisfies ChatSummary];
    })
    .sort((a, b) => {
      if (a.membership.is_pinned !== b.membership.is_pinned) return a.membership.is_pinned ? -1 : 1;
      const aTime = a.lastMessage?.created_at ?? a.chat.updated_at;
      const bTime = b.lastMessage?.created_at ?? b.chat.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

/** Returns an existing 1:1 chat with the given user, or creates one. */
export async function getOrCreateDirectChat(userId: string, peerId: string): Promise<string> {
  const { data: mine } = await supabase.from("chat_members").select("chat_id").eq("user_id", userId);
  const myChatIds = (mine ?? []).map((m) => m.chat_id as string);

  if (myChatIds.length) {
    const { data: shared } = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", peerId)
      .in("chat_id", myChatIds);
    const sharedIds = (shared ?? []).map((m) => m.chat_id as string);
    if (sharedIds.length) {
      const { data: directChats } = await supabase
        .from("chats")
        .select("id")
        .eq("type", "direct")
        .in("id", sharedIds);
      const existing = (directChats ?? [])[0];
      if (existing) return existing.id as string;
    }
  }

  const { data: newId, error } = await supabase.rpc("create_chat_with_members", {
    _type: "direct",
    _member_ids: [peerId],
  });
  if (error) throw error;
  return newId as string;
}

export async function createGroupChat(
  _userId: string,
  input: { title: string; description?: string; type: "group" | "channel"; memberIds: string[] },
) {
  const { data: newId, error } = await supabase.rpc("create_chat_with_members", {
    _type: input.type,
    _title: input.title,
    ...(input.description ? { _description: input.description } : {}),
    _member_ids: input.memberIds,
  });
  if (error) throw error;
  return newId as string;
}


export type MessageRead = {
  id: string;
  message_id: string;
  chat_id: string;
  user_id: string;
  read_at: string;
};

/**
 * Marks every message in a chat that the current user has not read yet as read.
 * Runs atomically in the database, skips own messages and never duplicates rows.
 */
export async function markMessagesAsRead(chatId: string): Promise<number> {
  const { data, error } = await supabase.rpc("mark_messages_as_read", { _chat_id: chatId });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Loads read receipts for the given messages. */
export async function fetchMessageReads(chatId: string): Promise<MessageRead[]> {
  const { data, error } = await supabase.from("message_reads").select("*").eq("chat_id", chatId);
  if (error) throw error;
  return (data ?? []) as MessageRead[];
}
