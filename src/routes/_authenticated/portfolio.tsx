import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { useTransactions } from "@/lib/db";
import { MARKET_LABEL, num, pct, timeAgo, usd } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Terminal" },
      {
        name: "description",
        content:
          "Every holding, cost basis, unrealised P&L and allocation drift across crypto, stocks and Kalshi.",
      },
      { property: "og:title", content: "Portfolio — Terminal" },
      { property: "og:description", content: "Holdings, P&L, allocation drift and trade history in one view." },
    ],
  }),
  component: Portfolio,
});

type SortKey = "value" | "pnl" | "symbol";

function Portfolio() {
  const p = usePortfolio();
  const tx = useTransactions(40);
  const [market, setMarket] = useState("all");
  const [sort, setSort] = useState<SortKey>("value");

  const rows = useMemo(() => {
    const list = p.holdings
      .filter((h) => market === "all" || h.market === market)
      .map((h) => {
        const value = h.quantity * h.last_price;
        const cost = h.quantity * h.avg_cost;
        return { ...h, value, cost, pnl: value - cost, pnlPct: cost ? (value - cost) / cost : 0 };
      });
    return list.sort((a, b) =>
      sort === "symbol" ? a.symbol.localeCompare(b.symbol) : sort === "pnl" ? b.pnl - a.pnl : b.value - a.value,
    );
  }, [p.holdings, market, sort]);

  const markets = ["all", ...new Set(p.holdings.map((h) => h.market))];
  const driftData = p.allocation.map((a) => ({
    name: MARKET_LABEL[a.market] ?? a.market,
    drift: Number(((a.weight - a.target) * 100).toFixed(1)),
  }));

  return (
    <AppShell title="Portfolio" subtitle="Positions, cost basis and allocation discipline">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-12" title="Position summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Market value" value={usd(p.marketValue)} tone="gold" />
            <Stat label="Cost basis" value={usd(p.costBasis)} />
            <Stat
              label="Unrealised"
              value={`${p.unrealized >= 0 ? "+" : ""}${usd(p.unrealized)}`}
              hint={pct(p.unrealizedPct)}
              tone={p.unrealized >= 0 ? "up" : "down"}
            />
            <Stat label="Cash" value={usd(p.cash)} />
            <Stat
              label="Max drawdown"
              value={pct(p.drawdown)}
              hint="From 90-day peak"
              tone={p.drawdown < -0.05 ? "down" : "neutral"}
            />
          </div>
        </Panel>

        <Panel
          className="lg:col-span-8"
          title="Holdings"
          subtitle={`${rows.length} positions`}
          action={
            <div className="flex flex-wrap items-center gap-1">
              {markets.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarket(m)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    market === m ? "bg-gold text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "all" ? "All" : (MARKET_LABEL[m] ?? m)}
                </button>
              ))}
            </div>
          }
          bodyClassName="px-0 pb-3"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Th onClick={() => setSort("symbol")}>Symbol</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Avg cost</Th>
                  <Th align="right">Last</Th>
                  <Th align="right" onClick={() => setSort("value")}>
                    Value
                  </Th>
                  <Th align="right" onClick={() => setSort("pnl")}>
                    P&amp;L
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{h.symbol}</span>
                        <Pill>{MARKET_LABEL[h.market] ?? h.market}</Pill>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{h.name}</span>
                    </td>
                    <td className="num px-4 py-2.5 text-right">{num(h.quantity, 4)}</td>
                    <td className="num px-4 py-2.5 text-right">{usd(h.avg_cost, h.avg_cost < 5 ? 3 : 2)}</td>
                    <td className="num px-4 py-2.5 text-right">{usd(h.last_price, h.last_price < 5 ? 3 : 2)}</td>
                    <td className="num px-4 py-2.5 text-right">{usd(h.value)}</td>
                    <td
                      className={cn("num px-4 py-2.5 text-right", h.pnl >= 0 ? "text-bull" : "text-bear")}
                    >
                      {h.pnl >= 0 ? "+" : ""}
                      {usd(h.pnl)}
                      <span className="block text-[11px] opacity-80">{pct(h.pnlPct)}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No positions in this market yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 lg:col-span-4">
          <Panel title="Allocation drift" subtitle="Actual weight vs strategy target">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driftData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v}%`, "Drift"]}
                  />
                  <Bar dataKey="drift" radius={3}>
                    {driftData.map((d) => (
                      <Cell key={d.name} fill={d.drift >= 0 ? "var(--bull)" : "var(--bear)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5">
              {p.allocation.map((a) => (
                <li key={a.market} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{MARKET_LABEL[a.market] ?? a.market}</span>
                  <span className="num">
                    {(a.weight * 100).toFixed(1)}%
                    <span className="text-muted-foreground"> / {(a.target * 100).toFixed(0)}% target</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Accounts" subtitle="Balances by venue">
            <ul className="space-y-2">
              {p.accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.label}</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {MARKET_LABEL[a.market] ?? a.market} · {a.mode}
                    </p>
                  </div>
                  <span className="num text-sm">{usd(a.balance_usd)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel className="lg:col-span-12" title="Trade history" subtitle="Most recent fills" bodyClassName="px-0 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Th>When</Th>
                  <Th>Symbol</Th>
                  <Th>Side</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Notional</Th>
                  <Th>Mode</Th>
                </tr>
              </thead>
              <tbody>
                {(tx.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{timeAgo(t.executed_at)}</td>
                    <td className="px-4 py-2 font-medium">{t.symbol}</td>
                    <td className="px-4 py-2">
                      <Pill tone={t.side === "buy" ? "up" : "down"}>{t.side}</Pill>
                    </td>
                    <td className="num px-4 py-2 text-right">{num(t.quantity, 4)}</td>
                    <td className="num px-4 py-2 text-right">{usd(t.price, t.price < 5 ? 3 : 2)}</td>
                    <td className="num px-4 py-2 text-right">{usd(t.quantity * t.price)}</td>
                    <td className="px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{t.mode}</td>
                  </tr>
                ))}
                {(tx.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No trades recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Th({
  children,
  align = "left",
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-4 py-2 font-semibold",
        align === "right" ? "text-right" : "text-left",
        onClick && "cursor-pointer hover:text-gold",
      )}
    >
      {children}
    </th>
  );
}
