-- V17.1.2.4：请休假历史结果字段兼容修复。
-- 原因：生产库中的请休假模型可能在早期版本已经被四阶段编辑过（project version > 1），
-- seed 为保护用户配置不会覆盖 design，因此旧 design 可能缺少 calculations / outputDigitalMap 元数据。
-- 本迁移只补齐“缺失”的基准计算配置，不覆盖用户已经存在的同名计算；随后按现有历史起止日期回填请假天数。

-- 1. 对请休假模型补齐缺失的 days 计算定义与 16 位输出标识映射。
WITH leave_projects AS (
  SELECT p.id,p.design
  FROM model_projects p
  JOIN models m ON m.id=p.model_id
  WHERE m.name='请休假模型'
), patched AS (
  SELECT id,
    jsonb_set(
      CASE
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(design->'calculations','[]'::jsonb)) c
          WHERE c->>'targetKey'='days'
        ) THEN COALESCE(design,'{}'::jsonb)
        ELSE jsonb_set(
          COALESCE(design,'{}'::jsonb),
          '{calculations}',
          COALESCE(design->'calculations','[]'::jsonb) ||
          '[{"id":"calc-days","targetKey":"days","label":"请假天数","operation":"dateDiffInclusive","sourceKeys":["startDate","endDate"]}]'::jsonb,
          true
        )
      END,
      '{outputDigitalMap}',
      COALESCE(design->'outputDigitalMap','{}'::jsonb) || '{"days":"5013001005001106"}'::jsonb,
      true
    ) AS new_design
  FROM leave_projects
)
UPDATE model_projects p
SET design=patched.new_design,updated_at=now()
FROM patched
WHERE p.id=patched.id AND p.design IS DISTINCT FROM patched.new_design;

-- 2. 确保请假天数结果标识及数字化库列存在。
UPDATE digital_identifiers
SET display_name='请假天数',data_type='number',description='模型计算得到的请假天数',updated_at=now()
WHERE code='5013001005001106';

INSERT INTO digital_identifiers(id,code,display_name,data_type,description)
SELECT 'did-leave-days','5013001005001106','请假天数','number','模型计算得到的请假天数'
WHERE NOT EXISTS (SELECT 1 FROM digital_identifiers WHERE code='5013001005001106');

INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-leave-days',l.id,di.id,90,false,'result'
FROM digital_libraries l
JOIN models m ON m.id=l.model_id
JOIN digital_identifiers di ON di.code='5013001005001106'
WHERE m.name='请休假模型'
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET source_role='result',visible=true;

-- 3. 用 canonical 16位标识、历史 run input、旧归档 data.input 三种来源恢复起止日期并计算自然日（含首尾）。
WITH leave_records AS (
  SELECT d.id AS record_id,d.run_id,
         COALESCE(
           NULLIF(d.identifier_values->>'5013001005001104',''),
           NULLIF(r.input_data->>'startDate',''),
           NULLIF(d.data->'input'->>'startDate',''),
           NULLIF(d.data->>'startDate',''),
           NULLIF(d.data->>'开始日期','')
         ) AS start_text,
         COALESCE(
           NULLIF(d.identifier_values->>'5013001005001105',''),
           NULLIF(r.input_data->>'endDate',''),
           NULLIF(d.data->'input'->>'endDate',''),
           NULLIF(d.data->>'endDate',''),
           NULLIF(d.data->>'结束日期','')
         ) AS end_text
  FROM digital_library_records d
  JOIN digital_libraries l ON l.id=d.library_id
  JOIN models m ON m.id=l.model_id
  LEFT JOIN model_runs r ON r.id=d.run_id
  WHERE m.name='请休假模型'
), computed AS (
  SELECT record_id,run_id,start_text,end_text,
         CASE
           WHEN start_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND end_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND end_text::date >= start_text::date
           THEN (end_text::date-start_text::date)+1
           ELSE NULL
         END AS days
  FROM leave_records
)
UPDATE digital_library_records d
SET identifier_values=COALESCE(d.identifier_values,'{}'::jsonb) || jsonb_build_object('5013001005001106',c.days),
    data=CASE
      WHEN jsonb_typeof(COALESCE(d.data,'{}'::jsonb)->'output')='object'
      THEN jsonb_set(COALESCE(d.data,'{}'::jsonb),'{output}',(COALESCE(d.data,'{}'::jsonb)->'output') || jsonb_build_object('days',c.days),true)
      ELSE COALESCE(d.data,'{}'::jsonb) || jsonb_build_object('output',jsonb_build_object('days',c.days))
    END
FROM computed c
WHERE d.id=c.record_id AND c.days IS NOT NULL;

-- 4. 同步回 model_runs.output_data，使审批/智选/数字化库读取同一份结果。
WITH leave_runs AS (
  SELECT DISTINCT d.run_id,
         (d.identifier_values->>'5013001005001106')::numeric AS days
  FROM digital_library_records d
  JOIN digital_libraries l ON l.id=d.library_id
  JOIN models m ON m.id=l.model_id
  WHERE m.name='请休假模型'
    AND d.run_id IS NOT NULL
    AND COALESCE(d.identifier_values->>'5013001005001106','') ~ '^[0-9]+(?:\.[0-9]+)?$'
)
UPDATE model_runs r
SET output_data=COALESCE(r.output_data,'{}'::jsonb) || jsonb_build_object('days',lr.days)
FROM leave_runs lr
WHERE r.id=lr.run_id;
