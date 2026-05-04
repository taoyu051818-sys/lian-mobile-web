import test from "node:test";
import assert from "node:assert/strict";

import { canViewPost } from "../src/server/audience-service.js";
import { sessionCookie } from "../src/server/auth-service.js";
import { escapeHtml, buildTextPostHtml, renderPostContent, sanitizeHtml } from "../src/server/content-utils.js";
import { isAllowedImageUrl } from "../src/server/image-proxy.js";
import { assertRateLimit, checkRateLimit, clearRateLimits } from "../src/server/rate-limit.js";
import { getRequestOrigin, isSameOriginRequest, requireSameOrigin } from "../src/server/request-security.js";
import { responseHeaders } from "../src/server/security-headers.js";
import { isProductionMode } from "../src/server/security-mode.js";
import { detectImageType, validateImageFile, MAX_UPLOAD_IMAGE_BYTES } from "../src/server/upload.js";

const SCHOOL_NAME = "中国传媒大学海南国际学院";
const SCHOOL_ID = "中国传媒大学";
const campusUser = {
  id: "user-1",
  institution: SCHOOL_NAME,
  tags: [SCHOOL_ID, "高校认证"],
  status: "active"
};

function withSecurityMode(mode, fn) {
  const previous = process.env.LIAN_SECURITY_MODE;
  if (mode === undefined) delete process.env.LIAN_SECURITY_MODE;
  else process.env.LIAN_SECURITY_MODE = mode;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.LIAN_SECURITY_MODE;
    else process.env.LIAN_SECURITY_MODE = previous;
  }
}

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
      schoolIds: [SCHOOL_ID],
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

test("security mode is development by default and production when explicitly enabled", () => {
  withSecurityMode("development", () => assert.equal(isProductionMode(), false));
  withSecurityMode("production", () => assert.equal(isProductionMode(), true));
});

test("rate limiter is disabled in development and enforceable in production", () => {
  clearRateLimits();
  withSecurityMode("development", () => {
    const result = assertRateLimit("login:test", { max: 1, windowMs: 1000, now: 100 });
    assert.equal(result.disabled, true);
    assert.doesNotThrow(() => assertRateLimit("login:test", { max: 1, windowMs: 1000, now: 200 }));
  });
  withSecurityMode("production", () => {
    clearRateLimits();
    assert.equal(assertRateLimit("login:test", { max: 2, windowMs: 1000, now: 100 }).remaining, 1);
    assert.equal(assertRateLimit("login:test", { max: 2, windowMs: 1000, now: 200 }).remaining, 0);
    assert.throws(() => assertRateLimit("login:test", { max: 2, windowMs: 1000, now: 300 }), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterSeconds, 1);
      return true;
    });
    assert.equal(assertRateLimit("login:test", { max: 2, windowMs: 1000, now: 1200 }).remaining, 1);
  });
});

test("rate limiter keys include client ip and subject in production", () => {
  withSecurityMode("production", () => {
    clearRateLimits();
    const req = { headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" } };
    checkRateLimit(req, "email-code", "student@example.edu", { max: 1, windowMs: 1000 });
    assert.throws(() => checkRateLimit(req, "email-code", "student@example.edu", { max: 1, windowMs: 1000 }), /too many requests/);
    assert.doesNotThrow(() => checkRateLimit(req, "email-code", "other@example.edu", { max: 1, windowMs: 1000 }));
  });
});

test("same-origin guard is disabled in development and blocks cross-site mutations in production", () => {
  const baseReq = {
    method: "POST",
    headers: {
      host: "149.104.21.74:4100",
      origin: "http://149.104.21.74:4100"
    }
  };
  assert.equal(getRequestOrigin(baseReq), "http://149.104.21.74:4100");
  assert.equal(isSameOriginRequest(baseReq), true);
  withSecurityMode("development", () => {
    assert.doesNotThrow(() => requireSameOrigin({ ...baseReq, headers: { ...baseReq.headers, origin: "https://evil.example" } }));
  });
  withSecurityMode("production", () => {
    assert.doesNotThrow(() => requireSameOrigin(baseReq));
    assert.doesNotThrow(() => requireSameOrigin({ ...baseReq, method: "GET", headers: { ...baseReq.headers, origin: "https://evil.example" } }));
    assert.throws(() => requireSameOrigin({ ...baseReq, headers: { ...baseReq.headers, origin: "https://evil.example" } }), /cross-origin/);
  });
});

test("same-origin guard respects forwarded proto and host", () => {
  const req = {
    method: "POST",
    headers: {
      host: "127.0.0.1:4100",
      "x-forwarded-host": "lian.example.com",
      "x-forwarded-proto": "https",
      referer: "https://lian.example.com/app"
    }
  };
  assert.equal(getRequestOrigin(req), "https://lian.example.com");
  assert.equal(isSameOriginRequest(req), true);
});

test("production headers are strict while development headers stay minimal", () => {
  withSecurityMode("development", () => {
    const headers = responseHeaders("text/html; charset=utf-8", { "content-type": "text/html; charset=utf-8" });
    assert.equal(headers["x-lian-security-mode"], "development");
    assert.equal(headers["content-security-policy"], undefined);
    assert.equal(headers["x-content-type-options"], undefined);
  });
  withSecurityMode("production", () => {
    const headers = responseHeaders("text/html; charset=utf-8", { "content-type": "text/html; charset=utf-8" });
    assert.equal(headers["x-lian-security-mode"], "production");
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["referrer-policy"], "no-referrer");
    assert.equal(headers["x-frame-options"], "SAMEORIGIN");
    assert.match(headers["content-security-policy"], /default-src 'self'/);
  });
});

test("session cookies are Secure only in production", () => {
  withSecurityMode("development", () => {
    assert.doesNotMatch(sessionCookie("token"), /; Secure/);
  });
  withSecurityMode("production", () => {
    assert.match(sessionCookie("token"), /; Secure/);
  });
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
