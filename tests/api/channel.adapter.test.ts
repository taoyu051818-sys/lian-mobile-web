import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildChannelReadPayload,
  markChannelMessagesRead,
  normalizeChannelMessage,
} from "../../src/api/channel";

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

describe("channel message adapter", () => {
  it("preserves supported backend visibility and audience fields", () => {
    const message = normalizeChannelMessage({
      id: "visible-1",
      content: "School-only channel note",
      visibility: "school",
      audience: {
        visibility: "school",
        schoolIds: ["bfsu"],
        orgIds: [],
        roleIds: [],
        userIds: [],
        linkOnly: false,
      },
    });

    expect(message.visibility).toBe("school");
    expect(message.audience).toEqual({
      visibility: "school",
      schoolIds: ["bfsu"],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false,
    });
  });

  it("derives message visibility from normalized audience when top-level visibility is absent", () => {
    const message = normalizeChannelMessage({
      id: "audience-only-1",
      content: "Campus audience channel note",
      audience: {
        visibility: "campus",
        schoolIds: [],
        orgIds: [],
        roleIds: [],
        userIds: [],
        linkOnly: false,
      },
    });

    expect(message.visibility).toBe("campus");
    expect(message.audience?.visibility).toBe("campus");
  });

  it("leaves ordinary messages without visibility unchanged", () => {
    const message = normalizeChannelMessage({
      id: "ordinary-1",
      content: "Ordinary channel note",
    });

    expect(message.visibility).toBeUndefined();
    expect(message.audience).toBeUndefined();
  });

  it("drops unsupported top-level visibility instead of showing a cue", () => {
    const message = normalizeChannelMessage({
      id: "future-visibility-1",
      content: "Future visibility channel note",
      visibility: "cohort",
    } as never);

    expect(message.visibility).toBeUndefined();
    expect(message.audience).toBeUndefined();
  });

  it("drops unsupported audience visibility instead of showing a cue", () => {
    const message = normalizeChannelMessage({
      id: "future-audience-1",
      content: "Future audience channel note",
      audience: { visibility: "cohort", schoolIds: [] },
    } as never);

    expect(message.visibility).toBeUndefined();
    expect(message.audience).toBeUndefined();
  });

  it("drops malformed audience linkOnly fields instead of showing a cue", () => {
    const message = normalizeChannelMessage({
      id: "malformed-link-1",
      content: "Malformed link-only channel note",
      audience: { visibility: "linkOnly", linkOnly: "yes" },
    } as never);

    expect(message.visibility).toBeUndefined();
    expect(message.audience).toBeUndefined();
  });

  it("drops malformed audience fields without suppressing top-level fallback", () => {
    const message = normalizeChannelMessage({
      id: "malformed-1",
      content: "Malformed channel note",
      visibility: "private",
      audience: { visibility: "school", schoolIds: "bfsu" },
    } as never);

    expect(message.visibility).toBe("private");
    expect(message.audience).toBeUndefined();
  });
});

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

  it("builds ChannelReadPayload from channel message ids as backend eventIds", () => {
    expect(buildChannelReadPayload([7, "8"])).toEqual({
      eventIds: [7, "8"],
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
        eventIds: [101, "102"],
        readerId: "reader-123",
      }),
    );
  });

  it("skips the network entirely when there is nothing to mark read", async () => {
    await markChannelMessagesRead([]);
    expect(g.fetch).not.toHaveBeenCalled();
  });
});
