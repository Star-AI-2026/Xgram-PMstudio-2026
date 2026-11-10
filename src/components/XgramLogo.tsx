import logo from "@/assets/xgram-logo-tight.png";
import { cn } from "@/lib/utils";

export function XgramLogo({
  className,
  size = 32,
  withWordmark = false,
  wordmarkText = "Xgram",
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  wordmarkText?: string;
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
        <span className="font-display text-xl font-semibold tracking-tight">{wordmarkText}</span>
      ) : null}
    </span>
  );
}
