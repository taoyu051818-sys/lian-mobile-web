# Project File Index

Canonical index of every important file group in `lian-mobile-web`. Use this as the starting point for understanding project structure.

Source-of-truth order: current code > latest handoff > current task > this index > domain docs > architecture workplan > decisions > historical baseline.

Repo split status as of 2026-05-05:

| Repository | Role |
|---|---|
| `https://github.com/taoyu051818-sys/lian-platform-server` | Current backend/API/runtime source of truth |
| `https://github.com/taoyu051818-sys/lian-mobile-web` | Current frontend/static mobile web source of truth |
| `https://github.com/taoyu051818-sys/lian-mobile-web-full` | Retired historical full-stack transition repo; do not use for active deployment |

This index still documents historical file ownership and split destination for the original full workspace. For active repo ownership, prefer current code in the split repos and `references/RECENT_WORK_HANDOFF_2026-05-05.md`.

---

## Root

| File | Purpose | Status | Repo split |
|---|---|---|---|
| `server.js` | HTTP server entry, top-level routing | Moved to `lian-platform-server` | Backend |
| `package.json` | Dependencies, scripts | Active | Both |
| `README.md` | Project overview, dev setup | Current | Frontend |
| `CLAUDE.md` | Agent operating rules (loaded by Claude Code) | Current | Both |
| `EDITORIAL_PRINCIPLES.md` | Content style guide | Current | Frontend |
| `docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md` | LIAN Campus UI / UX Guidelines V0.1 | Current | Frontend |
| `.env.example` | Environment variable template | Current | Backend |
| `.gitignore` | Git ignore rules | Current | Both |

## `src/server/` - Backend services (moved to `lian-platform-server`)

All backend logic moved to the backend repository. This section remains as ownership/history for the original full workspace. Target: **`lian-platform-server`**.

| File | Purpose | Status | Owner |
|---|---|---|---|
| `api-router.js` | Route mounting only, no business logic | Active | soft-lock / shared |
| `feed-service.js` | Recommendation core: scoring, filtering, diversity, curated pages, moment feed | Active | hard-review |
| `post-service.js` | Publishing core: HTML building, NodeBB topic creation, reply handling | Active | hard-review |
| `auth-service.js` | User model, password, session, NodeBB uid mapping | Active | soft-lock |
| `auth-routes.js` | Register/login/logout endpoints | Active | soft-lock |
| `audience-service.js` | Permission functions (canViewPost etc.) | Active | soft-lock |
| `notification-service.js` | User-scoped notifications from NodeBB | Active | soft-lock |
| `channel-service.js` | Campus channel messages | Active | open |
| `map-v2-service.js` | Map v2 data API, admin writes, bounds validation | Active | soft-lock |
| `nodebb-client.js` | NodeBB HTTP client, all NodeBB calls go through here | Active | soft-lock |
| `ai-post-preview.js` | AI draft generation | Active | open |
| `ai-light-publish.js` | AI draft save + publish | Active | open |
| `alias-service.js` | Alias pool management | Active | open |
| `admin-routes.js` | Admin endpoints | Active | open |
| `task-board-service.js` | Task board markdown API (`/api/internal/task-board`) | Active | open |
| `content-utils.js` | HTML processing, image URL helpers | Active | soft-lock |
| `image-proxy.js` | Cloudinary proxy | Active | open |
| `upload.js` | Image upload to Cloudinary | Active | open |
| `data-store.js` | JSON file read/write | Active | soft-lock |
| `config.js` | Environment loading | Active | soft-lock |
| `route-matcher.js` | URL pattern matching for API router | Active | soft-lock |
| `static-data.js` | Institutions list, map items | Active | open |
| `static-server.js` | Static file serving | Active | open |
| `setup-page.js` | First-run setup page | Active | open |
| `cache.js` | In-memory cache maps | Active | open |
| `paths.js` | File path constants | Active | open |
| `http-response.js` | Response helpers | Active | open |
| `request-utils.js` | Body parsing, admin auth | Active | open |

## `public/` - Frontend (12 JS files)

Classic-script frontend (no ES modules). Script load order matters. Target: **Frontend repo**.

| File | Purpose | Status | Owner |
|---|---|---|---|
| `index.html` | HTML structure, script load order | Active | soft-lock |
| `styles.css` | All styles | Active | soft-lock |
| `map-v2.js` | Leaflet map, overlays, location picker (IIFE) | Active | soft-lock |
| `app-state.js` | Global state, state aliases | Active | soft-lock |
| `app-utils.js` | DOM helpers, API helper, upload/compression | Active | soft-lock |
| `app-auth-avatar.js` | Auth UI, current user loading, avatar crop | Active | soft-lock |
| `app-feed.js` | Feed tabs, masonry cards, detail view, gallery | Active | soft-lock |
| `app-legacy-map.js` | Old illustrated map compatibility | Active (legacy compat) | soft-lock |
| `app-ai-publish.js` | AI light publish sheet, preview/draft/publish | Active | soft-lock |
| `app-messages-profile.js` | Channel messages, replies, profile panel | Active | soft-lock |
| `app.js` | Event delegation, global listeners, app init | Active | soft-lock |
| `publish-page.js` | Publish V2 dedicated page, 3-step flow | Active | soft-lock |

Load order: `map-v2.js` -> `app-state.js` -> `app-utils.js` -> feature scripts -> `app.js`

## `public/tools/` - Internal admin tools

Admin-only pages. Target: **Frontend repo** (admin/internal tools stay with frontend; backend only provides API endpoints).

| File | Purpose | Status |
|---|---|---|
| `map-v2-editor.html` | Map editor page | Active |
| `map-v2-editor.css` | Map editor styles | Active |
| `map-v2-editor.js` | Map editor logic (IIFE) | Active |
| `map-georef.html` | Georeferencing tool | Active |
| `map-coastline-align.html` | Coastline alignment tool | Active |
| `task-board.html` | PC task board viewer | Active |
| `task-board.css` | Task board styles | Active |
| `task-board.js` | Task board parser/renderer | Active |

## `public/assets/` - Static assets

Images, icons, map textures. Target: **Frontend repo**.

| Item | Purpose | Status |
|---|---|---|
| `campus-grass.png` | Map base layer texture | Active |
| Other assets | Icons, images | Active |

## `public/menu-prototype*` - Experimental demos

Menu prototype HTML/CSS/JS files. Not part of main app. Status: **experimental/demo**.

Target: **Frontend repo** (or move to `public/experimental/`).

## `data/` - Runtime data

| File | Type | Tracked | Policy | Repo split |
|---|---|---|---|---|
| `post-metadata.json` | Product data (source of truth) | yes | Never bulk-format. Backup before large changes. | Backend |
| `feed-rules.json` | Product config | yes | Changes affect all users immediately. | Backend |
| `locations.json` | Product data (Map v2 coordinates) | yes | Source of truth for map locations. | Backend |
| `map-v2-layers.json` | Product data (map layer definitions) | yes | Source of truth for map layers. | Backend |
| `clubs.json` | Static reference | yes | Low change frequency. | Backend |
| `alias-pool.json` | Operational data | yes | Alias pool. | Backend |
| `user-cache.json` | Local runtime cache | no | Never commit. Managed by nodebb-client. | Backend |
| `study-hn-club-discoveries.json` | Discovery artifact | yes | Archive candidate. | Backend |
| `auth-users.json` | Local runtime state | no | Never commit. Managed by auth-service. | Backend |
| `channel-reads.json` | Local runtime state | no | Never commit. Managed by channel-service. | Backend |
| `ai-post-drafts.jsonl` | Generated records | no | Append-only. Never hand-edit. | Backend |
| `ai-post-records.jsonl` | Generated records | no | Append-only. Never hand-edit. | Backend |
| `post-metadata.json.bak` | Backup | no | In .gitignore (`*.bak`). | Backend |

## `scripts/` - Validation and ops (22 files)

| File | Lifecycle | Purpose |
|---|---|---|
| `smoke-frontend.js` | active | Frontend HTTP smoke test. 21 checks. |
| `test-routes.js` | active | API route matcher tests. 61 checks. |
| `test-audience.js` | active | Audience permission tests. |
| `test-audience-hydration.js` | active | Audience hydration tests. 61 checks. |
| `smoke-nodebb-contracts.js` | active | NodeBB endpoint validation. |
| `validate-post-metadata.js` | active | Metadata structure validation. |
| `validate-locations.js` | active | Location data validation. |
| `validate-project-structure.js` | active | Project structure validation. |
| `test-metadata-write-safety.js` | active | Metadata write safety. |
| `snapshot-feed.js` | active | Feed snapshot tool. |
| `diff-feed-snapshots.js` | active | Snapshot comparison. |
| `audit-feed-rules.js` | active | Feed config audit. |
| `audit-post-metadata.js` | active | Metadata audit. |
| `import-road-network-preview.js` | active | Road network import tool. |
| `deploy.sh` | ops | Deployment script. |
| `install-linux-env.sh` | ops | Linux environment setup. |
| `start-local.ps1` | ops | Local dev startup (PowerShell). |
| `archive-ai-records.js` | one-shot | JSONL hygiene. |
| `setup-audience-test.js` | one-shot | Test data setup. |
| `cleanup-audience-test.js` | one-shot | Test data cleanup. |
| `rewrite-test-posts.js` | one-shot | Test post rewriting. |
| `seed-photo-post-candidates.js` | one-shot | Data seeding tool. |

## `outputs/` - Generated artifacts

Not source of truth. Generated snapshots, reports, publishing artifacts.

| Category | Tracked? | Policy |
|---|---|---|
| Feed snapshots (`feed-snapshot-*.md`) | yes | Keep as historical reference |
| Feed diffs (`feed-diff-*.md`) | yes | Keep as historical reference |
| Club content (`club-posts/*.md`) | yes | Content reference |
| Club images (`club-posts/images/`) | no | Ignored. Large binary assets. |
| Menu scripts (`menu-post-*.cjs`) | no | Ignored. Generated one-shot scripts. |
| Seed results (`*-result-*.json`) | varies | Archive candidate. |

## `docs/agent/` - Coordination layer

Primary working memory for agent threads. All files open for modification.

| Path | Purpose | Status |
|---|---|---|
| `README.md` | Docs index, start-here guide, source-of-truth order | Current |
| `00_AGENT_RULES.md` | Operating rules, validation, high-conflict files | Current |
| `01_PROJECT_FACT_BASELINE.md` | Early fact baseline | **Historical** - superseded by this index and current code |
| `03_FILE_OWNERSHIP.md` | File ownership and conflict levels | Current |
| `04_DECISIONS.md` | Recorded architecture/product decisions | Current |
| `05_TASK_BOARD.md` | Task board with status legend and audit log | Current |
| `ARCHITECTURE_WORKPLAN.md` | Architecture direction and work organization | Current |
| `MAP_V2_TECH_PLAN.md` | Early Map v2 plan | Historical |
| `PROJECT_FILE_INDEX.md` | This file | Current |
| `domains/` | Domain documentation | Current |
| `tasks/` | Task specifications | Active |
| `handoffs/` | Thread handoffs | Active |
| `references/` | Audit reports, high-risk areas | Active |
| `templates/` | Templates for tasks and handoffs | Active |
| `contracts/` | Frozen API contracts | Active |

## `docs/agent/domains/` - Domain documentation

| File | Status | Notes |
|---|---|---|
| `AI_POST_PREVIEW.md` | Current | Matches implementation |
| `AUDIENCE_SYSTEM.md` | Current | Matches Phase 1-3 implementation |
| `FEED_SYSTEM.md` | Current | Matches feed-service.js |
| `FEED_REFACTOR_PLAN.md` | Historical | Planning doc, implementation done |
| `MAP_SYSTEM.md` | Current | Matches Map v2 implementation |
| `NODEBB_INTEGRATION.md` | Current | Includes failure modes |

## `docs/agent/references/` - Reference documents

| File | Purpose |
|---|---|
| `HIGH_RISK_AREAS.md` | 6 high-risk area structured audits |
| `DOC_CLEANUP_AUDIT_2026-05-03.md` | Documentation cleanup findings |
| `PRO_ENGINEERING_DECISION_2026-05-03.md` | Pro engineering decision record |
| `GITHUB_RECENT_UPDATES_2026-05-05.md` | Latest GitHub PR/repo-split alignment |
| `RECENT_WORK_HANDOFF_2026-05-05.md` | Latest repo-split/docs handoff |
