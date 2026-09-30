import fs from "node:fs"
import assert from "node:assert/strict"

const digital=fs.readFileSync("server/src/digital-codes.ts","utf8")
const builder=fs.readFileSync("server/src/model-builder.ts","utf8")
const seed=fs.readFileSync("server/src/seed.ts","utf8")
const migration=fs.readFileSync("server/migrations/024_unify_runtime_filenames_current_structure.sql","utf8")
const rule=fs.readFileSync(".ai/rules/16_MODEL_DIGITAL_CODE_FILENAME_RULES.md","utf8")
const workbench=fs.readFileSync("src/ModelBuilderWorkbench.tsx","utf8")

assert.match(rule,/当前有效版本：V17\.7\.11/)
assert.match(rule,/模型文件名 = 模型数字化编码 \+ 发起\/运行人员员工数字化编码 \+ 时间码/)
assert.match(rule,/当前运行中数据及既有数字化库运行记录统一生效/)
assert.match(rule,/model_runs.*数字化库记录.*待办\/已办\/办结/s)

assert.match(digital,/CURRENT_RUNTIME_FILE_NAME_PATTERN/)
assert.match(digital,/isCurrentModelDigitalCode\(modelCode\)/)
assert.match(digital,/isCurrentEmployeeDigitalCode\(employeeCode\)/)
assert.doesNotMatch(digital,/buildRuntimeFileName[\s\S]{0,250}isModelDigitalCode\(modelCode\)/)

assert.match(builder,/禁止继续生成旧格式模型文件名/)
assert.match(builder,/SELECT EXISTS\(SELECT 1 FROM model_runs WHERE file_name=\$1\)/)
assert.match(builder,/model_file_name_migration_issues/)
assert.match(builder,/必须先完成V17\.7\.11文件名迁移/)

assert.match(migration,/CREATE TABLE IF NOT EXISTS model_file_name_migrations/)
assert.match(migration,/CREATE TABLE IF NOT EXISTS model_file_name_migration_issues/)
assert.match(migration,/ALTER TABLE model_runs ADD COLUMN IF NOT EXISTS legacy_file_name/)
assert.match(migration,/UPDATE model_runs[\s\S]*input_data=v17711_replace_runtime_jsonb/)
assert.match(migration,/UPDATE digital_library_records[\s\S]*v17711_replace_runtime_jsonb/)
assert.match(migration,/UPDATE todos SET content=v17711_replace_runtime_text/)
assert.match(migration,/UPDATE model_trigger_failures SET source_file_name=v17711_replace_runtime_text/)
assert.match(migration,/model_runs_current_filename_check/)
assert.match(migration,/model_runs_current_file_name_uq/)
assert.match(migration,/AT TIME ZONE 'Asia\/Shanghai'/)
assert.match(migration,/old_file_name.*new_file_name/s)

assert.match(seed,/"50110020015"/)
assert.match(seed,/employeeCode: "50110020016"/)
assert.match(seed,/employeeCode: "50110020017"/)
assert.doesNotMatch(seed,/501100200000000[123]/)

assert.match(workbench,/发布与新运行必须配置当前19位模型数字化编码/)
console.log("V17.7.11 filename full-migration regression passed")
