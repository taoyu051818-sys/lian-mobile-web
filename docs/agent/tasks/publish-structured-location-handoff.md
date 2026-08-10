# Task: publish-structured-location-handoff

## Current source check

- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F2c acceptance `a357799`.
- Working branch: `codex/audit-f2d-publish-structured-location`.
- Control issue: [#1089](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1089).
- Open issues were searched for map-picker, coordinate-system, handoff, and
  structured-location duplicates before #1089 was opened. None owns this
  contract.

## Problems

1. Map free-pin and browser geolocation both write the same unversioned
   `coords` payload. Publish then discards both coordinates and falls back to
   text/manual location.
2. If place A is already selected and a new picker handoff for B arrives before
   the catalog contains B, only the visible name changes. The structured draft
   can still submit A.
3. Map V2 is GCJ-02 while browser geolocation is WGS84. Treating both as one
   source would silently mislabel or shift coordinates.
4. Catalog load, account-scoped draft restore, handoff consumption, and a late
   geolocation callback can overwrite one another.
5. A successful picker confirmation leaves its selection in the long-lived Map
   instance, so the next picker entry can reuse stale state.

## Goal

Make Publish location state an explicit, source-aware contract. A map place or
free pin must reach the final publish payload with the original GCJ-02 data. A
browser location must remain explicitly WGS84 and display-only until a separate
conversion/backend contract is approved. New handoffs replace old bindings
atomically and survive catalog ordering and account-scoped draft restoration.

## Coordinate policy

- Map picker data is `source: "map_picker"`, `coordinateSystem: "gcj02"`.
- Browser geolocation is `source: "browser_geolocation"`,
  `coordinateSystem: "wgs84"`.
- F2d performs no coordinate conversion.
- Only map-picker GCJ-02 data can create a structured `map_v2` location draft.
- Browser WGS84 is shown to the user but publishes through the existing
  manual/display-only lane; map wire coordinates remain null.
- Latitude and longitude must both be finite and inside `[-90, 90]` and
  `[-180, 180]`. Source/system mismatches are rejected.

## Handoff compatibility

Keep the existing storage key and add a versioned discriminated union:

```ts
type PublishLocationHandoffV2 =
  | {
      version: 2;
      source: "map_picker";
      coordinateSystem: "gcj02";
      kind: "place";
      locationId?: string;
      placeId: string;
      name: string;
      type?: string;
      lat: number;
      lng: number;
    }
  | {
      version: 2;
      source: "map_picker";
      coordinateSystem: "gcj02";
      kind: "coords";
      lat: number;
      lng: number;
      label?: string;
    }
  | {
      version: 2;
      source: "browser_geolocation";
      coordinateSystem: "wgs84";
      kind: "coords";
      lat: number;
      lng: number;
      accuracy?: number;
    };
```

- Legacy `place` can be normalized to map-picker/GCJ-02 because its only
  producer is the existing map picker.
- Legacy `coords` has no reliable source. Normalize it to
  `legacy/unknown` and keep it display-only.
- Unknown versions, invalid ranges, incomplete pairs, and source/system
  mismatches are destructively cleared.
- Add an optional structured binding to the existing scoped draft snapshot.
  Old snapshots read as `null`; the storage key does not change.

## State and ordering

- `usePublishLocationOptions` owns one explicit structured map binding in
  addition to the canonical catalog selection.
- Applying B clears A before any visible or structured field for B is written.
- Catalog already loaded: rebind B to the canonical `MapLocation` by stable
  `placeId`.
- Catalog late or missing: immediately retain a complete structured fallback
  from the handoff; a later successful catalog load may canonicalize it.
- Free pin creates `map_v2/gcj02/map_selection` without fabricating a place.
- Browser WGS84 clears any map binding and remains display-only.
- Consume pending handoff only after account-scoped restore is settled and
  while Publish is active, so the current picker action wins over older draft
  state.
- Starting the picker invalidates an outstanding browser-geolocation attempt.
  A late or deactivated attempt cannot write or consume handoff state.
- Successful picker confirmation clears the Map selection.

## Allowed files

Implementation:

- `src/config/brand/publish.ts`
- `src/features/publish/index.ts`
- `src/features/publish/usePublishLocationHandoff.ts`
- `src/features/map/useMapPickerMode.ts`
- `src/features/publish/useGeolocation.ts`
- `src/features/publish/usePublishLocationOptions.ts`
- `src/features/publish/PublishView.vue`
- `src/features/publish/PublishLocationControls.vue`
- `src/features/publish/publishDraftSession.ts`
- `src/features/publish/usePublishDraftSession.ts`

Tests:

- `tests/config/brand.test.ts`
- `tests/publish/usePublishLocationHandoff.test.ts`
- `tests/map/useMapPickerMode.test.ts`
- `tests/publish/useGeolocation.test.ts`
- `tests/publish/usePublishLocationOptions.test.ts`
- `tests/publish/publishDraft.test.ts`
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `tests/e2e/publish-structured-location-handoff.spec.ts`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-structured-location-handoff.md`
- `docs/agent/handoffs/publish-structured-location-handoff.md`

## Forbidden files

- `src/app/AppViewHost.vue` and all F2c KeepAlive/lease behavior.
- `src/app/deepLink.ts`.
- `src/api/publish.ts`, `src/api/map.ts`, and `src/types/**`.
- AI, upload, Event, Merchant, and Trade files.
- Backend, dependency, deployment, and production configuration files.
- Direct-picker return navigation/history redesign; that is a separate lane.
- Any file outside the allowed list.

## Acceptance criteria

- [ ] V2 known place round-trips all IDs, source, system, and coordinates.
- [ ] V2 free pin reaches the final draft as
      `map_v2/gcj02/map_selection`.
- [ ] Browser geolocation remains WGS84, is not converted or mislabeled, and
      produces display-only/manual wire state with null map coordinates.
- [ ] Invalid ranges, incomplete pairs, unknown versions, and source/system
      mismatches are rejected and cleared.
- [ ] Legacy place reads safely as map/GCJ-02; legacy coords reads as
      legacy/unknown display-only.
- [ ] Applying B while A is selected can never submit A, even if the catalog is
      late, fails, or does not contain B.
- [ ] Catalog-before-handoff and handoff-before-catalog converge on the same
      binding without losing fallback data.
- [ ] A scoped draft restores the optional binding without crossing accounts;
      old snapshots remain readable.
- [ ] A late/deactivated geolocation result cannot overwrite a newer map
      handoff or consume state owned by another Publish instance.
- [ ] Picker confirmation clears its selection; the next picker entry starts
      empty and disabled.
- [ ] Focused tests demonstrate intended failures on the old implementation,
      then pass on the new implementation.
- [ ] Deterministic local browser journeys, build, and full `npm run verify`
      pass.
- [ ] Only allowed files are changed.

## Validation commands

```bash
npx vitest run \
  tests/publish/usePublishLocationHandoff.test.ts \
  tests/map/useMapPickerMode.test.ts \
  tests/publish/useGeolocation.test.ts \
  tests/publish/usePublishLocationOptions.test.ts \
  tests/publish/publishDraft.test.ts \
  tests/publish/publishLocationHandoff.structure.test.ts
npx playwright test tests/e2e/publish-structured-location-handoff.spec.ts
npm run build
npm run verify
```

Configured remote account journeys may be skipped locally. Deterministic
loopback journeys must not use an online account or production API.

## Rollback

Revert the implementation and acceptance-document commits. The new handoff and
snapshot fields are backwards-compatible additions under existing storage
keys. If needed, clear only the pending location handoff and the affected
account-scoped Publish draft; no server, API, database, or deployment migration
is required.
