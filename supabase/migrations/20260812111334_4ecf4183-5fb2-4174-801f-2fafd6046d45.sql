CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_tokens (
  id integer PRIMARY KEY DEFAULT 1,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.cron_tokens (id, token)
VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_tokens WHERE token = _token);
$$;

REVOKE EXECUTE ON FUNCTION public.verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text) TO service_role;

CREATE OR REPLACE FUNCTION private.call_engine(_job text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  _token text;
BEGIN
  SELECT token INTO _token FROM private.cron_tokens WHERE id = 1;
  PERFORM extensions.net_http_post(
    url := 'https://project--14db9673-7112-461f-a45a-95239240b1ca.lovable.app/api/public/cron/' || _job,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', _token),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('aurum-prices', '*/15 * * * *', $$SELECT private.call_engine('prices')$$);
SELECT cron.schedule('aurum-news', '*/20 * * * *', $$SELECT private.call_engine('news')$$);
SELECT cron.schedule('aurum-signals', '7 * * * *', $$SELECT private.call_engine('signals')$$);
SELECT cron.schedule('aurum-trade', '12 * * * *', $$SELECT private.call_engine('trade')$$);
SELECT cron.schedule('aurum-digest', '0 21 * * *', $$SELECT private.call_engine('digest')$$);