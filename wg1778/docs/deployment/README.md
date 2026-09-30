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
