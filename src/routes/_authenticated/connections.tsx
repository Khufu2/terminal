import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleDashed, Database, Server, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getConnectionHealth } from "@/lib/connection.functions";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({ meta: [{ title: "Connections — Terminal" }] }),
  component: Connections,
});

function Connections() {
  const healthFn = useServerFn(getConnectionHealth);
  const health = useQuery({ queryKey: ["connection-health"], queryFn: () => healthFn({ data: undefined }), refetchInterval: 30_000 });

  return (
    <AppShell title="Connections" subtitle="Server-side credentials only — never paste broker keys into the browser">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Credential boundary</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Terminal reads provider credentials from encrypted deployment environment variables. The web client never receives the Alpaca secret or quant-engine bearer key. This commercial build stays paper-first.</p></div></div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <ConnectionCard
            icon={Database}
            title="Alpaca market data"
            status={health.data?.alpaca ? (health.data.alpacaPaper ? "Paper configured" : "Configured") : "Not configured"}
            good={Boolean(health.data?.alpaca)}
            description="Verified US equity and crypto daily bars for Explore and Trade. Paper broker credentials are recommended."
            env={["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "ALPACA_PAPER=true"]}
          />
          <ConnectionCard
            icon={Server}
            title="Terminal Quant Engine"
            status={health.data?.quantOnline ? "Online" : health.data?.quantConfigured ? "Configured, unreachable" : "Not configured"}
            good={Boolean(health.data?.quantOnline)}
            description="Isolated Vibe-Trading service for research, backtests, factors and run artifacts."
            env={["QUANT_ENGINE_URL", "QUANT_ENGINE_API_KEY"]}
          />
        </div>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Quant engine deployment</h2>
          <ol className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
            <li><span className="mr-2 font-mono text-primary">01</span>Deploy <code className="rounded bg-background px-1.5 py-0.5">services/quant-engine</code> as a Docker service with persistent storage mounted at <code className="rounded bg-background px-1.5 py-0.5">/data</code>.</li>
            <li><span className="mr-2 font-mono text-primary">02</span>Set a long random <code className="rounded bg-background px-1.5 py-0.5">API_AUTH_KEY</code>, plus the engine's LLM provider credentials.</li>
            <li><span className="mr-2 font-mono text-primary">03</span>Set the web app's <code className="rounded bg-background px-1.5 py-0.5">QUANT_ENGINE_URL</code> and matching <code className="rounded bg-background px-1.5 py-0.5">QUANT_ENGINE_API_KEY</code>.</li>
          </ol>
        </section>
      </div>
    </AppShell>
  );
}

function ConnectionCard({ icon: Icon, title, status, good, description, env }: { icon: typeof Database; title: string; status: string; good: boolean; description: string; env: string[] }) {
  return <section className="rounded-3xl border border-border bg-card p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04]"><Icon className="h-4 w-4 text-primary" /></div><span className={good ? "flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary" : "flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"}>{good ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}{status}</span></div>
    <h3 className="mt-4 text-base font-semibold">{title}</h3>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    <div className="mt-4 space-y-1.5">{env.map((name) => <div key={name} className="rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">{name}</div>)}</div>
  </section>;
}
