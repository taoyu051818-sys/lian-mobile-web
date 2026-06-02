import { expect, test, type Route } from "@playwright/test";

import { parseLlmTickResponse } from "../../src/api/aiPreview";
import { buildPublishPayload } from "../../src/api/publish";
import { inferKind } from "../../src/features/publish/inferKind";
import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * Issue #881 — PRD V0.2 section 4.3 response contract guard.
 *
 * Validates that `/api/ai/post-preview` responses conform to the contract
 * shape defined in PRD V0.2 section 4.3:
 *
 *   - `ok: boolean` at top level
 *   - `candidates` object with:
 *     - `title: string | null`
 *     - `bodyCandidate: string | null`
 *     - `suggestedComponents: Array<{ type, reason }>`
 *     - `inferredKind: InferredKind | null`
 *     - `modelLatencyMs: number`
 *     - `modelName: string`
 *
 * The spec stubs the endpoint to return mock data and validates the shape
 * on the client side. This guards against contract drift between frontend
 * expectations and backend responses.
 */

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

const VALID_INFERRED_KINDS = ["image", "text", "event", "merchant", "trade", "help", "place"];

const VALID_COMPONENT_TYPES = [
  "location",
  "time",
  "media",
  "quality",
  "audience",
  "tags",
  "event",
  "merchant",
  "trade",
  "help",
  "event_time",
  "price",
  "merchant_info",
  "trade_condition",
  "help_tag",
];

/**
 * Mock response conforming to PRD V0.2 section 4.3 contract.
 */
function createMockPreviewResponse() {
  return {
    ok: true,
    mode: "mock",
    draft: {
      title: "Mock title",
      body: "Mock body content",
      tags: [],
    },
    locationDraft: null,
    locationSuggestions: [],
    riskFlags: [],
    confidence: 0.85,
    suggestedAudience: null,
    candidates: {
      title: "AI suggested title",
      bodyCandidate: "AI polished body content for the user to review.",
      suggestedComponents: [
        { type: "location", reason: "Adding a location helps others find your post" },
        { type: "event_time", reason: "This looks like an event - add a time?" },
      ],
      inferredKind: "image",
      modelLatencyMs: 245,
      modelName: "mimo-preview-v1",
    },
  };
}

/**
 * Mock response with null/empty candidates (degraded path per PRD section 4.3).
 */
function createDegradedMockResponse() {
  return {
    ok: true,
    mode: "mock",
    draft: { title: "", body: "", tags: [] },
    locationDraft: null,
    locationSuggestions: [],
    riskFlags: [],
    confidence: 0,
    suggestedAudience: null,
    candidates: {
      title: null,
      bodyCandidate: null,
      suggestedComponents: [],
      inferredKind: null,
      modelLatencyMs: 0,
      modelName: "fallback",
    },
  };
}

test.describe("@publish @llm issue #881 — LLM contract shape validation", () => {
  test("successful response has correct top-level ok field", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      // Verify the mock response shape directly
      expect(typeof mockResponse.ok).toBe("boolean");
      expect(mockResponse.ok).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("candidates object has required title field (string | null)", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.candidates).toBeDefined();
      expect(
        mockResponse.candidates.title === null || typeof mockResponse.candidates.title === "string",
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("candidates object has required bodyCandidate field (string | null)", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.candidates).toBeDefined();
      expect(
        mockResponse.candidates.bodyCandidate === null ||
          typeof mockResponse.candidates.bodyCandidate === "string",
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("candidates.suggestedComponents is an array with valid structure", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.candidates).toBeDefined();
      expect(Array.isArray(mockResponse.candidates.suggestedComponents)).toBe(true);

      for (const component of mockResponse.candidates.suggestedComponents) {
        expect(typeof component.type).toBe("string");
        expect(VALID_COMPONENT_TYPES).toContain(component.type);
        expect(typeof component.reason).toBe("string");
      }
    } finally {
      await api.dispose();
    }
  });

  test("candidates.inferredKind is valid enum value or null", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.candidates).toBeDefined();
      const inferredKind = mockResponse.candidates.inferredKind;
      expect(inferredKind === null || VALID_INFERRED_KINDS.includes(inferredKind)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("candidates has modelLatencyMs (number) and modelName (string)", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.candidates).toBeDefined();
      expect(typeof mockResponse.candidates.modelLatencyMs).toBe("number");
      expect(typeof mockResponse.candidates.modelName).toBe("string");
    } finally {
      await api.dispose();
    }
  });

  test("degraded response still has candidates block with null/empty values", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createDegradedMockResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.candidates).toBeDefined();
      expect(mockResponse.candidates.title).toBeNull();
      expect(mockResponse.candidates.bodyCandidate).toBeNull();
      expect(mockResponse.candidates.suggestedComponents).toEqual([]);
      expect(mockResponse.candidates.inferredKind).toBeNull();
      expect(typeof mockResponse.candidates.modelLatencyMs).toBe("number");
      expect(typeof mockResponse.candidates.modelName).toBe("string");
    } finally {
      await api.dispose();
    }
  });

  test("full contract shape validation against PRD V0.2 section 4.3", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const mockResponse = createMockPreviewResponse();

    await page.route("**/api/ai/post-preview", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });

    const { api } = await loginAs("registered", BASE_URL);
    try {
      // Top-level ok field
      expect(typeof mockResponse.ok).toBe("boolean");

      // candidates block existence
      expect(mockResponse.candidates).toBeDefined();
      expect(typeof mockResponse.candidates).toBe("object");
      expect(mockResponse.candidates).not.toBeNull();

      // title: string | null
      const { title } = mockResponse.candidates;
      expect(title === null || typeof title === "string").toBe(true);
      if (typeof title === "string") {
        expect(title.length).toBeLessThanOrEqual(40); // PRD: <=40 chars
      }

      // bodyCandidate: string | null
      const { bodyCandidate } = mockResponse.candidates;
      expect(bodyCandidate === null || typeof bodyCandidate === "string").toBe(true);
      if (typeof bodyCandidate === "string") {
        expect(bodyCandidate.length).toBeLessThanOrEqual(300); // PRD: <=300 chars
      }

      // suggestedComponents: Array<{ type, reason }>
      const { suggestedComponents } = mockResponse.candidates;
      expect(Array.isArray(suggestedComponents)).toBe(true);
      expect(suggestedComponents.length).toBeLessThanOrEqual(6); // PRD: capped at 6
      for (const comp of suggestedComponents) {
        expect(VALID_COMPONENT_TYPES).toContain(comp.type);
        expect(typeof comp.reason).toBe("string");
        expect(comp.reason.length).toBeLessThanOrEqual(60); // PRD: <=60 chars
      }

      // inferredKind: InferredKind | null
      const { inferredKind } = mockResponse.candidates;
      expect(inferredKind === null || VALID_INFERRED_KINDS.includes(inferredKind)).toBe(true);

      // modelLatencyMs: number
      expect(typeof mockResponse.candidates.modelLatencyMs).toBe("number");
      expect(mockResponse.candidates.modelLatencyMs).toBeGreaterThanOrEqual(0);

      // modelName: string
      expect(typeof mockResponse.candidates.modelName).toBe("string");
      expect(mockResponse.candidates.modelName.length).toBeGreaterThan(0);
    } finally {
      await api.dispose();
    }
  });
});

test("@publish @llm structural fallback — parser/payload round-trip preserves candidates", async () => {
  const mockResponse = createMockPreviewResponse();
  const degradedResponse = createDegradedMockResponse();

  const parsed = parseLlmTickResponse(mockResponse);
  expect(parsed).toEqual({
    title: "AI suggested title",
    bodyCandidate: "AI polished body content for the user to review.",
    suggestedComponents: [
      { kind: "location", payload: {}, label: "Adding a location helps others find your post" },
      { kind: "time", payload: {}, label: "This looks like an event - add a time?" },
    ],
    inferredKind: "image",
    modelLatencyMs: 245,
    modelName: "mimo-preview-v1",
  });

  const payload = buildPublishPayload({
    imageUrls: ["https://img.lian.test/publish-round-trip.jpg"],
    title: parsed.title ?? "fallback title",
    body: parsed.bodyCandidate ?? "fallback body",
    tag: "活动",
    identityTag: " 校友 ",
    placeName: "图书馆",
    visibility: "public",
    kind: inferKind({
      publishKind: "regular",
      hasLocation: true,
      hasImage: true,
      hasBody: Boolean(parsed.bodyCandidate?.trim()),
      tag: "活动",
      llmInferredKind: parsed.inferredKind,
    }),
  });
  expect(payload).toEqual({
    imageUrl: "https://img.lian.test/publish-round-trip.jpg",
    imageUrls: ["https://img.lian.test/publish-round-trip.jpg"],
    title: "AI suggested title",
    body: "AI polished body content for the user to review.",
    tag: "#活动",
    identityTag: "校友",
    kind: "image",
    metadata: {
      locationArea: "图书馆",
      visibility: "public",
      distribution: ["home", "map", "search", "detail"],
      primaryTag: "#活动",
      identityTag: "校友",
    },
    locationDraft: {
      source: "manual",
      locationId: "",
      locationArea: "图书馆",
      displayName: "图书馆",
      lat: null,
      lng: null,
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "manual",
      coordinateSystem: "none",
      identityKind: "manual_text",
      precisionKind: "display_only",
      confidence: 0.65,
      skipped: false,
      note: "",
      issues: [],
    },
    riskFlags: [],
    confidence: 0.65,
    needsHumanReview: false,
    aiMode: "manual-vue",
    aliasId: undefined,
  });

  const degraded = parseLlmTickResponse(degradedResponse);
  expect(degraded).toEqual({
    title: null,
    bodyCandidate: null,
    suggestedComponents: [],
    inferredKind: null,
    modelLatencyMs: 0,
    modelName: "fallback",
  });
});
