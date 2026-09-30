-- V12: 审批模型归档并触发智选模型后，为原业务发起人生成“智选结果待确认”。
-- 智选模型仍然自动执行并决定是否触发后续业务模型；该待办仅用于让发起人看见智选结果，不要求人工参与智选判断。

INSERT INTO todos(id,title,model,sender,owner_id,status,content,run_id,step_index,created_at,updated_at)
SELECT
  'smart-view-' || r.id,
  COALESCE(NULLIF(r.input_data->'sourceInput'->>'sourceModelName',''), NULLIF(r.input_data->>'sourceModelName',''), '业务事项') || ' · 智选结果',
  '智选模型',
  '系统',
  r.owner_id,
  '待确认',
  jsonb_build_object(
    'type','smart_result_v1',
    'sourceModelName',COALESCE(NULLIF(r.input_data->>'sourceModelName',''),'审批模型'),
    'businessSourceModelName',COALESCE(NULLIF(r.input_data->'sourceInput'->>'sourceModelName',''), NULLIF(r.input_data->>'sourceModelName',''), '业务事项'),
    'approvalResult',COALESCE(r.input_data->>'approvalResult', r.input_data->'sourceOutput'->>'approvalResult',''),
    'smartDecision',COALESCE(r.output_data->>'smartDecision',''),
    'triggeredModels',COALESCE((
      SELECT jsonb_agg(m2.name ORDER BY child.created_at)
      FROM model_runs child
      JOIN models m2 ON m2.id=child.model_id
      WHERE child.source_run_id=r.id
    ), '[]'::jsonb),
    'triggerError','',
    'businessData',
      COALESCE(r.input_data->'sourceInput'->'sourceInput','{}'::jsonb)
      || COALESCE(r.input_data->'sourceInput'->'sourceOutput','{}'::jsonb)
  )::text,
  r.id,
  0,
  COALESCE(r.completed_at,r.created_at),
  COALESCE(r.completed_at,r.created_at)
FROM model_runs r
JOIN models m ON m.id=r.model_id
WHERE m.name='智选模型'
  AND r.status='已归档'
  AND NOT EXISTS (
    SELECT 1 FROM todos t WHERE t.run_id=r.id AND t.model='智选模型'
  )
ON CONFLICT (id) DO NOTHING;
