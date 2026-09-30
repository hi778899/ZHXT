import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('server/migrations/026_materialize_all_digital_library_records_as_model_runs.sql','utf8');
const linkage=fs.readFileSync('server/src/data-linkage.ts','utf8');
const employee=fs.readFileSync('server/src/employee-digital-config.ts','utf8');
const seed=fs.readFileSync('server/src/seed.ts','utf8');
const templates=fs.readFileSync('server/src/model-templates.ts','utf8');
const rule=fs.readFileSync('.ai/rules/16_MODEL_DIGITAL_CODE_FILENAME_RULES.md','utf8');
const oneModel=fs.readFileSync('.ai/rules/02_ONE_MODEL_ONE_LIBRARY_RULES.md','utf8');

assert.match(migration,/ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS legacy_record_id TEXT/);
assert.match(migration,/record_origin TEXT NOT NULL DEFAULT 'model_run'/);
assert.match(migration,/digital_library_run_materialization_issues/);
assert.match(migration,/CREATE OR REPLACE FUNCTION v17714_materialize_digital_library_runs/);
assert.match(migration,/INSERT INTO model_runs\(id,model_id,project_id,owner_id,file_name,display_file_name/);
assert.match(migration,/trigger_mode,source_run_id/);
assert.match(migration,/'system_initialization'/);
assert.match(migration,/SET run_id=r\.id/);
assert.match(migration,/数字化库正式记录必须由对应数据产生模型运行形成/);
assert.match(migration,/NEW\.run_id IS NULL/);
assert.match(migration,/数字化库正式文件名必须与对应 model_runs\.file_name 完全一致/);
assert.match(migration,/legacy_record_id IS '历史 seed\/src0622\/系统同步技术记录键/);

assert.match(linkage,/export async function upsertSystemDigitalLibraryRecord/);
assert.match(linkage,/INSERT INTO model_runs/);
assert.match(linkage,/triggerMode=useHistoricalTime \? "system_initialization" : "system_sync"/);
assert.match(linkage,/INSERT INTO digital_library_records[\s\S]*runId/);
assert.match(linkage,/SELECT v17714_materialize_digital_library_runs\(\)/);
assert.match(linkage,/legacy_identifier_repair/);
assert.doesNotMatch(linkage,/UPDATE digital_library_records SET identifier_values/);
assert.match(linkage,/数字化库方案A物化未完成/);

assert.match(employee,/upsertSystemDigitalLibraryRecord/);
assert.doesNotMatch(employee,/INSERT INTO digital_library_records/);

assert.match(seed,/ensureInfrastructureDigitalProjects/);
assert.match(seed,/5011001001100023001/);
assert.match(seed,/5011001001100024001/);
assert.match(seed,/5011001001100025001/);
assert.match(seed,/await syncSystemStandardLibraryRecords\(\)/);

assert.match(templates,/name: "员工信息模型"/);
assert.match(templates,/name: "组织名称数字化模型"/);
assert.match(templates,/name: "组织数字化模型"/);
assert.match(templates,/name: "模型时限模型"/);
assert.match(templates,/name: "模型数字化配置模型"/);
assert.match(templates,/name: "标识关联配置模型"/);
assert.match(templates,/name: "业务归属模型"/);

assert.match(rule,/当前有效版本：V17\.7\.14/);
assert.match(rule,/文件名不能脱离模型运行单独存在/);
assert.match(rule,/digital_library_records\.run_id/);
assert.match(rule,/system_initialization/);
assert.match(rule,/system_sync/);
assert.match(oneModel,/每一条正式数字化库记录必须由其归属的数据产生模型一次真实运行形成/);

const serverFiles=['server/src/model-builder.ts','server/src/data-linkage.ts','server/src/employee-digital-config.ts','server/src/seed.ts'];
const direct=serverFiles.flatMap(file=>{
  const text=fs.readFileSync(file,'utf8');
  return [...text.matchAll(/INSERT INTO digital_library_records/g)].map(()=>file);
});
assert.deepEqual(direct.sort(),['server/src/data-linkage.ts','server/src/model-builder.ts'].sort(), '正式数字化库 INSERT 仅允许统一系统运行归档与普通模型归档两个入口');

console.log('V17.7.14 all-library model-run provenance regression passed');
