# HTTP Client Contract: Request Lifecycle, Error Taxonomy, Retry, and Idempotency

> [!NOTE]
> Documentation-only slice for issue #154. This contract defines the **target behavior** for the LIAN frontend HTTP client. It does not change runtime code. Implementation follow-up is tracked in the "Implementation Follow-up" section at the end.

Date: 2026-05-08
Status: **Proposed** — documentation slice; pending runtime implementation.
Scope: `src/api/http.ts` and all consumers in `src/api/*`, `src/views/*`.
Cross-reference: [API Contract (endpoint surface)](../agent/contracts/api-contract.md)

---

## 1. Baseline: Current State

The current HTTP client (`src/api/http.ts`) is a thin `fetch()` wrapper:

- `apiGet<T>(path, options)` — calls `fetch()` with `credentials: "include"`, auto-parses JSON, throws `LianApiError` on non-OK.
- `apiSend<T>(path, options)` — alias for `apiGet`.
- `LianApiError` — has `status: number` and `code: string`; no `kind` field.
- No timeout, no `AbortController`, no retry, no `Retry-After` parsing.
- All responses parsed as `response.json().catch(() => ({}))` — no content-type or status-code-aware parsing.
- Two files (`profile.ts`, `publish.ts`) bypass the wrapper with direct `fetch()` for uploads.

---

## 2. Request Timeout Contract

### 2.1 Default Timeouts

| Request class | Default timeout | Rationale |
|---------------|----------------|-----------|
| GET (reads) | 15 s | User-perceptible loading boundary; aligns with weak-network PWA resume |
| POST/PUT/DELETE (mutations) | 30 s | Mutations may involve server-side work (AI publish, image upload) |
| Upload (`FormData`) | 60 s | Large image uploads on mobile networks |

### 2.2 Mechanism

- Use `AbortSignal.timeout(ms)` (or equivalent `setTimeout` + `AbortController` for older targets).
- The timeout signal must be composed with any caller-supplied `signal` via `AbortSignal.any([timeoutSignal, callerSignal])` (or manual composition).
- Timeout produces `LianApiError` with `kind: "timeout"`.

### 2.3 Caller-Supplied AbortSignal

- `apiGet` and `apiSend` accept an optional `signal: AbortSignal` in their options.
- When the caller aborts the signal (e.g., component unmount, navigation), the request rejects with `LianApiError` with `kind: "abort"`.
- Aborted requests must NOT trigger error toasts or retry prompts. The UI layer checks `error.kind === "abort"` and silently discards.

---

## 3. Error Taxonomy

### 3.1 `LianApiError` Extended Shape

```typescript
class LianApiError extends Error {
  kind: ErrorKind;        // stable machine-readable category
  status: number;         // HTTP status (0 for network/timeout/abort)
  code: string;           // backend business code (empty if none)
  retryAfterSeconds?: number;  // populated when 429 + Retry-After
}
```

### 3.2 Error Kind Mapping

| `kind` | Trigger | `status` | User-actionable? |
|--------|---------|----------|-----------------|
| `"offline"` | `navigator.onLine === false` or `TypeError` from `fetch()` | 0 | Show offline banner; queue for retry |
| `"timeout"` | `AbortSignal.timeout()` fired | 0 | Show "request timed out"; offer manual retry |
| `"abort"` | Caller-supplied `AbortSignal` aborted | 0 | Silent discard; no UI |
| `"network"` | `fetch()` rejected (DNS, CORS, etc.) but online | 0 | Show generic network error; offer retry |
| `"auth_required"` | 401 | 401 | Redirect to login or refresh session |
| `"forbidden"` | 403 | 403 | Show "no permission"; no retry |
| `"not_found"` | 404 | 404 | Show "not found"; no retry |
| `"conflict"` | 409 | 409 | Show conflict message; no auto-retry |
| `"rate_limited"` | 429 | 429 | Show cooldown; use `retryAfterSeconds` |
| `"validation"` | 422 | 422 | Show field errors from `details`; no auto-retry |
| `"server_error"` | 500, 502, 503 | 5xx | Show "server error"; offer retry after backoff |
| `"parse_error"` | Response body not valid JSON when JSON expected, or unexpected content-type | 200–299 | Log diagnostics; show generic error |
| `"unknown"` | Anything else | varies | Show generic fallback |

### 3.3 Status-to-Kind Resolution Order

1. Network/offline check (before `fetch` returns).
2. Timeout check (after `AbortSignal.timeout` fires).
3. Abort check (caller signal).
4. HTTP status mapping (401→auth_required, 429→rate_limited, etc.).
5. Response body parse failure → `parse_error`.
6. Fallback → `unknown`.

---

## 4. Retry-After Handling

### 4.1 Parsing

The client MUST parse the `Retry-After` header from any 429 or 503 response:

- **Numeric format** (`Retry-After: 120`): seconds until retry is safe.
- **HTTP-date format** (`Retry-After: Fri, 08 May 2026 12:00:00 GMT`): compute delta in seconds from `Date.now()`.

If the header is missing or unparseable, `retryAfterSeconds` is `undefined`. The UI falls back to a default cooldown (see 4.2).

### 4.2 Cooldown Contract

| Context | Default cooldown (no header) | Source |
|---------|------------------------------|--------|
| Auth (login/register/email-code) | 60 s | Issue #127 |
| Invite code generation | 120 s | Issue #142 |
| Channel messaging | 30 s | Issue #143 |
| AI publish | 120 s | Issue #138 |
| Other mutations | 30 s | Conservative default |

### 4.3 Cooldown State

- Cooldown state lives in the calling view/composable, NOT in the HTTP client.
- The HTTP client only surfaces `retryAfterSeconds` on the error object.
- The UI disables the action button and shows a countdown.

---

## 5. Idempotency Contract

### 5.1 Policy

| Mutation category | Idempotency strategy | Header |
|-------------------|---------------------|--------|
| Toggle (like/save) | Safe to retry; server is idempotent by nature | None required |
| Create (reply/message/publish) | Client-generated `Idempotency-Key` | `Idempotency-Key: <uuid>` |
| Auth (login/register/email-code) | Rate-limited; no idempotency key | None (cooldown-gated) |
| Report/flag | Client-generated `Idempotency-Key` | `Idempotency-Key: <uuid>` |

### 5.2 Key Generation

- Generate a UUID v4 per user intent (e.g., each click of "Send" or "Publish").
- Store the key in the request header, NOT in the request body.
- If the request times out (`kind: "timeout"`), the UI shows "confirming..." and allows a safe retry with the SAME idempotency key. The server deduplicates.

### 5.3 Client Mutation ID

- Each mutation carries an `x-client-mutation-id` header (UUID v4).
- This is distinct from `Idempotency-Key`: it identifies the logical user action for diagnostics, even for idempotent toggles.
- Format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (RFC 4122 v4).

---

## 6. Response Parsing Rules

### 6.1 Decision Matrix

| HTTP Status | Content-Type | Action |
|-------------|-------------|--------|
| 204 | any | Return `undefined` (no body expected) |
| 205 | any | Return `undefined` (reset content) |
| 200–299 | `application/json` | Parse as JSON; on failure → `parse_error` |
| 200–299 | `text/html` | Reject as `parse_error` (likely proxy error page) |
| 200–299 | `text/plain` | Reject as `parse_error` (unexpected for API endpoints) |
| 200–299 | other / missing | Reject as `parse_error` |
| 400–5xx | `application/json` | Parse for error body (`error`, `message`, `status.code`) |
| 400–5xx | non-JSON | Extract status; message = HTTP status text; no body leak |

### 6.2 Error Body Extraction

For non-OK JSON responses, extract in this priority:

1. `data.error` (string) — most common backend pattern.
2. `data.message` (string) — fallback.
3. `data.status.message` + `data.status.code` — nested pattern.
4. Fallback: `请求失败（状态码 ${status}）`.

### 6.3 HTML Error Page Detection

If a 200–299 response has `Content-Type: text/html`, the response is almost certainly a proxy/load-balancer error page. Treat as `parse_error` with diagnostic context:

```json
{
  "kind": "parse_error",
  "status": 200,
  "detail": "Unexpected text/html response; likely proxy error page"
}
```

---

## 7. Credentials and CORS Contract

### 7.1 Default Behavior

- All requests use `credentials: "include"` (cookie-based session via `lian_session`).
- This requires the API base to be same-origin or proxied through the same origin.
- Cross-origin direct API calls MUST NOT use `credentials: "include"` unless the backend sets `Access-Control-Allow-Credentials: true` with an explicit origin allowlist.

### 7.2 API Base Resolution

1. `window.LIAN_API_BASE_URL` (runtime config, set by deployment).
2. Empty string → same-origin (default for proxied setups).
3. Absolute URLs (`https://...`) passed directly — MUST be on an allowlist.

### 7.3 Upload Endpoints

Upload endpoints (`/api/upload/image`) that use `FormData` MUST also use `credentials: "include"` and go through the same API base resolution. Currently these bypass the wrapper — implementation should unify them.

---

## 8. Implementation Follow-up

This documentation slice does NOT change runtime code. The following implementation tasks are tracked under issue #154:

| Task | Priority | Files affected |
|------|----------|----------------|
| Add `kind` field to `LianApiError` | P1 | `src/api/http.ts` |
| Add timeout support (`AbortSignal.timeout`) | P1 | `src/api/http.ts` |
| Accept caller `signal` in `apiGet`/`apiSend` | P1 | `src/api/http.ts` |
| Parse `Retry-After` header (numeric + HTTP-date) | P1 | `src/api/http.ts` |
| Content-type-aware response parsing (6.1 matrix) | P1 | `src/api/http.ts` |
| HTML error page detection | P1 | `src/api/http.ts` |
| Idempotency key generation helper | P1 | `src/api/http.ts` (new export) |
| Unify upload endpoints through wrapper | P2 | `src/api/profile.ts`, `src/api/publish.ts` |
| View-level abort on unmount (composable) | P2 | `src/composables/` (new) |
| Cooldown helpers for auth/invite/AI/message | P2 | `src/composables/` (new) |
| Diagnostics telemetry (privacy-safe) | P2 | `src/api/http.ts` |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **Error kind** | Machine-readable category on `LianApiError` (e.g., `"timeout"`, `"rate_limited"`) |
| **Idempotency key** | UUID v4 header that lets the server deduplicate retried mutations |
| **Client mutation ID** | UUID v4 header identifying a logical user action for diagnostics |
| **Cooldown** | UI-level countdown after a 429 or rate-limited response |
| **Parse error** | Response body could not be interpreted as the expected format |
