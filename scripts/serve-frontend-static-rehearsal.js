#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");

const host = process.env.LIAN_FRONTEND_HOST || "127.0.0.1";
const port = Number(process.env.LIAN_FRONTEND_PORT || 4300);
const apiBaseUrl = new URL(process.env.LIAN_API_BASE_URL || "http://127.0.0.1:4200");
const imageProxyBaseUrl = new URL(process.env.LIAN_IMAGE_PROXY_BASE_URL || "http://127.0.0.1:4201");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"]
]);

function sendText(res, status, text) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(text);
}

function resolvePublicPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(publicDir, relativePath));
  if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) return null;
  return filePath;
}

function proxyRequest(req, res, targetBaseUrl) {
  const targetUrl = new URL(req.url || "/", targetBaseUrl);
  const headers = { ...req.headers, host: targetUrl.host };

  const proxy = http.request(targetUrl, { method: req.method, headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    pipeline(proxyRes, res, () => {});
  });

  proxy.on("error", (error) => {
    if (!res.headersSent) {
      sendText(res, 502, `proxy error: ${error.message}`);
    } else {
      res.destroy(error);
    }
  });

  req.pipe(proxy);
}

function serveStatic(req, res) {
  const filePath = resolvePublicPath(req.url || "/");
  if (!filePath) {
    sendText(res, 400, "invalid path");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendText(res, 404, "not found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`).pathname;

  if (urlPath.startsWith("/api/image-proxy")) {
    proxyRequest(req, res, imageProxyBaseUrl);
    return;
  }

  if (urlPath.startsWith("/api/")) {
    proxyRequest(req, res, apiBaseUrl);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`LIAN static frontend rehearsal server running at http://${host}:${port}`);
  console.log(`Proxy /api/* -> ${apiBaseUrl.origin}`);
  console.log(`Proxy /api/image-proxy -> ${imageProxyBaseUrl.origin}`);
});
