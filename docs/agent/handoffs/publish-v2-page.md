# Handoff: Publish V2 Page

Date: 2026-05-02

Status: **待审核** — review correction applied. Image selection now shows local thumbnails immediately, uploads run in background, map picker is entered instantly after confirmation. Upload promise is awaited before AI preview.

## Plan Summary

Publish V2 moves from a `<dialog>` modal to a dedicated `<section data-view="publish">` view with three internal steps: imageSelect → locationPick → draftReview.

A new `public/publish-page.js` (~415 lines) owns the dedicated page rendering and state. Map v2 gets an embedded pick mode (`startPickInContainer`). The existing multi-image publish baseline is reused instead of rebuilt from scratch. Audience picker is added to draft review and must be user-confirmed before publish.

Confirmed product flow after review:

```text
 click
→ choose multiple images
→ confirm upload/images
→ immediately enter Map v2 location picker
→ user confirms coordinate location or taps skip
→ when image URLs are ready, call AI preview with all images and location context
→ editable draft review
→ explicit publish or save draft
```

The map step must include both "确认地点" and "跳过定位". Default expectation is a coordinate-bearing `locationDraft` from Map v2 when the user confirms a point/location.

## Current Baseline

This task starts after the completed `AI Publish Polish` work:

- `src/server/ai-light-publish.js` already handles `imageUrls[]`.
- `public/app-ai-publish.js` already has a modal-era multi-image flow.
- draft saves are already non-blocking.
- JSONL archive tooling already exists.

Publish V2 should migrate and harden the user-facing flow, not duplicate these capabilities.

## Architecture Decision

**Dedicated view, not enhanced modal.** Rationale:
- Current `<dialog>` already strained at ~300 lines with AI publish flow
- Map v2 needs a visible container; modal cannot host Leaflet without z-index issues
- Integrates with existing `switchView()` SPA pattern

## Files Changed

| File | Change | Lines |
|---|---|---|
| `public/publish-page.js` | **NEW** — all publish page rendering and state, 3 steps, ~415 lines | ~415 |
| `public/index.html` | Added `<section data-view="publish">` + `<script src="/publish-page.js">` | +20 |
| `public/app.js` | `+` button → `publishPageOpen()`, 10 delegated click handlers, 1 change handler | +45 |
| `public/app-state.js` | Added `publish` state block (20 fields) | +20 |
| `public/map-v2.js` | Added `startPickInContainer()` for embedded Leaflet picker, exported on `window.MapV2` | +40 |
| `public/styles.css` | Publish page styles (view, topbar, sections, upload zone, image grid, location embed, audience picker) | +120 |

Unchanged (reused as-is): `public/app-ai-publish.js`, `public/app-utils.js`, `src/server/ai-post-preview.js`, `src/server/ai-light-publish.js`, `src/server/api-router.js`.

## Implementation Status

All 7 phases completed:

| Phase | Description | Status |
|---|---|---|
| 1 | Page shell: state, HTML, CSS, button wiring, event delegation | Done |
| 2 | Image select: compress via `compressImageForUpload` + upload via `uploadImage` | Done |
| 3 | Map v2 embedded picker: `startPickInContainer` creates standalone Leaflet map | Done |
| 4 | AI preview: `POST /api/ai/post-preview`, `publishPageApplyPreview`, regenerate | Done |
| 5 | Audience picker: 4-option (公开/校园/本校/仅自己), `userEditedAudience` flag | Done |
| 6 | Save/publish: draft save to `/api/ai/post-drafts`, publish to `/api/ai/post-publish` | Done |
| 7 | Polish: step labels, status messages, risk flags display | Done |

Key implementation details:

- `+` button now calls `publishPageOpen()` instead of old `resetAiPublish()` + `showModal()` path
- Image select: local thumbnails via `URL.createObjectURL` shown immediately, compression + upload runs in background
- Upload is non-blocking: user can proceed to location picking while uploads continue
- `publishPageSkipLocation` / `publishPageConfirmLocation` await `uploadPromise` before calling AI preview
- Location pick step shows upload progress (`N/M`) when uploads still in progress
- `startPickInContainer` creates a Leaflet map independent from main map state, with click-to-pick and nearest-location snapping
- Audience picker uses `userEditedAudience` flag so AI preview doesn't override user choice
- `publishPageBuildPayload` sets `metadata.distribution` based on whether location was set (includes `"map"` only when location present)
- Old modal path (`#publishSheet`) still exists but is no longer reachable from `+` button

## API Changes

- `POST /api/ai/post-preview`: request should prefer `imageUrls[]`; MiMo call sends each URL as a separate `image_url` content part.
- `POST /api/ai/post-drafts`: continue supporting `imageUrls[]`; include confirmed `metadata.visibility`; optional `audienceDraft` only if needed.
- `POST /api/ai/post-publish`: continue supporting `imageUrls[]`; include confirmed `metadata.visibility`; optional `audienceDraft` only if needed.

Audience scope for this task:

- continue using `metadata.visibility` for compatibility;
- do not implement school/org hard enforcement here;
- do not let AI silently set final audience;
- regenerate must not override a user-confirmed audience.

## Implementation Order

1. **Phase 0 (Reconcile Existing Code)**: inspect current modal multi-image code and backend `imageUrls[]` behavior before editing.
2. **Phase 1 (Dedicated Page Shell)**: `app-state.js` → `index.html` → `styles.css` → `app.js` entry wiring.
3. **Phase 2 (Images And Upload)**: `publish-page.js` image select/compress/upload, reusing the existing `imageUrls[]` contract.
4. **Phase 3 (Map v2 Picker)**: `map-v2.js` embedded picker → `publish-page.js` locationPick step, with instance cleanup and bounds validation.
5. **Phase 4 (AI Preview And Draft Review)**: preview once with all images; editable draft; regenerate respects user edits.
6. **Phase 5 (Audience Confirmation)**: user-confirmed `metadata.visibility`; optional `audienceDraft`.
7. **Phase 6 (Save/Publish/Recovery)**: save draft, publish, failure recovery, JSONL and metadata validation.
8. **Phase 7 (Polish)**: CSS refinement, full flow test, old modal compatibility check.

## Validation Steps

```bash
node --check src/server/ai-post-preview.js
node --check src/server/ai-light-publish.js
node --check src/server/api-router.js
node --check public/publish-page.js
node --check public/map-v2.js
node --check public/app.js
node scripts/validate-post-metadata.js
```

Browser smoke test:
1. Click `+`
2. Select multiple images
3. Confirm images
4. Verify immediate transition to Map v2 embed while upload/progress state is visible if needed
5. Pick a coordinate location or skip location from the location step
6. Verify AI draft waits for image URLs, then uses all images plus the confirmed/skipped location context
7. Edit audience
8. Save draft
9. Publish to LIAN
10. Verify in feed
11. Verify main `+` no longer opens the old modal path
12. Verify failed publish does not write `post-metadata.json`

Failure-path checks:

- one image compression fails;
- one of multiple uploads fails;
- AI preview fails or falls back to mock;
- user skips location;
- user cancels after upload;
- publish fails after draft review.

## Known Risks

- `map-v2.js` embedded mode may conflict with main map view if both initialized. Mitigation: destroy container map on step exit.
- frontend is split into classic scripts; changes must preserve script load order and global names.
- Multi-image MiMo calls increase token usage. Monitor API costs.
- Audience is not yet a full permission system. This task must not imply school/org hard access control.
- Map distribution must be removed or avoided when the user skips location.
- `post-metadata.json` writes must not corrupt existing entries.

## Review Findings (Resolved)

1. ~~The image step currently does not enter map picking immediately after confirmation.~~ **Fixed**: `publishPageConfirmImages` transitions to locationPick immediately; `selectedFiles`/`localImageUrls` used for thumbnails instead of waiting for `imageUrls`.
2. ~~Upload and AI preview latency should be overlapped with user location selection.~~ **Fixed**: `publishPageHandleImageSelect` starts upload via `uploadPromise` in background; location step shows upload progress (`N/M`); `publishPageSkipLocation`/`publishPageConfirmLocation` await `uploadPromise` before calling AI preview.
3. ~~The map picker must return coordinates by default when the user confirms a location.~~ **Already correct**: `startPickInContainer` returns `locationDraft` with `lat`/`lng` from Leaflet click event; `nearestLocation` snaps to known locations within 120m.
4. ~~The map picker step must always show "确认地点" and "跳过定位".~~ **Already correct**: `publishPageRenderLocationPick` renders both buttons unconditionally.

## Follow-up TODOs

- Deprecate old modal publish path once V2 is stable (remove `#publishSheet` dialog and `app-ai-publish.js` event handlers)
- Add concurrent image upload (Promise.all with limit) if sequential is too slow
- Add audience-specific validation on backend (school visibility requires valid schoolId)
- Add `miniMap.remove()` cleanup when leaving locationPick step to free memory
- Wire Map v2 location markers (show existing locations on embedded picker for reference)
