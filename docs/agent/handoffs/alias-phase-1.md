# Alias Phase 1 Handoff

> 2026-05-02 — Alias 后端基础：alias pool + 用户 alias CRUD

## 目标

实现 alias（马甲/轻身份）的数据模型和管理 API。不涉及前端、badge 系统、发帖流程改动。

## 文件变更

### 新建

| 文件 | 用途 |
|------|------|
| `data/alias-pool.json` | 马甲池，6 个预定义身份人格 |
| `src/server/alias-service.js` | alias pool 加载 + 用户 alias CRUD + 路由 handlers |

### 修改

| 文件 | 变更 |
|------|------|
| `src/server/paths.js` | 新增 `aliasPoolPath` |
| `src/server/auth-service.js` | `publicAuthUser` 增加 `aliases`、`activeAliasId`、`badges` 字段 |
| `src/server/auth-routes.js` | re-export alias handlers from alias-service.js |
| `src/server/api-router.js` | 挂载 4 条新路由 |

## API

### `GET /api/alias-pool`

公开接口，返回马甲池列表。

```json
{
  "aliases": [
    { "id": "quiet-observer", "name": "安静观察者", "description": "...", "avatarSeed": "quiet", "order": 1 }
  ]
}
```

### `GET /api/auth/aliases`

需登录。返回当前用户的 alias 列表。

```json
{
  "aliases": [
    { "id": "uuid", "poolId": "quiet-observer", "name": "安静观察者", "avatarUrl": "", "avatarSeed": "quiet", "createdAt": "...", "status": "active" }
  ],
  "activeAliasId": "uuid"
}
```

### `POST /api/auth/aliases`

需登录。从 pool 创建 alias 实例并设为活跃。

```json
// Request
{ "poolId": "quiet-observer" }

// Response
{ "alias": { ... }, "activeAliasId": "uuid" }
```

限制：每用户最多 1 个 alias。重复创建返回 409。

### `POST /api/auth/aliases/deactivate`

需登录。取消活跃 alias，恢复真实身份。

```json
// Response
{ "ok": true, "activeAliasId": null }
```

## 数据模型

### alias-pool.json

```json
{
  "version": 1,
  "aliases": [
    { "id": "slug", "name": "显示名", "description": "描述", "avatarSeed": "seed", "order": 1 }
  ]
}
```

### auth-users.json 中的用户对象扩展

```json
{
  "aliases": [
    {
      "id": "uuid",
      "poolId": "quiet-observer",
      "name": "安静观察者",
      "avatarUrl": "",
      "avatarSeed": "quiet",
      "createdAt": "2026-05-02T...",
      "status": "active"
    }
  ],
  "activeAliasId": "uuid | null",
  "badges": []
}
```

- `aliases[].id` — alias 实例 UUID（主键）
- `activeAliasId` — 指向 `aliases[].id`，非 poolId
- `badges` — 预留字段，Phase 1 为空数组

### publicAuthUser 新增字段

```json
{
  "aliases": [],
  "activeAliasId": null,
  "badges": []
}
```

向后兼容：旧用户无 aliases/activeAliasId/badges 时自动返回空值。

## 验证

### 语法检查

```bash
node --check server.js
node --check src/server/alias-service.js
node --check src/server/auth-service.js
node --check src/server/auth-routes.js
node --check src/server/api-router.js
node --check src/server/paths.js
node -e "JSON.parse(require('fs').readFileSync('data/alias-pool.json','utf8'))"
```

全部通过。

### curl 测试

```bash
# 1. 查看 alias pool（无需登录）
curl http://localhost:3000/api/alias-pool

# 2. 登录
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"login":"YOUR_EMAIL","password":"YOUR_PASS"}'

# 3. 查看当前 alias（应为空）
curl -b cookies.txt http://localhost:3000/api/auth/aliases

# 4. 创建 alias
curl -b cookies.txt -X POST http://localhost:3000/api/auth/aliases \
  -H "content-type: application/json" \
  -d '{"poolId":"quiet-observer"}'

# 5. 再次查看（应有 1 个 alias + activeAliasId）
curl -b cookies.txt http://localhost:3000/api/auth/aliases

# 6. 再创建一个（应返回 409，超过上限）
curl -b cookies.txt -X POST http://localhost:3000/api/auth/aliases \
  -H "content-type: application/json" \
  -d '{"poolId":"curious-passenger"}'

# 7. 停用 alias
curl -b cookies.txt -X POST http://localhost:3000/api/auth/aliases/deactivate

# 8. 验证 /api/auth/me 包含新字段
curl -b cookies.txt http://localhost:3000/api/auth/me
```

## 不变项

- `public/app.js` — 未修改
- `src/server/post-service.js` — 未修改
- `src/server/ai-light-publish.js` — 未修改
- `src/server/feed-service.js` — 未修改
- `data/post-metadata.json` — 未修改
- 发帖流程 — 不携带 aliasId，行为不变

## 已知限制

- 每用户最多 1 个 alias（`MAX_ALIASES_PER_USER = 1`）
- 不支持修改 alias 名称（从 pool 继承）
- 不支持自定义 alias（只从预定义 pool 选择）
- alias 头像修改 API 未实现（avatarUrl 为空）
- badge 系统未实现（badges 始终为空数组）
- 无 alias 切换频率限制

## 下一步

- Phase 2：发帖时携带 aliasId，buildLianUserMeta 支持 alias
- Phase 3：badge 系独立实现
- Phase 4：前端 onboarding + 发帖身份选择器
