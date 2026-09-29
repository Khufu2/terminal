import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { supabase } from "@/integrations/supabase/client";
import { ensureRiskSettings, getIntegrationStatus, runEngineJob } from "@/lib/bot.functions";
import { useAlerts, useBotDecisions, useBotRuns, useRiskSettings, type RiskSettings } from "@/lib/db";
import { timeAgo, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/autopilot")({
  head: () => ({
    meta: [
      { title: "Autopilot — Aurum Terminal" },
      {
        name: "description",
        content:
          "Autonomous trading controls: risk per trade, daily loss limit, drawdown kill switch and a live audit of every bot decision.",
      },
      { property: "og:title", content: "Autopilot — Aurum Terminal" },
      { property: "og:description", content: "Hard risk caps, kill switch and full decision audit for the trading engine." },
    ],
  }),
  component: Autopilot,
});

const NUMERIC: { key: keyof RiskSettings; label: string; hint: string; step: number }[] = [
  { key: "risk_per_trade_pct", label: "Risk per trade %", hint: "Equity risked between entry and stop", step: 0.1 },
  { key: "max_open_positions", label: "Max open positions", hint: "Hard cap on concurrent exposure", step: 1 },
  { key: "max_market_exposure_pct", label: "Max position size %", hint: "Cap on any single position's notional", step: 1 },
  { key: "daily_loss_limit_pct", label: "Daily loss limit %", hint: "Bot halts itself when breached", step: 0.5 },
  { key: "max_drawdown_pct", label: "Max drawdown %", hint: "Halt if equity falls this far from peak", step: 1 },
  { key: "min_confidence", label: "Min confidence", hint: "0–1; signals below this are ignored", step: 0.05 },
];

const JOBS = [
  { job: "prices", label: "Refresh prices" },
  { job: "news", label: "Pull news" },
  { job: "signals", label: "Generate signals" },
  { job: "trade", label: "Run trader" },
  { job: "digest", label: "Send digest" },
] as const;

function Autopilot() {
  const qc = useQueryClient();
  const risk = useRiskSettings();
  const decisions = useBotDecisions();
  const runs = useBotRuns();
  const alerts = useAlerts();
  const ensure = useServerFn(ensureRiskSettings);
  const run = useServerFn(runEngineJob);
  const status = useQuery({ queryKey: ["integrations"], queryFn: () => getIntegrationStatus() });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (risk.isSuccess && !risk.data) {
      void ensure({ data: undefined }).then(() => qc.invalidateQueries({ queryKey: ["risk_settings"] }));
    }
  }, [risk.isSuccess, risk.data, ensure, qc]);

  const r = risk.data;

  async function patch(values: Partial<RiskSettings>) {
    if (!r) return;
    const { error } = await supabase.from("risk_settings").update(values).eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["risk_settings"] });
  }

  async function trigger(job: string) {
    setBusy(job);
    try {
      const res = await run({ data: { job } });
      toast.success(res.result);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const integrations = status.data;
  const live = r ? r.live_crypto || r.live_stocks || r.live_kalshi : false;

  return (
    <AppShell title="Autopilot" subtitle="Hard caps, kill switch and the bot's full decision trail">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Engine state">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Autonomy"
              value={r?.autonomy_enabled ? "On" : "Off"}
              tone={r?.autonomy_enabled ? "up" : "neutral"}
            />
            <Stat label="Status" value={r?.halted ? "Halted" : "Clear"} tone={r?.halted ? "down" : "up"} />
            <Stat label="Mode" value={live ? "Live" : "Sim"} tone={live ? "down" : "gold"} />
            <Stat label="Peak equity" value={usd(r?.peak_equity ?? 0)} />
          </div>

          {r?.halted && (
            <p className="mt-3 rounded-md border border-bear/40 bg-bear/10 p-3 text-xs text-bear">
              Bot halted: {r.halt_reason}. Trading stays off until you clear it.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void patch({ autonomy_enabled: !r?.autonomy_enabled })}
              className={cn(
                "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-90",
                r?.autonomy_enabled ? "bg-secondary text-foreground" : "bg-gold text-background",
              )}
            >
              {r?.autonomy_enabled ? "Pause autonomy" : "Enable autonomy"}
            </button>
            <button
              type="button"
              onClick={() => void patch({ halted: true, halt_reason: "manual kill switch" })}
              className="rounded-md border border-bear/50 bg-bear/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-bear"
            >
              Kill switch
            </button>
            {r?.halted && (
              <button
                type="button"
                onClick={() => void patch({ halted: false, halt_reason: null })}
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                Clear halt
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {JOBS.map((j) => (
              <button
                key={j.job}
                type="button"
                disabled={busy !== null}
                onClick={() => void trigger(j.job)}
                className="rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold-soft disabled:opacity-50"
              >
                {busy === j.job ? "Running…" : j.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-4" title="Data & broker links">
          <ul className="space-y-2 text-xs">
            {[
              ["Alpaca (prices, news, orders)", integrations?.alpaca],
              ["Telegram alerts", integrations?.telegram],
              ["Kalshi", integrations?.kalshi],
              ["Scheduler secret", integrations?.cron],
            ].map(([label, ok]) => (
              <li key={String(label)} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <Pill tone={ok ? "up" : "neutral"}>{ok ? "connected" : "missing"}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Without an Alpaca key the engine has no prices or headlines and every job reports “skipped”. Live order
            routing only happens for markets you switch to Live below.
          </p>
        </Panel>

        <Panel className="lg:col-span-8" title="Hard caps" subtitle="The bot cannot act outside these numbers">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NUMERIC.map((f) => (
              <label key={String(f.key)} className="block">
                <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}</span>
                <input
                  type="number"
                  step={f.step}
                  defaultValue={Number(r?.[f.key] ?? 0)}
                  onBlur={(e) => void patch({ [f.key]: Number(e.target.value) } as Partial<RiskSettings>)}
                  className="num mt-1 w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm outline-none focus:border-gold/60"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">{f.hint}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Per-market execution</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["live_crypto", "Crypto"],
                  ["live_stocks", "Stocks"],
                  ["live_kalshi", "Kalshi"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void patch({ [key]: !r?.[key] } as Partial<RiskSettings>)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                    r?.[key] ? "border-bear/50 bg-bear/10 text-bear" : "border-border text-muted-foreground",
                  )}
                >
                  {label}: {r?.[key] ? "Live" : "Sim"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Live means real orders at your broker. Leave everything on Sim until the record justifies real money.
            </p>
          </div>

          <label className="mt-4 block">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Telegram chat ID</span>
            <input
              defaultValue={r?.telegram_chat_id ?? ""}
              placeholder="e.g. 123456789"
              onBlur={(e) => void patch({ telegram_chat_id: e.target.value.trim() || null })}
              className="num mt-1 w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm outline-none focus:border-gold/60"
            />
          </label>
        </Panel>

        <Panel className="lg:col-span-4" title="Alerts">
          <ul className="space-y-2">
            {(alerts.data ?? []).map((a) => (
              <li key={a.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-semibold", a.level === "critical" ? "text-bear" : "text-foreground")}>
                    {a.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                </div>
                {a.body && <p className="mt-1 whitespace-pre-line text-[11px] text-muted-foreground">{a.body}</p>}
              </li>
            ))}
            {!alerts.data?.length && <li className="text-xs text-muted-foreground">No alerts yet.</li>}
          </ul>
        </Panel>

        <Panel className="lg:col-span-7" title="Decision audit" subtitle="Everything the bot considered, and why">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left">Symbol</th>
                  <th className="text-left">Action</th>
                  <th className="text-right">Conf.</th>
                  <th className="text-left">Outcome</th>
                  <th className="text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {(decisions.data ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-border/70">
                    <td className="py-1.5 font-medium">{d.symbol}</td>
                    <td className="uppercase text-muted-foreground">{d.action}</td>
                    <td className="num text-right">{(Number(d.confidence) * 100).toFixed(0)}%</td>
                    <td className={cn("truncate", d.accepted ? "text-bull" : "text-muted-foreground")}>
                      {d.accepted ? `filled ${d.quantity} @ ${d.price}` : (d.blocked_reason ?? "—")}
                    </td>
                    <td className="text-right text-muted-foreground">{timeAgo(d.created_at)}</td>
                  </tr>
                ))}
                {!decisions.data?.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-muted-foreground">
                      No decisions yet — run the trader once autonomy is on.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-5" title="Engine runs">
          <ul className="space-y-1.5">
            {(runs.data ?? []).map((run_) => (
              <li key={run_.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5 text-xs">
                <div className="min-w-0">
                  <span className="uppercase tracking-[0.12em] text-gold-soft">{run_.job}</span>
                  <p className="truncate text-[11px] text-muted-foreground">{run_.detail}</p>
                </div>
                <Pill tone={run_.status === "ok" ? "up" : "down"}>{run_.status}</Pill>
              </li>
            ))}
            {!runs.data?.length && <li className="text-xs text-muted-foreground">No runs yet.</li>}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}