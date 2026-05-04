# Handoff: Implementation Batch 2026-05-02

## Date

2026-05-02

## Thread scope

Architect/documentation handoff only. No runtime code was implemented in this handoff.

This batch translates Pro review feedback into implementation lanes. The main decision is that product work can continue, but two engineering gates should land first:

1. metadata write safety;
2. route matcher tests.

## Files changed

- `docs/agent/tasks/metadata-write-safety.md`
- `docs/agent/tasks/route-matcher-tests.md`
- `docs/agent/tasks/audience-auth-hydration.md`
- `docs/agent/tasks/nodebb-contract-smoke-tests.md`
- `docs/agent/tasks/nodebb-reply-notifications-messages.md`
- `docs/agent/tasks/channel-messages-audience-filtering.md`
- `docs/agent/tasks/map-v2-bounds-picker-validation.md`
- `docs/agent/tasks/publish-v2-page.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/handoffs/implementation-batch-2026-05-02.md`

## Work distribution

| Lane | Thread | Task doc | Dependency | Notes |
|---|---|---|---|---|
| A | Backend safety | `docs/agent/tasks/metadata-write-safety.md` | none | First gate. Protects `post-metadata.json` writes. |
| B | Route safety | `docs/agent/tasks/route-matcher-tests.md` | none | First gate. Freezes route behavior before more API work. |
| C | Publish UX | `docs/agent/tasks/publish-v2-page.md` | A + B recommended | Verify/fix immediate Map v2 picker flow after image confirmation. |
| D | Audience correctness | `docs/agent/tasks/audience-auth-hydration.md` | B recommended | Real auth users must work without stored `schoolId`. |
| E | NodeBB contracts | `docs/agent/tasks/nodebb-contract-smoke-tests.md` | B recommended | Diagnostic-first. Do not change runtime behavior. |
| F | Messages discussion | `docs/agent/tasks/nodebb-reply-notifications-messages.md` | D + E | NodeBB replies enter Messages as discussion notifications, not DM. |
| G | Channel safety | `docs/agent/tasks/channel-messages-audience-filtering.md` | D | Prevent `/api/channel` from bypassing Audience. |
| H | Map v2 picker safety | `docs/agent/tasks/map-v2-bounds-picker-validation.md` | B recommended | Product bounds and coordinate-bearing `locationDraft`. |
| I | Map v2 editor continuation | `docs/agent/tasks/map-v2-admin-editor.md` | H recommended | Continue curves/assets/building hierarchy after picker contract stabilizes. |

## Decisions made

- Publish V2 remains the primary user-value track, but metadata safety and route safety are engineering gates.
- `post-metadata.json` must be treated as a core product database until a real DB migration exists.
- Messages means discussion/reply/activity notifications, not private chat.
- NodeBB notification/bookmark/upvoted assumptions must be smoke-tested against the live NodeBB instance before deeper Messages work.
- Audience correctness starts with viewer hydration from real auth-store shape, not with a new database model.
- Map v2 editor work should not outrun picker/bounds validation.

## Validation expected from implementation threads

Each implementation thread must run only the validation relevant to the files it touches. Common gates:

```bash
node --check <touched-js-file>
node scripts/validate-post-metadata.js
node scripts/test-routes.js
node scripts/test-audience.js
node scripts/validate-locations.js
```

NodeBB integration threads should additionally run the smoke script introduced by `nodebb-contract-smoke-tests.md`.

Frontend Publish/Messages threads should run browser smoke or `scripts/smoke-frontend.js` if available in the branch.

## Risks

- Combining lanes can create noisy PRs and hide behavior regressions.
- Runtime files are already changing in parallel; implementation threads must check current `git status` and avoid reverting unrelated edits.
- Chinese encoding has regressed before; avoid tools or editors that double-encode UTF-8.
- NodeBB endpoint shape can differ from assumptions; do not hard-code unverified notification/bookmark/upvoted response shapes.

## Rollback notes

- Each lane should land in its own commit or PR.
- If Publish V2 fails after NodeBB topic creation, metadata write failure must be explicit and repairable.
- If Audience hydration widens access unexpectedly, revert that lane before continuing Messages or Channel work.
- If Map v2 bounds reject existing data, pause and get product approval before widening bounds silently.

## Next thread instructions

1. Pick exactly one lane from the table.
2. Read the task doc and this handoff.
3. Inspect current code and dirty worktree before editing.
4. Implement only the allowed files for that lane.
5. Run the task validation.
6. Write or update the lane handoff.
7. Do not mark the lane done without evidence from validation.
