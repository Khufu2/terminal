import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill } from "@/components/Panel";
import { supabase } from "@/integrations/supabase/client";
import { useConnections, useTableMutation } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Aurum Terminal" },
      {
        name: "description",
        content: "Connect brokers, exchanges, Kalshi and market data feeds to move from paper to live trading.",
      },
      { property: "og:title", content: "Connections — Aurum Terminal" },
      { property: "og:description", content: "Step-by-step setup for Alpaca, Binance, Kalshi and market data." },
    ],
  }),
  component: Connections,
});

const GUIDES: Record<string, { what: string; steps: string[] }> = {
  alpaca: {
    what: "US stocks & ETFs execution, paper and live.",
    steps: [
      "Create an account at alpaca.markets and open the Paper Trading dashboard.",
      "Generate an API key + secret (start with paper keys).",
      "Send me the keys here and I'll store them as encrypted backend secrets.",
      "I wire order routing so the trade ticket can flip from Sim to Live.",
    ],
  },
  binance: {
    what: "Crypto spot execution and price feeds.",
    steps: [
      "In Binance, go to API Management and create a key labelled Aurum.",
      "Enable Spot Trading only — leave withdrawals disabled.",
      "Whitelist server IPs if your account requires it, then share the key + secret.",
      "I add them as secrets and route crypto orders through Binance.",
    ],
  },
  kalshi: {
    what: "Regulated event contracts (elections, macro, weather).",
    steps: [
      "Sign up at kalshi.com and complete identity verification.",
      "Create an API key in Account → API, and download the RSA private key file.",
      "Share the key ID and private key with me; they go straight into secrets.",
      "Kalshi markets then appear with live prices and order placement.",
    ],
  },
  polygon: {
    what: "Real-time and historical market data for stocks and crypto.",
    steps: [
      "Create a polygon.io account and pick a plan (the free tier works to start).",
      "Copy your API key from the dashboard.",
      "Share it and I'll replace the synthetic candles with real OHLC data.",
    ],
  },
  orchestrator: {
    what: "Your existing Python trading-orchestrator bot.",
    steps: [
      "Deploy the orchestrator anywhere it can reach the internet.",
      "I expose a signed webhook endpoint on this app.",
      "Point the orchestrator at that URL so its signals land in the Signals page automatically.",
    ],
  },
};

const STATUSES = ["not_connected", "pending", "connected"] as const;

function Connections() {
  const connections = useConnections();

  const setStatus = useTableMutation<{ id: string; status: string }>(
    "connections",
    ({ id, status }) => supabase.from("connections").update({ status }).eq("id", id),
    ["connections"],
  );

  return (
    <AppShell title="Connections" subtitle="Everything you need to go from paper to live">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-12" title="How this works">
          <p className="text-xs leading-relaxed text-muted-foreground">
            The terminal runs fully in simulation today — every fill updates your real portfolio maths without touching
            money. To trade live you connect a broker or exchange. Never paste keys into a public chat or a page you do
            not trust; when you're ready, tell me which provider and I'll request the key through the secure secret
            prompt so it is stored encrypted on the backend and never in the codebase.
          </p>
        </Panel>

        {(connections.data ?? []).map((c) => {
          const guide = GUIDES[c.provider.toLowerCase()];
          return (
            <Panel key={c.id} className="lg:col-span-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold capitalize">{c.provider}</h3>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{c.category}</p>
                </div>
                <Pill tone={c.status === "connected" ? "up" : c.status === "pending" ? "gold" : "neutral"}>
                  {c.status.replace("_", " ")}
                </Pill>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{guide?.what ?? c.notes}</p>

              {guide && (
                <ol className="mt-3 space-y-1.5">
                  {guide.steps.map((s, i) => (
                    <li key={s} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="num text-gold-soft">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-3 flex gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setStatus.mutate(
                        { id: c.id, status: s },
                        { onError: (e) => toast.error(e.message) },
                      )
                    }
                    className={cn(
                      "flex-1 rounded border py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                      c.status === s
                        ? "border-gold/50 bg-gold/10 text-gold-soft"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
