import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const seed=readFileSync(new URL('../server/src/seed.ts',import.meta.url),'utf8')
const builder=readFileSync(new URL('../server/src/model-builder.ts',import.meta.url),'utf8')
const migration=readFileSync(new URL('../server/migrations/029_model_digital_config_completeness.sql',import.meta.url),'utf8')
const rule=readFileSync(new URL('../.ai/rules/22_MODEL_DIGITAL_CONFIG_COMPLETENESS_RULES.md',import.meta.url),'utf8')

assert.match(seed,/ensureAllPublishedModelDigitalConfigs/,'必须扫描全部已发布可运行模型')
assert.match(seed,/model_digital_config_completeness_issues/,'必须记录无法自动安全补齐的配置异常')
assert.match(seed,/system_model_config_completeness_sync/,'全量配置补齐必须通过真实模型运行写入数字化库')
assert.match(seed,/NOT IN \('approval','smart'\)/,'除审批/智选外所有已发布模型都必须建立业务→审批系统固定链路')
assert.match(seed,/lib-standard-model-timeout/,'全量配置完整性必须同步校验模型时限业务域')
assert.match(seed,/lib-standard-approval-assignment/,'全量配置完整性必须同步校验基础行政审批分管')
assert.match(builder,/ensurePublishedProjectDigitalConfig/,'模型发布时必须立即形成模型数字化配置')
assert.match(builder,/model_publish_config_completeness/,'发布配置必须通过模型数字化配置模型真实运行归档')
assert.match(builder,/!\["approval","smart"\]\.includes\(modelTypeOf\(row\)\)/,'模型建设/数字化建设等非business模型也必须进入审批固定链路')
assert.match(migration,/model_digital_config_completeness_issues/)
assert.match(rule,/所有已发布、可运行模型/)
assert.match(rule,/不得采用“发现某个模型缺配置后再单独补一个模型”/)
assert.match(rule,/模型发布时必须立即完成/)

console.log('V17.7.21 regression checks passed')
