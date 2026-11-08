import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearUserCache } from "@/lib/local-cache";
import type { Profile } from "@/lib/xgram";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been restored. Never render protected data before this flips. */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);
  const lastUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string, strict = false) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      setProfile((data as Profile | null) ?? null);
    } catch {
      if (strict) throw new Error("Profile synchronization failed");
      // A failed profile read must never take the whole app down.
    }
  }, []);

  useEffect(() => {
    let active = true;

    const finish = () => {
      if (!settled.current) {
        settled.current = true;
        setLoading(false);
      }
    };

    // One listener for the whole app. INITIAL_SESSION / TOKEN_REFRESHED keep the
    // session alive silently; only real identity changes touch the profile.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);

      if (nextSession?.user?.id) lastUserId.current = nextSession.user.id;

      if (event === "SIGNED_OUT") {
        if (lastUserId.current) void clearUserCache(lastUserId.current);
        lastUserId.current = null;
        setProfile(null);
        finish();
        return;
      }

      if (nextSession?.user) {
        setTimeout(() => void loadProfile(nextSession.user.id), 0);
      }
      if (event === "INITIAL_SESSION") finish();
    });

    // Restore the stored session before anything protected renders.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        if (data.session?.user) {
          lastUserId.current = data.session.user.id;
          await loadProfile(data.session.user.id);
        }
      } catch {
        // Offline or a temporarily unreachable backend: stay signed out quietly
        // instead of crashing the app shell.
      } finally {
        if (active) finish();
      }
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Keep our own profile in sync across devices (photo, name, username, bio, language).
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const channel = supabase
      .channel(`xgram-self-profile-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Profile | null;
          if (row?.id) setProfile(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id, true);
  }, [session?.user, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Already signed out locally.
    }
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, session, profile, loading, refreshProfile, signOut }),
    [session, profile, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
