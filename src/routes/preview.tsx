import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  CircleDollarSign,
  Compass,
  FlaskConical,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "Terminal UI Preview" }] }),
  component: Preview,
});

const watch = [
  { symbol: "BTC", name: "Bitcoin", price: "$68,421.20", change: "+3.82%", up: true, path: "M0 44 C18 40 28 45 44 34 S70 22 88 30 S120 39 142 21 S176 19 210 7" },
  { symbol: "NVDA", name: "NVIDIA", price: "$128.94", change: "+2.41%", up: true, path: "M0 39 C22 42 29 31 48 35 S73 28 91 25 S124 30 145 18 S178 11 210 8" },
  { symbol: "SPY", name: "S&P 500 ETF", price: "$524.31", change: "+0.62%", up: true, path: "M0 32 C20 30 34 34 50 28 S81 31 101 24 S131 21 151 18 S183 20 210 13" },
  { symbol: "TSLA", name: "Tesla", price: "$232.10", change: "-1.74%", up: false, path: "M0 12 C24 13 37 20 55 17 S84 24 106 21 S139 30 157 28 S185 36 210 40" },
];

const predictions = [
  { question: "Fed holds rates at the next meeting?", yes: 72, volume: "$8.4m", closes: "18d" },
  { question: "Bitcoin above $75k before month end?", yes: 41, volume: "$3.1m", closes: "9d" },
  { question: "US CPI prints below 3.0%?", yes: 64, volume: "$1.8m", closes: "23d" },
];

function Preview() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1380px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-xs font-black text-black">T</span>
            <span className="text-sm font-semibold tracking-[-0.035em]">Terminal</span>
          </div>
          <nav className="ml-6 hidden items-center gap-5 text-[11px] text-muted-foreground md:flex">
            <Link to="/" className="text-foreground hover:text-primary">Home</Link>
            <Link to="/markets" className="hover:text-foreground">Markets</Link>
            <Link to="/trade" className="hover:text-foreground">Trade</Link>
            <Link to="/research" className="hover:text-foreground">Research</Link>
            <Link to="/labs" className="hover:text-foreground">Labs</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/markets" className="hidden h-8 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-muted-foreground hover:text-foreground sm:flex">
              <Search className="h-3.5 w-3.5" />
              Search
            </Link>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[9px] font-semibold text-primary">PAPER</span>
            <Link to="/auth" className="rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-black">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-4 pb-24 pt-5 sm:px-6 lg:pb-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,.55fr)]">
          <div>
            <section className="border-b border-border pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Portfolio value · demo</div>
                  <div className="mt-1 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">$24,681.42</div>
                  <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                    <ArrowUpRight className="h-4 w-4" />
                    +$438.18 (+1.81%) today
                  </div>
                </div>
                <div className="hidden gap-2 sm:flex">
                  <Quick to="/research" icon={BrainCircuit} label="Research" />
                  <Quick to="/labs" icon={FlaskConical} label="Backtest" />
                </div>
              </div>

              <div className="mt-4 h-48 sm:h-56">
                <svg viewBox="0 0 900 220" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--primary)" stopOpacity=".22" />
                      <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="55" x2="900" y2="55" stroke="var(--border)" strokeWidth="1" />
                  <line x1="0" y1="110" x2="900" y2="110" stroke="var(--border)" strokeWidth="1" />
                  <line x1="0" y1="165" x2="900" y2="165" stroke="var(--border)" strokeWidth="1" />
                  <path d="M0 171 C60 162 92 170 138 149 S222 104 273 120 S352 154 413 131 S476 64 539 77 S631 94 687 61 S791 65 900 25 L900 220 L0 220 Z" fill="url(#equityFill)" />
                  <path d="M0 171 C60 162 92 170 138 149 S222 104 273 120 S352 154 413 131 S476 64 539 77 S631 94 687 61 S791 65 900 25" fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>

              <div className="flex items-center gap-5 text-[10px] font-medium">
                <span className="text-foreground">1D</span>
                <span className="text-muted-foreground">1W</span>
                <span className="text-muted-foreground">1M</span>
                <span className="text-muted-foreground">3M</span>
                <span className="text-muted-foreground">1Y</span>
                <span className="text-muted-foreground">ALL</span>
              </div>
            </section>

            <section className="grid grid-cols-3 border-b border-border">
              <Metric label="Buying power" value="$6,240.10" />
              <Metric label="Invested" value="$18,441.32" />
              <Metric label="Day P/L" value="+$438.18" positive />
            </section>

            <section className="border-b border-border py-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Watchlist</h2>
                <Link to="/trade" className="text-[10px] text-muted-foreground hover:text-foreground">Edit</Link>
              </div>
              <div className="divide-y divide-border">
                {watch.map((item) => (
                  <Link key={item.symbol} to="/trade" search={{ symbol: item.symbol }} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{item.symbol}</div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.name}</div>
                    </div>
                    <svg viewBox="0 0 210 50" className="h-10 w-full">
                      <path d={item.path} fill="none" stroke={item.up ? "var(--primary)" : "var(--bear)"} strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div className="text-right">
                      <div className="num text-xs font-medium">{item.price}</div>
                      <div className={"num mt-1 flex items-center justify-end gap-0.5 text-[10px] " + (item.up ? "text-primary" : "text-bear")}>
                        {item.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {item.change}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="border-b border-border py-5 xl:hidden">
              <PredictionSection />
            </section>

            <section className="py-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Terminal AI</h2>
                <BrainCircuit className="h-4 w-4 text-primary" />
              </div>
              <Link to="/auth" className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">Ask Terminal to research anything</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">Find robust gold strategies with max drawdown below 15%.</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </section>
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-5">
              <PredictionSection />
              <section className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Paper order</h2>
                  <span className="text-[9px] font-semibold text-primary">SIM</span>
                </div>
                <div className="grid grid-cols-2 rounded-xl bg-card p-1">
                  <Link to="/trade" className="rounded-lg bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">Buy</Link>
                  <Link to="/trade" className="rounded-lg py-2 text-center text-xs text-muted-foreground hover:text-foreground">Sell</Link>
                </div>
                <div className="my-5 text-center">
                  <div className="text-[10px] text-muted-foreground">Amount</div>
                  <div className="mt-1 text-4xl font-semibold tracking-[-0.05em]">$500</div>
                </div>
                <div className="space-y-2 border-y border-border py-3 text-[10px]">
                  <TicketRow label="BTC price" value="$68,421.20" />
                  <TicketRow label="Estimated BTC" value="0.007307" />
                  <TicketRow label="Fee" value="$0.50" />
                </div>
                <Link to="/trade" className="mt-4 block w-full rounded-xl bg-primary py-3 text-center text-xs font-semibold text-primary-foreground">Review paper buy</Link>
              </section>
            </div>
          </aside>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-background/96 px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <Bottom to="/" icon={Wallet} label="Home" active />
        <Bottom to="/markets" icon={Compass} label="Markets" />
        <Bottom to="/trade" icon={TrendingUp} label="Trade" />
        <Bottom to="/research" icon={BrainCircuit} label="Research" />
        <Bottom to="/labs" icon={BarChart3} label="Labs" />
      </nav>
    </div>
  );
}

function PredictionSection() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Prediction markets</h2></div>
        <Link to="/markets" className="text-[10px] text-muted-foreground hover:text-foreground">View all</Link>
      </div>
      <div className="divide-y divide-border">
        {predictions.map((item) => (
          <div key={item.question} className="py-3.5">
            <div className="text-xs font-medium leading-5">{item.question}</div>
            <div className="mt-3 flex items-center gap-2">
              <Link to="/markets" className="rounded-lg bg-primary/12 px-3 py-2 text-[10px] font-semibold text-primary">Yes {item.yes}¢</Link>
              <Link to="/markets" className="rounded-lg bg-white/[0.045] px-3 py-2 text-[10px] font-semibold text-muted-foreground">No {100 - item.yes}¢</Link>
              <div className="ml-auto text-right">
                <div className="text-[9px] text-muted-foreground">{item.volume} vol</div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">{item.closes} left</div>
              </div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-primary" style={{ width: item.yes + "%" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className="border-r border-border py-4 pr-3 last:border-r-0 last:pl-3 sm:px-4 first:pl-0"><div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className={"num mt-1 text-xs font-semibold sm:text-sm " + (positive ? "text-primary" : "")}>{value}</div></div>;
}

function Quick({ to, icon: Icon, label }: { to: "/research" | "/labs"; icon: typeof BrainCircuit; label: string }) {
  return <Link to={to} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[10px] font-medium hover:border-primary/30"><Icon className="h-3.5 w-3.5 text-primary" />{label}</Link>;
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="num">{value}</span></div>;
}

function Bottom({ to, icon: Icon, label, active = false }: { to: "/" | "/markets" | "/trade" | "/research" | "/labs"; icon: typeof Wallet; label: string; active?: boolean }) {
  return <Link to={to} className={"flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-medium " + (active ? "text-foreground" : "text-muted-foreground")}><Icon className={"h-[18px] w-[18px] " + (active ? "text-primary" : "")} />{label}</Link>;
}
