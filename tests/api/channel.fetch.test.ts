import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchChannelMessages } from "../../src/api/channel";

describe("fetchChannelMessages visibility filter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify({ items: [], hasMore: false, nextOffset: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("adds a selected visibility alongside pagination parameters", async () => {
    await fetchChannelMessages(-5, 12, "campus");

    const [requestUrl] = vi.mocked(fetch).mock.calls[0] ?? [];
    const parsed = new URL(String(requestUrl), "https://lian.test");
    expect(parsed.pathname).toBe("/api/channel");
    expect(parsed.searchParams.get("offset")).toBe("0");
    expect(parsed.searchParams.get("limit")).toBe("12");
    expect(parsed.searchParams.get("visibility")).toBe("campus");
  });

  it("omits visibility for the all filter", async () => {
    await fetchChannelMessages(30, 30);

    const [requestUrl] = vi.mocked(fetch).mock.calls[0] ?? [];
    const parsed = new URL(String(requestUrl), "https://lian.test");
    expect(parsed.searchParams.get("offset")).toBe("30");
    expect(parsed.searchParams.has("visibility")).toBe(false);
  });
});
