import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProTradingChart } from "@/components/ProTradingChart";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAccounts, useHoldings, useTransactions, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, num, pct, timeAgo, usd } from "@/lib/format";
import { getMarketSnapshot, type ChartRange } from "@/lib/market.functions";
import { placePaperTrade } from "@/lib/paper-trade.functions";
import { addWatchlistItem, removeWatchlistItem, searchInstruments } from "@/lib/watchlist.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: (search: Record<string, unknown>) => ({
    symbol: typeof search["symbol"] === "string" ? String(search["symbol"]) : undefined,
  }),
  head: () => ({ meta: [{ title: "Trade — Terminal" }] }),
  component: Trade,
});

type Instrument = {
  symbol: string;
  market: "stocks" | "crypto";
  name: string;
  recorded: number | null;
};

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y"];

function keyOf(x: Pick<Instrument, "market" | "symbol">) {
  return `${x.market}:${x.symbol}`;
}

function Trade() {
  const { symbol: initialSymbol } = Route.useSearch();
  const holdings = useHoldings();
  const watch = useWatchlist();
  const accounts = useAccounts();
  const tx = useTransactions(40);
  const fetchSnapshot = useServerFn(getMarketSnapshot);
  const searchFn = useServerFn(searchInstruments);
  const addWatch = useServerFn(addWatchlistItem);
  const removeWatch = useServerFn(removeWatchlistItem);
  const qc = useQueryClient();

  const [range, setRange] = useState<ChartRange>("1M");
  const [activeKey, setActiveKey] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mobileTicket, setMobileTicket] = useState<"buy" | "sell" | null>(null);

  const universe = useMemo<Instrument[]>(() => {
    const map = new Map<string, Instrument>();
    for (const h of holdings.data ?? []) {
      if (h.market !== "stocks" && h.market !== "crypto") continue;
      const row: Instrument = {
        symbol: h.symbol,
        market: h.market,
        name: h.name ?? h.symbol,
        recorded: Number(h.last_price) > 0 ? Number(h.last_price) : null,
      };
      map.set(keyOf(row), row);
    }
    for (const w of watch.data ?? []) {
      if (w.market !== "stocks" && w.market !== "crypto") continue;
      const row: Instrument = {
        symbol: w.symbol,
        market: w.market,
        name: w.name ?? w.symbol,
        recorded: map.get(`${w.market}:${w.symbol}`)?.recorded ?? null,
      };
      map.set(keyOf(row), row);
    }
    return [...map.values()].sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
  }, [holdings.data, watch.data]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (activeKey) return;
    const initial = universe.find((u) => u.symbol === initialSymbol) ?? universe[0];
    if (initial) setActiveKey(keyOf(initial));
  }, [activeKey, initialSymbol, universe]);

  const selected = universe.find((u) => keyOf(u) === activeKey) ?? universe[0] ?? null;

  const results = useQuery({
    queryKey: ["instrument-search", debounced],
    queryFn: () => searchFn({ data: { query: debounced, market: "all" } }),
    enabled: debounced.length >= 1,
    staleTime: 5 * 60_000,
  });

  const snapshot = useQuery({
    queryKey: ["trade-market-snapshot", selected?.market, selected?.symbol, range],
    queryFn: () => fetchSnapshot({ data: { symbol: selected!.symbol, market: selected!.market, range } }),
    enabled: Boolean(selected),
    staleTime: range === "1D" ? 15_000 : 60_000,
    refetchInterval: range === "1D" ? 25_000 : false,
  });

  const watchMutation = useMutation({
    mutationFn: async (row: Instrument) => {
      const exists = (watch.data ?? []).some((w) => w.market === row.market && w.symbol === row.symbol);
      if (exists) return removeWatch({ data: { market: row.market, symbol: row.symbol } });
      return addWatch({ data: { market: row.market, symbol: row.symbol, name: row.name } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Watchlist update failed"),
  });

  const addFromSearch = useMutation({
    mutationFn: async (row: { symbol: string; name: string; market: "stocks" | "crypto" }) => {
      await addWatch({ data: row });
      return row;
    },
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["watchlist"] });
      setSearch("");
      setDebounced("");
      setActiveKey(`${row.market}:${row.symbol}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add symbol"),
  });

  const price = snapshot.data?.latest ?? selected?.recorded ?? null;
  const position = (holdings.data ?? []).find((h) => h.market === selected?.market && h.symbol === selected?.symbol) ?? null;
  const account = (accounts.data ?? []).find((a) => a.market === selected?.market);
  const watched = selected
    ? (watch.data ?? []).some((w) => w.market === selected.market && w.symbol === selected.symbol)
    : false;

  return (
    <AppShell title="Trade" subtitle="TradingView-style workspace · verified Alpaca data · paper execution" noPad>
      <div className="min-h-[calc(100vh-7rem)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_21rem]">
        <aside className="hidden border-r border-border bg-card/20 lg:block">
          <SearchPanel
            value={search}
            onChange={setSearch}
            results={results.data ?? []}
            loading={results.isFetching}
            onSelect={(row) => addFromSearch.mutate(row)}
          />
          <div className="border-t border-border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Watchlist
          </div>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">
            {universe.map((u) => (
              <button
                key={keyOf(u)}
                onClick={() => setActiveKey(keyOf(u))}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-l-2 px-4 py-3 text-left transition-colors",
                  selected && keyOf(selected) === keyOf(u)
                    ? "border-primary bg-primary/[0.055]"
                    : "border-transparent hover:bg-white/[0.025]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{u.symbol}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">{MARKET_LABEL[u.market]} · {u.name}</span>
                </span>
                <span className="num text-[10px] text-muted-foreground">
                  {u.recorded != null ? usd(u.recorded, u.recorded < 5 ? 4 : 2) : "—"}
                </span>
              </button>
            ))}
            {!universe.length && (
              <div className="px-4 py-8 text-center text-xs leading-5 text-muted-foreground">
                Search a symbol above to build your watchlist.
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-3 lg:hidden">
            <SearchPanel
              value={search}
              onChange={setSearch}
              results={results.data ?? []}
              loading={results.isFetching}
              onSelect={(row) => addFromSearch.mutate(row)}
              mobile
            />
            {!search && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {universe.map((u) => (
                  <button
                    key={keyOf(u)}
                    onClick={() => setActiveKey(keyOf(u))}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold",
                      selected && keyOf(selected) === keyOf(u)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {u.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selected ? (
            <div className="flex min-h-[35rem] items-center justify-center px-8 text-center">
              <div>
                <Search className="mx-auto h-6 w-6 text-muted-foreground" />
                <div className="mt-3 text-sm font-medium">Find a market to trade</div>
                <div className="mt-1 text-xs text-muted-foreground">Search US equities or crypto and add them to your watchlist.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
                <div>
                  <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <span>{MARKET_LABEL[selected.market]}</span>
                    <span>·</span>
                    <span>{snapshot.data?.source === "alpaca" ? "Alpaca" : "Recorded"}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-[-0.045em]">{selected.symbol}</h2>
                    <button
                      onClick={() => watchMutation.mutate(selected)}
                      className={cn("rounded-lg p-1.5 transition-colors", watched ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Star className={cn("h-4 w-4", watched && "fill-current")} />
                    </button>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{selected.name}</div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-semibold sm:text-3xl">{price != null ? usd(price, price < 5 ? 4 : 2) : "—"}</div>
                  {snapshot.data?.changePct != null && (
                    <div className={cn("num mt-1 flex items-center justify-end gap-1 text-[11px] font-medium", snapshot.data.changePct >= 0 ? "text-bull" : "text-bear")}>
                      {snapshot.data.changePct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {pct(snapshot.data.changePct)} · {range}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 border-y border-border px-3 py-2">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                      range === r ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
                <div className="ml-auto hidden text-[9px] text-muted-foreground sm:block">
                  {snapshot.data?.asOf ? `Updated ${new Date(snapshot.data.asOf).toLocaleString()}` : ""}
                </div>
              </div>

              {snapshot.isLoading ? (
                <div className="flex h-[24rem] items-center justify-center text-xs text-muted-foreground sm:h-[31rem]">Loading verified candles…</div>
              ) : snapshot.data?.bars?.length ? (
                <ProTradingChart candles={snapshot.data.bars} />
              ) : (
                <div className="flex h-[24rem] flex-col items-center justify-center px-8 text-center sm:h-[31rem]">
                  <div className="text-sm font-medium">Verified chart unavailable</div>
                  <div className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{snapshot.data?.message ?? "No candles returned."}</div>
                  <Link to="/connections" className="mt-4 rounded-xl border border-border px-3 py-2 text-xs">Open connections</Link>
                </div>
              )}

              <div className="grid grid-cols-3 border-t border-border text-center">
                <Stat label="Position" value={position ? `${num(position.quantity, 5)} ${selected.symbol}` : "None"} />
                <Stat label="Avg cost" value={position ? usd(Number(position.avg_cost)) : "—"} />
                <Stat label="Buying power" value={usd(Number(account?.balance_usd ?? 0))} />
              </div>

              <div className="border-t border-border p-4 lg:hidden">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMobileTicket("buy")} className="rounded-xl bg-bull py-3 text-sm font-semibold text-black">Buy</button>
                  <button onClick={() => setMobileTicket("sell")} className="rounded-xl bg-bear py-3 text-sm font-semibold text-white">Sell</button>
                </div>
                <Link to="/asset/$market/$symbol" params={{ market: selected.market, symbol: selected.symbol }} className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-medium">
                  Full asset page <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </section>

        <aside className="hidden bg-card/20 lg:block">
          <div className="sticky top-[62px] p-4">
            <OrderTicket
              selected={selected}
              displayPrice={price}
              cash={Number(account?.balance_usd ?? 0)}
              positionQty={Number(position?.quantity ?? 0)}
              onFilled={() => invalidateTrading(qc)}
            />
            {selected && (
              <div className="mt-3 grid gap-2">
                <Link to="/asset/$market/$symbol" params={{ market: selected.market, symbol: selected.symbol }} className="flex items-center justify-between rounded-xl border border-border p-3 text-xs font-medium hover:border-primary/25">
                  Open asset page <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link to="/research" search={{ prompt: `Research ${selected.symbol}: trend, risks, catalysts and a testable trading thesis.` }} className="flex items-center justify-between rounded-xl border border-border p-3 text-xs font-medium hover:border-primary/25">
                  <span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" />Research {selected.symbol}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="border-t border-border bg-card/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-semibold">Paper fills</span>
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Simulated · server-priced</span>
        </div>
        <div className="overflow-x-auto">
          {(tx.data ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">No paper fills yet.</div>
          ) : (
            <table className="w-full min-w-[42rem] text-xs">
              <tbody>
                {(tx.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">{t.symbol}</td>
                    <td className={cn("px-4 py-3 font-semibold", t.side === "buy" ? "text-bull" : "text-bear")}>{t.side.toUpperCase()}</td>
                    <td className="num px-4 py-3 text-right">{num(t.quantity, 5)}</td>
                    <td className="num px-4 py-3 text-right">{usd(t.price)}</td>
                    <td className="num px-4 py-3 text-right">{usd(t.quantity * t.price)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(t.executed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Sheet open={mobileTicket != null} onOpenChange={(open) => !open && setMobileTicket(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl border-border bg-background p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="text-sm">{selected ? `${mobileTicket === "sell" ? "Sell" : "Buy"} ${selected.symbol}` : "Paper order"}</SheetTitle>
            <button onClick={() => setMobileTicket(null)} className="rounded-lg p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <OrderTicket
              selected={selected}
              displayPrice={price}
              cash={Number(account?.balance_usd ?? 0)}
              positionQty={Number(position?.quantity ?? 0)}
              initialSide={mobileTicket ?? "buy"}
              bare
              onFilled={() => {
                invalidateTrading(qc);
                setMobileTicket(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function invalidateTrading(qc: ReturnType<typeof useQueryClient>) {
  ["holdings", "accounts", "transactions", "watchlist"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  qc.invalidateQueries({ queryKey: ["trade-market-snapshot"] });
}

function SearchPanel({
  value,
  onChange,
  results,
  loading,
  onSelect,
  mobile = false,
}: {
  value: string;
  onChange: (v: string) => void;
  results: Array<{ symbol: string; name: string; market: "stocks" | "crypto"; exchange: string; fractionable: boolean }>;
  loading: boolean;
  onSelect: (row: { symbol: string; name: string; market: "stocks" | "crypto" }) => void;
  mobile?: boolean;
}) {
  return (
    <div className="relative">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search stocks or crypto"
          className="w-full rounded-xl border border-border bg-background/70 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary/35"
        />
      </label>
      {value && (
        <div className={cn("z-30 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl", mobile ? "relative" : "absolute left-0 right-0 top-full")}>
          {loading && <div className="px-3 py-3 text-[10px] text-muted-foreground">Searching Alpaca…</div>}
          {!loading && !results.length && <div className="px-3 py-4 text-center text-[10px] text-muted-foreground">No matching tradable assets.</div>}
          {results.map((r) => (
            <button key={`${r.market}:${r.symbol}`} onClick={() => onSelect(r)} className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-[10px] font-bold">{r.symbol.slice(0, 3)}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{r.symbol}</div><div className="truncate text-[9px] text-muted-foreground">{r.name}</div></div>
              <div className="text-[9px] uppercase text-muted-foreground">{r.market === "crypto" ? "Crypto" : r.exchange}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderTicket({
  selected,
  displayPrice,
  cash,
  positionQty,
  onFilled,
  initialSide = "buy",
  bare = false,
}: {
  selected: Instrument | null;
  displayPrice: number | null;
  cash: number;
  positionQty: number;
  onFilled: () => void;
  initialSide?: "buy" | "sell";
  bare?: boolean;
}) {
  const place = useServerFn(placePaperTrade);
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [inputMode, setInputMode] = useState<"usd" | "shares">("usd");
  const [value, setValue] = useState("");

  useEffect(() => setSide(initialSide), [initialSide]);
  useEffect(() => setValue(""), [selected?.symbol]);

  const raw = Number(value) || 0;
  const quantity = inputMode === "shares" ? raw : displayPrice ? raw / displayPrice : 0;
  const estNotional = displayPrice ? quantity * displayPrice : 0;
  const estFee = estNotional * 0.001;

  const order = useMutation({
    mutationFn: () => place({ data: { market: selected!.market, symbol: selected!.symbol, name: selected!.name, side, quantity } }),
    onSuccess: (result) => {
      setValue("");
      onFilled();
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${num(Number(result.quantity), 5)} ${result.symbol} at ${usd(Number(result.price))}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Paper order failed"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !displayPrice) return toast.error("A verified market price is required.");
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Enter an amount.");
    if (side === "buy" && estNotional + estFee > cash) return toast.error("Not enough paper buying power.");
    if (side === "sell" && quantity > positionQty) return toast.error("You cannot sell more than your paper position.");
    order.mutate();
  }

  const body = (
    <>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-background/70 p-1">
        <button onClick={() => setSide("buy")} type="button" className={cn("rounded-lg py-2 text-xs font-semibold", side === "buy" ? "bg-bull text-black" : "text-muted-foreground")}>Buy</button>
        <button onClick={() => setSide("sell")} type="button" className={cn("rounded-lg py-2 text-xs font-semibold", side === "sell" ? "bg-bear text-white" : "text-muted-foreground")}>Sell</button>
      </div>

      <form onSubmit={submit}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Order by</span>
          <button type="button" onClick={() => { setInputMode(inputMode === "usd" ? "shares" : "usd"); setValue(""); }} className="flex items-center gap-1 text-[10px] font-medium">
            {inputMode === "usd" ? "Dollars" : "Shares"} <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="my-5 flex items-baseline justify-center gap-1">
          {inputMode === "usd" && <span className="text-3xl font-semibold text-muted-foreground">$</span>}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            className="num min-w-0 max-w-[13rem] bg-transparent text-center text-4xl font-semibold tracking-[-0.05em] outline-none placeholder:text-muted-foreground/35"
          />
          {inputMode === "shares" && <span className="text-xs text-muted-foreground">shares</span>}
        </div>

        <div className="space-y-2 border-y border-border py-3 text-[10px]">
          <Row label="Reference price" value={displayPrice ? usd(displayPrice, displayPrice < 5 ? 4 : 2) : "—"} />
          <Row label="Estimated quantity" value={quantity > 0 ? num(quantity, 6) : "—"} />
          <Row label="Estimated fee" value={usd(estFee)} />
          <Row label={side === "buy" ? "Buying power" : "Position"} value={side === "buy" ? usd(cash) : `${num(positionQty, 6)} shares`} />
        </div>

        <button
          disabled={order.isPending || !selected || !displayPrice || quantity <= 0}
          className={cn("mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-35", side === "buy" ? "bg-bull text-black" : "bg-bear text-white")}
        >
          {order.isPending ? "Filling…" : `Review ${side}`}
          {!order.isPending && <ArrowRight className="h-4 w-4" />}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          Price is re-checked server-side with Alpaca before the simulated fill. No live broker order is sent.
        </p>
      </form>
    </>
  );

  if (bare) return body;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div><div className="text-sm font-semibold">{selected ? `${side === "buy" ? "Buy" : "Sell"} ${selected.symbol}` : "Paper order"}</div><div className="mt-0.5 text-[9px] text-muted-foreground">Server-verified simulated execution</div></div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">PAPER</span>
      </div>
      {body}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="num text-right text-foreground">{value}</span></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-border px-3 py-3 last:border-r-0"><div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div><div className="num mt-1 truncate text-xs font-medium">{value}</div></div>;
}
