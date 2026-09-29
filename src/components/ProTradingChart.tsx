import { useMemo, useState, type PointerEvent } from "react";
import type { Candle } from "@/lib/market-data";
import { sma } from "@/lib/market-data";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 1200;
const H = 520;
const PAD_R = 72;
const PAD_T = 26;
const PAD_B = 28;
const VOL_H = 84;

type Indicator = "SMA20" | "SMA50" | "EMA20" | "BB" | "VOL";

function ema(values: number[], period: number) {
  const out: Array<number | null> = [];
  if (!values.length) return out;
  const k = 2 / (period + 1);
  let prev = values[0]!;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i]! : values[i]! * k + prev * (1 - k);
    out.push(i >= period - 1 ? prev : null);
  }
  return out;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    const avg = mid[i];
    if (avg == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += Math.pow(values[j]! - avg, 2);
    const sd = Math.sqrt(sum / period);
    upper.push(avg + mult * sd);
    lower.push(avg - mult * sd);
  }
  return { mid, upper, lower };
}

function formatTime(ts: number, dense = false) {
  const d = new Date(ts);
  return dense
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProTradingChart({
  candles,
  heightClass = "h-[24rem] sm:h-[31rem]",
}: {
  candles: Candle[];
  heightClass?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(["SMA20", "VOL"]));

  const model = useMemo(() => {
    if (!candles.length) return null;
    const closes = candles.map((c) => c.c);
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const pad = (hi - lo) * 0.075 || Math.max(hi * 0.01, 1);
    const top = hi + pad;
    const bottom = lo - pad;
    const showVol = indicators.has("VOL");
    const volumeH = showVol ? VOL_H : 0;
    const plotH = H - PAD_T - PAD_B - volumeH;
    const plotW = W - PAD_R;
    const step = plotW / candles.length;
    const y = (v: number) => PAD_T + ((top - v) / (top - bottom)) * plotH;
    const maxVol = Math.max(1, ...candles.map((c) => c.v));
    const s20 = sma(closes, 20);
    const s50 = sma(closes, 50);
    const e20 = ema(closes, 20);
    const bb = bollinger(closes, 20, 2);
    const line = (series: Array<number | null>) =>
      series
        .map((v, i) => (v == null ? null : `${i * step + step / 2},${y(v)}`))
        .filter(Boolean)
        .join(" ");
    const grid = Array.from({ length: 6 }, (_, i) => bottom + ((top - bottom) * i) / 5);
    const times = [0, .2, .4, .6, .8, 1].map((f) =>
      Math.min(candles.length - 1, Math.floor((candles.length - 1) * f)),
    );
    return {
      top,
      bottom,
      plotH,
      plotW,
      step,
      y,
      maxVol,
      volumeH,
      grid,
      times,
      sma20: line(s20),
      sma50: line(s50),
      ema20: line(e20),
      bbUpper: line(bb.upper),
      bbLower: line(bb.lower),
    };
  }, [candles, indicators]);

  if (!model || !candles.length) {
    return <div className={cn("flex items-center justify-center text-xs text-muted-foreground", heightClass)}>No chart data.</div>;
  }

  const idx = hover ?? candles.length - 1;
  const active = candles[idx]!;
  const previous = candles[Math.max(0, idx - 1)]!;
  const activeChange = previous.c ? active.c / previous.c - 1 : 0;
  const last = candles[candles.length - 1]!;
  const hoverX = idx * model.step + model.step / 2;
  const hoverY = model.y(active.c);
  const isIntraday = candles.length > 2 && candles[candles.length - 1]!.t - candles[0]!.t < 14 * 86400000;

  function toggle(ind: Indicator) {
    setIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(candles.length - 1, Math.floor(x / model.step)));
    setHover(i);
  }

  return (
    <div className="relative w-full overflow-hidden bg-background/20">
      <div className="flex min-h-9 items-center gap-x-3 gap-y-1 overflow-x-auto border-b border-border/60 px-2 py-1.5 text-[10px]">
        <span className="shrink-0 font-semibold text-foreground">{formatTime(active.t, isIntraday)}</span>
        <span className="num shrink-0 text-muted-foreground">O {usd(active.o, active.o < 5 ? 4 : 2)}</span>
        <span className="num shrink-0 text-muted-foreground">H {usd(active.h, active.h < 5 ? 4 : 2)}</span>
        <span className="num shrink-0 text-muted-foreground">L {usd(active.l, active.l < 5 ? 4 : 2)}</span>
        <span className={cn("num shrink-0 font-semibold", active.c >= active.o ? "text-bull" : "text-bear")}>C {usd(active.c, active.c < 5 ? 4 : 2)}</span>
        <span className={cn("num shrink-0", activeChange >= 0 ? "text-bull" : "text-bear")}>
          {activeChange >= 0 ? "+" : ""}{(activeChange * 100).toFixed(2)}%
        </span>
        <span className="num shrink-0 text-muted-foreground">V {num(active.v, 0)}</span>
        <div className="ml-auto flex shrink-0 gap-1 pl-3">
          {(["SMA20", "SMA50", "EMA20", "BB", "VOL"] as Indicator[]).map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => toggle(ind)}
              className={cn(
                "rounded px-1.5 py-1 font-medium transition-colors",
                indicators.has(ind) ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      <div className={heightClass}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full touch-none"
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
        >
          {model.grid.map((v) => (
            <g key={v}>
              <line x1={0} x2={model.plotW} y1={model.y(v)} y2={model.y(v)} stroke="var(--border)" strokeWidth={0.7} />
              <text x={model.plotW + 8} y={model.y(v) + 4} fill="var(--muted-foreground)" style={{ fontSize: 10 }}>
                {v >= 1000 ? v.toFixed(0) : v < 5 ? v.toFixed(3) : v.toFixed(2)}
              </text>
            </g>
          ))}

          {model.times.map((i) => {
            const x = i * model.step + model.step / 2;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={PAD_T} y2={PAD_T + model.plotH} stroke="var(--border)" strokeWidth={0.45} opacity={0.45} />
                <text x={Math.min(model.plotW - 60, Math.max(3, x - 22))} y={H - 7} fill="var(--muted-foreground)" style={{ fontSize: 9 }}>
                  {formatTime(candles[i]!.t, isIntraday)}
                </text>
              </g>
            );
          })}

          {candles.map((c, i) => {
            const x = i * model.step + model.step / 2;
            const up = c.c >= c.o;
            const bodyTop = model.y(Math.max(c.o, c.c));
            const bodyH = Math.max(1, Math.abs(model.y(c.o) - model.y(c.c)));
            const width = Math.max(1.2, Math.min(10, model.step * 0.62));
            const color = up ? "var(--bull)" : "var(--bear)";
            return (
              <g key={c.t}>
                <line x1={x} x2={x} y1={model.y(c.h)} y2={model.y(c.l)} stroke={color} strokeWidth={1} />
                <rect x={x - width / 2} y={bodyTop} width={width} height={bodyH} fill={color} rx={0.4} />
                {indicators.has("VOL") && (
                  <rect
                    x={x - width / 2}
                    y={H - PAD_B - (c.v / model.maxVol) * (VOL_H - 10)}
                    width={width}
                    height={(c.v / model.maxVol) * (VOL_H - 10)}
                    fill={color}
                    opacity={0.28}
                  />
                )}
              </g>
            );
          })}

          {indicators.has("BB") && (
            <>
              <polyline points={model.bbUpper} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} strokeDasharray="4 4" />
              <polyline points={model.bbLower} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} strokeDasharray="4 4" />
            </>
          )}
          {indicators.has("SMA20") && <polyline points={model.sma20} fill="none" stroke="var(--primary)" strokeWidth={1.4} opacity={0.9} />}
          {indicators.has("SMA50") && <polyline points={model.sma50} fill="none" stroke="var(--gold-soft)" strokeWidth={1.2} opacity={0.75} />}
          {indicators.has("EMA20") && <polyline points={model.ema20} fill="none" stroke="var(--foreground)" strokeWidth={1.1} opacity={0.65} />}

          <line
            x1={0}
            x2={model.plotW}
            y1={model.y(last.c)}
            y2={model.y(last.c)}
            stroke="var(--primary)"
            strokeWidth={0.8}
            strokeDasharray="4 4"
            opacity={0.75}
          />
          <rect x={model.plotW + 2} y={model.y(last.c) - 9} width={68} height={18} rx={4} fill="var(--primary)" />
          <text x={model.plotW + 36} y={model.y(last.c) + 4} textAnchor="middle" fill="var(--primary-foreground)" style={{ fontSize: 9, fontWeight: 700 }}>
            {last.c < 5 ? last.c.toFixed(4) : last.c.toFixed(2)}
          </text>

          {hover != null && (
            <>
              <line x1={hoverX} x2={hoverX} y1={PAD_T} y2={H - PAD_B} stroke="var(--muted-foreground)" strokeWidth={0.75} strokeDasharray="3 3" />
              <line x1={0} x2={model.plotW} y1={hoverY} y2={hoverY} stroke="var(--muted-foreground)" strokeWidth={0.75} strokeDasharray="3 3" />
              <circle cx={hoverX} cy={hoverY} r={3.5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.2} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
