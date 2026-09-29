/** Alpaca REST helpers. Server-only: never import from client code. */

export type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type AlpacaCreds = { key: string; secret: string; paper: boolean };

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

/** Daily bars for a batch of stock symbols. */
export async function stockBars(c: AlpacaCreds, symbols: string[], limit = 120) {
  if (!symbols.length) return {} as Record<string, Bar[]>;
  const url = `https://data.alpaca.markets/v2/stocks/bars?symbols=${encodeURIComponent(
    symbols.join(","),
  )}&timeframe=1Day&limit=${limit}&adjustment=split&feed=iex&sort=asc`;
  const json = await get<{ bars?: Record<string, RawBar[]> }>(c, url);
  const out: Record<string, Bar[]> = {};
  for (const [sym, rows] of Object.entries(json.bars ?? {})) out[sym] = toBars(rows);
  return out;
}

/** Daily bars for a batch of crypto symbols (BTC -> BTC/USD). */
export async function cryptoBars(c: AlpacaCreds, symbols: string[], limit = 120) {
  if (!symbols.length) return {} as Record<string, Bar[]>;
  const pairs = symbols.map(cryptoPair);
  const url = `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(
    pairs.join(","),
  )}&timeframe=1Day&limit=${limit}&sort=asc`;
  const json = await get<{ bars?: Record<string, RawBar[]> }>(c, url);
  const out: Record<string, Bar[]> = {};
  for (const [pair, rows] of Object.entries(json.bars ?? {})) {
    out[pair.split("/")[0] ?? pair] = toBars(rows);
  }
  return out;
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

/** Submits a real order to Alpaca (paper or live depending on the key). */
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