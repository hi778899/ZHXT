-- V17.1.2.2：历史数字化库全字段修复。
-- 目标：一次性补齐早期记录中缺失的输入字段、计算字段和 outputDigitalMap 字段，
-- 并把可恢复的计算结果同步回 model_runs.output_data，保证数字化库、审批、智选读取一致。


-- 先把四阶段配置中的 outputDigitalMap 结果标识补进数字化标识目录和模型数字化库列。
-- 这样不仅“请假天数”，所有用户后续自建模型的计算/表达式结果都能在数字化库直接显示。
WITH output_defs AS (
  SELECT p.id AS project_id,p.model_id,m.name AS model_name,l.id AS library_id,
         om.key AS output_key,om.value AS digital_id,
         COALESCE(
           (SELECT NULLIF(c->>'label','') FROM jsonb_array_elements(COALESCE(p.design->'calculations','[]'::jsonb)) c WHERE c->>'targetKey'=om.key LIMIT 1),
           (SELECT NULLIF(e->>'label','') FROM jsonb_array_elements(COALESCE(p.design->'expressions','[]'::jsonb)) e WHERE e->>'targetKey'=om.key LIMIT 1),
           om.key
         ) AS display_name,
         CASE WHEN COALESCE((SELECT c->>'operation' FROM jsonb_array_elements(COALESCE(p.design->'calculations','[]'::jsonb)) c WHERE c->>'targetKey'=om.key LIMIT 1),'')
                   IN ('dateDiffInclusive','sum','difference') THEN 'number' ELSE 'text' END AS data_type
  FROM model_projects p
  JOIN models m ON m.id=p.model_id
  JOIN digital_libraries l ON l.model_id=p.model_id
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.design->'outputDigitalMap','{}'::jsonb)) om(key,value)
  WHERE om.value ~ '^[0-9]{16}$'
)
INSERT INTO digital_identifiers(id,code,display_name,data_type,description)
SELECT 'did-result-' || md5(project_id || ':' || output_key),digital_id,display_name,data_type,model_name || '结果数字化标识'
FROM output_defs
ON CONFLICT(code) DO UPDATE SET
  display_name=CASE WHEN digital_identifiers.display_name=digital_identifiers.code OR digital_identifiers.display_name='' THEN EXCLUDED.display_name ELSE digital_identifiers.display_name END,
  data_type=EXCLUDED.data_type,updated_at=now();

WITH output_defs AS (
  SELECT p.id AS project_id,p.model_id,l.id AS library_id,om.key AS output_key,om.value AS digital_id,
         row_number() OVER(PARTITION BY p.id ORDER BY om.key) AS ord
  FROM model_projects p
  JOIN digital_libraries l ON l.model_id=p.model_id
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.design->'outputDigitalMap','{}'::jsonb)) om(key,value)
  WHERE om.value ~ '^[0-9]{16}$'
)
INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-result-' || md5(o.project_id || ':' || o.output_key),o.library_id,di.id,1000+o.ord::int,false,'result'
FROM output_defs o JOIN digital_identifiers di ON di.code=o.digital_id
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET source_role='result';
DO $$
DECLARE
  rec RECORD;
  field_item JSONB;
  calc_item JSONB;
  output_item RECORD;
  source_key TEXT;
  target_key TEXT;
  field_key TEXT;
  field_label TEXT;
  digital_id TEXT;
  operation TEXT;
  separator TEXT;
  merged JSONB;
  values_json JSONB;
  output_patch JSONB;
  candidate JSONB;
  computed JSONB;
  start_text TEXT;
  end_text TEXT;
  number_text TEXT;
  total_value NUMERIC;
  first_value NUMERIC;
  second_value NUMERIC;
  concat_value TEXT;
  source_count INTEGER;
BEGIN
  FOR rec IN
    SELECT d.id,d.run_id,d.project_id,d.identifier_values,d.data,
           r.project_id AS run_project_id,r.input_data,r.output_data,
           p.design,
           COALESCE(u.display_name,'') AS owner_name,
           COALESCE(u.department,'') AS owner_department,
           COALESCE(u.employee_code,'') AS owner_code
    FROM digital_library_records d
    LEFT JOIN model_runs r ON r.id=d.run_id
    LEFT JOIN model_projects p ON p.id=COALESCE(d.project_id,r.project_id)
    LEFT JOIN users u ON u.id=d.owner_id
    WHERE p.id IS NOT NULL
  LOOP
    merged := COALESCE(rec.data,'{}'::jsonb)
              || CASE WHEN jsonb_typeof(rec.data->'input')='object' THEN rec.data->'input' ELSE '{}'::jsonb END
              || COALESCE(rec.input_data,'{}'::jsonb)
              || CASE WHEN jsonb_typeof(rec.data->'output')='object' THEN rec.data->'output' ELSE '{}'::jsonb END
              || COALESCE(rec.output_data,'{}'::jsonb);

    -- 旧记录若未保存自动读取字段，则从归属人补回最基础的人员/部门数据。
    IF COALESCE(NULLIF(merged->>'applicant',''),'')='' AND rec.owner_name<>'' THEN
      merged := merged || jsonb_build_object('applicant',rec.owner_name);
    END IF;
    IF COALESCE(NULLIF(merged->>'department',''),'')='' AND rec.owner_department<>'' THEN
      merged := merged || jsonb_build_object('department',rec.owner_department);
    END IF;
    IF COALESCE(NULLIF(merged->>'employeeCode',''),'')='' AND rec.owner_code<>'' THEN
      merged := merged || jsonb_build_object('employeeCode',rec.owner_code);
    END IF;

    -- 按模型四阶段中保存的 calculations 顺序恢复历史计算字段。
    FOR calc_item IN SELECT value FROM jsonb_array_elements(COALESCE(rec.design->'calculations','[]'::jsonb))
    LOOP
      target_key := COALESCE(calc_item->>'targetKey','');
      operation := COALESCE(calc_item->>'operation','');
      IF target_key='' OR (merged ? target_key AND COALESCE(NULLIF(merged->>target_key,''),'')<>'') THEN
        CONTINUE;
      END IF;
      computed := NULL;

      IF operation='dateDiffInclusive' THEN
        SELECT COUNT(*), MIN(CASE WHEN ord=1 THEN val END), MIN(CASE WHEN ord=2 THEN val END)
          INTO source_count,start_text,end_text
        FROM (
          SELECT ord, merged->>key AS val
          FROM jsonb_array_elements_text(COALESCE(calc_item->'sourceKeys','[]'::jsonb)) WITH ORDINALITY s(key,ord)
        ) x;
        IF source_count>=2
           AND start_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           AND end_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           AND end_text::date >= start_text::date THEN
          computed := to_jsonb((end_text::date - start_text::date) + 1);
        END IF;

      ELSIF operation='copy' THEN
        SELECT merged->key INTO computed
        FROM jsonb_array_elements_text(COALESCE(calc_item->'sourceKeys','[]'::jsonb)) WITH ORDINALITY s(key,ord)
        WHERE ord=1;

      ELSIF operation IN ('sum','difference') THEN
        total_value := 0; first_value := 0; second_value := 0; source_count := 0;
        FOR source_key IN SELECT value FROM jsonb_array_elements_text(COALESCE(calc_item->'sourceKeys','[]'::jsonb))
        LOOP
          number_text := COALESCE(merged->>source_key,'');
          IF number_text ~ '^-?[0-9]+(?:\.[0-9]+)?$' THEN
            source_count := source_count + 1;
            total_value := total_value + number_text::numeric;
            IF source_count=1 THEN first_value := number_text::numeric; END IF;
            IF source_count=2 THEN second_value := number_text::numeric; END IF;
          ELSE
            source_count := source_count + 1;
          END IF;
        END LOOP;
        IF operation='sum' THEN computed := to_jsonb(total_value);
        ELSIF source_count>=2 THEN computed := to_jsonb(first_value-second_value);
        END IF;

      ELSIF operation='concat' THEN
        concat_value := ''; separator := COALESCE(calc_item->>'separator',''); source_count := 0;
        FOR source_key IN SELECT value FROM jsonb_array_elements_text(COALESCE(calc_item->'sourceKeys','[]'::jsonb))
        LOOP
          IF source_count>0 THEN concat_value := concat_value || separator; END IF;
          concat_value := concat_value || COALESCE(merged->>source_key,'');
          source_count := source_count + 1;
        END LOOP;
        computed := to_jsonb(concat_value);
      END IF;

      IF computed IS NOT NULL AND computed <> 'null'::jsonb AND computed <> '""'::jsonb THEN
        merged := merged || jsonb_build_object(target_key,computed);
        IF COALESCE(calc_item->>'label','')<>'' THEN
          merged := merged || jsonb_build_object(calc_item->>'label',computed);
        END IF;
      END IF;
    END LOOP;

    values_json := COALESCE(rec.identifier_values,'{}'::jsonb);

    -- 表单字段 key/中文名称 -> 16位数字化标识。
    FOR field_item IN SELECT value FROM jsonb_array_elements(COALESCE(rec.design->'fields','[]'::jsonb))
    LOOP
      IF COALESCE(field_item->>'type','')='section' THEN CONTINUE; END IF;
      field_key := COALESCE(field_item->>'key','');
      field_label := COALESCE(field_item->>'label','');
      digital_id := COALESCE(field_item->>'digitalId','');
      IF field_key='' OR digital_id !~ '^[0-9]{16}$' OR values_json ? digital_id THEN CONTINUE; END IF;
      candidate := merged->field_key;
      IF candidate IS NULL OR candidate = 'null'::jsonb OR candidate = '""'::jsonb THEN
        candidate := merged->field_label;
      END IF;
      IF candidate IS NOT NULL AND candidate <> 'null'::jsonb AND candidate <> '""'::jsonb THEN
        values_json := values_json || jsonb_build_object(digital_id,candidate);
      END IF;
    END LOOP;

    output_patch := '{}'::jsonb;
    -- 计算/结果字段 outputDigitalMap -> 16位数字化标识。
    FOR output_item IN SELECT key,value FROM jsonb_each_text(COALESCE(rec.design->'outputDigitalMap','{}'::jsonb))
    LOOP
      target_key := output_item.key;
      digital_id := output_item.value;
      candidate := merged->target_key;
      IF digital_id ~ '^[0-9]{16}$'
         AND candidate IS NOT NULL AND candidate <> 'null'::jsonb AND candidate <> '""'::jsonb THEN
        IF NOT (values_json ? digital_id) THEN
          values_json := values_json || jsonb_build_object(digital_id,candidate);
        END IF;
        IF rec.run_id IS NOT NULL AND NOT (COALESCE(rec.output_data,'{}'::jsonb) ? target_key) THEN
          output_patch := output_patch || jsonb_build_object(target_key,candidate);
        END IF;
      END IF;
    END LOOP;

    UPDATE digital_library_records SET identifier_values=values_json WHERE id=rec.id;
    IF rec.run_id IS NOT NULL AND output_patch <> '{}'::jsonb THEN
      UPDATE model_runs SET output_data=COALESCE(output_data,'{}'::jsonb) || output_patch WHERE id=rec.run_id;
    END IF;
  END LOOP;
END $$;
