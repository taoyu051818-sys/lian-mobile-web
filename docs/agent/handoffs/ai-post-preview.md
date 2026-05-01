# Handoff: AI Post Preview

This normalized handoff corresponds to the older root file:

```text
../HANDOFF_ai-post-preview.md
```

Keep the root file for historical detail.

## Status

Backend completed and integration-tested on 2026-05-01.

## Changed Areas

Historical implementation changed:

- `server.js`
- `.env.example`
- `docs/agent/AI_POST_PREVIEW.md`
- `docs/agent/HANDOFF_ai-post-preview.md`

This refresh only updates docs under `docs/agent`.

## New API

```text
POST /api/ai/post-preview
```

Implemented:

- `mockPostPreview()`
- `callMimoVisionPostPreview()`
- MiMo adapter
- prompt construction
- JSON parse and normalize
- `imageBase64` length limits

## Modes

Mock mode:

- forced by `AI_POST_PREVIEW_MODE=mock`
- automatic when `MIMO_API_KEY` is absent

MiMo mode:

- uses `MIMO_BASE_URL=https://api.xiaomimimo.com/v1`
- uses `MIMO_MODEL=mimo-v2.5`
- returns `mode=mimo` when successful

## Validation

Passed:

- mock mode
- MiMo mode
- Cloudinary image URL input

PowerShell Chinese may display `???`; verify with browser, curl, or a UTF-8 terminal before treating this as API mojibake.

## Safety Boundaries

The endpoint does not:

- publish automatically;
- call NodeBB post creation;
- write `data/post-metadata.json`;
- change recommendation;
- change map behavior.

Real `MIMO_API_KEY` values must only live in `.env` or server environment variables and must never be committed.

## Next Thread Notes

Frontend integration should render AI output as editable suggestions and require explicit user confirmation before any publish call.

