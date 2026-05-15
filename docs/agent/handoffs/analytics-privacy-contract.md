# Analytics Privacy Contract Handoff

## What landed

This bounded docs-only slice adds `docs/frontend/analytics-privacy-contract.md` as a frontend source document for issue `#158`.

It defines:
- a normalized product analytics event envelope
- event taxonomy and naming expectations
- privacy levels and forbidden fields
- consent and reduced-tracking states
- separation between analytics identity and auth or messaging identity
- impression de-duplication and conservative offline/batching policy
- a future `src/analytics/**` wrapper boundary

## Why this slice exists

Issue `#158` is a cross-surface contract problem rather than just an SDK choice. This doc gives later implementation work a reviewed privacy boundary before any runtime event transport is added.

## Validation status

- manual doc sanity against issue `#158` and current repo README/docs guidance: PASS
- `npm run check`: NOT RUN in this execution lane because the repo was not mounted as a runnable local checkout and the change was delivered through GitHub file edits

## Follow-up work

Suggested next bounded slices:
- add typed `src/analytics/**` schema and wrapper foundations with tests only
- add development-time forbidden-key rejection
- add consent-state contract wiring with a no-op transport path
- defer vendor SDK or backend ingest work until those foundations exist

## Risks / rollback

Risk is low because this is documentation only.
Rollback is straightforward: revert the single docs PR if the contract wording needs to change.

## Linkage

Related to #158.
Part of #158.
Does not close #158.
