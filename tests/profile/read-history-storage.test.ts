import { describe, expect, it } from "vitest";
import {
  accountReadHistoryScope,
  getRecentReadHistoryIds,
  GUEST_READ_HISTORY_SCOPE,
  LEGACY_READ_HISTORY_KEY,
  readHistoryEntries,
  readHistoryQuery,
  READ_HISTORY_KEY_PREFIX,
  rememberReadItem,
  type ReadHistoryScope,
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

function accountScope(userId: string): ReadHistoryScope {
  const scope = accountReadHistoryScope(userId);
  if (!scope) throw new Error(`Expected a valid account scope for ${userId}`);
  return scope;
}

function storageKey(scope: ReadHistoryScope): string {
  return scope.kind === "guest"
    ? `${READ_HISTORY_KEY_PREFIX}guest`
    : `${READ_HISTORY_KEY_PREFIX}account:${encodeURIComponent(scope.userId)}`;
}

describe("browser-storage account-scoped read history", () => {
  it("isolates account A, account B, and guest reads, writes, and queries", () => {
    const storage = createStorage();
    const accountA = accountScope("user-a");
    const accountB = accountScope("user-b");

    rememberReadItem(accountA, 101, storage);
    rememberReadItem(accountB, 202, storage);
    rememberReadItem(GUEST_READ_HISTORY_SCOPE, 303, storage);

    expect(readHistoryEntries(accountA, storage).map((entry) => entry.tid)).toEqual([101]);
    expect(readHistoryEntries(accountB, storage).map((entry) => entry.tid)).toEqual([202]);
    expect(readHistoryEntries(GUEST_READ_HISTORY_SCOPE, storage).map((entry) => entry.tid)).toEqual(
      [303],
    );
    expect(readHistoryQuery(accountA, storage)).toBe("101");
    expect(readHistoryQuery(accountB, storage)).toBe("202");
    expect(readHistoryQuery(GUEST_READ_HISTORY_SCOPE, storage)).toBe("303");
  });

  it("reorders a duplicate only inside its owning scope", () => {
    const storage = createStorage();
    const accountA = accountScope("user-a");
    const accountB = accountScope("user-b");

    rememberReadItem(accountA, 101, storage);
    rememberReadItem(accountA, 102, storage);
    rememberReadItem(accountB, 201, storage);
    rememberReadItem(accountA, 101, storage);

    expect(readHistoryEntries(accountA, storage).map((entry) => entry.tid)).toEqual([102, 101]);
    expect(readHistoryEntries(accountB, storage).map((entry) => entry.tid)).toEqual([201]);
  });

  it("applies the 500-entry storage cap and recent limit per scope", () => {
    const storage = createStorage();
    const accountA = accountScope("user-a");
    const accountB = accountScope("user-b");

    for (let id = 1; id <= 510; id += 1) rememberReadItem(accountA, id, storage);
    for (let id = 1001; id <= 1010; id += 1) rememberReadItem(accountB, id, storage);

    expect(readHistoryEntries(accountA, storage)).toHaveLength(500);
    expect(getRecentReadHistoryIds(accountA, storage, 50)).toEqual(
      Array.from({ length: 50 }, (_, index) => 510 - index),
    );
    expect(getRecentReadHistoryIds(accountB, storage, 50)).toEqual(
      Array.from({ length: 10 }, (_, index) => 1010 - index),
    );
  });

  it("normalizes numeric-string tids and ignores malformed entries in one scope", () => {
    const accountA = accountScope("user-a");
    const accountB = accountScope("user-b");
    const storage = createStorage({
      [storageKey(accountA)]: JSON.stringify([
        { tid: "11" },
        { tid: "oops" },
        { nope: 22 },
        { tid: 33, lastViewedAt: 44 },
        null,
      ]),
      [storageKey(accountB)]: JSON.stringify([{ tid: 99 }]),
    });

    expect(readHistoryEntries(accountA, storage)).toEqual([{ tid: 11 }, { tid: 33 }]);
    expect(readHistoryEntries(accountB, storage)).toEqual([{ tid: 99 }]);
  });

  it("soft-fails malformed and throwing storage without affecting another scope", () => {
    const accountA = accountScope("user-a");
    const accountB = accountScope("user-b");
    const storage = createStorage({
      [storageKey(accountA)]: "{",
      [storageKey(accountB)]: JSON.stringify([{ tid: 202 }]),
    });
    const throwingStorage = {
      ...storage,
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as Storage;

    expect(readHistoryEntries(accountA, storage)).toEqual([]);
    expect(readHistoryEntries(accountB, storage)).toEqual([{ tid: 202 }]);
    expect(readHistoryEntries(accountA, throwingStorage)).toEqual([]);
    expect(() => rememberReadItem(accountA, 303, throwingStorage)).not.toThrow();
  });

  it("ignores and preserves unowned legacy history byte-for-byte", () => {
    const legacyValue = ' [ { "tid": 777 } ] ';
    const storage = createStorage({ [LEGACY_READ_HISTORY_KEY]: legacyValue });
    const accountA = accountScope("user-a");

    expect(readHistoryEntries(accountA, storage)).toEqual([]);
    expect(readHistoryEntries(GUEST_READ_HISTORY_SCOPE, storage)).toEqual([]);

    rememberReadItem(accountA, 101, storage);
    rememberReadItem(GUEST_READ_HISTORY_SCOPE, 303, storage);

    expect(storage.getItem(LEGACY_READ_HISTORY_KEY)).toBe(legacyValue);
    expect(storage.length).toBe(3);
  });

  it("rejects blank account ids and encodes stable ids in separate keys", () => {
    expect(accountReadHistoryScope("")).toBeNull();
    expect(accountReadHistoryScope("   ")).toBeNull();
    expect(accountReadHistoryScope(" user/a ")).toEqual({ kind: "account", userId: "user/a" });

    const storage = createStorage();
    const encodedScope = accountScope("user/a");
    rememberReadItem(encodedScope, 101, storage);
    expect(storage.getItem(`${READ_HISTORY_KEY_PREFIX}account:user%2Fa`)).not.toBeNull();
  });
});
