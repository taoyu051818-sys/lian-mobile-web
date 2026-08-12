# Task: publish-ai-attempt-boundary

## Current source check

- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisites: B0 `0ea4cc1`, F1 acceptance `b5d1588`, and F2a
  acceptance `ee8ff1a`.
- Working branch: `codex/audit-f2b-publish-ai-attempt-boundary`.
- Control issue: [#1087](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1087).
- Open issues and recent merged pull requests were checked before the task was
  opened. No active task already owns this reset boundary.

## Problem

Publish has two asynchronous AI paths: the legacy image preview and the editor
LLM tick. Clearing a draft or completing a publish resets the visible form but
does not invalidate either path. A delayed response can therefore repopulate a
new or empty draft with an old candidate, component suggestion, inferred kind,
risk flag, or error. The editor path also sends image and location context but
currently validates only title and body before applying a response.

## Goal

Give one Publish draft attempt a shared, monotonically increasing generation.
Both AI paths may finish their network calls, but a response may update the
draft only when it belongs to the current generation and the complete input
snapshot still matches.

## Product scope

This is an internal ownership and reset correction. It does not change publish
payloads, API contracts, user-facing copy, model prompts, automatic request
frequency, image/location trigger behavior, persistence, or backend behavior.

## Allowed files

- `src/composables/usePublishAiDraft.ts`
- `src/features/publish/usePublishAi.ts`
- `src/features/publish/usePublishDraft.ts`
- `src/features/publish/PublishComposer.vue`
- `src/features/publish/usePublishLlmTick.ts`
- `tests/publish/usePublishAiDraft.test.ts`
- `tests/publish/usePublishLlmTick.test.ts`
- `tests/phase0/phase3-contract.test.ts`
- `scripts/check-test-inventory.mjs`
- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-ai-attempt-boundary.md`
- `docs/agent/handoffs/publish-ai-attempt-boundary.md`

## Forbidden files

- `src/features/publish/PublishView.vue` and `usePublishSubmit.ts`.
- Publish API clients, backend routes, DTOs, persisted draft-session formats,
  CSS, dependencies, deployment files, and the existing image/location E2E
  trigger fixmes.
- Any file outside the allowed list.

## Design

- `usePublishDraft` owns a shared `Ref<number>` attempt generation and advances
  it whenever `resetForm()` clears the draft.
- The same ref is passed directly to the image-preview path and provided to the
  descendant composer; it is never copied through a numeric prop.
- Reset synchronously clears title/body candidates, component suggestions, LLM
  inferred kind, and the image-preview path's loading, error, suggestions, and
  risk state. The next draft may auto-run its first image preview again.
- Both AI paths capture generation plus title, body, image URLs, and location at
  send time. Success, error, and completion writes are ignored when generation,
  request ticket, or snapshot no longer matches.
- Generation change cancels pending editor debounce work and invalidates local
  tickets. Disposing either composable also invalidates local work without
  changing the shared generation.
- The LLM watcher remains title/body-only. Images and location are validated as
  request context but do not become new automatic triggers in this task.

## Acceptance criteria

- [x] Clearing a draft while either AI request is pending prevents every old
      success, error, candidate, component, inferred-kind, and risk write.
- [x] Clearing and immediately recreating identical content still rejects the
      earlier draft's response.
- [x] Changing only image URLs or location while an editor request is pending
      rejects the old response.
- [x] Reset clears all transient AI state and re-arms the image path's first
      empty-to-non-empty trigger for the next draft.
- [x] Scope disposal prevents delayed writes.
- [x] Fresh same-attempt responses, explicit refresh, existing debounce, and
      latest-request-wins behavior remain intact.
- [x] Images and location still do not automatically trigger the editor LLM.
- [x] Focused tests, build, and full `npm run verify` pass.
- [x] Only allowed files are changed.

## Validation commands

```bash
npx vitest run tests/publish/usePublishAiDraft.test.ts tests/publish/usePublishLlmTick.test.ts tests/phase0/phase3-contract.test.ts
npm run check:test-inventory
npm run build
npm run verify
```

## Rollback

Revert this task's implementation and acceptance-document commits. There is no
server, API, database, browser-storage, or persisted-draft migration to reverse.
