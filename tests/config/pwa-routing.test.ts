import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RouteMatchCallbackOptions } from "workbox-core/types";
import { pwaImageRouteMatch, pwaNavigationRouteMatch } from "../../vite.config";

const viteConfigSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");

function routeCandidate(
  href: string,
  {
    mode = "cors",
    destination = "",
    sameOrigin = true,
  }: { mode?: string; destination?: string; sameOrigin?: boolean } = {},
): RouteMatchCallbackOptions {
  return {
    event: {} as ExtendableEvent,
    request: { mode, destination } as Request,
    sameOrigin,
    url: new URL(href),
  };
}

describe("PWA runtime route matching", () => {
  it("uses NetworkFirst navigation with a precached offline fallback", () => {
    expect(viteConfigSource).toMatch(/navigateFallback:\s*null/);
    expect(viteConfigSource).not.toMatch(/navigateFallback:\s*["']\/offline\.html["']/);
    expect(viteConfigSource).toMatch(/urlPattern:\s*pwaNavigationRouteMatch/);
    expect(viteConfigSource).toMatch(/handler:\s*["']NetworkFirst["']/);
    expect(viteConfigSource).toMatch(
      /precacheFallback:\s*\{[\s\S]*fallbackURL:\s*["']\/offline\.html["']/,
    );
  });

  it("routes same-origin app navigations through NetworkFirst", () => {
    expect(
      pwaNavigationRouteMatch(routeCandidate("https://lian.test/post/123", { mode: "navigate" })),
    ).toBe(true);
    expect(
      pwaNavigationRouteMatch(routeCandidate("https://lian.test/join", { mode: "navigate" })),
    ).toBe(true);
    expect(
      pwaNavigationRouteMatch(routeCandidate("https://lian.test/u/alice", { mode: "navigate" })),
    ).toBe(true);
  });

  it("does not treat API or cross-origin requests as app navigations", () => {
    expect(
      pwaNavigationRouteMatch(routeCandidate("https://lian.test/api", { mode: "navigate" })),
    ).toBe(false);
    expect(
      pwaNavigationRouteMatch(
        routeCandidate("https://lian.test/api/posts/123", { mode: "navigate" }),
      ),
    ).toBe(false);
    expect(
      pwaNavigationRouteMatch(
        routeCandidate("https://other.test/post/123", { mode: "navigate", sameOrigin: false }),
      ),
    ).toBe(false);
    expect(pwaNavigationRouteMatch(routeCandidate("https://lian.test/post/123"))).toBe(false);
  });

  it("keeps commerce JSON reads outside navigation and image runtime caches", () => {
    for (const href of [
      "https://lian.test/api/commerce/stores",
      "https://lian.test/api/commerce/stores/1",
    ]) {
      expect(pwaNavigationRouteMatch(routeCandidate(href, { mode: "navigate" }))).toBe(false);
      expect(pwaNavigationRouteMatch(routeCandidate(href))).toBe(false);
      expect(pwaImageRouteMatch(routeCandidate(href))).toBe(false);
    }
    expect(viteConfigSource).not.toMatch(/commerce[^\n]*Cache(?:First|Only)|commerce-cache/i);
  });

  it("caches same-origin images even when their URL has no extension", () => {
    expect(
      pwaImageRouteMatch(routeCandidate("https://lian.test/image/123", { destination: "image" })),
    ).toBe(true);
  });

  it("caches Cloudinary images but not images from unlisted CDN hosts", () => {
    expect(
      pwaImageRouteMatch(
        routeCandidate("https://res.cloudinary.com/demo/image/upload/sample", {
          destination: "image",
          sameOrigin: false,
        }),
      ),
    ).toBe(true);
    expect(
      pwaImageRouteMatch(
        routeCandidate("https://images.example.test/photo.jpg", {
          destination: "image",
          sameOrigin: false,
        }),
      ),
    ).toBe(false);
    expect(
      pwaImageRouteMatch(
        routeCandidate("https://res.cloudinary.com/demo/app.js", {
          destination: "script",
          sameOrigin: false,
        }),
      ),
    ).toBe(false);
  });
});
