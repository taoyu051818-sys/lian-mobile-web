# Handoff: Publish V2 Page

Date: 2026-05-02

## Plan Summary

Publish V2 moves from a `<dialog>` modal to a dedicated `<section data-view="publish">` view with three internal steps: imageSelect → locationPick → draftReview.

A new `public/publish-page.js` (~500-700 lines) owns the dedicated page rendering and state. Map v2 gets an embedded pick mode. The existing multi-image publish baseline is reused instead of rebuilt from scratch. Audience picker is added to draft review and must be user-confirmed before publish.

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

## Files to Change

| File | Change | Risk |
|---|---|---|
| `public/publish-page.js` | **NEW** — all publish page rendering and state | Medium |
| `public/index.html` | Add `<section data-view="publish">` (~15 lines) | Low |
| `public/app.js` | Wire `+` button to `publishPageOpen()`, add delegated handlers (~40 lines) | Medium |
| `public/app-state.js` | Add `publish` state block (~20 lines) | Low |
| `public/map-v2.js` | Add `startPickInContainer()` for embedded mode (~40 lines) | Medium |
| `public/styles.css` | Publish page styles (~120 lines) | Low |
| `public/app-ai-publish.js` | Keep old modal compatibility; extract/reuse helpers only if needed | Medium |
| `public/app-utils.js` | Optional shared image compression/upload helper | Low |
| `src/server/ai-post-preview.js` | Verify/complete multi-image MiMo content parts; keep `imageUrl` compatibility | Low |
| `src/server/ai-light-publish.js` | Preserve `imageUrls[]`; pass confirmed visibility/audience only if needed | Low |

Unchanged unless specifically required: `src/server/audience-service.js`, `src/server/api-router.js`.

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
4. Verify automatic transition to Map v2 embed
5. Pick or skip location
6. Verify AI draft uses all images
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

## Follow-up TODOs

- Deprecate old modal publish path once V2 is stable
- Add concurrent image upload (Promise.all with limit) if sequential is too slow
- Add audience-specific validation on backend (school visibility requires valid schoolId)
- Consider step indicator (dots/labels) at top of publish view for UX
