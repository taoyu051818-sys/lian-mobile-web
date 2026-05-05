# Decisions Override - 2026-05-05

This file overrides stale active-decision readings in `docs/agent/04_DECISIONS.md`.

The original decision log remains useful as history, but it predates the merged PR burst for Vue canary, task-board UI, and the completed repo-ownership split.

## Current decision authority

1. Current code on `main`.
2. Merged GitHub PRs.
3. `PR_DERIVED_STATUS_2026-05-05.md`.
4. This override file.
5. `04_DECISIONS.md` for historical decision context.

## New active supersessions

| Old decision text | Current supersession |
|---|---|
| `04_DECISIONS.md` is the current decision log unless newer dated decision is added. | This override is the newer dated decision layer for conflicts found on 2026-05-05. |
| `ARCHITECTURE_WORKPLAN.md` is the current entry point for assigning next work. | Current entry point is PR-derived status plus overrides, then old workplan. |
| Backend repo bootstrap is still pending/destructive split not approved. | Repo ownership split is complete: backend belongs to `lian-platform-server`; frontend belongs to `lian-mobile-web`. |
| Frontend app split/classic scripts are the new baseline. | Classic scripts remain the 4300 compatibility lane; Vue canary on 4301 is now a real migration lane with product paths. |
| Publish V2 is planned or rough/single-image. | Recent Vue canary PRs added publish flow and Map V2 location draft support; check current code before planning missing work. |
| Task-board web UI is planned first cut. | Task-board dashboard, structure panel, and architecture diagram have landed. |
| Map V2 design-only or do-not-add Leaflet decisions. | Superseded by Map V2 implementation and later map decisions; map geometry/data still requires human assistance. |

## Active current decisions

- Frontend repo uses dual lanes: 4300 legacy/static rehearsal and 4301 Vue canary.
- Vue canary work should be checked against merged PRs before creating new tasks.
- Backend/API/runtime work belongs in `lian-platform-server`.
- `lian-mobile-web-full` is historical only.
- AI may suggest drafts, but must not automatically publish or approve content.
- Map geometry/data/editor work remains human-assisted.
- Do not mix feed ranking, publish, map, auth, and frontend shell/runtime changes in one PR.
- Any API shape change must coordinate with backend contract/docs and the backend repo.

## Still-valid historical decisions

The following old decisions remain valid unless current code/PRs prove otherwise:

- NodeBB remains the content backend.
- LIAN owns the campus experience layer.
- AI suggestions are draft-only.
- `locationId` is the formal place key direction.
- `locationArea` is legacy compatibility text.
- Feed curation must not permanently lock the whole homepage.
- Task market, errands, and drones remain deferred.
