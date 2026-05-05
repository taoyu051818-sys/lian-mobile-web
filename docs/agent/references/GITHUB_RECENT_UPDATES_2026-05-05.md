# GitHub Recent Updates - 2026-05-05

This note aligns the active GitHub repositories after the repo-split work and the frontend PR burst.

## Current Source-Of-Truth

The full-stack repo is no longer the runtime source of truth.

| Repository | URL | Role |
|---|---|---|
| Backend | `https://github.com/taoyu051818-sys/lian-platform-server` | Current backend/API/runtime source of truth. Verified `main` exists at `4de844b` on 2026-05-05. |
| Frontend | `https://github.com/taoyu051818-sys/lian-mobile-web` | Current mobile web/frontend/static app source of truth. |
| Historical full-stack | `https://github.com/taoyu051818-sys/lian-mobile-web-full` | Retired full-stack transition repository. Use only as history/rollback reference, not as active deployment target. |

## Remote Map

| Remote | Repository | Current role |
|---|---|---|
| `full` | `taoyu051818-sys/lian-mobile-web-full` | Historical full-stack transition source. Full-stack is stopped/decommissioned; do not deploy from `full/main` except for an explicit rollback exercise. |
| `origin` | `taoyu051818-sys/lian-mobile-web` | Frontend/static mobile web repository. Current public GitHub UI shows `0 Open / 34 Closed` PRs. |

Backend runtime work now lives in `lian-platform-server`. Server deploy docs must point there, not to `lian-mobile-web-full`.

## Historical Full-Stack / Split Remote: `full`

Current fetched head, retained for history:

```text
cab0ec7 full/main Merge pull request #20 from cleanup/frontend-only-repo
```

Recent PRs and commits after the previous 2026-05-04 baseline:

| PR / Commit | Area | Summary | Doc implication |
|---|---|---|---|
| #16 `3c8c725` | Repo split / backend export | Skip runtime data in backend export. | Runtime files such as auth users, caches, reads, and AI JSONL records must stay local and ignored. |
| #17 `aa5c6f0` | Repo split / backend export | Generate backend-only validation in export. | Backend repo validation should be owned by `lian-platform-server`, not the frontend repo. |
| #18 `c418d85` | Frontend static rehearsal | Add static rehearsal server for frontend proxy testing. | Frontend repo can run static app on `4300` with API proxy to backend staging. |
| #19 `1f29756` | Publish UI fix | Prevent publish page horizontal offset. | Publish layout offset is accepted as fixed in recent split work. |
| #20 `cab0ec7` | Repo split cleanup | Remove backend entrypoint, `src/server`, backend tests/export scripts from mobile web repo. | First cleanup PR completed the code-layer frontend-only split. `data/*` cleanup remains second PR scope. |

Validation state from local execution before PR #20 push:

```text
npm run check: 40 passed, 0 failed
frontend static rehearsal: 4300 starts and serves / as 200
local smoke: 28 passed, 2 failed only because local 4200/4201 backend staging was not running
```

Server-side expected validation remains:

```text
backend staging: 4200
image proxy staging: 4201
frontend static rehearsal: 4300
smoke-frontend on 4300: expected 30 passed, 0 failed when backend staging is alive
```

## Frontend Remote: `origin`

Current fetched head:

```text
5f86490 origin/main chore: ignore frontend generated artifacts
```

Public GitHub PR state checked on 2026-05-05:

```text
0 open PRs
34 closed PRs
```

Recent merged / landed frontend work visible in `origin/main`:

| PR / Commit | Area | Summary |
|---|---|---|
| #24 `ae48910` | Runtime ops contract | Document runtime ops contract. |
| #25 `88d0ef7` | Vue canary | Add canary dev port support. |
| #26 `ddb3152` | Vue runtime | Add canary runtime supervisor. |
| #27 `fe764bd` | Vue feed | Add feed read-path fast path. |
| #28 `4b07d9a` | Vue messages/profile | Add profile/messages fast path. |
| #29 `8dd9008` | Vue auth | Add auth fast path. |
| #31 `9e016ef` | Vue publish | Add publish fast path. |
| #32 `2db01b2` | Vue detail actions | Add detail actions fast path. |
| #34 `66feaaf` | Vue profile edit | Add profile edit fast path. |
| `c5bc270` | CI | Add frontend verification workflow. |
| `611476d` | Frontend ops | Add frontend verify script. |
| `46d1433` | Runtime deps | Self-heal frontend runtime dependencies before start. |
| `57d6932` | CI guard | Limit runtime inventory diff guard to CI context. |
| `fb88247` | Task board | Add progress dashboard and workstream visualization. |
| `1d5ad5e` | Task board | Add project structure map panel. |
| `5f86490` | Hygiene | Ignore frontend generated artifacts. |

The frontend repo is moving toward a Vue/runtime canary path plus task-board/ops observability. This is separate from the retired classic-script full-stack transition history documented in older agent docs.

## Open Documentation Alignment Needed

1. Treat repo split as completed at the code-layer cleanup stage.
2. Keep `data/*` migration/removal as a second cleanup PR, not part of the first cleanup.
3. Update deploy guidance:
   - Frontend static app uses `lian-mobile-web`.
   - Backend/API runtime should use `lian-platform-server`.
   - Do not instruct production backend pulls from `lian-mobile-web-full/main`.
4. Keep `docs/agent/contracts/api-contract.md` as the cross-repo API contract until a shared contracts repo exists.
5. Keep LIAN UI/UX guidelines under `docs/design/` as frontend/product design source of truth.
