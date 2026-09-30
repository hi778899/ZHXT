-- V17.7.8：业务模型数字化库正式入库后硬性触发通用审批模型。
-- 目的：兼容历史四阶段项目 relations 缺失/误删，并记录模型簇触发失败；不修改历史已归档业务结果。

CREATE TABLE IF NOT EXISTS model_trigger_failures (
  id text PRIMARY KEY,
  source_run_id text,
  source_model_name text NOT NULL,
  source_model_code text,
  source_file_name text,
  target_model_name text NOT NULL,
  trigger_mode text NOT NULL,
  status text NOT NULL DEFAULT '失败',
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_trigger_failures_source_run_idx ON model_trigger_failures(source_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_trigger_failures_created_at_idx ON model_trigger_failures(created_at DESC);

-- 对所有已发布、模型类型为 business 的历史项目补齐“业务 → 审批”系统固定关系。
-- 运行引擎本身也有同一硬性规则，因此即使关系后续被误删，运行链路仍不能断开。
WITH business_projects AS (
  SELECT p.id, COALESCE(p.configuration,'{}'::jsonb) AS cfg
  FROM model_projects p
  WHERE p.status='published'
    AND COALESCE(p.suggestion->>'modelType','business')='business'
), repaired AS (
  SELECT id,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          cfg,
          '{relations}',
          jsonb_build_array(jsonb_build_object(
            'id','system-business-approval',
            'enabled',true,
            'mode','hard_link',
            'targetModelName','审批模型',
            'condition',jsonb_build_object('fieldKey','','operator','always','value',''),
            'description','系统固定链路：业务模型数字化库正式入库后必须启动通用审批模型'
          )) || COALESCE((
            SELECT jsonb_agg(item)
            FROM jsonb_array_elements(COALESCE(cfg->'relations','[]'::jsonb)) item
            WHERE COALESCE(item->>'targetModelName','') <> '审批模型'
          ), '[]'::jsonb),
          true
        ),
        '{afterArchiveEnabled}','true'::jsonb,true
      ),
      '{nextModelName}',to_jsonb('审批模型'::text),true
    ) AS new_cfg
  FROM business_projects
)
UPDATE model_projects p
SET configuration=r.new_cfg, updated_at=now()
FROM repaired r
WHERE p.id=r.id;
