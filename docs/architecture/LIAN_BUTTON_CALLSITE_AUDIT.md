# LianButton call-site 审计 (2026-05-23)

> 为 `feat/lian-button-state-vocabulary` 之后的"call-site replace PR"备弹药的纯研究产物。
> 不写代码、不改 props、只读。
>
> 任务 hint：LianButton 即将获得 `state="loading"|"disabled"|"pressed"|"success"|"error"|"default"` 6 态词表，替代现有的 `loading: bool + disabled: bool` 两个 boolean。
>
> 当前 LianButton 实现：`src/ui/LianButton.vue`（变体 `primary | tonal | ghost | danger`，尺寸 `sm | md | lg`，已有 `loading + disabled`，模板中只 emit `is-loading` 一个状态类）。
>
> 用户 import 数：22 个 SFC（不是任务描述里的 29，重新数过）。`<LianButton>` 标签出现 **40 次**——全部列在下方清单。

---

## 1. 清单（40 个 `<LianButton>` 标签 / 22 个 SFC）

> 格式：`<相对路径>:<行号> | variant/size | state-shaped props 用法摘要`
> 状态类 props 含义已经折成最小："—" 表示既没 `loading` 也没 `disabled`、纯 click 按钮。

### admin（10）

- `src/features/admin/AdminTokenGate.vue:49` | primary | — | submit token
- `src/features/admin/AdminQueueItem.vue:125` | primary/sm | — | 提交 transition
- `src/features/admin/AdminQueueItem.vue:131` | danger/sm | — | 隐藏帖子
- `src/features/admin/AdminQueueItem.vue:134` | ghost/sm | — | 锁帖
- `src/features/admin/AdminQueueItem.vue:137` | ghost/sm | — | 解锁帖
- `src/features/admin/AdminQueueList.vue:66` | ghost/sm | — | 重新载入举报队列
- `src/features/admin/AdminUserActionPanel.vue:65` | danger/sm | `:disabled="!target.trim()"` | 用户处罚提交
- `src/features/admin/AdminView.vue:425` | ghost/sm | — | 重新载入实名审核列表
- `src/features/admin/AdminView.vue:514` | ghost/sm | `:disabled="console.revealingVerificationId.value === request.verificationId"`（label 在"再次显示"/"显示"/"处理中…"间切换） | 揭露实名信息
- `src/features/admin/AdminView.vue:559` | primary/sm | — | 实名审核 approve
- `src/features/admin/AdminView.vue:566` | danger/sm | — | 实名审核 reject
- `src/features/admin/AdminView.vue:582` | ghost/sm | — | 重新载入审计日志

> 注：admin 共 10 个标签 + AdminView.vue 里 5 个，合计 12，上面已穷举（行号去重）。

### detail（5）

- `src/features/detail/PostReportBlock.vue:70` | danger/sm | `:loading="reportBusy"` | 提交举报
- `src/features/detail/PostReportBlock.vue:77` | ghost/sm | — | 隐藏被举报帖
- `src/features/detail/PostDetailHiddenState.vue:19` | ghost/sm | — | 撤销隐藏
- `src/features/detail/ShareCardSheet.vue:132` | tonal/sm | — | 分享卡片重试（仅在 `status==='error'` 时渲染）
- `src/features/detail/ShareCardSheet.vue:174` | ghost/md | — | 关闭分享卡片
- `src/features/detail/ShareCardSheet.vue:177` | primary/md | `:disabled="status !== 'ready' || !card"` | 确认分享

### feed（1）

- `src/features/feed/FeedLoadMore.vue:21` | ghost | `:loading="loadingMore"` | 载入更多

### merchant（1）

- `src/features/merchant/MerchantCenterView.vue:127` | ghost/sm | — | 商家中心错误状态下的"重新载入"

### messages（2）

- `src/features/messages/ChannelComposer.vue:75` | tonal(默认)/md | `:loading="sending"` | 频道发送
- `src/features/messages/ChannelThread.vue:72` | ghost | `:loading="loading"` | 频道载入更多

### profile（4）

- `src/features/profile/ProfileInviteCodePanel.vue:41` | ghost | `:disabled="!canCreateInvite" :loading="busy"` | 生成邀请码（同时有 disabled+loading 的混用）
- `src/features/profile/ProfileAvatarEditor.vue:103` | ghost | `:disabled="busy"` | 头像编辑取消
- `src/features/profile/ProfileAvatarEditor.vue:106` | tonal | `:loading="busy"` | 头像编辑保存
- `src/features/profile/ServerChanOptInDialog.vue:85` | ghost/md | `:disabled="busy"` | ServerChan 对话框次要 CTA
- `src/features/profile/ServerChanOptInDialog.vue:94` | primary/md | `:disabled="busy"` | ServerChan 对话框主 CTA

### publish（4）

- `src/features/publish/PublishActionBar.vue:19` | ghost | `:disabled="publishing || uploading"` | 清空表单
- `src/features/publish/PublishActionBar.vue:26` | primary/md | `:loading="publishing" :disabled="!canSubmit"` | 发布提交（loading + disabled 同时使用）
- `src/features/publish/PublishLocationControls.vue:113` | ghost/sm | — | 切回手动定位
- `src/features/publish/PublishResetConfirm.vue:25` | ghost | — | 重置确认 cancel
- `src/features/publish/PublishResetConfirm.vue:28` | danger | — | 重置确认 confirm

### runner（7）

- `src/features/runner/RunnerGate.vue:14` | primary | — | 跳转去验证
- `src/features/runner/RunnerCenterView.vue:178` | tonal/sm | — | 重新载入可接订单
- `src/features/runner/RunnerCenterView.vue:210` | tonal/sm | — | 重新载入进行中订单
- `src/features/runner/RunnerOrderCard.vue:120` | primary/sm | `:disabled="isPending"`（label "接单" / "处理中…"） | accept
- `src/features/runner/RunnerOrderCard.vue:131` | primary/sm | `:disabled="isPending"`（label "已到店" / "处理中…"） | at-shop
- `src/features/runner/RunnerOrderCard.vue:142` | primary/sm | `:disabled="isPending"`（label "已取餐" / "处理中…"） | pickup
- `src/features/runner/RunnerOrderCard.vue:153` | primary/sm | `:disabled="isPending"`（label "送达" / "处理中…"） | deliver

### verification（1）

- `src/features/verification/VerificationView.vue:200` | primary | `:disabled="campus.submitting.value"`（label "提交" / "提交中"） | 校园邮箱验证提交

> **小计**：admin 12 / detail 6 / feed 1 / merchant 1 / messages 2 / profile 5 / publish 5 / runner 7 / verification 1 = 40。

---

## 2. 高 ROI 替换候选（10 条）

> 标签 (a)/(b)/(c)/(d) 与任务描述一致。
> 行内说明用于 PR-α 给 replace agent 参考——不是 PR-α 的实现指令。

- [ ] `src/features/runner/RunnerOrderCard.vue:120` — **(a)** — `:disabled="isPending"` 但 label 切到"处理中…"，语义其实是 **loading**（async transition 进行中）。改 `state="loading"` 后 `is-loading` 会自动从 LianButton 内透出，不再需要 caller 手动判 label。**accept 按钮，错位最明显**。
- [ ] `src/features/runner/RunnerOrderCard.vue:131,142,153` — **(a)** — at-shop / pickup / deliver 三个 transition 全是同 pattern，连同 line 120 一起换掉是一次性收益。
- [ ] `src/features/verification/VerificationView.vue:200` — **(a)** — `:disabled="campus.submitting.value"` 配 label "提交中"，本质 loading。这是 errand/runner 之外的第二个明确"loading 伪装成 disabled"的高频例子。
- [ ] `src/features/admin/AdminView.vue:514` — **(a)** — reveal realname 同样是 disabled 配"处理中…"label。改 `state="loading"` 后还能让 `aria-busy=true` 走原语自然带出。
- [ ] `src/features/detail/PostReportBlock.vue:70` — **(c)/(d)** — submit report 已经有 `:loading="reportBusy"`；提交成功之后表单会折叠，目前没有视觉成功态。建议换成新原语后在 success 分支让 caller 选用 `state="success"` 闪 600ms（或 settled 后切回 default）。catch 路径同理走 `state="error"`。
- [ ] `src/features/publish/PublishActionBar.vue:26` — **(c)/(d)** — submit 当前已经 `:loading + :disabled`，这是流量最大的提交入口。success 后视图切走，但中间瞬态可以让按钮 `state="success"` 给一个 60ms 反馈。**但注意：success 撞白名单（见 §4）**。
- [ ] `src/features/messages/ChannelComposer.vue:75` — **(c)/(d)** — channel 消息发送，`:loading="sending"`，send 失败后 `<InlineError v-if="sendError">` 只在外侧报错，按钮自身没有 error 兜底。`state="error"` 闪一下能给到"这次没发出去"的一秒钟视觉锚点。
- [ ] `src/features/admin/AdminView.vue:559,566` — **(c)** — 实名审核 approve / reject 直接执行没视觉反馈，操作后列表会重排但中间瞬态空白。`state="success"` 短暂呈现能让审核员手感更稳，避免误以为按了没生效连点两次。
- [ ] `src/features/admin/AdminUserActionPanel.vue:65` — **(a)** — `:disabled="!target.trim()"` 是纯 form-validity gate，不是 loading 也不是 sibling-busy。直接 `state="disabled"` 把意图收敛成"前置条件未满足"。
- [ ] `src/features/detail/ShareCardSheet.vue:177` — **(a)** — `:disabled="status !== 'ready' || !card"` 同样是 validity gate。`state="disabled"` 显式收敛。

---

## 3. 低 ROI / 现状即可

下面 13 条是纯无状态 click 按钮（既不 loading 也不 disabled）；新原语下它们就是 `state="default"`，**不需要在 replace PR 里改任何 prop**——只要 LianButton 默认值兜底处理好就行。

- `src/features/admin/AdminTokenGate.vue:49`
- `src/features/admin/AdminQueueItem.vue:125,131,134,137`
- `src/features/admin/AdminQueueList.vue:66`
- `src/features/admin/AdminView.vue:425,582`
- `src/features/detail/PostReportBlock.vue:77`
- `src/features/detail/PostDetailHiddenState.vue:19`
- `src/features/detail/ShareCardSheet.vue:132,174`
- `src/features/merchant/MerchantCenterView.vue:127`
- `src/features/publish/PublishLocationControls.vue:113`
- `src/features/publish/PublishResetConfirm.vue:25,28`
- `src/features/runner/RunnerGate.vue:14`
- `src/features/runner/RunnerCenterView.vue:178,210`

> **共 17 个标签**，跨 13 个文件——这是大头，replace PR 别浪费 review 带宽。

---

## 4. 复杂 disabled 逻辑（替换时小心 race condition）

下面 4 个 caller 的 disabled / loading 表达式涉及多个 reactive，新原语的 `state` 是 enum 不是 OR 链，需要 caller 端先 `computed()` 出来再传——race 风险点在这里。

- `src/features/profile/ProfileInviteCodePanel.vue:41`
  - 当前：`:disabled="!canCreateInvite" :loading="busy"`——同时声明 disabled 和 loading
  - 新原语下：`busy` 时 `state="loading"`；不 busy 但无权限时 `state="disabled"`；都不 busy 且有权限时 `state="default"`。**优先级 loading > disabled > default**。caller 必须自己写 `computed`，否则新旧语义不等价（旧版 disabled+loading 同时为 true）。
- `src/features/publish/PublishActionBar.vue:26`
  - 当前：`:loading="publishing" :disabled="!canSubmit"`
  - 同上：必须 `computed` 出 `publishing ? "loading" : !canSubmit ? "disabled" : "default"`。**注意 `canSubmit` 内部也是组合多个 reactive**（form 校验 + uploading），race 已经存在但目前用 `||` 在外层兜底；新 enum 下需要在 caller 端把 OR 链显式化。
- `src/features/publish/PublishActionBar.vue:19`
  - 当前：`:disabled="publishing || uploading"`——disabled 的来源是 sibling 的 busy，不是自身的 loading。
  - 新原语下应该是 `state="disabled"` 而不是 `state="loading"`（这个按钮自己不是在 load，是被锁住）。**容易写错成 loading**——需要在 PR-α 里写一句类型注释提醒。
- `src/features/profile/ProfileAvatarEditor.vue:103`
  - 当前：`:disabled="busy"`，配套 line 106 是 `:loading="busy"`——一个组件里一对按钮共享同一个 `busy`，但语义错位（cancel 不是在 load，只是在 sibling load 时被锁）。
  - 新原语下 line 103 走 `state="disabled"`，line 106 走 `state="loading"`。**必须一起改**，否则 cancel 会显示 spinner。

---

## 5. `.is-*` 白名单交叉验证 + success 态决策点

> **2026-05-23 更新（doc 起草后落地）**：mw#843（`feat(ui): add 6-state vocabulary to LianButton`）已合 main，把 `.is-*` 白名单从 8 词扩到 9 词，新增 `is-success`。下面这一节"success 态决策点"原文保留作为历史背景，但**结论已自动达成**——不再需要起 mw#834 follow-up doc PR；第三批 success / error 瞬态 caller 的前置依赖**已解除**，可以直接排期。

mw#834 锁定的 8 词白名单（见 `tests/structure/state-class-vocabulary.test.ts` line 14-23 + `docs/frontend/state-vocabulary.md`）：

```
is-loading, is-empty, is-error, is-disabled, is-pressed, is-selected, is-active, is-open
```

**LianButton 当前 template 用到的 `.is-*` 类**（`src/ui/LianButton.vue:36`）：

```
{ 'is-loading': loading }
```

只有 `is-loading` 一个，已在白名单内。

### 6 态映射 vs 白名单

| `state` 值       | 拟用 `.is-*` 类  | 白名单内？ | 备注                                                                                       |
| ---------------- | ---------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `default`        | （无）           | n/a        | 默认态不需要状态类                                                                         |
| `loading`        | `is-loading`     | ✅          | 已是现状                                                                                   |
| `disabled`       | `is-disabled`    | ✅          | 与 `[disabled]` 选择器是不同的视觉钩子，词表已留位                                         |
| `pressed`        | `is-pressed`     | ✅          | 但 LianButton 当前 40 个 caller 里**没有任何 toggle/like/follow 用法**（详见 §6）           |
| `error`          | `is-error`       | ✅          | 词表本意是 form validation error，复用到瞬态按钮 error 没问题                              |
| **`success`**    | `is-success`     | ❌ **缺失** | **白名单只有 8 词，没有 success**。这是规避项                                              |

### success 态决策点

`is-success` 不在 mw#834 白名单里。如果 LianButton state PR 直接在 template 输出 `is-success`，会被 `tests/structure/state-class-vocabulary.test.ts` ban。

可选方案：

- **方案 A（推荐）**：把 success 视觉用 `is-active` 临时态表达。词表里 `.is-active` 的定义是"currently active (route match, focus-within, currently-playing, dragging). A persistent 'this is the live one' marker, not a toggle and not a selection." ——和 success 的瞬态语义不完全契合，会被未来的 reviewer 质疑"按钮怎么会 active"。
- **方案 B（推荐做正经 follow-up）**：在 `feat/lian-button-state-vocabulary` 的 stack 上单独加一个 mw#834 follow-up doc PR，把 `is-success` 加进白名单 + 更新 `state-vocabulary.md` + grandfathered.json 不变。词表本来就允许"通过 doc PR 加新词"。预计变更面：
  - `docs/frontend/state-vocabulary.md` 加一行表格 + 一段 mutual exclusivity 说明（`is-success` 与 `is-loading/is-empty/is-error` 也互斥）
  - `tests/structure/state-class-vocabulary.test.ts` 的 `ALLOWED_STATE_CLASSES` 加一个字符串
  - 不动 grandfathered.json
- **方案 C**：success 不在 button 上呈现，而是在父级 toast/inline 上呈现，按钮在 success 后回到 `default`。和现状一致，等于砍掉 success 态。**但任务描述里 6 态 PR 是要落 success 的**——砍 success 实际上是放弃这次 PR 的一项 deliverable。

**建议路径**：方案 B 走 mw#834 follow-up，命名 `feat/state-vocab-add-success`，与 LianButton state PR stack 顺序为：

```
mw#834 follow-up (加 is-success 到 8 → 9 词) → LianButton state PR (用 is-success) → call-site replace PR
```

这样 LianButton state PR 落地时不会被结构测试卡，也不会污染 grandfathered.json。

---

## 6. 关于 toggle 按钮 / aria-pressed 的非发现

值得显式 flag：**40 个 LianButton call-site 里没有一个是 toggle 按钮**。所有的 like / save / follow / interest-chip / filter-chip toggle 都用裸 `<button>`，分布在：

- `src/features/feed/FeedItemCardFooter.vue`（feed 卡 like）
- `src/features/detail/PostReplyDock.vue`（详情 dock like + save）
- `src/features/auth/AuthInterestPicker.vue`（onboarding interest chip）
- `src/shell/ShellChrome.vue`（chrome filter chip）
- `src/features/admin/AdminQueueList.vue`（queue 状态 filter，不是 LianButton 那一行，是它隔壁的 `<button>`）
- `src/features/admin/AdminView.vue`（实名审核 status filter）

这 6 个文件都已被 `tests/ui/aria-pressed-coverage.test.ts` 的 `TOGGLE_BUTTON_WHITELIST` 锁住，state="pressed" 即便加了，**第一波 replace PR 里也用不上**——它们不是 LianButton 调用方。

**含义**：

- 任务描述里高 ROI 类别 (b)"toggle 但无 aria-pressed"在当前 LianButton 范围内是**空集**。
- 真正需要把 LianButton 普及到 toggle 用法的，是另一个尺度更大的迁移：把 PostReplyDock / FeedItemCardFooter 的裸 button 收编进 LianButton。这件事不在 LianButton state PR 范围里——单独立项。
- replace PR 阶段的 `state="pressed"` 暂时留作扩展位，**没有 caller**。这个事实需要在 PR 描述里写清楚，否则 reviewer 会以为漏改。

---

## 7. 建议替换分批

按 ROI、风险面、是否需要 stack 依赖排序：

### 第一批（5-6 个最高 ROI · 纯 (a) 类 disabled→loading 收敛）

不依赖 success 态白名单决策，可以单独发 PR。

- [ ] `RunnerOrderCard.vue:120,131,142,153`（4 个 transition）
- [ ] `VerificationView.vue:200`
- [ ] `AdminView.vue:514`（reveal realname）

> 触及 3 个 SFC，行号 6 处。这一批纯把"disabled+伪 loading label"折成 `state="loading"`，无 success/error 依赖，最早能合。

### 第二批（混合 disabled+loading caller · 优先级合规）

这一批的关键是验证 LianButton 新原语对 loading > disabled > default 的优先级语义。

- [ ] `PublishActionBar.vue:19,26`
- [ ] `ProfileInviteCodePanel.vue:41`
- [ ] `ProfileAvatarEditor.vue:103,106`
- [ ] `AdminUserActionPanel.vue:65`
- [ ] `ShareCardSheet.vue:177`

> 触及 5 个 SFC，行号 7 处。重点 review 优先级 + caller 端 `computed` 的写法。

### 第三批（success / error 瞬态 · 依赖 §5 决策）

仅在 `is-success` 加入白名单后才能落，否则会被结构测试卡。

- [ ] `PostReportBlock.vue:70`
- [ ] `PublishActionBar.vue:26`（同时被第二批触及，二选一在哪个 PR 里完成 success 闪现）
- [ ] `ChannelComposer.vue:75`
- [ ] `AdminView.vue:559,566`（approve / reject）
- [ ] `ProfileAvatarEditor.vue:106`（同上，在第二批已触及——success 闪现可作为后续 polish）

> 触及 4 个 SFC，行号 6 处。**前置依赖**：mw#834 follow-up `is-success` 词表 PR 必须先合。

### 不做（17 个标签 / 13 个文件）

§3 列出的 default-only callsite 全部跳过——他们不需要任何代码改动。

---

## 附录 A：搜索命令复现

```sh
# 全部 import + tag 用法
rg -n "LianButton" src/

# 计数
rg -c "<LianButton" src/   # 40 occurrences across 22 files

# 白名单 / 词表
cat docs/frontend/state-vocabulary.md
cat tests/structure/state-class-vocabulary.test.ts
cat tests/structure/state-class-grandfathered.json

# aria-pressed 白名单 (确认 toggle 不在 LianButton 范围)
cat tests/ui/aria-pressed-coverage.test.ts
```

## 附录 B：未触碰的高冲突文件

按用户偏好，本审计**未读取**：

- `public/app.js`
- `src/server/{feed,post,api-router}-service.js`
- `data/post-metadata.json`

LianButton 替换不会触及它们——CTA 按钮全在 `src/features/**/*.vue`。
