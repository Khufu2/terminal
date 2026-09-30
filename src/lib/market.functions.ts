import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cryptoBars,
  getAlpacaCreds,
  stockBars,
  type Bar,
  type MarketTimeframe,
} from "@/lib/alpaca.server";

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y";

const RANGE_CONFIG: Record<ChartRange, { timeframe: MarketTimeframe; limit: number }> = {
  "1D": { timeframe: "5Min", limit: 78 },
  "1W": { timeframe: "15Min", limit: 160 },
  "1M": { timeframe: "1Hour", limit: 180 },
  "3M": { timeframe: "1Day", limit: 90 },
  "1Y": { timeframe: "1Day", limit: 252 },
};

export type MarketSnapshot = {
  configured: boolean;
  source: string;
  symbol: string;
  market: string;
  range: ChartRange;
  latest: number | null;
  previous: number | null;
  changePct: number | null;
  bars: Bar[];
  asOf: number | null;
  message?: string;
};

export const getMarketSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { symbol: string; market: string; range?: ChartRange }) => {
    const requested = String(input?.range ?? "1M") as ChartRange;
    return {
      symbol: String(input?.symbol ?? "").trim().toUpperCase().slice(0, 32),
      market: String(input?.market ?? "").trim().toLowerCase().slice(0, 24),
      range: Object.prototype.hasOwnProperty.call(RANGE_CONFIG, requested) ? requested : "1M",
    };
  })
  .handler(async ({ data }): Promise<MarketSnapshot> => {
    if (!data.symbol) throw new Error("Symbol is required.");
    if (data.market === "kalshi") {
      return {
        configured: false,
        source: "none",
        symbol: data.symbol,
        market: data.market,
        range: data.range,
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
        range: data.range,
        latest: null,
        previous: null,
        changePct: null,
        bars: [],
        asOf: null,
        message: "Connect Alpaca market data to load verified prices and charts.",
      };
    }

    const cfg = RANGE_CONFIG[data.range];
    const result =
      data.market === "crypto"
        ? await cryptoBars(creds, [data.symbol], cfg.limit, cfg.timeframe)
        : await stockBars(creds, [data.symbol], cfg.limit, cfg.timeframe);

    const bars = result[data.symbol] ?? [];
    const latestBar = bars.at(-1);
    const firstBar = bars[0];
    const latest = latestBar?.c ?? null;
    const previous = firstBar?.c ?? null;
    const changePct = latest != null && previous ? (latest - previous) / previous : null;

    return {
      configured: true,
      source: "alpaca",
      symbol: data.symbol,
      market: data.market,
      range: data.range,
      latest,
      previous,
      changePct,
      bars,
      asOf: latestBar?.t ?? null,
    };
  });
