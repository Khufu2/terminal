import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { startResearch } from "@/lib/research.functions";

export const Route = createFileRoute("/_authenticated/labs")({
  head: () => ({ meta: [{ title: "Labs — Terminal" }] }),
  component: Labs,
});

function Labs() {
  const start = useServerFn(startResearch);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState("SPY");
  const [idea, setIdea] = useState("20/50 moving-average crossover");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [fees, setFees] = useState("0.10");

  const run = useMutation({
    mutationFn: () => start({ data: { prompt: `Backtest ${idea} on ${symbol} from ${startDate} to the latest available date. Include ${fees}% trading costs per transaction, slippage, benchmark comparison, max drawdown, Sharpe/Sortino, turnover, trade count, and walk-forward or out-of-sample validation. Flag look-ahead bias and weak statistical evidence. Do not place live orders.` } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["research-runs"] }); navigate({ to: "/research" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Backtest could not start"),
  });

  return <AppShell title="Labs" subtitle="Turn a trading idea into a reproducible research run">
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FlaskConical className="h-5 w-5" /></div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">Backtest a hypothesis</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Describe the strategy. Terminal asks the engine to collect data, run the test and audit the result instead of returning a made-up number.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <Field label="Market / symbol" value={symbol} onChange={setSymbol} />
            <Field label="Start date" value={startDate} onChange={setStartDate} type="date" />
            <div className="sm:col-span-2"><Field label="Strategy idea" value={idea} onChange={setIdea} /></div>
            <Field label="Trading cost (%)" value={fees} onChange={setFees} type="number" />
          </div>
          <button disabled={run.isPending} onClick={() => run.mutate()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Play className="h-4 w-4 fill-current" /> {run.isPending ? "Starting…" : "Run backtest"}</button>
        </section>
        <section className="rounded-3xl border border-border bg-surface/50 p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Validation checklist</div>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            {["Fees and slippage included", "Benchmark comparison", "Drawdown and risk-adjusted return", "Walk-forward / out-of-sample test", "Look-ahead-bias check", "Evidence and run artifacts retained"].map((x) => <div key={x} className="flex items-center gap-3 border-b border-border pb-4 last:border-0"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{x}</div>)}
          </div>
          <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">Labs is research-first. A successful backtest never becomes a live order automatically.</p>
        </section>
      </div>
    </div>
  </AppShell>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/40" /></label>;
}
