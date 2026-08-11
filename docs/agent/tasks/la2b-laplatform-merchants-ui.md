# Task: LA2b LAPlatform merchants UI

## Current source check

- Frontend base:
  `codex/la2b-laplatform-merchants-ui@0d78fdac21bdf51fc0ba24457fb7625a80a7eb5a`,
  the locally accepted F3j Profile membership baseline.
- Backend contract sources checked locally:
  - accepted LA1 server-only read client and its fixed merchants query/envelope contract;
  - accepted LA2a administrator principal/capability foundation;
  - current route matcher, route policy, administrator handler, and LAPlatform configuration.
- Frontend sources checked locally:
  - `AdminView.vue`, `useAdminConsole.ts`, `useAdminToken.ts`;
  - administrator API helpers and HTTP client;
  - administrator unit, structure, live E2E, and local Playwright infrastructure;
  - root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
    `docs/agent/README.md`, and `docs/agent/00_AGENT_RULES.md`.
- Network access is forbidden for this planning batch, so recent GitHub pull requests were not
  queried again. Current local code and the accepted LA1/LA2a handoffs are the checked sources.
- Test-inventory baseline at `0d78fda` is exactly 172 Vitest files and 67 Node structure files.
  This task creates exactly three `*.test.ts` files and no `*.test.mjs` file, so the intentional
  post-task inventory is 175 Vitest files and 67 Node structure files.
- The current frontend session path is not an accepted contract for this task:
  `AdminView` calls cookie-only `GET /api/admin/me`, derives access from `roleIds`, clears the
  stored operations token, and then calls the token-only reports queue without a token.
  `useAdminConsole` also treats that session flag as permission for every legacy administrator
  read and mutation. The existing live E2E proves only that the token gate disappears; it does
  not wait for a successful first queue.

## Frontend stack and merge order

The local `0d78fda` base is an accepted F3j planning baseline, not evidence that its ancestry is
already integrated into the real main branch. Before LA2b implementation is proposed:

1. Prefer landing accepted F3j `0d78fda` and its prerequisite ancestry into the real main branch
   first, then branch/restack LA2b from that updated main.
2. If real main already contains the equivalent accepted F1-F3 chain under different commit
   identities, restack LA2b onto that real main and record the equivalence and actual merge base in
   the handoff.
3. Re-run test inventory and Allowed/Forbidden scope checks against that actual base. The checked
   `0d78fda` baseline is 172 Vitest/67 Node and LA2b itself adds exactly three Vitest files and zero
   Node files. If the real-main baseline differs, stop and amend/review the expected inventory
   rather than silently changing the counter.
4. The LA2b review diff must contain only the small LA2b Allowed-file change set relative to its
   real-main merge base. It must never package or present the entire F1-F3 history as part of a
   supposedly small LA2b pull request.

## Goal

Deliver one complete, read-only administrator journey in which the first and only initial
browser request to exact `GET /api/admin/laplatform/merchants?limit=20&offset=0` simultaneously
proves the current cookie session has the merchants capability and supplies the first merchants
page, while the legacy operations-token console remains isolated and functional.

## Product scope

After this task, a logged-in administrator whose server-side principal has
`laplatform.merchants.read` can open the LIAN administrator view and browse the LAPlatform
merchant directory with search, status filtering, pagination, safe loading/empty/error states,
and retry. The browser never receives or sends the LAPlatform service token.

This is a complete merchants **GET** journey only. It does not add merchant creation, editing,
status mutation, stores, catalog, or any other LAPlatform operation.

## Backend prerequisites and frozen API contract

Frontend runtime implementation may start against hermetic test doubles, but this lane cannot be
accepted or rolled out until the corresponding backend LA2b route is independently accepted.
The backend prerequisite is:

- exact `GET /api/admin/laplatform/merchants` is a dedicated route matched before the legacy
  `/api/admin/` prefix;
- it never dispatches to `handleAdmin`, the `admin` route id, or the legacy ADMIN_TOKEN policy;
- it accepts only an authenticated cookie session whose immutable administrator principal has
  `laplatform.merchants.read`;
- ADMIN_TOKEN, `Authorization`, and `x-admin-token` do not grant this route access;
- query keys are exactly `limit`, `offset`, `q`, and `status` under the accepted LA1 limits;
- the backend calls only the accepted server-side `listLaPlatformMerchants` client and forwards
  caller abort;
- an admitted success is HTTP 200 and its body is the already validated strict LAPlatform
  envelope, unchanged:

  ```json
  {
    "data": [
      {
        "id": "merchant_demo",
        "code": "demo",
        "displayName": "Example Merchant",
        "status": "active",
        "createdAt": "2026-08-11T00:00:00.000Z",
        "updatedAt": "2026-08-11T00:00:00.000Z"
      }
    ],
    "page": { "limit": 20, "offset": 0, "total": 1 },
    "meta": {
      "requestId": "3f5a9c26-6571-4d6c-9c70-3517b2a7f4d8",
      "schemaVersion": "v1"
    }
  }
  ```

- failures are safe fixed backend errors; no LA URL, service token, query value, response body,
  upstream message, header, stack, or raw cause reaches the browser;
- the primary browser-route kill switch is `LAPLATFORM_MERCHANTS_BFF_ENABLED`; the LA1 client
  prerequisite is `LAPLATFORM_ENABLED`. Both are independently fail-closed and default to
  `false`;
- the backend may authenticate the session, check the exact capability, and apply route rate
  limiting before consulting the BFF flag. Therefore 401, 403, or 429 may validly precede the
  disabled-route 503. After those guards, either flag being false prevents the LA1 client call
  and returns a safe 503;
- no LAPlatform request is possible unless both flags are true and all earlier guards pass.

The frontend must not call, alter, or reinterpret `GET /api/admin/me` in this batch. That legacy
route retains its current ops-token compatibility, wallet side effect, and response shape for
other callers until a separately reviewed authentication migration. In particular, this task
must not derive LAPlatform access from `/api/admin/me`, `roleIds`, `viaToken`, or a standalone
probe/capabilities route.

## Authentication and capability state machine

Use one discriminated state, not independent booleans that can form an illegal combination:

| State               | Visible surface                                                                   | Permitted requests                                                                    |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `probing`           | Neutral loading state only; no privileged tabs, rows, or token gate               | The single initial merchants GET                                                      |
| `session-merchants` | Merchants read tab/list only                                                      | Merchants GET requests                                                                |
| `ops`               | Existing reports, verifications, auth-links, and audit tabs only                  | Existing Bearer ADMIN_TOKEN APIs                                                      |
| `gate`              | Operations-token gate and a fixed non-sensitive reason                            | None until explicit token submit or session recheck                                   |
| `probe-error`       | Safe unavailable/rate-limited state, status-owned optional retry, and token entry | A permitted explicit merchants retry or explicit ops-token submit                     |
| `disposed`          | Nothing                                                                           | Nothing; merchants fetch/timers are cancelled and all commit ownership is invalidated |

Setup starts synchronously in `probing`, before `onMounted`. A token already present in
sessionStorage cannot reveal an ops tab while the merchants request is pending. `onMounted`
issues exactly one `GET /api/admin/laplatform/merchants?limit=20&offset=0`. There is no
`/api/admin/me` call, watcher-triggered duplicate, tab-triggered duplicate, or second request to
load the same page. Only an `apiGet` success-path value that decodes as the fully valid strict
envelope establishes `session-merchants`; its `data` and `page` become the first rendered queue
atomically.

The backend contract still emits only HTTP 200 on success. The existing frontend `apiGet` seam,
however, treats every `response.ok` 2xx as success and returns only decoded data, not the status.
Without changing `src/api/http.ts`, the new module cannot distinguish 200 from another successful
2xx. It therefore accepts a strict validated envelope on the `apiGet` successful-2xx path. A 204
or other bodyless response becomes a non-envelope value and fails the strict decoder; so does any
malformed 2xx body. The frontend must not claim to prove exact 200 or widen the Allowed files to
add a response-status seam.

### Initial response matrix

The following matrix applies before session-merchants has ever been established. “Stored token”
means an operations token that the user explicitly supplied earlier; it is not attached to the
merchants request. Every transition waits for the one initial merchants request to settle, and
none automatically retries it.

| Initial outcome                           | No stored ops token                                               | Stored ops token                                                    |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Strict valid `apiGet` 2xx envelope        | Enter `session-merchants` with first rows/empty page              | Enter `session-merchants`; retain but do not use token              |
| Malformed/bodyless `apiGet` 2xx value     | `probe-error`, safe malformed copy, manual retry                  | Enter `ops`; reports exactly once                                   |
| 400                                       | `probe-error`, deployment/query-contract copy, no merchants retry | Enter `ops`; reports exactly once                                   |
| 401                                       | `gate`, login-required reason                                     | Enter `ops`; reports exactly once                                   |
| 403                                       | `gate`, capability-required reason                                | Enter `ops`; reports exactly once                                   |
| 404                                       | `probe-error`, BFF-not-deployed copy, no merchants retry          | Enter `ops`; reports exactly once                                   |
| 428                                       | `probe-error`, prerequisite-unavailable copy, no merchants retry  | Enter `ops`; reports exactly once                                   |
| 429                                       | `probe-error`, rate-limit copy and bounded cooldown/manual retry  | Enter `ops`; reports exactly once; no merchants timer/retry remains |
| 499                                       | `probe-error`, generic transient copy and manual retry            | Enter `ops`; reports exactly once                                   |
| 500/502/503/504                           | `probe-error`, fixed unavailable copy and manual retry            | Enter `ops`; reports exactly once                                   |
| Other HTTP status                         | `probe-error`, generic safe copy and manual retry                 | Enter `ops`; reports exactly once                                   |
| Network failure                           | `probe-error`, generic safe copy and manual retry                 | Enter `ops`; reports exactly once                                   |
| Locally owned abort/supersession/disposal | Silent; the current owner decides the next state                  | Silent; never activates ops                                         |

Here, 503 includes either kill switch being false as well as a safe unavailable failure. The UI
does not distinguish configuration detail. A returned 499 is treated as an HTTP failure only
when the current signal is still live; a locally aborted signal is always the silent ownership
case.

### Established-session response matrix

After one strict valid `apiGet` successful-2xx envelope has established session-merchants, no
later failure silently escalates to the more powerful ops lane, even if an old token remains in
storage:

| Later outcome                                              | Session behavior                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Strict valid `apiGet` 2xx envelope                         | Replace the current page if sequence and auth epoch still own it                               |
| Malformed/bodyless `apiGet` 2xx value                      | Stay in merchants lane, clear rows, show safe malformed copy, allow manual retry               |
| 401/403                                                    | Retire owner/epoch, clear stored ops token and rows/access, then enter `gate`; no ops fallback |
| 400/404/428                                                | Stay in merchants error state, clear rows, fixed non-retry contract/deployment copy            |
| 429                                                        | Stay in merchants error state, clear rows, bounded cooldown/manual retry                       |
| 499/500/502/503/504, other HTTP status, or network failure | Stay in merchants error state, clear rows, generic/fixed manual retry                          |
| Locally owned abort/supersession/disposal                  | Silent; cannot change rows, error, lane, or loading ownership                                  |

For 429, only a normalized `retryAfterSeconds` that is an integer from 1 through 60 inclusive
owns a cooldown timer. Missing, fractional, zero, negative, non-number, or greater-than-60 values
create no timer and permit an immediate manual retry. There is no automatic retry. A timer owns
the exact request sequence and auth epoch that created it; starting another request, changing
lane/epoch, retrying, or disposing clears it. A stale timer callback is a no-op.

A later session 401/403 uses one synchronous authorization-loss transition. Before committing
`gate`, it retires the current merchants request/timer owner, invalidates its sequence, advances
the auth epoch, clears the stored ops token, and clears rows/access. The token-clear hook
participates in that transition; implementation must not expose an intermediate gate or ops state
with the old token, and the failed or stale request's `finally` owns no subsequent commit.

Explicit token submit is its own exactly-once transition. A non-empty trimmed token increments
auth epoch, enters `ops`, and starts the reports queue once. Repeated submit for the same active
intent, an empty token, a stale handler, or a submit after lane/epoch ownership changed starts no
request. An ops 401/403 clears the token, invalidates its sequence/epoch, and enters `gate`.

Explicit exit, account change, logout, and unmount/disposal physically abort the merchants fetch
and clear every merchants-owned cooldown timer. They invalidate auth epoch/sequence before
clearing the stored ops token and all ephemeral access/data. This preserves the existing safe
AdminView unmount behavior. Existing legacy ops API helpers do not accept AbortSignal in this
batch, so disposal does **not** claim to cancel their physical HTTP transport; instead their
sequence, lane, auth epoch, success, error, and `finally` commit rights are invalidated before any
late settlement.

The stored operations token is deliberately **not** cleared when the initial merchants request
returns a strict valid envelope. Keeping a sentinel token present while the component remains
mounted in a successfully established, unrevoked `session-merchants` lane makes the no-leakage
test meaningful. A later session 401/403 clears it before `gate`; explicit exit, account change,
logout, and unmount/disposal also clear it. While retained, the token is not sufficient to activate
`useAdminConsole`: legacy methods require both an explicit `ops` state and a non-empty token.

## Browser API and strict decoder

The new browser API module has a fixed relative path and a deliberately narrow signature:

- caller inputs are only a normalized merchants query and optional `AbortSignal`;
- it accepts no token, headers, base URL, method, credential mode, arbitrary path, or generic
  `RequestInit`;
- it sends GET with cookie credentials and `cache: "no-store"` through the existing LIAN HTTP
  boundary;
- it internally fixes `redirect: "error"`; the caller cannot override it. A BFF/proxy 3xx must
  not be followed to a login page or another origin with `x-client-id`, cookies, or any other
  browser context. Redirect rejection becomes the fixed local network/probe error;
- it never imports or uses the legacy `withAuthHeader` helper;
- the canonical query order is `limit`, `offset`, `q`, `status`;
- the initial URL is exact and has only `limit=20&offset=0`;
- the browser calls only the LIAN BFF path, never an LAPlatform origin.

The API boundary catches every raw HTTP-layer failure immediately and replaces it with a local
safe error whose message is selected from fixed frontend copy. It may retain only:

- an integer HTTP status in the accepted 400-599 range, otherwise zero;
- one code generated locally from this exact closed mapping, never copied from a raw server code:
  - 400 -> `REQUEST_CONTRACT`;
  - 401 -> `AUTH_REQUIRED`;
  - 403 -> `CAPABILITY_REQUIRED`;
  - 404 -> `BFF_NOT_DEPLOYED`;
  - 428 -> `PREREQUISITE_UNAVAILABLE`;
  - 429 -> `RATE_LIMITED`;
  - 499, 500, 502, or 504 -> `TEMPORARILY_UNAVAILABLE`;
  - 503 -> `INTEGRATION_UNAVAILABLE`;
  - every other validated 400-599 status -> `HTTP_FAILURE`;
  - a caught `LianApiError` without an integer 400-599 status -> `HTTP_FAILURE` with status zero;
  - fetch failure or redirect rejection -> `NETWORK_FAILURE` with status zero;
  - a decoder rejection on any `apiGet` success-path value, including 204/no body ->
    `MALFORMED_RESPONSE` with status zero;
- `retryAfterSeconds` only when status is 429 and the normalized value is an integer from 1
  through 60 inclusive, otherwise null.

It retains no raw `LianApiError.message`, code, cause, stack, response object, body, URL, headers,
query, token, or other server-controlled diagnostic. Even a raw code that exactly spells a local
enum member is discarded; the local code is regenerated only from the mapping above. Abort is
determined from the caller-owned signal/sequence, not by trusting a spoofable raw error name, and
a locally owned abort produces no displayed safe error.

Decode the response from `unknown`. A success must have exact top-level keys `data`, `page`, and
`meta`; exact merchant keys `id`, `code`, `displayName`, `status`, `createdAt`, and `updatedAt`;
exact page keys `limit`, `offset`, and `total`; and exact meta keys `requestId` and
`schemaVersion`. Reuse the accepted limits semantically without importing a build/runtime
dependency from the LAPlatform repository:

- ID: `[A-Za-z0-9_-]{1,64}`;
- code: `[A-Za-z0-9._-]{1,64}`;
- display name: JavaScript string `.length` from 1 through 160 UTF-16 code units, exactly matching
  the accepted backend validator; do not trim, normalize, coerce, or require non-whitespace text,
  and preserve the accepted value exactly;
- status: exactly `active` or `inactive`;
- timestamps: real UTC timestamps in the accepted ISO shape;
- page limit: integer 1-100;
- page offset: safe integer 0-1,000,000;
- total: non-negative safe integer;
- meta request ID: canonical UUID v4;
- schema version: exactly `v1`.

The returned page limit and offset must equal the canonical request. Unknown keys, extra fields,
missing fields, invalid arrays, coercible values, unsafe numbers, invalid timestamps, and contract
drift become a fixed local malformed-response error. They must never be rendered as an empty
list or as raw JSON.

## Query, list, and concurrency behavior

- The UI owns a draft search value and submits explicitly. It trims q, validates at most 160
  characters, and encodes it with `URLSearchParams`. Empty q is omitted.
- Status is exactly all/active/inactive; all omits the wire parameter.
- Page is one-based UI state only. The browser sends offset `(page - 1) * 20`; it never sends a
  `page` query key. q/status changes reset to page one.
- Clicking the selected status or current page does not issue another request. Explicit refresh
  or retry is the only force reload.
- The previous button is disabled on offset zero. Compute `nextOffset = offset + 20`; the next
  button is disabled when `offset + data.length >= total`, `nextOffset` is not a safe integer, or
  `nextOffset > 1_000_000`. The click handler independently rechecks those conditions and returns
  without issuing a request if any fails.
- Each accepted **merchants** load snapshots a canonical query, physically aborts its predecessor,
  creates a new `AbortController`, and increments a monotonically increasing request sequence.
- A result may commit only if the component is still live, its signal is not aborted, its
  sequence is latest, and its captured auth epoch still equals the current epoch.
- A stale request's success, failure, or `finally` cannot replace rows, display an error, or clear
  the latest request's loading state.
- Retry uses the failed request's frozen canonical query and issues exactly one new request.
- Starting any request clears visible rows. Empty is rendered only after a strict valid
  `apiGet` successful-2xx envelope with zero data; loading, failure, and authorization loss are
  never presented as empty.
- Rows and capabilities are in-memory only and are cleared on account epoch change and unmount.

Legacy ops requests use the existing API signatures and therefore have no new physical abort in
this task. Each ops load/action still captures lane, auth epoch, and an operation sequence before
starting. A late legacy success, error, nested reload, or `finally` can commit only while all three
still match. This is logical ownership invalidation, not a claim that the old HTTP transport was
cancelled.

The auth epoch is module-scoped frontend state shared with the existing profile
`clearAdminAccessState()` hook. It increments on operations-token set/clear, login/logout/account
change, authorization loss, explicit lane reset, and disposal. It is not stored in browser
storage.

## Safe presentation

- Session mode renders only merchant display name, ID, code, status, updated timestamp, total,
  search/status controls, pagination, and an optional already-validated request UUID.
- Use Vue text interpolation only. No `v-html`, raw HTML insertion, or string-built DOM.
- Error copy is selected locally from status/code categories. Never render a backend/upstream
  message, URL, body, headers, stack, cause, token, or query value.
- 400 copy means a request-contract mismatch; 401 means login is required; 403 means permission
  is absent; 404 means the BFF is not deployed; 428 means a prerequisite is unavailable; 429
  means retry later; 499/500/502/504 mean temporarily unavailable; and 503 means one or more
  integration gates are not available. Unknown/network/malformed failures use one generic safe
  message. These are local categories and never raw HTTP messages.
- The existing service-worker policy that excludes `/api/*` remains unchanged. No merchant
  response or capability decision is persisted in localStorage, sessionStorage, IndexedDB,
  Cache API, or a service worker.

## Allowed files

Implementation may modify or create only:

- `src/features/admin/AdminView.vue`
- `src/features/admin/useAdminToken.ts`
- `src/features/admin/useAdminConsole.ts`
- `src/features/admin/useAdminAccess.ts` (new)
- `src/features/admin/useAdminMerchants.ts` (new)
- `src/features/admin/AdminLaMerchantsBlock.vue` (new)
- `src/features/admin/index.ts`
- `src/api/adminLaPlatform.ts` (new)
- `src/config/brand/admin.ts`
- `tests/admin/admin-token.test.ts`
- `tests/admin/admin-console-auth-mode.test.ts`
- `tests/admin/admin-console.structure.test.mjs`
- `tests/admin/admin-access-fsm.test.ts` (new)
- `tests/admin/admin-la-merchants-api.test.ts` (new)
- `tests/admin/admin-la-merchants-state.test.ts` (new)
- `tests/e2e/local/admin-la-merchants-journeys.spec.ts` (new)
- `scripts/check-test-inventory.mjs` (only change the expected Vitest count from 172 to 175;
  expected Node count remains 67)
- `docs/agent/tasks/la2b-laplatform-merchants-ui.md`
- `docs/agent/handoffs/la2b-laplatform-merchants-ui.md` (acceptance phase only)

No other file becomes allowed merely because a gate reports an unrelated baseline failure.
`npm run check` intentionally generates the ignored verification artifact
`docs/architecture/auto/file-ownership.md` after new `src/` files appear. It may exist locally as
gate output, but it is not an Allowed tracked change and must not be force-added, staged, or
committed.

## Forbidden files and actions

- `src/api/admin.ts`, `tests/admin/admin-session-probe.test.ts`, and
  `src/composables/usePostDetailExtensions.ts`; `/api/admin/me` behavior remains byte-identical.
- `tests/e2e/admin-session-entry.spec.ts`; its current weak live assertion remains unchanged and is
  not LA2b acceptance evidence.
- Existing reports, verification, auth-link, audit, or mutation API contracts and child
  components, except the explicitly allowed top-level console isolation change.
- Any frontend call to `/api/admin/me` from `AdminView` or the new composables.
- Any roleIds-, username-, `ok`-, `viaToken`-, tag-, or client-side role-derived LAPlatform
  permission.
- Any stores/catalog route, tab, type, fetch, or UI.
- Any merchant POST, PUT, PATCH, DELETE, activation, deactivation, creation, or edit action.
- Any browser-visible or browser-supplied `LAPLATFORM_SERVICE_TOKEN`, ADMIN_TOKEN on the new BFF,
  direct LAPlatform URL, caller-supplied header, or dynamic BFF base/path.
- Browser persistence or caching of capabilities, merchants, filters, responses, request IDs, or
  auth epoch.
- Backend, NodeBB, DSPlatform, LAPlatform, data, Redis, wallet, database, storage, runtime,
  deployment, or infrastructure files.
- `package.json`, lockfiles, dependencies, Vite/PWA/service-worker configuration, Playwright
  configuration, CI/workflows, environment examples, scripts other than the exact inventory-count
  edit above, generated ownership docs, public assets, or deployment files.
- Broad formatting, suppression/skip/only/todo changes, weakened old assertions, snapshot
  replacement, production requests, credential access, pushes, merges, or deployment.
- Treating the accepted local F1-F3 ancestry as an LA2b feature diff, or opening a nominally small
  LA2b review whose comparison includes that whole prerequisite chain.

## RED test matrix

Tests must be added before runtime changes and collected against the old runtime without suite
collapse. Every RED test that targets a **new** module performs its dynamic import inside the test
body; it must not statically import a missing module at file evaluation time. The old runtime must
therefore collect all tests and fail reachable missing-contract assertions rather than losing an
entire suite. Record exact RED totals in the handoff.

The three new Vitest files move the inventory from 172 to 175; the 67-file Node structure
inventory does not change. `scripts/check-test-inventory.mjs` changes only that expected Vitest
count. In `admin-console.structure.test.mjs`, replace only the stale AdminView assertions that
require AdminView to probe `/api/admin/me` or clear/use the old `sessionAdmin` path. Do not delete,
weaken, or rewrite the independent `/api/admin/me` API/helper, post-detail consumer, authorization,
or compatibility contracts.

### Initial authorization and lane selection

1. Initial synchronous state is `probing`, including when an ops token is already stored.
2. While the first merchants request is pending, merchant rows, all legacy tabs, and token gate
   have count zero.
3. Mount issues exactly one initial merchants GET with exact default query and no `/api/admin/me`.
4. A strict valid non-empty envelope on the `apiGet` successful-2xx path both authorizes session
   mode and supplies first rows without a second request. Test the backend-contract 200 and a
   representative non-200 2xx to lock the status-blind seam.
5. A strict valid empty envelope on that success path authorizes session mode and renders the
   explicit empty state.
6. A malformed success value, 204/no body, or any other bodyless 2xx does not authorize session
   mode or render empty; it maps to local `MALFORMED_RESPONSE`.
7. Initial 401 and 403 without token enter distinct safe gate reasons and issue no queue request.
8. Initial 401/403 with a stored explicit token enters ops and loads reports exactly once.
9. Initial 400/404/428 without token enters the specified fixed non-retry state; 429,
   499/500/502/503/504, unknown status, redirect rejection, network, and malformed success enter
   their specified safe retry/error state. None auto-retries.
10. Every corresponding initial failure with a stored token enters ops only after the merchants
    request settles; reports loads once and merchants/timer ownership is retired.
11. 429 creates a timer only when the existing HTTP layer supplies a normalized safe-integer
    `retryAfterSeconds` from 1 through 60. The new module cannot and need not infer whether that
    normalized number originated from delta-seconds or an HTTP date. Every missing, fractional,
    non-number, non-positive, or greater-than-60 value creates no timer. New intent, lane/epoch
    change, and disposal clear ownership; stale callbacks are no-ops.
12. Locally aborted initialization is silent and cannot reveal gate, ops, session, or error state;
    a live HTTP 499 follows the transient failure arm.
13. Explicit non-empty token submit changes lane/epoch and starts reports exactly once; duplicate,
    empty, or stale submits do not call reports.

### Credential and route isolation

14. With a sentinel ops token still in sessionStorage, the BFF URL, query, headers, body, options,
    error, diagnostics, and rendered DOM never contain the sentinel.
15. The new API exposes no token/header/base/path/method/RequestInit input and sends no
    Authorization or x-admin-token.
16. The browser path is fixed to `/api/admin/laplatform/merchants`; no direct LAPlatform origin,
    fallback path, trailing slash, or alternate method exists. The internal request fixes
    `redirect: "error"`, follows no 3xx, and maps redirect rejection to safe local failure.
17. Session mode mounts no reports, verifications, auth-links, audit, user action, or mutation
    component and calls none of their APIs.
18. `useAdminConsole` requires both explicit ops mode and a non-empty token; it never substitutes
    an empty token for session access.
19. Ops mode keeps all four legacy tabs and their existing explicit Bearer behavior. Its existing
    physical requests are not claimed to abort; stale lane/authEpoch/sequence settlements,
    nested reloads, and `finally` are rejected logically.
20. Static/runtime tests prove `AdminView` and new modules do not import or call `fetchAdminMe` or
    `isAdminMeRoleEligible`.
21. Existing non-AdminView `/api/admin/me` tests and caller behavior remain green and unchanged.

### Decoder and presentation

22. Exact envelope/merchant/page/meta values decode, clone, and expose only the UI contract.
23. Display-name tests use the backend's exact JavaScript `.length` 1-160 UTF-16-code-unit rule,
    preserve whitespace/value exactly, and reject only wrong type or out-of-range length.
24. Unknown/missing/non-enumerable-equivalent JSON keys, wrong arrays, nulls, coercible values,
    invalid identifiers/codes/status/timestamps/page numbers/request IDs/schema versions fail.
25. Response limit/offset mismatch with the canonical query fails closed.
26. Non-JSON/HTML, raw backend messages, query echoes, and oversized or invalid diagnostic IDs
    render only fixed escaped copy.
27. Raw HTTP errors are translated immediately; the safe local error retains only validated
    status, the exact status-derived local code mapping, and bounded 429 retry seconds. Arbitrary
    and even regex-valid/raw-enum-matching server codes cannot influence the retained code, copy,
    or DOM; raw message/cause/stack/response are absent.
28. Loading clears/hides rows; success renders escaped rows; a successful zero-length data array
    alone renders empty.
29. A 401/403 after session establishment first retires request/timer ownership, invalidates the
    sequence/auth epoch, clears the stored ops token and rows/access, and only then enters `gate`.
    There is no intermediate token-bearing gate/ops render and no automatic ops fallback.
30. Later 400/404/428 use fixed non-retry merchants errors; 429 uses the bounded timer; and
    499/500/502/503/504/unknown/network/redirect/malformed failures remain in the merchants lane
    with their specified safe behavior and no stale rows.

### Query, pagination, retry, and races

31. q submit trims/encodes q, validates length, resets offset to zero, and fires once.
32. all/active/inactive are the only status values; status change resets offset; selecting the
    current status is a no-op.
33. Previous/next compute offsets correctly and honor both total and hard-bound states; `page` is
    never sent on the wire. At the boundary, `nextOffset = offset + 20` must be a safe integer no
    greater than 1,000,000. A non-safe or over-1,000,000 next offset disables Next, and both the
    disabled control and guarded handler issue zero requests.
34. Canonical query key order is stable and unknown keys are never serialized.
35. Retry snapshots the failed canonical query and creates exactly one forced request.
36. A new merchants request physically aborts the prior merchants request. A late old success or
    error cannot win.
37. A stale request's `finally` cannot turn off the current request's loading state.
38. Auth epoch change while a request is pending prevents its successful result from committing.
39. Account A rows never flash for account B, even when A's response settles late.
40. Explicit exit, account change, logout, and unmount each clear the stored ops token and
    increment auth epoch. Unmount also physically aborts merchants initialization/list requests,
    clears merchants timers, and permits no late state or DOM commit. A legacy ops request may
    still settle physically but every stale commit path remains rejected.

## Hermetic local E2E matrix; live proof deferred

The new local Playwright spec is hermetic and uses `page.route`; it never contacts production:

1. Preload a sentinel ops token, hold the initial BFF response, and assert no privileged flash.
2. Fulfill a valid non-empty backend-contract 200; assert one BFF call, no `/api/admin/me`, one
   merchants-only tab, rows visible, and every legacy endpoint called zero times. Also fulfill a
   representative non-200 2xx with the same strict envelope and prove the current status-blind
   `apiGet` seam accepts it without a second request.
3. Inspect the real intercepted request and prove the sentinel/token/Authorization/x-admin-token
   is absent while cookies remain the only browser auth channel.
4. Cover a valid empty success envelope separately, plus 204/no body and malformed successful 2xx
   as safe decoder failures.
5. Cover initial malformed successful 2xx, 400, 401, 403, 404, 428, 429, 499, 500, 502, 503, 504,
   unknown status, redirect rejection, and network failure with and without a stored ops token
   according to the exact FSM.
6. Cover every corresponding post-session arm, including the ordered 401/403 owner/epoch/token
   retirement before gate and no automatic ops escalation.
7. Cover retry from a safe error to a backend-contract 200 and prove exactly one request per user
   action; cover valid 1/60-second normalized cooldown ownership plus missing, invalid, and
   over-60 no-timer arms.
8. Submit a non-empty explicit ops token and prove one reports request; repeat/empty/stale submits
   prove zero additional requests.
9. Cover q, status, next/previous URL construction and disabled states. Unit coverage injects a
   synthetic non-safe next offset; the local E2E reaches the 1,000,000 hard-bound fixture. In both,
   assert Next is disabled and the guarded click issues zero requests; inspect all local E2E calls
   and prove every serialized offset is a safe integer in the inclusive 0-1,000,000 range.
10. Resolve two merchants requests in reverse order and prove latest-wins plus physical abort.
11. Settle a legacy ops request after lane/authEpoch/sequence invalidation and prove every late
    success/error/finally commit is ignored without claiming physical abort.
12. In separate hermetic cases, trigger explicit admin exit, account change, logout, and
    navigate-away/unmount; prove each clears the stored ops token. With merchants and ops work
    pending, also prove merchants/timer cancellation and logical rejection of any late ops render.

No exact approved staging origin exists in the accepted source for this batch. Therefore
`tests/e2e/admin-session-entry.spec.ts` stays byte-for-byte unchanged, its existing weak
gate-disappearance assertion cannot count as LA2b evidence, and this task neither runs nor edits a
live suite. It reads no live credential, contacts no staging/production target, and performs no
rollout or deployment.

A separate release/staging task may add the live spec to its own Allowed files only after an exact
non-production staging origin is explicitly supplied, source-controlled, and reviewed. That later
task must install a fail-closed guard before fixture setup, role checks, login, or any credential
environment access. The guard must require an explicit HTTPS root origin and
`LIAN_E2E_ENV=staging`, compare exact normalized origin equality, reject production, loopback,
userinfo/path/query/fragment, substring/suffix guesses, and every unapproved origin, and log no
environment value. Only after the guard passes may that task prove the first BFF 200, exact call
count, token/header absence, rows or successful empty state, and zero legacy session calls.

The later live task must use only approved existing fixtures, invent no moderator fixture, and
must not require a real ADMIN_TOKEN. Moderator/capability denial, ADMIN_TOKEN-only denial, method,
trailing-slash, encoded-path, unknown-query, dual-flag, and auth-before-flag ordering remain owned
by backend hermetic tests. None of this deferred live scope is acceptance evidence for the current
LA2b implementation batch.

## Acceptance criteria

- [ ] RED tests are committed separately, collect normally, and fail for the intended missing
      behavior against the old runtime.
- [ ] AdminView makes no `/api/admin/me` request and issues one exact initial merchants GET.
- [ ] A strict validated envelope on the existing `apiGet` successful-2xx path is the sole way to
      establish session merchants mode and also supplies the first queue without a duplicate
      request. The backend emits 200; the frontend does not claim to observe exact status, and
      204/bodyless or malformed 2xx fails closed.
- [ ] Probe/loading, rows, empty, complete HTTP/FSM mapping, bounded retry, q/status/page,
      latest-wins, merchants physical abort/timer cleanup, legacy logical invalidation, unmount,
      and auth-epoch behavior match this task exactly.
- [ ] Session mode renders only merchants GET; ops mode preserves only the existing legacy tabs
      and explicit Bearer calls.
- [ ] A stored sentinel ops token retained instead of activating ops remains present only while a
      successfully established, unrevoked `session-merchants` component is mounted. It never
      reaches the new BFF, direct LAPlatform, logs, errors, storage beyond its existing key, or
      DOM; a later session 401/403 clears it before `gate`, and explicit exit, account change,
      logout, and unmount/disposal also clear it.
- [ ] Next is disabled and its handler issues zero requests whenever the total boundary is reached
      or `nextOffset = offset + 20` is non-safe or greater than 1,000,000; every wire offset is a
      safe integer from 0 through 1,000,000.
- [ ] `/api/admin/me`, its frontend API/helper, and its post-detail caller remain unchanged.
- [ ] No capabilities, merchant data, response, filter, request ID, or epoch is persisted/cached.
- [ ] New-module RED tests use test-body dynamic imports; all tests collect on the old runtime.
- [ ] Test inventory changes intentionally from 172/67 to exactly 175/67, with only the Vitest
      expected count updated.
- [ ] Implementation is based on real main after F3j `0d78fda` lands, or is restacked on a real
      main containing the equivalent accepted chain. Inventory and scope are revalidated against
      that merge base, and the LA2b review does not include the prerequisite F1-F3 history.
- [ ] Targeted unit/structure/local E2E and full frontend verification pass.
- [ ] The backend BFF prerequisite is independently accepted, but this batch claims only hermetic
      local frontend evidence and performs no live proof, rollout, deployment, or flag change.
- [ ] `LAPLATFORM_MERCHANTS_BFF_ENABLED=false` and `LAPLATFORM_ENABLED=false` remain unchanged;
      production remains **HOLD** without separate explicit release authority.
- [ ] `tests/e2e/admin-session-entry.spec.ts` is unchanged and is not cited as LA2b evidence. A
      separate approved release/staging task owns the fail-closed live guard and live proof.
- [ ] The tracked diff contains only allowed files.

## Validation commands

Run with the repository's Node 22 runtime. The executor records RED totals before runtime changes,
then GREEN totals and command exits in the handoff.

```bash
npx prettier --check docs/agent/tasks/la2b-laplatform-merchants-ui.md
npm run check:test-inventory
npm run test:unit -- tests/admin/admin-token.test.ts \
  tests/admin/admin-console-auth-mode.test.ts \
  tests/admin/admin-access-fsm.test.ts \
  tests/admin/admin-la-merchants-api.test.ts \
  tests/admin/admin-la-merchants-state.test.ts
npm run test:structure
npm run test:e2e:local -- tests/e2e/local/admin-la-merchants-journeys.spec.ts
npm run check
npm run ops:guard
npm run build
npm run verify
git diff --check
git status --short
```

`npm run check` may create or refresh ignored
`docs/architecture/auto/file-ownership.md`. Inspect it as validation output if useful, then leave it
ignored; never force-add, stage, or commit it.

No staging or production validation, credential read, rollout, deployment, flag change, push, or
merge is part of implementation or local acceptance.

## Deferred release plan; no rollout in this batch

This task stops after the Allowed implementation, hermetic validation, and handoff. Both
`LAPLATFORM_MERCHANTS_BFF_ENABLED` and `LAPLATFORM_ENABLED` remain false everywhere controlled by
this task. The following sequence is a prerequisite for a separate release/staging task, not
authorization to execute it here:

1. Confirm the real-main frontend stack/merge condition above and independently accept the LA1
   read client, LA2a principal foundation, and backend LA2b exact route.
2. After an exact non-production staging origin is explicitly approved, create a separate scoped
   release/staging task that owns live-spec changes, deployment, and credential-safe validation.
3. That later task may deploy the backend and frontend with both flags false. Before either flag
   is enabled in staging, the separately scoped task, exact origin, fail-closed guard, and
   credential-safe execution plan must all be approved; only that task may then enable both after
   hermetic backend gates pass.
4. The later task must run its fail-closed target guard and complete live journey before proposing
   any wider release. It must record one initial BFF request, strict envelope, zero credential
   leakage, zero legacy session calls, and rollback readiness.
5. Production keeps both flags false and remains **HOLD**. Enabling either production flag needs
   separate explicit release authority after reviewed staging evidence and backup/rollback review.

`LAPLATFORM_MERCHANTS_BFF_ENABLED` is the first-response and rollback kill switch for the browser
route. `LAPLATFORM_ENABLED` remains the independent LA1 transport prerequisite. No frontend env
flag or runtime path override is added.

## Risks

- **Illegal mixed privilege state:** a stored ops token could accidentally activate old mutation
  surfaces during a session read. Mitigation: discriminated lane state plus dual ops guard.
- **Credential leakage:** a generic fetch helper could forward ADMIN_TOKEN to the new BFF.
  Mitigation: token-free API signature, sentinel tests, and exact request inspection.
- **False-positive authorization:** a standalone probe may succeed while the queue remains
  unreachable. Mitigation: the valid first queue response is the capability proof.
- **Duplicate first load:** mount/watch/tab effects may each fetch page zero. Mitigation: one
  explicit initializer and exact call-count RED/E2E assertions.
- **Cross-account stale rows:** a late response can commit after logout/account switch. Mitigation:
  physical merchants abort, logical ops sequence/lane/auth-epoch invalidation, clearing on request
  start, and unmount tests.
- **Rollout skew:** frontend may encounter 404/503 before backend enablement. Mitigation: backend
  first, both flags false, safe fail-closed state, and ops fallback.
- **Dual-flag ambiguity:** operators may enable LA1 transport while believing the browser BFF is
  disabled, or vice versa. Mitigation: name both flags in every rollout check, use the BFF flag as
  first rollback, and require both true only in approved staging.
- **Contract drift:** accepting multiple envelopes or coercing fields could hide backend/LA drift.
  Mitigation: one strict unknown decoder with exact keys and safe malformed response.

## Deferred rollback plan

Because this batch performs no rollout or deployment, its immediate rollback is limited to
reverting the Allowed LA2b code/test/document changes while both flags remain false. If a later
approved release/staging task deploys this work, its fastest safe rollback is, in order:

1. Set backend `LAPLATFORM_MERCHANTS_BFF_ENABLED=false` first and restart through the approved
   deployment process. After earlier auth/rate-limit guards, the route returns safe 503 and issues
   no LAPlatform request.
2. Redeploy the previous frontend commit, removing the merchants session UI while preserving the
   legacy operations-token console.
3. Set `LAPLATFORM_ENABLED=false` to disable the independent LA1 transport prerequisite as
   defense in depth.
4. Revert the backend LA2b exact route commit if necessary. LA1 and LA2a may remain dormant because
   neither independently exposes a browser route.
5. If full program rollback is required, revert LA2a and LA1 only through their recorded reverse
   commit chains.

There is no merchant mutation, database/Redis/storage schema, NodeBB state, LAPlatform data,
service-worker cache, or browser-persisted merchant data to clean up. Token rotation is not needed
unless separate evidence shows a credential escaped; the contract and tests are designed to make
such escape an acceptance blocker.
