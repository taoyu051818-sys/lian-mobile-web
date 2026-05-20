import { describe, expect, it } from "vitest";

import {
  parseEnvUrl,
  getRuntimeConfig,
  getApiBase,
  getImageProxyBase,
  buildApiUrl,
  getReleaseDiagnostics,
} from "../../src/config/runtime-config.ts";

describe("runtime config", () => {
  // ---------------------------------------------------------------------------
  // parseEnvUrl — build/serve-time env validation
  // ---------------------------------------------------------------------------

  it("parseEnvUrl returns empty for undefined or empty input", () => {
    expect(parseEnvUrl(undefined, "TEST", { dev: false })).toBe("");
    expect(parseEnvUrl("", "TEST", { dev: true })).toBe("");
    expect(parseEnvUrl("  ", "TEST", { dev: false })).toBe("");
  });

  it("parseEnvUrl strips trailing slashes", () => {
    expect(parseEnvUrl("https://api.example.com/", "TEST", { dev: false })).toBe(
      "https://api.example.com",
    );
    expect(parseEnvUrl("https://api.example.com///", "TEST", { dev: false })).toBe(
      "https://api.example.com",
    );
  });

  it("parseEnvUrl accepts https origin in production", () => {
    expect(parseEnvUrl("https://api.example.com", "TEST", { dev: false })).toBe(
      "https://api.example.com",
    );
  });

  it("parseEnvUrl accepts http origin in dev", () => {
    expect(parseEnvUrl("http://localhost:4200", "TEST", { dev: true })).toBe(
      "http://localhost:4200",
    );
  });

  it("parseEnvUrl rejects non-absolute values", () => {
    expect(() => parseEnvUrl("not-a-url", "MY_VAR", { dev: false })).toThrow(
      /MY_VAR.*absolute URL/,
    );
    expect(() => parseEnvUrl("/relative/path", "MY_VAR", { dev: true })).toThrow(
      /MY_VAR.*absolute URL/,
    );
  });

  it("parseEnvUrl rejects localhost origins outside dev", () => {
    expect(() => parseEnvUrl("http://localhost:4200", "MY_VAR", { dev: false })).toThrow(
      /MY_VAR.*localhost/,
    );
    expect(() => parseEnvUrl("http://127.0.0.1:4200", "MY_VAR", { dev: false })).toThrow(
      /MY_VAR.*localhost/,
    );
    expect(() => parseEnvUrl("http://[::1]:4200", "MY_VAR", { dev: false })).toThrow(
      /MY_VAR.*localhost/,
    );
  });

  // ---------------------------------------------------------------------------
  // getRuntimeConfig / accessor — injection order and runtime validation
  // ---------------------------------------------------------------------------

  const g = globalThis as unknown as { window?: Record<string, unknown> };

  function setWindow(config: Record<string, string | boolean | undefined>) {
    g.window = { ...config };
  }

  function clearWindow() {
    delete g.window;
  }

  it("getApiBase returns empty string when window.LIAN_API_BASE_URL is unset (same-origin policy)", () => {
    setWindow({});
    expect(getApiBase()).toBe("");
    clearWindow();
  });

  it("getApiBase returns the injected absolute URL", () => {
    setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
    expect(getApiBase()).toBe("https://api.example.com");
    clearWindow();
  });

  it("accessor reads fresh value on each call — injection order is not frozen", () => {
    setWindow({ LIAN_API_BASE_URL: "https://first.example.com" });
    expect(getApiBase()).toBe("https://first.example.com");

    // Simulate late injection (script tag runs after module loaded)
    (g.window as Record<string, string>).LIAN_API_BASE_URL = "https://second.example.com";
    expect(getApiBase()).toBe("https://second.example.com");
    clearWindow();
  });

  it("getRuntimeConfig returns both values", () => {
    setWindow({
      LIAN_API_BASE_URL: "https://api.example.com",
      LIAN_IMAGE_PROXY_BASE_URL: "https://img.example.com",
    });
    const config = getRuntimeConfig();
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.imageProxyBaseUrl).toBe("https://img.example.com");
    clearWindow();
  });

  it("getRuntimeConfig allows empty apiBaseUrl (same-origin)", () => {
    setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "https://img.example.com" });
    const config = getRuntimeConfig();
    expect(config.apiBaseUrl).toBe("");
    clearWindow();
  });

  it("buildApiUrl prefixes root-relative API paths with the injected base", () => {
    setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
    expect(buildApiUrl("/api/me")).toBe("https://api.example.com/api/me");
    clearWindow();
  });

  it("buildApiUrl keeps same-origin root-relative paths when api base is empty", () => {
    setWindow({});
    expect(buildApiUrl("/api/me")).toBe("/api/me");
    clearWindow();
  });

  it("buildApiUrl passes through absolute and non-root-relative paths", () => {
    setWindow({ LIAN_API_BASE_URL: "https://api.example.com" });
    expect(buildApiUrl("https://cdn.example.com/image.jpg")).toBe(
      "https://cdn.example.com/image.jpg",
    );
    expect(buildApiUrl("api/me")).toBe("api/me");
    clearWindow();
  });

  it("getReleaseDiagnostics returns a safe release/runtime identity snapshot", () => {
    setWindow({
      LIAN_RELEASE_ID: "release-2026-05-20",
      LIAN_BUILD_SHA: "940828eaa023710917ef3a3706d24862952d3dd0",
      LIAN_BUILD_TIME: "2026-05-20T08:00:00Z",
      LIAN_RUNTIME_LANE: "prod-cn",
      LIAN_API_BASE_URL: "https://api.example.com",
      LIAN_IMAGE_PROXY_BASE_URL: "https://img.example.com",
    });

    const snapshot = getReleaseDiagnostics();
    expect(snapshot).toMatchObject({
      releaseId: "release-2026-05-20",
      buildSha: "940828eaa023710917ef3a3706d24862952d3dd0",
      buildTime: "2026-05-20T08:00:00Z",
      runtimeLane: "prod-cn",
      apiBaseUrl: "https://api.example.com",
      imageProxyBaseUrl: "https://img.example.com",
      runtimeConfigStatus: "ok",
      dev: false,
    });
    expect(snapshot.mode.length).toBeGreaterThan(0);
    clearWindow();
  });

  it("getReleaseDiagnostics degrades safely when runtime config is invalid", () => {
    setWindow({
      LIAN_RELEASE_ID: "release-invalid",
      LIAN_BUILD_SHA: "deadbeefdeadbeef",
      LIAN_BUILD_TIME: "2026-05-20T08:05:00Z",
      LIAN_RUNTIME_LANE: "staging",
      LIAN_API_BASE_URL: "https://api.example.com",
    });

    const snapshot = getReleaseDiagnostics();
    expect(snapshot.releaseId).toBe("release-invalid");
    expect(snapshot.runtimeConfigStatus).toBe("invalid");
    expect(snapshot.apiBaseUrl).toBe("");
    expect(snapshot.imageProxyBaseUrl).toBe("");
    clearWindow();
  });

  // ---------------------------------------------------------------------------
  // Non-dev rejection: malformed and missing values
  // ---------------------------------------------------------------------------

  it("getApiBase rejects localhost origin outside dev", () => {
    setWindow({ LIAN_API_BASE_URL: "http://localhost:4200" });
    expect(() => getApiBase()).toThrow(/localhost/);
    clearWindow();
  });

  it("getApiBase rejects non-absolute URL outside dev", () => {
    setWindow({ LIAN_API_BASE_URL: "not-a-url" });
    expect(() => getApiBase()).toThrow(/not an absolute URL/);
    clearWindow();
  });

  it("getImageProxyBase throws when empty and not in dev context", () => {
    setWindow({});
    // In the test runner import.meta.url is a file:// URL, so isDevContext() is false.
    expect(() => getImageProxyBase()).toThrow(/LIAN_IMAGE_PROXY_BASE_URL/);
    clearWindow();
  });

  it("getImageProxyBase rejects non-absolute value outside dev", () => {
    setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "/images" });
    expect(() => getImageProxyBase()).toThrow(/not an absolute URL/);
    clearWindow();
  });

  it("getImageProxyBase rejects localhost origin outside dev", () => {
    setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "http://localhost:4201" });
    expect(() => getImageProxyBase()).toThrow(/localhost/);
    clearWindow();
  });

  it("getImageProxyBase accepts a valid https origin", () => {
    setWindow({ LIAN_IMAGE_PROXY_BASE_URL: "https://img.cdn.example.com" });
    expect(getImageProxyBase()).toBe("https://img.cdn.example.com");
    clearWindow();
  });

  // ---------------------------------------------------------------------------
  // SSR / non-browser safety
  // ---------------------------------------------------------------------------

  it("accessor returns empty strings when window is undefined (SSR)", () => {
    clearWindow();
    // getApiBase should not throw — same-origin default
    expect(getApiBase()).toBe("");
    expect(buildApiUrl("/api/me")).toBe("/api/me");
    // getImageProxyBase throws because empty is rejected outside dev
    expect(() => getImageProxyBase()).toThrow(/LIAN_IMAGE_PROXY_BASE_URL/);
  });
}
