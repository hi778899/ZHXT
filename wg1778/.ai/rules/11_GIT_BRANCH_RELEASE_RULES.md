# 11 Git 分支与版本发布规则

## 1. 主分支

`main` 代表当前正式稳定代码。禁止日常开发直接提交到 main。

## 2. 分支类型

- `feature/<name>`：新增能力
- `fix/<name>`：普通缺陷
- `hotfix/<name>`：生产紧急修复
- `refactor/<name>`：明确批准的架构整理

## 3. 生命周期

每个任务从最新 main 创建独立分支：

`最新 main → feature/fix → 修改 → 测试 → PR → 合并 main → 删除临时分支`

下一项需求必须重新从最新 main 建分支，不从已完成旧分支继续叠加。

## 4. 并行开发

当多个分支并行开发时，提交 PR 前必须同步最新 main 并重新测试，避免旧分支覆盖已合并功能。

## 5. Commit

提交信息应体现变更目的，例如：

- `feat(model-builder): add digital library data source`
- `fix(approval): prevent duplicate countersign trigger`
- `chore(db): add migration for model version table`

## 6. PR

PR 至少包含：

- 需求/问题
- 实现方案
- 变更范围
- 数据库变化
- 测试结果
- 风险
- 截图或运行证明（UI 变更时）

## 7. Tag 与版本

正式发布在 main 对应 commit 打 Tag，例如：

- `v0.20.0`：新增功能
- `v0.20.1`：缺陷修复
- `v0.21.0`：下一批兼容性功能

历史版本依赖 Tag 和 Commit 保存，不通过长期保留大量旧 feature 分支保存。
