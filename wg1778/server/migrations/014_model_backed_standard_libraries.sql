-- V17 第一版：所有下拉/多选标准值均来源于“对应标准模型 -> 数字化库 -> 模型运行记录”。
-- 同时补齐数字化配置、审批和智选所需的基础标准库与配置模型。

-- 1. 标准模型与审批/智选配置模型。
INSERT INTO models(id,name,category,description,can_start) VALUES
 ('model-std-person','人员信息模型','基础标准','维护人员姓名、账号、部门、角色等人员标准数据',true),
 ('model-std-department','部门信息模型','基础标准','维护部门及组织基础标准数据',true),
 ('model-std-leave-type','请假类型标准模型','基础标准','维护请假类型标准数据',true),
 ('model-std-model-info','模型信息标准模型','基础标准','形成模型名称、模型类别、模型编码和模型状态标准数据',true),
 ('model-std-digital-type','数字化类型标准模型','数字化标准','维护数字化编码、属性、标识等类型标准',true),
 ('model-std-code-type','数字化编码类型标准模型','数字化标准','维护模型、人员、组织等编码类型标准',true),
 ('model-std-business-level','业务层级标准模型','数字化标准','维护一级至四级业务层级标准',true),
 ('model-std-definition-type','数字化定义类型标准模型','数字化标准','维护编码、属性、标识、数字化库、文件名等定义类型',true),
 ('model-std-object-type','数字化对象类型标准模型','数字化标准','维护模型、人员、组织等数字化对象类型',true),
 ('model-std-attribute-definition','数字化属性定义模型','数字化标准','维护可配置到数字化对象下的属性定义',true),
 ('model-std-data-type','数据类型标准模型','数字化标准','维护数字化标识数据类型标准',true),
 ('model-std-org-nature','组织性质标准模型','组织标准','维护党组织、行政机构、委员会等组织性质标准',true),
 ('model-std-admin-approval-level','行政审批层级标准模型','审批标准','维护行政审批层级标准',true),
 ('model-std-business-approval-level','业务审批层级标准模型','审批标准','维护业务审批层级标准',true),
 ('model-std-approval-opinion','审批意见标准模型','审批标准','维护审批意见标准',true),
 ('model-std-meeting-type','会议类型标准模型','会议标准','维护会议类型标准',true),
 ('model-std-meeting-room','会议室标准模型','会议标准','维护会议室标准',true),
 ('model-std-review-opinion','议题审定意见标准模型','会议标准','维护议题审定意见标准',true),
 ('model-std-yes-no','是否标准模型','公共标准','维护是/否标准值',true),
 ('model-std-org-rank','组织职级标准模型','组织标准','维护组织性质、组织层级和职级标准',true),
 ('model-std-threshold-type','阈值类型标准模型','审批标准','维护金额、人员、天数等阈值类型',true),
 ('model-std-model-timeout','模型时限标准模型','运行标准','维护模型办理时限标准',true),
 ('model-config-digital','数字化配置模型','数字化配置','为数字化编码对象配置数字化属性和数字化标识',true),
 ('model-config-digital-display','数字化展示模型','数字化配置','按人员及授权范围展示数字化编码、属性和标识',true),
 ('model-config-admin-approval','行政审批层级分选模型','审批配置','按业务事项配置行政审批层级',true),
 ('model-config-business-approval','业务审批层级分选模型','审批配置','按业务事项配置业务审批层级',true),
 ('model-config-position','岗位分选模型','审批配置','按业务事项配置使用岗、审查岗和管理岗',true),
 ('model-config-identifier-trigger','标识触发配置模型','智选配置','配置数字化标识与后续模型的引用关系',true),
 ('model-config-business-ownership','业务归属配置模型','数字化配置','配置组织与业务范围的归属关系',true),
 ('model-config-approval-assignment','审批分管配置模型','审批配置','配置组织职级对应的行政/业务审批分管范围及阈值',true),
 ('model-config-threshold','审批阈值配置模型','审批配置','配置金额、人员、天数等审批阈值规则',true)
ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description;

-- 2. 标准库/配置库字段的16位数字化标识。
INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES
 ('did-std-digital-type-code','5013001001110001','数字化类型码','text','数字化类型代码'),
 ('did-std-digital-type-name','5013001001110002','数字化类型','select','数字化类型中文名称'),
 ('did-std-code-type-code','5013001001110011','数字化编码类型码','text','三位编码类型码'),
 ('did-std-code-type-name','5013001001110012','数字化编码类型','select','数字化编码类型中文名称'),
 ('did-std-business-level-code','5013001001110021','业务层级码','text','业务层级代码'),
 ('did-std-business-level-name','5013001001110022','业务层级','select','一级/二级/三级/四级'),
 ('did-std-definition-type-code','5013001001110031','定义类型码','text','数字化定义类型代码'),
 ('did-std-definition-type-name','5013001001110032','定义类型','select','编码/属性/标识/数字化库/文件名'),
 ('did-std-object-type-code','5013001001110041','对象类型码','text','数字化对象类型代码'),
 ('did-std-object-type-name','5013001001110042','对象类型','select','模型/人员/组织等对象类型'),
 ('did-std-attribute-code','5013001001110051','属性定义码','text','数字化属性定义代码'),
 ('did-std-attribute-name','5013001001110052','数字化属性名称','select','数字化属性中文名称'),
 ('did-std-attribute-desc','5013001001110053','数字化属性说明','textarea','数字化属性业务说明'),
 ('did-std-data-type-code','5013001001110061','数据类型码','text','数据类型代码'),
 ('did-std-data-type-name','5013001001110062','数据类型','select','数字化标识的数据类型'),
 ('did-std-org-nature-code','5013001001110071','组织性质码','text','组织性质两位代码'),
 ('did-std-org-nature-name','5013001001110072','组织性质','select','党组织/行政机构/委员会'),
 ('did-std-dept-org-nature','5013001001110703','部门组织性质','select','部门对应组织性质'),
 ('did-std-admin-level-code','5013001001110081','行政审批层级码','number','行政审批层级代码'),
 ('did-std-admin-level-name','5013001001110082','行政审批层级','select','行政审批层级名称'),
 ('did-std-business-level2-code','5013001001110091','业务审批层级码','number','业务审批层级代码'),
 ('did-std-business-level2-name','5013001001110092','业务审批层级','select','业务审批层级名称'),
 ('did-std-opinion-code','5013001001110101','审批意见码','text','审批意见代码'),
 ('did-std-opinion-name','5013001001110102','审批意见','select','同意/不同意/退回修改等'),
 ('did-std-opinion-terminal','5013001001110103','审批意见是否终止','boolean','该意见是否终止审批'),
 ('did-std-meeting-type-code','5013001001110111','会议类型码','text','会议类型代码'),
 ('did-std-meeting-type-name','5013001001110112','会议类型','select','会议类型中文名称'),
 ('did-std-room-code','5013001001110121','会议室编码','text','会议室代码'),
 ('did-std-room-name','5013001001110122','会议室名称','select','会议室中文名称'),
 ('did-std-room-capacity','5013001001110123','会议室容纳人数','number','会议室容量'),
 ('did-std-review-code','5013001001110131','审定意见码','text','议题审定意见代码'),
 ('did-std-review-name','5013001001110132','审定意见','select','同意上会/不同意上会'),
 ('did-std-yn-code','5013001001110141','是否标准值码','text','是/否标准值代码'),
 ('did-std-yn-name','5013001001110142','是否标准值','select','是/否'),
 ('did-std-org-rank-nature','5013001001110151','组织职级-组织性质','select','组织职级对应的组织性质'),
 ('did-std-org-rank-level','5013001001110152','组织层级码','text','组织层级代码'),
 ('did-std-org-rank-code','5013001001110153','职级码','text','组织内职级代码'),
 ('did-std-org-rank-name','5013001001110154','职级含义','select','组织职级中文名称'),
 ('did-std-threshold-code','5013001001110161','阈值类型码','text','阈值类型代码'),
 ('did-std-threshold-name','5013001001110162','阈值类型','select','金额/人员/天数'),
 ('did-std-timeout-hours','5013001001110171','模型时限小时','number','模型办理时限小时数'),
 ('did-std-timeout-business','5013001001110172','模型时限适用业务','multiselect','时限适用业务范围'),
 ('did-cfg-digital-model','5013001001210001','数字化配置对象','select','需要配置数字化的对象'),
 ('did-cfg-digital-code','5013001001210002','数字化配置对象编码','text','对象16位数字化编码'),
 ('did-cfg-digital-attrs','5013001001210003','数字化属性集合','multiselect','配置到对象的数字化属性集合'),
 ('did-cfg-digital-ids','5013001001210004','数字化标识集合','multiselect','配置到对象的数字化标识集合'),
 ('did-cfg-display-user','5013001001210011','数字化展示操作者','user','当前操作者'),
 ('did-cfg-display-dept','5013001001210012','数字化展示部门','department','当前操作者部门'),
 ('did-cfg-display-codes','5013001001210013','数字化编码展示集','multiselect','授权可见数字化编码集合'),
 ('did-cfg-display-attrs','5013001001210014','数字化属性展示集','multiselect','授权可见数字化属性集合'),
 ('did-cfg-display-ids','5013001001210015','数字化标识展示集','multiselect','授权可见数字化标识集合'),
 ('did-cfg-admin-business','5013001001210101','行政审批分选业务','select','行政审批层级分选对应业务事项'),
 ('did-cfg-admin-level','5013001001210102','行政审批分选层级','select','选定的行政审批层级'),
 ('did-cfg-business-business','5013001001210201','业务审批分选业务','select','业务审批层级分选对应业务事项'),
 ('did-cfg-business-level','5013001001210202','业务审批分选层级','select','选定的业务审批层级'),
 ('did-cfg-position-business','5013001001210301','岗位分选业务','select','岗位分选对应业务事项'),
 ('did-cfg-position-use','5013001001210302','使用岗人员','user','业务使用岗人员'),
 ('did-cfg-position-review','5013001001210303','审查岗人员','user','业务审查岗人员'),
 ('did-cfg-position-manage','5013001001210304','管理岗人员','user','业务管理岗人员'),
 ('did-cfg-trigger-source','5013001001210401','触发源数字化标识','select','智选判断的业务数字化标识'),
 ('did-cfg-trigger-model','5013001001210402','关联目标模型','select','数字化标识关联的目标模型'),
 ('did-cfg-trigger-enabled','5013001001210403','标识触发是否启用','boolean','标识触发关系是否启用'),
 ('did-cfg-own-dept','5013001001210501','业务归属组织','select','业务归属的组织/部门'),
 ('did-cfg-own-business','5013001001210502','业务归属业务集合','multiselect','组织归属的业务集合'),
 ('did-cfg-own-desc','5013001001210503','业务归属说明','textarea','业务归属说明'),
 ('did-cfg-assign-rank','5013001001210601','审批分管组织职级','select','审批分管配置的组织职级'),
 ('did-cfg-assign-admin','5013001001210602','行政审批分管业务','multiselect','行政审批分管业务范围'),
 ('did-cfg-assign-business','5013001001210603','业务审批分管业务','multiselect','业务审批分管业务范围'),
 ('did-cfg-assign-admin-threshold','5013001001210604','行政审批阈值类型','select','行政审批阈值类型'),
 ('did-cfg-assign-business-threshold','5013001001210605','业务审批阈值类型','select','业务审批阈值类型'),
 ('did-cfg-threshold-type','5013001001210701','审批阈值类型','select','阈值类型'),
 ('did-cfg-threshold-id','5013001001210702','审批阈值数字化标识','select','阈值对应业务数字化标识'),
 ('did-cfg-threshold-value','5013001001210703','审批阈值值','number','阈值数值'),
 ('did-cfg-threshold-level','5013001001210704','审批阈值对应层级','select','达到阈值后对应审批层级')
ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,description=EXCLUDED.description,updated_at=now();

-- 2.1 人员信息标准库补充字段：审批、授权和模型可用范围都从人员模型运行记录中读取。
INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES
 ('did-person-rank','5013001001002007','组织职级','select','人员组织职级，供审批层级与人员匹配使用'),
 ('did-person-business','5013001001002008','业务领域','multiselect','人员可承担/分管的业务领域'),
 ('did-person-title','5013001001002009','身份说明','text','人员身份或岗位中文说明'),
 ('did-person-models','5013001001002010','可使用模型','multiselect','人员可使用的模型集合')
ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,description=EXCLUDED.description,updated_at=now();

INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-person-extra-'||di.code,'lib-standard-person',di.id,x.position,false,'data'
FROM (VALUES ('5013001001002007',7),('5013001001002008',8),('5013001001002009',9),('5013001001002010',10)) x(code,position)
JOIN digital_identifiers di ON di.code=x.code
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,visible=true;

-- 请休假示例归入“考勤管理”，审批分选通过标准配置库匹配，不在审批模型代码中固化。
INSERT INTO business_definitions(id,code,name,parent_id,level_no,description) VALUES
 ('biz-attendance','B0010301','考勤管理','biz-leave',3,'人员请休假、考勤等业务标准分类')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,parent_id=EXCLUDED.parent_id,level_no=EXCLUDED.level_no,description=EXCLUDED.description,updated_at=now();

-- 3. 若历史版本为同一模型建立过普通模型库，先把记录迁入标准库，再解除旧库模型绑定。
DO $$
DECLARE x RECORD;
BEGIN
  FOR x IN SELECT * FROM (VALUES
    ('业务定义模型','lib-standard-business-definition','业务定义标准库'),
    ('数字化定义模型','lib-standard-digital-definition','数字化定义标准库'),
    ('数字化标识建设模型','lib-standard-identifier','数字化标识标准库'),
    ('数字化库配置模型','lib-standard-library-catalog','数字化库目录标准库')
  ) AS t(model_name,target_library,target_name)
  LOOP
    UPDATE digital_library_records r SET library_id=x.target_library,library_name=x.target_name
      WHERE r.library_id IN (SELECT l.id FROM digital_libraries l JOIN models m ON m.id=l.model_id WHERE m.name=x.model_name AND l.id<>x.target_library);
    UPDATE digital_libraries l SET model_id=NULL,status='disabled',updated_at=now()
      WHERE l.model_id=(SELECT id FROM models WHERE name=x.model_name) AND l.id<>x.target_library;
  END LOOP;
END $$;

-- 4. 标准数字化库。每个库绑定一个产生/维护该标准数据的模型。
INSERT INTO digital_libraries(id,name,model_id,library_type,is_standard,allow_as_source,description)
SELECT v.lib_id,v.lib_name,m.id,'standard',true,true,v.description
FROM (VALUES
 ('lib-standard-digital-type','数字化类型标准库','数字化类型标准模型','数字化类型标准数据'),
 ('lib-standard-code-type','数字化编码类型标准库','数字化编码类型标准模型','数字化编码类型标准数据'),
 ('lib-standard-business-level','业务层级标准库','业务层级标准模型','一级至四级业务层级标准'),
 ('lib-standard-definition-type','数字化定义类型标准库','数字化定义类型标准模型','数字化定义类型标准'),
 ('lib-standard-object-type','数字化对象类型标准库','数字化对象类型标准模型','数字化对象类型标准'),
 ('lib-standard-attribute-definition','数字化属性定义标准库','数字化属性定义模型','数字化属性定义标准'),
 ('lib-standard-data-type','数据类型标准库','数据类型标准模型','数字化标识数据类型标准'),
 ('lib-standard-org-nature','组织性质标准库','组织性质标准模型','组织性质标准'),
 ('lib-standard-admin-approval-level','行政审批层级标准库','行政审批层级标准模型','行政审批层级标准'),
 ('lib-standard-business-approval-level','业务审批层级标准库','业务审批层级标准模型','业务审批层级标准'),
 ('lib-standard-approval-opinion','审批意见标准库','审批意见标准模型','审批意见标准'),
 ('lib-standard-meeting-type','会议类型标准库','会议类型标准模型','会议类型标准'),
 ('lib-standard-meeting-room','会议室标准库','会议室标准模型','会议室标准'),
 ('lib-standard-review-opinion','议题审定意见标准库','议题审定意见标准模型','议题审定意见标准'),
 ('lib-standard-yes-no','是否标准库','是否标准模型','公共是/否标准'),
 ('lib-standard-org-rank','组织职级标准库','组织职级标准模型','组织职级标准'),
 ('lib-standard-threshold-type','阈值类型标准库','阈值类型标准模型','金额/人员/天数阈值类型'),
 ('lib-standard-model-timeout','模型时限标准库','模型时限标准模型','模型办理时限标准'),
 ('lib-standard-digital-config','数字化配置标准库','数字化配置模型','数字化编码-属性-标识配置结果'),
 ('lib-standard-digital-display','数字化展示结果库','数字化展示模型','按权限形成的数字化展示集合'),
 ('lib-standard-admin-approval-selector','行政审批层级分选标准库','行政审批层级分选模型','业务到行政审批层级的配置'),
 ('lib-standard-business-approval-selector','业务审批层级分选标准库','业务审批层级分选模型','业务到业务审批层级的配置'),
 ('lib-standard-position-selector','岗位分选标准库','岗位分选模型','业务到使用/审查/管理岗人员的配置'),
 ('lib-standard-identifier-trigger','标识触发配置标准库','标识触发配置模型','数字化标识到目标模型的智选配置'),
 ('lib-standard-business-ownership','业务归属配置标准库','业务归属配置模型','组织到业务范围的归属配置'),
 ('lib-standard-approval-assignment','审批分管配置标准库','审批分管配置模型','组织职级到行政/业务审批分管范围配置'),
 ('lib-standard-threshold-config','审批阈值配置标准库','审批阈值配置模型','审批阈值配置')
) AS v(lib_id,lib_name,model_name,description)
JOIN models m ON m.name=v.model_name
ON CONFLICT(name) DO UPDATE SET model_id=EXCLUDED.model_id,library_type='standard',is_standard=true,allow_as_source=true,description=EXCLUDED.description,status='active',updated_at=now();

-- 既有核心标准库也绑定到对应模型。
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='人员信息模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-person';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='部门信息模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-dept';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='请假类型标准模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-leave-type';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='模型信息标准模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-model';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='业务定义模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-business-definition';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='数字化定义模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-digital-definition';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='数字化标识建设模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-identifier';
UPDATE digital_libraries SET model_id=(SELECT id FROM models WHERE name='数字化库配置模型'),library_type='standard',is_standard=true,allow_as_source=true,status='active',updated_at=now() WHERE id='lib-standard-library-catalog';

-- 5. 标准库列定义。
WITH defs(lib_id,did_code,pos,required) AS (VALUES
 ('lib-standard-digital-type','5013001001110001',1,true),('lib-standard-digital-type','5013001001110002',2,true),
 ('lib-standard-code-type','5013001001110011',1,true),('lib-standard-code-type','5013001001110012',2,true),
 ('lib-standard-business-level','5013001001110021',1,true),('lib-standard-business-level','5013001001110022',2,true),
 ('lib-standard-definition-type','5013001001110031',1,true),('lib-standard-definition-type','5013001001110032',2,true),
 ('lib-standard-object-type','5013001001110041',1,true),('lib-standard-object-type','5013001001110042',2,true),
 ('lib-standard-attribute-definition','5013001001110051',1,true),('lib-standard-attribute-definition','5013001001110052',2,true),('lib-standard-attribute-definition','5013001001110053',3,false),
 ('lib-standard-data-type','5013001001110061',1,true),('lib-standard-data-type','5013001001110062',2,true),
 ('lib-standard-org-nature','5013001001110071',1,true),('lib-standard-org-nature','5013001001110072',2,true),
 ('lib-standard-admin-approval-level','5013001001110081',1,true),('lib-standard-admin-approval-level','5013001001110082',2,true),
 ('lib-standard-business-approval-level','5013001001110091',1,true),('lib-standard-business-approval-level','5013001001110092',2,true),
 ('lib-standard-approval-opinion','5013001001110101',1,true),('lib-standard-approval-opinion','5013001001110102',2,true),('lib-standard-approval-opinion','5013001001110103',3,true),
 ('lib-standard-meeting-type','5013001001110111',1,true),('lib-standard-meeting-type','5013001001110112',2,true),
 ('lib-standard-meeting-room','5013001001110121',1,true),('lib-standard-meeting-room','5013001001110122',2,true),('lib-standard-meeting-room','5013001001110123',3,false),
 ('lib-standard-review-opinion','5013001001110131',1,true),('lib-standard-review-opinion','5013001001110132',2,true),
 ('lib-standard-yes-no','5013001001110141',1,true),('lib-standard-yes-no','5013001001110142',2,true),
 ('lib-standard-org-rank','5013001001110151',1,true),('lib-standard-org-rank','5013001001110152',2,true),('lib-standard-org-rank','5013001001110153',3,true),('lib-standard-org-rank','5013001001110154',4,true),
 ('lib-standard-threshold-type','5013001001110161',1,true),('lib-standard-threshold-type','5013001001110162',2,true),
 ('lib-standard-model-timeout','5013001001110171',1,true),('lib-standard-model-timeout','5013001001110172',2,true),
 ('lib-standard-digital-config','5013001001210001',1,true),('lib-standard-digital-config','5013001001210002',2,true),('lib-standard-digital-config','5013001001210003',3,false),('lib-standard-digital-config','5013001001210004',4,false),
 ('lib-standard-digital-display','5013001001210011',1,true),('lib-standard-digital-display','5013001001210012',2,false),('lib-standard-digital-display','5013001001210013',3,false),('lib-standard-digital-display','5013001001210014',4,false),('lib-standard-digital-display','5013001001210015',5,false),
 ('lib-standard-admin-approval-selector','5013001001210101',1,true),('lib-standard-admin-approval-selector','5013001001210102',2,true),
 ('lib-standard-business-approval-selector','5013001001210201',1,true),('lib-standard-business-approval-selector','5013001001210202',2,true),
 ('lib-standard-position-selector','5013001001210301',1,true),('lib-standard-position-selector','5013001001210302',2,true),('lib-standard-position-selector','5013001001210303',3,true),('lib-standard-position-selector','5013001001210304',4,true),
 ('lib-standard-identifier-trigger','5013001001210401',1,true),('lib-standard-identifier-trigger','5013001001210402',2,true),('lib-standard-identifier-trigger','5013001001210403',3,true),
 ('lib-standard-business-ownership','5013001001210501',1,true),('lib-standard-business-ownership','5013001001210502',2,true),('lib-standard-business-ownership','5013001001210503',3,false),
 ('lib-standard-approval-assignment','5013001001210601',1,true),('lib-standard-approval-assignment','5013001001210602',2,false),('lib-standard-approval-assignment','5013001001210603',3,false),('lib-standard-approval-assignment','5013001001210604',4,false),('lib-standard-approval-assignment','5013001001210605',5,false),
 ('lib-standard-threshold-config','5013001001210701',1,true),('lib-standard-threshold-config','5013001001210702',2,true),('lib-standard-threshold-config','5013001001210703',3,true),('lib-standard-threshold-config','5013001001210704',4,true)
)
INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-v17-'||md5(d.lib_id||':'||d.did_code),d.lib_id,di.id,d.pos,d.required,'data'
FROM defs d JOIN digital_identifiers di ON di.code=d.did_code
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,required=EXCLUDED.required,visible=true,source_role='data';

-- 部门信息标准库增加组织性质列。
INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role)
SELECT 'col-v17-dept-nature','lib-standard-dept',id,4,false,'data' FROM digital_identifiers WHERE code='5013001001110703'
ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=4,visible=true;

-- 6. 初始标准数据。它们是系统初始化基线；上线后新增/修改标准值应运行对应标准模型形成新记录。
WITH seed(lib_id,record_id,primary_did,values_json,data_json) AS (VALUES
 ('lib-standard-digital-type','std-v17-dt-code','5013001001110002','{"5013001001110001":"1","5013001001110002":"数字化编码"}'::jsonb,'{"类型码":"1","数字化类型":"数字化编码","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-digital-type','std-v17-dt-attr','5013001001110002','{"5013001001110001":"2","5013001001110002":"数字化属性"}'::jsonb,'{"类型码":"2","数字化类型":"数字化属性","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-digital-type','std-v17-dt-id','5013001001110002','{"5013001001110001":"3","5013001001110002":"数字化标识"}'::jsonb,'{"类型码":"3","数字化类型":"数字化标识","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-code-type','std-v17-ct-model','5013001001110012','{"5013001001110011":"001","5013001001110012":"模型"}'::jsonb,'{"编码类型码":"001","数字化编码类型":"模型","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-code-type','std-v17-ct-person','5013001001110012','{"5013001001110011":"002","5013001001110012":"人员"}'::jsonb,'{"编码类型码":"002","数字化编码类型":"人员","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-code-type','std-v17-ct-org','5013001001110012','{"5013001001110011":"003","5013001001110012":"组织"}'::jsonb,'{"编码类型码":"003","数字化编码类型":"组织","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-business-level','std-v17-bl1','5013001001110022','{"5013001001110021":"001","5013001001110022":"一级"}'::jsonb,'{"业务层级码":"001","业务层级":"一级","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-business-level','std-v17-bl2','5013001001110022','{"5013001001110021":"002","5013001001110022":"二级"}'::jsonb,'{"业务层级码":"002","业务层级":"二级","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-business-level','std-v17-bl3','5013001001110022','{"5013001001110021":"003","5013001001110022":"三级"}'::jsonb,'{"业务层级码":"003","业务层级":"三级","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-business-level','std-v17-bl4','5013001001110022','{"5013001001110021":"004","5013001001110022":"四级"}'::jsonb,'{"业务层级码":"004","业务层级":"四级","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-definition-type','std-v17-def-code','5013001001110032','{"5013001001110031":"01","5013001001110032":"编码"}'::jsonb,'{"定义类型":"编码","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-definition-type','std-v17-def-attr','5013001001110032','{"5013001001110031":"02","5013001001110032":"属性"}'::jsonb,'{"定义类型":"属性","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-definition-type','std-v17-def-id','5013001001110032','{"5013001001110031":"03","5013001001110032":"标识"}'::jsonb,'{"定义类型":"标识","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-definition-type','std-v17-def-lib','5013001001110032','{"5013001001110031":"04","5013001001110032":"数字化库"}'::jsonb,'{"定义类型":"数字化库","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-definition-type','std-v17-def-file','5013001001110032','{"5013001001110031":"05","5013001001110032":"文件名"}'::jsonb,'{"定义类型":"文件名","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-object-type','std-v17-obj-model','5013001001110042','{"5013001001110041":"001","5013001001110042":"模型"}'::jsonb,'{"对象类型":"模型","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-object-type','std-v17-obj-person','5013001001110042','{"5013001001110041":"002","5013001001110042":"人员"}'::jsonb,'{"对象类型":"人员","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-object-type','std-v17-obj-org','5013001001110042','{"5013001001110041":"003","5013001001110042":"组织"}'::jsonb,'{"对象类型":"组织","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-org-nature','std-v17-org-party','5013001001110072','{"5013001001110071":"01","5013001001110072":"党组织"}'::jsonb,'{"组织性质码":"01","组织性质":"党组织","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-org-nature','std-v17-org-admin','5013001001110072','{"5013001001110071":"02","5013001001110072":"行政机构"}'::jsonb,'{"组织性质码":"02","组织性质":"行政机构","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-org-nature','std-v17-org-committee','5013001001110072','{"5013001001110071":"03","5013001001110072":"委员会"}'::jsonb,'{"组织性质码":"03","组织性质":"委员会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-threshold-type','std-v17-th-money','5013001001110162','{"5013001001110161":"01","5013001001110162":"金额"}'::jsonb,'{"阈值类型码":"01","阈值类型":"金额","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-threshold-type','std-v17-th-person','5013001001110162','{"5013001001110161":"02","5013001001110162":"人员"}'::jsonb,'{"阈值类型码":"02","阈值类型":"人员","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-threshold-type','std-v17-th-days','5013001001110162','{"5013001001110161":"03","5013001001110162":"天数"}'::jsonb,'{"阈值类型码":"03","阈值类型":"天数","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-approval-opinion','std-v17-op-agree','5013001001110102','{"5013001001110101":"0","5013001001110102":"同意","5013001001110103":false}'::jsonb,'{"审批意见码":"0","审批意见":"同意","是否终止":false,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-approval-opinion','std-v17-op-reject','5013001001110102','{"5013001001110101":"1","5013001001110102":"不同意","5013001001110103":true}'::jsonb,'{"审批意见码":"1","审批意见":"不同意","是否终止":true,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-approval-opinion','std-v17-op-return','5013001001110102','{"5013001001110101":"2","5013001001110102":"退回修改","5013001001110103":true}'::jsonb,'{"审批意见码":"2","审批意见":"退回修改","是否终止":true,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-type','std-v17-mt-party','5013001001110112','{"5013001001110111":"M01","5013001001110112":"党委会"}'::jsonb,'{"会议类型":"党委会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-type','std-v17-mt-chair','5013001001110112','{"5013001001110111":"M02","5013001001110112":"董事长专题会"}'::jsonb,'{"会议类型":"董事长专题会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-type','std-v17-mt-manager','5013001001110112','{"5013001001110111":"M03","5013001001110112":"总经理办公会"}'::jsonb,'{"会议类型":"总经理办公会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-type','std-v17-mt-purchase','5013001001110112','{"5013001001110111":"M04","5013001001110112":"采购管理委员会"}'::jsonb,'{"会议类型":"采购管理委员会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-room','std-v17-room-1','5013001001110122','{"5013001001110121":"R01","5013001001110122":"第一会议室","5013001001110123":30}'::jsonb,'{"会议室名称":"第一会议室","容纳人数":30,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-room','std-v17-room-2','5013001001110122','{"5013001001110121":"R02","5013001001110122":"第二会议室","5013001001110123":20}'::jsonb,'{"会议室名称":"第二会议室","容纳人数":20,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-meeting-room','std-v17-room-video','5013001001110122','{"5013001001110121":"R03","5013001001110122":"视频会议室","5013001001110123":50}'::jsonb,'{"会议室名称":"视频会议室","容纳人数":50,"数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-review-opinion','std-v17-review-yes','5013001001110132','{"5013001001110131":"R01","5013001001110132":"同意上会"}'::jsonb,'{"审定意见":"同意上会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-review-opinion','std-v17-review-no','5013001001110132','{"5013001001110131":"R02","5013001001110132":"不同意上会"}'::jsonb,'{"审定意见":"不同意上会","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-yes-no','std-v17-yes','5013001001110142','{"5013001001110141":"1","5013001001110142":"是"}'::jsonb,'{"标准值":"是","数据来源":"系统初始化基线"}'::jsonb),
 ('lib-standard-yes-no','std-v17-no','5013001001110142','{"5013001001110141":"0","5013001001110142":"否"}'::jsonb,'{"标准值":"否","数据来源":"系统初始化基线"}'::jsonb)
)
INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
SELECT s.record_id,l.model_id,NULL,NULL,NULL,l.name,s.primary_did,s.lib_id,s.values_json,s.data_json
FROM seed s JOIN digital_libraries l ON l.id=s.lib_id
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,library_name=EXCLUDED.library_name,library_id=EXCLUDED.library_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 审批层级初始标准：允许用户后续通过对应标准模型增删改，不在审批模型内部写死。
WITH levels(n,label) AS (VALUES (1,'一级'),(2,'二级'),(3,'三级'),(4,'四级'),(5,'五级'))
INSERT INTO digital_library_records(id,model_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'std-v17-admin-level-'||n,l.model_id,l.name,'5013001001110082',l.id,jsonb_build_object('5013001001110081',n,'5013001001110082',label),jsonb_build_object('行政审批层级码',n,'行政审批层级',label,'数据来源','系统初始化基线')
FROM levels,digital_libraries l WHERE l.id='lib-standard-admin-approval-level'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;
WITH levels(n,label) AS (VALUES (1,'一级'),(2,'二级'),(3,'三级'),(4,'四级'),(5,'五级'))
INSERT INTO digital_library_records(id,model_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'std-v17-business-level-'||n,l.model_id,l.name,'5013001001110092',l.id,jsonb_build_object('5013001001110091',n,'5013001001110092',label),jsonb_build_object('业务审批层级码',n,'业务审批层级',label,'数据来源','系统初始化基线')
FROM levels,digital_libraries l WHERE l.id='lib-standard-business-approval-level'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 数据类型标准：供“数字化标识建设模型”的数据类型下拉使用。
WITH types(code,type_name) AS (VALUES ('T01','text'),('T02','textarea'),('T03','number'),('T04','date'),('T05','boolean'),('T06','user'),('T07','department'),('T08','select'),('T09','multiselect'),('T10','json'))
INSERT INTO digital_library_records(id,model_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'std-v17-data-type-'||lower(type_name),l.model_id,l.name,'5013001001110062',l.id,jsonb_build_object('5013001001110061',code,'5013001001110062',type_name),jsonb_build_object('数据类型码',code,'数据类型',type_name,'数据来源','系统初始化基线')
FROM types,digital_libraries l WHERE l.id='lib-standard-data-type'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 数字化属性定义的初始标准。
WITH attrs(code,attr_name,attr_description) AS (VALUES
 ('A01','业务领域','对象所属一级至四级业务范围'),('A02','功能类别','对象在系统中的功能分类'),('A03','组织层级','人员或组织层级属性'),('A04','模型类型','业务/审批/智选/建设/数字化等模型类型'))
INSERT INTO digital_library_records(id,model_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'std-v17-attr-'||lower(code),l.model_id,l.name,'5013001001110052',l.id,jsonb_build_object('5013001001110051',code,'5013001001110052',attr_name,'5013001001110053',attr_description),jsonb_build_object('属性定义码',code,'数字化属性名称',attr_name,'数字化属性说明',attr_description,'数据来源','系统初始化基线')
FROM attrs,digital_libraries l WHERE l.id='lib-standard-attribute-definition'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 6.1 请休假示例审批配置也由对应配置模型数字化库提供；后续在系统中运行配置模型即可修改。
WITH cfg(lib_id,record_id,primary_did,values_json,data_json) AS (VALUES
 ('lib-standard-admin-approval-selector','std-v17-leave-admin-selector','5013001001210101','{"5013001001210101":"考勤管理","5013001001210102":"四级"}'::jsonb,'{"业务事项":"考勤管理","行政审批层级":"四级","数据来源":"系统初始化基线，可由模型修改"}'::jsonb),
 ('lib-standard-business-approval-selector','std-v17-leave-business-selector','5013001001210201','{"5013001001210201":"考勤管理","5013001001210202":"四级"}'::jsonb,'{"业务事项":"考勤管理","业务审批层级":"四级","数据来源":"系统初始化基线，可由模型修改"}'::jsonb),
 ('lib-standard-position-selector','std-v17-leave-position-selector','5013001001210301','{"5013001001210301":"考勤管理","5013001001210303":"考勤主管","5013001001210304":"部门经理"}'::jsonb,'{"业务事项":"考勤管理","审查岗人员":"考勤主管","管理岗人员":"部门经理","数据来源":"系统初始化基线，可由模型修改"}'::jsonb)
)
INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
SELECT c.record_id,l.model_id,p.id,NULL,NULL,l.name,c.primary_did,c.lib_id,c.values_json,c.data_json
FROM cfg c JOIN digital_libraries l ON l.id=c.lib_id LEFT JOIN model_projects p ON p.model_id=l.model_id AND p.status='published'
ON CONFLICT(id) DO UPDATE SET model_id=EXCLUDED.model_id,project_id=COALESCE(EXCLUDED.project_id,digital_library_records.project_id),library_name=EXCLUDED.library_name,library_id=EXCLUDED.library_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data;

-- 7. 把已有标准记录补成“有对应模型”的标准记录。后续新增/修改仍通过标准模型运行。
UPDATE digital_library_records d SET model_id=l.model_id
FROM digital_libraries l WHERE d.library_id=l.id AND d.model_id IS NULL AND l.model_id IS NOT NULL;

-- 8. 升级既有系统模板：所有选择类字段改成“标准数字化库 -> 数字化标识”，不再保留模型内固定 options。
WITH patched AS (
  SELECT p.id,jsonb_agg(
    CASE
      WHEN m.name='业务定义模型' AND f.value->>'key'='businessLevel' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-business-level','sourceLibrary','业务层级标准库','sourceDigitalId','5013001001110022','mode','options'))
      WHEN m.name='数字化定义模型' AND f.value->>'key'='definitionType' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-definition-type','sourceLibrary','数字化定义类型标准库','sourceDigitalId','5013001001110032','mode','options'))
      WHEN m.name='数字化属性配置模型' AND f.value->>'key'='objectType' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-object-type','sourceLibrary','数字化对象类型标准库','sourceDigitalId','5013001001110042','mode','options'))
      WHEN m.name='数字化属性配置模型' AND f.value->>'key'='attributeName' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-attribute-definition','sourceLibrary','数字化属性定义标准库','sourceDigitalId','5013001001110052','mode','options'))
      WHEN m.name='数字化标识建设模型' AND f.value->>'key'='dataType' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-data-type','sourceLibrary','数据类型标准库','sourceDigitalId','5013001001110062','mode','options'))
      WHEN f.value->>'key'='meetingType' AND m.name IN ('会议议题提报','会议议题编组','会议组织') THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-meeting-type','sourceLibrary','会议类型标准库','sourceDigitalId','5013001001110112','mode','options'))
      WHEN f.value->>'key'='reviewResult' AND m.name='会议议题审定' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-review-opinion','sourceLibrary','议题审定意见标准库','sourceDigitalId','5013001001110132','mode','options'))
      WHEN f.value->>'key'='meetingRoom' AND m.name='会议组织' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-meeting-room','sourceLibrary','会议室标准库','sourceDigitalId','5013001001110122','mode','options'))
      WHEN f.value->>'key'='host' AND m.name='会议组织' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-person','sourceLibrary','人员信息标准库','sourceDigitalId','5013001001002002','mode','options'))
      WHEN f.value->>'key'='attendees' AND m.name='会议组织' THEN (f.value-'options') || jsonb_build_object('type','dataMultiSelect','sourceMode','library_multi_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-person','sourceLibrary','人员信息标准库','sourceDigitalId','5013001001002002','mode','options'))
      WHEN f.value->>'key'='willAttend' AND m.name='参会反馈' THEN (f.value-'options') || jsonb_build_object('type','dataSelect','sourceMode','library_select','linkage',jsonb_build_object('sourceLibraryId','lib-standard-yes-no','sourceLibrary','是否标准库','sourceDigitalId','5013001001110142','mode','options'))
      ELSE f.value
    END ORDER BY f.ordinality) AS fields
  FROM model_projects p JOIN models m ON m.id=p.model_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.design->'fields','[]'::jsonb)) WITH ORDINALITY f(value,ordinality)
  GROUP BY p.id
)
UPDATE model_projects p SET design=jsonb_set(p.design,'{fields}',patched.fields,true),updated_at=now()
FROM patched WHERE p.id=patched.id;

-- 审批/智选模型记录其通用数据依赖，供模型设计阶段直接选择；运行时标准库优先、旧步骤仅作为兼容兜底。
UPDATE model_projects p SET design=jsonb_set(
  jsonb_set(
    jsonb_set(p.design,'{approvalSettings,standardSources}',jsonb_build_object(
      'administrativeLevel','行政审批层级分选标准库','businessLevel','业务审批层级分选标准库','positions','岗位分选标准库','personnel','人员信息标准库','approvalAssignment','审批分管配置标准库','thresholds','审批阈值配置标准库','opinions','审批意见标准库','timeout','模型时限标准库'),true),
    '{approvalSettings,standardSourceIds}',jsonb_build_object(
      'administrativeLevel','lib-standard-admin-approval-selector','businessLevel','lib-standard-business-approval-selector','positions','lib-standard-position-selector','personnel','lib-standard-person','approvalAssignment','lib-standard-approval-assignment','thresholds','lib-standard-threshold-config','opinions','lib-standard-approval-opinion','timeout','lib-standard-model-timeout'),true),
  '{approvalSettings,routeStrategy}','"standard_first"'::jsonb,true),updated_at=now()
FROM models m WHERE p.model_id=m.id AND m.name='审批模型';

UPDATE model_projects p SET design=jsonb_set(
  jsonb_set(p.design,'{smartStandardSources}',jsonb_build_object('digitalConfig','数字化配置标准库','identifierTrigger','标识触发配置标准库','identifiers','数字化标识标准库','models','模型信息标准库'),true),
  '{smartStandardSourceIds}',jsonb_build_object('digitalConfig','lib-standard-digital-config','identifierTrigger','lib-standard-identifier-trigger','identifiers','lib-standard-identifier','models','lib-standard-model'),true),updated_at=now()
FROM models m WHERE p.model_id=m.id AND m.name='智选模型';
