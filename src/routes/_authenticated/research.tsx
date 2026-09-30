import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Cpu,
  Search,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import {
  askGeminiResearch,
  cancelResearch,
  getResearchCapabilities,
  getResearchRun,
  listResearchRuns,
  startResearch,
} from "@/lib/research.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/research")({
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search["prompt"] === "string" ? String(search["prompt"]) : undefined,
  }),
  head: () => ({ meta: [{ title: "Research — Terminal" }] }),
  component: Research,
});

const STARTERS = [
  "Compare BTC momentum, mean reversion and buy-and-hold. Tell me what should be backtested next.",
  "Research NVDA: trend, business context, catalysts, downside risks and a falsifiable thesis.",
  "Which positions in my paper portfolio contribute the most concentration risk?",
  "Build a research plan for a diversified 5-asset portfolio and define failure conditions.",
];

type Provider = "fast" | "vibe";

function statusLabel(status: string) {
  if (["idle", "completed", "done"].includes(status)) return "Complete";
  if (["failed", "error"].includes(status)) return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Running";
}

function Research() {
  const searchParams = Route.useSearch();
  const start = useServerFn(startResearch);
  const list = useServerFn(listResearchRuns);
  const read = useServerFn(getResearchRun);
  const cancel = useServerFn(cancelResearch);
  const askGemini = useServerFn(askGeminiResearch);
  const capabilitiesFn = useServerFn(getResearchCapabilities);
  const qc = useQueryClient();

  const [input, setInput] = useState(searchParams.prompt ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("fast");
  const [quick, setQuick] = useState<Array<{ role: "user" | "assistant"; content: string; meta?: string }>>([]);

  useEffect(() => {
    if (searchParams.prompt) setInput(searchParams.prompt);
  }, [searchParams.prompt]);

  const capabilities = useQuery({
    queryKey: ["research-capabilities"],
    queryFn: () => capabilitiesFn({ data: undefined }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (capabilities.data && !capabilities.data.fast && capabilities.data.vibe) setProvider("vibe");
  }, [capabilities.data]);

  const runs = useQuery({
    queryKey: ["research-runs"],
    queryFn: () => list({ data: undefined }),
    refetchInterval: 8_000,
    retry: false,
  });

  const run = useQuery({
    queryKey: ["research-run", selected],
    queryFn: () => read({ data: { runId: selected! } }),
    enabled: Boolean(selected),
    retry: false,
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.status ?? "running";
      return ["idle", "completed", "done", "failed", "error", "cancelled"].includes(s) ? false : 2_500;
    },
  });

  const vibeLaunch = useMutation({
    mutationFn: (prompt: string) => start({ data: { prompt } }),
    onSuccess: async (row) => {
      setSelected(row.id);
      setQuick([]);
      setInput("");
      await qc.invalidateQueries({ queryKey: ["research-runs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Vibe research could not start"),
  });

  const geminiLaunch = useMutation({
    mutationFn: async (prompt: string) => {
      setQuick((prev) => [...prev, { role: "user", content: prompt }]);
      return askGemini({ data: { prompt } });
    },
    onSuccess: (result) => {
      const providerLabel =
        result.provider === "openrouter"
          ? `OpenRouter · ${result.model}${result.fallbackUsed ? " · Gemini fallback" : ""}`
          : `Gemini · ${result.model}`;
      setQuick((prev) => [...prev, { role: "assistant", content: result.reply, meta: providerLabel }]);
      setInput("");
      setSelected(null);
      if (result.provider === "openrouter" && result.fallbackUsed) {
        toast.info("Gemini was unavailable, so Terminal used OpenRouter automatically.");
      }
    },
    onError: (err) => {
      setQuick((prev) => prev.slice(0, -1));
      toast.error(err instanceof Error ? err.message : "Gemini research failed");
    },
  });

  const stop = useMutation({
    mutationFn: (runId: string) => cancel({ data: { runId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-run", selected] }),
  });

  const messages = run.data?.messages ?? [];
  const visibleMessages = useMemo(
    () => messages.filter((m: any) => m.role === "user" || m.role === "assistant"),
    [messages],
  );
  const active =
    run.data &&
    !["idle", "completed", "done", "failed", "error", "cancelled"].includes(run.data.status);

  const fastReady = Boolean(capabilities.data?.fast);
  const vibeReady = Boolean(capabilities.data?.vibe);

  function submit(prompt = input) {
    const clean = prompt.trim();
    if (!clean) return;
    if (provider === "vibe") {
      if (!vibeReady) return toast.error("The Vibe-Trading engine is not online yet.");
      vibeLaunch.mutate(clean);
    } else {
      if (!fastReady) return toast.error("Terminal AI is not configured.");
      geminiLaunch.mutate(clean);
    }
  }

  return (
    <AppShell title="Research" subtitle="Gemini first · OpenRouter fallback · Vibe-Trading deep research" noPad>
      <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-card/20 p-3 lg:border-b-0 lg:border-r">
          <button
            onClick={() => {
              setSelected(null);
              setQuick([]);
              setInput("");
            }}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" /> New research
          </button>

          <div className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Engine</div>
          <div className="mb-4 grid gap-1">
            <ProviderButton
              active={provider === "fast"}
              ready={fastReady}
              onClick={() => setProvider("fast")}
              icon={WandSparkles}
              title="Terminal AI"
              detail={capabilities.data?.chain ?? "Gemini → OpenRouter"}
            />
            <ProviderButton
              active={provider === "vibe"}
              ready={vibeReady}
              onClick={() => setProvider("vibe")}
              icon={Cpu}
              title="Vibe-Trading"
              detail="Deep tool-using research"
            />
          </div>

          <div className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deep research history</div>
          <div className="space-y-1">
            {(runs.data ?? []).map((item: any) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelected(item.id);
                  setQuick([]);
                }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  selected === item.id ? "bg-white/[0.07] text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                <div className="line-clamp-2 text-[10px] font-medium leading-4">{item.prompt}</div>
                <div className="mt-1 flex items-center gap-1 text-[9px]"><Clock3 className="h-3 w-3" /> {statusLabel(item.status)}</div>
              </button>
            ))}
            {runs.isError && (
              <div className="rounded-xl border border-border p-3 text-[9px] leading-4 text-muted-foreground">
                Deep-run history needs the Terminal research migration. Fast AI still works independently.
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[72vh] flex-col">
          {!selected && quick.length === 0 ? (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
              <div className="max-w-2xl">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
                <h2 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Ask a market question. Keep the evidence separate from the story.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Terminal tries Gemini first and automatically falls back to OpenRouter if Gemini fails. Vibe-Trading handles deeper tool-using research when its engine service is online.
                </p>
              </div>

              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((prompt) => (
                  <button key={prompt} onClick={() => submit(prompt)} className="rounded-2xl border border-border bg-card/40 p-4 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground">
                    {prompt}
                  </button>
                ))}
              </div>
              <PromptBox value={input} onChange={setInput} onSubmit={() => submit()} pending={geminiLaunch.isPending || vibeLaunch.isPending} provider={provider} />
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-5 sm:px-8">
              {selected ? (
                <>
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">Vibe-Trading deep run</div>
                      <div className="mt-1 text-sm">{run.data?.prompt ?? "Loading…"}</div>
                    </div>
                    {active && (
                      <button onClick={() => selected && stop.mutate(selected)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground">
                        <Square className="h-3 w-3 fill-current" /> Stop
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-5 pb-6">
                    {run.isLoading && <div className="py-16 text-center text-xs text-muted-foreground">Connecting to the quant engine…</div>}
                    {visibleMessages.map((m: any) => (
                      <ResearchMessage key={m.message_id} role={m.role} content={m.content} tools={m.tool_trail} />
                    ))}
                    {active && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Collecting data, running tools and checking evidence…</div>}
                    {run.data && !active && <div className="flex items-center gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> {statusLabel(run.data.status)}</div>}
                  </div>
                </>
              ) : (
                <div className="flex-1 space-y-5 pb-6">
                  <div className="border-b border-border pb-4">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">Fast research · {capabilities.data?.chain ?? "Gemini → OpenRouter"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Grounded in the portfolio context available to Terminal; provider fallback happens server-side.</div>
                  </div>
                  {quick.map((m, i) => <ResearchMessage key={i} role={m.role} content={m.content} meta={m.meta} />)}
                  {geminiLaunch.isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Analyzing…</div>}
                </div>
              )}
              <PromptBox value={input} onChange={setInput} onSubmit={() => submit()} pending={geminiLaunch.isPending || vibeLaunch.isPending} provider={provider} />
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function ResearchMessage({ role, content, tools, meta }: { role: string; content: string; tools?: Array<Record<string, unknown>>; meta?: string }) {
  const user = role === "user";
  return (
    <div className={cn("flex", user ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[94%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6", user ? "bg-primary text-primary-foreground" : "border border-border bg-card/55 text-foreground")}>
        {!user && meta ? <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary">{meta}</div> : null}
        {content}
        {!user && tools?.length ? (
          <div className="mt-3 border-t border-border/70 pt-2">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tool trail</div>
            <div className="space-y-1">
              {tools.slice(0, 8).map((tool, i) => <div key={i} className="font-mono text-[9px] leading-4 text-muted-foreground">{String(tool["name"] ?? tool["tool"] ?? "tool")}</div>)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProviderButton({
  active,
  ready,
  onClick,
  icon: Icon,
  title,
  detail,
}: {
  active: boolean;
  ready: boolean;
  onClick: () => void;
  icon: typeof Cpu;
  title: string;
  detail: string;
}) {
  return (
    <button onClick={onClick} disabled={!ready} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40", active ? "border-primary/30 bg-primary/[0.07]" : "border-border hover:bg-white/[0.03]")}>
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold">{title}</span><span className="block text-[9px] text-muted-foreground">{detail}</span></span>
      <span className={cn("h-1.5 w-1.5 rounded-full", ready ? "bg-primary" : "bg-muted-foreground")} />
    </button>
  );
}

function PromptBox({
  value,
  onChange,
  onSubmit,
  pending,
  provider,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  provider: Provider;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="sticky bottom-20 mt-5 flex items-end gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-[0_20px_70px_-35px_rgba(0,0,0,.95)] backdrop-blur-xl lg:bottom-4">
      <Search className="mb-2 ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={provider === "vibe" ? "Give Vibe-Trading a research mission…" : "Ask Terminal AI about a market, portfolio or thesis…"} className="min-h-12 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground" />
      <button type="submit" disabled={pending || !value.trim()} className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-35"><ArrowUp className="h-4 w-4" /></button>
    </form>
  );
}
