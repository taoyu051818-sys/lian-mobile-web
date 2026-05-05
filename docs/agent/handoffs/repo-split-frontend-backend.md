# Handoff: Repo Split Frontend Backend

## Current status

Updated: 2026-05-05

Status: **Done / split executed**.

The original 2026-05-02 handoff recorded Phase 0 and Phase 0.5 before the physical repo split. That historical state is now superseded.

Current source of truth:

| Repository | Role |
|---|---|
| `lian-mobile-web` | Frontend/static mobile web workspace |
| `lian-platform-server` | Backend/API/runtime/storage workspace |
| `lian-mobile-web-full` | Retired historical full-stack transition repo; do not use for active deployment |

Current ownership:

- `lian-mobile-web` owns the frontend app, static assets, Vue/Vite frontend shell, legacy static frontend rehearsal, frontend smoke/rehearsal scripts, frontend README, and the stable API contract reference.
- `lian-platform-server` owns `server.js`, backend services, NodeBB integration, auth/session, media upload/image proxy, AI backend adapters, feed/ranking services, messages/notifications backend, Audience enforcement, Map v2 data/admin APIs, runtime data/storage, deployment, ops, validators, and backend README.
- The API contract remains the cross-repo boundary. Frontend code must call backend APIs through the configured API base URL instead of assuming same-repo backend files.

## Corrected decision

Repo split is no longer a future P0 bootstrap task. The backend repository already exists and is the active backend source of truth.

Do not follow the old wording that said:

- `lian-mobile-web` would become the backend repo;
- a new frontend repo would be created;
- no backend repo existed;
- backend files must remain in the current repo until future staging.

Those statements described an earlier pre-split plan and are now historical only.

## Phase history

### Phase 0: API inventory and contract freeze

Completed before the split.

Results from the original handoff:

- Frontend inventory: 32 call sites across 13 JavaScript files.
- Frontend-required API endpoints: 29.
- Backend route inventory: 48 total endpoints.
- API contract reference: `docs/agent/contracts/api-contract.md`.

### Phase 0.5: Frontend API base URL

Completed before the split.

Frontend `/api/*` calls were made configurable through `LIAN_API_BASE_URL` / `LIAN_API_BASE` so the frontend can point at a backend on another origin.

Representative frontend files from the original implementation:

- `public/app-utils.js`
- `public/map-v2.js`
- `public/tools/map-v2-editor.js`

Use pattern:

```html
<script>window.LIAN_API_BASE_URL = "https://api.example.com";</script>
```

Default empty value preserves same-origin behavior for local/static rehearsal when a proxy is used.

## Current follow-up scope

Remaining work should be tracked as validation/docs/cleanup work, not as backend bootstrap planning:

1. Keep the API contract synchronized when backend endpoints change.
2. Validate frontend static/Vue paths against the backend service URL.
3. Keep backend runtime/storage docs in `lian-platform-server`.
4. Keep frontend-only docs in `lian-mobile-web`.
5. Remove or clearly mark stale historical docs that still describe the pre-split repo plan as current.
6. Treat any leftover `data/*` or generated/local artifacts in the frontend workspace as cleanup/ownership follow-up, not as evidence that the frontend repo owns backend runtime state.

## Validation expectations

Frontend repo:

```bash
npm run check
npm test
npm run build
```

Backend repo:

```bash
npm run check
npm test
npm run test:routes
npm run test:object-native
npm run verify:redis
npm run verify:redis:auth
```

Use the backend README as the current runtime/storage reference. Use the frontend README as the current frontend development reference.
