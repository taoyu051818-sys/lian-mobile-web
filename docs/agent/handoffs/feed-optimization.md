# Handoff: Feed Optimization

This normalized handoff corresponds to the older root file:

```text
../HANDOFF_feed-optimization.md
```

Keep the root file for historical detail.

## Status

Completed on 2026-05-01.

## Summary

Recommendation feed now supports curated entry plus ranked rest:

- `curatedSlotsPerPage: 3`
- `rankedRestOnCuratedPages: true`

Scoring additions:

- `contentTypeWeights`
- `missingLocationAreaPenalty`
- `momentContentTypeWeights`
- `momentMissingLocationAreaPenalty`

Metadata filled:

- tids `91-97`
- tid `99`
- tid `100`

## Snapshot Results

Snapshots:

- before: `outputs/feed-snapshot-20260501-161614.md`
- after: `outputs/feed-snapshot-20260501-162140.md`

Recommendation page 1:

- `general`: `9/9` before, `2/12` after
- filled `locationArea`: `0/9` before, `10/12` after

Total sampled pages:

- `general`: `30/60` before, `13/72` after
- empty `locationArea`: `30/60` before, `13/72` after

## Next Thread Notes

Do not add more scoring strategy without a new task and fresh snapshot comparison.

Use `/api/feed-debug` and metadata validation before changing feed behavior again.

