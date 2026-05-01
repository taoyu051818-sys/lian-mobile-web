# Task: Feed Optimization

## Goal

Completed: improve recommendation feed quality while preserving operator control and making feed behavior observable.

## Scope

Completed scope:

- changed recommendation page 1 from full curated-page lock to curated entry plus ranked rest;
- kept `feedEditions` compatible;
- added content type and missing-location scoring signals;
- updated moment scoring with parallel signals;
- filled selected metadata gaps;
- generated before/after snapshots.

## Out of Scope

Still out of scope unless a new task explicitly reopens it:

- new recommendation algorithms;
- new product tabs;
- LLM automation;
- place detail pages;
- food map product;
- changes unrelated to feed observability, metadata quality, or feed behavior.

## Inputs

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../domains/FEED_SYSTEM.md`
- `../HANDOFF_feed-optimization.md`
- `../handoffs/feed-optimization.md`
- before snapshot: `../../outputs/feed-snapshot-20260501-161614.md`
- after snapshot: `../../outputs/feed-snapshot-20260501-162140.md`

## Validation

Historical validation was recorded in `../HANDOFF_feed-optimization.md`.

Expected checks for future feed changes:

```powershell
node --check server.js
node --check scripts\snapshot-feed.js
node --check scripts\validate-post-metadata.js
node scripts\validate-post-metadata.js
node scripts\snapshot-feed.js --base-url http://localhost:4100
```

Use `/api/feed-debug` with `ADMIN_TOKEN` to confirm ranking and filtering reasons.

## Deliverables

Completed deliverables:

- hybrid recommendation page behavior;
- `curatedSlotsPerPage: 3`;
- `rankedRestOnCuratedPages: true`;
- recommendation page 1 changed from `9/9` general to `2/12` general;
- recommendation page 1 filled `locationArea` changed from `0/9` to `10/12`;
- total sampled `general` changed from `30/60` to `13/72`;
- total sampled empty `locationArea` changed from `30/60` to `13/72`;
- metadata filled for tids `91-97`, `99`, and `100`;
- before/after snapshots.

## Handoff file

Current handoff:

- `../handoffs/feed-optimization.md`

Historical original:

- `../HANDOFF_feed-optimization.md`

