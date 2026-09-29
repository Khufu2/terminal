import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookText,
  Bot,
  CandlestickChart,
  Coins,
  Compass,
  LayoutGrid,
  LineChart,
  Menu,
  Newspaper,
  Plug,
  Radar,
  ShieldAlert,
  Wallet,
  LogOut,
  Sparkles,
  X,
  CircleDollarSign,
  ListPlus,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { useState, useEffect, useMemo, type ReactNode } from "react";

import logo from "@/assets/logo.png";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  mobile?: boolean;
};

const NAV: NavItemDef[] = [
  { to: "/", label: "Overview", icon: LayoutGrid, mobile: true },
  { to: "/portfolio", label: "Portfolio", icon: Wallet, mobile: true },
  { to: "/finances", label: "Finances", icon: Coins },
  { to: "/markets", label: "Markets", icon: CandlestickChart, mobile: true },
  { to: "/signals", label: "Signals", icon: Radar, mobile: true },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/trade", label: "Trade", icon: LineChart, mobile: true },
  { to: "/autopilot", label: "Autopilot", icon: ShieldAlert },
  { to: "/strategies", label: "Strategies", icon: Compass },
  { to: "/advisor", label: "Advisor", icon: Bot, mobile: true },
  { to: "/journal", label: "Journal", icon: BookText },
  { to: "/connections", label: "Connections", icon: Plug },
];

// Simulated ticker symbols
const TICKER_SYMBOLS = [
  { symbol: "BTC/USD", base: 67420 },
  { symbol: "ETH/USD", base: 3480 },
  { symbol: "AAPL", base: 227.5 },
  { symbol: "NVDA", base: 875.2 },
  { symbol: "SPY", base: 541.8 },
  { symbol: "SOL/USD", base: 178.4 },
  { symbol: "TSLA", base: 248.9 },
  { symbol: "QQQ", base: 468.3 },
  { symbol: "MSFT", base: 415.6 },
  { symbol: "AVAX/USD", base: 38.72 },
  { symbol: "AMZN", base: 192.4 },
  { symbol: "META", base: 547.1 },
];

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function useTickerPrices() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const r = seededRand(tick * 7919 + 1234);
    return TICKER_SYMBOLS.map((s) => {
      const chgPct = (r() - 0.485) * 0.8;
      const price = s.base * (1 + chgPct / 100);
      return { ...s, price, chgPct };
    });
  }, [tick]);
}

function TickerTape() {
  const items = useTickerPrices();
  const doubled = [...items, ...items]; // infinite scroll trick

  return (
    <div className="overflow-hidden border-b border-border/60 bg-background/60 backdrop-blur">
      <div className="relative flex h-7 items-center">
        <div className="ticker-tape flex shrink-0 items-center gap-0">
          {doubled.map((s, i) => {
            const up = s.chgPct >= 0;
            return (
              <span
                key={`${s.symbol}-${i}`}
                className="flex shrink-0 items-center gap-1.5 border-r border-border/40 px-4 text-[11px]"
              >
                <span className="font-semibold text-foreground/80">{s.symbol}</span>
                <span
                  className={cn("num font-medium tabular-nums", up ? "text-bull" : "text-bear")}
                >
                  {s.price < 10
                    ? s.price.toFixed(3)
                    : s.price < 100
                      ? s.price.toFixed(2)
                      : s.price.toFixed(1)}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px]",
                    up ? "text-bull" : "text-bear",
                  )}
                >
                  {up ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {up ? "+" : ""}
                  {s.chgPct.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function NavItem({
  pathname,
  item,
  onNavigate,
}: {
  pathname: string;
  item: NavItemDef;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.to);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        active
          ? "bg-gold/12 text-gold-soft shadow-sm"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", active && "text-gold")} />
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-gold live-dot" />}
    </Link>
  );
}

function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="sticky top-0 hidden h-screen w-[13.5rem] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={logo} alt="Aurum Terminal" width={28} height={28} className="h-7 w-7" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold tracking-tight text-gold-soft">
            AURUM
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Terminal
          </p>
        </div>
      </div>
      <div className="gold-rule mx-4 h-px" />
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => (
          <NavItem key={item.to} pathname={pathname} item={item} />
        ))}
      </nav>
      <div className="p-3">
        <button
          onClick={() => void supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const tabs = NAV.filter((n) => n.mobile);
  const more = NAV.filter((n) => !n.mobile);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6">
          {tabs.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 pb-safe pb-3 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] transition-colors",
                  active ? "text-gold-soft" : "text-muted-foreground/70 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent" />
                )}
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    active && "text-gold drop-shadow-[0_0_6px_rgb(201_168_76_/_60%)]",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center gap-0.5 pb-3 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label="More"
              >
                <Menu className="h-5 w-5" />
                More
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="glass rounded-t-2xl border-t-0 pb-8 pt-3">
              <SheetTitle className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Everything else
              </SheetTitle>
              <div className="mt-3 grid grid-cols-1 gap-0.5">
                {more.map((item) => {
                  const active = isActive(pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                        active
                          ? "bg-gold/10 text-gold-soft"
                          : "text-foreground hover:bg-secondary/60",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          active ? "text-gold" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={() => void supabase.auth.signOut()}
                className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sign out
              </button>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Quick Trade FAB */}
      <Link
        to="/trade"
        search={{ symbol: undefined }}
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-background shadow-lg shadow-gold/30 transition-all hover:scale-105 hover:shadow-gold/50 active:scale-95 md:hidden"
        aria-label="Quick Trade"
      >
        <Zap className="h-5 w-5 fill-current" />
      </Link>
    </>
  );
}

function HeaderClock() {
  const fmt = () =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    }).format(new Date());
  const [now, setNow] = useState<string>(fmt);
  useEffect(() => {
    const id = window.setInterval(() => setNow(fmt()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="num hidden text-xs text-muted-foreground sm:inline">
      <span className="tabular-nums">{now}</span> <span className="text-gold/50">UTC</span>
    </span>
  );
}

function MarketStatus() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const utcH = now.getUTCHours();
      const utcM = now.getUTCMinutes();
      const utcDay = now.getUTCDay();
      const mins = utcH * 60 + utcM;
      const isWeekday = utcDay >= 1 && utcDay <= 5;
      setOpen(isWeekday && mins >= 870 && mins < 1260); // 14:30–21:00 UTC
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline-flex",
        open ? "border-bull/30 bg-bull/10 text-bull" : "border-gold/40 bg-gold/10 text-gold-soft",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", open ? "bg-bull live-dot" : "bg-gold live-dot")}
      />
      {open ? "US Open" : "Sim"}
    </span>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  noPad,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Ticker tape */}
        <TickerTape />

        {/* Header */}
        <header className="glass sticky top-0 z-20 border-b border-border/70">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logo}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 lg:hidden"
              />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <HeaderClock />
              <MarketStatus />
              {actions}
            </div>
          </div>
        </header>

        <WelcomeBanner />

        <main className={cn("min-w-0 flex-1", noPad ? "" : "p-3 pb-24 sm:p-5 md:pb-5")}>
          {children}
        </main>
      </div>

      <MobileTabs />
    </div>
  );
}

function WelcomeBanner() {
  const qc = useQueryClient();
  const { data } = useQuery<{ seeded: boolean } | null>({
    queryKey: ["onboarded"],
    queryFn: () => null,
  });
  const seeded = Boolean(data?.seeded);
  const [open, setOpen] = useState(seeded);
  useEffect(() => {
    if (seeded) setOpen(true);
  }, [seeded]);
  if (!open) return null;

  const ITEMS = [
    { icon: CircleDollarSign, label: "$100k funding per market" },
    { icon: ListPlus, label: "Default watchlist loaded" },
    { icon: ShieldCheck, label: "Risk caps armed" },
  ];

  return (
    <div className="border-b border-gold/20 bg-gradient-to-r from-gold/12 via-transparent to-transparent px-4 py-3 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-soft">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Welcome to live simulation</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Your paper accounts are funded — head to <span className="text-gold-soft">Trade</span>{" "}
            to place your first order. Everything you do is simulated and updates your portfolio in
            real time.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {ITEMS.map((i) => (
              <span
                key={i.label}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <i.icon className="h-3 w-3 text-gold-soft" />
                {i.label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            qc.setQueryData(["onboarded"], { seeded: false });
          }}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss welcome"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
