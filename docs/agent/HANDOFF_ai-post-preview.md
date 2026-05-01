# Handoff: ai-post-preview

## Changed Files

- `server.js`
- `.env.example`
- `docs/agent/AI_POST_PREVIEW.md`
- `docs/agent/HANDOFF_ai-post-preview.md`

## New API

`POST /api/ai/post-preview`

生成可编辑帖子草稿预览。它不发布帖子、不调用 NodeBB 发帖接口、不写入 `data/post-metadata.json`。

## Test Commands

Syntax and metadata checks:

```powershell
node --check server.js
node scripts\validate-post-metadata.js
```

Mock request:

```powershell
$env:AI_POST_PREVIEW_MODE="mock"; node server.js
```

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/api/ai/post-preview" -ContentType "application/json" -Body (@{
  imageUrl = "https://example.com/image.jpg"
  template = "campus_moment"
  userText = "刚刚路过看到的"
  locationHint = "大墩村"
  visibilityHint = "public"
} | ConvertTo-Json)
```

MiMo request:

```powershell
$env:AI_POST_PREVIEW_MODE="mimo"; $env:MIMO_API_KEY="replace-with-key"; node server.js
```

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/api/ai/post-preview" -ContentType "application/json" -Body (@{
  imageUrl = "https://example.com/image.jpg"
  template = "place_memory"
  userText = "等车的时候看到的"
  locationHint = "摆渡车站点"
  visibilityHint = "public"
} | ConvertTo-Json)
```

Feed smoke checks:

```powershell
Invoke-RestMethod "http://localhost:4100/api/feed"
Invoke-RestMethod "http://localhost:4100/api/feed-debug?token=$env:ADMIN_TOKEN"
```

## Mock Example

Mock mode returns:

```json
{
  "ok": true,
  "mode": "mock",
  "draft": {
    "title": "大墩村的一刻",
    "body": "刚刚路过看到的。这是一条可编辑的校园轻投稿草稿，发布前可以继续补充时间、地点和细节。",
    "tags": ["校园随手拍", "黎安记忆", "生活感"],
    "metadata": {
      "contentType": "campus_moment",
      "vibeTags": ["真实", "在地", "生活感"],
      "sceneTags": ["大墩村"],
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

## MiMo Example

MiMo mode returns the same normalized shape with `"mode": "mimo"` when the API call succeeds. If MiMo is unavailable or returns invalid JSON, the endpoint returns mock fallback with:

```json
{
  "ok": true,
  "mode": "mock",
  "fallbackReason": "mimo_unavailable",
  "needsHumanReview": true
}
```

## Environment Variables

- `AI_POST_PREVIEW_MODE=mock | mimo`
- `MIMO_API_KEY`
- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5`

Without `MIMO_API_KEY`, the endpoint automatically uses mock mode.

## Frontend Integration Notes

- Call `/api/ai/post-preview` after image upload or when the user enters a public image URL.
- Prefer sending Cloudinary/public `imageUrl`.
- Use `imageBase64` only for temporary preview and keep it small.
- Render `draft.title`, `draft.body`, `draft.tags`, `draft.metadata`, `locationSuggestions`, and `riskFlags` as editable fields or suggestions.
- Do not publish automatically after receiving the preview.
- Do not write preview metadata directly to `post-metadata.json`.
- Require explicit user confirmation before any future `/api/posts` call.
- Treat `riskFlags` as user-facing warnings, not as automatic allow/deny decisions.
- Treat `locationId` as optional. The backend currently clears unknown AI-provided IDs.

## Risks And Rollback

Risks:

- MiMo may return malformed JSON; backend normalizes and falls back to mock.
- Vision output may infer a wrong place; unknown `locationId` is cleared and location suggestions require user confirmation.
- Base64 requests can be large; backend has route-specific body and base64 length limits.

Rollback:

- Remove the `/api/ai/post-preview` route and AI post preview helper block from `server.js`.
- Remove MiMo env entries from `.env.example`.
- Delete `docs/agent/AI_POST_PREVIEW.md` and this handoff file.

No runtime data files are written by this feature, so rollback does not require data migration.
