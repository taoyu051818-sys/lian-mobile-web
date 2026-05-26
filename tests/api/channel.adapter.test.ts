import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildChannelReadPayload, markChannelMessagesRead } from "../../src/api/channel";

function createStorageMock(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  } as unknown as Storage;
}

describe("channel read adapter", () => {
  const g = globalThis as typeof globalThis & {
    window?: Record<string, unknown>;
    localStorage?: Storage;
    fetch?: typeof fetch;
  };

  beforeEach(() => {
    g.window = { __VITE_DEV__: true };
    g.localStorage = createStorageMock({ "lian.clientId": "reader-123" });
    g.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    delete g.window;
    delete g.localStorage;
    delete g.fetch;
    vi.restoreAllMocks();
  });

  it("builds ChannelReadPayload from message ids plus the stable client id", () => {
    expect(buildChannelReadPayload([7, "8"])).toEqual({
      messageIds: [7, "8"],
      readerId: "reader-123",
    });
  });

  it("posts /api/channel/read with the normalized read payload", async () => {
    await markChannelMessagesRead([101, "102"]);

    expect(g.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(g.fetch).mock.calls[0] ?? [];
    expect(url).toBe("/api/channel/read");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
    });

    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(headers.get("x-client-id")).toBe("reader-123");
    expect((init as RequestInit | undefined)?.body).toBe(
      JSON.stringify({
        messageIds: [101, "102"],
        readerId: "reader-123",
      }),
    );
  });

  it("skips the network entirely when there is nothing to mark read", async () => {
    await markChannelMessagesRead([]);
    expect(g.fetch).not.toHaveBeenCalled();
  });
});
