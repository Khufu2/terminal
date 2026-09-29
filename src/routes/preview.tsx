import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BrainCircuit, ChevronRight, CircleDollarSign, Search, Sparkles, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "Terminal UI Preview" }] }),
  component: Preview,
});

const assets = [
  { symbol: "BTC", name: "Bitcoin", price: "$68,421.20", change: "+3.82%", up: true },
  { symbol: "NVDA", name: "NVIDIA", price: "$128.94", change: "+2.41%", up: true },
  { symbol: "SPY", name: "S&P 500 ETF", price: "$524.31", change: "+0.62%", up: true },
  { symbol: "TSLA", name: "Tesla", price: "$232.10", change: "-1.74%", up: false },
];

const markets = [
  { q: "Fed holds rates at next meeting?", yes: "72¢", vol: "$8.4m" },
  { q: "BTC above $75k this month?", yes: "41¢", vol: "$3.1m" },
  { q: "US CPI prints below 3%?", yes: "64¢", vol: "$1.8m" },
];

function Preview() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">T</span>
            <div>
              <div className="text-sm font-semibold tracking-[-.03em]">Terminal</div>
              <div className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">UI preview</div>
            </div>
          </div>
          <nav className="ml-6 hidden items-center gap-6 text-xs text-muted-foreground md:flex">
            <span className="text-foreground">Home</span><span>Markets</span><span>Research</span><span>Labs</span><span>Activity</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex"><Search className="h-3.5 w-3.5" /> Search markets</div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold text-primary">PAPER</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] space-y-5 px-4 py-5 pb-24 sm:px-6 lg:pb-8">
        <div className="flex items-center justify-between">
          <div><div className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Demo data</div><h1 className="mt-1 text-2xl font-semibold tracking-[-.045em] sm:text-3xl">Good evening.</h1></div>
          <Link to="/auth" className="hidden rounded-xl border border-border px-3 py-2 text-xs font-medium sm:inline-flex">Connect account</Link>
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_19rem]">
              <div>
                <div className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Portfolio value</div>
                <div className="mt-2 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">$24,681.42</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-primary"><ArrowUpRight className="h-4 w-4" /> +$438.18 · +1.81% today</div>
                <div className="mt-7 flex flex-wrap gap-2">
                  {[[BrainCircuit,"Research"],[BarChart3,"Backtest"],[TrendingUp,"Paper trade"],[Wallet,"Portfolio"]].map(([Icon,label]: any) => <button key={label} className="flex items-center gap-2 rounded-xl border border-border bg-white/[.025] px-3 py-2 text-xs font-medium"><Icon className="h-3.5 w-3.5 text-primary" />{label}</button>)}
                </div>
              </div>
              <div className="relative min-h-40 overflow-hidden rounded-2xl border border-border bg-background/50 p-4">
                <svg viewBox="0 0 300 130" className="absolute inset-x-0 bottom-0 h-[85%] w-full" preserveAspectRatio="none">
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity=".28"/><stop offset="1" stopColor="var(--primary)" stopOpacity="0"/></linearGradient></defs>
                  <path d="M0 100 C30 88,45 96,70 78 S105 64,126 69 S165 92,188 58 S230 54,300 16 L300 130 L0 130 Z" fill="url(#g)"/>
                  <path d="M0 100 C30 88,45 96,70 78 S105 64,126 69 S165 92,188 58 S230 54,300 16" fill="none" stroke="var(--primary)" strokeWidth="3"/>
                </svg>
                <div className="relative z-10 flex justify-between text-[9px] text-muted-foreground"><span>1M</span><span>+8.4%</span></div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between"><div><div className="text-xs font-semibold">Terminal AI</div><div className="mt-1 text-[10px] text-muted-foreground">Research agent</div></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4"/></span></div>
            <p className="mt-5 text-sm leading-6">What should we research?</p>
            <div className="mt-3 rounded-2xl border border-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">“Find gold strategies since 2020 with drawdown below 15%, then walk-forward test the best one.”</div>
            <button className="mt-3 flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground">Run research <ArrowRight className="h-4 w-4"/></button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Markets</h2><span className="text-[10px] text-muted-foreground">Live-style layout · demo data</span></div>
            <div className="divide-y divide-border">
              {assets.map((a) => <div key={a.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4">
                <div><div className="text-sm font-semibold">{a.symbol}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{a.name}</div></div>
                <div className="num text-sm">{a.price}</div>
                <div className={"num min-w-16 text-right text-xs font-medium "+(a.up?"text-primary":"text-bear")}>{a.up?<ArrowUpRight className="mr-1 inline h-3 w-3"/>:<ArrowDownRight className="mr-1 inline h-3 w-3"/>}{a.change}</div>
              </div>)}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Prediction markets</h2><CircleDollarSign className="h-4 w-4 text-primary"/></div>
            <div className="divide-y divide-border">
              {markets.map((m) => <div key={m.q} className="px-5 py-4">
                <div className="text-sm font-medium leading-5">{m.q}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="rounded-xl bg-primary/12 px-3 py-2 text-xs font-semibold text-primary">Yes {m.yes}</button>
                  <button className="rounded-xl bg-white/[.045] px-3 py-2 text-xs font-semibold text-muted-foreground">No</button>
                  <span className="ml-auto text-[10px] text-muted-foreground">{m.vol} vol</span>
                </div>
              </div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Labs","Backtest ideas with fees, slippage, drawdown and out-of-sample validation."],
            ["Strategies","Save research hypotheses and paper-deploy them without handing over unrestricted execution."],
            ["Activity","One timeline for research runs, simulated fills and journal notes."],
          ].map(([title,body]) => <div key={title} className="group rounded-3xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"/></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p></div>)}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-background/95 px-2 pb-[max(.4rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        {["Home","Markets","Trade","Research","More"].map((x,i)=><button key={x} className={"min-h-14 text-[9px] font-medium "+(i===0?"text-foreground":"text-muted-foreground")}>{x}</button>)}
      </nav>
    </div>
  );
}
