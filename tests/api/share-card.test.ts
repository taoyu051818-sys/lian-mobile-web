import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchShareCard, ShareCardError } from "../../src/api/share-card";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchShareCard (ps#484 V1 envelope consumer)", () => {
  it("normalizes the V1 envelope into a ShareCard", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ok: true,
        card: {
          tid: "115",
          title: "这段路今天有施工",
          summary: "施工时间从下午两点到傍晚六点。",
          thumbnailUrl: "https://cdn.example/x.jpg",
          url: "https://lian.example/posts/115",
          kind: "post",
          authorName: "小李",
          audienceLabel: "公开",
          channel: {
            wechat: {
              title: "这段路今天有施工",
              description: "施工时间从下午两点到傍晚六点。",
              imageUrl: "https://cdn.example/x.jpg",
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const card = await fetchShareCard(115);

    expect(card).toEqual({
      tid: 115,
      title: "这段路今天有施工",
      summary: "施工时间从下午两点到傍晚六点。",
      thumbnailUrl: "https://cdn.example/x.jpg",
      url: "https://lian.example/posts/115",
      kind: "post",
      authorName: "小李",
      audienceLabel: "公开",
      channel: {
        wechat: {
          title: "这段路今天有施工",
          description: "施工时间从下午两点到傍晚六点。",
          imageUrl: "https://cdn.example/x.jpg",
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/posts/115/share-card");
  });

  it("falls back to defaults for missing optional fields and an absent channel block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          ok: true,
          card: { tid: 42, title: "minimal" },
        }),
      ),
    );

    const card = await fetchShareCard(42);

    expect(card).toEqual({
      tid: 42,
      title: "minimal",
      summary: "",
      thumbnailUrl: "",
      url: "",
      kind: "post",
      authorName: "",
      audienceLabel: "",
      channel: {},
    });
  });

  it("maps 404 to ShareCardError('not-found') (covers deleted + audience-rejected)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: false, error: "not_found" }, 404)),
    );

    const error = await fetchShareCard(999).then(
      () => null,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ShareCardError);
    expect((error as ShareCardError).reason).toBe("not-found");
    expect((error as ShareCardError).status).toBe(404);
  });

  it("maps 5xx to ShareCardError('network') so the caller can retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: "upstream_down" }, 503)),
    );

    const error = await fetchShareCard(7).then(
      () => null,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ShareCardError);
    expect((error as ShareCardError).reason).toBe("network");
    expect((error as ShareCardError).status).toBe(503);
  });

  it("maps a fetch rejection (offline) to ShareCardError('network')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const error = await fetchShareCard(1).then(
      () => null,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ShareCardError);
    expect((error as ShareCardError).reason).toBe("network");
    expect((error as ShareCardError).status).toBe(0);
  });
});
