import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XgramLogo } from "@/components/XgramLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const signupSchema = credentials.extend({
  displayName: z.string().trim().min(2, "Name is too short").max(50),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscore only"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to Xgram" },
      { name: "description", content: "Sign in or create your Xgram account to start messaging in real time." },
      { property: "og:title", content: "Sign in to Xgram" },
      { property: "og:description", content: "Sign in or create your Xgram account to start messaging." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/chats", replace: true });
  }, [user, loading, navigate]);

  const handleForgot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) return;
    setBusy(true);
    // Never reveal whether the address belongs to an account.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setResetSent(true);
  };


  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentials.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error("Could not sign in", { description: error.message });
      return;
    }
    void navigate({ to: "/chats", replace: true });
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      displayName: form.get("displayName"),
      username: String(form.get("username") ?? "").toLowerCase(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: parsed.data.username, display_name: parsed.data.displayName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Could not create account", { description: error.message });
      return;
    }
    if (!data.session) {
      setPendingEmail(parsed.data.email);
      return;
    }
    void navigate({ to: "/chats", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">

      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-soft">
        <div className="flex flex-col items-center gap-2 text-center">
          <XgramLogo size={44} />
          <h1 className="font-display text-2xl font-semibold">Welcome to Xgram</h1>
          <p className="text-sm text-muted-foreground">Your conversations, fast and private.</p>
        </div>

        {forgot ? (
          <div className="mt-8 space-y-4">
            <h2 className="text-center text-base font-semibold">{t("auth.forgotTitle")}</h2>
            {resetSent ? (
              <p className="text-center text-sm text-muted-foreground">{t("auth.resetSent")}</p>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("auth.forgotHint")}</p>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("auth.sendLink")}
                </Button>
              </form>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setForgot(false);
                setResetSent(false);
              }}
            >
              {t("auth.backToSignIn")}
            </Button>
          </div>
        ) : pendingEmail ? (

          <div className="mt-8 space-y-4 text-center">
            <h2 className="text-base font-semibold">Confirm your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{pendingEmail}</span>.
              Open it to activate your account, then sign in.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPendingEmail(null);
                setTab("signin");
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(value) => setTab(value as "signin" | "signup")} className="mt-7">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
                </Button>
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("auth.forgot")}
                </button>
              </form>

            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input id="signup-name" name="displayName" maxLength={50} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input id="signup-username" name="username" maxLength={24} placeholder="jane_doe" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
