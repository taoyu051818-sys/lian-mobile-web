/**
 * Node http service for SSR — phase 1.2 of
 * `docs/architecture/SSR_PWA_RFC_2026_05_23.md`.
 *
 * Wraps the route-aware `render(url)` from `src/entry-server.ts` in a
 * minimal Node http server. systemd / Caddy wiring is phase 1.6 (out
 * of scope here). This file is the runtime-only concern; vite never
 * sees it (the SSR render is a string-builder, not a Vue render in
 * phase 1.2 — see `entry-server.ts` for the rationale).
 *
 * Endpoints:
 *   GET /__ssr/health → 200 "ok" (cheap probe; never touches ps).
 *   GET *             → render(url); 200 HTML on success, 503 on any
 *                       upstream error so Caddy can fall back to the
 *                       static `index.html` (RFC §5).
 *
 * `createSsrServer()` returns the Node `http.Server` without binding,
 * so tests can listen on port 0. The CLI bootstrap lives in
 * `./start.ts` so that importing this module never starts a listener
 * by accident.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { render } from "../../entry-server";

export const DEFAULT_SSR_PORT = 5173;

export function createSsrServer(): Server {
  return createServer(handleRequest);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? "/";

  if (url === "/__ssr/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  // Only GET is meaningful for SSR; other verbs would be Caddy
  // misconfiguration. We still answer 405 instead of crashing so the
  // operator gets a precise error rather than a 503 fallback page.
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("allow", "GET, HEAD");
    res.end("method not allowed");
    return;
  }

  try {
    const { head, html } = await render(url);
    const body = renderDocument({ head, html });
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(body);
  } catch (error) {
    // Per RFC §5: any SSR failure is non-fatal — Caddy serves the
    // static index.html instead. Returning 503 (not 500) lets Caddy
    // distinguish "SSR is broken right now" from "this URL does not
    // exist". The body is intentionally tiny so it isn't mistaken
    // for a real page if Caddy fallback is ever misconfigured.
    res.statusCode = 503;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    const message = error instanceof Error ? error.message : "unknown";
    res.end(`SSR fallback (${message})`);
  }
}

/**
 * Splice render output into the document shell. Phase 1.2 emits a
 * minimal shell that mirrors the static `index.html` head order
 * (charset → viewport → theme-color → injected meta) so crawlers see
 * a stable document while real browsers immediately follow the
 * embedded `location.replace` script in the body.
 */
function renderDocument({ head, html }: { head: string; html: string }): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#f7f4ec" />
    ${head}
  </head>
  <body>
    ${html}
  </body>
</html>
`;
}
