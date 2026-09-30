ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS engine_source TEXT NOT NULL DEFAULT 'vibe',
  ADD COLUMN IF NOT EXISTS result_text TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'research',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.lab_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL,
  strategy TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis TEXT,
  source TEXT NOT NULL DEFAULT 'local+gemini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_runs TO authenticated;
GRANT ALL ON public.lab_runs TO service_role;
ALTER TABLE public.lab_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own lab runs" ON public.lab_runs;
CREATE POLICY "own lab runs" ON public.lab_runs
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lab_runs_user_created
ON public.lab_runs(user_id, created_at DESC);
