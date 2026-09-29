import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useNews, useSignals, useTraders } from "@/lib/db";
import { compactUsd, pct, timeAgo, usd } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Overview — Aurum Terminal" },
      {
        name: "description",
        content:
          "Net worth, live allocation, top movers, AI signals and market news in one premium trading dashboard.",
      },
      { property: "og:title", content: "Overview — Aurum Terminal" },
      {
        property: "og:description",
        content:
          "Track net worth, allocation drift, signals and news from a single command centre.",
      },
    ],
  }),
  component: Overview,
});

const SLICE_COLORS = ["#c9a84c", "#f0d78c", "#8a7433", "#3f3a2a", "#5d5747"];

function OverviewSkeleton() {
  return (
    <AppShell title="Overview" subtitle="Loading your portfolio…">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Net worth">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-7 w-28" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-5 h-56 w-full" />
        </Panel>
        <Panel className="lg:col-span-4" title="Allocation">
          <Skeleton className="mx-auto mt-2 h-40 w-40 rounded-full" />
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Panel>
        {[...Array(4)].map((_, i) => (
          <Panel key={i} className="lg:col-span-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 space-y-2">
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

function MarketCountdown() {
  const [label, setLabel] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcM = now.getUTCMinutes();
      const utcDay = now.getUTCDay();
      const mins = utcH * 60 + utcM;
      const isWeekday = utcDay >= 1 && utcDay <= 5;
      const open = isWeekday && mins >= 870 && mins < 1260;
      setIsOpen(open);
      if (open) {
        const minsLeft = 1260 - mins;
        setLabel(`US Market closes in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`);
      } else if (isWeekday && mins < 870) {
        const minsLeft = 870 - mins;
        setLabel(`US Market opens in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`);
      } else {
        setLabel("US Market closed (weekend)");
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        isOpen
          ? "border-bull/25 bg-bull/8 text-bull"
          : "border-border bg-secondary/20 text-muted-foreground",
      )}
    >
      <span
        className={cn("h-2 w-2 rounded-full", isOpen ? "bg-bull live-dot" : "bg-muted-foreground")}
      />
      {label}
    </div>
  );
}

function Overview() {
  const p = usePortfolio();
  const signals = useSignals(6);
  const news = useNews(6);
  const traders = useTraders();

  const up = p.dayChange >= 0;
  if (p.loading) return <OverviewSkeleton />;

  // Portfolio gauge — needle from 0 (full loss) to 180° (max gain)
  const gaugeAngle = Math.max(0, Math.min(180, 90 + p.dayChangePct * 500));

  return (
    <AppShell
      title="Overview"
      subtitle="Everything that moves your money, in one glance"
      actions={
        <Link
          to="/trade"
          search={{ symbol: undefined }}
          className="hidden rounded-xl bg-gold px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 sm:inline-flex"
        >
          New trade
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Market status bar */}
        <div className="lg:col-span-12">
          <MarketCountdown />
        </div>

        {/* Net worth */}
        <Panel
          className="lg:col-span-8"
          title="Net worth"
          subtitle="Cash + market value, last 90 days"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Net worth" value={usd(p.netWorth)} tone="gold" />
            <Stat
              label="Today"
              value={`${up ? "+" : ""}${usd(p.dayChange)}`}
              hint={pct(p.dayChangePct)}
              tone={up ? "up" : "down"}
            />
            <Stat
              label="Unrealised P&L"
              value={`${p.unrealized >= 0 ? "+" : ""}${usd(p.unrealized)}`}
              hint={pct(p.unrealizedPct)}
              tone={p.unrealized >= 0 ? "up" : "down"}
            />
            <Stat label="Cash" value={usd(p.cash)} hint="Available to deploy" />
          </div>

          {/* Portfolio gauge */}
          <div className="mt-4 flex items-center gap-4">
            <div className="relative flex h-12 w-24 shrink-0 items-end justify-center overflow-hidden">
              <svg width={96} height={52} viewBox="0 0 96 52">
                {/* Background arc */}
                <path
                  d="M 8 48 A 40 40 0 0 1 88 48"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                {/* Filled arc */}
                <path
                  d="M 8 48 A 40 40 0 0 1 88 48"
                  fill="none"
                  stroke={up ? "var(--bull)" : "var(--bear)"}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={`${(gaugeAngle / 180) * 125.6} 125.6`}
                  style={{ filter: `drop-shadow(0 0 4px ${up ? "var(--bull)" : "var(--bear)"})` }}
                />
                {/* Needle */}
                <line
                  x1={48}
                  y1={48}
                  x2={48 + 32 * Math.cos(((gaugeAngle - 180) * Math.PI) / 180)}
                  y2={48 + 32 * Math.sin(((gaugeAngle - 180) * Math.PI) / 180)}
                  stroke="var(--gold)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle cx={48} cy={48} r={4} fill="var(--gold)" />
              </svg>
            </div>
            <div>
              <p className={cn("num text-2xl font-bold", up ? "text-bull" : "text-bear")}>
                {up ? "+" : ""}
                {pct(p.dayChangePct)}
              </p>
              <p className="text-xs text-muted-foreground">Today's performance gauge</p>
            </div>
          </div>

          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={p.curve} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a84c" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#c9a84c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => v.slice(5)}
                  minTickGap={40}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["dataMin - 200", "dataMax + 200"]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => compactUsd(v)}
                  width={54}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0e0e0e",
                    border: "1px solid rgba(201,168,76,0.3)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#c9a84c" }}
                  formatter={(v: number) => [usd(v), "Equity"]}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  fill="url(#equityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Allocation */}
        <Panel
          className="lg:col-span-4"
          title="Allocation"
          subtitle="Live weight vs strategy target"
        >
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={p.allocation}
                  dataKey="value"
                  nameKey="market"
                  innerRadius={44}
                  outerRadius={66}
                  paddingAngle={3}
                  stroke="none"
                >
                  {p.allocation.map((a, i) => (
                    <Cell key={a.market} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0e0e0e",
                    border: "1px solid rgba(201,168,76,0.3)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, n: string) => [usd(v), n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-2">
            {p.allocation.map((a, i) => {
              const drift = a.target ? a.weight - a.target : 0;
              return (
                <li key={a.market} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate capitalize">{a.market}</span>
                  <span className="num text-muted-foreground">{pct(a.weight, 1, false)}</span>
                  {a.target > 0 && (
                    <Pill tone={Math.abs(drift) > 0.05 ? "down" : "neutral"}>
                      {drift >= 0 ? "+" : ""}
                      {(drift * 100).toFixed(1)} vs tgt
                    </Pill>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* This month */}
        <Panel className="lg:col-span-4" title="This month" subtitle="Personal cash flow">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Income" value={usd(p.income)} tone="up" />
            <Stat label="Spending" value={usd(p.expenses)} tone="down" />
            <Stat label="Invested" value={usd(p.invested)} tone="gold" />
            <Stat label="Savings rate" value={pct(p.savingsRate, 0, false)} />
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${Math.max(0, Math.min(1, p.savingsRate)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Max drawdown from peak {pct(p.drawdown)} · 7-day {pct(p.weekChangePct)}
          </p>
          <Link
            to="/finances"
            className="mt-3 inline-block text-xs font-medium text-gold-soft underline-offset-4 hover:underline"
          >
            Record earnings and expenses →
          </Link>
        </Panel>

        {/* Top movers */}
        <Panel className="lg:col-span-4" title="Top movers" subtitle="By unrealised return">
          <ul className="space-y-2.5">
            {p.movers.slice(0, 5).map((h) => (
              <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="num truncate text-sm font-semibold">{h.symbol}</p>
                  <p className="truncate text-[11px] capitalize text-muted-foreground">
                    {h.name ?? h.market}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm">{usd(h.last_price)}</p>
                  <p className={`num text-[11px] ${h.pnlPct >= 0 ? "text-bull" : "text-bear"}`}>
                    {pct(h.pnlPct)}
                  </p>
                </div>
              </li>
            ))}
            {!p.movers.length && (
              <li className="text-xs text-muted-foreground">No holdings yet.</li>
            )}
          </ul>
        </Panel>

        {/* Live signals */}
        <Panel
          className="lg:col-span-4"
          title="Live signals"
          subtitle="Highest conviction right now"
          action={
            <Link to="/signals" className="text-[11px] text-gold-soft hover:underline">
              All
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {(signals.data ?? []).map((s) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="num truncate text-sm font-semibold">{s.symbol}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {s.ai_reason ?? s.source}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill
                    tone={
                      s.direction === "long" ? "up" : s.direction === "short" ? "down" : "neutral"
                    }
                  >
                    {s.direction}
                  </Pill>
                  <span className="num text-xs text-gold-soft">
                    {Math.round(s.confidence * 100)}%
                  </span>
                </div>
              </li>
            ))}
            {!signals.data?.length && (
              <li className="text-xs text-muted-foreground">No signals yet.</li>
            )}
          </ul>
        </Panel>

        {/* Market news */}
        <Panel
          className="lg:col-span-8"
          title="Market news"
          subtitle="Sentiment-scored headlines"
          action={
            <Link to="/news" className="text-[11px] text-gold-soft hover:underline">
              All
            </Link>
          }
        >
          <ul className="divide-y divide-border/50">
            {(news.data ?? []).map((n) => (
              <li
                key={n.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
              >
                <div className="min-w-0">
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm hover:text-gold-soft transition-colors"
                    >
                      {n.title}
                    </a>
                  ) : (
                    <p className="truncate text-sm">{n.title}</p>
                  )}
                  <p className="truncate text-[11px] text-muted-foreground">
                    {n.source} · {timeAgo(n.published_at)} {n.symbols ? `· ${n.symbols}` : ""}
                  </p>
                </div>
                <Pill tone={n.sentiment > 0.1 ? "up" : n.sentiment < -0.1 ? "down" : "neutral"}>
                  {n.sentiment > 0 ? "+" : ""}
                  {n.sentiment.toFixed(2)}
                </Pill>
              </li>
            ))}
            {!news.data?.length && (
              <li className="py-2 text-xs text-muted-foreground">No news yet.</li>
            )}
          </ul>
        </Panel>

        {/* Traders */}
        <Panel
          className="lg:col-span-4"
          title="Traders you follow"
          subtitle="Stance of reputable operators"
          action={
            <Link to="/strategies" className="text-[11px] text-gold-soft hover:underline">
              Manage
            </Link>
          }
        >
          <ul className="space-y-3">
            {(traders.data ?? []).slice(0, 5).map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t.current_stance ?? t.specialty ?? t.market}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-xs text-bull">{pct(t.ytd_return, 1, false)} YTD</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {Math.round(t.win_rate * 100)}% win
                  </p>
                </div>
              </li>
            ))}
            {!traders.data?.length && (
              <li className="text-xs text-muted-foreground">Follow traders from Strategies.</li>
            )}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
