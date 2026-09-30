import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookText,
  BrainCircuit,
  CandlestickChart,
  Compass,
  FlaskConical,
  LayoutGrid,
  LogOut,
  Menu,
  Plug,
  Search,
  Wallet,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  mobile?: boolean;
  emphasis?: boolean;
};

const NAV: NavItemDef[] = [
  { to: "/", label: "Home", icon: LayoutGrid, mobile: true },
  { to: "/portfolio", label: "Portfolio", icon: Wallet, mobile: true },
  { to: "/markets", label: "Explore", icon: Compass, mobile: true },
  { to: "/trade", label: "Trade", icon: CandlestickChart, mobile: true, emphasis: true },
  { to: "/research", label: "Research", icon: BrainCircuit, mobile: true },
  { to: "/labs", label: "Labs", icon: FlaskConical },
  { to: "/strategies", label: "Strategies", icon: Zap },
  { to: "/journal", label: "Activity", icon: BookText },
  { to: "/connections", label: "Connections", icon: Plug },
];

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-white text-[13px] font-black text-black shadow-sm">
        T
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold tracking-[-0.03em] text-foreground">Terminal</div>
        <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Research + trading</div>
      </div>
    </Link>
  );
}

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItemDef;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.to);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
        active
          ? "bg-white/[0.07] text-foreground"
          : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
      )}
    >
      <item.icon className={cn("h-[17px] w-[17px] shrink-0", active && "text-primary")} />
      <span>{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
    </Link>
  );
}

function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="sticky top-0 hidden h-screen w-[14rem] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="px-4 pb-5 pt-4"><Brand /></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((item) => <NavItem key={item.to} item={item} pathname={pathname} />)}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-white/[0.025] px-3 py-2.5">
          <div>
            <div className="text-[11px] font-semibold text-foreground">Paper mode</div>
            <div className="text-[9px] text-muted-foreground">No live orders by default</div>
          </div>
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
        </div>
        <button
          onClick={() => void supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-white/[0.045] hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const mobile = NAV.filter((n) => n.mobile);
  const more = NAV.filter((n) => !n.mobile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-6">
        {mobile.map((item) => {
          const active = isActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", item.emphasis && "bg-primary text-primary-foreground", active && !item.emphasis && "bg-white/[0.06]")}>
                <item.icon className={cn("h-[18px] w-[18px]", active && !item.emphasis && "text-primary")} />
              </span>
              {item.label}
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-medium text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center"><Menu className="h-[18px] w-[18px]" /></span>
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card pb-8">
            <SheetTitle className="mb-4 text-left text-sm">More</SheetTitle>
            <div className="grid gap-1">
              {more.map((item) => <NavItem key={item.to} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />)}
            </div>
            <button onClick={() => void supabase.auth.signOut()} className="mt-3 flex w-full items-center gap-3 rounded-xl border-t border-border px-3 py-3 text-sm text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
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
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
          <div className="flex h-[62px] items-center gap-3 px-4 sm:px-6">
            <div className="lg:hidden"><Brand /></div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
              {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/markets" className="hidden h-9 items-center gap-2 rounded-xl border border-border bg-white/[0.025] px-3 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex">
                <Search className="h-3.5 w-3.5" /> Search markets
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-primary sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> PAPER
              </span>
              {actions}
            </div>
          </div>
          <div className="border-t border-border/60 px-4 py-2 lg:hidden">
            <div className="text-[15px] font-semibold tracking-[-0.025em]">{title}</div>
            {subtitle && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{subtitle}</div>}
          </div>
        </header>
        <main className={cn("min-w-0 pb-20 lg:pb-0", noPad ? "" : "p-3 sm:p-5 lg:p-6")}>{children}</main>
      </div>
      <MobileTabs />
    </div>
  );
}
