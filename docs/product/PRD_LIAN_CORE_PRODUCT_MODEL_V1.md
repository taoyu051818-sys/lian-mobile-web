# PRD：LIAN Core Product Model V1

> **承接关系**：本 PRD 是 LIAN 的产品总纲。它不替代 `PRD_WAP_SECURITY_AUDIENCE_EVENT_V0.1.md` 与 `PRD_POST_CREATION_REVOLUTION_V0.2.md` 的已落地细节，而是为它们提供统一的产品模型、系统边界与长期演进方向。
>
> **决策日期**：2026-05-25
>
> **目标仓库**：`lian-mobile-web`、`lian-platform-server`
>
> **不在范围**：`lian-nest-server` 不作为当前主开发目标；不重写 NodeBB 核心论坛/账号/频道机制；不在本 PRD 中直接定义具体接口字段级 contract。

---

## 1. 产品定义

LIAN 不是一个普通论坛，也不是一个单纯的信息流应用。

LIAN 是一个建立在 NodeBB 核心内容与账号能力之上的、面向高校/园区/组织场景的**现实协作网络**。

它的目标不是让信息被发布，而是让：

- 需求被看见
- 资源被组织
- 解决方案被提出
- 参与者被连接
- 交付被验收
- 奖励被分配
- 本地生活与现实协作真正发生

LIAN 的核心单位不是“页面”，而是**帖子（Post）**。

帖子既是信息载体，也是行动载体。帖子通过附加组件、关系和状态机，被赋予不同语义；再通过首页、地图、消息、频道、个人主页、详情页等不同 surface 被消费，形成完整的协作系统。

---

## 2. 核心产品哲学

### 2.1 NodeBB 提供底座，LIAN 提供语义与工作流

NodeBB 是成熟的核心能力提供者，负责：

- 账号基础能力
- topic / reply 基础内容能力
- 原生消息与频道基础能力
- 成熟的社区底座与兜底稳定性

LIAN 负责在其之上提供：

- 组件级 metadata
- 业务语义层
- 权限与身份层
- 现实协作工作流
- AI 协作能力
- 推荐、地图、奖励与本地生活场景

这意味着 LIAN 的原则不是重复发明 NodeBB 已经成熟解决的问题，而是：

> **在 NodeBB 之上，优雅地赋予帖子更多语义、关系、能力与现实价值。**

### 2.2 帖子是统一核心单位

LIAN 中的绝大多数能力，都应尽量通过“帖子 + 组件 + 关系 + 状态机”的组合表达，而不是为每个场景发明孤立系统。

例如：

- 一条求助帖，可以通过关系演化为解决方案帖
- 一条解决方案帖，可以演化为活动帖或项目帖
- 一条项目帖，可以接受交付物并触发验收
- 一条评价帖，可以关联到商家页或地点页
- 一条活动总结帖，可以关联到活动或解决方案

帖子不是静态内容，而是现实协作的节点。

### 2.3 轻量、低摩擦、默认智能协作

用户使用 LIAN 时应当是轻量、低成本、低摩擦的。

- 发布时，不应先被复杂表单压住
- LLM 应作为默认协作者存在，而不是专家模式按钮
- 用户先表达意图，再让系统帮助其结构化、补全、组织与落地

这意味着 LIAN 的产品体验必须优先满足：

- 低门槛表达
- 高质量结构化
- 明确的可执行性
- 对现实行动的支持

### 2.4 身份不是装饰，而是信任与责任系统

LIAN 允许用户以官方风格的长期马甲身份参与社区，降低现实社交压力；同时又通过认证、标签、贡献、履约与记录，建立可信协作网络。

身份系统既要保护用户，也要让别人能够快速判断：

- 这个人是否可信
- 这个人具备什么能力
- 这个人是否有参与某类事务的资格
- 这个人是否需要承担责任

---

## 3. 系统边界与所有权模型

### 3.1 NodeBB Core Layer

NodeBB 作为核心底层，原则上拥有：

- 用户账号与基础会话
- topic / reply 原生写入与读取
- 原生频道 / 私信 / 社区消息的基础机制
- 成熟的论坛级互动底座

### 3.2 LIAN Semantic Layer

LIAN 在 NodeBB 之上拥有：

- post metadata
- components
- relations
- audience / visibility / distribution
- post type / presentation intent / card template
- identity tag / verification state
- location / place / merchant / event / help / trade / errand 等语义扩展

### 3.3 LIAN Workflow Layer

LIAN 负责把静态内容演化为可执行协作流程，包括：

- 活动报名与完成
- 跑腿订单与状态流转
- 商家能力与接单能力
- 求助到解决方案的演进
- 项目交付与验收
- 奖励发放与结算
- 举报与后台治理

### 3.4 External Intelligence & Notification Layer

LIAN 可接入外部服务，但其角色必须清晰：

- LLM：结构化表达、建议组件、建议解决方案、建议验收标准、辅助审核
- Server酱：外部通知与提醒
- 地图服务：地点上下文与地理消费 surface

这些外部服务永远是增强层，不应替代核心业务真相。

---

## 4. 核心产品模型

LIAN 的统一产品模型如下：

```text
Post
├─ Base Content
├─ Components[]
├─ Relations[]
├─ State Machines[]
├─ Permissions
├─ Identity Requirements
├─ Surface Projections
└─ Action Graph
```

### 4.1 Base Post

每条帖子至少包含：

- 基础标题 / 正文 / 图片 / 封面
- 作者与显示身份
- 时间信息
- 基础标签
- 可见性与受众范围
- 当前状态

Base Post 解决的是“这是什么内容”。

### 4.2 Components

组件解决的是“这条帖子拥有什么附加语义”。

组件不是 UI 装饰，而是产品语义单元。组件既影响渲染，也影响权限、状态机、推荐与交互。

V1 组件分层建议：

#### 基础组件

- `audience`
- `identity`
- `media`
- `location`
- `time`
- `tags`

#### 业务组件

- `event`
- `merchant`
- `trade`
- `help`
- `errand`
- `review`
- `submission`
- `reward`
- `group_buy`
- `project`

#### 约束组件

- `verification_requirement`
- `action_availability`
- `delivery_requirement`
- `acceptance_criteria`
- `channel_binding`

### 4.3 Relations

关系解决的是“这条帖子与其他帖子 / 实体之间是什么语义关系”。

关系不是简单链接，而是图谱与状态机的输入。

V1 推荐关系类型：

- `solves`
- `implements`
- `reviews`
- `summary_of`
- `submission_for`
- `belongs_to_place`
- `belongs_to_merchant`
- `organized_from`
- `spawned_channel`
- `reward_settlement_for`
- `derived_from_help`
- `follow_up_of`

关系将直接影响：

- 详情页结构
- 推荐策略
- 地图归属
- 商家聚合
- 状态流转
- 通知范围
- 协作频道建立

### 4.4 State Machines

状态机解决的是“这条帖子或其附属业务对象当前处于什么协作阶段”。

不是所有帖子都有状态机，但任何会影响现实协作、资金、资格、交付或治理的对象，都必须有显式状态机。

V1 关键状态机包括：

- `event lifecycle`
- `errand order lifecycle`
- `trade lifecycle`
- `submission review lifecycle`
- `moderation lifecycle`
- `group-buy lifecycle`

状态机必须满足：

- 可读
- 可审计
- 可通知
- 可恢复
- 可做权限判断

### 4.5 Permissions

权限至少拆成三层：

- `viewPermission`：谁能看到
- `actionPermission`：谁能互动或参与
- `publishPermission`：谁能发布或发起该类内容

不得把三者混在一个字段中。

### 4.6 Identity Requirements

身份要求解决的是“谁可以以什么身份参与”。

V1 至少支持：

- 无门槛参与
- 注册用户参与
- 高校认证参与
- 实名认证参与
- 组织成员参与
- 商家认证参与
- 跑腿认证参与
- 管理员 / 审核员参与

---

## 5. Post Type 与 Component 的关系

LIAN 不应把产品能力完全绑定在 post type 上。

post type 的职责是：

- 作为主要展示 intent 的快速分类
- 作为前后端分支与兜底兼容层
- 作为用户理解成本较低的结果标签

V1 canonical post type：

- `image`
- `text`
- `event`
- `merchant`
- `trade`
- `help`
- `place`
- `project`（规划项）
- `review`（规划项）

但长期上，LIAN 的表达核心是：

> **type 是入口标签，component 才是产品语义主轴。**

---

## 6. 多 surface 消费模型

同一条帖子，可以在不同 surface 中呈现不同切片。

### 6.1 Feed

Feed 解决的是：

- 发现值得关注的信息
- 推荐可能感兴趣或有价值的内容
- 在低成本浏览下提供高密度线索

Feed 中优先展示：

- 内容摘要
- 核心组件信号
- 身份与可信度信号
- 当前可行动作

### 6.2 Map

Map 解决的是：

- 空间上下文下的信息发现
- 用户当前探索窗口内的现实信息组织
- 地点与帖子的关联消费

Map 中优先展示：

- 地点相关帖子
- place / merchant / errand / event / help 等空间强相关内容
- 区域推荐与筛选

### 6.3 Detail

Detail 解决的是：

- 语义完整展示
- 组件完整展示
- 关系完整展示
- 当前状态与动作入口

Detail 是帖子作为协作对象的主解释页。

### 6.4 Messages / Channel

Messages 不是单纯通知收件箱，而是协作流的另一种消费形态。

- `notification`：系统对状态变更、结果、奖励、审核的告知
- `channel`：围绕某个活动、项目、跑腿、群体协作的实时沟通空间

长期上，频道应升级为协作工作台，而不仅是聊天流。

### 6.5 Profile

Profile 解决的是：

- 这个人是谁
- 这个人如何被信任
- 这个人做过什么
- 这个人可以参与什么

它不仅展示内容记录，也展示身份、能力、贡献、履约与可见范围。

---

## 7. 身份、马甲与信任系统

### 7.1 官方马甲身份

用户在注册后，可以获得一个官方风格的、唯一的、长期使用的马甲身份。

这个身份的目标是：

- 降低熟人社交压力
- 保护真实身份
- 允许长期积累信誉
- 保持责任可追踪

### 7.2 认证梯度

V1 认证与身份标签体系：

- `registered`
- `campus_verified`
- `realname_verified`
- `org_member`
- `merchant_verified`
- `runner_verified`
- `admin`
- `moderator`

### 7.3 可信标签

除了认证标签，还应逐步支持：

- 社区贡献
- 组织经历
- 可靠/诚信/履约
- 审核资质
- 活动组织经验

### 7.4 场景化身份使用

不同场景，对身份强度要求不同：

- 普通内容：可使用马甲
- 校园内部交流：要求高校认证
- 商业/交易/跑腿：要求更强认证
- 某些高风险场景：要求实名或审核通过

身份不是单一值，而是**场景化约束能力**。

---

## 8. AI 在 LIAN 中的角色

AI 不是替代用户，而是增强用户。

V1 中 AI 至少承担四种角色：

### 8.1 Authoring Assistant

帮助用户：

- 补全标题
- 润色正文
- 推断帖子 intent
- 推荐标签、地点、组件、可见范围

### 8.2 Structuring Assistant

帮助帖子从“自然表达”结构化为“可执行对象”：

- 建议活动组件
- 建议价格组件
- 建议地点组件
- 建议交付要求
- 建议验收标准
- 建议关系归属

### 8.3 Matching Assistant

帮助系统识别：

- 谁可能能解决问题
- 哪些需求可以合并
- 哪些帖子可以关联
- 哪些活动可以转成项目或频道

### 8.4 Reviewing Assistant

帮助人类审核员或发起者：

- 评估交付物是否符合标准
- 生成审核摘要
- 标出风险点
- 给出推荐动作

AI 的原则：

- 默认在场，但不抢用户控制权
- 先建议，后应用
- 不静默覆盖用户表达
- 关键决策必须可审计

---

## 9. 现实协作闭环

LIAN 的价值不在于发帖本身，而在于把现实协作闭环建立起来。

V1 的闭环能力包括：

### 9.1 Help → Solution

- 用户提出需求
- 社区提出方案
- 有能力的人接管与推进

### 9.2 Event / Activity

- 发起活动
- 报名
- 管理参与者
- 完成活动
- 结算奖励
- 沉淀总结

### 9.3 Errand

- 商家或需求方触发跑腿
- 接单
- 配送状态流转
- 通知
- 完成与结算

### 9.4 Project / Submission / Review

规划中的重点主系统：

- 把需求升级为项目型帖子
- 明确定义交付物
- 允许用户提交成果
- 允许 AI 或审核员按标准验收
- 允许发奖励、退回、重试

### 9.5 Group Buy / Collective Action

规划中的重点主系统：

- 报名达到阈值才生效
- 先冻结点券或资格
- 成功后扣除或结算
- 失败后退款/解锁
- 自动形成协作频道

---

## 10. 奖励与贡献体系

LIAN 的奖励体系服务于现实协作，不是单纯积分装饰。

V1 奖励对象包括：

- 活动完成后的奖励
- 项目交付后的奖励
- 跑腿或现实任务完成后的奖励
- 社区贡献与审核贡献

V1 奖励表现：

- `points`
- `honor`
- 可扩展的 locked balances / settlement ledger

奖励体系必须满足：

- 可审计
- 与动作/结果绑定
- 支持锁定与结算
- 支持失败回滚或补偿

---

## 11. 推荐与分发原则

LIAN 的推荐目标不是单纯提高停留时长，而是提升问题解决效率与现实协作效率。

推荐因子至少包括：

- 地点相关性
- 身份匹配
- 内容质量
- 热度
- 可信度
- 当前上下文
- 关系图谱
- 解决概率

分发层面至少区分：

- `home`
- `search`
- `detail`
- `map`
- `channel`
- `messages`

并明确某些内容可能：

- 只在频道出现
- 不进入首页
- 只在特定 audience 中出现
- 只在任务/活动完成后可见

---

## 12. 治理与安全原则

LIAN 的治理必须覆盖：

- 举报对象与证据
- 审核状态
- 管理员动作
- 用户通知
- 审计日志

同时，安全边界必须坚持：

- 关键权限由后端控制
- 客户端不承担安全真相
- 外部服务不可成为系统真相来源
- 上传、鉴权、对象级授权、功能级授权、资源消耗控制都必须明确

---

## 13. 当前阶段的实施优先级

### P0：统一核心模型

先把 Post / Component / Relation / StateMachine / Surface 模型固定为团队共识。

### P1：V2 metadata components 与 relation contract 稳定

前后端统一组件与关系 schema，保证 feed / detail / map / messages / profile 都能消费同一份语义真相。

### P2：Publish 从“轻量发帖”升级为“轻量发起协作”

在当前 Card-as-Editor + LLM 协同之上，继续增加：

- 结构化建议
- 关系建议
- 交付要求建议
- 验收标准建议

### P3：Identity & Trust System V1

把认证、身份标签、马甲、场景权限与 profile 展示统一起来。

### P4：Project / Submission / Review

建立可交付、可验收、可奖励的项目型协作系统。

### P5：Channel 升级为协作工作台

让频道不只是消息流，而是协作空间。

### P6：Group Buy / Collective Action

建立群体参与、锁定、结算、退款与频道联动模型。

---

## 14. 非目标与反模式

V1 明确不做：

- 重新发明 NodeBB 已成熟提供的核心论坛/消息底座
- 用孤立页面替代统一帖子模型
- 为每个业务场景单独设计完全割裂的数据系统
- 让 AI 直接静默改写用户内容
- 把复杂现实工作流全塞进单一 post type 而不抽象组件与状态机
- 让权限逻辑只存在前端 UI 层

反模式包括：

- 只靠 post type 堆业务能力
- 把关系当成普通超链接
- 把频道当成单纯消息收件箱
- 把 profile 当成静态名片
- 把 LLM 当成“生成文案按钮”而不是结构化协作者

---

## 15. 里程碑文档关系

本 PRD 作为总纲，下挂或衔接的子 PRD / RFC 建议包括：

1. `PRD_WAP_SECURITY_AUDIENCE_EVENT_V0.1.md`
2. `PRD_POST_CREATION_REVOLUTION_V0.2.md`
3. `PRD_IDENTITY_AND_TRUST_SYSTEM_V1.md`（待建）
4. `PRD_ACTIONABLE_POST_PROJECT_WORKFLOW_V1.md`（待建）
5. `PRD_COLLABORATION_CHANNEL_V1.md`（待建）
6. `PRD_GROUP_BUY_COLLECTIVE_ACTION_V1.md`（待建）
7. `RFC_POST_COMPONENT_RELATION_CONTRACT_V1.md`（待建）

---

## 16. 一句话总结

> **LIAN 的本质，是以帖子为统一节点、以组件与关系赋予语义、以身份与状态机建立信任和协作、以 AI 和外部服务增强执行效率、以 NodeBB 为稳定底座，把校园与本地生活中的真实问题组织起来并推动解决。**
