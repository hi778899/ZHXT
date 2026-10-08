# 部署与运维

## Docker Compose

仓库根目录保留 `Dockerfile` 与 `docker-compose.yml`，因此构建上下文始终为项目根目录。

首次部署：

```bash
cp .env.example .env
# 修改 .env 中密码及生产环境参数
chmod +x scripts/启动生产环境.sh
./scripts/启动生产环境.sh
```

更新代码后：

```bash
docker compose up -d --build
```

停止服务并保留数据库卷：

```bash
./scripts/stop-production.sh
```

不要使用 `docker compose down -v`，除非明确需要删除数据库卷。

## Node / pnpm 依赖仓库

Docker 构建通过 `.env` 中的 `NPM_REGISTRY` 控制依赖仓库。默认值：

```bash
NPM_REGISTRY=https://registry.npmmirror.com
```

该值同时提供给 Corepack（下载固定版本 pnpm）和 pnpm（下载项目依赖）。如服务器可访问官方 npm，可改为 `https://registry.npmjs.org`；企业内网优先填写内部 npm 镜像。运行时镜像不会再次执行依赖安装，因此启动容器不依赖 npm 仓库可用性。

