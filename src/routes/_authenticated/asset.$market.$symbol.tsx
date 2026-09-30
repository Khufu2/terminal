import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Newspaper,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProTradingChart } from "@/components/ProTradingChart";
import { getAssetNews } from "@/lib/asset.functions";
import { useAccounts, useHoldings, useSignals, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, num, pct, timeAgo, usd } from "@/lib/format";
import { getMarketSnapshot, type ChartRange } from "@/lib/market.functions";
import { addWatchlistItem, removeWatchlistItem } from "@/lib/watchlist.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/asset/$market/$symbol")({
  head: ({ params }) => ({ meta: [{ title: `${params.symbol} — Terminal` }] }),
  component: AssetPage,
});

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y"];

function AssetPage() {
  const params = Route.useParams();
  const market = params.market === "crypto" ? "crypto" : "stocks";
  const symbol = params.symbol.toUpperCase();
  const [range, setRange] = useState<ChartRange>("1M");
  const fetchSnapshot = useServerFn(getMarketSnapshot);
  const fetchNews = useServerFn(getAssetNews);
  const addWatch = useServerFn(addWatchlistItem);
  const removeWatch = useServerFn(removeWatchlistItem);
  const qc = useQueryClient();

  const holdings = useHoldings();
  const accounts = useAccounts();
  const signals = useSignals(100);
  const watch = useWatchlist();

  const holding = (holdings.data ?? []).find((h) => h.market === market && h.symbol === symbol) ?? null;
  const account = (accounts.data ?? []).find((a) => a.market === market);
  const watched = (watch.data ?? []).some((w) => w.market === market && w.symbol === symbol);
  const name = holding?.name ?? (watch.data ?? []).find((w) => w.market === market && w.symbol === symbol)?.name ?? symbol;

  const snapshot = useQuery({
    queryKey: ["asset-snapshot", market, symbol, range],
    queryFn: () => fetchSnapshot({ data: { market, symbol, range } }),
    staleTime: range === "1D" ? 15_000 : 60_000,
    refetchInterval: range === "1D" ? 25_000 : false,
  });

  const news = useQuery({
    queryKey: ["asset-news", symbol],
    queryFn: () => fetchNews({ data: { symbol, limit: 12 } }),
    staleTime: 5 * 60_000,
  });

  const toggle = useMutation({
    mutationFn: () =>
      watched
        ? removeWatch({ data: { market, symbol } })
        : addWatch({ data: { market, symbol, name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Watchlist update failed"),
  });

  const price = snapshot.data?.latest ?? (Number(holding?.last_price ?? 0) || null);
  const marketValue = holding && price ? Number(holding.quantity) * price : 0;
  const cost = holding ? Number(holding.quantity) * Number(holding.avg_cost) : 0;
  const pnl = marketValue - cost;
  const pnlPct = cost ? pnl / cost : 0;
  const buyingPower = Number(account?.balance_usd ?? 0);
  const assetSignals = (signals.data ?? []).filter((s) => s.market === market && s.symbol === symbol).slice(0, 6);

  return (
    <AppShell title={symbol} subtitle={`${MARKET_LABEL[market]} · Robinhood-style asset view`}>
      <div className="mx-auto max-w-[1120px]">
        <section className="border-b border-border pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{MARKET_LABEL[market]}</div>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{symbol}</h1>
                <button onClick={() => toggle.mutate()} className={cn("rounded-lg p-2", watched ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                  <Star className={cn("h-4 w-4", watched && "fill-current")} />
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{name}</div>
            </div>
            <div className="text-right">
              <div className="num text-3xl font-semibold sm:text-4xl">{price ? usd(price, price < 5 ? 4 : 2) : "—"}</div>
              {snapshot.data?.changePct != null && (
                <div className={cn("num mt-1 flex items-center justify-end gap-1 text-xs font-medium", snapshot.data.changePct >= 0 ? "text-bull" : "text-bear")}>
                  {snapshot.data.changePct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {pct(snapshot.data.changePct)} · {range}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-1 border-b border-border pb-2">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("rounded-lg px-3 py-1.5 text-[10px] font-semibold", range === r ? "bg-white/[0.08] text-foreground" : "text-muted-foreground")}>{r}</button>
            ))}
          </div>

          <div className="mt-2">
            {snapshot.isLoading ? (
              <div className="flex h-[27rem] items-center justify-center text-xs text-muted-foreground">Loading verified market data…</div>
            ) : snapshot.data?.bars?.length ? (
              <ProTradingChart candles={snapshot.data.bars} heightClass="h-[27rem] sm:h-[34rem]" />
            ) : (
              <div className="flex h-[27rem] items-center justify-center text-center text-xs text-muted-foreground">{snapshot.data?.message ?? "No verified chart available."}</div>
            )}
          </div>
        </section>

        <section className="grid border-b border-border sm:grid-cols-4">
          <Metric label="Position" value={holding ? `${num(holding.quantity, 6)} ${symbol}` : "None"} />
          <Metric label="Market value" value={usd(marketValue)} />
          <Metric label="Total return" value={holding ? `${pnl >= 0 ? "+" : ""}${usd(pnl)} · ${pct(pnlPct)}` : "—"} tone={pnl >= 0 ? "up" : "down"} />
          <Metric label="Buying power" value={usd(buyingPower)} />
        </section>

        <section className="grid gap-0 border-b border-border lg:grid-cols-[1fr_20rem]">
          <div className="py-5 lg:border-r lg:border-border lg:pr-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your position</h2>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            {holding ? (
              <div className="mt-4 grid grid-cols-2 gap-y-4 text-xs sm:grid-cols-4">
                <Small label="Quantity" value={num(holding.quantity, 6)} />
                <Small label="Average cost" value={usd(Number(holding.avg_cost))} />
                <Small label="Cost basis" value={usd(cost)} />
                <Small label="Portfolio value" value={usd(marketValue)} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">You do not hold this asset in your Terminal paper portfolio.</p>
            )}
          </div>
          <div className="py-5 lg:pl-6">
            <div className="grid grid-cols-2 gap-2">
              <Link to="/trade" search={{ symbol }} className="rounded-xl bg-bull py-3 text-center text-sm font-semibold text-black">Buy</Link>
              <Link to="/trade" search={{ symbol }} className="rounded-xl bg-bear py-3 text-center text-sm font-semibold text-white">Sell</Link>
            </div>
            <p className="mt-3 flex gap-2 text-[9px] leading-4 text-muted-foreground"><ShieldCheck className="h-3 w-3 shrink-0 text-primary" />These buttons open Terminal's simulated order ticket. No live order is sent.</p>
          </div>
        </section>

        <section className="border-b border-border py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">News</h2></div>
            <span className="text-[9px] text-muted-foreground">Alpaca news</span>
          </div>
          {news.isLoading ? (
            <div className="py-6 text-xs text-muted-foreground">Loading news…</div>
          ) : !(news.data ?? []).length ? (
            <div className="py-6 text-xs text-muted-foreground">No recent Alpaca news for {symbol}.</div>
          ) : (
            <div className="grid gap-x-6 sm:grid-cols-2">
              {(news.data ?? []).slice(0, 8).map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="border-b border-border py-3.5">
                  <div className="line-clamp-2 text-xs font-medium leading-5">{item.headline}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{item.source} · {timeAgo(item.created_at)}</div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Research</h2></div>
            <Link to="/research" search={{ prompt: `Research ${symbol}: trend, valuation/context, catalysts, downside risks, and a testable trading thesis. Use evidence and identify missing data.` }} className="text-[10px] font-medium text-primary">Ask Terminal</Link>
          </div>

          {assetSignals.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {assetSignals.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-semibold uppercase", s.direction === "buy" || s.direction === "long" ? "text-bull" : s.direction === "sell" || s.direction === "short" ? "text-bear" : "text-muted-foreground")}>{s.direction}</span>
                    <span className="num text-[9px] text-muted-foreground">{Math.round(Number(s.confidence) * 100)}%</span>
                  </div>
                  <p className="mt-2 line-clamp-4 text-[10px] leading-4 text-muted-foreground">{s.ai_reason || "No rationale stored."}</p>
                </div>
              ))}
            </div>
          )}

          <Link to="/research" search={{ prompt: `Deep research ${symbol} and propose the next falsifiable test before I paper trade it.` }} className="mt-3 flex items-center justify-between rounded-2xl border border-border p-4 hover:border-primary/25">
            <div><div className="text-xs font-medium">Run deeper research</div><div className="mt-1 text-[10px] text-muted-foreground">Gemini for fast analysis; Vibe-Trading for tool-using quant research when the engine is online.</div></div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return <div className="border-b border-border px-3 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("num mt-1 text-sm font-semibold", tone === "up" && "text-bull", tone === "down" && "text-bear")}>{value}</div></div>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div><div className="num mt-1 text-xs font-medium">{value}</div></div>;
}
