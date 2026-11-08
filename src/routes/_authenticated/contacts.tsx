import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Loader2, MessageSquarePlus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getOrCreateDirectChat } from "@/lib/xgram";
import { useI18n } from "@/lib/i18n";
import { usePresence } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — Xgram" },
      { name: "description", content: "Find people on Xgram and start a private conversation instantly." },
      { property: "og:title", content: "Contacts — Xgram" },
      { property: "og:description", content: "Find people on Xgram and start a private conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isUserOnline } = usePresence();
  type ContactResult = {
    id: string; username: string; display_name: string; avatar_url: string | null;
    is_verified: boolean; last_seen: string;
  };
  const [people, setPeople] = useState<ContactResult[]>([]);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestId = useRef(0);
  const searchedQuery = useRef("");

  const search = async () => {
    const term = query.trim();
    const current = ++requestId.current;
    searchedQuery.current = "";
    setPeople([]);
    setSearched(false);
    setLoading(false);
    const usernameValid = /^@[a-zA-Z0-9_]{3,32}$/.test(term);
    const emailValid = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(term) && term.length <= 254;
    if (!usernameValid && !emailValid) {
      setError(t("contacts.invalid"));
      return;
    }
    searchedQuery.current = term;
    setError("");
    setSearched(true);
    setLoading(true);
    try {
      const { data, error: searchError } = await supabase.rpc("search_xgram_contacts", { _query: term });
      if (current !== requestId.current) return;
      if (searchError) throw searchError;
      setPeople((data ?? []) as ContactResult[]);
    } catch {
      if (current === requestId.current) setError(t("contacts.searchError"));
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const resync = (event: Event) => {
      const term = searchedQuery.current;
      if (!term) return;
      const current = ++requestId.current;
      const task = Promise.resolve(supabase.rpc("search_xgram_contacts", { _query: term }).then(({ data, error: searchError }) => {
        if (current !== requestId.current) return;
        if (searchError) throw searchError;
        setPeople((data ?? []) as ContactResult[]);
      }));
      (event as CustomEvent<{ waitUntil?: (task: Promise<unknown>) => void }>).detail?.waitUntil?.(task);
    };
    window.addEventListener("xgram:resync", resync);
    return () => window.removeEventListener("xgram:resync", resync);
  }, []);

  const openChat = async (person: ContactResult) => {
    if (!user) return;
    setBusyId(person.id);
    try {
      const chatId = await getOrCreateDirectChat(user.id, person.id);
      void navigate({ to: "/chats/$chatId", params: { chatId } });
    } catch (error) {
      toast.error("Could not open chat", { description: (error as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button asChild size="icon" variant="ghost" className="size-9" aria-label={t("common.back")}>
          <Link to="/chats">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-semibold">{t("contacts.title")}</h1>
      </header>

      <form className="flex gap-2 p-3" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              requestId.current++;
              searchedQuery.current = "";
              setQuery(event.target.value);
              setPeople([]);
              setSearched(false);
              setError("");
              setLoading(false);
            }}
            placeholder={t("contacts.searchPlaceholder")}
            aria-label={t("contacts.searchPlaceholder")}
            aria-invalid={Boolean(error)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          <Search className="size-4" /> {t("common.search")}
        </Button>
      </form>
      {error && <p role="alert" className="px-4 pb-2 text-sm text-destructive">{error}</p>}

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : searched && people.length === 0 && !error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("contacts.empty")}</p>
        ) : (
          people.map((person) => {
            return (
            <div key={person.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-accent/60">
              <UserAvatar
                name={person.display_name}
                src={person.avatar_url}
                online={isUserOnline(person.id)}
                showPresence
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  {person.display_name}
                  {person.is_verified ? <BadgeCheck className="size-4 text-primary" /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{person.username} · {isUserOnline(person.id) ? t("chat.online") : t("chat.offline")}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void openChat(person)} disabled={busyId === person.id}>
                {busyId === person.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="size-4" />
                )}
                {t("contacts.message")}
              </Button>
            </div>
            );
          })
        )}
      </div>
    </main>
  );
}
