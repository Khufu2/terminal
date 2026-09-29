/** Alpaca REST helpers. Server-only: never import from client code. */

export type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type AlpacaCreds = { key: string; secret: string; paper: boolean };

export type MarketTimeframe = "5Min" | "15Min" | "1Hour" | "1Day";

export function getAlpacaCreds(): AlpacaCreds | null {
  const key = process.env["ALPACA_API_KEY_ID"];
  const secret = process.env["ALPACA_API_SECRET_KEY"];
  if (!key || !secret) return null;
  return { key, secret, paper: (process.env["ALPACA_PAPER"] ?? "true") !== "false" };
}

function headers(c: AlpacaCreds) {
  return { "APCA-API-KEY-ID": c.key, "APCA-API-SECRET-KEY": c.secret, accept: "application/json" };
}

async function get<T>(c: AlpacaCreds, url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(c) });
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

type RawBar = { t: string; o: number; h: number; l: number; c: number; v: number };

const toBars = (rows: RawBar[] = []): Bar[] =>
  rows.map((b) => ({ t: new Date(b.t).getTime(), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));

/** Alpaca crypto pairs use BTC/USD; the app stores BTC. */
export const cryptoPair = (symbol: string) => (symbol.includes("/") ? symbol : `${symbol}/USD`);

export async function stockBars(
  c: AlpacaCreds,
  symbols: string[],
  limit = 120,
  timeframe: MarketTimeframe = "1Day",
) {
  if (!symbols.length) return {} as Record<string, Bar[]>;
  const url = `https://data.alpaca.markets/v2/stocks/bars?symbols=${encodeURIComponent(
    symbols.join(","),
  )}&timeframe=${timeframe}&limit=${limit}&adjustment=split&feed=iex&sort=desc`;
  const json = await get<{ bars?: Record<string, RawBar[]> }>(c, url);
  const out: Record<string, Bar[]> = {};
  for (const [sym, rows] of Object.entries(json.bars ?? {})) out[sym] = toBars(rows).reverse();
  return out;
}

export async function cryptoBars(
  c: AlpacaCreds,
  symbols: string[],
  limit = 120,
  timeframe: MarketTimeframe = "1Day",
) {
  if (!symbols.length) return {} as Record<string, Bar[]>;
  const pairs = symbols.map(cryptoPair);
  const url = `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(
    pairs.join(","),
  )}&timeframe=${timeframe}&limit=${limit}&sort=desc`;
  const json = await get<{ bars?: Record<string, RawBar[]> }>(c, url);
  const out: Record<string, Bar[]> = {};
  for (const [pair, rows] of Object.entries(json.bars ?? {})) {
    out[pair.split("/")[0] ?? pair] = toBars(rows).reverse();
  }
  return out;
}

export async function latestReferencePrice(c: AlpacaCreds, market: string, symbol: string) {
  if (market === "crypto") {
    const pair = cryptoPair(symbol);
    try {
      const url = `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(pair)}`;
      const json = await get<{ trades?: Record<string, { p?: number }> }>(c, url);
      const price = Number(json.trades?.[pair]?.p ?? 0);
      if (price > 0) return price;
    } catch {
      // Fall through to latest bar.
    }
    const bars = await cryptoBars(c, [symbol], 2, "5Min");
    return bars[symbol]?.at(-1)?.c ?? null;
  }

  try {
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`;
    const json = await get<{ trade?: { p?: number } }>(c, url);
    const price = Number(json.trade?.p ?? 0);
    if (price > 0) return price;
  } catch {
    // Fall through to latest bar.
  }
  const bars = await stockBars(c, [symbol], 2, "5Min");
  return bars[symbol]?.at(-1)?.c ?? null;
}

export type AlpacaAsset = {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  fractionable?: boolean;
};

const assetCache = new Map<string, { expires: number; rows: AlpacaAsset[] }>();

export async function listAssets(c: AlpacaCreds, market: "stocks" | "crypto") {
  const cacheKey = market;
  const cached = assetCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.rows;

  const base = c.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  const assetClass = market === "crypto" ? "crypto" : "us_equity";
  const rows = await get<AlpacaAsset[]>(
    c,
    `${base}/v2/assets?status=active&asset_class=${assetClass}`,
  );
  const clean = rows.filter((a) => a.tradable !== false);
  assetCache.set(cacheKey, { expires: Date.now() + 5 * 60_000, rows: clean });
  return clean;
}

export async function searchAssets(
  c: AlpacaCreds,
  query: string,
  market: "stocks" | "crypto" | "all" = "all",
  limit = 20,
) {
  const q = query.trim().toLowerCase();
  if (!q) return [] as Array<{ symbol: string; name: string; market: "stocks" | "crypto"; exchange: string; fractionable: boolean }>;

  const markets = market === "all" ? (["stocks", "crypto"] as const) : ([market] as const);
  const batches = await Promise.all(markets.map(async (m) => ({ market: m, rows: await listAssets(c, m) })));
  return batches
    .flatMap(({ market: m, rows }) =>
      rows
        .filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
        .map((a) => ({
          symbol: m === "crypto" ? a.symbol.split("/")[0] ?? a.symbol : a.symbol,
          name: a.name,
          market: m,
          exchange: a.exchange,
          fractionable: Boolean(a.fractionable || m === "crypto"),
          score:
            a.symbol.toLowerCase() === q ? 0 :
            a.symbol.toLowerCase().startsWith(q) ? 1 :
            a.name.toLowerCase().startsWith(q) ? 2 : 3,
        })),
    )
    .sort((a, b) => a.score - b.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map(({ score: _score, ...row }) => row);
}

export type NewsArticle = {
  id: number;
  headline: string;
  summary: string;
  url: string;
  source: string;
  symbols: string[];
  created_at: string;
};

export async function fetchNews(c: AlpacaCreds, symbols: string[], limit = 25) {
  const q = symbols.length ? `&symbols=${encodeURIComponent(symbols.join(","))}` : "";
  const url = `https://data.alpaca.markets/v1beta1/news?limit=${limit}&sort=desc&exclude_contentless=true${q}`;
  const json = await get<{ news?: NewsArticle[] }>(c, url);
  return json.news ?? [];
}

export type OrderRequest = {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  limit_price?: number;
  market: string;
};

/** Submits a broker order. Terminal's commercial baseline does not call this helper from the UI. */
export async function submitOrder(c: AlpacaCreds, req: OrderRequest) {
  const base = c.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  const symbol = req.market === "crypto" ? cryptoPair(req.symbol) : req.symbol;
  const body: Record<string, unknown> = {
    symbol,
    qty: String(req.qty),
    side: req.side,
    type: req.type,
    time_in_force: req.market === "crypto" ? "gtc" : "day",
  };
  if (req.type === "limit" && req.limit_price) body["limit_price"] = String(req.limit_price);

  const res = await fetch(`${base}/v2/orders`, {
    method: "POST",
    headers: { ...headers(c), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Alpaca order ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as { id: string; status: string; filled_avg_price: string | null };
}

export async function accountEquity(c: AlpacaCreds) {
  const base = c.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  const json = await get<{ equity: string; cash: string }>(c, `${base}/v2/account`);
  return { equity: Number(json.equity), cash: Number(json.cash) };
}
