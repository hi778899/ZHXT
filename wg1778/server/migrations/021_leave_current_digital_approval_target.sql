-- V17.7.7：请休假模型进入当前19位模型数字化编码与0622审批计算链。
-- 原则：不修改历史已归档运行；不再使用“考勤管理 -> 四级”历史示例作为新运行审批目标。

UPDATE model_projects p
SET configuration=jsonb_set(
      jsonb_set(COALESCE(p.configuration,'{}'::jsonb),'{modelCode}',to_jsonb('5011001005001000001'::text),true),
      '{digitalStructureVersion}',to_jsonb('0622'::text),true
    ),
    updated_at=now()
FROM models m
WHERE p.model_id=m.id AND m.name='请休假模型';

INSERT INTO digital_codes(id,object_type,object_id,code,display_name)
SELECT 'dcode-v1777-leave','model',m.id,'5011001005001000001','请休假模型'
FROM models m WHERE m.name='请休假模型'
ON CONFLICT(object_type,object_id) DO UPDATE
SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now();

-- “考勤管理”业务属性来自既有0622业务分类数字化库；字段数字化标识沿用该模型当前已发布设计，
-- 仅用于把现有请休假模型接入统一数字化审批计算，后续列级19位标识应通过数字化标识建设模型正式迁移。
INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'src0622-3-leave-current',l.model_id,NULL,NULL,NULL,l.name,'5011001005001000001',l.id,'{}'::jsonb,
       '{"模型数字化编码":"5011001005001000001","模型名称":"请休假模型","数字化属性集合":"[5012001005001000000]","数字化标识集合":"[5013001005001101,5013001005001102,5013001005001103,5013001005001104,5013001005001105,5013001005001106,5013001005001107]","数据版本":"0622","数据来源":"请休假模型当前结构迁移；审批目标由数字化库动态计算"}'::jsonb
FROM digital_libraries l WHERE l.id='lib-standard-digital-config'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,library_name=EXCLUDED.library_name,digital_id=EXCLUDED.digital_id,library_id=EXCLUDED.library_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 历史“考勤管理 -> 四级”记录保留用于历史追溯，但标记为历史兼容，禁止作为新运行正式数据源。
UPDATE digital_library_records
SET data = COALESCE(data,'{}'::jsonb) || '{"当前状态":"历史兼容，不参与当前审批目标计算"}'::jsonb
WHERE id IN ('std-v17-leave-admin-selector','std-v17-leave-business-selector');
