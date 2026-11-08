import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/chats/")({
  head: () => ({
    meta: [
      { title: "Choose a conversation — Xgram" },
      { name: "description", content: "Choose an Xgram conversation to view messages." },
      { property: "og:title", content: "Choose a conversation — Xgram" },
      { property: "og:description", content: "Choose an Xgram conversation to view messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmptyState,
});

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-chat-canvas px-6 text-center">
      <span className="brand-gradient flex size-16 items-center justify-center rounded-2xl shadow-soft">
        <MessagesSquare className="size-8 text-primary-foreground" />
      </span>
      <h1 className="font-display text-xl font-semibold">{t("chat.selectConversation")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("chat.selectHint")}</p>
    </div>
  );
}
