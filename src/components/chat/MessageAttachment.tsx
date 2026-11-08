import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { attachmentKind, getMediaUrl } from "@/lib/media";

export function MessageAttachment({
  path,
  mime,
  name,
}: {
  path: string;
  mime: string | null;
  name: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const kind = attachmentKind(mime);

  useEffect(() => {
    let active = true;
    getMediaUrl(path)
      .then((value) => active && setUrl(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) {
    return <p className="text-xs opacity-70">Attachment unavailable.</p>;
  }

  if (!url) {
    return (
      <div className="flex h-24 w-48 items-center justify-center rounded-xl bg-black/10">
        <Loader2 className="size-4 animate-spin opacity-70" />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <>
        <button type="button" onClick={() => setViewerOpen(true)} className="block overflow-hidden rounded-xl">
          <img
            src={url}
            alt={name ?? "Shared image"}
            loading="lazy"
            className="max-h-72 w-full max-w-xs rounded-xl object-cover transition-transform hover:scale-[1.01]"
          />
        </button>
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">{name ?? "Image"}</DialogTitle>
            <img src={url} alt={name ?? "Shared image"} className="w-full rounded-xl" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (kind === "video") {
    return <video src={url} controls className="max-h-72 w-full max-w-xs rounded-xl" />;
  }

  if (kind === "audio") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2">
        <Play className="size-4 opacity-70" />
        <audio src={url} controls className="h-8 max-w-[220px]" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl bg-black/10 px-3 py-2 transition-colors hover:bg-black/20"
    >
      <FileText className="size-5 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate text-sm">{name ?? "Attachment"}</span>
      <Button size="icon" variant="ghost" className="size-7" tabIndex={-1} aria-label="Download">
        <Download className="size-4" />
      </Button>
    </a>
  );
}
