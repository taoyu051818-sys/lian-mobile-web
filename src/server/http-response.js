import { responseHeaders } from "./security-headers.js";

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  const contentType = "application/json; charset=utf-8";
  res.writeHead(status, responseHeaders(contentType, {
    "content-type": contentType,
    "cache-control": "no-store"
  }));
  res.end(payload);
}

export function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, responseHeaders(type, { "content-type": type }));
  res.end(text);
}
