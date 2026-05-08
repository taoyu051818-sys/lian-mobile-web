# HTTP Client Test Matrix: Fixtures and Expected Outcomes

> [!NOTE]
> Documentation-only slice for issue #154. This test matrix defines the **target test coverage** for the HTTP client. No test code is included here — this is the specification for implementation.

Date: 2026-05-08
Status: **Proposed** — documentation slice; pending test implementation.
Cross-reference: [HTTP Client Contract](../frontend/http-client-contract.md)

---

## 1. Fixture Catalog

Each fixture represents a simulated server response. Tests should mock `fetch()` to return these fixtures.

### 1.1 Success Fixtures

| ID | Description | Status | Content-Type | Body | Expected result |
|----|-------------|--------|-------------|------|-----------------|
| `S-01` | Standard JSON success | 200 | `application/json` | `{ "items": [], "hasMore": false }` | Parsed object returned |
| `S-02` | No content | 204 | (none) | (empty) | `undefined` returned |
| `S-03` | Reset content | 205 | (none) | (empty) | `undefined` returned |
| `S-04` | JSON with nested status | 200 | `application/json` | `{ "status": { "code": "ok" }, "data": {} }` | Parsed object returned |

### 1.2 Error Taxonomy Fixtures

| ID | Description | Status | Content-Type | Body | Expected `kind` | Expected `code` |
|----|-------------|--------|-------------|------|-----------------|-----------------|
| `E-01` | Unauthorized | 401 | `application/json` | `{ "error": "未登录" }` | `auth_required` | (empty) |
| `E-02` | Forbidden | 403 | `application/json` | `{ "error": "无权限" }` | `forbidden` | (empty) |
| `E-03` | Not found | 404 | `application/json` | `{ "error": "资源不存在" }` | `not_found` | (empty) |
| `E-04` | Conflict | 409 | `application/json` | `{ "error": "重复操作" }` | `conflict` | (empty) |
| `E-05` | Validation error | 422 | `application/json` | `{ "error": "参数错误", "details": { "field": "email" } }` | `validation` | (empty) |
| `E-06` | Server error | 500 | `application/json` | `{ "error": "服务器内部错误" }` | `server_error` | (empty) |
| `E-07` | Bad gateway | 502 | `application/json` | `{ "error": "Bad Gateway" }` | `server_error` | (empty) |
| `E-08` | Service unavailable | 503 | `application/json` | `{ "error": "服务不可用" }` | `server_error` | (empty) |
| `E-09` | Error with nested status code | 400 | `application/json` | `{ "status": { "code": "INVALID_EMAIL", "message": "邮箱格式错误" } }` | `unknown` | `INVALID_EMAIL` |
| `E-10` | Error with `message` field | 400 | `application/json` | `{ "message": "请求参数有误" }` | `unknown` | (empty) |

### 1.3 Rate Limit / Retry-After Fixtures

| ID | Description | Status | Headers | Body | Expected `kind` | Expected `retryAfterSeconds` |
|----|-------------|--------|---------|------|-----------------|------------------------------|
| `R-01` | 429 with numeric Retry-After | 429 | `Retry-After: 120` | `{ "error": "请求过于频繁" }` | `rate_limited` | `120` |
| `R-02` | 429 with HTTP-date Retry-After | 429 | `Retry-After: Fri, 08 May 2026 12:02:00 GMT` | `{ "error": "请求过于频繁" }` | `rate_limited` | (computed delta) |
| `R-03` | 429 without Retry-After | 429 | (none) | `{ "error": "请求过于频繁" }` | `rate_limited` | `undefined` |
| `R-04` | 429 with unparseable Retry-After | 429 | `Retry-After: not-a-number` | `{ "error": "请求过于频繁" }` | `rate_limited` | `undefined` |
| `R-05` | 503 with Retry-After | 503 | `Retry-After: 60` | `{ "error": "维护中" }` | `server_error` | `60` |

### 1.4 Parse Error Fixtures

| ID | Description | Status | Content-Type | Body | Expected `kind` |
|----|-------------|--------|-------------|------|-----------------|
| `P-01` | Malformed JSON | 200 | `application/json` | `{ broken json` | `parse_error` |
| `P-02` | HTML error page on 200 | 200 | `text/html` | `<html><body>502 Bad Gateway</body></html>` | `parse_error` |
| `P-03` | Plain text on 200 | 200 | `text/plain` | `OK` | `parse_error` |
| `P-04` | Empty body on 200 (non-204) | 200 | `application/json` | (empty string) | `parse_error` |
| `P-05` | HTML error page on 502 | 502 | `text/html` | `<html><body>502</body></html>` | `server_error` |
| `P-06` | JSON array instead of object | 200 | `application/json` | `[1, 2, 3]` | (returned as-is; caller's type problem) |

### 1.5 Network / Timeout / Abort Fixtures

| ID | Description | Mechanism | Expected `kind` |
|----|-------------|-----------|-----------------|
| `N-01` | Offline (navigator.onLine = false) | Pre-check before fetch | `offline` |
| `N-02` | Network error (DNS failure, CORS) | `fetch()` rejects with `TypeError` | `network` |
| `N-03` | Request timeout | `AbortSignal.timeout()` fires | `timeout` |
| `N-04` | Caller abort (component unmount) | Caller's `AbortSignal` aborted | `abort` |
| `N-05` | Timeout composed with caller signal | Both signals present; timeout fires first | `timeout` |
| `N-06` | Caller abort composed with timeout | Both signals present; caller aborts first | `abort` |

---

## 2. Test Scenarios

### 2.1 Happy Path

| Test | Fixture | Assertion |
|------|---------|-----------|
| GET returns parsed JSON | `S-01` | `result.items` is array, `result.hasMore` is `false` |
| 204 returns undefined | `S-02` | `result === undefined` |
| 205 returns undefined | `S-03` | `result === undefined` |

### 2.2 Error Classification

| Test | Fixture | Assertion |
|------|---------|-----------|
| 401 maps to auth_required | `E-01` | `error.kind === "auth_required"`, `error.status === 401` |
| 403 maps to forbidden | `E-02` | `error.kind === "forbidden"`, `error.status === 403` |
| 404 maps to not_found | `E-03` | `error.kind === "not_found"`, `error.status === 404` |
| 409 maps to conflict | `E-04` | `error.kind === "conflict"`, `error.status === 409` |
| 422 maps to validation | `E-05` | `error.kind === "validation"`, `error.status === 422` |
| 500 maps to server_error | `E-06` | `error.kind === "server_error"`, `error.status === 500` |
| 502 maps to server_error | `E-07` | `error.kind === "server_error"`, `error.status === 502` |
| 503 maps to server_error | `E-08` | `error.kind === "server_error"`, `error.status === 503` |
| Nested status.code preserved | `E-09` | `error.code === "INVALID_EMAIL"` |
| message field extracted | `E-10` | `error.message === "请求参数有误"` |

### 2.3 Rate Limiting

| Test | Fixture | Assertion |
|------|---------|-----------|
| 429 + numeric Retry-After | `R-01` | `error.kind === "rate_limited"`, `error.retryAfterSeconds === 120` |
| 429 + HTTP-date Retry-After | `R-02` | `error.kind === "rate_limited"`, `error.retryAfterSeconds` is positive integer |
| 429 without header | `R-03` | `error.kind === "rate_limited"`, `error.retryAfterSeconds === undefined` |
| 429 + bad header | `R-04` | `error.kind === "rate_limited"`, `error.retryAfterSeconds === undefined` |
| 503 + Retry-After | `R-05` | `error.kind === "server_error"`, `error.retryAfterSeconds === 60` |

### 2.4 Parse Errors

| Test | Fixture | Assertion |
|------|---------|-----------|
| Malformed JSON on 200 | `P-01` | `error.kind === "parse_error"` |
| HTML on 200 | `P-02` | `error.kind === "parse_error"` |
| Plain text on 200 | `P-03` | `error.kind === "parse_error"` |
| Empty body on 200 | `P-04` | `error.kind === "parse_error"` |
| HTML on 502 | `P-05` | `error.kind === "server_error"` (non-OK status takes precedence) |
| JSON array on 200 | `P-06` | Returns array (no error; type contract is caller's responsibility) |

### 2.5 Network, Timeout, Abort

| Test | Fixture | Assertion |
|------|---------|-----------|
| Offline detected | `N-01` | `error.kind === "offline"`, `error.status === 0` |
| Network failure | `N-02` | `error.kind === "network"`, `error.status === 0` |
| Timeout fires | `N-03` | `error.kind === "timeout"`, `error.status === 0` |
| Caller abort | `N-04` | `error.kind === "abort"`, `error.status === 0` |
| Timeout before caller abort | `N-05` | `error.kind === "timeout"` (first signal wins) |
| Caller abort before timeout | `N-06` | `error.kind === "abort"` (first signal wins) |

### 2.6 Idempotency Key Injection

| Test | Setup | Assertion |
|------|-------|-----------|
| Key present on mutation | Call `apiSend` with `idempotencyKey: "test-uuid"` | Request header contains `Idempotency-Key: test-uuid` |
| Key absent on GET | Call `apiGet` without key | No `Idempotency-Key` header |
| Client mutation ID always present | Call `apiSend` | Request header contains `x-client-mutation-id` (UUID format) |

### 2.7 Credentials and Base URL

| Test | Setup | Assertion |
|------|-------|-----------|
| Default credentials include | Call `apiGet("/api/feed")` | `fetch` called with `credentials: "include"` |
| Relative path gets API base | Set `window.LIAN_API_BASE_URL = "https://api.example.com"` | URL is `https://api.example.com/api/feed` |
| Absolute URL passes through | Call `apiGet("https://other.com/api/x")` | URL is `https://other.com/api/x` |
| Empty base → same-origin | `LIAN_API_BASE_URL` undefined | URL is `/api/feed` |

---

## 3. Test Implementation Notes

### 3.1 Mocking Strategy

- Mock `fetch()` globally via `vi.fn()` (Vitest) or equivalent.
- For timeout tests, mock `AbortSignal.timeout` to control timing.
- For offline tests, mock `navigator.onLine`.
- For network errors, make the mock `fetch` reject with `TypeError("Failed to fetch")`.

### 3.2 Fixture Delivery

Fixtures should be defined as constants in a shared test helper:

```typescript
// test/fixtures/http-client.ts
export const FIXTURES = {
  S_01: { status: 200, headers: { "content-type": "application/json" }, body: '{"items":[],"hasMore":false}' },
  E_01: { status: 401, headers: { "content-type": "application/json" }, body: '{"error":"未登录"}' },
  R_01: { status: 429, headers: { "content-type": "application/json", "retry-after": "120" }, body: '{"error":"请求过于频繁"}' },
  // ... etc
} as const;
```

### 3.3 Test File Location

Tests should live alongside the source:

```
src/api/__tests__/http.test.ts
```

### 3.4 Coverage Targets

| Area | Minimum cases |
|------|--------------|
| Success parsing | 4 |
| Error taxonomy (kind mapping) | 10 |
| Rate limit / Retry-After | 5 |
| Parse errors | 6 |
| Network / timeout / abort | 6 |
| Idempotency key injection | 3 |
| Credentials / base URL | 4 |
| **Total** | **38** |

---

## 4. Traceability Matrix

Maps contract sections to test scenario groups.

| Contract section | Test scenario group | Fixture IDs |
|-----------------|---------------------|-------------|
| 2. Request Timeout | 2.5 Network, Timeout, Abort | N-01 through N-06 |
| 3. Error Taxonomy | 2.2 Error Classification | E-01 through E-10 |
| 4. Retry-After | 2.3 Rate Limiting | R-01 through R-05 |
| 5. Idempotency | 2.6 Idempotency Key Injection | (setup-based, no fixture) |
| 6. Parsing Rules | 2.1 Happy Path + 2.4 Parse Errors | S-01 through S-04, P-01 through P-06 |
| 7. Credentials/CORS | 2.7 Credentials and Base URL | (setup-based, no fixture) |
