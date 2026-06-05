# Admin frontend surface — audit for ps#511

## Scope & method

Read-only inventory of the LIAN mobile-web admin surface as it stands on `main`
at 2026-05-23 (HEAD `afa9361`). The intent is to feed
[platform-server#511 — canonical admin verification aggregate
contract](https://github.com/taoyu051818-sys/lian-platform-server/issues/511)
with the actual frontend consumer shape, so the backend contract gets
right-sized to what mw reads, not guessed from the backend side.

Method:

- Walk every file under `src/features/admin/**`.
- Pull every admin endpoint string from the codebase (`/api/admin/*`).
- Cross-reference DTO surface in `src/types/admin.ts` and the in-file types in
  `src/api/admin.ts`.
- Track every place outside the admin view that reads admin signals
  (`isAdminMeRoleEligible`, `fetchAdminMe`, moderation notifications).
- Record what the consumer actually reads off each response. The DTO is the
  contract surface; the consumer set is the binding contract.

No source files were modified.

## Verification — current consumer

**Frontend location**

- Container: `src/features/admin/AdminView.vue` (verifications tab)
- State machine: `src/features/admin/useAdminConsole.ts`
  (`loadVerificationRequests`, `reviewVerificationRequest`,
  `revealVerificationRequest`)
- API client: `src/api/admin.ts` (`fetchAdminVerificationRequests`,
  `patchAdminVerificationRequest`, `fetchAdminVerificationDetail`)
- DTO: defined inline in `src/api/admin.ts` (`AdminVerificationRequest`,
  `AdminVerificationDetail`, `AdminVerificationListResponse`)

**Backend endpoints called**

| Action                      | Method  | Path                                                                        |
| --------------------------- | ------- | --------------------------------------------------------------------------- |
| List queue                  | `GET`   | `/api/admin/verifications?status=&verificationType=&userId=&limit=&offset=` |
| Approve / reject (org-join) | `PATCH` | `/api/admin/verifications/org-join/:verificationId`                         |
| Approve / reject (realname) | `PATCH` | `/api/admin/verifications/realname/:verificationId`                         |
| Approve / reject (merchant) | `PATCH` | `/api/admin/verifications/merchant/:verificationId`                         |
| Approve / reject (runner)   | `PATCH` | `/api/admin/verifications/runner/:verificationId`                           |
| Reveal PII (realname only)  | `GET`   | `/api/admin/verifications/realname/:verificationId?reveal=true`             |

The list endpoint is already aggregate. Transition and reveal are still
per-channel — the frontend computes the channel-specific path inside
`verificationTransitionPath()` / `verificationDetailPath()`.

**Stitching: 1 list + 1 transition + (optional) 1 reveal per item.** After a
PATCH succeeds the composable re-runs `loadVerificationRequests(filter)` to
pick up the new status because the PATCH response (`{ verification: {...} }`)
only returns the single record.

**Fields the consumer actually reads off the list response**

From `AdminVerificationRequest`:

- `verificationId` — list key, transition path, reveal path
- `verificationType` — `"org-join" | "realname" | "merchant" | "runner"`,
  drives the per-channel transition path AND the summary-row layout AND the
  reveal-button gating
- `userId` — rendered raw
- `status` — `"pending" | "approved" | "rejected"`, drives review-action
  visibility (only `pending` is reviewable)
- `publicSummary` — record consumed via `verificationSummaryRows()`. Per-type
  shape:
  - `org-join`: reads `orgName`, `orgId`, `note`
  - `realname`: reads `idType`, `realName`, `idNumber`, `contact` (the
    redacted variants — list never returns plaintext PII)
  - `merchant`: reads `merchantName`, `note`
  - `runner`: reads `note`
- `reviewerId`, `reviewedAt` — rendered when present
- `reviewerNote` — rendered as a note prefix when present
- `createdAt`, `updatedAt` — submitted-at / fallback timestamp

Plus the envelope fields `items[]`, `total`.

**Fields read off the realname reveal response (`AdminVerificationDetail`)**

Only used for `verificationType === "realname"` and only the four PII fields:
`idType`, `realName`, `idNumber`, `contact`. Everything else on
`AdminVerificationDetail` (the `submittedFields` blob, `note`, `orgId`,
`orgName`) is declared but unread by the verifications tab.

**Pagination / filtering**

- Filters in flight: `status` (`pending` is the default tab landing),
  `verificationType` (declared in API client but never set from the UI today —
  only the four-status filter chip group is wired).
- Pagination not used. The composable hardcodes `limit: 100` and never sends
  `offset`. The UI shows no paging controls. `total` is read into a ref
  (`verificationTotal`) but never rendered.

## Moderation (reports + post-locks + user-status) — current consumer

**Frontend location**

- Container: `src/features/admin/AdminView.vue` (reports tab) →
  `src/features/admin/AdminQueueList.vue` →
  `src/features/admin/AdminQueueItem.vue`
- User status side panel: `src/features/admin/AdminUserActionPanel.vue`
- State machine: `src/features/admin/useAdminConsole.ts`
  (`loadReports`, `transitionReport`, `applyPostAction`, `applyUserStatus`)
- API client: `src/api/admin.ts` (`fetchAdminReports`, `patchAdminReport`,
  `postAdminPostAction`, `patchAdminUserStatus`)
- DTO: `src/types/admin.ts` (`AdminReport`, `AdminReportStatus`,
  `AdminPostAction`, `AdminUserStatus`, `AdminUserStatusResult`)

**Backend endpoints called**

| Action                                 | Method  | Path                                                    |
| -------------------------------------- | ------- | ------------------------------------------------------- |
| List reports                           | `GET`   | `/api/admin/reports?status=&targetType=&limit=&offset=` |
| Transition report                      | `PATCH` | `/api/admin/reports/:reportId`                          |
| Post moderation (hide / lock / unlock) | `POST`  | `/api/admin/posts/:tid/:action`                         |
| User status moderation                 | `PATCH` | `/api/admin/auth/users/:userIdOrEmail/status`           |

**Stitching**

The moderation tab does fan out across endpoints by design — one queue list
plus per-row drill-downs into report-state OR target-post-state OR
target-user-state. Each row in `AdminQueueItem.vue` may emit any combination
of `transition` (report state) and `postAction` (target post — only when
`report.targetType === "post"` and `Number(report.targetId)` parses).

The user-status panel (`AdminUserActionPanel.vue`) is independent of the
reports list — admins type a userId/email manually. Today it does not pull
from the report row; the row's `actorId` (reporter) is shown but never piped
into the panel.

**Fields the consumer reads**

`AdminReport`:

- `reportId` — list key, PATCH path
- `targetType` — used to decide whether `postAction` is offered
- `targetId` — used as `tid` for post action when target is a post
- `pid` — declared, unread by current UI
- `actorId` — rendered as reporter
- `reason` — rendered raw
- `status` — drives status chip + filter chip
- `reviewerId`, `reviewedAt` — declared, unread by the row UI today
- `action`, `note` — `note` seeds the textarea on expand; `action` declared
  but unread
- `createdAt`, `updatedAt` — formatted via `formatAdminTime`

`AdminUserStatusResult`: only consumed via the `actionMessage` string ("操作已
生效"). The structured result (`userId`, `status`, `statusReason`,
`statusChangedAt`) is computed in the API client but discarded by the
composable.

**Pagination / filtering**

- Status filter chips render the four-state set: `""` (all) / `pending` /
  `reviewing` / `resolved` / `dismissed`. The DTO declares 11 statuses —
  seven of them (`ignored`, `handled`, `hidden`, `restricted`, `banned`,
  `restored`, `false_report`) are mapped through `adminStatusLabel` but never
  filterable.
- `targetType` filter is in the API client signature but unused.
- Same `limit: 100`, no offset, no paging UI.

## Help-state override — current consumer

**Not present in the admin surface.** Help state lifecycle (link/unlink event,
mark resolved, mark closed) is owned by the post detail page itself
(`src/composables/useHelpManage.ts`, `src/features/detail/PostDetailHelpManageBlock.vue`)
and runs against `/api/events/help/...`. Permission gating uses
`post.helpManageable`, a server-shipped boolean on `PostDetail`.

The admin role does not get a separate help-override endpoint or surface in
the admin tabs today. If admins need to override help state, they do so by
becoming the help author (or via direct API). Out of scope for ps#511 unless
backend chooses to add one.

## Audit log — current consumer

**Frontend location**

- Container: `src/features/admin/AdminView.vue` (audit tab)
- Sub-block: `src/features/admin/AdminAuditLogList.vue`
- State machine: `src/features/admin/useAdminConsole.ts` (`loadAuditLog`)
- API client: `src/api/admin.ts` (`fetchAdminAuditLog`)
- DTO: `src/types/admin.ts` (`AdminAuditEvent`, `AdminAuditListResponse`)

**Backend endpoints called**

| Action            | Method | Path                                                   |
| ----------------- | ------ | ------------------------------------------------------ |
| List audit events | `GET`  | `/api/admin/audit-log?actorId=&action=&limit=&offset=` |

One call. No stitching.

**Fields the consumer reads** (all of `AdminAuditEvent`):

- `eventId` — list key
- `actorId` — rendered
- `action` — rendered raw
- `targetType`, `targetId` — rendered as `"<type> <id>"` when either is set
- `detail` — `JSON.stringify`'d into a `<dd>` when truthy. **The audit list
  treats `detail` as opaque blob.** No structured rendering.
- `createdAt` — formatted

**Pagination / filtering**

`actorId` and `action` filter params are declared in the API client signature
but the audit tab UI does not surface filters today — only a refresh button.
Same `limit: 100`, no offset.

## Admin session probe — cross-cutting consumer

**Frontend location**

- API client: `src/api/admin.ts` (`fetchAdminMe`, `isAdminMeRoleEligible`)
- AdminView gate: `src/features/admin/AdminView.vue` (`probeAdminSession`)
- Dual-auth side: `src/features/admin/useAdminToken.ts` (sessionStorage-only Bearer fallback)
- Event-manage probe in detail: `src/composables/usePostDetailExtensions.ts`
  (`probeEventManageable`)

**Backend endpoints called**

| Action                   | Method | Path            |
| ------------------------ | ------ | --------------- |
| Admin role / token probe | `GET`  | `/api/admin/me` |

Response shape consumed (`AdminMeResponse`):

- `ok: boolean` — first gate
- `viaToken: boolean` — true bypasses the role check (Bearer path)
- `user.roleIds: string[]` — case-insensitive match against
  `{"admin", "moderator"}` to decide cookie-session admin eligibility

`user.id`, `user.username` are declared on the type but not read by either
consumer (id/username come from `/api/auth/me` instead).

**Stitching: 2 endpoints to derive one bit.** `usePostDetailExtensions`
fan-outs `Promise.all([fetchAuthMe(), fetchAdminMe()])` whenever a post has an
`event` extension and the backend did not pre-compute `eventManageable`. The
composable then merges:

- `me.id`/`me.username` to author-match,
- `adminMe.viaToken || adminMe.user.roleIds ⊇ {admin|moderator}` for the
  admin override.

This is the strongest single signal that an aggregate "admin context"
endpoint would simplify.

## Cross-cutting findings

### Endpoints the frontend stitches today

1. **Verification transition is per-channel even though listing is aggregate.**
   `verificationTransitionPath(request)` branches on
   `request.verificationType` and emits one of four backend paths. mw already
   has the unified DTO from the list response, but cannot PATCH against the
   aggregate. ps#511's `PATCH /api/admin/verifications/:id` would let
   `useAdminConsole.reviewVerificationRequest` collapse to one call.
2. **Realname reveal is a separate GET.** After the list returns redacted
   `publicSummary`, the UI hits
   `GET /api/admin/verifications/realname/:id?reveal=true` per item to read
   plaintext PII. This is the right shape for audit (reveal is an explicit
   audited path), but the call goes to the per-channel route, not the
   aggregate. ps#511 should keep reveal as a separate audited call but expose
   it at the aggregate path.
3. **Verification PATCH responses don't refresh the list.** Because the PATCH
   only returns the single record, `useAdminConsole` re-issues
   `loadVerificationRequests(currentFilter)` after every approve/reject. An
   aggregate contract that returns enough state for in-place row replacement
   (or returns the new list snapshot when filter is `pending`) would remove
   the round-trip.
4. **Admin context = `/api/auth/me` + `/api/admin/me` joined client-side.**
   The PostDetail "结束活动" gate (`probeEventManageable`) does this every time
   it loads an event post without a pre-computed `eventManageable`. Two
   parallel requests to derive one boolean. `ps#511` itself doesn't need to
   solve this, but a sibling capability endpoint exposing
   `{viewerIsAdmin, viewerUserId, viewerUsername}` in one shot would let mw
   delete `probeEventManageable`.
5. **Reports + posts + users moderation is fanned across three subsystems.**
   `applyPostAction` and `applyUserStatus` are decoupled from the report
   queue — admins re-type the userId or click into a row to act. Out of scope
   for ps#511 (verification-only) but worth flagging if a follow-up issue
   wants a true moderation aggregate.

### Response-shape inconsistencies

- **Reveal response wrapper.** `fetchAdminVerificationDetail` expects
  `{ verification: AdminVerificationDetail }`, the list endpoint returns
  `{ items: [...] }` (no wrapper key per item). PATCH returns
  `{ verification: ... }`. ps#511 should pick one envelope.
- **Status enum drift.** `AdminReportStatus` has 11 string values; the
  frontend filter only exposes 4. The label map silently maps the rest to one
  of the four. If ps#511's transition contract aligns the verification
  status enum, it would set the precedent for shrinking the report enum
  later.
- **`total` is in every list envelope but never rendered or paginated.**
  Every list call (`reports`, `verifications`, `audit-log`) declares
  `{ items, total }`, hardcodes `limit: 100`, never sends `offset`. The
  `verificationTotal` ref is set and never read. ps#511 should still ship
  `total` and `offset` semantics so paging can land later, but the contract
  spec should not assume mw consumes it today.
- **Per-channel `summarized PII` is a free-form `Record<string, unknown>`.**
  `publicSummary` is typed `Record<string, unknown> | null` and the consumer
  reaches into channel-specific keys (`orgName`, `realName`, `merchantName`,
  `note`, etc.). ps#511's canonical DTO should either lift these to typed
  per-channel discriminated unions OR commit to the loose-bag shape and
  document the keys per `verificationType`.
- **`AdminUserStatusResult` is computed and dropped.** The composable just
  shows a generic success toast. If ps#511 inspires a moderation aggregate
  later, this is a place where the contract is wider than the consumer.

### Permission checks duplicated in mw

- **AdminView mount probe.** Even when there is a session admin (cookie
  roles), `probeAdminSession()` re-issues `/api/admin/me` on mount.
- **PostDetail event-manage probe.** Re-issues `/api/admin/me` per
  event-post detail load when backend didn't pre-stamp `eventManageable`.
  This is the second admin probe per session for the same viewer.
- **`useAdminToken`** writes the fallback Bearer only to `sessionStorage`, never
  `localStorage`, and sends it on admin calls via `withAuthHeader` only when
  cookie-session admin probing is unavailable. `AdminView` probes `/api/admin/me`
  before using the stored fallback token, clears the fallback token when a
  session-admin probe succeeds, and clears both admin auth-mode refs when leaving
  the admin surface or when profile logout/authentication changes. The fallback
  gate copy labels ADMIN_TOKEN as an ops-only backup path, not the preferred
  login path. Legacy public admin tooling must not persist the shared
  `lian.adminToken` key in `localStorage`.

## Recommendations for ps#511 aggregate contract

1. **Make `PATCH /api/admin/verifications/:verificationId` channel-agnostic.**
   The frontend already has `verificationType` on the row; the backend can
   read it from the verification record. Killing the per-channel branching in
   `verificationTransitionPath()` is the single biggest mw simplification.
2. **Keep `GET /api/admin/verifications` aggregate (already there)** with
   stable fields: `verificationId`, `verificationType`, `userId`, `status`,
   `publicSummary`, `reviewerId`, `reviewerNote`, `reviewedAt`, `createdAt`,
   `updatedAt`. mw consumes exactly this surface today. No new fields needed
   to satisfy mw. The `pid`-style noise on reports is not present here.
3. **Define `publicSummary` as a typed discriminated union keyed on
   `verificationType`.** mw renders different fields per type and would map
   cleanly to a typed union; today it walks loose keys with
   `formatSummaryValue`. If you keep the loose-bag shape, ship a
   per-`verificationType` key registry in the API surface doc so mw can drop
   the inline maps in `verificationSummaryRows`.
4. **Keep reveal as a distinct, audited call**, but at the aggregate path:
   `GET /api/admin/verifications/:verificationId?reveal=true`. mw only needs
   it for `realname` today, but routing the call through the aggregate path
   means ps#511 owns the gate and the audit log entry shape.
5. **PATCH response should return the full updated record** (already the
   shape: `{ verification: AdminVerificationDetail }`). If the contract can
   additionally return the row-after-merge in the same envelope mw expects
   from the list, mw can drop the post-PATCH `loadVerificationRequests`
   re-fetch.
6. **PII redaction default + explicit reveal.** mw treats the list as
   redacted today; this is correct. Document the redaction rule per channel
   in the contract so a future channel doesn't accidentally leak.
7. **Out of scope for ps#511 but worth a sibling issue:** a small "viewer
   admin context" probe (or merging admin role into `/api/auth/me`) would
   let mw delete `probeEventManageable` and the `AdminView` mount probe. The
   admin Bearer-token path can stay as-is.
