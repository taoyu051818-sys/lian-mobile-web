# Feed System

## Purpose

The feed system turns NodeBB topics plus LIAN metadata into student-facing mobile feed cards.

## Current Status

Feed optimization is completed as of 2026-05-01.

Recommendation page 1 now uses a hybrid model:

- 3 curated slots from `feedEditions.curatedSlotsPerPage`
- ranked rest when `feedEditions.rankedRestOnCuratedPages` is true

This replaces the old full-page curated lock for recommendation page 1.

## Source Of Truth

- NodeBB: topics, replies, users, tags, categories, moderation state.
- `data/post-metadata.json`: LIAN-specific metadata by `tid`.
- `data/feed-rules.json`: tabs, curated editions, feature flags, scoring, diversity.

## Current Flow

```text
NodeBB recent/topics
  -> normalizeTopic()
  -> metadata merge
  -> isFeedEligible()
  -> tab selection
  -> feedEditions curated slots
  -> ranked rest when enabled
  -> scoreItem()
  -> diversifyItems()
  -> hydrate details
  -> final /api/feed response
```

## New Scoring Signals

Recommendation scoring now includes:

- `contentTypeWeights`
- `missingLocationAreaPenalty`

Moment scoring now includes:

- `momentContentTypeWeights`
- `momentMissingLocationAreaPenalty`

`/api/feed-debug` should expose score components for review.

## Measured Result

Snapshots:

- before: `outputs/feed-snapshot-20260501-161614.md`
- after: `outputs/feed-snapshot-20260501-162140.md`

Recommendation page 1:

- `general`: `9/9` before, `2/12` after
- filled `locationArea`: `0/9` before, `10/12` after

Total sampled pages:

- `general`: `30/60` before, `13/72` after
- empty `locationArea`: `30/60` before, `13/72` after

Metadata was filled for tids `91-97`, `99`, and `100`.

## Operating Rules

- Use `/api/feed-debug` for ranking and filter explanations.
- Use `scripts/snapshot-feed.js` before and after behavior changes.
- Use `scripts/validate-post-metadata.js` before metadata-dependent feed work.
- Keep `feedEditions` available for operators, but do not let it lock the whole homepage.
- Do not add more scoring strategy without a new task and fresh snapshots.

## Related Files

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../tasks/feed-optimization.md`
- `../handoffs/feed-optimization.md`
- `../HANDOFF_feed-optimization.md`

