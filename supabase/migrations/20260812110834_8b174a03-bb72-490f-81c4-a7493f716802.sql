CREATE TABLE public.risk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  autonomy_enabled boolean NOT NULL DEFAULT false,
  halted boolean NOT NULL DEFAULT false,
  halt_reason text,
  risk_per_trade_pct numeric NOT NULL DEFAULT 1,
  max_open_positions integer NOT NULL DEFAULT 6,
  max_market_exposure_pct numeric NOT NULL DEFAULT 40,
  daily_loss_limit_pct numeric NOT NULL DEFAULT 3,
  max_drawdown_pct numeric NOT NULL DEFAULT 15,
  min_confidence numeric NOT NULL DEFAULT 0.7,
  live_crypto boolean NOT NULL DEFAULT false,
  live_stocks boolean NOT NULL DEFAULT false,
  live_kalshi boolean NOT NULL DEFAULT false,
  telegram_chat_id text,
  day_start_equity numeric NOT NULL DEFAULT 0,
  day_start_date date NOT NULL DEFAULT CURRENT_DATE,
  peak_equity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_settings TO authenticated;
GRANT ALL ON public.risk_settings TO service_role;
ALTER TABLE public.risk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own risk settings" ON public.risk_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  job text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_runs TO authenticated;
GRANT ALL ON public.bot_runs TO service_role;
ALTER TABLE public.bot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bot runs" ON public.bot_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bot_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market text NOT NULL,
  symbol text NOT NULL,
  action text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  quantity numeric,
  price numeric,
  reason text,
  accepted boolean NOT NULL DEFAULT false,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_decisions TO authenticated;
GRANT ALL ON public.bot_decisions TO service_role;
ALTER TABLE public.bot_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bot decisions" ON public.bot_decisions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.risk_settings (user_id)
SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;