import { Check, CheckCheck, Pencil, Pin, Reply, SmilePlus, Trash2, Copy, MoreVertical, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { MessageAttachment } from "@/components/chat/MessageAttachment";
import { cn } from "@/lib/utils";
import { formatTime, type Message, type Profile } from "@/lib/xgram";
import { usePresence } from "@/lib/presence";

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "🙏", "🎉"];

export type MessageStatus = "sent" | "delivered" | "read";

export function MessageBubble({
  message,
  sender,
  own,
  status,
  showAvatar,
  replyTo,
  reactions,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
}: {
  message: Message;
  sender: Profile | null;
  own: boolean;
  status: MessageStatus;
  showAvatar: boolean;
  replyTo: Message | null;
  reactions: ReactionSummary[];
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}) {
  const deleted = Boolean(message.deleted_at);
  const { live } = usePresence();
  const freshSender = live(sender);

  return (
    <div className={cn("group flex w-full gap-2 px-3", own ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">
        {!own && showAvatar ? (
          <UserAvatar
            name={freshSender?.display_name ?? "Unknown"}
            src={freshSender?.avatar_url}
            className="size-8"
          />
        ) : null}
      </div>

      <div className={cn("flex max-w-[min(78%,34rem)] flex-col gap-1", own ? "items-end" : "items-start")}>
        {!own && showAvatar ? (
          <span className="flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground">
            {freshSender?.display_name ?? "Unknown"}
            {freshSender?.is_verified ? <BadgeCheck className="size-3.5 text-primary" aria-label="Verified" /> : null}
          </span>
        ) : null}

        <div
          className={cn(
            "xgram-message-bubble animate-bubble-in relative rounded-2xl px-3 py-2 shadow-soft",
            own
              ? "xgram-message-own rounded-br-md bg-bubble-out text-bubble-out-foreground"
              : "xgram-message-incoming rounded-bl-md bg-bubble-in text-bubble-in-foreground",
            deleted && "opacity-70 italic",
          )}
        >
          {replyTo && !deleted ? (
            <div
              className={cn(
                "mb-1 rounded-lg border-l-2 px-2 py-1 text-xs",
                own ? "border-primary-foreground/60 bg-black/10" : "border-primary bg-black/5",
              )}
            >
              <span className="line-clamp-2 opacity-80">
                {replyTo.deleted_at ? "Deleted message" : (replyTo.content ?? "Attachment")}
              </span>
            </div>
          ) : null}

          {deleted ? (
            <p className="text-sm">This message was deleted</p>
          ) : (
            <>
              {message.attachment_url ? (
                <div className="mb-1">
                  <MessageAttachment
                    path={message.attachment_url}
                    mime={message.attachment_type}
                    name={message.attachment_name}
                  />
                </div>
              ) : null}
              {message.content ? (
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              ) : null}
            </>
          )}

          <span
            className={cn(
              "mt-1 flex items-center justify-end gap-1 text-[10px]",
              own ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {message.is_pinned ? <Pin className="size-3" /> : null}
            {message.edited_at && !deleted ? <span>edited</span> : null}
            {formatTime(message.created_at)}
            {own && !deleted ? (
              status === "sent" ? (
                <Check className="size-3.5 opacity-70" aria-label="Sent" />
              ) : (
                <CheckCheck
                  className={cn("size-3.5", status === "read" ? "text-read-receipt" : "opacity-70")}
                  aria-label={status === "read" ? "Read" : "Delivered"}
                />
              )
            ) : null}
          </span>
        </div>

        {reactions.length ? (
          <div className={cn("flex flex-wrap gap-1", own ? "justify-end" : "justify-start")}>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onReact(message, reaction.emoji)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs transition-colors",
                  reaction.mine
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!deleted ? (
        <div className="self-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Message actions">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={own ? "end" : "start"} className="w-48">
              <div className="flex justify-between px-2 py-1.5">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-md px-1 text-lg transition-transform hover:scale-125"
                    onClick={() => onReact(message, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply className="size-4" /> Reply
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(message.content ?? "");
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="size-4" /> Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPin(message)}>
                <Pin className="size-4" /> {message.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              {own ? (
                <>
                  <DropdownMenuItem onClick={() => onEdit(message)}>
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(message)}>
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => onReact(message, "👍")}>
                  <SmilePlus className="size-4" /> React 👍
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="w-7" />
      )}
    </div>
  );
}
