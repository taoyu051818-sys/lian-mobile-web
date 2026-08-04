import { afterEach, describe, expect, it, vi } from "vitest";

import { render, resolveSsrPathname } from "../../src/entry-server";

/**
 * Phase 1.2 of docs/architecture/SSR_PWA_RFC_2026_05_23.md.
 *
 * Locks the contract for `render(url)`:
 *   - `/post/:tid` calls ps share-card on the internal URL, builds
 *     per-kind OG meta + a noscript-friendly degraded body + a SPA
 *     redirect script.
 *   - `/` returns the brand-default homepage shell with no upstream
 *     fetch.
 *   - `/u/:username` is a phase-1.5 stub today; it must not call ps
 *     and must produce a usable shell.
 *   - share-card 4xx / 5xx propagates as a thrown error so the caller
 *     (the Node http service) can map it to 503 → Caddy fallback.
 *
 * The fixture envelope mirrors the V1 shape ps emits today
 * (ps#484 + ps#536: tid, title, summary, thumbnailUrl, url, kind,
 * authorName, audienceLabel, channel.wechat).
 */

const ENVELOPE_TEMPLATE = {
  ok: true,
  card: {
    tid: 123,
    title: "施工通知",
    summary: "今日下午两点开始",
    thumbnailUrl: "https://cdn.example/img.jpg",
    url: "https://lian.example/post/123",
    kind: "post",
    authorName: "小李",
    audienceLabel: "公开",
    channel: {},
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withCard(overrides: Record<string, unknown>) {
  return {
    ok: true,
    card: { ...ENVELOPE_TEMPLATE.card, ...overrides },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LIAN_PS_INTERNAL_URL;
});

describe("entry-server.render", () => {
  describe("/post/:tid", () => {
    it("renders OG/twitter meta from the share-card envelope for kind=post", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ENVELOPE_TEMPLATE)),
      );

      const { head, html } = await render("/post/123");

      expect(head).toContain("<title>施工通知</title>");
      expect(head).toContain('property="og:title"');
      expect(head).toContain("施工通知");
      expect(head).toContain('property="og:description"');
      expect(head).toContain("今日下午两点开始");
      expect(head).toContain('property="og:image"');
      expect(head).toContain("https://cdn.example/img.jpg");
      expect(head).toContain('property="og:type"');
      expect(head).toContain("article");
      expect(head).toContain('name="twitter:card"');
      expect(head).toContain("summary_large_image");
      expect(head).toContain('name="description"');

      expect(html).toContain("<h1>施工通知</h1>");
      expect(html).toContain("今日下午两点开始");
      expect(html).toContain("https://cdn.example/img.jpg");
      expect(html).toContain("location.replace");
      expect(html).toContain('"/#/post/123"');
    });

    it("calls the ps internal URL from LIAN_PS_INTERNAL_URL with an abort signal", async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ENVELOPE_TEMPLATE));
      vi.stubGlobal("fetch", fetchMock);
      process.env.LIAN_PS_INTERNAL_URL = "http://internal.test:9999";

      await render("/post/123");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toBe("http://internal.test:9999/api/posts/123/share-card");
      expect(init?.signal).toBeDefined();
    });

    it("ignores query parameters for route selection and fallback canonical URL", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => jsonResponse(withCard({ url: "" })));
      vi.stubGlobal("fetch", fetchMock);

      const clean = await render("/post/123");
      const tracked = await render("/post/123?utm_source=share&campaign=%E6%A0%A1%E5%9B%AD");

      expect(tracked).toEqual(clean);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(tracked.head).toContain('<link rel="canonical" href="/post/123">');
      expect(tracked.head).toContain('<meta property="og:url" content="/post/123">');
      expect(tracked.head).not.toContain("utm_source");
    });

    it("defaults to 127.0.0.1:3000 when LIAN_PS_INTERNAL_URL is unset", async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(ENVELOPE_TEMPLATE));
      vi.stubGlobal("fetch", fetchMock);
      delete process.env.LIAN_PS_INTERNAL_URL;

      await render("/post/123");
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toBe("http://127.0.0.1:3000/api/posts/123/share-card");
    });

    it("throws when the share-card upstream returns 404", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: false }, 404)),
      );

      await expect(render("/post/999")).rejects.toThrow();
    });

    it("throws when the share-card upstream returns 5xx", async () => {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503)));

      await expect(render("/post/999")).rejects.toThrow();
    });

    it("throws when the share-card envelope is malformed", async () => {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true })));

      await expect(render("/post/123")).rejects.toThrow();
    });

    it("kind=errand prefixes the OG title with 可下单：", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(withCard({ kind: "errand", title: "买药" }))),
      );

      const { head } = await render("/post/200");

      expect(head).toContain("可下单：买药");
    });

    it("kind=help prefixes the OG title with 求助：", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(withCard({ kind: "help", title: "找回钥匙" }))),
      );

      const { head } = await render("/post/300");

      expect(head).toContain("求助：找回钥匙");
    });

    it("kind=event falls back to plain title (envelope has no startTimeLocal yet)", async () => {
      // RFC §4 spec: `${title} · ${startTimeLocal}`. ps follow-up tracked in §12.
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(withCard({ kind: "event", title: "周末派对" }))),
      );

      const { head } = await render("/post/400");

      expect(head).toContain("<title>周末派对</title>");
      // No middle-dot separator until startTimeLocal lands in the envelope.
      expect(head).not.toMatch(/周末派对\s+·\s+/);
    });

    it("kind=merchant falls back to plain title (envelope has no merchantName yet)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(withCard({ kind: "merchant", title: "校园咖啡" }))),
      );

      const { head } = await render("/post/500");

      expect(head).toContain("校园咖啡");
    });

    it("escapes HTML in title / summary so envelope content cannot inject markup", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse(
            withCard({
              title: "<script>alert(1)</script>",
              summary: '"&<>',
            }),
          ),
        ),
      );

      const { head, html } = await render("/post/600");

      expect(head).not.toContain("<script>alert(1)</script>");
      expect(head).toContain("&lt;script&gt;");
      expect(head).toContain("&amp;");
      expect(head).toContain("&quot;");
      expect(html).not.toContain("<script>alert(1)</script>");
    });
  });

  describe("/", () => {
    it("returns the brand-default homepage shell with a redirect to #/feed", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      const { head, html } = await render("/");

      expect(head).toContain("<title>");
      expect(head).toContain("LIAN");
      expect(html).toContain("location.replace");
      expect(html).toContain("/#/feed");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("/u/:username", () => {
    it("returns a brand-default stub without calling ps (phase 1.5 deferred)", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      const { head, html } = await render("/u/alice");

      expect(typeof head).toBe("string");
      expect(typeof html).toBe("string");
      expect(head).toContain("LIAN");
      expect(html).toContain("location.replace");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps profile query and encoded username routing equivalent to the clean route", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      const clean = await render("/u/alice");
      const withQuery = await render("/u/alice?tab=posts&utm_source=share");
      const encoded = await render("/u/%E5%B0%8F%E6%9D%8E?tab=posts");

      expect(resolveSsrPathname("/u/%E5%B0%8F%E6%9D%8E?tab=posts")).toBe("/u/%E5%B0%8F%E6%9D%8E");
      expect(withQuery).toEqual(clean);
      expect(encoded).toEqual(clean);
      expect(withQuery.head).toContain('<link rel="canonical" href="/">');
      expect(withQuery.head).not.toContain("utm_source");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("unknown route", () => {
    it("falls through to the homepage shell without calling ps", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      const { head } = await render("/unknown/path");

      expect(head).toContain("LIAN");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps encoded post ids encoded and safely falls back for malformed URLs", async () => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetchMock);

      expect(resolveSsrPathname("/post/%31%32%33?utm_source=x")).toBe("/post/%31%32%33");
      expect(resolveSsrPathname("http://[")).toBe("/");

      const encoded = await render("/post/%31%32%33?utm_source=x");
      const malformed = await render("http://[");

      expect(encoded).toEqual(malformed);
      expect(encoded.head).toContain('<link rel="canonical" href="/">');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
