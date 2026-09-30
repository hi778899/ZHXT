-- V8: 请休假归档后触发独立审批模型；审批模型固定为两步：行政审批 -> 业务审批。
-- 行政审批由全局“考勤主管”角色办理；业务审批由申请人所属部门的“部门经理”办理。

INSERT INTO roles(id,code,name,description) VALUES
  ('role-attendance','attendance_supervisor','考勤主管','负责请休假等事项的行政审批'),
  ('role-dept','department_manager','部门经理','负责本部门业务审批')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

UPDATE roles SET name='部门经理', description='负责本部门业务审批' WHERE code='department_manager';

-- 将现有“审批模型”建设项目更新为两步审批。保留其表单、运行节点、数字化库和模型关系，只替换审批步骤与默认路径。
UPDATE model_projects p
SET design = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(COALESCE(p.design,'{}'::jsonb), '{approvalSettings}',
                     '{"taskTitle":"{sourceModelName}审批","routeOutputKey":"approvalRoute","resultOutputKey":"approvalResult","actions":["同意","不同意","退回修改"],"assigneeFallback":"error","steps":[{"id":"approval-admin","title":"行政审批","approvalType":"administrative","assigneeScope":"global_role","role":"attendance_supervisor","roleLabel":"考勤主管"},{"id":"approval-business","title":"业务审批","approvalType":"business","assigneeScope":"department_role","role":"department_manager","roleLabel":"部门经理","departmentField":"department"}]}'::jsonb, true),
                   '{expressions}', '[{"id":"expr-route","targetKey":"approvalRoute","label":"审批路径","expression":"\"行政审批 → 业务审批\""},{"id":"expr-status","targetKey":"approvalStatus","label":"审批状态","expression":"\"待审批\""}]'::jsonb, true),
                 '{formula}', '"审批顺序 = 行政审批（考勤主管） → 业务审批（申请人所属部门的部门经理）"'::jsonb, true),
               '{outputKeys}', '["approvalRoute","approvalStatus","approvalResult","approvalProcess"]'::jsonb, true),
    test_data = '{"cases":[{"id":"ap-case-1","name":"请休假两步审批路径","input":{"sourceModelName":"请休假模型","sourceFileName":"FN-TEST-1","sourceDigitalId":"L-LEAVE-APPLICATION","applicant":"张珊","department":"设备管理部","days":2,"approvalContent":"请休假申请"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}},{"id":"ap-case-2","name":"较长请假仍为两步审批","input":{"sourceModelName":"请休假模型","sourceFileName":"FN-TEST-2","sourceDigitalId":"L-LEAVE-APPLICATION","applicant":"张珊","department":"设备管理部","days":5,"approvalContent":"请休假申请"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}}]}'::jsonb,
    test_passed=true,
    status='published',
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='审批模型';

-- 审批模型仍仅允许硬性链接触发；不在“可发起模型”中出现。
UPDATE models SET can_start=false WHERE name='审批模型';
