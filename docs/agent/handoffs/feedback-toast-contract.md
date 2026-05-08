# Handoff: feedback-toast-contract

Date: 2026-05-08
Issue: #186

## Summary

Docs-only contract slice defining the feedback channel taxonomy (field error, inline error, toast, fatal fallback), toast queue/timer/lifecycle rules, live-region accessibility policy, privacy boundaries, and a focused test checklist. This is a contract document only — no runtime implementation was delivered.

## Files changed

| File | Change |
|---|---|
| `docs/frontend/feedback-toast-contract.md` | New. Authoritative contract for toast, inline, fatal feedback boundaries; queue/timer/privacy/live-region/test policy |
| `docs/agent/handoffs/feedback-toast-contract.md` | New. This handoff |
| `docs/agent/tasks/issue-186-feedback-toast-contract.md` | New. Task record for this contract slice |

## Decisions made

1. **Feedback taxonomy**: Four channels — field error, inline error, toast, fatal fallback — with explicit decision rules for which to use when.
2. **Toast queue**: Max 3 visible, max 8 queued, 2s dedup window, priority ordering (error > warning > info > success).
3. **Timer registry**: All toast timeouts tracked in a `Map<toastId, timeoutId>`. `removeToast`, `clearToasts`, `disposeToasts` all clear registered timers.
4. **Live region ownership**: `ToastHost` owns the single `aria-live` region. Individual toasts do NOT duplicate `aria-live` to avoid double-announcement.
5. **Error assertiveness**: Error/warning toasts use `role="alert"` with `aria-live="assertive"`. Info/success use `role="status"` with `aria-live="polite"`.
6. **No focus steal**: Toasts never steal focus. Close buttons are keyboard-focusable with contextual labels.
7. **Privacy**: Toast messages must not contain raw URLs, tokens, invite codes, post body text, client IDs, or precise geolocation.
8. **Scope**: Toasts can be global, view-scoped, or session-scoped. Logout clears non-global toasts.

## Validation

```bash
npm run check
```

Manual link/reference sanity for the three new docs files.

## What was intentionally not done

- No runtime implementation of toast queue, timer registry, or dedup logic
- No changes to `src/ui/feedback/toast-state.ts`, `ToastHost.vue`, or `Toast.vue`
- No changes to `package.json`, `scripts/`, `public/`, or CI configuration
- No changes to source code in `src/`
- This PR does NOT close #186 — it delivers a contract slice only

## Risks

- Contract may diverge from eventual implementation if not referenced during code changes
- Test checklist is prescriptive but unimplemented; tests must be written separately

## Rollback

- Delete the three new docs files. No runtime behavior is affected.

## Next suggested task

Implement the toast timer registry and queue constraints defined in this contract, starting with `src/ui/feedback/toast-state.ts`. Reference `docs/frontend/feedback-toast-contract.md` sections 2.1 and 2.2.
