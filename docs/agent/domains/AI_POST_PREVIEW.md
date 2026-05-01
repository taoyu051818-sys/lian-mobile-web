# AI Post Preview

## Purpose

AI post preview provides draft assistance for lightweight campus posting. It reduces friction but does not publish content.

The older root document `../AI_POST_PREVIEW.md` is historical implementation documentation. This domain file is the current workspace summary.

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

## Allowed AI Outputs

AI may suggest:

- title
- editable body draft
- tags
- content type
- location suggestions
- time hints
- risk/privacy warnings
- LIAN metadata draft fields

## Hard Boundaries

AI must not:

- automatically publish
- call NodeBB post creation
- write `data/post-metadata.json`
- change recommendation behavior
- change map behavior
- invent a trusted `locationId` without server-side known-place confirmation

## Validation Notes

Passed:

- mock mode
- MiMo mode
- Cloudinary image URL input
- normalized response shape

PowerShell Chinese may display as `???`. Verify with browser, curl, or a UTF-8 terminal before assuming the API returned mojibake.

## Related Files

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../tasks/ai-post-preview.md`
- `../handoffs/ai-post-preview.md`
- `../HANDOFF_ai-post-preview.md`

