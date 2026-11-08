import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Upload, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { removeMedia, uploadMedia } from "@/lib/media";

const schema = z.object({
  display_name: z.string().trim().min(2, "Name is too short").max(50),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscore only"),
  bio: z.string().trim().max(200, "Bio must be under 200 characters"),
  phone: z.string().trim().max(20),
});

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Xgram" },
      { name: "description", content: "Update your Xgram display name, username, photo and bio." },
      { property: "og:title", content: "Your profile — Xgram" },
      { property: "og:description", content: "Update your Xgram display name, username, photo and bio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      display_name: form.get("display_name"),
      username: String(form.get("username") ?? "").toLowerCase(),
      bio: form.get("bio") ?? "",
      phone: form.get("phone") ?? "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        username: parsed.data.username,
        bio: parsed.data.bio || null,
        phone: parsed.data.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save profile", { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success(t("profile.updated"));
  };

  const changeAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const previous = profile?.avatar_url ?? null;
    try {
      const { path } = await uploadMedia(file, user.id);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      // Only after the new photo is safely stored do we drop the old one.
      if (previous && previous !== path && !/^https?:/.test(previous)) {
        void removeMedia(previous).catch(() => undefined);
      }
      toast.success(t("profile.photoUpdated"));
    } catch (error) {
      toast.error("Upload failed", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-xl flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button asChild size="icon" variant="ghost" className="size-9" aria-label={t("chat.backToChats")}>
          <Link to="/chats">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
        </Button>
        <h1 className="font-display text-lg font-semibold">{t("profile.title")}</h1>
      </header>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex flex-col items-center gap-3">
          <UserAvatar
            name={profile?.display_name ?? "You"}
            src={profile?.avatar_url}
            className="size-24 text-2xl"
          />
          <p className="flex items-center gap-2 font-semibold">{profile?.display_name}{profile?.is_verified ? <BadgeCheck className="size-5 text-primary" aria-label="Verified" /> : null}</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void changeAvatar(file);
                event.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("profile.changePhoto")}
            </span>
          </label>
        </div>

        <form onSubmit={save} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">{t("profile.displayName")}</Label>
            <Input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">{t("profile.username")}</Label>
            <Input id="username" name="username" defaultValue={profile?.username ?? ""} maxLength={24} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t("profile.bio")}</Label>
            <Textarea id="bio" name="bio" defaultValue={profile?.bio ?? ""} maxLength={200} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("profile.phone")}</Label>
            <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} maxLength={20} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} {t("common.save")}
          </Button>
        </form>
      </div>
    </main>
  );
}
