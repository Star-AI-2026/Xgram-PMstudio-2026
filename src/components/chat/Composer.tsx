import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/xgram";

// This shareable demo is intentionally read-only: no message payload can be sent.
const DEMO_DISABLE_MESSAGE_SENDING = true;

const EMOJIS = [
  "😀","😂","😍","😎","🤔","😴","👍","🙏","🔥","🎉","❤️","✨","💡","✅","🚀","📎","🎧","📷","😅","😇",
];

export function Composer({
  onSend,
  onTyping,
  onRecordingChange,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  disabled,
}: {
  onSend: (payload: { content: string; file?: File | undefined }) => Promise<void>;
  onTyping: () => void;
  onRecordingChange?: ((recording: boolean) => void) | undefined;
  replyTo: Message | null;
  onCancelReply: () => void;
  editing: Message | null;
  onCancelEdit: () => void;
  disabled?: boolean | undefined;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (editing) {
      setValue(editing.content ?? "");
      textareaRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Tell the other side when recording starts and stops, and always clear it on unmount.
  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(
    () => () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // recorder already stopped
      }
      onRecordingChange?.(false);
    },
    [onRecordingChange],
  );

  const submit = async () => {
    if (DEMO_DISABLE_MESSAGE_SENDING || sending || disabled) return;
    if (!value.trim() && !file) return;
    setSending(true);
    try {
      await onSend({ content: value.trim(), file: file ?? undefined });
      setValue("");
      setFile(null);
    } catch (error) {
      toast.error("Message not sent", { description: (error as Error).message });
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        setFile(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable", { description: "Allow microphone access to record voice notes." });
    }
  };

  return (
    <div className="composer-shell">
      {replyTo || editing ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <span className="font-medium text-primary">{editing ? "Editing" : "Replying to"}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {(editing ?? replyTo)?.content ?? t("chat.attachment")}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setValue("");
              } else {
                onCancelReply();
              }
            }}
            aria-label={t("common.cancel")}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {file ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <Paperclip className="size-3.5 text-primary" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-muted-foreground">{formatBytes(file.size)}</span>
          <Button size="icon" variant="ghost" className="size-6" onClick={() => setFile(null)} aria-label="Remove file">
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {sending ? <Progress value={70} className="h-0.5 rounded-none" /> : null}

      <div className="composer-inner flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) setFile(selected);
            event.target.value = "";
          }}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-9 shrink-0" aria-label="Emoji">
              <span className="text-lg">🙂</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-md p-1 text-lg transition-transform hover:scale-125"
                  onClick={() => setValue((prev) => prev + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="size-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={recording ? `${t("chat.recording")} ${seconds}s` : value}
          disabled={recording}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={t("chat.writeMessage")}
          rows={1}
          className={cn(
            "composer-input max-h-40 min-h-11 flex-1 resize-none rounded-[1.4rem] border-border bg-background/80 py-2.5",
            recording && "text-destructive",
          )}
        />

        {value.trim() || file ? (
          <Button
            size="icon"
            className="size-10 shrink-0 rounded-full"
            onClick={() => void submit()}
            disabled={DEMO_DISABLE_MESSAGE_SENDING || sending}
            title={DEMO_DISABLE_MESSAGE_SENDING ? "Message sending is disabled in this demo" : undefined}
            aria-label={t("chat.sendMessage")}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:rotate-180" />}
          </Button>
        ) : (
          <Button
            size="icon"
            variant={recording ? "destructive" : "default"}
            className="size-10 shrink-0 rounded-full"
            onClick={() => (recording ? recorderRef.current?.stop() : void startRecording())}
            aria-label={recording ? "Stop recording" : "Record voice message"}
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
