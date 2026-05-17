import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("Phase 2: map viewport policy is wired into Leaflet (PRD V0.1 §7.2.3)", () => {
  const canvas = readRepoFile("../../src/features/map/MapCanvas.vue");

  it("MapCanvas accepts a viewportPolicy prop", () => {
    expect(canvas).toMatch(/viewportPolicy\?:\s*MapViewportPolicy/);
  });

  it("MapCanvas no longer hardcodes minZoom: 15 / maxZoom: 17", () => {
    // The policy-driven version reads min/max off `policy.minZoom` etc.
    expect(canvas).toMatch(/minZoom:\s*policy\.minZoom/);
    expect(canvas).toMatch(/maxZoom:\s*policy\.maxZoom/);
  });

  it("MapCanvas falls back to DEFAULT_MAP_VIEWPORT_POLICY when prop omitted", () => {
    expect(canvas).toMatch(/DEFAULT_MAP_VIEWPORT_POLICY/);
    expect(canvas).toMatch(/props\.viewportPolicy\s*\?\?\s*DEFAULT_MAP_VIEWPORT_POLICY/);
  });

  it("MapLeafletView passes the default policy to MapCanvas", () => {
    const view = readRepoFile("../../src/features/map/MapLeafletView.vue");
    expect(view).toMatch(/import\s*\{\s*DEFAULT_MAP_VIEWPORT_POLICY\s*\}/);
    expect(view).toMatch(/:viewport-policy="DEFAULT_MAP_VIEWPORT_POLICY"/);
  });
});

describe("Phase 0/1: PublishMetaControls honors audience gating", () => {
  const meta = readRepoFile("../../src/features/publish/PublishMetaControls.vue");

  it("accepts isVisibilityAllowed and visibilityDisabledReason as props", () => {
    expect(meta).toMatch(/isVisibilityAllowed\?:\s*\(value:\s*PublishVisibility\)\s*=>\s*boolean/);
    expect(meta).toMatch(
      /visibilityDisabledReason\?:\s*\(value:\s*PublishVisibility\)\s*=>\s*string/,
    );
  });

  it("disables the option button and short-circuits emit when not allowed", () => {
    expect(meta).toMatch(/:disabled="!isAllowed\(option\.value\)"/);
    expect(meta).toMatch(/if \(!isAllowed\(value\)\) return/);
  });

  it("renders the disabled reason as inline UI", () => {
    expect(meta).toMatch(/publish-meta__visibility-reason/);
  });
});
