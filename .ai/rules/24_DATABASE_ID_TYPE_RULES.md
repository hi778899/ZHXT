# V17.7.23 数据库主键类型一致性规则

## 当前有效规则

1. 数据库代码必须以实际父表字段类型为准，不得因为运行值看起来像 UUID 就自行把引用字段声明为 UUID。
2. 当前系统 `models.id`、`model_projects.id` 为 `TEXT`；所有保存这两个主键的审计、异常、关联表字段必须使用 `TEXT` 或通过正式外键继承同一类型。
3. `model-digital-business-classification-0622`、`model-config-digital` 等字符串是合法模型主键，不得尝试转换为 UUID。
4. 新增 migration 前必须核对被引用父表 DDL；新增回归测试必须覆盖“字符串模型主键写入异常/审计表”的场景。
5. 已部署环境的数据类型修复必须通过后续 migration 原位升级，禁止要求用户删库、重建数据库。
