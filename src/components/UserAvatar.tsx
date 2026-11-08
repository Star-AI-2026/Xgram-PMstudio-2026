import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/xgram";

/**
 * Avatars are kept in private storage, so `src` is normally a storage path.
 * This resolves it to a temporary signed URL (cached per path) and re-resolves
 * whenever the stored path changes, which is what makes new photos appear
 * immediately instead of showing a stale image.
 */
function useResolvedSrc(src: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    if (/^(https?:|data:|blob:)/.test(src)) {
      setUrl(src);
      return;
    }
    let active = true;
    void getMediaUrl(src)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [src]);

  return url;
}

export function UserAvatar({
  name,
  src,
  online = false,
  className,
  showPresence = false,
}: {
  name: string;
  src?: string | null | undefined;
  online?: boolean | undefined;
  className?: string | undefined;
  showPresence?: boolean | undefined;
}) {
  const resolved = useResolvedSrc(src);

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn("size-11 border border-border/60", className)}>
        {resolved ? <AvatarImage key={resolved} src={resolved} alt={name} /> : null}
        <AvatarFallback className="brand-gradient font-semibold text-primary-foreground">
          {initialsOf(name) || "?"}
        </AvatarFallback>
      </Avatar>
      {showPresence ? (
        <span
          className={cn(
            "absolute end-0 bottom-0 size-3 rounded-full border-2 border-background transition-colors",
            online ? "bg-success" : "bg-muted-foreground/50",
          )}
          aria-label={online ? "online" : "offline"}
        />
      ) : null}
    </span>
  );
}
