import test from "node:test";
import assert from "node:assert/strict";

import {
  parseEnvUrl,
  getRuntimeConfig,
  getApiBase,
  getImageProxyBase,
  buildApiUrl,
} from "../../src/config/runtime-config.ts";

// ---------------------------------------------------------------------------
// parseEnvUrl — build/serve-time env validation
// ---------------------------------------------------------------------------

test("parseEnvUrl returns empty for undefined or empty input", () => {
  assert.equal(parseEnvUrl(undefined, "TEST", { dev: false }), "");
  assert.equal(parseEnvUrl("", "TEST", { dev: true }), "");
  assert.equal(parseEnvUrl("  ", "TEST", { dev: false }), "");
});

test("parseEnvUrl strips trailing slashes", () => {
  assert.equal(
    parseEnvUrl("https://api.example.com/", "TEST", { dev: false }),
    "https://api.example.com",
  );
  assert.equal(
    parseEnvUrl("https://api.example.com///", "TEST", { dev: false }),
    "https://api.example.com",
  );
});

test("parseEnvUrl accepts https origin in production", () => {
  assert.equal(
    parseEnvUrl("https://api.example.com", "TEST", { dev: false }),
    "https://api.example.com",
  );
});

test("parseEnvUrl accepts http origin in dev", () => {
  assert.equal(
    parseEnvUrl("http://localhost:4200", "TEST", { dev: true }),
    "http://localhost:4200",
  );
});

test("parseEnvUrl rejects non-absolute values", () => {
  assert.throws(
    () => parseEnvUrl("not-a-url", "MY_VAR", { dev: false }),
    /MY_VAR.*absolute URL/,
  );
  assert.throws(
    () => parseEnvUrl("/relative/path", "MY_VAR", { dev: true }),
    /MY_VAR.*absolute URL/,
  );
});

test("parseEnvUrl rejects localhost origins outside dev", () => {
  assert.throws(
    () => parseEnvUrl("http://localhost:4200", "MY_VAR", { dev: false }),
    /MY_VAR.*localhost/,
  );
  assert.throws(
    () => parseEnvUrl("http://127.0.0.1:4200", "MY_VAR", { dev: false }),
    /MY_VAR.*localhost/,
  );
  assert.throws(
    () => parseEnvUrl("http://[::1]:4200", "MY_VAR", { dev: false }),
    /MY_VAR.*localhost/,
  );
});

// ---------------------------------------------------------------------------
// getRuntimeConfig / accessor — injection order and runtime validation
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { window?: Record<string, unknown> };

function setWindow(config: Record<string, string | undefined>) {
  g.window = { ...config };
}

function clearWindow() {
  delete g.window;
}

test("getApiBase returns empty string when window.LIAN_API_BASE_URL is unset (same-origin policy)", () => {
  setWindow({});
  assert.equal(getApiBase(), "");
  clearWindow();
});

test("getApiBase returns the injected absolute URL", () => {
  setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
  assert.equal(getApiBase(), "https://api.example.com");
  clearWindow();
});

test("accessor reads fresh value on each call — injection order is not frozen", () => {
  setWindow({ LIAN_API_BASE_URL: "https://first.example.com" });
  assert.equal(getApiBase(), "https://first.example.com");

  // Simulate late injection (script tag runs after module loaded)
  (g.window as Record<string, string>).LIAN_API_BASE_URL = "https://second.example.com";
  assert.equal(getApiBase(), "https://second.example.com");
  clearWindow();
});

test("getRuntimeConfig returns both values", () => {
  setWindow({
    LIAN_API_BASE_URL: "https://api.example.com",
    LIAN_IMAGE_PROXY_BASE_URL: "https://img.example.com",
  });
  const config = getRuntimeConfig();
  assert.equal(config.apiBaseUrl, "https://api.example.com");
  assert.equal(config.imageProxyBaseUrl, "https://img.example.com");
  clearWindow();
});

test("getRuntimeConfig allows empty apiBaseUrl (same-origin)", () => {
  setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "https://img.example.com" });
  const config = getRuntimeConfig();
  assert.equal(config.apiBaseUrl, "");
  clearWindow();
});

test("buildApiUrl prefixes root-relative API paths with the injected base", () => {
  setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
  assert.equal(buildApiUrl("/api/me"), "https://api.example.com/api/me");
  clearWindow();
});

test("buildApiUrl keeps same-origin root-relative paths when api base is empty", () => {
  setWindow({});
  assert.equal(buildApiUrl("/api/me"), "/api/me");
  clearWindow();
});

test("buildApiUrl passes through absolute and non-root-relative paths", () => {
  setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
  assert.equal(buildApiUrl("https://cdn.example.com/image.jpg"), "https://cdn.example.com/image.jpg");
  assert.equal(buildApiUrl("api/me"), "api/me");
  clearWindow();
});

// ---------------------------------------------------------------------------
// Non-dev rejection: malformed and missing values
// ---------------------------------------------------------------------------

test("getApiBase rejects localhost origin outside dev", () => {
  setWindow({ LIAN_API_BASE_URL: "http://localhost:4200" });
  assert.throws(() => getApiBase(), /localhost/);
  clearWindow();
});

test("getApiBase rejects non-absolute URL outside dev", () => {
  setWindow({ LIAN_API_BASE_URL: "not-a-url" });
  assert.throws(() => getApiBase(), /not an absolute URL/);
  clearWindow();
});

test("getImageProxyBase throws when empty and not in dev context", () => {
  setWindow({});
  // In the test runner import.meta.url is a file:// URL, so isDevContext() is false.
  assert.throws(() => getImageProxyBase(), /LIAN_IMAGE_PROXY_BASE_URL/);
  clearWindow();
});

test("getImageProxyBase rejects non-absolute value outside dev", () => {
  setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "/images" });
  assert.throws(() => getImageProxyBase(), /not an absolute URL/);
  clearWindow();
});

test("getImageProxyBase rejects localhost origin outside dev", () => {
  setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "http://localhost:4201" });
  assert.throws(() => getImageProxyBase(), /localhost/);
  clearWindow();
});

test("getImageProxyBase accepts a valid https origin", () => {
  setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "https://img.cdn.example.com" });
  assert.equal(getImageProxyBase(), "https://img.cdn.example.com");
  clearWindow();
});

// ---------------------------------------------------------------------------
// SSR / non-browser safety
// ---------------------------------------------------------------------------

test("accessor returns empty strings when window is undefined (SSR)", () => {
  clearWindow();
  // getApiBase should not throw — same-origin default
  assert.equal(getApiBase(), "");
  assert.equal(buildApiUrl("/api/me"), "/api/me");
  // getImageProxyBase throws because empty is rejected outside dev
  assert.throws(() => getImageProxyBase(), /LIAN_IMAGE_PROXY_BASE_URL/);
});
