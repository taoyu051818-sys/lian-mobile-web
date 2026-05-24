# E2E Coverage Audit 2026-05-24

## Summary Statistics

| Metric                | Count |
| --------------------- | ----- |
| Total spec files      | 46    |
| Total test cases      | ~165  |
| Fixture files         | 4     |
| Feature areas covered | 11/12 |

## Spec Files by Feature Area

### Auth (1 spec, 14 tests)

- `auth-flow.spec.ts` — login/register UI, validation, mode switching

### Admin (4 specs, 15 tests)

- `admin-session-entry.spec.ts` — admin session gate, /api/admin/me
- `admin-verification-proof.spec.ts` — merchant verification, moderation, audit trail
- `admin-verification-aggregate.spec.ts` — aggregate queue redaction

### Feed (2 specs, 9 tests)

- `feed-image-loading.spec.ts` — cover image rendering, lazy loading
- `feed-text-card-expand.spec.ts` — text card expand/collapse

### Publish (15 specs, ~35 tests)

- `publish-body-candidate-bar.spec.ts` — body candidate apply/revert
- `publish-card-as-editor.spec.ts` — card-as-editor V0.2
- `publish-ghost-reduced-motion.spec.ts` — reduced-motion accessibility
- `publish-kind-inference-payload.spec.ts` — kind inference wire format
- `publish-kind-inference-role-matrix.spec.ts` — role-based kind inference
- `publish-llm-contract-shape.spec.ts` — LLM response contract validation
- `publish-llm-stale-and-failure.spec.ts` — stale drop + silent failure
- `publish-llm-telemetry.spec.ts` — telemetry event emission
- `publish-llm-trigger-matrix.spec.ts` — LLM trigger timing
- `publish-no-kind-radio.spec.ts` — no kind radio V0.2
- `publish-shell-shares-feed-card.spec.ts` — shell visual parity
- `publish-step-f-no-radio.spec.ts` — step F no radio
- `publish-suggested-components-actions.spec.ts` — ghost accept/dismiss

### Profile (3 specs, 11 tests)

- `profile-editor.spec.ts` — avatar, alias, invite code editing
- `profile-posts-content-filter.spec.ts` — posts tab content filter chips

### Detail (4 specs, ~18 tests)

- `detail-cta-shared-base.spec.ts` — CTA 6-state vocabulary
- `detail-type-action-blocks.spec.ts` — type-specific action blocks
- `post-detail-cold-start.spec.ts` — cold-start contract
- `post-lightbox.spec.ts` — gallery/lightbox interaction
- `post-visibility-matrix.spec.ts` — visibility permission matrix (16 tests)

### Messages (2 specs, 5 tests)

- `messages-notification-proof.spec.ts` — notification routing
- `messages-product-inbox.spec.ts` — 4-tab inbox, error states

### Map (1 spec, 6 tests)

- `map-view.spec.ts` — map loading, place sheet, navigation

### Errand (3 specs, 16 tests)

- `errand-order.journey.spec.ts` — errand order journey
- `errand-full-chain-proof.spec.ts` — full chain accept/pickup/deliver

### Event (4 specs, 14 tests)

- `event-runtime.spec.ts` — event fixture consumer
- `event-runtime-proof.spec.ts` — event extension, join flow
- `event-complete-reward-proof.spec.ts` — complete/reward flow

### Help (2 specs, 10 tests)

- `help-runtime-proof.spec.ts` — help extension, vote flow
- `help-manage-runtime-proof.spec.ts` — link-event, resolve flow

### Merchant (1 spec, 2 tests)

- `merchant-center.journey.spec.ts` — merchant center entry, gate

### Runner (1 spec, 4 tests)

- `runner-center.spec.ts` — runner order list, transitions

### Trade (1 spec, 3 tests)

- `trade-author-state.spec.ts` — author state transitions

### Share (2 specs, 11 tests)

- `share-card.spec.ts` — share sheet open/close, error states
- `share-card-post-detail.spec.ts` — share from post detail

### Cross-cutting (3 specs)

- `account-fixture.spec.ts` — role matrix validation
- `forum-gate.spec.ts` — forum-gate access control
- `journey.spec.ts` — anonymous browse, login, like/save
- `self-published-round-trip-proof.spec.ts` — publish round-trip
- `outcome-recap-kb-proof.spec.ts` — outcome/KB proof
- `post-reply-submit.spec.ts` — reply submit flow

## Uncovered Feature Areas

### 1. Verification (`src/features/verification/`)

- `useCampusEmailVerify.ts` — campus email verification flow
- `verification-format.ts` — verification display formatting
- **Gap**: No E2E for the campus email verification UI flow

### 2. Feed Advanced Features

- `useFeedData.ts` — feed data fetching/pagination
- `FeedAutoLoadSentinel.vue` — infinite scroll sentinel
- `FeedLoadMore.vue` — load more button
- **Gap**: No E2E for infinite scroll / pagination behavior

### 3. Map Advanced Features

- `useMapLayers.ts` / `useMapRoads.ts` — layer switching
- `useMapSelection.ts` — marker selection
- `useMapDataCache.ts` — data caching
- **Gap**: Layer switching, marker clustering, data cache invalidation

### 4. Profile Settings

- `ProfileSettingsBlock.vue` — settings panel
- `settings-state/` — settings state management
- **Gap**: Settings toggle persistence, notification preferences

### 5. Profile Rewards/Stats

- `ProfileRewardsBlock.vue` — rewards display
- `ProfileStatsBlock.vue` — stats display
- **Gap**: Rewards redemption flow, stats accuracy

## Dead Code Analysis

### Unused Fixture Exports

| Export                      | File                        | Status                                   |
| --------------------------- | --------------------------- | ---------------------------------------- |
| `storageStateForRole`       | `fixtures/accounts.ts`      | **UNUSED** — exported but never imported |
| `getSeededEventId`          | `fixtures/event-runtime.ts` | Used only in `event-runtime.spec.ts`     |
| `isSeededEventIdConfigured` | `fixtures/event-runtime.ts` | Used only in `event-runtime.spec.ts`     |

### Fixture Files — All Active

- `fixtures/accounts.ts` — heavily used (38 imports)
- `fixtures/event-runtime.ts` — used by 4 specs
- `fixtures/help-runtime.ts` — used by 1 spec
- `fixtures/errand-runtime.ts` — used by 2 specs

## Recommended E2E Priorities

### P0 — Critical Gaps

1. **Campus email verification flow** — user-facing verification with real email interaction
2. **Feed infinite scroll** — core UX, regression risk on scroll/pagination

### P1 — High Value

3. **Profile settings persistence** — notification/privacy toggles
4. **Map layer switching** — feature parity with native apps
5. **Rewards redemption** — money-adjacent flow

### P2 — Nice to Have

6. **Feed card interaction edge cases** — swipe gestures, long-press
7. **Map marker clustering** — performance at scale
8. **Profile stats accuracy** — cross-check with backend

## Cleanup Actions

1. **Remove `storageStateForRole`** from `fixtures/accounts.ts` — dead export
2. Consider consolidating `getSeededEventId` / `isSeededEventIdConfigured` into `fetchEventRuntimeFixture` — only one consumer

---

_Generated 2026-05-24 by E2E coverage audit task #188_
