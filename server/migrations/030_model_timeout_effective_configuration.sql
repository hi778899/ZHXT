-- V17.7.22 / 18.3.6.26
-- migration: 030_model_timeout_effective_configuration.sql
-- 模型时限模型审批生效与当前有效值修复。
-- 目标：
-- 1. 把历史人工模型运行中保存在数字化标识或 input/output 的时限值规范化回模型时限数字化库正式字段；
-- 2. 已通过审批的人工模型时限配置标记为“生效”，未通过/未完成审批的标记为“待审批/未生效”；
-- 3. 系统初始化/同步基线继续保持生效，但后续运行时由审批后的正式配置按匹配精度与生效时间覆盖。

UPDATE digital_library_records d
SET data = COALESCE(d.data,'{}'::jsonb)
  || jsonb_build_object(
       '模型时限',
       COALESCE(
         NULLIF(d.identifier_values->>'5013001001110171',''),
         NULLIF(d.data->>'模型时限',''),
         NULLIF(d.data->'output'->>'timeoutHours',''),
         NULLIF(d.data->'input'->>'timeoutHours',''),
         ''
       ),
       '业务领域集合',
       COALESCE(
         d.identifier_values->'5013001001110172',
         d.data->'业务领域集合',
         d.data->'output'->'businessDomains',
         d.data->'input'->'businessDomains',
         '[]'::jsonb
       ),
       '数据版本',
       COALESCE(NULLIF(d.data->>'数据版本',''),'0622')
     )
WHERE d.library_id='lib-standard-model-timeout';

WITH approvals AS (
  SELECT DISTINCT ON (ar.source_run_id)
         ar.source_run_id,
         COALESCE(ar.output_data->>'审批结果',ar.output_data->>'approvalResult','') AS approval_result,
         ar.completed_at AS approved_at
  FROM model_runs ar
  JOIN models am ON am.id=ar.model_id
  WHERE am.name='审批模型'
    AND ar.status='已归档'
    AND ar.source_run_id IS NOT NULL
  ORDER BY ar.source_run_id,ar.completed_at DESC NULLS LAST,ar.created_at DESC,ar.id DESC
)
UPDATE digital_library_records d
SET data = COALESCE(d.data,'{}'::jsonb)
  || jsonb_build_object(
       '配置状态',
       CASE
         WHEN COALESCE(ap.approval_result,'') IN ('同意','通过','审批通过','已通过','允许生效') THEN '生效'
         WHEN COALESCE(ap.approval_result,'') <> '' THEN '未生效'
         ELSE '待审批'
       END,
       '审批结果',COALESCE(ap.approval_result,''),
       '生效时间',
       CASE
         WHEN COALESCE(ap.approval_result,'') IN ('同意','通过','审批通过','已通过','允许生效') THEN to_jsonb(ap.approved_at)
         ELSE COALESCE(d.data->'生效时间','null'::jsonb)
       END
     )
FROM approvals ap
WHERE d.library_id='lib-standard-model-timeout'
  AND d.record_origin='model_run'
  AND d.run_id=ap.source_run_id;

UPDATE digital_library_records d
SET data = COALESCE(d.data,'{}'::jsonb)
  || jsonb_build_object('配置状态','待审批')
WHERE d.library_id='lib-standard-model-timeout'
  AND d.record_origin='model_run'
  AND NOT EXISTS (
    SELECT 1
    FROM model_runs ar
    JOIN models am ON am.id=ar.model_id
    WHERE ar.source_run_id=d.run_id
      AND am.name='审批模型'
      AND ar.status='已归档'
  );

UPDATE digital_library_records d
SET data = COALESCE(d.data,'{}'::jsonb)
  || jsonb_build_object(
       '配置状态','生效',
       '生效时间',to_jsonb(d.created_at)
     )
WHERE d.library_id='lib-standard-model-timeout'
  AND d.record_origin IN ('system_initialization','system_sync');
