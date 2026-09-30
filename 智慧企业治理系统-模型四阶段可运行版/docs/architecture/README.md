# 架构文档

当前项目运行结构：

```text
浏览器 / React + TypeScript (`src/`)
        ↓ HTTP API
Node.js + TypeScript (`server/src/`)
        ↓
PostgreSQL (`server/migrations/`)
```

核心业务规则不在本文重复定义。AI 与开发人员必须以根目录 `AGENTS.md` 及 `.ai/rules/` 为准。
