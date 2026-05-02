# Alias Phase 3 Handoff

> 2026-05-02 — 默认发布身份 + 个人页设置 + 发帖页身份提示

## 产品定义

马甲身份是**官方预设身份**，不是用户自定义身份：

- **真实身份**：用户自己的 username + avatar，可修改
- **马甲身份**：alias pool 中预设的 displayName + avatar，用户只能选择使用哪个
- **activeAliasId**：null = 真实身份，有值 = 使用官方 alias pool 中对应马甲
- 前端只传 aliasId，后端通过 aliasId 查官方 pool / 用户已授权 alias 记录

## 文件变更

### 已提交（server-side，上一轮）

| 文件 | 变更 |
|------|------|
| `src/server/alias-service.js` | +handleActivateAlias（POST /api/auth/aliases/activate） |
| `src/server/auth-routes.js` | re-export handleActivateAlias |
| `src/server/api-router.js` | 挂载 activate 路由 |
| `src/server/post-service.js` | buildLianUserMeta avatarUrl 修复 + createNodebbTopicFromPayload 拒绝无效 aliasId |

### 本轮修改（public-side）

| 文件 | 变更 |
|------|------|
| `public/app.js` | loadProfile 身份切换区块 + submitPost 注入 aliasId + currentAiPublishPayload 注入 aliasId + updatePublishIdentityNote |
| `public/index.html` | publishSheet 增加 publishIdentityNote 元素 |
| `public/styles.css` | .profile-identity-section / .profile-identity-option / .publish-identity-note 样式 |

## 后端关键逻辑

### 无效 aliasId 拒绝（post-service.js）

```
POST /api/posts { aliasId: "fake-uuid" }
  → findUserAlias(user, "fake-uuid") → null
  → throw 400 "aliasId is invalid or does not belong to current user"
  → 帖子不创建
```

### avatarUrl 不回退真实头像（post-service.js）

```javascript
// 有 alias 时：alias.avatarUrl 为空则为空字符串（前端用文字头像）
// 无 alias 时：用 user.avatarUrl
avatarUrl: alias ? (alias.avatarUrl || "") : (user.avatarUrl || ""),
```

### activate 路由（alias-service.js）

```
POST /api/auth/aliases/activate
Body: { "aliasId": "uuid" }
→ requireUser → findUserAlias(user, aliasId) → 404 if not found
→ user.activeAliasId = alias.id → save
→ { ok: true, activeAliasId: "uuid" }
```

## 前端关键逻辑

### 个人页身份切换

- 读取 `state.currentUser.aliases[]` 和 `activeAliasId`
- 渲染 radio 选择：真实身份 + 每个官方马甲
- 切换时调用 activate/deactivate API
- 失败时 alert + reloadProfile 恢复 UI 状态
- 无 alias 时显示"暂无可用官方马甲"

### 发帖自动注入 aliasId

```javascript
// submitPost 中
if (state.currentUser?.activeAliasId) {
  payload.aliasId = state.currentUser.activeAliasId;
}

// currentAiPublishPayload 中
aliasId: state.currentUser?.activeAliasId || undefined
```

### 发帖页身份提示

- publishSheet 打开时调用 `updatePublishIdentityNote()`
- 显示"当前发布身份：安静观察者"或"当前发布身份：真实用户名"

## 验证

### 自动化

```bash
node scripts/validate-project-structure.js   # 43 项全通过
node --check server.js                        # 通过
Get-ChildItem src/server/*.js | ForEach-Object { node --check $_.FullName }  # 全通过
```

### curl 测试

```bash
# 激活 alias
curl -b cookies.txt -X POST http://localhost:PORT/api/auth/aliases/activate \
  -H "content-type: application/json" \
  -d '{"aliasId":"ALIAS_ID"}'

# 发帖（应使用 alias 身份）
curl -b cookies.txt -X POST http://localhost:PORT/api/posts \
  -H "content-type: application/json" \
  -d '{"title":"alias 测试","content":"用马甲发帖"}'

# 伪造 aliasId（应返回 400）
curl -b cookies.txt -X POST http://localhost:PORT/api/posts \
  -H "content-type: application/json" \
  -d '{"title":"伪造","content":"aliasId 不存在","aliasId":"fake-uuid"}'

# 停用 alias
curl -b cookies.txt -X POST http://localhost:PORT/api/auth/aliases/deactivate

# 发帖（应使用真实身份）
curl -b cookies.txt -X POST http://localhost:PORT/api/posts \
  -H "content-type: application/json" \
  -d '{"title":"真实身份","content":"不带 aliasId"}'
```

### 浏览器测试

1. 登录 → 个人页 → 看到"发布身份"区块
2. 选择马甲 → 个人页 radio 切换 → 无报错
3. 打开发布表单 → 看到"当前发布身份：马甲名"
4. 发帖 → 帖子卡片/详情页显示马甲名
5. 个人页切回真实身份 → 发帖 → 显示真实用户名
6. 旧帖子不受影响（lian-user-meta 是快照）

## 未实现

- 创建新马甲入口（不在本轮）
- 马甲自定义名称/头像（不允许，马甲是官方预设）
- badge 系统
- index.html 中文 mojibake 是预存在问题，非本轮引入
