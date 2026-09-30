-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  starting_capital NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =============== ACCOUNTS ===============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  label TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'sim',
  balance_usd NUMERIC NOT NULL DEFAULT 0,
  equity_usd NUMERIC NOT NULL DEFAULT 0,
  target_weight NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== HOLDINGS ===============
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  last_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holdings" ON public.holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== TRANSACTIONS ===============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'market',
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  fees NUMERIC NOT NULL DEFAULT 0,
  stop_price NUMERIC,
  target_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'filled',
  mode TEXT NOT NULL DEFAULT 'sim',
  notes TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== FINANCE ENTRIES ===============
CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own finance" ON public.finance_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== WATCHLIST ===============
CREATE TABLE public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist" ON public.watchlist_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== SIGNALS ===============
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  sentiment NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'orchestrator',
  ai_reason TEXT,
  entry_price NUMERIC,
  target_price NUMERIC,
  stop_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own signals" ON public.signals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== NEWS ===============
CREATE TABLE public.news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  symbols TEXT,
  sentiment NUMERIC NOT NULL DEFAULT 0,
  impact TEXT NOT NULL DEFAULT 'medium',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT ALL ON public.news_items TO service_role;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own news" ON public.news_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== STRATEGIES ===============
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT NOT NULL DEFAULT 'balanced',
  crypto_weight NUMERIC NOT NULL DEFAULT 0.4,
  stocks_weight NUMERIC NOT NULL DEFAULT 0.4,
  kalshi_weight NUMERIC NOT NULL DEFAULT 0.2,
  min_confidence NUMERIC NOT NULL DEFAULT 0.6,
  max_position_pct NUMERIC NOT NULL DEFAULT 0.1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own strategies" ON public.strategies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== FOLLOWED TRADERS ===============
CREATE TABLE public.followed_traders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT,
  market TEXT NOT NULL,
  specialty TEXT,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  ytd_return NUMERIC NOT NULL DEFAULT 0,
  current_stance TEXT,
  following BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followed_traders TO authenticated;
GRANT ALL ON public.followed_traders TO service_role;
ALTER TABLE public.followed_traders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own traders" ON public.followed_traders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== ADVISOR MESSAGES ===============
CREATE TABLE public.advisor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_messages TO authenticated;
GRANT ALL ON public.advisor_messages TO service_role;
ALTER TABLE public.advisor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own advisor" ON public.advisor_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== JOURNAL ===============
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT,
  market TEXT,
  title TEXT NOT NULL,
  body TEXT,
  tags TEXT,
  outcome TEXT,
  r_multiple NUMERIC,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal" ON public.journal_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== CONNECTIONS ===============
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connections" ON public.connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============== EQUITY SNAPSHOTS ===============
CREATE TABLE public.equity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  market TEXT NOT NULL,
  equity_usd NUMERIC NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equity_snapshots TO authenticated;
GRANT ALL ON public.equity_snapshots TO service_role;
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.equity_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_snapshots_user_time ON public.equity_snapshots(user_id, snapshot_at);
CREATE INDEX idx_signals_user_time ON public.signals(user_id, created_at DESC);
CREATE INDEX idx_news_user_time ON public.news_items(user_id, published_at DESC);
CREATE INDEX idx_advisor_user_time ON public.advisor_messages(user_id, created_at);

-- =============== NEW USER BOOTSTRAP + DEMO DATA ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := NEW.id;
  d INT;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (uid, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.accounts (user_id, market, label, mode, balance_usd, equity_usd, target_weight) VALUES
    (uid, 'crypto', 'Crypto · Freqtrade', 'sim', 1240.00, 4820.55, 0.40),
    (uid, 'stocks', 'Stocks · Alpaca', 'sim', 2100.00, 5310.20, 0.40),
    (uid, 'kalshi', 'Kalshi · Events', 'sim', 480.00, 1465.75, 0.15),
    (uid, 'cash',   'Cash Reserve',     'sim', 3200.00, 3200.00, 0.05);

  INSERT INTO public.holdings (user_id, market, symbol, name, quantity, avg_cost, last_price) VALUES
    (uid, 'crypto', 'BTC',  'Bitcoin',       0.0412, 61240.00, 68120.40),
    (uid, 'crypto', 'ETH',  'Ethereum',      0.870,  2810.00,  3042.10),
    (uid, 'crypto', 'SOL',  'Solana',        6.20,   138.40,   151.85),
    (uid, 'stocks', 'NVDA', 'NVIDIA Corp',   9,      112.30,   128.94),
    (uid, 'stocks', 'MSFT', 'Microsoft',     6,      402.10,   428.66),
    (uid, 'stocks', 'AAPL', 'Apple Inc',     11,     198.55,   211.20),
    (uid, 'stocks', 'VOO',  'Vanguard S&P',  4,      492.00,   524.31),
    (uid, 'kalshi', 'FEDRATE-DEC', 'Fed holds rates in Dec', 900, 0.61, 0.68),
    (uid, 'kalshi', 'CPI-ABOVE3',  'CPI prints above 3%',    500, 0.34, 0.29);

  FOR d IN 0..89 LOOP
    INSERT INTO public.equity_snapshots (user_id, market, equity_usd, snapshot_at) VALUES
      (uid, 'crypto', 3600 + d * 13.2 + (random() * 320 - 160), now() - ((89 - d) || ' days')::interval),
      (uid, 'stocks', 4400 + d * 10.4 + (random() * 240 - 120), now() - ((89 - d) || ' days')::interval),
      (uid, 'kalshi', 1200 + d * 3.0  + (random() * 120 - 60),  now() - ((89 - d) || ' days')::interval);
  END LOOP;

  INSERT INTO public.transactions (user_id, market, symbol, side, order_type, quantity, price, fees, status, notes, executed_at) VALUES
    (uid, 'crypto', 'BTC',  'buy',  'market', 0.0212, 59800.00, 1.20, 'filled', 'Trend continuation after breakout', now() - interval '22 days'),
    (uid, 'crypto', 'ETH',  'buy',  'limit',  0.870,  2810.00,  0.90, 'filled', 'Bounce from 200D MA', now() - interval '17 days'),
    (uid, 'stocks', 'NVDA', 'buy',  'market', 9,      112.30,   0.00, 'filled', 'Earnings momentum', now() - interval '31 days'),
    (uid, 'stocks', 'AAPL', 'buy',  'market', 11,     198.55,   0.00, 'filled', 'Core holding accumulation', now() - interval '44 days'),
    (uid, 'crypto', 'SOL',  'sell', 'market', 2.00,   162.10,   0.40, 'filled', 'Took partial profit into strength', now() - interval '5 days'),
    (uid, 'kalshi', 'FEDRATE-DEC', 'buy', 'limit', 900, 0.61, 0.00, 'filled', 'Rate-hold consensus mispriced', now() - interval '9 days');

  INSERT INTO public.finance_entries (user_id, kind, category, label, amount, recurring, entry_date) VALUES
    (uid, 'income',  'salary',     'Monthly salary',        4200, true,  CURRENT_DATE - 3),
    (uid, 'income',  'freelance',  'Design contract',        850, false, CURRENT_DATE - 11),
    (uid, 'income',  'dividends',  'VOO dividend',            34, true,  CURRENT_DATE - 20),
    (uid, 'expense', 'housing',    'Rent',                  1350, true,  CURRENT_DATE - 3),
    (uid, 'expense', 'food',       'Groceries',              420, true,  CURRENT_DATE - 6),
    (uid, 'expense', 'transport',  'Fuel & transit',         180, true,  CURRENT_DATE - 8),
    (uid, 'expense', 'subscriptions','Software & data feeds', 96, true,  CURRENT_DATE - 10),
    (uid, 'expense', 'investing',  'Transfer to trading',    1000, true, CURRENT_DATE - 4),
    (uid, 'income',  'salary',     'Monthly salary',        4200, true,  CURRENT_DATE - 33),
    (uid, 'expense', 'housing',    'Rent',                  1350, true,  CURRENT_DATE - 33),
    (uid, 'expense', 'food',       'Groceries',              465, true,  CURRENT_DATE - 36),
    (uid, 'expense', 'investing',  'Transfer to trading',    800, true,  CURRENT_DATE - 34);

  INSERT INTO public.watchlist_items (user_id, market, symbol, name) VALUES
    (uid, 'crypto', 'BTC', 'Bitcoin'),
    (uid, 'crypto', 'ETH', 'Ethereum'),
    (uid, 'crypto', 'SOL', 'Solana'),
    (uid, 'crypto', 'LINK','Chainlink'),
    (uid, 'stocks', 'NVDA','NVIDIA Corp'),
    (uid, 'stocks', 'AAPL','Apple Inc'),
    (uid, 'stocks', 'MSFT','Microsoft'),
    (uid, 'stocks', 'TSLA','Tesla Inc'),
    (uid, 'kalshi', 'FEDRATE-DEC','Fed holds rates in Dec'),
    (uid, 'kalshi', 'CPI-ABOVE3','CPI prints above 3%'),
    (uid, 'kalshi', 'GDP-Q4POS','Q4 GDP growth positive');

  INSERT INTO public.signals (user_id, market, symbol, direction, confidence, sentiment, source, ai_reason, entry_price, target_price, stop_price, created_at) VALUES
    (uid, 'crypto','BTC','buy', 0.82, 0.44,'ai+momentum','Higher lows on the 4H with expanding volume; funding neutral so the move is spot-driven rather than leverage-driven.', 68120, 74500, 64800, now() - interval '35 minutes'),
    (uid, 'stocks','NVDA','buy',0.76, 0.51,'ai+earnings','Guidance beat plus rising data-centre backlog. Relative strength versus the semiconductor index remains positive.', 128.94, 148.00, 118.50, now() - interval '2 hours'),
    (uid, 'kalshi','FEDRATE-DEC','buy',0.71,0.22,'ai+macro','Market implies 68c but futures-implied odds sit near 79c. Positive expected value if the December dot plot holds.', 0.68, 0.86, 0.55, now() - interval '4 hours'),
    (uid, 'crypto','SOL','hold',0.51,0.08,'orchestrator','Momentum cooling into resistance; wait for a reclaim of the prior high before adding.', 151.85, NULL, NULL, now() - interval '6 hours'),
    (uid, 'stocks','TSLA','sell',0.64,-0.33,'ai+sentiment','Deliveries trending below consensus and margin compression continues. Distribution pattern on daily volume.', 232.10, 198.00, 249.00, now() - interval '9 hours'),
    (uid, 'crypto','ETH','buy',0.69,0.31,'ai+flows','Net exchange outflows for nine straight sessions alongside rising staking ratio.', 3042.10, 3480, 2790, now() - interval '14 hours'),
    (uid, 'stocks','MSFT','hold',0.58,0.19,'orchestrator','Fairly valued near term; keep the core position and add only on a pullback to the 50D.', 428.66, NULL, NULL, now() - interval '20 hours'),
    (uid, 'kalshi','CPI-ABOVE3','sell',0.66,-0.18,'ai+macro','Shelter disinflation is feeding through faster than the market prices. Fade the above-3% contract.', 0.29, 0.14, 0.40, now() - interval '26 hours');

  INSERT INTO public.news_items (user_id, source, title, summary, url, symbols, sentiment, impact, published_at) VALUES
    (uid, 'Reuters','Fed officials signal patience on rate cuts','Two governors said they want more evidence of sustained disinflation before easing, pushing the first cut expectation later into the year.','https://reuters.com','FEDRATE-DEC,VOO,MSFT', -0.22,'high', now() - interval '48 minutes'),
    (uid, 'Bloomberg','NVIDIA data-centre backlog hits record','Supply commitments extend into next year as hyperscaler capex guidance rises again.','https://bloomberg.com','NVDA', 0.61,'high', now() - interval '3 hours'),
    (uid, 'CoinDesk','Bitcoin ETFs log ninth straight day of inflows','Spot vehicles absorbed more than daily issuance for the second week running.','https://coindesk.com','BTC', 0.55,'high', now() - interval '5 hours'),
    (uid, 'The Block','Ethereum staking ratio reaches new high','Validators continue to absorb float as exchange balances decline.','https://theblock.co','ETH', 0.38,'medium', now() - interval '8 hours'),
    (uid, 'CNBC','Tesla deliveries tracking below consensus','Regional registration data points to a softer quarter in Europe and China.','https://cnbc.com','TSLA', -0.47,'medium', now() - interval '11 hours'),
    (uid, 'FT','Shelter inflation cools faster than expected','New lease data suggests the largest CPI component keeps decelerating.','https://ft.com','CPI-ABOVE3', 0.29,'high', now() - interval '15 hours'),
    (uid, 'Reuters','Solana network activity rebounds','Daily active addresses recover after last month''s decline.','https://reuters.com','SOL', 0.24,'low', now() - interval '21 hours'),
    (uid, 'WSJ','Apple services revenue beats again','Higher-margin services offset flat hardware growth.','https://wsj.com','AAPL', 0.41,'medium', now() - interval '30 hours');

  INSERT INTO public.strategies (user_id, name, description, risk_level, crypto_weight, stocks_weight, kalshi_weight, min_confidence, max_position_pct, is_active) VALUES
    (uid,'Steady Compounder','Index-heavy core with a small satellite in crypto majors. Few trades, long holds, tight risk.','conservative',0.20,0.70,0.10,0.70,0.06,true),
    (uid,'Balanced Momentum','Trend-following across crypto and large-cap equities, with event contracts used as a hedge.','balanced',0.40,0.40,0.20,0.60,0.10,false),
    (uid,'Event Edge','Concentrates on mispriced Kalshi macro contracts, funded by a conservative equity base.','balanced',0.15,0.45,0.40,0.65,0.08,false),
    (uid,'High Conviction','Fewer, larger positions on the strongest signals only. Higher drawdowns, higher ceiling.','aggressive',0.50,0.35,0.15,0.78,0.18,false);

  INSERT INTO public.followed_traders (user_id, name, handle, market, specialty, win_rate, ytd_return, current_stance, following) VALUES
    (uid,'Nadia Vance','@nadiamacro','kalshi','Macro event contracts, CPI and Fed prints',0.68,0.41,'Long rate-hold contracts into December; fading above-3% CPI.',true),
    (uid,'Marcus Oyelaran','@oyelabs','crypto','Spot majors, flow and on-chain positioning',0.61,0.87,'Accumulating BTC and ETH on ETF inflow strength; no leverage.',true),
    (uid,'Rina Kohl','@rinakohl','stocks','Quality compounders and semiconductor cycle',0.64,0.29,'Overweight semis, trimming consumer discretionary.',true),
    (uid,'Diego Marchetti','@dmarch','stocks','Systematic trend following on liquid equities',0.57,0.22,'Model is risk-on; full allocation to the equity sleeve.',false),
    (uid,'Ayo Bankole','@ayoquant','crypto','Quant mean reversion across alt majors',0.59,0.34,'Neutral on SOL, waiting for a reclaim of the prior high.',false);

  INSERT INTO public.journal_entries (user_id, symbol, market, title, body, tags, outcome, r_multiple, entry_date) VALUES
    (uid,'SOL','crypto','Trimmed into strength','Sold a third of the position at resistance instead of holding for the full target. Felt early but the pullback confirmed it.','discipline,partial-exit','win',1.4, CURRENT_DATE - 5),
    (uid,'NVDA','stocks','Held through earnings','Sized small enough that the gap risk was tolerable. Thesis on backlog held up.','earnings,patience','win',2.1, CURRENT_DATE - 12),
    (uid,'TSLA','stocks','Cut too late','Ignored the first stop level because of anchoring on the entry price. Cost roughly one extra R.','mistake,stop-loss','loss',-1.6, CURRENT_DATE - 19),
    (uid,'FEDRATE-DEC','kalshi','First macro contract','Position sized at 4% of portfolio. Comfortable holding to expiry.','macro,first','open',NULL, CURRENT_DATE - 9);

  INSERT INTO public.connections (user_id, provider, category, status, notes) VALUES
    (uid,'Alpaca','stocks','not_connected','Paper trading and US equity market data'),
    (uid,'Binance','crypto','not_connected','Crypto spot prices and paper execution'),
    (uid,'Kalshi','events','not_connected','Event contract markets and order routing'),
    (uid,'Polygon.io','data','not_connected','Historical candles and fundamentals'),
    (uid,'NewsData.io','news','not_connected','Headline feed for sentiment scoring'),
    (uid,'Trading Orchestrator','bots','not_connected','Your Python allocator posting equity and signals');

  INSERT INTO public.advisor_messages (user_id, role, content) VALUES
    (uid,'assistant','Welcome. I am your advisor — I can see your portfolio, your open positions, the latest signals and the news attached to them. Ask me anything, including the basics. A good first question: "What is my biggest risk right now?"');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();