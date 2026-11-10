import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XgramLogo } from "@/components/XgramLogo";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your Xgram password" },
      { name: "description", content: "Choose a new password for your Xgram account." },
      { property: "og:title", content: "Reset your Xgram password" },
      { property: "og:description", content: "Choose a new password for your Xgram account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);

  // The recovery link puts a session in place (hash or code flow). Wait for it.
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setValid(true);
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setValid(true);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth.passwordUpdated"));
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <XgramLogo size={44} />
          <h1 className="font-display text-xl font-semibold">{t("auth.resetTitle")}</h1>
        </div>

        {!ready ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !valid ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{t("auth.linkInvalid")}</p>
            <Button variant="outline" className="w-full" onClick={() => void navigate({ to: "/auth" })}>
              {t("auth.backToSignIn")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.newPassword")}</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("auth.updatePassword")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
