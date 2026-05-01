# AI Post Preview

## Goal

用户上传图片或提供图片 URL 后，生成可编辑帖子草稿。

## Current Scope

只做后端 API，不自动发布，不写 metadata，不改前端投稿流程。

## API

`POST /api/ai/post-preview`

## Input

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "imageBase64": "",
  "template": "campus_moment",
  "userText": "刚刚路过看到的",
  "locationHint": "大墩村",
  "visibilityHint": "public"
}
```

- `imageUrl`: 优先使用，适合 Cloudinary 或公网可访问图片。
- `imageBase64`: 备用输入，服务端限制长度，避免大请求压垮服务。
- `template`: 支持 `campus_moment`, `food`, `campus_tip`, `place_memory`, `library_moment`, `activity_scene`。
- `userText`: 用户补充文字。
- `locationHint`: 用户提供的地点提示。
- `visibilityHint`: 支持 `public`, `campus`, `school`, `linkOnly`, `private`。

图片不是必填。没有图片时也可以纯文本生成，但返回 confidence 会更低。

## Output

```json
{
  "ok": true,
  "mode": "mock",
  "draft": {
    "title": "校园里的一刻",
    "body": "这是一条可编辑的校园轻投稿草稿。",
    "tags": ["校园随手拍"],
    "metadata": {
      "contentType": "campus_moment",
      "vibeTags": ["真实", "在地"],
      "sceneTags": [],
      "locationId": "",
      "locationArea": "大墩村",
      "qualityScore": 0.66,
      "imageImpactScore": 0.72,
      "riskScore": 0.08,
      "officialScore": 0,
      "visibility": "public",
      "distribution": ["home", "search", "detail"],
      "keepAfterExpired": false
    }
  },
  "locationSuggestions": [
    {
      "locationId": "",
      "name": "大墩村",
      "confidence": 0.45,
      "reason": "来自用户提供的地点提示，需发布前确认。"
    }
  ],
  "riskFlags": [
    {
      "type": "privacy",
      "level": "warning",
      "message": "如果图片中有人脸、电话号码、车牌或宿舍门牌，请发布前确认是否需要打码。"
    }
  ],
  "confidence": 0.62,
  "needsHumanReview": false
}
```

## Environment Variables

- `AI_POST_PREVIEW_MODE=mock | mimo`: 设置为 `mock` 时强制使用 mock。留空或 `mimo` 时，如果有 `MIMO_API_KEY` 就调用 MiMo。
- `MIMO_API_KEY`: MiMo API key。不会返回给前端，也不要写入日志。
- `MIMO_BASE_URL`: 默认 `https://api.xiaomimimo.com/v1`。
- `MIMO_MODEL`: 默认 `mimo-v2.5`。

没有 `MIMO_API_KEY` 时自动使用 mock，不返回 500。

## Mock Mode

mock 模式用于本地开发和模型不可用兜底。它会基于 `template`, `userText`, `locationHint`, `visibilityHint` 返回结构完整的草稿，不调用外部 API。

## MiMo Mode

MiMo 使用 OpenAI-compatible chat completions：

- endpoint: `POST {MIMO_BASE_URL}/chat/completions`
- auth: `api-key: $MIMO_API_KEY`
- model: `$MIMO_MODEL`，默认 `mimo-v2.5`
- temperature: `0.3`
- max_completion_tokens: `2048`
- thinking: `{ "type": "disabled" }`

图片传入：

- `imageUrl` 传为 `image_url.url`
- `imageBase64` 传为 data URL；如果请求中不是 data URL，服务端会补 `data:image/jpeg;base64,`

模型被要求输出纯 JSON，服务端仍会做安全解析和 normalize。

## Safety Rules

- AI 只生成草稿。
- 用户必须确认和修改后，前端才能进入后续发布流程。
- 不自动发布。
- 不调用 NodeBB 发帖接口。
- 不自动评论。
- 不自动写入 `data/post-metadata.json`。
- 不修改推荐流、地图 UI 或权限系统。
- 不允许 AI 随便编 `locationId`；只有匹配当前服务端已知地点 ID 时才保留，否则置空。
- `imageBase64` 必须限制大小。
- 模型 JSON 必须安全解析和 normalize。
- `tags` 最多 5 个。
- `title` 最多 40 字，`body` 最多 300 字。
- scores 限制到 0 到 1。
- `visibility` 和 `distribution` 只允许白名单值。
- `riskFlags` 只提示风险，不自动审核通过或拒绝。
- 不把 `MIMO_API_KEY` 返回前端，也不要在日志里打印密钥。

## Rollback

回滚 `server.js` 中 AI post preview helpers 和 `/api/ai/post-preview` 路由，同时移除 `.env.example` 中的 MiMo 配置项即可。该接口不写数据文件，正常不会产生数据迁移成本。
