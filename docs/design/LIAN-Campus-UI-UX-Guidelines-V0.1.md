# LIAN Campus UI / UX Guidelines V0.1

LIAN 校园信息系统 UI / UX 设计规范 V0.1。

This document is LIAN's lightweight product, UI, and UX source of truth. It is not a Material Design clone and not a heavy design-system standard. Its job is to keep product decisions, interface patterns, and implementation behavior consistent across `lian-mobile-web`, `lian-platform-server`, and future split repos.

## 1. 总纲与产品原则

LIAN is not a forum plus a map. It is a campus information system where scattered student life information can be searched, discussed, mapped, trusted, and reused over time.

Homepage slogan:

```text
卡片是信息的容器，马甲是用户的身份，地点是内容的归宿。
```

Short UI principle:

```text
统一卡片，清晰身份，轻玻璃层级，地点化沉淀。
```

UX principle:

```text
视觉让它统一，动效让它连贯，状态让它可信，身份让它安全，地点让它沉淀。
```

Product-level rules, in priority order:

1. 信息优先于装饰。
2. 信息流优先于功能宫格。
3. 卡片是所有内容的统一容器。
4. 马甲身份必须清晰可见。
5. 地点不是附属信息，而是内容沉淀入口。
6. 玻璃 UI 只用于浮层材质，不替代信息层级。
7. AI 只做整理和辅助，不做事实权威。
8. 主操作必须永远比次操作明显。
9. 实用互助优先于情绪宣泄。
10. 内容要可搜索、可归档、可复用。

The three hardest constraints are:

```text
卡片统一
身份清晰
地点沉淀
```

LIAN should combine outside design systems selectively:

```text
结构学 Google
体验学 Apple
视觉回到 LIAN
```

Google / Material gives LIAN component system thinking: repeatable components, explicit states, tokens, and interaction categories. Apple / HIG gives LIAN experience judgment: content first, clear hierarchy, natural motion, readable text, platform habits, and material that supports depth instead of becoming decoration.

LIAN's own rule:

```text
像 Apple 一样尊重内容，像 Google 一样系统化，最后长成自己的滨海校园信息系统。
```

## 2. 视觉基础

LIAN's visual direction is:

```text
Campus Utility Glass
校园生活工具感 + 滨海轻玻璃感
```

Utility is the core. Glass is only a material. Tool clarity comes before visual effect.

Use:

- 滨海、自然、清爽、校园生活感。
- 米白背景。
- 蓝绿色主色。
- 轻玻璃浮层。
- 清楚的信息层级。
- 适合移动端快速扫描的密度。

Avoid:

- 政务蓝。
- 企业 SaaS 风。
- 纯论坛风。
- 过度科技风。
- 满屏毛玻璃。
- 外卖平台风。

Suggested V0.1 tokens:

```css
:root {
  --lian-bg: #F7F4EC;
  --lian-card: rgba(255, 255, 255, 0.76);

  --lian-primary: #1FA7A0;
  --lian-primary-deep: #087B78;
  --lian-primary-soft: #E4F7F5;

  --lian-coast-blue: #5BB8D6;
  --lian-grass-green: #78B66B;

  --lian-ink: #1F2933;
  --lian-muted: #6B7280;
  --lian-faint: #9CA3AF;

  --lian-danger: #EF4444;
  --lian-warning: #F59E0B;
  --lian-success: #22C55E;
}
```

Color semantics must stay stable. A color cannot mean primary action, normal decoration, place, and AI at the same time.

| Color role | Meaning | Strength |
|---|---|---|
| 蓝绿色主色 | Primary action, current selection, brand signal | Strong for action, restrained elsewhere |
| 海岸蓝 | Place, map, spatial information | Light to medium |
| 草地绿 | Success, confirmed, useful life information | Medium |
| 黄色 / 橙色 | Pending, AI-organized, caution, trade risk | Medium to strong by risk |
| 红色 | Delete, error, report, destructive risk | Strong |
| 灰色 | Time, source, secondary information | Low |

Colors serve four semantic jobs:

| Use | Meaning | Strength |
|---|---|---|
| 类型识别 | Experience, discussion, food, AI, official, trade | Weak |
| 状态提示 | Confirmed, pending, expired, disputed | Medium |
| 操作强调 | Publish, confirm, next, submit | Strong |
| 风险警示 | Delete, report, trade risk, real-name reminder | Strong |

The feed color rule:

```text
统一卡片底色，轻量类型色，结构优先，颜色辅助。
```

LIAN feed cards must not use large-area type colors. Keep card backgrounds unified and use small type chips, icons, thin accents, source labels, and content modules to identify type.

Type tokens are for chips, icons, left hairlines, and small badges, not full-card backgrounds:

```css
:root {
  --type-experience: #78B66B;
  --type-discussion: #5BB8D6;
  --type-hot: #F59E0B;
  --type-food: #1FA7A0;
  --type-place: #2F80ED;
  --type-ai: #8B7CF6;
  --type-official: #087B78;
  --type-trade: #F97316;
  --type-contribution: #22C55E;

  --type-experience-soft: rgba(120, 182, 107, 0.14);
  --type-discussion-soft: rgba(91, 184, 214, 0.14);
  --type-hot-soft: rgba(245, 158, 11, 0.14);
  --type-food-soft: rgba(31, 167, 160, 0.14);
  --type-place-soft: rgba(47, 128, 237, 0.14);
  --type-ai-soft: rgba(139, 124, 246, 0.14);
  --type-official-soft: rgba(8, 123, 120, 0.14);
  --type-trade-soft: rgba(249, 115, 22, 0.14);
  --type-contribution-soft: rgba(34, 197, 94, 0.14);
}
```

Typography:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  sans-serif;
```

Type scale:

| Use | Size |
|---|---|
| 页面标题 | 22-24px |
| 模块标题 | 18-20px |
| 卡片标题 | 16px |
| 正文 | 14px |
| 辅助信息 | 12px |
| 标签 | 11-12px |

Typography rules:

- 标题要短。
- 正文预览最多 2 到 3 行。
- 卡片里只突出一个主信息。
- 辅助信息必须降权。
- 标签、地点、身份、热度不能全部一样显眼。
- 卡片标题最多 2 行。
- 摘要最多 3 行。
- 身份标签最多展示 2 个。
- Tag chip 最多展示 2 到 3 个，更多折叠。
- 地点和时间放在同一弱信息层。
- 字号放大时优先保留标题和地点，减少截断正文和辅助标签。

Spacing, radius, and shadows use a 4px grid:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-chip: 999px;
  --radius-button: 12px;
  --radius-card: 16px;
  --radius-sheet: 24px;
  --radius-orb: 999px;

  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-floating: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

## 3. 玻璃 UI 与层级

Glass UI must be layered. Do not glass everything.

First rule:

```text
Utility 是核心，Glass 是材质。
工具性优先，玻璃感辅助。
```

Material is a depth tool, not a style protagonist. Glass should separate foreground controls from content, especially in navigation, map overlays, and bottom sheets. It must not cover or compete with the user's main reading path.

Glass hierarchy:

| Type | Use | Rule |
|---|---|---|
| `GlassBar` | Top bar, bottom navigation | Light blur, low shadow |
| `GlassPanel` | Map detail, publish form, bottom sheet | Medium blur, medium shadow |
| `GlassOrb` | Back, close, locate, floating publish actions | Circular, strongly recognizable |
| `TonalPill` | Save draft, regenerate, filter | Soft color, low emphasis |
| `FilledPill` | Publish, confirm, next, submit | Solid color, high emphasis |

Hard rules:

- 决定流程结果的按钮不能只是玻璃按钮。
- 正文内容卡片不要默认重玻璃。
- 长列表项不要大面积使用 `backdrop-filter`。
- 主操作按钮不要只靠玻璃表达。
- 玻璃层必须有足够底色，不能牺牲文字对比。

Must use `FilledPill`:

- 发布
- 提交
- 确认
- 下一步
- 保存修改
- 确认拼车
- 确认交易

May use glass or tonal styles:

- 返回
- 关闭
- 定位
- 筛选
- 保存草稿
- 重新生成
- 展开更多

## 4. 卡片系统

Cards are LIAN's core information container.

```text
卡片是信息流中所有信息存在的统一框架。
```

V0.1 should start with four parent card families:

| Parent card | Covers |
|---|---|
| `ContentCard` | Posts, experiences, discussions, notices |
| `PlaceCard` | Places, buildings, dining halls, merchant aggregates |
| `ActionCard` | Publish prompts, corrections, contributions, update records |
| `SummaryCard` | AI summaries, system summaries, knowledge-base summaries |

Specific cards such as `PostCard`, `HotCard`, `NoticeCard`, `MerchantCard`, and `AISummaryCard` should be variants of these parent cards instead of unrelated layouts.

Unified card structure:

```text
身份区
内容区
上下文区
互动区
沉淀区
```

Field meaning:

| Area | Content |
|---|---|
| 身份区 | Avatar, alias name, identity label, contribution label |
| 内容区 | Title, summary, image, menu information, AI summary |
| 上下文区 | Place, tag, time, source, category |
| 互动区 | Comments, likes, saves, shares, corrections |
| 沉淀区 | Linked place, entered knowledge base, referenced count |

Information priority:

```text
身份
标题
核心内容
地点
标签
时间
互动
沉淀状态
```

Rules:

- Do not turn cards into miscellaneous drawers.
- Card body click enters detail.
- Chips, buttons, images, and identity controls must have higher event priority than the card body.
- A card should usually emphasize one main idea.
- NodeBB topics must be transformed into mobile information cards, not copied as raw forum UI.

Feed card color rule:

```text
弱颜色区分 + 强结构区分。
```

All feed cards keep a unified white / warm white / light glass base. Content type is identified through `TypeChip`, icon, thin accent line, trust/source badge, and the card's content module. Color is an auxiliary signal and cannot be the only semantic signal.

Recommended feed card skeleton:

```text
[Type Chip] [Location Chip] [Trust Badge]

标题

摘要 / 图片 / 特定内容模块

IdentityBadge · ContributionBadge
时间 · 评论 · 收藏 · 沉淀状态
```

Example:

```text
[经验] [三食堂] [已沉淀]

三食堂二楼哪家适合晚饭便宜吃饱？

靠左边那家套餐比较稳，15-18 元，晚饭人少一点……

小蓝鲸 · 饭堂观察员
12分钟前 · 18评论 · 42收藏
```

Do not do this:

```text
饭堂卡片整张绿色
讨论卡片整张蓝色
AI 卡片整张紫色
官方卡片整张红色
拼车卡片整张橙色
```

Type-specific modules should carry the real difference:

| Card type | Primary module |
|---|---|
| 校园经验 | Title, place, summary, saves, sedimentation |
| 热门讨论 | Comment count, heat, latest reply, discussion state |
| 饭堂商家 | Place, stall, price, open state, recommendation |
| AI 摘要 | Source count, uncertainty, view sources |
| 官方通知 | Official identity, publish time, importance, source link |
| 拼车 / 闲置 | Time/place, real-name state, risk prompt, contact action |

Visible marker limits:

- `TypeChip`: at most 1.
- `LocationChip`: at most 1.
- Trust / status badge: at most 1.
- Tag chips: show 2 to 3, then collapse.
- Identity / contribution labels: at most 2.

## 5. 身份、贡献标签与 Tag Chip

LIAN's identity system is not just avatar plus name. It includes:

```text
马甲身份
认证身份
贡献标签
领域信誉
```

Identity has two layers:

```text
展示身份：用户现在以谁出现
信誉身份：这个人在什么领域值得信任
```

Card display:

```text
头像
小蓝鲸
马甲身份 · 饭堂观察员
```

Rules:

- 卡片最多展示 1 个身份标签 + 1 个贡献标签。
- 个人页可以展示完整身份和贡献经历。
- 发布页必须显示当前发布身份。
- 评论框必须显示当前评论身份。
- 拼车和闲置必须进入实名或半实名确认。

Publish copy:

```text
你将以「小蓝鲸 · 马甲身份」发布
```

Comment copy:

```text
以「小蓝鲸」评论
```

Tag chips are content connectors, not decoration.

Tag rules:

- 展示时必须带 `#`。
- 用户输入时 `#` 可选。
- 系统保存时统一补 `#`。
- 最多 5 个。
- 单个标签最多 15 个字符。
- 允许中文、英文、数字、下划线、连字符。
- 不允许空格、表情、特殊符号。
- 输入后必须转成 chip。

Tag types:

| Type | Examples | Source |
|---|---|---|
| 内容标签 | `#避坑`, `#晚饭`, `#求助` | User input |
| 地点标签 | `#三食堂`, `#宿舍区`, `#海边` | Generated by place binding |
| 系统标签 | `#AI整理`, `#官方通知`, `#已验证` | System only |

Users cannot freely create system trust tags such as `#官方通知`, `#已认证`, or `#AI整理`.

## 6. 信息流、地点与地图沉淀

LIAN's distribution model:

```text
内容 -> 信息流分发 -> 地点归档 -> 被搜索 / 地图 / AI 复用
```

This is the difference from a normal forum:

```text
普通论坛：内容 -> 时间流 -> 过期 -> 被遗忘
LIAN：内容 -> 信息流分发 -> 地点归档 -> 长期复用
```

Homepage structure:

```text
顶部搜索
今日热帖 / 今日园区动态
频道 Tab
推荐信息流
地图悬浮入口
发布按钮
```

Initial feed channels:

```text
推荐
热帖
经验
讨论
饭堂
附近
```

MVP distribution ratio can be manually configured:

| Content type | Ratio |
|---|---|
| 热门讨论 | 30% |
| 校园生活经验 | 25% |
| 同学吐槽 / 实用反馈 | 20% |
| 饭堂商家 | 15% |
| AI 整理 | 5% |
| 新内容探索 | 5% |

Algorithm principle:

```text
算法不是只追求上瘾，而是调节 LIAN 的信息生态。
```

Use two metric groups:

| Metric group | Examples |
|---|---|
| 分发指标 | 点击、停留、评论、点赞、收藏 |
| 沉淀指标 | 地点绑定、搜索命中、被收藏、被 AI 引用、被地点页采用、纠错通过 |

Map relationship:

```text
信息流负责分发
地图负责定位
地点页负责沉淀
```

Map layer rule:

```text
地图是内容层
浮层是控制层
地点 Sheet 是解释层
```

Map UI should follow content-first layout:

- The map is not a decorative background.
- Search and filters are control layers.
- Place details belong in a bottom sheet.
- Locate, back, and publish controls can be `GlassOrb`.
- Hot markers must not hide major buildings or routes.
- Marker type cannot rely on color alone; use icon, label, or count.

Homepage answers: 我现在该看什么。

Map answers: 这个信息在哪里。

Place page answers: 这个地方长期有什么。

Search answers: 我主动找什么。

Map defaults:

- 建筑。
- 饭堂。
- 宿舍区。
- 主要公共空间。
- 少量热帖。
- 当前筛选内容。

Do not show every post by default.

Place page should be:

```text
结构化资料
+
动态讨论
+
AI 轻整理
```

Example for a dining hall:

```text
三食堂

基础信息：
位置 / 楼层 / 营业状态

商家档口：
一楼：奶茶、炒饭、面食
二楼：套餐、麻辣烫、烧腊

热门经验：
哪家便宜吃饱
哪家排队少
哪家适合晚饭

相关讨论：
今天二楼人多吗？
一楼奶茶出餐慢吗？

AI 摘要：
根据最近 18 条讨论整理
```

## 7. 动效、交互、状态与反馈

Motion should explain relationship, not show off.

Motion principles:

- 动效必须短。
- 动效必须说明关系。
- 动效不能影响阅读。
- 动效不能抢过内容。
- 动效要支持 `prefers-reduced-motion`。
- 玻璃 blur 不参与强动画。

Recommended duration:

| Motion | Duration |
|---|---|
| 微反馈 | 100-180ms |
| 卡片展开 | 180-240ms |
| 页面转场 | 240-320ms |
| 地图 Sheet | 250-350ms |
| AI 生成 | Light loading only |

Implementation rules:

- Page transitions should use `transform` and `opacity`.
- Avoid animating `width`, `height`, `top`, and `left`.
- Long lists should not run large reveal animations on every item.
- Heavy glass effects and heavy motion must not stack.

Purposeful LIAN motion examples:

- Feed card enters detail: the selected card expands into content.
- Place chip opens place page: the content moves toward its long-term location.
- Map marker opens sheet: a spatial point becomes structured information.
- Tag chip is created: typed text becomes a reusable connector.
- Identity switch confirms: the publishing identity visibly changes.
- AI summary generates: the system is organizing, not declaring truth.

Avoid:

- Every card flying in differently.
- Buttons flashing continuously.
- AI summaries glowing as the visual focus.
- Map markers bouncing without user intent.

Interaction rules:

| Target | Action |
|---|---|
| 卡片主体 | Enter detail |
| 地点 chip | Enter place page |
| 标签 chip | Enter tag/search result |
| 身份 | Enter profile or identity explanation |
| 图片 | Open lightbox |
| 长按卡片 | More actions |
| 首页下拉 | Refresh feed |
| 地图 Sheet 上滑 | Expand place detail |

Event priority inside cards:

```text
按钮 > chip > 图片 > 身份 > 卡片主体
```

This rule exists to prevent input fields or reply controls from accidentally triggering card navigation.

State has two categories:

| State category | Examples |
|---|---|
| 组件状态 | Default, pressed, selected, disabled, loading, success, failure |
| 信息状态 | 已确认、待确认、有争议、已过期、AI 整理、官方信息 |

Write actions must always produce feedback.

Covered actions:

- 点赞
- 收藏
- 评论
- 发布
- 保存草稿
- 选择身份
- 绑定地点
- 提交纠错
- AI 生成
- 举报
- 删除
- 实名确认

Feedback rules:

- 用户触发写操作后，必须有即时反馈。
- 失败时必须告诉用户下一步。
- 可恢复操作优先给撤销。
- 长操作必须显示进度或状态。

Examples:

```text
发布成功，已关联到「三食堂」。
发布失败，草稿已保存，可以稍后重试。
已提交纠错，确认后会更新地点资料。
AI 摘要已生成，请确认后发布。
```

## 8. 文案、无障碍与数据可信度

LIAN copy should be:

```text
清楚
友好
不装
不官方腔
不制造压力
```

Error copy must include a reason or a next step.

Avoid:

```text
提交失败
标签不合法
AI 暂时无法整理
```

Prefer:

```text
发布失败，网络可能不稳定。你可以重试，草稿已保存。
标签只能包含文字、数字、下划线或连字符，最多 5 个。
AI 暂时无法整理，你可以先保存草稿，稍后重新生成。
```

Accessibility V0.1 hard rules:

- Button hit area should be at least 44px.
- Important text must maintain usable contrast.
- Icon-only buttons need accessible labels.
- State cannot be communicated by color alone.
- Map markers need text or type icons.
- Motion must respect reduced-motion preference.
- Form errors must have text descriptions.
- Important buttons must not disappear automatically.
- Tags and controls need enough spacing to avoid mis-taps.
- Glass backgrounds must preserve contrast in light, dark, and high-contrast contexts.
- Cards should still make sense when type color is removed.

Color can help recognition, but it cannot carry meaning alone.

Do not rely on this:

```text
Purple means AI.
Yellow means pending.
Green means confirmed.
```

Use explicit labels:

```text
AI 摘要
根据 12 条帖子整理
可能不准确，请查看来源

待确认
用户投稿 · 暂未核实

已确认
商家更新 · 今天 11:30
```

Data trust is a first-class UI concern.

Every durable information item should answer:

```text
谁提供的？
什么时候更新的？
是否被确认？
是否来自 AI？
是否过期？
能不能查看来源？
```

Source labels:

```text
用户发布
用户纠错
运营维护
商家更新
AI 整理
官方来源
```

Trust states:

```text
已确认
待确认
有争议
已过期
AI 整理
官方信息
```

AI trust rules:

- AI 不代表事实。
- AI 不自动替用户发布。
- AI 不覆盖官方信息。
- AI 涉及价格、时间、地点时必须提示不确定性。
- AI 整理内容必须允许编辑。
- AI 摘要必须能查看来源。
- 没有来源的 AI 摘要只能作为草稿，不能作为事实卡片。

AI summary pattern:

```text
AI 摘要
根据最近 18 条讨论整理
可能不准确，请查看来源
[查看来源]
```

If sources are unavailable:

```text
AI 草稿
等待人工确认
```

## 9. 页面评审 Checklist

Every new or changed page should pass this checklist:

```text
1. 这个页面的主信息是否足够清楚？
2. 是否使用了统一卡片结构？
3. 主操作是否明显？
4. 玻璃 UI 是否影响阅读？
5. 是否显示当前身份？
6. 是否使用标签 chip？
7. 是否绑定地点？
8. 是否能沉淀到地点页或资料库？
9. AI 内容是否标注来源和不确定性？
10. 错误状态是否告诉用户下一步怎么做？
11. 写操作是否有即时反馈？
12. 加载、空、失败状态是否完整？
13. 动效是否解释关系且不影响阅读？
14. 是否支持减少动态效果？
15. 数据可信度状态是否清楚？
```

V0.1 should be applied first to:

1. Card system.
2. Alias identity and contribution labels.
3. Tag chip rules.
4. Glass UI hierarchy.
5. Place-based content sedimentation.
6. Motion, state, and feedback rules for publish/detail/place flows.

## 10. 代码落地

The guidelines should live in docs and code, not only in chat or design files.

Target implementation files as the frontend evolves:

```text
docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md
public/lian-tokens.css
docs/design/page-review-checklist.md
src/styles/tokens.css
src/components/ui/
src/components/cards/
src/components/map/
src/components/community/
```

Current implementation note: `lian-mobile-web` is still classic-script frontend plus CSS under `public/`. Apply these rules incrementally through `public/styles.css`, `public/glass-ui.css`, and frontend page scripts until the frontend split introduces component directories.

First practical code rules:

1. Extract LIAN color, spacing, radius, shadow, and glass variables into tokens.
2. Normalize `TagChip`, `IdentityBadge`, and `LocationChip` display rules.
3. Keep card interaction priority consistent.
4. Give publish, detail, and place flows complete state and feedback behavior.
5. Treat data trust labels as part of the UI, not optional metadata.
