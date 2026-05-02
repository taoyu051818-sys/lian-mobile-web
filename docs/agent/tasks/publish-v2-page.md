# Task: Publish V2 Page

## Goal

Move publishing from the current modal-style MVP behavior into a dedicated page that supports multi-image input, Map v2 location picking, editable AI draft review, and user-confirmed audience selection.

User-facing name: **发布** / **Publish**.

Do not call the user-facing product flow "AI light publish" or "AI 轻投稿". AI is an implementation capability behind the Publish page.

## Current Baseline

Do not treat this task as a from-scratch multi-image publish build.

Existing baseline from the completed `AI Publish Polish` work:

- `src/server/ai-light-publish.js` already accepts `imageUrls[]` in AI draft/save/publish payloads.
- `public/app-ai-publish.js` already has a modal-era multi-image implementation and non-blocking draft save behavior.
- `scripts/archive-ai-records.js` exists for JSONL hygiene.

Publish V2 should reuse those behaviors where practical, but move the user-facing flow into a dedicated page. The core new work is:

- dedicated publish view;
- page-owned publish state;
- image compression and clearer upload failure handling;
- immediate transition into Map v2 location picking after image confirmation;
- Map v2 embedded picker outputting `locationDraft`;
- user-confirmed audience/visibility;
- clearer save/publish/regenerate failure recovery.

## Product Requirements

1. Clicking `+` opens the dedicated Publish page.
2. First step asks for images and brief optional context.
3. User can select multiple images in one batch.
4. Frontend performs simple compression before upload.
5. After the user confirms images, upload starts and the flow immediately moves to Map v2 location picking.
6. Do not wait for the user to press a separate "choose location" button.
7. AI preview is called once with all uploaded image URLs so the LLM can see the full image set.
8. Draft page shows editable title, body, tags, location, risk flags, and audience.
9. AI may suggest audience/visibility, but the user must confirm the final audience before publish.
10. Publish still requires the explicit "publish to LIAN" action.
11. Save draft remains available and must not make the post public.
12. Regenerate calls preview again with the same image set and current context.

## Location Rules

- Use Map v2 as the primary picker.
- Legacy map / old location picker is in retirement and should not receive new product behavior.
- Provide skip-location.
- Constrain manual point selection to:
  - southwest: `18.373050, 109.995380`
  - northeast: `18.413856, 110.036262`
- Persist location through the existing `locationDraft` contract.

## Audience Rules

- Add an audience picker to the dedicated Publish page.
- AI can suggest an initial value, but the user's selection wins.
- Regenerate must not silently override a user-edited audience value.
- Final publish payload must include the confirmed audience/visibility.

## API Requirements

`POST /api/ai/post-preview` must accept preferred multi-image input:

```json
{
  "imageUrls": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
  "template": "campus_moment",
  "userText": "",
  "locationHint": "",
  "visibilityHint": "campus"
}
```

Keep `imageUrl` compatibility for old clients.

`POST /api/ai/post-drafts` and `POST /api/ai/post-publish` should continue to support `imageUrls`.

Audience first cut:

- continue writing `metadata.visibility` for current compatibility;
- optionally include `audienceDraft` as a non-authoritative future-facing object;
- do not implement school/org hard filtering in this task;
- do not let AI output become final audience without user confirmation.

## Architecture Decision

**Dedicated `<section data-view="publish">` view, not enhanced modal.**

Current `<dialog>` already strained at ~300 lines. Map v2 needs a visible container; modal cannot host Leaflet without z-index issues. Integrates with existing `switchView()` SPA pattern. Internal step state: `imageSelect` → `locationPick` → `draftReview`.

## Affected Pages And Files

| File | Change | Risk |
|---|---|---|
| `public/publish-page.js` | **NEW** — all publish page rendering and state (~500-700 lines) | Medium |
| `public/index.html` | Add `<section data-view="publish">` (~15 lines) | Low |
| `public/app.js` | Wire `+` button to `publishPageOpen()`, delegated handlers (~40 lines) | Medium |
| `public/app-state.js` | Add `publish` state block (~20 lines) | Low |
| `public/map-v2.js` | Add `startPickInContainer()` for embedded mode (~40 lines) | Medium |
| `public/styles.css` | Publish page styles (~120 lines) | Low |
| `public/app-ai-publish.js` | Keep old modal path as compatibility fallback; optionally extract/reuse helpers only | Medium |
| `public/app-utils.js` | Shared image compression/upload helper if needed | Low |
| `src/server/ai-post-preview.js` | Verify/complete multi-image MiMo content parts; keep `imageUrl` compatibility | Low |
| `src/server/ai-light-publish.js` | Preserve `imageUrls[]`; add confirmed visibility/audience passthrough only if needed | Low |

Unchanged unless a concrete implementation need appears: `src/server/audience-service.js`, `src/server/api-router.js`.

Do not touch feed ranking or recommendation rules in this task.

Compatibility note: `public/app-ai-publish.js` is not the primary target, but it may be touched to disable the old main entry or share helper code. It must remain backward compatible until the V2 page is stable.

## Failure And Recovery Rules

- Image compression failure: keep the original image if it is below upload limits; otherwise show a per-image error and let the user remove it.
- Partial upload failure: keep successfully uploaded images, show failed images, and allow retry/remove before continuing.
- AI preview failure: allow mock fallback if the backend returns it; otherwise show manual draft fields using uploaded images and do not block save draft.
- Map picker failure: offer skip-location and preserve `locationDraft.source = "skipped"`.
- User skips location: do not force `metadata.distribution` to include `map`.
- Regenerate: refresh AI-generated content suggestions, but do not silently override user-edited audience or confirmed location.
- Cancel: close the flow and clear local page state; do not publish; already uploaded images may remain in object storage.
- Publish failure: keep the draft state recoverable in the page and do not write `post-metadata.json` unless NodeBB publish succeeds.

## Validation

- `node --check src/server/ai-post-preview.js`
- `node --check src/server/ai-light-publish.js`
- `node --check public/publish-page.js`
- `node --check public/map-v2.js`
- `node --check public/app.js`
- `node scripts/validate-post-metadata.js`
- frontend smoke test if available
- manual browser check:
  1. click `+`
  2. select multiple images
  3. confirm images
  4. verify automatic transition to Map v2 picker
  5. skip or select location
  6. verify AI draft uses all images
  7. edit audience
  8. save draft
  9. publish to LIAN
  10. verify old modal path is not opened by the main `+` entry
  11. verify no failed publish leaves a `post-metadata.json` residue

## Implementation Order

1. **Phase 0 (Reconcile Existing Code)**: inspect current `app-ai-publish.js`, `ai-post-preview.js`, and `ai-light-publish.js`; identify reusable multi-image behavior before editing.
2. **Phase 1 (Dedicated Page Shell)**: `app-state.js` → `index.html` → `styles.css` → `app.js` `+` entry wiring.
3. **Phase 2 (Images And Upload)**: `publish-page.js` image select/compress/upload using existing `imageUrls[]` contract.
4. **Phase 3 (Map v2 Picker)**: `map-v2.js` embedded picker → `publish-page.js` `locationPick` step, with destroy-on-exit and bounds validation.
5. **Phase 4 (AI Preview And Draft Review)**: preview once with all `imageUrls`; draft fields remain editable; regenerate respects user edits.
6. **Phase 5 (Audience Confirmation)**: audience picker writes confirmed `metadata.visibility` and optional `audienceDraft`.
7. **Phase 6 (Save/Publish/Recovery)**: save draft, publish, publish-failure recovery, JSONL and metadata validation.
8. **Phase 7 (Polish)**: CSS refinement, full browser smoke, old modal compatibility check.

## Non-Goals

- No Map v2 redesign.
- No new Leaflet fallback.
- No recommendation changes.
- No automatic publishing by AI.
- No admin approval workflow.
