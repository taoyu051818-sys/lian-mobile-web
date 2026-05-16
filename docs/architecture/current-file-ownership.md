# Current File Ownership

This file is the working map for keeping `lian-mobile-web` understandable during cleanup. It describes what each active source file owns and how logic flows through the app.

When this file conflicts with code, trust code plus `npm run check` first, then update this file.

## Runtime Flow

```text
index.html
  -> src/main.ts
  -> src/App.vue
  -> src/shell/AppShell.vue
  -> src/app/AppViewHost.vue
  -> src/features/<active-view>/*
```

High-level rules:

- `src/app/` owns view registry and active-view switching.
- `src/shell/` owns app chrome, content frame, layout modes, and shared sheet infrastructure.
- `src/features/` owns page workflows, page state, and page-local components.
- `src/ui/` owns reusable presentation primitives only.
- `src/api/` owns HTTP access and response shaping.
- `src/domain/` owns pure business rules.
- `src/platform/` owns browser and third-party adapter code.
- `src/config/brand/` owns product copy constants, split by feature/domain.

## Root Source Files

| File                | Owns                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `src/main.ts`       | Vue app bootstrap, i18n install, global stylesheet import, idle map chunk prefetch. |
| `src/App.vue`       | Thin app composition: active view state, tab definitions, shell mount, toast host.  |
| `src/vite-env.d.ts` | Vite and browser global TypeScript declarations.                                    |

## `src/app/`

| File                      | Owns                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppViewHost.vue`         | Maps the active view key to the feature view component. Feed is eager, map/publish/messages/profile are async. Keeps `MapLeafletView` alive. |
| `useActiveView.ts`        | Global active-view ref and setter. This is the current navigation state source.                                                              |
| `view-types.ts`           | View keys, shell layout modes, tab labels/icons, and view definition lookup.                                                                 |
| `ViewAsyncError.vue`      | Error fallback for async feature view loading.                                                                                               |
| `ViewLoadingFallback.vue` | Loading fallback for async feature view loading.                                                                                             |

## `src/api/`

| File          | Owns                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `http.ts`     | Shared API transport, runtime API base resolution, JSON send/get helpers, `LianApiError`. |
| `auth.ts`     | Auth rules, login, register, email code API calls.                                        |
| `feed.ts`     | Feed tab defaults, feed fetch request, feed response normalization.                       |
| `map.ts`      | Map items and road-network preview fetches.                                               |
| `messages.ts` | Channel messages, notification list, optimistic merge helpers, read/send APIs.            |
| `places.ts`   | Place sheet fetch API.                                                                    |
| `posts.ts`    | Post detail, like/save/report/reply APIs and response normalization.                      |
| `profile.ts`  | Current user, profile tabs, avatar upload, alias activation, invite, logout APIs.         |
| `publish.ts`  | Publish image validation/upload and AI publish API flow.                                  |

## `src/composables/`

| File                     | Owns                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `useAutoLoadSentinel.ts` | IntersectionObserver-based auto-load trigger helper.                |
| `useNowTicker.ts`        | Shared ticking timestamp ref for relative-time updates.             |
| `useReducedMotion.ts`    | Reduced-motion preference detection and reactive state.             |
| `useVisualViewport.ts`   | Visual viewport measurement for keyboard and mobile inset handling. |

## `src/config/`

| File                | Owns                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `runtime-config.ts` | Runtime URL parsing, same-origin API default, image proxy base validation, API URL builder. |

## `src/config/brand/`

| File              | Owns                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `index.ts`        | Barrel export for all brand copy modules. Existing imports should keep using `../../config/brand`. |
| `shared.ts`       | Generic shared labels and fallback copy.                                                           |
| `auth.ts`         | Auth panel, login/register, invite and email-code copy.                                            |
| `detail.ts`       | Post detail, reply, place-sheet and detail action copy.                                            |
| `error.ts`        | Shared error messages.                                                                             |
| `feed.ts`         | Feed tabs, feed card, empty/loading/retry copy.                                                    |
| `loading.ts`      | Shared loading labels.                                                                             |
| `map.ts`          | Map filters, map status, map fallback copy.                                                        |
| `messages.ts`     | Channel, composer, message-thread copy.                                                            |
| `notification.ts` | Notification list and notification-state copy.                                                     |
| `profile.ts`      | Profile tabs, profile editor, collection and alias copy.                                           |
| `publish.ts`      | Publish form, draft, location, metadata and submit copy.                                           |
| `report.ts`       | Report flow copy.                                                                                  |
| `share.ts`        | Share action and share metadata copy.                                                              |
| `shell.ts`        | Shell chrome and navigation copy.                                                                  |
| `validation.ts`   | Form validation copy.                                                                              |

## `src/domain/`

| File                  | Owns                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `actor.ts`            | Pure actor display helpers: display name, avatar text, avatar URL. |
| `place.ts`            | Pure place/type/status label helpers.                              |
| `validation/forms.ts` | Pure auth and publish form validation rules.                       |

## `src/features/auth/`

| File                      | Owns                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `AuthPanel.vue`           | Auth UI composition, mode switching, form field wiring.                              |
| `AuthModeTabs.vue`        | Login/register tab navigation.                                                       |
| `AuthLoginFields.vue`     | Login email/nickname input.                                                          |
| `AuthRegisterFields.vue`  | Register fields orchestrator (composes AuthEmailCodeField + AuthInterestPicker).     |
| `AuthEmailCodeField.vue`  | Email code input with cooldown-aware send button.                                    |
| `AuthInterestPicker.vue`  | Interest selection grid with skip/reload.                                            |
| `AuthSubmitState.vue`     | Error/success messages and submit button.                                            |
| `useAuthForm.ts`          | Composition entrypoint: wires useEmailCodeCooldown, useAuthInterests, useAuthSubmit. |
| `useEmailCodeCooldown.ts` | Email code cooldown timer, requestEmailCode, rate-limit copy.                        |
| `useAuthInterests.ts`     | Interest load/toggle/skip, loadAuthInterestSettings, toggleSelectedInterest.         |
| `useAuthSubmit.ts`        | Login/register submit, validation, mode switching, error state.                      |

## `src/features/detail/`

| File                           | Owns                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| `PostDetailPanel.vue`          | Detail panel container, composable wiring, template composition.            |
| `PostDetailContent.vue`        | Detail body composition shell — wires sub-components, forwards props/emits. |
| `PostDetailGallery.vue`        | Image gallery presentation and pointer events.                              |
| `PostDetailMainBody.vue`       | Title + SafeHtml body presentation.                                         |
| `PostDetailInfoStrip.vue`      | Tag, time, place button, report toggle strip.                               |
| `PostPlaceSheetBlock.vue`      | Expanded place sheet with meta/stats/recent posts.                          |
| `PostReportBlock.vue`          | Report form + follow-up hide prompt.                                        |
| `PostActionFeedback.vue`       | Action error/success display.                                               |
| `PostDetailHiddenState.vue`    | Hidden-state card with undo-hide action.                                    |
| `PostDetailLightbox.vue`       | Fullscreen image overlay.                                                   |
| `PostDetailTopbar.vue`         | Detail topbar presentation and top actions.                                 |
| `PostReplies.vue`              | Reply list presentation.                                                    |
| `PostReplyDock.vue`            | Reply composer dock.                                                        |
| `reportFlow.ts`                | Report request payload and error handling helper.                           |
| `usePostDetail.ts`             | Post detail fetch state helper.                                             |
| `usePostDetailPresentation.ts` | Presentation normalization for detail content.                              |
| `usePostReactions.ts`          | Like/save optimistic update logic, busy flags.                              |
| `usePlaceSheetLoader.ts`       | Place sheet open/load/error/cache logic.                                    |
| `usePostReport.ts`             | Report flow (report/submit/local hide).                                     |
| `usePostReplyComposer.ts`      | Reply compose/submit state.                                                 |
| `usePostShare.ts`              | Web share + WeChat config.                                                  |
| `useDetailGallery.ts`          | Gallery/lightbox state.                                                     |

## `src/features/feed/`

| File                           | Owns                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `FeedView.vue`                 | Feed page composition, shell tab intent, feed list/detail wiring, drag state application. |
| `FeedList.vue`                 | Feed list presentation and item event forwarding.                                         |
| `FeedItemCard.vue`             | Feed card presentation, card-level like state, card open interaction.                     |
| `FeedItemCardMedia.vue`        | Feed card media section (cover, placeholder, floating tag).                               |
| `FeedItemCardFooter.vue`       | Feed card footer actions and counters.                                                    |
| `FeedAutoLoadSentinel.vue`     | Feed-local auto-load sentinel component.                                                  |
| `FeedLoadMore.vue`             | Manual load-more/end-of-feed UI.                                                          |
| `FeedPlaceholder.vue`          | Feed empty/loading/demo placeholder surface.                                              |
| `feedItemId.ts`                | Feed item id normalization helpers.                                                       |
| `useFeedData.ts`               | Feed data loading, tab switching, pagination and error state.                             |
| `useFeedDetail.ts`             | Feed-owned detail loading and detail panel state.                                         |
| `useCardPointerInteraction.ts` | Card pointer/touch interaction helper.                                                    |
| `useDetailDragGesture.ts`      | Feed detail drag gesture state and thresholds.                                            |

## `src/features/map/`

| File                 | Owns                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| `MapLeafletView.vue` | Map page composition, shell chrome intent, map data cache and selection wiring. |
| `MapCanvas.vue`      | Leaflet map rendering surface, layer mounting, selection events.                |
| `map-canvas.css`     | Leaflet/map marker deep styles imported by MapCanvas.vue scoped style.          |
| `MapPlaceholder.vue` | Map fallback/demo presentation.                                                 |
| `MapPlaceSheet.vue`  | Map selected place/post sheet presentation.                                     |
| `MapStatus.vue`      | Map loading/error status surface.                                               |
| `mapIcons.ts`        | Leaflet icon creation for map assets/posts.                                     |
| `roads.ts`           | Road-network parsing and transform helpers.                                     |
| `useMapChrome.ts`    | Map shell chrome filter intent.                                                 |
| `useMapDataCache.ts` | Map item and road preview loading/cache state.                                  |
| `useMapLayers.ts`    | Leaflet marker/layer creation and updates.                                      |
| `useMapIconScale.ts` | Map icon scaling logic for zoom-dependent marker sizing.                        |
| `useMapRoads.ts`     | Leaflet road layer creation and lifecycle.                                      |
| `useMapSelection.ts` | Map-local selection state, place/post detail loading and errors.                |

## `src/features/messages/`

| File                      | Owns                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `MessagesView.vue`        | Messages page composition, tab state, viewport inset wiring, child component orchestration. |
| `MessagesTabs.vue`        | Messages tab switcher presentation.                                                         |
| `ChannelThread.vue`       | Channel message list, read state presentation, load-more and retry events.                  |
| `ChannelComposer.vue`     | Message composer UI and submit event.                                                       |
| `NotificationList.vue`    | Notification list presentation.                                                             |
| `MessagesPlaceholder.vue` | Messages empty/demo placeholder.                                                            |
| `useChannelMessages.ts`   | Channel loading, pagination, optimistic send, read marking and error state.                 |
| `useMessageComposer.ts`   | Composer draft, validation and send state.                                                  |
| `useNotifications.ts`     | Notification loading and error state.                                                       |
| `index.ts`                | Public feature entrypoint for messages exports.                                             |

## `src/features/profile/`

| File                         | Owns                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `ProfileView.vue`            | Profile page composition, composable wiring, shell chrome intent.            |
| `ProfileHeader.vue`          | Profile hero/header presentation.                                            |
| `ProfileSummary.vue`         | Profile summary and stats presentation.                                      |
| `ProfileTabs.vue`            | Profile tab switcher presentation.                                           |
| `ProfileCollectionList.vue`  | Profile history/saved/liked collection list presentation.                    |
| `ProfileEditorPanel.vue`     | Profile editor composition, delegates to avatar/alias/invite sub-components. |
| `ProfileAvatarEditor.vue`    | Avatar section with crop UI, pointer/touch handling.                         |
| `ProfileAliasSelector.vue`   | Alias radio list UI, switch/cancel actions.                                  |
| `ProfileInviteCodePanel.vue` | Invite code generation UI.                                                   |
| `ProfileDetailOverlay.vue`   | Detail overlay wrapper with dialog semantics.                                |
| `ProfileActions.vue`         | Profile edit/collapse/logout action buttons.                                 |
| `ProfilePlaceholder.vue`     | Profile unauthenticated/demo placeholder.                                    |
| `useProfileSession.ts`       | User/loading/error state and session refresh.                                |
| `useProfileTabs.ts`          | Tab/list state, list loading with session refresh retry.                     |
| `useProfileChrome.ts`        | Shell chrome spec computation and button handling.                           |
| `useProfileAliasPicker.ts`   | Alias picker state, switch, identity computed properties.                    |
| `useProfileAliasSwitch.ts`   | Alias activate/cancel composable.                                            |
| `useInviteCode.ts`           | Invite code generation composable.                                           |
| `useAvatarCropper.ts`        | Pointer/touch/canvas crop state for avatar editing.                          |

## `src/features/publish/`

| File                           | Owns                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `PublishView.vue`              | Publish page composition: draft, location options, submit state and child components. |
| `PublishComposer.vue`          | Main publish text/image/identity UI.                                                  |
| `PublishImagePreview.vue`      | Publish image preview grid and remove actions.                                        |
| `PublishLocationControls.vue`  | Location selection controls and location validation display.                          |
| `PublishMetaControls.vue`      | Tag and visibility controls.                                                          |
| `PublishActionBar.vue`         | Clear and submit action row.                                                          |
| `usePublishDraft.ts`           | Publish draft state, validation, image handling and reset behavior.                   |
| `usePublishLocationOptions.ts` | Map location option loading and error handling.                                       |
| `usePublishSubmit.ts`          | Submit flow, current user fetch, API call and success/error state.                    |

## `src/locales/`

| File       | Owns                     |
| ---------- | ------------------------ |
| `index.ts` | Vue i18n setup.          |
| `zh-CN.ts` | Chinese locale messages. |

## `src/platform/`

| File                 | Owns                                                            |
| -------------------- | --------------------------------------------------------------- |
| `api-normalizers.ts` | Safe primitive/object normalization helpers for API responses.  |
| `browser-storage.ts` | Local storage keys and browser storage helpers.                 |
| `clientIdentity.ts`  | Client id generation and persistence.                           |
| `leaflet.ts`         | Lazy Leaflet loading and type-safe adapter boundary.            |
| `share.ts`           | Generic browser share fallback behavior.                        |
| `wechatShare.ts`     | WeChat share metadata setup and platform-specific sharing hook. |

## `src/shell/`

| File                    | Owns                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `AppShell.vue`          | Main shell composition: top chrome, content frame, bottom nav and detail sheet slotting. |
| `ShellChrome.vue`       | Shell chrome renderer for top/bottom regions from typed chrome specs.                    |
| `ContentFrame.vue`      | Layout-mode frame and page surface wrapper.                                              |
| `DetailSheet.vue`       | Shared detail sheet infrastructure.                                                      |
| `useShellChrome.ts`     | Shell chrome state and region update/reset helpers.                                      |
| `useDetailSheet.ts`     | Shared detail sheet state helpers.                                                       |
| `page-model.ts`         | Page-to-shell chrome intent model.                                                       |
| `shell-chrome-types.ts` | Shell chrome region/button/filter/tab/identity types and defaults.                       |
| `detail-sheet-types.ts` | Detail sheet types and defaults.                                                         |
| `index.ts`              | Shell public exports.                                                                    |
| `shell-chrome.css`      | Shell chrome layout and interaction styling.                                             |
| `content-frame.css`     | Content frame and layout mode styling.                                                   |
| `detail-sheet.css`      | Detail sheet styling.                                                                    |

## `src/styles/`

| File                       | Owns                                                      |
| -------------------------- | --------------------------------------------------------- |
| `main.css`                 | Global stylesheet entry and stylesheet import order.      |
| `lian-tokens.css`          | Global design tokens.                                     |
| `floating-chrome.css`      | Shared floating chrome visual and pointer-event behavior. |
| `content-immersive-ui.css` | Immersive content and detail transition styling.          |

## `src/types/`

| File          | Owns                                           |
| ------------- | ---------------------------------------------- |
| `feed.ts`     | Feed item, tab and presentation intent types.  |
| `map.ts`      | Map item, road, asset and location types.      |
| `messages.ts` | Channel, notification and message actor types. |
| `place.ts`    | Place sheet and place status types.            |
| `post.ts`     | Post detail and reply types.                   |
| `profile.ts`  | Profile user, alias, list item and tab types.  |
| `publish.ts`  | Publish draft, location and visibility types.  |

## `src/ui/`

| File                      | Owns                                                     |
| ------------------------- | -------------------------------------------------------- |
| `index.ts`                | Public UI barrel export.                                 |
| `BottomTabBar.vue`        | Shell-owned bottom navigation primitive.                 |
| `GlassPanel.vue`          | Generic glass panel presentation primitive.              |
| `IdentityBadge.vue`       | Identity badge presentation.                             |
| `InlineError.vue`         | Inline error presentation.                               |
| `LianButton.vue`          | Shared button primitive.                                 |
| `LocationChip.vue`        | Location chip presentation.                              |
| `SafeHtml.vue`            | Sanitized HTML rendering boundary.                       |
| `Sheet.vue`               | Generic sheet primitive.                                 |
| `TagChip.vue`             | Tag chip presentation.                                   |
| `Toast.vue`               | Toast item presentation.                                 |
| `TopBar.vue`              | Shared top-bar primitive retained for compatible UI use. |
| `TrustBadge.vue`          | Trust/status badge presentation.                         |
| `TypeChip.vue`            | Type chip presentation.                                  |
| `feedback/toast-state.ts` | Toast state store and mutation helpers.                  |
| `feedback/ToastHost.vue`  | App-level toast host renderer.                           |
| `feedback/useToast.ts`    | Toast composable API.                                    |
| `icons/LianIcon.vue`      | Icon renderer.                                           |
| `icons/paths.ts`          | Icon path registry and icon names.                       |
| `layout/ActionRow.vue`    | Reusable action row layout.                              |
| `layout/ContentStack.vue` | Reusable vertical content stack layout.                  |
| `layout/EmptyState.vue`   | Reusable empty-state layout.                             |
| `layout/PageSection.vue`  | Reusable page section layout.                            |
| `layout/PageSurface.vue`  | Page surface wrapper used by shell/content frame.        |
| `primitives.css`          | UI primitive styling.                                    |

## `src/utils/`

| File                          | Owns                                             |
| ----------------------------- | ------------------------------------------------ |
| `client-id.ts`                | Utility wrapper around client identity behavior. |
| `extractErrorMessage.ts`      | Safe error-to-message extraction.                |
| `html.ts`                     | HTML sanitization helpers.                       |
| `time.ts`                     | Timestamp and relative time formatting helpers.  |
| `__tests__/client-id.test.ts` | Unit tests for client id behavior.               |

## Cleanup Hotspots

All `.vue` files are under 300 lines (verified by `check:large-vue`).

Completed refactorings (waves #513–#545):

- `ProfileEditorPanel.vue` — split into avatar/alias/invite sub-components and composables.
- `PostDetailPanel.vue` — split into reactions/place/report/reply/share/gallery composables.
- `PostDetailContent.vue` — split into 6 presentational sub-components (gallery/main-body/info-strip/place-sheet/report/feedback).
- `PostDetailPanel.vue` — extracted hidden-state and lightbox sub-components.
- `AuthPanel.vue` — split into 6 template block components and 3 composables.
- `useAuthForm.ts` — split into useEmailCodeCooldown, useAuthInterests, useAuthSubmit.
- `ProfileView.vue` — split into session/tabs/chrome/alias composables.
- `FeedView.vue` — split into useFeedData, useDetailDragGesture composables.
- `src/config/brand.ts` — split into 15 domain modules under `src/config/brand/`.
- `FeedItemCard.vue` — extracted FeedItemCardMedia sub-component.
- `MapCanvas.vue` — extracted useMapIconScale composable.
- `PublishComposer.vue` — extracted PublishImagePreview sub-component.
