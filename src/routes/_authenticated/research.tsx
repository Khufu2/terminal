import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, BrainCircuit, CheckCircle2, Clock3, Search, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { cancelResearch, getResearchRun, listResearchRuns, startResearch } from "@/lib/research.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "Research — Terminal" }] }),
  component: Research,
});

const STARTERS = [
  "Find robust gold strategies from 2020 to now with max drawdown below 15%.",
  "Compare BTC momentum, mean reversion and buy-and-hold with fees and walk-forward validation.",
  "Research NVDA: trend, valuation, catalysts, downside risks and a testable trading thesis.",
  "Build a diversified 5-asset portfolio and stress-test it across high-correlation regimes.",
];

function statusLabel(status: string) {
  if (["idle", "completed", "done"].includes(status)) return "Complete";
  if (["failed", "error"].includes(status)) return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Running";
}

function Research() {
  const start = useServerFn(startResearch);
  const list = useServerFn(listResearchRuns);
  const read = useServerFn(getResearchRun);
  const cancel = useServerFn(cancelResearch);
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["research-runs"],
    queryFn: () => list({ data: undefined }),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!selected && runs.data?.[0]?.id) setSelected(runs.data[0].id);
  }, [runs.data, selected]);

  const run = useQuery({
    queryKey: ["research-run", selected],
    queryFn: () => read({ data: { runId: selected! } }),
    enabled: Boolean(selected),
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.status ?? "running";
      return ["idle", "completed", "done", "failed", "error", "cancelled"].includes(s) ? false : 2_500;
    },
  });

  const launch = useMutation({
    mutationFn: (prompt: string) => start({ data: { prompt } }),
    onSuccess: async (row) => {
      setSelected(row.id);
      setInput("");
      await qc.invalidateQueries({ queryKey: ["research-runs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Research could not start"),
  });

  const stop = useMutation({
    mutationFn: (runId: string) => cancel({ data: { runId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-run", selected] }),
  });

  const messages = run.data?.messages ?? [];
  const visibleMessages = useMemo(() => messages.filter((m: any) => m.role === "user" || m.role === "assistant"), [messages]);
  const active = run.data && !["idle", "completed", "done", "failed", "error", "cancelled"].includes(run.data.status);

  function submit(prompt = input) {
    const clean = prompt.trim();
    if (!clean || launch.isPending) return;
    launch.mutate(clean);
  }

  return (
    <AppShell title="Research" subtitle="Ask a question. Terminal does the quant work underneath." noPad>
      <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-surface/40 p-3 lg:border-b-0 lg:border-r">
          <button
            onClick={() => { setSelected(null); setInput(""); }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> New research
          </button>
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent</div>
          <div className="space-y-1">
            {(runs.data ?? []).map((item: any) => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={cn("w-full rounded-xl px-3 py-2.5 text-left transition-colors", selected === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}
              >
                <div className="line-clamp-2 text-xs font-medium leading-5">{item.prompt}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <Clock3 className="h-3 w-3" /> {statusLabel(item.status)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col">
          {!selected ? (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
              <div className="mb-8 max-w-2xl">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Research markets, not vibes.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Terminal can gather market data, test strategies, compare factors and return evidence-backed results through the isolated Vibe-Trading engine.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTERS.map((prompt) => <button key={prompt} onClick={() => submit(prompt)} className="rounded-2xl border border-border bg-card p-4 text-left text-sm leading-6 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground">{prompt}</button>)}
              </div>
              <PromptBox value={input} onChange={setInput} onSubmit={() => submit()} pending={launch.isPending} />
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5 sm:px-8">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quant research run</div><div className="mt-1 text-sm text-foreground">{run.data?.prompt ?? "Loading…"}</div></div>
                {active && <button onClick={() => selected && stop.mutate(selected)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"><Square className="h-3 w-3 fill-current" /> Stop</button>}
              </div>
              <div className="flex-1 space-y-5 pb-8">
                {run.isLoading && <div className="py-16 text-center text-sm text-muted-foreground">Connecting to the quant engine…</div>}
                {visibleMessages.map((m: any) => (
                  <div key={m.message_id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6", m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground")}>{m.content}</div>
                  </div>
                ))}
                {active && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Researching, testing and checking evidence…</div>}
                {run.data && !active && <div className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> {statusLabel(run.data.status)}</div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PromptBox({ value, onChange, onSubmit, pending }: { value: string; onChange: (v: string) => void; onSubmit: () => void; pending: boolean }) {
  return <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="mt-6 flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_16px_60px_-32px_rgba(0,0,0,.8)] focus-within:border-primary/35">
    <Search className="mb-2 ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="Ask Terminal to research a market, strategy or portfolio…" className="min-h-12 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
    <button type="submit" disabled={pending || !value.trim()} className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-35"><ArrowUp className="h-4 w-4" /></button>
  </form>;
}
