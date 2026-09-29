import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TradingChart } from "@/components/TradingChart";
import { askAdvisor } from "@/lib/advisor.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useHoldings, useTransactions, useWatchlist } from "@/lib/db";
import { MARKET_LABEL, num, usd } from "@/lib/format";
import { buildDepth } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trade")({
  validateSearch: (search: Record<string, unknown>) => ({
    symbol: typeof search["symbol"] === "string" ? (search["symbol"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Trade — Aurum Terminal" },
      {
        name: "description",
        content:
          "Paper execution built like TradingView — watchlist, candles, depth and a one-click order ticket.",
      },
      { property: "og:title", content: "Trade — Aurum Terminal" },
      {
        property: "og:description",
        content: "Place sized, risk-managed paper trades across crypto and stocks.",
      },
    ],
  }),
  component: Trade,
});

const FALLBACK: Record<string, number> = { crypto: 2400, stocks: 180 };
const USE_DIGITS = (p: number) => (p < 5 ? 3 : 2);

function Trade() {
  const { symbol: initialSymbol } = Route.useSearch();
  const holdings = useHoldings();
  const watch = useWatchlist();
  const accounts = useAccounts();
  const tx = useTransactions(30);
  const qc = useQueryClient();

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
    return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [holdings.data, watch.data]);

  const [active, setActive] = useState(initialSymbol ?? "");
  const selected = useMemo(
    () => universe.find((u) => u.symbol === active) ?? universe[0] ?? null,
    [universe, active],
  );
  useEffect(() => {
    if (!active && selected) setActive(selected.symbol);
  }, [active, selected]);

  const depth = useMemo(
    () => (selected ? buildDepth(selected.price, selected.symbol) : { bids: [], asks: [] }),
    [selected],
  );

  const [query, setQuery] = useState("");

  const watchRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universe.filter(
      (u) => !q || u.symbol.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q),
    );
  }, [universe, query]);

  return (
    <AppShell
      title="Trade"
      subtitle="Paper execution — every fill updates your live portfolio"
      noPad
    >
      {/* Main trading layout */}
      <div className="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-0 overflow-hidden lg:flex-row">
        {/* Watchlist */}
        <div className="flex w-full shrink-0 flex-col border-b border-border/70 bg-black/40 lg:w-[13rem] lg:border-b-0 lg:border-r lg:border-border/70">
          <div className="border-b border-border/50 px-2 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-border/50 bg-background/40 py-1.5 pl-7 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-gold/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-border/40 px-2 py-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60">
            <span className="min-w-0 flex-1">Symbol</span>
            <span className="num w-16 text-right">Last</span>
            <span className="num w-12 text-right">Chg%</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-full">
            {watchRows.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No symbols.</p>
            )}
            {watchRows.map((u) => {
              const pos = (holdings.data ?? []).find((h) => h.symbol === u.symbol);
              const chg =
                ((u.price - u.price / 1.02) / (u.price / 1.02)) *
                100 *
                (Math.sin(u.symbol.charCodeAt(0)) > 0 ? 1 : -1);
              const isSel = selected?.symbol === u.symbol;
              return (
                <button
                  key={u.symbol}
                  type="button"
                  onClick={() => setActive(u.symbol)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/30 px-2 py-2 text-left transition-all",
                    isSel
                      ? "bg-gold/10 text-foreground"
                      : "hover:bg-secondary/40 text-foreground/80",
                  )}
                >
                  {isSel && <span className="absolute left-0 h-8 w-0.5 rounded-full bg-gold" />}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs font-semibold",
                        isSel && "text-gold-soft",
                      )}
                    >
                      {u.symbol}
                      {pos && (
                        <span className="ml-1 text-[9px] opacity-60">·{num(pos.quantity, 2)}</span>
                      )}
                    </span>
                    <span className="block truncate text-[9px] text-muted-foreground">
                      {MARKET_LABEL[u.market] ?? u.market}
                    </span>
                  </span>
                  <span className="num w-16 text-right text-xs">
                    {num(u.price, USE_DIGITS(u.price))}
                  </span>
                  <span
                    className={cn(
                      "num w-12 text-right text-[10px]",
                      chg >= 0 ? "text-bull" : "text-bear",
                    )}
                  >
                    {chg >= 0 ? "+" : ""}
                    {chg.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="min-h-0 flex-1 overflow-hidden border-b border-border/70 bg-black lg:border-b-0 lg:border-r lg:border-border/70">
          {selected ? (
            <TradingChart symbol={selected.symbol} price={selected.price} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Add a holding or watchlist symbol to start.
              </p>
            </div>
          )}
        </div>

        {/* Right column: Order panel + AI */}
        <div className="flex w-full shrink-0 flex-col gap-0 overflow-y-auto bg-black/20 lg:w-[19rem]">
          <OrderPanel
            universe={universe}
            selected={selected}
            depth={depth}
            cash={
              (accounts.data ?? []).find((a) => a.market === selected?.market)?.balance_usd ?? 0
            }
            position={(holdings.data ?? []).find((h) => h.symbol === selected?.symbol) ?? null}
            onSelect={setActive}
            onFilled={() =>
              ["holdings", "accounts", "transactions"].forEach((k) =>
                qc.invalidateQueries({ queryKey: [k] }),
              )
            }
          />
          <GeminiPanel symbol={selected?.symbol ?? null} />
        </div>
      </div>

      {/* Recent fills */}
      <div className="border-t border-border/60 bg-black/30">
        <div className="flex items-center gap-4 border-b border-border/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Recent fills</span>
          <span className="ml-auto rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[9px] text-gold-soft">
            Sim
          </span>
        </div>
        <div className="overflow-x-auto">
          {(tx.data ?? []).length === 0 ? (
            <p className="px-4 py-5 text-center text-xs text-muted-foreground">
              No fills yet. Place a trade above.
            </p>
          ) : (
            <table className="w-full min-w-[36rem] text-xs">
              <tbody>
                {(tx.data ?? []).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/30 last:border-0 hover:bg-secondary/20"
                  >
                    <td className="px-4 py-2 font-semibold text-foreground">{t.symbol}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn("font-bold", t.side === "buy" ? "text-bull" : "text-bear")}
                      >
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right text-muted-foreground">
                      {num(t.quantity, 4)}
                    </td>
                    <td className="num px-3 py-2 text-right text-muted-foreground">
                      {usd(t.price, USE_DIGITS(t.price))}
                    </td>
                    <td className="num px-3 py-2 text-right font-medium text-foreground">
                      {usd(t.quantity * t.price)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground/60">
                      {new Date(t.executed_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ─── Gemini AI panel ────────────────────────────────────────────── */

function GeminiPanel({ symbol }: { symbol: string | null }) {
  const ask = useServerFn(askAdvisor);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  // Pre-fill prompt when symbol changes
  useEffect(() => {
    if (symbol) setInput(`Analyse ${symbol} for me`);
  }, [symbol]);

  async function send(prompt: string) {
    if (!prompt.trim() || pending) return;
    const userMsg = prompt.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setPending(true);
    try {
      const res = await ask({ data: { prompt: userMsg } });
      setMessages((m) => [...m, { role: "ai", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Advisor unavailable");
      setMessages((m) => [
        ...m,
        { role: "ai", content: "Sorry — could not reach the advisor. Try again." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border/50 transition-all duration-300",
        open ? "min-h-[16rem]" : "",
      )}
    >
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gold/20">
          <Bot className="h-3.5 w-3.5 text-gold" />
        </div>
        <span className="flex-1 text-xs font-semibold text-gold-soft">Ask Gemini</span>
        {symbol && <span className="num text-[10px] text-muted-foreground">{symbol}</span>}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col fade-up">
          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Ask anything about {symbol ?? "this symbol"}:
                </p>
                {[
                  `What's the risk on ${symbol ?? "this"}?`,
                  "How should I size this position?",
                  "Is now a good entry?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="block w-full rounded-lg border border-border/50 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-gold/30 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed",
                    m.role === "user"
                      ? "bg-gold/15 text-foreground"
                      : "border border-border/50 bg-secondary/40 text-muted-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-border/50 bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span
                      className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold"
                      style={{ animationDelay: "300ms" }}
                    />
                    <span
                      className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold"
                      style={{ animationDelay: "600ms" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-1.5 border-t border-border/40 p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemini…"
              className="input-base text-[12px] py-1.5"
              disabled={pending}
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-[11px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── Order panel ─────────────────────────────────────────────────── */

type Selected = { symbol: string; market: string; name: string; price: number } | null;

function OrderPanel({
  universe,
  selected,
  depth,
  cash,
  position,
  onSelect,
  onFilled,
}: {
  universe: { symbol: string; market: string; name: string }[];
  selected: Selected;
  depth: { bids: { price: number; size: number }[]; asks: { price: number; size: number }[] };
  cash: number;
  position: { id: string; quantity: number; avg_cost: number } | null;
  onSelect: (s: string) => void;
  onFilled: () => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setQty("");
    setLimitPrice("");
    setStop("");
    setTarget("");
  }, [selected?.symbol]);

  const price =
    orderType === "limit" && Number(limitPrice) > 0 ? Number(limitPrice) : (selected?.price ?? 0);
  const quantity = Number(qty) || 0;
  const notional = quantity * price;
  const riskUsd = Number(stop) > 0 && quantity > 0 ? Math.abs(price - Number(stop)) * quantity : 0;
  const bestBid = depth.bids[0]?.price ?? selected?.price ?? 0;
  const bestAsk = depth.asks[depth.asks.length - 1]?.price ?? selected?.price ?? 0;
  const spread = bestAsk - bestBid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (quantity <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }
    if (side === "buy" && notional > cash) {
      toast.error("Insufficient sim cash.");
      return;
    }
    if (side === "sell" && quantity > Number(position?.quantity ?? 0)) {
      toast.error("You cannot sell more than you hold.");
      return;
    }

    setPending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user!.id;
      const fees = notional * 0.001;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: userId,
        market: selected.market,
        symbol: selected.symbol,
        side,
        order_type: orderType,
        quantity,
        price,
        fees,
        stop_price: Number(stop) > 0 ? Number(stop) : null,
        target_price: Number(target) > 0 ? Number(target) : null,
        status: "filled",
        mode: "sim",
      });
      if (txError) throw txError;

      const pos = position;
      if (side === "buy") {
        if (pos) {
          const newQty = Number(pos.quantity) + quantity;
          const newAvg =
            (Number(pos.quantity) * Number(pos.avg_cost) + quantity * price) / (newQty || 1);
          const { error } = await supabase
            .from("holdings")
            .update({ quantity: newQty, avg_cost: newAvg, last_price: price })
            .eq("id", pos.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("holdings").insert({
            user_id: userId,
            market: selected.market,
            symbol: selected.symbol,
            name: selected.name,
            quantity,
            avg_cost: price,
            last_price: price,
          });
          if (error) throw error;
        }
      } else if (pos) {
        const newQty = Number(pos.quantity) - quantity;
        const { error } =
          newQty <= 0
            ? await supabase.from("holdings").delete().eq("id", pos.id)
            : await supabase
                .from("holdings")
                .update({ quantity: newQty, last_price: price })
                .eq("id", pos.id);
        if (error) throw error;
      }

      const account = await supabase
        .from("accounts")
        .select("id, balance_usd")
        .eq("market", selected.market)
        .maybeSingle();
      const acc = account.data;
      if (acc?.id) {
        const delta = side === "buy" ? -(notional + fees) : notional - fees;
        const { error } = await supabase
          .from("accounts")
          .update({ balance_usd: (acc.balance_usd ?? 0) + delta })
          .eq("id", acc.id);
        if (error) throw error;
      }

      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${num(quantity, 4)} ${selected.symbol}`);
      setQty("");
      setStop("");
      setTarget("");
      onFilled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setPending(false);
    }
  }

  const buyBtn = side === "buy";

  return (
    <div className="flex min-h-0 flex-col border-b border-border/50">
      {/* Buy/Sell tabs */}
      <div className="grid grid-cols-2 gap-1 p-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={cn(
            "rounded-lg py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-all",
            buyBtn ? "bg-bull text-black shadow-md shadow-bull/30" : "text-bull/50 hover:text-bull",
          )}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={cn(
            "rounded-lg py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-all",
            !buyBtn
              ? "bg-bear text-black shadow-md shadow-bear/30"
              : "text-bear/50 hover:text-bear",
          )}
        >
          Sell
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2.5 overflow-y-auto p-3 pt-1">
        {/* Symbol */}
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
            Instrument
          </span>
          <select
            value={selected?.symbol ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-2 text-xs text-foreground outline-none focus:border-gold/40"
          >
            {universe.map((u) => (
              <option key={u.symbol} value={u.symbol}>
                {u.symbol} — {MARKET_LABEL[u.market] ?? u.market}
              </option>
            ))}
          </select>
        </label>

        {/* Order type */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/50 p-1">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOrderType(t)}
              className={cn(
                "rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                orderType === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Qty + Price */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="input-mono"
            />
          </Field>
          <Field label={orderType === "limit" ? "Limit price" : "Est. price"}>
            <input
              value={orderType === "limit" ? limitPrice : price.toFixed(USE_DIGITS(price))}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={orderType === "market"}
              inputMode="decimal"
              className="input-mono disabled:opacity-40"
            />
          </Field>
        </div>

        {/* % quick-size */}
        <div className="flex gap-1">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                const base =
                  side === "buy" ? (cash * f) / (price || 1) : Number(position?.quantity ?? 0) * f;
                setQty(base.toFixed(base < 1 ? 4 : 2));
              }}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-all",
                "border-border/50 text-muted-foreground hover:border-gold/40 hover:bg-gold/5 hover:text-gold-soft",
              )}
            >
              {f * 100}%
            </button>
          ))}
        </div>

        {/* Stop/Target */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Stop">
            <input
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              inputMode="decimal"
              placeholder="optional"
              className="input-mono"
            />
          </Field>
          <Field label="Target">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
              placeholder="optional"
              className="input-mono"
            />
          </Field>
        </div>

        {/* Summary */}
        <dl className="space-y-1.5 rounded-xl border border-border/40 bg-secondary/20 p-3 text-[11px]">
          <Row label="Est. value" value={usd(notional)} />
          <Row label="Fees (0.10%)" value={usd(notional * 0.001)} muted />
          <Row label="Risk at stop" value={riskUsd ? usd(riskUsd) : "—"} muted />
          <Row
            label="Cash after"
            value={usd(side === "buy" ? cash - notional * 1.001 : cash + notional * 0.999)}
          />
        </dl>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "w-full rounded-xl py-3 text-xs font-bold uppercase tracking-[0.16em] transition-all hover:opacity-90 disabled:opacity-40",
            buyBtn
              ? "bg-bull text-black shadow-md shadow-bull/20"
              : "bg-bear text-black shadow-md shadow-bear/20",
          )}
        >
          {pending ? "Placing fill…" : `${side} ${selected?.symbol ?? ""}`}
        </button>

        {/* Bid/Ask */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="rounded-lg border border-border/40 bg-bull/5 p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Bid</p>
            <p className="num mt-0.5 font-semibold text-bull">
              {num(bestBid, USE_DIGITS(bestBid))}
            </p>
          </div>
          <div className="rounded-lg border border-border/40 p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Spread</p>
            <p className="num mt-0.5 font-semibold text-muted-foreground">
              {num(spread, USE_DIGITS(spread))}
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-bear/5 p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Ask</p>
            <p className="num mt-0.5 font-semibold text-bear">
              {num(bestAsk, USE_DIGITS(bestAsk))}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/60">
          Cash: {usd(cash)} · {MARKET_LABEL[selected?.market ?? ""] ?? "Sim"}
        </p>
      </form>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("num font-medium", muted ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
