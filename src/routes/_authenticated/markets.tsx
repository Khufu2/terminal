import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BrainCircuit, Database, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CandleChart } from "@/components/CandleChart";
import { useHoldings, useSignals, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, pct, usd } from "@/lib/format";
import { getMarketSnapshot } from "@/lib/market.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({ meta: [{ title: "Explore — Terminal" }] }),
  component: Markets,
});

const TABS = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "kalshi", label: "Prediction" },
] as const;

function Markets() {
  const holdings = useHoldings();
  const watch = useWatchlist();
  const signals = useSignals(80);
  const fetchSnapshot = useServerFn(getMarketSnapshot);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const universe = useMemo(() => {
    const map = new Map<string, { symbol: string; market: string; name: string; recorded: number | null }>();
    for (const h of holdings.data ?? []) {
      map.set(h.symbol, {
        symbol: h.symbol,
        market: h.market,
        name: h.name ?? h.symbol,
        recorded: Number(h.last_price) > 0 ? Number(h.last_price) : null,
      });
    }
    for (const w of watch.data ?? []) {
      if (!map.has(w.symbol)) map.set(w.symbol, { symbol: w.symbol, market: w.market, name: w.name ?? w.symbol, recorded: null });
    }
    return [...map.values()].sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
  }, [holdings.data, watch.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universe.filter((item) => (tab === "all" || item.market === tab) && (!q || item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)));
  }, [universe, tab, query]);

  const selected = filtered.find((x) => x.symbol === active) ?? filtered[0] ?? null;

  const snapshot = useQuery({
    queryKey: ["market-snapshot", selected?.market, selected?.symbol],
    queryFn: () => fetchSnapshot({ data: { symbol: selected!.symbol, market: selected!.market } }),
    enabled: Boolean(selected),
    staleTime: 60_000,
  });

  const price = snapshot.data?.latest ?? selected?.recorded ?? null;
  const selectedSignals = (signals.data ?? []).filter((s) => s.symbol === selected?.symbol).slice(0, 5);

  return (
    <AppShell title="Explore" subtitle="Verified data only — no synthetic market tape">
      <div className="mx-auto max-w-[1250px] space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button key={item.id} onClick={() => { setTab(item.id); setActive(null); }} className={cn("rounded-xl px-3 py-2 text-xs font-medium transition-colors", tab === item.id ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>{item.label}</button>
            ))}
          </div>
          <label className="relative block sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tracked symbols" className="w-full rounded-xl border border-border bg-background/60 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/35" />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold">Tracked markets</div>
            <div className="max-h-[38rem] divide-y divide-border overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs leading-5 text-muted-foreground">No tracked instruments in this category. Add symbols from Connections or your watchlist.</div>
              ) : filtered.map((item) => {
                const holding = (holdings.data ?? []).find((h) => h.symbol === item.symbol);
                return (
                  <button key={item.symbol} onClick={() => setActive(item.symbol)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors", selected?.symbol === item.symbol ? "bg-primary/[0.07]" : "hover:bg-white/[0.025]")}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.symbol}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{MARKET_LABEL[item.market] ?? item.market} · {item.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-xs">{item.recorded != null ? usd(item.recorded, item.recorded < 5 ? 3 : 2) : "—"}</div>
                      {holding && <div className="text-[9px] text-muted-foreground">held</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            {!selected ? (
              <section className="flex min-h-96 items-center justify-center rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Track a symbol to start exploring it.</section>
            ) : (
              <>
                <section className="overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground">{MARKET_LABEL[selected.market] ?? selected.market}</div>
                      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{selected.symbol}</h2>
                      <div className="mt-1 text-xs text-muted-foreground">{selected.name}</div>
                    </div>
                    <div className="sm:text-right">
                      <div className="num text-3xl font-semibold">{price != null ? usd(price, price < 5 ? 3 : 2) : "—"}</div>
                      {snapshot.data?.changePct != null && <div className={cn("num mt-1 text-xs font-medium", snapshot.data.changePct >= 0 ? "text-bull" : "text-bear")}>{pct(snapshot.data.changePct)} last session</div>}
                    </div>
                  </div>

                  {snapshot.isLoading ? (
                    <div className="flex h-[22rem] items-center justify-center text-xs text-muted-foreground">Loading verified market data…</div>
                  ) : snapshot.data?.bars?.length ? (
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> Alpaca daily bars</span>
                        <span>{snapshot.data.asOf ? new Date(snapshot.data.asOf).toLocaleDateString() : ""}</span>
                      </div>
                      <div className="h-[22rem]"><CandleChart candles={snapshot.data.bars} /></div>
                    </div>
                  ) : (
                    <div className="flex h-[22rem] flex-col items-center justify-center px-8 text-center">
                      <Database className="h-6 w-6 text-muted-foreground" />
                      <div className="mt-3 text-sm font-medium">Verified chart unavailable</div>
                      <div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{snapshot.data?.message ?? "Connect a market-data provider to load a real chart."}</div>
                      <Link to="/connections" className="mt-4 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:border-primary/30">Open connections</Link>
                    </div>
                  )}
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-3xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4"><h3 className="text-sm font-semibold">Research signals</h3><BrainCircuit className="h-4 w-4 text-primary" /></div>
                    <div className="divide-y divide-border">
                      {selectedSignals.length === 0 ? <div className="px-5 py-8 text-center text-xs text-muted-foreground">No saved signals for {selected.symbol}.</div> : selectedSignals.map((s) => (
                        <div key={s.id} className="px-5 py-4">
                          <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{s.direction}</span><span className="num text-[10px] text-muted-foreground">{Math.round(Number(s.confidence) * 100)}% confidence</span></div>
                          <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-muted-foreground">{s.ai_reason || "No rationale stored."}</p>
                        </div>
                      ))}
                    </div>
                    <Link to="/research" className="flex items-center justify-between border-t border-border px-5 py-4 text-xs font-medium text-muted-foreground hover:text-foreground">Research {selected.symbol}<ArrowRight className="h-4 w-4" /></Link>
                  </section>

                  <section className="rounded-3xl border border-border bg-card">
                    <div className="border-b border-border px-5 py-4"><h3 className="text-sm font-semibold">Actions</h3></div>
                    <div className="space-y-2 p-5">
                      <Link to="/trade" search={{ symbol: selected.symbol }} className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Paper trade <ArrowRight className="h-4 w-4" /></Link>
                      <Link to="/research" className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-medium">Ask the research agent <ArrowRight className="h-4 w-4" /></Link>
                      <p className="pt-2 text-[10px] leading-5 text-muted-foreground">Terminal does not fabricate order books or price history. Market visuals appear only when a verified data source responds.</p>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
