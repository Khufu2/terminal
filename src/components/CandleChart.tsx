import { useMemo, useState } from "react";

import type { Candle } from "@/lib/market-data";
import { sma } from "@/lib/market-data";
import { num, usd } from "@/lib/format";

const W = 1000;
const H = 340;
const VOL_H = 60;
const PAD_R = 62;
const PAD_B = 18;

export function CandleChart({ candles }: { candles: Candle[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const closes = candles.map((c) => c.c);
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const pad = (hi - lo) * 0.08 || 1;
    const top = hi + pad;
    const bottom = lo - pad;
    const plotH = H - VOL_H - PAD_B;
    const plotW = W - PAD_R;
    const step = plotW / candles.length;
    const y = (v: number) => ((top - v) / (top - bottom)) * plotH;
    const maxVol = Math.max(...candles.map((c) => c.v));
    const fast = sma(closes, 9);
    const slow = sma(closes, 30);
    const line = (series: (number | null)[]) =>
      series
        .map((v, i) => (v == null ? null : `${i * step + step / 2},${y(v)}`))
        .filter(Boolean)
        .join(" ");
    const gridVals = Array.from({ length: 5 }, (_, i) => bottom + ((top - bottom) * i) / 4);
    return { top, bottom, plotH, plotW, step, y, maxVol, fast: line(fast), slow: line(slow), gridVals };
  }, [candles]);

  const active = hover != null ? candles[hover] : candles[candles.length - 1];

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.floor(x / model.step);
          setHover(i >= 0 && i < candles.length ? i : null);
        }}
      >
        {model.gridVals.map((v) => (
          <g key={v}>
            <line
              x1={0}
              x2={model.plotW}
              y1={model.y(v)}
              y2={model.y(v)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={0.7}
            />
            <text
              x={model.plotW + 8}
              y={model.y(v) + 4}
              className="fill-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {v >= 1000 ? v.toFixed(0) : v.toFixed(2)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const x = i * model.step + model.step / 2;
          const up = c.c >= c.o;
          const cls = up ? "text-bull" : "text-bear";
          const bodyTop = model.y(Math.max(c.o, c.c));
          const bodyH = Math.max(1, Math.abs(model.y(c.o) - model.y(c.c)));
          const bw = Math.max(1.4, model.step * 0.6);
          return (
            <g key={c.t} className={cls}>
              <line x1={x} x2={x} y1={model.y(c.h)} y2={model.y(c.l)} stroke="currentColor" strokeWidth={1} />
              <rect x={x - bw / 2} y={bodyTop} width={bw} height={bodyH} fill="currentColor" opacity={up ? 0.95 : 0.85} />
              <rect
                x={x - bw / 2}
                y={H - PAD_B - (c.v / model.maxVol) * (VOL_H - 8)}
                width={bw}
                height={(c.v / model.maxVol) * (VOL_H - 8)}
                fill="currentColor"
                opacity={0.35}
              />
            </g>
          );
        })}

        <polyline points={model.fast} fill="none" stroke="var(--gold)" strokeWidth={1.4} />
        <polyline points={model.slow} fill="none" stroke="var(--gold-soft)" strokeWidth={1} opacity={0.55} strokeDasharray="4 3" />

        {hover != null && candles[hover] && (
          <line
            x1={hover * model.step + model.step / 2}
            x2={hover * model.step + model.step / 2}
            y1={0}
            y2={H - PAD_B}
            stroke="currentColor"
            className="text-gold"
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {active && (
        <div className="num pointer-events-none absolute left-2 top-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span>O {usd(active.o)}</span>
          <span>H {usd(active.h)}</span>
          <span>L {usd(active.l)}</span>
          <span className={active.c >= active.o ? "text-bull" : "text-bear"}>C {usd(active.c)}</span>
          <span>V {num(active.v, 0)}</span>
          <span className="text-gold">SMA9 / SMA30</span>
        </div>
      )}
    </div>
  );
}