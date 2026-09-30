import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Beaker,
  BrainCircuit,
  CandlestickChart,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useNews, useSignals, useTransactions } from "@/lib/db";
import { pct, timeAgo, usd } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Home — Terminal" }] }),
  component: Home,
});

function Home() {
  const p = usePortfolio();
  const signals = useSignals(5);
  const news = useNews(6);
  const tx = useTransactions(6);

  const positions = [...p.holdings]
    .map((h) => ({
      ...h,
      value: h.quantity * h.last_price,
      pnlPct: h.avg_cost ? (h.last_price - h.avg_cost) / h.avg_cost : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const predictionPositions = positions.filter((h) => h.market === "kalshi");
  const investPositions = positions.filter((h) => h.market !== "kalshi");

  return (
    <AppShell title="Home" subtitle="Paper portfolio · research · markets">
      <div className="mx-auto max-w-[1160px]">
        <section className="border-b border-border pb-5 sm:pb-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Portfolio</div>
              <div className="mt-1 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{usd(p.netWorth)}</div>
              <div className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", p.dayChange >= 0 ? "text-bull" : "text-bear")}>
                <ArrowUpRight className={cn("h-4 w-4", p.dayChange < 0 && "rotate-90")} />
                <span>{p.dayChange >= 0 ? "+" : ""}{usd(p.dayChange)} ({pct(p.dayChangePct)}) today</span>
              </div>
              <div className="mt-5 flex items-center gap-5 text-[10px] font-medium text-muted-foreground">
                <span className="text-foreground">1D</span><span>1W</span><span>1M</span><span>3M</span><span>ALL</span>
              </div>
            </div>

            <div className="h-32 sm:h-36">
              {p.curve.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={p.curve}>
                    <defs>
                      <linearGradient id="terminalHomeEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 10 }}
                      formatter={(v) => [usd(Number(v)), "Equity"]}
                    />
                    <Area type="monotone" dataKey="equity" stroke="var(--primary)" strokeWidth={2.25} fill="url(#terminalHomeEquity)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[10px] leading-5 text-muted-foreground">
                  Your performance chart appears after portfolio snapshots are recorded.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 sm:flex">
            <Action to="/trade" icon={CandlestickChart} label="Trade" primary />
            <Action to="/research" icon={BrainCircuit} label="Research" />
            <Action to="/labs" icon={Beaker} label="Backtest" />
            <Action to="/portfolio" icon={Wallet} label="Portfolio" />
          </div>
        </section>

        <section className="border-b border-border py-4">
          <Link to="/portfolio" className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-medium">Buying power</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">Available across your paper accounts</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="num text-sm font-semibold">{usd(p.cash)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </section>

        <section className="border-b border-border py-5">
          <SectionHeader title="Investing" action={<Link to="/markets" className="text-[10px] text-muted-foreground">Explore</Link>} />
          <div className="mt-2 divide-y divide-border">
            {investPositions.length === 0 ? (
              <Empty title="No positions yet" body="Your first paper trade will appear here." action="/trade" />
            ) : investPositions.slice(0, 8).map((h) => (
              <Link key={h.id} to="/trade" search={{ symbol: h.symbol }} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{h.symbol}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    <span>{h.name || h.market}</span>
                    <span> · </span>
                    <span>{h.quantity} units</span>
                  </div>
                </div>
                <div className="num text-sm">{usd(h.value)}</div>
                <div className={cn("num min-w-16 text-right text-xs font-medium", h.pnlPct >= 0 ? "text-bull" : "text-bear")}>{pct(h.pnlPct)}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-b border-border py-5">
          <SectionHeader title="Terminal AI" action={<BrainCircuit className="h-4 w-4 text-primary" />} />
          <Link to="/research" className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3 transition-colors hover:border-primary/25">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">Ask about a market, position or strategy</div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">Test BTC momentum with fees and walk-forward validation.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>

        {predictionPositions.length > 0 && (
          <section className="border-b border-border py-5">
            <SectionHeader title="Prediction positions" action={<CircleDollarSign className="h-4 w-4 text-primary" />} />
            <div className="mt-2 divide-y divide-border">
              {predictionPositions.map((h) => (
                <div key={h.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium leading-5">{h.name || h.symbol}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{h.quantity} contracts</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm">{Math.round(h.last_price * 100)}¢</div>
                      <div className={cn("num mt-1 text-[10px]", h.pnlPct >= 0 ? "text-bull" : "text-bear")}>{pct(h.pnlPct)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid md:grid-cols-2">
          <section className="border-b border-border py-5 md:border-r md:pr-6">
            <SectionHeader title="Market news" action={<Link to="/news" className="text-[10px] text-muted-foreground">All</Link>} />
            <div className="mt-2 divide-y divide-border">
              {(news.data ?? []).length === 0 ? <Empty title="No news yet" body="Connect or fetch a market news source." /> : (news.data ?? []).slice(0, 4).map((n) => (
                <a key={n.id} href={n.url || undefined} target={n.url ? "_blank" : undefined} rel="noreferrer" className="block py-3.5">
                  <div className="line-clamp-2 text-xs font-medium leading-5">{n.title}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{n.source} · {timeAgo(n.published_at)}</div>
                </a>
              ))}
            </div>
          </section>

          <section className="border-b border-border py-5 md:pl-6">
            <SectionHeader title="Activity" action={<Link to="/journal" className="text-[10px] text-muted-foreground">All</Link>} />
            <div className="mt-2 divide-y divide-border">
              {(tx.data ?? []).length === 0 ? <Empty title="No activity yet" body="Paper fills will appear here." /> : (tx.data ?? []).slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3.5">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold", t.side === "buy" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear")}>{t.side === "buy" ? "B" : "S"}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{t.symbol}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{timeAgo(t.executed_at)}</div></div>
                  <div className="num text-right text-xs">{usd(t.quantity * t.price)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {(signals.data ?? []).length > 0 && (
          <section className="py-5">
            <SectionHeader title="Research signals" action={<Link to="/research" className="text-[10px] text-muted-foreground">Research</Link>} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(signals.data ?? []).slice(0, 3).map((s) => (
                <div key={s.id} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{s.symbol}</span>
                    <span className={cn("text-[9px] font-semibold uppercase", s.direction === "long" || s.direction === "buy" ? "text-bull" : s.direction === "short" || s.direction === "sell" ? "text-bear" : "text-muted-foreground")}>{s.direction}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                    {s.ai_reason || <span>{Math.round(Number(s.confidence) * 100)}% confidence</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between"><h2 className="text-sm font-semibold tracking-[-0.02em]">{title}</h2>{action}</div>;
}

function Action({ to, icon: Icon, label, primary = false }: { to: "/trade" | "/research" | "/labs" | "/portfolio"; icon: typeof BrainCircuit; label: string; primary?: boolean }) {
  return (
    <Link to={to} className={cn("flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-medium sm:min-w-20", primary ? "bg-primary text-primary-foreground" : "bg-white/[0.045] text-foreground")}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: "/trade" }) {
  const content = <div className="py-6 text-center"><div className="text-xs font-medium">{title}</div><div className="mt-1 text-[10px] text-muted-foreground">{body}</div></div>;
  return action ? <Link to={action} className="block">{content}</Link> : content;
}
