# E2E Acceptance - Actor/Source and PlaceSheet Contracts - 2026-05-06

This checklist is the focused QA track for #67 and the final acceptance path for #63.

It verifies the accepted contracts without expanding scope into auth implementation, deployment operations, UI motion, legacy cleanup, or PlaceSheet product redesign.

## Accepted contracts under test

### Actor / identityTag / source

```text
actor = display identity
identityTag = optional trust / contribution signal
source = platform / import / provider provenance metadata
```

Rules:

- UI identity uses `actor` first.
- `identityTag` is only an optional signal.
- `source`, provider labels, and NodeBB-style platform labels must not appear as identity UI.
- Legacy flat fields are temporary fallback only and should not be treated as the accepted contract.

### PlaceRef / PlaceSheet / fallback location text

```text
PlaceRef = stable place identity
PlaceSheet = durable place surface
locationArea/manual text = fallback display only, not identity
```

Rules:

- Frontend uses structured `place?: PlaceRef` / `placeId` when available.
- Frontend must not parse `locationArea`, place names, or manual text into stable place identity.
- `status` and `source` are backend-owned structured metadata.
- Source/provider text must not become identity or trust badge text unless a future product issue explicitly maps it.

## Pre-flight gates

Run these gates before manual product acceptance:

- [ ] #64 profile liked/saved auth regression is fixed or not blocking this test account.
- [ ] #65 deploy-state verification is complete for the environment under test.
- [ ] The served frontend build marker matches the expected main commit when available.
- [ ] Test account is logged in for authenticated publish/profile checks.
- [ ] Test data includes at least one post with `post.place.id` and at least one post with only fallback `locationArea`.
- [ ] If the environment cannot provide the required test data, record the gap in #67 instead of marking the item passed.

## Actor/source acceptance

### Feed card

- [ ] Open the feed/home surface.
- [ ] Confirm card author text never renders `[object Object]`.
- [ ] Confirm card author uses `actor.displayName` when available.
- [ ] Confirm fallback order remains readable when `actor.displayName` is absent.
- [ ] Confirm `source`, provider, or `NodeBB` does not appear as the card author or identity badge.

Evidence to record:

```text
Feed item tested:
Observed author text:
Observed identityTag, if present:
Observed source/provider leakage: yes/no
```

### Detail post author

- [ ] Open a feed item detail.
- [ ] Confirm detail post author comes from `post.actor`.
- [ ] Confirm detail author is not source/provider/NodeBB.
- [ ] Confirm `identityTag`, if present, reads as a signal rather than the speaking subject.

Evidence to record:

```text
Post id/tid:
Observed detail author:
Observed identityTag:
Observed source/provider leakage: yes/no
```

### Detail replies

- [ ] Open a detail view with replies.
- [ ] Confirm each reply author comes from `reply.actor` when available.
- [ ] Confirm reply identity does not use source/provider/NodeBB.
- [ ] Confirm missing actor fallback is readable and not `[object Object]`.

Evidence to record:

```text
Reply id(s):
Observed reply author(s):
Observed source/provider leakage: yes/no
```

### Messages channel

- [ ] Open Messages / channel surface.
- [ ] Confirm channel sender display uses `item.actor`.
- [ ] Confirm identityTag is only optional signal text.
- [ ] Confirm source/provider/NodeBB does not appear as sender identity.

Evidence to record:

```text
Message/channel item tested:
Observed sender:
Observed identityTag:
Observed source/provider leakage: yes/no
```

## PlaceSheet acceptance

### Detail with structured place

- [ ] Open a detail item where `post.place.id` exists.
- [ ] Confirm location pill is interactive.
- [ ] Tap the pill.
- [ ] Confirm PlaceSheet opens for the structured place.
- [ ] Confirm the displayed place name comes from structured place/sheet data.
- [ ] Confirm the frontend does not infer identity from `locationArea`.

Evidence to record:

```text
Post id/tid:
post.place.id:
Observed PlaceSheet title:
Fallback locationArea present: yes/no
```

### Detail without structured place

- [ ] Open a detail item where `post.place.id` is absent.
- [ ] Confirm `locationArea` may appear as plain display text.
- [ ] Confirm `locationArea` is not treated as stable PlaceRef.
- [ ] Confirm tapping fallback text does not fabricate a PlaceSheet identity.

Evidence to record:

```text
Post id/tid:
Observed fallback locationArea:
PlaceSheet opened from fallback text: yes/no
```

### Map selected location

- [ ] Open Map.
- [ ] Select a location that has `placeId` or `place`.
- [ ] Confirm selected location can open PlaceSheet.
- [ ] Confirm PlaceSheet uses structured place identity.
- [ ] Confirm source/status are not guessed from color, copy, or provider name.

Evidence to record:

```text
Map location id:
placeId/place.id:
Observed PlaceSheet title:
Observed source/status interpretation issue: yes/no
```

### Map nearby content path

- [ ] Open Map.
- [ ] Select a location with nearby posts.
- [ ] Tap `查看附近内容` or the equivalent nearby-content action.
- [ ] Confirm post detail still opens.
- [ ] Confirm this flow does not regress after PlaceSheet integration.

Evidence to record:

```text
Map location id:
Nearby post id/tid:
Detail opened: yes/no
```

### Publish known place binding

- [ ] Open Publish.
- [ ] Select a known map/place result.
- [ ] Submit or inspect the outgoing publish payload.
- [ ] Confirm payload includes `locationDraft.placeId` and/or structured `locationDraft.place`.
- [ ] Confirm fallback `locationArea` remains display/supporting text only.

Expected payload shape:

```text
locationDraft.placeId = <known place id>
locationDraft.place = <PlaceRef when available>
locationDraft.locationArea = <display text when available>
locationDraft.source = <structured source such as map_v2>
```

Evidence to record:

```text
Selected place:
Observed placeId:
Observed place object: yes/no
Observed locationArea:
```

### Publish manual/free-text location

- [ ] Open Publish.
- [ ] Enter a manual/free-text location without selecting a known place.
- [ ] Submit or inspect outgoing payload.
- [ ] Confirm frontend does not create stable PlaceRef from manual text.
- [ ] Confirm manual text is treated as fallback display only.

Evidence to record:

```text
Manual location text:
Generated placeId client-side: yes/no
Generated place object client-side: yes/no
```

### Publish success read-back

- [ ] Publish a post with known structured place binding.
- [ ] Confirm success UI uses `response.place.name` when returned.
- [ ] Open the resulting detail.
- [ ] Confirm detail can read back `place?: PlaceRef`.
- [ ] Confirm Map can read back `place` or `placeId` for the related location when applicable.

Evidence to record:

```text
Published post id/tid:
response.place.name:
Detail read-back place.id:
Map read-back place/placeId:
```

## Release/auth acceptance

These checks are blocking gates for full acceptance, but they should stay in their own issues:

- #64: profile liked/saved auth regression.
- #65: canary/prod deploy-state verification.

Checklist:

- [ ] Profile `赞过` returns data or empty state after login, not `401`.
- [ ] Profile `收藏` returns data or empty state after login, not `401`.
- [ ] `/api/auth/me` and `/api/me/liked` agree on whether the test session is authenticated.
- [ ] Deployed build marker matches expected main commit before product QA.

## Pass/fail summary template

Use this summary in #67 after the manual pass:

```text
Environment:
Expected frontend commit:
Served build marker commit:
Test account:

Actor/source:
- Feed card: pass/fail
- Detail author: pass/fail
- Replies: pass/fail
- Messages channel: pass/fail
- Source/provider leakage: none/found

PlaceSheet:
- Detail structured place: pass/fail
- Detail fallback locationArea: pass/fail
- Map selected location: pass/fail
- Map nearby content: pass/fail
- Publish known place: pass/fail
- Publish manual location: pass/fail
- Publish success/read-back: pass/fail

Release/auth gates:
- Profile liked/saved: pass/fail
- Build marker verified: pass/fail

Open follow-ups:
- Auth:
- Deploy:
- Motion:
- Backend contract:
- Cleanup:
- Product/design:
```

## Non-goals

This checklist does not authorize:

- new source/provider badge UI;
- PlaceSheet redesign;
- UI motion changes;
- auth implementation changes;
- backend DTO expansion;
- legacy fallback cleanup;
- runtime/deploy command guessing.

If any of those are needed, route them to the focused follow-up issues instead of expanding #63 or #67.
