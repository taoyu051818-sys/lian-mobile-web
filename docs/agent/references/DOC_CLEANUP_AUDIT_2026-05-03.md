# Documentation Cleanup Audit

Date: 2026-05-03

Scope: all docs/agent/ files, root docs, data/, outputs/, scripts/

No runtime code was changed. This is a findings-and-recommendations report only.

---

## 1. Stale Baseline Facts

### `01_PROJECT_FACT_BASELINE.md`

File already has a historical disclaimer at top, but the body still contains stale facts that a new thread might act on:

| Line/Section | Stale claim | Current truth |
|---|---|---|
| Section 1 table | `app.js` tab switch as frontend entry | Frontend is now split into 10 JS files; `app.js` is event delegation only |
| Section 1 table | `GET /api/messages` in `channel-service.js:135` | Notifications moved to `notification-service.js` |
| Section 1 table | `GET /api/map/items` hardcoded in `api-router.js:69` | Map v2 uses `GET /api/map/v2/items` via `map-v2-service.js` |
| Section 1 table | `GET /api/tags` passthrough | Deprecated, no frontend caller |
| Section 2 directory tree | `src/server/` 22 modules, ~3,581 lines | Now 27 modules, ~5,158 lines |
| Section 2 directory tree | `app.js` 2,151 lines single file | Split into 8 files + `publish-page.js` + `map-v2.js` |
| Section 2 directory tree | `post-service.js` 195 lines | Now 523 lines |
| Section 2 directory tree | Missing: `audience-service.js`, `alias-service.js`, `notification-service.js`, `map-v2-service.js`, `route-matcher.js` | All exist and are active |
| Section 2 directory tree | Missing: `public/publish-page.js`, `public/map-v2.js` | Both exist |
| Technology appendix | "No automated tests" | Multiple validation/smoke scripts exist: `test-routes.js`, `test-audience.js`, `smoke-frontend.js`, etc. |
| Technology appendix | "No Leaflet" | Leaflet is loaded via CDN in `index.html` for Map v2 |

**Recommendation:** Add a bolder "HISTORICAL — DO NOT USE FOR IMPLEMENTATION" banner. Or replace stale sections with one-line pointers to current docs.

---

## 2. Missing File Entries

### `03_FILE_OWNERSHIP.md`

These files exist on disk but have no ownership entry:

**src/server/ (5 missing):**

| File | Lines | Recommended level |
|---|---|---|
| `audience-service.js` | 149 | soft-lock — permission functions used by feed, map, detail, channel |
| `alias-service.js` | 155 | open — alias pool management |
| `notification-service.js` | 130 | soft-lock — user-scoped notifications |
| `map-v2-service.js` | 439 | soft-lock — map data API and admin writes |
| `route-matcher.js` | 80 | soft-lock — URL pattern matching |

**public/ (3 missing):**

| File | Lines | Recommended level |
|---|---|---|
| `map-v2.js` | ~220 | soft-lock — Leaflet map, overlays, location pick |
| `publish-page.js` | ~415 | soft-lock — Publish V2 dedicated page |
| `mock-api.js` | ~340 | open — mock data layer for frontend repo |

**data/ (4 missing):**

| File | Tracked | Recommended |
|---|---|---|
| `alias-pool.json` | yes | open — alias pool data |
| `locations.json` | yes | soft-lock — location coordinates for map v2 |
| `map-v2-layers.json` | yes | soft-lock — map layer definitions |
| `study-hn-club-discoveries.json` | yes | open — discovery data |

**scripts/ (11 missing):**

| File | Recommended status |
|---|---|
| `archive-ai-records.js` | active — JSONL hygiene |
| `audit-feed-rules.js` | active — feed config audit |
| `audit-post-metadata.js` | active — metadata audit |
| `cleanup-audience-test.js` | active — test cleanup |
| `diff-feed-snapshots.js` | active — snapshot comparison |
| `smoke-nodebb-contracts.js` | active — NodeBB endpoint validation |
| `setup-audience-test.js` | active — test data setup |
| `test-audience.js` | active — audience permission tests |
| `test-audience-hydration.js` | active — audience hydration tests |
| `test-metadata-write-safety.js` | active — metadata write safety |
| `validate-project-structure.js` | active — project structure validation |

**Recommendation:** Add all missing entries to `03_FILE_OWNERSHIP.md` with the levels above.

---

## 3. Script Lifecycle Status

`scripts/` has 21 files. None have explicit lifecycle labels. Suggested classification:

| Status | Scripts |
|---|---|
| **Active (run regularly)** | `smoke-frontend.js`, `validate-post-metadata.js`, `validate-locations.js`, `test-routes.js`, `test-audience.js`, `test-audience-hydration.js` |
| **Active (run on change)** | `snapshot-feed.js`, `diff-feed-snapshots.js`, `audit-feed-rules.js`, `audit-post-metadata.js`, `smoke-nodebb-contracts.js`, `test-metadata-write-safety.js`, `validate-project-structure.js` |
| **Ops/deploy** | `deploy.sh`, `install-linux-env.sh`, `start-local.ps1` |
| **One-shot/maintenance** | `archive-ai-records.js`, `cleanup-audience-test.js`, `setup-audience-test.js`, `rewrite-test-posts.js`, `seed-photo-post-candidates.js` |

**Recommendation:** Add lifecycle status column to `03_FILE_OWNERSHIP.md` scripts table.

---

## 4. Outputs Classification

`outputs/` has 12 tracked files, 51 ignored. Classification:

| Category | Files | Recommendation |
|---|---|---|
| **Kept artifact (tracked)** | `feed-snapshot-*.md` (3), `feed-diff-*.md` (1), `feed-post-observability-report.md` | Keep as historical reference |
| **One-shot script (tracked)** | `club-posts/upload-club-images.cjs` | Move to `scripts/archive/` or untrack |
| **Club content (tracked)** | `club-posts/01-05*.md` (5) | Keep as content reference |
| **Generated seed result (tracked)** | `feed-test-seed-result-2026-04-30.json` | Archive or untrack |
| **Ignored images** | `club-posts/images/*` (44) | Already ignored, leave as-is |
| **Ignored scripts** | `menu-post-*.cjs`, `club-posts/*.cjs` (6) | Already ignored, leave as-is |

**Recommendation:** Mark `outputs/` as "generated/archive" in `03_FILE_OWNERSHIP.md`. Consider untracking `feed-test-seed-result-*.json` and `upload-club-images.cjs`.

---

## 5. Data File Classification

| File | Type | Tracked | Recommendation |
|---|---|---|---|
| `post-metadata.json` | Product data (source of truth) | yes | Keep. Never bulk-format. |
| `feed-rules.json` | Product config | yes | Keep. Changes affect all users. |
| `locations.json` | Product data | yes | Keep. Map v2 coordinates. |
| `map-v2-layers.json` | Product data | yes | Keep. Map layer definitions. |
| `clubs.json` | Static reference | yes | Keep. |
| `alias-pool.json` | Operational data | yes | Keep. Alias pool. |
| `study-hn-club-discoveries.json` | Discovery artifact | yes | Consider archiving. |
| `auth-users.json` | Local runtime state | no (gitignored) | Correct. Never commit. |
| `channel-reads.json` | Local runtime state | no (gitignored) | Correct. Never commit. |
| `ai-post-drafts.jsonl` | Generated records | no (gitignore) | Correct. Append-only. |
| `ai-post-records.jsonl` | Generated records | no (gitignore) | Correct. Append-only. |
| `post-metadata.json.bak` | Backup | no (untracked) | Add `*.bak` to gitignore or delete. |

**Recommendation:** Add data classification table to `03_FILE_OWNERSHIP.md`. Add `data/*.bak` to `.gitignore`.

---

## 6. Menu Prototypes

`public/` contains 6 menu prototype files:

- `menu-prototype.html`, `menu-prototype.css`, `menu-prototype.js`
- `menu-prototype-v2.html`, `menu-prototype-v2.css`, `menu-prototype-v2.js`
- `menu-data.json`

These are experimental demos, not part of the main app. No file in `index.html` references them (they are standalone HTML pages).

**Recommendation:** Mark as "experimental/demo" in ownership docs. Consider moving to `public/experimental/` or `tools/` to separate from production assets.

---

## 7. Task Board Status Language

Current `05_TASK_BOARD.md` uses these status terms without a legend:

- Done
- Accepted
- 待审核 (pending review)
- 待复核 (pending re-review)
- Blocked
- Ready
- Later

**Recommendation:** Add a status legend section at the top of the task board:

```
## Status Legend
- Done — implementation complete, accepted by reviewer
- 待审核 — implementation complete, awaiting first review
- 待复核 — review findings fixed, awaiting reviewer re-run
- Blocked — waiting on dependency or external action
- Ready — task spec written, can be started
- Later — intentionally deferred
- Superseded — replaced by newer task/decision
```

---

## 8. Contradictory Blocker Sections

`05_TASK_BOARD.md` has two overlapping blocker sections:

1. "Review Fix Pass" (line ~475) — says prior blockers are no longer open blockers, lists 7 fixes recorded
2. "Review Blockers: Audience, NodeBB Detail/Profile, Publish V2" (line ~511) — says tasks are not approved

Both are about the same work items but present different conclusions. A new thread cannot tell which is current.

**Recommendation:** Move the older "Review Blockers" section into an "Audit Log" subsection. Keep the "Review Fix Pass" as the current status. Add a header note: "Historical blocker record — see Review Fix Pass for current status."

---

## 9. Root Doc Ownership

| File | Current role | Recommendation |
|---|---|---|
| `README.md` | Project overview, dev setup | Keep as-is. Current. |
| `CLAUDE.md` | Agent operating rules (loaded by Claude Code) | **P2 — needs thread workflow pointer.** Project uses Codex for planning/review, Claude Code for execution. `CLAUDE.md` must link to `00_AGENT_RULES.md` thread division so execution threads don't treat handoffs as acceptance. |
| `EDITORIAL_PRINCIPLES.md` | Content style guide | Keep. Current. |
| `package.json` | Project metadata | Keep. Current. |
| `server.js` | Backend entry point | Keep. Current. |
| `.env.example` | Environment template | Keep. Current. |

**Recommendation:** `CLAUDE.md` needs a thread workflow pointer (P2). Other root docs are current.

---

## 10. Domain Docs Freshness

| File | Status | Notes |
|---|---|---|
| `domains/AI_POST_PREVIEW.md` | Current | Matches implementation |
| `domains/AUDIENCE_SYSTEM.md` | Current | Matches Phase 1-3 implementation |
| `domains/FEED_SYSTEM.md` | Current | Matches feed-service.js |
| `domains/FEED_REFACTOR_PLAN.md` | Historical | Planning doc, implementation done |
| `domains/MAP_SYSTEM.md` | Current | Matches Map v2 implementation |
| `domains/NODEBB_INTEGRATION.md` | Current | Includes failure modes |

**Recommendation:** Mark `FEED_REFACTOR_PLAN.md` as historical in `README.md` (it's already listed under Historical References, but the file itself has no disclaimer).

---

## 11. Frontend Repo Sync Gap

The frontend repo (`lian-frontend`) was created from `public/` but does not include:
- `public/tools/` (map editor) — intentionally excluded from frontend repo
- `public/assets/` — copied to frontend repo
- Mock API layer — added to frontend repo only

The main repo `lian-mobile-web` does not have `mock-api.js`.

**Recommendation:** Add a note to `03_FILE_OWNERSHIP.md` that `mock-api.js` lives in the frontend repo only, and `tools/` are admin-only (backend repo).

---

## Summary of Recommended Actions

| Priority | Action | Files affected |
|---|---|---|
| P1 | Add stale banner to `01_PROJECT_FACT_BASELINE.md` | 1 file |
| P1 | Add missing file entries to `03_FILE_OWNERSHIP.md` | 1 file (23 entries) |
| P1 | Add status legend to `05_TASK_BOARD.md` | 1 file |
| P1 | Move old blocker section to Audit Log | 1 file |
| P2 | Add data classification to `03_FILE_OWNERSHIP.md` | 1 file |
| P2 | Add script lifecycle status | 1 file |
| P2 | Mark `FEED_REFACTOR_PLAN.md` as historical | 1 file |
| P2 | Add `data/*.bak` to `.gitignore` | 1 file |
| P2 | Add thread workflow pointer to `CLAUDE.md` | 1 file |
| P3 | Classify menu prototypes | 1-2 files |
| P3 | Consider untracking `outputs/` seed results | 1 file |

No runtime code changes. All actions are docs/config only.
