-- Terminal commercial safety baseline.
-- Future users get clearly labelled paper buying power, not fabricated positions,
-- performance history, news, signals, traders, or journal entries.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := NEW.id;
BEGIN
  INSERT INTO public.profiles (id, display_name, starting_capital)
  VALUES (
    uid,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    100000
  )
  ON CONFLICT (id) DO NOTHING;

  -- $100k TOTAL simulated buying power, split by sleeve.
  INSERT INTO public.accounts (user_id, market, label, mode, balance_usd, equity_usd, target_weight)
  VALUES
    (uid, 'stocks', 'Stocks · Paper', 'sim', 60000, 60000, 0.60),
    (uid, 'crypto', 'Crypto · Paper', 'sim', 30000, 30000, 0.30),
    (uid, 'kalshi', 'Prediction · Paper', 'sim', 10000, 10000, 0.10)
  ON CONFLICT DO NOTHING;

  -- A watchlist is metadata, not a fabricated position or price.
  INSERT INTO public.watchlist_items (user_id, market, symbol, name)
  VALUES
    (uid, 'stocks', 'SPY',  'SPDR S&P 500 ETF'),
    (uid, 'stocks', 'AAPL', 'Apple Inc.'),
    (uid, 'stocks', 'NVDA', 'NVIDIA Corp.'),
    (uid, 'crypto', 'BTC',  'Bitcoin'),
    (uid, 'crypto', 'ETH',  'Ethereum')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.connections (user_id, provider, category, status, notes)
  VALUES
    (uid, 'Alpaca', 'market_data', 'not_connected', 'US equities, crypto market data and optional paper broker connection'),
    (uid, 'Terminal Quant Engine', 'research', 'not_connected', 'Isolated Vibe-Trading research and backtesting service')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.risk_settings (
    user_id,
    autonomy_enabled,
    halted,
    risk_per_trade_pct,
    max_open_positions,
    max_market_exposure_pct,
    daily_loss_limit_pct,
    max_drawdown_pct,
    min_confidence,
    live_crypto,
    live_stocks,
    live_kalshi
  )
  VALUES (uid, false, false, 1, 10, 25, 2, 15, 0.55, false, false, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- This commercial branch is paper-first. Force old rows back to paper and
-- fail closed if legacy UI/code ever tries to enable live execution.
UPDATE public.risk_settings
SET live_crypto = false, live_stocks = false, live_kalshi = false
WHERE live_crypto OR live_stocks OR live_kalshi;

ALTER TABLE public.risk_settings
  DROP CONSTRAINT IF EXISTS terminal_paper_only_crypto,
  DROP CONSTRAINT IF EXISTS terminal_paper_only_stocks,
  DROP CONSTRAINT IF EXISTS terminal_paper_only_kalshi;

ALTER TABLE public.risk_settings
  ADD CONSTRAINT terminal_paper_only_crypto CHECK (live_crypto = false),
  ADD CONSTRAINT terminal_paper_only_stocks CHECK (live_stocks = false),
  ADD CONSTRAINT terminal_paper_only_kalshi CHECK (live_kalshi = false);

-- Retire the old Aurum/Lovable autonomous scheduler. Research and paper
-- execution are now invoked intentionally from Terminal.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname LIKE 'aurum-%' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END;
$$;
