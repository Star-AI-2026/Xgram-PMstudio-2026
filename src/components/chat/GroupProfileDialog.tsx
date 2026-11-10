import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, Search, ShieldCheck, ShieldMinus, UserPlus, BadgeCheck } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePresence } from "@/lib/presence";
import { uploadMedia } from "@/lib/media";
import {
  getOrCreateDirectChat,
  type Chat,
  type ChatMember,
  type ChatPermission,
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

const PERMISSION_FIELDS = [
  { column: "send_messages_policy", label: "group.whoCanSend" },
  { column: "send_media_policy", label: "group.whoCanMedia" },
  { column: "send_files_policy", label: "group.whoCanFiles" },
  { column: "send_links_policy", label: "group.whoCanLinks" },
] as const;

export function GroupProfileDialog({ open, onOpenChange, chat, members, profiles, onChanged }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isUserOnline, live } = usePresence();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(chat.title ?? "");
  const [description, setDescription] = useState(chat.description ?? "");
  const [permissions, setPermissions] = useState<Record<string, ChatPermission>>({
    send_messages_policy: chat.send_messages_policy ?? "everyone",
    send_media_policy: chat.send_media_policy ?? "everyone",
    send_files_policy: chat.send_files_policy ?? "everyone",
    send_links_policy: chat.send_links_policy ?? "everyone",
  });

  useEffect(() => {
    setTitle(chat.title ?? "");
    setDescription(chat.description ?? "");
    setPermissions({
      send_messages_policy: chat.send_messages_policy ?? "everyone",
      send_media_policy: chat.send_media_policy ?? "everyone",
      send_files_policy: chat.send_files_policy ?? "everyone",
      send_links_policy: chat.send_links_policy ?? "everyone",
    });
  }, [chat]);

  // --- Add members -------------------------------------------------------
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  useEffect(() => {
    if (!open || !canManage) return;
    let active = true;
    const timer = setTimeout(async () => {
      let request = supabase.from("profiles").select("*").limit(30);
      if (query.trim()) {
        request = request.or(`display_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`);
      }
      const { data } = await request;
      if (!active) return;
      setPeople(((data ?? []) as Profile[]).filter((p) => !memberIds.has(p.id)));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, canManage, memberIds]);

  const saveInfo = useCallback(async () => {
    setBusy(true);
    const { error } = await supabase
      .from("chats")
      .update({
        title: title.trim() || null,
        description: description.trim() || null,
        ...permissions,
      })
      .eq("id", chat.id);
    setBusy(false);
    if (error) {
      toast.error(t("group.noPermission"), { description: error.message });
      return;
    }
    toast.success(t("group.saved"));
    onChanged();
  }, [chat.id, title, description, permissions, onChanged, t]);

  const changePhoto = useCallback(
    async (file: File) => {
      if (!user) return;
      setBusy(true);
      try {
        const uploaded = await uploadMedia(file, user.id);
        const { error } = await supabase.from("chats").update({ photo_url: uploaded.path }).eq("id", chat.id);
        if (error) throw error;
        toast.success(t("group.saved"));
        onChanged();
      } catch (error) {
        toast.error(t("group.noPermission"), {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [chat.id, user, onChanged, t],
  );

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{chat.type === "channel" ? t("group.channelInfo") : t("group.info")}</DialogTitle>
          <DialogDescription>{chat.title ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="relative">
            <UserAvatar name={chat.title ?? "Chat"} src={chat.photo_url} className="size-16" />
            {canManage ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -end-1 rounded-full bg-primary p-1.5 text-primary-foreground"
                aria-label={t("group.photo")}
              >
                <Camera className="size-3.5" />
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void changePhoto(file);
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{chat.title}</span>{chat.type === "channel" && chat.is_verified ? <BadgeCheck className="size-4 text-primary" aria-label="Verified" /> : null}</p>
            <p className="text-sm text-muted-foreground">
              {members.length} {chat.type === "channel" ? t("group.members") : t("group.members")}
            </p>
          </div>
        </div>

        <Tabs defaultValue="members" className="mt-2">
          <TabsList className={canManage ? "grid w-full grid-cols-3" : "grid w-full grid-cols-1"}>
            <TabsTrigger value="members">{t("group.members")}</TabsTrigger>
            {canManage ? <TabsTrigger value="add">{t("group.addMembers")}</TabsTrigger> : null}
            {canManage ? <TabsTrigger value="edit">{t("group.edit")}</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="members" className="space-y-1">
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
                    <p className="flex items-center gap-1 text-sm font-medium"><span className="truncate">{name}</span>{profile?.is_verified ? <BadgeCheck className="size-4 text-primary" aria-label="Verified" /> : null}</p>
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
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {people.map((person) => (
                  <label
                    key={person.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={selected.includes(person.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, person.id] : prev.filter((id) => id !== person.id),
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
              <Button className="w-full" disabled={busy || !selected.length} onClick={() => void addMembers()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}{" "}
                {t("group.add")}
              </Button>
            </TabsContent>
          ) : null}

          {canManage ? (
            <TabsContent value="edit" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">{t("group.name")}</Label>
                <Input id="group-name" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">{t("group.description")}</Label>
                <Textarea
                  id="group-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">{t("group.permissions")}</p>
                {PERMISSION_FIELDS.map((field) => (
                  <div key={field.column} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t(field.label)}</span>
                    <Select
                      value={permissions[field.column] ?? "everyone"}
                      onValueChange={(value) =>
                        setPermissions((prev) => ({ ...prev, [field.column]: value as ChatPermission }))
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">{t("group.everyone")}</SelectItem>
                        <SelectItem value="admins">{t("group.adminsOnly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Button className="w-full" disabled={busy} onClick={() => void saveInfo()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("group.saved")}
              </Button>
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
