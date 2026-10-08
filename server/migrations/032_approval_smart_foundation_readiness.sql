-- V17.7.26 审批/智选基础模型库就绪审计。
-- 本 migration 只建立审计结构，不直接 INSERT 任何基础业务 digital_library_records。
CREATE TABLE IF NOT EXISTS foundation_model_library_readiness_issues (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('approval','smart')),
  library_id text NOT NULL,
  producer_model_name TEXT NOT NULL,
  requirement TEXT NOT NULL CHECK (requirement IN ('hard','supporting')),
  reason TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS foundation_model_library_readiness_scope_idx
  ON foundation_model_library_readiness_issues(scope,resolved_at,library_id);
