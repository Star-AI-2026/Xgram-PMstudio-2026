import { createFileRoute, isRedirect, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // The stored session is restored locally first. Only when there is no stored
    // session at all do we send the visitor to the sign-in page — a temporary
    // network failure must never sign anyone out or crash the app shell.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) return { user: sessionData.session.user };

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
