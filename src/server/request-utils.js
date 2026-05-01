import { config } from "./config.js";

async function readJsonBody(req, maxBytes = 0) {
  let body = "";
  let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (maxBytes && bytes > maxBytes) {
      const error = new Error("request body is too large");
      error.status = 413;
      throw error;
    }
    body += chunk;
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || req.headers["x-admin-token"] || "";
}

function requireAdmin(req) {
  if (!config.adminToken) {
    const error = new Error("ADMIN_TOKEN is missing");
    error.status = 503;
    throw error;
  }
  if (getAuthToken(req) !== config.adminToken) {
    const error = new Error("admin authorization failed");
    error.status = 401;
    throw error;
  }
}

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType = "") {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Missing multipart boundary");
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor >= 0) {
    let start = cursor + boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    const next = buffer.indexOf(boundary, start);
    if (next < 0) break;

    let end = next;
    if (buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
    const part = buffer.subarray(start, end);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > 0) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      const name = rawHeaders.match(/name="([^"]+)"/)?.[1] || "";
      const filename = rawHeaders.match(/filename="([^"]*)"/)?.[1] || "";
      const type = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
      parts.push({ name, filename, type, body });
    }

    cursor = next;
  }

  return parts;
}

export { getAuthToken, parseMultipart, readBodyBuffer, readJsonBody, requireAdmin };