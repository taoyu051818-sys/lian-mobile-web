import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { sendJson, sendText } from "./http-response.js";
import { publicDir } from "./paths.js";
import { responseHeaders } from "./security-headers.js";
import { MIME } from "./static-data.js";

const LONG_LIVED_STATIC_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".json",
  ".png",
  ".svg",
  ".webp"
]);

function runtimeConfigScript(pathname) {
  const values = [
    `window.LIAN_IMAGE_PROXY_BASE_URL=${JSON.stringify(config.imageProxyPublicBaseUrl)};`
  ];
  if (pathname === "/tools/map-v2-editor.html") {
    values.push(`window.LIAN_NODEBB_URL=${JSON.stringify(config.nodebbPublicBaseUrl)};`);
  }
  return `<script>${values.join("")}</script>`;
}

function injectRuntimeConfig(html, pathname) {
  return String(html).replace("</head>", `${runtimeConfigScript(pathname)}</head>`);
}

function cacheControlForStatic(pathname, ext) {
  if (pathname.startsWith("/assets/") || LONG_LIVED_STATIC_EXTENSIONS.has(ext)) {
    return "public, max-age=2592000, immutable";
  }
  return "no-cache";
}

async function serveStatic(reqUrl, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(reqUrl.pathname);
  } catch {
    sendText(res, 400, "Bad Request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(publicDir, pathname));
  const relativePath = path.relative(publicDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  try {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const isHtml = ext === ".html" || ext === ".htm";
    let data = await fs.readFile(filePath, isHtml ? "utf8" : undefined);
    if (isHtml) data = injectRuntimeConfig(data, pathname);
    res.writeHead(200, responseHeaders(type, {
      "content-type": type,
      "cache-control": cacheControlForStatic(pathname, ext)
    }));
    res.end(data);
  } catch {
    const index = injectRuntimeConfig(await fs.readFile(path.join(publicDir, "index.html"), "utf8"), "/index.html");
    const type = MIME[".html"];
    res.writeHead(200, responseHeaders(type, { "content-type": type, "cache-control": "no-cache" }));
    res.end(index);
  }
}

async function proxyLianAsset(reqUrl, res) {
  const assetPath = reqUrl.pathname.replace(/^\/lian-assets/, "");
  if (!assetPath.startsWith("/assets/")) {
    sendText(res, 404, "not found");
    return;
  }
  try {
    const target = new URL(assetPath + reqUrl.search, config.nodebbBaseUrl);
    const response = await fetch(target, { headers: { connection: "close" } });
    if (!response.ok) {
      sendText(res, response.status, "asset not found");
      return;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get("content-type") || MIME[path.extname(assetPath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, responseHeaders(type, {
      "content-type": type,
      "cache-control": "public, max-age=2592000, immutable"
    }));
    res.end(bytes);
  } catch (error) {
    sendJson(res, 502, { error: error.message || "asset proxy failed" });
  }
}

export { proxyLianAsset, serveStatic };
