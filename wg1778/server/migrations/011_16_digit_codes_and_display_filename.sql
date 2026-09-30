-- V14: 数字化编码统一为16位；文件名=模型数字化编码-发起人人员数字化编码-时间码；增加中文显示名称。

ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code TEXT;
CREATE SEQUENCE IF NOT EXISTS employee_digital_code_seq START WITH 4;

UPDATE users SET employee_code='5011002000000001' WHERE lower(username)='zhangshan';
UPDATE users SET employee_code='5011002000000002' WHERE lower(username)='deptmanager';
UPDATE users SET employee_code='5011002000000003' WHERE lower(username)='attendance';

WITH unmapped AS (
  SELECT id, row_number() OVER (ORDER BY created_at,id) + 3 AS seq
  FROM users
  WHERE lower(username) NOT IN ('zhangshan','deptmanager','attendance')
)
UPDATE users u
SET employee_code='5011002' || lpad(unmapped.seq::text,9,'0')
FROM unmapped
WHERE u.id=unmapped.id;

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_code_uq ON users(employee_code);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_code_16_check;
ALTER TABLE users ADD CONSTRAINT users_employee_code_16_check CHECK (employee_code ~ '^[0-9]{16}$');
ALTER TABLE users ALTER COLUMN employee_code SET NOT NULL;
SELECT setval('employee_digital_code_seq', GREATEST(COALESCE((SELECT max(right(employee_code,9)::bigint) FROM users),3),3), true);

ALTER TABLE model_runs ADD COLUMN IF NOT EXISTS display_file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE query_records ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

-- 内置四阶段模板统一使用16位模型数字化编码和16位数字化标识。
WITH code_map(model_name,model_code,digital_id) AS (
  VALUES
    ('审批模型','5011001005001001','5013001005001001'),
    ('请休假模型','5011001005001002','5013001005001002'),
    ('智选模型','5011001005001003','5013001005001003'),
    ('会议议题提报','5011001006001001','5013001006001001'),
    ('会议收集','5011001006001002','5013001006001002'),
    ('会议议题编组','5011001006001003','5013001006001003'),
    ('会议议题审定','5011001006001004','5013001006001004'),
    ('会议组织','5011001006001005','5013001006001005'),
    ('会议通知','5011001006001006','5013001006001006'),
    ('会议','5011001006001008','5013001006001008'),
    ('会议纪要','5011001006001009','5013001006001009'),
    ('参会反馈','5011001006001010','5013001006001010')
)
UPDATE model_projects p
SET configuration=(p.configuration - 'fileNamePrefix') || jsonb_build_object(
      'modelCode',c.model_code,
      'fileNameRule','模型数字化编码-发起人人员数字化编码-时间码',
      'displayFileNameRule','模型中文名称-发起人姓名-时间码',
      'digitalIdentities',jsonb_build_array(c.digital_id)
    ),
    updated_at=now()
FROM models m, code_map c
WHERE p.model_id=m.id AND m.name=c.model_name;

-- 智选模型显式保存系统文件名、中文显示名称、数字化标识与关联数字化标识。
UPDATE model_projects p
SET design=jsonb_set(
      jsonb_set(
        p.design,
        '{fields}',
        '[
          {"id":"sm-model","label":"业务模型","key":"businessSourceModelName","type":"text","readonly":true,"required":true,"width":6},
          {"id":"sm-file","label":"文件名","key":"businessFileName","type":"text","readonly":true,"required":true,"width":12},
          {"id":"sm-display-file","label":"中文显示名称","key":"businessDisplayFileName","type":"text","readonly":true,"required":true,"width":12},
          {"id":"sm-id","label":"数字化标识","key":"businessDigitalId","type":"text","readonly":true,"required":true,"width":6},
          {"id":"sm-related-id","label":"关联数字化标识","key":"associatedDigitalIds","type":"text","readonly":true,"required":false,"width":6},
          {"id":"sm-result","label":"审批结果","key":"approvalResult","type":"text","readonly":true,"required":false,"width":6}
        ]'::jsonb,
        true
      ),
      '{outputKeys}',
      '["smartDecision","businessSourceModelName","businessFileName","businessDisplayFileName","businessDigitalId","associatedDigitalIds","associatedModels"]'::jsonb,
      true
    ),
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='智选模型';

UPDATE model_projects p
SET test_data='{"cases":[{"id":"sm-c1","name":"请休假模型无后续关联","input":{"businessSourceModelName":"请休假模型","businessFileName":"5011001005001002-5011002000000001-20260907031848","businessDisplayFileName":"请假模型-张珊-20260907031848","businessDigitalId":"5013001005001002","approvalResult":"同意"},"expectValid":true,"expectedOutput":{"smartDecision":"本模型（请休假模型）没有后续关联的模型","businessFileName":"5011001005001002-5011002000000001-20260907031848","businessDisplayFileName":"请假模型-张珊-20260907031848","businessDigitalId":"5013001005001002","associatedDigitalIds":[]}},{"id":"sm-c2","name":"审批未通过","input":{"businessSourceModelName":"请休假模型","businessFileName":"5011001005001002-5011002000000001-20260907031848","businessDisplayFileName":"请假模型-张珊-20260907031848","businessDigitalId":"5013001005001002","approvalResult":"不同意"},"expectValid":true,"expectedOutput":{"smartDecision":"本模型（请休假模型）没有后续关联的模型","associatedDigitalIds":[]}}]}'::jsonb,
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='智选模型';

-- 把已有运行记录转换成新文件名和16位数字化标识，确保升级后立即可见新格式。
CREATE TEMP TABLE v14_run_map ON COMMIT DROP AS
SELECT r.id AS run_id,r.owner_id,r.model_id,r.file_name AS old_file_name,r.digital_id AS old_digital_id,
       p.configuration->>'modelCode' AS model_code,
       p.configuration->'digitalIdentities'->>0 AS new_digital_id,
       u.employee_code,
       to_char(r.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS stamp,
       (p.configuration->>'modelCode') || '-' || u.employee_code || '-' || to_char(r.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS new_file_name,
       (CASE WHEN m.name='请休假模型' THEN '请假模型' ELSE m.name END) || '-' || u.display_name || '-' || to_char(r.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS display_file_name,
       m.name AS model_name
FROM model_runs r
JOIN model_projects p ON p.id=r.project_id
JOIN models m ON m.id=r.model_id
JOIN users u ON u.id=r.owner_id
WHERE COALESCE(p.configuration->>'modelCode','') ~ '^[0-9]{16}$'
  AND COALESCE(p.configuration->'digitalIdentities'->>0,'') ~ '^[0-9]{16}$'
  AND u.employee_code ~ '^[0-9]{16}$';

UPDATE query_records q
SET record_name=rm.new_file_name,
    display_name=rm.display_file_name,
    digital_id=rm.new_digital_id
FROM v14_run_map rm
WHERE q.owner_id=rm.owner_id AND q.record_name=rm.old_file_name;

UPDATE digital_library_records d
SET digital_id=rm.new_digital_id,
    data=jsonb_set(jsonb_set(d.data,'{fileName}',to_jsonb(rm.new_file_name),true),'{displayFileName}',to_jsonb(rm.display_file_name),true)
FROM v14_run_map rm
WHERE d.run_id=rm.run_id;

UPDATE model_runs r
SET file_name=rm.new_file_name,
    display_file_name=rm.display_file_name,
    digital_id=rm.new_digital_id
FROM v14_run_map rm
WHERE r.id=rm.run_id;

-- 直接前序模型信息同步为新文件名/新数字化标识。
UPDATE model_runs child
SET input_data=child.input_data || jsonb_build_object(
      'sourceFileName',parent.new_file_name,
      'sourceDisplayFileName',parent.display_file_name,
      'sourceDigitalId',parent.new_digital_id
    )
FROM v14_run_map parent
WHERE child.source_run_id=parent.run_id;

-- 智选模型保留最初业务模型（例如请休假模型）的新文件名和中文显示名称。
WITH smart_source AS (
  SELECT smart.id AS smart_run_id,biz.new_file_name,biz.display_file_name,biz.new_digital_id,biz.run_id AS business_run_id,biz.model_name
  FROM model_runs smart
  JOIN models sm ON sm.id=smart.model_id AND sm.name='智选模型'
  JOIN model_runs approval ON approval.id=smart.source_run_id
  JOIN v14_run_map biz ON biz.run_id=approval.source_run_id
)
UPDATE model_runs smart
SET input_data=smart.input_data || jsonb_build_object(
      'businessSourceModelName',ss.model_name,
      'businessFileName',ss.new_file_name,
      'businessDisplayFileName',ss.display_file_name,
      'businessDigitalId',ss.new_digital_id,
      'businessRunId',ss.business_run_id
    ),
    output_data=smart.output_data || jsonb_build_object(
      'businessSourceModelName',ss.model_name,
      'businessFileName',ss.new_file_name,
      'businessDisplayFileName',ss.display_file_name,
      'businessDigitalId',ss.new_digital_id
    )
FROM smart_source ss
WHERE smart.id=ss.smart_run_id;

WITH smart_source AS (
  SELECT smart.id AS smart_run_id,biz.new_file_name,biz.display_file_name,biz.new_digital_id,biz.model_name
  FROM model_runs smart
  JOIN models sm ON sm.id=smart.model_id AND sm.name='智选模型'
  JOIN model_runs approval ON approval.id=smart.source_run_id
  JOIN v14_run_map biz ON biz.run_id=approval.source_run_id
)
UPDATE todos t
SET content=(t.content::jsonb || jsonb_build_object(
      'type','smart_result_v3',
      'businessSourceModelName',ss.model_name,
      'businessFileName',ss.new_file_name,
      'businessDisplayFileName',ss.display_file_name,
      'businessDigitalId',ss.new_digital_id,
      'associatedDigitalIds',COALESCE(t.content::jsonb->'associatedDigitalIds','[]'::jsonb)
    ))::text,
    updated_at=now()
FROM smart_source ss
WHERE t.run_id=ss.smart_run_id AND t.model='智选模型' AND ltrim(t.content) LIKE '{%';
