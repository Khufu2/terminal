import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JOB_NAMES = ["prices", "news", "signals", "trade", "digest"] as const;
type JobName = (typeof JOB_NAMES)[number];

/** Creates the risk profile row on first visit and returns it. */
export const ensureRiskSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("risk_settings").select("*").maybeSingle();
    if (data) return data;
    const { data: created, error } = await supabase
      .from("risk_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

/** Runs one engine job immediately for the signed-in user. */
export const runEngineJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job: string }) => {
    const job = String(input?.job ?? "");
    if (!(JOB_NAMES as readonly string[]).includes(job)) throw new Error("Unknown job");
    return { job: job as JobName };
  })
  .handler(async ({ data, context }) => {
    const { runJob } = await import("@/lib/engine.server");
    const results = await runJob(data.job, context.userId);
    return { result: results[0]?.result ?? "no profile" };
  });

/** Broker/data key availability, so the UI can tell the user what is still missing. */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    alpaca: Boolean(process.env["ALPACA_API_KEY_ID"] && process.env["ALPACA_API_SECRET_KEY"]),
    alpacaPaper: (process.env["ALPACA_PAPER"] ?? "true") !== "false",
    telegram: Boolean(process.env["TELEGRAM_BOT_TOKEN"]),
    kalshi: Boolean(process.env["KALSHI_API_KEY_ID"]),
    cron: Boolean(process.env["CRON_SECRET"]),
  }));