# Task: feed-ops-snapshot-diff

## Goal

Make feed changes measurable by adding snapshot diff tooling and documenting the operating loop for feed tuning.

## Product scope

This task does not change ranking behavior. It improves operator confidence before future ranking changes.

## Allowed files

- `scripts/snapshot-feed.js`
- `outputs/*`
- `docs/agent/domains/FEED_SYSTEM.md`
- `docs/agent/tasks/feed-ops-snapshot-diff.md`
- `docs/agent/handoffs/feed-ops-snapshot-diff.md`

## Forbidden files

- `src/server/feed-service.js`
- `data/feed-rules.json`
- `data/post-metadata.json`
- publish, auth, or map files

## Data schema changes

None.

## API changes

None.

## Acceptance criteria

- [x] `scripts/snapshot-feed.js --diff <before> <after>` produces a readable diff.
- [x] Diff highlights content type distribution, location coverage, official ratio, image ratio, and changed tids.
- [x] Existing snapshot generation still works.
- [x] No feed runtime behavior changes.

## Validation commands

```bash
node --check scripts/snapshot-feed.js
node scripts/snapshot-feed.js
node scripts/snapshot-feed.js --diff outputs/example-before.md outputs/example-after.md
```

## Risks

- Snapshot text format may be brittle if used as the only data source.
- Diff should not become a hidden ranking algorithm.

## Rollback plan

- Revert script changes.
- Keep generated snapshots under `outputs/` only when they are useful for review.

