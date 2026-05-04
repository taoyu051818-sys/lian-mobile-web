import test from "node:test";
import assert from "node:assert/strict";

import { canViewPost } from "../src/server/audience-service.js";
import { escapeHtml, buildTextPostHtml, renderPostContent, sanitizeHtml } from "../src/server/content-utils.js";
import { isAllowedImageUrl } from "../src/server/image-proxy.js";
import { detectImageType, validateImageFile, MAX_UPLOAD_IMAGE_BYTES } from "../src/server/upload.js";

const campusUser = {
  id: "user-1",
  institution: "海南比勒费尔德应用科学大学",
  tags: ["海南比勒费尔德应用科学大学", "高校认证"],
  status: "active"
};

test("linkOnly posts are hidden from feed and map but visible on detail when public", () => {
  const post = { visibility: "public", audience: { visibility: "public", linkOnly: true } };
  assert.equal(canViewPost(null, post, "feed"), false);
  assert.equal(canViewPost(campusUser, post, "map"), false);
  assert.equal(canViewPost(null, post, "detail"), true);
});

test("school visibility denies guests and allows matching school users", () => {
  const post = {
    visibility: "school",
    audience: {
      visibility: "school",
      schoolIds: ["海南比勒费尔德应用科学大学"],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false
    }
  };
  assert.equal(canViewPost(null, post, "detail"), false);
  assert.equal(canViewPost(campusUser, post, "detail"), true);
});

test("private visibility only allows listed users or org members", () => {
  const post = {
    visibility: "private",
    audience: {
      visibility: "private",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: ["user-1"],
      linkOnly: false
    }
  };
  assert.equal(canViewPost(null, post, "detail"), false);
  assert.equal(canViewPost({ ...campusUser, id: "other" }, post, "detail"), false);
  assert.equal(canViewPost(campusUser, post, "detail"), true);
});

test("image proxy only accepts the configured HTTPS Cloudinary path", () => {
  assert.equal(isAllowedImageUrl("https://res.cloudinary.com/dhvyvfu4n/image/upload/v1/example.jpg"), true);
  assert.equal(isAllowedImageUrl("http://res.cloudinary.com/dhvyvfu4n/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("https://evil.example.com/dhvyvfu4n/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("https://res.cloudinary.com/other/image/upload/v1/example.jpg"), false);
  assert.equal(isAllowedImageUrl("not-a-url"), false);
});

test("text post helpers escape HTML before rendering", () => {
  const payload = `<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>`;
  const html = buildTextPostHtml(payload);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(escapeHtml('"<&>'), "&quot;&lt;&amp;&gt;");
});

test("html sanitizer removes dangerous tags, handlers, and unsafe urls", () => {
  const input = `
    <p onclick="alert(1)" style="color:red">hello <strong>world</strong></p>
    <script>alert(1)</script>
    <img src="javascript:alert(1)" onerror="alert(2)" alt="x">
    <img src="/api/image-proxy?url=safe" loading="lazy" alt="ok">
    <a href="javascript:alert(1)" target="_blank">bad</a>
    <a href="https://example.com/x" target="_blank">good</a>
    <iframe src="https://evil.example"></iframe>
  `;
  const html = sanitizeHtml(input);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /onclick/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /style=/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /iframe/i);
  assert.match(html, /<strong>world<\/strong>/);
  assert.match(html, /<img src="\/api\/image-proxy\?url=safe" loading="lazy" alt="ok">/);
  assert.match(html, /<a href="https:\/\/example\.com\/x" target="_blank" rel="noopener noreferrer">good<\/a>/);
});

test("renderPostContent sanitizes existing HTML blocks", () => {
  const html = renderPostContent('<div><img src="javascript:alert(1)" onerror="x"><p>safe</p></div>');
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.match(html, /<p>safe<\/p>/);
});

test("upload validation accepts only matching image signatures", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");
  const gif = Buffer.from("GIF89a", "ascii");
  assert.equal(detectImageType(jpeg), "image/jpeg");
  assert.equal(detectImageType(png), "image/png");
  assert.equal(detectImageType(webp), "image/webp");
  assert.equal(detectImageType(gif), "image/gif");
  assert.equal(detectImageType(Buffer.from("<svg></svg>")), "");
  assert.equal(validateImageFile({ type: "image/jpeg", body: jpeg }).type, "image/jpeg");
  assert.throws(() => validateImageFile({ type: "image/png", body: jpeg }), /does not match/);
  assert.throws(() => validateImageFile({ type: "image/svg+xml", body: Buffer.from("<svg></svg>") }), /only jpeg/);
  assert.throws(() => validateImageFile({ type: "image/jpeg", body: Buffer.alloc(MAX_UPLOAD_IMAGE_BYTES + 1, 0xff) }), /too large/);
});
