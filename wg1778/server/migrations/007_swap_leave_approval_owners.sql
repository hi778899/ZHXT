-- V9：修正请休假独立审批模型的两步负责人。
-- 第1步“行政审批”由申请人所属部门的“部门经理”办理；
-- 第2步“业务审批”由全局“考勤主管”办理。

UPDATE roles SET name='部门经理', description='负责本部门请休假等事项的行政审批' WHERE code='department_manager';
UPDATE roles SET name='考勤主管', description='负责请休假等事项的业务审批' WHERE code='attendance_supervisor';

UPDATE model_projects p
SET design = jsonb_set(
               jsonb_set(
                 jsonb_set(
                   COALESCE(p.design,'{}'::jsonb),
                   '{approvalSettings}',
                   '{"taskTitle":"{sourceModelName}审批","routeOutputKey":"approvalRoute","resultOutputKey":"approvalResult","actions":["同意","不同意","退回修改"],"assigneeFallback":"error","steps":[{"id":"approval-admin","title":"行政审批","approvalType":"administrative","assigneeScope":"department_role","role":"department_manager","roleLabel":"部门经理","departmentField":"department"},{"id":"approval-business","title":"业务审批","approvalType":"business","assigneeScope":"global_role","role":"attendance_supervisor","roleLabel":"考勤主管"}]}'::jsonb,
                   true
                 ),
                 '{expressions}',
                 '[{"id":"expr-route","targetKey":"approvalRoute","label":"审批路径","expression":"\"行政审批 → 业务审批\""},{"id":"expr-status","targetKey":"approvalStatus","label":"审批状态","expression":"\"待审批\""}]'::jsonb,
                 true
               ),
               '{formula}',
               '"审批顺序 = 行政审批（申请人所属部门的部门经理） → 业务审批（考勤主管）"'::jsonb,
               true
             ),
    test_data = '{"cases":[{"id":"ap-case-1","name":"请休假两步审批路径","input":{"sourceModelName":"请休假模型","sourceFileName":"FN-TEST-1","sourceDigitalId":"L-LEAVE-APPLICATION","applicant":"张珊","department":"设备管理部","days":2,"approvalContent":"请休假申请"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}},{"id":"ap-case-2","name":"较长请假仍为两步审批","input":{"sourceModelName":"请休假模型","sourceFileName":"FN-TEST-2","sourceDigitalId":"L-LEAVE-APPLICATION","applicant":"张珊","department":"设备管理部","days":5,"approvalContent":"请休假申请"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}}]}'::jsonb,
    test_passed=true,
    status='published',
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='审批模型';
