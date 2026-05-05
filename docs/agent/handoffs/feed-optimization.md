# Handoff: Feed Optimization

Date: 2026-05-01

## Status

Completed.

## Scope

Optimized the LIAN recommendation feed and moment feed without adding map work, LLM work, publishing changes, permission work, or NodeBB rewrites.

## Changed Files

- `src/server/feed-service.js` — hybrid curated/ranked fill, new scoring signals
- `data/feed-rules.json` — feed editions config, content type weights, location penalties
- `data/post-metadata.json` — metadata filled for critical tids

## Algorithm Changes

Recommendation feed now supports a hybrid curated/ranked mode:

- `feedEditions.pages` still provides manual operator picks.
- `feedEditions.curatedSlotsPerPage` (default 3) limits how many manual picks are used at the top of a recommendation page.
- `feedEditions.rankedRestOnCuratedPages=true` fills the rest of the same page with scored and diversified ranked rest.
- This releases page 1 from the old full-page curated batches while preserving manual operation ability.

Scoring now includes two configurable signals:

- `scoring.contentTypeWeights`: boosts LIAN-native types (`food`, `campus_moment`, `place_memory`, `campus_tip`, `library_moment`); demotes `general`, `official_recap`, and archive types.
- `scoring.missingLocationAreaPenalty`: lightly demotes items without `locationArea`.

Moment feed scoring now also reads:

- `scoring.momentContentTypeWeights`
- `scoring.momentMissingLocationAreaPenalty`

`/api/feed-debug` score breakdown now includes `contentType` and `locationArea` components.

## Feed Rules Changes

`data/feed-rules.json`:

- `feedEditions.strategy` changed to `curated-entry-plus-ranked-rest`
- `rankedRestOnCuratedPages: true`
- `curatedSlotsPerPage: 3`
- Curated recommendation page shortened to `[99, 92, 91]`
- Added content type weights for recommendation and moment feeds
- Added missing location penalties
- Tightened diversity from 3 to 2 for same `contentType` and same `locationArea`

## Metadata Filled

`data/post-metadata.json`:

- `91`: `campus_activity`, location `运动区`
- `92`: `library_moment`, location `图书馆`
- `93-97`: `activity_archive`, location `试验区社团`
- `99`: `food`, location `大墩村`
- `100`: `place_memory`, location `中国传媒大学楼`

## Snapshot Comparison

Generated snapshots:

- Before: `outputs/feed-snapshot-20260501-161614.md`
- After: `outputs/feed-snapshot-20260501-162140.md`

Recommendation page 1:

- Before: 9 items, `general` 9/9, `locationArea` filled 0/9
- After: 12 items, `general` 2/12, `locationArea` filled 10/12

Total sampled pages:

- Before: `general` 30/60, empty `locationArea` 30/60
- After: `general` 13/72, empty `locationArea` 13/72

## Validation

Passed:

- `node --check server.js`
- `node --check scripts/snapshot-feed.js`
- `node --check scripts/validate-post-metadata.js`
- `node scripts/validate-post-metadata.js`
- `node scripts/snapshot-feed.js --base-url http://localhost:4100`

## Risks

- `campus_moment` and `campus_tip` weights are intentionally strong for current LIAN goals. Future content growth may require lowering them.
- Some older posts still lack metadata and remain validator warnings.
- Curated slots are 3. Operators can over-influence page 1 by changing those three tids.
- Snapshot output is affected by live NodeBB data; compare using generated snapshot files.

## Rollback

1. In `data/feed-rules.json`, set `feedEditions.strategy` back to `daily-curated-batches`, remove `rankedRestOnCuratedPages` / `curatedSlotsPerPage`, restore old curated pages.
2. Remove `contentTypeWeights`, `momentContentTypeWeights`, and missing location penalties.
3. Revert `feed-service.js` changes around curated/ranked hybrid fill and scoring components.
4. Metadata additions can remain safely.

## Next Thread Notes

Do not add more scoring strategy without a new task and fresh snapshot comparison. Use `/api/feed-debug` and metadata validation before changing feed behavior again.
