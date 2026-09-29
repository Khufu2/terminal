import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { CandleChart } from "@/components/CandleChart";
import { Panel, Pill } from "@/components/Panel";
import { useHoldings, useSignals, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, num, pct, usd } from "@/lib/format";
import { buildCandles, buildDepth, rsi } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — Aurum Terminal" },
      {
        name: "description",
        content:
          "Depth charts, order book, momentum and live signals for crypto, stocks and Kalshi markets.",
      },
      { property: "og:title", content: "Markets — Aurum Terminal" },
      {
        property: "og:description",
        content: "Professional depth charts and order book for every market you track.",
      },
    ],
  }),
  component: Markets,
});

const MARKET_TABS = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "kalshi", label: "Kalshi" },
] as const;

type MarketTab = (typeof MARKET_TABS)[number]["id"];

const FALLBACK: Record<string, number> = { crypto: 2400, stocks: 180, kalshi: 0.54 };

// Sample Kalshi markets when none in DB
const KALSHI_SAMPLES = [
  { symbol: "FED-CUT-SEP", name: "Fed cut in Sep?", market: "kalshi", price: 0.62 },
  { symbol: "BTC-100K-EOY", name: "BTC over $100k by EOY", market: "kalshi", price: 0.41 },
  { symbol: "RECESSION-2025", name: "US recession in 2025", market: "kalshi", price: 0.28 },
  { symbol: "TRUMP-EO-CRYPTO", name: "Crypto exec order signed", market: "kalshi", price: 0.78 },
];

function Markets() {
  const holdings = useHoldings();
  const watch = useWatchlist();
  const signals = useSignals(50);
  const [active, setActive] = useState<string | null>(null);
  const [tf, setTf] = useState<"1D" | "1W" | "1M">("1D");
  const [marketTab, setMarketTab] = useState<MarketTab>("all");

  const universe = useMemo(() => {
    const map = new Map<string, { symbol: string; market: string; name: string; price: number }>();
    for (const h of holdings.data ?? [])
      map.set(h.symbol, {
        symbol: h.symbol,
        market: h.market,
        name: h.name ?? h.symbol,
        price: Number(h.last_price) || FALLBACK[h.market] || 100,
      });
    for (const w of watch.data ?? [])
      if (!map.has(w.symbol))
        map.set(w.symbol, {
          symbol: w.symbol,
          market: w.market,
          name: w.name ?? w.symbol,
          price: FALLBACK[w.market] ?? 100,
        });
    // Always add Kalshi samples if none exist
    const hasKalshi = [...map.values()].some((v) => v.market === "kalshi");
    if (!hasKalshi) {
      for (const k of KALSHI_SAMPLES) map.set(k.symbol, k);
    }
    return [...map.values()].sort(
      (a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol),
    );
  }, [holdings.data, watch.data]);

  const filteredUniverse = useMemo(
    () => (marketTab === "all" ? universe : universe.filter((u) => u.market === marketTab)),
    [universe, marketTab],
  );

  const selected = filteredUniverse.find((u) => u.symbol === active) ?? filteredUniverse[0];

  const candles = useMemo(
    () =>
      selected
        ? buildCandles(
            selected.symbol + tf,
            selected.price,
            tf === "1D" ? 120 : tf === "1W" ? 80 : 60,
            selected.market === "kalshi" ? 0.05 : tf === "1D" ? 0.02 : tf === "1W" ? 0.04 : 0.07,
          )
        : [],
    [selected, tf],
  );

  const depth = useMemo(
    () => (selected ? buildDepth(selected.price, selected.symbol) : { bids: [], asks: [] }),
    [selected],
  );

  const momentum = useMemo(() => {
    if (candles.length < 2) return { change: 0, changePct: 0, rsiNow: 50, high: 0, low: 0 };
    const closes = candles.map((c) => c.c);
    const last = closes.at(-1)!;
    const prev = closes.at(-2)!;
    const r = rsi(closes).at(-1) ?? 50;
    return {
      change: last - prev,
      changePct: (last - prev) / prev,
      rsiNow: r ?? 50,
      high: Math.max(...candles.map((c) => c.h)),
      low: Math.min(...candles.map((c) => c.l)),
    };
  }, [candles]);

  const symbolSignals = (signals.data ?? []).filter((s) => s.symbol === selected?.symbol);
  const maxDepth = Math.max(1, ...depth.bids.map((b) => b.size), ...depth.asks.map((a) => a.size));
  const isKalshi = selected?.market === "kalshi";

  return (
    <AppShell title="Markets" subtitle="Depth, momentum and order flow across every market">
      {/* Market tabs */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-border/50 bg-secondary/20 p-1">
        {MARKET_TABS.map((tab) => {
          const count =
            tab.id === "all" ? universe.length : universe.filter((u) => u.market === tab.id).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMarketTab(tab.id);
                setActive(null);
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
                marketTab === tab.id
                  ? "bg-gold text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  marketTab === tab.id
                    ? "bg-black/20 text-background"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Instruments list */}
        <Panel
          className="xl:col-span-3"
          title="Instruments"
          subtitle={`${filteredUniverse.length} tracked`}
          bodyClassName="px-0 pb-2"
        >
          <div className="max-h-[32rem] overflow-y-auto">
            {filteredUniverse.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No {marketTab} instruments tracked.
              </p>
            )}
            {filteredUniverse.map((u) => {
              const isActive = selected?.symbol === u.symbol;
              const drift = buildCandles(u.symbol + tf, u.price, 20, 0.02);
              const chg =
                drift.length > 1 ? (drift.at(-1)!.c - drift.at(-2)!.c) / drift.at(-2)!.c : 0;
              const isKal = u.market === "kalshi";
              return (
                <button
                  key={u.symbol}
                  type="button"
                  onClick={() => setActive(u.symbol)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-l-2 px-4 py-2.5 text-left transition-all",
                    isActive ? "border-gold bg-gold/8" : "border-transparent hover:bg-muted/30",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{u.symbol}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {isKal ? "Kalshi" : (MARKET_LABEL[u.market] ?? u.market)} · {u.name}
                    </span>
                  </span>
                  <span className="text-right">
                    {isKal ? (
                      <>
                        <span className="num block text-sm font-semibold text-gold-soft">
                          {Math.round(u.price * 100)}¢
                        </span>
                        <span
                          className={cn(
                            "num block text-[11px]",
                            chg >= 0 ? "text-bull" : "text-bear",
                          )}
                        >
                          {pct(chg)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="num block text-sm">
                          {usd(u.price, u.price < 5 ? 3 : 2)}
                        </span>
                        <span
                          className={cn(
                            "num block text-[11px]",
                            chg >= 0 ? "text-bull" : "text-bear",
                          )}
                        >
                          {pct(chg)}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Chart */}
        <Panel
          className="xl:col-span-6"
          title={
            selected
              ? `${selected.symbol} · ${selected.market === "kalshi" ? "Kalshi" : (MARKET_LABEL[selected.market] ?? selected.market)}`
              : "Chart"
          }
          subtitle={selected?.name ?? ""}
          action={
            <div className="flex gap-1">
              {(["1D", "1W", "1M"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTf(t)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    tf === t
                      ? "bg-gold text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        >
          {isKalshi ? (
            <KalshiView symbol={selected?.symbol ?? ""} price={selected?.price ?? 0.5} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric
                  label="Last"
                  value={usd(selected?.price ?? 0, (selected?.price ?? 0) < 5 ? 3 : 2)}
                  tone="gold"
                />
                <Metric
                  label="Change"
                  value={pct(momentum.changePct)}
                  tone={momentum.changePct >= 0 ? "up" : "down"}
                />
                <Metric label="Range high" value={usd(momentum.high)} />
                <Metric label="Range low" value={usd(momentum.low)} />
              </div>
              <div className="mt-3 h-[22rem]">
                {candles.length > 0 && <CandleChart candles={candles} />}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  RSI 14
                </span>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      momentum.rsiNow > 70
                        ? "bg-bear"
                        : momentum.rsiNow < 30
                          ? "bg-bull"
                          : "bg-gold",
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, momentum.rsiNow))}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "num text-xs font-semibold",
                    momentum.rsiNow > 70
                      ? "text-bear"
                      : momentum.rsiNow < 30
                        ? "text-bull"
                        : "text-muted-foreground",
                  )}
                >
                  {momentum.rsiNow.toFixed(1)}
                  {momentum.rsiNow > 70 ? " OB" : momentum.rsiNow < 30 ? " OS" : ""}
                </span>
              </div>
            </>
          )}
        </Panel>

        {/* Right column: Order book + Signals */}
        <div className="grid gap-4 xl:col-span-3">
          <Panel title="Order book" subtitle="Aggregated depth">
            {isKalshi ? (
              <KalshiOrderBook price={selected?.price ?? 0.5} />
            ) : (
              <div className="space-y-0.5">
                {[...depth.asks].reverse().map((a) => (
                  <Row
                    key={`a${a.price}`}
                    price={a.price}
                    size={a.size}
                    max={maxDepth}
                    side="ask"
                  />
                ))}
                <div className="num my-1.5 border-y border-border py-1.5 text-center text-sm font-semibold text-gold">
                  {usd(selected?.price ?? 0, (selected?.price ?? 0) < 5 ? 3 : 2)}
                </div>
                {depth.bids.map((b) => (
                  <Row
                    key={`b${b.price}`}
                    price={b.price}
                    size={b.size}
                    max={maxDepth}
                    side="bid"
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Signals" subtitle={selected?.symbol ?? ""}>
            {symbolSignals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open signals on this instrument.</p>
            ) : (
              <ul className="space-y-2">
                {symbolSignals.slice(0, 4).map((s) => (
                  <li key={s.id} className="rounded-lg border border-border/50 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Pill
                        tone={
                          s.direction === "long"
                            ? "up"
                            : s.direction === "short"
                              ? "down"
                              : "neutral"
                        }
                      >
                        {s.direction}
                      </Pill>
                      <span className="num text-xs text-muted-foreground">
                        {num(Number(s.confidence) * 100, 0)}% conf
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{s.ai_reason}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/trade"
              search={{ symbol: selected?.symbol }}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-gold px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90"
            >
              Trade {selected?.symbol}
            </Link>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── Kalshi special views ─────────────────────────────────────────── */

function KalshiView({ symbol, price }: { symbol: string; price: number }) {
  const pct = Math.round(price * 100);
  const circumference = 2 * Math.PI * 56;
  const offset = circumference * (1 - price);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative">
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={70} cy={70} r={56} fill="none" stroke="var(--border)" strokeWidth={12} />
          <circle
            cx={70}
            cy={70}
            r={56}
            fill="none"
            stroke={price > 0.6 ? "var(--bull)" : price < 0.4 ? "var(--bear)" : "var(--gold)"}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
          <text
            x={70}
            y={66}
            textAnchor="middle"
            fill="currentColor"
            className="fill-foreground"
            style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}
          >
            {pct}¢
          </text>
          <text
            x={70}
            y={86}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 11 }}
          >
            probability
          </text>
        </svg>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-bull/30 bg-bull/8 py-3">
          <p className="text-xs text-muted-foreground">Yes</p>
          <p className="num text-xl font-bold text-bull">{pct}¢</p>
          <p className="text-[10px] text-muted-foreground">buy to win $1</p>
        </div>
        <div className="rounded-xl border border-bear/30 bg-bear/8 py-3">
          <p className="text-xs text-muted-foreground">No</p>
          <p className="num text-xl font-bold text-bear">{100 - pct}¢</p>
          <p className="text-[10px] text-muted-foreground">buy to win $1</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {symbol} · Prediction market contract
      </p>
    </div>
  );
}

function KalshiOrderBook({ price }: { price: number }) {
  const yesPrice = Math.round(price * 100);
  const noPrice = 100 - yesPrice;
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center justify-between rounded-lg bg-bull/10 px-3 py-2 font-semibold text-bull">
        <span>Yes</span>
        <span className="num">{yesPrice}¢</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-bear/10 px-3 py-2 font-semibold text-bear">
        <span>No</span>
        <span className="num">{noPrice}¢</span>
      </div>
      <p className="pt-1 text-center text-[10px] text-muted-foreground">
        Binary outcome · $1 settlement
      </p>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "gold";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num truncate text-lg font-semibold",
          tone === "up" && "text-bull",
          tone === "down" && "text-bear",
          tone === "gold" && "text-gold-soft",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  price,
  size,
  max,
  side,
}: {
  price: number;
  size: number;
  max: number;
  side: "bid" | "ask";
}) {
  return (
    <div className="relative grid grid-cols-2 overflow-hidden rounded-sm px-1 py-0.5 text-[11px]">
      <div
        className={cn("absolute inset-y-0 right-0", side === "bid" ? "bg-bull/10" : "bg-bear/10")}
        style={{ width: `${(size / max) * 100}%` }}
      />
      <span className={cn("num relative", side === "bid" ? "text-bull" : "text-bear")}>
        {price < 5 ? price.toFixed(3) : price.toFixed(2)}
      </span>
      <span className="num relative text-right text-muted-foreground">{num(size, 0)}</span>
    </div>
  );
}
