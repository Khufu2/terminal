import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill } from "@/components/Panel";
import { supabase } from "@/integrations/supabase/client";
import { useStrategies, useTableMutation, useTraders } from "@/lib/db";
import { MARKET_LABEL, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/strategies")({
  head: () => ({
    meta: [
      { title: "Strategies — Aurum Terminal" },
      {
        name: "description",
        content: "Switch between risk-calibrated allocation strategies and follow reputable traders in one click.",
      },
      { property: "og:title", content: "Strategies — Aurum Terminal" },
      { property: "og:description", content: "Shift strategy safely with preset weights, confidence gates and sizing caps." },
    ],
  }),
  component: Strategies,
});

function Strategies() {
  const strategies = useStrategies();
  const traders = useTraders();

  const activate = useTableMutation<string>(
    "strategies",
    async (id) => {
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("strategies").update({ is_active: false }).eq("user_id", auth.user!.id);
      return supabase.from("strategies").update({ is_active: true }).eq("id", id);
    },
    ["strategies"],
  );

  const toggleFollow = useTableMutation<{ id: string; following: boolean }>(
    "followed_traders",
    ({ id, following }) => supabase.from("followed_traders").update({ following }).eq("id", id),
    ["traders"],
  );

  return (
    <AppShell title="Strategies" subtitle="Change how the terminal thinks, not just what it holds">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {(strategies.data ?? []).map((s) => (
          <Panel key={s.id} className={cn("lg:col-span-4", s.is_active && "ring-1 ring-gold/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{s.name}</h3>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{s.risk_level} risk</p>
              </div>
              {s.is_active && <Pill tone="gold">Active</Pill>}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.description}</p>

            <div className="mt-3 space-y-1.5">
              {(
                [
                  ["crypto", s.crypto_weight],
                  ["stocks", s.stocks_weight],
                  ["kalshi", s.kalshi_weight],
                ] as const
              ).map(([market, weight]) => (
                <div key={market}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{MARKET_LABEL[market] ?? market}</span>
                    <span className="num">{(Number(weight) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Number(weight) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md border border-border py-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Min confidence</dt>
                <dd className="num text-xs">{pct(Number(s.min_confidence), 0, false)}</dd>
              </div>
              <div className="rounded-md border border-border py-1.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Max position</dt>
                <dd className="num text-xs">{pct(Number(s.max_position_pct), 0, false)}</dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={s.is_active || activate.isPending}
              onClick={() =>
                activate.mutate(s.id, {
                  onSuccess: () => toast.success(`${s.name} is now your active strategy`),
                  onError: (e) => toast.error(e.message),
                })
              }
              className="mt-3 w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {s.is_active ? "Currently running" : "Switch to this strategy"}
            </button>
          </Panel>
        ))}

        <Panel className="lg:col-span-12" title="Traders you follow" subtitle="Reputable operators across crypto, stocks and Kalshi">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(traders.data ?? []).map((t) => (
              <div key={t.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.handle} · {MARKET_LABEL[t.market] ?? t.market} · {t.specialty}
                    </p>
                  </div>
                  <Pill tone={t.following ? "gold" : "neutral"}>{t.following ? "Following" : "Muted"}</Pill>
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px]">
                  <span className="num text-bull">{pct(Number(t.ytd_return))} YTD</span>
                  <span className="num text-muted-foreground">{pct(Number(t.win_rate), 0, false)} win rate</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{t.current_stance}</p>
                <button
                  type="button"
                  onClick={() => toggleFollow.mutate({ id: t.id, following: !t.following })}
                  className="mt-2 w-full rounded border border-border py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold-soft"
                >
                  {t.following ? "Unfollow" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
