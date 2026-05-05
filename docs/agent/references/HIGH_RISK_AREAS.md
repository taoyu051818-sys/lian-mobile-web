# High-Risk Areas Reference

Date: 2026-05-02

6 个高风险区域的结构化调研资料，供重构或大改动前参考。

---

## 1. Frontend Script Load Order

### 概述

前端是 classic-script 全局变量模式，11 个 `<script>` 标签按顺序加载。无 bundler，无 ESM。

### 加载顺序

| # | 文件 | 类型 | 行数 |
|---|---|---|---|
| 1 | `leaflet.js` | 外部库 | — |
| 2 | `map-v2.js` | IIFE，导出 `window.MapV2` | ~390 |
| 3 | `app-state.js` | 纯数据，定义 `state` 等全局变量 | ~80 |
| 4 | `app-utils.js` | 工具函数：`$`, `$$`, `api`, `uploadImage` 等 | ~200 |
| 5 | `app-auth-avatar.js` | 认证 + 头像裁剪 | ~150 |
| 6 | `app-feed.js` | Feed 渲染 + 详情页 | ~500 |
| 7 | `app-legacy-map.js` | 校园手绘地图 | ~300 |
| 8 | `app-ai-publish.js` | AI 发布（旧版弹窗流） | ~350 |
| 9 | `publish-page.js` | 发布页（新版专用页面） | ~415 |
| 10 | `app-messages-profile.js` | 消息 + 个人中心 | ~350 |
| 11 | `app.js` | 事件绑定 + `initApp()` 启动 | ~300 |

### 依赖图

```
Leaflet
  └─ map-v2.js (IIFE, window.MapV2)
       └─ app-state.js (state, campusMap, campusPlaces)
            └─ app-utils.js ($, $$, api, uploadImage, compressImageForUpload)
                 └─ app-auth-avatar.js (loadAuthMe, requireLoginUi, openAuth)
                      └─ app-feed.js (loadFeed, openDetail, switchView)
                           ├─ app-legacy-map.js (renderCampusMap, initMap)
                           ├─ app-ai-publish.js (renderAiPublishSheet, publishAiPost)
                           ├─ publish-page.js (publishPageOpen, publishPagePublish)
                           └─ app-messages-profile.js (loadMessages, loadProfile, submitPost)
                                └─ app.js (initApp, 事件绑定)
```

### 前向引用（安全，仅在事件处理器中调用）

| 调用方 | 引用 | 定义在 |
|---|---|---|
| `app-auth-avatar.js` | `changeAvatar()` | `app-messages-profile.js` |
| `app-feed.js` | `loadMessages()`, `loadProfile()` | `app-messages-profile.js` |
| `app-feed.js` | `renderAiPublishSheet()` | `app-ai-publish.js` |
| `app-legacy-map.js` | `updatePublishLocationNote()` | `app-ai-publish.js` |
| `map-v2.js` | `window.openDetail()` | `app-feed.js` |

### window.* 显式导出

- `map-v2.js`: `window.MapV2`
- `app-feed.js`: `window.openDetail`
- `publish-page.js`: 11 个 `window.publishPage*` 函数

### 重复定义

- `displayImageUrl` 和 `escapeHtml` 在 `app-utils.js` 和 `map-v2.js` IIFE 内部各定义一次
- `api()` 函数行为不同：`map-v2.js` 版本加 `credentials: "include"`，`app-utils.js` 版本不加

### 改动风险

- 任何文件的加载顺序变更可能导致未定义变量
- 新增文件必须插入正确位置，不能随意追加
- 重构建议：先添加加载顺序断言（如 smoke test 检查关键全局变量是否存在）

---

## 2. Feed Scoring 评分系统

### 概述

`src/server/feed-service.js` 820 行，`data/feed-rules.json` 127 行。评分决定帖子在首页的排序。

### 评分函数

| 函数 | 行号 | 用途 |
|---|---|---|
| `legacyScoreItem` | 256 | 基础评分（enhancedScoring 关闭时使用） |
| `scoreItem` | 307 | 增强评分 = legacy + 多维度加权 |
| `scoreBreakdown` | 335 | 与 `scoreItem` 相同逻辑，返回分项明细（DRY 违规） |
| `momentScoreItem` | 423 | "此刻" Tab 独立评分器 |

### scoreItem 各维度权重

| 维度 | 公式 | 默认权重 |
|---|---|---|
| pinned | 1000 - index*5 | — |
| tagWeight | `tagWeights[tag]` | "报名机会"=92, "校园活动"=86 |
| recency | `60 * 0.5^(age/96h)` | 半衰期 96h |
| cover | 有图 +9 | 9 |
| quality | `qualityScore * 40` | 40 |
| imageImpact | `imageImpactScore * 24` | 24 |
| risk | `riskScore * -220` | -220 |
| official | `officialScore * -35` | -35（仅首页） |
| contentType | `contentTypeWeights[ct]` | campus_moment=180, food=76, activity_archive=-180 |
| locationArea | 无位置 -26 | -26 |
| read | 已读 -60 | -60 |
| vibe | `vibeWeights[tag]` | "真实"=30, "在地"=24 |
| scene | `sceneWeights[tag]` | "饭点"=18, "夜宵"=18 |

### momentScoreItem（此刻 Tab）

独立评分器，部分权重硬编码：

| 维度 | 来源 |
|---|---|
| recency | `90 * 0.5^(age/48h)`，半衰期 48h |
| quality | `qualityScore * 35`（硬编码） |
| imageImpact | `imageImpactScore * 30`（硬编码） |
| replies | `replyCount * 4`（硬编码） |
| vibe | 匹配标签 +12（硬编码列表） |
| contentType | `momentContentTypeWeights[ct]`（rules.json） |

### handleFeed 分支逻辑（496-610 行）

```
tab === "此刻" && momentTab 启用?
  → selectMomentFeed (momentScoreItem)
tab 是分类标签?
  → 按 tag 过滤，无评分排序
curatedPages 存在 && page 匹配?
  → curatedSlotsPerPage 个固定位 + 评分排序填充
else
  → scoreItem 排序 + 多样性限制
```

### 多样性限制

- `maxSameContentType: 2`
- `maxSameLocationArea: 2`
- `maxSamePrimaryTag: 4`

### 改动风险

- `scoreBreakdown` 与 `scoreItem` 逻辑重复，改一个必须改另一个
- `momentScoreItem` 硬编码权重不在 feed-rules.json 中，无法运行时调整
- `handleFeed` 和 `handleFeedDebug` 各有 115/106 行，分支逻辑重复
- 评分权重改动影响所有用户立即生效，需 snapshot 对比验证

---

## 3. NodeBB Integration Layer

### 概述

`src/server/nodebb-client.js` 94 行，是所有 NodeBB API 调用的唯一入口。

### 导出函数

| 函数 | 行号 | 用途 |
|---|---|---|
| `nodebbFetch(apiPath, options)` | 15 | 通用 HTTP 客户端 |
| `withNodebbUid(apiPath, uid)` | 9 | 构建带 `_uid` 的路径 |
| `retryApi(task, attempts)` | 60 | 重试包装器（3 次，450/900ms 间隔） |
| `fetchNodebbTopicIndex(maxPages)` | 73 | 分页获取最新帖子列表 |

### 认证模式

| 操作类型 | `_uid` | Auth Header |
|---|---|---|
| 公共读取（feed, tags） | `config.nodebbUid`（自动） | `x-api-token`（自动） |
| 用户读取（bookmarks, profile） | `withNodebbUid(uid)` | `x-api-token`（自动） |
| 用户写入（create, vote, flag, reply） | `withNodebbUid(uid)` | `authorization: Bearer <token>`（显式） |

### nodebbFetch 调用点（共 19 处）

| 文件 | 调用数 | 主要用途 |
|---|---|---|
| `post-service.js` | 9 | create, vote, bookmark, flag, reply, history |
| `channel-service.js` | 3 | markRead, channelMessage, notifications |
| `feed-service.js` | 3 | getTopicDetail, getRecentTopics, detail for bookmark |
| `auth-service.js` | 2 | findNodebbUser, createNodebbUser |
| `auth-routes.js` | 1 | /api/me fallback |
| `api-router.js` | 1 | proxy /api/tags |

### createNodebbTopicFromPayload（post-service.js:136-185）

统一发布入口，被 3 个调用方使用：

1. `handleCreatePost()` — 手动发布
2. `handleAiPostPublish()` — AI 发布
3. (文档引用)

流程：resolve uid → validate alias → normalize images → build HTML → POST /api/v3/topics → check status → return {tid, ...}

### 改动风险

- `nodebbFetch` 是单点依赖，改错影响全部 NodeBB 交互
- `_uid` 模式是隐式约定，不遵循会导致用户身份错乱
- `createNodebbTopicFromPayload` 被手动和 AI 发布共用，改动影响两条路径
- NodeBB 端点可能版本差异，vote/bookmark/flag 均有 fallback 端点

---

## 4. Auth System 认证系统

### 概述

`src/server/auth-service.js` 340 行，19 个导出函数。纯逻辑模块，路由在 `auth-routes.js`。

### 核心函数

| 类别 | 函数 | 行号 |
|---|---|---|
| 用户查找 | `findInstitutionByEmail`, `findUserByLogin`, `normalizeLogin` | 42-54 |
| NodeBB 映射 | `ensureNodebbUid`, `findNodebbUserByUsername`, `createNodebbUserForLian` | 56-122 |
| 密码 | `hashPassword` (scrypt), `verifyPassword` (timingSafeEqual) | 250-259 |
| 邮箱验证 | `createEmailCode`, `hashEmailCode`, `sendMail`, `sendSmtpMail`, `verifyEmailCode` | 124-248 |
| 会话 | `parseCookies`, `sessionCookie`, `getCurrentUser`, `requireUser` | 261-298 |
| 邀请码 | `createInviteCode`, `applyInviteViolation` | 300-318 |
| 身份展示 | `allowedIdentityTags`, `selectIdentityTag`, `publicAuthUser` | 9-40 |

### 会话生命周期

```
登录/注册 → crypto.randomBytes(24) 生成 token
  → store.sessions[token] = { userId, expiresAt }
  → Set-Cookie: lian_session=<token>; HttpOnly; SameSite=Lax; Max-Age=30天

getCurrentUser(req) → 读 cookie 或 x-session-token header
  → 查 store.sessions → 检查 expiresAt → 解析 user

requireUser(req) → getCurrentUser + 401/403 守卫
```

### 密码哈希

- 算法：`crypto.scryptSync`，64 字节派生密钥
- Salt：随机 16 字节 hex
- 比较：`crypto.timingSafeEqual`（防时序攻击）

### 邮箱验证

- 6 位数字验证码，SHA-256 哈希存储
- 发送渠道：Resend API 优先，SMTP 备用
- SMTP 客户端：手写 `node:net`/`node:tls`，支持 STARTTLS

### 邀请码级联封禁

`applyInviteViolation(bannedUserId)`:
1. 撤销邀请人的 `invitePermission`
2. 将邀请人邀请的所有其他用户标记为 `limited`

### 调用方耦合

| 调用方 | 导入的函数 |
|---|---|
| `auth-routes.js` | 大部分函数 |
| `post-service.js` | `getCurrentUser`, `ensureNodebbUid`, `requireUser`, `selectIdentityTag` |
| `feed-service.js` | `ensureNodebbUid`, `getCurrentUser` |
| `channel-service.js` | `ensureNodebbUid`, `requireUser`, `selectIdentityTag` |
| `alias-service.js` | `requireUser`, `publicAuthUser` |
| `admin-routes.js` | `applyInviteViolation`, `publicAuthUser` |
| `map-v2-service.js` | `getCurrentUser` |
| `ai-light-publish.js` | `requireUser` |

最高耦合：`requireUser`（5 处）、`getCurrentUser`（4 处）、`ensureNodebbUid`（4 处）

### 改动风险

- 密码哈希算法变更需迁移所有现有密码
- 会话格式变更需处理已登录用户的 token 兼容
- `sendSmtpMail` 是 84 行手写 SMTP，脆弱且难测试
- 邀请码级联封禁是破坏性操作，误触发影响大

---

## 5. post-metadata.json 格式

### 概述

`data/post-metadata.json` 2314+ 行，是帖子元数据的唯一存储。

### 读写函数

| 函数 | 文件 | 用途 |
|---|---|---|
| `loadMetadata()` | `data-store.js` | 读取完整 JSON |
| `patchPostMetadata(patch)` | `data-store.js` | 合并写入（Object.assign） |

### 调用方

| 文件 | 读 | 写 |
|---|---|---|
| `feed-service.js` | loadMetadata | — |
| `post-service.js` | loadMetadata | patchPostMetadata |
| `ai-light-publish.js` | — | patchPostMetadata |
| `admin-routes.js` | loadMetadata | patchPostMetadata |
| `map-v2-service.js` | loadMetadata | — |

### 数据结构

```json
{
  "<tid>": {
    "title": "string",
    "contentType": "campus_moment | campus_tip | food | ...",
    "locationArea": "string",
    "locationId": "string",
    "lat": number,
    "lng": number,
    "imageUrls": ["string"],
    "tags": ["string"],
    "vibeTags": ["string"],
    "sceneTags": ["string"],
    "visibility": "public | campus | school | private",
    "audience": { "visibility": "string", "schoolIds": [], "orgIds": [], "userIds": [], "linkOnly": false },
    "distribution": ["home", "search", "detail", "map"],
    "qualityScore": 0-1,
    "imageImpactScore": 0-1,
    "riskScore": 0-1,
    "officialScore": 0-1,
    "priority": number,
    "expiresAt": "ISO string",
    "keepAfterExpired": boolean,
    "authorUserId": "string",
    "authorSchoolId": "string",
    "sourceUrl": "string"
  }
}
```

### 改动风险

- `patchPostMetadata` 使用 `Object.assign` 浅合并，并发写入可能丢失数据
- 格式变更需同步所有读取方（5 个文件）
- 不能 pretty-print（CLAUDE.md 明确禁止）
- 修改前需备份到 `outputs/`

---

## 6. api-router.js 路由结构

### 概述

`src/server/api-router.js` 是 if-else 链式路由，统一 `async (req, reqUrl, res)` 签名。

### 路由结构

```
GET  /api/feed           → handleFeed
GET  /api/feed-debug     → handleFeedDebug
GET  /api/posts/:tid     → handlePostDetail
POST /api/posts/:tid/replies → handleCreateReply
POST /api/posts          → handleCreatePost
POST /api/ai/post-preview → handleAiPostPreview
POST /api/ai/post-drafts  → handleAiPostDrafts
POST /api/ai/post-publish → handleAiPostPublish
GET  /api/map/v2/items   → handleMapV2Items
PUT  /api/admin/map-v2   → handleAdminMapV2
POST /api/upload/image   → handleImageUpload
GET  /api/auth/me        → handleAuthMe
POST /api/auth/login     → handleAuthLogin
POST /api/auth/register  → handleAuthRegister
POST /api/auth/logout    → handleAuthLogout
POST /api/auth/verify-email → handleVerifyEmail
POST /api/auth/send-email-code → handleSendEmailCode
GET  /api/channel        → handleChannel
POST /api/channel/:tid/replies → handleChannelReply
GET  /api/messages       → handleMessages
GET  /api/tags           → proxy to NodeBB
POST /api/posts/:tid/like → handleTogglePostLike
POST /api/posts/:tid/save → handleTogglePostSave
POST /api/posts/:tid/report → handleReportPost
GET  /api/profile/:uid   → handleProfile
GET  /api/profile/:uid/history → handleGetHistory
GET  /api/profile/:uid/:tab → handleProfileTab
```

### 签名模式

所有 handler 统一：`async (req, reqUrl, res)` 或带参数变体如 `async (req, reqUrl, res, tid)`

路径解析通过手动 `reqUrl.pathname` 匹配，参数通过正则提取。

### 改动风险

- 添加路由需在正确的 if-else 位置插入
- 路径匹配是手动字符串操作，无框架路由的参数验证
- 切换到框架路由需改动所有 handler 签名
- 当前是单一文件，超过一定路由数量后维护困难

---

## 重构建议优先级

| 优先级 | 区域 | 建议 |
|---|---|---|
| 1 | api-router.js | 添加路由前先写路径匹配测试，逐步迁移到框架路由 |
| 2 | post-metadata.json | 添加并发写入锁或 WAL，防止数据丢失 |
| 3 | feed-service.js | 将 scoreBreakdown 改为调用 scoreItem + 分解，消除 DRY 违规 |
| 4 | frontend | 添加脚本加载顺序断言，防止静默失败 |
| 5 | auth-service.js | 将 sendSmtpMail 抽为独立模块，便于测试 |
| 6 | nodebb-client.js | 添加端点健康检查和降级策略 |
