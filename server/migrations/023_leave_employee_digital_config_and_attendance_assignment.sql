-- V17.7.9：请休假审批的员工数字化配置与考勤审批分管补齐。
-- 原则：审批运行仍只读取数字化库；系统账号仅用于同步形成正式员工信息数字化库记录。

-- 四级机构正职/负责人承担本部门员工考勤管理的基础行政审批。
UPDATE digital_library_records
SET data=jsonb_set(
  data,
  '{行政审批分管业务属性集合}',
  to_jsonb(
    CASE
      WHEN COALESCE(data->>'行政审批分管业务属性集合','') LIKE '%5012001005001000000%' THEN data->>'行政审批分管业务属性集合'
      WHEN COALESCE(data->>'行政审批分管业务属性集合','') IN ('','—','无') THEN '5012001005001000000'
      ELSE data->>'行政审批分管业务属性集合' || '；5012001005001000000'
    END
  ),true
)
WHERE library_id='lib-standard-approval-assignment'
  AND data->>'数据版本'='0622'
  AND data->>'组织职级'='501200302041';

-- 五级机构正职/负责人同样承担本机构员工考勤管理基础审批，适配科室型组织。
UPDATE digital_library_records
SET data=jsonb_set(
  data,
  '{行政审批分管业务属性集合}',
  to_jsonb(
    CASE
      WHEN COALESCE(data->>'行政审批分管业务属性集合','') LIKE '%5012001005001000000%' THEN data->>'行政审批分管业务属性集合'
      WHEN COALESCE(data->>'行政审批分管业务属性集合','') IN ('','—','无') THEN '5012001005001000000'
      ELSE data->>'行政审批分管业务属性集合' || '；5012001005001000000'
    END
  ),true
)
WHERE library_id='lib-standard-approval-assignment'
  AND data->>'数据版本'='0622'
  AND data->>'组织职级'='501200302051';

-- 默认设备管理部属于总经理组成人员分管范围，保证当前默认请休假测试组织能够形成向上审批路径。
INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
SELECT 'src0622-rel-v1779-equipment',l.model_id,NULL,NULL,NULL,l.name,'501200402003-501200402006',l.id,'{}'::jsonb,
       '{"上级组织名称":"总经理组成人员","上级组织名称数字化属性":"501200402003","下级组织名称":"设备管理部","下级组织名称数字化属性":"501200402006","关系类型":"分管","数据版本":"0622补充","数据来源":"请休假审批当前组织关系补齐"}'::jsonb
FROM digital_libraries l WHERE l.id='lib-digital-org-relationship-0622'
ON CONFLICT(id) DO UPDATE SET library_name=EXCLUDED.library_name,digital_id=EXCLUDED.digital_id,library_id=EXCLUDED.library_id,data=EXCLUDED.data;
