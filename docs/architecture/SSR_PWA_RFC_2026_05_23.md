# SSR + PWA RFC (2026-05-23)

Status: architecture lock (this RFC is the contract; sub-task PRs implement it)
Owners: LIAN architecture
Scope: `lian-mobile-web` (SSR shell + PWA), with one tiny `lian-platform-server` URL fix carved out as a sub-task.

## 1. Execution declaration (for Claude Code agents picking this up)

This RFC is the contract for any agent that takes phase 1 / phase 2 sub-tasks. Read this before picking up a sub-issue.

- This RFC does **not** touch the ps write path, NodeBB integration, or the V0.2 publish flow. Those are owned elsewhere and out of scope.
- Implementation must be TDD. Phase 1 sub-tasks land a red test first, then the green code. No "we'll add tests later".
- No new framework. We use **Vite SSR + Vue 3 native** (the SSR APIs that ship with `@vue/server-renderer`). No Nuxt, no Quasar, no Astro.
- No Native (iOS/Android wrapper). Product decision has explicitly removed that lane; this RFC supersedes any earlier "phase 3 native" plan.
- One file new in this PR: this RFC itself. Phase 1 sub-tasks each get their own PR with their own scope.

## 2. Current-state findings

### LIAN routing today

- `lian-mobile-web` does **not** use vue-router. Routing is hand-rolled in `src/app/deepLink.ts`, which only understands `#/post/{tid}` plus the flat list `#/{view}` where view is one of `feed | map | publish | messages | profile | admin | verification | merchant | errand-order | runner`.
- `index.html` is a 17-line shell: `<div id="vue-root">` plus `<script type="module" src="/src/main.ts">`.
- `src/main.ts` is roughly `createApp(App).use(i18n).mount("#vue-root")` plus a map-chunk prefetch hint. No SSR-aware factory exists today.
- There is already an SSR-sensitive composable on disk: `src/composables/useReducedMotion.ts` reaches for `window.matchMedia` directly. SSR will need an `onMounted` guard plus a sane default (`reduce = false`) on the server.

### ps already has the SSR-ready surface — reuse it, do not reinvent

- The endpoint `GET /api/posts/:tid/share-card` is already wired (`src/server/api-route-registry.js:219` → `src/server/share-card-service.js:236`).
- `buildShareCard(item)` already returns `{ tid, title, summary, thumbnailUrl, url, kind, authorName, audienceLabel, channel.wechat }`.
- `deriveKind(item)` already classifies as `event | merchant | errand | help | post`:
  - `presentationIntent` wins first: `activity → event`, `merchant → merchant`, `help → help`.
  - Otherwise falls back to `metadata.contentType`: `campus_tip → help`, `merchant_food / merchant_service / merchant_retail → merchant`, `trade → errand`.
  - Otherwise checks metadata flags (merchant / event / trade / help).
- `pickThumbnailUrl(item)` already cascades cover → imageUrls → `DEFAULT_BRAND_THUMBNAIL`.
- `deriveSummary(item)` already cascades `metadata.excerpt` → `summary` → `bodyPreview` → `contentHtml` → `metadata.body`, truncating to 80 chars.
- `buildShareUrl(tid)` currently returns `${publicSiteUrl}/posts/${tid}` (plural). See section 3 — this RFC requires it to be singular.

### Deployment surface

- nat100 single host, Caddy reverse proxy, no CDN.
- ps is a separate Node process.
- mw today is a `vite build` static bundle served by Caddy.

## 3. Dual-URL strategy

We keep the existing hash router fully intact, and add an SSR layer that emits crawler-friendly HTML on a small set of canonical paths. Real users pass through the SSR layer once and end up in the SPA hash router unchanged.

**SSR-rendered paths (phase 1):**

- `/post/:tid` — single post detail (singular `post`, aligned with the hash form).
- `/u/:username` — public profile shell (phase 1.5; gated, see section 12).
- `/` — homepage shell (only for `Accept: text/html` GETs; everything else still bypasses).

**Hash paths (unchanged):** every existing `#/...` route keeps working exactly as today. Hash routing is the source of truth for the SPA. SSR is a thin capping layer for share preview / SEO / cold-start meta.

**Per-request SSR flow for `GET /post/123`:**

```
GET /post/123
  → mw SSR Node process calls ps GET /api/posts/123/share-card (internal localhost)
  → Receives the share-card envelope (kind, title, summary, thumbnailUrl, ...)
  → Renders an HTML response with:
      <head>
        <title>{title}</title>
        <meta name="description" content="{summary}">
        <meta property="og:title"        content="{title}">
        <meta property="og:description"  content="{summary}">
        <meta property="og:image"        content="{thumbnailUrl}">
        <meta property="og:url"          content="https://<host>/post/{tid}">
        <meta property="og:type"         content="article">
        <meta name="twitter:card"        content="summary_large_image">
        <meta name="twitter:title"       content="{title}">
        <meta name="twitter:description" content="{summary}">
        <meta name="twitter:image"       content="{thumbnailUrl}">
      </head>
      <body>
        <noscript-friendly degraded view: H1 title, summary paragraph, large image, author + audience meta>
        <script>location.replace("/#/post/123")</script>
      </body>
```

Crawlers and IM previewers (WeChat, WeCom, etc.) see the rendered HTML and pull the meta without executing JS. Real browsers execute the redirect and land in the SPA hash router, which already knows how to handle `#/post/123`.

**Required ps-side change (single line, carved out as phase 1.7):** `share-card-service.js:165` currently emits `${publicSiteUrl}/posts/${num}` (plural). For SSR paths to align with both the WeChat share back-link and the hash route, this must change to `${publicSiteUrl}/post/${num}` (singular). This is the only ps mutation this RFC asks for. Everything else (kind inference, summary extraction, thumbnail cascade) reuses what ps already shipped.

## 4. Share card / SSR HEAD meta field map

mw's SSR layer **must not** re-derive `kind`, `summary`, or `thumbnailUrl`. It calls ps `share-card`, takes the envelope as-is, and maps fields into HTML meta. Per-kind presentation:

| kind             | OG title                                       | OG description                       | OG image                                        | Notes                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------- | ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `post` (default) | `item.title`                                   | `summary` (≤ 80 char)                | cover → first image → `DEFAULT_BRAND_THUMBNAIL` | Default fallback when no specialized intent applies.                                                                                                                                                                             |
| `event`          | `"{title} · {startTimeLocal}"`                 | `summary`                            | event poster (cover)                            | Title concatenation needs `metadata.event.startTime` reaching the share-card envelope. **ps follow-up:** add `startTimeLocal` to `buildShareCard` output.                                                                        |
| `merchant`       | `"{title}"` or `"{merchantName} · {locality}"` | `merchantDescription` or `summary`   | merchant cover / first image                    | **ps follow-up:** confirm whether `merchantName` / `locality` / `merchantDescription` are surfaced today; if not, extend `buildShareCard`. mw SSR consumes whatever is exposed and falls through to the `post` shape on absence. |
| `errand` (trade) | `"可下单：{serviceTitle}"` or `"{title}"`      | `summary` plus a price hint          | merchant cover                                  | **ps follow-up:** add `priceHint` (e.g. `¥15 起`) to the share-card envelope. mw SSR appends `priceHint` to OG description if present, otherwise just emits `summary`.                                                           |
| `help`           | `"求助：{title}"`                              | problem description (`summary`)      | first image / help-default thumbnail            | Title prefix `求助：` is rendered on the SSR side as a literal concat, not a ps change.                                                                                                                                          |
| `place`          | `item.title`                                   | `summary` (with locality if present) | cover                                           | Place kind exists in product but is not yet emitted by `deriveKind` — when ps adds it, no SSR change needed beyond falling through to the `post` shape.                                                                          |

**Hard rule:** mw SSR is a dumb consumer of the share-card envelope. If a kind needs a richer field (event time, merchant name, errand price), the work belongs in `share-card-service.js` and is enumerated in the ps follow-up checklist (section 12).

## 5. Deployment shape

**Process model on nat100:**

- New systemd unit `lian-mw-ssr.service` runs the SSR Node process on a fixed local port (e.g. `127.0.0.1:5173`). `Restart=on-failure`, `RestartSec=2`, plus a `WatchdogSec` health probe pinging an `/__ssr/health` endpoint.
- Logs go through journald with `StandardOutput=journal`. No file logs to rotate.

**Caddy routing (sketch):**

```
@ssrHtml {
  method GET
  header Accept *text/html*
  path /post/* /u/* /
}
reverse_proxy @ssrHtml localhost:5173

# everything else (assets, /api/*, /sw.js, /manifest.webmanifest, hash-only routes)
# falls through to current static / api rules unchanged.
```

**Failure isolation:**

- If the SSR process is unhealthy (5xx, timeout, or systemd reports it down), Caddy falls back to serving the static `index.html` for the same paths. The SPA hash router still loads, the user is not blocked. Worst case: crawlers see a generic shell instead of the rich preview, no production traffic is lost.
- The mw SSR layer calls ps `/api/posts/:tid/share-card` over `http://localhost:<ps_port>` only. It must never reach out via the public hostname. A 5-second timeout on that call is the budget; on timeout we 503 → Caddy fallback.

## 6. SSR-safe composable audit (high-risk shortlist)

Phase 1 SSRs only `/post/:tid` and `/`. The bulk of LIAN's composables are reachable only from `#/...` routes that **do not** SSR in phase 1, so we audit narrowly. The high-risk surface:

1. `src/composables/useReducedMotion.ts` — uses `window.matchMedia`. Must guard with `onMounted` and provide an SSR default of `reduce = false`.
2. Any composable touching `localStorage` (draft session, interest picker, publish recovery). On SSR these must short-circuit to a deterministic empty value. Phase 1 doesn't render publish or feed surfaces, but the audit list must enumerate them so phase 1.5 isn't a surprise.
3. Hash-listener / `window.location` consumers (share helpers, deep-link bootstrap) — must not register listeners during SSR.
4. Leaflet map init — wrap in `<ClientOnly>` (or its hand-rolled equivalent — we don't pull in Nuxt's tag) so the map only mounts after hydration.
5. `usePublishDraft` family — `localStorage` read in factory. Audit but defer enforcement to phase 1.5.

**Phase boundary note:** because phase 1 SSR only covers `/post/:tid` and `/`, the SSR-safety bar applies to the components those two routes actually render. Publish / messages / profile / map composables are deferred to phase 1.5; they must not be SSR-hardened in phase 1 (out of scope, out of test budget).

## 7. Active invalidate pipeline

- ps write paths fire an internal invalidate after a successful publish:
  - `createNodebbTopicFromPayload` (NodeBB-native publish)
  - `handleAiPostPublish` (AI-drafted publish)
  - Edit / delete paths
  - Audience change (visibility toggle)
- After commit, ps does `POST http://localhost:<mw_ssr_port>/__ssr/invalidate` with `{ tid }`. Best-effort, fire-and-forget; ps does not wait or retry.
- mw SSR maintains an in-process LRU keyed by `tid` (HTML body + meta envelope). `/__ssr/invalidate` evicts the entry. No Redis. At 5000 users a single-host LRU is trivially sufficient.
- TTL fallback of 5 minutes on every cached entry — even if the invalidate webhook is missed (process restart, network blip), the worst-case staleness is 5 min.
- `__ssr/invalidate` is bound to localhost only at the Caddy layer; ps is the only legal caller.

## 8. PWA phase (independent of SSR)

PWA work begins **after** phase 1 SSR has shipped and stabilized — we need a stable build manifest before we can write a precache list.

**Tooling:** `vite-plugin-pwa` (Workbox under the hood). No hand-rolled service worker.

**Cache matrix:**

| Resource                                | Strategy                              | TTL / size               |
| --------------------------------------- | ------------------------------------- | ------------------------ |
| App shell (HTML / JS / CSS / icons)     | Precache, hash-revisioned each deploy | Updates on deploy        |
| API (`/api/feed`, listing endpoints)    | NetworkFirst, 5 s timeout             | 5 min freshness          |
| Images (post images, thumbnails)        | CacheFirst                            | 30 days, max 100 entries |
| NodeBB session cookies / `/api/session` | Never cache                           | —                        |

**Update flow:**

- New SW detected → SPA shows a non-blocking toast `"有新版本，点击刷新"` → click triggers `skipWaiting()` + `location.reload()`.
- No silent auto-reload (we don't want to interrupt a publish flow).

**Install prompt (soft):**

- After a user has opened the app ≥ 3 times across distinct sessions, show a dismissable card at the top of the profile tab inviting installation.
- 30-day cooldown on dismissal — we do not nag.

**iOS limits:**

- iOS < 16.4 has no Web Push. We do not put push on the critical path. The app still functions fully without notifications; we surface a one-time hint pointing iOS users at native messaging fallbacks where applicable.
- iOS PWA storage caps (≈ 50 MB) are well within our cache budget.

## 9. Three-phase work breakdown

### Phase 1 — SSR shell (2–3 weeks)

- 1.1 Vite SSR entry split: extract `src/entry-client.ts`, `src/entry-server.ts`, and a shared `src/app.ts` from today's `main.ts`. No behavior change for SPA users.
- 1.2 SSR Node service: `src/server/ssr/index.js` (or equivalent), reverse-calls ps `share-card`, renders HTML with the meta block in section 3.
- 1.3 SSR meta injection — implement the per-kind mapping in section 4 (event / merchant / errand / help / post).
- 1.4 Dual-URL adapter: emit the trailing `<script>location.replace("/#/post/...")</script>` redirect plus a degraded `<noscript>`-friendly body.
- 1.5 SSR-safe composable guards for `useReducedMotion` plus any composable directly imported by the `/post/:tid` and `/` render paths.
- 1.6 systemd unit + Caddy config + `/__ssr/health` probe.
- 1.7 ps share-card URL fix: `share-card-service.js:165` `posts` → `post`. Single-line change, separate ps PR, owned by the agent picking up this sub-task.
- 1.8 Active invalidate endpoint (`/__ssr/invalidate`) on mw + ps emitter on publish/edit/delete/audience-change.

### Phase 2 — PWA (1–2 weeks, gated on phase 1 landing)

- 2.1 `vite-plugin-pwa` wiring + cache matrix from section 8.
- 2.2 Update notification toast + reload handshake.
- 2.3 Soft install prompt with 30-day cooldown.
- 2.4 iOS-specific fallbacks (no push path, document caps).

### Phase 3 — (removed)

The original phase 3 covered a Native wrapper. Product has decided not to ship Native. This RFC supersedes any earlier doc that listed phase 3 — there is no phase 3.

## 10. Risks + feature flags

- `LIAN_SSR_ENABLED` env flag on mw — set to `0` to bypass SSR and have Caddy route everything to the static bundle. Required as a kill switch for phase 1 rollout.
- `LIAN_PWA_ENABLED` env flag on mw — same idea, gates the PWA plugin so a bad service worker can be retired without a rebuild.
- **Hydration mismatch (high):** any client-only API used during render breaks hydration. Mitigation: composable guards (section 6) + a mandatory hydration test for every SSR'd route in phase 1.
- **ps share-card endpoint flakiness (medium):** mw SSR uses a hard 5 s timeout → 503 → Caddy fallback to static `index.html`. Logs the timeout for observability but never blocks the user.
- **WeChat share-link plural / singular split (low):** identified, fixed in 1.7. Until 1.7 lands, existing share links keep working (ps still answers on the plural form).

## 11. Priority alignment with V0.2 + Apple-gap

- V0.2 publish steps D–G (ghost text, ghost component, removing the 4-radio, card visual): **continue in parallel.** Publish surface is not on the SSR path, so V0.2 work and SSR phase 1 work do not touch the same files.
- Apple-gap PR-α (merged) / PR-β / PR-γ: **continue in parallel.** These are styling / motion polish on existing SPA components, untouched by SSR.
- SSR phase 1 and V0.2 D–G can be staffed by separate agents on disjoint paths.
- PWA phase 2 must wait for SSR phase 1 to land — phase 2 precache lists depend on the SSR build manifest.

## 12. Out-of-scope follow-ups

Tracked here so they do not regrow into RFC scope:

- ps `buildShareCard` field extensions: event `startTimeLocal`, merchant `merchantName` / `locality` / `merchantDescription`, errand `priceHint`. See section 4 for which kinds need which fields.
- `/u/:username` SSR — phase 1.5 once phase 1 is stable. Profile rendering needs its own composable audit pass.
- `/sitemap.xml` SSR — phase 2.5 (after PWA, before SEO push).
- Lighthouse mobile baseline measurement for accept criteria. To be captured pre-rollout and re-measured per phase.
