import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { optimizeCloudinaryAvatarUrl, warmupPostImages } from "./content-utils.js";
import { sendJson } from "./http-response.js";
import { rootDir } from "./paths.js";
import { parseMultipart, readBodyBuffer } from "./request-utils.js";

const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_IMAGE_BYTES + 512 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function getCloudinaryUrl() {
  if (config.cloudinaryUrl) return config.cloudinaryUrl;
  const localEnv = path.resolve(rootDir, "../NodeBB-frontend/.env.local");
  try {
    const text = await fs.readFile(localEnv, "utf8");
    const line = text.split(/\r?\n/).find((item) => item.startsWith("CLOUDINARY_URL="));
    if (line) return line.slice("CLOUDINARY_URL=".length).trim();
  } catch {
    return "";
  }
  return "";
}

function detectImageType(buffer = Buffer.alloc(0)) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  return "";
}

function validateImageFile(file) {
  if (!file?.body?.length) {
    const error = new Error("image file is required");
    error.status = 400;
    throw error;
  }
  if (file.body.length > MAX_UPLOAD_IMAGE_BYTES) {
    const error = new Error("image file is too large");
    error.status = 413;
    throw error;
  }
  const declaredType = String(file.type || "").toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(declaredType)) {
    const error = new Error("only jpeg, png, webp, and gif images are supported");
    error.status = 400;
    throw error;
  }
  const detectedType = detectImageType(file.body);
  if (!detectedType || detectedType !== declaredType) {
    const error = new Error("image file type does not match its content");
    error.status = 400;
    throw error;
  }
  return { ...file, type: detectedType };
}

async function uploadImageToCloudinary(file, purpose = "") {
  const cloudinaryUrl = await getCloudinaryUrl();
  if (!cloudinaryUrl) throw new Error("CLOUDINARY_URL is missing");

  const uri = new URL(cloudinaryUrl);
  const [apiKey, apiSecret] = decodeURIComponent(uri.username + ":" + uri.password).split(":");
  const cloudName = uri.hostname;
  const folder = purpose === "avatar" ? "nodebb-frontend/avatars" : "nodebb-frontend/mobile-web-upload";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([file.body], { type: file.type }), file.filename || "upload.jpg");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }
  return purpose === "avatar" ? optimizeCloudinaryAvatarUrl(data.secure_url) : data.secure_url;
}

async function handleUploadImage(req, res, reqUrl) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_UPLOAD_BODY_BYTES) return sendJson(res, 413, { error: "request body is too large" });
  const buffer = await readBodyBuffer(req, MAX_UPLOAD_BODY_BYTES);
  const parts = parseMultipart(buffer, req.headers["content-type"] || "");
  const rawFile = parts.find((part) => part.name === "image" && part.filename && part.body.length);
  let file;
  try {
    file = validateImageFile(rawFile);
  } catch (error) {
    return sendJson(res, error.status || 400, { error: error.message });
  }
  const purpose = reqUrl.searchParams.get("purpose") === "avatar" ? "avatar" : "";
  const url = await uploadImageToCloudinary(file, purpose);
  if (purpose !== "avatar") await warmupPostImages([url]);
  sendJson(res, 200, { url });
}

export {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BODY_BYTES,
  MAX_UPLOAD_IMAGE_BYTES,
  detectImageType,
  handleUploadImage,
  uploadImageToCloudinary,
  validateImageFile
};
