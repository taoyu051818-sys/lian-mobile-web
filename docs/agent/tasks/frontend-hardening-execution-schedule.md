# Task: Frontend Hardening Execution Schedule

Status: **Ready**

Date: 2026-05-08

Reference: [issue #148](https://github.com/taoyu051818-sys/lian-mobile-web/issues/148)

## Goal

Convert the PM scheduling direction from issue #148 into a bounded, reviewable execution plan for the frontend hardening wave. This doc records phase order, PR slicing rules, execution dependencies, and iteration sequence. It does not make new product decisions — it distills decisions already made on the issue.

## Non-Goals

- No code changes to `src/`, `public/`, `scripts/`, or CI workflows.
- No new product decisions beyond what #148 already states.
- No duplication of existing task docs — this doc references them by path.

## Execution Principle

```text
decision gate
-> engineering quality / runtime / API contract
-> security / privacy / identity / geospatial
-> UI / motion / PWA / share / notifications
-> unified acceptance / release candidate
```

---

## Phase Order

### Phase 0 — Decision Freeze

Close open discussion buckets. Confirm contract acceptance.

| Issue | Action |
|---|---|
| #46 | Write final product/UI decision record |
| #63 | Confirm actor/source/PlaceSheet contract accepted |
| #67 | Define runtime/manual acceptance checklist |
| lian-platform-server#45 | Confirm display actor semantics |
| lian-platform-server#61 | Confirm release/ops ownership |

**Exit:** #46 stops expanding. Each P0 issue has owner / non-goals / acceptance.

### Phase 1 — Engineering Quality and CI Baseline

Make the project verifiable and reproducible.

| Order | Issue | Scope |
|---|---|---|
| 1 | #125 | CI deterministic install, supply-chain hardening |
| 2 | #124 | Lint, formatting, static quality gates |
| 3 | #133 | Smoke into verify + Vitest pure functions |
| 4 | #104 | API client, upload client, async stale request protection |
| 5 | #113 | Validation, copy catalog, API response adapters |
| 6 | #118 | Centralized time formatting / timestamp contracts |
| 7 | #126 | Release id / privacy-safe diagnostics only |

Dependencies: `#125 -> #124/#133`, `#104 -> #113/#137`, `#126 -> #119`

**Exit:** CI uses lockfile. `npm run verify` has static/test/build entrypoint. High-risk patterns blocked by static gates.

### Phase 2 — Runtime, Router, Lifecycle, Browser Capability

Stabilize frontend runtime state.

| Order | Issue | Scope |
|---|---|---|
| 1 | #119 | Runtime config, proxies, feature flags |
| 2 | #110 | Router/deep link, view lifecycle, error boundary |
| 3 | #120 | App lifecycle: network/resume/pagehide/cross-tab |
| 4 | #123 | Browser support matrix and capability layer |
| 5 | #130 | Mobile keyboard / visualViewport / fixed input chrome |
| 6 | #135 | Overlay layer / z-index / scroll lock / focus stack |

**Exit:** Config lazy-read defined. Views have URL/deep-link direction. Browser capabilities centralized.

### Phase 3 — Security, Privacy, Identity, Data Contract

Define trust boundaries before UI expansion.

| Order | Issue | Scope |
|---|---|---|
| 1 | #127 | Auth/session/CSRF/rate-limit/write result taxonomy |
| 2 | #129 | Moderation, hide/block/delete, visibility, alias privacy |
| 3 | #128 | Image upload privacy, EXIF/GPS, media purpose policy |
| 4 | #140 | Account privacy, data controls, session/device management |
| 5 | #137 | Entity ID/API model normalize |
| 6 | #145 | Actor identity presenter / alias display contract |
| 7 | Backend | #49 avatar, #46 legacy cleanup, #74 metadata audit |

PM rule: #145 must land before broad UI rewrites across Feed/Detail/Messages/Profile/Publish.

**Exit:** Write actions have result taxonomy. Actor display centralized. Entity IDs normalized.

### Phase 4 — Map, Place, PlaceSheet, Discovery

Upgrade "place" from UI label to stable content entity.

Order: `#132` (geospatial) -> `#137` (ID normalize) -> `#146` (PlaceSheet contract) -> `#141` (search/tags/recommendation) -> `#46` follow-up (UI split).

PM rule: Do not build broad PlaceSheet UI before `#132/#137/#146` accepted.

**Exit:** Coordinate system clear. PlaceId/LocationId relationship documented. Place contracts stable.

### Phase 5 — Messages, Notifications, Invite, Drafts, AI Publish

Land complex business chains against contracts.

| Order | Issue | Dependencies |
|---|---|---|
| 1 | #143 | #127, #137, #145, #115 |
| 2 | #139 | #120, #123, #127, #137 |
| 3 | #142 | #127, #131, #140 |
| 4 | #136 | — |
| 5 | #138 | #127, #128, #129, #136, #137 |
| 6 | #115 | — |

PM rule: AI-assisted publish should not expand early.

**Exit:** Channel/notification/invite/draft/AI contracts stable.

### Phase 6 — Performance, Responsive, Motion, UI Polish

Experience hardening after core contracts stable.

| Order | Issue | Scope |
|---|---|---|
| 1 | #121 | Route-level code splitting, bundle budgets |
| 2 | #114 | Performance budgets, design-token guardrails |
| 3 | #144 | Responsive layout contracts (tablet/desktop/foldable) |
| 4 | #85/#86/#91 | Motion architecture — bounded PRs only |

PM rule: Motion PRs must not mix with actor/place/source contract changes.

### Phase 7 — Share, SEO, PWA, Release Candidate

Final integration and release.

Order: `#131` (share) -> `#117` (SEO) -> `#109` (PWA RFC) -> `#134` (release runbook) -> `#67` (acceptance) -> `#63` (close).

PWA phasing: manifest/icons -> minimal SW -> update UX -> selective cache.

---

## PR Slicing Rules

Every implementation PR must follow these rules:

1. **One contract or one surface per PR.** Do not mix actor, PlaceSheet, PWA, motion, and router.

2. **Adapter/contract/test first, then UI expansion.** Example: `presentActor()` first, then Feed/Detail/Messages/Profile changes.

3. **Declare affected surfaces.** Feed, Detail, Map, Publish, Messages, Profile, Auth, Sheet/Dialog, PWA installed mode.

4. **Declare validation.** `npm run verify`, unit tests, smoke, manual QA, runtime evidence.

5. **Legacy/static lane: compatibility only.** New product behavior goes to Vue lane first.

6. **Privacy/security PRs must declare non-leakage.** Tokens, cookies, private URLs, post body, message text, precise coordinates, raw image URLs, filenames.

---

## Top 10 Execution Order

```text
 1. #46   final decision record
 2. #125  CI deterministic / supply-chain
 3. #124  lint / static gates
 4. #133  testing strategy Phase 1
 5. #119  runtime config / feature flags
 6. #104  API client / async lifecycle
 7. #113  validation / copy / adapters
 8. #137  entity ID normalize
 9. #127  auth / session / CSRF / rate-limit
10. #132  map / place / geospatial contract
```

## Second Batch

```text
#145  actor presenter
#129  content safety
#128  image privacy
#140  account privacy
#146  PlaceSheet contract
#130  mobile keyboard
#135  overlay / focus stack
#143  Messages contract
#139  Notifications contract
#134  release runbook
```

---

## Iteration Plan

### Iteration 1 — Engineering Baseline

Goal: CI and tests can prove subsequent work.

- #125 deterministic CI install + GitHub Actions permissions
- #124 lint/static guard baseline
- #133 smoke into verify + first Vitest setup
- #151 type boundary rules / no-new-unsafe-any
- #118 time formatter tests (first low-risk test slice)

### Iteration 2 — API / Runtime / Adapters

Goal: Unified data entry points, less component-level guessing.

- #119 runtimeConfig helper
- #104 API/write/upload client result model
- #113 validation/copy/response adapters
- #137 entity ID normalize
- #145 actor presenter

### Iteration 3 — Safety / Privacy Contracts

Goal: Write operations and privacy boundaries are explainable.

- #127 auth/session/CSRF/rate-limit UX
- #128 media policy / EXIF-GPS stripping contract
- #129 content safety / visibility / anonymous copy
- #149 clientId/readerId lifecycle
- #126 safe diagnostics

### Iteration 4 — Place / Map / Product Core

Goal: Map/Detail/Publish/PlaceSheet stop guessing.

- #132 geospatial contract
- #146 PlaceSheet product/API contract
- #46 split follow-up tasks for Map/Detail/Publish/Messages UI
- #67 runtime/manual evidence plan

### Iteration 5 — Core Experience Completion

Goal: Close user-facing usability loops.

- #143 Messages send/read/read receipt
- #139 Notifications read/unread/badge contract
- #142 Invite code lifecycle
- #136 Unsaved drafts
- #147/#135/#130 a11y / overlay / keyboard

---

## Development Blockers

| Blocked Feature | Blockers |
|---|---|
| Broad PlaceSheet UI | #132, #137, #146 |
| AI-assisted publish expansion | #127, #128, #129, #136, #137 |
| PWA Service Worker | #109, #119, #123, #125, #126, #134, #152 |
| Push / App Badge | #139, #120, #123, #127 |
| Public share / social preview | #131, #117, #129, #132 |
| Large motion rewrite | #91, #135, #130, #123 |
| Responsive desktop rewrite | #144, #114, #121 |

---

## Explicitly Deferred

| Deferred Item | Reason |
|---|---|
| Service Worker implementation | Needs #109/#119/#123/#134 first |
| Broad PlaceSheet UI | Needs #132/#137/#146 first |
| Push / App Badge | Needs #139 + PWA/capability/lifecycle decisions |
| AI Publish expansion | Needs #127/#128/#129/#136/#137 |
| Large motion rewrite | Needs overlay/input/chrome foundations + bounded PR governance |
| Desktop responsive rewrite | Needs #144 layout contract first |

---

## Related Task Docs

- `docs/agent/tasks/high-risk-execution-plan.md` — Track-by-track refactor plan for 6 high-risk areas
- `docs/agent/tasks/frontend-stability-smoke.md` — Smoke test baseline
- `docs/agent/legacy-fallback-cleanup-plan.md` — Actor/place cleanup for issue #68
- `docs/agent/FRONTEND_REVIEWER_HANDOFF.md` — Frontend reviewer continuation protocol

## Acceptance Criteria

- Phase order matches issue #148 scheduling direction.
- PR slicing rules are bounded and enforceable.
- Dependency graph prevents premature feature expansion.
- Each iteration has a clear goal and bounded scope.
- Blockers table prevents starting work before prerequisites are met.
