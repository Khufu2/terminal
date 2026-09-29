CREATE TABLE IF NOT EXISTS public.research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  engine_session_id TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_runs TO authenticated;
GRANT ALL ON public.research_runs TO service_role;
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own research runs" ON public.research_runs;
CREATE POLICY "own research runs" ON public.research_runs
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_research_runs_user_created
ON public.research_runs(user_id, created_at DESC);
