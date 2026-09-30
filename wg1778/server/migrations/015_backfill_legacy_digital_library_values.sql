-- V17.1.2：历史数字化库记录兼容修复。
-- 既有业务运行记录在早期版本中主要保存于 model_runs.input_data/output_data
-- 或 digital_library_records.data.input/data.output；本迁移按模型设计字段 key → 16位数字化标识补齐 identifier_values。
WITH field_map AS (
  SELECT p.id AS project_id,
         f.value->>'key' AS field_key,
         COALESCE(NULLIF(f.value->>'label',''),f.value->>'key') AS field_label,
         f.value->>'digitalId' AS digital_id
  FROM model_projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.design->'fields','[]'::jsonb)) f(value)
  WHERE COALESCE(f.value->>'type','') <> 'section'
    AND COALESCE(f.value->>'key','') <> ''
    AND COALESCE(f.value->>'digitalId','') ~ '^[0-9]{16}$'
), direct_values AS (
  SELECT d.id AS record_id,fm.digital_id,
         COALESCE(
           r.output_data -> fm.field_key,
           r.input_data -> fm.field_key,
           d.data -> 'output' -> fm.field_key,
           d.data -> 'input' -> fm.field_key,
           d.data -> fm.field_key,
           d.data -> fm.field_label
         ) AS field_value
  FROM digital_library_records d
  LEFT JOIN model_runs r ON r.id=d.run_id
  JOIN field_map fm ON fm.project_id=COALESCE(d.project_id,r.project_id)
), output_map AS (
  SELECT p.id AS project_id,om.key AS field_key,om.value AS digital_id
  FROM model_projects p
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.design->'outputDigitalMap','{}'::jsonb)) om(key,value)
  WHERE om.value ~ '^[0-9]{16}$'
), calculated_values AS (
  SELECT d.id AS record_id,om.digital_id,
         COALESCE(
           r.output_data -> om.field_key,
           d.data -> 'output' -> om.field_key,
           d.data -> om.field_key
         ) AS field_value
  FROM digital_library_records d
  LEFT JOIN model_runs r ON r.id=d.run_id
  JOIN output_map om ON om.project_id=COALESCE(d.project_id,r.project_id)
), recovered AS (
  SELECT record_id,digital_id,field_value FROM direct_values
  WHERE field_value IS NOT NULL AND field_value <> 'null'::jsonb AND field_value <> '""'::jsonb
  UNION ALL
  SELECT record_id,digital_id,field_value FROM calculated_values
  WHERE field_value IS NOT NULL AND field_value <> 'null'::jsonb AND field_value <> '""'::jsonb
), aggregated AS (
  SELECT record_id,jsonb_object_agg(digital_id,field_value) AS mapped_values
  FROM recovered
  GROUP BY record_id
)
UPDATE digital_library_records d
SET identifier_values=COALESCE(a.mapped_values,'{}'::jsonb) || COALESCE(d.identifier_values,'{}'::jsonb)
FROM aggregated a
WHERE d.id=a.record_id
  AND a.mapped_values IS NOT NULL;
