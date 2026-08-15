/**
 * Offline fixture transport guarantees.
 *
 * These are the invariants the whole "no backend, no network" workflow rests
 * on, so they are asserted directly rather than left to manual observation:
 *   1. no request ever reaches the real `fetch`;
 *   2. an uncovered `/api/**` route fails closed with 501, never a silent 200;
 *   3. cross-origin traffic is blocked locally;
 *   4. same-origin non-API traffic still passes through to the dev server;
 *   5. the runtime refuses to arm itself outside DEV.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureJson } from "../../src/platform/ui-fixtures/contract";
import { registerAllFixtures, resetFixtureRegistration } from "../../src/platform/ui-fixtures/data";
import { clearFixtureRoutes, registerFixtureFamily } from "../../src/platform/ui-fixtures/registry";
import { resetFixtureState, setFixtureState } from "../../src/platform/ui-fixtures/state";
import {
  installOfflineFixtureTransport,
  isOfflineFixtureTransportInstalled,
  uninstallOfflineFixtureTransport,
} from "../../src/platform/ui-fixtures/transport";

/** Stands in for the real network: if this is ever called, isolation failed. */
const realFetch = vi.fn(async () => new Response("REAL NETWORK", { status: 200 }));

beforeEach(() => {
  vi.stubEnv("VITE_UI_FIXTURES", "true");
  vi.stubEnv("VITE_UI_FIXTURE_MODE", "offline");
  realFetch.mockClear();
  clearFixtureRoutes();
  resetFixtureState();
  vi.stubGlobal("fetch", realFetch);
  installOfflineFixtureTransport();
});

afterEach(() => {
  uninstallOfflineFixtureTransport();
  clearFixtureRoutes();
  resetFixtureState();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("offline fixture transport", () => {
  it("installs over global fetch and restores it on uninstall", () => {
    expect(isOfflineFixtureTransportInstalled()).toBe(true);
    expect(globalThis.fetch).not.toBe(realFetch);

    uninstallOfflineFixtureTransport();

    expect(isOfflineFixtureTransportInstalled()).toBe(false);
    expect(globalThis.fetch).toBe(realFetch);
  });

  it("serves a registered /api route from fixtures without touching the network", async () => {
    registerFixtureFamily("test", [["GET", "/api/test/thing", () => fixtureJson({ ok: true })]]);

    const response = await fetch("/api/test/thing");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("fails closed with 501 on an uncovered /api route instead of an empty 200", async () => {
    const response = await fetch("/api/not/covered");

    expect(response.status).toBe(501);
    // Flat `{ error, code }` — the exact shape `extractApiError()` reads.
    const body = (await response.json()) as { error?: string; code?: string };
    expect(body.code).toBe("UNMAPPED_FIXTURE_REQUEST");
    // The decisive part: a coverage hole must never become a real request.
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("blocks cross-origin requests locally", async () => {
    const response = await fetch("https://example.com/tracker.png");

    expect(response.ok).toBe(false);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("passes same-origin non-API requests through to the dev server", async () => {
    await fetch("/assets/icon.svg");

    // Vite modules, HMR and static assets must keep working normally.
    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it("routes every registered family without unmapped holes", async () => {
    resetFixtureRegistration();
    registerAllFixtures();

    // GET endpoints only — `/api/errands/orders` is POST-only in the real API,
    // so a GET there is correctly expected to fail closed.
    const probes = [
      "/api/auth/me",
      "/api/feed?tab=recommend",
      "/api/me/stats",
      "/api/commerce/stores",
      "/api/errands/orders/mine",
    ];

    for (const probe of probes) {
      const response = await fetch(probe);
      expect(response.status, `${probe} should be covered`).not.toBe(501);
    }
    expect(realFetch).not.toHaveBeenCalled();
  });
});

describe("failure scenarios", () => {
  beforeEach(() => {
    registerFixtureFamily("test", [["GET", "/api/test/thing", () => fixtureJson({ ok: true })]]);
  });

  it("returns the mapped HTTP status for each transport scenario", async () => {
    const cases = [
      ["error", 500],
      ["not-found", 404],
      ["forbidden", 403],
      ["unauthorized", 401],
      ["rate-limited", 429],
    ] as const;

    for (const [scenario, status] of cases) {
      setFixtureState({ scenario });
      const response = await fetch("/api/test/thing");
      expect(response.status, `scenario ${scenario}`).toBe(status);
    }
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("never resolves under the loading scenario so skeletons stay visible", async () => {
    setFixtureState({ scenario: "loading" });

    const settled = vi.fn();
    void fetch("/api/test/thing").then(settled, settled);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(settled).not.toHaveBeenCalled();
  });

  it("rejects with an AbortError when the caller aborts", async () => {
    setFixtureState({ scenario: "loading" });
    const controller = new AbortController();

    const pending = fetch("/api/test/thing", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("production safety", () => {
  it("refuses to install when the fixture flag is off", () => {
    uninstallOfflineFixtureTransport();
    vi.stubEnv("VITE_UI_FIXTURES", "false");

    expect(installOfflineFixtureTransport()).toBe(false);
    expect(isOfflineFixtureTransportInstalled()).toBe(false);
    expect(globalThis.fetch).toBe(realFetch);
  });

  it("refuses to install when the mode is not offline", () => {
    uninstallOfflineFixtureTransport();
    vi.stubEnv("VITE_UI_FIXTURE_MODE", "render");

    expect(installOfflineFixtureTransport()).toBe(false);
    expect(globalThis.fetch).toBe(realFetch);
  });
});
