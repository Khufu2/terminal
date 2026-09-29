import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { useHoldings, useNews, useWatchlist } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "News — Aurum Terminal" },
      {
        name: "description",
        content: "Sentiment-scored market headlines mapped to your holdings and watchlist, feeding the signal engine.",
      },
      { property: "og:title", content: "News — Aurum Terminal" },
      { property: "og:description", content: "AI-scored headlines linked to the positions you actually hold." },
    ],
  }),
  component: Page,
});

function Page() {
  const news = useNews(60);
  const holdings = useHoldings();
  const watch = useWatchlist();
  const [filter, setFilter] = useState<"all" | "mine" | "bullish" | "bearish">("all");

  const owned = useMemo(
    () => new Set([...(holdings.data ?? []).map((h) => h.symbol), ...(watch.data ?? []).map((w) => w.symbol)]),
    [holdings.data, watch.data],
  );

  const items = (news.data ?? []).filter((n) => {
    const syms = (n.symbols ?? "").split(",").filter(Boolean);
    if (filter === "mine") return syms.some((s) => owned.has(s));
    if (filter === "bullish") return Number(n.sentiment) > 0.15;
    if (filter === "bearish") return Number(n.sentiment) < -0.15;
    return true;
  });

  const avg = items.length ? items.reduce((a, n) => a + Number(n.sentiment), 0) / items.length : 0;
  const highImpact = items.filter((n) => n.impact === "high").length;

  return (
    <AppShell title="News" subtitle="Headlines scored for sentiment and impact, wired into the signal engine">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Headlines" value={String(items.length)} />
            <Stat
              label="Net sentiment"
              value={avg.toFixed(2)}
              tone={avg > 0.05 ? "up" : avg < -0.05 ? "down" : "neutral"}
            />
            <Stat label="High impact" value={String(highImpact)} tone="gold" />
            <Stat label="Tracked symbols" value={String(owned.size)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(["all", "mine", "bullish", "bearish"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  filter === f ? "border-gold/50 bg-gold/10 text-gold-soft" : "border-border text-muted-foreground",
                )}
              >
                {f === "mine" ? "My symbols" : f}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-12" title="Feed">
          <ul className="divide-y divide-border/70">
            {items.map((n) => {
              const s = Number(n.sentiment);
              return (
                <li key={n.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={s > 0.15 ? "up" : s < -0.15 ? "down" : "neutral"}>
                      {s > 0 ? "+" : ""}
                      {s.toFixed(2)}
                    </Pill>
                    <Pill tone={n.impact === "high" ? "gold" : "neutral"}>{n.impact} impact</Pill>
                    {(n.symbols ?? "")
                      .split(",")
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((sym) => (
                        <span
                          key={sym}
                          className={cn(
                            "num rounded border px-1.5 py-0.5 text-[10px]",
                            owned.has(sym) ? "border-gold/40 text-gold-soft" : "border-border text-muted-foreground",
                          )}
                        >
                          {sym}
                        </span>
                      ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(n.published_at)}</span>
                  </div>
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 block text-sm font-medium hover:text-gold-soft"
                    >
                      {n.title}
                    </a>
                  ) : (
                    <p className="mt-1.5 text-sm font-medium">{n.title}</p>
                  )}
                  {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{n.source}</p>
                </li>
              );
            })}
            {!items.length && (
              <li className="py-6 text-sm text-muted-foreground">
                No headlines yet. Connect Alpaca and run the news job from Autopilot to start ingesting.
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
