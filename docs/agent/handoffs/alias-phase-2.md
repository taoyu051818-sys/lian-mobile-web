# Alias Phase 2 Handoff

> 2026-05-02 — 发帖支持 aliasId

## 目标

发帖请求可带 aliasId，后端在 lian-user-meta 中写 alias 展示信息。NodeBB 真实 uid 不变。

## 文件变更

### 修改

| 文件 | 变更 |
|------|------|
| `src/server/post-service.js` | import findUserAlias；buildLianUserMeta/userSignature/buildTopicHtml/createNodebbTopicFromPayload 支持 alias |
| `src/server/ai-light-publish.js` | handleAiPostPublish 提取 aliasId，透传到 createNodebbTopicFromPayload，记录到 JSONL |

### 不变

- `public/app.js` — 未修改
- `data/post-metadata.json` — 未修改
- `src/server/feed-service.js` — 未修改（normalizeTopic 已解析 lian-user-meta，自动适配新字段）
- `src/server/alias-service.js` — 未修改
- `src/server/auth-service.js` — 未修改

## 数据流

```
POST /api/posts { aliasId: "uuid", title, ... }
  → handleCreatePost → createNodebbTopicFromPayload
    → findUserAlias(auth.user, aliasId) → alias 对象
    → buildTopicHtml({ ..., alias })
      → buildLianUserMeta(user, "", alias)
        → lian-user-meta 写入 aliasId/aliasName/username=alias.name
      → userSignature(user, alias)
        → "来自 安静观察者"
    → POST /api/v3/topics (_uid = 真实 nodebbUid)
```

## lian-user-meta 新字段

```json
{
  "userId": "real-user-uuid",
  "nodebbUid": 42,
  "username": "安静观察者",
  "aliasId": "alias-instance-uuid",
  "aliasName": "安静观察者",
  "identityTag": "高校认证",
  "avatarText": "安",
  "avatarUrl": "",
  "sentAt": "2026-05-02T..."
}
```

- `username` — 有 alias 时为 alias.name，无 alias 时为真实 username
- `aliasId` — alias 实例 UUID，无 alias 时为空字符串
- `aliasName` — alias 显示名，无 alias 时为空字符串
- `identityTag` — 机构认证标签（不受 alias 影响）

## 验证

### 语法检查

```bash
node --check server.js
for f in src/server/*.js; do node --check "$f"; done
```

### curl 测试

```bash
# 先创建 alias（如果还没有）
curl -b cookies.txt -X POST http://localhost:PORT/api/auth/aliases \
  -H "content-type: application/json" \
  -d '{"poolId":"quiet-observer"}'

# 记返回的 alias.id

# 用 alias 发帖
curl -b cookies.txt -X POST http://localhost:PORT/api/posts \
  -H "content-type: application/json" \
  -d '{
    "title": "alias 测试帖",
    "content": "这是一条用马甲发的帖子",
    "aliasId": "ALIAS_ID_HERE"
  }'

# 不带 aliasId 发帖（应使用真实身份）
curl -b cookies.txt -X POST http://localhost:PORT/api/posts \
  -H "content-type: application/json" \
  -d '{
    "title": "真实身份帖子",
    "content": "这条用真实身份"
  }'

# AI publish 带 aliasId
curl -b cookies.txt -X POST http://localhost:PORT/api/ai/post-publish \
  -H "content-type: application/json" \
  -d '{
    "title": "AI alias 测试",
    "body": "AI 用马甲发帖",
    "imageUrl": "https://res.cloudinary.com/...",
    "aliasId": "ALIAS_ID_HERE"
  }'

# 验证 feed 中帖子的 author 字段
curl http://localhost:PORT/api/feed | jq '.items[0].author'

# 验证帖子详情中的 author 字段
curl http://localhost:PORT/api/posts/TID | jq '.author, .authorIdentityTag'
```

## 向后兼容

- 不传 aliasId → 行为完全不变
- buildLianUserMeta 的 alias 参数默认 null
- userSignature 的 alias 参数默认 null
- feed normalizeTopic 解析 lian-user-meta 时，新字段 aliasId/aliasName 自动被忽略（不使用）

## 已知限制

- replyToNodebbTopic 不支持 alias（回复用真实身份）
- buildChannelMessageHtml 不支持 alias（频道消息用真实身份）
- 不改前端，需要用 curl 验证

## Technical Debt / Known Risks

### 1. aliasId 权限校验未验证

`findUserAlias(auth.user, aliasId)` 从当前用户的 `aliases[]` 中查找，理论上只能用自己的 alias。但未做端到端验证：如果传入别人的 aliasId 或伪造的 UUID，行为需确认。预期：找不到 → 返回 null → 用真实身份。但未测试。

### 2. aliasId 无效时的静默降级

当 aliasId 无效（不存在、已删除、不属于当前用户）时，`findUserAlias` 返回 null，帖子会以真实身份发布，**但用户可能以为自己在用马甲**。需要前端在发帖前校验 aliasId 有效性，或后端返回警告。当前 Phase 2 未处理此问题。

### 3. feed/detail 展示未端到端验证

`normalizeTopic` 从 lian-user-meta 解析 `username`，Phase 2 将 `username` 覆盖为 `alias.name`。但 feed 卡片和详情页是否正确展示 alias 名称，需要实际发帖后在浏览器中验证。curl 只能验证 API 返回值，不能验证前端渲染。

### 4. lian-user-meta.username 被覆盖的语义风险

Phase 2 将 `lian-user-meta.username` 从真实用户名改为 alias.name。这意味着：
- NodeBB 原生 `posts[0].user.username` 仍显示真实用户名
- LIAN 展示层的 `username` 显示 alias.name
- 两层 username 含义不同，可能造成调试 confusion
- 如果未来有逻辑依赖 `lian-user-meta.username === 真实用户名`，会 break

### 5. 前端未完成

发帖表单、AI publish 表单均未加入 aliasId 字段。当前只能 curl 测试。

### 6. 合并状态

**不建议直接合并到 main**。保留在 alias 分支或 integration 待 Phase 3 前端完成后统一验证。
