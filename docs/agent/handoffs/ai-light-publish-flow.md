# Handoff: AI Light Publish Flow

## Changed Files

- `server.js`
- `public/app.js`
- `public/styles.css`
- `docs/agent/domains/AI_POST_PREVIEW.md`
- `docs/agent/tasks/ai-post-preview.md`
- `docs/agent/handoffs/ai-light-publish-flow.md`

Runtime files created by use:

- `data/ai-post-drafts.jsonl`
- `data/ai-post-records.jsonl`

## New APIs

`POST /api/ai/post-drafts`

Saves a private AI light publish draft to `data/ai-post-drafts.jsonl`. It does not publish and does not write `post-metadata.json`.

`POST /api/ai/post-publish`

Publishes after explicit user confirmation. It creates a NodeBB topic, writes the final metadata for the returned `tid`, and appends a publish record to `data/ai-post-records.jsonl`.

## Frontend Flow

1. User taps `+`.
2. The publish sheet shows only image upload and a short AI explanation.
3. Image upload uses the existing `/api/upload/image` path.
4. The uploaded `imageUrl` is sent to `/api/ai/post-preview`.
5. The sheet shows legacy/manual location controls with a skip option.
6. The AI draft fields are editable: title, body, tags, location.
7. Actions: publish to LIAN, save draft, regenerate, cancel.

## NodeBB Reuse

The implementation extracts the existing topic creation path into `createNodebbTopicFromPayload()`. Both legacy `/api/posts` and AI `/api/ai/post-publish` use that helper, so the NodeBB client is not duplicated.

普通 `/api/posts` keeps the existing user-owned path: it calls `createNodebbTopicFromPayload(auth, payload)` without an explicit uid, so the helper resolves the current LIAN user's NodeBB uid through `ensureNodebbUid(auth)`.

AI `/api/ai/post-publish` uses the same formal product path: it also calls `createNodebbTopicFromPayload(auth, payload)` without an explicit uid. Therefore confirmed AI posts are published as the current logged-in user's NodeBB account, not as the platform `NODEBB_UID=2` account.

`NODEBB_UID=2` remains useful for local smoke testing or platform fallback experiments, but it is not the default AI publish behavior and is not exposed for frontend users to choose.

## Draft JSONL

Each line in `data/ai-post-drafts.jsonl`:

```json
{
  "id": "uuid",
  "source": "ai_light_publish",
  "status": "draft",
  "createdAt": "ISO time",
  "imageUrl": "https://...",
  "title": "...",
  "body": "...",
  "tags": ["..."],
  "metadata": {},
  "locationDraft": {},
  "riskFlags": [],
  "confidence": 0.62,
  "needsHumanReview": false,
  "aiMode": "mock",
  "nodebbUid": 123,
  "lianUser": {
    "id": "local-user-id",
    "email": "student@example.edu",
    "username": "student",
    "displayName": "student"
  }
}
```

## Publish Record JSONL

Each line in `data/ai-post-records.jsonl` is similar to the draft line plus publish outcome fields:

```json
{
  "id": "uuid",
  "source": "ai_light_publish",
  "status": "published",
  "tid": 123,
  "url": "http://149.104.21.74:4567/topic/123",
  "publishedAt": "ISO time"
}
```

If NodeBB succeeds but metadata write fails, the record status is `metadata_error` and the API returns a clear error with `tid` and `recordId`.

## Location Draft

Current shape:

```json
{
  "source": "legacy_map",
  "locationId": "",
  "locationArea": "",
  "displayName": "",
  "lat": null,
  "lng": null,
  "legacyPoint": { "x": null, "y": null },
  "imagePoint": { "x": null, "y": null },
  "mapVersion": "legacy",
  "confidence": 0,
  "skipped": false,
  "note": ""
}
```

Skip location uses `source: "skipped"` and `skipped: true`.

`metadata.locationArea` prefers user location input over AI suggestion. `metadata.locationId` stays empty unless a future trusted locations source confirms it.

## Test Draft Save

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/api/ai/post-drafts" -ContentType "application/json" -Body (@{
  imageUrl = "https://example.com/image.jpg"
  title = "校园里的一刻"
  body = "这是一条可编辑草稿。"
  tags = @("校园随手拍")
  metadata = @{ contentType = "campus_moment"; visibility = "public" }
  locationDraft = @{ source = "skipped"; skipped = $true; mapVersion = "legacy" }
  riskFlags = @()
  confidence = 0.5
  needsHumanReview = $false
  aiMode = "mock"
} | ConvertTo-Json -Depth 6)
```

Requires login session, same as publish.

## Test Publish

Use the UI for the safest end-to-end test:

1. Start the server.
2. Log in.
3. Tap `+`.
4. Upload an image.
5. Edit draft and location.
6. Click `发布到 LIAN`.
7. Confirm the new `tid` appears in NodeBB, `data/post-metadata.json`, `data/ai-post-records.jsonl`, `/api/feed`, and `/api/feed-debug`.

## Risks And Rollback

Risks:

- NodeBB publish can succeed while metadata write fails. The API records `metadata_error` for manual repair.
- Legacy location is text or image-point based and may be imprecise.
- AI risk flags are advisory only and do not block publishing.

Rollback:

- Remove `/api/ai/post-drafts` and `/api/ai/post-publish` handlers and route registrations.
- Revert the dynamic AI publish sheet changes in `public/app.js`.
- Remove AI publish styles from `public/styles.css`.
- Keep or archive JSONL files for analysis; they do not affect feed runtime.

## Future Map V2 Replacement

Keep the API payload shape. Replace only the frontend location step:

- `source` becomes `map_v2`.
- Fill trusted `locationId` when a future locations source exists.
- Fill `lat/lng` from precise picker.
- Fill `imagePoint` from the Map v2 illustrated map projection.

No publish API shape change should be needed.
