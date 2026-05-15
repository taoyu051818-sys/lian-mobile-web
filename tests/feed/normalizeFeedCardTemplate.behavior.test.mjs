import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Pure normalization helpers extracted from src/api/feed.ts for behavioral testing.
// These mirror the production logic so node --test can exercise them without TS compilation.

const CARD_TEMPLATES = new Set(["image", "text", "activity", "place", "merchant", "help"]);

const CONTENT_TYPE_CARD_TEMPLATES = {
  image: "image",
  photo: "image",
  gallery: "image",
  text: "text",
  post: "text",
  article: "text",
  discussion: "text",
  activity: "activity",
  event: "activity",
  opportunity: "activity",
  place: "place",
  location: "place",
  map: "place",
  merchant: "merchant",
  shop: "merchant",
  food: "merchant",
  trade: "merchant",
  help: "help",
  support: "help",
  ask: "help",
};

function readableText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    return readableText(value.label || value.name || value.title || value.id);
  }
  return "";
}

function normalizeFeedPresentationIntent(value) {
  return typeof value === "string" && CARD_TEMPLATES.has(value) ? value : null;
}

function normalizeFeedContentType(value) {
  return readableText(value).toLowerCase();
}

function normalizeFeedItemId(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeCount(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeFeedCardTemplate(item) {
  const normalizedServerTemplate =
    normalizeFeedPresentationIntent(item.cardTemplate) ||
    normalizeFeedPresentationIntent(item.presentationIntent);
  if (normalizedServerTemplate) {
    return {
      cardTemplate: normalizedServerTemplate,
      cardTemplateSource: "server",
      presentationIntent: normalizedServerTemplate,
    };
  }

  const normalizedContentType = normalizeFeedContentType(item.contentType);
  const mappedFromContentType = CONTENT_TYPE_CARD_TEMPLATES[normalizedContentType];
  if (mappedFromContentType) {
    return {
      cardTemplate: mappedFromContentType,
      cardTemplateSource: "content-type",
      presentationIntent: null,
    };
  }

  return {
    cardTemplate: item.cover ? "image" : "text",
    cardTemplateSource: "cover-fallback",
    presentationIntent: null,
  };
}

function normalizeFeedItem(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  const cover = readableText(record.cover || record.coverUrl || record.image || record.imageUrl);
  const contentType = normalizeFeedContentType(record.contentType || record.category || record.type);
  const { cardTemplate, cardTemplateSource, presentationIntent } = normalizeFeedCardTemplate({
    cover,
    contentType,
    presentationIntent: record.presentationIntent,
    cardTemplate: record.cardTemplate,
  });

  return {
    tid: normalizeFeedItemId(record.tid || record.id),
    title: readableText(record.title) || "未命名内容",
    bodyPreview: readableText(record.bodyPreview || record.summary || record.excerpt || record.body),
    cover,
    primaryTag: readableText(record.primaryTag || record.tag),
    actor: typeof record.actor === "object" && record.actor ? record.actor : undefined,
    source: typeof record.source === "object" && record.source ? record.source : undefined,
    timeLabel: readableText(record.timeLabel || record.timeAgo) || "刚刚",
    timestampISO: readableText(record.timestampISO || record.timestamp || record.createdAt),
    likeCount: normalizeCount(record.likeCount || record.likes),
    liked: normalizeBoolean(record.liked),
    locationArea: readableText(record.locationArea || record.placeLabel || record.location) || "校园",
    contentType,
    presentationIntent,
    cardTemplate,
    cardTemplateSource,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeFeedCardTemplate: server cardTemplate/presentationIntent priority", () => {
  it("prefers cardTemplate over presentationIntent when both are valid", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: "text",
      cardTemplate: "merchant",
    });
    assert.equal(result.cardTemplate, "merchant");
    assert.equal(result.cardTemplateSource, "server");
    assert.equal(result.presentationIntent, "merchant");
  });

  it("falls back to presentationIntent when cardTemplate is invalid", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: "activity",
      cardTemplate: "invalid-value",
    });
    assert.equal(result.cardTemplate, "activity");
    assert.equal(result.cardTemplateSource, "server");
    assert.equal(result.presentationIntent, "activity");
  });

  it("uses presentationIntent alone when cardTemplate is absent", () => {
    const result = normalizeFeedCardTemplate({
      cover: "https://img.example.com/a.jpg",
      contentType: "photo",
      presentationIntent: "place",
    });
    assert.equal(result.cardTemplate, "place");
    assert.equal(result.cardTemplateSource, "server");
    assert.equal(result.presentationIntent, "place");
  });

  it("server value takes priority over contentType mapping", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "photo",
      presentationIntent: "help",
    });
    assert.equal(result.cardTemplate, "help");
    assert.equal(result.cardTemplateSource, "server");
  });
});

describe("normalizeFeedCardTemplate: known contentType mapping", () => {
  const knownMappings = [
    ["image", "image"],
    ["photo", "image"],
    ["gallery", "image"],
    ["text", "text"],
    ["post", "text"],
    ["article", "text"],
    ["discussion", "text"],
    ["activity", "activity"],
    ["event", "activity"],
    ["opportunity", "activity"],
    ["place", "place"],
    ["location", "place"],
    ["map", "place"],
    ["merchant", "merchant"],
    ["shop", "merchant"],
    ["food", "merchant"],
    ["trade", "merchant"],
    ["help", "help"],
    ["support", "help"],
    ["ask", "help"],
  ];

  for (const [contentType, expected] of knownMappings) {
    it(`maps contentType "${contentType}" to template "${expected}"`, () => {
      const result = normalizeFeedCardTemplate({
        cover: "",
        contentType,
      });
      assert.equal(result.cardTemplate, expected);
      assert.equal(result.cardTemplateSource, "content-type");
      assert.equal(result.presentationIntent, null);
    });
  }

  it("normalizes contentType case-insensitively", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "PHOTO",
    });
    assert.equal(result.cardTemplate, "image");
    assert.equal(result.cardTemplateSource, "content-type");
  });

  it("trims whitespace from contentType before lookup", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "  event  ",
    });
    assert.equal(result.cardTemplate, "activity");
    assert.equal(result.cardTemplateSource, "content-type");
  });
});

describe("normalizeFeedCardTemplate: unknown contentType falls back to cover image/text", () => {
  it("returns image when cover is present and contentType is unknown", () => {
    const result = normalizeFeedCardTemplate({
      cover: "https://img.example.com/cover.jpg",
      contentType: "unknown-type",
    });
    assert.equal(result.cardTemplate, "image");
    assert.equal(result.cardTemplateSource, "cover-fallback");
    assert.equal(result.presentationIntent, null);
  });

  it("returns text when cover is empty and contentType is unknown", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "unknown-type",
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "cover-fallback");
    assert.equal(result.presentationIntent, null);
  });

  it("returns text when cover is empty string and contentType is unknown", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "bogus",
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });
});

describe("normalizeFeedCardTemplate: null/undefined/empty input handling", () => {
  it("treats null cardTemplate as absent and checks presentationIntent", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: "image",
      cardTemplate: null,
    });
    assert.equal(result.cardTemplate, "image");
    assert.equal(result.cardTemplateSource, "server");
  });

  it("treats undefined cardTemplate as absent and checks presentationIntent", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: "text",
      cardTemplate: undefined,
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "server");
  });

  it("treats null presentationIntent as absent", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: null,
      cardTemplate: null,
    });
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats undefined presentationIntent as absent", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats empty string cardTemplate as invalid (not in CARD_TEMPLATES)", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      cardTemplate: "",
    });
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats empty string presentationIntent as invalid", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: "",
    });
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats empty contentType as unknown (falls back)", () => {
    const result = normalizeFeedCardTemplate({
      cover: "https://img.example.com/a.jpg",
      contentType: "",
    });
    assert.equal(result.cardTemplate, "image");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats non-string cardTemplate as invalid", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      cardTemplate: 42,
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats non-string presentationIntent as invalid", () => {
    const result = normalizeFeedCardTemplate({
      cover: "",
      contentType: "",
      presentationIntent: { foo: "bar" },
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats whitespace-only cover as truthy (raw string, no trim in normalizeFeedCardTemplate)", () => {
    const result = normalizeFeedCardTemplate({
      cover: "   ",
      contentType: "",
    });
    // normalizeFeedCardTemplate checks item.cover truthiness directly;
    // cover is trimmed by readableText in normalizeFeedItem before reaching here.
    assert.equal(result.cardTemplate, "image");
    assert.equal(result.cardTemplateSource, "cover-fallback");
  });

  it("treats cover trimmed to empty by normalizeFeedItem as falsy via full pipeline", () => {
    const item = normalizeFeedItem({ id: 1, cover: "   ", contentType: "unknown-type" });
    assert.equal(item.cover, "");
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "cover-fallback");
  });
});

describe("normalizeFeedItem: edge cases", () => {
  it("returns null for null input", () => {
    assert.equal(normalizeFeedItem(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(normalizeFeedItem(undefined), null);
  });

  it("returns null for primitive input", () => {
    assert.equal(normalizeFeedItem("string"), null);
    assert.equal(normalizeFeedItem(42), null);
    assert.equal(normalizeFeedItem(true), null);
  });

  it("defaults title to fallback when missing", () => {
    const item = normalizeFeedItem({ id: 1 });
    assert.equal(item.title, "未命名内容");
  });

  it("defaults timeLabel to fallback when missing", () => {
    const item = normalizeFeedItem({ id: 1 });
    assert.equal(item.timeLabel, "刚刚");
  });

  it("defaults locationArea to fallback when missing", () => {
    const item = normalizeFeedItem({ id: 1 });
    assert.equal(item.locationArea, "校园");
  });

  it("uses tid over id when both present", () => {
    const item = normalizeFeedItem({ tid: 100, id: 200 });
    assert.equal(item.tid, 100);
  });

  it("falls back to id when tid is absent", () => {
    const item = normalizeFeedItem({ id: 42 });
    assert.equal(item.tid, 42);
  });

  it("returns 0 tid when neither tid nor id is a valid number", () => {
    const item = normalizeFeedItem({ tid: "abc", id: "xyz" });
    assert.equal(item.tid, 0);
  });

  it("normalizes card template from server fields in feed item", () => {
    const item = normalizeFeedItem({
      id: 1,
      cardTemplate: "merchant",
      contentType: "photo",
      cover: "https://img.example.com/a.jpg",
    });
    assert.equal(item.cardTemplate, "merchant");
    assert.equal(item.cardTemplateSource, "server");
    assert.equal(item.presentationIntent, "merchant");
  });

  it("normalizes card template from contentType when no server field", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "event",
    });
    assert.equal(item.cardTemplate, "activity");
    assert.equal(item.cardTemplateSource, "content-type");
    assert.equal(item.presentationIntent, null);
  });

  it("normalizes card template to cover-fallback for unknown contentType", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "unknown",
      cover: "https://img.example.com/a.jpg",
    });
    assert.equal(item.cardTemplate, "image");
    assert.equal(item.cardTemplateSource, "cover-fallback");
    assert.equal(item.presentationIntent, null);
  });

  it("normalizes card template to text fallback when no cover", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "unknown",
    });
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "cover-fallback");
  });

  it("reads cover from coverUrl alias", () => {
    const item = normalizeFeedItem({ id: 1, coverUrl: "https://img.example.com/b.jpg" });
    assert.equal(item.cover, "https://img.example.com/b.jpg");
  });

  it("reads cover from image alias", () => {
    const item = normalizeFeedItem({ id: 1, image: "https://img.example.com/c.jpg" });
    assert.equal(item.cover, "https://img.example.com/c.jpg");
  });

  it("reads cover from imageUrl alias", () => {
    const item = normalizeFeedItem({ id: 1, imageUrl: "https://img.example.com/d.jpg" });
    assert.equal(item.cover, "https://img.example.com/d.jpg");
  });

  it("reads contentType from category alias", () => {
    const item = normalizeFeedItem({ id: 1, category: "photo" });
    assert.equal(item.contentType, "photo");
    assert.equal(item.cardTemplate, "image");
  });

  it("reads contentType from type alias", () => {
    const item = normalizeFeedItem({ id: 1, type: "event" });
    assert.equal(item.contentType, "event");
    assert.equal(item.cardTemplate, "activity");
  });

  it("reads bodyPreview from summary alias", () => {
    const item = normalizeFeedItem({ id: 1, summary: "Hello" });
    assert.equal(item.bodyPreview, "Hello");
  });

  it("reads bodyPreview from excerpt alias", () => {
    const item = normalizeFeedItem({ id: 1, excerpt: "World" });
    assert.equal(item.bodyPreview, "World");
  });

  it("reads bodyPreview from body alias", () => {
    const item = normalizeFeedItem({ id: 1, body: "Content" });
    assert.equal(item.bodyPreview, "Content");
  });

  it("reads primaryTag from tag alias", () => {
    const item = normalizeFeedItem({ id: 1, tag: "food" });
    assert.equal(item.primaryTag, "food");
  });

  it("reads timeLabel from timeAgo alias", () => {
    const item = normalizeFeedItem({ id: 1, timeAgo: "3分钟前" });
    assert.equal(item.timeLabel, "3分钟前");
  });

  it("reads timestampISO from timestamp alias", () => {
    const item = normalizeFeedItem({ id: 1, timestamp: "2025-01-01T00:00:00Z" });
    assert.equal(item.timestampISO, "2025-01-01T00:00:00Z");
  });

  it("reads timestampISO from createdAt alias", () => {
    const item = normalizeFeedItem({ id: 1, createdAt: "2025-06-01T12:00:00Z" });
    assert.equal(item.timestampISO, "2025-06-01T12:00:00Z");
  });

  it("reads likeCount from likes alias", () => {
    const item = normalizeFeedItem({ id: 1, likes: 5 });
    assert.equal(item.likeCount, 5);
  });

  it("clamps negative likeCount to 0", () => {
    const item = normalizeFeedItem({ id: 1, likeCount: -3 });
    assert.equal(item.likeCount, 0);
  });

  it("reads locationArea from placeLabel alias", () => {
    const item = normalizeFeedItem({ id: 1, placeLabel: "图书馆" });
    assert.equal(item.locationArea, "图书馆");
  });

  it("reads locationArea from location alias", () => {
    const item = normalizeFeedItem({ id: 1, location: "操场" });
    assert.equal(item.locationArea, "操场");
  });

  it("preserves actor object when present", () => {
    const actor = { displayName: "小明", id: "u1" };
    const item = normalizeFeedItem({ id: 1, actor });
    assert.deepEqual(item.actor, actor);
  });

  it("sets actor to undefined when not an object", () => {
    const item = normalizeFeedItem({ id: 1, actor: "string" });
    assert.equal(item.actor, undefined);
  });

  it("preserves source object when present", () => {
    const source = { provider: "test", label: "Test" };
    const item = normalizeFeedItem({ id: 1, source });
    assert.deepEqual(item.source, source);
  });

  it("sets source to undefined when not an object", () => {
    const item = normalizeFeedItem({ id: 1, source: 123 });
    assert.equal(item.source, undefined);
  });

  it("normalizes liked from string 'true'", () => {
    const item = normalizeFeedItem({ id: 1, liked: "true" });
    assert.equal(item.liked, true);
  });

  it("normalizes liked from number 1", () => {
    const item = normalizeFeedItem({ id: 1, liked: 1 });
    assert.equal(item.liked, true);
  });

  it("normalizes liked from string '1'", () => {
    const item = normalizeFeedItem({ id: 1, liked: "1" });
    assert.equal(item.liked, true);
  });

  it("returns false for liked when value is falsy", () => {
    const item = normalizeFeedItem({ id: 1, liked: false });
    assert.equal(item.liked, false);
  });

  it("handles empty object input with all defaults", () => {
    const item = normalizeFeedItem({});
    assert.equal(item.tid, 0);
    assert.equal(item.title, "未命名内容");
    assert.equal(item.bodyPreview, "");
    assert.equal(item.cover, "");
    assert.equal(item.primaryTag, "");
    assert.equal(item.timeLabel, "刚刚");
    assert.equal(item.timestampISO, "");
    assert.equal(item.likeCount, 0);
    assert.equal(item.liked, false);
    assert.equal(item.locationArea, "校园");
    assert.equal(item.contentType, "");
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "cover-fallback");
    assert.equal(item.presentationIntent, null);
  });

  it("does not guess title/tag/place from cover URL substrings", () => {
    const item = normalizeFeedItem({
      id: 1,
      cover: "https://img.example.com/food/restaurant-cover.jpg",
    });
    assert.equal(item.primaryTag, "");
    assert.equal(item.title, "未命名内容");
    assert.equal(item.locationArea, "校园");
  });
});
