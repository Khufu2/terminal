import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled entry point for the trading engine.
 * Called by the database scheduler; requires the shared CRON_SECRET.
 *   POST /api/public/cron/prices|news|signals|trade|digest
 */
export const Route = createFileRoute("/api/public/cron/$job")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const envSecret = process.env["CRON_SECRET"];
        const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const provided = request.headers.get("x-cron-secret") ?? bearer;
        let authorized = Boolean(envSecret) && provided === envSecret;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!authorized && provided) {
          const { data } = await supabaseAdmin.rpc("verify_cron_token", { _token: provided });
          authorized = data === true;
        }
        if (!authorized) return new Response("Unauthorized", { status: 401 });

        const { JOBS, runJob } = await import("@/lib/engine.server");
        const job = params.job as (typeof JOBS)[number];
        if (!JOBS.includes(job)) return new Response("Unknown job", { status: 400 });

        try {
          const results = await runJob(job);
          return Response.json({ job, results });
        } catch (e) {
          return Response.json({ job, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});