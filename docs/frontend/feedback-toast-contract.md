# Feedback & Toast Contract

Issue: #186
Date: 2026-05-08
Status: contract-only (no runtime implementation)

## Purpose

Define the boundaries, lifecycle, accessibility, and privacy rules for user feedback channels in the LIAN mobile web frontend. This document is the authoritative contract that future implementation must follow.

---

## 1. Feedback channel taxonomy

| Channel | Scope | Typical lifetime | User action required | Examples |
|---|---|---|---|---|
| **Field error** | Single form field | Until field is edited | Yes (fix input) | "标题不能超过 30 字", "密码至少 6 位" |
| **Inline error** | Page / component | Until dismissed or navigated | Optional (retry / acknowledge) | "发布失败，请重试", "加载帖子出错" |
| **Toast** | Cross-page / global | Auto-dismiss (timed) | No (informational) | "已复制链接", "图片上传成功", "网络已恢复" |
| **Fatal fallback** | Entire view or app | Until user navigates or reloads | Yes (retry / home / reload) | "页面出错了", "应用加载失败" |

### Decision rules

1. If the error is **field-specific validation**, use **field error** (InlineError associated via `aria-describedby`). Do NOT show a toast.
2. If the error is **page-scoped and recoverable** (e.g., API request failed), use **inline error** at the component level. Toast is optional as a supplementary notification.
3. If the feedback is a **transient operation result** that does not block the user (success, copy confirmation, background sync), use **toast**.
4. If the error **prevents the view from rendering** or is an **unrecoverable runtime failure**, use **fatal fallback** (ErrorBoundary). Do NOT rely solely on toast for fatal errors.
5. Critical errors that require user action MUST have an inline or fallback presence. Toast alone is insufficient for errors the user must act on.

---

## 2. Toast queue, timer, and lifecycle

### 2.1 Queue constraints

| Property | Value | Rationale |
|---|---|---|
| Max visible toasts | 3 | Prevent screen clutter on mobile |
| Max queued toasts | 8 | Bounded memory; oldest evicted if exceeded |
| Deduplication window | 2 seconds | Same `key` within window coalesces into one toast |
| Priority ordering | error > warning > info > success | Higher-priority toasts render on top |

### 2.2 Timer contract

- Each toast has a `duration` (default: 3600ms for info/success, 5000ms for warning, 8000ms for error).
- Timers MUST be tracked in a registry: `Map<toastId, timeoutId>`.
- `removeToast(id)` MUST clear the corresponding timeout.
- `clearToasts()` and `disposeToasts()` MUST clear all registered timeouts.
- App unmount, session reset, and logout MUST call `disposeToasts()`.
- Action toasts (with `actionLabel`) default to `duration: 0` (no auto-dismiss) unless explicitly set.
- Tests MUST use fake timers and verify no leaked timeouts.

### 2.3 Toast item schema (target shape)

```
{
  key?: string,          // dedup key
  message: string,       // display text (copy key preferred over raw string)
  tone: "info" | "success" | "warning" | "error",
  duration?: number,     // ms; 0 = no auto-dismiss
  actionLabel?: string,  // button text (e.g., "重试", "撤销")
  actionId?: string,     // event identifier for action handler
  dismissible?: boolean, // default true
  scope?: "global" | "view:<key>" | "session",
  priority?: number      // higher = more important
}
```

---

## 3. Live-region and accessibility policy

### 3.1 Region ownership

| Element | Role | Live region |
|---|---|---|
| `ToastHost` (container) | `aria-live` | Single live region for all toasts |
| Individual `Toast` | No `aria-live` | Content announced by host region |

- The host container owns the live region. Individual toasts MUST NOT duplicate `aria-live` or `role="status"` to avoid double-announcement.
- Host MUST have `aria-label="通知"` (or equivalent i18n key).

### 3.2 Severity-based announcement

| Tone | `aria-live` value | `role` | Notes |
|---|---|---|---|
| info / success | `polite` | `status` | Default; does not interrupt screen reader |
| warning | `polite` | `status` | Same as info, but visually distinct |
| error | `assertive` | `alert` | Interrupts current announcement |

- `aria-relevant` MUST be `additions` only. Do NOT announce removals (causes screen reader noise).
- When an error toast appears, the host switches its `aria-live` to `assertive` for that insertion, then reverts to `polite`.

### 3.3 Focus policy

- Toasts MUST NOT steal focus from the current element.
- Dismissible toasts MUST have a close button that is keyboard-focusable.
- Close button label MUST include context: `aria-label="关闭：<toast message excerpt>"`.
- After toast dismissal, focus MUST return to the previously focused element (or remain on close button if no prior focus is tracked).

### 3.4 Reduced motion

- Toast enter/exit animations MUST respect `prefers-reduced-motion: reduce`.
- When reduced motion is active, toasts appear/disappear without animation.

---

## 4. Privacy and copy boundaries

### 4.1 Forbidden content in toast messages

Toast messages MUST NOT contain:

- Raw API error messages or stack traces
- Post body text, comment text, or message content
- Invite codes, tokens, or secrets
- Full URLs (including query parameters)
- Client IDs, reader IDs, or aliases
- Precise geolocation coordinates
- Image URLs or file paths

### 4.2 Copy key preference

- New toasts SHOULD use typed copy keys with parameters rather than raw strings.
- Example: `showToast({ key: "publish.success", tone: "success", params: { count: 3 } })`
- Raw string fallback is permitted during migration but MUST NOT leak sensitive data.
- Dev builds MAY include a guard that warns if a toast message matches URL/token/ID patterns.

### 4.3 HTTP error code to toast mapping

| Error kind | Feedback channel | Toast? | Inline? |
|---|---|---|---|
| `offline` | toast + inline | Yes (warning) | Yes (banner) |
| `timeout` | inline | Optional | Yes |
| `abort` | none | No | No |
| `rate_limited` | inline + toast | Yes (warning) | Yes (with countdown) |
| `auth_required` | redirect / inline | No | Yes |
| `forbidden` | inline | Optional | Yes |
| `not_found` | inline | Optional | Yes |
| `validation` | field error | No | Yes (field-level) |
| `server_error` | inline + toast | Yes (error) | Yes |

---

## 5. Scope and lifecycle

### 5.1 View-scoped toasts

- Toasts MAY carry a `scope` field: `"global"`, `"view:<viewKey>"`, or `"session"`.
- When the active view changes, view-scoped toasts from the previous view MAY be retained (policy: keep for 5 seconds after navigation, then dismiss).
- Session-scoped toasts persist across view changes but clear on logout.

### 5.2 Session cleanup

- On logout or session expiry: clear all toasts with `scope !== "global"`.
- On runtime fatal / app reload: all toasts are cleared.

---

## 6. Relationship to parent issues

| Issue | Relationship |
|---|---|
| #113 | Copy catalog provides toast message keys; field error policy aligns with form validation |
| #133 | Toast timer/queue tests belong in the unit test layer |
| #147 | Live-region, focus, and reduced-motion rules derive from the a11y contract |
| #154 | HTTP error kind taxonomy drives toast vs inline routing |
| #185 | Fatal fallback boundary is the outermost layer; toast handles non-fatal feedback |

This contract does NOT close #186. It defines the documentation boundary only. Runtime implementation, component refactoring, and test scaffolding are separate follow-up tasks.

---

## 7. Focused test checklist

### 7.1 Timer and lifecycle

- [ ] Toast auto-dismisses after `duration` ms
- [ ] Manual dismiss clears the registered timeout (no leaked timer)
- [ ] `clearToasts()` clears all registered timeouts
- [ ] `disposeToasts()` clears all timeouts and empties the queue
- [ ] App unmount / session reset calls `disposeToasts()`
- [ ] Fake timer tests: advance time, verify toast removed, verify no stale timeouts

### 7.2 Queue and dedup

- [ ] Pushing 4 toasts with max visible 3: only 3 rendered, 1 queued
- [ ] Pushing duplicate `key` within 2s window: coalesced into single toast
- [ ] Pushing duplicate `key` outside window: separate toasts
- [ ] Queue eviction: pushing beyond max queued removes oldest low-priority toast
- [ ] Priority ordering: error toast renders above info toast when both visible

### 7.3 Accessibility

- [ ] Screen reader announces new toast content (additions only, not removals)
- [ ] Error toast triggers `assertive` announcement
- [ ] Info/success toast uses `polite` announcement
- [ ] Close button is keyboard-focusable and has contextual `aria-label`
- [ ] Toast does NOT steal focus from current input/button
- [ ] After close, focus returns to previously focused element
- [ ] `prefers-reduced-motion: reduce` disables enter/exit animations

### 7.4 Privacy

- [ ] Toast with raw URL in message: dev guard warns
- [ ] Toast with invite code in message: dev guard warns
- [ ] Toast with post body text: dev guard warns
- [ ] Copy key + params produces correct rendered message

### 7.5 Scope and cleanup

- [ ] View-scoped toast persists for 5s after view switch, then dismisses
- [ ] Logout clears all non-global toasts
- [ ] Session-scoped toast survives view changes but clears on logout
- [ ] Global toast survives view changes and logout (unless explicitly cleared)

### 7.6 Channel boundaries

- [ ] Form field validation error appears inline (not as toast)
- [ ] API error with `error.kind === "rate_limited"` shows inline countdown + optional toast
- [ ] Fatal runtime error shows ErrorBoundary fallback, not just toast
- [ ] Successful post publish shows toast (not inline)
- [ ] Offline status shows toast warning + inline banner
