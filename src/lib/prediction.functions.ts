import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = "https://external-api.kalshi.com/trade-api/v2";

type RawMarket = Record<string, any>;
type RawEvent = Record<string, any>;

export type PredictionMarket = {
  ticker: string;
  title: string;
  subtitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  volume24h: number;
  openInterest: number;
  liquidity: number;
  closeTime: string | null;
  rules: string | null;
};

export type PredictionEvent = {
  eventTicker: string;
  title: string;
  subtitle: string;
  category: string;
  markets: PredictionMarket[];
  volume24h: number;
  openInterest: number;
};

function n(value: unknown) {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function normalizeMarket(m: RawMarket): PredictionMarket {
  const bid = n(m.yes_bid_dollars ?? m.yes_bid) / (m.yes_bid_dollars != null ? 1 : 100);
  const ask = n(m.yes_ask_dollars ?? m.yes_ask) / (m.yes_ask_dollars != null ? 1 : 100);
  const last = n(m.last_price_dollars ?? m.last_price) / (m.last_price_dollars != null ? 1 : 100);
  const price = last > 0 ? last : bid > 0 && ask > 0 ? (bid + ask) / 2 : ask || bid || 0;
  return {
    ticker: String(m.ticker ?? ""),
    title: String(m.title ?? m.yes_sub_title ?? ""),
    subtitle: String(m.subtitle ?? m.yes_sub_title ?? ""),
    yesPrice: Math.max(0, Math.min(1, price)),
    noPrice: Math.max(0, Math.min(1, 1 - price)),
    volume: n(m.volume_fp ?? m.volume),
    volume24h: n(m.volume_24h_fp ?? m.volume_24h),
    openInterest: n(m.open_interest_fp ?? m.open_interest),
    liquidity: n(m.liquidity_dollars ?? m.liquidity),
    closeTime: m.close_time ?? m.expected_expiration_time ?? null,
    rules: m.rules_primary ?? null,
  };
}

function normalizeEvent(e: RawEvent, siblingMarkets?: RawMarket[]): PredictionEvent {
  const marketsRaw = Array.isArray(e.markets) ? e.markets : siblingMarkets ?? [];
  const markets = marketsRaw.map(normalizeMarket).filter((m) => m.ticker);
  return {
    eventTicker: String(e.event_ticker ?? e.ticker ?? ""),
    title: String(e.title ?? ""),
    subtitle: String(e.sub_title ?? e.subtitle ?? ""),
    category: String(e.category ?? "Other"),
    markets,
    volume24h: markets.reduce((s, m) => s + m.volume24h, 0),
    openInterest: markets.reduce((s, m) => s + m.openInterest, 0),
  };
}

async function kalshiJson(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Kalshi ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as any;
  } finally {
    clearTimeout(timeout);
  }
}

export const getPredictionFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category?: string; query?: string; limit?: number } = {}) => ({
    category: String(input?.category ?? "All").slice(0, 80),
    query: String(input?.query ?? "").trim().slice(0, 120),
    limit: Math.max(10, Math.min(100, Number(input?.limit ?? 60))),
  }))
  .handler(async ({ data }) => {
    const json = await kalshiJson(
      `/events?limit=200&status=open&with_nested_markets=true`,
    );
    const events: PredictionEvent[] = (json.events ?? [])
      .map((e: RawEvent) => normalizeEvent(e))
      .filter((e: PredictionEvent) => e.eventTicker && e.markets.length);

    const categories = Array.from(
      events.reduce((map, e) => map.set(e.category, (map.get(e.category) ?? 0) + 1), new Map<string, number>()),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    const q = data.query.toLowerCase();
    const filtered = events
      .filter((e) => data.category === "All" || e.category === data.category)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, data.limit);

    return {
      events: filtered,
      trending: [...events].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8),
      categories,
      source: "Kalshi public market data",
      updatedAt: new Date().toISOString(),
    };
  });

export const getPredictionEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventTicker: string }) => ({
    eventTicker: String(input?.eventTicker ?? "").trim().slice(0, 160),
  }))
  .handler(async ({ data }) => {
    if (!data.eventTicker) throw new Error("Event ticker is required.");
    const json = await kalshiJson(
      `/events/${encodeURIComponent(data.eventTicker)}?with_nested_markets=true`,
    );
    const event = json.event ?? json;
    const normalized = normalizeEvent(event, json.markets);
    if (!normalized.eventTicker) throw new Error("Prediction event not found.");
    return normalized;
  });
