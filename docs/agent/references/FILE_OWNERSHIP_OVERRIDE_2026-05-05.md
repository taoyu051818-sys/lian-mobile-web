# File Ownership Override - 2026-05-05

This file overrides stale active-ownership readings in `docs/agent/03_FILE_OWNERSHIP.md`.

The original file remains useful as split-history context, but it still lists backend/data/scripts ownership that no longer belongs to the frontend repo.

## Current ownership facts

- `lian-mobile-web` owns frontend runtime lanes, frontend assets, Vue canary, legacy/static rehearsal, frontend task-board UI, and frontend docs.
- `lian-platform-server` owns backend/API/runtime, Redis object-native state, NodeBB integration, auth/session, uploads, image proxy, map/data APIs, and backend validation.
- `lian-mobile-web-full` is historical only.

## Current frontend-owned areas

| Area | Current owner | Notes |
|---|---|---|
| Root `README.md` and frontend package scripts | Frontend | Must reflect dual-lane runtime. |
| `index.html`, `src/`, `vite.config.ts`, `tsconfig.json` | Frontend | Vue canary lane. |
| `public/` legacy/static frontend | Frontend | 4300 compatibility/smoke lane. |
| `public/tools/task-board.*` | Frontend | Internal task-board UI. Backend only provides APIs. |
| Frontend assets and design docs | Frontend | Includes UI guidelines and static assets. |
| Frontend smoke/ops guard scripts | Frontend | Use current `package.json` scripts as source of truth. |

## Not frontend-owned for active implementation

| Area listed in old ownership file | Current correction |
|---|---|
| `src/server/*` | Backend-owned in `lian-platform-server`. |
| `data/*` runtime data | Backend-owned in `lian-platform-server`. |
| Backend validation scripts such as route/audience/metadata checks | Backend-owned in `lian-platform-server` unless current frontend `package.json` includes them. |
| Redis migration/storage files | Backend-owned in `lian-platform-server`. |
| NodeBB integration files | Backend-owned in `lian-platform-server`. |

## Current frontend validation entrypoints

Use current frontend `package.json` as source of truth:

```bash
npm start
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

## Current conflict rules

1. Do not add backend code back into `lian-mobile-web`.
2. Do not edit backend runtime/data/API files from the frontend repo.
3. Keep Vue canary changes scoped by page/product surface.
4. Keep legacy/static lane changes scoped and compatibility-focused.
5. Keep map geometry/data changes human-assisted, even when the UI file lives in the frontend repo.
6. If a frontend change needs a backend contract change, create or update the API contract/task doc and make the backend change in `lian-platform-server`.

## Known stale readings in `03_FILE_OWNERSHIP.md`

- The `src/server/` section is historical for this repo.
- The `data/` section is historical for this repo.
- The backend-heavy `scripts/` table is historical for this repo.
- Classic script load order remains relevant for the 4300 legacy lane only; it is not the whole frontend architecture.
- `mock-api.js` references may point to older external/mock repo work and should be checked against current repo contents before use.
