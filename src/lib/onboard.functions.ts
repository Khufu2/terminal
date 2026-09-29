import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Default watchlist so Trade / Markets / Signals / News work immediately. */
export const DEFAULT_WATCHLIST = [
  { market: "crypto" as const, symbol: "BTC", name: "Bitcoin" },
  { market: "crypto" as const, symbol: "ETH", name: "Ethereum" },
  { market: "crypto" as const, symbol: "SOL", name: "Solana" },
  { market: "stocks" as const, symbol: "AAPL", name: "Apple Inc." },
  { market: "stocks" as const, symbol: "MSFT", name: "Microsoft Corp." },
  { market: "stocks" as const, symbol: "NVDA", name: "NVIDIA Corp." },
  { market: "stocks" as const, symbol: "TSLA", name: "Tesla Inc." },
  { market: "stocks" as const, symbol: "SPY", name: "SPDR S&P 500 ETF" },
];

export const STARTING_CASH = 100_000;

/**
 * Idempotent first-login seed: creates the three sim accounts with starting
 * paper cash plus a default watchlist and risk profile. Safe to call as often
 * as you like — it no-ops once a user already has accounts.
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

    await supabase.from("accounts").insert([
      { user_id: userId, market: "crypto", label: "Sim Crypto", balance_usd: STARTING_CASH, equity_usd: STARTING_CASH, target_weight: 0.2, mode: "sim" },
      { user_id: userId, market: "stocks", label: "Sim Stocks", balance_usd: STARTING_CASH, equity_usd: STARTING_CASH, target_weight: 0.6, mode: "sim" },
      { user_id: userId, market: "kalshi", label: "Sim Kalshi", balance_usd: STARTING_CASH, equity_usd: STARTING_CASH, target_weight: 0.2, mode: "sim" },
    ]);

    await supabase
      .from("watchlist_items")
      .insert(DEFAULT_WATCHLIST.map((w) => ({ user_id: userId, ...w })));

    const { data: existingRisk } = await supabase
      .from("risk_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingRisk) {
      await supabase.from("risk_settings").insert({
        user_id: userId,
        autonomy_enabled: false,
        halted: false,
        risk_per_trade_pct: 1,
        max_open_positions: 10,
        max_market_exposure_pct: 25,
        daily_loss_limit_pct: 2,
        max_drawdown_pct: 15,
        min_confidence: 0.55,
      });
    }

    return { seeded: true };
  });