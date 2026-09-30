import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchNews, getAlpacaCreds } from "@/lib/alpaca.server";

export const getAssetNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { symbol: string; limit?: number }) => ({
    symbol: String(input?.symbol ?? "").trim().toUpperCase().replace("/USD", "").slice(0, 32),
    limit: Math.max(1, Math.min(30, Number(input?.limit ?? 12))),
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) return [];
    const creds = getAlpacaCreds();
    if (!creds) return [];
    return fetchNews(creds, [data.symbol], data.limit);
  });
