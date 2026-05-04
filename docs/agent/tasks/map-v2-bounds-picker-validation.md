# Task: Map v2 Bounds And Picker Validation

## Goal

Make Map v2 safe for Publish V2 location picking by enforcing the approved campus bounds, validating picker output, and keeping editor-generated data out of the user-facing map until it is valid.

## Product scope

This task supports the Publish page and location asset loop. Users should be able to choose a coordinate-bearing location or skip location. Admin/editor work remains separate and must not break the public picker.

## Allowed files

- `src/server/map-v2-service.js`
- `public/map-v2.js`
- `public/publish-page.js`, only for picker contract integration
- `scripts/validate-locations.js`
- `scripts/validate-map-v2-layers.js`
- `data/locations.json`, only if validation fields must be corrected
- `data/map-v2-layers.json`, only if validation fields must be corrected
- `docs/agent/tasks/map-v2-bounds-picker-validation.md`
- `docs/agent/handoffs/map-v2-bounds-picker-validation.md`

## Forbidden files

- `src/server/feed-service.js`
- `src/server/post-service.js`
- `src/server/ai-light-publish.js`
- `data/feed-rules.json`
- Advanced road engine work
- Building floor-plan implementation
- External AI render pipeline implementation

## Data schema changes

No broad schema change.

If `map-v2-layers.json` does not already include `schemaVersion`, this task may add it only after documenting the expected shape and validator behavior.

Picker output must preserve the existing `locationDraft` contract while adding Map v2 coordinates:

```json
{
  "source": "map_v2",
  "locationId": "",
  "locationArea": "",
  "displayName": "",
  "lat": null,
  "lng": null,
  "legacyPoint": { "x": null, "y": null },
  "imagePoint": { "x": null, "y": null },
  "mapVersion": "gaode_v2",
  "confidence": 0,
  "skipped": false,
  "note": ""
}
```

If compatibility still requires a different `mapVersion`, document the reason in the handoff.

## API changes

No new endpoints.

Existing Map v2 admin save endpoints must reject out-of-bounds geometry.

## Acceptance criteria

- [x] Server-side bounds match the approved product bounds unless a documented decision explicitly expands them:
  - southwest: `18.373050, 109.995380`
  - northeast: `18.413856, 110.036262`
- [x] Admin saves reject locations, areas, roads, routes, and draft points outside the approved bounds.
- [ ] User-facing picker cannot confirm a point outside the approved bounds.
- [ ] Picker has both confirm and skip actions.
- [ ] Confirmed picker output includes `lat`, `lng`, `source`, `mapVersion`, `locationArea`, and `displayName` when available.
- [ ] Skip output uses `source: "skipped"` and `skipped: true`.
- [ ] `metadata.locationArea` precedence remains: user chosen location, AI locationArea, user hint, empty string.
- [x] User-facing map consumes only validated `locations` and `map-v2-layers` data.
- [x] Validation scripts reject malformed coordinates and out-of-bounds geometry.

## Validation commands

```bash
node --check src/server/map-v2-service.js
node --check public/map-v2.js
node --check public/publish-page.js
node scripts/validate-locations.js
```

If a layer validator is added:

```bash
node scripts/validate-map-v2-layers.js
```

Manual smoke:

```text
1. Open Publish page.
2. Enter Map v2 picker.
3. Confirm an in-bounds coordinate.
4. Try to confirm an out-of-bounds coordinate.
5. Skip location.
6. Confirm draft review receives the expected locationDraft in both cases.
```

## Risks

- Risk: Existing map data may already sit outside the approved bounds. Mitigation: list exceptions in the handoff and require product approval before widening bounds.
- Risk: Changing `mapVersion` can break old consumers. Mitigation: preserve contract fields and document compatibility behavior.
- Risk: Editor validation can block legitimate future expansion. Mitigation: expansion requires explicit bounds decision, not silent code drift.

## Rollback plan

- Revert bounds and picker validation changes.
- Restore previous map data from git if validation rewrites it.
- Keep validator failures documented for follow-up.

---

## Review Blockers Added 2026-05-03

Lane H status: **accepted** (bounds consistency resolved).

Finding:

- `src/server/map-v2-service.js` uses the approved product bounds:
  - south `18.373050`
  - west `109.995380`
  - north `18.413856`
  - east `110.036262`
- `scripts/validate-locations.js` still uses the old wider bounds:
  - south `18.3700734`
  - west `109.9940365`
  - north `18.4149043`
  - east `110.0503482`

Impact:

- `node scripts/validate-locations.js` can pass while locations or layer geometry are outside the approved product bounds.
- The claim "all locations + all layer geometry verified within bounds" is not reliable until the validator uses the same bounds as the server.

Required fix:

1. Update `scripts/validate-locations.js` to use the approved product bounds.
2. Prefer importing or sharing the bounds constant if practical, so service and validator cannot drift again.
3. Re-run:

```bash
node --check src/server/map-v2-service.js
node scripts/validate-locations.js
```

Review validation run:

```bash
node --check src/server/map-v2-service.js
node scripts/validate-locations.js
```

Result:

- syntax passed;
- validation passed, but against old bounds, so H remains not approved.

---

## Fix Pass Result Added 2026-05-03

Status: fixed, pending reviewer re-run.

Recorded implementation result:

- `scripts/validate-locations.js` now uses the approved product bounds:
  - southwest: `18.373050, 109.995380`
  - northeast: `18.413856, 110.036262`
- The validator bounds drift blocker is reported fixed.
- The broader fix pass reports 143/143 tests passing.

Reviewer validation:

```bash
node --check src/server/map-v2-service.js
node --check scripts/validate-locations.js
node scripts/validate-locations.js
```

If validation passes, Lane H can move from not approved to accepted for bounds validation. The picker-specific acceptance items still need browser checks if not already covered by a separate Publish V2 smoke.
