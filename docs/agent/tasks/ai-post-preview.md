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
- `../AI_POST_PREVIEW.md`
- `../HANDOFF_ai-post-preview.md`
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

## Handoff file

Current handoff:

- `../handoffs/ai-post-preview.md`

Historical original:

- `../HANDOFF_ai-post-preview.md`

