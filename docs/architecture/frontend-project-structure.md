# Frontend Project Structure

This document explains the current frontend folder structure, functional architecture, and page structure.

It is a human-readable guide, not the final source of truth. The executable structure source is:

```bash
npm run check
```

which runs:

```bash
node scripts/validate-project-structure.js
```

When this document drifts from the repository, trust the script and update the document only as a short guide. Do not add broad hand-maintained indexes when a script can derive the information.

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

## Root files

The root contains the Vue/Vite application entry and project configuration:

- `index.html` is the Vite HTML entry.
- `src/main.ts` creates the Vue app and mounts `App.vue` onto `#vue-root`.
- `package.json` defines development, build, validation, and rehearsal commands.
- `vite.config.ts` and `tsconfig.json` define frontend build and TypeScript behavior.

## Runtime modes

The frontend currently has two active modes during migration.

### Legacy static runtime

```text
public/
|-- index.html
|-- app.js
|-- app-state.js
|-- app-utils.js
|-- app-auth-avatar.js
|-- app-feed.js
|-- app-legacy-map.js
|-- app-ai-publish.js
|-- app-messages-profile.js
|-- publish-page.js
|-- map-v2.js
|-- reply-form-click-guard.js
|-- explore-preload.js
|-- styles.css
|-- glass-ui.css
|-- lian-tokens.css
`-- tools/
```

This is the current legacy mobile frontend runtime. It remains active while features migrate into the Vue shell.

`public/tools/task-board.html`, `public/tools/task-board.js`, and `public/tools/task-board.css` now exist as a legacy/internal historical viewer for earlier LIAN task-board data. They are not the live development control plane. For current coordination truth, use `lian-platform-server` Control Room #112 plus the active GitHub issue and PR queues instead of treating this page as authoritative:

- Control Room: `https://github.com/taoyu051818-sys/lian-platform-server/issues/112`
- Issue queue: `https://github.com/taoyu051818-sys/lian-mobile-web/issues?q=is%3Aopen+sort%3Aupdated-desc`
- PR queue: `https://github.com/taoyu051818-sys/lian-mobile-web/pulls?q=is%3Aopen+sort%3Aupdated-desc`
- Label queues: use the open GitHub `agent:*` labels such as `agent:codex-action-needed`, `agent:review-needed`, and `agent:follow-up-needed`

### Vue 3 + Vite shell

```text
src/
|-- main.ts
|-- App.vue
|-- app/
|-- views/
|-- ui/
|-- styles/
`-- vite-env.d.ts
```

The Vue shell is the long-term UI architecture direction.

`src/main.ts` creates the Vue application:

```ts
const app = createApp(App);
app.mount("#vue-root");
```

`src/App.vue` composes the top-level shell:

```text
TopBar
AppViewHost
BottomTabBar
ToastHost
```

## Functional architecture

### `src/app/`

Application orchestration layer.

Current responsibilities:

- Define supported app views.
- Track the active view.
- Mount the active view component.

Important files:

- `src/app/view-types.ts`
- `src/app/useActiveView.ts`
- `src/app/AppViewHost.vue`

### `src/views/`

Page-level Vue views.

Current page keys:

```text
feed
map
messages
profile
```

Current mapped view components:

```text
feed     -> src/views/FeedView.vue
map      -> src/views/MapView.vue
messages -> src/views/MessagesView.vue
profile  -> src/views/ProfileView.vue
```

The view registry is declared in `src/app/view-types.ts`, and the component mapping lives in `src/app/AppViewHost.vue`.

### `src/ui/`

Reusable UI primitives and shell components.

Current responsibilities:

- Bottom tab navigation
- Top bar
- Glass/card primitives
- Chips and badges
- Sheet/modal-style containers
- Toast feedback system

Representative files:

```text
src/ui/BottomTabBar.vue
src/ui/TopBar.vue
src/ui/GlassPanel.vue
src/ui/LianButton.vue
src/ui/Toast.vue
src/ui/feedback/ToastHost.vue
src/ui/feedback/toast-state.ts
src/ui/feedback/useToast.ts
```

### `src/styles/`

Vue shell styling entry.

Important file:

```text
src/styles/main.css
```

### `scripts/`

Frontend maintenance and validation scripts.

Important scripts:

- `scripts/validate-project-structure.js` checks required frontend files and backend-only exclusions.
- `scripts/check-encoding-contamination.js` blocks encoding contamination.
- `scripts/serve-frontend-runtimes.js` serves frontend runtimes.
- `scripts/serve-frontend-static-rehearsal.js` serves the legacy static rehearsal mode.
- `scripts/smoke-frontend.js` runs frontend smoke checks.
- `scripts/run-smoke-with-server.js` starts a static rehearsal server and runs smoke checks.
- `scripts/guard-runtime-inventory.js` guards runtime inventory.

## Page structure

### Main mobile shell

The Vue shell has four primary tabs:

| Key | Label | Purpose |
| `feed` | Home | Campus information feed and content distribution |
| `map` | Explore | Places, location organization, and map-based exploration |
| `messages` | Messages | Channels, notifications, and future private-message entry |
| `profile` | Profile | Identity, contributions, and posting history |
| `profile` | 鎴戠殑 | Identity, contributions, and posting history |

### Legacy mobile pages

The legacy runtime still owns active user flows under `public/`, including:

- home/feed runtime
- auth/avatar runtime
- legacy map runtime
- AI publish runtime
- publish page runtime
- messages/profile runtime
- Map V2 runtime
- explore preload behavior
- reply form click guard

These files should be migrated incrementally into the Vue shell only after each feature is validated.

### Internal tools pages

Current internal tool page:

```text
public/tools/task-board.html
```

It is a legacy/internal historical viewer for the superseded task-board flow, not the authoritative development dashboard. Keep it as reference material only. For live LIAN coordination, use Control Room #112 and the GitHub issue/PR label queues instead of relying on this page for project status.

## Validation commands

For normal frontend changes:

```bash
npm run check
```

For build-sensitive Vue shell changes:

```bash
npm run build
```

For static rehearsal smoke testing:

```bash
npm run start:frontend-static
npm test
```

For full frontend verification:

```bash
npm run verify
```

The full verification path runs `verify:static` first, then `verify:smoke`.

## Maintenance rules

- Treat `scripts/validate-project-structure.js` as the executable structure source.
- Keep this document concise and explanatory.
- Do not duplicate every file into multiple docs.
- If structure needs frequent discovery, add an automatic inventory script instead of expanding this document.
- When adding a new page, update the view registry or runtime inventory first, then update this guide only if the architecture meaning changes.

