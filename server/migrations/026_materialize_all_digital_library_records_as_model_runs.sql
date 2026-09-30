-- V17.7.14 方案A：所有数字化库正式记录必须由对应数据产生模型的一次真实运行形成。
-- 历史 std-* / src0622-* / auto0622-* 等直接写库记录，转换为“系统初始化模型运行”；
-- 新的 system seed/sync 禁止再写 run_id=NULL 的正式数字化库记录。

ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS legacy_record_id TEXT;
ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS record_origin TEXT NOT NULL DEFAULT 'model_run';

-- 已有真实模型运行记录归类为 model_run；历史无 run_id 记录先进入待物化状态。
UPDATE digital_library_records SET record_origin='model_run' WHERE run_id IS NOT NULL;
UPDATE digital_library_records
SET legacy_record_id=COALESCE(legacy_record_id,id),
    legacy_file_name=COALESCE(legacy_file_name,NULLIF(file_name,'')),
    file_name=NULL,
    display_file_name=NULL,
    record_origin='migration_pending'
WHERE run_id IS NULL;

CREATE TABLE IF NOT EXISTS digital_library_run_materialization_issues (
  record_id TEXT PRIMARY KEY REFERENCES digital_library_records(id) ON DELETE CASCADE,
  library_id TEXT,
  model_id TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 可重复调用：migration 阶段先物化当前已具备模型编码/运行人员的记录；seed 发布全部数据产生模型后再调用一次，完成首次安装剩余记录。
CREATE OR REPLACE FUNCTION v17714_materialize_digital_library_runs()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE affected INTEGER := 0;
BEGIN
  -- 先把库目录上的数据产生模型和已发布/最新项目同步到记录。
  UPDATE digital_library_records d
  SET model_id=l.model_id
  FROM digital_libraries l
  WHERE d.library_id=l.id AND d.run_id IS NULL AND d.model_id IS DISTINCT FROM l.model_id AND l.model_id IS NOT NULL;

  UPDATE digital_library_records d
  SET project_id=p.id
  FROM digital_libraries l
  JOIN LATERAL (
    SELECT mp.id FROM model_projects mp WHERE mp.model_id=l.model_id
    ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
  ) p ON true
  WHERE d.library_id=l.id AND d.run_id IS NULL AND d.project_id IS DISTINCT FROM p.id;

  WITH actor AS (
    SELECT id,employee_code,display_name
    FROM users
    WHERE status='active' AND employee_code ~ '^5011002[0-9]{4}$'
    ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,created_at,id
    LIMIT 1
  ), raw AS (
    SELECT d.id AS record_id,d.library_id,d.digital_id,d.identifier_values,d.data,d.created_at,
           COALESCE(d.model_id,l.model_id) AS model_id,
           COALESCE(d.project_id,p.id) AS project_id,
           COALESCE(CASE WHEN ou.employee_code ~ '^5011002[0-9]{4}$' THEN ou.id END,a.id) AS owner_id,
           COALESCE(CASE WHEN ou.employee_code ~ '^5011002[0-9]{4}$' THEN ou.employee_code END,a.employee_code) AS employee_code,
           COALESCE(CASE WHEN ou.employee_code ~ '^5011002[0-9]{4}$' THEN ou.display_name END,a.display_name,'系统运行人员') AS actor_name,
           COALESCE(NULLIF(dc.code,''),NULLIF(p.configuration->>'modelCode','')) AS model_code,
           COALESCE(NULLIF(m.name,''),'数字化模型') AS model_name,
           to_char(d.created_at AT TIME ZONE 'Asia/Shanghai','YYYYMMDDHH24MISS') AS base_stamp
    FROM digital_library_records d
    JOIN digital_libraries l ON l.id=d.library_id AND l.status='active'
    LEFT JOIN models m ON m.id=COALESCE(d.model_id,l.model_id)
    LEFT JOIN LATERAL (
      SELECT mp.id,mp.configuration FROM model_projects mp WHERE mp.model_id=COALESCE(d.model_id,l.model_id)
      ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=COALESCE(d.model_id,l.model_id) AND dc.code ~ '^5011001[0-9]{12}$'
    LEFT JOIN users ou ON ou.id=d.owner_id
    LEFT JOIN actor a ON true
    WHERE d.run_id IS NULL
  ), valid AS (
    SELECT r.*,row_number() OVER (PARTITION BY model_code,employee_code,base_stamp ORDER BY created_at,record_id) AS seq
    FROM raw r
    WHERE model_id IS NOT NULL AND model_code ~ '^5011001[0-9]{12}$' AND employee_code ~ '^5011002[0-9]{4}$' AND owner_id IS NOT NULL
  ), prepared AS (
    SELECT v.*,
           v.model_code||'-'||v.employee_code||'-'||v.base_stamp||lpad((v.seq+COALESCE(x.existing_count,0))::text,6,'0') AS new_file_name,
           v.model_name||'-'||v.actor_name||'-'||v.base_stamp||'-'||lpad((v.seq+COALESCE(x.existing_count,0))::text,6,'0') AS new_display_file_name
    FROM valid v
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS existing_count FROM model_runs e
      WHERE e.file_name LIKE v.model_code||'-'||v.employee_code||'-'||v.base_stamp||'%'
    ) x ON true
  ), inserted AS (
    INSERT INTO model_runs(id,model_id,project_id,owner_id,file_name,display_file_name,digital_id,input_data,output_data,status,created_at,completed_at,trigger_mode,source_run_id)
    SELECT 'syslib-'||md5(record_id||':'||new_file_name),model_id,project_id,owner_id,new_file_name,new_display_file_name,digital_id,
           jsonb_build_object('systemManaged',true,'systemSource','historical_library_materialization','legacyRecordId',record_id,'libraryId',library_id),
           jsonb_build_object('identifierValues',COALESCE(identifier_values,'{}'::jsonb),'data',COALESCE(data,'{}'::jsonb),'libraryId',library_id),
           '已归档',created_at,created_at,'system_initialization',NULL
    FROM prepared
    ON CONFLICT(id) DO NOTHING
    RETURNING id,model_id,project_id,owner_id,file_name,display_file_name,input_data
  )
  UPDATE digital_library_records d
  SET model_id=i.model_id,project_id=COALESCE(i.project_id,d.project_id),run_id=i.id,owner_id=i.owner_id,
      file_name=i.file_name,display_file_name=i.display_file_name,legacy_record_id=COALESCE(d.legacy_record_id,d.id),record_origin='system_initialization'
  FROM inserted i
  WHERE d.id=i.input_data->>'legacyRecordId';

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- 如果上一次插入成功但事务重试时 INSERT 因 deterministic id 冲突未 RETURNING，按 deterministic run 再补关联。
  UPDATE digital_library_records d
  SET run_id=r.id,model_id=r.model_id,project_id=COALESCE(r.project_id,d.project_id),owner_id=r.owner_id,
      file_name=r.file_name,display_file_name=r.display_file_name,legacy_record_id=COALESCE(d.legacy_record_id,d.id),record_origin='system_initialization'
  FROM model_runs r
  WHERE d.run_id IS NULL AND r.trigger_mode='system_initialization' AND r.input_data->>'legacyRecordId'=d.id;

  INSERT INTO digital_library_run_materialization_issues(record_id,library_id,model_id,reason)
  SELECT d.id,d.library_id,d.model_id,
    CASE
      WHEN l.model_id IS NULL THEN '数字化库未配置数据产生模型'
      WHEN COALESCE(dc.code,p.configuration->>'modelCode','') !~ '^5011001[0-9]{12}$' THEN '数据产生模型未配置当前19位模型数字化编码/发布项目'
      WHEN NOT EXISTS(SELECT 1 FROM users u WHERE u.status='active' AND u.employee_code ~ '^5011002[0-9]{4}$') THEN '不存在可承担系统初始化模型运行的当前11位员工数字化编码人员'
      ELSE '数字化库历史记录尚未形成真实模型运行'
    END
  FROM digital_library_records d
  LEFT JOIN digital_libraries l ON l.id=d.library_id
  LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=COALESCE(d.model_id,l.model_id) AND dc.code ~ '^5011001[0-9]{12}$'
  LEFT JOIN LATERAL (
    SELECT mp.configuration FROM model_projects mp WHERE mp.model_id=COALESCE(d.model_id,l.model_id)
    ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
  ) p ON true
  WHERE d.run_id IS NULL
  ON CONFLICT(record_id) DO UPDATE SET library_id=EXCLUDED.library_id,model_id=EXCLUDED.model_id,reason=EXCLUDED.reason,resolved_at=NULL;

  UPDATE digital_library_run_materialization_issues i SET resolved_at=now()
  WHERE resolved_at IS NULL AND EXISTS(SELECT 1 FROM digital_library_records d WHERE d.id=i.record_id AND d.run_id IS NOT NULL);

  -- V17.7.13 的“仅文件名迁移”异常在真实 model_run 物化成功后同步关闭。
  UPDATE digital_library_file_name_migration_issues i SET resolved_at=now()
  WHERE resolved_at IS NULL AND EXISTS(SELECT 1 FROM digital_library_records d WHERE d.id=i.record_id AND d.run_id IS NOT NULL);

  -- 既有真实运行的库记录再次与 model_runs 强一致。
  UPDATE digital_library_records d
  SET model_id=r.model_id,project_id=COALESCE(r.project_id,d.project_id),owner_id=COALESCE(d.owner_id,r.owner_id),
      file_name=r.file_name,display_file_name=r.display_file_name,
      record_origin=CASE WHEN r.trigger_mode IN ('system_initialization','system_sync') THEN r.trigger_mode ELSE 'model_run' END
  FROM model_runs r
  WHERE d.run_id=r.id AND (d.file_name IS DISTINCT FROM r.file_name OR d.display_file_name IS DISTINCT FROM r.display_file_name OR d.model_id IS DISTINCT FROM r.model_id);

  RETURN affected;
END $$;

SELECT v17714_materialize_digital_library_runs();

-- 禁止未来新增“无模型运行”的正式记录。migration_pending 仅用于历史迁移期间暂存，不能由业务/seed/sync代码主动使用。
CREATE OR REPLACE FUNCTION v17714_enforce_digital_library_run_provenance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE run_file_name TEXT;
BEGIN
  IF NEW.run_id IS NULL AND COALESCE(NEW.record_origin,'model_run') <> 'migration_pending' THEN
    RAISE EXCEPTION '数字化库正式记录必须由对应数据产生模型运行形成，禁止直接写入 run_id=NULL 记录';
  END IF;
  IF NEW.run_id IS NOT NULL THEN
    SELECT r.file_name INTO run_file_name FROM model_runs r WHERE r.id=NEW.run_id;
    IF run_file_name IS NULL THEN
      RAISE EXCEPTION '数字化库正式记录的 run_id 未关联到真实模型运行';
    END IF;
    IF COALESCE(NEW.file_name,'')='' OR NEW.file_name !~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$' THEN
      RAISE EXCEPTION '数字化库正式记录必须保存当前标准模型文件名';
    END IF;
    IF NEW.file_name IS DISTINCT FROM run_file_name THEN
      RAISE EXCEPTION '数字化库正式文件名必须与对应 model_runs.file_name 完全一致';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_digital_library_run_provenance ON digital_library_records;
CREATE TRIGGER trg_digital_library_run_provenance
BEFORE INSERT OR UPDATE OF run_id,file_name,record_origin ON digital_library_records
FOR EACH ROW EXECUTE FUNCTION v17714_enforce_digital_library_run_provenance();

CREATE INDEX IF NOT EXISTS digital_library_records_run_required_idx ON digital_library_records(run_id) WHERE run_id IS NULL;
COMMENT ON COLUMN digital_library_records.legacy_record_id IS '历史 seed/src0622/系统同步技术记录键，仅用于迁移审计；不得作为文件名或运行链路字段';
COMMENT ON COLUMN digital_library_records.record_origin IS '记录形成方式：model_run/system_initialization/system_sync；migration_pending仅历史迁移暂存';
COMMENT ON TABLE digital_library_run_materialization_issues IS 'V17.7.14 方案A：数字化库历史记录尚未形成对应模型运行的异常清单；seed发布数据产生模型后自动重试';
