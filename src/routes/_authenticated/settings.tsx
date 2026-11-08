import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, Check, Globe, Layers, LogOut, Monitor, Moon, Sparkles, Sun, User, Waves } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { LANGUAGES, useI18n, type Language, type TranslationKey } from "@/lib/i18n";
import { useTheme, type ThemeMode, type VisualStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Xgram" },
      { name: "description", content: "Manage your Xgram appearance, notifications, language and account." },
      { property: "og:title", content: "Settings — Xgram" },
      { property: "og:description", content: "Manage appearance, notifications, language and account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const THEMES: { value: ThemeMode; key: "settings.light" | "settings.dark" | "settings.system"; icon: typeof Sun }[] = [
  { value: "light", key: "settings.light", icon: Sun },
  { value: "dark", key: "settings.dark", icon: Moon },
  { value: "system", key: "settings.system", icon: Monitor },
];

function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const { theme, setTheme, visualStyle, setVisualStyle } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const [sounds, setSounds] = useState(true);

  const currentLabel = LANGUAGES.find((entry) => entry.code === language)?.label ?? "English";

  const pickLanguage = (next: Language) => {
    if (next === language) return;
    setLanguage(next);
    toast.success(next === "fa" ? "زبان با موفقیت تغییر کرد" : "Language changed successfully");
  };

  const toggleNotifications = async (next: boolean) => {
    if (!next) {
      setNotifications(false);
      return;
    }
    if (typeof Notification === "undefined") {
      toast.error("Notifications aren't supported in this browser");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifications(permission === "granted");
    if (permission !== "granted") toast.error("Notification permission was declined");
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-xl flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button asChild size="icon" variant="ghost" className="size-9" aria-label={t("chat.backToChats")}>
          <Link to="/chats">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-semibold">{t("settings.title")}</h1>
      </header>

      <div className="scroll-slim min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <Link to="/profile" className="flex items-center gap-3 rounded-2xl border border-border p-4 hover:bg-accent/60">
          <UserAvatar name={profile?.display_name ?? "You"} src={profile?.avatar_url} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.display_name ?? t("common.profile")}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{profile?.username ?? "username"} · {user?.email}
            </p>
          </div>
          <User className="size-4 text-muted-foreground" />
        </Link>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Globe className="size-3.5" /> {t("common.languages")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.currentLanguage")}: <span className="font-medium text-foreground">{currentLabel}</span>
          </p>
          <div className="overflow-hidden rounded-2xl border border-border">
            {LANGUAGES.map((entry, index) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => pickLanguage(entry.code)}
                className={cn(
                  "flex w-full items-center gap-3 p-4 text-start text-sm transition-colors hover:bg-accent",
                  index > 0 && "border-t border-border",
                  language === entry.code && "bg-primary/10",
                )}
              >
                <span className="text-lg">{entry.flag}</span>
                <span className="flex-1 font-medium">{entry.label}</span>
                {language === entry.code ? <Check className="size-4 text-primary" /> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("settings.appearance")}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setTheme(entry.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition-colors",
                  theme === entry.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <entry.icon className="size-5" />
                {t(entry.key)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Sparkles className="size-3.5" /> {t("settings.visualStyle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.visualStyleHint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              { value: "classic", label: "settings.styleClassic", hint: "settings.styleClassicHint", icon: Layers },
              { value: "blur", label: "settings.styleBlur", hint: "settings.styleBlurHint", icon: Waves },
              { value: "liquid-glass", label: "settings.styleLiquidGlass", hint: "settings.styleLiquidGlassHint", icon: Sparkles },
            ] as { value: VisualStyle; label: TranslationKey; hint: TranslationKey; icon: typeof Layers }[]).map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={visualStyle === entry.value}
                onClick={() => setVisualStyle(entry.value)}
                className={cn(
                  "group flex min-h-28 flex-col items-start gap-2 rounded-2xl border p-3 text-start transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft",
                  visualStyle === entry.value
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:bg-accent/70",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <entry.icon className="size-5" />
                  {visualStyle === entry.value ? <Check className="size-4 text-primary" /> : null}
                </span>
                <span className="text-sm font-semibold">{t(entry.label)}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{t(entry.hint)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("settings.notifications")}
          </h2>
          <div className="space-y-1 rounded-2xl border border-border">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <Label htmlFor="push" className="text-sm">
                  {t("settings.desktopNotifications")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("settings.desktopNotificationsHint")}</p>
              </div>
              <Switch id="push" checked={notifications} onCheckedChange={(v) => void toggleNotifications(v)} />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border p-4">
              <div>
                <Label htmlFor="sounds" className="text-sm">
                  {t("settings.sounds")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("settings.soundsHint")}</p>
              </div>
              <Switch id="sounds" checked={sounds} onCheckedChange={setSounds} />
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bell className="size-3.5" /> {t("settings.deviceNote")}
          </p>
        </section>

        <Button
          variant="destructive"
          className="w-full"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="size-4" /> {t("common.signOut")}
        </Button>
      </div>
    </main>
  );
}
