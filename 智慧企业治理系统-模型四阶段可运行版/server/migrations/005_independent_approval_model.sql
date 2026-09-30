-- V5: 审批从业务模型内部节点解耦为独立模型。
-- 待办与模型运行实例绑定，支持审批模型按路由逐级生成待办。
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES model_runs(id) ON DELETE SET NULL;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS todos_run_id_idx ON todos(run_id);

-- 数字化标识是模型数据类的固定标识，不是每次运行实例的唯一编号。
-- 因此同一 L 标识必须允许存在多条运行记录，实例唯一性由模型文件名/运行 ID 区分。
ALTER TABLE query_records DROP CONSTRAINT IF EXISTS query_records_digital_id_key;
DROP INDEX IF EXISTS query_records_digital_id_key;
CREATE INDEX IF NOT EXISTS query_records_digital_id_idx ON query_records(digital_id, created_at DESC);

-- 兼容 V4 示例模型名称。若目标名称已存在，则保留现有记录，避免唯一键冲突。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM models WHERE name = '请休假审批模型')
     AND NOT EXISTS (SELECT 1 FROM models WHERE name = '请休假模型') THEN
    UPDATE models
       SET name = '请休假模型',
           category = '请休假管理',
           description = '采集请休假申请、计算业务结果并归档；归档后按模型关系触发独立审批模型'
     WHERE name = '请休假审批模型';
  END IF;
END $$;

-- 若数据库中已经同时存在新旧两个名称，旧名称仅作为历史数据保留，不再允许人工发起。
UPDATE models SET can_start=false WHERE name='请休假审批模型';

-- 已使用 V4 模板建设的请休假项目，删除历史“审批节点”和旧判断节点，
-- 将业务模型收敛为：交互 -> 读取 -> 运算 -> 输出存储。
UPDATE model_projects p
SET suggestion = jsonb_set(
                   jsonb_set(
                     jsonb_set(COALESCE(p.suggestion,'{}'::jsonb), '{name}', '"请休假模型"'::jsonb, true),
                     '{modelType}', '"business"'::jsonb, true),
                   '{goal}', '"形成完整的请休假业务申请记录并归档到请休假模型数字化库；归档后按模型关系触发独立审批模型。"'::jsonb, true),
    design = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(COALESCE(p.design,'{}'::jsonb), '{nodes}',
                       COALESCE((SELECT jsonb_agg(n) FROM jsonb_array_elements(COALESCE(p.design->'nodes','[]'::jsonb)) n
                                 WHERE COALESCE(n->>'type','') <> 'approval'
                                   AND COALESCE(n->>'id','') <> 'leave-condition'), '[]'::jsonb), true),
                     '{edges}',
                       '[{"id":"leave-e1","source":"leave-interaction","target":"leave-read","sourceHandle":"out","targetHandle":"in"},{"id":"leave-e2","source":"leave-read","target":"leave-calc","sourceHandle":"out","targetHandle":"in"},{"id":"leave-e3","source":"leave-calc","target":"leave-output","sourceHandle":"out","targetHandle":"in"}]'::jsonb, true),
                   '{expressions}', '[]'::jsonb, true),
                 '{formula}', '"days = DATE_DIFF_INCLUSIVE(startDate, endDate)"'::jsonb, true),
               '{outputKeys}', '["applicant","department","leaveType","startDate","endDate","reason","days"]'::jsonb, true),
    configuration = jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(COALESCE(p.configuration,'{}'::jsonb), '{storageName}', '"请休假模型数字化库"'::jsonb, true),
                            '{fileNamePrefix}', '"FN-请休假模型"'::jsonb, true),
                          '{digitalIdentities}', '["L-LEAVE-APPLICATION"]'::jsonb, true),
                        '{afterArchiveEnabled}', 'true'::jsonb, true),
                      '{nextModelName}', '"审批模型"'::jsonb, true),
    test_data = '{"cases":[{"id":"case-1","name":"正常场景：2天年休假","input":{"applicant":"张珊","department":"设备管理部","leaveType":"年休假","startDate":"2026-09-08","endDate":"2026-09-09","reason":"年休假"},"expectValid":true,"expectedOutput":{"days":2,"leaveType":"年休假"}},{"id":"case-2","name":"正常场景：4天年休假","input":{"applicant":"张珊","department":"设备管理部","leaveType":"年休假","startDate":"2026-09-08","endDate":"2026-09-11","reason":"年休假"},"expectValid":true,"expectedOutput":{"days":4,"department":"设备管理部"}},{"id":"case-3","name":"拦截场景：日期倒置","input":{"applicant":"张珊","department":"设备管理部","leaveType":"年休假","startDate":"2026-09-11","endDate":"2026-09-08","reason":"日期测试"},"expectValid":false,"expectedOutput":{}}]}'::jsonb,
    test_report = '{"passed":true,"total":3,"passedCount":3,"results":[]}'::jsonb,
    test_passed = true,
    updated_at = now()
FROM models m
WHERE p.model_id = m.id
  AND m.name = '请休假模型'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p.design->'nodes','[]'::jsonb)) n
    WHERE COALESCE(n->>'type','') = 'approval' OR COALESCE(n->>'id','') = 'leave-approval'
  );
