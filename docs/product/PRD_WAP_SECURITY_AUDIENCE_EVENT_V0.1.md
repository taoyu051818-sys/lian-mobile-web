# PRD：LIAN WAP 网页应用安全、权限、信息流与事件系统 V0.1

## 0. 给 Claude Code 的执行声明

本 PRD 的当前开发目标不是一次性完成全量产品，而是基于现有代码做**可持续演进**。

主仓库范围：

- 前端：`taoyu051818-sys/lian-mobile-web`
- 后端：`taoyu051818-sys/lian-platform-server`
- 不要把 `lian-nest-server` 作为当前主开发目标，除非任务明确要求未来重构参考。

开发前必须读取：

- 前端 `README.md`
- 前端 `package.json`
- 后端 `docs/ops/generated-api-surface.md`
- 后端 `src/server/route-manifest.js`
- 后端 `src/server/route-metadata.js`
- 后端 `src/server/api-route-registry.js`
- 后端 `docs/agent/domains/AUDIENCE_SYSTEM.md`

当前 API 真相以 `lian-platform-server` 的 generated API surface 和 route manifest 为准，不以旧版 split-era `api-contract.md` 为准。

---

## 1. 产品定位

LIAN 是一个面向高校/园区/组织场景的 WAP 网页应用。核心不是普通论坛，而是：

> 基于地点、身份、组织、活动、求助、交易和实时消息的校园现实协作网络。

用户可以看到附近和自己相关的信息，可以参与 event/activity，可以发布图文、求助、商家/交易/活动内容，可以通过身份标签获得权限，也可以通过完成活动或现实任务获得贡献、荣誉值、点券等激励。

---

## 2. 当前已实现基础

### 2.1 前端已存在的页面

现有 Vue canary 视图包括：

- 首页 Feed
- 地图 Map
- 发布 Publish
- 消息 Messages
- 个人 Profile

当前 `AppViewHost.vue` 已经将这些视图作为主应用页面挂载。

### 2.2 首页 Feed 现状

首页已经具备：

- Feed 数据加载
- 双列瀑布流卡片
- 卡片进入详情页
- 卡片动效基础
- 图片卡片、文本卡片、activity、place、merchant、help 等 presentation intent/card template 的前端雏形

当前 `FeedItemCard.vue` 已经支持 `image`、`text`、`activity`、`place`、`merchant`、`help` 卡片模板，文本卡片已有展开/折叠按钮逻辑。
`src/api/feed.ts` 已经把后端 `contentType/presentationIntent/cardTemplate` 映射成前端卡片模板。

### 2.3 地图现状

地图页当前使用 `MapLeafletView.vue`，已经接入 `MapCanvas`、`MapPlaceSheet`、`MapStatus`、`PostDetailPanel`，支持地图上的地点/帖子点击后展示地点 sheet 或帖子详情。

后端当前 live API surface 中，地图主接口为：

- `GET /api/map/v2/items`

旧接口 `/api/map/items` 是 legacy，后续开发不得继续扩展旧接口。

### 2.4 消息现状

消息页已经分为 channel 和 notification 两类，包含频道消息流、通知列表、消息输入框，以及从通知打开帖子详情的能力。

### 2.5 发布现状

发布页已经有：

- 图片/标题/正文
- 标签
- 身份标签
- 可见范围
- 地点选择
- 草稿恢复
- 上传与提交状态
- 发布后跳转查看帖子详情链接

对应前端在 `PublishView.vue`。

后端当前已有：

- `POST /api/ai/post-preview`
- `POST /api/ai/post-drafts`
- `POST /api/ai/post-publish`
- `POST /api/upload/image`
- `POST /api/posts`

这些应作为轻量发布和 AI 发布的现有基础。

---

## 3. 关键规格补齐

### 3.1 可见范围、参与权限、发布权限必须分开

不要只写"可见范围"。需要拆成三类：

| 权限类型            | 含义                             | 示例                                         |
| ------------------- | -------------------------------- | -------------------------------------------- |
| `viewPermission`    | 谁能看到帖子                     | 公开、登录用户、某高校、某组织、指定用户     |
| `actionPermission`  | 谁能点赞、vote、评论、报名、交易 | 未注册不能 like/vote；非组织用户不能报名活动 |
| `publishPermission` | 谁能发布某类帖子                 | merchant 需要实名认证；二手交易至少高校认证  |

这三类不能混在一个字段里。

### 3.2 activity 应统一升级为 event

- 数据模型叫 `event`
- feed card 展示 intent 可以继续叫 `activity`
- 用户文案可以叫"活动/任务/事件"

### 3.3 跑腿功能必须先定义订单生命周期

跑腿不能直接塞进 merchant 帖子里，应该拆成 `errandOrder` 子系统，覆盖订单状态、支付/冻结/退款、骑手接单/取消/超时、位置上传频率、隐私范围、异常处理、风控限制。

### 3.4 举报和管理员后台需要闭环

补充：举报分类、举报证据、被举报对象类型（post/comment/user/order/event）、管理员处理状态、处理动作（忽略/下架/限制用户/封禁/标记误报）、通知对象（管理员/举报人/被处理用户）。

### 3.5 国际化要从散落常量迁移到 i18n

当前前端很多中文文案在 `src/config/brand/*` 常量里，未来应该迁移成 `vue-i18n` key。前端依赖里已经有 `vue-i18n`，应作为 Phase 0 的基础改造。

### 3.6 源码保护要改成"客户端保护 + 后端权限"

WAP 前端无法真正隐藏源码，最多做到：

- 生产构建不开 sourcemap
- 代码压缩、混淆、chunk 拆分
- 不在前端暴露密钥、管理 token、推荐算法细节、风控规则
- 后端强鉴权、强权限、强限流
- CSP、安全响应头、上传校验、日志审计

OWASP API Security Top 10 把对象级授权、认证、对象属性授权、资源消耗、功能级授权、敏感业务流滥用等列为 API 风险，LIAN 的可见范围、交易、跑腿、举报、管理后台都必须按这些风险设计。
CSP 适合作为浏览器端纵深防御，尤其用于限制 inline script、远程脚本、unsafe JS、表单提交和 framing，但它不能替代正常的 XSS 防护和安全开发实践。

---

## 4. V0.1 开发目标

### 4.1 本阶段目标

1. 源码保护与基础安全基线
2. 中文/英文自动语言切换
3. 用户身份标签与权限模型
4. 帖子类型系统
5. 可见范围/audience enforcement
6. 首页 Feed、详情页、地图、消息、发布、个人页与新模型对齐

### 4.2 本阶段不做

- 完整余额系统
- 完整跑腿调度系统
- 实时骑手定位生产级实现
- 商家入驻审核全流程
- 完整二手交易担保交易
- 完整 event 奖励结算
- AI agent 自动发起现实任务
- 复杂反作弊模型
- 多语言除中文/英文外的完整翻译

---

## 5. 用户角色与身份标签

### 5.1 用户状态

| 状态                | 说明                        |
| ------------------- | --------------------------- |
| `anonymous`         | 未注册用户                  |
| `new_cookie_user`   | cookie 显示新用户，但未注册 |
| `registered`        | 已注册用户                  |
| `invited_user`      | 通过邀请码注册              |
| `campus_verified`   | 高校邮箱/高校身份认证       |
| `realname_verified` | 实名认证                    |
| `org_member`        | 某组织成员                  |
| `merchant_verified` | 商家/餐饮/交易发布权限      |
| `runner_verified`   | 跑腿骑手权限                |
| `admin`             | 管理员                      |
| `moderator`         | 内容/社区管理员             |

### 5.2 权限矩阵

| 功能                | anonymous | registered | campus_verified |  realname_verified   | admin |
| ------------------- | :-------: | :--------: | :-------------: | :------------------: | :---: |
| 查看公开首页        |    ✅     |     ✅     |       ✅        |          ✅          |  ✅   |
| 查看地图公开内容    |    ✅     |     ✅     |       ✅        |          ✅          |  ✅   |
| 查看校园内容        |    ❌     |     ✅     |       ✅        |          ✅          |  ✅   |
| like/vote           |    ❌     |     ✅     |       ✅        |          ✅          |  ✅   |
| comment/reply       |    ❌     |     ✅     |       ✅        |          ✅          |  ✅   |
| 举报                |    ❌     |     ✅     |       ✅        |          ✅          |  ✅   |
| 发布普通图文        |    ❌     |     ✅     |       ✅        |          ✅          |  ✅   |
| 发布二手交易        |    ❌     |     ❌     |       ✅        |          ✅          |  ✅   |
| 发布 merchant       |    ❌     |     ❌     |       ❌        | ✅/merchant_verified |  ✅   |
| 创建 event/activity |    ❌     |  条件开放  |       ✅        |          ✅          |  ✅   |
| 管理举报            |    ❌     |     ❌     |       ❌        |          ❌          |  ✅   |

---

## 6. 核心数据模型

### 6.1 Post

```ts
type PostType = "image" | "text" | "event" | "merchant" | "trade" | "help" | "place";

interface Post {
  tid: number;
  type: PostType;
  title: string;
  body: string;
  bodyPreview: string;
  cover?: string;
  imageUrls?: string[];
  tags: string[];
  authorUserId: string;
  aliasId?: string;
  identityTag?: string;
  location?: PostLocation;
  audience: Audience;
  relations?: PostRelation[];
  status: "active" | "hidden" | "deleted" | "pending_review";
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 Audience

后端已有 audience 设计文档，字段建议沿用。它已定义 `visibility`、`schoolIds`、`orgIds`、`roleIds`、`userIds`、`linkOnly`，并指出 feed、detail、map、channel、messages 等所有 surface 都要做可见性过滤。

```ts
interface Audience {
  visibility: "public" | "campus" | "school" | "private" | "linkOnly";
  schoolIds: string[];
  orgIds: string[];
  roleIds: string[];
  userIds: string[];
  linkOnly: boolean;
}
```

### 6.3 Event

```ts
interface EventPostExtension {
  eventId: string;
  participantScope: Audience;
  allowedOrganizations: string[];
  reward?: RewardRule;
  eventStatus: "open" | "full" | "closed" | "completed" | "cancelled";
  startAt?: string;
  endAt?: string;
  location?: PostLocation;
  capacity?: number;
  participantCount: number;
  joinPolicy: "open" | "approval_required" | "org_only" | "school_only";
}
```

### 6.4 Merchant / Errand

```ts
interface MerchantPostExtension {
  merchantId?: string;
  merchantType: "food" | "shop" | "service" | "trade";
  publishRequiredTags: string[];
  supportsErrand: boolean;
}
```

```ts
interface ErrandOrder {
  orderId: string;
  requesterUserId: string;
  runnerUserId?: string;
  merchantPostId?: number;
  pickupLocation: PostLocation;
  dropoffLocation: PostLocation;
  mode: "dedicated" | "meal_peak_batch";
  status:
    | "created"
    | "paid_locked"
    | "assigned"
    | "picked_up"
    | "delivering"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "disputed";
  feeAmount: number;
  lockedBalanceAmount: number;
  etaSeconds?: number;
  runnerLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
}
```

V0.1 只做接口和 UI 占位；不要直接实现复杂调度。

### 6.5 Help

```ts
interface HelpPostExtension {
  helpId: string;
  voteCount: number;
  commentCount: number;
  status: "open" | "linked_event" | "resolved" | "closed";
  linkedEventTid?: number;
}
```

---

## 7. 功能需求

### 7.1 首页 Feed

#### 7.1.1 Feed 类型

- 图文 `image`
- 纯文字 `text`
- 活动/事件 `event`
- 商家/餐饮/服务 `merchant`
- 二手交易 `trade`
- 求助/公共治理 `help`
- 地点相关 `place`

#### 7.1.2 卡片规则

图文卡片：展示图片、标题、标签、作者、时间、地点、like 信息。当前状态基本可保留。

纯文字卡片：默认折叠，正文超过正常卡片高度时显示展开按钮，展开/折叠按钮不得触发进入详情页。已有逻辑应保留并抽象成可复用组件。

event 卡片：卡片展示 event 状态、时间、地点、奖励/贡献值摘要、可参与状态。无参与权限时按钮灰色，点击灰色按钮弹出不可参与原因。详情页展示完整报名信息和参与规则。

merchant 卡片：卡片展示商家/餐饮/交易摘要，仅有权限用户可发布。如果支持跑腿，显示"找人帮取/跑腿"入口。V0.1 该入口可以进入占位流程。

trade 卡片：至少高校认证用户才可发起交易。未认证用户点击交易按钮，展示认证引导。交易流程 V0.1 先不做担保支付。

help 卡片：展示 vote/comment。vote 与 like 后端可共用 interaction，但前端用 vote 文案。有权限用户可将 help 关联到 event。

#### 7.1.3 推荐模式

- `此刻`：偏时间近、附近、实时
- `精选`：偏质量、兴趣、互动、可信身份
- 标签筛选
- 搜索

#### 7.1.4 加载与刷新

- 上滑到底自动加载下一页
- 下拉触发刷新
- 刷新时清理旧帖子，重新加载第一页
- 当前 `FeedLoadMore` 已有自动加载 sentinel，可在此基础上继续扩展

#### 7.1.5 详情页 URL

- `/posts/:tid`
- 分享按钮使用真实详情链接
- 微信中转页面应跳回对应详情页
- 后端已有 `GET /api/posts/:tid` 与 `GET /api/posts/:tid/share-card`，应优先复用

### 7.2 地图页

#### 7.2.1 当前能力

- 环境底图
- 路网
- 建筑物/地点图标
- 地图上的帖子
- 点击帖子进入详情页

#### 7.2.2 待实现

- 限制用户过度缩小
- 限制拖拽出合理边界
- 根据用户中心点和屏幕内/屏幕外缓冲区加载附近帖子
- 根据用户兴趣排序地图帖子
- 地图卡片展示要克制，只显示标题、类型、距离/地点、缩略图
- 地图上的帖子必须经过 audience 过滤
- 高德地图只作为定位能力，不在前端显示高德底图

#### 7.2.3 地图边界规则

```ts
interface MapViewportPolicy {
  minZoom: number;
  maxZoom: number;
  campusBounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
  outsideBufferMeters: number;
}
```

### 7.3 消息页

#### 7.3.1 消息类型

- 多频道实时聊天
- 系统通知
- 帖子相关回复
- 评论相关回复
- 举报/审核通知
- event 报名/完成/奖励通知
- 跑腿订单通知

#### 7.3.2 关联规则

- 引用帖子的消息自动作为帖子的回复
- 引用评论的消息自动作为评论的回复
- 不引用的消息只进入频道，不展示在帖子详情页
- 频道消息需要支持按组织/类别过滤

#### 7.3.3 NodeBB 分类策略

频道消息应进入特殊 NodeBB 分类或独立 channel surface，Feed 按分类/metadata 过滤掉，避免实时聊天被当帖子分发。

### 7.4 发布页

#### 7.4.1 发布原则

发布必须轻量：用户可以只上传图片，LLM 生成标题、正文、标签、可见范围建议；图片上传后立刻进入地图选点流程；坐标无关帖子允许跳过选点。

#### 7.4.2 发布流程

1. 用户选择图片/输入少量文本
2. 前端调用上传接口
3. 同时调用 AI draft/preview
4. 页面跳转到地点选择
5. 用户选择地点或跳过
6. AI 内容返回后填入草稿
7. 用户确认可见范围/标签/身份
8. 发布

#### 7.4.3 可见范围

发布时必须支持：公开、登录用户、高校、组织、指定用户/私密、仅链接可见。

这些选项要由后端根据当前用户权限返回，不要前端硬编码完整权限。

建议新增：

```http
GET /api/audience/options
```

返回当前用户可选的可见范围和不可选原因。

### 7.5 个人页

#### 7.5.1 已有能力

- 登录/游客态
- 用户信息
- 浏览记录、喜欢、收藏、发布内容
- 马甲/身份标签
- 个人资料编辑

后端当前也已有 `/api/me/*` 相关 surface。

#### 7.5.2 待实现

- 邀请码生成升级为微信分享卡片
- 身份标签与权限解释
- event 完成记录
- 贡献值
- 点券/代币余额
- 荣誉值
- 跑腿骑手状态
- 商家认证状态
- 高校认证状态

### 7.6 注册与新手引导

#### 7.6.1 注册流程

注册时引导用户：选择感兴趣内容、建立基础用户画像、创建官方统一风格的长期马甲、展示基础身份标签。如果通过邀请注册，添加 `invited_user`；如果通过高校邮箱认证，添加 `campus_verified`。

#### 7.6.2 游戏化引导

| 阶段            | 开放能力                       |
| --------------- | ------------------------------ |
| 未注册          | 首页查看、地图查看             |
| 注册后          | like/vote/comment/report       |
| 完成兴趣选择    | 标签推荐、精选推荐             |
| 高校认证后      | 二手交易、校园范围内容         |
| 实名/商家认证后 | merchant 发布、跑腿相关能力    |
| 完成 event 后   | 贡献值、荣誉、更多活动创建权限 |

---

## 8. 安全、源码保护与风控

### 8.1 前端源码保护原则

WAP 前端不能真正隐藏源码。V0.1 的目标是：

- 不暴露密钥
- 不暴露管理 token
- 不暴露完整风控规则
- 不暴露私有 API 地址和内部配置
- 降低逆向可读性
- 所有关键权限以后端为准

#### 8.1.1 前端要求

- production 禁用 sourcemap
- Vite build 后 JS/CSS 压缩
- 可选：生产构建引入 JS obfuscation，但不得破坏性能和调试
- 所有 `import.meta.env` 暴露变量必须白名单
- 禁止在前端写死 admin token、LLM key、高德 key 私密部分、NodeBB 管理凭证
- 保留并扩展现有 `check:runtime-exposure`、`check:unsafe-dom` 等安全检查

#### 8.1.2 后端要求

- 所有写操作必须鉴权
- 所有涉及对象 ID 的接口必须做对象级权限检查
- 所有 admin 接口必须强 admin 鉴权
- 上传图片必须校验大小、类型、扩展名、MIME
- AI 接口必须限流，避免成本被刷
- 发布、评论、vote、举报、跑腿下单、骑手定位必须限流
- 记录审计日志

### 8.2 安全响应头

后端或网关应加：`Content-Security-Policy`、`Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy`、`Cross-Origin-Opener-Policy`、`Cross-Origin-Resource-Policy`。

CSP 建议先以 Report-Only 跑一轮，再逐步收紧。

### 8.3 风控能力

V0.1 风控要求：设备/浏览器 client id、登录态 session、IP + 用户 + client id 联合限流、新用户冷启动限制、举报量异常检测、vote/like 频率限制、发布频率限制、图片上传频率限制、AI 生成频率限制、管理后台处理队列。

---

## 9. 国际化 i18n

### 9.1 目标

根据用户系统语言自动切换：中文 `zh-CN`、英文 `en`，其他语言暂时 fallback 到英文。

### 9.2 语言优先级

```ts
language =
  userSetting ?? localStorage.language ?? navigator.languages ?? navigator.language ?? "en";
```

规则：

- `zh`、`zh-CN`、`zh-Hans` → 中文
- `en`、`en-US`、`en-GB` → 英文
- 其他 → 英文

### 9.3 开发要求

- 新增 `src/i18n/index.ts`（或继续使用 `src/locales/index.ts` 并扩展）
- 新增 `src/i18n/locales/zh-CN.ts`
- 新增 `src/i18n/locales/en.ts`
- 将 `src/config/brand/*` 中用户可见文案逐步迁移到 i18n key
- V0.1 先迁移五个主页面、Feed 卡片、发布页、消息页、错误提示
- 保留旧常量兼容，但新增代码不得继续写死中文文案

---

## 10. 管理后台与举报

### 10.1 举报入口

所有帖子详情页必须有举报入口。

未注册用户：不展示举报按钮，或点击后引导登录。

已注册用户：可选择举报分类、可填写说明、可提交证据。

举报分类：隐私泄露、虚假信息、骚扰/攻击、地点错误、过期内容、交易/跑腿风险、其他。

后端已有 `POST /api/posts/:tid/report`，V0.1 应先扩展这个接口和管理通知闭环。

### 10.2 管理后台

新增或扩展 admin surface：

```http
GET /api/admin/reports
POST /api/admin/reports/:reportId/action
```

管理动作：忽略、标记已处理、隐藏帖子、限制用户、封禁用户、恢复帖子、标记误报。

管理员收到通知：后台列表、系统通知、可选站内消息频道。

---

## 11. API 需求草案

### 11.1 Audience

```http
GET /api/audience/options
POST /api/audience/validate
```

### 11.2 Event

```http
POST /api/events
GET /api/events/:eventId
POST /api/events/:eventId/join
POST /api/events/:eventId/cancel-join
POST /api/events/:eventId/complete
POST /api/events/:eventId/reward
```

### 11.3 Help

```http
POST /api/posts/:tid/vote
POST /api/help/:helpId/link-event
POST /api/help/:helpId/resolve
```

### 11.4 Errand

```http
POST /api/errands/orders
GET /api/errands/orders/:orderId
POST /api/errands/orders/:orderId/cancel
POST /api/errands/orders/:orderId/assign
POST /api/errands/orders/:orderId/pickup
POST /api/errands/orders/:orderId/deliver
POST /api/errands/runner/location
```

### 11.5 Admin

```http
GET /api/admin/reports
POST /api/admin/reports/:reportId/action
GET /api/admin/risk/events
```

---

## 12. 开发优先级

### Phase 0：安全/i18n/权限底座

1. 生产构建源码保护基线
2. CSP/安全 headers 方案
3. i18n 中文/英文自动切换
4. audience options API
5. 前后端统一 `Audience` 类型
6. Feed/detail/map/channel/report 的 audience enforcement 检查

### Phase 1：首页与详情页类型系统

1. 统一 PostType
2. 扩展 FeedItem 类型
3. 完成 event/merchant/trade/help 卡片
4. 详情页展示完整类型信息
5. like/vote 统一 interaction

### Phase 2：地图与消息关联

1. 地图边界限制
2. 地图帖子 audience 过滤
3. 地图卡片克制展示
4. 频道消息引用帖子/评论
5. 不引用则只在频道展示

### Phase 3：轻量发布 + AI 发布

1. 图片上传后进入地图选点
2. AI draft 异步返回
3. 发布前确认标题/正文/标签/audience
4. 发布成功后进入独立 URL 详情页

### Phase 4：event/reward/help 闭环

1. event 创建
2. event 报名
3. event 完成
4. help 关联 event
5. reward ledger 记录

### Phase 5：merchant/trade/errand

1. merchant 发布权限
2. trade 发布权限
3. 跑腿订单基础状态机
4. 骑手位置上传
5. ETA 展示
6. 余额冻结/退款

---

## 13. 验收标准

### 13.1 安全

- production 构建不输出 sourcemap
- 前端无密钥、admin token、LLM key
- 所有写接口需要鉴权
- 所有 post detail/feed/map/channel 根据 audience 过滤
- 举报能进入 admin 队列
- AI/上传/发布/评论/vote 有基础限流

### 13.2 i18n

- 中文系统显示中文
- 英文系统显示英文
- 其他语言显示英文
- 五个主页面无新增硬编码中文
- 旧中文常量逐步迁移，不一次性大爆炸重构

### 13.3 Feed

- 双列卡片稳定
- 图文卡片不退化
- 纯文字卡片超过高度才显示展开
- event/merchant/trade/help 有各自卡片表达
- 卡片进入详情页仍有 iOS 风格转场
- 详情页有独立 URL

### 13.4 地图

- 不能无限缩小
- 不能拖出校园过远范围
- 地图帖子按权限过滤
- 点击地图帖子进入详情页
- 地图卡片不遮挡主要地图信息

### 13.5 发布

- 只传图片也能进入 AI 草稿流程
- 图片上传后可选择地点或跳过
- 发布前能确认可见范围
- 发布后能打开帖子详情 URL
