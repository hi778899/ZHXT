-- V17.7.20：考勤主管与基础数字化模型审批入口前置数据修正。
--
-- 说明：正式数字化库补齐由 seed.ts 通过各自“数据产生模型”的 system_sync 运行形成，
-- 本 migration 只处理用户/部门关系这一非数字化库基础数据，避免直接写入 run_id=NULL 的数字化库记录。

INSERT INTO departments(id,name)
SELECT 'dept-org-hr-v17720','组织人事部'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name='组织人事部');

-- 历史默认考勤主管曾被放入“综合管理部”，但0622组织名称数字化库不存在该组织。
-- 仅修复系统默认/空部门场景；管理员后续明确维护的其他正式部门不覆盖。
UPDATE users u
SET department='组织人事部',
    department_id=(SELECT id FROM departments WHERE name='组织人事部' ORDER BY created_at,id LIMIT 1),
    updated_at=now()
WHERE u.role='attendance_supervisor'
  AND COALESCE(NULLIF(btrim(u.department),''),'综合管理部')='综合管理部';
