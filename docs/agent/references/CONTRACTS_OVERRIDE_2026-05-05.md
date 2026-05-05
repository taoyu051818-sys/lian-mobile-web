# Contracts Override - 2026-05-05

This file overrides stale active-contract readings in `docs/agent/contracts/*`.

The API contract remains useful as a split-era inventory and compatibility reference. It must not be treated as the live API source of truth without checking current code, merged PRs, and the current frontend/backend runtime model.

## Current authority

1. Current code on `main`.
2. Merged GitHub PRs.
3. `PR_DERIVED_STATUS_2026-05-05.md`.
4. Current root `README.md` files in both repos for runtime entrypoints.
5. This override file.
6. `docs/agent/contracts/api-contract.md` as historical/API inventory context.

## Current frontend runtime facts

- Frontend repo: `lian-mobile-web`.
- Backend repo: `lian-platform-server`.
- Historical full-stack repo: `lian-mobile-web-full`.
- Frontend runtime is dual-lane:
  - 4300 legacy/static rehearsal;
  - 4301 Vue canary.
- Vue canary has real Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor paths.

## Known stale contract readings

| Contract reading | Current correction |
|---|---|
| `Status: Frozen — Phase 0 of repo split` and `source of truth for API surface`. | Treat as split-era inventory. Current code and merged PRs are authoritative. |
| Frontend file references such as `app-feed.js`, `app-messages-profile.js`, `publish-page.js`, and `map-v2.js` as complete caller list. | Vue canary source now exists and must be checked for current API callers. |
| Backend route references only to old services such as `api-router.js` and inline routes. | Backend route registry and current backend code must be checked in `lian-platform-server`. |
| Port assumptions such as `PORT=4100` and image proxy `4101`. | Current frontend README uses 4300/4301 frontend lanes; backend README owns backend/image proxy runtime references. |
| `GET /api/messages` marked deprecated because old frontend used `/api/channel`. | Vue canary Messages may call current message/channel APIs; check current source before treating endpoint status as deprecated. |
| `After repo split, backend repo does not need to serve public/`. | Backend may still have static fallback behavior from later PRs; check backend current code/README. |
| API helper examples based only on `public/app-utils.js`. | Current frontend may also use Vue/Vite API utilities. Check current `src/` and `public/`. |

## Current safe contract usage

Use `api-contract.md` to understand:

- original split-era endpoint inventory;
- broad frontend/backend boundary intent;
- expected request/response shapes for legacy/static callers;
- which endpoints were considered frontend-required, admin-only, backend-only, or deprecated on 2026-05-02.

Do not use it alone to decide:

- whether an endpoint currently exists;
- whether an endpoint is still deprecated;
- whether an endpoint is called by Vue canary;
- which port or runtime hosts a route;
- whether a response shape has drifted.

## Update rule

If an API contract matters for new implementation, verify current backend route registry/code and current frontend callers first. Then either update the contract explicitly or create a newer dated contract addendum.
