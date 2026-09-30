-- V17.4.1
-- 审批模型用户可见/可配置字段统一使用中文名称。
-- 历史英文键只作为运行兼容读取口径保留在代码中，不再作为审批模型设计的新字段名。
DO $$
DECLARE
  project_row RECORD;
  design_text TEXT;
  test_text TEXT;
  config_text TEXT;
BEGIN
  FOR project_row IN
    SELECT p.id, p.design, p.test_data, p.configuration
    FROM model_projects p
    JOIN models m ON m.id=p.model_id
    WHERE m.name='审批模型'
  LOOP
    design_text := project_row.design::text;
    test_text := project_row.test_data::text;
    config_text := project_row.configuration::text;

    -- 先替换较长键名，避免被短键提前替换。
    design_text := replace(design_text, 'sourceDisplayFileName', '中文显示名称');
    design_text := replace(design_text, 'sourceModelName', '前序业务模型');
    design_text := replace(design_text, 'sourceFileName', '前序模型文件名');
    design_text := replace(design_text, 'sourceDigitalId', '前序数字化标识');
    design_text := replace(design_text, 'approvalResultPdf', '审批结果文件');
    design_text := replace(design_text, 'approvalThresholdVariables', '命中数字化标识阈值');
    design_text := replace(design_text, 'approvalAdministrativeLevel', '行政审批目标层级');
    design_text := replace(design_text, 'approvalTechnicalLevel', '技术业务审查目标层级');
    design_text := replace(design_text, 'approvalCurrentApprover', '当前审批人');
    design_text := replace(design_text, 'approvalCurrentStep', '当前审批环节');
    design_text := replace(design_text, 'approvalTotalSteps', '审批总环节');
    design_text := replace(design_text, 'approvalTimeoutHours', '规定时限');
    design_text := replace(design_text, 'approvalProcess', '审批办理记录');
    design_text := replace(design_text, 'approvalOpinion', '审批意见');
    design_text := replace(design_text, 'approvalTime', '审批时间');
    design_text := replace(design_text, 'approvalRoute', '正式审批路径');
    design_text := replace(design_text, 'approvalStatus', '审批状态');
    design_text := replace(design_text, 'approvalResult', '审批结果');

    test_text := replace(test_text, 'sourceDisplayFileName', '中文显示名称');
    test_text := replace(test_text, 'sourceModelName', '前序业务模型');
    test_text := replace(test_text, 'sourceFileName', '前序模型文件名');
    test_text := replace(test_text, 'sourceDigitalId', '前序数字化标识');
    test_text := replace(test_text, 'approvalRoute', '正式审批路径');
    test_text := replace(test_text, 'approvalStatus', '审批状态');
    test_text := replace(test_text, 'approvalResult', '审批结果');

    config_text := replace(config_text, 'approvalRoute', '正式审批路径');
    config_text := replace(config_text, 'approvalResult', '审批结果');

    UPDATE model_projects
    SET design=design_text::jsonb,
        test_data=test_text::jsonb,
        configuration=config_text::jsonb,
        updated_at=now()
    WHERE id=project_row.id;
  END LOOP;
END $$;
