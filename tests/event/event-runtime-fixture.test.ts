/**
 * Unit tests for the event-runtime fixture helper (issue #707).
 *
 * The helper lives under tests/e2e/fixtures/ and is consumed by the
 * Playwright suite, but the env-var reader (`getSeededEventId` /
 * `isSeededEventIdConfigured`) is pure Node and worth pinning here so a
 * regression — empty string treated as "configured", missing var crashing
 * dev mode — fails CI immediately without spinning up Playwright.
 *
 * The fetch path (`fetchEventRuntimeFixture`) needs a Playwright
 * `request.newContext` and is exercised by the e2e spec instead.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getSeededEventId,
  isSeededEventIdConfigured,
} from "../../tests/e2e/fixtures/event-runtime";

describe("event-runtime fixture: getSeededEventId", () => {
  const original = process.env.LIAN_E2E_SEEDED_EVENT_ID;

  beforeEach(() => {
    delete process.env.LIAN_E2E_SEEDED_EVENT_ID;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LIAN_E2E_SEEDED_EVENT_ID;
    } else {
      process.env.LIAN_E2E_SEEDED_EVENT_ID = original;
    }
  });

  it("falls back to the well-known default '156' when the env var is unset", () => {
    expect(getSeededEventId()).toBe("156");
    expect(isSeededEventIdConfigured()).toBe(false);
  });

  it("reports unconfigured when the env var is an empty string or whitespace", () => {
    process.env.LIAN_E2E_SEEDED_EVENT_ID = "";
    expect(isSeededEventIdConfigured()).toBe(false);
    expect(getSeededEventId()).toBe("156");

    process.env.LIAN_E2E_SEEDED_EVENT_ID = "   ";
    expect(isSeededEventIdConfigured()).toBe(false);
    expect(getSeededEventId()).toBe("156");
  });

  it("returns the trimmed env value when a tid is explicitly set", () => {
    process.env.LIAN_E2E_SEEDED_EVENT_ID = "  156  ";
    expect(isSeededEventIdConfigured()).toBe(true);
    expect(getSeededEventId()).toBe("156");

    // Forward-compat: helper does not lock to 156 — if the backend rotates
    // the seeded tid, the env var is the source of truth.
    process.env.LIAN_E2E_SEEDED_EVENT_ID = "999";
    expect(isSeededEventIdConfigured()).toBe(true);
    expect(getSeededEventId()).toBe("999");
  });
});
