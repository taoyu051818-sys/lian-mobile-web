# Handoff: publish-structured-location-handoff

## Current source check

- Current upstream source checked: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite checked: F2c acceptance `a357799`.
- Working branch: `codex/audit-f2d-publish-structured-location`.
- Control issue checked: [#1089](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1089).
- Root `README.md`, `package.json`, task contract, Publish/Map ownership docs,
  current route/runtime code, and existing F2c handoff were checked.
- This handoff supersedes the unversioned Publish location handoff behavior
  described by the older map-picker flow. It does not supersede F2c's
  KeepAlive/lease contract.

## Summary

- Replaced the unversioned location envelope with source-aware V2 variants:
  Map picker data is GCJ-02; browser geolocation is explicitly WGS84.
- Preserved map place/free-pin IDs and coordinates through catalog ordering,
  scoped draft restore, and final `map_v2` payload creation.
- Kept browser and ambiguous legacy coordinates display-only, with null map
  coordinates on the publish wire.
- Made non-null snapshot bindings authoritative so damaged WGS84 data cannot
  fall back through `selectedMapLocation` and be mislabeled as GCJ-02.
- Added request-generation invalidation for delayed geolocation callbacks and
  cleared the long-lived Map picker selection after confirmation.

## Files changed

- `scripts/check-test-inventory.mjs`: update the approved Vitest inventory from
  156 to 157.
- `src/config/brand/publish.ts`: add source/coordinate explanatory copy.
- `src/features/map/useMapPickerMode.ts`: write V2 GCJ-02 handoffs and clear
  confirmed selection.
- `src/features/publish/usePublishLocationHandoff.ts`: define and validate V2
  write types, normalized legacy reads, and destructive invalidation.
- `src/features/publish/usePublishLocationOptions.ts`: own the authoritative
  map binding, reconcile catalog UI, and build the final structured draft.
- `src/features/publish/publishDraftSession.ts`: persist and strictly normalize
  the optional authoritative binding.
- `src/features/publish/usePublishDraftSession.ts`: restore the binding only
  after the account scope settles.
- `src/features/publish/useGeolocation.ts`: label WGS84 results and ignore stale
  callback generations.
- `src/features/publish/PublishView.vue`: apply source-aware handoffs in the
  correct restore/activation order.
- `src/features/publish/PublishLocationControls.vue`: render fallback map pins
  as bound and keep the manual-switch affordance.
- `src/features/publish/index.ts`: export the new location handoff types.
- `tests/config/brand.test.ts`, `tests/map/useMapPickerMode.test.ts`,
  `tests/publish/publishDraft.test.ts`,
  `tests/publish/publishLocationHandoff.structure.test.ts`,
  `tests/publish/useGeolocation.test.ts`, and
  `tests/publish/usePublishLocationHandoff.test.ts`: extend regression coverage.
- `tests/publish/usePublishLocationOptions.test.ts`: add atomic replacement,
  catalog-order, wire-payload, and display-only tests.
- `tests/e2e/local/publish-structured-location-journeys.spec.ts`: add two
  loopback-only browser journeys.

## Repository and ownership notes

- Repository touched: `lian-mobile-web`.
- Owned areas touched: Publish feature, Map picker feature, frontend tests, and
  the test inventory guard.
- Backend/API/runtime changes needed: None.
- F2c `AppViewHost` KeepAlive/lease code was not modified.

## API or contract changed

No HTTP API changed.

Internal frontend state contracts changed:

- `lian:publish:pendingLocation` keeps the same key but writes only V2,
  source-aware payloads.
- `lian.publishDraft.sameSession::<scope>` adds an optional
  `mapPickerBinding` field. Old snapshots without it remain readable.
- Existing final `PublishLocationDraft` wire shapes are unchanged: map data is
  still `map_v2/gaode_v2/gcj02`; display-only data is still
  `manual/none` with null coordinates.

## Data or state changed

- Session-scoped browser storage gains the optional V2 binding described
  above. No server, database, Redis, file-store, or production data changed.
- Invalid/non-null bindings are dropped together with any duplicate canonical
  selection. Safe text fields remain recoverable as manual display text.

## How to verify

1. Run the six focused Vitest files listed in the task document.
2. Run `npm run build` and `npm run verify` with the repository's Node 22/npm
   toolchain.
3. Run the two browser journeys only through
   `playwright.local.config.ts`, or use an equivalent deterministic loopback
   harness. Never use the default online Playwright target for this task.
4. Confirm the map journey submits `location-b-picker/place-b`, GCJ-02, and B's
   coordinates rather than restored A.
5. Confirm the browser WGS84 journey submits manual/display-only state with
   `lat: null`, `lng: null`, and `coordinateSystem: "none"`.

## Test result

```text
Focused Vitest: 6 files / 86 tests passed
Independent typecheck: passed
npm run build: passed (642 modules)
npm run verify: exit 0
  - 157 Vitest files / 4,018 tests passed
  - 65 Node structure files / 817 tests passed
  - sanitizer passed
  - loopback smoke 3/3 passed
Deterministic in-app loopback browser verification: 2/2 passed
  - Map B replaced restored A and submitted map_v2/gcj02
  - Browser WGS84 submitted manual/display-only with null coordinates
Browser console errors during the journeys: 0
```

The independent reviewer recorded `ACCEPT` with no remaining blocking
findings after the authoritative snapshot-binding repair.

## Known risks

- No coordinate conversion is performed. Browser WGS84 remains intentionally
  display-only until a separate backend/coordinate contract is approved.
- The repository's packaged Playwright browser was unavailable locally; the
  same journeys were completed with a deterministic in-app loopback harness.
- A direct map-picker entry/history redesign remains outside this lane.

## Not done

- No push, pull request, merge, deployment, production access, or server
  mutation.
- No backend location schema or API change.
- No redesign of direct picker return history.
- No broader account-switch/re-entry redesign for Publish drafts; audit that
  state machine separately before changing it.

## Acceptance note

Local acceptance is recorded by the independent reviewer and the verification
evidence above. Durable integration acceptance still belongs in a future PR or
newer status record after the branch is pushed by an authorized operator.

## Next suggested task

- `publish-draft-account-scope-reentry`: audit and test A → B → A identity
  changes in one mounted Publish instance so a previously visited scope cannot
  retain or persist another account's in-memory draft.
