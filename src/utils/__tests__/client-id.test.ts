import { describe, expect, it } from "vitest";

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const store = { ...initial };
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      for (const key in store) delete store[key];
    },
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
  };
}

function createThrowingStorage(): Storage {
  return {
    get length() {
      return 0;
    },
    clear() {},
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
    removeItem() {},
    key() {
      return null;
    },
  };
}

async function loadClientIdentityModule() {
  return import(`../../platform/clientIdentity.ts?case=${Math.random().toString(16).slice(2)}`);
}

describe("ensureClientId", () => {
  it("exports the canonical key constant", async () => {
    const { CLIENT_ID_KEY } = await loadClientIdentityModule();
    expect(CLIENT_ID_KEY).toBe("lian.clientId");
  });

  it("generates and persists a new id when storage is empty", async () => {
    const { CLIENT_ID_KEY, ensureClientId } = await loadClientIdentityModule();
    const storage = createMockStorage();

    const id = ensureClientId(storage);

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(storage.getItem(CLIENT_ID_KEY)).toBe(id);
  });

  it("returns an existing stored id without overwriting it", async () => {
    const { CLIENT_ID_KEY, ensureClientId } = await loadClientIdentityModule();
    const storage = createMockStorage({ [CLIENT_ID_KEY]: "existing-id" });

    const id = ensureClientId(storage);

    expect(id).toBe("existing-id");
    expect(storage.getItem(CLIENT_ID_KEY)).toBe("existing-id");
  });

  it("falls back cleanly when crypto.randomUUID is unavailable", async () => {
    const { CLIENT_ID_KEY, ensureClientId } = await loadClientIdentityModule();
    const originalRandomUUID = crypto.randomUUID;
    const storage = createMockStorage();

    delete crypto.randomUUID;

    try {
      const id = ensureClientId(storage);
      expect(id).toContain("-");
      expect(storage.getItem(CLIENT_ID_KEY)).toBe(id);
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it("keeps a stable in-memory id when storage access throws", async () => {
    const { ensureClientId } = await loadClientIdentityModule();
    const storage = createThrowingStorage();

    const first = ensureClientId(storage);
    const second = ensureClientId(storage);

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
  });
});
