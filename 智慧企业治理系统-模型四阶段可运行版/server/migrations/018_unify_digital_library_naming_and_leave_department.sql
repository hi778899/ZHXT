-- V17.3.1
-- 1) 对外统一只使用“数字化库”概念；保留既有 lib-standard-* 技术 ID 以兼容历史链路。
-- 2) 修复既有生产库中请休假模型“所属部门”字段缺少数字化库自动带入配置的问题。

-- 数字化库显示名称统一。仅改变显示名称/描述，不改变库 ID、模型绑定和历史记录关系。
UPDATE digital_libraries
SET name = replace(name, '标准库', '数字化库'),
    description = replace(replace(COALESCE(description,''), '标准库', '数字化库'), '标准数据', '数字化数据'),
    updated_at = now()
WHERE name LIKE '%标准库%'
   OR COALESCE(description,'') LIKE '%标准库%'
   OR COALESCE(description,'') LIKE '%标准数据%';

UPDATE digital_library_records
SET library_name = replace(library_name, '标准库', '数字化库')
WHERE library_name LIKE '%标准库%';

-- 数字化库目录模型不再向用户输出“标准库/模型库”分类值，统一为“数字化库”。
UPDATE digital_library_records
SET identifier_values = jsonb_set(COALESCE(identifier_values,'{}'::jsonb), '{5013001001009002}', '"数字化库"'::jsonb, true),
    data = COALESCE(data,'{}'::jsonb) || jsonb_build_object('数字化库类型','数字化库')
WHERE library_id='lib-standard-library-catalog';

-- 已发布模型配置中的库显示名称统一；内部 lib-standard-* ID 不变。
UPDATE model_projects
SET suggestion = replace(suggestion::text, '标准库', '数字化库')::jsonb,
    design = replace(design::text, '标准库', '数字化库')::jsonb,
    test_data = replace(test_data::text, '标准库', '数字化库')::jsonb,
    configuration = replace(configuration::text, '标准库', '数字化库')::jsonb,
    updated_at = now()
WHERE suggestion::text LIKE '%标准库%'
   OR design::text LIKE '%标准库%'
   OR test_data::text LIKE '%标准库%'
   OR configuration::text LIKE '%标准库%';

-- 请休假模型：既有已发布项目补齐申请人和所属部门的数据取得方式。
-- 申请人由当前登录人员自动带入；所属部门通过人员信息数字化库按申请人匹配后自动带入。
WITH target AS (
  SELECT p.id,
         jsonb_agg(
           CASE
             WHEN f.value->>'key'='applicant' THEN
               (f.value - 'options') || jsonb_build_object(
                 'sourceMode','current_user',
                 'source','当前用户',
                 'readonly',true
               )
             WHEN f.value->>'key'='department' THEN
               (f.value - 'options') || jsonb_build_object(
                 'id',COALESCE(NULLIF(f.value->>'id',''),'leave-department'),
                 'sourceMode','library_fill',
                 'source','人员信息数字化库',
                 'readonly',true,
                 'digitalId',COALESCE(NULLIF(f.value->>'digitalId',''),'5013001005001102'),
                 'linkage',jsonb_build_object(
                   'sourceLibraryId','lib-standard-person',
                   'sourceLibrary','人员信息数字化库',
                   'triggerFieldKey','applicant',
                   'matchDigitalId','5013001001002002',
                   'sourceDigitalId','5013001001002004',
                   'mode','fill'
                 )
               )
             ELSE f.value
           END
           ORDER BY f.ordinality
         ) AS fields
  FROM model_projects p
  JOIN models m ON m.id=p.model_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.design->'fields','[]'::jsonb)) WITH ORDINALITY AS f(value, ordinality)
  WHERE m.name='请休假模型'
  GROUP BY p.id
)
UPDATE model_projects p
SET design=jsonb_set(COALESCE(p.design,'{}'::jsonb),'{fields}',target.fields,true),
    updated_at=now()
FROM target
WHERE p.id=target.id;
