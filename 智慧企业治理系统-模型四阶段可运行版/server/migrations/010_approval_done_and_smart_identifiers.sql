-- V13: 发起人已办展示审批模型；智选模型保留原业务文件名、数字化标识、关联数字化标识。
-- “审批模型已办”由 /api/dashboard 动态读取已归档 model_runs，无需复制生成新的 todos 记录。

-- 1. 更新已有智选模型设计字段，使四阶段设计中明确包含：业务模型、文件名、数字化标识、关联数字化标识、审批结果。
UPDATE model_projects p
SET design = jsonb_set(
  jsonb_set(
    jsonb_set(
      p.design,
      '{fields}',
      '[
        {"id":"sm-model","label":"业务模型","key":"businessSourceModelName","type":"text","readonly":true,"required":true,"width":6},
        {"id":"sm-file","label":"文件名","key":"businessFileName","type":"text","readonly":true,"required":true,"width":12},
        {"id":"sm-id","label":"数字化标识","key":"businessDigitalId","type":"text","readonly":true,"required":true,"width":6},
        {"id":"sm-related-id","label":"关联数字化标识","key":"associatedDigitalIds","type":"text","readonly":true,"required":false,"width":6},
        {"id":"sm-result","label":"审批结果","key":"approvalResult","type":"text","readonly":true,"required":false,"width":6,"source":"审批模型"}
      ]'::jsonb,
      true
    ),
    '{outputKeys}',
    '["smartDecision","businessSourceModelName","businessFileName","businessDigitalId","associatedDigitalIds","associatedModels"]'::jsonb,
    true
  ),
  '{formula}',
  to_jsonb('读取原业务模型文件名与数字化标识；查询标识关联配置；有匹配关联则形成关联数字化标识并触发目标模型，无匹配关联则记录本模型没有后续关联的模型。'::text),
  true
),
updated_at = now()
FROM models m
WHERE m.id = p.model_id
  AND m.name = '智选模型';

-- 2. 兼容 V12 已生成的智选待办：补齐原业务模型文件名、数字化标识、关联数字化标识，
--    没有后续关联模型时明确显示“本模型（XXX）没有后续关联的模型”。
WITH smart_rows AS (
  SELECT
    t.id AS todo_id,
    r.id AS run_id,
    t.content::jsonb AS old_content,
    COALESCE(
      NULLIF(r.input_data->>'businessSourceModelName',''),
      NULLIF(r.input_data->>'sourceModelName',''),
      NULLIF(r.input_data->'sourceInput'->>'sourceModelName',''),
      NULLIF(r.input_data->'sourceInput'->'sourceInput'->>'sourceModelName',''),
      '业务模型'
    ) AS business_model,
    COALESCE(
      NULLIF(r.input_data->>'businessFileName',''),
      NULLIF(r.input_data->>'sourceFileName',''),
      NULLIF(r.input_data->'sourceInput'->>'sourceFileName',''),
      NULLIF(r.input_data->'sourceInput'->'sourceInput'->>'sourceFileName',''),
      ''
    ) AS business_file_name,
    COALESCE(
      NULLIF(r.input_data->>'businessDigitalId',''),
      NULLIF(r.input_data->>'sourceDigitalId',''),
      NULLIF(r.input_data->'sourceInput'->>'sourceDigitalId',''),
      NULLIF(r.input_data->'sourceInput'->'sourceInput'->>'sourceDigitalId',''),
      ''
    ) AS business_digital_id
  FROM todos t
  JOIN model_runs r ON r.id = t.run_id
  WHERE t.model = '智选模型'
    AND left(trim(t.content), 1) = '{'
    AND COALESCE(t.content::jsonb->>'type','') IN ('smart_result_v1','smart_result_v2')
)
UPDATE todos t
SET content = (
  s.old_content
  || jsonb_build_object(
    'type','smart_result_v2',
    'businessSourceModelName',s.business_model,
    'businessFileName',s.business_file_name,
    'businessDigitalId',s.business_digital_id,
    'associatedDigitalIds',
      CASE
        WHEN jsonb_array_length(COALESCE(s.old_content->'triggeredModels','[]'::jsonb)) > 0
             AND s.business_digital_id <> ''
          THEN jsonb_build_array(s.business_digital_id)
        ELSE '[]'::jsonb
      END,
    'smartDecision',
      CASE
        WHEN jsonb_array_length(COALESCE(s.old_content->'triggeredModels','[]'::jsonb)) = 0
          THEN '本模型（' || s.business_model || '）没有后续关联的模型'
        ELSE COALESCE(NULLIF(s.old_content->>'smartDecision',''), '已匹配后续关联模型')
      END
  )
)::text,
updated_at = now()
FROM smart_rows s
WHERE t.id = s.todo_id;
