import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAuthLinkUrl,
  createAdminAuthLink,
  fetchAdminAuthLinks,
  getAuthLinkStatus,
  isAuthLinkExhausted,
  isAuthLinkExpired,
  revokeAdminAuthLink,
  type AuthLink,
} from "../../src/api/adminAuthLink";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockAuthLink(overrides: Partial<AuthLink> = {}): AuthLink {
  return {
    token: "link_ABCD1234EFGH5678",
    createdByUserId: "user-123",
    createdAt: "2026-05-23T10:00:00.000Z",
    expiresAt: "2026-05-24T10:00:00.000Z",
    maxUses: 10,
    usedCount: 0,
    audienceLabel: "2026 级新生",
    grant: {},
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createAdminAuthLink", () => {
  it("sends POST to /api/admin/auth-link with payload and normalizes response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        authLink: {
          token: "link_NEWTOKEN12345678",
          createdByUserId: "admin-1",
          createdAt: "2026-05-23T12:00:00.000Z",
          expiresAt: "2026-05-24T12:00:00.000Z",
          maxUses: 5,
          usedCount: 0,
          audienceLabel: "测试受众",
          grant: { verificationKind: "campus_verified" },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const link = await createAdminAuthLink("test-token", {
      audienceLabel: "测试受众",
      maxUses: 5,
      ttlSeconds: 86400,
      grant: { verificationKind: "campus_verified" },
    });

    expect(link.token).toBe("link_NEWTOKEN12345678");
    expect(link.audienceLabel).toBe("测试受众");
    expect(link.grant.verificationKind).toBe("campus_verified");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/auth-link");
    expect(options?.method).toBe("POST");
    expect(options?.headers?.get("authorization")).toBe("Bearer test-token");
  });
});

describe("fetchAdminAuthLinks", () => {
  it("fetches list from /api/admin/auth-links and normalizes items", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        items: [mockAuthLink({ token: "link_A" }), mockAuthLink({ token: "link_B", usedCount: 5 })],
        total: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAdminAuthLinks("admin-token");

    expect(result.items).toHaveLength(2);
    expect(result.items[0].token).toBe("link_A");
    expect(result.items[1].usedCount).toBe(5);
    expect(result.total).toBe(2);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/auth-links");
    expect(options?.headers?.get("authorization")).toBe("Bearer admin-token");
  });

  it("returns empty array when items is missing", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true })));

    const result = await fetchAdminAuthLinks("token");

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("revokeAdminAuthLink", () => {
  it("sends DELETE to /api/admin/auth-link/:token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await revokeAdminAuthLink("admin-token", "link_TOREVOKE123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/auth-link/link_TOREVOKE123");
    expect(options?.method).toBe("DELETE");
  });
});

describe("buildAuthLinkUrl", () => {
  it("builds URL with token as query param", () => {
    const url = buildAuthLinkUrl("link_ABC123");
    expect(url).toContain("/join?link=link_ABC123");
  });

  it("encodes special characters in token", () => {
    const url = buildAuthLinkUrl("link_A+B=C");
    expect(url).toContain("link_A%2BB%3DC");
  });
});

describe("isAuthLinkExpired", () => {
  it("returns false when expiresAt is in the future", () => {
    const link = mockAuthLink({ expiresAt: "2099-12-31T23:59:59.000Z" });
    expect(isAuthLinkExpired(link)).toBe(false);
  });

  it("returns true when expiresAt is in the past", () => {
    const link = mockAuthLink({ expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(isAuthLinkExpired(link)).toBe(true);
  });

  it("returns true when expiresAt equals now", () => {
    const now = Date.now();
    const link = mockAuthLink({ expiresAt: new Date(now).toISOString() });
    expect(isAuthLinkExpired(link, now)).toBe(true);
  });
});

describe("isAuthLinkExhausted", () => {
  it("returns false when usedCount < maxUses", () => {
    const link = mockAuthLink({ maxUses: 10, usedCount: 5 });
    expect(isAuthLinkExhausted(link)).toBe(false);
  });

  it("returns true when usedCount >= maxUses", () => {
    const link = mockAuthLink({ maxUses: 10, usedCount: 10 });
    expect(isAuthLinkExhausted(link)).toBe(true);
  });

  it("returns true when usedCount exceeds maxUses", () => {
    const link = mockAuthLink({ maxUses: 5, usedCount: 7 });
    expect(isAuthLinkExhausted(link)).toBe(true);
  });
});

describe("getAuthLinkStatus", () => {
  it("returns 'active' for valid unexpired link with remaining uses", () => {
    const link = mockAuthLink({
      expiresAt: "2099-12-31T23:59:59.000Z",
      maxUses: 10,
      usedCount: 3,
    });
    expect(getAuthLinkStatus(link)).toBe("active");
  });

  it("returns 'expired' for link past expiresAt", () => {
    const link = mockAuthLink({
      expiresAt: "2020-01-01T00:00:00.000Z",
      maxUses: 10,
      usedCount: 0,
    });
    expect(getAuthLinkStatus(link)).toBe("expired");
  });

  it("returns 'exhausted' for link with no remaining uses", () => {
    const link = mockAuthLink({
      expiresAt: "2099-12-31T23:59:59.000Z",
      maxUses: 5,
      usedCount: 5,
    });
    expect(getAuthLinkStatus(link)).toBe("exhausted");
  });

  it("returns 'expired' when both expired and exhausted (expiry takes precedence)", () => {
    const link = mockAuthLink({
      expiresAt: "2020-01-01T00:00:00.000Z",
      maxUses: 5,
      usedCount: 5,
    });
    expect(getAuthLinkStatus(link)).toBe("expired");
  });
});
