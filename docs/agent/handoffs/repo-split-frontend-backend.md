# Handoff: Repo Split Frontend Backend

## Date

2026-05-02

## Thread scope

Phase 0 complete: frontend API call inventory, backend route inventory, and API contract freeze. No runtime files were moved.

Phase 0.5 complete: `LIAN_API_BASE_URL` configuration so frontend can point to a backend on a different origin.

## Decision

Repo split is now a P0 task. Phase 0 contract inventory is complete.

Target ownership:

- current repo `lian-mobile-web`: ALL local files — backend runtime, data, scripts, docs. This becomes the backend repo.
- new frontend repo: only `public/`, `scripts/smoke-frontend.js`, `docs/agent/contracts/api-contract.md`, `.gitignore`, `README.md`.

## Files changed

- `docs/agent/contracts/api-contract.md` (**NEW** — frozen API contract, 48 endpoints documented)
- `docs/agent/tasks/repo-split-frontend-backend.md` (Phase 0 marked done)
- `docs/agent/handoffs/repo-split-frontend-backend.md` (this file)
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/ARCHITECTURE_WORKPLAN.md`

## Phase 0 Results

**Frontend inventory:** 32 call sites across 13 `.js` files, hitting 29 distinct API endpoints. All use `api()` helper (app-utils.js:53) or direct `fetch()`. No HTTP libraries.

**Backend inventory:** 48 total endpoints in api-router.js + admin-routes.js + server.js.

| Classification | Count |
|---|---|
| frontend-required | 29 |
| admin-only | 11 |
| backend-only | 2 (setup) |
| deprecated | 6 |

**Deprecated endpoints** (no frontend caller): `GET /api/auth/rules`, `GET /api/alias-pool`, `GET /api/auth/aliases`, `POST /api/auth/aliases`, `GET /api/messages`, `GET /api/map/items`, `GET /api/tags`.

**Key contract details:**
- Auth: `lian_session` cookie or `x-session-token` header
- Admin: `x-admin-token` or `Bearer <ADMIN_TOKEN>`
- Frontend API helper needs `LIAN_API_BASE_URL` config for split (default: empty = same-origin)
- Image upload uses `FormData` with `image` field + `?purpose=` query param
- Image proxy rewrites Cloudinary URLs to `/api/image-proxy?url=...`

## What was intentionally not done

- No code moved.
- No backend repo created.
- No package/build/deployment files changed.
- No runtime APIs changed.
- Deprecated endpoints not removed (backward compatibility during staged split).

## Required next steps

1. ~~Inventory frontend API calls.~~ Done
2. ~~Inventory backend routes.~~ Done
3. ~~Freeze API contract docs.~~ Done
4. Bootstrap backend repo without changing runtime behavior.
5. ~~Add frontend API base URL configuration.~~ Done (Phase 0.5)
6. Stage reverse proxy deployment.
7. Only then remove backend ownership from current repo.

## Phase 0.5: LIAN_API_BASE_URL

All frontend `/api/*` calls now go through `LIAN_API_BASE` prefix. Set `window.LIAN_API_BASE_URL` before scripts load to point at a remote backend (default: empty = same-origin).

**Files modified:**
- `public/app-utils.js` — `LIAN_API_BASE` constant, `api()`, `displayImageUrl()`, `uploadImage()` all prepend base
- `public/map-v2.js` — `LIAN_API_BASE` constant, local `api()`, `displayImageUrl()` all prepend base
- `public/tools/map-v2-editor.js` — `LIAN_API_BASE` constant, local `api()`, `displayImageUrl()`, direct `/api/upload/image` fetch all prepend base

**Usage:** In `index.html` before any `<script>` tag:
```html
<script>window.LIAN_API_BASE_URL = "https://api.example.com";</script>
```

Default (empty string) preserves same-origin behavior — no change needed for existing deployments.

## Risks

- Splitting before contract freeze can break Publish, Messages, Map v2, and auth flows. **Mitigated: contract now frozen.**
- Moving backend secrets or `.env` assumptions into frontend would be a security bug.
- Backend behavior changes during repo bootstrap would make debugging impossible.

## Rollback

Keep the current monorepo deployment path active until the backend repo has a validated staging release.
