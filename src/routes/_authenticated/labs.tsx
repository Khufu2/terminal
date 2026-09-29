import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { runLabBacktest } from "@/lib/labs.functions";
import { getResearchCapabilities, startResearch } from "@/lib/research.functions";
import { pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/labs")({
  head: () => ({ meta: [{ title: "Labs — Terminal" }] }),
  component: Labs,
});

type Strategy = "sma_cross" | "momentum" | "mean_reversion";

function Labs() {
  const backtest = useServerFn(runLabBacktest);
  const startDeep = useServerFn(startResearch);
  const capsFn = useServerFn(getResearchCapabilities);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [symbol, setSymbol] = useState("SPY");
  const [market, setMarket] = useState<"stocks" | "crypto">("stocks");
  const [strategy, setStrategy] = useState<Strategy>("sma_cross");
  const [fast, setFast] = useState("20");
  const [slow, setSlow] = useState("50");
  const [lookback, setLookback] = useState("20");
  const [threshold, setThreshold] = useState("2");
  const [fees, setFees] = useState("0.10");

  const capabilities = useQuery({
    queryKey: ["research-capabilities"],
    queryFn: () => capsFn({ data: undefined }),
    staleTime: 60_000,
  });

  const run = useMutation({
    mutationFn: () =>
      backtest({
        data: {
          symbol,
          market,
          strategy,
          fast: Number(fast),
          slow: Number(slow),
          lookback: Number(lookback),
          threshold: Number(threshold),
          feesPct: Number(fees),
        },
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Backtest failed"),
  });

  const deep = useMutation({
    mutationFn: () =>
      startDeep({
        data: {
          prompt: `Deep backtest ${strategy} on ${symbol} (${market}). Use point-in-time data where available. Parameters: fast=${fast}, slow=${slow}, momentum lookback=${lookback}, mean-reversion threshold=${threshold}%, trading cost=${fees}% per position change. Include benchmark, max drawdown, Sharpe/Sortino, turnover, trade count, walk-forward or out-of-sample validation, look-ahead-bias checks, and retain the evidence/artifacts. Do not place any live order.`,
        },
      }),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ["research-runs"] });
      navigate({ to: "/research" });
      toast.success(`Deep Vibe run started: ${row.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Deep run could not start"),
  });

  const result = run.data;
  const m = result?.metrics;

  return (
    <AppShell title="Labs" subtitle="Deterministic Alpaca backtests + Gemini review + optional Vibe-Trading deep runs">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border bg-card/45 p-4">
            <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Backtest setup</h2></div>
            <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Quick tests are calculated in code from Alpaca daily bars. Gemini may review the computed metrics but does not invent them.</p>

            <div className="mt-5 space-y-4">
              <Field label="Symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} />
              <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Market</span><select value={market} onChange={(e) => setMarket(e.target.value as "stocks" | "crypto")} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none"><option value="stocks">Stocks</option><option value="crypto">Crypto</option></select></label>
              <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">Strategy</span><select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none"><option value="sma_cross">SMA crossover</option><option value="momentum">Momentum</option><option value="mean_reversion">Mean reversion</option></select></label>

              {strategy === "sma_cross" && <div className="grid grid-cols-2 gap-2"><Field label="Fast SMA" value={fast} onChange={setFast} type="number" /><Field label="Slow SMA" value={slow} onChange={setSlow} type="number" /></div>}
              {strategy === "momentum" && <Field label="Lookback days" value={lookback} onChange={setLookback} type="number" />}
              {strategy === "mean_reversion" && <div className="grid grid-cols-2 gap-2"><Field label="SMA period" value={fast} onChange={setFast} type="number" /><Field label="Entry below SMA (%)" value={threshold} onChange={setThreshold} type="number" /></div>}
              <Field label="Trading cost per position change (%)" value={fees} onChange={setFees} type="number" />

              <button disabled={run.isPending} onClick={() => run.mutate()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Play className="h-4 w-4 fill-current" />{run.isPending ? "Running…" : "Run verified quick test"}</button>

              <button disabled={!capabilities.data?.vibe || deep.isPending} onClick={() => deep.mutate()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-semibold disabled:opacity-40"><BrainCircuit className="h-4 w-4 text-primary" />{deep.isPending ? "Starting…" : "Deep test with Vibe-Trading"}</button>
              {!capabilities.data?.vibe && <div className="text-center text-[9px] leading-4 text-muted-foreground">Deep mode becomes available when QUANT_ENGINE_URL + QUANT_ENGINE_API_KEY point to the deployed Vibe-Trading service.</div>}
            </div>
          </section>

          <section className="min-w-0">
            {!result ? (
              <div className="flex min-h-[34rem] items-center justify-center rounded-2xl border border-border bg-card/20 p-8 text-center">
                <div className="max-w-sm">
                  <ShieldCheck className="mx-auto h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">No made-up backtest numbers</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Run a quick test to calculate the equity curve, benchmark return, volatility, Sharpe proxy, drawdown, trades, exposure and win rate from actual Alpaca bars.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card/35 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">{result.source}</div><h2 className="mt-1 text-xl font-semibold">{result.symbol} · {labelStrategy(result.strategy)}</h2></div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Computed</div>
                  </div>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.curve}>
                        <XAxis dataKey="t" hide />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Tooltip
                          labelFormatter={(v) => new Date(Number(v)).toLocaleDateString()}
                          formatter={(value, name) => [usd(Number(value)), name === "strategy" ? "Strategy" : "Benchmark"]}
                          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 10 }}
                        />
                        <Line type="monotone" dataKey="strategy" stroke="var(--primary)" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="benchmark" stroke="var(--muted-foreground)" dot={false} strokeWidth={1.2} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {m && (
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
                    <Metric label="Total return" value={pct(m.totalReturn)} tone={m.totalReturn >= 0 ? "up" : "down"} />
                    <Metric label="Buy & hold" value={pct(m.benchmarkReturn)} tone={m.benchmarkReturn >= 0 ? "up" : "down"} />
                    <Metric label="Max drawdown" value={pct(m.maxDrawdown)} tone="down" />
                    <Metric label="Sharpe proxy" value={m.sharpe.toFixed(2)} />
                    <Metric label="Annualized return" value={pct(m.annualizedReturn)} tone={m.annualizedReturn >= 0 ? "up" : "down"} />
                    <Metric label="Annualized vol" value={pct(m.annualizedVolatility)} />
                    <Metric label="Exposure" value={pct(m.exposure)} />
                    <Metric label="Position changes" value={String(m.trades)} />
                  </div>
                )}

                {result.analysis && (
                  <div className="rounded-2xl border border-border bg-card/35 p-4">
                    <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Gemini review</h3></div>
                    <div className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{result.analysis}</div>
                  </div>
                )}

                <div className="rounded-2xl border border-border p-4">
                  <div className="text-xs font-semibold">Validation boundary</div>
                  <p className="mt-2 text-[10px] leading-5 text-muted-foreground">The quick test is a simple historical simulation, not proof of edge. It uses daily bars, a long/flat rule and explicit transaction costs. Use the Vibe deep run for walk-forward tests, richer strategy logic, artifacts and stronger bias checks.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary/40" /></label>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return <div className="bg-card px-4 py-4"><div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div><div className={cn("num mt-1 text-sm font-semibold", tone === "up" && "text-bull", tone === "down" && "text-bear")}>{value}</div></div>;
}

function labelStrategy(strategy: string) {
  return strategy === "sma_cross" ? "SMA crossover" : strategy === "momentum" ? "Momentum" : "Mean reversion";
}
