import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { sendJson, sendText } from "./http-response.js";
import { publicDir } from "./paths.js";
import { responseHeaders } from "./security-headers.js";
import { MIME } from "./static-data.js";

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
    if (isHtml && pathname === "/tools/map-v2-editor.html") {
      data = data.replace(
        "</head>",
        `<script>window.LIAN_NODEBB_URL=${JSON.stringify(config.nodebbPublicBaseUrl)};</script></head>`
      );
    }
    res.writeHead(200, responseHeaders(type, { "content-type": type, "cache-control": "no-cache" }));
    res.end(data);
  } catch {
    const index = await fs.readFile(path.join(publicDir, "index.html"));
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
      "cache-control": "public, max-age=3600"
    }));
    res.end(bytes);
  } catch (error) {
    sendJson(res, 502, { error: error.message || "asset proxy failed" });
  }
}

export { proxyLianAsset, serveStatic };
