# LIAN Repository Relationship Register

Last verified: 2026-08-30

This file is the only authoritative repository relationship table for LIAN. Other repositories and
documents must link here instead of copying the table. A repository's default branch is not evidence
that it is deployable; the status and deployment authority below are decisive.

## Status definitions

- `canonical`: active source of truth and eligible release source for the stated runtime.
- `migration`: retained migration/reference implementation; not a production release source.
- `archived`: GitHub repository is read-only and retained only for history.
- `removed`: repository has been deliberately deleted after its final commit was recorded here.

## Relationship table

| Repository                                | Status      | Owns / may be used for                          | Deployment rule                                                          | Recorded boundary                                        |
| ----------------------------------------- | ----------- | ----------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `taoyu051818-sys/lian-mobile-web`         | `canonical` | LIAN Vue/Vite web frontend                      | Only frontend release source                                             | Production artifact must expose `/release-manifest.json` |
| `taoyu051818-sys/lian-platform-server`    | `canonical` | LIAN API, BFF, auth/session and backend runtime | Only LIAN backend release source                                         | Running SHA is `/api/system/health` → `revision`         |
| `taoyu051818-sys/gdplatform-dev`          | `canonical` | GD commerce provider and its UniApp client      | Independent provider/client release source; never a LIAN browser backend | LIAN integrates through the governed provider boundary   |
| `taoyu051818-sys/NodeBB`                  | `canonical` | Forum service dependency                        | Independent service release source                                       | LIAN backend is the integration boundary                 |
| `taoyu051818-sys/lian-nest-server`        | `migration` | Frozen Nest rewrite and migration evidence      | No deployment and no feature development while frozen                    | Frozen at `57b8d129c84c82fbe71fecd0aeea32b6ea01db00`     |
| `taoyu051818-sys/LIAN`                    | `archived`  | Original frontend history                       | Never deploy                                                             | Final `main`: `4e550d26c9089e5ca30674233d8420112656b87f` |
| `taoyu051818-sys/lian-mobile-web-full`    | `archived`  | Retired full-stack transition history           | Never deploy                                                             | Final `main`: `8596b147dc54d7a14ce79d6c11b5742fe4d93ede` |
| `taoyu051818-sys/-lian-mobile-web-legacy` | `archived`  | Retired static frontend history                 | Never deploy                                                             | Final `main`: `a9b545a817589bc0d398204e7fa357fc72def40c` |
| `taoyu051818-sys/lian-agent-os`           | `removed`   | No runtime or development responsibility        | Must not be restored as a LIAN dependency                                | Final `main`: `ba44f2174a903faa3458e39a89b8188d620a7195` |

## Change control

Changing any row requires a reviewed pull request in `lian-mobile-web` that explains ownership,
migration, release and rollback impact. Moving a repository to `canonical` also requires a release
manifest integration and an explicit deployment runbook. Recreating `lian-agent-os`, unarchiving an
old frontend, or deploying Nest is a status change and must update this register first.
