import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Bell,
  BellOff,
  LogOut,
  MessagesSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Users,
  BadgeCheck,
  Megaphone,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { XgramLogo } from "@/components/XgramLogo";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { usePresence } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { formatTime, type ChatSummary } from "@/lib/xgram";

type Filter = "all" | "unread" | "direct" | "group" | "channel" | "archived";

const FILTERS: { key: Filter; label: TranslationKey; icon: typeof MessagesSquare }[] = [
  { key: "all", label: "filter.all", icon: MessagesSquare },
  { key: "unread", label: "filter.unread", icon: Bell },
  { key: "direct", label: "filter.direct", icon: Bookmark },
  { key: "group", label: "filter.group", icon: Users },
  { key: "channel", label: "filter.channel", icon: Megaphone },
  { key: "archived", label: "filter.archived", icon: Archive },
];

export function ChatSidebar({
  summaries,
  loading,
  activeChatId,
  onRefresh,
  className,
}: {
  summaries: ChatSummary[];
  loading: boolean;
  activeChatId?: string | undefined;
  onRefresh: () => void;
  className?: string | undefined;
}) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isUserOnline, live } = usePresence();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Overlay the freshest profile data so renamed peers and new photos appear instantly.
  const fresh = useMemo(
    () =>
      summaries.map((item) => {
        const peer = live(item.peer);
        if (!peer || item.chat.type !== "direct") return item;
        return {
          ...item,
          peer,
          title: peer.display_name ?? item.title,
          avatarUrl: peer.avatar_url ?? null,
          isVerified: Boolean(peer.is_verified),
        } satisfies ChatSummary;
      }),
    [summaries, live],
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return fresh.filter((item) => {
      if (filter === "archived" ? !item.membership.is_archived : item.membership.is_archived) return false;
      if (filter === "unread" && item.unreadCount === 0) return false;
      if ((filter === "direct" || filter === "group" || filter === "channel") && item.chat.type !== filter)
        return false;
      if (!search) return true;
      return (
        item.title.toLowerCase().includes(search) ||
        (item.lastMessage?.content ?? "").toLowerCase().includes(search) ||
        (item.peer?.username ?? "").toLowerCase().includes(search)
      );
    });
  }, [fresh, filter, query]);

  const toggleMembership = async (item: ChatSummary, patch: Partial<ChatSummary["membership"]>) => {
    const { error } = await supabase.from("chat_members").update(patch).eq("id", item.membership.id);
    if (error) toast.error("Could not update chat", { description: error.message });
    else onRefresh();
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className={cn("xgram-sidebar flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Link to="/chats" className="flex items-center gap-2">
          <XgramLogo size={28} withWordmark />
        </Link>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-9" onClick={() => setDialogOpen(true)} aria-label={t("chat.newChat")}>
            <Plus className="size-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Account menu">
                <UserAvatar
                  name={profile?.display_name ?? "You"}
                  src={profile?.avatar_url}
                  className="size-9"
                  online
                  showPresence
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => void navigate({ to: "/profile" })}>
                <Users className="size-4" /> {t("common.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate({ to: "/contacts" })}>
                <MessagesSquare className="size-4" /> {t("common.contacts")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
                <Settings className="size-4" /> {t("common.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleSignOut()}>
                <LogOut className="size-4" /> {t("common.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("chat.searchChats")}
            className="rounded-full border-transparent bg-sidebar-accent pl-9"
          />
        </div>
      </div>

      <div className="scroll-slim flex gap-1 overflow-x-auto px-3 pb-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === entry.key
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent text-muted-foreground hover:text-foreground",
            )}
          >
            <entry.icon className="size-3.5" />
            {t(entry.label)}
          </button>
        ))}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <MessagesSquare className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {query ? t("chat.nothingMatched") : t("chat.noConversations")}
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> {t("chat.startChat")}
            </Button>
          </div>
        ) : (
          visible.map((item) => (
            <div key={item.chat.id} className="group relative">
              <Link
                to="/chats/$chatId"
                params={{ chatId: item.chat.id }}
                className={cn(
                  "xgram-chat-list-item flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
                  activeChatId === item.chat.id
                    ? "bg-sidebar-primary/15"
                    : "hover:bg-sidebar-accent",
                )}
              >
                <UserAvatar
                  name={item.title}
                  src={item.avatarUrl}
                  online={isUserOnline(item.peer?.id)}
                  showPresence={item.chat.type === "direct"}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</span>
                    {item.isVerified ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
                    {item.membership.is_muted ? (
                      <BellOff className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    {item.membership.is_pinned ? (
                      <Pin className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {item.lastMessage ? formatTime(item.lastMessage.created_at) : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {item.lastMessage
                        ? item.lastMessage.deleted_at
                          ? t("chat.deleted")
                          : (item.lastMessage.content ?? `📎 ${t("chat.attachment")}`)
                        : t("chat.none")}
                    </span>
                    {item.unreadCount > 0 ? (
                      <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
                        {item.unreadCount}
                      </Badge>
                    ) : null}
                  </span>
                </span>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label="Chat options"
                  >
                    <Settings className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => void toggleMembership(item, { is_pinned: !item.membership.is_pinned })}
                  >
                    {item.membership.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    {item.membership.is_pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void toggleMembership(item, { is_muted: !item.membership.is_muted })}
                  >
                    {item.membership.is_muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                    {item.membership.is_muted ? "Unmute" : "Mute"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void toggleMembership(item, { is_archived: !item.membership.is_archived })}
                  >
                    <Archive className="size-4" />
                    {item.membership.is_archived ? "Unarchive" : "Archive"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      <NewChatDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={onRefresh} />
    </aside>
  );
}
