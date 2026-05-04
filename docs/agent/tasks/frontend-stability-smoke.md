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

---

## Review Blocker Added 2026-05-03

Current status: smoke result is not reliable.

Review finding:

- `node scripts/smoke-frontend.js` currently reports 13 pass / 8 fail.
- The failures are all in the frontend `node --check` section.
- Running `node --check` directly against individual frontend files passes, so the smoke harness likely has a Windows path or command execution issue.
- The smoke script itself still contains mojibake in output labels.

Impact:

- Handoffs claiming `node scripts/smoke-frontend.js` passed 21/21 should not be treated as verified until this script is fixed or the failure is explained.

Required fix:

1. Make `checkSyntax()` invoke `node --check` without shell quoting ambiguity on Windows.
2. Clean mojibake from smoke output labels.
3. Re-run:

```bash
node --check scripts/smoke-frontend.js
node scripts/smoke-frontend.js http://localhost:4100
```

Acceptance addition:

- [ ] Smoke script and direct `node --check public/*.js` agree on frontend syntax status.

---

## Fix Pass Result Added 2026-05-03

Status: fixed by implementation handoff.

Recorded implementation result:

- `scripts/smoke-frontend.js` was fixed.
- Frontend smoke now reports 21/21 pass.
- The broader fix pass reports 143/143 tests passing.

Reviewer validation:

```bash
node --check scripts/smoke-frontend.js
node scripts/smoke-frontend.js http://localhost:4100
```

If this fails again on Windows, compare the smoke script's syntax check command path handling against direct `node --check public/*.js` runs before treating app code as broken.

---

## P0 Rerun Requirement Added 2026-05-03

Current Pro decision: this is the first task in the next execution order.

If reviewer rerun still reports 13/21 while direct frontend syntax checks pass, the next implementation thread should change the harness to avoid shell-dependent syntax checks.

Preferred implementation:

```js
spawnSync(process.execPath, ["--check", fullPath], { shell: false })
```

Avoid:

```js
execSync("node --check ...")
```

Scope limit:

- Fix only `scripts/smoke-frontend.js` and its handoff unless the smoke exposes a real frontend bug.
- Do not edit `public/*.js` just to satisfy a broken harness.
- Do not mark Lane F, Publish V2, or NodeBB detail/profile accepted until this smoke status is reproducible or the reviewer records an explicit environment waiver.
