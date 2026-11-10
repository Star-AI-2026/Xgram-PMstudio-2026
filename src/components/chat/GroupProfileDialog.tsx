import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search, ShieldCheck, ShieldMinus, UserPlus, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePresence } from "@/lib/presence";
import {
  getOrCreateDirectChat,
  type Chat,
  type ChatMember,
  type Profile,
} from "@/lib/xgram";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: Chat;
  members: ChatMember[];
  profiles: Record<string, Profile>;
  onChanged: () => void;
};

export function GroupProfileDialog({ open, onOpenChange, chat, members, profiles, onChanged }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isUserOnline, live } = usePresence();
  const navigate = useNavigate();

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  // Do not reveal a directory of all users. Search only after three characters.
  useEffect(() => {
    const term = query.trim();
    if (!open || !canManage || term.length < 3) {
      setPeople([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      const safeTerm = term.replace(/[,%()]/g, " ").trim();
      if (safeTerm.length < 3) {
        if (active) setPeople([]);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`display_name.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%`)
        .limit(30);
      if (!active) return;
      if (error) {
        setPeople([]);
        return;
      }
      setPeople(((data ?? []) as Profile[]).filter((person) => !memberIds.has(person.id)));
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, open, canManage, memberIds]);

  const setRole = useCallback(
    async (userId: string, role: "admin" | "member") => {
      setBusy(true);
      const { error } = await supabase.rpc("set_member_role", {
        _chat_id: chat.id,
        _user_id: userId,
        _role: role,
      });
      setBusy(false);
      if (error) {
        toast.error(t("group.noPermission"), { description: error.message });
        return;
      }
      toast.success(role === "admin" ? t("group.adminAdded") : t("group.adminRemoved"));
      onChanged();
    },
    [chat.id, onChanged, t],
  );

  const addMembers = useCallback(async () => {
    if (!selected.length) return;
    setBusy(true);
    const { error } = await supabase.rpc("add_chat_members", {
      _chat_id: chat.id,
      _member_ids: selected,
    });
    setBusy(false);
    if (error) {
      toast.error(t("group.noPermission"), { description: error.message });
      return;
    }
    setSelected([]);
    setQuery("");
    setPeople([]);
    toast.success(t("group.membersAdded"));
    onChanged();
  }, [chat.id, selected, onChanged, t]);

  const openPersonalPage = useCallback(
    async (peerId: string) => {
      if (!user || peerId === user.id) return;
      try {
        const directId = await getOrCreateDirectChat(user.id, peerId);
        onOpenChange(false);
        void navigate({ to: "/chats/$chatId", params: { chatId: directId } });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open chat");
      }
    },
    [user, navigate, onOpenChange],
  );

  const sortedMembers = useMemo(() => {
    const weight = { owner: 0, admin: 1, member: 2 } as const;
    return [...members].sort((a, b) => weight[a.role] - weight[b.role]);
  }, [members]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[101] max-h-[85vh] overflow-y-auto border-border bg-card text-card-foreground shadow-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{chat.type === "channel" ? t("group.channelInfo") : t("group.info")}</DialogTitle>
          <DialogDescription>{chat.title ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3">
          <UserAvatar name={chat.title ?? "Chat"} src={chat.photo_url} className="size-14" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold">
              <span className="truncate">{chat.title}</span>
              {chat.type === "channel" && chat.is_verified ? (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">
              {members.length} {t("group.members")}
            </p>
            {chat.description ? <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{chat.description}</p> : null}
          </div>
        </div>

        <Tabs defaultValue="members" className="mt-2">
          <TabsList className={canManage ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            <TabsTrigger value="members">{t("group.members")}</TabsTrigger>
            {canManage ? <TabsTrigger value="add">{t("group.addMembers")}</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="members" className="max-h-[45vh] space-y-1 overflow-y-auto">
            {sortedMembers.map((member) => {
              const profile = live(profiles[member.user_id]);
              const name = profile?.display_name ?? "Member";
              return (
                <div key={member.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
                  <UserAvatar
                    name={name}
                    src={profile?.avatar_url}
                    className="size-10"
                    online={isUserOnline(member.user_id)}
                    showPresence
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start"
                    onClick={() => void openPersonalPage(member.user_id)}
                    title={t("group.goToPersonalPage")}
                  >
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <span className="truncate">{name}</span>
                      {profile?.is_verified ? <BadgeCheck className="size-4 text-primary" aria-label="Verified" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.role === "owner"
                        ? t("group.owner")
                        : member.role === "admin"
                          ? t("group.admin")
                          : profile?.username
                            ? `@${profile.username}`
                            : ""}
                    </p>
                  </button>
                  {isOwner && member.user_id !== user?.id && member.role !== "owner" ? (
                    member.role === "admin" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void setRole(member.user_id, "member")}
                      >
                        <ShieldMinus className="size-4" /> {t("group.removeAdmin")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void setRole(member.user_id, "admin")}
                      >
                        <ShieldCheck className="size-4" /> {t("group.addAdmin")}
                      </Button>
                    )
                  ) : null}
                </div>
              );
            })}
          </TabsContent>

          {canManage ? (
            <TabsContent value="add" className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("group.searchUsers")}
                  className="ps-9"
                />
              </div>
              {query.trim().length < 3 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Type at least 3 characters to search for people.</p>
              ) : people.length ? (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {people.map((person) => (
                    <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
                      <Checkbox
                        checked={selected.includes(person.id)}
                        onCheckedChange={(checked) =>
                          setSelected((previous) =>
                            checked ? [...previous, person.id] : previous.filter((id) => id !== person.id),
                          )
                        }
                      />
                      <UserAvatar name={person.display_name} src={person.avatar_url} className="size-9" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{person.display_name}</p>
                        <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No matching people found.</p>
              )}
              <Button className="w-full" disabled={busy || !selected.length} onClick={() => void addMembers()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} {t("group.add")}
              </Button>
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
