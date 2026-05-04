import assert from "node:assert/strict";

const REQUIRED_ENV = ["APP_BASE_URL"];
const OPTIONAL_ENV = [
  "ADMIN_TOKEN",
  "TEST_LOGIN",
  "TEST_PASSWORD",
  "ONLINE_E2E_ALLOW_MUTATIONS",
  "ONLINE_E2E_TEST_AI_PREVIEW"
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}

function boolEnv(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

function mask(value = "") {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function logStep(message) {
  console.log(`\n▶ ${message}`);
}

function logEnvSummary() {
  console.log("Online E2E smoke configuration:");
  for (const name of REQUIRED_ENV) console.log(`- ${name}: set`);
  for (const name of OPTIONAL_ENV) {
    const value = process.env[name] || "";
    if (!value) console.log(`- ${name}: not set`);
    else if (name.includes("TOKEN") || name.includes("PASSWORD")) console.log(`- ${name}: ${mask(value)}`);
    else console.log(`- ${name}: ${value}`);
  }
}

const baseUrl = requireEnv("APP_BASE_URL");
const allowMutations = boolEnv("ONLINE_E2E_ALLOW_MUTATIONS");
const testAiPreview = boolEnv("ONLINE_E2E_TEST_AI_PREVIEW");
const adminToken = process.env.ADMIN_TOKEN || "";
const testLogin = process.env.TEST_LOGIN || "";
const testPassword = process.env.TEST_PASSWORD || "";

const cookieJar = new Map();

function rememberCookies(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;
  for (const raw of setCookie.split(/,(?=\s*[^;=]+=[^;]+)/)) {
    const first = raw.split(";")[0];
    const index = first.indexOf("=");
    if (index <= 0) continue;
    cookieJar.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  if (cookieJar.size && !headers.has("cookie")) headers.set("cookie", cookieHeader());

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  rememberCookies(response);
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const detail = typeof data?.error === "string" ? data.error : text.slice(0, 300);
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${detail}`);
  }
  return { response, data };
}

async function expectEndpoint(path, validate) {
  const { data } = await request(path);
  validate(data);
  console.log(`✓ ${path}`);
  return data;
}

async function runReadOnlySmoke() {
  logStep("Read-only service checks");

  await expectEndpoint("/api/setup/status", (data) => {
    assert.equal(typeof data.required, "boolean", "setup.status.required should be boolean");
    assert.equal(typeof data.configured, "boolean", "setup.status.configured should be boolean");
  });

  await expectEndpoint("/api/auth/rules", (data) => {
    assert.ok(Array.isArray(data.institutions), "auth rules should include institutions array");
  });

  await expectEndpoint("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=4", (data) => {
    assert.ok(Array.isArray(data.items), "feed.items should be array");
    assert.equal(typeof data.hasMore, "boolean", "feed.hasMore should be boolean");
  });

  await expectEndpoint("/api/map/v2/items", (data) => {
    assert.equal(typeof data, "object", "map/v2/items should return JSON object");
  });
}

async function runAdminSmoke() {
  if (!adminToken) {
    console.log("\nℹ ADMIN_TOKEN not set; skipping admin checks");
    return;
  }

  logStep("Admin checks");
  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const rules = await request("/api/admin/feed-rules", { headers: adminHeaders });
  assert.equal(typeof rules.data, "object", "admin feed rules should be object");
  console.log("✓ /api/admin/feed-rules");

  if (!allowMutations) {
    console.log("ℹ ONLINE_E2E_ALLOW_MUTATIONS is not true; skipping admin reload");
    return;
  }

  const reload = await request("/api/admin/reload", { method: "POST", headers: adminHeaders });
  assert.equal(reload.data.ok, true, "admin reload should return ok=true");
  console.log("✓ /api/admin/reload");
}

async function runLoginSmoke() {
  if (!testLogin || !testPassword) {
    console.log("\nℹ TEST_LOGIN or TEST_PASSWORD not set; skipping login checks");
    return;
  }

  logStep("Login checks");
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: testLogin, password: testPassword })
  });
  assert.ok(login.data.user, "login should return user");
  assert.ok(cookieJar.has("lian_session"), "login should set lian_session cookie");
  console.log("✓ /api/auth/login");

  const me = await request("/api/auth/me");
  assert.ok(me.data.user, "auth/me should return user after login");
  console.log("✓ /api/auth/me");

  if (allowMutations) {
    const logout = await request("/api/auth/logout", { method: "POST" });
    assert.equal(logout.data.ok, true, "logout should return ok=true");
    console.log("✓ /api/auth/logout");
  } else {
    console.log("ℹ ONLINE_E2E_ALLOW_MUTATIONS is not true; skipping logout mutation");
  }
}

async function runAiPreviewSmoke() {
  if (!testAiPreview) {
    console.log("\nℹ ONLINE_E2E_TEST_AI_PREVIEW is not true; skipping AI preview check");
    return;
  }

  logStep("AI preview check");
  const preview = await request("/api/ai/post-preview", {
    method: "POST",
    body: JSON.stringify({
      template: "campus_moment",
      userText: "线上 E2E 冒烟测试：请生成一条可编辑草稿。",
      locationHint: "测试地点",
      visibilityHint: "public"
    })
  });
  assert.equal(preview.data.ok, true, "AI preview should return ok=true");
  assert.ok(preview.data.draft?.title, "AI preview should return draft.title");
  assert.ok(preview.data.draft?.body, "AI preview should return draft.body");
  console.log(`✓ /api/ai/post-preview mode=${preview.data.mode || "unknown"}`);
}

async function main() {
  logEnvSummary();
  await runReadOnlySmoke();
  await runAdminSmoke();
  await runLoginSmoke();
  await runAiPreviewSmoke();
  console.log("\n✅ Online E2E smoke passed");
}

main().catch((error) => {
  console.error("\n❌ Online E2E smoke failed");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
