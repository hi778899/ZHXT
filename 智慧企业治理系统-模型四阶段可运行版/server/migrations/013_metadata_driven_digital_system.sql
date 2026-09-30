-- V16: 元数据驱动数字化体系。数字化库兼具标准库能力；库列=16位数字化标识；模型建设四阶段按四个独立模型运行。

CREATE TABLE IF NOT EXISTS business_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES business_definitions(id) ON DELETE SET NULL,
  level_no INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  definition_type TEXT NOT NULL CHECK (definition_type IN ('编码','属性','标识','数字化库','文件名')),
  definition_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_codes (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('model','person','organization','other')),
  object_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{16}$'),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(object_type, object_id)
);
CREATE INDEX IF NOT EXISTS digital_codes_object_idx ON digital_codes(object_type, object_id);

CREATE TABLE IF NOT EXISTS digital_attribute_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_object_attributes (
  id TEXT PRIMARY KEY,
  digital_code_id TEXT NOT NULL REFERENCES digital_codes(id) ON DELETE CASCADE,
  attribute_definition_id TEXT NOT NULL REFERENCES digital_attribute_definitions(id) ON DELETE RESTRICT,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(digital_code_id, attribute_definition_id)
);

CREATE TABLE IF NOT EXISTS digital_identifiers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{16}$'),
  display_name TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text' CHECK (data_type IN ('text','textarea','number','date','boolean','user','department','json','select','multiselect')),
  business_definition_id TEXT REFERENCES business_definitions(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_identifiers_name_idx ON digital_identifiers(display_name);

CREATE TABLE IF NOT EXISTS digital_libraries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  model_id TEXT UNIQUE REFERENCES models(id) ON DELETE SET NULL,
  library_type TEXT NOT NULL DEFAULT 'model' CHECK (library_type IN ('model','standard')),
  is_standard BOOLEAN NOT NULL DEFAULT false,
  allow_as_source BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_libraries_standard_idx ON digital_libraries(is_standard, allow_as_source, name);

CREATE TABLE IF NOT EXISTS digital_library_columns (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL REFERENCES digital_libraries(id) ON DELETE CASCADE,
  digital_identifier_id TEXT NOT NULL REFERENCES digital_identifiers(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  source_role TEXT NOT NULL DEFAULT 'data' CHECK (source_role IN ('data','system','result')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(library_id, digital_identifier_id)
);
CREATE INDEX IF NOT EXISTS digital_library_columns_order_idx ON digital_library_columns(library_id, position);

ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS library_id TEXT REFERENCES digital_libraries(id) ON DELETE SET NULL;
ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS identifier_values JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS digital_library_records_library_id_idx ON digital_library_records(library_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_library_records_identifier_values_gin ON digital_library_records USING GIN(identifier_values);

CREATE TABLE IF NOT EXISTS model_field_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES model_projects(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  target_digital_identifier_id TEXT REFERENCES digital_identifiers(id) ON DELETE SET NULL,
  source_library_id TEXT REFERENCES digital_libraries(id) ON DELETE SET NULL,
  source_digital_identifier_id TEXT REFERENCES digital_identifiers(id) ON DELETE SET NULL,
  match_digital_identifier_id TEXT REFERENCES digital_identifiers(id) ON DELETE SET NULL,
  source_mode TEXT NOT NULL DEFAULT 'manual' CHECK (source_mode IN ('manual','current_user','library_select','library_multi_select','library_fill','calculated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, field_id)
);

CREATE TABLE IF NOT EXISTS model_build_stage_runs (
  id TEXT PRIMARY KEY,
  target_project_id TEXT NOT NULL REFERENCES model_projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL CHECK (stage_key IN ('suggestion','design','test','config')),
  stage_model_name TEXT NOT NULL,
  stage_run_id TEXT REFERENCES model_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_project_id, stage_key)
);

CREATE SEQUENCE IF NOT EXISTS digital_identifier_auto_seq START WITH 1;

-- 数字化基本定义。
INSERT INTO digital_definitions(id,code,name,definition_type,definition_text) VALUES
 ('def-code','D-CODE','数字化编码','编码','用于模型、人员等系统对象唯一确认；当前采用16位数字结构。'),
 ('def-attr','D-ATTR','数字化属性','属性','在数字化编码对象下配置系统维度参数，用于分类、权限、规则和运行条件。'),
 ('def-id','D-ID','数字化标识','标识','数据在系统内的标准存储识别单元；当前采用16位数字结构，并配置中文显示名称与数据类型。'),
 ('def-lib','D-LIB','数字化库','数字化库','一个模型对应一个数字化库；库列由数字化标识定义，模型运行形成一条记录。'),
 ('def-fn','D-FN','模型运行文件名','文件名','模型数字化编码-发起人人员数字化编码-时间码；另保存中文显示名称。')
ON CONFLICT(code) DO UPDATE SET definition_text=EXCLUDED.definition_text,updated_at=now();

INSERT INTO business_definitions(id,code,name,level_no,description) VALUES
 ('biz-governance','B001','企业治理业务',1,'智慧企业治理系统业务总类'),
 ('biz-model-build','B00101','模型建设',2,'模型建议、设计、测试、配置等系统建设业务'),
 ('biz-digital','B00102','数字化管理',2,'编码、属性、标识、数字化库等数字化建设业务'),
 ('biz-leave','B00103','请休假管理',2,'请休假申请及相关业务数据')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,updated_at=now();

-- 初始数字化属性定义。
INSERT INTO digital_attribute_definitions(id,code,name,value_type,description) VALUES
 ('attr-business-domain','A001','业务领域','text','对象所属业务领域'),
 ('attr-functional-category','A002','功能类别','text','对象承担的功能类别'),
 ('attr-org-level','A003','组织层级','text','人员或组织对象的组织层级'),
 ('attr-model-type','A004','模型类型','text','业务、审批、智选、建设、数字化等模型类型')
ON CONFLICT(code) DO NOTHING;

-- 标准库数字化标识。页面显示中文名，系统使用16位数字化标识。
INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES
 ('did-person-code','5013001001002001','人员数字化编码','text','人员16位数字化编码'),
 ('did-person-name','5013001001002002','人员姓名','user','人员中文姓名'),
 ('did-person-account','5013001001002003','人员账号','text','系统登录账号'),
 ('did-person-dept','5013001001002004','所属部门','department','人员所属部门'),
 ('did-person-role','5013001001002005','人员角色','text','系统角色'),
 ('did-person-status','5013001001002006','人员状态','select','人员启用状态'),
 ('did-dept-name','5013001001003001','部门名称','department','部门中文名称'),
 ('did-dept-parent','5013001001003002','上级部门','department','上级部门名称'),
 ('did-dept-status','5013001001003003','部门状态','select','部门启用状态'),
 ('did-leave-type-code','5013001001004001','请假类型编码','text','请假类型标准编码'),
 ('did-leave-type-name','5013001001004002','请假类型名称','select','请休假申请可选择的请假类型'),
 ('did-leave-type-status','5013001001004003','请假类型状态','select','请假类型是否启用'),
 ('did-leave-applicant','5013001005001101','申请人','user','请休假申请人'),
 ('did-leave-department','5013001005001102','所属部门','department','请休假申请人所属部门'),
 ('did-leave-type','5013001005001103','请假类型','select','本次选择的请假类型'),
 ('did-leave-start','5013001005001104','开始日期','date','请假开始日期'),
 ('did-leave-end','5013001005001105','结束日期','date','请假结束日期'),
 ('did-leave-days','5013001005001106','请假天数','number','模型计算得到的请假天数'),
 ('did-leave-reason','5013001005001107','请假事由','textarea','本次请假事由'),
 ('did-approval-source-file','5013001005001201','前序模型文件名','text','审批对象的模型运行文件名'),
 ('did-approval-source-id','5013001005001202','前序数字化标识','text','审批对象数字化标识'),
 ('did-approval-route','5013001005001203','审批路线','text','本次审批实际路线'),
 ('did-approval-result','5013001005001204','审批结果','text','审批最终结果'),
 ('did-approval-process','5013001005001205','审批过程','json','逐环节审批过程数据'),
 ('did-smart-business-file','5013001005001301','业务模型文件名','text','智选判断对应业务模型文件名'),
 ('did-smart-business-id','5013001005001302','业务数字化标识','text','智选判断对应业务数字化标识'),
 ('did-smart-related-id','5013001005001303','关联数字化标识','json','命中的关联数字化标识集合'),
 ('did-smart-decision','5013001005001304','智选判断','text','智选模型判断结果'),
 ('did-smart-target','5013001005001305','后续模型','json','命中的后续业务模型集合')
ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,description=EXCLUDED.description,updated_at=now();

-- 三个基础标准库。
INSERT INTO digital_libraries(id,name,library_type,is_standard,allow_as_source,description) VALUES
 ('lib-standard-person','人员信息标准库','standard',true,true,'人员基础信息标准数据，可供模型选择和联动'),
 ('lib-standard-dept','部门信息标准库','standard',true,true,'组织部门标准数据，可供模型选择和联动'),
 ('lib-standard-leave-type','请假类型标准库','standard',true,true,'请假类型标准数据，业务模型优先选择而非自由输入')
ON CONFLICT(name) DO UPDATE SET is_standard=true,allow_as_source=true,updated_at=now();

INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role) VALUES
 ('col-person-code','lib-standard-person','did-person-code',1,true,'data'),
 ('col-person-name','lib-standard-person','did-person-name',2,true,'data'),
 ('col-person-account','lib-standard-person','did-person-account',3,true,'data'),
 ('col-person-dept','lib-standard-person','did-person-dept',4,false,'data'),
 ('col-person-role','lib-standard-person','did-person-role',5,false,'data'),
 ('col-person-status','lib-standard-person','did-person-status',6,true,'data'),
 ('col-dept-name','lib-standard-dept','did-dept-name',1,true,'data'),
 ('col-dept-parent','lib-standard-dept','did-dept-parent',2,false,'data'),
 ('col-dept-status','lib-standard-dept','did-dept-status',3,true,'data'),
 ('col-leave-type-code','lib-standard-leave-type','did-leave-type-code',1,true,'data'),
 ('col-leave-type-name','lib-standard-leave-type','did-leave-type-name',2,true,'data'),
 ('col-leave-type-status','lib-standard-leave-type','did-leave-type-status',3,true,'data')
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,required=EXCLUDED.required;

-- 将所有已有模型建立为数字化对象，并建立对应数字化库元数据。
INSERT INTO digital_codes(id,object_type,object_id,code,display_name)
SELECT 'dcode-model-' || m.id,'model',m.id,p.configuration->>'modelCode',m.name
FROM models m JOIN model_projects p ON p.model_id=m.id
WHERE COALESCE(p.configuration->>'modelCode','') ~ '^[0-9]{16}$'
ON CONFLICT(object_type,object_id) DO UPDATE SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now();

INSERT INTO digital_codes(id,object_type,object_id,code,display_name)
SELECT 'dcode-person-' || u.id,'person',u.id,u.employee_code,u.display_name
FROM users u WHERE u.employee_code ~ '^[0-9]{16}$'
ON CONFLICT(object_type,object_id) DO UPDATE SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now();

INSERT INTO digital_libraries(id,name,model_id,library_type,is_standard,allow_as_source,description)
SELECT 'lib-model-' || m.id,
       COALESCE(NULLIF(p.configuration->>'storageName',''),m.name || '数字化库'),
       m.id,'model',COALESCE((p.configuration->>'isStandardLibrary')::boolean,false),COALESCE((p.configuration->>'allowAsSource')::boolean,true),
       m.name || '每次运行归档形成一条数据记录；库列由16位数字化标识定义。'
FROM models m JOIN model_projects p ON p.model_id=m.id
WHERE m.name <> '数据查询模型'
ON CONFLICT(model_id) DO UPDATE SET name=EXCLUDED.name,is_standard=EXCLUDED.is_standard,allow_as_source=EXCLUDED.allow_as_source,description=EXCLUDED.description,updated_at=now();

-- 给已有模型表单字段分配16位数字化标识；已知请休假/审批/智选字段使用固定标识，其余自动分配。
WITH expanded AS (
  SELECT p.id AS project_id,m.name AS model_name,f.value AS field_json,f.ordinality AS ord,
         f.value->>'id' AS field_id,f.value->>'key' AS field_key,f.value->>'label' AS field_label,f.value->>'type' AS field_type,
         CASE
           WHEN m.name='请休假模型' AND f.value->>'key'='applicant' THEN '5013001005001101'
           WHEN m.name='请休假模型' AND f.value->>'key'='department' THEN '5013001005001102'
           WHEN m.name='请休假模型' AND f.value->>'key'='leaveType' THEN '5013001005001103'
           WHEN m.name='请休假模型' AND f.value->>'key'='startDate' THEN '5013001005001104'
           WHEN m.name='请休假模型' AND f.value->>'key'='endDate' THEN '5013001005001105'
           WHEN m.name='请休假模型' AND f.value->>'key'='reason' THEN '5013001005001107'
           WHEN m.name='审批模型' AND f.value->>'key'='sourceFileName' THEN '5013001005001201'
           WHEN m.name='审批模型' AND f.value->>'key'='sourceDigitalId' THEN '5013001005001202'
           WHEN m.name='智选模型' AND f.value->>'key'='businessFileName' THEN '5013001005001301'
           WHEN m.name='智选模型' AND f.value->>'key'='businessDigitalId' THEN '5013001005001302'
           WHEN m.name='智选模型' AND f.value->>'key'='associatedDigitalIds' THEN '5013001005001303'
           ELSE COALESCE(NULLIF(f.value->>'digitalId',''),'5013999' || lpad(nextval('digital_identifier_auto_seq')::text,9,'0'))
         END AS digital_code
  FROM model_projects p JOIN models m ON m.id=p.model_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.design->'fields','[]'::jsonb)) WITH ORDINALITY f(value,ordinality)
  WHERE COALESCE(f.value->>'type','') <> 'section'
), inserted_ids AS (
  INSERT INTO digital_identifiers(id,code,display_name,data_type,description)
  SELECT 'did-auto-' || md5(project_id || ':' || field_id),digital_code,
         COALESCE(NULLIF(field_label,''),field_key),
         CASE WHEN field_type IN ('text','textarea','number','date','boolean','user','department','select') THEN field_type WHEN field_type='checkbox' THEN 'multiselect' ELSE 'json' END,
         '由模型设计字段建立的数字化标识'
  FROM expanded
  ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,updated_at=now()
  RETURNING id,code
), design_updated AS (
  SELECT e.project_id,jsonb_agg(e.field_json || jsonb_build_object('digitalId',e.digital_code) ORDER BY e.ord) AS fields
  FROM expanded e GROUP BY e.project_id
)
UPDATE model_projects p SET design=jsonb_set(p.design,'{fields}',d.fields,true),updated_at=now()
FROM design_updated d WHERE p.id=d.project_id;

-- 建立模型数字化库列。
INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-' || md5(p.id || ':' || (f.value->>'id')),
       l.id,did.id,f.ordinality::int,COALESCE((f.value->>'required')::boolean,false),
       CASE WHEN COALESCE(f.value->>'readonly','false')='true' THEN 'result' ELSE 'data' END
FROM model_projects p
JOIN models m ON m.id=p.model_id
JOIN digital_libraries l ON l.model_id=m.id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.design->'fields','[]'::jsonb)) WITH ORDINALITY f(value,ordinality)
JOIN digital_identifiers did ON did.code=f.value->>'digitalId'
WHERE COALESCE(f.value->>'type','') <> 'section'
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,required=EXCLUDED.required,source_role=EXCLUDED.source_role;

-- 请休假模型增加“请假天数”结果列；其值由运算配置形成，不由用户填写。
INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-leave-days',l.id,'did-leave-days',90,false,'result'
FROM digital_libraries l JOIN models m ON m.id=l.model_id WHERE m.name='请休假模型'
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET source_role='result';

-- 既有记录补齐 library_id；identifier_values 将在应用层按模型设计映射，新运行记录直接写入。
UPDATE digital_library_records d SET library_id=l.id
FROM digital_libraries l
WHERE d.library_id IS NULL AND d.library_name=l.name;

-- 标准库记录不是某次业务模型运行，因此允许 model_id / owner_id 为空。
ALTER TABLE digital_library_records ALTER COLUMN model_id DROP NOT NULL;
ALTER TABLE digital_library_records ALTER COLUMN owner_id DROP NOT NULL;

-- 请假类型标准数据。
INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'std-leave-' || v.code,NULL,NULL,NULL,NULL,'请假类型标准库','5013001001004002','lib-standard-leave-type',
       jsonb_build_object('5013001001004001',v.code,'5013001001004002',v.name,'5013001001004003','启用'),
       jsonb_build_object('请假类型编码',v.code,'请假类型名称',v.name,'状态','启用')
FROM (VALUES ('L01','年休假'),('L02','事假'),('L03','病假'),('L04','婚假'),('L05','调休')) v(code,name)
ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 四个模型建设阶段对应四个独立模型，不再把阶段本身理解为一个模型内的四个 Tab。
-- 模型编码和数字化标识均为16位；这四个模型本身也属于普通模型，运行后进入通用审批→智选。
INSERT INTO models(id,name,category,description,can_start)
VALUES
 ('model-stage-suggestion','模型建议模型','模型建设','形成目标模型的功能目标、边界、适用范围与启动约束',true),
 ('model-stage-design','模型设计模型','模型建设','形成目标模型的表单、数据源、数字化标识、运算和运行结构设计',true),
 ('model-stage-test','模型测试模型','模型建设','对目标模型的输入、数据源、运算、输出和存储映射进行验证',true),
 ('model-stage-config','模型配置模型','模型建设','配置目标模型数字化库、启动方式、模型关系并形成发布结果',true)
ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description;

-- 数字化建设模型簇。
INSERT INTO models(id,name,category,description,can_start)
VALUES
 ('model-digital-business-definition','业务定义模型','数字化管理','建立业务领域及业务颗粒定义',true),
 ('model-digital-definition','数字化定义模型','数字化管理','建立数字化编码、属性、标识和数字化库等定义',true),
 ('model-digital-model-code','模型数字化编码模型','数字化管理','为模型分配16位模型数字化编码',true),
 ('model-digital-person-code','人员数字化编码模型','数字化管理','为人员分配16位人员数字化编码',true),
 ('model-digital-attribute','数字化属性配置模型','数字化管理','在数字化编码对象下配置数字化属性',true),
 ('model-digital-identifier','数字化标识建设模型','数字化管理','建立16位数字化标识、中文显示名称、数据类型和业务归属',true),
 ('model-digital-library','数字化库配置模型','数字化管理','将数字化标识组合成数字化库并配置标准库能力',true)
ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description;

-- 元数据本身也进入数字化库，供数字化建设模型通过“选择”完成配置。
INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES
 ('did-model-name','5013001001005001','模型名称','select','系统模型中文名称'),
 ('did-model-category','5013001001005002','模型类别','select','模型所属功能类别'),
 ('did-model-code','5013001001005003','模型数字化编码','text','模型16位数字化编码'),
 ('did-model-status','5013001001005004','模型状态','select','模型建设/发布状态'),
 ('did-business-code','5013001001006001','业务编码','text','业务定义编码'),
 ('did-business-name','5013001001006002','业务名称','select','业务中文名称'),
 ('did-business-parent','5013001001006003','上级业务','select','上级业务名称'),
 ('did-business-level','5013001001006004','业务层级','number','业务层级'),
 ('did-business-desc','5013001001006005','业务定义','textarea','业务边界和定义'),
 ('did-definition-code','5013001001007001','定义编码','text','数字化定义编码'),
 ('did-definition-name','5013001001007002','定义名称','select','数字化定义名称'),
 ('did-definition-type','5013001001007003','定义类型','select','编码/属性/标识/数字化库/文件名'),
 ('did-definition-text','5013001001007004','定义内容','textarea','数字化规则定义'),
 ('did-identifier-code','5013001001008001','数字化标识','text','16位数字化标识'),
 ('did-identifier-name','5013001001008002','数字化标识中文名','text','数字化标识中文显示名称'),
 ('did-identifier-type','5013001001008003','标识数据类型','select','数字化标识的数据类型'),
 ('did-identifier-desc','5013001001008004','标识说明','textarea','数字化标识业务含义'),
 ('did-library-name','5013001001009001','数字化库名称','select','数字化库中文名称'),
 ('did-library-type','5013001001009002','数字化库类型','select','模型库或标准库'),
 ('did-library-standard','5013001001009003','标准库功能','boolean','是否作为标准数据源'),
 ('did-library-source','5013001001009004','允许作为数据源','boolean','是否允许模型设计引用')
ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,description=EXCLUDED.description,updated_at=now();

INSERT INTO digital_libraries(id,name,library_type,is_standard,allow_as_source,description) VALUES
 ('lib-standard-model','模型信息标准库','standard',true,true,'模型对象、类别、模型数字化编码和状态'),
 ('lib-standard-business-definition','业务定义标准库','standard',true,true,'业务定义模型形成并确认的业务定义'),
 ('lib-standard-digital-definition','数字化定义标准库','standard',true,true,'数字化定义模型形成并确认的数字化定义'),
 ('lib-standard-identifier','数字化标识标准库','standard',true,true,'数字化标识建设模型形成并确认的标识元数据'),
 ('lib-standard-library-catalog','数字化库目录标准库','standard',true,true,'数字化库配置模型形成并确认的库目录')
ON CONFLICT(name) DO UPDATE SET is_standard=true,allow_as_source=true,updated_at=now();

INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role) VALUES
 ('col-model-name','lib-standard-model','did-model-name',1,true,'data'),('col-model-category','lib-standard-model','did-model-category',2,true,'data'),('col-model-code','lib-standard-model','did-model-code',3,false,'data'),('col-model-status','lib-standard-model','did-model-status',4,true,'data'),
 ('col-biz-code','lib-standard-business-definition','did-business-code',1,true,'data'),('col-biz-name','lib-standard-business-definition','did-business-name',2,true,'data'),('col-biz-parent','lib-standard-business-definition','did-business-parent',3,false,'data'),('col-biz-level','lib-standard-business-definition','did-business-level',4,true,'data'),('col-biz-desc','lib-standard-business-definition','did-business-desc',5,false,'data'),
 ('col-def-code','lib-standard-digital-definition','did-definition-code',1,true,'data'),('col-def-name','lib-standard-digital-definition','did-definition-name',2,true,'data'),('col-def-type','lib-standard-digital-definition','did-definition-type',3,true,'data'),('col-def-text','lib-standard-digital-definition','did-definition-text',4,true,'data'),
 ('col-id-code','lib-standard-identifier','did-identifier-code',1,true,'data'),('col-id-name','lib-standard-identifier','did-identifier-name',2,true,'data'),('col-id-type','lib-standard-identifier','did-identifier-type',3,true,'data'),('col-id-desc','lib-standard-identifier','did-identifier-desc',4,false,'data'),
 ('col-lib-name','lib-standard-library-catalog','did-library-name',1,true,'data'),('col-lib-type','lib-standard-library-catalog','did-library-type',2,true,'data'),('col-lib-standard','lib-standard-library-catalog','did-library-standard',3,true,'data'),('col-lib-source','lib-standard-library-catalog','did-library-source',4,true,'data')
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,required=EXCLUDED.required;
