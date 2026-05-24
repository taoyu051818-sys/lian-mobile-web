# SSR Audit: First-Load, Share-Detail, and Offline Contracts (2026-05-23)

Status: **historical pre-PWA snapshot (2026-05-23)** — preserved as-is for context. Findings labelled "current" below describe runtime as of 2026-05-23 and are no longer current truth for offline/PWA behavior. See [§0 Current state and supersession](#0-current-state-and-supersession) before relying on any specific finding.
Scope: `lian-mobile-web` runtime contracts for first-load, share-detail, and offline behavior, **as of 2026-05-23**
Related: `SSR_PWA_RFC_2026_05_23.md`, `SSR_COMPOSABLE_AUDIT_2026_05_23.md`

---

## 0. Current state and supersession

This document was written as a pre-implementation audit. After it landed, the PWA foundation it identified as missing was implemented and verified:

- **PWA foundation shipped** in `#916` ("feat(pwa): add PWA foundation with vite-plugin-pwa"): `vite-plugin-pwa` + Workbox precache, service worker registration in `src/entry-client.ts`, `public/offline.html`, PWA icons, runtime caching (NetworkFirst for `/api/`, CacheFirst for images, fonts), and `pwa-update-available` event.
- **Browser-level proof shipped** in `#920` ("test(e2e): add PWA basics E2E tests"): 13 E2E test cases covering `manifest.json`, `offline.html`, service worker registration, and PWA meta tags.

What this means for readers of this document:

- Section 6 ("Offline / No-Network Fallback Behavior") is **superseded** for current runtime. The "no service worker" / "no offline shell" findings describe the pre-PWA baseline and must not be cited as current state.
- Section 4 ("First-Load Rendering Path") still describes the SPA cold-start sequence accurately, but a registered service worker now sits in front of network fetches in production builds — the precache and runtime-cache layers in `vite.config.ts` are the source of truth for that behavior.
- Section 9 ("Recommended Next Implementation Slice") proposed "PWA Phase 2.1: Service Worker + Offline Shell". That slice has **shipped** via `#916`/`#920`. Treat the section as a historical record of the proposal, not as outstanding work.

For current PWA/offline behavior, read in this order:

1. `vite.config.ts` (`VitePWA` plugin block) — precache globs, runtime cache strategies, navigation fallback.
2. `src/entry-client.ts` (`registerSW` block) — service-worker registration and update-prompt event.
3. `public/manifest.json` — installable PWA manifest with icons.
4. `public/offline.html` — offline fallback page.
5. `docs/architecture/SSR_PWA_RFC_2026_05_23.md` — design intent the shipped implementation followed.

The remainder of this document is preserved unchanged below as a historical artifact. Inline notes have been added to sections whose findings are superseded so that readers landing mid-document do not mistake the pre-PWA state for current truth.

---

## 1. Purpose

This document records the current mobile-web runtime contract for:

- First-load rendering path
- Share-detail / direct-link entry path
- Current offline / no-network fallback behavior

The audit is a prerequisite for SSR phase 2 and PWA implementation per issue #862.

---

## 2. Current Rendering Entrypoints

### 2.1 Client Entry (`src/entry-client.ts`)

The SPA's sole browser entry point:

```
src/entry-client.ts
  └─ createApp() from src/app.ts
       └─ createVueApp(App).use(i18n)
  └─ app.mount("#vue-root")
  └─ idle-time prefetch: MapLeafletView.vue chunk (requestIdleCallback / setTimeout fallback)
```

Key behaviors:

- Mounts Vue app to `#vue-root` synchronously on script load
- No hydration — pure client-side render
- Map chunk prefetch fires after 2–3s idle to reduce first-tap latency on map tab

### 2.2 Server Entry (`src/entry-server.ts`)

SSR phase 1.2 entry point (already shipped):

```
src/entry-server.ts
  └─ render(url: string) → { html, head }
       ├─ /post/:tid  → fetchInternalShareCard(tid) → renderPostHtml(card)
       ├─ /u/:username → renderProfileStub() (brand-default shell, phase 1.5)
       └─ / (fallback) → renderHomepageShell()
```

Key behaviors:

- Does NOT call `renderToString` — no Vue SSR rendering yet
- Emits static HTML with OG meta + a `<script>location.replace("/#/...")</script>` redirect
- Crawlers/IM previewers see the meta + degraded body; real browsers execute the redirect
- ps `share-card` fetch has 5s timeout; failure → throw → 503 → Caddy fallback to static `index.html`

### 2.3 App Factory (`src/app.ts`)

Shared factory for client/server:

```typescript
export function createApp(): { app: VueApp; i18n: typeof i18n };
```

- No side effects — does not mount, does not prefetch
- SSR-safe by design (phase 1.1a of RFC)

### 2.4 Static Shell (`index.html`)

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="..." />
    <meta name="theme-color" content="#f7f4ec" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preload" as="image" href="/assets/campus-base-map.png" />
    <link rel="preload" as="fetch" href="/assets/road-network-preview.json" crossorigin />
    <title>黎安屿你</title>
  </head>
  <body>
    <div id="vue-root"></div>
    <script type="module" src="/src/entry-client.ts"></script>
  </body>
</html>
```

Key observations:

- 17-line minimal shell
- Preloads map base image and road network JSON (critical for map tab)
- No inline critical CSS
- No SSR placeholder content in `#vue-root`

---

## 3. Routing Architecture

### 3.1 Hash Router (SPA)

LIAN does NOT use vue-router. Routing is hand-rolled:

| Module                        | Responsibility                                                       |
| ----------------------------- | -------------------------------------------------------------------- |
| `src/app/deepLink.ts`         | Pure parsing/building for `#/post/{tid}` and `#/{view}`              |
| `src/app/view-hash.ts`        | Module singleton for active view; listens to `hashchange`/`popstate` |
| `src/app/detail-navigation/`  | FSM for post-detail overlay; separate hash listener                  |
| `src/app/post-detail-hash.ts` | History I/O for `#/post/{tid}`                                       |

Supported hash shapes:

- `#/post/{tid}` — opens post detail panel (overlay on current tab)
- `#/{view}` — selects top-level tab or secret view

Views:

- Visible tabs: `feed | map | publish | messages | profile`
- Secret views: `admin | verification | merchant | errand-order | runner`

### 3.2 SSR Canonical Paths

SSR layer handles these paths (phase 1):

- `/post/:tid` — post detail (singular, aligned with hash form)
- `/u/:username` — profile stub (phase 1.5, currently returns brand-default shell)
- `/` — homepage shell

Real browsers hitting these paths receive HTML with a redirect script that hands off to the hash router.

---

## 4. First-Load Rendering Path

### 4.1 Cold Start Sequence (SPA-only, no SSR)

```
1. Browser requests /
2. Caddy serves static index.html
3. Browser parses HTML, starts module script fetch
4. Vite dev server / bundled JS loads
5. entry-client.ts executes:
   a. createApp() — Vue app + i18n instantiated
   b. app.mount("#vue-root") — DOM render begins
   c. view-hash.ts module load — syncFromWindow() reads hash, sets viewFromHash
   d. detail-navigation/url-sync.ts module load — installUrlSync() runs
   e. requestIdleCallback schedules map chunk prefetch
6. App.vue renders:
   a. AppShell with BottomTabBar
   b. AppViewHost renders active view (default: FeedView)
   c. DetailSurface mounts (hidden unless detail FSM is open)
   d. ToastHost mounts
7. FeedView fetches /api/feed, renders cards
```

> **Pre-PWA snapshot.** The cold-start sequence below is still structurally accurate, but in current builds a registered Workbox service worker (`#916`) sits in front of step 2: precached app-shell assets serve from cache, `/api/*` uses NetworkFirst with a 5s timeout, and a failed navigation falls back to `/offline.html`. See [§0](#0-current-state-and-supersession).

### 4.2 Cold Start with SSR (current phase 1)

```
1. Browser requests /post/123
2. Caddy routes to mw SSR Node process (localhost:5173)
3. SSR process:
   a. Matches /post/:tid route
   b. Fetches ps /api/posts/123/share-card (internal localhost, 5s timeout)
   c. Renders HTML with OG meta + degraded body + redirect script
4. Browser receives HTML:
   a. Crawlers/IM previewers: read meta, render degraded body, done
   b. Real browsers: execute <script>location.replace("/#/post/123")</script>
5. Browser navigates to /#/post/123
6. SPA cold start sequence (4.1) runs
7. detail-navigation/url-sync.ts:
   a. bootstrapColdStartHistory() synthesizes #/feed beneath #/post/123
   b. syncFromWindow() dispatches url-sync action with tid=123
8. Detail FSM opens, fetches /api/posts/123, renders PostDetailPanel
```

### 4.3 Critical Path Analysis

First contentful paint blockers:

1. Module script fetch + parse (~200-400ms on fast connection)
2. Vue app instantiation + mount (~50-100ms)
3. Initial view render (FeedView or detail)
4. API fetch for content (feed list or post detail)

No SSR hydration — the `#vue-root` div is empty until JS runs. This is the gap SSR phase 2 (Vue `renderToString`) will address.

---

## 5. Share-Detail / Direct-Link Entry Path

### 5.1 Share Link Forms

| Form                              | Handler                    | Behavior                            |
| --------------------------------- | -------------------------- | ----------------------------------- |
| `https://lian.example/post/123`   | SSR `/post/:tid`           | OG meta + redirect to `/#/post/123` |
| `https://lian.example/#/post/123` | SPA hash router            | Direct SPA load, detail FSM opens   |
| `https://lian.example/posts/123`  | (legacy, ps still answers) | Redirect to singular form pending   |

### 5.2 Cold-Start History Bootstrap

Problem: Direct load at `#/post/{tid}` has only one history entry. `history.back()` leaves the SPA entirely.

Solution (`src/app/post-detail-hash.ts:bootstrapColdStartHistory`):

```
1. Detect cold start at #/post/{tid}
2. replaceState to #/feed
3. pushState back to #/post/{tid}
4. Result: history stack is [#/feed, #/post/{tid}]
5. history.back() now lands on #/feed inside the SPA
```

This runs BEFORE the detail FSM observes the hash, so the initial url-sync still sees the post hash.

### 5.3 OG Meta Generation

SSR `entry-server.ts` generates per-kind meta:

| Kind             | OG Title          | Notes                                            |
| ---------------- | ----------------- | ------------------------------------------------ |
| `post` (default) | `{title}`         | Fallback for unclassified posts                  |
| `event`          | `{title}`         | (startTimeLocal concat deferred to ps follow-up) |
| `merchant`       | `{title}`         | (merchantName/locality deferred to ps follow-up) |
| `errand`         | `可下单：{title}` | Prefix applied SSR-side                          |
| `help`           | `求助：{title}`   | Prefix applied SSR-side                          |

Meta fields sourced from ps `share-card` envelope:

- `title`, `summary`, `thumbnailUrl`, `url`, `kind`, `authorName`, `audienceLabel`

SSR does NOT re-derive these fields — ps is the source of truth.

---

## 6. Offline / No-Network Fallback Behavior

> **Superseded by `#916` and `#920`.** This section describes the pre-PWA baseline as of 2026-05-23. It is retained as historical context for the gap that motivated the PWA work, not as current runtime truth. For current behavior, read `vite.config.ts` (VitePWA block), `src/entry-client.ts` (`registerSW`), `public/manifest.json`, and `public/offline.html`. See [§0](#0-current-state-and-supersession).

### 6.1 Current State (pre-PWA, 2026-05-23): No Offline Support

**There is no service worker.** The codebase has:

- `public/manifest.json` — minimal PWA manifest (name, colors, empty icons array)
- `<link rel="manifest" href="/manifest.json">` in index.html

But no:

- Service worker registration
- Offline cache strategy
- Network-first/cache-first logic
- Offline fallback page

### 6.2 Failure Behavior (pre-PWA)

| Scenario                         | Behavior                                                       |
| -------------------------------- | -------------------------------------------------------------- |
| Network offline on cold start    | Browser shows default offline page (ERR_INTERNET_DISCONNECTED) |
| Network offline after SPA loaded | API calls fail, error states render in-app                     |
| SSR upstream (ps) timeout        | SSR returns 503 → Caddy fallback to static index.html          |
| SSR process down                 | Caddy fallback to static index.html                            |

### 6.3 In-App Error Handling

The SPA has error states for API failures:

- `PostDetailPanel` shows error message + retry button when fetch fails
- `FeedView` shows error state when feed fetch fails
- No global offline indicator or toast

### 6.4 PWA Manifest Analysis

Current `public/manifest.json`:

```json
{
  "name": "黎安屿你",
  "short_name": "黎安屿你",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f7f4ec",
  "theme_color": "#1fa7a0",
  "orientation": "portrait",
  "icons": []
}
```

Missing for installable PWA:

- Icons (required for install prompt)
- Service worker (required for offline capability)
- `scope` field (optional but recommended)

---

## 7. SSR-Safe Composable Status

Per `SSR_COMPOSABLE_AUDIT_2026_05_23.md`:

| Phase                            | Status   | Count                        |
| -------------------------------- | -------- | ---------------------------- |
| Phase 1 (post detail + homepage) | Complete | 1 fixed (`useReducedMotion`) |
| Phase 1.5b (profile SSR)         | Pending  | 2 mandatory + 8 audit        |
| Phase 2+ (publish/messages/map)  | Pending  | 4 mandatory + others         |

The `/post/:tid` and `/` SSR paths are safe. Profile and other routes need composable hardening before SSR expansion.

---

## 8. Validation

### 8.1 File Path References

All paths verified against current codebase:

- `src/entry-client.ts` — client entry, mount + prefetch
- `src/entry-server.ts` — SSR entry, render(url) function
- `src/app.ts` — shared app factory
- `index.html` — static shell
- `src/app/deepLink.ts` — hash parsing/building
- `src/app/view-hash.ts` — view hash singleton + listener
- `src/app/detail-navigation/` — detail FSM (store, url-sync, fetcher, state)
- `src/app/post-detail-hash.ts` — post detail history I/O
- `public/manifest.json` — PWA manifest

### 8.2 Command-Level Validation

This document touches only `docs/architecture/**`. No runtime code modified.

```
npm run check
```

Docs are not covered by repo checks (no markdown linting configured).

---

## 9. Recommended Next Implementation Slice

> **Shipped via `#916` and `#920`.** The proposal below is preserved as the historical record of what this audit recommended. It is no longer outstanding work — items 1, 2, 3, 4, and 5 all landed. See [§0](#0-current-state-and-supersession) for the current source of truth.

Based on this audit, the smallest credible next slice is:

**PWA Phase 2.1: Service Worker + Offline Shell**

Scope:

1. Add `vite-plugin-pwa` to build pipeline
2. Configure precache for app shell (HTML/JS/CSS/icons)
3. Implement NetworkFirst strategy for API calls with 5s timeout
4. Add offline fallback page showing cached shell + "offline" indicator
5. Add icons to manifest for install prompt

Non-goals for this slice:

- No Vue SSR rendering (phase 2 SSR)
- No push notifications
- No background sync
- No install prompt UI (defer to 2.3)

Rationale:

- SSR phase 1 is stable; PWA can proceed independently
- Offline shell is the highest-impact user-facing improvement
- Precache list depends on stable build manifest (SSR phase 1 provides this)

---

## 10. Appendix: Module Dependency Graph

```
index.html
  └─ src/entry-client.ts
       └─ src/app.ts
            └─ src/App.vue
                 ├─ src/app/AppViewHost.vue
                 ├─ src/app/DetailSurface.vue
                 │    └─ src/app/detail-navigation/
                 │         ├─ store.ts (FSM + effect handlers)
                 │         ├─ url-sync.ts (hashchange/popstate listener)
                 │         ├─ fetcher.ts (network bridge)
                 │         └─ state.ts (pure reducer)
                 ├─ src/shell/AppShell.vue
                 └─ src/ui/ToastHost.vue

src/entry-server.ts (SSR, separate process)
  └─ render(url) → { html, head }
       └─ fetchInternalShareCard(tid) → ps /api/posts/:tid/share-card
```
