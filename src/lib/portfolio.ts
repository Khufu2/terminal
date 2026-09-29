import { useMemo } from "react";
import { useAccounts, useFinanceEntries, useHoldings, useSnapshots } from "@/lib/db";

export function usePortfolio() {
  const accounts = useAccounts();
  const holdings = useHoldings();
  const snapshots = useSnapshots();
  const finance = useFinanceEntries();

  return useMemo(() => {
    const acc = accounts.data ?? [];
    const hold = holdings.data ?? [];
    const snaps = snapshots.data ?? [];
    const fin = finance.data ?? [];

    const marketValue = hold.reduce((s, h) => s + h.quantity * h.last_price, 0);
    const costBasis = hold.reduce((s, h) => s + h.quantity * h.avg_cost, 0);
    const cash = acc.reduce((s, a) => s + Number(a.balance_usd), 0);
    const netWorth = marketValue + cash;
    const unrealized = marketValue - costBasis;

    const byMarket = new Map<string, number>();
    for (const h of hold) byMarket.set(h.market, (byMarket.get(h.market) ?? 0) + h.quantity * h.last_price);
    byMarket.set("cash", cash);

    const allocation = [...byMarket.entries()]
      .filter(([, v]) => v > 0)
      .map(([market, value]) => ({
        market,
        value,
        weight: netWorth ? value / netWorth : 0,
        target: Number(acc.find((a) => a.market === market)?.target_weight ?? 0),
      }))
      .sort((a, b) => b.value - a.value);

    // equity curve: sum markets per day
    const byDay = new Map<string, number>();
    for (const s of snaps) {
      const day = s.snapshot_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(s.equity_usd));
    }
    const curve = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, equity]) => ({ date, equity: Math.round(equity) }));

    const last = curve.at(-1)?.equity ?? netWorth;
    const prev = curve.at(-2)?.equity ?? last;
    const weekAgo = curve.at(-8)?.equity ?? last;
    const dayChange = last - prev;
    const dayChangePct = prev ? dayChange / prev : 0;
    const weekChangePct = weekAgo ? (last - weekAgo) / weekAgo : 0;
    const peak = curve.reduce((m, p) => Math.max(m, p.equity), 0);
    const drawdown = peak ? (last - peak) / peak : 0;

    const movers = hold
      .map((h) => ({
        ...h,
        pnl: (h.last_price - h.avg_cost) * h.quantity,
        pnlPct: h.avg_cost ? (h.last_price - h.avg_cost) / h.avg_cost : 0,
      }))
      .sort((a, b) => Math.abs(b.pnlPct) - Math.abs(a.pnlPct));

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = fin.filter((f) => f.entry_date.startsWith(monthKey));
    const income = thisMonth.filter((f) => f.kind === "income").reduce((s, f) => s + Number(f.amount), 0);
    const expenses = thisMonth.filter((f) => f.kind === "expense").reduce((s, f) => s + Number(f.amount), 0);
    const invested = thisMonth
      .filter((f) => f.kind === "expense" && f.category === "investing")
      .reduce((s, f) => s + Number(f.amount), 0);

    return {
      loading: accounts.isLoading || holdings.isLoading || snapshots.isLoading,
      accounts: acc,
      holdings: hold,
      netWorth,
      marketValue,
      costBasis,
      cash,
      unrealized,
      unrealizedPct: costBasis ? unrealized / costBasis : 0,
      allocation,
      curve,
      dayChange,
      dayChangePct,
      weekChangePct,
      drawdown,
      movers,
      income,
      expenses,
      invested,
      savingsRate: income ? (income - expenses) / income : 0,
    };
  }, [accounts.data, holdings.data, snapshots.data, finance.data, accounts.isLoading, holdings.isLoading, snapshots.isLoading]);
}