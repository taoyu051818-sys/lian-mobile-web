import { describe, it, expect } from "vitest";
import {
  createManualLocationDraft,
  createMapV2LocationDraft,
  buildPublishPayload,
} from "../../src/api/publish";

describe("createManualLocationDraft", () => {
  it("produces manual source with explicit mapVersion when name is provided", () => {
    const draft = createManualLocationDraft("图书馆三楼");
    expect(draft.source).toBe("manual");
    expect(draft.mapVersion).toBe("manual");
    expect(draft.skipped).toBe(false);
    expect(draft.displayName).toBe("图书馆三楼");
    expect(draft.locationArea).toBe("图书馆三楼");
    expect(draft.lat).toBeNull();
    expect(draft.lng).toBeNull();
    expect(draft.legacyPoint).toEqual({ x: null, y: null });
    expect(draft.imagePoint).toEqual({ x: null, y: null });
    expect(draft.confidence).toBe(0.65);
  });

  it("produces skipped source when name is empty", () => {
    const draft = createManualLocationDraft("");
    expect(draft.source).toBe("skipped");
    expect(draft.mapVersion).toBe("manual");
    expect(draft.skipped).toBe(true);
    expect(draft.displayName).toBe("");
    expect(draft.locationArea).toBe("");
    expect(draft.confidence).toBe(0);
  });

  it("treats whitespace-only name as skipped", () => {
    const draft = createManualLocationDraft("   ");
    expect(draft.source).toBe("skipped");
    expect(draft.skipped).toBe(true);
    expect(draft.confidence).toBe(0);
  });

  it("trims surrounding whitespace from name", () => {
    const draft = createManualLocationDraft("  食堂  ");
    expect(draft.source).toBe("manual");
    expect(draft.displayName).toBe("食堂");
    expect(draft.locationArea).toBe("食堂");
  });

  it("sets locationId and note to empty strings", () => {
    const draft = createManualLocationDraft("操场");
    expect(draft.locationId).toBe("");
    expect(draft.note).toBe("");
  });

  it("does not set placeId or place for manual drafts", () => {
    const draft = createManualLocationDraft("操场");
    expect(draft.placeId).toBeUndefined();
    expect(draft.place).toBeUndefined();
  });
});

describe("createMapV2LocationDraft", () => {
  it("produces map_v2 source with gaode_v2 map version", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-001",
      name: "图书馆",
      lat: 30.12345678,
      lng: 120.12345678,
    });
    expect(draft.source).toBe("map_v2");
    expect(draft.mapVersion).toBe("gaode_v2");
    expect(draft.skipped).toBe(false);
    expect(draft.confidence).toBe(0.86);
    expect(draft.locationId).toBe("loc-001");
    expect(draft.displayName).toBe("图书馆");
    expect(draft.locationArea).toBe("图书馆");
  });

  it("rounds coordinates to 7 decimal places", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-002",
      name: "食堂",
      lat: 30.123456789,
      lng: 120.987654321,
    });
    expect(draft.lat).toBe(30.1234568);
    expect(draft.lng).toBe(120.9876543);
  });

  it("attaches provided place ref directly", () => {
    const place = { id: "p1", name: "图书馆", type: "library" };
    const draft = createMapV2LocationDraft({
      locationId: "loc-003",
      name: "图书馆",
      lat: 30.0,
      lng: 120.0,
      place,
    });
    expect(draft.place).toBe(place);
    expect(draft.placeId).toBe("p1");
  });

  it("creates synthetic place from placeId when no place ref given", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-004",
      name: "教学楼A",
      lat: 30.0,
      lng: 120.0,
      placeId: "p2",
    });
    expect(draft.placeId).toBe("p2");
    expect(draft.place).toEqual({ id: "p2", name: "教学楼A", type: undefined });
  });

  it("uses place.id over placeId when both provided", () => {
    const place = { id: "p-from-place", name: "图书馆" };
    const draft = createMapV2LocationDraft({
      locationId: "loc-005",
      name: "图书馆",
      lat: 30.0,
      lng: 120.0,
      placeId: "p-from-id",
      place,
    });
    expect(draft.placeId).toBe("p-from-place");
  });

  it("sets default note when none provided", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-006",
      name: "操场",
      lat: 30.0,
      lng: 120.0,
    });
    expect(draft.note).toBe("Vue MapV2 location selection");
  });

  it("uses custom note when provided", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-007",
      name: "操场",
      lat: 30.0,
      lng: 120.0,
      note: "custom note",
    });
    expect(draft.note).toBe("custom note");
  });

  it("sets coordinate fields to null for legacyPoint and imagePoint", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-008",
      name: "图书馆",
      lat: 30.0,
      lng: 120.0,
    });
    expect(draft.legacyPoint).toEqual({ x: null, y: null });
    expect(draft.imagePoint).toEqual({ x: null, y: null });
  });
});

describe("buildPublishPayload", () => {
  const baseInput = {
    imageUrls: ["https://cdn.test/a.jpg"],
    title: "测试标题",
    body: "测试内容",
    tag: "#test",
    visibility: "public" as const,
  };

  it("falls back to manual draft when no locationDraft provided", () => {
    const payload = buildPublishPayload({
      ...baseInput,
      placeName: "图书馆三楼",
    });
    expect(payload.locationDraft.source).toBe("manual");
    expect(payload.locationDraft.mapVersion).toBe("manual");
    expect(payload.locationDraft.skipped).toBe(false);
    expect(payload.aiMode).toBe("manual-vue");
    expect(payload.metadata.locationArea).toBe("图书馆三楼");
    expect(payload.metadata.distribution).toContain("map");
  });

  it("falls back to skipped draft when placeName is empty", () => {
    const payload = buildPublishPayload({
      ...baseInput,
      placeName: "",
    });
    expect(payload.locationDraft.source).toBe("skipped");
    expect(payload.locationDraft.skipped).toBe(true);
    expect(payload.metadata.locationArea).toBe("");
    expect(payload.metadata.distribution).not.toContain("map");
    expect(payload.aiMode).toBe("manual-vue");
  });

  it("uses provided map_v2 draft", () => {
    const draft = createMapV2LocationDraft({
      locationId: "loc-100",
      name: "食堂",
      lat: 30.0,
      lng: 120.0,
    });
    const payload = buildPublishPayload({
      ...baseInput,
      placeName: "ignored",
      locationDraft: draft,
    });
    expect(payload.locationDraft.source).toBe("map_v2");
    expect(payload.locationDraft.mapVersion).toBe("gaode_v2");
    expect(payload.aiMode).toBe("manual-vue-map-v2");
    expect(payload.metadata.locationArea).toBe("食堂");
    expect(payload.metadata.distribution).toContain("map");
  });

  it("propagates confidence from the location draft", () => {
    const manual = buildPublishPayload({ ...baseInput, placeName: "操场" });
    expect(manual.confidence).toBe(0.65);

    const skipped = buildPublishPayload({ ...baseInput, placeName: "" });
    expect(skipped.confidence).toBe(0);

    const mapDraft = createMapV2LocationDraft({
      locationId: "loc-101",
      name: "图书馆",
      lat: 30.0,
      lng: 120.0,
    });
    const map = buildPublishPayload({ ...baseInput, placeName: "x", locationDraft: mapDraft });
    expect(map.confidence).toBe(0.86);
  });

  it("excludes 'map' from distribution when locationArea is empty", () => {
    const payload = buildPublishPayload({ ...baseInput, placeName: "" });
    expect(payload.metadata.distribution).toEqual(["home", "search", "detail"]);
  });

  it("includes 'map' in distribution when locationArea is present", () => {
    const payload = buildPublishPayload({ ...baseInput, placeName: "操场" });
    expect(payload.metadata.distribution).toEqual(["home", "map", "search", "detail"]);
  });

  it("normalizes tag and identityTag", () => {
    const payload = buildPublishPayload({
      ...baseInput,
      tag: "##hello world!",
      identityTag: "  my tag  ",
      placeName: "操场",
    });
    expect(payload.tag).toBe("#helloworld");
    expect(payload.identityTag).toBe("my tag");
    expect(payload.metadata.primaryTag).toBe("#helloworld");
    expect(payload.metadata.identityTag).toBe("my tag");
  });

  it("sets needsHumanReview to false", () => {
    const payload = buildPublishPayload({ ...baseInput, placeName: "" });
    expect(payload.needsHumanReview).toBe(false);
  });

  it("passes through aliasId", () => {
    const payload = buildPublishPayload({
      ...baseInput,
      placeName: "",
      aliasId: "alias-123",
    });
    expect(payload.aliasId).toBe("alias-123");
  });

  it("trims title and body", () => {
    const payload = buildPublishPayload({
      ...baseInput,
      title: "  标题  ",
      body: "  内容  ",
      placeName: "",
    });
    expect(payload.title).toBe("标题");
    expect(payload.body).toBe("内容");
  });

  // #645 — nat100 普通帖 text-only 发布失败的根因是后端
  // /api/ai/post-publish 在 normalizeAiPostPayload 里硬连线了
  // requireImage: true。前端 payload 结构本身已经是合法的（无图时
  // imageUrl 为 "", imageUrls 为 []），这条用例锁定该契约，避免后端
  // 解除门槛后前端被回归改坏。
  it("supports text-only ordinary publish with empty imageUrls", () => {
    const payload = buildPublishPayload({
      imageUrls: [],
      title: "纯文字标题",
      body: "纯文字正文，无图发布。",
      tag: "",
      visibility: "public",
      placeName: "",
    });
    expect(payload.imageUrl).toBe("");
    expect(payload.imageUrls).toEqual([]);
    expect(payload.title).toBe("纯文字标题");
    expect(payload.body).toBe("纯文字正文，无图发布。");
    expect(payload.aiMode).toBe("manual-vue");
    expect(payload.metadata.visibility).toBe("public");
    expect(payload.metadata.distribution).toEqual(["home", "search", "detail"]);
    expect(payload.metadata.presentationIntent).toBeUndefined();
    expect(payload).not.toHaveProperty("contentType");
    expect(payload).not.toHaveProperty("merchant");
    expect(payload).not.toHaveProperty("trade");
    expect(payload.locationDraft.skipped).toBe(true);
    expect(payload.locationDraft.source).toBe("skipped");
    expect(payload.needsHumanReview).toBe(false);
    expect(payload.riskFlags).toEqual([]);
  });

  it("preserves text-only shape when a manual location is attached", () => {
    const payload = buildPublishPayload({
      imageUrls: [],
      title: "纯文字+地点",
      body: "无图但带地点。",
      tag: "",
      visibility: "public",
      placeName: "图书馆三楼",
    });
    expect(payload.imageUrl).toBe("");
    expect(payload.imageUrls).toEqual([]);
    expect(payload.locationDraft.source).toBe("manual");
    expect(payload.metadata.locationArea).toBe("图书馆三楼");
    expect(payload.metadata.distribution).toContain("map");
  });
});
