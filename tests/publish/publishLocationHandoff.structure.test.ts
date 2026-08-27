import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("publish location handoff structure", () => {
  const appViewHost = readRepoFile("src/app/AppViewHost.vue");
  const handoff = readRepoFile("src/features/publish/usePublishLocationHandoff.ts");
  const mapPicker = readRepoFile("src/features/map/useMapPickerMode.ts");
  const publishView = readRepoFile("src/features/publish/PublishView.vue");
  const locationOptions = readRepoFile("src/features/publish/usePublishLocationOptions.ts");
  const draftSession = readRepoFile("src/features/publish/publishDraftSession.ts");
  const useDraftSession = readRepoFile("src/features/publish/usePublishDraftSession.ts");
  const locationControls = readRepoFile("src/features/publish/PublishLocationControls.vue");
  const geolocation = readRepoFile("src/features/publish/useGeolocation.ts");

  it("keeps map and publish in independent static KeepAlive containers", () => {
    expect(appViewHost).not.toMatch(/<KeepAlive\s+:include=/);
    expect(appViewHost.match(/<KeepAlive\b/g)).toHaveLength(2);
    expect(appViewHost).toMatch(
      /<KeepAlive include="MapView">[\s\S]*?:is="viewComponents\.map"[\s\S]*?v-if="props\.activeViewKey === 'map'"[\s\S]*?<\/KeepAlive>/,
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
    expect(appViewHost).toMatch(/import \{ registerBeforeNavigate \} from "\.\/view-hash";/);
    expect(appViewHost).toMatch(
      /function releasePublishLeaseOnInAppMapNavigation\(target: AppViewKey\) \{[\s\S]*?props\.activeViewKey !== "map"[\s\S]*?target !== "map"[\s\S]*?parseDeepLinkQuery\(window\.location\.hash\)\.picker !== "1"[\s\S]*?publishPickerLease\.value = false;[\s\S]*?\}/,
    );
    expect(appViewHost).toMatch(
      /unregisterBeforeNavigate = registerBeforeNavigate\(releasePublishLeaseOnInAppMapNavigation\);/,
    );
    expect(appViewHost).toMatch(/unregisterBeforeNavigate\?\.\(\);/);
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
      /function consumeHandoffIfActive\(\) \{\s*if \(publishViewActive\.value && restoreSettled\.value\) consumeHandoff\(\);\s*\}/,
    );
    expect(publishView).toMatch(
      /onActivated\(\(\) => \{\s*publishViewActive\.value = true;\s*emitChromeIfActive\(\);\s*consumeHandoffIfActive\(\);\s*\}\);/,
    );
    expect(publishView).toMatch(
      /onDeactivated\(\(\) => \{[\s\S]*?publishViewActive\.value = false;[\s\S]*?geolocation\.invalidatePendingRequest\(\);[\s\S]*?\}\);/,
    );
    expect(publishView).toMatch(
      /watch\(draft\.pageChrome, emitChromeIfActive, \{\s*deep: true,\s*\}\);/,
    );
    expect(publishView).toMatch(
      /function handlePageShow\(\) \{\s*consumeHandoffIfActive\(\);\s*\}/,
    );
  });

  it("separates v2 writes from normalized legacy reads and makes coordinate provenance explicit", () => {
    expect(handoff).toContain('const STORAGE_KEY = "lian:publish:pendingLocation"');
    expect(handoff).toContain("export type PublishLocationHandoffV2 =");
    expect(handoff).toContain("export type PublishMapPickerLocationHandoff =");
    expect(handoff).toContain("export type NormalizedPublishLocationHandoff =");
    expect(handoff).toContain('source: "map_picker"');
    expect(handoff).toContain('coordinateSystem: "gcj02"');
    expect(handoff).toContain('source: "browser_geolocation"');
    expect(handoff).toContain('coordinateSystem: "wgs84"');
    expect(handoff).toContain('source: "legacy"');
    expect(handoff).toContain('coordinateSystem: "unknown"');
    expect(handoff).toMatch(/setPendingPublishLocation\(payload: PublishLocationHandoffV2\)/);
    expect(handoff).toMatch(
      /consumePendingPublishLocation\(\): NormalizedPublishLocationHandoff \| null/,
    );
  });

  it("writes explicit GCJ-02 picker envelopes and clears the long-lived selection on confirm", () => {
    expect(mapPicker).toContain("type PublishMapPickerLocationHandoff");
    expect(mapPicker).toContain("version: 2");
    expect(mapPicker).toContain('source: "map_picker"');
    expect(mapPicker).toContain('coordinateSystem: "gcj02"');
    expect(mapPicker).toMatch(
      /setPendingPublishLocation\(payload\);\s*clearSelection\(\);\s*navigateBack\(\);/,
    );
  });

  it("owns an atomic fallback binding and reconciles it by stable placeId after catalog load", () => {
    expect(locationOptions).toContain(
      "const mapPickerBinding = ref<PublishMapPickerLocationHandoff | null>(null);",
    );
    expect(locationOptions).toContain("function applyMapPickerHandoff(");
    expect(locationOptions).toContain("selectedMapLocation.value = null;");
    expect(locationOptions).toContain("mapPickerBinding.value = null;");
    expect(locationOptions).toContain("function reconcileMapPickerBinding()");
    expect(locationOptions).toContain("createMapV2LocationDraft({");
    expect(locationOptions).toMatch(
      /mapLocations\.value = data\.locations \|\| \[\];\s*reconcileMapPickerBinding\(\);/,
    );
  });

  it("persists the fallback inside the scoped draft and exposes restore settlement", () => {
    expect(draftSession).toContain("mapPickerBinding: PublishMapPickerLocationHandoff | null;");
    expect(draftSession).toContain("normalizePublishMapPickerLocationHandoff(");
    expect(useDraftSession).toContain(
      "mapPickerBinding: Ref<PublishMapPickerLocationHandoff | null>;",
    );
    expect(useDraftSession).toContain("mapPickerBinding.value = snapshot.mapPickerBinding;");
    expect(useDraftSession).toContain("const restoreSettled = computed(");
    expect(useDraftSession).toContain("restoreSettled,");
    expect(publishView).toContain("mapPickerBinding: locationOptions.mapPickerBinding,");
  });

  it("consumes only after scoped restore settles while Publish is active", () => {
    expect(publishView).toMatch(
      /const \{[\s\S]*draftNotice[\s\S]*hasUnsavedDraft[\s\S]*currentScope[\s\S]*restoreSettled[\s\S]*restoreGeneration[\s\S]*\}\s*=\s*usePublishDraftSession/,
    );
    expect(publishView).toMatch(
      /if \(publishViewActive\.value && restoreSettled\.value\) consumeHandoff\(\);/,
    );
    expect(publishView).toMatch(/watch\(restoreGeneration, consumeHandoffIfActive/);

    const useCurrentLocation =
      publishView.match(/async function useCurrentLocation\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
    expect(useCurrentLocation).toContain("if (!coords || !publishViewActive.value) return;");
    expect(useCurrentLocation).not.toContain("!restoreSettled.value");
    expect(useCurrentLocation.indexOf("setPendingPublishLocation({")).toBeLessThan(
      useCurrentLocation.indexOf("consumeHandoffIfActive();"),
    );
  });

  it("uses a monotonic scope-restore generation and resets transient state before handoff", () => {
    expect(useDraftSession).not.toContain("restoredScopes");
    expect(useDraftSession).toContain("resetTransientState");
    expect(useDraftSession).toContain("const restoreGeneration = ref(0);");
    expect(useDraftSession).toContain("restoreGeneration.value += 1;");
    expect(useDraftSession).toContain("restoreGeneration,");
    expect(publishView).toMatch(
      /const \{[\s\S]*restoreGeneration[\s\S]*\}\s*=\s*usePublishDraftSession/,
    );
    expect(publishView).toContain("resetTransientState:");
    const scopeResetBody =
      publishView.match(/function resetPublishTransientState\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
    expect(scopeResetBody).toContain("consumePendingPublishLocation();");
    expect(scopeResetBody).toContain("draft.resetForm(locationOptions.clearLocationState);");
    expect(scopeResetBody).toContain("eventDraft.reset();");
    expect(scopeResetBody).toContain("geolocation.invalidatePendingRequest();");
    expect(scopeResetBody).toContain("geolocation.clearError();");
    expect(scopeResetBody).toContain('geolocationHint.value = "";');
    expect(scopeResetBody).toContain("actionablePreview.value = null;");
    expect(scopeResetBody).toContain('draft.errorMessage.value = "";');
    expect(scopeResetBody).toContain('draft.successMessage.value = "";');
    expect(scopeResetBody).toContain("draft.lastTid.value = null;");
    expect(scopeResetBody).toContain("resetConfirmationVisible.value = false;");
    expect(scopeResetBody).toContain("resetPublishAttemptForScopeTransition();");
    expect(scopeResetBody.indexOf("resetPublishAttemptForScopeTransition();")).toBeLessThan(
      scopeResetBody.indexOf("draft.resetForm(locationOptions.clearLocationState);"),
    );
    expect(publishView).toContain("resetPublishAttemptForScopeTransition = resetPublishAttempt;");
    expect(publishView).toContain("resetTransientState: resetPublishTransientState,");
    expect(publishView).toMatch(/watch\(restoreGeneration, consumeHandoffIfActive/);
    expect(publishView).not.toMatch(/watch\(restoreSettled, consumeHandoffIfActive/);
    expect(publishView).toMatch(
      /onMounted\(\(\) => \{[\s\S]*?consumeHandoffIfActive\(\);[\s\S]*?window\.addEventListener\("pageshow", handlePageShow\);[\s\S]*?\}\);/,
    );
  });

  it("keeps map GCJ-02 structured but browser/legacy coordinates display-only", () => {
    expect(publishView).toContain('if (payload.source === "map_picker")');
    expect(publishView).toContain("locationOptions.applyMapPickerHandoff(payload);");
    expect(publishView).toContain('payload.source === "browser_geolocation"');
    expect(publishView).toContain("PUBLISH_LOCATION_GEOLOC_HINT");
    expect(publishView).toContain("PUBLISH_LOCATION_LEGACY_HINT");
    expect(publishView).toMatch(
      /version: 2,[\s\S]*source: "browser_geolocation",[\s\S]*coordinateSystem: "wgs84",/,
    );
    expect(geolocation).toContain('coordinateSystem: "wgs84"');
    expect(geolocation).not.toMatch(/gcj02|transform|convert/i);
  });

  it("invalidates delayed browser geolocation on picker entry and deactivation", () => {
    const pickOnMap = publishView.match(/function pickOnMap\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
    expect(pickOnMap).toContain("geolocation.invalidatePendingRequest()");
    expect(publishView).toMatch(
      /onDeactivated\(\(\) => \{[\s\S]*geolocation\.invalidatePendingRequest\(\);[\s\S]*\}\);/,
    );
    expect(geolocation).toContain("function invalidatePendingRequest()");
  });

  it("renders fallback bindings as bound and keeps the manual-switch affordance", () => {
    expect(locationControls).toContain("hasStructuredMapBinding: boolean;");
    expect(locationControls).toContain("panelOpen || hasStructuredMapBinding || placeName.trim()");
    expect(locationControls).toContain("hasStructuredMapBinding ? PUBLISH_LOCATION_BOUND");
    expect(locationControls).toContain('v-if="hasStructuredMapBinding"');
    expect(publishView).toContain(
      ':has-structured-map-binding="locationOptions.hasStructuredMapBinding.value"',
    );
  });

  it("does not duplicate the storage key outside the handoff module", () => {
    expect(mapPicker).not.toContain("lian:publish:pendingLocation");
    expect(publishView).not.toContain("lian:publish:pendingLocation");
  });
});
