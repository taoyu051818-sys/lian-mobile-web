# Handoff: ai-publish-polish

Date: 2026-05-02

## Summary

AI 发布流程打磨：多图支持、draft 保存不阻塞发布、JSONL 清理工具。

## Files changed

| File | Change |
|---|---|
| `src/server/ai-light-publish.js` | `normalizeAiPostPayload` 支持 `imageUrls` 数组；draft/record 记录 `imageUrls`；publish 传 `imageUrls` 给 NodeBB；warmup 所有图片 |
| `public/app-ai-publish.js` | 状态 `imageUrl` → `imageUrls` 数组；多图上传+移除；`currentAiPublishPayload` 传 `imageUrls`；draft 保存改为 fire-and-forget |
| `public/app.js` | 事件委托：文件输入传所有文件；`data-remove-ai-image` 处理 |
| `public/styles.css` | `.ai-publish-preview`、`.ai-image-thumb`、`.ai-image-remove`、`.ai-add-more` 样式 |
| `scripts/archive-ai-records.js` | 新增。count/list/archive 三个命令，支持 drafts/records/all |

## Behavior changes

### 多图
- 上传时 `<input multiple>`，可选多张图片
- 上传后显示缩略图列表，每张有移除按钮
- 支持"继续添加"更多图片
- AI 预览仍基于第一张图片
- 发布时所有图片传给 NodeBB，`buildTopicHtml` 渲染所有 `<img>`

### Draft 保存
- `saveAiDraftSilently()` 改为 fire-and-forget（不 await）
- 失败时静默，不显示错误信息，不阻塞预览或发布

### JSONL 工具
- `node scripts/archive-ai-records.js count` — 按 status 统计
- `node scripts/archive-ai-records.js list [drafts|records] [N]` — 列出最新 N 条
- `node scripts/archive-ai-records.js archive [drafts|records|all]` — 归档到 `data/archive/` 并清空原文件

## Validation

```bash
node --check src/server/ai-light-publish.js
node --check src/server/ai-post-preview.js
node --check public/app-ai-publish.js
node --check public/app-utils.js
node --check scripts/archive-ai-records.js
node scripts/validate-post-metadata.js
```

全部通过。

## What was intentionally not done

- `ai-post-preview.js` 未修改 — 预览仍用第一张图，多图预览不在本轮
- 未修改 `post-service.js` — 后端已支持 `imageUrls`，无需改动
- 归档工具不自动运行，需手动触发

## Risks

- 多图上传增加耗时和内存压力
- AI 预览只分析第一张图，其余图的内容不会影响标题/标签生成

## Rollback

- 回退 `ai-light-publish.js`、`app-ai-publish.js`、`app.js`、`styles.css` 的改动
- 删除 `scripts/archive-ai-records.js`
- 单图流程不受影响（`imageUrls` 数组兼容单元素）

## Next suggested task

Task D: Feed Ops Snapshot Diff (`docs/agent/tasks/feed-ops-snapshot-diff.md`)
