-- V17.7.11：模型文件名全量统一落地。
-- 规则：模型文件名 = 当前19位模型数字化编码-当前11位员工数字化编码-原运行时间码。
-- 本迁移同步更新运行记录、数字化库、待办/已办/办结承载内容、审批/智选上下游引用及审计映射。

-- 1. 员工编码先统一到当前11位结构；历史编码仅保留迁移审计。
CREATE TABLE IF NOT EXISTS employee_code_migrations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  old_employee_code TEXT NOT NULL,
  new_employee_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'migrated',
  reason TEXT NOT NULL DEFAULT '',
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_code_migrations_new_uq ON employee_code_migrations(new_employee_code);

WITH current_codes AS (
  SELECT right(employee_code,4)::integer AS seq FROM users WHERE employee_code ~ '^5011002[0-9]{4}$'
  UNION ALL
  SELECT right(code,4)::integer AS seq FROM digital_codes WHERE object_type='person' AND code ~ '^5011002[0-9]{4}$'
), current_max AS (
  SELECT GREATEST(COALESCE(max(seq),0),14) AS max_seq FROM current_codes
), legacy_users AS (
  SELECT u.id,u.employee_code,u.created_at,
         row_number() OVER (ORDER BY u.created_at,u.id) AS rn
  FROM users u
  WHERE COALESCE(u.employee_code,'') !~ '^5011002[0-9]{4}$'
), mapped AS (
  SELECT l.id,l.employee_code AS old_code,
         '5011002' || lpad((c.max_seq+l.rn)::text,4,'0') AS new_code
  FROM legacy_users l CROSS JOIN current_max c
)
INSERT INTO employee_code_migrations(user_id,old_employee_code,new_employee_code,status,reason)
SELECT id,COALESCE(old_code,''),new_code,'migrated','历史/非当前员工编码迁移为当前11位员工数字化编码'
FROM mapped
ON CONFLICT(user_id) DO UPDATE SET
  old_employee_code=EXCLUDED.old_employee_code,
  new_employee_code=EXCLUDED.new_employee_code,
  status='migrated',reason=EXCLUDED.reason,migrated_at=now();

UPDATE users u SET employee_code=m.new_employee_code,updated_at=now()
FROM employee_code_migrations m
WHERE u.id=m.user_id AND m.status='migrated' AND u.employee_code IS DISTINCT FROM m.new_employee_code;

UPDATE digital_codes d SET code=m.new_employee_code,display_name=COALESCE(NULLIF(d.display_name,''),u.display_name),updated_at=now()
FROM employee_code_migrations m JOIN users u ON u.id=m.user_id
WHERE d.object_type='person' AND d.object_id=m.user_id AND m.status='migrated';

SELECT setval('employee_digital_code_seq',
  GREATEST(
    COALESCE((SELECT max(right(employee_code,4)::bigint) FROM users WHERE employee_code ~ '^5011002[0-9]{4}$'),0),
    COALESCE((SELECT max(right(code,4)::bigint) FROM digital_codes WHERE object_type='person' AND code ~ '^5011002[0-9]{4}$'),0),
    14
  ),true);

-- 2. 对存在正式19位模型编码映射的项目同步当前模型编码；不自行猜测缺失映射。
UPDATE model_projects p
SET configuration=jsonb_set(COALESCE(p.configuration,'{}'::jsonb),'{modelCode}',to_jsonb(d.code),true),updated_at=now()
FROM digital_codes d
WHERE d.object_type='model' AND d.object_id=p.model_id AND d.code ~ '^5011001[0-9]{12}$'
  AND COALESCE(p.configuration->>'modelCode','') IS DISTINCT FROM d.code;

-- 3. 建立运行文件名永久审计映射。legacy_file_name 只用于审计，现行业务链路只使用 file_name。
ALTER TABLE model_runs ADD COLUMN IF NOT EXISTS legacy_file_name TEXT;
CREATE TABLE IF NOT EXISTS model_file_name_migrations (
  run_id TEXT PRIMARY KEY REFERENCES model_runs(id) ON DELETE CASCADE,
  old_file_name TEXT NOT NULL,
  new_file_name TEXT,
  model_code TEXT,
  employee_code TEXT,
  original_run_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('migrated','exception')),
  reason TEXT NOT NULL DEFAULT '',
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_file_name_migrations_old_idx ON model_file_name_migrations(old_file_name);

WITH raw AS (
  SELECT r.id AS run_id,r.file_name AS old_file_name,r.created_at,
         COALESCE(
           CASE WHEN p.configuration->>'modelCode' ~ '^5011001[0-9]{12}$' THEN p.configuration->>'modelCode' END,
           CASE WHEN d.code ~ '^5011001[0-9]{12}$' THEN d.code END,
           CASE WHEN split_part(r.file_name,'-',1) ~ '^5011001[0-9]{12}$' THEN split_part(r.file_name,'-',1) END
         ) AS model_code,
         CASE WHEN u.employee_code ~ '^5011002[0-9]{4}$' THEN u.employee_code END AS employee_code,
         to_char(r.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS base_stamp,
         count(*) OVER (PARTITION BY r.file_name) AS old_name_count
  FROM model_runs r
  LEFT JOIN model_projects p ON p.id=r.project_id
  LEFT JOIN digital_codes d ON d.object_type='model' AND d.object_id=r.model_id AND d.code ~ '^5011001[0-9]{12}$'
  LEFT JOIN users u ON u.id=r.owner_id
), ranked AS (
  SELECT raw.*,
         row_number() OVER (PARTITION BY model_code,employee_code,base_stamp ORDER BY created_at,run_id) AS time_rank
  FROM raw
), mapped AS (
  SELECT *,
    CASE WHEN old_file_name<>'' AND model_code IS NOT NULL AND employee_code IS NOT NULL AND old_name_count=1 THEN
      model_code || '-' || employee_code || '-' || base_stamp || CASE WHEN time_rank=1 THEN '' ELSE lpad((time_rank-1)::text,3,'0') END
    END AS new_file_name,
    CASE
      WHEN old_file_name='' THEN '旧模型文件名为空，无法建立可审计映射'
      WHEN old_name_count>1 THEN '旧模型文件名存在重复，无法安全按旧名同步跨模型引用'
      WHEN model_code IS NULL THEN '未找到当前19位模型数字化编码映射'
      WHEN employee_code IS NULL THEN '未找到当前11位员工数字化编码映射'
      ELSE ''
    END AS reason
  FROM ranked
)
INSERT INTO model_file_name_migrations(run_id,old_file_name,new_file_name,model_code,employee_code,original_run_time,status,reason)
SELECT run_id,old_file_name,new_file_name,model_code,employee_code,created_at,
       CASE WHEN new_file_name IS NULL THEN 'exception' ELSE 'migrated' END,reason
FROM mapped
ON CONFLICT(run_id) DO UPDATE SET
 old_file_name=EXCLUDED.old_file_name,new_file_name=EXCLUDED.new_file_name,model_code=EXCLUDED.model_code,
 employee_code=EXCLUDED.employee_code,original_run_time=EXCLUDED.original_run_time,status=EXCLUDED.status,
 reason=EXCLUDED.reason,migrated_at=now();

-- 仅允许无歧义旧名进入自动替换映射。
CREATE UNIQUE INDEX IF NOT EXISTS model_file_name_migrations_migrated_old_uq
  ON model_file_name_migrations(old_file_name) WHERE status='migrated';
CREATE UNIQUE INDEX IF NOT EXISTS model_file_name_migrations_migrated_new_uq
  ON model_file_name_migrations(new_file_name) WHERE status='migrated';

-- 4. 通用替换函数：精确/嵌套 JSON 与文本中出现的旧文件名、旧员工编码一并切换。
CREATE OR REPLACE FUNCTION v17711_replace_runtime_text(input_text TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE result_text TEXT := COALESCE(input_text,''); item RECORD;
BEGIN
  FOR item IN SELECT old_file_name,new_file_name FROM model_file_name_migrations WHERE status='migrated' AND old_file_name<>new_file_name LOOP
    result_text := replace(result_text,item.old_file_name,item.new_file_name);
  END LOOP;
  FOR item IN SELECT old_employee_code,new_employee_code FROM employee_code_migrations WHERE status='migrated' AND old_employee_code<>new_employee_code AND old_employee_code<>'' LOOP
    result_text := replace(result_text,item.old_employee_code,item.new_employee_code);
  END LOOP;
  RETURN result_text;
END $$;

CREATE OR REPLACE FUNCTION v17711_replace_runtime_jsonb(input_json JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE kind TEXT; result_json JSONB; raw_text TEXT;
BEGIN
  IF input_json IS NULL THEN RETURN NULL; END IF;
  kind := jsonb_typeof(input_json);
  IF kind='object' THEN
    SELECT COALESCE(jsonb_object_agg(v17711_replace_runtime_text(key),v17711_replace_runtime_jsonb(value)),'{}'::jsonb) INTO result_json FROM jsonb_each(input_json);
    RETURN result_json;
  ELSIF kind='array' THEN
    SELECT COALESCE(jsonb_agg(v17711_replace_runtime_jsonb(value)),'[]'::jsonb) INTO result_json FROM jsonb_array_elements(input_json);
    RETURN result_json;
  ELSIF kind='string' THEN
    raw_text := input_json #>> '{}';
    RETURN to_jsonb(v17711_replace_runtime_text(raw_text));
  END IF;
  RETURN input_json;
END $$;

-- 5. 先更新所有承载引用，再切换运行记录自身文件名，保证同一事务内原子完成。
UPDATE model_runs
SET input_data=v17711_replace_runtime_jsonb(input_data),
    output_data=v17711_replace_runtime_jsonb(output_data);

UPDATE digital_library_records
SET data=v17711_replace_runtime_jsonb(data),
    identifier_values=v17711_replace_runtime_jsonb(COALESCE(identifier_values,'{}'::jsonb)),
    digital_id=COALESCE((SELECT m.new_employee_code FROM employee_code_migrations m WHERE m.status='migrated' AND m.old_employee_code=digital_library_records.digital_id LIMIT 1),digital_id);

UPDATE todos SET content=v17711_replace_runtime_text(content);
UPDATE audit_logs SET metadata=v17711_replace_runtime_jsonb(metadata);
UPDATE model_projects SET
  suggestion=v17711_replace_runtime_jsonb(suggestion),
  design=v17711_replace_runtime_jsonb(design),
  test_data=v17711_replace_runtime_jsonb(test_data),
  test_report=v17711_replace_runtime_jsonb(test_report),
  configuration=v17711_replace_runtime_jsonb(configuration);
UPDATE digital_object_attributes SET value=v17711_replace_runtime_jsonb(value);
UPDATE model_trigger_failures SET source_file_name=v17711_replace_runtime_text(source_file_name)
WHERE COALESCE(source_file_name,'')<>'';

UPDATE model_runs r
SET legacy_file_name=CASE WHEN r.file_name<>m.new_file_name THEN COALESCE(r.legacy_file_name,m.old_file_name) ELSE r.legacy_file_name END,
    file_name=m.new_file_name
FROM model_file_name_migrations m
WHERE r.id=m.run_id AND m.status='migrated' AND m.new_file_name IS NOT NULL;

-- 数字化库中本次模型文件名以对应 run_id 的当前 file_name 再做一次强一致校正。
UPDATE digital_library_records d
SET data=jsonb_set(
      v17711_replace_runtime_jsonb(d.data),
      '{模型文件名}',to_jsonb(r.file_name),true
    )
FROM model_runs r
WHERE d.run_id=r.id AND d.data ? '模型文件名';
UPDATE digital_library_records d
SET data=jsonb_set(
      v17711_replace_runtime_jsonb(d.data),
      '{fileName}',to_jsonb(r.file_name),true
    )
FROM model_runs r
WHERE d.run_id=r.id AND d.data ? 'fileName';

-- 6. 新数据只能写当前文件名。迁移异常旧记录允许原样保留并进入异常清单，禁止继续跨模型流转。
ALTER TABLE model_runs DROP CONSTRAINT IF EXISTS model_runs_current_filename_check;
ALTER TABLE model_runs ADD CONSTRAINT model_runs_current_filename_check
  CHECK (file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$') NOT VALID;
-- 异常旧记录先标记 legacy_file_name，避免其阻断系统启动；新运行仍受唯一索引保护。
UPDATE model_runs r SET legacy_file_name=COALESCE(r.legacy_file_name,m.old_file_name)
FROM model_file_name_migrations m WHERE r.id=m.run_id AND m.status='exception';
CREATE UNIQUE INDEX IF NOT EXISTS model_runs_current_file_name_uq
  ON model_runs(file_name)
  WHERE legacy_file_name IS NULL AND file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$';

-- 7. 迁移异常进入持久化清单。运行引擎不得使用异常记录的旧文件名继续形成新的跨模型关系。
CREATE TABLE IF NOT EXISTS model_file_name_migration_issues (
  run_id TEXT PRIMARY KEY REFERENCES model_runs(id) ON DELETE CASCADE,
  old_file_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
INSERT INTO model_file_name_migration_issues(run_id,old_file_name,reason)
SELECT run_id,old_file_name,reason FROM model_file_name_migrations WHERE status='exception'
ON CONFLICT(run_id) DO UPDATE SET old_file_name=EXCLUDED.old_file_name,reason=EXCLUDED.reason;

-- 8. 当前用户/模型结构约束：历史值仍可在审计映射表中保留，但 users 与新运行入口只使用当前编码。
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_code_current_or_legacy_check;
ALTER TABLE users ADD CONSTRAINT users_employee_code_current_check CHECK (employee_code ~ '^5011002[0-9]{4}$') NOT VALID;

COMMENT ON TABLE model_file_name_migrations IS 'V17.7.11模型文件名旧→新全量迁移审计映射；现行业务链路只使用new_file_name';
COMMENT ON COLUMN model_runs.legacy_file_name IS '迁移前模型文件名，仅供审计追溯，不参与现行业务链路';
