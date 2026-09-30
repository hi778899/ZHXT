-- V17.7.23：修复 V17.7.21 完整性异常表错误使用 UUID 的问题。
-- 本项目 models.id / model_projects.id 为 TEXT，允许 model-digital-... 这类稳定业务键。
-- 已执行 029 的数据库通过本迁移原位转换，不删除既有异常记录。

ALTER TABLE IF EXISTS model_digital_config_completeness_issues
  ALTER COLUMN model_id TYPE text USING model_id::text;

ALTER TABLE IF EXISTS model_digital_config_completeness_issues
  ALTER COLUMN project_id TYPE text USING project_id::text;

COMMENT ON COLUMN model_digital_config_completeness_issues.model_id IS
  '模型主键，类型必须与 models.id 一致为 TEXT；不得假定为 UUID';
COMMENT ON COLUMN model_digital_config_completeness_issues.project_id IS
  '模型项目主键，类型必须与 model_projects.id 一致为 TEXT；不得假定为 UUID';
