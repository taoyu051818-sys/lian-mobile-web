# Task: Metadata Write Safety

## Goal

Make `data/post-metadata.json` writes safe enough for Publish V2, AI publish, Audience, and Map v2 work to continue without corrupting the core product metadata file.

## Product scope

This task does not add user-facing features. It is an engineering safety gate for every flow that creates or updates posts, because `post-metadata.json` currently drives feed distribution, map linkage, image records, AI publish traces, and future audience behavior.

## Allowed files

- `src/server/data-store.js`
- `src/server/ai-light-publish.js`
- `src/server/post-service.js`
- `src/server/admin-routes.js`
- `scripts/test-metadata-write-safety.js`
- `docs/agent/tasks/metadata-write-safety.md`
- `docs/agent/handoffs/metadata-write-safety.md`

Only touch call sites that currently write or patch `post-metadata.json`.

## Forbidden files

- `public/*`
- `data/feed-rules.json`
- `data/locations.json`
- `data/map-v2-layers.json`
- `server.js`
- `src/server/feed-service.js`, unless a direct metadata write is discovered there

Do not bulk-format or reorder `data/post-metadata.json`.

## Data schema changes

None.

Generated runtime backups are allowed, but they must not be committed unless the task explicitly creates a tiny fixture for testing.

## API changes

None.

## Acceptance criteria

- [ ] All writes to `post-metadata.json` go through one write helper or metadata service.
- [ ] Metadata writes are serialized in the Node.js process so concurrent patch calls cannot overwrite each other.
- [ ] Writes use temp-file then rename behavior.
- [ ] A backup/snapshot is created before risky write operations.
- [ ] Patch operations are by `tid` and preserve unrelated fields.
- [ ] A simulated concurrent patch test proves two patches to different tids do not drop either change.
- [ ] A simulated concurrent patch test proves two patches to the same tid merge predictably or fail explicitly.
- [ ] AI publish still writes metadata only after NodeBB topic creation succeeds.
- [ ] If metadata write fails after NodeBB topic creation, the response and AI post record expose a clear partial-failure state for manual repair.
- [ ] `node scripts/validate-post-metadata.js` passes after the task.

## Validation commands

```bash
node --check src/server/data-store.js
node --check src/server/ai-light-publish.js
node --check src/server/post-service.js
node --check src/server/admin-routes.js
node scripts/validate-post-metadata.js
```

If the test script is added:

```bash
node scripts/test-metadata-write-safety.js
```

## Risks

- Risk: A write queue can hide bugs if errors are swallowed. Mitigation: every queued write must reject to the caller on failure.
- Risk: Backups can leak into git status. Mitigation: write backups to an ignored or clearly temporary runtime directory and do not commit them.
- Risk: Changing publish failure behavior can affect current UI. Mitigation: preserve existing success responses and only make failure states more explicit.

## Rollback plan

- Revert the metadata write helper changes and call-site updates as one commit.
- Restore `data/post-metadata.json` from the generated backup if a write test corrupts it.
- Re-run `node scripts/validate-post-metadata.js` before restarting any server.
