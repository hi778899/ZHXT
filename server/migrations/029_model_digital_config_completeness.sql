-- V17.7.21：全系统模型数字化配置完整性异常清单。
-- 正式模型数字化配置仍由“模型数字化配置模型”的真实 system_sync/model_publish 运行形成，
-- 本迁移仅建立完整性审计表，不直接制造 run_id=NULL 的数字化库记录。

CREATE TABLE IF NOT EXISTS model_digital_config_completeness_issues (
  id uuid PRIMARY KEY,
  model_id text NOT NULL,
  project_id text,
  model_name text NOT NULL,
  model_code text,
  reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_model_digital_config_completeness_open
  ON model_digital_config_completeness_issues(model_id, detected_at DESC)
  WHERE resolved_at IS NULL;
