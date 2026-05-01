# HANDOFF: agent/feed-optimization

Date: 2026-05-01

## Scope

This thread optimized the LIAN recommendation feed and moment feed without adding map work, LLM work, publishing changes, permission work, or NodeBB rewrites.

Changed files:

- `server.js`
- `data/feed-rules.json`
- `data/post-metadata.json`
- `docs/agent/HANDOFF_feed-optimization.md`

Generated snapshots:

- Before: `outputs/feed-snapshot-20260501-161614.md`
- After: `outputs/feed-snapshot-20260501-162140.md`

## Algorithm Changes

Recommendation feed now supports a hybrid curated/ranked mode:

- `feedEditions.pages` still provides manual operator picks.
- `feedEditions.curatedSlotsPerPage` limits how many manual picks are used at the top of a recommendation page.
- `feedEditions.rankedRestOnCuratedPages=true` fills the rest of the same page with scored and diversified ranked rest.
- This releases page 1/page 2 from the old full-page curated batches while preserving manual operation ability.

Scoring now includes two configurable signals:

- `scoring.contentTypeWeights`: boosts LIAN-native types such as `food`, `campus_moment`, `place_memory`, `campus_tip`, `library_moment`; demotes `general`, `official_recap`, and archive types.
- `scoring.missingLocationAreaPenalty`: lightly demotes items without `locationArea`.

Moment feed scoring now also reads:

- `scoring.momentContentTypeWeights`
- `scoring.momentMissingLocationAreaPenalty`

`/api/feed-debug` structure is preserved. Score breakdown now includes `contentType` and `locationArea` score components.

## Feed Rules Changes

`data/feed-rules.json`:

- Changed `feedEditions.strategy` to `curated-entry-plus-ranked-rest`.
- Set `rankedRestOnCuratedPages: true`.
- Set `curatedSlotsPerPage: 3`.
- Shortened curated recommendation page to `[99, 92, 91]`.
- Added content type weights for recommendation and moment feeds.
- Added missing location penalties.
- Tightened diversity from 3 to 2 for same `contentType` and same `locationArea`.

## Metadata Filled

`data/post-metadata.json`:

- `91`: `campus_activity`, location `运动区`.
- `92`: `library_moment`, location `图书馆`.
- `93`: `activity_archive`, location `试验区社团`.
- `94`: `activity_archive`, location `试验区社团`.
- `95`: `activity_archive`, location `试验区社团`.
- `96`: `activity_archive`, location `试验区社团`.
- `97`: `activity_archive`, location `试验区社团`.
- `99`: `food`, location `大墩村`.
- `100`: new metadata entry, `place_memory`, location `中国传媒大学楼`.

## Snapshot Comparison

Before recommendation page 1:

- 9 items returned.
- `general`: 9/9.
- `locationArea` filled: 0/9.
- Test/new ranked content: 0.
- Page was controlled by old `feedEditions` batch.

After recommendation page 1:

- 12 items returned.
- `general`: 2/12.
- `locationArea` filled: 10/12.
- Test/new ranked content appears on page 1.
- Page includes `food`, `campus_moment`, `place_memory`, `campus_tip`, `library_moment`, plus limited activity/opportunity style content.
- Old/general content is no more than 2 items on page 1.

Before moment page 1:

- `general`: 3/12.
- Empty `locationArea`: 3/12.
- Already had many test/local items, but old general could still sit high.

After moment page 1:

- `general`: 2/12.
- Empty `locationArea`: 2/12.
- Page includes food, campus moment, place memory, library moment, campus activity, campus tip.
- Old general still exists but is less dominant.

Overall snapshot comparison:

- Before 60 total cards across sampled pages; after 72 because recommendation page 2 is no longer underfilled by curated batches.
- Before sampled `general`: 30/60.
- After sampled `general`: 13/72.
- Before sampled empty `locationArea`: 30/60.
- After sampled empty `locationArea`: 13/72.

## Validation

Passed:

- `node --check server.js`
- `node --check scripts/snapshot-feed.js`
- `node --check scripts/validate-post-metadata.js`
- `node scripts/validate-post-metadata.js`
- `node scripts/snapshot-feed.js --base-url http://localhost:4100`

Note: local PATH `node.exe` was not executable in this Codex environment, so validation used bundled Node:

`C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

## Risks

- `campus_moment` and `campus_tip` weights are intentionally strong to make page 1 meet the current LIAN feed goal. Future content growth may require lowering them.
- Some older posts still lack metadata and remain validator warnings; this task only filled the requested critical tids.
- Curated slots are currently 3. Operators can still over-influence the top of page 1 by changing those three tids.
- Snapshot output is affected by live NodeBB recent data, so compare using generated snapshot files rather than assuming stable topic inventory.

## Rollback

To roll back the behavior:

1. In `data/feed-rules.json`, set `feedEditions.strategy` back to `daily-curated-batches`, remove `rankedRestOnCuratedPages` / `curatedSlotsPerPage`, and restore the old two curated pages.
2. Remove or neutralize `contentTypeWeights`, `momentContentTypeWeights`, and missing location penalties.
3. Revert the small `server.js` changes around curated/ranked hybrid fill and scoring components.
4. Metadata additions can remain safely, or be reverted for tids `91-97`, `99`, and `100` if strict rollback is required.
