import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

import { createSsrServer } from "../../src/server/ssr/index";

/**
 * Phase 1.2: integration tests for the Node http service.
 *
 * The service multiplexes:
 *   - GET /__ssr/health → 200 "ok" (cheap probe used by the systemd
 *     watchdog in phase 1.6).
 *   - any other GET     → render(url); on success returns a 200 HTML
 *     document, on render error returns 503 with a tiny fallback body
 *     so Caddy can serve the static index.html.
 *
 * Tests run a real ps stub on a random port, point
 * `LIAN_PS_INTERNAL_URL` at it, and probe the SSR server end-to-end.
 */

let psServer: Server | null = null;
let psPort = 0;
let psHandler: (req: IncomingMessage, res: ServerResponse) => void = () => {};

function startPsStub(): Promise<void> {
  return new Promise((resolve) => {
    psServer = createServer((req, res) => psHandler(req, res));
    psServer.listen(0, "127.0.0.1", () => {
      psPort = (psServer!.address() as AddressInfo).port;
      resolve();
    });
  });
}

function stopServer(server: Server | null): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

beforeEach(async () => {
  await startPsStub();
  process.env.LIAN_PS_INTERNAL_URL = `http://127.0.0.1:${psPort}`;
});

afterEach(async () => {
  await stopServer(psServer);
  psServer = null;
  delete process.env.LIAN_PS_INTERNAL_URL;
});

describe("ssr http service", () => {
  it("GET /__ssr/health returns 200 ok without touching ps", async () => {
    psHandler = (_req, res) => {
      res.statusCode = 500;
      res.end();
    };

    const ssr = createSsrServer();
    await new Promise<void>((resolve) => ssr.listen(0, "127.0.0.1", resolve));
    const port = (ssr.address() as AddressInfo).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/__ssr/health`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ok");
    } finally {
      await stopServer(ssr);
    }
  });

  it("GET /post/:tid renders 200 HTML containing OG meta when ps responds", async () => {
    psHandler = (req, res) => {
      if (!req.url?.startsWith("/api/posts/115/share-card")) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          card: {
            tid: 115,
            title: "校园咖啡今日特惠",
            summary: "拿铁买一送一，仅限下午茶时段。",
            thumbnailUrl: "https://cdn.example/coffee.jpg",
            url: "https://lian.example/post/115",
            kind: "post",
            authorName: "店长",
            audienceLabel: "公开",
            channel: {},
          },
        }),
      );
    };

    const ssr = createSsrServer();
    await new Promise<void>((resolve) => ssr.listen(0, "127.0.0.1", resolve));
    const port = (ssr.address() as AddressInfo).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/post/115`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      const body = await response.text();
      expect(body).toContain("og:image");
      expect(body).toContain("https://cdn.example/coffee.jpg");
      expect(body).toContain("<title>校园咖啡今日特惠</title>");
      expect(body).toContain('"/#/post/115"');
    } finally {
      await stopServer(ssr);
    }
  });

  it("GET /post/:tid responds 503 when ps share-card returns 404", async () => {
    psHandler = (_req, res) => {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
    };

    const ssr = createSsrServer();
    await new Promise<void>((resolve) => ssr.listen(0, "127.0.0.1", resolve));
    const port = (ssr.address() as AddressInfo).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/post/999`);
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(body).toContain("SSR fallback");
    } finally {
      await stopServer(ssr);
    }
  });

  it("GET / serves the homepage shell (no ps call)", async () => {
    let psCalls = 0;
    psHandler = (_req, res) => {
      psCalls++;
      res.statusCode = 500;
      res.end();
    };

    const ssr = createSsrServer();
    await new Promise<void>((resolve) => ssr.listen(0, "127.0.0.1", resolve));
    const port = (ssr.address() as AddressInfo).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("LIAN");
      expect(body).toContain("location.replace");
      expect(psCalls).toBe(0);
    } finally {
      await stopServer(ssr);
    }
  });

  it("GET /__ssr/health works even with no ps configured", async () => {
    delete process.env.LIAN_PS_INTERNAL_URL;
    const ssr = createSsrServer();
    await new Promise<void>((resolve) => ssr.listen(0, "127.0.0.1", resolve));
    const port = (ssr.address() as AddressInfo).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/__ssr/health`);
      expect(response.status).toBe(200);
    } finally {
      await stopServer(ssr);
    }
  });
});
