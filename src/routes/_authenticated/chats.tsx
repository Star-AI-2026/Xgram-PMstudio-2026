import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { useChats } from "@/lib/useChats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "Chats — Xgram" },
      { name: "description", content: "Your Xgram conversations, groups and channels in one place." },
      { property: "og:title", content: "Chats — Xgram" },
      { property: "og:description", content: "Your Xgram conversations, groups and channels in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatsLayout,
});

function ChatsLayout() {
  const { summaries, loading, refresh } = useChats();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeChatId = pathname.startsWith("/chats/") ? pathname.split("/")[2] : undefined;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <div
        className={cn(
          "w-full min-w-0 border-r border-border md:w-80 lg:w-96",
          activeChatId ? "hidden md:block" : "block",
        )}
      >
        <ChatSidebar
          summaries={summaries}
          loading={loading}
          activeChatId={activeChatId}
          onRefresh={() => void refresh()}
        />
      </div>
      <div className={cn("min-w-0 flex-1", activeChatId ? "block" : "hidden md:block")}>
        <Outlet />
      </div>
    </div>
  );
}
