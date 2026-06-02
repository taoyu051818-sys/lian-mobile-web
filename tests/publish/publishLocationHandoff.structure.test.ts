import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractHandoffKinds(source: string) {
  return new Set(Array.from(source.matchAll(/kind: "([^"]+)";/g), ([, kind]) => kind));
}

describe("publish location handoff structure", () => {
  const handoff = readRepoFile("src/features/publish/usePublishLocationHandoff.ts");
  const mapPicker = readRepoFile("src/features/map/useMapPickerMode.ts");
  const publishView = readRepoFile("src/features/publish/PublishView.vue");

  it("keeps map picker and current-location writes on the shared handoff envelope", () => {
    expect(handoff).toContain('const STORAGE_KEY = "lian:publish:pendingLocation"');
    expect(handoff).toMatch(
      /export type PublishLocationHandoff =\s*\| \{[\s\S]*kind: "place";[\s\S]*placeId: string;[\s\S]*lat: number;[\s\S]*lng: number;[\s\S]*\| \{[\s\S]*kind: "coords";[\s\S]*lat: number;[\s\S]*lng: number;/,
    );

    expect(mapPicker).toMatch(/setPendingPublishLocation, type PublishLocationHandoff/);
    expect(mapPicker).toMatch(/function buildHandoff\(\): PublishLocationHandoff \| null/);
    expect(mapPicker).toMatch(/setPendingPublishLocation\(payload\);\s*navigateBack\(\);/);

    expect(publishView).toMatch(
      /setPendingPublishLocation\(\{ kind: "coords", lat: coords\.lat, lng: coords\.lng \}\);\s*consumeHandoff\(\);/,
    );
  });

  it("keeps publish as the single destructive consumer for both place and coords payloads", () => {
    expect(publishView).toMatch(
      /const pending = consumePendingPublishLocation\(\);\s*if \(pending\) applyHandoff\(pending\);/,
    );
    expect(publishView).toMatch(
      /if \(payload\.kind === "place"\) \{[\s\S]*locationOptions\.selectMapLocation\(known\);[\s\S]*draft\.placeName\.value = payload\.name;/,
    );
    expect(publishView).toMatch(
      /draft\.placeName\.value = payload\.label \|\| draft\.placeName\.value;[\s\S]*locationOptions\.clearMapLocation\(\);[\s\S]*geolocationHint\.value = PUBLISH_LOCATION_GEOLOC_HINT;/,
    );
  });

  it("keeps every handoff kind covered by publish consume and map write paths", () => {
    const handoffKinds = extractHandoffKinds(handoff);
    const publishBranches = new Set(
      Array.from(
        publishView.matchAll(/payload\.kind === "([^"]+)"|payload\.kind !== "([^"]+)"/g),
        ([, eqKind, neqKind]) => eqKind || neqKind,
      ),
    );
    const mapWrites = new Set(
      Array.from(mapPicker.matchAll(/kind: "([^"]+)"/g), ([, kind]) => kind),
    );

    expect(publishBranches).toEqual(handoffKinds);
    expect(mapWrites).toEqual(handoffKinds);
  });

  it("does not duplicate the storage key outside the handoff module", () => {
    expect(mapPicker).not.toContain("lian:publish:pendingLocation");
    expect(publishView).not.toContain("lian:publish:pendingLocation");
  });
});
