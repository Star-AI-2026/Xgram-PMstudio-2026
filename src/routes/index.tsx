import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, MessagesSquare, Megaphone, Users, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { XgramLogo } from "@/components/XgramLogo";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xgram — Modern messenger for teams and friends" },
      {
        name: "description",
        content:
          "Sign in to Xgram for real-time private chats, groups, channels, voice notes and media sharing with a clean, fast interface.",
      },
      { property: "og:title", content: "Xgram — Modern messenger for teams and friends" },
      {
        property: "og:description",
        content: "Real-time private chats, groups, channels, voice notes and media sharing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Zap, title: "Real-time delivery", text: "Messages, reactions and read receipts arrive instantly." },
  { icon: Users, title: "Groups", text: "Bring people together with roles, pins and shared media." },
  { icon: Megaphone, title: "Channels", text: "Broadcast updates to an audience of any size." },
  { icon: Lock, title: "Private by design", text: "Only chat members can read a conversation. Ever." },
];

function Landing() {
  const { user, loading } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[32rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-accent/25 blur-3xl" />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <XgramLogo size={32} withWordmark />
        <Button asChild variant="ghost">
          <Link to={user ? "/chats" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>

      <section className="relative mx-auto max-w-3xl px-6 pt-14 pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <MessagesSquare className="size-3.5 text-primary" /> Messaging, reimagined
        </span>
        <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Conversations that keep up with you
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Xgram brings private chats, groups, channels, voice notes and file sharing into one calm,
          lightning-fast workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-7">
            <Link to={user ? "/chats" : "/auth"}>{loading ? "Loading…" : user ? "Go to your chats" : "Get started free"}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7">
            <Link to="/auth" search={{ mode: "signup" }}>
              Create an account
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass-panel rounded-2xl p-5 shadow-soft">
              <feature.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
