import { useMemo, useState, useEffect, useRef, type MouseEvent } from "react";

import type { Candle } from "@/lib/market-data";
import { buildCandles, sma, rsi } from "@/lib/market-data";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 1200;
const H = 480;
const PAD_R = 72;
const PAD_B = 24;
const PAD_T = 8;

const TIMEFRAMES = [
  { id: "15m", label: "15m", count: 60, vol: 0.012 },
  { id: "1H", label: "1H", count: 80, vol: 0.015 },
  { id: "4H", label: "4H", count: 90, vol: 0.017 },
  { id: "1D", label: "1D", count: 120, vol: 0.02 },
  { id: "1W", label: "1W", count: 70, vol: 0.03 },
  { id: "1M", label: "1M", count: 40, vol: 0.05 },
] as const;

const INDICATORS = ["SMA", "BB", "RSI", "MACD", "VOL"] as const;
type Indicator = (typeof INDICATORS)[number];

function pseudoRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prevEma = values[0]!;
  out.push(prevEma);
  for (let i = 1; i < values.length; i++) {
    const cur = values[i]! * k + prevEma * (1 - k);
    out.push(cur);
    prevEma = cur;
  }
  for (let i = 0; i < Math.min(period - 1, values.length); i++) {
    out[i] = null;
  }
  return out;
}

function macd(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const e12 = ema12[i];
    const e26 = ema26[i];
    if (e12 == null || e26 == null) {
      macdLine.push(null);
    } else {
      macdLine.push(e12 - e26);
    }
  }
  const macdValid = macdLine.map((v) => v ?? 0);
  const signalLine = ema(macdValid, 9);
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] == null) {
      signalLine[i] = null;
    }
  }
  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const ml = macdLine[i];
    const sl = signalLine[i];
    if (ml == null || sl == null) {
      histogram.push(null);
    } else {
      histogram.push(ml - sl);
    }
  }
  return { macdLine, signalLine, histogram };
}

function bollingerBands(closes: number[], period = 20, multiplier = 2) {
  const smaVals = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const avg = smaVals[i];
    if (avg == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += Math.pow(closes[j]! - avg, 2);
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper.push(avg + multiplier * stdDev);
    lower.push(avg - multiplier * stdDev);
  }
  return { mid: smaVals, upper, lower };
}

export function TradingChart({ symbol, price }: { symbol: string; price: number }) {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[3]);
  const [hover, setHover] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(["SMA", "VOL"]));
  const [tick, setTick] = useState(0);
  const prevPriceRef = useRef(price);
  const [flashClass, setFlashClass] = useState("");

  // Live tick: update last candle every 3 seconds
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  // Flash on price direction change
  useEffect(() => {
    if (prevPriceRef.current !== price) {
      setFlashClass(price > prevPriceRef.current ? "price-up" : "price-down");
      const t = window.setTimeout(() => setFlashClass(""), 700);
      prevPriceRef.current = price;
      return () => window.clearTimeout(t);
    }
  }, [price]);

  const baseCandles = useMemo(
    () => buildCandles(`${symbol}${tf.id}`, price, tf.count, tf.vol),
    [symbol, tf, price],
  );

  // Apply live tick mutation to the last candle
  const candles = useMemo(() => {
    if (!baseCandles.length) return baseCandles;
    const r = pseudoRand(tick * 31337 + symbol.charCodeAt(0));
    const last = { ...baseCandles[baseCandles.length - 1]! };
    const delta = (r() - 0.495) * last.c * tf.vol * 0.4;
    last.c = Math.max(last.l, Math.min(last.h, last.c + delta));
    last.h = Math.max(last.h, last.c);
    last.l = Math.min(last.l, last.c);
    last.v = Math.round(last.v * (0.95 + r() * 0.1));
    return [...baseCandles.slice(0, -1), last];
  }, [baseCandles, tick, symbol, tf.vol]);

  const model = useMemo(() => {
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const pad = (hi - lo) * 0.07 || 1;
    const top = hi + pad;
    const bottom = lo - pad;

    const showVol = indicators.has("VOL");
    const showRsi = indicators.has("RSI");
    const showMacd = indicators.has("MACD");

    const volH = showVol ? 60 : 0;
    const rsiH = showRsi ? 60 : 0;
    const macdH = showMacd ? 60 : 0;
    const bottomH = volH + rsiH + macdH;

    const plotH = H - bottomH - PAD_B - PAD_T;
    const plotW = W - PAD_R;
    const step = plotW / candles.length;
    const y = (v: number) => PAD_T + ((top - v) / (top - bottom)) * plotH;
    const maxVol = Math.max(...candles.map((c) => c.v));
    const closes = candles.map((c) => c.c);

    // Indicator calculations
    const fast = sma(closes, 9);
    const slow = sma(closes, 30);
    const rsiVals = rsi(closes, 14);
    const bbVals = bollingerBands(closes, 20, 2);
    const macdVals = macd(closes);

    const line = (series: (number | null)[]) =>
      series
        .map((v, i) => (v == null ? null : `${i * step + step / 2},${y(v)}`))
        .filter(Boolean)
        .join(" ");

    const bbMid = line(bbVals.mid);
    const bbUpper = line(bbVals.upper);
    const bbLower = line(bbVals.lower);

    const gridVals = Array.from({ length: 6 }, (_, i) => bottom + ((top - bottom) * i) / 5);
    const timeRows = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      Math.min(candles.length - 1, Math.floor(f * (candles.length - 1))),
    );

    return {
      top,
      bottom,
      plotH,
      plotW,
      step,
      y,
      maxVol,
      volH,
      rsiH,
      macdH,
      bottomH,
      fast: line(fast),
      slow: line(slow),
      rsiVals,
      gridVals,
      timeRows,
      bbMid,
      bbUpper,
      bbLower,
      bbVals,
      macdVals,
    };
  }, [candles, indicators]);

  const last = candles[candles.length - 1] ?? candles[0]!;
  const active = hover != null ? candles[hover] : last;
  const prevClose = candles[candles.length - 2]?.c ?? last.c;
  const change = ((last.c - prevClose) / prevClose) * 100;
  const up = last.c >= last.o;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor(x / model.step);
    setHover(i >= 0 && i < candles.length ? i : null);
  }

  const hoverX = hover != null ? hover * model.step + model.step / 2 : null;
  const hoverY = hover != null ? model.y(candles[hover]!.c) : null;

  function toggleIndicator(ind: Indicator) {
    setIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  }

  const lastRsi = model.rsiVals.findLast((v) => v != null) ?? 50;

  return (
    <div className="flex h-full w-full flex-col bg-black">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-tight text-white">{symbol}</span>
          <span
            className={cn(
              "num text-lg font-semibold tabular-nums transition-colors",
              up ? "text-bull" : "text-bear",
              flashClass,
            )}
          >
            {usd(last.c, last.c < 5 ? 3 : 2)}
          </span>
          <span className={cn("num text-xs font-medium", change >= 0 ? "text-bull" : "text-bear")}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
          {/* Live dot */}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-bull" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Timeframes */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTf(t)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  tf.id === t.id ? "bg-gold text-black" : "text-muted-foreground hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
            {INDICATORS.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndicator(ind)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  indicators.has(ind)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-white",
                )}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OHLCV data strip */}
      {active && (
        <div className="num flex flex-wrap items-center gap-x-4 gap-y-0.5 border-b border-border/30 bg-background/20 px-3 py-1 text-[11px] text-muted-foreground">
          <span>
            {new Date(active.t).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>
            O <b className="text-foreground">{usd(active.o, active.o < 5 ? 3 : 2)}</b>
          </span>
          <span>
            H <b className="text-bull">{usd(active.h, active.h < 5 ? 3 : 2)}</b>
          </span>
          <span>
            L <b className="text-bear">{usd(active.l, active.l < 5 ? 3 : 2)}</b>
          </span>
          <span>
            C{" "}
            <b className={active.c >= active.o ? "text-bull" : "text-bear"}>
              {usd(active.c, active.c < 5 ? 3 : 2)}
            </b>
          </span>
          <span>
            Vol <b className="text-foreground">{num(active.v, 0)}</b>
          </span>
          {indicators.has("RSI") && (
            <span
              className={cn(
                "ml-2",
                (lastRsi as number) > 70
                  ? "text-bear"
                  : (lastRsi as number) < 30
                    ? "text-bull"
                    : "text-gold-soft",
              )}
            >
              RSI <b>{(lastRsi as number).toFixed(1)}</b>
              {(lastRsi as number) > 70 ? " OB" : (lastRsi as number) < 30 ? " OS" : ""}
            </span>
          )}
        </div>
      )}

      {/* Main chart SVG */}
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full cursor-crosshair"
          onMouseLeave={() => setHover(null)}
          onMouseMove={onMove}
        >
          {/* Grid */}
          {model.gridVals.map((v) => (
            <g key={`h${v}`}>
              <line
                x1={0}
                x2={model.plotW}
                y1={model.y(v)}
                y2={model.y(v)}
                stroke="#1c1c1c"
                strokeWidth={1}
              />
              <text x={model.plotW + 8} y={model.y(v) + 4} fill="#555" style={{ fontSize: 10 }}>
                {v >= 1000 ? num(v, 0) : num(v, 2)}
              </text>
            </g>
          ))}
          {/* Vertical grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
            const x = f * model.plotW;
            return (
              <line
                key={`v${i}`}
                x1={x}
                x2={x}
                y1={PAD_T}
                y2={H - model.bottomH - PAD_B}
                stroke="#151515"
                strokeWidth={1}
              />
            );
          })}
          {/* Time labels */}
          {model.timeRows.map((idx, i) => (
            <text
              key={`t${i}`}
              x={idx * model.step + model.step / 2}
              y={H - PAD_B + 16}
              fill="#555"
              textAnchor="middle"
              style={{ fontSize: 10 }}
            >
              {new Date(candles[idx]!.t).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </text>
          ))}

          {/* Candles */}
          {candles.map((c, i) => {
            const x = i * model.step + model.step / 2;
            const isUp = c.c >= c.o;
            const bw = Math.max(1.5, model.step * 0.65);
            const bodyTop = model.y(Math.max(c.o, c.c));
            const bodyH = Math.max(1.2, Math.abs(model.y(c.o) - model.y(c.c)));
            const isLast = i === candles.length - 1;
            return (
              <g key={c.t}>
                <line
                  x1={x}
                  x2={x}
                  y1={model.y(c.h)}
                  y2={model.y(c.l)}
                  stroke={isUp ? "#22c55e" : "#ef4444"}
                  strokeWidth={isLast ? 1.5 : 1}
                />
                <rect
                  x={x - bw / 2}
                  y={bodyTop}
                  width={bw}
                  height={bodyH}
                  fill={isUp ? "#22c55e" : "#ef4444"}
                  opacity={isLast ? 1 : 0.9}
                />
                {/* Volume */}
                {indicators.has("VOL") && (
                  <rect
                    x={x - bw / 2}
                    y={
                      H - PAD_B - model.macdH - model.rsiH - (c.v / model.maxVol) * (model.volH - 8)
                    }
                    width={bw}
                    height={(c.v / model.maxVol) * (model.volH - 8)}
                    fill={isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}
                  />
                )}
              </g>
            );
          })}

          {/* SMA Indicators */}
          {indicators.has("SMA") && (
            <>
              <polyline points={model.fast} fill="none" stroke="#f59e0b" strokeWidth={1.4} />
              <polyline
                points={model.slow}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.8}
              />
            </>
          )}

          {/* Bollinger Bands */}
          {indicators.has("BB") && model.bbUpper && model.bbLower && (
            <g>
              <polyline
                points={model.bbUpper}
                fill="none"
                stroke="rgba(201, 168, 76, 0.4)"
                strokeWidth={1}
              />
              <polyline
                points={model.bbLower}
                fill="none"
                stroke="rgba(201, 168, 76, 0.4)"
                strokeWidth={1}
              />
              <polyline
                points={model.bbMid}
                fill="none"
                stroke="rgba(201, 168, 76, 0.2)"
                strokeWidth={0.8}
                strokeDasharray="3 3"
              />
              {(() => {
                const upperPts = model.bbVals.upper
                  .map((v, i) => (v == null ? null : [i * model.step + model.step / 2, model.y(v)]))
                  .filter((p): p is [number, number] => p !== null);
                const lowerPts = model.bbVals.lower
                  .map((v, i) => (v == null ? null : [i * model.step + model.step / 2, model.y(v)]))
                  .filter((p): p is [number, number] => p !== null)
                  .reverse();
                if (upperPts.length === 0 || lowerPts.length === 0) return null;
                const pointsStr = [...upperPts, ...lowerPts]
                  .map(([px, py]) => `${px},${py}`)
                  .join(" ");
                return <polygon points={pointsStr} fill="rgba(201, 168, 76, 0.03)" stroke="none" />;
              })()}
            </g>
          )}

          {/* Current price line */}
          <line
            x1={0}
            x2={model.plotW}
            y1={model.y(last.c)}
            y2={model.y(last.c)}
            stroke="#3f3f3f"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <rect
            x={model.plotW + 2}
            y={model.y(last.c) - 9}
            width={PAD_R - 4}
            height={18}
            fill={up ? "#22c55e" : "#ef4444"}
            rx={3}
          />
          <text
            x={model.plotW + PAD_R - 8}
            y={model.y(last.c) + 4}
            fill="#000"
            textAnchor="end"
            style={{ fontSize: 11, fontWeight: 700 }}
          >
            {num(last.c, last.c < 5 ? 3 : 2)}
          </text>

          {/* Crosshair */}
          {hoverX != null && hoverY != null && (
            <g>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={PAD_T}
                y2={H - model.bottomH - PAD_B}
                stroke="#555"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                x2={model.plotW}
                y1={hoverY}
                y2={hoverY}
                stroke="#555"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </g>
          )}

          {/* RSI sub-panel */}
          {indicators.has("RSI") &&
            model.rsiVals.length > 0 &&
            (() => {
              const rsiTop = H - model.macdH - model.rsiH - PAD_B;
              const rsiH = 50;
              const rsiY = (v: number) => rsiTop + ((100 - v) / 100) * rsiH;
              const rsiPoints = model.rsiVals
                .map((v, i) => (v == null ? null : `${i * model.step + model.step / 2},${rsiY(v)}`))
                .filter(Boolean)
                .join(" ");
              return (
                <g>
                  <line
                    x1={0}
                    x2={model.plotW}
                    y1={rsiTop}
                    y2={rsiTop}
                    stroke="#222"
                    strokeWidth={1}
                  />
                  <line
                    x1={0}
                    x2={model.plotW}
                    y1={rsiY(70)}
                    y2={rsiY(70)}
                    stroke="#ef444430"
                    strokeWidth={0.8}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={0}
                    x2={model.plotW}
                    y1={rsiY(30)}
                    y2={rsiY(30)}
                    stroke="#22c55e30"
                    strokeWidth={0.8}
                    strokeDasharray="3 2"
                  />
                  <polyline points={rsiPoints} fill="none" stroke="#a855f7" strokeWidth={1.2} />
                  <text x={model.plotW + 4} y={rsiTop + 10} fill="#555" style={{ fontSize: 9 }}>
                    RSI
                  </text>
                </g>
              );
            })()}

          {/* MACD sub-panel */}
          {indicators.has("MACD") &&
            model.macdVals &&
            (() => {
              const macdTop = H - model.macdH - PAD_B;
              const macdH = 50;
              const lineData = model.macdVals.macdLine;
              const sigData = model.macdVals.signalLine;
              const histData = model.macdVals.histogram;

              const vals = [...lineData, ...sigData, ...histData].filter(
                (v): v is number => v !== null,
              );
              const maxVal = vals.length > 0 ? Math.max(...vals.map(Math.abs)) * 1.15 : 1;

              const macdY = (v: number) => macdTop + macdH / 2 - (v / maxVal) * (macdH / 2);

              const macdLinePoints = lineData
                .map((v, i) =>
                  v == null ? null : `${i * model.step + model.step / 2},${macdY(v)}`,
                )
                .filter(Boolean)
                .join(" ");

              const signalLinePoints = sigData
                .map((v, i) =>
                  v == null ? null : `${i * model.step + model.step / 2},${macdY(v)}`,
                )
                .filter(Boolean)
                .join(" ");

              return (
                <g>
                  <line
                    x1={0}
                    x2={model.plotW}
                    y1={macdTop}
                    y2={macdTop}
                    stroke="#222"
                    strokeWidth={1}
                  />
                  <line
                    x1={0}
                    x2={model.plotW}
                    y1={macdY(0)}
                    y2={macdY(0)}
                    stroke="#44444430"
                    strokeWidth={0.8}
                  />

                  {/* Histogram bars */}
                  {histData.map((v, i) => {
                    if (v == null) return null;
                    const x = i * model.step + model.step / 2;
                    const yZero = macdY(0);
                    const yVal = macdY(v);
                    const bw = Math.max(1, model.step * 0.5);
                    const color = v >= 0 ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
                    return (
                      <rect
                        key={`h-${i}`}
                        x={x - bw / 2}
                        y={v >= 0 ? yVal : yZero}
                        width={bw}
                        height={Math.max(1, Math.abs(yVal - yZero))}
                        fill={color}
                      />
                    );
                  })}

                  {/* MACD Line */}
                  <polyline
                    points={macdLinePoints}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={1.2}
                  />
                  {/* Signal Line */}
                  <polyline
                    points={signalLinePoints}
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth={1.2}
                  />

                  <text x={model.plotW + 4} y={macdTop + 10} fill="#555" style={{ fontSize: 9 }}>
                    MACD
                  </text>
                </g>
              );
            })()}
        </svg>

        {/* Legend */}
        <div className="num pointer-events-none absolute right-20 top-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          {indicators.has("SMA") && (
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3 rounded-full bg-amber-500" /> SMA9/30
            </span>
          )}
          {indicators.has("BB") && (
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3 rounded-full bg-yellow-600/60" /> BB(20,2)
            </span>
          )}
          {indicators.has("MACD") && (
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3 rounded-full bg-blue-600" /> MACD(12,26,9)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
