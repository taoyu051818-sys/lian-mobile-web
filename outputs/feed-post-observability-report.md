# Feed & Post Observability Report

> Generated: 2026-05-02
> Principle: no secrets, no business code changes, read-only audit

---

## 1. 当前帖子资产摘要

| 指标 | 值 |
|------|-----|
| tid 总数 | 123 |
| 有 imageUrls | 24 (19.5%) |
| 无 imageUrls | 99 (80.5%) |
| 有 contentType | 41 (33.3%) |
| 缺少 contentType | 82 (66.7%) |
| 有 locationArea | 38 (30.9%) |
| 缺少 locationArea | 85 (69.1%) |
| 有 tags | 32 (26.0%) |
| 缺少 tags | 91 (74.0%) |
| 缺少 title 和 summary | 123 (100%) |

> 注：title/summary 存储在 NodeBB 侧，不在 post-metadata.json 中。100% 缺失是正常的元数据设计。

### contentType 分布（41 条有值）

| contentType | 数量 |
|-------------|------|
| place_memory | 7 |
| activity_archive | 6 |
| food | 6 |
| campus_moment | 4 |
| map_tip | 3 |
| activity_scene | 3 |
| library_moment | 2 |
| general | 2 |
| campus_activity | 1 |
| campus_tip | 1 |
| campus_life | 1 |
| learning_scene | 1 |
| deadline | 1 |
| signup | 1 |
| club_archive | 1 |
| official_recap | 1 |

### locationArea 分布（38 条有值，Top 10）

| locationArea | 数量 |
|--------------|------|
| 试验区社团 | 5 |
| 大墩村 | 5 |
| 试验区 | 4 |
| 运动区 | 2 |
| 图书馆 | 2 |
| 其他 20 个地点 | 各 1 |

### tags 分布（Top 10）

| tag | 数量 |
|-----|------|
| 推荐测试 | 32 |
| 校园随手拍 | 8 |
| 真实动态 | 7 |
| 黎安记忆 | 6 |
| 地图探索 | 6 |
| 校园活动 | 5 |
| 有网感 | 4 |
| 大墩村 | 3 |
| 系统测试 | 3 |
| 小动物 | 2 |

---

## 2. 当前内容分布问题

### 问题 1：大量帖子缺少元数据

82 条（67%）帖子没有 contentType，85 条（69%）没有 locationArea。这些帖子在推荐流中会使用默认值 `general`，被 `contentTypeWeights` 中的 `-32` 权重压制。

**影响**：推荐流质量依赖元数据覆盖率。当前约 2/3 的帖子以低权重参与推荐。

### 问题 2："推荐测试" 标签污染

`primaryTag` 为 "推荐测试" 的帖子有 32 条，占所有有标签帖子的绝大部分。这些是测试数据，会干扰标签维度的推荐质量。

**影响**：diversity 限制 `maxSamePrimaryTag: 4` 会限制其影响，但它们仍占据推荐池。

### 问题 3：图片覆盖率低

仅 24 条（19.5%）有图片。无图内容在 feed 中没有 cover 图，视觉吸引力低。

**影响**：`imageImpactScore` 权重 24 对无图内容无效，导致这些帖子在评分中处于劣势。

### 问题 4：测试内容与真实内容混合

`tags` 中包含 "系统测试"（3条）、"推荐测试"（32条）、"过期资料"（2条）等测试标签。这些内容与真实校园内容混在同一个推荐池中。

---

## 3. 当前推荐规则摘要

### Tab 结构

9 个 tab：此刻、推荐、校园活动、报名机会、图书馆学习、周边玩乐、安全通知、试验区社团、美食菜单

### 推荐模式

- **推荐 tab**：`curated-entry-plus-ranked-rest`，每页 3 个 curated slot + ranked rest
- **此刻 tab**：独立 moment 评分，halfLife 48h
- **其他 tab**：按 tag 精确匹配

### Feature Flags

全部开启：`eligibility`、`enhancedScoring`、`diversity`、`momentTab`

### Curated 配置

- Page 1: [99, 92, 91]
- Pinned: [92, 91, 90, 89, 88, 87, 86]
- `curatedSlotsPerPage`: 3
- `rankedRestOnCuratedPages`: true

### 评分权重

| 信号 | 推荐流权重 | 此刻流权重 |
|------|-----------|-----------|
| campus_moment | +180 | +46 |
| campus_tip | +180 | +44 |
| food | +76 | +38 |
| place_memory | +70 | +40 |
| general | -32 | -24 |
| activity_archive | -180 | -20 |

### Diversity

`maxSameContentType: 2`, `maxSameLocationArea: 2`, `maxSamePrimaryTag: 4`

---

## 4. 当前规则风险

### 风险 1：`campus_activity` 在 momentWeights 中缺失

`contentTypeWeights` 中有 `campus_activity: 42`，但 `momentContentTypeWeights` 中没有。此刻流中 `campus_activity` 类型帖子评分权重为 0。

**建议**：在 `momentContentTypeWeights` 中补充 `campus_activity` 权重。

### 风险 2：curated 内容过期

`feedEditions.generatedAt` 为 `2026-04-28`，已过期约 4 天。curated page 引用的 tids [99, 92, 91] 和 pinned tids [86-92] 可能已不全在活跃推荐池中。

**建议**：定期更新 curated 配置，或设置自动过期机制。

### 风险 3：tagWeights 与 tab 不完全对齐

7 个 tagWeights 覆盖了 7 个分类 tab，但 "此刻" 和 "推荐" 没有 tagWeight。这是设计意图（它们使用不同评分），但维护者需要理解这个区别。

### 风险 4：`deadline` contentType 未在权重中定义

`post-metadata.json` 中存在 `deadline` contentType，但 `contentTypeWeights` 和 `momentContentTypeWeights` 都没有定义它的权重。这类帖子默认权重为 0。

---

## 5. 当前推荐流重构前置条件

### 必须先完成

1. **元数据补全**：至少为活跃帖子（tid > 80）补全 contentType、locationArea、tags
2. **测试数据清理**：标记或隔离 "推荐测试"、"系统测试" 标签的帖子
3. **curated 配置更新**：确认 pinned tids 和 curated page tids 仍然有效
4. **快照基线**：在重构前运行一次新快照作为 before baseline

### 建议先完成

1. **momentWeights 补全**：补充 `campus_activity` 到 `momentContentTypeWeights`
2. **contentType 权重文档化**：记录每个 contentType 权重的设计意图
3. **dead tids 检测脚本**：识别 NodeBB 中已不存在但仍在 metadata 中的 tid

---

## 6. 不建议立即动的文件

| 文件 | 原因 |
|------|------|
| `src/server/feed-service.js` | 787 行推荐核心，改评分影响全站，需 before/after snapshot |
| `public/app.js` | 2151 行前端单文件，无自动化测试 |
| `data/post-metadata.json` | 2314 行，并发写入风险，多处读取 |
| `src/server/post-service.js` | 两条发布路径的统一入口 |
| `src/server/api-router.js` | 路由链，改错全站挂 |

---

## 7. 推荐下一步低风险任务

### 优先级 1：momentWeights 补全

- **目标**：在 `data/feed-rules.json` 的 `momentContentTypeWeights` 中补充 `campus_activity`
- **修改文件**：`data/feed-rules.json`
- **风险**：低，只加一个权重值
- **验证**：运行 `node scripts/audit-feed-rules.js` 确认无 warning

### 优先级 2：curated 配置更新

- **目标**：确认 pinned tids 86-92 和 curated page [99, 92, 91] 在 NodeBB 中仍然有效
- **修改文件**：`data/feed-rules.json`（如需调整）
- **风险**：低，只改 curated 列表
- **验证**：运行 `node scripts/snapshot-feed.js` 对比前后快照

### 优先级 3：dead tid 检测脚本

- **目标**：新增 `scripts/check-dead-tids.js`，对比 `post-metadata.json` 中的 tid 与 NodeBB 实际 topic 列表
- **修改文件**：`scripts/check-dead-tids.js`（新建）
- **风险**：低，只读脚本
- **验证**：`node --check scripts/check-dead-tids.js`

### 优先级 4：元数据补全

- **目标**：为 tid > 80 的活跃帖子补全 contentType、locationArea、tags
- **修改文件**：`data/post-metadata.json`（逐条 PATCH）
- **风险**：中，需逐条确认，不能批量覆盖
- **验证**：`node scripts/audit-post-metadata.js` + `node scripts/validate-post-metadata.js`

---

## 8. 需要人工确认的问题

1. **测试数据处理**：32 条 "推荐测试" 帖子是否应该从推荐池中排除？可以通过 distribution 设为 `["detailOnly"]` 或添加特定 tag 过滤规则。

2. **pinned tids 有效性**：pinned tids [86-92] 是否仍在 NodeBB 中存在且内容有效？需要实际查询确认。

3. **curated page 策略**：curated page 只有 1 页 [99, 92, 91]。是否需要更多 curated 页，还是当前单页足够？

4. **momentContentTypeWeights 缺失**：`campus_activity` 是否需要加入 momentWeights？如果加入，权重建议多少？（推荐流是 42，moment 流同类帖子一般约 1/3-1/2）

5. **`deadline` contentType**：这个 contentType 是设计意图还是遗留？是否需要加入权重体系？

6. **元数据补全优先级**：82 条缺 contentType 的帖子中，哪些是活跃内容需要优先补全，哪些是历史归档可以忽略？

7. **推荐流重构方向**：下一阶段重构应该先做函数拆分（低风险）还是先做评分逻辑升级（中风险）？
