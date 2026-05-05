# Handoff: feed-ops-snapshot-diff

Date: 2026-05-02

## Summary

Added `--diff` mode to `scripts/snapshot-feed.js` for comparing two feed snapshots and highlighting changes.

## Files changed

| File | Change |
|---|---|
| `scripts/snapshot-feed.js` | Added `parseSnapshot()`, `parseCountTable()`, `diffCounts()`, `diffSnapshots()`, `--diff` arg parsing |

## What was done

- `--diff <before> <after>` reads two snapshot markdown files and produces a diff report
- Diff output covers: overall metrics (total/official/cover), contentType distribution, locationArea distribution, added/removed tids, position shifts for kept tids
- Existing snapshot generation unchanged
- Diff output saved to `outputs/feed-diff-{timestamp}.md`

## Usage

```bash
# Generate snapshots as before
node scripts/snapshot-feed.js
node scripts/snapshot-feed.js --base-url http://localhost:4100 --limit 12

# Compare two snapshots
node scripts/snapshot-feed.js --diff outputs/before.md outputs/after.md
```

## Validation

- `node --check scripts/snapshot-feed.js` passes
- Tested with two real snapshots: `feed-snapshot-20260501-161614.md` vs `feed-snapshot-20260501-162140.md`
- Diff correctly reports 60→72 total, contentType shifts, 1 added/5 removed tids, 39 position changes

## Risks

- Snapshot markdown format is the parser's contract; if snapshot format changes, diff parser must be updated
- Position changes are based on flattened order across all tabs/pages

## Rollback

Revert `scripts/snapshot-feed.js`.
