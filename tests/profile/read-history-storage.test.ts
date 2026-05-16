import { describe, expect, it } from "vitest";
import {
  getRecentReadHistoryIds,
  readHistoryEntries,
  type ReadHistoryEntry,
  READ_HISTORY_KEY,
} from "../../src/platform/browser-storage";

function createStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(seed));

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("browser-storage read history helpers", () => {
  it("returns newest-first ids from stored history entries", () => {
    const storage = createStorage({
      [READ_HISTORY_KEY]: JSON.stringify([
        { tid: 101, lastViewedAt: "2026-05-10T00:00:00.000Z" },
        { tid: 202, lastViewedAt: "2026-05-10T01:00:00.000Z" },
        { tid: 303, lastViewedAt: "2026-05-10T02:00:00.000Z" },
      ] satisfies ReadHistoryEntry[]),
    });

    expect(getRecentReadHistoryIds(storage)).toEqual([303, 202, 101]);
  });

  it("normalizes numeric-string tids and skips malformed entries", () => {
    const storage = createStorage({
      [READ_HISTORY_KEY]: JSON.stringify([
        { tid: "11" },
        { tid: "oops" },
        { nope: 22 },
        { tid: 33, lastViewedAt: 44 },
        null,
      ]),
    });

    expect(readHistoryEntries(storage)).toEqual([{ tid: 11 }, { tid: 33 }]);
  });

  it("returns an empty list for invalid or non-array history payloads", () => {
    expect(readHistoryEntries(createStorage({ [READ_HISTORY_KEY]: "{" }))).toEqual([]);
    expect(
      readHistoryEntries(createStorage({ [READ_HISTORY_KEY]: JSON.stringify({ tid: 1 }) })),
    ).toEqual([]);
  });

  it("caps the recent history list to the requested limit", () => {
    const storage = createStorage({
      [READ_HISTORY_KEY]: JSON.stringify(
        Array.from({ length: 60 }, (_, index) => ({ tid: index + 1 })),
      ),
    });

    const ids = getRecentReadHistoryIds(storage, 5);
    expect(ids).toEqual([60, 59, 58, 57, 56]);
  });
});
