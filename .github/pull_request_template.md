## Scope

- What this PR changes:
- What part of the bad-smell cleanup this PR owns:

## Non-goals

- What this PR intentionally does not change:
- Related work that remains for another PR:

## Runtime impact

Check every item that applies:

- [ ] Changes default frontend entry / served root
- [ ] Changes `package.json` scripts
- [ ] Changes deployment, static server, port, proxy, nginx, pm2, or systemd behavior
- [ ] Changes API routes or backend contracts
- [ ] Removes legacy code or fallback paths
- [ ] Changes auth, publish, map, feed, messages, or profile user flows

If any item is checked, describe rollback path and confirm the runtime inventory was updated.

## Migration / fallback matrix

For frontend migration work, mark each product area as `Vue`, `Legacy fallback`, `Explicitly disabled`, or `Not touched`.

| Area | Status | Notes |
| --- | --- | --- |
| Feed |  |  |
| Detail |  |  |
| Map |  |  |
| Publish |  |  |
| Messages |  |  |
| Profile |  |  |

## Verification

- [ ] `npm run check`
- [ ] `npm run ops:guard`
- [ ] `npm run build`, if Vue or build files changed
- [ ] Manual smoke test, if runtime behavior changed

## Risk notes

- Known risks:
- How the PR avoids introducing new bad smells:
