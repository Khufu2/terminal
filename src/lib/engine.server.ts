/**
 * Autonomous trading engine. Server-only.
 * Jobs are invoked by the cron route or by the user pressing "Run now".
 * Every job is defensive: missing broker keys degrade to a skipped run, never a crash.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  cryptoBars,
  fetchNews,
  getAlpacaCreds,
  stockBars,
  submitOrder,
  type Bar,
} from "@/lib/alpaca.server";
import { sendTelegram } from "@/lib/notify.server";
import { rsi, sma } from "@/lib/market-data";

export type Job = "prices" | "news" | "signals" | "trade" | "digest";
export const JOBS: Job[] = ["prices", "news", "signals", "trade", "digest"];

type Risk = {
  user_id: string;
  autonomy_enabled: boolean;
  halted: boolean;
  halt_reason: string | null;
  risk_per_trade_pct: number;
  max_open_positions: number;
  max_market_exposure_pct: number;
  daily_loss_limit_pct: number;
  max_drawdown_pct: number;
  min_confidence: number;
  live_crypto: boolean;
  live_stocks: boolean;
  live_kalshi: boolean;
  telegram_chat_id: string | null;
  day_start_equity: number;
  day_start_date: string;
  peak_equity: number;
};

const db = () => supabaseAdmin;

async function log(userId: string, job: string, status: string, detail: string) {
  await db().from("bot_runs").insert({ user_id: userId, job, status, detail: detail.slice(0, 900) });
}

async function raise(risk: Risk, level: string, title: string, body: string) {
  const delivered = await sendTelegram(risk.telegram_chat_id, `<b>${title}</b>\n${body}`);
  await db().from("alerts").insert({ user_id: risk.user_id, level, title, body, delivered });
}

export async function listRiskProfiles(userId?: string) {
  const q = db().from("risk_settings").select("*");
  const { data, error } = userId ? await q.eq("user_id", userId) : await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Risk[];
}

/* ------------------------------------------------------------------ prices */

async function universe(userId: string) {
  const [h, w] = await Promise.all([
    db().from("holdings").select("market, symbol").eq("user_id", userId),
    db().from("watchlist_items").select("market, symbol").eq("user_id", userId),
  ]);
  const map = new Map<string, string>();
  for (const r of [...(h.data ?? []), ...(w.data ?? [])]) map.set(r.symbol, r.market);
  return map;
}

async function loadBars(userId: string) {
  const creds = getAlpacaCreds();
  if (!creds) return null;
  const u = await universe(userId);
  const stocks = [...u].filter(([, m]) => m === "stocks").map(([s]) => s);
  const crypto = [...u].filter(([, m]) => m === "crypto").map(([s]) => s);
  const [a, b] = await Promise.all([
    stockBars(creds, stocks).catch(() => ({}) as Record<string, Bar[]>),
    cryptoBars(creds, crypto).catch(() => ({}) as Record<string, Bar[]>),
  ]);
  return { bars: { ...a, ...b } as Record<string, Bar[]>, universe: u };
}

async function jobPrices(risk: Risk) {
  const loaded = await loadBars(risk.user_id);
  if (!loaded) return "skipped: no Alpaca key";
  let updated = 0;
  for (const [symbol, bars] of Object.entries(loaded.bars)) {
    const last = bars[bars.length - 1];
    if (!last) continue;
    const { error } = await db()
      .from("holdings")
      .update({ last_price: last.c })
      .eq("user_id", risk.user_id)
      .eq("symbol", symbol);
    if (!error) updated += 1;
  }
  return `refreshed ${updated} symbols`;
}

/* -------------------------------------------------------------------- news */

async function scoreHeadlines(items: { title: string; symbols: string }[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !items.length) return items.map(() => ({ sentiment: 0, impact: "low" }));

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "system",
          content:
            "Score market headlines. Reply with ONLY a JSON array, one object per headline, in order: " +
            '[{"sentiment":-1..1,"impact":"low|medium|high"}]. No prose, no code fences.',
        },
        { role: "user", content: items.map((h, i) => `${i + 1}. [${h.symbols}] ${h.title}`).join("\n") },
      ],
    }),
  });
  if (!res.ok) return items.map(() => ({ sentiment: 0, impact: "low" }));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return items.map(() => ({ sentiment: 0, impact: "low" }));
  try {
    const parsed = JSON.parse(match[0]) as { sentiment?: number; impact?: string }[];
    return items.map((_, i) => ({
      sentiment: Math.max(-1, Math.min(1, Number(parsed[i]?.sentiment ?? 0))),
      impact: ["low", "medium", "high"].includes(String(parsed[i]?.impact)) ? String(parsed[i]?.impact) : "low",
    }));
  } catch {
    return items.map(() => ({ sentiment: 0, impact: "low" }));
  }
}

async function jobNews(risk: Risk) {
  const creds = getAlpacaCreds();
  if (!creds) return "skipped: no Alpaca key";
  const u = await universe(risk.user_id);
  const symbols = [...u].filter(([, m]) => m !== "kalshi").map(([s]) => s);
  const articles = await fetchNews(creds, symbols, 25);
  if (!articles.length) return "no headlines";

  const { data: existing } = await db()
    .from("news_items")
    .select("url")
    .eq("user_id", risk.user_id)
    .order("published_at", { ascending: false })
    .limit(200);
  const seen = new Set((existing ?? []).map((r) => r.url));

  const fresh = articles.filter((a) => a.url && !seen.has(a.url)).slice(0, 12);
  if (!fresh.length) return "no new headlines";

  const scored = await scoreHeadlines(
    fresh.map((a) => ({ title: a.headline, symbols: a.symbols.join(",") })),
  );

  const rows = fresh.map((a, i) => ({
    user_id: risk.user_id,
    source: a.source || "alpaca",
    title: a.headline.slice(0, 300),
    summary: (a.summary || "").slice(0, 600),
    url: a.url,
    symbols: a.symbols.join(","),
    sentiment: scored[i]?.sentiment ?? 0,
    impact: scored[i]?.impact ?? "low",
    published_at: a.created_at,
  }));
  const { error } = await db().from("news_items").insert(rows);
  if (error) throw new Error(error.message);
  return `ingested ${rows.length} headlines`;
}

/* ----------------------------------------------------------------- signals */

function technicalScore(bars: Bar[]) {
  const closes = bars.map((b) => b.c);
  if (closes.length < 40) return null;
  const fast = sma(closes, 9);
  const slow = sma(closes, 30);
  const r = rsi(closes, 14);
  const last = closes.length - 1;
  const f = fast[last];
  const s = slow[last];
  const rv = r[last];
  const price = closes[last]!;
  if (f == null || s == null || rv == null) return null;

  const trend = (f - s) / s; // positive = uptrend
  const mom = (price - closes[last - 5]!) / closes[last - 5]!;
  const vols = closes.slice(-20).map((c, i, arr) => (i ? Math.abs(c - arr[i - 1]!) / arr[i - 1]! : 0));
  const atrPct = vols.reduce((a, b) => a + b, 0) / vols.length || 0.02;

  let score = 0;
  score += Math.max(-1, Math.min(1, trend * 25)) * 0.45;
  score += Math.max(-1, Math.min(1, mom * 12)) * 0.3;
  score += rv < 30 ? 0.25 : rv > 70 ? -0.25 : 0;
  return { score, price, atrPct, rsi: rv, trend };
}

async function jobSignals(risk: Risk) {
  const loaded = await loadBars(risk.user_id);
  if (!loaded) return "skipped: no Alpaca key";

  const { data: news } = await db()
    .from("news_items")
    .select("symbols, sentiment, impact, title")
    .eq("user_id", risk.user_id)
    .order("published_at", { ascending: false })
    .limit(60);

  const rows: {
    user_id: string;
    market: string;
    symbol: string;
    direction: string;
    confidence: number;
    sentiment: number;
    source: string;
    ai_reason: string;
    entry_price: number;
    stop_price: number;
    target_price: number;
  }[] = [];
  for (const [symbol, bars] of Object.entries(loaded.bars)) {
    const tech = technicalScore(bars);
    if (!tech) continue;
    const market = loaded.universe.get(symbol) ?? "stocks";

    const related = (news ?? []).filter((n) => (n.symbols ?? "").split(",").includes(symbol));
    const newsScore = related.length
      ? related.reduce((a, n) => a + Number(n.sentiment) * (n.impact === "high" ? 1 : n.impact === "medium" ? 0.6 : 0.3), 0) /
        related.length
      : 0;

    const blended = tech.score * 0.7 + newsScore * 0.3;
    const direction = blended >= 0 ? "long" : "short";
    const confidence = Math.min(0.97, Math.abs(blended));
    const stopDist = Math.max(tech.atrPct * 2, 0.02) * tech.price;

    rows.push({
      user_id: risk.user_id,
      market,
      symbol,
      direction,
      confidence,
      sentiment: newsScore,
      source: "aurum-engine",
      ai_reason:
        `Trend ${(tech.trend * 100).toFixed(1)}% (SMA9 vs SMA30), RSI ${tech.rsi.toFixed(0)}, ` +
        `news sentiment ${newsScore.toFixed(2)} across ${related.length} headlines. ` +
        `Volatility ${(tech.atrPct * 100).toFixed(1)}%/day sets the stop distance.`,
      entry_price: tech.price,
      stop_price: direction === "long" ? tech.price - stopDist : tech.price + stopDist,
      target_price: direction === "long" ? tech.price + stopDist * 2 : tech.price - stopDist * 2,
    });
  }
  if (!rows.length) return "no signals";
  const { error } = await db().from("signals").insert(rows);
  if (error) throw new Error(error.message);
  return `generated ${rows.length} signals`;
}

/* ------------------------------------------------------------------- trade */

type Ctx = {
  equity: number;
  cash: number;
  holdings: { id: string; market: string; symbol: string; quantity: number; avg_cost: number; last_price: number }[];
};

async function portfolio(userId: string): Promise<Ctx> {
  const [{ data: accounts }, { data: holdings }] = await Promise.all([
    db().from("accounts").select("market, balance_usd").eq("user_id", userId),
    db().from("holdings").select("id, market, symbol, quantity, avg_cost, last_price").eq("user_id", userId),
  ]);
  const cash = (accounts ?? []).reduce((a, r) => a + Number(r.balance_usd), 0);
  const mv = (holdings ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.last_price), 0);
  return { equity: cash + mv, cash, holdings: (holdings ?? []) as Ctx["holdings"] };
}

async function decide(
  risk: Risk,
  market: string,
  symbol: string,
  action: string,
  confidence: number,
  extra: { quantity?: number; price?: number; reason?: string; accepted?: boolean; blocked?: string },
) {
  await db().from("bot_decisions").insert({
    user_id: risk.user_id,
    market,
    symbol,
    action,
    confidence,
    quantity: extra.quantity ?? null,
    price: extra.price ?? null,
    reason: extra.reason ?? null,
    accepted: extra.accepted ?? false,
    blocked_reason: extra.blocked ?? null,
  });
}

/** Enforces the hard caps. Returns a blocking reason, or null when trading is allowed. */
async function guard(risk: Risk, ctx: Ctx): Promise<string | null> {
  if (!risk.autonomy_enabled) return "autonomy disabled";
  if (risk.halted) return risk.halt_reason || "bot halted";

  const today = new Date().toISOString().slice(0, 10);
  let dayStart = Number(risk.day_start_equity);
  if (risk.day_start_date !== today || dayStart <= 0) {
    dayStart = ctx.equity;
    await db()
      .from("risk_settings")
      .update({ day_start_equity: ctx.equity, day_start_date: today })
      .eq("user_id", risk.user_id);
  }
  const peak = Math.max(Number(risk.peak_equity), ctx.equity);
  if (peak > Number(risk.peak_equity)) {
    await db().from("risk_settings").update({ peak_equity: peak }).eq("user_id", risk.user_id);
  }

  const dayPnlPct = dayStart > 0 ? ((ctx.equity - dayStart) / dayStart) * 100 : 0;
  if (dayPnlPct <= -Number(risk.daily_loss_limit_pct)) {
    const reason = `daily loss limit hit (${dayPnlPct.toFixed(2)}%)`;
    await db().from("risk_settings").update({ halted: true, halt_reason: reason }).eq("user_id", risk.user_id);
    await raise(risk, "critical", "Bot halted — daily loss limit", `Equity ${ctx.equity.toFixed(2)} USD, ${reason}.`);
    return reason;
  }

  const ddPct = peak > 0 ? ((peak - ctx.equity) / peak) * 100 : 0;
  if (ddPct >= Number(risk.max_drawdown_pct)) {
    const reason = `max drawdown hit (${ddPct.toFixed(2)}% from peak)`;
    await db().from("risk_settings").update({ halted: true, halt_reason: reason }).eq("user_id", risk.user_id);
    await raise(risk, "critical", "Bot halted — max drawdown", `Equity ${ctx.equity.toFixed(2)} USD, ${reason}.`);
    return reason;
  }

  const open = ctx.holdings.filter((h) => Number(h.quantity) > 0).length;
  if (open >= risk.max_open_positions) return `max open positions (${open})`;
  return null;
}

function isLive(risk: Risk, market: string) {
  if (market === "crypto") return risk.live_crypto;
  if (market === "stocks") return risk.live_stocks;
  return risk.live_kalshi;
}

async function jobTrade(risk: Risk) {
  const ctx = await portfolio(risk.user_id);
  const blocked = await guard(risk, ctx);
  if (blocked) {
    await decide(risk, "all", "-", "hold", 0, { blocked });
    return `no trading: ${blocked}`;
  }

  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: signals } = await db()
    .from("signals")
    .select("*")
    .eq("user_id", risk.user_id)
    .gte("created_at", since)
    .order("confidence", { ascending: false })
    .limit(20);

  const creds = getAlpacaCreds();
  let acted = 0;
  const seen = new Set<string>();

  for (const s of signals ?? []) {
    if (acted >= 2) break;
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);

    const confidence = Number(s.confidence);
    if (confidence < Number(risk.min_confidence)) {
      await decide(risk, s.market, s.symbol, "hold", confidence, { blocked: "below confidence threshold" });
      continue;
    }
    if (s.direction !== "long") {
      await decide(risk, s.market, s.symbol, "hold", confidence, { blocked: "shorting is disabled" });
      continue;
    }

    const price = Number(s.entry_price) || 0;
    const stop = Number(s.stop_price) || price * 0.95;
    if (price <= 0 || stop >= price) continue;

    const riskUsd = ctx.equity * (Number(risk.risk_per_trade_pct) / 100);
    let qty = riskUsd / (price - stop);
    const maxNotional = ctx.equity * (Number(risk.max_market_exposure_pct) / 100);
    qty = Math.min(qty, maxNotional / price, ctx.cash / price);
    if (s.market === "stocks") qty = Math.floor(qty);
    else qty = Number(qty.toFixed(6));

    const notional = qty * price;
    if (qty <= 0 || notional < 1) {
      await decide(risk, s.market, s.symbol, "buy", confidence, {
        price,
        blocked: "position size below the minimum tradeable amount",
      });
      continue;
    }

    const live = isLive(risk, s.market) && creds;
    if (live && creds) {
      try {
        await submitOrder(creds, { symbol: s.symbol, qty, side: "buy", type: "market", market: s.market });
      } catch (e) {
        await decide(risk, s.market, s.symbol, "buy", confidence, {
          quantity: qty,
          price,
          blocked: `broker rejected: ${(e as Error).message}`,
        });
        continue;
      }
    }

    // Mirror the fill into the local book (source of truth for the dashboard).
    const existing = ctx.holdings.find((h) => h.symbol === s.symbol);
    if (existing) {
      const newQty = Number(existing.quantity) + qty;
      const newCost = (Number(existing.quantity) * Number(existing.avg_cost) + notional) / newQty;
      await db().from("holdings").update({ quantity: newQty, avg_cost: newCost, last_price: price }).eq("id", existing.id);
    } else {
      await db().from("holdings").insert({
        user_id: risk.user_id,
        market: s.market,
        symbol: s.symbol,
        name: s.symbol,
        quantity: qty,
        avg_cost: price,
        last_price: price,
      });
    }

    const { data: acct } = await db()
      .from("accounts")
      .select("id, balance_usd")
      .eq("user_id", risk.user_id)
      .eq("market", s.market)
      .maybeSingle();
    if (acct) {
      await db().from("accounts").update({ balance_usd: Number(acct.balance_usd) - notional }).eq("id", acct.id);
    }

    await db().from("transactions").insert({
      user_id: risk.user_id,
      market: s.market,
      symbol: s.symbol,
      side: "buy",
      order_type: "market",
      quantity: qty,
      price,
      fees: 0,
      stop_price: stop,
      target_price: Number(s.target_price) || null,
      status: "filled",
      mode: live ? "real" : "sim",
      notes: `Autonomous entry — confidence ${(confidence * 100).toFixed(0)}%`,
    });

    await decide(risk, s.market, s.symbol, "buy", confidence, {
      quantity: qty,
      price,
      accepted: true,
      ...(s.ai_reason ? { reason: s.ai_reason } : {}),
    });
    await raise(
      risk,
      "info",
      `${live ? "LIVE" : "SIM"} buy ${s.symbol}`,
      `${qty} @ ${price.toFixed(2)} (${notional.toFixed(2)} USD), stop ${stop.toFixed(2)}, confidence ${(confidence * 100).toFixed(0)}%.`,
    );
    ctx.cash -= notional;
    acted += 1;
  }

  return `placed ${acted} order(s) from ${(signals ?? []).length} signals`;
}

/* ------------------------------------------------------------------ digest */

async function jobDigest(risk: Risk) {
  const ctx = await portfolio(risk.user_id);
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: fills }, { data: decisions }] = await Promise.all([
    db().from("transactions").select("symbol, side, quantity, price").eq("user_id", risk.user_id).gte("executed_at", since),
    db().from("bot_decisions").select("symbol, action, blocked_reason").eq("user_id", risk.user_id).gte("created_at", since),
  ]);
  const dayStart = Number(risk.day_start_equity) || ctx.equity;
  const pnl = ctx.equity - dayStart;
  const body =
    `Equity ${ctx.equity.toFixed(2)} USD (${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} today)\n` +
    `Fills: ${(fills ?? []).length} · Decisions: ${(decisions ?? []).length}\n` +
    `Open positions: ${ctx.holdings.filter((h) => Number(h.quantity) > 0).length}\n` +
    `Status: ${risk.halted ? `HALTED — ${risk.halt_reason}` : risk.autonomy_enabled ? "trading" : "autonomy off"}`;
  await raise(risk, "info", "Daily summary", body);

  await db().from("equity_snapshots").insert(
    ["crypto", "stocks", "kalshi"].map((market) => ({
      user_id: risk.user_id,
      market,
      equity_usd: ctx.holdings.filter((h) => h.market === market).reduce((a, h) => a + h.quantity * h.last_price, 0),
    })),
  );
  return "digest sent";
}

/* ------------------------------------------------------------------ runner */

export async function runJob(job: Job, userId?: string) {
  const profiles = await listRiskProfiles(userId);
  const results: { user_id: string; result: string }[] = [];
  for (const risk of profiles) {
    try {
      const result =
        job === "prices"
          ? await jobPrices(risk)
          : job === "news"
            ? await jobNews(risk)
            : job === "signals"
              ? await jobSignals(risk)
              : job === "trade"
                ? await jobTrade(risk)
                : await jobDigest(risk);
      await log(risk.user_id, job, "ok", result);
      results.push({ user_id: risk.user_id, result });
    } catch (e) {
      const message = (e as Error).message;
      await log(risk.user_id, job, "error", message);
      results.push({ user_id: risk.user_id, result: `error: ${message}` });
    }
  }
  return results;
}