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
  const appViewHost = readRepoFile("src/app/AppViewHost.vue");
  const handoff = readRepoFile("src/features/publish/usePublishLocationHandoff.ts");
  const mapPicker = readRepoFile("src/features/map/useMapPickerMode.ts");
  const publishView = readRepoFile("src/features/publish/PublishView.vue");

  it("keeps map and publish in independent static KeepAlive containers", () => {
    expect(appViewHost).not.toMatch(/<KeepAlive\s+:include=/);
    expect(appViewHost.match(/<KeepAlive\b/g)).toHaveLength(2);
    expect(appViewHost).toMatch(
      /<KeepAlive include="MapLeafletView">[\s\S]*?:is="viewComponents\.map"[\s\S]*?v-if="props\.activeViewKey === 'map'"[\s\S]*?<\/KeepAlive>/,
    );
    expect(appViewHost).toMatch(
      /<KeepAlive\s+v-if="shouldKeepPublishAlive"\s+include="PublishView">[\s\S]*?:is="viewComponents\.publish"[\s\S]*?v-if="props\.activeViewKey === 'publish'"[\s\S]*?<\/KeepAlive>/,
    );
    expect(appViewHost).toMatch(
      /:is="viewComponents\[props\.activeViewKey\]"[\s\S]*?v-if="props\.activeViewKey !== 'map' && props\.activeViewKey !== 'publish'"/,
    );
  });

  it("owns a publish-only picker lease and releases it outside the map round trip", () => {
    expect(appViewHost).toContain("const publishPickerLease = ref(false);");
    expect(appViewHost).toMatch(
      /const shouldKeepPublishAlive = computed\(\s*\(\) => props\.activeViewKey === "publish" \|\| publishPickerLease\.value,?\s*\);/,
    );
    expect(appViewHost).toMatch(
      /function openPublishMapPicker\(\) \{\s*if \(props\.activeViewKey === "publish"\) publishPickerLease\.value = true;\s*\}/,
    );
    expect(appViewHost).toMatch(
      /watch\(\s*\(\) => props\.activeViewKey,\s*\(nextView\) => \{\s*if \(nextView !== "map"\) publishPickerLease\.value = false;\s*\},?\s*\);/,
    );
    expect(appViewHost).toContain('@map-picker-open="openPublishMapPicker"');
    expect(appViewHost).toMatch(
      /function releasePublishLeaseOnMapExit\(\) \{[\s\S]*?const link = parseDeepLink\(hash\);[\s\S]*?if \(link\?\.view !== "map"\) return;[\s\S]*?if \(parseDeepLinkQuery\(hash\)\.picker !== "1"\) \{\s*publishPickerLease\.value = false;\s*\}[\s\S]*?\}/,
    );
    expect(appViewHost).toMatch(
      /window\.addEventListener\("hashchange", releasePublishLeaseOnMapExit\);[\s\S]*?window\.addEventListener\("popstate", releasePublishLeaseOnMapExit\);/,
    );
    expect(appViewHost).toMatch(
      /window\.removeEventListener\("hashchange", releasePublishLeaseOnMapExit\);[\s\S]*?window\.removeEventListener\("popstate", releasePublishLeaseOnMapExit\);/,
    );
  });

  it("opens the lease before navigation and restores handoff/chrome on activation", () => {
    expect(publishView).toContain('defineOptions({ name: "PublishView" });');
    expect(publishView).toMatch(/"map-picker-open": \[\];/);

    const pickOnMap = publishView.match(/function pickOnMap\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
    expect(pickOnMap).toContain('emit("map-picker-open")');
    expect(pickOnMap.indexOf('emit("map-picker-open")')).toBeLessThan(
      pickOnMap.indexOf("window.location.hash = buildMapPickerHash()"),
    );

    expect(publishView).toMatch(
      /function emitChromeIfActive\(spec: PageChromeSpec = draft\.pageChrome\.value\) \{\s*if \(!publishViewActive\.value\) return;\s*emit\("chrome", spec\);\s*\}/,
    );
    expect(publishView).toMatch(
      /function consumeHandoffIfActive\(\) \{\s*if \(publishViewActive\.value\) consumeHandoff\(\);\s*\}/,
    );
    expect(publishView).toMatch(
      /onActivated\(\(\) => \{\s*publishViewActive\.value = true;\s*emitChromeIfActive\(\);\s*consumeHandoffIfActive\(\);\s*\}\);/,
    );
    expect(publishView).toMatch(
      /onDeactivated\(\(\) => \{\s*publishViewActive\.value = false;\s*\}\);/,
    );
    expect(publishView).toMatch(
      /watch\(draft\.pageChrome, emitChromeIfActive, \{\s*deep: true,\s*\}\);/,
    );
    expect(publishView).toMatch(
      /function handlePageShow\(\) \{\s*consumeHandoffIfActive\(\);\s*\}/,
    );
  });

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
      /if \(payload\.kind === "coords"\) \{[\s\S]*draft\.placeName\.value = payload\.label \|\| draft\.placeName\.value;[\s\S]*locationOptions\.clearMapLocation\(\);[\s\S]*geolocationHint\.value = PUBLISH_LOCATION_GEOLOC_HINT;/,
    );
  });

  it("keeps every handoff kind covered by publish consume and map write paths", () => {
    const handoffKinds = extractHandoffKinds(handoff);
    const publishBranches = new Set(
      Array.from(publishView.matchAll(/payload\.kind === "([^"]+)"/g), ([, kind]) => kind),
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
