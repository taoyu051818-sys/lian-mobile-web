# Domain Docs Override - 2026-05-05

This file overrides stale active-domain readings in `docs/agent/domains/*`.

The domain docs remain useful as business and historical context, but some statements predate the frontend/backend split, Vue canary PR burst, Redis object-native backend state, and Audience Phase 1-3 implementation notes.

## Current authority

1. Current code on `main`.
2. Merged GitHub PRs.
3. `PR_DERIVED_STATUS_2026-05-05.md`.
4. This override file.
5. Domain docs as historical/domain context.

## Cross-domain current facts

- `lian-mobile-web` owns frontend runtime lanes, frontend UI, Vue canary, legacy/static rehearsal, frontend task-board UI, and frontend docs.
- `lian-platform-server` owns backend/API/runtime, Redis object-native state, NodeBB integration, feed service, audience service, map/data APIs, auth/session, uploads, and backend validation.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane: 4300 legacy/static rehearsal and 4301 Vue canary.
- Vue canary already has real Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor paths.

## Feed domain corrections

| Domain doc reading | Current correction |
|---|---|
| Feed source of truth includes frontend-local `data/post-metadata.json` and `data/feed-rules.json`. | Runtime feed data and feed service ownership are backend-owned in `lian-platform-server`; frontend docs may reference them only as API/domain context. |
| Feed validation scripts are local frontend execution guidance. | Use frontend `package.json` for frontend checks; backend feed validation belongs in `lian-platform-server`. |
| Feed UI is only legacy/static path. | Vue canary has a real `/api/feed` read path and detail opening. |

## Map domain corrections

| Domain doc reading | Current correction |
|---|---|
| `data/map-v2-layers.json`, `data/locations.json`, and `src/server/map-v2-service.js` are active local frontend implementation files. | Backend map data/API files belong in `lian-platform-server`; frontend map UI belongs in `lian-mobile-web`. |
| Bounds shown as south `18.3700734`, west `109.9940365`, north `18.4149043`, east `110.0503482`. | Later decision/task-board references set canonical bounds to south `18.37107`, west `109.98464`, north `18.41730`, east `110.04775`. Verify current backend code before editing. |
| Map admin/editor work can be planned from domain doc alone. | Map geometry/data/editor work remains human-assisted and must be scoped with explicit human approval. |
| Map v2 is only legacy frontend map work. | Vue canary now renders real Map V2 items and supports publish location drafts. |

## Audience domain corrections

| Domain doc reading | Current correction |
|---|---|
| Enforcement table still says feed/detail/map/messages have no audience filtering and require changes. | Task-board and handoff history record Audience Phase 1-3 read-side enforcement as implemented/accepted with follow-up. Recheck current backend code before treating read-side as missing. |
| Write-side enforcement is Phase 4. | This remains a valid follow-up area unless newer backend code/PRs prove it landed. |
| `auth-users.json` is the current user source. | Backend root README now describes Redis object-native auth runtime. Treat JSON file wording as historical/file-mode context. |
| Organization membership examples are active product model. | Treat as design/examples unless current backend code implements them. |

## NodeBB domain corrections

| Domain doc reading | Current correction |
|---|---|
| Some implementation statuses say report/not integrated or read/history partial. | Recheck current backend PRs/code before planning. Recent task-board notes accepted several detail/profile actions and left narrower message/reply identity follow-up. |
| Current gaps list says feed/detail/map/messages lack audience checks. | Audience Phase 1-3 read-side state must be rechecked against current backend code and PRs; do not blindly use old gap list. |
| `post-metadata.json` and JSON auth files are the active state model. | Backend currently documents Redis object-native runtime. JSON references may be migration/rollback context. |
| NodeBB endpoint details are static truth. | Endpoint/auth behavior must still be verified against the installed NodeBB version before new integration cuts. |

## Still-valid domain rules

- NodeBB remains the durable content/community backend.
- LIAN owns campus product state: feed ranking, audience rules, map experience, metadata, AI drafts, and frontend UX.
- AI suggestions are draft-only; no auto-publish or auto-approval.
- `locationId` is the formal place-key direction; `locationArea` is compatibility text.
- `feedEditions` should not permanently lock the homepage.
- Map geometry/data work is human-assisted.
- NodeBB groups/categories should mirror hard boundaries only after LIAN-owned audience rules are clear.

## Safe domain-read rule

Before starting domain implementation, read current code and PR-derived status first. Then use domain docs to understand intent, not as current implementation truth.
