import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAlpacaCreds, searchAssets } from "@/lib/alpaca.server";

export const searchInstruments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; market?: "stocks" | "crypto" | "all" }) => ({
    query: String(input?.query ?? "").trim().slice(0, 80),
    market: input?.market === "stocks" || input?.market === "crypto" ? input.market : "all",
  }))
  .handler(async ({ data }) => {
    if (data.query.length < 1) return [];
    const creds = getAlpacaCreds();
    if (!creds) throw new Error("Alpaca is not configured.");
    return searchAssets(creds, data.query, data.market, 20);
  });

export const addWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { symbol: string; market: "stocks" | "crypto"; name?: string }) => {
    const market = input?.market === "crypto" ? "crypto" : "stocks";
    const symbol = String(input?.symbol ?? "").trim().toUpperCase().replace("/USD", "").slice(0, 32);
    if (!symbol) throw new Error("Symbol is required.");
    return { symbol, market, name: String(input?.name ?? symbol).trim().slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: existing, error: lookupError } = await db
      .from("watchlist_items")
      .select("id")
      .eq("user_id", context.userId)
      .eq("market", data.market)
      .eq("symbol", data.symbol)
      .limit(1);
    if (lookupError) throw new Error(lookupError.message);
    if (existing?.length) return { id: existing[0].id, added: false };

    const { data: row, error } = await db
      .from("watchlist_items")
      .insert({ user_id: context.userId, market: data.market, symbol: data.symbol, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, added: true };
  });

export const removeWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { symbol: string; market: "stocks" | "crypto" }) => ({
    symbol: String(input?.symbol ?? "").trim().toUpperCase().replace("/USD", "").slice(0, 32),
    market: input?.market === "crypto" ? "crypto" : "stocks",
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db
      .from("watchlist_items")
      .delete()
      .eq("user_id", context.userId)
      .eq("market", data.market)
      .eq("symbol", data.symbol);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
