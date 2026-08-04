import { afterEach, describe, expect, it, vi } from "vitest";
import { apiSend } from "../../src/api/http";

describe("accepted HTTP responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a 202 JSON body once without treating it as an error or retrying", async () => {
    const body = {
      ok: true,
      tid: 202,
      url: "/post/202",
      partial: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiSend<typeof body>("/api/ai/post-publish", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "publish-key-1" }),
      }),
    ).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
