# PRD：LIAN 发布体验重构 V0.2 — Card-as-Editor + LLM 协同

> **承接关系**：本 PRD 是 V0.1（`PRD_WAP_SECURITY_AUDIENCE_EVENT_V0.1.md`）第 7.4 节「发布页」的演进版本，不替代 V0.1 的发布权限/可见范围/AI 接口契约，只重构 **用户视角的发布流程与编辑模型**。
>
> **决策日期**：2026-05-23（产品决策锁）
>
> **目标仓库**：`lian-mobile-web`（移动端优先），`lian-platform-server`（仅在新增/调整 AI 接口时涉及）
>
> **不在范围**：`lian-nest-server` 不动；NodeBB 写路径不动（仍走 `createNodebbTopicFromPayload` / `handleAiPostPublish` 管道）
>
> **文档落地说明**：本文件是 V0.2 PRD 的**回填**。在 step A–F 的实施 PR（#825 / #826 / #841 / #847 / #860 / #868）和 RFC #883 的 PR body 里都引用了本 PRD 的 § 号，但 PRD 文件本体此前未落 `main`。本 PR 只补文件本体，不引入产品决策。所有内容来自这 7 份 PR body 的逐条引文。

---

## 1. 决策背景与目标

LIAN 的发布从「填表」转为「写卡片」。

- 用户主路径：上传图片 → 写两句话 → 发布。
- 用户面对的不是表单，而是 **一张正在生长的卡片**：所见即所得，预览即编辑。
- LLM 是默默在场的助手，不是按钮，不是面板。它通过 _ghost text_ 与 _inline ghost component_ 出现，被用户输入覆盖即消失。
- 帖子类型（image/text/event/merchant/trade/help/place）从用户必须先选择的分支，退化为 LLM 与用户共同决定的 **结果性标签**。

这是一次取消 _模态_ 的重构，不是加功能的重构。

### 1.1 不做项清单（节选，完整列表见 §7）

- 不要新建一个独立的"预览页面"或"预览路由"。预览即编辑（见 §3）。
- 不要保留"先选发帖类型"的步骤。kind 在本 PRD 后退为帖子的一个 _后置标签_。
- 不要保留"专家模式"或"高级编辑"开关。LLM 已经是默认协作者，不再分模式。
- 不要绕过 `usePublishDraft` 聚合层去直接读写正文/标题，所有用户输入与 LLM 输入都必须经过 draft session。
- 不要把 LLM 生成的内容直接写到正文字段。LLM 写入走 _候选层_，用户点击应用后才落入正文（见 §4.2.2）。

---

## 2. 信息架构

### 2.1 发布卡视觉模型

**V0.1 现状**（`PublishView.vue` 顶部 4 个 radio）：

```
┌──────────────────────────────────────────┐
│ ○ 普通图文  ○ 活动  ○ 商家  ○ 二手交易     │  ← 必须先选
├──────────────────────────────────────────┤
│ [图片] [标题] [正文] [标签] [可见范围]     │
│ + 商家专属字段 / 活动专属字段              │
└──────────────────────────────────────────┘
```

**V0.2 目标**：删除 radio 行。卡片自身就是入口。

```
┌──────────────────────────────────────────┐
│ [图片占位 / 已上传图]                       │
│                                            │
│ ghost: 帮你想个标题…                         │  ← LLM 候选标题（灰）
│ │                                          │  ← 用户光标在这
│ ghost: 用户开始写正文…                       │  ← LLM 候选正文片段（灰）
│                                            │
│ [📍 选个地点（可选）]                       │  ← inline ghost component
│ [⏰ 这是活动吗？要时间吗？]                  │  ← inline ghost component（条件显示）
│                                            │
│                            [发布]           │
└──────────────────────────────────────────┘
```

kind 不再是用户的第一决策，而是 LLM 通过文本/图片推断 + 用户通过 _添加 inline ghost component_ 间接选定的结果。

### 2.2 kind 推断模型与 enum 7 值

**enum**（与 V0.1 后端契约一致，`src/types/publishSuggestion.ts` 的 `InferredKind` 7-set）：

```
"image" | "text" | "event" | "merchant" | "trade" | "help" | "place"
```

**数据上**：post 仍带 `kind` 字段，后端契约不变。前端在 submit 时按下面的优先级推断写入 `kind`，后端不重推断，按收到的 `kind` 走现有分支。

**UI 上**：`kind` 不在发布页暴露成 radio。

**推断优先级**（2026-05-23 产品决策锁；实施载体 `src/features/publish/inferKind.ts`，PR #868 step F）：

1. **image** > **panel（event/merchant/trade）/ ghost component** > **求助 tag** > **location-only** > **text**
2. 具体分支：
   - **有任意图片附件** → `kind=image`（最高优先级；只要有任意图片附件，无论用户是否化实 ghost component，无论文字写了什么，kind 一律 `image`。"有图即图文帖" 是产品决策的硬约束，不可被 panel/ghost component 覆盖）
   - 无图 + 启用「时间 + 地点 + 名额」 → `event`
   - 无图 + 启用「价格 + 商家信息」 → `merchant`
   - 无图 + 启用「价格 + 二手物品状态」 → `trade`（accept(price) ghost component 化实即触发 trade kind 推断，详见 §4.2.3）
   - 无图 + tagInput 含「求助」标签 → `help`
   - 无图 + 仅地点 → `place`
   - 无图 + 仅文 → `text`（默认 fallback）
3. **降级**：若推断不出，落 `image` 或 `text`（按是否有图）。

**审计**：发布请求体里仍带显式 `kind` 字段；`PublishPayload.kind` 在 wire 上保持 optional 以让较老客户端继续解析（PR #868）。

### 2.3 商家与跑腿 capability 对齐（V0.1 §5.2 + 已合 PR #821 的能力门）

- merchant 相关 inline ghost component 默认 **不出现** 在非商家用户的卡片上（继承已合 PR #821 capability gating）。
- 跑腿 CTA 仍走 V0.1 §6.4 的 errand 子系统，发布页只展示商家是否打开"接受跑腿"开关，不展开订单流程。
- ghost component 的「实化」遵守这条 gate：例如 `merchant_info` 仅对 `merchant_verified` 用户实化，`trade_condition` 仅对 `campus_verified` 用户实化（PR #860 实现，PR #882 / S13 用 e2e 锁定）。

---

## 3. 卡即编辑器交互模型

**核心反例**：先前曾考虑「全屏预览」与「编辑面板」分两面，被产品决策否决。原因——"全屏预览，预览的同时不就可以修改了吗，为什么要分两面"。

### 3.1 视觉与交互契约

- 发布页 = 一张全屏的、终态视觉的卡片。卡片所有字段（图、标题、正文、地点、活动时间、价格…）**都是可点击的编辑入口**。
- 没有「预览模式」按钮，没有「切换到编辑」按钮。
- 用户点击卡片任意可编辑字段 → 该字段进入 inline 编辑态（标题变 input，正文变 textarea，地点变 picker sheet 等）。
- 用户点击卡片空白处或键盘收起 → 字段退出编辑态，卡片回到展示态。
- **展示态与编辑态必须是同一棵 DOM 树的不同样式分支**，不允许是两个独立组件互相切换（防止状态/光标/输入法丢失）。

### 3.2 与现有 `FeedItemCard.vue` 的关系

- 发布页卡片必须 **复用 feed 上对应 kind 的卡片模板** 作为视觉基线。
- 同一帖子在发布页所见 = 在首页 feed 流中所见（除：feed 卡片是只读的，发布页卡片是可编辑的）。
- 实现策略：抽出 `FeedItemCardShell.vue`（纯展示骨架），feed 与 publish 各包一层（feed 加跳转/动效，publish 加编辑钩子）。已由 step A / PR #825 落地。
  - shell 单 root `<article>`，事件靠 attribute fallthrough 传给宿主，wrapper 不直接读 `domain/composables/api`。
  - 结构守卫：`tests/feed/feed-item-card-shell.structure.test.mjs`（8 条断言）防止 shell 反向依赖。

### 3.3 验收

- 用户从未离开同一个屏幕，从空白到发布完成。
- 用户没有看到 tab、step、stepper、模式切换器、"预览"按钮、"高级"按钮。
- 用户看到的卡片样式与发布后的卡片样式像素级一致（除了编辑态光标/占位符）。

---

## 4. LLM 协同

### 4.1 触发矩阵

LLM 调用 **自动触发**，不需要用户点按钮。来源：PR #847 step E-pre。

| 触发条件               | 行为                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| 用户上传任一张图       | 立即触发 `POST /api/ai/post-preview`（图 + 已写文本）                                       |
| 用户停止输入超过 600ms | 触发或刷新 LLM 候选（实现里 debounce 取 800ms，给 burst typing 留余量；floor 仍然是 600ms） |
| 用户选完地点           | 用「地点上下文」再触发一次（地点常常决定 kind）                                             |
| 用户按「发布」         | **不再触发**——来不及                                                                        |

#### 4.1.1 stale drop / silent failure / latency telemetry

实现规则（PR #847）：

1. `title` 或 `body` 任一变化都重置 debounce（"任意一边 ratchet"）。
2. fire 之前快照 `title / body / imageUrls`；await fetcher 之后做**双重 stale 守护**：
   - inflight ticket：newer fire 把 older response 视为 stale。
   - snapshot guard：response 回来时 ref 值已变 → 丢弃，不调 `set*Candidate`，避免与 `createBodyCandidate` 的 watch invalidate 形成死循环。
3. `title === '' && body === '' && images === []` → skip round trip（无 grounding）。
4. **网络错误 / LLM 错误 → 静默**：refs 不动，`suggestedComponents` 不动，不弹 toast / alert（沿用 step B/C 的 silent-fail 哲学）。
5. `onScopeDispose` 取消 pending timer + bump inflight，组件销毁后任何 in-flight response 也不会再写。

**用户量小，不做成本管控**。但记录每次 LLM 调用的响应时间到 telemetry，用于后续选型（详见 §9）。

### 4.2 LLM 输出的三种落点

#### 4.2.1 标题：ghost text 隐式填上

- 用户标题字段为空 → LLM 标题以 _灰色 ghost text_ 渲染在 input 内部。
- 用户按任意键开始打字 → ghost 立即消失，标题为用户输入。
- 用户点击 ghost → ghost 转为可编辑文本，光标置于末尾，颜色变正常。
- 用户清空标题 → ghost 重新显示（如果 LLM 候选还在）。
- **不允许的反模式**：弹出"建议标题"对话框，让用户点"采用 / 拒绝"。这又回到模态了。

实现拆分（PR #841）：候选槽 + apply/revert bar 与 body 候选对齐先行；**ghost text 的输入框内联渲染**（PRD §4.2.1 视觉层）留给后续 PR，状态机层不重写。

#### 4.2.2 正文：候选层 + 显式应用 + 撤回

正文字段比标题敏感得多（用户主要心血在这里），不能让 LLM 直接覆盖。模型（PR #826 step B）：

- LLM 生成的"润色版"正文 **不写入正文字段**，存在 draft session 的 `bodyCandidate` 槽。
- 正文字段下方出现一行小按钮：`✨ 帮我润色`（仅当存在 candidate 且与当前正文不同）。
- 用户点 `✨ 帮我润色` → 用 candidate 替换正文字段；按钮变为 `↶ 撤回润色`，再点恢复原文。
- 用户继续手写 → candidate 失效，按钮消失（PR #826 watcher 在 body 改到第三个值时清掉 candidate）。
- 候选与当前正文相同时按钮也隐藏（no-op suggestion guard）。
- **每张卡片只保留 1 步撤回**，不需要完整 undo 栈。

**持久化策略**：candidate 是 transient（memory-only）。candidate 由 LLM 派生、可重新派生；持久化只会带来 stale-candidate bug；`publishDraftSession` 保留给"用户敲过的"。`resetForm` 清掉，reload 后消失。

**不允许的反模式**：

- 在用户写正文时悄悄替换或追加。
- 把 LLM 候选作为 ghost text 叠在用户已写的正文上面（视觉灾难）。

#### 4.2.3 inline ghost component

LLM 推断当前内容更适合做 `event` / `merchant` / `place` 时，在卡片合适位置显示一个 _灰色虚线虚拟组件_（PR #860 step E-main）：

- 例：`[⏰ 这是活动吗？加个时间]`、`[📍 加个地点]`、`[💰 加个价格]`。
- 用户点击 ghost component → 它变成实组件并加入 draft（同时把 kind 推断结果上调）。
- 用户忽略（点「忽略」）→ 仅从 list 移除，不动 draft。
- 用户继续输入或切到下一个 LLM tick → ghost 静默消失。
- 一次 accept 后该候选从 list 移除（"用户继续输入或切到下一个 LLM tick 时静默消失"的对应实现）。

**accept(price) → kind=trade 决策**（2026-05-23 产品决策锁）：用户化实「价格」ghost component 后，**在无图前提下**，kind 推断为 `trade`（详见 §2.2 priority chain）。enum 不变（image/text/event/merchant/trade/help/place）。该映射的实施载体是 `src/features/publish/inferKind.ts`，由 step F 后续 PR 落地。

**6 类 inline ghost component 与角色 capability 门**（PR #860 实现，PR #882 / S13 e2e 锁定）：

| 候选 kind         | 用户点「加入」后的 draft 动作                                                                      | 门控                                 |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `event_time`      | `publishKind = "event"`（活动面板打开）                                                            | 任何登录用户                         |
| `merchant_info`   | `publishKind = "merchant"`                                                                         | **仅 `merchant_verified`**           |
| `trade_condition` | `publishKind = "trade"`                                                                            | **仅 `campus_verified`**             |
| `price`           | **`publishKind = "trade"`**（无图前提下；2026-05-23 产品决策锁，覆盖此前 merchant 优先的临时方案） | `campus_verified`（沿用 trade gate） |
| `help_tag`        | `tagInput = "求助"`（仅当为空，绝不静默覆盖用户已写的 tag）                                        | 任何登录用户                         |
| `location`        | draft 不动（PRD §2.2 `place` kind 留给 step F 推断）                                               | 任何登录用户                         |

**a11y 合规**（PR #860）：

- 整个 `<ul>` 带 `aria-label="AI 建议添加"`。
- 每条「加入」按钮 `aria-label="建议添加 <reason>"`，让屏幕阅读器念出 LLM 给的 reason 而不是泛泛的「加入」。
- 每个 `<li>` 暴露 `data-kind` 给 e2e selector / telemetry。
- 双 button + 键盘可达。

### 4.3 LLM 响应契约形状

V0.1 已有：

- `POST /api/ai/post-preview`（生成预览草稿）
- `POST /api/ai/post-drafts`（落 draft）
- `POST /api/ai/post-publish`（发布）

V0.2 对 `post-preview` 的 **响应** 加 top-level `candidates` 字段，不改请求形状（来源：PR #847，已与 ps#534 后端实现确认）。

请求形状（V0.1 不变）：

```ts
{
  imageUrl: string,
  imageBase64?: string,
  template?: "campus_moment" | "food" | string,
  userText: string,        // ≤300 chars，server 会再 truncate
  locationHint?: string,   // ≤80 chars
  visibilityHint?: "public" | "campus" | "school" | "private" | "linkOnly"
}
```

响应（在原有 `draft / locationDraft / locationSuggestions / riskFlags / confidence / suggestedAudience` 之外新增 top-level `candidates`）：

```ts
{
  ok: true,
  mode: "mock" | "mimo" | string,
  // … pre-existing fields untouched
  candidates: {
    title: string | null,                 // ghost-text title, ≤40 chars
    bodyCandidate: string | null,         // 润色 candidate, ≤300 chars
    suggestedComponents: Array<{
      type: "location" | "event_time" | "price" | "merchant_info" | "trade_condition" | "help_tag",
      reason: string                      // ≤60 chars 中文
    }>,                                   // deduped + capped at 6
    inferredKind: "image"|"text"|"event"|"merchant"|"trade"|"help"|"place" | null,
    modelLatencyMs: number,
    modelName: string
  }
}
```

**降级路径**（provider 不可用 / LLM error）也带 `candidates` 块，字段全为 null/empty。client **不需要** 根据 `mode` / `degraded` 做分支——这是 ps#534 留给我们的「defensive nulls」。

后端实现：在现有 preview pipeline 末尾增加 `candidates` 字段构造。**不允许** 替换原有 `title/body/tags` 字段含义（向后兼容旧客户端）。

**前端命名取舍**（PR #847）：

- 后端字段叫 `type`（保留与原 LLM JSON 兼容），前端 `src/types/publishSuggestion.ts` 起名 `kind`——避开 JS `type` 关键字。
- `label`：直接吃后端 `reason`（≤60 字中文一句话理由）。
- `payload`：在 step E-pre 永远是 `{}`；E-main「实化」时由 sub-draft factory 决定要带什么默认值。

---

## 5. 边界与 capability gating

- 沿用 PR #821 的 `capability registry`，不新增 capability key。
- `usePublishDraft` 是聚合层；新增的 `bodyCandidate` / `titleCandidate` / `suggestedComponents` 全部从 `usePublishDraft` 派生，组件用 `provide` / `inject` 消费，不允许组件局部 ref。
- `merchant` / `trade` / `event` 子草稿仍按 kind 分文件（`useMerchantPublishDraft.ts` / `useTradePublishDraft.ts` / `useEventPublishDraft.ts`）；本 PRD 只换"何时激活"，不换激活后的字段。
- `usePublishSubmit.ts` 提交链路不动（仍走 `createNodebbTopicFromPayload`），step F 在其中插入 `inferKind` 调用，把推断结果写到 wire `kind` 字段，作为防御性兜底（PR #868）。
- non-merchant 用户进入发布页：merchant 相关 ghost component 完全不出现，与 PR #821 行为一致；merchantVerified mid-session fallback 在 step F 保留作为 defense-in-depth。
- `PublishGateNotice.vue` 仍保留（merchant 门提示），但不再挂在 radio 上，挂在 ghost component "实化" 时的兜底路径。

---

## 6. 工程拆分顺序

每步是一个独立 PR，每步都先红测再绿。每个 PR 都需要：

- `npm run check` 全绿
- `npm run test:unit` 全绿
- 至少一条 Playwright e2e 覆盖该步骤的用户路径（A 仅结构守卫不强求 e2e）

| step   | 内容                                         | PR     | 状态                       |
| ------ | -------------------------------------------- | ------ | -------------------------- |
| A      | Shell 抽取（无行为变化）                     | #825   | merged 2026-05-23 03:26    |
| B      | `bodyCandidate` 槽 + 润色按钮                | #826   | merged 2026-05-23 03:43    |
| C      | LLM 响应扩字段（后端 ps#534）                | ps#534 | merged                     |
| D      | 标题候选槽（ghost text 状态机层）            | #841   | merged 2026-05-23 05:00    |
| E-pre  | 把 LLM tick 接到 publish state               | #847   | merged 2026-05-23 07:57    |
| E-main | 把 `suggestedComponents` 渲染成 inline ghost | #860   | merged 2026-05-23 08:50    |
| F      | 删 4-radio + submit 时按 §2.2 推断 kind      | #868   | open（draft 时 in-flight） |
| G      | 视觉对齐 / 卡片化布局                        | TBD    | 未开                       |

每 step 的范围与测试要求逐条说明：

### 步骤 A — Shell 抽取（无行为变化）

- 抽 `FeedItemCardShell.vue`，让 `FeedItemCard.vue` 与（暂时仍存在的）`PublishComposer.vue` 都 import 它。
- shell 单 root `<article>`，事件靠 attribute fallthrough；shell 不引 `domain/`、`composables/`、`app/`、`api/`、`types/feed`。
- 测试：`tests/feed/feed-item-card-shell.structure.test.mjs`（8 条），feed 视觉快照未变；publish 视觉快照未变。
- 风险：低。

### 步骤 B — `bodyCandidate` 槽 + 润色按钮

- `usePublishDraft` 加 `bodyCandidate` ref，新增 `setBodyCandidate / applyBodyCandidate / revertBodyCandidate`、`bodyCandidateApplied` computed、body-watch 在用户敲第三个值时清候选。
- `PublishCandidateBar.vue` 上线，挂在 `PublishComposer.vue` body textarea 之下；`provide`/`inject` 消费，不 prop drill。
- 文案常量：`src/config/brand/publish.ts` 里 `PUBLISH_BODY_CANDIDATE_APPLY / _REVERT / _LABEL`。
- transient 持久化（memory-only），`resetForm` 清掉。
- 测试：注入 candidate → 按钮出现；点击 → body 被替换；再点 → body 被还原；用户编辑 body → candidate 失效，按钮消失；候选 == body 时也隐藏；setBodyCandidate(null) 清干净。

### 步骤 C — LLM 响应扩字段（无前端 UI 变化，后端 ps#534）

- 后端 `post-preview` 响应加 §4.3 描述的 `candidates` 字段（标题候选 / 正文候选 / suggestedComponents / inferredKind / latency）。
- 前端 step C 当下不消费——「step C 之后前端到现在还没消费」（PR #847 引文）。
- 降级路径也带 `candidates` 块（all-null/empty）。

### 步骤 D — 标题候选槽

- 镜像 step B：`createTitleCandidate` 工厂、`PublishTitleCandidateApi` 接口、`PublishTitleCandidateKey` injection key；`usePublishDraft` provide。
- `PublishTitleCandidateBar.vue` 挂在 title `<label>` 与 body `<label>` 之间，与 body bar 在 textarea 下方的位置对称。
- 文案：`PUBLISH_TITLE_CANDIDATE_APPLY / REVERT / LABEL`。
- transient 持久化，`resetForm` 同步清。
- **本 step 不接 LLM**，也**不实现** ghost text 输入框内联渲染——状态机层先行，渲染层留给后续 PR。
- 测试：状态机 7 条 + DOM 结构 / 文案合规 2 条 + PublishComposer 挂载位置 1 条。

### 步骤 E-pre — LLM tick 接到 publish state

- 新增 `src/types/publishSuggestion.ts` 类型 + 校验 helper；`src/api/aiPreview.ts`（V0.2 `fetchPublishLlmCandidates`）；`src/features/publish/usePublishLlmTick.ts`（debounce + race-safe）。
- `usePublishDraft` 加 `suggestedComponents: Ref<SuggestedComponent[]>`、`PublishSuggestedComponentsKey` InjectionKey、`useInjectedSuggestedComponents` consumer。
- `PublishComposer.vue` setup 调用 `usePublishLlmTick({ title, body, setTitleCandidate, setBodyCandidate, suggestedComponents })`。
- **不渲染**：`suggestedComponents` 只灌进 ref，UI 看不到。
- 实现规则照 §4.1.1 stale / silent / dispose。
- 测试 12 条覆盖：debounce / 持续打字不调 / body 触发 / pipe / 静默失败 / stale snapshot drop / inflight race / 全空不调 / image-only / null candidates 不写 / 空 response 清 components / scope dispose 取消。

### 步骤 E-main — 渲染 inline ghost component

- `PublishSuggestedComponents.vue`：在 `PublishCandidateBar` 下方以 inline ghost 卡片渲染 `suggestedComponents`，每条带 `加入` / `忽略` 两个按钮。视觉与 step B `PublishCandidateBar` / step D `PublishTitleCandidateBar` 同语言（dashed primary tint border + low-opacity background）。
- `usePublishDraft.ts` 加 `createSuggestedComponentsActions` 纯工厂 + `PublishSuggestedComponentsActionsKey`，6 类 accept 行为见 §4.2.3 表。任意 accept 后该候选从 list 移除；dismiss 仅移除不动 draft。
- a11y 见 §4.2.3。
- reduced-motion：接入 `useReducedMotion`，subtle slide+fade 在 `prefers-reduced-motion: reduce` 下完全 disable（BEM 修饰符 `publish-suggested--reduced`，不污染 `.is-*` 词表）。
- brand 词条：`PUBLISH_SUGGESTED_*` 系列 9 条，全走 `src/config/brand/publish.ts`。
- 测试 22 条：accept × 6 kind + 双击保护 + verification gate 双向；dismiss × 3；end-to-end pipe；DOM snapshot + brand-only 守卫；`PublishComposer` 挂载顺序锁 `bodyBar < ghost list < summary`。
- step E-pre 的契约层（`src/types/publishSuggestion.ts`、`src/api/aiPreview.ts`、`usePublishLlmTick.ts`）一行不动。

### 步骤 F — 删 4-radio + submit 时按 §2.2 推断 kind

- 新增 `src/features/publish/inferKind.ts` —— 纯工厂；branches per §2.2 priority。
- `usePublishSubmit.ts` 在 submit 时快照 draft refs，调 `inferKind`，把结果写到 `PublishPayload.kind`（wire 上 optional 让旧 client 仍可解析）。
- `PublishView.vue` 删 `<fieldset>` + `kindStates` computed + `selectPublishKind` helper；`v-if` panels（event/merchant/trade）保留各自 gate 与 `merchantVerified` mid-session fallback。
- 5 条结构测试更新；新 vitest 覆盖 `inferKind`（17 cases —— 4 panel kind + help tag + location-only + image + text fallback + panel-beats-content priority）；新 e2e spec `publish-step-f-no-radio.spec.ts` 断言 fieldset DOM 已删。

### 步骤 G — 视觉对齐 / 卡片化布局

- 整体页面布局换成 card-as-editor。删除当前的「分段表单」感（多个 GlassPanel 并列）。
- 测试：发布页快照 与 feed 卡片快照在 `kind=image` 时除编辑光标外像素一致（容差 2px）。

---

## 7. 不做项 / 后续可能

V0.2 显式 **不做**：

- 不做 LLM 流式输出（先 POST/JSON，等 latency 数据再考虑流式）。
- 不做多轮对话式润色（仅单轮 candidate）。
- 不做 LLM 自动选 audience / 自动选 location（V0.1 §3.1 三类权限不能由 AI 决定）。
- 不做完整 undo 栈（仅 1 步撤回润色）。
- 不做"先看预览再编辑"（card-as-editor 即终态）。
- 不做独立的"预览页面"或"预览路由"。
- 不做"专家模式"或"高级编辑"开关。
- 不做"先选发帖类型"步骤（kind 是结果性标签，不是入口）。
- 不做 LLM 直接覆盖正文字段（强制走候选 + 一键应用 + 一键撤回）。
- 不做"建议标题"对话框的 accept/decline 模态。

---

## 8. mobile-first 设计原则与 reduced-motion 处理

- 移动端优先；卡片为单列、纵向滚动；任何"两栏"或"分模式"布局视为反模式。
- 所有 ghost / candidate 视觉必须遵守 `prefers-reduced-motion: reduce`（PR #860）：
  - subtle slide+fade 在 reduce 下完全 disable。
  - 用 BEM 修饰符（如 `publish-suggested--reduced`），不污染 `.is-*` 状态词表。
  - 候选 bar / inline ghost component / 标题 ghost text 共用同一份 reduced-motion guard（S11 / #880 e2e 锁定）。
- 文案中文为主，全部经 `src/config/brand/publish.ts` 常量；e2e / unit 断言用常量 import，不用字面量 emoji，避免 copy 改动牵连测试。

---

## 9. telemetry 与质量度量

PRD §4.1 mandates "记录每次 LLM 调用的响应时间到 telemetry，用于后续选型"。承载形态来源于 PR #847 + RFC #883 §9 open question 2：

- LLM tick 必带的 latency 字段：`modelLatencyMs: number`、`modelName: string`（来自后端 `candidates` 块）。
- e2e 期望（S9 / #878）：每个 tick 落一条 `publish_llm_tick` event，shape `{ modelLatencyMs: number, modelName: string, status: "ok" }`；force 500 → `{ status: "error" }` event。
- sink 形状：`window.__lianTelemetry`（capture 在 `beforeEach`）。**注**：`window.__lianTelemetry` 在 main 上当前不存在，要么 step F 落 sink + S9 跟上，要么 S9 先 ship 一个 `test.fixme` 占位（RFC #883 open question 2）。
- 用户接受率（candidate 被 apply 的比例 / ghost component 被 accept 的比例）也希望进 telemetry 通道，路径在 mw 与 ps 各自的 observability 通道（具体形状未定）。

工程验收（来源：之前合 PR body 的 §7.2 引文）：

- LLM 自动触发逻辑有 telemetry 落库（响应时间分布 / 调用频次 / 用户接受率）。
- 所有 ghost / candidate / inferredKind 的 UI 状态都从 `usePublishDraft` 派生，不允许组件局部 ref。
- 发布请求体的 `kind` 字段由前端按 §2.2 推断写入；后端不重推断，按收到的 `kind` 走现有分支。
- 卡片骨架在 feed 与 publish 之间为同一个 SFC（`FeedItemCardShell.vue`），任何视觉漂移立即被快照测试拦下。

---

## 10. 组件清单

### 10.1 新增

| 组件                                | 责任                                               | step   |
| ----------------------------------- | -------------------------------------------------- | ------ |
| `FeedItemCardShell.vue`             | 纯展示骨架，feed 与 publish 共用                   | A      |
| `PublishCandidateBar.vue`           | 正文下方 `帮我润色 / 撤回润色` 按钮                | B      |
| `PublishTitleCandidateBar.vue`      | 标题候选 apply/revert bar（与 body 对称）          | D      |
| `usePublishLlmTick.ts`              | composable：debounce 800ms + 自动触发 + race-safe  | E-pre  |
| `src/types/publishSuggestion.ts`    | `SuggestedComponentKind` / `InferredKind` 类型定义 | E-pre  |
| `src/api/aiPreview.ts`              | V0.2 `/api/ai/post-preview` typed 客户端           | E-pre  |
| `PublishSuggestedComponents.vue`    | inline ghost component 渲染 + 加入/忽略            | E-main |
| `src/features/publish/inferKind.ts` | submit 时按 §2.2 推断 kind 的纯工厂                | F      |

### 10.2 删除或大幅瘦身（V0.2 落地后）

- `PublishView.vue` 内的 4-radio kind 选择段（step F 已删）。
- 「先选发帖类型」相关 brand 常量：`PUBLISH_TYPE_LABEL` / `PUBLISH_TYPE_REGULAR` / `PUBLISH_TYPE_EVENT` / `PUBLISH_TYPE_MERCHANT` / `PUBLISH_TYPE_TRADE`（保留至 i18n 迁移完成后再批量清）。

### 10.3 保留不动

- `usePublishDraft.ts` 聚合层（V0.2 在其内部加 `bodyCandidate` / `titleCandidate` / `suggestedComponents` 槽）。
- `useMerchantPublishDraft.ts` / `useTradePublishDraft.ts` / `useEventPublishDraft.ts`（kind 子草稿仍按 kind 分文件）。
- `usePublishSubmit.ts` 提交链路（含 `createNodebbTopicFromPayload` 调用）；step F 仅在内部插入 `inferKind` 调用，不重写链路。
- `PublishGateNotice.vue`（merchant 门提示，挂载点改到 ghost component "实化" 兜底路径）。

---

## 11. 跨 PRD 引用

- V0.1 §2.5 列出了 3 个 AI 接口的现有形态——本 PRD 只扩 `post-preview` 的响应字段（见 §4.3）。
- V0.1 §3.1 三类权限（view/action/publish）不变。
- V0.1 §5.2 商家发布权限矩阵不变；本 PRD 通过 ghost component 的「不出现」实现 V0.1 §3.1 中"无感化隐式提示"。
- V0.1 §7.4 发布流程被本 PRD §3 + §4 + §6 完全替换，但接口契约（`/api/posts`、AI 三件套）不动。

**RFC #883 引用**：本 PRD 与 e2e 覆盖 RFC `docs/agent/rfc/e2e-v02-prd-coverage.md` 双向引用。RFC §9 列了 3 条 open question，对本 PRD 影响如下：

1. **Ghost-text DOM strategy**（S3）：`PublishComposer.vue` 当下还没渲染标题 ghost（仅槽接到）。`::placeholder` overlay vs sibling `<span aria-hidden>` vs `::before` 伪元素三种实现里挑哪种，会改 §4.2.1 验收里的 DOM 形状。Resolve before opening S3 / #872 PR。
2. **Telemetry sink**（S9）：见 §9。
3. ~~**`accept(price)` fallback 语义**（S5）~~：**已 resolve 2026-05-23**：accept(price) → `kind=trade`（无图前提下），见 §4.2.3 + §2.2。`inferKind.ts` price→trade 实施 PR 跟在本 PRD 后落地。

---

## 12. 术语

- **ghost text** — 输入控件内部以浅灰色显示的占位候选文字，不是 placeholder（placeholder 是空提示，ghost 是真候选）。
- **inline ghost component** — 卡片正文流里以虚线、灰色显示的占位组件，点击实化为正式组件。
- **candidate** — LLM 生成、尚未被用户接受的内容。仅落 draft session 的候选槽，不落正文/标题字段。
- **card-as-editor** — 同一棵 DOM 同时承担"展示 = 终态预览"与"编辑 = 字段录入"两种角色，不分模式。
- **inferredKind** — 由 LLM + ghost component 选择共同得出的最终 `kind` 标签，用户不直接选。

---

## 附录 A：13 个 V0.2 e2e issue 与 § 索引

由 RFC #883（`docs/agent/rfc/e2e-v02-prd-coverage.md`）建立的 13 行 gap matrix；issue 编号 #870–#882；每个 issue body 用 `S<n>` 链回 RFC 行。

| RFC 行 | issue | spec 文件名                                    | 对应 §                    | wave |
| ------ | ----- | ---------------------------------------------- | ------------------------- | ---- |
| S1     | #870  | `publish-card-as-editor.spec.ts`               | §3                        | 3    |
| S2     | #871  | `publish-llm-trigger-matrix.spec.ts`           | §4.1                      | 2    |
| S3     | #872  | `publish-title-ghost-text.spec.ts`             | §4.2.1                    | 3    |
| S4     | #873  | `publish-body-candidate-bar.spec.ts`           | §4.2.2                    | 1    |
| S5     | #874  | `publish-suggested-components-actions.spec.ts` | §4.2.3                    | 1    |
| S6     | #875  | `publish-kind-inference-payload.spec.ts`       | §4.3 + §6 step F          | 2    |
| S7     | #876  | `publish-no-kind-radio.spec.ts`                | §6 step F                 | 2    |
| S8     | #877  | `publish-llm-stale-and-failure.spec.ts`        | §4.1（stale + silent）    | 1    |
| S9     | #878  | `publish-llm-telemetry.spec.ts`                | §4.1 + §9                 | 2    |
| S10    | #879  | `publish-shell-shares-feed-card.spec.ts`       | §3.2 / §6 step G          | 3    |
| S11    | #880  | `publish-ghost-reduced-motion.spec.ts`         | §4.2.x + §8               | 1    |
| S12    | #881  | `publish-llm-contract-shape.spec.ts`           | §4.3                      | 1    |
| S13    | #882  | `publish-kind-inference-role-matrix.spec.ts`   | §6 step F + §2.3 + §4.2.3 | 2    |

调度建议（RFC §7）：

- **Wave 1**（依赖已合）：S4 / S5 / S8 / S11 / S12。
- **Wave 2**（step F 合并后）：S2 / S6 / S7 / S9 / S13。
- **Wave 3**（step G + 标题 ghost-text 渲染后续 PR 落地后）：S1 / S3 / S10。

---

## 附录 B：Changelog

- **2026-05-23** — 用户拍板 §2.2 priority chain（image 最高）+ §4.2.3 accept(price) → trade 链路。`inferKind.ts` 中 image 最高优先级与 price→trade 的实施 PR 跟在本 PRD 之后。同步 resolve §11 open question 3。
