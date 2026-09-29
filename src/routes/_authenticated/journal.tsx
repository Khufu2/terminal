import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useJournal, useTableMutation } from "@/lib/db";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Terminal" },
      { name: "description", content: "Log every trade's thesis, outcome and R-multiple so you can see what actually works." },
      { property: "og:title", content: "Journal — Terminal" },
      { property: "og:description", content: "Build the habit that separates profitable traders: writing down the why." },
    ],
  }),
  component: Page,
});

const MARKETS = ["crypto", "stocks", "kalshi", "cash"] as const;
const OUTCOMES = ["win", "loss", "breakeven", "scratch"] as const;

function Page() {
  const journal = useJournal();
  const rows = journal.data ?? [];
  const loading = journal.isLoading;

  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<string>("crypto");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [outcome, setOutcome] = useState<string>("");
  const [rMultiple, setRMultiple] = useState("");

  const add = useTableMutation<{
    title: string;
    symbol: string | null;
    market: string | null;
    body: string | null;
    tags: string | null;
    outcome: string | null;
    r_multiple: number | null;
  }>(
    "journal_entries",
    async (vars) => {
      const { data: auth } = await supabase.auth.getUser();
      return supabase.from("journal_entries").insert({ ...vars, user_id: auth.user!.id, entry_date: new Date().toISOString() });
    },
    ["journal"],
  );

  const del = useTableMutation<string>(
    "journal_entries",
    (id) => supabase.from("journal_entries").delete().eq("id", id),
    ["journal"],
  );

  const stats = useMemo(() => {
    const decided = rows.filter((r) => r.outcome === "win" || r.outcome === "loss");
    const wins = decided.filter((r) => r.outcome === "win").length;
    const winRate = decided.length ? wins / decided.length : 0;
    const rVals = rows.filter((r) => r.r_multiple != null).map((r) => Number(r.r_multiple));
    const avgR = rVals.length ? rVals.reduce((s, v) => s + v, 0) / rVals.length : 0;
    const expectancy = decided.length
      ? decided.reduce((s, r) => s + (r.outcome === "win" ? 1 : -1), 0) / decided.length
      : 0;
    const bySymbol = new Map<string, { wins: number; total: number }>();
    for (const r of decided) {
      const key = r.symbol ?? "other";
      const e = bySymbol.get(key) ?? { wins: 0, total: 0 };
      e.total += 1;
      if (r.outcome === "win") e.wins += 1;
      bySymbol.set(key, e);
    }
    return { winRate, avgR, expectancy, decided, wins, rVals, bySymbol };
  }, [rows]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the entry a title first.");
      return;
    }
    add.mutate(
      {
        title: title.trim(),
        symbol: symbol.trim() || null,
        market: market || null,
        body: body.trim() || null,
        tags: tags.trim() || null,
        outcome: outcome || null,
        r_multiple: Number.isFinite(Number(rMultiple)) && rMultiple !== "" ? Number(rMultiple) : null,
      },
      {
        onSuccess: () => {
          toast.success("Journal entry saved");
          setTitle("");
          setSymbol("");
          setBody("");
          setTags("");
          setOutcome("");
          setRMultiple("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <AppShell title="Journal" subtitle="The 'why' behind every trade, and what it taught you">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-12" title="Your record">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Entries" value={String(rows.length)} tone="gold" />
            <Stat
              label="Win rate"
              value={stats.decided.length ? `${(stats.winRate * 100).toFixed(0)}%` : "—"}
              hint={`${stats.wins}/${stats.decided.length} decided`}
            />
            <Stat
              label="Avg R"
              value={stats.rVals.length ? num(stats.avgR, 2) : "—"}
              tone={stats.avgR > 0 ? "up" : stats.avgR < 0 ? "down" : "neutral"}
              hint="Reward-to-risk per trade"
            />
            <Stat
              label="Expectancy"
              value={stats.decided.length ? `${stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(2)}R` : "—"}
              tone={stats.expectancy > 0 ? "up" : stats.expectancy < 0 ? "down" : "neutral"}
            />
            <Stat label="Symbols logged" value={String(stats.bySymbol.size)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-4" title="New entry" subtitle="Log it before you forget it">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Title *">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Why I took the trade" className="input-base" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbol">
                <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTC" className="input-base num" />
              </Field>
              <Field label="Market">
                <select value={market} onChange={(e) => setMarket(e.target.value)} className="input-base">
                  {MARKETS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Thesis / notes">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Setup, plan, what I expected to happen…" className="input-base resize-none" />
            </Field>
            <Field label="Tags">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="breakout, earnings, trend" className="input-base" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outcome">
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="input-base">
                  <option value="">—</option>
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="R multiple">
                <input value={rMultiple} onChange={(e) => setRMultiple(e.target.value)} inputMode="decimal" placeholder="e.g. 1.5" className="input-base num" />
              </Field>
            </div>
            <button
              type="submit"
              disabled={add.isPending}
              className="w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {add.isPending ? "Saving…" : "Save entry"}
            </button>
          </form>
        </Panel>

        <Panel className="lg:col-span-8" title="Entries" subtitle={`${rows.length} logged`} bodyClassName="px-0 pb-3">
          {loading ? (
            <div className="space-y-2 px-4 py-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">No entries yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Writers don't lose the lesson. Log your first trade on the left.
              </p>
            </div>
          ) : (
            <div className="max-h-[40rem] space-y-0 divide-y divide-border/60 overflow-y-auto">
              {rows.map((r) => (
                <div key={r.id} className="group px-4 py-3 hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.title}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {[r.symbol, r.market, r.tags].filter(Boolean).join(" · ") || "—"}
                        <span className="ml-1 text-muted-foreground/70">
                          {new Date(r.entry_date).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.outcome && (
                        <Pill
                          tone={
                            r.outcome === "win" ? "up" : r.outcome === "loss" ? "down" : r.outcome === "breakeven" ? "neutral" : "gold"
                          }
                        >
                          {r.outcome}
                        </Pill>
                      )}
                      {r.r_multiple != null && (
                        <span className={cn("num text-xs font-semibold", Number(r.r_multiple) >= 0 ? "text-bull" : "text-bear")}>
                          {Number(r.r_multiple) >= 0 ? "+" : ""}
                          {num(Number(r.r_multiple), 2)}R
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => del.mutate(r.id)}
                        className="ml-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-bear group-hover:opacity-100"
                        aria-label={`Delete ${r.title}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {r.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{r.body}</p>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}