#!/usr/bin/env node

// Route matcher tests — freezes current api-router.js matching behavior.
// Usage: node scripts/test-routes.js

import { matchRoute } from "../src/server/route-matcher.js";

let passed = 0, failed = 0;

function assert(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✓ ${name}`); passed++; }
  else {
    console.log(`  ✗ ${name}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertNull(result, name) {
  if (result === null) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name} — expected null, got ${JSON.stringify(result)}`); failed++; }
}

console.log("═══ 路由匹配测试 ═══\n");

// === 1. Exact matches ===
console.log("▶ 精确匹配");

assert(matchRoute("GET", "/api/setup/status"), { routeId: "setup-status", params: {} }, "GET /api/setup/status");
assert(matchRoute("POST", "/api/setup"), { routeId: "setup", params: {} }, "POST /api/setup");
assert(matchRoute("GET", "/api/image-proxy"), { routeId: "image-proxy", params: {} }, "GET /api/image-proxy");
assert(matchRoute("GET", "/api/alias-pool"), { routeId: "alias-pool", params: {} }, "GET /api/alias-pool");
assert(matchRoute("POST", "/api/ai/post-preview"), { routeId: "ai-post-preview", params: {} }, "POST /api/ai/post-preview");
assert(matchRoute("POST", "/api/ai/post-drafts"), { routeId: "ai-post-drafts", params: {} }, "POST /api/ai/post-drafts");
assert(matchRoute("POST", "/api/ai/post-publish"), { routeId: "ai-post-publish", params: {} }, "POST /api/ai/post-publish");
assert(matchRoute("GET", "/api/auth/rules"), { routeId: "auth-rules", params: {} }, "GET /api/auth/rules");
assert(matchRoute("GET", "/api/auth/me"), { routeId: "auth-me", params: {} }, "GET /api/auth/me");
assert(matchRoute("POST", "/api/auth/avatar"), { routeId: "auth-avatar", params: {} }, "POST /api/auth/avatar");
assert(matchRoute("POST", "/api/auth/email-code"), { routeId: "auth-email-code", params: {} }, "POST /api/auth/email-code");
assert(matchRoute("POST", "/api/auth/register"), { routeId: "auth-register", params: {} }, "POST /api/auth/register");
assert(matchRoute("POST", "/api/auth/login"), { routeId: "auth-login", params: {} }, "POST /api/auth/login");
assert(matchRoute("POST", "/api/auth/logout"), { routeId: "auth-logout", params: {} }, "POST /api/auth/logout");
assert(matchRoute("POST", "/api/auth/invites"), { routeId: "auth-invites", params: {} }, "POST /api/auth/invites");
assert(matchRoute("GET", "/api/auth/aliases"), { routeId: "auth-aliases-get", params: {} }, "GET /api/auth/aliases");
assert(matchRoute("POST", "/api/auth/aliases"), { routeId: "auth-aliases-post", params: {} }, "POST /api/auth/aliases");
assert(matchRoute("POST", "/api/auth/aliases/deactivate"), { routeId: "auth-alias-deactivate", params: {} }, "POST /api/auth/aliases/deactivate");
assert(matchRoute("POST", "/api/auth/aliases/activate"), { routeId: "auth-alias-activate", params: {} }, "POST /api/auth/aliases/activate");
assert(matchRoute("GET", "/api/feed"), { routeId: "feed", params: {} }, "GET /api/feed");
assert(matchRoute("GET", "/api/feed-debug"), { routeId: "feed-debug", params: {} }, "GET /api/feed-debug");
assert(matchRoute("GET", "/api/tags"), { routeId: "tags", params: {} }, "GET /api/tags");
assert(matchRoute("GET", "/api/map/v2/items"), { routeId: "map-v2-items", params: {} }, "GET /api/map/v2/items");
assert(matchRoute("GET", "/api/map/items"), { routeId: "map-items", params: {} }, "GET /api/map/items");
assert(matchRoute("GET", "/api/channel"), { routeId: "channel", params: {} }, "GET /api/channel");
assert(matchRoute("POST", "/api/channel/read"), { routeId: "channel-read", params: {} }, "POST /api/channel/read");
assert(matchRoute("POST", "/api/channel/messages"), { routeId: "channel-messages", params: {} }, "POST /api/channel/messages");
assert(matchRoute("GET", "/api/messages"), { routeId: "messages", params: {} }, "GET /api/messages");
assert(matchRoute("GET", "/api/me"), { routeId: "me", params: {} }, "GET /api/me");
assert(matchRoute("GET", "/api/me/saved"), { routeId: "me-saved", params: {} }, "GET /api/me/saved");
assert(matchRoute("GET", "/api/me/liked"), { routeId: "me-liked", params: {} }, "GET /api/me/liked");
assert(matchRoute("POST", "/api/me/history"), { routeId: "me-history", params: {} }, "POST /api/me/history");
assert(matchRoute("POST", "/api/upload/image"), { routeId: "upload-image", params: {} }, "POST /api/upload/image");
assert(matchRoute("POST", "/api/posts"), { routeId: "create-post", params: {} }, "POST /api/posts");

console.log("");

// === 2. Regex routes with param extraction ===
console.log("▶ 参数提取");

assert(matchRoute("GET", "/api/posts/123"), { routeId: "post-detail", params: { tid: "123" } }, "GET /api/posts/123 → tid=123");
assert(matchRoute("GET", "/api/posts/1"), { routeId: "post-detail", params: { tid: "1" } }, "GET /api/posts/1 → tid=1");
assert(matchRoute("GET", "/api/posts/99999"), { routeId: "post-detail", params: { tid: "99999" } }, "GET /api/posts/99999 → tid=99999");
assert(matchRoute("POST", "/api/posts/42/replies"), { routeId: "post-replies", params: { tid: "42" } }, "POST /api/posts/42/replies → tid=42");
assert(matchRoute("POST", "/api/posts/42/like"), { routeId: "post-like", params: { tid: "42" } }, "POST /api/posts/42/like → tid=42");
assert(matchRoute("POST", "/api/posts/42/save"), { routeId: "post-save", params: { tid: "42" } }, "POST /api/posts/42/save → tid=42");
assert(matchRoute("POST", "/api/posts/42/report"), { routeId: "post-report", params: { tid: "42" } }, "POST /api/posts/42/report → tid=42");

console.log("");

// === 3. Prefix match (admin) ===
console.log("▶ 前缀匹配");

assert(matchRoute("GET", "/api/admin/map-v2"), { routeId: "admin", params: {} }, "GET /api/admin/map-v2");
assert(matchRoute("PUT", "/api/admin/map-v2"), { routeId: "admin", params: {} }, "PUT /api/admin/map-v2");
assert(matchRoute("POST", "/api/admin/anything"), { routeId: "admin", params: {} }, "POST /api/admin/anything");
assert(matchRoute("GET", "/api/admin/deep/nested/path"), { routeId: "admin", params: {} }, "GET /api/admin/deep/nested/path");

console.log("");

// === 4. 404 (null) ===
console.log("▶ 404 未匹配");

assertNull(matchRoute("GET", "/api/nonexistent"), "GET /api/nonexistent → null");
assertNull(matchRoute("GET", "/api"), "GET /api → null");
assertNull(matchRoute("GET", "/"), "GET / → null");
assertNull(matchRoute("POST", "/api/feed"), "POST /api/feed → null (method mismatch)");
assertNull(matchRoute("GET", "/api/posts"), "GET /api/posts → null (no GET handler for /api/posts)");
assertNull(matchRoute("PUT", "/api/posts/123"), "PUT /api/posts/123 → null");
assertNull(matchRoute("DELETE", "/api/posts/123"), "DELETE /api/posts/123 → null");

console.log("");

// === 5. Method mismatch ===
console.log("▶ 方法不匹配");

assertNull(matchRoute("GET", "/api/auth/login"), "GET /api/auth/login → null (POST only)");
assertNull(matchRoute("GET", "/api/auth/register"), "GET /api/auth/register → null (POST only)");
assertNull(matchRoute("POST", "/api/feed-debug"), "POST /api/feed-debug → null (GET only)");
assertNull(matchRoute("POST", "/api/map/v2/items"), "POST /api/map/v2/items → null (GET only)");
assertNull(matchRoute("GET", "/api/upload/image"), "GET /api/upload/image → null (POST only)");

console.log("");

// === 6. Priority: exact before regex ===
console.log("▶ 优先级");

assert(matchRoute("GET", "/api/auth/me"), { routeId: "auth-me", params: {} }, "GET /api/auth/me → exact match, not regex");
assert(matchRoute("POST", "/api/posts"), { routeId: "create-post", params: {} }, "POST /api/posts → exact, not /api/posts/:tid regex");
assert(matchRoute("GET", "/api/me"), { routeId: "me", params: {} }, "GET /api/me → exact, not /api/me/saved");
assert(matchRoute("POST", "/api/auth/aliases"), { routeId: "auth-aliases-post", params: {} }, "POST /api/auth/aliases → exact, not /api/auth/aliases/deactivate");

console.log("");

// === Summary ===
console.log("═══ 结果 ═══");
console.log(`通过: ${passed}, 失败: ${failed}`);
if (failed > 0) {
  console.log("\n有失败的测试用例，请检查 route-matcher.js。");
  process.exit(1);
} else {
  console.log("\n全部通过！");
}
