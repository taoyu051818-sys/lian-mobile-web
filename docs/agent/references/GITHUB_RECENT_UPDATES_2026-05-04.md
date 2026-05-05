# GitHub Recent Updates - 2026-05-04

> Superseded by `GITHUB_RECENT_UPDATES_2026-05-05.md` for repo ownership and deployment orientation. As of 2026-05-05, backend is `lian-platform-server`, frontend is `lian-mobile-web`, and `lian-mobile-web-full` is stopped/decommissioned as an active full-stack source.

This note summarizes the recent GitHub updates that are already in the local `main` branch and pushed to the full-stack remote.

Target full-stack remote:

- `full`: `https://github.com/taoyu051818-sys/lian-mobile-web-full.git`

Current recent commit chain:

```text
22e3126 统一生产/开发安全模式
4cbd478 同源检查改为生产模式启用
5cbb359 开发模式启动警告
2892457 认证限流改为生产模式启用
d4d2eec setup/status 开发暴露、生产隐藏
b2b09cd 生产/开发安全模式测试
5c0164e 新增生产安全响应头
834bff2 API 响应接入安全头
e10d18b 静态资源接入安全头
6fe885a 生产模式 Cookie 加 Secure
02d8941 安全头和 Secure Cookie 测试
8eb4d9e fix: keep fixed headers outside scroll flow
e424c07 fix: refine detail layout and view transitions
596715d feat: stabilize publish map and project baseline
288cc49 docs(agent): documentation cleanup per review feedback
77d3cd2 docs(agent): add mock API review entry and doc cleanup audit
d822302 feat(data-store): serialize metadata writes with promise queue
c2da517 feat(routes): add route matcher module and 61 route tests
de16857 docs(agent): high-risk areas reference for 6 critical subsystems
c379c35 feat: like/save/report, map editor v1, publish page, docs refresh
2cf148f feat(audience): read-side enforcement with test infrastructure
```

## Production/Development Security Mode Updates

### `22e3126` - Unified Production/Development Security Mode

Purpose:

- Establish a single security-mode distinction between development and production.
- Avoid applying production-only protections in local development where they block debugging or setup.
- Avoid exposing development-only setup/status behavior in production.

Operational expectation:

- Production deployments must set the expected production environment flag.
- Development mode should remain explicit and should surface warnings when potentially unsafe settings are active.

### `4cbd478` - Same-Origin Check Enabled In Production Mode

Purpose:

- Same-origin request protection is enforced in production mode.
- Development mode remains more permissive for local testing and iteration.

Acceptance focus:

- Production requests from disallowed origins should be rejected.
- Local development requests should not be accidentally blocked by production-only origin policy.

### `5cbb359` - Development Mode Startup Warning

Purpose:

- Make unsafe/non-production runtime mode visible at startup.
- Reduce the risk of accidentally running a public deployment with development assumptions.

Acceptance focus:

- Startup logs should clearly show when the server is running in development mode.
- Production startup should not show misleading development warnings.

### `2892457` - Auth Rate Limiting Enabled In Production Mode

Purpose:

- Authentication rate limiting is applied in production mode.
- Development mode avoids unnecessary friction during local login and test loops.

Acceptance focus:

- Login/register/auth-sensitive endpoints should be rate-limited in production.
- Local development should remain usable for repeated manual testing.

### `d4d2eec` - Setup/Status Development Exposure, Production Hidden

Purpose:

- Setup/status endpoints or diagnostics may remain visible in development.
- Production mode must hide or restrict setup/status surfaces that could leak operational details.

Acceptance focus:

- Production must not expose setup helpers or sensitive status details.
- Development can keep those endpoints for operator setup and debugging.

### `b2b09cd` - Production/Development Security Mode Tests

Purpose:

- Add automated coverage for security-mode behavior.
- Guard against regressions where production-only protections become inactive or development-only helpers leak.

Acceptance focus:

- Tests must cover both development and production mode behavior.
- Future security-mode changes should update these tests.

### `5c0164e` - Production Security Response Headers

Purpose:

- Add baseline production response headers for browser-facing security hardening.
- Reduce common web exposure around framing, sniffing, referrer leakage, and related browser behavior.

Acceptance focus:

- Production responses should include the configured security headers.
- Header behavior should be consistent across dynamic/API and static responses after the follow-up commits below.

### `834bff2` - API Responses Use Security Headers

Purpose:

- Apply the security header policy to API responses.
- Prevent API routes from bypassing browser-facing hardening.

Acceptance focus:

- `GET /api/*` and `POST /api/*` responses should include expected production security headers.
- Error responses should also receive the same baseline headers.

### `e10d18b` - Static Assets Use Security Headers

Purpose:

- Apply the security header policy to static files served from `public/`.
- Keep HTML, JS, CSS, images, and tool pages aligned with production browser hardening.

Acceptance focus:

- `GET /`, `GET /app*.js`, `GET /styles.css`, and `/tools/*` should include expected production security headers.

### `6fe885a` - Secure Cookie In Production Mode

Purpose:

- Production cookies are marked `Secure`.
- Development cookies can remain usable on plain `http://localhost`.

Acceptance focus:

- Production session/auth cookies should include `Secure`.
- Local development over HTTP should still allow login/session testing.

### `02d8941` - Security Headers And Secure Cookie Tests

Purpose:

- Add automated tests for security headers and production `Secure` cookie behavior.
- Make security-mode behavior reviewable and repeatable.

Acceptance focus:

- Tests should validate production headers on representative API/static responses.
- Tests should validate production cookies include `Secure`.
- Tests should validate development mode does not accidentally require HTTPS-only cookies on localhost.

## Security Mode Review Notes

These commits shift the project toward explicit runtime modes. Follow-up reviewers should check:

1. Which environment variable selects production mode.
2. Whether PM2/server deployment sets that variable.
3. Whether local development remains usable over `http://localhost:4100`.
4. Whether production cookies are only marked `Secure` when HTTPS is actually used at the public edge.
5. Whether reverse proxy headers and same-origin checks agree on the public domain.
6. Whether setup/status endpoints are hidden or restricted in production.

## 2026-05-04 UI Fixes

### `8eb4d9e` - Fixed Fixed-Header Scroll Regression

Changed file:

- `public/styles.css`

What changed:

- Removed the base transform from `.view`.
- Added `.view.is-active { transform: none; }`.
- This fixes fixed-position headers and controls being pulled into the page scroll flow after the view-transition work.

Why it matters:

- Feed chips, message topbar, profile topbar, and other fixed UI elements must stay pinned to the viewport top, not scroll with the content.
- CSS transforms on a parent create a containing block for `position: fixed`, which caused the regression.

Validation:

```bash
node scripts/smoke-frontend.js http://localhost:4100
node scripts/validate-project-structure.js
git diff --check -- public/styles.css
```

Observed validation result before commit:

- frontend smoke: `21/21`
- project structure validation: `43/43`
- diff whitespace check: clean

### `e424c07` - Detail Layout And View Transition Refinement

Changed files:

- `public/app-feed.js`
- `public/app-messages-profile.js`
- `public/app.js`
- `public/index.html`
- `public/map-v2.js`
- `public/menu-data.json`
- `public/styles.css`

What changed:

- Detail page now has fixed header and bottom action bar.
- Reply panel gained count, empty state, and improved reply-submit behavior.
- `openDetail()` can refresh the current detail view without pushing extra history or forcing scroll jumps.
- Reply submit can refresh detail and scroll back to the reply panel.
- Added a reply-focus trigger for detail actions.
- Added view-transition shell and related CSS.
- Added `window.MapV2.invalidateSize()` for view-transition/map resizing.
- Cleaned a menu-data label.

Validation:

```bash
node --check public/app-feed.js
node --check public/app-messages-profile.js
node --check public/app-utils.js
node --check public/app.js
node scripts/validate-project-structure.js
node scripts/smoke-frontend.js http://localhost:4100
git diff --check
```

Observed validation result before commit:

- frontend syntax checks: passed
- project structure validation: `43/43`
- frontend smoke: `21/21`
- diff whitespace check: clean

## Stabilization Batch

### `596715d` - Publish, Map, Project Baseline Stabilization

This was a broad stabilization merge. It touched docs, frontend, backend, data, scripts, map assets, and tool pages.

Main areas:

- Publish V2 stabilization
- Map v2 bounds, icons, editor, and data assets
- NodeBB detail/profile regression fixes
- Messages and notification handoff updates
- Alias pool and avatar assets
- Metadata, routes, audience, and NodeBB integration docs
- Task board web UI tool files
- Road network preview import artifacts
- Project file index and repo split documentation

Notable touched areas:

- `public/publish-page.js`
- `public/app-feed.js`
- `public/app-messages-profile.js`
- `public/map-v2.js`
- `public/styles.css`
- `public/tools/map-v2-editor.*`
- `public/tools/task-board.*`
- `src/server/post-service.js`
- `src/server/channel-service.js`
- `src/server/audience-service.js`
- `src/server/map-v2-service.js`
- `src/server/task-board-service.js`
- `data/alias-pool.json`
- `data/locations.json`
- `data/map-v2-layers.json`
- `data/post-metadata.json`
- `docs/agent/**`
- `scripts/smoke-frontend.js`
- `scripts/test-audience-hydration.js`
- `scripts/validate-locations.js`

Follow-up status:

- Publish V2 browser flow was manually checked by the user and accepted for the main flow.
- NodeBB like/save/report/profile list behavior was manually checked by the user and accepted.
- Map development remains human-assisted only.
- Repo split is directionally accepted but destructive split is still gated.

## Earlier Safety Gates

### `d822302` - Metadata Write Queue

Purpose:

- Serialize writes to `data/post-metadata.json`.
- Reduce risk of concurrent metadata writes during publish, AI publish, and admin operations.

Status:

- This is part of the stabilization baseline.
- Future metadata writes should continue to go through the shared data-store/metadata path instead of direct file writes.

### `c2da517` - Route Matcher Tests

Purpose:

- Add route matcher module and `61` route tests.
- Stabilize the hand-written Node HTTP router before more features are added.

Status:

- Route test coverage is a current safety gate.
- New APIs should update route tests.

### `2cf148f` - Audience Read-Side Enforcement

Purpose:

- Add audience read-side enforcement with test infrastructure.
- Protect feed/detail/map/channel style surfaces from obvious visibility leakage.

Status:

- Read-side enforcement is accepted as a baseline.
- Write-side minimum enforcement remains a separate P0/P1 follow-up in planning.

## Current Engineering Implications

1. The current repo is still the runnable full-stack workspace.
2. The full-stack GitHub remote is `lian-mobile-web-full`.
3. Server deployment should pull from `lian-mobile-web-full`, not the old frontend-only remote.
4. `data/post-metadata.json` on the server may contain runtime updates and can conflict during pull. Back it up before resolving deploy conflicts.
5. Do not let Map v2 work proceed autonomously without human approval.
6. Do not expand product scope until Publish V2, NodeBB interactions, messages, audience, and map baseline remain stable after deployment.

## Recommended Server Update Path

Use this only after the full-stack remote is configured correctly on the server:

```bash
cd /opt/lian-mobile-web
git fetch origin
git pull origin main
npm install
node --check server.js
node scripts/validate-project-structure.js
node scripts/validate-post-metadata.js
pm2 restart lian-mobile-web --update-env
pm2 logs lian-mobile-web --lines 80
```

If `data/post-metadata.json` has an unresolved conflict on the server, do not discard it blindly. It may contain live runtime metadata. Back it up first, then resolve deliberately.
