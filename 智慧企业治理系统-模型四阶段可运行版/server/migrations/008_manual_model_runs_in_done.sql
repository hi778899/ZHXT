ALTER TABLE model_runs
  ADD COLUMN IF NOT EXISTS trigger_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE model_runs
  ADD COLUMN IF NOT EXISTS source_run_id TEXT;

CREATE INDEX IF NOT EXISTS model_runs_owner_trigger_idx
  ON model_runs(owner_id, trigger_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS model_runs_source_run_idx
  ON model_runs(source_run_id)
  WHERE source_run_id IS NOT NULL;

-- 兼容 V10 及以前已经生成的跨模型运行记录：凡带有前序 sourceRunId 的记录均不是用户手工发起。
UPDATE model_runs
SET trigger_mode = CASE
    WHEN COALESCE(NULLIF(input_data->>'sourceRunId',''),'') <> '' THEN 'hard_link'
    ELSE COALESCE(NULLIF(trigger_mode,''),'manual')
  END,
  source_run_id = COALESCE(source_run_id, NULLIF(input_data->>'sourceRunId',''));
