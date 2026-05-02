# AI Post Preview

## Purpose

AI post preview provides draft assistance for lightweight campus posting. It reduces friction but does not publish content.

This is the current workspace summary for AI post preview and light publish flow.

## Current Status

Backend implementation is complete and real integration has passed.

Endpoint:

```text
POST /api/ai/post-preview
```

Implemented components:

- `mockPostPreview()`
- `callMimoVisionPostPreview()`
- MiMo adapter
- prompt construction
- JSON parsing
- response normalization
- `imageBase64` length limits

## Modes

Mock mode is used when:

- `AI_POST_PREVIEW_MODE=mock`
- `MIMO_API_KEY` is absent

MiMo mode is used when:

- `AI_POST_PREVIEW_MODE` allows MiMo
- `MIMO_API_KEY` is available
- MiMo call succeeds

Successful MiMo responses return:

```json
{
  "mode": "mimo"
}
```

## Environment

`.env.example` documents:

```text
AI_POST_PREVIEW_MODE=mock
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

Real `MIMO_API_KEY` values must only live in `.env` or server environment variables and must never be committed.

## API Input

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
- `imageBase64`: 备用输入，服务端限制长度（1.5MB），避免大请求压垮服务。
- `template`: 支持 `campus_moment`, `food`, `campus_tip`, `place_memory`, `library_moment`, `activity_scene`。
- `userText`: 用户补充文字，最多 300 字。
- `locationHint`: 用户提供的地点提示，最多 80 字。
- `visibilityHint`: 支持 `public`, `campus`, `school`, `linkOnly`, `private`。

图片不是必填。没有图片时也可以纯文本生成，但返回 confidence 会更低。

## API Output

```json
{
  "ok": true,
  "mode": "mock",
  "draft": {
    "title": "大墩村的一刻",
    "body": "刚刚路过看到的。这是一条可编辑的校园轻投稿草稿。",
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

MiMo 模式返回相同结构，`mode` 为 `"mimo"`。MiMo 不可用时自动降级为 mock，返回 `"fallbackReason": "mimo_unavailable"`。

## MiMo Mode Details

- endpoint: `POST {MIMO_BASE_URL}/chat/completions`
- auth: `api-key: $MIMO_API_KEY`
- model: `$MIMO_MODEL`，默认 `mimo-v2.5`
- temperature: `0.3`
- max_completion_tokens: `2048`
- thinking: `{ "type": "disabled" }`

图片传入：`imageUrl` 传为 `image_url.url`；`imageBase64` 传为 data URL，如果请求中不是 data URL，服务端会补 `data:image/jpeg;base64,`。

模型被要求输出纯 JSON，服务端仍会做安全解析和 normalize。

## Allowed AI Outputs

AI may suggest:

- title（最多 40 字）
- editable body draft（最多 300 字）
- tags（最多 5 个）
- content type
- location suggestions
- time hints
- risk/privacy warnings
- LIAN metadata draft fields
- scores（0 到 1）

## Hard Boundaries

AI must not:

- automatically publish
- call NodeBB post creation
- write `data/post-metadata.json`
- change recommendation behavior
- change map behavior
- invent a trusted `locationId` without server-side known-place confirmation
- return `MIMO_API_KEY` to frontend or log it

## Validation Notes

Passed:

- mock mode
- MiMo mode
- Cloudinary image URL input
- normalized response shape

PowerShell Chinese may display as `???`. Verify with browser, curl, or a UTF-8 terminal before assuming the API returned mojibake.

## Rollback

- Remove `/api/ai/post-preview` route and AI post preview helpers from `ai-post-preview.js`.
- Remove `/api/ai/post-drafts` and `/api/ai/post-publish` routes and handlers from `ai-light-publish.js`.
- Remove MiMo env entries from `.env.example`.
- Runtime data files (`ai-post-drafts.jsonl`, `ai-post-records.jsonl`) can be kept or archived; they do not affect feed runtime.

## Related Files

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../tasks/ai-post-preview.md`
- `../handoffs/ai-post-preview.md`

## AI Light Publish Flow

Current follow-up thread adds the user-confirmed publish flow around the preview endpoint.

New APIs:

- `POST /api/ai/post-drafts`
- `POST /api/ai/post-publish`

The preview endpoint still does not publish by itself. After a preview/regenerate succeeds, the frontend silently saves a private draft through `/api/ai/post-drafts`, then shows editable fields, risk warnings, and location controls. Only the user clicking "发布到 LIAN" may call `/api/ai/post-publish`.

Silent draft saves append private records to:

```text
data/ai-post-drafts.jsonl
```

Confirmed publishes:

- create a NodeBB topic through the existing NodeBB topic creation helper;
- write the final metadata to `data/post-metadata.json`;
- append an analysis record to `data/ai-post-records.jsonl`.

Location is represented with `locationDraft` so Map v2 can replace the legacy picker later without changing the publish contract.

Current `locationDraft.mapVersion` is `legacy`. `locationId` remains empty unless a future trusted locations source confirms it.
