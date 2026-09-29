import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_WATCHLIST = [
  { market: "stocks" as const, symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { market: "stocks" as const, symbol: "AAPL", name: "Apple Inc." },
  { market: "stocks" as const, symbol: "NVDA", name: "NVIDIA Corp." },
  { market: "crypto" as const, symbol: "BTC", name: "Bitcoin" },
  { market: "crypto" as const, symbol: "ETH", name: "Ethereum" },
];

export const TOTAL_PAPER_BUYING_POWER = 100_000;

/**
 * Idempotent fallback for accounts created before the latest database trigger
 * is installed. It creates only simulated cash + watchlist metadata. It never
 * invents positions, P&L, signals, news, fills, or performance history.
 */
export const ensureOnboarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (existing?.length) return { seeded: false };

    const { error: accountError } = await supabase.from("accounts").insert([
      { user_id: userId, market: "stocks", label: "Stocks · Paper", balance_usd: 60_000, equity_usd: 60_000, target_weight: 0.6, mode: "sim" },
      { user_id: userId, market: "crypto", label: "Crypto · Paper", balance_usd: 30_000, equity_usd: 30_000, target_weight: 0.3, mode: "sim" },
      { user_id: userId, market: "kalshi", label: "Prediction · Paper", balance_usd: 10_000, equity_usd: 10_000, target_weight: 0.1, mode: "sim" },
    ]);
    if (accountError) throw new Error(accountError.message);

    const { error: watchError } = await supabase
      .from("watchlist_items")
      .insert(DEFAULT_WATCHLIST.map((w) => ({ user_id: userId, ...w })));
    if (watchError) throw new Error(watchError.message);

    const { data: existingRisk } = await supabase
      .from("risk_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingRisk) {
      const { error } = await supabase.from("risk_settings").insert({
        user_id: userId,
        autonomy_enabled: false,
        halted: false,
        risk_per_trade_pct: 1,
        max_open_positions: 10,
        max_market_exposure_pct: 25,
        daily_loss_limit_pct: 2,
        max_drawdown_pct: 15,
        min_confidence: 0.55,
        live_crypto: false,
        live_stocks: false,
        live_kalshi: false,
      });
      if (error) throw new Error(error.message);
    }

    return { seeded: true, paperBuyingPower: TOTAL_PAPER_BUYING_POWER };
  });
