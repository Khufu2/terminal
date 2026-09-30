-- Atomic, authenticated paper trading for Terminal.
-- All portfolio mutations happen inside one transaction and always use auth.uid().

CREATE OR REPLACE FUNCTION public.execute_paper_trade(
  p_market text,
  p_symbol text,
  p_name text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_fee_bps numeric DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  account_row public.accounts%ROWTYPE;
  holding_row public.holdings%ROWTYPE;
  notional numeric;
  fee numeric;
  new_cash numeric;
  new_qty numeric;
  new_avg numeric;
  tx_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  p_market := lower(trim(p_market));
  p_symbol := upper(trim(p_symbol));
  p_side := lower(trim(p_side));

  IF p_market NOT IN ('stocks', 'crypto') THEN
    RAISE EXCEPTION 'Paper trading is currently enabled for stocks and crypto only';
  END IF;
  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid side';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than zero';
  END IF;
  IF p_fee_bps < 0 OR p_fee_bps > 1000 THEN
    RAISE EXCEPTION 'Invalid fee';
  END IF;

  SELECT *
  INTO account_row
  FROM public.accounts
  WHERE user_id = uid
    AND market = p_market
    AND mode = 'sim'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paper account not found for %', p_market;
  END IF;

  notional := p_quantity * p_price;
  fee := round(notional * (p_fee_bps / 10000.0), 8);

  SELECT *
  INTO holding_row
  FROM public.holdings
  WHERE user_id = uid
    AND market = p_market
    AND symbol = p_symbol
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF p_side = 'buy' THEN
    IF account_row.balance_usd < (notional + fee) THEN
      RAISE EXCEPTION 'Insufficient paper buying power';
    END IF;

    new_cash := account_row.balance_usd - notional - fee;

    IF FOUND THEN
      new_qty := holding_row.quantity + p_quantity;
      new_avg := CASE
        WHEN new_qty > 0
        THEN ((holding_row.quantity * holding_row.avg_cost) + notional) / new_qty
        ELSE p_price
      END;

      UPDATE public.holdings
      SET quantity = new_qty,
          avg_cost = new_avg,
          last_price = p_price,
          name = COALESCE(NULLIF(p_name, ''), name),
          updated_at = now()
      WHERE id = holding_row.id;
    ELSE
      new_qty := p_quantity;
      new_avg := p_price;

      INSERT INTO public.holdings (
        user_id, market, symbol, name, quantity, avg_cost, last_price
      )
      VALUES (
        uid, p_market, p_symbol, NULLIF(p_name, ''), p_quantity, p_price, p_price
      );
    END IF;
  ELSE
    IF NOT FOUND OR holding_row.quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient paper position';
    END IF;

    new_qty := holding_row.quantity - p_quantity;
    new_avg := holding_row.avg_cost;
    new_cash := account_row.balance_usd + notional - fee;

    IF new_qty <= 0 THEN
      DELETE FROM public.holdings WHERE id = holding_row.id;
      new_qty := 0;
      new_avg := 0;
    ELSE
      UPDATE public.holdings
      SET quantity = new_qty,
          last_price = p_price,
          updated_at = now()
      WHERE id = holding_row.id;
    END IF;
  END IF;

  UPDATE public.accounts
  SET balance_usd = new_cash,
      updated_at = now()
  WHERE id = account_row.id;

  INSERT INTO public.transactions (
    user_id, market, symbol, side, order_type, quantity, price, fees,
    status, mode, notes, executed_at
  )
  VALUES (
    uid, p_market, p_symbol, p_side, 'market', p_quantity, p_price, fee,
    'filled', 'sim', 'Terminal paper fill using server-verified Alpaca reference price', now()
  )
  RETURNING id INTO tx_id;

  RETURN jsonb_build_object(
    'transaction_id', tx_id,
    'symbol', p_symbol,
    'market', p_market,
    'side', p_side,
    'quantity', p_quantity,
    'price', p_price,
    'notional', notional,
    'fees', fee,
    'cash', new_cash,
    'position_quantity', new_qty,
    'average_cost', new_avg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_paper_trade(text,text,text,text,numeric,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_paper_trade(text,text,text,text,numeric,numeric,numeric) TO authenticated;
