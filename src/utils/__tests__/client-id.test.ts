import { ensureClientId, CLIENT_ID_KEY } from "../client-id";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const store = { ...initial };
  return {
    get length() { return Object.keys(store).length; },
    clear() { for (const k in store) delete store[k]; },
    getItem(k: string) { return store[k] ?? null; },
    setItem(k: string, v: string) { store[k] = v; },
    removeItem(k: string) { delete store[k]; },
    key(i: number) { return Object.keys(store)[i] ?? null; },
  };
}

// exports correct key constant
assertEqual(CLIENT_ID_KEY, "lian.clientId", "CLIENT_ID_KEY");

// generates and persists a new ID when storage is empty
{
  const storage = createMockStorage();
  const id = ensureClientId(storage);
  assertEqual(typeof id, "string", "new id type");
  assertEqual(id.length > 0, true, "new id not empty");
  assertEqual(storage.getItem(CLIENT_ID_KEY), id, "persisted to storage");
}

// returns existing ID without overwriting
{
  const storage = createMockStorage({ [CLIENT_ID_KEY]: "existing-id" });
  const id = ensureClientId(storage);
  assertEqual(id, "existing-id", "returns existing");
  assertEqual(storage.getItem(CLIENT_ID_KEY), "existing-id", "storage unchanged");
}

// fallback path: when crypto.randomUUID is unavailable
{
  const origRandomUUID = crypto.randomUUID;
  // @ts-expect-error intentionally deleting for test
  delete crypto.randomUUID;
  try {
    const storage = createMockStorage();
    const id = ensureClientId(storage);
    assertEqual(id.includes("-"), true, "fallback id contains dash separator");
    assertEqual(storage.getItem(CLIENT_ID_KEY), id, "fallback persisted");
  } finally {
    crypto.randomUUID = origRandomUUID;
  }
}

// multiple calls return the same ID (idempotent)
{
  const storage = createMockStorage();
  const first = ensureClientId(storage);
  const second = ensureClientId(storage);
  assertEqual(first, second, "idempotent");
}

console.log("All ensureClientId tests passed.");
