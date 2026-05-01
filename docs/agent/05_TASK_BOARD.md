# Agent Task Board

This numbered file is the current task board. Older root docs under `docs/agent/` are historical context; future threads should start here plus one task file under `docs/agent/tasks/`.

## Current Rule

Documentation refresh threads must only update `docs/agent/*`.

Do not modify:

- `server.js`
- `public/app.js`
- `data/*`

Do not commit real API keys. `MIMO_API_KEY` belongs only in `.env` or server environment variables.

## Done Recently

- NodeBB-backed mobile web feed exists.
- Default feed tab changed to `此刻`.
- Feed optimization completed.
- AI post preview backend completed and联调 passed in mock and MiMo modes.
- Metadata validator script exists.
- Feed snapshot script exists.
- `/api/feed-debug` exists and is protected by `ADMIN_TOKEN`.

## Feed Optimization: Completed

Feed behavior now uses a hybrid curated/ranked recommendation page:

- `feedEditions.curatedSlotsPerPage: 3`
- `feedEditions.rankedRestOnCuratedPages: true`
- recommendation page 1 is now small curated entry plus ranked rest.

Measured improvements:

- recommendation page 1 `general`: before `9/9`, after `2/12`
- recommendation page 1 filled `locationArea`: before `0/9`, after `10/12`
- total sampled `general`: before `30/60`, after `13/72`
- total sampled empty `locationArea`: before `30/60`, after `13/72`

New scoring config:

- `contentTypeWeights`
- `missingLocationAreaPenalty`
- `momentContentTypeWeights`
- `momentMissingLocationAreaPenalty`

Metadata was filled for tids `91-97`, `99`, and `100`.

Snapshots:

- `outputs/feed-snapshot-20260501-161614.md`
- `outputs/feed-snapshot-20260501-162140.md`

Historical handoff:

- `HANDOFF_feed-optimization.md`
- `handoffs/feed-optimization.md`

## AI Post Preview: Completed Backend

Backend API:

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
- mock fallback when `MIMO_API_KEY` is absent or `AI_POST_PREVIEW_MODE=mock`

Validation status:

- mock mode passed
- MiMo mode passed
- Cloudinary image URL input passed
- successful MiMo response returns `mode=mimo`

Boundaries:

- AI does not publish
- AI does not write `post-metadata.json`
- AI does not call NodeBB post creation
- AI does not change recommendation
- AI does not change map behavior

Environment documentation exists in `.env.example`:

```text
AI_POST_PREVIEW_MODE=mock
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

PowerShell Chinese output may display `???`; verify with browser, curl, or a UTF-8 terminal before treating it as API mojibake.

Historical handoff:

- `HANDOFF_ai-post-preview.md`
- `handoffs/ai-post-preview.md`

## Map V2: Design-Only Next

Do not implement Map v2 directly yet.

Next deliverable:

- `MAP_V2_TECH_PLAN.md`

Until the technical plan is reviewed:

- do not modify `public/app.js`
- do not add Leaflet
- do not change locations API implementation

## Next Immediate Tasks

1. Review `MAP_V2_TECH_PLAN.md` before any map implementation.
2. Use feed snapshots and `/api/feed-debug` before any further feed tuning.
3. Integrate AI post preview into frontend only in a separate task, with explicit user confirmation before publish.
4. Keep secrets out of git and confirm `.env.example` contains placeholders only.

## Thread Boundaries

- Feed thread: observability, snapshots, scoring config, metadata validation.
- AI preview thread: draft generation API/UI only; no publishing side effects.
- Map thread: design-only plan first, then implementation in a later approved task.
- Metadata thread: content classification and validation cleanup.
- Ops thread: environment, deployment, logs, secrets, and verification.

