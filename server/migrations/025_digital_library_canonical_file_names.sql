-- V17.7.13：数字化库文件名全量统一。
-- 规则：数字化库中的“文件名”必须直接持久化标准模型文件名，禁止页面退回显示 record_id。
-- 有真实 run_id 的记录与 model_runs.file_name 强一致；历史 seed/系统同步记录按所属模型当前19位编码 + 责任/迁移运行人员11位员工编码 + 原创建时间码形成迁移文件名。

ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS display_file_name TEXT;
ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS legacy_file_name TEXT;

-- 1. 数字化库记录必须挂到其数据产生模型；历史缺失时从数字化库目录补齐。
UPDATE digital_library_records d
SET model_id=l.model_id
FROM digital_libraries l
WHERE d.library_id=l.id AND d.model_id IS NULL AND l.model_id IS NOT NULL;

UPDATE digital_library_records d
SET project_id=p.id
FROM digital_libraries l
JOIN LATERAL (
  SELECT mp.id FROM model_projects mp
  WHERE mp.model_id=l.model_id
  ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC
  LIMIT 1
) p ON true
WHERE d.library_id=l.id AND d.project_id IS NULL;

-- 2. 真实模型运行形成的数字化库记录，直接使用同一次 model_runs 的标准模型文件名。
UPDATE digital_library_records d
SET legacy_file_name=CASE WHEN COALESCE(d.file_name,'')<>'' AND d.file_name<>r.file_name THEN COALESCE(d.legacy_file_name,d.file_name) ELSE d.legacy_file_name END,
    file_name=r.file_name,
    display_file_name=r.display_file_name
FROM model_runs r
WHERE d.run_id=r.id AND r.file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$';

-- 3. 历史 seed / 系统同步记录没有 run_id。为它们形成可审计的迁移文件名。
--    原 owner_id 存在且员工编码合法时使用原责任人；否则使用当前启用管理员（无管理员时使用最早启用员工）作为迁移运行人员。
WITH actor AS (
  SELECT id,employee_code,display_name
  FROM users
  WHERE status='active' AND employee_code ~ '^5011002[0-9]{4}$'
  ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,created_at,id
  LIMIT 1
), raw AS (
  SELECT d.id,d.created_at,
         COALESCE(NULLIF(u.employee_code,''),a.employee_code) AS employee_code,
         COALESCE(NULLIF(u.display_name,''),a.display_name,'系统迁移') AS actor_name,
         COALESCE(NULLIF(dc.code,''),NULLIF(p.configuration->>'modelCode','')) AS model_code,
         COALESCE(NULLIF(m.name,''),'数字化模型') AS model_name,
         to_char(d.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS time_code
  FROM digital_library_records d
  JOIN digital_libraries l ON l.id=d.library_id
  LEFT JOIN models m ON m.id=COALESCE(d.model_id,l.model_id)
  LEFT JOIN digital_codes dc
    ON dc.object_type='model' AND dc.object_id=COALESCE(d.model_id,l.model_id)
   AND dc.code ~ '^5011001[0-9]{12}$'
  LEFT JOIN LATERAL (
    SELECT mp.configuration
    FROM model_projects mp
    WHERE mp.model_id=COALESCE(d.model_id,l.model_id)
    ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC
    LIMIT 1
  ) p ON true
  LEFT JOIN users u ON u.id=d.owner_id AND u.employee_code ~ '^5011002[0-9]{4}$'
  LEFT JOIN actor a ON true
  WHERE COALESCE(d.file_name,'')='' AND d.run_id IS NULL
), valid AS (
  SELECT *,row_number() OVER (PARTITION BY model_code,employee_code,time_code ORDER BY id) AS seq
  FROM raw
  WHERE model_code ~ '^5011001[0-9]{12}$' AND employee_code ~ '^5011002[0-9]{4}$'
), names AS (
  SELECT v.id,
         v.model_code||'-'||v.employee_code||'-'||v.time_code||lpad((v.seq+COALESCE(x.existing_count,0))::text,6,'0') AS new_file_name,
         v.model_name||'-'||v.actor_name||'-'||v.time_code||'-'||lpad((v.seq+COALESCE(x.existing_count,0))::text,6,'0') AS new_display_file_name
  FROM valid v
  LEFT JOIN LATERAL (SELECT count(*)::int AS existing_count FROM digital_library_records e WHERE e.file_name LIKE v.model_code||'-'||v.employee_code||'-'||v.time_code||'%') x ON true
)
UPDATE digital_library_records d
SET legacy_file_name=CASE WHEN COALESCE(d.file_name,'')<>'' THEN COALESCE(d.legacy_file_name,d.file_name) ELSE d.legacy_file_name END,
    file_name=n.new_file_name,
    display_file_name=n.new_display_file_name
FROM names n
WHERE d.id=n.id;

-- 4. 对仍无法形成标准文件名的记录留痕，不允许页面用 record_id 冒充文件名。
CREATE TABLE IF NOT EXISTS digital_library_file_name_migration_issues (
  record_id TEXT PRIMARY KEY REFERENCES digital_library_records(id) ON DELETE CASCADE,
  library_id TEXT,
  model_id TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

INSERT INTO digital_library_file_name_migration_issues(record_id,library_id,model_id,reason)
SELECT d.id,d.library_id,d.model_id,
       CASE
         WHEN d.run_id IS NOT NULL THEN '对应模型运行文件名迁移尚未完成，数字化库不得退回显示record_id或旧文件名'
         WHEN COALESCE(d.model_id,'')='' THEN '数字化库记录未关联数据产生模型'
         WHEN COALESCE(dc.code,p.configuration->>'modelCode','') !~ '^5011001[0-9]{12}$' THEN '数据产生模型未配置当前19位模型数字化编码'
         WHEN NOT EXISTS(SELECT 1 FROM users u WHERE u.status='active' AND u.employee_code ~ '^5011002[0-9]{4}$') THEN '不存在可用于历史迁移的当前11位员工数字化编码运行人员'
         ELSE '数字化库记录标准模型文件名生成失败'
       END
FROM digital_library_records d
LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=d.model_id AND dc.code ~ '^5011001[0-9]{12}$'
LEFT JOIN LATERAL (
  SELECT mp.configuration FROM model_projects mp WHERE mp.model_id=d.model_id
  ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
) p ON true
WHERE COALESCE(d.file_name,'')=''
ON CONFLICT(record_id) DO UPDATE SET library_id=EXCLUDED.library_id,model_id=EXCLUDED.model_id,reason=EXCLUDED.reason,resolved_at=NULL;

UPDATE digital_library_file_name_migration_issues i SET resolved_at=now()
WHERE resolved_at IS NULL AND EXISTS(
  SELECT 1 FROM digital_library_records d
  WHERE d.id=i.record_id AND d.file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$'
);

-- 5. 当前格式约束和唯一性。迁移异常允许暂存为空，但不得再写入非标准格式。
ALTER TABLE digital_library_records DROP CONSTRAINT IF EXISTS digital_library_records_current_filename_check;
ALTER TABLE digital_library_records ADD CONSTRAINT digital_library_records_current_filename_check CHECK (
  file_name IS NULL OR file_name='' OR file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$'
) NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS digital_library_records_current_file_name_uq
  ON digital_library_records(file_name)
  WHERE file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$';

COMMENT ON COLUMN digital_library_records.file_name IS '数字化库记录正式模型文件名；格式=19位模型数字化编码-11位员工数字化编码-时间码；页面不得用record_id替代';
COMMENT ON COLUMN digital_library_records.legacy_file_name IS '数字化库记录迁移前旧文件名，仅供审计追溯';
COMMENT ON TABLE digital_library_file_name_migration_issues IS '数字化库文件名全量统一迁移异常；未解决记录不得以record_id伪装为文件名';
