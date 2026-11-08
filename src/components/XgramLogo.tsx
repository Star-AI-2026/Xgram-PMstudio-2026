import logo from "@/assets/xgram-logo.png";
import { cn } from "@/lib/utils";

export function XgramLogo({
  className,
  size = 32,
  withWordmark = false,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={logo}
        alt="Xgram logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 drop-shadow-sm"
      />
      {withWordmark ? (
        <span className="font-display text-xl font-semibold tracking-tight">Xgram</span>
      ) : null}
    </span>
  );
}
