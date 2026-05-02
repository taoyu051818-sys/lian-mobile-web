# Task: AI Post Preview

## Goal

Completed backend: provide AI-assisted editable draft preview for lightweight campus posting while preserving user confirmation and publication control.

## Scope

Completed backend scope:

- `POST /api/ai/post-preview`;
- `mockPostPreview()`;
- `callMimoVisionPostPreview()`;
- MiMo adapter;
- prompt construction;
- JSON parse and normalize;
- `imageBase64` length limits;
- mock fallback when no `MIMO_API_KEY` or when `AI_POST_PREVIEW_MODE=mock`;
- `.env.example` placeholders for MiMo config.

## Out of Scope

Still out of scope unless a new task explicitly reopens it:

- automatic publishing;
- writing `data/post-metadata.json`;
- calling NodeBB post creation;
- recommendation changes;
- map changes;
- frontend integration unless assigned in a separate UI task;
- committing real API keys.

## Inputs

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../domains/AI_POST_PREVIEW.md`
- `../handoffs/ai-post-preview.md`

## Validation

Completed validation:

- mock mode passed;
- MiMo mode passed;
- Cloudinary image URL input passed;
- successful MiMo response returned `mode=mimo`.

Notes:

- PowerShell Chinese may display `???`; verify with browser, curl, or a UTF-8 terminal before treating it as API mojibake.
- Real `MIMO_API_KEY` must only live in `.env` or server environment variables.

Expected checks for future backend changes:

```powershell
node --check server.js
node scripts\validate-post-metadata.js
```

## Deliverables

Completed deliverables:

- backend preview endpoint;
- mock mode;
- MiMo mode;
- normalized output shape;
- safety boundaries preventing publish/data/feed/map side effects;
- environment placeholders in `.env.example`;
- historical handoff.

Future frontend deliverables should render draft fields as editable suggestions and require explicit user confirmation before any publish call.

## Follow-up: AI Light Publish Flow

The next MVP layer is now active:

- clicking `+` opens a simplified AI upload entry;
- image upload calls `/api/upload/image` first and then `/api/ai/post-preview`;
- the user can choose a legacy map/manual location or skip location;
- AI fields are editable before publish;
- after AI preview/regenerate succeeds, the frontend silently writes a private draft to `data/ai-post-drafts.jsonl`;
- "发布到 LIAN" calls `/api/ai/post-publish`;
- publish creates a NodeBB topic, writes `data/post-metadata.json`, and appends `data/ai-post-records.jsonl`.

This flow still forbids AI automatic publishing. The publish API is only called after explicit user action.

Map v2 is not implemented in this task. The current contract stores `locationDraft` with `mapVersion: "legacy"` so a future Map v2 picker can fill `locationId`, `lat/lng`, and `imagePoint` without changing the API shape.

## Handoff file

Current handoff:

- `../handoffs/ai-post-preview.md`
