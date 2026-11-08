import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createGroupChat, getOrCreateDirectChat, isOnline, type Profile } from "@/lib/xgram";

export function NewChatDialog({
  open,
  onOpenChange,
  onCreated,
  defaultTab = "direct",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultTab?: "direct" | "group" | "channel";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      let request = supabase.from("profiles").select("*").neq("id", user.id).limit(30);
      if (query.trim()) {
        request = request.or(`display_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`);
      }
      const { data } = await request;
      if (!active) return;
      setPeople((data ?? []) as Profile[]);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, user]);

  const startDirect = async (peer: Profile) => {
    if (!user) return;
    setBusy(true);
    try {
      const chatId = await getOrCreateDirectChat(user.id, peer.id);
      onOpenChange(false);
      onCreated?.();
      void navigate({ to: "/chats/$chatId", params: { chatId } });
    } catch (error) {
      toast.error("Could not start the chat", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async (type: "group" | "channel") => {
    if (!user) return;
    if (!title.trim()) {
      toast.error(`Please name your ${type}`);
      return;
    }
    setBusy(true);
    try {
      const chatId = await createGroupChat(user.id, { title: title.trim(), type, memberIds: selected });
      setTitle("");
      setSelected([]);
      onOpenChange(false);
      onCreated?.();
      void navigate({ to: "/chats/$chatId", params: { chatId } });
    } catch (error) {
      toast.error(`Could not create the ${type}`, { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const peopleList = (mode: "direct" | "multi") => (
    <div className="scroll-slim max-h-64 space-y-1 overflow-y-auto pr-1">
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : people.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No people found.</p>
      ) : (
        people.map((person) => (
          <button
            key={person.id}
            type="button"
            disabled={busy}
            onClick={() =>
              mode === "direct"
                ? void startDirect(person)
                : setSelected((prev) =>
                    prev.includes(person.id) ? prev.filter((id) => id !== person.id) : [...prev, person.id],
                  )
            }
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
          >
            <UserAvatar
              name={person.display_name}
              src={person.avatar_url}
              online={isOnline(person.last_seen)}
              showPresence
              className="size-10"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{person.display_name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
            </span>
            {mode === "multi" ? <Checkbox checked={selected.includes(person.id)} /> : null}
          </button>
        ))
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start something new</DialogTitle>
          <DialogDescription>Message a person, or spin up a group or channel.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">
              Chat
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1">
              Group
            </TabsTrigger>
            <TabsTrigger value="channel" className="flex-1">
              Channel
            </TabsTrigger>
          </TabsList>

          <div className="relative mt-4">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people by name or @username"
              className="pl-9"
            />
          </div>

          <TabsContent value="direct" className="mt-3">
            {peopleList("direct")}
          </TabsContent>

          {(["group", "channel"] as const).map((type) => (
            <TabsContent key={type} value={type} className="mt-3 space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder={type === "group" ? "Group name" : "Channel name"}
              />
              {peopleList("multi")}
              <Button className="w-full" disabled={busy} onClick={() => void createRoom(type)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
                Create {type} {selected.length ? `with ${selected.length}` : ""}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
