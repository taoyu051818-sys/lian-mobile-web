# Metadata Write Safety

Date: 2026-05-03

## Thread Scope

Added write queue serialization and backup support to `patchPostMetadata` in `data-store.js`.

## Changes

### `src/server/data-store.js`

- `patchPostMetadata` now serializes concurrent writes through a promise queue (`metadataWriteQueue`). Each call waits for the previous write to complete before reading-modifying-writing.
- Added `backupMetadata()` — reads current `post-metadata.json` and writes a `.bak` copy. Returns backup path or null.
- `writeJsonFile` already used temp-file + rename (no change needed).

### `scripts/test-metadata-write-safety.js` (new)

14 test cases covering:
- Basic patch write and read
- Merge preserves existing fields
- Concurrent patches to 3 different tids (all preserved)
- Concurrent patches to same tid (merge is deterministic)
- Empty/null tid rejection
- backupMetadata doesn't throw

## Files Changed

| File | Change |
|---|---|
| `src/server/data-store.js` | Added write queue, backupMetadata export |
| `scripts/test-metadata-write-safety.js` | New test script |

## Validation

```
node --check src/server/data-store.js           ✓
node scripts/test-metadata-write-safety.js       14/14 pass
node scripts/validate-post-metadata.js           ✓
node scripts/smoke-frontend.js                   21/21 pass
```

## Decisions

1. **Promise queue, not mutex**: Node.js is single-threaded, so the race is only at I/O boundaries. A simple promise chain serializes async read-modify-write cycles without external dependencies.

2. **Backup is opt-in**: `backupMetadata()` is exported but not called automatically. Callers (publish handlers) can call it before risky operations. Automatic backup on every write would be too expensive.

3. **No schema changes**: The `post-metadata.json` format is unchanged. The write queue only affects the write path, not the read path.

## Risks Mitigated

- Concurrent patches to different tids no longer risk overwriting each other
- Concurrent patches to same tid merge deterministically (last-in waits for first-in to complete)
- Temp-file + rename prevents partial writes from corrupting the file

## Next Steps

- Lane D (Audience auth hydration) and Lane E (NodeBB contract smoke) can proceed
- Publish handlers should call `backupMetadata()` before first write in a session
