# Issue #115 — Scroll Anchor Phase 1

## What changed

`MessagesView.vue` now preserves the user's viewport scroll position when older channel messages are prepended via "加载更早消息".

## How it works

Before the `channelItems` array is mutated in `loadChannel(false)`:
1. Capture `document.documentElement.scrollHeight` and `window.scrollY`
2. After Vue's `nextTick` (DOM updated), compute `delta = newScrollHeight - prevScrollHeight`
3. If `delta > 0`, call `window.scrollTo(0, prevScrollTop + delta)`

This keeps the same content visible at the same screen position after prepend.

## What was NOT changed

- Dedupe logic: `known` Set + `uniqueItems` filter — untouched
- Reset path (`loadChannel(true)`) — no scroll anchor applied
- No virtualization, unread state, or notification work added
- `src/types/messages.ts` — no changes needed

## Validation

- `npm run check` — PASS (67 passed, 0 failed)
- `npm run ops:guard` — PASS (5 passed, 0 failed)
- `npm run build` (vue-tsc --noEmit + vite build) — PASS
- Dedupe: the `known` Set and `uniqueItems` filter are in the same code path, unchanged
- Scroll jump: `delta > 0` guard ensures scroll correction only fires when content actually grew
