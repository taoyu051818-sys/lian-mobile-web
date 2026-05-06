# Recent Work Handoff - 2026-05-06

This handoff records the actor/source and PlaceSheet contract review round, merged frontend work, review decisions, open risks, and the recommended prompt for the next agent/thread.

Do not copy runtime commands, process names, service aliases, ports, or deployment assumptions from prior messages. When operational work is needed, consult the current runtime inventory / runbook first.

## Current review state

Issue #63 is the active review thread:

- `Review: actor/source and PlaceSheet contract integration follow-up`
- Repository: `taoyu051818-sys/lian-mobile-web`

Review meeting status:

- The actor/source/identityTag contract is accepted for e2e validation.
- The PlaceRef/PlaceSheet/locationArea fallback contract is accepted for e2e validation.
- Strategic discussion has been added: LIAN may evolve beyond a campus feed into a GitHub-like campus experiment commons / co-building system.
- Strategic direction is acknowledged, but it should not block the current MVP contract acceptance.
- Follow-up work should be split into focused issues instead of turning #63 into a catch-all.

## Accepted product contracts

### Actor / identityTag / source

```text
actor = display identity
identityTag = optional trust / contribution signal
source = platform / import / provider provenance metadata
```

Frontend rules:

- UI identity should use `actor` first.
- `identityTag` is a signal, not the speaking identity.
- `source`, provider labels, and NodeBB-style platform labels must not enter identity UI.
- Legacy flat fields are temporary compatibility fallback only.

### PlaceRef / PlaceSheet / fallback text

```text
PlaceRef = stable place identity
PlaceSheet = durable place surface
locationArea/manual text = fallback display only, not identity
```

Frontend rules:

- Do not parse `locationArea`, place name, or manual text into a stable place identity.
- Use structured `place?: PlaceRef` / `placeId` when available.
- `status` and `source` are server-owned structured metadata.
- Source/provenance should not become identity or trust badge text unless product explicitly maps it.

### Strategic direction under discussion

Potential long-term framing:

```text
LIAN is not only a campus feed.
LIAN may become a campus experiment commons / co-building system.
```

Interpretation:

- Feed distributes information.
- Map locates information.
- PlaceSheet / future stable objects sediment information.
- Posts are lightweight input units, not necessarily the final product center.
- PlaceSheet is the first practical co-building object to validate before expanding to Project/Event/Guide/Resource-like objects.
- Avoid copying GitHub surface UI too early. Learn from its collaboration structure: object persistence, contribution traceability, discussion, review, provenance, and merge/acceptance.
- Do not introduce heavy points, ranks, or pressure-inducing contribution systems too early.

## Completed frontend work in this round

Merged PRs / accepted work include:

- #48 legacy `public/app-feed.js` actor-first mapper.
- #50 Vue feed/detail actor DTO integration.
- #53 MessagesView channel actor DTO integration.
- #55 PlaceSheet frontend contract foundation.
- #57 Detail place pill opens PlaceSheet from structured place.
- #59 Map selected location opens PlaceSheet.
- #61 Publish sends structured place binding.

### Identity paths now covered

- Feed card author display is actor-first.
- Detail post author and reply author are actor-first.
- Messages channel sender is actor-first.
- Composer wording treats identityTag as a signal, not as speaking identity.
- Legacy fields remain as fallback but should be cleaned later.

### PlaceSheet paths now covered

- `src/types/place.ts` defines `PlaceRef`, `PlaceSheet`, status, summary, stats, recent post preview.
- `src/api/places.ts` defines `fetchPlaceSheet(id)`.
- `PostDetail` supports `place?: PlaceRef`.
- Detail opens PlaceSheet when `post.place?.id` exists.
- Detail falls back to plain `locationArea` when no structured place exists.
- Map locations support `placeId?: string` and `place?: PlaceRef`.
- Map selected location can open PlaceSheet.
- Publish selected map location sends `locationDraft.placeId` and `locationDraft.place`.
- Publish manual/free-text location remains fallback display only.

## Open risks and blockers

### 1. Legacy fallback may hide contract drift

Fallback still exists around:

```text
author
username
displayName
authorAvatarUrl
authorIdentityTag
identityTag
locationArea
location.id as temporary place id fallback
```

Risk:

- UI may appear to work even when backend DTO is missing canonical fields.

Recommended next step:

- Open a cleanup issue.
- Add warning/test coverage before removing fallback.
- Remove in stages after backend DTO stability is confirmed.

### 2. Profile liked/saved auth regression

Reported in #63 comments:

- Vue canary profile liked/saved surfaces can return `401` after login.
- Example surface: `我的` -> `赞过` / `收藏`.

Risk:

- Authenticated profile surfaces cannot be accepted even if actor/place contracts are correct.

Recommended next step:

- Open a dedicated bug issue.
- Treat as blocker for authenticated profile-surface acceptance.
- Confirm whether `/api/me/liked` and saved/favorites routes are canonical.
- Confirm canary/prod auth/session routing consistency.

### 3. Deploy/canary consistency

Reported in #63 comments:

- Main merges may not always update the running server/build automatically.
- Real-device validation can accidentally test stale assets.

Risk:

- Review conclusions can be polluted by stale frontend builds.

Recommended next step:

- Open a release/ops issue.
- Make deployed commit/build state verifiable.
- Add a build marker or equivalent current-version signal.
- Do not write guessed runtime commands in docs or issue comments.

### 4. UI motion / gesture conflict

Reported in #63 comments:

- Long press may trigger detail transition.
- Bottom chrome may not share the same progress as detail stage.
- Multiple motion layers may compete.

Risk:

- UI motion bugs can obscure contract validation.

Recommended next step:

- Open a dedicated UI motion issue.
- Keep it separate from contract acceptance.

### 5. PlaceSheet product surface not final

Current implementation is MVP lightweight panel / inline surface.

Open design questions:

- Keep inline panel?
- Use unified bottom sheet?
- Add dedicated Place route/page?
- Should Detail/Map/Publish success converge on one Place page?
- Should PlaceSheet support save, correction, contribution, recent-post pagination, sharing?
- Should source/status be visible to users or stay metadata for now?

Recommended next step:

- Open a dedicated design/strategy issue after MVP acceptance.

## Recommended follow-up issues

Create these as separate follow-ups instead of expanding #63:

1. `Bug: profile liked/saved keeps returning 401 after login`
2. `Ops: make canary/prod deploy state verifiable after main merge`
3. `Motion: fix detail open gesture and bottom chrome progress coordination`
4. `QA: e2e acceptance for actor/source and PlaceSheet contracts`
5. `Cleanup: remove legacy actor/place fallback after DTO stabilization`
6. `Design: decide final PlaceSheet product surface`
7. `Strategy: LIAN as a campus experiment commons`

## Suggested e2e acceptance checklist

Actor/source:

- [ ] Feed card author does not show `[object Object]`.
- [ ] Feed card author uses `actor.displayName` / username / fallback properly.
- [ ] Detail post author uses `post.actor`.
- [ ] Detail replies use `reply.actor`.
- [ ] Messages channel sender uses `item.actor`.
- [ ] `identityTag` appears only as optional signal when intended.
- [ ] Source/provider/NodeBB labels do not appear as user identity.

PlaceSheet:

- [ ] Detail with `post.place.id` opens PlaceSheet.
- [ ] Detail without `post.place.id` shows `locationArea` only as text.
- [ ] Map selected location opens PlaceSheet.
- [ ] Map nearby post flow still opens post detail.
- [ ] Publish selected known location sends `locationDraft.placeId` / `locationDraft.place`.
- [ ] Publish manual text does not create stable PlaceRef client-side.
- [ ] Publish success uses `response.place.name` when returned.
- [ ] Backend can read back `place?: PlaceRef` in Detail / Map after publish.

Release/auth blockers:

- [ ] Validation environment exposes the expected frontend build/commit.
- [ ] Profile liked/saved does not return 401 after login.
- [ ] `/api/me` and `/api/me/liked` agree on auth state.

## Backend contract test recommendations

Backend should cover:

- PostDetail DTO returns `place?: PlaceRef` where appropriate.
- Map locations return `place` or `placeId`.
- Publish accepts and persists `locationDraft.placeId/place`.
- PublishResponse can return `place?: PlaceRef`.
- `locationArea` is not treated as stable identity.
- `source/provider` is never used as display identity.
- `identityTag` rejects or normalizes provider/source labels if needed.

## Next thread prompt

Use the following prompt to continue cleanly in a new thread:

```text
You are continuing work on the LIAN frontend/product review after the May 6 actor/source and PlaceSheet contract round.

Repositories:
- Frontend: taoyu051818-sys/lian-mobile-web
- Backend: taoyu051818-sys/lian-platform-server

Start by reading:
- lian-mobile-web issue #63
- docs/agent/references/RECENT_WORK_HANDOFF_2026-05-06.md

Current accepted contracts:
- actor = display identity
- identityTag = optional trust / contribution signal
- source = platform/import/provider provenance metadata
- PlaceRef = stable place identity
- PlaceSheet = durable place surface
- locationArea/manual text = fallback display only, not identity

Important boundaries:
- Do not treat source/provider/NodeBB as identity UI.
- Do not parse locationArea or manual place text into stable place identity.
- Do not expand #63 into a catch-all implementation issue.
- Do not guess runtime commands, process names, service aliases, or deployment steps.
- Keep contract acceptance, auth bug, deployment consistency, UI motion, cleanup, and strategy as separate tracks.

Completed frontend work:
- actor-first feed/detail/messages paths are merged.
- PlaceSheet client/types are merged.
- Detail/Map/Publish PlaceSheet MVP integration is merged.

Your immediate tasks:
1. Read #63 and confirm the final review state.
2. Create focused follow-up issues if they do not already exist:
   - Bug: profile liked/saved keeps returning 401 after login
   - Ops: make canary/prod deploy state verifiable after main merge
   - Motion: fix detail open gesture and bottom chrome progress coordination
   - QA: e2e acceptance for actor/source and PlaceSheet contracts
   - Cleanup: remove legacy actor/place fallback after DTO stabilization
   - Design: decide final PlaceSheet product surface
   - Strategy: LIAN as a campus experiment commons
3. Prioritize blockers before feature expansion:
   - auth regression
   - deploy/build verifiability
   - e2e acceptance checklist
4. Only then plan fallback cleanup or PlaceSheet product-surface work.

When opening PRs:
- Use small branches.
- Keep UI motion separate from API/contract changes.
- Let CI validate frontend changes.
- State clearly what was not run locally if you did not run it.
```

## Final review recommendation

Recommended closing position for #63:

```text
Contract direction accepted.
Enter e2e validation.
Split blockers and follow-ups into dedicated issues.
Do not expand current MVP scope until auth/deploy/acceptance are stable.
PlaceSheet can become the first co-building object, but strategic platform work should be tracked separately.
```
