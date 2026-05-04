# Task: Route Matcher Tests

## Goal

Freeze the current API route matching behavior before more Publish V2, Messages, Audience, and Map v2 routes are added.

## Product scope

This task should not change product behavior. It creates a safety net so future implementation threads can modify `api-router.js` without accidentally shadowing or breaking existing routes.

## Allowed files

- `src/server/api-router.js`
- `src/server/route-matcher.js`
- `scripts/test-routes.js`
- `docs/agent/tasks/route-matcher-tests.md`
- `docs/agent/handoffs/route-matcher-tests.md`

Prefer adding a pure route matcher module only if it keeps handler behavior unchanged.

## Forbidden files

- `public/*`
- `data/*`
- `server.js`
- `src/server/feed-service.js`
- `src/server/post-service.js`
- `src/server/channel-service.js`

Do not migrate to Express, Fastify, or any framework in this task.

## Data schema changes

None.

## API changes

None. This task should preserve existing endpoint behavior.

## Acceptance criteria

- [ ] A route test script verifies expected handler matching for key API routes.
- [ ] Route tests cover `GET /api/feed`.
- [ ] Route tests cover `GET /api/feed-debug`.
- [ ] Route tests cover `GET /api/posts/123`.
- [ ] Route tests cover `POST /api/posts/123/replies`.
- [ ] Route tests cover `POST /api/posts/123/like`.
- [ ] Route tests cover `POST /api/posts/123/save`.
- [ ] Route tests cover `POST /api/posts/123/report`.
- [ ] Route tests cover `GET /api/messages`.
- [ ] Route tests cover `GET /api/channel`.
- [ ] Route tests cover `GET /api/map/items`.
- [ ] Route tests cover `GET /api/map/v2` or the current Map v2 read endpoint.
- [ ] Route tests cover `POST /api/ai/post-preview`.
- [ ] Route tests cover `POST /api/ai/post-publish`.
- [ ] Route tests cover `POST /api/upload/image`.
- [ ] Unknown routes still resolve to the current 404 behavior.
- [ ] Existing handler signatures remain compatible with `async (req, reqUrl, res)`.

## Validation commands

```bash
node --check src/server/api-router.js
node scripts/test-routes.js
```

If a matcher module is added:

```bash
node --check src/server/route-matcher.js
```

## Risks

- Risk: Extracting route matching can accidentally change route precedence. Mitigation: first encode current precedence in tests, then refactor only if all tests pass.
- Risk: Tests become coupled to internal function names. Mitigation: assert route ids or handler labels, not implementation details that frequently change.
- Risk: Static tool routes are handled outside API router. Mitigation: document them separately instead of forcing them into API tests.

## Rollback plan

- Revert the matcher/test extraction commit.
- Keep the route test script if it is behavior-only and does not affect runtime.
