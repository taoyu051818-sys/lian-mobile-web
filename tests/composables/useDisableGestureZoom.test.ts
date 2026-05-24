import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for `installDisableGestureZoom`.
 *
 * Contract:
 *   1. Registers exactly one listener each for `gesturestart`,
 *      `gesturechange`, `gestureend` on `document` with `{ passive: false }`.
 *   2. Idempotent — calling twice does not double-register.
 *   3. The registered handler calls `event.preventDefault()` when invoked.
 *   4. SSR-safe — when `document` is undefined, the function returns
 *      without throwing.
 *
 * Vitest runs under the Node environment for this repo (no jsdom), so we
 * stub the `document` global with a fake addEventListener spy.
 */

type FakeListener = (event: Event) => void;
interface FakeAddCall {
  type: string;
  handler: FakeListener;
  options: AddEventListenerOptions | boolean | undefined;
}

function installFakeDocument(): {
  calls: FakeAddCall[];
  restore: () => void;
} {
  const calls: FakeAddCall[] = [];
  const fake = {
    addEventListener(
      type: string,
      handler: FakeListener,
      options?: AddEventListenerOptions | boolean,
    ) {
      calls.push({ type, handler, options });
    },
    removeEventListener() {
      // unused in these tests
    },
  };

  const hadDocument = "document" in globalThis;
  const savedDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = fake;

  return {
    calls,
    restore() {
      if (hadDocument) {
        (globalThis as { document?: unknown }).document = savedDocument;
      } else {
        delete (globalThis as { document?: unknown }).document;
      }
    },
  };
}

describe("installDisableGestureZoom", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("registers gesturestart, gesturechange, and gestureend listeners on document", async () => {
    const fake = installFakeDocument();
    try {
      const { installDisableGestureZoom } =
        await import("../../src/composables/useDisableGestureZoom");
      installDisableGestureZoom();

      const types = fake.calls.map((c) => c.type);
      expect(types).toContain("gesturestart");
      expect(types).toContain("gesturechange");
      expect(types).toContain("gestureend");
      expect(fake.calls).toHaveLength(3);

      for (const call of fake.calls) {
        expect(call.options).toEqual({ passive: false });
      }
    } finally {
      fake.restore();
    }
  });

  it("is idempotent: calling installDisableGestureZoom twice does not double-register", async () => {
    const fake = installFakeDocument();
    try {
      const { installDisableGestureZoom } =
        await import("../../src/composables/useDisableGestureZoom");
      installDisableGestureZoom();
      installDisableGestureZoom();
      expect(fake.calls).toHaveLength(3);
    } finally {
      fake.restore();
    }
  });

  it("registered handler calls preventDefault when invoked", async () => {
    const fake = installFakeDocument();
    try {
      const { installDisableGestureZoom } =
        await import("../../src/composables/useDisableGestureZoom");
      installDisableGestureZoom();

      const handler = fake.calls.find((c) => c.type === "gesturestart")?.handler;
      expect(typeof handler).toBe("function");

      const preventDefault = vi.fn();
      const fakeEvent = { preventDefault } as unknown as Event;
      handler!(fakeEvent);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    } finally {
      fake.restore();
    }
  });

  it("is SSR-safe: returns without throwing when document is undefined", async () => {
    const hadDocument = "document" in globalThis;
    const savedDocument = (globalThis as { document?: unknown }).document;
    delete (globalThis as { document?: unknown }).document;
    try {
      const { installDisableGestureZoom } =
        await import("../../src/composables/useDisableGestureZoom");
      expect(() => installDisableGestureZoom()).not.toThrow();
    } finally {
      if (hadDocument) {
        (globalThis as { document?: unknown }).document = savedDocument;
      }
    }
  });
});
