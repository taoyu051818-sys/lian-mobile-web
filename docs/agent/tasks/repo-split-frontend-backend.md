# Task: P0 Repo Split - Frontend Here, Backend Elsewhere

## Goal

Split LIAN into two repositories: keep the frontend/mobile web experience in the current repository, and move the full backend/server/data integration layer into a separate backend repository.

## Product scope

This is a P0 project-management and architecture task. It is not a visual redesign and not a feature launch by itself.

After this task is complete:

- the current repository is the frontend-facing LIAN mobile web app and frontend tooling workspace;
- the backend repository owns NodeBB integration, AI adapters, feed service, metadata writes, map data APIs, auth/session, upload proxy, and admin APIs;
- the frontend communicates with the backend through explicit API contracts instead of shared in-repo assumptions;
- implementation threads can work on frontend and backend without constantly touching the same files.

## Repository ownership target

Principle: **backend repo contains all local files; frontend repo contains only frontend-related code and stable/safe test methods.**

### New backend repo: `lian-platform-server`

Owns everything except `public/`:

- `server.js`
- `src/server/*` (all service modules)
- `data/*` (post-metadata, auth-users, feed-rules, locations, map-v2-layers, etc.)
- `scripts/*` (all validators, smoke tests, deploy scripts, seed scripts)
- `package.json` (Node.js dependencies)
- `.env` / `.env.example` (server secrets and config)
- `CLAUDE.md` (agent rules for backend work)
- `docs/` (backend docs, handoffs, domain docs, architecture workplan)
- `outputs/` (feed snapshots, test outputs)
- `.claude/` (agent memory)

### Current repo becomes frontend repo: `lian-mobile-web`

Owns only frontend-related code:

- `public/*` (HTML, CSS, JS, assets, map editor tools)
- `public/tools/*` (admin editor frontend — static pages that call admin APIs)
- `scripts/smoke-frontend.js` (safe frontend-only smoke test)
- `docs/agent/contracts/api-contract.md` (frozen API contract reference)
- `README.md` (frontend repo readme)
- `.gitignore`

The frontend repo does NOT own:

- `server.js`, `src/server/*`, `data/*`, `scripts/*` (except smoke-frontend.js)
- `.env` (secrets)
- `package.json` (backend dependencies)
- `outputs/`, `.claude/`, `CLAUDE.md`

## Allowed files

For the planning task:

- `docs/agent/tasks/repo-split-frontend-backend.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/ARCHITECTURE_WORKPLAN.md`
- `docs/agent/handoffs/repo-split-frontend-backend.md`
- `docs/agent/contracts/api-contract.md`

For the repo split implementation:

- **Move to backend repo:** everything except `public/` — `server.js`, `src/`, `data/`, `scripts/`, `package.json`, `.env`, `.env.example`, `CLAUDE.md`, `docs/`, `outputs/`, `.claude/`, `README.md`
- **Keep in frontend repo:** `public/`, `scripts/smoke-frontend.js`, `docs/agent/contracts/api-contract.md`, `.gitignore`, `README.md`

## Forbidden files

For this architecture/documentation thread:

- `server.js`
- `src/server/*`
- `public/*`
- `data/*`
- `package.json`

For future implementation threads:

- Do not delete backend files from the current repo until the backend repo boots and serves the required API surface.
- Do not split frontend and backend API behavior in the same PR without a rollback path.
- Do not move secrets or real production data into the frontend repository.
- Do not expose NodeBB token, MIMO API key, Cloudinary secret, session secrets, or admin tokens to frontend code.

## Data schema changes

None in the planning task.

Implementation will require an API contract file, such as:

- `docs/api/openapi.yaml`; or
- `docs/agent/contracts/api-contract.md`; or
- generated TypeScript client definitions if a frontend build step is introduced later.

The backend remains the source of truth for server-owned data:

- `post-metadata`;
- AI drafts/records;
- auth users/sessions;
- map layers;
- locations;
- feed rules.

## API changes

No immediate endpoint changes are required.

The split must preserve the existing public API surface first:

- `GET /api/feed`
- `GET /api/feed-debug`
- `GET /api/posts/:tid`
- `POST /api/posts`
- `POST /api/posts/:tid/replies`
- `POST /api/posts/:tid/like`
- `POST /api/posts/:tid/save`
- `POST /api/posts/:tid/report`
- `GET /api/messages`
- `GET /api/channel`
- `GET /api/map/items`
- Map v2 read/admin APIs currently used by frontend/editor
- `POST /api/upload/image`
- `POST /api/ai/post-preview`
- `POST /api/ai/post-drafts`
- `POST /api/ai/post-publish`
- auth/session/profile endpoints currently used by frontend

The frontend repo must support a backend base URL configuration:

```text
LIAN_API_BASE_URL=https://api.example.com
```

For local dev, the frontend may proxy `/api/*` to the backend repo or run against an absolute backend URL.

## Phase plan

### Phase 0: Freeze contract and inventory

- Inventory every frontend `fetch()`/`api()` call.
- Inventory every backend endpoint currently served by `api-router.js`.
- Document request/response contracts for all endpoints used by frontend.
- Mark each endpoint as required for initial split, admin-only, diagnostic, or deprecated.
- Confirm which static tools remain in frontend repo.

Status: **Done** — see `docs/agent/contracts/api-contract.md`.

Results: 48 total endpoints. 29 frontend-required, 11 admin-only, 2 backend-only (setup), 6 deprecated (no frontend caller). Frontend uses 32 call sites across 13 files. All calls use `api()` helper or direct `fetch()` — no HTTP libraries.

### Phase 1: Backend repo bootstrap

- Create new backend repository (`lian-platform-server`).
- Move all local files except `public/` into the backend repo: `server.js`, `src/`, `data/`, `scripts/`, `package.json`, `.env.example`, `CLAUDE.md`, `docs/`, `outputs/`, `.claude/`, `README.md`.
- Backend repo must run `node --check`, metadata validators, route tests, audience tests, and NodeBB contract smoke.
- Backend repo must serve the same API paths under `/api/*`.
- Preserve current behavior first; no framework migration during the initial split.

### Phase 2: Frontend repo cleanup

- Current repo keeps only `public/`, `scripts/smoke-frontend.js`, `docs/agent/contracts/api-contract.md`, `.gitignore`, `README.md`.
- Add `LIAN_API_BASE_URL` config to `public/app-utils.js` `api()` helper (default: empty = same-origin).
- Remove backend files from current repo (they now live in backend repo).
- Add frontend smoke that can run against a configurable backend URL.

### Phase 3: Deployment staging

- Run backend repo as a separate process/service.
- Serve frontend current repo either as static assets or through a minimal frontend dev server.
- Configure reverse proxy:
  - frontend static assets from current repo;
  - `/api/*` to backend repo service;
  - uploaded/proxied media paths to backend repo if applicable.
- Validate login, feed, detail, publish, messages, map, upload, and admin editor flows.

### Phase 4: Finalize

- Once backend repo is proven in staging, remove backend files from the frontend repo (already done in Phase 2).
- Frontend repo is now pure frontend: `public/` + `scripts/smoke-frontend.js` + API contract reference.
- Keep docs pointing to the backend repo for server tasks.

## Acceptance criteria

- [x] A full frontend endpoint inventory exists. (32 call sites, 29 endpoints, in `api-contract.md`)
- [x] A full backend route inventory exists. (48 endpoints, in `api-contract.md`)
- [x] API contract docs exist for all frontend-required endpoints. (`docs/agent/contracts/api-contract.md`)
- [ ] New backend repo can boot and serve the existing `/api/*` surface needed by the frontend.
- [ ] Current frontend repo can run against a configurable backend base URL.
- [ ] Local dev path is documented for both repos.
- [ ] Production/staging deployment path is documented for both repos.
- [ ] No secrets are moved into frontend code or frontend docs.
- [ ] Current repo no longer needs backend implementation files for frontend development after Phase 4.
- [ ] Backend repo owns metadata write safety, route tests, Audience, NodeBB contracts, Messages backend, AI publish backend, and Map v2 admin APIs.
- [ ] Frontend repo owns Publish UI, feed/detail UI, messages UI, profile UI, Map v2 UI, and frontend smoke tests.

## Validation commands

Planning/documentation validation:

```bash
git status --short
```

Backend repo validation after bootstrap:

```bash
node --check server.js
node --check src/server/*.js
node scripts/validate-post-metadata.js
node scripts/validate-locations.js
node scripts/test-routes.js
node scripts/test-audience.js
```

Frontend repo validation after split:

```bash
node scripts/smoke-frontend.js http://localhost:4100
```

If the frontend gets a build step later:

```bash
npm run build
npm run lint
```

## Risks

- Risk: Frontend and backend split before API contracts are documented, causing silent UI breakage. Mitigation: Phase 0 must land first.
- Risk: Backend repo drifts from current behavior during the move. Mitigation: no framework migration in initial backend bootstrap.
- Risk: Secrets leak into frontend repo. Mitigation: frontend repo must only use public base URLs and never hold server tokens.
- Risk: Deployment gets more complex. Mitigation: use reverse proxy with `/api/*` routed to backend while frontend remains static.
- Risk: Two repos make coordination harder. Mitigation: maintain task board links and handoffs in both repos, with backend task docs mirrored or referenced.
- Risk: Current repo still contains dirty runtime changes during the split. Mitigation: split must start from a known commit or explicitly documented branch state.

## Rollback plan

- Keep the current monorepo deployment path working until the split is validated in staging.
- If backend repo bootstrap fails, continue serving from current repo and do not delete backend files.
- If frontend API base URL changes break the UI, revert to same-origin `/api/*`.
- Do not remove backend files from current repo until a tagged backend repo release is available.

## Non-goals

- No PostgreSQL migration in the initial repo split.
- No Express/Fastify migration in the initial repo split.
- No frontend framework migration in the initial repo split.
- No redesign of Publish, Map v2, Feed, or Messages as part of the split.
- No new product features.
