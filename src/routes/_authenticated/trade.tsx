import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BrainCircuit, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CandleChart } from "@/components/CandleChart";
import { useAccounts, useHoldings, useTransactions, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, num, pct, timeAgo, usd } from "@/lib/format";
import { getMarketSnapshot } from "@/lib/market.functions";
import { placePaperTrade } from "@/lib/paper-trade.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: (search: Record<string, unknown>) => ({
    symbol: typeof search["symbol"] === "string" ? String(search["symbol"]) : undefined,
  }),
  head: () => ({ meta: [{ title: "Paper trade — Terminal" }] }),
  component: Trade,
});

type Instrument = { symbol: string; market: string; name: string; recorded: number | null };

function Trade() {
  const { symbol: initialSymbol } = Route.useSearch();
  const holdings = useHoldings();
  const watch = useWatchlist();
  const accounts = useAccounts();
  const tx = useTransactions(30);
  const fetchSnapshot = useServerFn(getMarketSnapshot);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  const universe = useMemo<Instrument[]>(() => {
    const map = new Map<string, Instrument>();
    for (const h of holdings.data ?? []) map.set(h.symbol, { symbol: h.symbol, market: h.market, name: h.name ?? h.symbol, recorded: Number(h.last_price) > 0 ? Number(h.last_price) : null });
    for (const w of watch.data ?? []) if (!map.has(w.symbol)) map.set(w.symbol, { symbol: w.symbol, market: w.market, name: w.name ?? w.symbol, recorded: null });
    return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [holdings.data, watch.data]);

  const [active, setActive] = useState(initialSymbol ?? "");
  const selected = universe.find((u) => u.symbol === active) ?? universe[0] ?? null;
  useEffect(() => { if (!active && selected) setActive(selected.symbol); }, [active, selected]);

  const snapshot = useQuery({
    queryKey: ["trade-market-snapshot", selected?.market, selected?.symbol],
    queryFn: () => fetchSnapshot({ data: { symbol: selected!.symbol, market: selected!.market } }),
    enabled: Boolean(selected),
    staleTime: 45_000,
  });

  const price = snapshot.data?.latest ?? selected?.recorded ?? null;
  const rows = universe.filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || u.symbol.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  return (
    <AppShell title="Trade" subtitle="Paper execution using verified or explicitly recorded prices" noPad>
      <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <aside className="border-b border-border bg-card/40 lg:border-b-0 lg:border-r">
          <div className="p-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search watchlist" className="w-full rounded-xl border border-border bg-background/60 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/35" />
            </label>
          </div>
          <div className="divide-y divide-border">
            {rows.map((u) => (
              <button key={u.symbol} onClick={() => setActive(u.symbol)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 text-left", selected?.symbol === u.symbol ? "bg-primary/[0.07]" : "hover:bg-white/[0.025]")}>
                <span className="min-w-0"><span className="block truncate text-xs font-semibold">{u.symbol}</span><span className="block truncate text-[9px] text-muted-foreground">{MARKET_LABEL[u.market] ?? u.market}</span></span>
                <span className="num text-[10px] text-muted-foreground">{u.recorded != null ? usd(u.recorded, u.recorded < 5 ? 3 : 2) : "—"}</span>
              </button>
            ))}
            {rows.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">No tracked symbols.</div>}
          </div>
        </aside>

        <section className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          {!selected ? (
            <div className="flex h-full min-h-96 items-center justify-center p-8 text-center text-sm text-muted-foreground">Add a watchlist symbol or position first.</div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-5 border-b border-border p-5">
                <div><div className="text-[10px] text-muted-foreground">{MARKET_LABEL[selected.market] ?? selected.market}</div><h2 className="mt-1 text-xl font-semibold">{selected.symbol}</h2><div className="mt-1 text-[11px] text-muted-foreground">{selected.name}</div></div>
                <div className="text-right"><div className="num text-2xl font-semibold">{price != null ? usd(price, price < 5 ? 3 : 2) : "—"}</div>{snapshot.data?.changePct != null && <div className={cn("num mt-1 text-[10px]", snapshot.data.changePct >= 0 ? "text-bull" : "text-bear")}>{pct(snapshot.data.changePct)} last session</div>}</div>
              </div>
              {snapshot.data?.bars?.length ? (
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between text-[10px] text-muted-foreground"><span>Alpaca daily bars</span><span>{snapshot.data.asOf ? new Date(snapshot.data.asOf).toLocaleDateString() : ""}</span></div>
                  <div className="h-[30rem]"><CandleChart candles={snapshot.data.bars} /></div>
                </div>
              ) : (
                <div className="flex min-h-[30rem] flex-col items-center justify-center p-8 text-center">
                  <div className="text-sm font-medium">Chart unavailable</div>
                  <div className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{snapshot.data?.message ?? "Connect market data for a verified chart."}</div>
                  <Link to="/connections" className="mt-4 rounded-xl border border-border px-3 py-2 text-xs">Open connections</Link>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="bg-card/30">
          <OrderTicket
            selected={selected}
            price={price}
            cash={(accounts.data ?? []).find((a) => a.market === selected?.market)?.balance_usd ?? 0}
            position={(holdings.data ?? []).find((h) => h.symbol === selected?.symbol) ?? null}
            onFilled={() => ["holdings", "accounts", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))}
          />
          {selected && <div className="border-t border-border p-4"><Link to="/research" className="flex items-center justify-between rounded-2xl border border-border p-3 text-xs font-medium hover:border-primary/25"><span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" />Research {selected.symbol}</span><ArrowRight className="h-3.5 w-3.5" /></Link></div>}
        </aside>
      </div>

      <section className="border-t border-border bg-card/30">
        <div className="border-b border-border px-4 py-3 text-xs font-semibold">Recent paper fills</div>
        <div className="overflow-x-auto">
          {(tx.data ?? []).length === 0 ? <div className="px-4 py-8 text-center text-xs text-muted-foreground">No fills yet.</div> : (
            <table className="w-full min-w-[42rem] text-xs">
              <tbody>{(tx.data ?? []).map((t) => <tr key={t.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-semibold">{t.symbol}</td><td className={cn("px-4 py-3 font-semibold", t.side === "buy" ? "text-bull" : "text-bear")}>{t.side.toUpperCase()}</td><td className="num px-4 py-3 text-right">{num(t.quantity, 4)}</td><td className="num px-4 py-3 text-right">{usd(t.price)}</td><td className="num px-4 py-3 text-right">{usd(t.quantity * t.price)}</td><td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(t.executed_at)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function OrderTicket({ selected, price, cash, position, onFilled }: { selected: Instrument | null; price: number | null; cash: number; position: { id: string; quantity: number; avg_cost: number } | null; onFilled: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [pending, setPending] = useState(false);
  const place = useServerFn(placePaperTrade);
  const quantity = Number(qty) || 0;
  const notional = price != null ? quantity * price : 0;

  useEffect(() => setQty(""), [selected?.symbol]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || price == null || price <= 0) return toast.error("A verified or recorded price is required.");
    if (quantity <= 0) return toast.error("Enter a quantity.");
    if (side === "buy" && notional > cash) return toast.error("Not enough paper cash.");
    if (side === "sell" && quantity > Number(position?.quantity ?? 0)) return toast.error("You cannot sell more than the paper position.");

    setPending(true);
    try {
      const result = await place({
        data: { market: selected.market, symbol: selected.symbol, name: selected.name, side, quantity },
      });
      setQty("");
      onFilled();
      toast.success(
        (side === "buy" ? "Bought " : "Sold ") +
          num(Number(result.quantity), 4) + " " + result.symbol + " at " + usd(Number(result.price)) + " in paper mode",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paper order failed");
    } finally {
      setPending(false);
    }
  }

  return <div className="p-4">
    <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-semibold">Paper order</div><div className="mt-0.5 text-[10px] text-muted-foreground">Never routes live by default</div></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">SIM</span></div>
    <div className="mb-4 grid grid-cols-2 rounded-xl bg-background/50 p-1">
      <button onClick={() => setSide("buy")} type="button" className={cn("rounded-lg py-2 text-xs font-semibold", side === "buy" ? "bg-bull text-black" : "text-muted-foreground")}>Buy</button>
      <button onClick={() => setSide("sell")} type="button" className={cn("rounded-lg py-2 text-xs font-semibold", side === "sell" ? "bg-bear text-white" : "text-muted-foreground")}>Sell</button>
    </div>
    <form onSubmit={submit} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-[10px] text-muted-foreground">Quantity</span><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="0" className="input-mono" /></label>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border p-3 text-xs"><div><div className="text-[9px] text-muted-foreground">Reference price</div><div className="num mt-1">{price != null ? usd(price) : "—"}</div></div><div className="text-right"><div className="text-[9px] text-muted-foreground">Notional</div><div className="num mt-1">{usd(notional)}</div></div></div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>Available cash</span><span className="num">{usd(cash)}</span></div>
      <button disabled={pending || !selected || price == null || quantity <= 0} className={cn("w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-35", side === "buy" ? "bg-bull text-black" : "bg-bear text-white")}>{pending ? "Filling…" : side === "buy" ? "Review paper buy" : "Review paper sell"}</button>
      <p className="text-[9px] leading-4 text-muted-foreground">Paper fills use the displayed Terminal reference price plus a simulated 0.10% fee. They are not broker executions.</p>
    </form>
  </div>;
}
