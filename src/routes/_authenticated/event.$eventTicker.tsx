import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, BrainCircuit, CalendarClock, CircleDollarSign, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { getPredictionEvent } from "@/lib/prediction.functions";

export const Route = createFileRoute("/_authenticated/event/$eventTicker")({
  head: () => ({ meta: [{ title: "Prediction market — Terminal" }] }),
  component: EventPage,
});

function EventPage() {
  const { eventTicker } = Route.useParams();
  const fetchEvent = useServerFn(getPredictionEvent);
  const event = useQuery({
    queryKey: ["prediction-event", eventTicker],
    queryFn: () => fetchEvent({ data: { eventTicker } }),
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  if (event.isLoading) return <AppShell title="Prediction market"><div className="py-24 text-center text-xs text-muted-foreground">Loading event…</div></AppShell>;
  if (event.isError || !event.data) return <AppShell title="Prediction market"><div className="py-24 text-center"><div className="text-sm font-medium">Event unavailable</div><Link to="/markets" className="mt-4 inline-flex text-xs text-primary">Back to markets</Link></div></AppShell>;

  const e = event.data;
  const totalVolume = e.markets.reduce((s, m) => s + m.volume24h, 0);
  const totalOi = e.markets.reduce((s, m) => s + m.openInterest, 0);

  return (
    <AppShell title="Prediction market" subtitle="Live Kalshi public market data">
      <div className="mx-auto max-w-4xl">
        <Link to="/markets" className="mb-5 inline-flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Markets</Link>

        <section className="border-b border-border pb-5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">{e.category}</div>
          <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.045em] sm:text-3xl">{e.title}</h1>
          {e.subtitle && <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{e.subtitle}</p>}
          <div className="mt-5 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
            <span>{formatMoney(totalVolume)} 24h volume</span>
            <span>{formatMoney(totalOi)} open interest</span>
            <span>{e.markets.length} market{e.markets.length === 1 ? "" : "s"}</span>
          </div>
        </section>

        <section className="py-5">
          <div className="mb-3 flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Outcomes</h2></div>
          <div className="space-y-2">
            {e.markets.map((m) => {
              const yes = Math.round(m.yesPrice * 100);
              return (
                <div key={m.ticker} className="rounded-2xl border border-border bg-card/35 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><div className="text-sm font-medium leading-5">{m.title || m.subtitle || m.ticker}</div><div className="mt-1 font-mono text-[9px] text-muted-foreground">{m.ticker}</div></div>
                    <div className="num text-2xl font-semibold text-primary">{yes}%</div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-primary/10 px-3 py-2.5"><div className="text-[9px] text-primary/75">Yes</div><div className="num mt-0.5 text-sm font-semibold text-primary">{yes}¢</div></div>
                    <div className="rounded-xl bg-white/[0.045] px-3 py-2.5"><div className="text-[9px] text-muted-foreground">No</div><div className="num mt-0.5 text-sm font-semibold">{100 - yes}¢</div></div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-primary" style={{ width: `${yes}%` }} /></div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[9px] text-muted-foreground">
                    <span>{formatMoney(m.volume24h)} 24h</span>
                    <span>{formatMoney(m.openInterest)} OI</span>
                    {m.closeTime && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Closes {new Date(m.closeTime).toLocaleString()}</span>}
                  </div>

                  {m.rules && <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Settlement rule</summary><p className="mt-2 text-[10px] leading-5 text-muted-foreground">{m.rules}</p></details>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-border py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /><div className="text-sm font-semibold">Research the event before acting</div></div>
              <p className="mt-1 max-w-xl text-[10px] leading-5 text-muted-foreground">Terminal can use Gemini immediately and the Vibe-Trading engine when deployed. Prediction prices are market-implied, not guarantees.</p>
            </div>
            <Link to="/research" search={{ prompt: `Research this prediction event neutrally: "${e.title}". Explain the evidence that could move the market, key uncertainty, and what data I should monitor. Do not tell me which political or electoral choice to support.` }} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground">Research event <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border p-3 text-[9px] leading-4 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />Terminal currently treats Kalshi as a market-data/research surface. Stock and crypto paper trading remains simulated inside Terminal; no Kalshi order routing is enabled.</div>
        </section>
      </div>
    </AppShell>
  );
}

function formatMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}
