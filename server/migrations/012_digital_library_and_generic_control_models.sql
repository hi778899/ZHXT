-- V15: 合并“数据查询”到“数字化库”；数字化库按模型配置展示并保存实际运行记录；审批/智选保持通用。

-- 1. 数据查询不再作为主界面/可发起模型能力，历史模型仅停用，避免影响旧数据外键。
UPDATE models SET can_start=false WHERE name='数据查询模型';

-- 2. 所有业务模型的固定后续首先进入通用审批模型；智选关联关系仍保存在各业务模型配置中，待审批后由通用智选模型读取。
UPDATE model_projects p
SET configuration = jsonb_set(
      jsonb_set(
        p.configuration,
        '{relations}',
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(p.configuration->'relations','[]'::jsonb)) r
            WHERE r->>'targetModelName'='审批模型' AND COALESCE(r->>'mode','hard_link')='hard_link'
          ) THEN COALESCE(p.configuration->'relations','[]'::jsonb)
          ELSE COALESCE(p.configuration->'relations','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'id','rel-v15-business-approval-' || p.id,
            'enabled',true,
            'mode','hard_link',
            'targetModelName','审批模型',
            'condition',jsonb_build_object('fieldKey','','operator','always','value',''),
            'description','业务模型数字化库完成数据确认后固定启动通用审批模型'
          ))
        END,
        true
      ),
      '{afterArchiveEnabled}',
      'true'::jsonb,
      true
    ) || jsonb_build_object('nextModelName','审批模型'),
    updated_at=now()
FROM models m
WHERE p.model_id=m.id
  AND COALESCE(p.suggestion->>'modelType','business')='business'
  AND m.name NOT IN ('审批模型','智选模型','数据查询模型');

-- 3. 审批模型设计界面只保留通用业务对象引用，不固化请假等具体字段。
UPDATE model_projects p
SET suggestion = p.suggestion || jsonb_build_object(
      'description','通用承接所有业务模型的归档结果，按审批配置形成审批过程和审批结论',
      'goal','作为全系统统一审批模型，读取任一业务模型的文件名、数字化标识和运行上下文，按审批配置完成审批并写入审批模型数字化库。',
      'scope','所有业务模型归档后的审批处理；不在审批模型中固化某个业务模型的专用表单字段。'
    ),
    design = jsonb_set(p.design,'{fields}','[
      {"id":"ap-source","label":"前序业务模型","key":"sourceModelName","type":"text","readonly":true,"required":true,"width":6},
      {"id":"ap-file","label":"前序模型文件名","key":"sourceFileName","type":"text","readonly":true,"required":true,"width":12},
      {"id":"ap-display-file","label":"中文显示名称","key":"sourceDisplayFileName","type":"text","readonly":true,"required":false,"width":12},
      {"id":"ap-id","label":"前序数字化标识","key":"sourceDigitalId","type":"text","readonly":true,"required":true,"width":6}
    ]'::jsonb,true),
    test_data='{"cases":[
      {"id":"ap-case-1","name":"通用业务模型A审批","input":{"sourceModelName":"业务模型A","sourceFileName":"5011001007001001-5011002000000001-20260908170000","sourceDisplayFileName":"业务模型A-张珊-20260908170000","sourceDigitalId":"5013001007001001"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}},
      {"id":"ap-case-2","name":"通用业务模型B审批","input":{"sourceModelName":"业务模型B","sourceFileName":"5011001007001002-5011002000000001-20260908170100","sourceDisplayFileName":"业务模型B-张珊-20260908170100","sourceDigitalId":"5013001007001002"},"expectValid":true,"expectedOutput":{"approvalRoute":"行政审批 → 业务审批","approvalStatus":"待审批"}}
    ]}'::jsonb,
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='审批模型';

-- 4. 智选模型测试数据也改成通用业务对象，不保留请休假专用示例。
UPDATE model_projects p
SET suggestion = p.suggestion || jsonb_build_object(
      'description','读取任一业务模型的文件名、数字化标识和审批结果，按该业务模型的标识关联配置判断后续模型',
      'scope','所有业务模型审批完成后的智能关联；智选模型不固化具体业务字段。'
    ),
    test_data='{"cases":[
      {"id":"sm-c1","name":"业务模型A无后续关联","input":{"businessSourceModelName":"业务模型A","businessFileName":"5011001007001001-5011002000000001-20260908170000","businessDisplayFileName":"业务模型A-张珊-20260908170000","businessDigitalId":"5013001007001001","approvalResult":"同意"},"expectValid":true,"expectedOutput":{"smartDecision":"本模型（业务模型A）没有后续关联的模型","associatedDigitalIds":[]}},
      {"id":"sm-c2","name":"业务模型B无后续关联","input":{"businessSourceModelName":"业务模型B","businessFileName":"5011001007001002-5011002000000001-20260908170100","businessDisplayFileName":"业务模型B-张珊-20260908170100","businessDigitalId":"5013001007001002","approvalResult":"同意"},"expectValid":true,"expectedOutput":{"smartDecision":"本模型（业务模型B）没有后续关联的模型","associatedDigitalIds":[]}}
    ]}'::jsonb,
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='智选模型';

-- 5. 已有审批模型数字化库记录清理为通用审批运行字段，避免复制每一种业务模型的具体内容。
UPDATE digital_library_records d
SET data = jsonb_build_object(
      'runId',r.id,
      'fileName',r.file_name,
      'displayFileName',COALESCE(r.display_file_name,''),
      'digitalId',d.digital_id,
      'sourceModelName',COALESCE(r.input_data->>'sourceModelName',''),
      'sourceFileName',COALESCE(r.input_data->>'sourceFileName',''),
      'sourceDisplayFileName',COALESCE(r.input_data->>'sourceDisplayFileName',''),
      'sourceDigitalId',COALESCE(r.input_data->>'sourceDigitalId',''),
      'sourceRunId',COALESCE(r.input_data->>'sourceRunId',''),
      'approvalRoute',COALESCE(r.output_data->'approvalRoute','""'::jsonb),
      'approvalStatus',COALESCE(r.output_data->'approvalStatus','""'::jsonb),
      'approvalResult',COALESCE(r.output_data->'approvalResult','""'::jsonb),
      'approvalProcess',COALESCE(r.output_data->'approvalProcess','[]'::jsonb)
    )
FROM model_runs r, models m
WHERE d.run_id=r.id AND d.model_id=m.id AND m.name='审批模型';

-- 6. 已有智选模型数字化库记录只保留通用关联信息。
UPDATE digital_library_records d
SET data = jsonb_build_object(
      'runId',r.id,
      'fileName',r.file_name,
      'displayFileName',COALESCE(r.display_file_name,''),
      'digitalId',d.digital_id,
      'businessSourceModelName',COALESCE(r.output_data->>'businessSourceModelName',r.input_data->>'businessSourceModelName',''),
      'businessFileName',COALESCE(r.output_data->>'businessFileName',r.input_data->>'businessFileName',''),
      'businessDisplayFileName',COALESCE(r.output_data->>'businessDisplayFileName',r.input_data->>'businessDisplayFileName',''),
      'businessDigitalId',COALESCE(r.output_data->>'businessDigitalId',r.input_data->>'businessDigitalId',''),
      'associatedDigitalIds',COALESCE(r.output_data->'associatedDigitalIds','[]'::jsonb),
      'associatedModels',COALESCE(r.output_data->'associatedModels','[]'::jsonb),
      'approvalResult',COALESCE(r.input_data->>'approvalResult',''),
      'smartDecision',COALESCE(r.output_data->>'smartDecision','')
    )
FROM model_runs r, models m
WHERE d.run_id=r.id AND d.model_id=m.id AND m.name='智选模型';

-- 7. “数据查询”已由“数字化库”统一承接，不再维护第二份查询记录表。
DROP TABLE IF EXISTS query_records;
