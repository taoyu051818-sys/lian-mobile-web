# Task: frontend-stability-smoke

## Goal

Add lightweight checks that catch homepage loading failures, split-script ordering problems, and HTML encoding corruption before deployment.

## Product scope

This task does not add user features. It protects the current mobile web app after the `public/app.js` split.

## Allowed files

- `scripts/smoke-frontend.js`
- `public/index.html` only if the smoke check exposes a real bug
- `public/app.js`
- `public/app-state.js`
- `public/app-utils.js`
- `public/app-auth-avatar.js`
- `public/app-feed.js`
- `public/app-legacy-map.js`
- `public/app-ai-publish.js`
- `public/app-messages-profile.js`
- `docs/agent/tasks/frontend-stability-smoke.md`
- `docs/agent/handoffs/frontend-stability-smoke.md`

## Forbidden files

- `src/server/feed-service.js`
- `src/server/post-service.js`
- `data/post-metadata.json`
- `data/feed-rules.json`
- Map v2 data files unless read-only validation is needed

## Data schema changes

None.

## API changes

None.

## Acceptance criteria

- [ ] Script checks `/`, `/app-state.js`, `/app-utils.js`, all split app scripts, `/map-v2.js`, `/api/feed`, and `/api/map/v2/items`.
- [ ] Script detects malformed `<title>` and missing `<main class="app-shell">`.
- [ ] Script exits non-zero on failed HTTP status or missing required scripts.
- [ ] All split frontend files pass `node --check`.

## Validation commands

```bash
node --check scripts/smoke-frontend.js
node scripts/smoke-frontend.js http://localhost:4100
```

Also run:

```bash
node --check public/app-state.js
node --check public/app-utils.js
node --check public/app-auth-avatar.js
node --check public/app-feed.js
node --check public/app-legacy-map.js
node --check public/app-ai-publish.js
node --check public/app-messages-profile.js
node --check public/app.js
```

## Risks

- A browserless HTTP smoke test cannot catch every runtime UI error.
- A full Playwright test may require browser installation on developer machines.

## Rollback plan

- Remove the smoke script and any package/runtime assumptions it introduced.
- Do not roll back app behavior unless a smoke-driven bug fix caused a regression.

