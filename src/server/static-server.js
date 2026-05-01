import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { sendJson, sendText } from "./http-response.js";
import { publicDir } from "./paths.js";
import { MIME } from "./static-data.js";

async function serveStatic(reqUrl, res) {
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    res.end(data);
  } catch {
    const index = await fs.readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-cache" });
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
    res.writeHead(200, {
      "content-type": type,
      "cache-control": "public, max-age=3600"
    });
    res.end(bytes);
  } catch (error) {
    sendJson(res, 502, { error: error.message || "asset proxy failed" });
  }
}

export { proxyLianAsset, serveStatic };