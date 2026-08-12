import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { buildPublishPayload } from "../../src/api/publish";
import { fetchMapV2Items } from "../../src/api/map";
import { usePublishLocationOptions } from "../../src/features/publish/usePublishLocationOptions";
import type { PublishLocationHandoffV2 } from "../../src/features/publish/usePublishLocationHandoff";
import type { MapLocation } from "../../src/types/map";

vi.mock("../../src/api/map", () => ({
  fetchMapV2Items: vi.fn(),
}));

const PLACE_A: MapLocation = {
  id: "location-a",
  name: "Place A",
  type: "library",
  placeId: "place-a",
  lat: 18.31,
  lng: 109.91,
};

const PLACE_B: MapLocation = {
  id: "location-b-canonical",
  name: "Place B canonical",
  type: "canteen",
  place: { id: "place-b", name: "Place B canonical", type: "canteen" },
  lat: 18.42,
  lng: 110.03,
};

const PLACE_B_HANDOFF: PublishLocationHandoffV2 = {
  version: 2,
  source: "map_picker",
  coordinateSystem: "gcj02",
  kind: "place",
  locationId: "location-b-picker",
  placeId: "place-b",
  name: "Place B picker",
  type: "canteen",
  lat: 18.421,
  lng: 110.031,
};

const FREE_PIN: PublishLocationHandoffV2 = {
  version: 2,
  source: "map_picker",
  coordinateSystem: "gcj02",
  kind: "coords",
  lat: 18.5,
  lng: 110.1,
  label: "Free pin",
};

function finalPayload(
  placeName: string,
  locationDraft: ReturnType<typeof usePublishLocationOptions>["selectedLocationDraft"]["value"],
) {
  return buildPublishPayload({
    imageUrls: [],
    title: "Structured location test",
    body: "Body",
    tag: "",
    placeName,
    visibility: "public",
    locationDraft,
  });
}

beforeEach(() => {
  vi.mocked(fetchMapV2Items).mockReset();
});

describe("usePublishLocationOptions structured picker binding", () => {
  it("atomically replaces selected A with complete fallback B and cannot submit A", () => {
    const placeName = ref("");
    const options = usePublishLocationOptions(placeName);
    options.selectMapLocation(PLACE_A);

    options.applyMapPickerHandoff(PLACE_B_HANDOFF);

    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toEqual(PLACE_B_HANDOFF);
    expect(placeName.value).toBe("Place B picker");
    expect(options.selectedLocationDraft.value).toMatchObject({
      source: "map_v2",
      locationId: "location-b-picker",
      placeId: "place-b",
      displayName: "Place B picker",
      lat: 18.421,
      lng: 110.031,
      coordinateSystem: "gcj02",
      identityKind: "canonical_place",
    });

    const payload = finalPayload(placeName.value, options.selectedLocationDraft.value);
    expect(payload.locationDraft).toMatchObject({
      locationId: "location-b-picker",
      placeId: "place-b",
      displayName: "Place B picker",
      lat: 18.421,
      lng: 110.031,
    });
    expect(payload.locationDraft.locationId).not.toBe(PLACE_A.id);
    expect(payload.locationDraft.placeId).not.toBe(PLACE_A.placeId);
  });

  it("turns a free GCJ-02 pin into map_v2/map_selection without fabricating a place", () => {
    const placeName = ref("");
    const options = usePublishLocationOptions(placeName);

    options.applyMapPickerHandoff(FREE_PIN);
    placeName.value = "Renamed free pin";

    const payload = finalPayload(placeName.value, options.selectedLocationDraft.value);
    expect(payload.locationDraft).toMatchObject({
      source: "map_v2",
      locationId: "",
      displayName: "Renamed free pin",
      lat: 18.5,
      lng: 110.1,
      coordinateSystem: "gcj02",
      identityKind: "map_selection",
    });
    expect(payload.locationDraft.placeId).toBeUndefined();
    expect(payload.locationDraft.place).toBeUndefined();
  });

  it("canonicalizes immediately when the catalog loads before the handoff", async () => {
    vi.mocked(fetchMapV2Items).mockResolvedValue({ locations: [PLACE_B] });
    const options = usePublishLocationOptions(ref(""));
    await options.loadMapLocations();

    options.applyMapPickerHandoff(PLACE_B_HANDOFF);

    expect(options.selectedMapLocation.value).toEqual(PLACE_B);
    expect(options.mapPickerBinding.value).toEqual(PLACE_B_HANDOFF);
    expect(options.selectedLocationDraft.value).toMatchObject({
      locationId: "location-b-picker",
      placeId: "place-b",
      displayName: "Place B picker",
      lat: 18.421,
      lng: 110.031,
    });
  });

  it("canonicalizes a retained fallback when the catalog loads after the handoff", async () => {
    vi.mocked(fetchMapV2Items).mockResolvedValue({ locations: [PLACE_B] });
    const options = usePublishLocationOptions(ref(""));
    options.applyMapPickerHandoff(PLACE_B_HANDOFF);
    expect(options.mapPickerBinding.value).toEqual(PLACE_B_HANDOFF);

    await options.loadMapLocations();

    expect(options.selectedMapLocation.value).toEqual(PLACE_B);
    expect(options.mapPickerBinding.value).toEqual(PLACE_B_HANDOFF);
    expect(options.selectedLocationDraft.value).toMatchObject({
      locationId: "location-b-picker",
      placeId: "place-b",
      displayName: "Place B picker",
      lat: 18.421,
      lng: 110.031,
    });
  });

  it.each([
    ["fails", new Error("catalog unavailable")],
    ["does not contain B", null],
  ])("keeps fallback B when the catalog %s", async (_label, failure) => {
    if (failure) vi.mocked(fetchMapV2Items).mockRejectedValue(failure);
    else vi.mocked(fetchMapV2Items).mockResolvedValue({ locations: [PLACE_A] });
    const options = usePublishLocationOptions(ref(""));
    options.applyMapPickerHandoff(PLACE_B_HANDOFF);

    await options.loadMapLocations();

    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toEqual(PLACE_B_HANDOFF);
    expect(options.selectedLocationDraft.value?.placeId).toBe("place-b");
  });

  it("clears both canonical and fallback structured bindings", () => {
    const options = usePublishLocationOptions(ref(""));
    options.applyMapPickerHandoff(PLACE_B_HANDOFF);
    options.clearMapLocation();
    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toBeNull();
    expect(options.selectedLocationDraft.value).toBeNull();

    options.selectMapLocation(PLACE_A);
    options.clearLocationState();
    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toBeNull();
  });

  it("removes A from both structured and visible state for a display-only replacement", () => {
    const placeName = ref("");
    const options = usePublishLocationOptions(placeName);
    options.selectMapLocation(PLACE_A);

    options.applyDisplayOnlyLocation();

    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toBeNull();
    expect(placeName.value).toBe("");

    options.applyMapPickerHandoff(PLACE_B_HANDOFF);
    options.applyDisplayOnlyLocation("Legacy coordinates");
    expect(options.selectedMapLocation.value).toBeNull();
    expect(options.mapPickerBinding.value).toBeNull();
    expect(placeName.value).toBe("Legacy coordinates");
  });
});
