import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, Stat } from "@/components/Panel";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceEntries, useTableMutation } from "@/lib/db";
import { pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finances")({
  head: () => ({
    meta: [
      { title: "Finances — Aurum Terminal" },
      {
        name: "description",
        content: "Record income, expenses and investment contributions, and track savings rate month by month.",
      },
      { property: "og:title", content: "Finances — Aurum Terminal" },
      { property: "og:description", content: "Personal cashflow, savings rate and capital deployed to markets." },
    ],
  }),
  component: Finances,
});

const CATEGORIES = ["salary", "business", "dividends", "housing", "living", "investing", "fees", "other"];

function Finances() {
  const entries = useFinanceEntries();
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("salary");
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const add = useTableMutation<{
    kind: string;
    label: string;
    amount: number;
    category: string;
    recurring: boolean;
    entry_date: string;
  }>(
    "finance_entries",
    async (vars) => {
      const { data: auth } = await supabase.auth.getUser();
      return supabase.from("finance_entries").insert({ ...vars, user_id: auth.user!.id });
    },
    ["finance_entries"],
  );

  const remove = useTableMutation<string>(
    "finance_entries",
    (id) => supabase.from("finance_entries").delete().eq("id", id),
    ["finance_entries"],
  );

  const data = entries.data ?? [];

  const months = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    for (const e of data) {
      const key = e.entry_date.slice(0, 7);
      const row = map.get(key) ?? { month: key, income: 0, expense: 0 };
      if (e.kind === "income") row.income += Number(e.amount);
      else row.expense += Number(e.amount);
      map.set(key, row);
    }
    return [...map.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-8)
      .map((m) => ({ ...m, net: m.income - m.expense }));
  }, [data]);

  const totals = useMemo(() => {
    const income = data.filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
    const expense = data.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
    const invested = data
      .filter((e) => e.category === "investing")
      .reduce((s, e) => s + Number(e.amount), 0);
    const recurringOut = data
      .filter((e) => e.kind === "expense" && e.recurring)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { income, expense, invested, recurringOut, net: income - expense };
  }, [data]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data.filter((x) => x.kind === "expense"))
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!label.trim() || !Number.isFinite(value) || value <= 0) {
      toast.error("Add a label and a positive amount.");
      return;
    }
    add.mutate(
      { kind, label: label.trim(), amount: value, category, recurring, entry_date: date },
      {
        onSuccess: () => {
          toast.success("Entry recorded");
          setLabel("");
          setAmount("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <AppShell title="Finances" subtitle="Cashflow discipline is where investing returns come from">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-12" title="Cashflow summary" subtitle="All recorded entries">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Income" value={usd(totals.income)} tone="up" />
            <Stat label="Expenses" value={usd(totals.expense)} tone="down" />
            <Stat
              label="Net"
              value={`${totals.net >= 0 ? "+" : ""}${usd(totals.net)}`}
              tone={totals.net >= 0 ? "up" : "down"}
            />
            <Stat
              label="Savings rate"
              value={pct(totals.income ? totals.net / totals.income : 0, 0)}
              tone="gold"
            />
            <Stat label="Deployed to markets" value={usd(totals.invested)} hint="Category: investing" />
          </div>
        </Panel>

        <Panel className="lg:col-span-8" title="Monthly cashflow" subtitle="Income vs expenses">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number, n: string) => [usd(v), n]}
                />
                <Bar dataKey="income" fill="var(--bull)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="var(--bear)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="lg:col-span-4" title="Record entry" subtitle="Income, expense or contribution">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1">
              {(["income", "expense"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setCategory(k === "income" ? "salary" : "living");
                  }}
                  className={cn(
                    "rounded py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                    kind === k
                      ? k === "income"
                        ? "bg-bull/20 text-bull"
                        : "bg-bear/20 text-bear"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Field label="Label">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Consulting retainer"
                className="input-base"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (USD)">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="1200"
                  className="input-base num"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-base num"
                />
              </Field>
            </div>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="accent-[var(--gold)]"
              />
              Recurring every month
            </label>
            <button
              type="submit"
              disabled={add.isPending}
              className="w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {add.isPending ? "Saving…" : "Add entry"}
            </button>
          </form>
        </Panel>

        <Panel className="lg:col-span-4" title="Spend by category">
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{c.name}</span>
                    <span className="num">{usd(c.value)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${(c.value / (byCategory[0]?.value || 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Recurring commitments: <span className="num text-foreground">{usd(totals.recurringOut)}</span> / month
          </p>
        </Panel>

        <Panel className="lg:col-span-8" title="Ledger" subtitle={`${data.length} entries`} bodyClassName="px-0 pb-3">
          <div className="max-h-[24rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <p className="font-medium">{e.label}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {e.category} · {e.entry_date}
                        {e.recurring ? " · recurring" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn("num", e.kind === "income" ? "text-bull" : "text-bear")}>
                        {e.kind === "income" ? "+" : "−"}
                        {usd(e.amount)}
                      </span>
                    </td>
                    <td className="w-10 px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove.mutate(e.id)}
                        className="text-xs text-muted-foreground transition-colors hover:text-bear"
                        aria-label={`Delete ${e.label}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-xs text-muted-foreground">
                      Nothing recorded yet — add your first entry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
