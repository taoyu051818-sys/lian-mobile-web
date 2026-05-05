# Route Matcher Tests

Date: 2026-05-02

## Thread Scope

Created route matcher module and test script to freeze current API route matching behavior as a safety net for future routing changes.

## Files Created

| File | Purpose |
|---|---|
| `src/server/route-matcher.js` | Pure function `matchRoute(method, pathname)` → `{ routeId, params }` or `null`. 40 routes in priority order matching api-router.js. |
| `scripts/test-routes.js` | 61 test cases: 34 exact matches, 7 param extractions, 4 prefix matches, 7 null/404, 5 method mismatches, 4 priority checks. |

## Files NOT Modified

- `src/server/api-router.js` — runtime behavior unchanged
- No handler signatures changed
- No new dependencies added

## Route Coverage

40 routes frozen: setup (2), AI (3), admin (prefix), auth (10), feed (2), tags (1), map (2), channel (3), messages (1), me (4), posts (6 regex + 1 exact), upload (1).

## Validation

```
node --check src/server/route-matcher.js    ✓
node scripts/test-routes.js                 61/61 pass
node scripts/smoke-frontend.js              21/21 pass
```

## Decisions

1. **Matcher is read-only**: `matchRoute` returns route IDs and params but does NOT call handlers. This is a testing/safety tool, not a routing framework replacement.

2. **Priority order preserved**: Exact routes are checked before regex routes, matching the if-else chain in api-router.js.

3. **Admin prefix uses wildcard method**: Unlike other routes, admin prefix matches any HTTP method, matching the original `reqUrl.pathname.startsWith("/api/admin/")` behavior.

4. **tid extracted as string**: Regex captures return string values (e.g., `{ tid: "123" }`), matching the original `Number(reqUrl.pathname.split("/").pop())` pattern. Consumers still call `Number()` on the value.

## Next Steps

- Lane D (Audience auth hydration) and Lane E (NodeBB contract smoke) can now proceed with B completed
- Route matcher can be used to validate new routes before adding them to api-router.js
