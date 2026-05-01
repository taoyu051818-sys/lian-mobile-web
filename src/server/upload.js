import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";
import { warmupPostImages } from "./content-utils.js";
import { sendJson } from "./http-response.js";
import { rootDir } from "./paths.js";
import { parseMultipart, readBodyBuffer } from "./request-utils.js";

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
  const buffer = await readBodyBuffer(req);
  const parts = parseMultipart(buffer, req.headers["content-type"] || "");
  const file = parts.find((part) => part.name === "image" && part.filename && part.body.length);
  if (!file) {
    sendJson(res, 400, { error: "image file is required" });
    return;
  }
  if (!file.type.startsWith("image/")) {
    sendJson(res, 400, { error: "only image files are supported" });
    return;
  }
  const purpose = reqUrl.searchParams.get("purpose") === "avatar" ? "avatar" : "";
  const url = await uploadImageToCloudinary(file, purpose);
  if (purpose !== "avatar") await warmupPostImages([url]);
  sendJson(res, 200, { url });
}

export { handleUploadImage, uploadImageToCloudinary };
