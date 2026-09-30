export const usd = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(v ?? 0));

export const compactUsd = (v: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(Number(v ?? 0)) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(Number(v ?? 0)) >= 100000 ? 1 : 0,
  }).format(Number(v ?? 0));

export const pct = (v: number | null | undefined, digits = 1, showSign = true) =>
  `${showSign && Number(v ?? 0) >= 0 ? "+" : ""}${(Number(v ?? 0) * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(v ?? 0));

export const signClass = (v: number) =>
  v > 0 ? "text-bull" : v < 0 ? "text-bear" : "text-muted-foreground";

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export const MARKET_LABEL: Record<string, string> = {
  crypto: "Crypto",
  stocks: "Stocks",
  kalshi: "Kalshi",
  cash: "Cash",
};

export const MARKET_COLOR: Record<string, string> = {
  crypto: "var(--gold)",
  stocks: "var(--bull)",
  kalshi: "var(--gold-soft)",
  cash: "var(--muted-foreground)",
};