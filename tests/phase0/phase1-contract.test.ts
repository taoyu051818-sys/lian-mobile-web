import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { POST_TYPES, isKnownPostType, normalizePostType } from "../../src/types/post";
import { DEFAULT_AUDIENCE, isDefaultAudience, normalizeAudience } from "../../src/types/audience";
import {
  DEFAULT_MAP_VIEWPORT_POLICY,
  clampZoom,
  isWithinBufferedBounds,
  isWithinCampusBounds,
} from "../../src/types/map-policy";
import { resolveAppLocale } from "../../src/locales/resolveLocale";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("Phase 1: unified PostType vocabulary (PRD V0.1 §6.1)", () => {
  it("ships exactly the eight post types the PRD lists", () => {
    expect([...POST_TYPES].sort()).toEqual(
      ["club", "event", "help", "image", "merchant", "place", "text", "trade"].sort(),
    );
  });

  it("isKnownPostType is strict", () => {
    expect(isKnownPostType("event")).toBe(true);
    expect(isKnownPostType("activity")).toBe(false); // activity is a card label only
    expect(isKnownPostType(undefined)).toBe(false);
    expect(isKnownPostType(42)).toBe(false);
  });

  it("normalizePostType falls back to image when there is a cover, text otherwise", () => {
    expect(normalizePostType(undefined, true)).toBe("image");
    expect(normalizePostType(undefined, false)).toBe("text");
    expect(normalizePostType("event", false)).toBe("event");
  });

  it("BasePostShape carries an Audience field", () => {
    const source = readRepoFile("../../src/types/post.ts");
    expect(source).toMatch(/audience:\s*Audience/);
  });
});

describe("Phase 1: like/vote unified interaction API", () => {
  it("api/interaction.ts dispatches like vs vote on different routes", () => {
    const source = readRepoFile("../../src/api/interaction.ts");
    expect(source).toMatch(/\/api\/posts\/\$\{tid\}\/vote/);
    expect(source).toMatch(/\/api\/posts\/\$\{tid\}\/like/);
    expect(source).toMatch(/togglePostInteraction/);
  });

  it("InteractionToggleResult is shared across like/vote", () => {
    const source = readRepoFile("../../src/types/post-extensions.ts");
    expect(source).toMatch(/export interface InteractionToggleResult/);
    expect(source).toMatch(/kind:\s*InteractionKind/);
    expect(source).toMatch(/active:\s*boolean/);
  });
});

describe("Phase 2: map viewport policy", () => {
  it("default policy clamps zoom to [12, 19]", () => {
    expect(clampZoom(5, DEFAULT_MAP_VIEWPORT_POLICY)).toBe(12);
    expect(clampZoom(99, DEFAULT_MAP_VIEWPORT_POLICY)).toBe(19);
    expect(clampZoom(15, DEFAULT_MAP_VIEWPORT_POLICY)).toBe(15);
  });

  it("isWithinCampusBounds rejects points outside the bounds", () => {
    const tight = {
      minZoom: 14,
      maxZoom: 18,
      campusBounds: { south: 30, west: 120, north: 31, east: 121 },
      outsideBufferMeters: 0,
    };
    expect(isWithinCampusBounds({ lat: 30.5, lng: 120.5 }, tight)).toBe(true);
    expect(isWithinCampusBounds({ lat: 35, lng: 120.5 }, tight)).toBe(false);
  });

  it("isWithinBufferedBounds allows a meter buffer", () => {
    const tight = {
      minZoom: 14,
      maxZoom: 18,
      // ~110 m latitude buffer when bounds are 1° tall
      campusBounds: { south: 30, west: 120, north: 30.001, east: 120.001 },
      outsideBufferMeters: 200,
    };
    // Just outside campusBounds but inside the 200m buffer
    expect(isWithinBufferedBounds({ lat: 30.0015, lng: 120.0005 }, tight)).toBe(true);
    // Far outside
    expect(isWithinBufferedBounds({ lat: 31, lng: 120.0005 }, tight)).toBe(false);
  });
});

describe("Phase 4/5: event/help/errand contracts", () => {
  it("post-extensions.ts declares the eight extension shapes", () => {
    const source = readRepoFile("../../src/types/post-extensions.ts");
    expect(source).toMatch(/export interface EventPostExtension/);
    expect(source).toMatch(/export interface HelpPostExtension/);
    expect(source).toMatch(/export interface MerchantPostExtension/);
    expect(source).toMatch(/export interface ErrandOrder/);
    expect(source).toMatch(/HelpStatus/);
    expect(source).toMatch(/ErrandStatus/);
    expect(source).toMatch(/InteractionKind/);
  });

  it("api/events.ts wires PRD §11.2/§11.3/§11.4 routes", () => {
    const source = readRepoFile("../../src/api/events.ts");
    expect(source).toMatch(/\/api\/events/);
    expect(source).toMatch(/\/cancel-join/);
    expect(source).toMatch(/\/api\/help\//);
    expect(source).toMatch(/\/link-event/);
    expect(source).toMatch(/\/api\/errands\/orders/);
    expect(source).toMatch(/\/api\/errands\/runner\/location/);
  });

  it("ErrandOrder mode/status enums match the PRD vocabulary", () => {
    const source = readRepoFile("../../src/types/post-extensions.ts");
    expect(source).toMatch(/"dedicated"\s*\|\s*"meal_peak_batch"/);
    expect(source).toMatch(/"created"/);
    expect(source).toMatch(/"paid_locked"/);
    expect(source).toMatch(/"refunded"/);
    expect(source).toMatch(/"disputed"/);
  });
});

describe("Phase 0/1 sanity: helpers behave", () => {
  it("DEFAULT_AUDIENCE and normalizeAudience round-trip the public default", () => {
    expect(isDefaultAudience(DEFAULT_AUDIENCE)).toBe(true);
    const round = normalizeAudience({});
    expect(isDefaultAudience(round)).toBe(true);
    expect(round).toMatchObject({
      visibility: "public",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false,
    });
  });

  it("normalizeAudience coerces unknown visibility to public", () => {
    const a = normalizeAudience({ visibility: "garbage", linkOnly: 1, schoolIds: ["s1", " "] });
    expect(a.visibility).toBe("public");
    expect(a.linkOnly).toBe(true);
    expect(a.schoolIds).toEqual(["s1"]);
  });

  it("resolveAppLocale prioritizes stored over navigator", () => {
    expect(
      resolveAppLocale({
        storedLocale: "zh-CN",
        navigatorLanguages: ["en-US"],
        navigatorLanguage: "en-US",
      }),
    ).toBe("zh-CN");
    expect(resolveAppLocale({ navigatorLanguages: ["sw-KE", "tr-TR"] })).toBe("en");
    expect(resolveAppLocale({ navigatorLanguages: ["zh-Hans-CN"] })).toBe("zh-CN");
    expect(resolveAppLocale({})).toBe("en");
  });
});

describe("Phase 1: post-extensions module exists", () => {
  it("file is on disk", () => {
    const path = fileURLToPath(new URL("../../src/types/post-extensions.ts", import.meta.url));
    expect(existsSync(path)).toBe(true);
  });
});
