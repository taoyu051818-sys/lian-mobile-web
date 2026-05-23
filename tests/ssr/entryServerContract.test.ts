import { describe, it, expect } from "vitest";
import { render } from "../../src/entry-server";

/**
 * Phase 1.1a contract test for the SSR entry point.
 *
 * The shape `{ html, head }` is the lever that downstream phases (1.2 route
 * resolution, 1.3 head injection, 1.5 /u/:username) will pull on. Locking the
 * function signature now means a later change cannot silently break the
 * Caddy/mw HTML transform contract — the test fails before it ships.
 */
describe("entry-server", () => {
  it("exposes a render function", () => {
    expect(typeof render).toBe("function");
  });

  it("returns html + head shape", async () => {
    const result = await render("/");
    expect(result).toHaveProperty("html");
    expect(result).toHaveProperty("head");
    expect(typeof result.html).toBe("string");
    expect(typeof result.head).toBe("string");
  });
});
