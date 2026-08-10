import { expect, test, type Page } from "@playwright/test";
import { PUBLISH_LOCATION_GEOLOC_HINT } from "../../../src/config/brand";
import { LOCAL_PUBLISHED_BODY, LOCAL_PUBLISHED_TITLE, installLocalCoreApi } from "./core-fixture";

const DRAFT_KEY = "lian.publishDraft.sameSession::u:e2e-registered-001";
const HANDOFF_KEY = "lian:publish:pendingLocation";

async function capturePublishPayload(page: Page) {
  let captured: Record<string, unknown> | null = null;
  await page.route("**/api/ai/post-publish", async (route) => {
    captured = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tid: 700_001, place: null }),
    });
  });
  return () => captured;
}

async function fillAndSubmit(page: Page) {
  await page.locator(".publish-composer__headline input").fill(LOCAL_PUBLISHED_TITLE);
  await page.locator(".publish-composer__body-field textarea").fill(LOCAL_PUBLISHED_BODY);
  const submit = page.locator('.publish-action-bar button[type="submit"]');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByTestId("publish-view-post-link")).toBeVisible();
}

test.describe("@local-core structured Publish location journeys", () => {
  test("pending picker B wins after scoped draft A restore even without a catalog", async ({
    page,
  }) => {
    const state = await installLocalCoreApi(page);
    state.authenticated = true;
    const getPayload = await capturePublishPayload(page);
    await page.addInitScript(
      ({ draftKey, handoffKey }) => {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            title: "",
            body: "",
            tagInput: "",
            placeName: "Place A",
            visibility: "public",
            selectedMapLocation: {
              id: "location-a",
              name: "Place A",
              type: "library",
              placeId: "place-a",
              lat: 18.31,
              lng: 109.91,
            },
            pendingImageCount: 0,
          }),
        );
        sessionStorage.setItem(
          handoffKey,
          JSON.stringify({
            version: 2,
            source: "map_picker",
            coordinateSystem: "gcj02",
            kind: "place",
            locationId: "location-b-picker",
            placeId: "place-b",
            name: "Place B",
            type: "canteen",
            lat: 18.42,
            lng: 110.03,
          }),
        );
      },
      { draftKey: DRAFT_KEY, handoffKey: HANDOFF_KEY },
    );

    await page.goto("/#/publish");
    await expect(page.getByTestId("publish-auth-gate")).toHaveCount(0);
    await expect(page.locator(".publish-location__preview")).toContainText("Place B");
    await fillAndSubmit(page);

    const payload = getPayload() as {
      locationDraft?: Record<string, unknown>;
    } | null;
    expect(payload?.locationDraft).toMatchObject({
      source: "map_v2",
      locationId: "location-b-picker",
      placeId: "place-b",
      displayName: "Place B",
      lat: 18.42,
      lng: 110.03,
      coordinateSystem: "gcj02",
      identityKind: "canonical_place",
    });
    expect(payload?.locationDraft?.locationId).not.toBe("location-a");
  });

  test("browser WGS84 remains labeled display-only and publishes null map coordinates", async ({
    page,
  }) => {
    const state = await installLocalCoreApi(page);
    state.authenticated = true;
    const getPayload = await capturePublishPayload(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success: PositionCallback) {
            success({
              coords: {
                latitude: 18.401,
                longitude: 110.002,
                accuracy: 9,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
                toJSON: () => ({}),
              },
              timestamp: Date.now(),
              toJSON: () => ({}),
            });
          },
        },
      });
    });

    await page.goto("/#/publish");
    await expect(page.getByTestId("publish-auth-gate")).toHaveCount(0);
    await page.locator(".publish-composer__tool").nth(1).click();
    await page.locator(".publish-location__field input").first().fill("Browser display name");
    await page.getByTestId("publish-location-use-current").click();
    await expect(page.getByTestId("publish-location-geoloc-error")).toHaveText(
      PUBLISH_LOCATION_GEOLOC_HINT,
    );
    await fillAndSubmit(page);

    const payload = getPayload() as {
      locationDraft?: Record<string, unknown>;
    } | null;
    expect(payload?.locationDraft).toMatchObject({
      source: "manual",
      displayName: "Browser display name",
      lat: null,
      lng: null,
      coordinateSystem: "none",
      identityKind: "manual_text",
      precisionKind: "display_only",
    });
  });
});
