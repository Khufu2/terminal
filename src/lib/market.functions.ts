import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cryptoBars, getAlpacaCreds, stockBars, type Bar } from "@/lib/alpaca.server";

export type MarketSnapshot = {
  configured: boolean;
  source: string;
  symbol: string;
  market: string;
  latest: number | null;
  previous: number | null;
  changePct: number | null;
  bars: Bar[];
  asOf: number | null;
  message?: string;
};

export const getMarketSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { symbol: string; market: string }) => ({
    symbol: String(input?.symbol ?? "").trim().toUpperCase().slice(0, 32),
    market: String(input?.market ?? "").trim().toLowerCase().slice(0, 24),
  }))
  .handler(async ({ data }): Promise<MarketSnapshot> => {
    if (!data.symbol) throw new Error("Symbol is required.");
    if (data.market === "kalshi") {
      return {
        configured: false,
        source: "none",
        symbol: data.symbol,
        market: data.market,
        latest: null,
        previous: null,
        changePct: null,
        bars: [],
        asOf: null,
        message: "Prediction-market data is not connected yet.",
      };
    }

    const creds = getAlpacaCreds();
    if (!creds) {
      return {
        configured: false,
        source: "none",
        symbol: data.symbol,
        market: data.market,
        latest: null,
        previous: null,
        changePct: null,
        bars: [],
        asOf: null,
        message: "Connect Alpaca market data to load verified prices and charts.",
      };
    }

    const result =
      data.market === "crypto"
        ? await cryptoBars(creds, [data.symbol], 180)
        : await stockBars(creds, [data.symbol], 180);
    const bars = result[data.symbol] ?? [];
    const latestBar = bars.at(-1);
    const previousBar = bars.at(-2);
    const latest = latestBar?.c ?? null;
    const previous = previousBar?.c ?? null;
    const changePct = latest != null && previous ? (latest - previous) / previous : null;

    return {
      configured: true,
      source: "alpaca",
      symbol: data.symbol,
      market: data.market,
      latest,
      previous,
      changePct,
      bars,
      asOf: latestBar?.t ?? null,
    };
  });
