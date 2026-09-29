import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowRight, Beaker, BrainCircuit, CandlestickChart, ChevronRight, Wallet } from "lucide-react";

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
  const news = useNews(5);
  const tx = useTransactions(5);

  const topHoldings = [...p.holdings]
    .map((h) => ({ ...h, value: h.quantity * h.last_price, pnl: (h.last_price - h.avg_cost) * h.quantity }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <AppShell title="Home" subtitle="Portfolio, research and paper trading">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_22rem]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Portfolio value</div>
              <div className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{usd(p.netWorth)}</div>
              <div className={cn("mt-2 text-sm font-medium", p.dayChange >= 0 ? "text-bull" : "text-bear")}>
                {p.dayChange >= 0 ? "+" : ""}{usd(p.dayChange)} · {pct(p.dayChangePct)} last snapshot
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <QuickAction to="/research" icon={BrainCircuit} label="Research" />
                <QuickAction to="/labs" icon={Beaker} label="Backtest" />
                <QuickAction to="/trade" icon={CandlestickChart} label="Paper trade" />
                <QuickAction to="/portfolio" icon={Wallet} label="Portfolio" />
              </div>
            </div>
            <div className="min-h-40 rounded-2xl bg-background/40 p-3">
              {p.curve.length > 1 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={p.curve}>
                    <defs>
                      <linearGradient id="terminalEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}
                      formatter={(v) => [usd(Number(v)), "Equity"]}
                    />
                    <Area type="monotone" dataKey="equity" stroke="var(--primary)" strokeWidth={2} fill="url(#terminalEquity)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[150px] items-center justify-center px-5 text-center text-xs leading-5 text-muted-foreground">
                  Equity history will appear after Terminal records multiple portfolio snapshots.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-3xl border border-border bg-card">
            <Header title="Positions" action={<Link to="/portfolio" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>} />
            <div className="divide-y divide-border">
              {topHoldings.length === 0 ? (
                <Empty text="No positions yet. Paper-trade an asset to build your portfolio." />
              ) : topHoldings.map((h) => {
                const pnlPct = h.avg_cost ? (h.last_price - h.avg_cost) / h.avg_cost : 0;
                return (
                  <Link key={h.id} to="/trade" search={{ symbol: h.symbol }} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{h.symbol}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{h.name || h.market}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm">{usd(h.value)}</div>
                      <div className="text-[10px] text-muted-foreground">{h.quantity} units</div>
                    </div>
                    <div className={cn("num min-w-16 text-right text-xs font-medium", pnlPct >= 0 ? "text-bull" : "text-bear")}>{pct(pnlPct)}</div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card">
            <Header title="Risk" />
            <div className="grid grid-cols-2 gap-px bg-border">
              <RiskCell label="Cash" value={usd(p.cash)} />
              <RiskCell label="Invested" value={usd(p.marketValue)} />
              <RiskCell label="Unrealised" value={usd(p.unrealized)} tone={p.unrealized >= 0 ? "up" : "down"} />
              <RiskCell label="Drawdown" value={pct(p.drawdown)} tone={p.drawdown < -0.05 ? "down" : "neutral"} />
            </div>
            <Link to="/portfolio" className="flex items-center justify-between border-t border-border px-5 py-4 text-xs text-muted-foreground hover:text-foreground">
              Full portfolio analysis <ChevronRight className="h-4 w-4" />
            </Link>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-3xl border border-border bg-card">
            <Header title="Research signals" action={<Link to="/research" className="text-xs text-muted-foreground hover:text-foreground">Ask Terminal</Link>} />
            <div className="divide-y divide-border">
              {(signals.data ?? []).length === 0 ? <Empty text="No evidence-backed signals have been recorded yet." /> : (signals.data ?? []).slice(0, 4).map((s) => (
                <div key={s.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{s.symbol}</div>
                    <div className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", s.direction === "long" ? "bg-bull/10 text-bull" : s.direction === "short" ? "bg-bear/10 text-bear" : "bg-white/5 text-muted-foreground")}>{s.direction}</div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{s.ai_reason || (Math.round(Number(s.confidence) * 100) + "% confidence")}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card">
            <Header title="Market news" action={<Link to="/news" className="text-xs text-muted-foreground hover:text-foreground">All news</Link>} />
            <div className="divide-y divide-border">
              {(news.data ?? []).length === 0 ? <Empty text="No news feed is connected yet." /> : (news.data ?? []).slice(0, 4).map((n) => (
                <a key={n.id} href={n.url || undefined} target={n.url ? "_blank" : undefined} rel="noreferrer" className="block px-5 py-3.5 hover:bg-white/[0.025]">
                  <div className="line-clamp-2 text-xs font-medium leading-5">{n.title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{n.source} · {timeAgo(n.published_at)}</div>
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card">
            <Header title="Recent activity" action={<Link to="/journal" className="text-xs text-muted-foreground hover:text-foreground">Activity</Link>} />
            <div className="divide-y divide-border">
              {(tx.data ?? []).length === 0 ? <Empty text="Paper orders and fills will appear here." /> : (tx.data ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold", t.side === "buy" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear")}>{t.side === "buy" ? "B" : "S"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{t.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{t.mode === "real" ? "Live" : "Paper"} · {timeAgo(t.executed_at)}</div>
                  </div>
                  <div className="num text-right text-xs">{usd(t.quantity * t.price)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <Link to="/research" className="group flex items-center justify-between rounded-3xl border border-primary/20 bg-primary/[0.06] p-5 sm:p-6">
          <div>
            <div className="text-sm font-semibold text-foreground">Have a market question?</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">Send it to the quant research engine and keep the resulting evidence, backtests and run history.</div>
          </div>
          <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-1"><ArrowRight className="h-4 w-4" /></span>
        </Link>
      </div>
    </AppShell>
  );
}

function Header({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-sm font-semibold tracking-[-0.02em]">{title}</h2>{action}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-xs leading-5 text-muted-foreground">{text}</div>;
}
function RiskCell({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "up" | "down" }) {
  return <div className="bg-card px-5 py-5"><div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={cn("num mt-1 text-lg font-semibold", tone === "up" && "text-bull", tone === "down" && "text-bear")}>{value}</div></div>;
}
function QuickAction({ to, icon: Icon, label }: { to: "/research" | "/labs" | "/trade" | "/portfolio"; icon: typeof BrainCircuit; label: string }) {
  return <Link to={to} className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.025] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/25 hover:bg-primary/[0.05]"><Icon className="h-3.5 w-3.5 text-primary" />{label}</Link>;
}
