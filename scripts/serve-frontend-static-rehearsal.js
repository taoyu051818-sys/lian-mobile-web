#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");

const port = Number(process.env.FRONTEND_PORT || 4300);
const backendBaseUrl = String(process.env.LIAN_BACKEND_BASE_URL || "http://127.0.0.1:4200").replace(/\/$/, "");
const imageProxyBaseUrl = String(process.env.LIAN_IMAGE_PROXY_BASE_URL || "http://127.0.0.1:4201").replace(/\/$/, "");
const publicProto = String(process.env.LIAN_PUBLIC_PROTO || "").trim().toLowerCase();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

function runtimeConfigScript() {
  return `<script>
window.LIAN_API_BASE_URL = "";
window.LIAN_IMAGE_PROXY_BASE_URL = window.location.origin;
window.LIAN_STATIC_REHEARSAL = { backendBaseUrl: ${JSON.stringify(backendBaseUrl)}, imageProxyBaseUrl: ${JSON.stringify(imageProxyBaseUrl)} };
</script>`;
}

function injectRuntimeConfig(html) {
  if (html.includes("window.LIAN_STATIC_REHEARSAL")) return html;
  return html.replace("</head>", `${runtimeConfigScript()}\n  </head>`);
}

function safePublicPath(pathname) {
  const normalized = path.normalize(decodeURIComponent(pathname)).replace(/^([.][.][/\\])+/, "");
  const relative = normalized === "/" || normalized === "\\" || normalized === "." ? "index.html" : normalized.replace(/^[/\\]+/, "");
  const fullPath = path.resolve(publicDir, relative);
  if (!fullPath.startsWith(publicDir + path.sep) && fullPath !== publicDir) return null;
  return fullPath;
}

function firstHeaderValue(value = "") {
  return String(value || "").split(",")[0].trim();
}

function forwardedProto(req) {
  const explicit = firstHeaderValue(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (explicit) return explicit;
  if (publicProto === "http" || publicProto === "https") return publicProto;
  const host = firstHeaderValue(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1") && !host.startsWith("[::1]")) {
    return "https";
  }
  return "http";
}

function requestOrigin(req) {
  const host = firstHeaderValue(req.headers["x-forwarded-host"] || req.headers.host || `127.0.0.1:${port}`);
  return `${forwardedProto(req)}://${host}`.replace(/\/$/, "");
}

function addForwardedRequestHeaders(req, headers) {
  const host = firstHeaderValue(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (host) headers["x-forwarded-host"] = host;
  headers["x-forwarded-proto"] = forwardedProto(req);
  const existingFor = firstHeaderValue(req.headers["x-forwarded-for"] || "");
  const remoteAddress = req.socket?.remoteAddress || "";
  headers["x-forwarded-for"] = [existingFor, remoteAddress].filter(Boolean).join(", ");
}

function sanitizeProxyResponseHeaders(headers = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(lowerKey)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function shouldRewriteTextResponse(headers = {}) {
  const contentType = String(headers["content-type"] || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("text/") || contentType.includes("javascript");
}

function rewriteRehearsalBody(req, body) {
  const origin = requestOrigin(req);
  return body
    .replaceAll(imageProxyBaseUrl, origin)
    .replaceAll(backendBaseUrl, origin);
}

async function proxyRequest(req, res, targetBaseUrl, { rewriteText = false } = {}) {
  const targetUrl = new URL(req.url || "/", targetBaseUrl);
  const headers = { ...req.headers };
  headers.host = targetUrl.host;
  addForwardedRequestHeaders(req, headers);
  delete headers["accept-encoding"];

  const proxyReq = http.request(targetUrl, {
    method: req.method,
    headers
  }, (proxyRes) => {
    const responseHeaders = sanitizeProxyResponseHeaders(proxyRes.headers);

    if (!rewriteText || !shouldRewriteTextResponse(responseHeaders)) {
      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(res);
      return;
    }

    const chunks = [];
    proxyRes.on("data", (chunk) => chunks.push(chunk));
    proxyRes.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const rewritten = rewriteRehearsalBody(req, body);
      res.writeHead(proxyRes.statusCode || 502, {
        ...responseHeaders,
        "content-length": String(Buffer.byteLength(rewritten))
      });
      res.end(rewritten);
    });
  });

  proxyReq.on("error", (error) => {
    send(res, 502, JSON.stringify({ error: error.message }), { "content-type": "application/json; charset=utf-8" });
  });

  req.pipe(proxyReq);
}

async function serveStatic(req, res, reqUrl) {
  const fullPath = safePublicPath(reqUrl.pathname);
  if (!fullPath) return send(res, 403, "forbidden", { "content-type": "text/plain; charset=utf-8" });

  try {
    let body = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const headers = { "content-type": MIME_TYPES[ext] || "application/octet-stream" };
    if (path.basename(fullPath) === "index.html") {
      body = Buffer.from(injectRuntimeConfig(body.toString("utf8")), "utf8");
    }
    return send(res, 200, body, headers);
  } catch (error) {
    if (error.code === "ENOENT" && !path.extname(reqUrl.pathname)) {
      const indexPath = path.join(publicDir, "index.html");
      const html = injectRuntimeConfig(await fs.readFile(indexPath, "utf8"));
      return send(res, 200, html, { "content-type": MIME_TYPES[".html"] });
    }
    return send(res, 404, "not found", { "content-type": "text/plain; charset=utf-8" });
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (reqUrl.pathname.startsWith("/api/image-proxy")) {
    return proxyRequest(req, res, imageProxyBaseUrl);
  }
  if (reqUrl.pathname.startsWith("/api/")) {
    return proxyRequest(req, res, backendBaseUrl, { rewriteText: true });
  }
  return serveStatic(req, res, reqUrl);
});

server.listen(port, () => {
  console.log(`LIAN static frontend rehearsal server running at http://127.0.0.1:${port}`);
  console.log(`Proxy /api/* -> ${backendBaseUrl}`);
  console.log(`Proxy /api/image-proxy -> ${imageProxyBaseUrl}`);
});
