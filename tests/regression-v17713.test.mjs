import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataLinkage=fs.readFileSync('server/src/data-linkage.ts','utf8');
const builder=fs.readFileSync('server/src/model-builder.ts','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const migration=fs.readFileSync('server/migrations/025_digital_library_canonical_file_names.sql','utf8');
const rule=fs.readFileSync('.ai/rules/16_MODEL_DIGITAL_CODE_FILENAME_RULES.md','utf8');

assert.match(migration,/ALTER TABLE digital_library_records ADD COLUMN IF NOT EXISTS file_name TEXT/);
assert.match(migration,/digital_library_file_name_migration_issues/);
assert.match(migration,/(?:v\.)?model_code\|\|'-'\|\|(?:v\.)?employee_code\|\|'-'\|\|(?:v\.)?time_code/);
assert.match(dataLinkage,/COALESCE\(NULLIF\(d\.file_name,''\),NULLIF\(r\.file_name,''\),''\) AS file_name/);
assert.match(dataLinkage,/ensureCanonicalDigitalLibraryFileNames/);
assert.match(builder,/digital_library_records\(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data,file_name,display_file_name\)/);
assert.doesNotMatch(app,/record\.fileName \|\| record\.displayFileName \|\| record\.recordId/);
assert.match(app,/record\.fileName \|\| "未形成标准模型文件名"/);
assert.match(rule,/禁止在数字化库列表、模型簇触发、审批、智选或业务查询中作为文件名替代值/);
console.log('V17.7.13 regression passed');
