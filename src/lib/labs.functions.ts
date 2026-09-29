import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cryptoBars, getAlpacaCreds, stockBars } from "@/lib/alpaca.server";
import { geminiGenerate, isGeminiConfigured } from "@/lib/gemini.server";

type Strategy = "sma_cross" | "momentum" | "mean_reversion";

function sma(values: number[], period: number) {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function maxDrawdown(curve: number[]) {
  let peak = curve[0] ?? 1;
  let worst = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, peak ? (v - peak) / peak : 0);
  }
  return worst;
}

export const runLabBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    symbol: string;
    market?: "stocks" | "crypto";
    strategy?: Strategy;
    fast?: number;
    slow?: number;
    lookback?: number;
    threshold?: number;
    feesPct?: number;
  }) => {
    const market = input?.market === "crypto" ? "crypto" : "stocks";
    const symbol = String(input?.symbol ?? "").trim().toUpperCase().replace("/USD", "").slice(0, 32);
    if (!symbol) throw new Error("Symbol is required.");
    const strategy: Strategy =
      input?.strategy === "momentum" || input?.strategy === "mean_reversion"
        ? input.strategy
        : "sma_cross";
    return {
      symbol,
      market,
      strategy,
      fast: Math.max(2, Math.min(100, Number(input?.fast ?? 20))),
      slow: Math.max(3, Math.min(250, Number(input?.slow ?? 50))),
      lookback: Math.max(2, Math.min(120, Number(input?.lookback ?? 20))),
      threshold: Math.max(0.1, Math.min(20, Number(input?.threshold ?? 2))),
      feesPct: Math.max(0, Math.min(5, Number(input?.feesPct ?? 0.1))),
    };
  })
  .handler(async ({ data, context }) => {
    const creds = getAlpacaCreds();
    if (!creds) throw new Error("Alpaca is not configured.");

    const raw =
      data.market === "crypto"
        ? await cryptoBars(creds, [data.symbol], 750, "1Day")
        : await stockBars(creds, [data.symbol], 750, "1Day");
    const bars = raw[data.symbol] ?? [];
    if (bars.length < 80) throw new Error("Not enough historical bars for a meaningful test.");

    const closes = bars.map((b) => b.c);
    const fast = sma(closes, data.fast);
    const slow = sma(closes, data.slow);
    const feeRate = data.feesPct / 100;
    let equity = 10_000;
    let benchmark = 10_000;
    let prevPosition = 0;
    let trades = 0;
    let activeDays = 0;
    let winningDays = 0;
    const strategyReturns: number[] = [];
    const curve: Array<{ t: number; strategy: number; benchmark: number }> = [
      { t: bars[0]!.t, strategy: equity, benchmark },
    ];

    const signalAt = (i: number) => {
      if (i <= 0) return 0;
      if (data.strategy === "sma_cross") {
        const f = fast[i];
        const s = slow[i];
        return f != null && s != null && f > s ? 1 : 0;
      }
      if (data.strategy === "momentum") {
        const j = i - data.lookback;
        if (j < 0) return 0;
        return closes[i]! > closes[j]! ? 1 : 0;
      }
      const avg = fast[i];
      if (avg == null) return 0;
      return closes[i]! < avg * (1 - data.threshold / 100) ? 1 : closes[i]! > avg ? 0 : prevPosition;
    };

    for (let i = 1; i < bars.length; i++) {
      const marketReturn = closes[i]! / closes[i - 1]! - 1;
      const position = signalAt(i - 1);
      const turnover = Math.abs(position - prevPosition);
      if (turnover > 0) trades += 1;
      const strategyReturn = position * marketReturn - turnover * feeRate;
      equity *= 1 + strategyReturn;
      benchmark *= 1 + marketReturn;
      strategyReturns.push(strategyReturn);
      if (position > 0) {
        activeDays += 1;
        if (strategyReturn > 0) winningDays += 1;
      }
      curve.push({ t: bars[i]!.t, strategy: equity, benchmark });
      prevPosition = position;
    }

    const mean = strategyReturns.reduce((a, b) => a + b, 0) / Math.max(1, strategyReturns.length);
    const variance =
      strategyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
      Math.max(1, strategyReturns.length - 1);
    const vol = Math.sqrt(variance) * Math.sqrt(252);
    const annualized = Math.pow(equity / 10_000, 252 / Math.max(1, strategyReturns.length)) - 1;
    const sharpe = vol > 0 ? annualized / vol : 0;
    const metrics = {
      totalReturn: equity / 10_000 - 1,
      benchmarkReturn: benchmark / 10_000 - 1,
      annualizedReturn: annualized,
      annualizedVolatility: vol,
      sharpe,
      maxDrawdown: maxDrawdown(curve.map((p) => p.strategy)),
      trades,
      exposure: activeDays / Math.max(1, strategyReturns.length),
      winRate: winningDays / Math.max(1, activeDays),
      bars: bars.length,
    };

    let analysis: string | null = null;
    if (isGeminiConfigured()) {
      analysis = await geminiGenerate(
        `Interpret this deterministic paper backtest without inventing any numbers.
Symbol: ${data.symbol} (${data.market})
Strategy: ${data.strategy}
Parameters: ${JSON.stringify(data)}
Metrics: ${JSON.stringify(metrics)}
Explain what is encouraging, what is weak, likely overfitting risks, and what test should come next. Keep it under 220 words.`,
        {
          system:
            "You are Terminal's quant reviewer. The numbers supplied were computed by code from Alpaca daily bars. Never claim causality or future profitability. Distinguish in-sample evidence from a tradable edge.",
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      ).catch(() => null);
    }

    // Persistence is best-effort so Labs still works before the optional migration is applied.
    try {
      await (context.supabase as any).from("lab_runs").insert({
        user_id: context.userId,
        symbol: data.symbol,
        market: data.market,
        strategy: data.strategy,
        parameters: data,
        metrics,
        analysis,
        source: analysis ? "alpaca+gemini" : "alpaca",
      });
    } catch {
      // Ignore missing table/migration.
    }

    return {
      symbol: data.symbol,
      market: data.market,
      strategy: data.strategy,
      parameters: data,
      metrics,
      analysis,
      curve: curve.filter((_, i) => i % Math.max(1, Math.floor(curve.length / 180)) === 0 || i === curve.length - 1),
      source: analysis ? "Alpaca bars + Gemini review" : "Alpaca bars",
    };
  });
