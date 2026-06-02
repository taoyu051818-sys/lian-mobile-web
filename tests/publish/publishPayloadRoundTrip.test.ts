import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublishLlmCandidates, parseLlmTickResponse } from "../../src/api/aiPreview";
import { buildPublishPayload, createMapV2LocationDraft, publishPost } from "../../src/api/publish";
import { inferKind } from "../../src/features/publish/inferKind";
import type { PublishPayload } from "../../src/types/publish";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("publish parser/payload round trip", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("feeds parsed preview candidates into the publish payload wire shape", async () => {
    const previewRequests: unknown[] = [];
    const publishRequests: PublishPayload[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const path = String(url);
      if (path.includes("/api/ai/post-preview")) {
        previewRequests.push(requestBody);
        return jsonResponse({
          ok: true,
          mode: "mock",
          candidates: {
            title: "解析后的标题",
            bodyCandidate: "解析后的正文",
            suggestedComponents: [
              { type: "event_time", reason: "补充活动时间" },
              { type: "price", reason: "补充价格" },
              { type: "event_time", reason: "重复活动时间" },
            ],
            inferredKind: "event",
            modelLatencyMs: 12,
            modelName: "round-trip-test",
          },
        });
      }

      publishRequests.push(requestBody as PublishPayload);
      return jsonResponse({ ok: true, tid: 974, payloadEcho: requestBody });
    });
    vi.stubGlobal("fetch", fetchMock);

    const parsed = await fetchPublishLlmCandidates({
      title: "原始标题",
      body: "原始正文",
      locationLabel: "图书馆",
    });
    expect(parsed).toEqual({
      title: "解析后的标题",
      bodyCandidate: "解析后的正文",
      suggestedComponents: [
        { kind: "time", payload: {}, label: "补充活动时间" },
        { kind: "trade", payload: {}, label: "补充价格" },
      ],
      inferredKind: "event",
      modelLatencyMs: 12,
      modelName: "round-trip-test",
    });

    const payload = buildPublishPayload({
      imageUrls: [],
      title: parsed.title ?? "原始标题",
      body: parsed.bodyCandidate ?? "原始正文",
      tag: "#活动",
      identityTag: "  校友  ",
      placeName: "图书馆",
      visibility: "public",
      kind: inferKind({
        publishKind: "regular",
        hasLocation: true,
        hasImage: false,
        hasBody: Boolean(parsed.bodyCandidate?.trim()),
        tag: "#活动",
        llmInferredKind: parsed.inferredKind,
      }),
    });
    const published = await publishPost(payload);
    const echoedPayload = (published as { payloadEcho: PublishPayload }).payloadEcho;

    expect(echoedPayload).toEqual({
      imageUrl: "",
      imageUrls: [],
      title: "解析后的标题",
      body: "解析后的正文",
      tag: "#活动",
      identityTag: "校友",
      kind: "event",
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
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(previewRequests).toEqual([
      {
        userText: "原始标题\n原始正文",
        imageUrl: "",
        locationHint: "图书馆",
      },
    ]);
    expect(publishRequests).toEqual([echoedPayload]);
  });

  it("locks parser and payload behavior across publish kind round-trip cases", () => {
    const cases = [
      {
        name: "text-only fallback",
        response: { title: "文字标题", bodyCandidate: "文字正文", inferredKind: null },
        input: { imageUrls: [], placeName: "", tag: "" },
        expectedKind: "text",
      },
      {
        name: "LLM event hint",
        response: { title: "活动标题", bodyCandidate: "活动正文", inferredKind: "event" },
        input: { imageUrls: [], placeName: "操场", tag: "活动" },
        expectedKind: "event",
      },
      {
        name: "LLM trade hint",
        response: { title: "出物标题", bodyCandidate: "出物正文", inferredKind: "trade" },
        input: { imageUrls: [], placeName: "", tag: "闲置" },
        expectedKind: "trade",
      },
      {
        name: "image upload overrides LLM text hint",
        response: { title: "图片标题", bodyCandidate: "图片正文", inferredKind: "text" },
        input: { imageUrls: ["https://img.lian.test/one.jpg"], placeName: "", tag: "" },
        expectedKind: "image",
      },
      {
        name: "LLM image hallucination falls back to text without upload",
        response: { title: "无图标题", bodyCandidate: "无图正文", inferredKind: "image" },
        input: { imageUrls: [], placeName: "", tag: "" },
        expectedKind: "text",
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = parseLlmTickResponse({
        ok: true,
        candidates: {
          suggestedComponents: [],
          modelLatencyMs: 10,
          modelName: `round-trip-${testCase.name}`,
          ...testCase.response,
        },
      });
      const payload = buildPublishPayload({
        imageUrls: [...testCase.input.imageUrls],
        title: parsed.title ?? "fallback title",
        body: parsed.bodyCandidate ?? "fallback body",
        tag: testCase.input.tag,
        placeName: testCase.input.placeName,
        visibility: "public",
        kind: inferKind({
          publishKind: "regular",
          hasLocation: Boolean(testCase.input.placeName),
          hasImage: testCase.input.imageUrls.length > 0,
          hasBody: Boolean(parsed.bodyCandidate?.trim()),
          tag: testCase.input.tag,
          llmInferredKind: parsed.inferredKind,
        }),
      });

      expect({
        name: testCase.name,
        parsed,
        payloadKind: payload.kind,
        payloadTitle: payload.title,
        payloadBody: payload.body,
        payloadImageUrl: payload.imageUrl,
        payloadLocationArea: payload.metadata.locationArea,
        payloadPrimaryTag: payload.metadata.primaryTag,
      }).toEqual({
        name: testCase.name,
        parsed: {
          title: testCase.response.title,
          bodyCandidate: testCase.response.bodyCandidate,
          suggestedComponents: [],
          inferredKind: testCase.response.inferredKind,
          modelLatencyMs: 10,
          modelName: `round-trip-${testCase.name}`,
        },
        payloadKind: testCase.expectedKind,
        payloadTitle: testCase.response.title,
        payloadBody: testCase.response.bodyCandidate,
        payloadImageUrl: testCase.input.imageUrls[0] ?? "",
        payloadLocationArea: testCase.input.placeName,
        payloadPrimaryTag: testCase.input.tag ? `#${testCase.input.tag}` : "",
      });
    }
  });

  it("guards parser normalization before payload assembly", () => {
    const parsed = parseLlmTickResponse({
      ok: true,
      candidates: {
        title: "  标题会裁空白  ",
        bodyCandidate: "  正文会裁空白  ",
        suggestedComponents: [
          { type: "event_time", reason: "补时间" },
          { type: "time", reason: "重复时间" },
          { type: "help_tag", reason: "补求助标签" },
          { kind: "trade_condition", label: "补交易成色" },
          { type: "merchant_info", reason: "   " },
          { type: "unknown", reason: "未知组件" },
        ],
        inferredKind: "not-a-kind",
        modelLatencyMs: Number.POSITIVE_INFINITY,
        modelName: "  normalization-round-trip  ",
      },
    });
    const payload = buildPublishPayload({
      imageUrls: [],
      title: parsed.title ?? "fallback title",
      body: parsed.bodyCandidate ?? "fallback body",
      tag: "  求助  ",
      identityTag: "  身份标签  ",
      placeName: "",
      visibility: "public",
      kind: inferKind({
        publishKind: "regular",
        hasLocation: false,
        hasImage: false,
        hasBody: Boolean(parsed.bodyCandidate?.trim()),
        tag: "  求助  ",
        llmInferredKind: parsed.inferredKind,
      }),
    });

    expect({ parsed, payload }).toEqual({
      parsed: {
        title: "标题会裁空白",
        bodyCandidate: "正文会裁空白",
        suggestedComponents: [
          { kind: "time", payload: {}, label: "补时间" },
          { kind: "help", payload: {}, label: "补求助标签" },
          { kind: "trade", payload: {}, label: "补交易成色" },
        ],
        inferredKind: null,
        modelLatencyMs: 0,
        modelName: "normalization-round-trip",
      },
      payload: {
        imageUrl: "",
        imageUrls: [],
        title: "标题会裁空白",
        body: "正文会裁空白",
        tag: "#求助",
        identityTag: "身份标签",
        kind: "help",
        metadata: {
          locationArea: "",
          visibility: "public",
          distribution: ["home", "search", "detail"],
          primaryTag: "#求助",
          identityTag: "身份标签",
        },
        locationDraft: {
          source: "skipped",
          locationId: "",
          locationArea: "",
          displayName: "",
          lat: null,
          lng: null,
          legacyPoint: { x: null, y: null },
          imagePoint: { x: null, y: null },
          mapVersion: "manual",
          coordinateSystem: "none",
          identityKind: "skipped",
          precisionKind: "none",
          confidence: 0,
          skipped: true,
          note: "",
          issues: [],
        },
        riskFlags: [],
        confidence: 0,
        needsHumanReview: false,
        aiMode: "manual-vue",
        aliasId: undefined,
      },
    });
  });

  it("round-trips optional payload extensions through parser-derived publishes", () => {
    const parsed = parseLlmTickResponse({
      ok: true,
      candidates: {
        title: "商家标题",
        bodyCandidate: "商家正文",
        suggestedComponents: [{ type: "merchant_info", reason: "补充商家资料" }],
        inferredKind: "merchant",
        modelLatencyMs: 31,
        modelName: "payload-extension-round-trip",
      },
    });
    const merchantPayload = buildPublishPayload({
      imageUrls: [],
      title: parsed.title ?? "fallback title",
      body: parsed.bodyCandidate ?? "fallback body",
      tag: "商家",
      identityTag: "认证商家",
      placeName: "",
      visibility: "school",
      aliasId: "alias-974",
      locationDraft: createMapV2LocationDraft({
        locationId: "gaode-poi-974",
        placeId: "place-974",
        name: "校门口咖啡",
        lat: 39.984123456,
        lng: 116.307654321,
        note: "selected from map",
      }),
      audience: {
        visibility: "school",
        schoolIds: [" school-1 "],
        orgIds: [],
        roleIds: ["merchant_verified"],
        userIds: [],
        linkOnly: false,
      },
      kind: inferKind({
        publishKind: "regular",
        hasLocation: true,
        hasImage: false,
        hasBody: Boolean(parsed.bodyCandidate?.trim()),
        tag: "商家",
        llmInferredKind: parsed.inferredKind,
      }),
      merchant: {
        contentType: "merchant_food",
        input: {
          name: "校门口咖啡",
          category: "food",
          hours: "09:00-18:00",
          contact: "店内咨询",
          errandSupported: true,
        },
      },
    });

    expect({ parsed, merchantPayload }).toEqual({
      parsed: {
        title: "商家标题",
        bodyCandidate: "商家正文",
        suggestedComponents: [{ kind: "merchant", payload: {}, label: "补充商家资料" }],
        inferredKind: "merchant",
        modelLatencyMs: 31,
        modelName: "payload-extension-round-trip",
      },
      merchantPayload: {
        imageUrl: "",
        imageUrls: [],
        title: "商家标题",
        body: "商家正文",
        tag: "#商家",
        identityTag: "认证商家",
        kind: "merchant",
        metadata: {
          locationArea: "校门口咖啡",
          visibility: "school",
          distribution: ["home", "map", "search", "detail"],
          primaryTag: "#商家",
          identityTag: "认证商家",
          audience: {
            visibility: "school",
            schoolIds: ["school-1"],
            orgIds: [],
            roleIds: ["merchant_verified"],
            userIds: [],
            linkOnly: false,
          },
          presentationIntent: "merchant",
        },
        locationDraft: {
          source: "map_v2",
          locationId: "gaode-poi-974",
          placeId: "place-974",
          place: { id: "place-974", name: "校门口咖啡", type: undefined },
          locationArea: "校门口咖啡",
          displayName: "校门口咖啡",
          lat: 39.9841235,
          lng: 116.3076543,
          legacyPoint: { x: null, y: null },
          imagePoint: { x: null, y: null },
          mapVersion: "gaode_v2",
          coordinateSystem: "gcj02",
          identityKind: "canonical_place",
          precisionKind: "exact",
          confidence: 0.86,
          skipped: false,
          note: "selected from map",
          issues: [],
        },
        riskFlags: [],
        confidence: 0.86,
        needsHumanReview: false,
        aiMode: "manual-vue-map-v2",
        aliasId: "alias-974",
        contentType: "merchant_food",
        merchant: {
          name: "校门口咖啡",
          category: "food",
          hours: "09:00-18:00",
          contact: "店内咨询",
          errandSupported: true,
        },
      },
    });

    const tradeParsed = parseLlmTickResponse({
      ok: true,
      candidates: {
        title: "出物标题",
        bodyCandidate: "出物正文",
        suggestedComponents: [{ type: "trade_condition", reason: "补充成色" }],
        inferredKind: "trade",
        modelLatencyMs: 22,
        modelName: "trade-round-trip",
      },
    });
    const tradePayload = buildPublishPayload({
      imageUrls: [],
      title: tradeParsed.title ?? "fallback title",
      body: tradeParsed.bodyCandidate ?? "fallback body",
      tag: "闲置",
      placeName: "",
      visibility: "campus",
      kind: inferKind({
        publishKind: "regular",
        hasLocation: false,
        hasImage: false,
        hasBody: Boolean(tradeParsed.bodyCandidate?.trim()),
        tag: "闲置",
        llmInferredKind: tradeParsed.inferredKind,
      }),
      trade: {
        contentType: "trade",
        input: { price: "¥30", state: "available", category: "教材" },
      },
    });

    expect({ tradeParsed, tradePayload }).toEqual({
      tradeParsed: {
        title: "出物标题",
        bodyCandidate: "出物正文",
        suggestedComponents: [{ kind: "trade", payload: {}, label: "补充成色" }],
        inferredKind: "trade",
        modelLatencyMs: 22,
        modelName: "trade-round-trip",
      },
      tradePayload: {
        imageUrl: "",
        imageUrls: [],
        title: "出物标题",
        body: "出物正文",
        tag: "#闲置",
        identityTag: "",
        kind: "trade",
        metadata: {
          locationArea: "",
          visibility: "campus",
          distribution: ["home", "search", "detail"],
          primaryTag: "#闲置",
          identityTag: "",
          presentationIntent: "trade",
        },
        locationDraft: {
          source: "skipped",
          locationId: "",
          locationArea: "",
          displayName: "",
          lat: null,
          lng: null,
          legacyPoint: { x: null, y: null },
          imagePoint: { x: null, y: null },
          mapVersion: "manual",
          coordinateSystem: "none",
          identityKind: "skipped",
          precisionKind: "none",
          confidence: 0,
          skipped: true,
          note: "",
          issues: [],
        },
        riskFlags: [],
        confidence: 0,
        needsHumanReview: false,
        aiMode: "manual-vue",
        aliasId: undefined,
        contentType: "trade",
        trade: { price: "¥30", state: "available", category: "教材" },
      },
    });
  });
});
