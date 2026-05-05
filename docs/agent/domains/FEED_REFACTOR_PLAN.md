# Feed Refactor Plan

> Generated: 2026-05-02
> Principle: code is truth, plan is plan, nothing here is implemented yet.

This document outlines a phased approach to refactoring the LIAN recommendation feed. Each phase is designed to be independently shippable and reversible.

Baseline: `docs/agent/01_PROJECT_FACT_BASELINE.md`
Audit: `outputs/feed-post-observability-report.md`

---

## 1. 当前 Feed 真实状态

### 核心文件

- `src/server/feed-service.js` — 787 行，推荐核心
- `data/feed-rules.json` — 127 行，配置
- `data/post-metadata.json` — 2,314 行，元数据

### 推荐模式

| 模式 | 触发条件 | 评分逻辑 |
|------|---------|----------|
| curated + ranked | 推荐 tab，有 curatedPages | 前 3 slots 用 curated，rest 用 scoreItem() |
| scored | 推荐 tab，无 curatedPages | 纯 scoreItem() 排序 |
| moment | 此刻 tab，momentTab flag 开 | momentScoreItem() 独立评分 |
| category | 其他 tab | 按 tag 过滤，按时间排序 |

### 评分信号

`scoreItem()` 组成（推荐流）：

```
legacyScore (pinned + tagWeight + recency + cover + priority)
+ tagScore (vibeWeights + sceneWeights)
+ quality * 40
+ imageImpact * 24
+ risk * (-220)
+ official * (-35) [仅 home]
+ contentTypeWeight
+ missingLocationAreaPenalty (-26)
+ readPenalty (-60)
```

`momentScoreItem()` 组成（此刻流）：

```
recency (halfLife 48h, base 90)
+ quality * 35
+ imageImpact * 30
+ replies * 4
+ priority
+ vibe (hardcoded list: 真实/在地/有网感/生活感/现场感/实用/路况/饭点/夜宵/傍晚/夜间 each +12)
+ momentContentTypeWeight
+ momentMissingLocationAreaPenalty
```

### 数据流

```
NodeBB /api/recent → fetchNodebbTopicIndex()
                    → normalizeTopic(topic, detail, metadata)
                    → isFeedEligible() 过滤
                    → scoreItem() / momentScoreItem() 评分
                    → diversifyItems() 多样性
                    → personalizeBatch() 已读降权
                    → sendJson()
```

---

## 2. 当前帖子资产问题

### 量化数据

| 指标 | 值 | 影响 |
|------|-----|------|
| 123 条总帖子 | — | 推荐池较小 |
| 82 条缺 contentType (67%) | 使用默认 `general` | 被 -32 权重压制 |
| 85 条缺 locationArea (69%) | 空字符串 | 被 -26 penalty 打分 |
| 91 条缺 tags (74%) | 空数组 | 无法被 tag 匹配的 tab 筛选 |
| 32 条 "推荐测试" 标签 | 测试数据 | 污染推荐池 |
| 99 条无图片 (80.5%) | 无 cover | 视觉吸引力低 |

### 根因

- `post-metadata.json` 是手动填写的，早期帖子（tid < 80）大部分没有元数据
- 测试内容与真实内容混在同一个 NodeBB 分类中
- 没有自动化元数据补全流程

---

## 3. 当前 feed-rules 问题

| 问题 | 严重程度 | 位置 |
|------|---------|------|
| `campus_activity` 在 momentWeights 中缺失 | 低 | `scoring.momentContentTypeWeights` |
| `deadline` contentType 未在任何权重中定义 | 低 | `scoring.contentTypeWeights` |
| curated 内容 4 天未更新 | 中 | `feedEditions.generatedAt` |
| tagWeights 与 tab 是 1:1 映射，扩展性差 | 低 | `tagWeights` |

---

## 4. 当前 feed-service.js 风险点

### 4.1 函数职责过重

`handleFeed()` 函数（`feed-service.js:487-599`）承担了：
- 请求解析
- 规则加载
- 模式判断（moment / curated / scored / category）
- 数据获取
- 评分
- 多样性
- 详情补全
- 响应构建

单一函数 112 行，4 种推荐模式混在一个 if-else 链中。

### 4.2 momentScoreItem 硬编码

`feed-service.js:425-426` 硬编码了 vibe 标签列表：

```javascript
const momentVibe = ["真实", "在地", "有网感", "生活感", "现场感", "实用", "路况", "饭点", "夜宵", "傍晚", "夜间"];
```

与 `scoring.vibeWeights` 分离，维护者可能不知道有两套 vibe 逻辑。

### 4.3 评分权重分散

权重来源有 3 处：
1. `legacyScoreItem()` 中的硬编码常量（`feed-service.js:249-259`）
2. `scoringRules()` 中的默认值（`feed-service.js:222-238`）
3. `feed-rules.json` 中的覆盖值

修改权重需要同时检查这 3 处。

### 4.4 多样性逻辑与评分分离

`diversifyItems()` 在评分之后运行，只做后过滤。如果评分阶段就能加入多样性惩罚，结果会更可控。当前实现是合理的简化，但限制了多样性策略的灵活性。

### 4.5 无测试覆盖

整个 `feed-service.js` 没有单元测试。任何评分变更只能通过生产快照对比验证。

---

## 5. Phase 1：不改变推荐结果的整理

### 目标

在不改变推荐结果的前提下，为后续重构做准备。

### Task 1.1：momentWeights 补全

- **目标**：在 `data/feed-rules.json` 的 `momentContentTypeWeights` 中补充 `campus_activity`
- **修改文件**：`data/feed-rules.json`
- **验证**：`node scripts/audit-feed-rules.js` 无 warning，`node scripts/snapshot-feed.js` before/after 对比无变化（momentWeight 不影响推荐 tab）
- **回滚**：删除新增的 key

### Task 1.2：curated 配置有效性检查

- **目标**：确认 pinned tids [86-92] 和 curated page [99, 92, 91] 在 NodeBB 中仍然存在
- **修改文件**：无（只读检查），如发现 dead tid 则更新 `data/feed-rules.json`
- **验证**：`node scripts/check-dead-tids.js`（需新建此脚本）
- **回滚**：恢复原 pinned/curated 列表

### Task 1.3：dead tid 检测脚本

- **目标**：新增 `scripts/check-dead-tids.js`，对比 metadata 中的 tid 与 NodeBB 实际 topic
- **修改文件**：`scripts/check-dead-tids.js`（新建）
- **验证**：`node --check scripts/check-dead-tids.js`
- **回滚**：删除脚本

### Task 1.4：元数据补全（活跃帖子）

- **目标**：为 tid > 80 的帖子补全 contentType、locationArea、tags
- **修改文件**：`data/post-metadata.json`（逐条 PATCH via admin API 或脚本）
- **验证**：`node scripts/audit-post-metadata.js` 缺失率下降，`node scripts/snapshot-feed.js` before/after 对比
- **回滚**：恢复 `data/post-metadata.json` 备份

### Task 1.5：测试数据标记

- **目标**：为 "推荐测试"、"系统测试" 标签的帖子设置 `distribution: ["detailOnly"]` 或 `visibility: "private"`
- **修改文件**：`data/post-metadata.json`（逐条）
- **验证**：推荐流中不再出现测试帖子
- **回滚**：恢复原 distribution 值

### Phase 1 预计修改文件

- `data/feed-rules.json`（1-2 处小改动）
- `data/post-metadata.json`（逐条 PATCH，不批量覆盖）
- `scripts/check-dead-tids.js`（新建）

### Phase 1 验证方式

```bash
node scripts/audit-post-metadata.js
node scripts/audit-feed-rules.js
node scripts/validate-post-metadata.js
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
```

---

## 6. Phase 2：低风险函数拆分

### 目标

将 `feed-service.js` 中的职责拆分为独立模块，不改变任何评分结果。

### Task 2.1：提取评分模块

- **目标**：将 `scoreItem()`、`momentScoreItem()`、`legacyScoreItem()`、`scoreBreakdown()` 提取到 `src/server/feed-scoring.js`
- **修改文件**：`src/server/feed-scoring.js`（新建），`src/server/feed-service.js`（改为 import）
- **验证**：`node --check`，快照对比结果完全一致
- **回滚**：恢复 `feed-service.js` 中的内联函数

### Task 2.2：提取多样性模块

- **目标**：将 `diversifyItems()`、`exceedsDiversityLimits()`、`addDiversityCounters()` 提取到 `src/server/feed-diversity.js`
- **修改文件**：`src/server/feed-diversity.js`（新建），`src/server/feed-service.js`（改为 import）
- **验证**：同上
- **回滚**：恢复内联函数

### Task 2.3：提取元数据规范化模块

- **目标**：将 `normalizeTopic()`、`normalizePostMetadata()` 提取到 `src/server/feed-normalize.js`
- **修改文件**：`src/server/feed-normalize.js`（新建），`src/server/feed-service.js`（改为 import）
- **验证**：同上
- **回滚**：恢复内联函数

### Task 2.4：提取 eligibility 模块

- **目标**：将 `isFeedEligible()`、`feedFilterReason()` 提取到 `src/server/feed-eligibility.js`
- **修改文件**：`src/server/feed-eligibility.js`（新建），`src/server/feed-service.js`（改为 import）
- **验证**：同上
- **回滚**：恢复内联函数

### Phase 2 预计修改文件

- `src/server/feed-service.js`（import 替换内联函数）
- `src/server/feed-scoring.js`（新建）
- `src/server/feed-diversity.js`（新建）
- `src/server/feed-normalize.js`（新建）
- `src/server/feed-eligibility.js`（新建）

### Phase 2 验证方式

```bash
node --check src/server/feed-service.js
node --check src/server/feed-scoring.js
node --check src/server/feed-diversity.js
node --check src/server/feed-normalize.js
node --check src/server/feed-eligibility.js
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
```

快照对比必须显示零变化。

### Phase 2 风险

- `feed-service.js` 是高冲突文件，拆分期间其他 Agent 线程不能同时修改
- 需要在拆分前锁定该文件
- 每个 Task 独立可验证，可以逐个推进

---

## 7. Phase 3：产品级推荐流升级

### 前置条件

- Phase 1 完成（元数据补全、测试数据清理）
- Phase 2 完成（函数拆分）
- 有 before/after 快照基线

### Task 3.1：momentScoreItem vibe 外部化

- **目标**：将硬编码的 momentVibe 列表改为从 `feed-rules.json` 的 `scoring.momentVibeTags` 读取
- **修改文件**：`src/server/feed-scoring.js`（或 `feed-service.js`），`data/feed-rules.json`
- **验证**：快照对比 + 新增 momentVibeTags 配置后结果一致
- **回滚**：恢复硬编码列表

### Task 3.2：评分权重统一

- **目标**：将 `legacyScoreItem()` 中的硬编码常量移入 `feed-rules.json` 的 `scoring` 配置
- **修改文件**：`src/server/feed-scoring.js`，`data/feed-rules.json`
- **验证**：快照对比零变化
- **回滚**：恢复硬编码常量

### Task 3.3：dead content 清理

- **目标**：自动检测并标记 NodeBB 中已删除但 metadata 中仍存在的 tid
- **修改文件**：`scripts/cleanup-dead-metadata.js`（新建），可能更新 `data/post-metadata.json`
- **验证**：`node scripts/audit-post-metadata.js` 显示 dead tid 已清理
- **回滚**：恢复 `post-metadata.json` 备份

### Task 3.4：moment 独立配置

- **目标**：将此刻流的配置从 `feed-rules.json` 中独立出来，减少与推荐流配置的耦合
- **修改文件**：`data/feed-rules.json`（结构调整），`src/server/feed-service.js`
- **验证**：快照对比零变化
- **回滚**：恢复原配置结构

### Task 3.5：评分单元测试

- **目标**：为 `scoreItem()` 和 `momentScoreItem()` 添加单元测试
- **修改文件**：`tests/feed-scoring.test.js`（新建）
- **验证**：测试通过，覆盖主要评分路径
- **回滚**：删除测试文件

### Phase 3 预计修改文件

- `src/server/feed-scoring.js`（评分逻辑）
- `data/feed-rules.json`（配置结构）
- `scripts/cleanup-dead-metadata.js`（新建）
- `tests/feed-scoring.test.js`（新建）

### Phase 3 验证方式

```bash
node --check src/server/feed-scoring.js
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
node tests/feed-scoring.test.js  # needs verification: 是否有 test runner
```

---

## 8. 每阶段预计修改文件

| Phase | 修改文件 | 新建文件 | 删除文件 |
|-------|---------|---------|---------|
| Phase 1 | `data/feed-rules.json`, `data/post-metadata.json` | `scripts/check-dead-tids.js` | 无 |
| Phase 2 | `src/server/feed-service.js` | 4 个 feed-*.js 模块 | 无 |
| Phase 3 | `src/server/feed-scoring.js`, `data/feed-rules.json` | `scripts/cleanup-dead-metadata.js`, `tests/feed-scoring.test.js` | 无 |

---

## 9. 每阶段验证方式

### Phase 1

```bash
node scripts/audit-post-metadata.js
node scripts/audit-feed-rules.js
node scripts/validate-post-metadata.js
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
```

### Phase 2

```bash
node --check server.js
Get-ChildItem src/server/*.js | ForEach-Object { node --check $_.FullName }
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
# 快照对比必须零变化
```

### Phase 3

```bash
node --check server.js
Get-ChildItem src/server/*.js | ForEach-Object { node --check $_.FullName }
node scripts/snapshot-feed.js --base-url http://localhost:4100
node scripts/diff-feed-snapshots.js <before.md> <after.md>
node scripts/audit-feed-rules.js
```

---

## 10. 回滚方案

### Phase 1 回滚

- `data/feed-rules.json`：恢复备份（在修改前备份到 `outputs/`）
- `data/post-metadata.json`：恢复备份
- `scripts/check-dead-tids.js`：删除脚本

### Phase 2 回滚

- 恢复 `src/server/feed-service.js` 到拆分前版本
- 删除新建的 4 个模块文件
- 用快照对比确认回滚后结果一致

### Phase 3 回滚

- 恢复 `src/server/feed-scoring.js` 和 `data/feed-rules.json`
- 删除新建脚本和测试
- 用快照对比确认

---

## 11. 哪些任务适合 Codex 做

| 任务 | 原因 |
|------|------|
| dead tid 检测脚本 | 纯只读脚本，逻辑明确 |
| 元数据补全脚本 | 可以批量生成 PATCH 建议，人工确认后执行 |
| 函数提取（Phase 2） | 纯重构，不改变逻辑，快照对比可验证 |
| momentVibe 外部化 | 小改动，快照可验证 |
| 评分单元测试 | 新建文件，不影响现有代码 |
| 快照对比运行 | 只读脚本 |

---

## 12. 哪些任务必须人工确认

| 任务 | 原因 |
|------|------|
| 测试数据标记 | 需要确认哪些是测试数据，哪些是真实内容 |
| curated 配置更新 | 需要运营判断哪些帖子应该 curated |
| 权重调整 | 影响所有用户看到的内容，需要产品判断 |
| momentVibeTags 配置值 | 需要产品判断哪些标签应该在"此刻"流中加权 |
| 元数据补全的 contentType 值 | 需要判断每条帖子的真实类型 |
| Phase 3 整体方向 | 需要确认重构优先级（评分升级 vs 结构优化） |
