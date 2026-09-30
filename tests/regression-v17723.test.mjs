import fs from 'node:fs'
import assert from 'node:assert/strict'

const seed = fs.readFileSync(new URL('../server/src/seed.ts', import.meta.url), 'utf8')
const m029 = fs.readFileSync(new URL('../server/migrations/029_model_digital_config_completeness.sql', import.meta.url), 'utf8')
const m031 = fs.readFileSync(new URL('../server/migrations/031_model_digital_config_issue_id_type_fix.sql', import.meta.url), 'utf8')

assert.match(seed, /model_id text NOT NULL,project_id text/)
assert.doesNotMatch(seed, /model_id uuid NOT NULL,project_id uuid/)
assert.match(m029, /model_id text NOT NULL/)
assert.match(m029, /project_id text/)
assert.doesNotMatch(m029, /model_id uuid NOT NULL/)
assert.match(m031, /ALTER COLUMN model_id TYPE text USING model_id::text/)
assert.match(m031, /ALTER COLUMN project_id TYPE text USING project_id::text/)
assert.match(m031, /model-digital-/)
console.log('V17.7.23 regression passed')
