# Frontend Project Structure

This document explains the current frontend folder structure, ownership boundaries, and page map on `main`.

It is a short guide, not the final executable source of truth. The structure guard remains:

```bash
npm run check
```

which runs:

```bash
node scripts/validate-project-structure.js
```

When this document drifts from the repository, trust the scripts and the current runtime files first, then refresh the document as a concise architecture guide. Current code and structure guard scripts (`scripts/validate-project-structure.js`, `scripts/guard-runtime-inventory.js`) are authoritative when older docs or issues disagree.

For a file-by-file ownership map, read `docs/architecture/current-file-ownership.md`.

## Current folder structure

```text
lian-mobile-web/
|-- index.html
|-- package.json
|-- vite.config.ts
|-- tsconfig.json
|-- public/
|-- src/
|-- scripts/
`-- docs/
```

## Root entry and runtime

The root contains the Vue/Vite app entry plus project configuration:

- `index.html` is the Vite HTML entry.
- `src/main.ts` creates the Vue app and mounts `App.vue` onto `#vue-root`.
- `package.json` defines development, build, validation, and rehearsal commands.
- `vite.config.ts` and `tsconfig.json` define build and TypeScript behavior.

The active frontend runtime is Vue 3 + Vite.

The old static runtime was removed in PR `#282` and migrated to `taoyu051818-sys/-lian-mobile-web-legacy`. `public/assets/` now mainly holds static assets used by the Vue runtime, while `public/tools/` holds standalone internal tools.

`package.json`, `vite.config.ts`, and `scripts/validate-project-structure.js` now act as one coordinated root contract surface:

- `package.json` owns the operator and CI entrypoints for `npm start`, `npm run check`, `npm run ops:guard`, `npm run build`, `npm run verify`, `npm run ownership-doc`, `npm run check:ownership-doc`, and `npm run check:dead-code`.
- `vite.config.ts` owns the `~` alias to `src/`, backend/image-proxy env validation, dev-server proxy behavior, and the production source-protection build settings.
- `scripts/validate-project-structure.js` is the executable repo-shape guard behind `npm run check`; it validates required frontend files, backend-only exclusions, and the layer/barrel rules described below.

When one of those files changes, update this guide and the runtime inventory if the developer-facing or deploy-facing contract changed.

`public/tools/task-board.html`, `public/tools/task-board.js`, and `public/tools/task-board.css` are a legacy/internal historical viewer. They are not the live LIAN coordination surface. For current coordination truth, use:

- `taoyu051818-sys/lian-platform-server#112` as the canonical Control Room
- the open issue and PR queues in GitHub
- the active `agent:*` labels such as `agent:codex-action-needed`, `agent:review-needed`, and `agent:follow-up-needed`

That task-board downgrade was the narrower docs fix in `#249`; this document should stay aligned with it.

## Current runtime tree

```text
src/
|-- main.ts
|-- App.vue
|-- app/
|-- api/
|-- composables/
|-- config/
|-- domain/
|-- features/
|-- locales/
|-- platform/
|-- shell/
|-- styles/
|-- types/
|-- ui/
|-- utils/
`-- vite-env.d.ts
```

The important shift from older docs is that the app now has an explicit `src/shell/` layer and feature pages live under `src/features/` rather than the historical `src/views/` directory. The current shell/content split is documented in more detail in `docs/frontend/shell-content-architecture.md`; this file stays at the project-structure level.

## Top-level component ownership

The current high-level tree is:

```text
App.vue
|-- AppShell.vue
|   |-- ShellChrome.vue [top region]
|   |-- ContentFrame.vue
|   |   `-- AppViewHost.vue
|   |       |-- FeedView.vue
|   |       |-- MapView.vue
|   |       |-- PublishView.vue
|   |       |-- MessagesView.vue
|   |       `-- ProfileView.vue
|   `-- ShellChrome.vue [bottom region]
|-- DetailSurface.vue [app-level post detail overlay]
`-- ToastHost.vue
```

That means the older shorthand of treating the shell as `TopBar` / `AppViewHost` / `BottomTabBar` is no longer the current architecture description. Those names may still appear in older issues or migration-era notes, but the current shell split is `AppShell` / `ShellChrome` / `ContentFrame`; app-level `DetailSurface` separately owns the post-detail overlay.

`src/App.vue` now mounts `AppShell`, passes the active view key, current layout mode, and tab definitions into the shell, and renders `ToastHost` alongside it. `src/app/AppViewHost.vue` remains the active-view switcher, but it now sits inside shell-owned framing rather than standing in for the whole shell model.

## Functional architecture

### `src/app/`

Application orchestration and view switching.

Current responsibilities:

- define the supported app views
- define shell layout modes for each view
- track the active view key
- map view keys to page components in `AppViewHost.vue`

Important files:

- `src/app/view-types.ts`
- `src/app/useActiveView.ts`
- `src/app/AppViewHost.vue`

The current app-view registry includes five primary views:

```text
feed
map
publish
messages
profile
```

The view mapping in `AppViewHost.vue` points the map route at the Konva-backed `MapView.vue`.

### `src/shell/`

Shell-owned app structure and shared chrome/overlay infrastructure.

Current responsibilities:

- compose the app shell
- render persistent top and bottom shell chrome
- own content framing and layout mode behavior
- expose typed shell state helpers

Representative files:

```text
src/shell/AppShell.vue
src/shell/ShellChrome.vue
src/shell/ContentFrame.vue
src/shell/useShellChrome.ts
src/shell/shell-chrome-types.ts
src/shell/index.ts
```

Rule of thumb: shell owns persistent app chrome and framing; `src/app/DetailSurface.vue` owns the post-detail overlay; pages own feature content and page-local interaction behavior.

### `src/features/`

Feature-owned page surfaces and page-local state. Each feature directory contains the view component, related composables, and presentation helpers for that page.

Current feature directories:

```text
src/features/feed/       FeedView.vue, FeedList.vue, FeedItemCard.vue, ...
src/features/map/        MapView.vue, MapCanvas.vue, mapScene.ts, useMapSelection.ts, ...
src/features/publish/    PublishView.vue, PublishComposer.vue, PublishActionBar.vue, ...
src/features/messages/   MessagesView.vue, ChannelComposer.vue, ChannelThread.vue, ...
src/features/profile/    ProfileView.vue, ProfileHeader.vue, ProfileEditorPanel.vue, ...
src/features/detail/     PostDetailContent.vue, PostDetailPanel.vue, ...
src/features/auth/       AuthPanel.vue, useAuthForm.ts
```

These views own feature workflows such as feed interactions, map selection, publish form behavior, messages layout/composer behavior, and profile content. They can describe shell intent through typed shell state, but they do not own the shell DOM structure itself.

`AppViewHost.vue` maps the five primary view keys to their feature-owned components:

```text
feed     -> src/features/feed/FeedView.vue
map      -> src/features/map/MapView.vue              (async)
publish  -> src/features/publish/PublishView.vue       (async)
messages -> src/features/messages/MessagesView.vue     (async)
profile  -> src/features/profile/ProfileView.vue       (async)
```

`feed` is eagerly loaded; the other views are loaded asynchronously via `defineAsyncComponent`. `MapView` is kept alive across navigation via `<KeepAlive include="MapView">`.

### `src/ui/`

Reusable UI primitives, shared feedback surfaces, and smaller presentation helpers.

Representative files and areas:

```text
src/ui/BottomTabBar.vue
src/ui/feedback/ToastHost.vue
src/ui/feedback/toast-state.ts
src/ui/feedback/useToast.ts
src/ui/layout/
src/ui/icons/
```

A useful current distinction is that `BottomTabBar.vue` still exists, but it is now one shell-owned piece of global navigation rather than the main way to describe the whole shell architecture.

### `src/api/` and `src/platform/`

Runtime data access, normalization, and platform/browser helpers.

These folders hold the API clients, runtime config helpers, browser-storage helpers, and related normalization/utilities that support the views and shell without belonging to a single page component.

### `src/styles/`

Global styling entry for the Vue runtime.

Important file:

```text
src/styles/main.css
```

### `scripts/`

Frontend maintenance and validation scripts.

Important scripts:

- `scripts/validate-project-structure.js` checks required frontend files and backend-only exclusions.
- `scripts/check-encoding-contamination.js` blocks encoding contamination.
- `scripts/run-smoke-with-server.js` builds the frontend, starts preview, and runs smoke checks.
- `scripts/guard-runtime-inventory.js` guards runtime inventory expectations.

## Current page map

The app now exposes five primary shell-mounted views:

| Key        | Label  | Layout mode     | Current surface                          |
| ---------- | ------ | --------------- | ---------------------------------------- |
| `feed`     | `首页` | `content`       | `src/features/feed/FeedView.vue`         |
| `map`      | `探索` | `full-bleed`    | `src/features/map/MapView.vue`           |
| `publish`  | `发布` | `content`       | `src/features/publish/PublishView.vue`   |
| `messages` | `消息` | `composer-safe` | `src/features/messages/MessagesView.vue` |
| `profile`  | `我的` | `content`       | `src/features/profile/ProfileView.vue`   |

The map row is centered on `MapView.vue`, with `MapCanvas.vue` owning the Konva stage and `mapScene.ts` owning the JSON scene adapter.

## Historical notes that are no longer current

Treat these as historical references only:

- `src/views/` as the current runtime page directory — pages now live under `src/features/<feature>/`
- `TopBar` / `AppViewHost` / `BottomTabBar` as the current shell ownership model
- `MapView.vue` as the current explore-view owner
- `public/tools/task-board.*` as the live development dashboard or control plane

Older issues and docs may still mention those names because they reflect migration-era structure. When they conflict with current `main`, prefer the current shell docs and runtime files.

The `src/views/` directory was removed during the feature-domain reorganization tracked by #487. References to `src/views/` in older docs or issues are historical only.

## Validation commands

For normal frontend changes:

```bash
npm run check
```

For build-sensitive frontend changes:

```bash
npm run build
```

For full frontend verification:

```bash
npm run verify
```

## Maintenance rules

- Treat `scripts/validate-project-structure.js` as the executable structure source.
- Treat `docs/frontend/shell-content-architecture.md` as the more detailed shell/content ownership reference.
- Treat `docs/architecture/current-file-ownership.md` as the current file-by-file cleanup map.
- Keep this document concise and structural rather than turning it into a full file inventory.
- When the view registry, shell tree, or task-board authority wording changes, update this guide so it stays aligned with current `main`.
- Do not use this document to imply that broader frontend migration, runtime cleanup, or umbrella issues are fully complete.
