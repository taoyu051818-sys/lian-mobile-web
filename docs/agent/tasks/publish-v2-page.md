# Task: Publish V2 Page

Status: **待审核** — review 修正已应用。图片选择后立即进入地图选点，上传后台进行。`node --check` 通过，需浏览器 smoke test。

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

## Engineering Gate

Publish V2 is the main user-value track, but implementation should preferably start after these two safety tasks have landed:

- `docs/agent/tasks/metadata-write-safety.md`
- `docs/agent/tasks/route-matcher-tests.md`

Reason: final publish creates a NodeBB topic and then writes LIAN metadata. Without metadata write safety and route matcher tests, Publish V2 can create hard-to-repair partial failures or accidentally break adjacent APIs.

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
6. Do not wait for the upload or AI preview to finish before showing the map picker. Use the location-picking time to overlap upload latency and later LLM preview latency.
7. AI preview is called once with all uploaded image URLs so the LLM can see the full image set.
8. Draft page shows editable title, body, tags, location, risk flags, and audience.
9. AI may suggest audience/visibility, but the user must confirm the final audience before publish.
10. Publish still requires the explicit "publish to LIAN" action.
11. Save draft remains available and must not make the post public.
12. Regenerate calls preview again with the same image set and current context.

## Location Rules

- Use Map v2 as the primary picker.
- Legacy map / old location picker is in retirement and should not receive new product behavior.
- The location step must show both "确认地点" and "跳过定位".
- Default product expectation is to capture coordinates (`lat`/`lng`) from Map v2 when the user confirms a point or location.
- If upload is still running when the user enters the location step, keep the picker usable and show upload/progress state separately.
- AI preview should start only after upload URLs exist, but the user should not be blocked from choosing/skipping location while uploads continue.
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
- Partial upload failure: the user may continue location picking while upload failures are displayed; draft review should wait until at least one image URL exists or the user explicitly cancels/removes failed images.
- Upload still pending at location confirmation: keep the user on the location/draft transition state until image URLs are ready, then call AI preview with the confirmed/skipped location context.
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
  4. verify immediate transition to Map v2 picker even if uploads are still running
  5. confirm a coordinate location or skip location from the map step
  6. verify AI preview starts after image URLs are ready and uses all uploaded images plus the chosen/skipped location context
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

---

## Review Blockers Added 2026-05-03

This task is not approved yet.

Findings:

- Runtime user-facing labels in `public/publish-page.js` and related frontend state/rendering files still contain mojibake. Publish V2 cannot pass browser acceptance while visible labels are corrupted.
- Audience selection can be visually inconsistent after AI preview/regenerate. The publish payload may still use the user's selected audience, but the rendered selected state can fall back to `metadata.visibility` from the AI draft.
- Upload failure handling is not strict enough. A failed upload can alert and still let the flow advance toward draft review without a usable image URL.
- The frontend smoke result was not green during review. Individual syntax checks passed, so the smoke harness or script output needs a focused follow-up before acceptance.

Required fixes:

1. Render the current audience from the user-confirmed value first, then metadata fallback.
2. Preserve user-confirmed audience when applying or regenerating AI preview metadata.
3. If all image uploads fail, keep the user in a recoverable image/location step and do not request preview or allow publish.
4. Clean visible labels in Publish V2 runtime files.
5. Rerun browser/manual smoke:
   - open Publish page from `+`;
   - select multiple images;
   - confirm images and immediately enter Map v2 picker;
   - confirm or skip location;
   - verify preview waits for valid image URLs;
   - change audience and regenerate;
   - verify user-selected audience remains selected;
   - publish and verify metadata.

Acceptance additions:

- [ ] User-selected audience wins in UI and payload.
- [ ] Upload failure cannot silently produce an empty draft review.
- [ ] Publish V2 visible text renders as normal UTF-8 Chinese.
- [ ] Frontend smoke is green or any harness issue is separately fixed and documented.

---

## Fix Pass Result Added 2026-05-03

Status: fixed, pending browser smoke.

Recorded implementation result:

- Audience display precedence fixed: rendering uses `p.audience` first, then `p.metadata?.visibility`.
- Upload failure path fixed: failed uploads are filtered out; if no valid image URL remains, the user stays on image selection and does not advance into draft review.
- No mojibake found in the latest touched labels according to the implementation handoff.
- Frontend smoke reports 21/21 pass.
- The broader fix pass reports 143/143 tests passing.

Reviewer validation:

```bash
node scripts/smoke-frontend.js http://localhost:4100
```

Manual browser checks still required:

1. Open Publish from the `+` entry.
2. Select multiple images.
3. Force one upload failure and confirm the failed image is filtered.
4. Force all uploads to fail and confirm the user remains on image selection.
5. Change audience, trigger AI preview/regenerate, and confirm the user-selected audience remains selected.
6. Publish and confirm `visibility` and `audience` are written to metadata.
