# Handoff: AI Post Preview

Date: 2026-05-01

## Status

Backend completed and integration-tested.

## Changed Files

- `src/server/ai-post-preview.js` — preview endpoint, MiMo adapter, mock fallback
- `src/server/api-router.js` — route registration
- `.env.example` — MiMo config placeholders

## New API

`POST /api/ai/post-preview`

Generates an editable draft preview. Does not publish, does not call NodeBB, does not write `data/post-metadata.json`.

## Test Commands

Syntax check:

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

Feed smoke checks:

```powershell
Invoke-RestMethod "http://localhost:4100/api/feed"
Invoke-RestMethod "http://localhost:4100/api/feed-debug?token=$env:ADMIN_TOKEN"
```

## Modes

Mock mode:

- forced by `AI_POST_PREVIEW_MODE=mock`
- automatic when `MIMO_API_KEY` is absent

MiMo mode:

- uses `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- uses `MIMO_MODEL=mimo-v2.5`
- returns `mode=mimo` when successful
- falls back to mock with `fallbackReason=mimo_unavailable` when MiMo fails

## Environment Variables

- `AI_POST_PREVIEW_MODE=mock | mimo`
- `MIMO_API_KEY`
- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- `MIMO_MODEL=mimo-v2.5`

Without `MIMO_API_KEY`, the endpoint automatically uses mock mode.

## Frontend Integration Notes

- Call `/api/ai/post-preview` after image upload or when the user enters a public image URL.
- Prefer sending Cloudinary/public `imageUrl`. Use `imageBase64` only for temporary preview.
- Render `draft.title`, `draft.body`, `draft.tags`, `draft.metadata`, `locationSuggestions`, and `riskFlags` as editable fields.
- Do not publish automatically. Require explicit user confirmation.
- Treat `riskFlags` as user-facing warnings, not automatic allow/deny decisions.
- Treat `locationId` as optional. The backend clears unknown AI-provided IDs.

## Safety Boundaries

The endpoint does not:

- publish automatically
- call NodeBB post creation
- write `data/post-metadata.json`
- change recommendation
- change map behavior

## Risks

- MiMo may return malformed JSON; backend normalizes and falls back to mock.
- Vision output may infer a wrong place; unknown `locationId` is cleared.
- Base64 requests can be large; backend has body and base64 length limits.
- PowerShell Chinese may display `???`; verify with browser, curl, or UTF-8 terminal.

## Rollback

- Remove `/api/ai/post-preview` route and helpers from `ai-post-preview.js`.
- Remove MiMo env entries from `.env.example`.
- No runtime data files are written by this feature.

## Next Thread Notes

Frontend integration should render AI output as editable suggestions and require explicit user confirmation before any publish call. See `ai-light-publish-flow.md` for the full publish flow handoff.
