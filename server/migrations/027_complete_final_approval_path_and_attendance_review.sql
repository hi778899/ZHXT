-- V17.7.19：完整 Path_final 执行与员工请休假业务审查配置修正。
--
-- 规则：行政审批子路径完成不等于审批模型完成；所有 Path_final 必经节点完成后方可归档。
-- 本迁移只补齐审批分管数字化库中的正式配置，使“考勤管理”业务能够匹配业务审核岗。
-- 审批运行仍由通用 0622 运行引擎根据数字化库动态计算，不在代码中写死具体人员姓名。

DO $$
DECLARE
  r RECORD;
  current_value TEXT;
  new_value TEXT;
BEGIN
  FOR r IN
    SELECT id, data
    FROM digital_library_records
    WHERE library_id='lib-standard-approval-assignment'
      AND data->>'数据版本'='0622'
      AND data->>'职级含义'='业务审核岗'
  LOOP
    current_value := COALESCE(r.data->>'技术复核分管业务属性集合','');
    IF current_value NOT LIKE '%5012001005001000000%' THEN
      new_value := CASE
        WHEN btrim(current_value) IN ('','—','无') THEN '5012001005001000000'
        ELSE current_value || '；5012001005001000000'
      END;
      UPDATE digital_library_records
      SET data = jsonb_set(
        jsonb_set(data,'{技术复核分管业务属性集合}',to_jsonb(new_value),true),
        '{V17.7.19配置说明}',
        to_jsonb('考勤管理进入业务审核岗形成技术/业务审查节点；行政审批完成后必须继续执行完整Path_final'::text),
        true
      )
      WHERE id=r.id;
    END IF;
  END LOOP;
END $$;

-- 对系统自动形成的考勤主管员工配置再次确保考勤管理业务领域存在。
UPDATE digital_library_records
SET data=jsonb_set(
  data,
  '{业务领域}',
  to_jsonb(
    CASE
      WHEN COALESCE(data->>'业务领域','') LIKE '%5012001005001000000%' THEN data->>'业务领域'
      WHEN btrim(COALESCE(data->>'业务领域','')) IN ('','—','无') THEN '5012001005001000000'
      ELSE data->>'业务领域' || '；5012001005001000000'
    END
  ),true
)
WHERE library_id='lib-standard-person'
  AND data->>'数据版本'='0622'
  AND COALESCE(data->>'岗位/角色','')='考勤主管';

-- 保持方案A的模型运行归档一致性：若该配置记录已有真实 run_id，同步更新其模型运行输出快照。
UPDATE model_runs r
SET output_data = jsonb_set(COALESCE(r.output_data,'{}'::jsonb),'{data}',d.data,true)
FROM digital_library_records d
WHERE d.run_id=r.id
  AND d.library_id IN ('lib-standard-approval-assignment','lib-standard-person')
  AND (
    (d.data->>'数据版本'='0622' AND d.data->>'职级含义'='业务审核岗')
    OR (d.data->>'数据版本'='0622' AND d.data->>'岗位/角色'='考勤主管')
  );
