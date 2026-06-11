# Core Product Model V1 Phase Order

This queue keeps LIAN Core Product Model V1 work aligned with `docs/product/PRD_WAP_SECURITY_AUDIENCE_EVENT_V0.1.md`. Move through the phases in order unless a lane explicitly states that it is a later-phase bug fix against already-shipped behavior.

## Phase 0 — safety and localization baseline

Purpose: protect the production client baseline before widening product capabilities.

Guarded by:

- `tests/phase0/phase0-contract.test.ts`

Scope anchors:

- Production source-protection baseline
- Chinese/English locale detection and fallback
- Audience type and audience-option consumption baseline

## Phase 1 — core post and audience vocabulary

Purpose: establish the shared vocabulary that later surfaces depend on.

Guarded by:

- `tests/phase0/phase1-contract.test.ts`

Scope anchors:

- Unified `PostType` vocabulary
- Shared like/vote interaction result shape
- Audience normalization helpers
- Post extension module presence

## Phase 2 — map and publish controls alignment

Purpose: wire the Core Product Model constraints into the visible map and publish controls before adding assisted publish behavior.

Guarded by:

- `tests/phase0/phase2-contract.test.ts`

Scope anchors:

- Map viewport policy in Leaflet views
- Publish metadata controls honoring backend-driven audience gating

## Phase 3 — AI-assisted publish flow

Purpose: add AI assistance only after the publish and audience contracts are stable.

Guarded by:

- `tests/phase0/phase3-contract.test.ts`

Scope anchors:

- AI preview suggestion parsing
- Non-clobbering suggestion application policy
- First-upload location panel wiring
- Brand-sourced AI strings

## Phase 4 — event/help/errand action surfaces

Purpose: add action surfaces for event, help, and errand flows after the core post, audience, map, and publish contracts are in place.

Guarded by:

- `tests/phase0/phase4-contract.test.ts`
- `tests/phase0/phase4-help-contract.test.ts`
- `tests/phase0/phase4-help-manage-contract.test.ts`
- `tests/phase0/phase4-deeplink-contract.test.ts`
- `tests/phase0/phase4-publish-event-contract.test.ts`

Scope anchors:

- Event action/status policy
- Help vote and help-management contracts
- Canonical deeplink hash shape
- Event publish controls
- Errand vocabulary carried by post extensions

## Queue maintenance rule

When adding, renaming, or removing a Core Product Model V1 phase contract, update this file and `tests/phase0/phase-order-contract.test.ts` in the same change. Run `npm run test:phase-order` before handing off. The contract test is the queue pointer that keeps the documented execution order and the focused phase tests from drifting apart.
