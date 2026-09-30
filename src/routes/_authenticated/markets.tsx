import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bitcoin,
  ChevronRight,
  CircleDollarSign,
  Flame,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useHoldings, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, usd } from "@/lib/format";
import { getPredictionFeed, type PredictionEvent } from "@/lib/prediction.functions";
import { searchInstruments } from "@/lib/watchlist.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({ meta: [{ title: "Markets — Terminal" }] }),
  component: Markets,
});

type View = "prediction" | "stocks" | "crypto";

function Markets() {
  const [view, setView] = useState<View>("prediction");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  return (
    <AppShell title="Markets" subtitle="Prediction markets, stocks and crypto">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex items-center gap-1 border-b border-border pb-3">
          <Tab active={view === "prediction"} onClick={() => setView("prediction")} icon={CircleDollarSign}>Prediction</Tab>
          <Tab active={view === "stocks"} onClick={() => setView("stocks")} icon={TrendingUp}>Stocks</Tab>
          <Tab active={view === "crypto"} onClick={() => setView("crypto")} icon={Bitcoin}>Crypto</Tab>
        </div>

        {view === "prediction" ? (
          <PredictionFeed category={category} setCategory={setCategory} query={query} setQuery={setQuery} />
        ) : (
          <AssetFeed market={view} />
        )}
      </div>
    </AppShell>
  );
}

function PredictionFeed({
  category,
  setCategory,
  query,
  setQuery,
}: {
  category: string;
  setCategory: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  const feedFn = useServerFn(getPredictionFeed);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const feed = useQuery({
    queryKey: ["prediction-feed", category, debounced],
    queryFn: () => feedFn({ data: { category, query: debounced, limit: 80 } }),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });

  const categories = [{ name: "All", count: feed.data?.events.length ?? 0 }, ...(feed.data?.categories ?? [])];

  return (
    <div className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.045em]">What will happen?</h2>
          <p className="mt-1 text-xs text-muted-foreground">Live public Kalshi market data. Terminal is displaying prices, not placing Kalshi orders.</p>
        </div>
        <label className="relative block sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prediction markets" className="w-full rounded-xl border border-border bg-card/60 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary/35" />
        </label>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {categories.map((c) => (
          <button key={c.name} onClick={() => setCategory(c.name)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium", category === c.name ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {c.name}{c.name !== "All" ? ` · ${c.count}` : ""}
          </button>
        ))}
      </div>

      {feed.isLoading ? (
        <div className="py-20 text-center text-xs text-muted-foreground">Loading prediction markets…</div>
      ) : feed.isError ? (
        <div className="mt-5 rounded-2xl border border-border p-6 text-center">
          <div className="text-sm font-medium">Prediction feed unavailable</div>
          <p className="mt-2 text-xs text-muted-foreground">Terminal could not reach Kalshi's public market-data API. Stocks and crypto remain available.</p>
        </div>
      ) : (
        <>
          {!debounced && category === "All" && (feed.data?.trending?.length ?? 0) > 0 && (
            <section className="mt-5 border-b border-border pb-6">
              <div className="mb-3 flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Trending</h3></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(feed.data?.trending ?? []).slice(0, 8).map((event) => <CompactEvent key={event.eventTicker} event={event} />)}
              </div>
            </section>
          )}

          <section className="py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{category === "All" ? "Markets" : category}</h3>
              <span className="text-[9px] text-muted-foreground">{feed.data?.source} · refreshes every minute</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(feed.data?.events ?? []).map((event) => <EventCard key={event.eventTicker} event={event} />)}
            </div>
            {!(feed.data?.events ?? []).length && <div className="py-16 text-center text-xs text-muted-foreground">No matching open events.</div>}
          </section>
        </>
      )}
    </div>
  );
}

function CompactEvent({ event }: { event: PredictionEvent }) {
  const market = primaryMarket(event);
  if (!market) return null;
  return (
    <Link to="/event/$eventTicker" params={{ eventTicker: event.eventTicker }} className="rounded-2xl border border-border bg-card/45 p-3 transition-colors hover:border-primary/25">
      <div className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{event.category}</div>
      <div className="mt-1 line-clamp-2 min-h-10 text-xs font-medium leading-5">{event.title || market.title}</div>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Yes {Math.round(market.yesPrice * 100)}¢</span>
        <span className="text-[9px] text-muted-foreground">{money(market.volume24h)} 24h</span>
      </div>
    </Link>
  );
}

function EventCard({ event }: { event: PredictionEvent }) {
  const market = primaryMarket(event);
  if (!market) return null;
  const yes = Math.round(market.yesPrice * 100);
  return (
    <Link to="/event/$eventTicker" params={{ eventTicker: event.eventTicker }} className="group border-b border-border px-1 py-4 md:rounded-2xl md:border md:bg-card/30 md:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-primary"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{event.category}</div>
          <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{event.title || market.title}</div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <div className="rounded-xl bg-primary/10 px-3 py-2">
          <div className="text-[9px] text-primary/75">Yes</div>
          <div className="num mt-0.5 text-sm font-semibold text-primary">{yes}¢</div>
        </div>
        <div className="rounded-xl bg-white/[0.045] px-3 py-2">
          <div className="text-[9px] text-muted-foreground">No</div>
          <div className="num mt-0.5 text-sm font-semibold">{100 - yes}¢</div>
        </div>
        <div className="text-right text-[9px] leading-4 text-muted-foreground">
          <div>{money(event.volume24h)} 24h</div>
          <div>{money(event.openInterest)} OI</div>
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-primary" style={{ width: `${yes}%` }} />
      </div>
    </Link>
  );
}

function AssetFeed({ market }: { market: "stocks" | "crypto" }) {
  const holdings = useHoldings();
  const watch = useWatchlist();
  const searchFn = useServerFn(searchInstruments);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const tracked = useMemo(() => {
    const map = new Map<string, { symbol: string; name: string; price: number | null; held: boolean }>();
    for (const w of watch.data ?? []) if (w.market === market) map.set(w.symbol, { symbol: w.symbol, name: w.name ?? w.symbol, price: null, held: false });
    for (const h of holdings.data ?? []) if (h.market === market) map.set(h.symbol, { symbol: h.symbol, name: h.name ?? h.symbol, price: Number(h.last_price) || null, held: true });
    return [...map.values()].sort((a, b) => Number(b.held) - Number(a.held) || a.symbol.localeCompare(b.symbol));
  }, [holdings.data, market, watch.data]);

  const search = useQuery({
    queryKey: ["market-asset-search", market, debounced],
    queryFn: () => searchFn({ data: { query: debounced, market } }),
    enabled: debounced.length > 0,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{MARKET_LABEL[market]}</div><h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">{market === "stocks" ? "Stocks" : "Crypto"}</h2></div>
        <label className="relative block sm:w-72"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${market}`} className="w-full rounded-xl border border-border bg-card/60 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary/35" /></label>
      </div>

      {debounced ? (
        <div className="mt-5 divide-y divide-border">
          {(search.data ?? []).map((r) => (
            <Link key={r.symbol} to="/asset/$market/$symbol" params={{ market: r.market, symbol: r.symbol }} className="flex items-center gap-3 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-[10px] font-bold">{r.symbol.slice(0, 3)}</div>
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{r.symbol}</div><div className="truncate text-[10px] text-muted-foreground">{r.name} · {r.exchange}</div></div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {search.isLoading && <div className="py-8 text-center text-xs text-muted-foreground">Searching Alpaca…</div>}
          {!search.isLoading && !(search.data ?? []).length && <div className="py-8 text-center text-xs text-muted-foreground">No tradable matches.</div>}
        </div>
      ) : (
        <>
          <div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your markets</div>
          <div className="mt-2 divide-y divide-border">
            {tracked.map((a) => (
              <Link key={a.symbol} to="/asset/$market/$symbol" params={{ market, symbol: a.symbol }} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3.5">
                <div><div className="text-sm font-semibold">{a.symbol}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{a.name}</div></div>
                <div className="num text-xs">{a.price ? usd(a.price, a.price < 5 ? 4 : 2) : "—"}</div>
                <div className="text-[9px] text-muted-foreground">{a.held ? "Position" : "Watchlist"}</div>
              </Link>
            ))}
            {!tracked.length && <div className="py-10 text-center text-xs text-muted-foreground">Search above to discover markets.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof CircleDollarSign; children: string }) {
  return <button onClick={onClick} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors", active ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className={cn("h-3.5 w-3.5", active && "text-primary")} />{children}</button>;
}

function primaryMarket(event: PredictionEvent) {
  return [...event.markets].sort((a, b) => b.volume24h - a.volume24h)[0] ?? null;
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}
