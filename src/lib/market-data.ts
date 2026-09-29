export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic synthetic OHLC series so charts are stable per symbol/timeframe. */
export function buildCandles(symbol: string, base: number, count = 120, volatility = 0.02): Candle[] {
  const rand = mulberry32(hash(symbol));
  const out: Candle[] = [];
  let price = base * (0.82 + rand() * 0.06);
  const drift = (base - price) / count;
  const start = Date.now() - count * 86400000;
  for (let i = 0; i < count; i++) {
    const shock = (rand() - 0.48) * price * volatility * 2;
    const o = price;
    const c = Math.max(base * 0.2, o + drift + shock);
    const h = Math.max(o, c) * (1 + rand() * volatility * 0.6);
    const l = Math.min(o, c) * (1 - rand() * volatility * 0.6);
    out.push({
      t: start + i * 86400000,
      o,
      h,
      l,
      c,
      v: Math.round((0.6 + rand()) * 1_000_000),
    });
    price = c;
  }
  // pin the last close to the given base price
  const last = out[out.length - 1];
  if (last) {
    const adj = base / last.c;
    last.c = base;
    last.h = Math.max(last.h * adj, base);
    last.l = Math.min(last.l * adj, base);
  }
  return out;
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const g = Math.max(diff, 0);
    const l = Math.max(-diff, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      out.push(i === period ? 100 - 100 / (1 + gain / (loss || 1e-9)) : null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push(100 - 100 / (1 + gain / (loss || 1e-9)));
    }
  }
  return out;
}

export function buildDepth(price: number, symbol: string) {
  const rand = mulberry32(hash(symbol + "depth"));
  const bids: { price: number; size: number }[] = [];
  const asks: { price: number; size: number }[] = [];
  let bidCum = 0;
  let askCum = 0;
  for (let i = 1; i <= 12; i++) {
    bidCum += (0.4 + rand()) * 40;
    askCum += (0.4 + rand()) * 40;
    bids.push({ price: price * (1 - i * 0.0009), size: Math.round(bidCum) });
    asks.push({ price: price * (1 + i * 0.0009), size: Math.round(askCum) });
  }
  return { bids, asks };
}