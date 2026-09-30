import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quantEngineRequest } from "@/lib/quant-engine.server";

export const getConnectionHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const alpaca = Boolean(process.env["ALPACA_API_KEY_ID"] && process.env["ALPACA_API_SECRET_KEY"]);
    const quantConfigured = Boolean(process.env["QUANT_ENGINE_URL"] && process.env["QUANT_ENGINE_API_KEY"]);
    let quantOnline = false;
    if (quantConfigured) {
      try {
        await quantEngineRequest("/sessions?limit=1", {}, 5_000);
        quantOnline = true;
      } catch {
        quantOnline = false;
      }
    }
    return {
      alpaca,
      alpacaPaper: alpaca && (process.env["ALPACA_PAPER"] ?? "true") !== "false",
      quantConfigured,
      quantOnline,
    };
  });
