import { afterEach, describe, expect, it } from "vitest";

import { clearAdminAccessState, useAdminToken } from "../../src/features/admin/useAdminToken";

function installStorage() {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const makeStorage = (store: Map<string, string>): Storage =>
    ({
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, String(value)),
    }) as Storage;

  Object.defineProperty(globalThis, "window", {
    value: {
      sessionStorage: makeStorage(session),
      localStorage: makeStorage(local),
    },
    configurable: true,
  });
}

describe("useAdminToken", () => {
  afterEach(() => {
    clearAdminAccessState();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("clears the stored ops fallback token when session-admin mode becomes available", () => {
    installStorage();
    const adminToken = useAdminToken();

    adminToken.setToken("ops-token");
    expect(adminToken.token.value).toBe("ops-token");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBe("ops-token");

    adminToken.setSessionAdmin(true);

    expect(adminToken.sessionAdmin.value).toBe(true);
    expect(adminToken.token.value).toBe("");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBeNull();
    expect(window.localStorage.getItem("lian.adminToken")).toBeNull();
  });

  it("preserves the explicit ops fallback token when only session-admin mode is cleared", () => {
    installStorage();
    const adminToken = useAdminToken();

    adminToken.setToken("ops-token");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBe("ops-token");

    adminToken.clearSessionAdmin();

    expect(adminToken.sessionAdmin.value).toBe(false);
    expect(adminToken.token.value).toBe("ops-token");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBe("ops-token");
    expect(window.localStorage.getItem("lian.adminToken")).toBeNull();
  });

  it("clears both admin modes and storage through the shared reset", () => {
    installStorage();
    const adminToken = useAdminToken();

    adminToken.setToken("ops-token");
    adminToken.setSessionAdmin(true);
    clearAdminAccessState();

    expect(adminToken.sessionAdmin.value).toBe(false);
    expect(adminToken.token.value).toBe("");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBeNull();
    expect(window.localStorage.getItem("lian.adminToken")).toBeNull();
  });

  it("switches to explicit ops fallback mode when a fallback token is submitted", () => {
    installStorage();
    const adminToken = useAdminToken();

    adminToken.setSessionAdmin(true);
    adminToken.setToken(" ops-token ");

    expect(adminToken.sessionAdmin.value).toBe(false);
    expect(adminToken.token.value).toBe("ops-token");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBe("ops-token");
    expect(window.localStorage.getItem("lian.adminToken")).toBeNull();
  });

  it("shares a monotonic in-memory auth epoch across set, clear, and the profile reset hook", () => {
    installStorage();
    const first = useAdminToken() as ReturnType<typeof useAdminToken> & {
      authEpoch: { value: number };
      advanceAuthEpoch: () => number;
    };
    const second = useAdminToken() as ReturnType<typeof useAdminToken> & {
      authEpoch: { value: number };
      advanceAuthEpoch: () => number;
    };
    const start = first.authEpoch.value;

    first.setToken("ops-token");
    expect(first.authEpoch.value).toBeGreaterThan(start);
    expect(second.authEpoch.value).toBe(first.authEpoch.value);
    const afterSet = first.authEpoch.value;

    second.clearToken();
    expect(first.authEpoch.value).toBeGreaterThan(afterSet);
    const afterClear = first.authEpoch.value;

    clearAdminAccessState();
    expect(first.authEpoch.value).toBeGreaterThan(afterClear);
    expect(second.authEpoch.value).toBe(first.authEpoch.value);
    expect(window.sessionStorage.getItem("lian.adminToken")).toBeNull();
  });

  it("exposes an explicit epoch invalidation for lane reset and disposal without persisting it", () => {
    installStorage();
    const adminToken = useAdminToken() as ReturnType<typeof useAdminToken> & {
      authEpoch: { value: number };
      advanceAuthEpoch: () => number;
    };
    adminToken.setToken("sentinel-ops-token");
    const before = adminToken.authEpoch.value;

    expect(adminToken.advanceAuthEpoch()).toBeGreaterThan(before);
    expect(adminToken.authEpoch.value).toBeGreaterThan(before);
    expect(adminToken.token.value).toBe("sentinel-ops-token");
    expect(window.sessionStorage.getItem("lian.adminToken")).toBe("sentinel-ops-token");
    expect(window.sessionStorage.getItem("lian.adminAuthEpoch")).toBeNull();
    expect(window.localStorage.getItem("lian.adminAuthEpoch")).toBeNull();
  });
});
