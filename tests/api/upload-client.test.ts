import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUpload } from "../../src/api/http";
import { uploadPublishImage } from "../../src/api/publish";
import { uploadProfileAvatar } from "../../src/api/profile";

function makeFile(name: string) {
  return new File(["demo"], name, { type: "image/png" });
}

function mockJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiUpload", () => {
  it("posts form data with credentials and returns the parsed payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ url: "https://cdn.test/upload.png" }));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("image", makeFile("demo.png"));

    await expect(
      apiUpload<{ url: string }>("/api/upload/image?purpose=publish-v2", form, "fallback"),
    ).resolves.toEqual({ url: "https://cdn.test/upload.png" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/image?purpose=publish-v2",
      expect.objectContaining({
        body: form,
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("prefers the API error payload over the fallback message", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ error: "后端拒绝了上传" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("image", makeFile("demo.png"));

    await expect(apiUpload("/api/upload/image?purpose=publish-v2", form, "fallback")).rejects
      .toMatchObject({
        code: "",
        message: "后端拒绝了上传",
        name: "LianApiError",
        status: 400,
      });
  });

  it("uses the provided fallback message when the server response is not parseable", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("gateway failed", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("image", makeFile("demo.png"));

    await expect(apiUpload("/api/upload/image?purpose=avatar", form, "头像上传失败")).rejects
      .toMatchObject({
        message: "头像上传失败",
        name: "LianApiError",
        status: 502,
      });
  });
});

describe("uploadPublishImage", () => {
  it("returns the uploaded image URL", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ url: "https://cdn.test/publish.png" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadPublishImage(makeFile("publish.png"))).resolves.toBe(
      "https://cdn.test/publish.png",
    );
  });

  it("throws a specific error when the upload succeeds without a URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadPublishImage(makeFile("publish.png"))).rejects.toThrow(
      "图片上传成功但没有返回地址，请稍后再试。",
    );
  });
});

describe("uploadProfileAvatar", () => {
  it("returns the avatar URL", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockJsonResponse({ url: "https://cdn.test/avatar.png" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProfileAvatar(makeFile("avatar.png"))).resolves.toBe(
      "https://cdn.test/avatar.png",
    );
  });

  it("throws a specific error when the avatar upload response has no URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(mockJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProfileAvatar(makeFile("avatar.png"))).rejects.toThrow(
      "头像上传成功但没有返回地址，请稍后再试。",
    );
  });
});
