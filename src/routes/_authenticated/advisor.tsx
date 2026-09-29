import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Panel";
import { askAdvisor } from "@/lib/advisor.functions";
import { useAdvisorMessages } from "@/lib/db";
import { pct, usd } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/advisor")({
  head: () => ({
    meta: [
      { title: "AI Advisor — Aurum Terminal" },
      {
        name: "description",
        content: "A always-on AI investing coach that reads your portfolio, signals and news before it answers.",
      },
      { property: "og:title", content: "AI Advisor — Aurum Terminal" },
      { property: "og:description", content: "Ask anything about your positions, risk and next best action." },
    ],
  }),
  component: Advisor,
});

const PROMPTS = [
  "Review my portfolio risk in plain English",
  "What should I do with my worst position?",
  "Which signal has the best risk-to-reward today?",
  "Am I over-exposed to crypto right now?",
  "Explain my allocation drift like I'm new to this",
];

function Advisor() {
  const messages = useAdvisorMessages();
  const ask = useServerFn(askAdvisor);
  const qc = useQueryClient();
  const p = usePortfolio();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data, pending]);

  async function send(prompt: string) {
    if (!prompt.trim() || pending) return;
    setPending(true);
    setInput("");
    try {
      await ask({ data: { prompt } });
      await qc.invalidateQueries({ queryKey: ["advisor_messages"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Advisor unavailable");
    } finally {
      setPending(false);
    }
  }

  const list = messages.data ?? [];

  return (
    <AppShell title="AI Advisor" subtitle="Always-on coach that reads your book before answering">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-8 min-h-[34rem]" title="Conversation" subtitle="Context-aware, persistent" bodyClassName="flex min-h-0 flex-col px-4 pb-4">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {list.length === 0 && (
              <p className="py-10 text-center text-xs text-muted-foreground">
                Ask your first question — the advisor already knows your positions, signals and news.
              </p>
            )}
            {list.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-gold/15 text-foreground"
                      : "border border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                  Reading your book…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about risk, sizing, a symbol, or what to do next…"
              className="input-base"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-md bg-gold px-4 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </Panel>

        <div className="grid gap-4 lg:col-span-4">
          <Panel title="What it sees" subtitle="Live context sent with every question">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Net worth" value={usd(p.netWorth)} tone="gold" />
              <Stat
                label="Unrealised"
                value={pct(p.unrealizedPct)}
                tone={p.unrealized >= 0 ? "up" : "down"}
              />
              <Stat label="Positions" value={String(p.holdings.length)} />
              <Stat label="Cash" value={usd(p.cash)} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Holdings, account balances, target weights, the ten newest signals, recent news sentiment and your
              strategy settings are attached to every message.
            </p>
          </Panel>

          <Panel title="Starters" subtitle="Tap to ask">
            <ul className="space-y-2">
              {PROMPTS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => void send(q)}
                    disabled={pending}
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground disabled:opacity-50"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
