import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { Panel, Pill, Stat } from "@/components/Panel";
import { useSignals, useStrategies } from "@/lib/db";
import { MARKET_LABEL, num, pct, timeAgo, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Signals — Aurum Terminal" },
      {
        name: "description",
        content:
          "Ranked AI and orchestrator signals with confidence, sentiment, entry, target and stop levels.",
      },
      { property: "og:title", content: "Signals — Aurum Terminal" },
      {
        property: "og:description",
        content: "Know what to act on: conviction-ranked signals across every market.",
      },
    ],
  }),
  component: Signals,
});

function RadialConfidence({ confidence, direction }: { confidence: number; direction: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = circ * confidence;
  const color =
    direction === "long" ? "var(--bull)" : direction === "short" ? "var(--bear)" : "var(--gold)";
  const pct = Math.round(confidence * 100);

  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
        <circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ * 0.25}
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
            transition: "stroke-dasharray 0.8s ease",
          }}
        />
        <text
          x={36}
          y={38}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          className="fill-foreground"
          style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}
        >
          {pct}%
        </text>
      </svg>
    </div>
  );
}

function Signals() {
  const signals = useSignals(80);
  const strategies = useStrategies();
  const [market, setMarket] = useState("all");
  const [minConf, setMinConf] = useState(0);
  const [direction, setDirection] = useState("all");

  const active = (strategies.data ?? []).find((s) => s.is_active);
  const data = signals.data ?? [];

  const filtered = useMemo(
    () =>
      data
        .filter((s) => market === "all" || s.market === market)
        .filter((s) => direction === "all" || s.direction === direction)
        .filter((s) => Number(s.confidence) >= minConf)
        .sort((a, b) => Number(b.confidence) - Number(a.confidence)),
    [data, market, direction, minConf],
  );

  const avgConf = data.length
    ? data.reduce((s, x) => s + Number(x.confidence), 0) / data.length
    : 0;
  const netSentiment = data.length
    ? data.reduce((s, x) => s + Number(x.sentiment), 0) / data.length
    : 0;
  const markets = ["all", ...new Set(data.map((s) => s.market))];
  const longCount = data.filter((s) => s.direction === "long").length;
  const shortCount = data.filter((s) => s.direction === "short").length;

  return (
    <AppShell
      title="Signals"
      subtitle="Conviction-ranked ideas from the orchestrator and AI models"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Stats bar */}
        <Panel className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Open signals" value={String(data.length)} tone="gold" />
            <Stat label="Average confidence" value={pct(avgConf, 0, false)} />
            <Stat
              label="Net sentiment"
              value={netSentiment.toFixed(2)}
              tone={netSentiment >= 0 ? "up" : "down"}
              hint="-1 bearish · +1 bullish"
            />
            <Stat
              label="Active strategy gate"
              value={active ? pct(Number(active.min_confidence), 0, false) : "—"}
              hint={active?.name ?? "No active strategy"}
            />
          </div>

          {/* Bull/Bear ratio bar */}
          {data.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="text-bull">▲ Long {longCount}</span>
                <span className="text-bear">Short {shortCount} ▼</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-bear/20">
                <div
                  className="h-full bg-bull transition-all"
                  style={{ width: `${(longCount / Math.max(data.length, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </Panel>

        {/* Filters */}
        <Panel className="lg:col-span-12" bodyClassName="px-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <Group label="Market">
              {markets.map((m) => (
                <Chip key={m} active={market === m} onClick={() => setMarket(m)}>
                  {m === "all" ? "All" : (MARKET_LABEL[m] ?? m)}
                </Chip>
              ))}
            </Group>
            <Group label="Direction">
              {["all", "long", "short", "flat"].map((d) => (
                <Chip key={d} active={direction === d} onClick={() => setDirection(d)}>
                  {d}
                </Chip>
              ))}
            </Group>
            <Group label={`Min confidence ${Math.round(minConf * 100)}%`}>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={minConf}
                onChange={(e) => setMinConf(Number(e.target.value))}
                className="w-36 accent-[var(--gold)]"
              />
            </Group>
          </div>
        </Panel>

        {/* Signal cards */}
        {filtered.map((s) => {
          const long = s.direction === "long";
          const short = s.direction === "short";
          const rr =
            s.entry_price && s.target_price && s.stop_price
              ? Math.abs(
                  (Number(s.target_price) - Number(s.entry_price)) /
                    (Number(s.entry_price) - Number(s.stop_price) || 1),
                )
              : null;
          const confidence = Number(s.confidence);
          const glowClass = long ? "glow-bull" : short ? "glow-bear" : "glow-gold";

          return (
            <div
              key={s.id}
              className={cn("panel lg:col-span-4 transition-all hover:scale-[1.01]", glowClass)}
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{s.symbol}</h3>
                    <Pill tone={long ? "up" : short ? "down" : "neutral"}>{s.direction}</Pill>
                  </div>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {MARKET_LABEL[s.market] ?? s.market} · {s.source} · {timeAgo(s.created_at)}
                  </p>
                </div>
                <RadialConfidence confidence={confidence} direction={s.direction} />
              </div>

              <div className="px-4 pb-4">
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {s.ai_reason}
                </p>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Level label="Entry" value={s.entry_price} />
                  <Level label="Target" value={s.target_price} tone="up" />
                  <Level label="Stop" value={s.stop_price} tone="down" />
                </dl>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {rr ? `R:R ${rr.toFixed(2)}x` : "No levels"} · sent{" "}
                    {Number(s.sentiment).toFixed(2)}
                  </span>
                  <Link
                    to="/trade"
                    search={{ symbol: s.symbol }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all hover:opacity-90",
                      long
                        ? "border-bull/40 bg-bull/10 text-bull"
                        : short
                          ? "border-bear/40 bg-bear/10 text-bear"
                          : "border-gold/40 bg-gold/10 text-gold-soft",
                    )}
                  >
                    Trade →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Panel className="lg:col-span-12">
            <p className="py-8 text-center text-xs text-muted-foreground">
              No signals match these filters. Run the signal engine from Autopilot to generate some.
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] capitalize transition-all",
        active
          ? "bg-gold text-background shadow-sm shadow-gold/20"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Level({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-border/50 py-2">
      <dt className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "num mt-0.5 text-xs font-semibold",
          tone === "up" && "text-bull",
          tone === "down" && "text-bear",
        )}
      >
        {value == null ? "—" : usd(Number(value), Number(value) < 5 ? 3 : 2)}
      </dd>
    </div>
  );
}
