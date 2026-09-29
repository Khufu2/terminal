import { useEffect, useRef } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ensureOnboarded } from "@/lib/onboard.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (error) {
      // A fresh Vercel preview may not have the Supabase env copied yet.
      // Send it to the public product preview instead of showing a generic crash.
      if (error && typeof error === "object" && "isRedirect" in error) throw error;
      throw redirect({ to: "/preview" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureOnboarded);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    ensure({ data: undefined })
      .then((res) => {
        qc.setQueryData(["onboarded"], res);
        return qc.invalidateQueries();
      })
      .catch(() => {
        // Non-fatal: the app still works, pages will just start empty.
      });
  }, [qc, ensure]);

  return <Outlet />;
}
