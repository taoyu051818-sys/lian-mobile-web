# Task: detail-navigation-monotonic-request-generation

## Current source check

- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisites: B0 `0ea4cc1` and F1 acceptance `b5d1588`.
- Working branch: `codex/audit-f2a-detail-request-generation`.
- Control issue: [#1086](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1086).
- Open issue search and merged PRs through #1084 were checked. No active task
  already owns this reducer behavior.

## Problem

`DetailState` preserves the request token only while `loading`. After a request
settles to `ready` or `error`, or the detail closes, `lastToken()` falls back to
zero. A later fetch can therefore reuse an old token, allowing a delayed result
from an earlier post to be accepted as the current detail.

## Goal

Keep one monotonically increasing request generation across every detail FSM
state. Old requests may finish, but their results must never change the current
post, error, or loading state.

## Product scope

This is an internal state-machine correction. URL hashes, browser history,
API calls, DTOs, rendered DOM, shell chrome, and user-facing copy remain
unchanged.

## Allowed files

- `src/app/detail-navigation/state.ts`
- `tests/detail-navigation/reducer.test.ts`
- `tests/detail-navigation/store.test.ts`
- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/detail-navigation-monotonic-request-generation.md`
- `docs/agent/handoffs/detail-navigation-monotonic-request-generation.md`

## Forbidden files

- `src/app/detail-navigation/store.ts` and fetcher/URL modules.
- `src/App.vue`, `src/app/DetailSurface.vue`, and `src/features/detail/**`.
- API, DTO, CSS, dependency, backend, deployment, and persisted-data files.
- Any file outside the allowed list.

## Design

- Every `closed`, `loading`, `ready`, and `error` state carries the latest
  request generation.
- `initialState()` starts at generation zero.
- Every state transition that starts a fetch increments the retained
  generation.
- Close, successful fetch, and failed fetch retain the current generation.
- A fetch result is accepted only when the state is `loading` and the result
  generation equals the current one.
- No request cancellation, global counter, API change, or persistent state is
  introduced.

## Acceptance criteria

- [ ] `open A -> close -> open B` gives B a newer generation; A cannot overwrite B.
- [ ] `open A -> open B -> B ready -> open C` gives C a newer generation; A
      cannot overwrite C.
- [ ] `error -> retry` advances the generation and drops results from the
      failed attempt.
- [ ] `ready -> open new tid` advances the generation.
- [ ] Card open, deep-link, retry, user close, and popstate history effects are
      unchanged.
- [ ] Selectors still expose no tid/post while closed and the matching post
      while ready.
- [ ] Focused reducer/store tests, build, and full `npm run verify` pass.
- [ ] Only allowed files are changed.

## Validation commands

```bash
npx vitest run tests/detail-navigation/reducer.test.ts tests/detail-navigation/store.test.ts
npx vitest run tests/detail-navigation
npm run build
npm run verify
```

## Rollback

Revert this task's implementation and acceptance-document commits. There is no
server, API, database, URL, or browser-storage migration to reverse.
