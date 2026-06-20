import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Pure normalization helpers extracted from src/api/feed.ts for behavioral testing.
// These mirror the production logic so node --test can exercise them without TS compilation.

const CARD_TEMPLATES = new Set([
  "image",
  "text",
  "activity",
  "place",
  "merchant",
  "trade",
  "project",
  "review",
  "help",
  "club",
]);

const CONTENT_TYPE_CARD_TEMPLATES = {
  image: "image",
  photo: "image",
  gallery: "image",
  text: "text",
  post: "text",
  article: "text",
  discussion: "text",
  project: "project",
  review: "review",
  submission: "text",
  activity: "activity",
  event: "activity",
  opportunity: "activity",
  place: "place",
  location: "place",
  map: "place",
  merchant: "merchant",
  shop: "merchant",
  food: "merchant",
  trade: "trade",
  help: "help",
  support: "help",
  ask: "help",
  club: "club",
};

const INTENT_SIGNAL_LABELS = {
  trade: "二手交易",
  project: "项目",
  review: "评价",
};
const INTENT_SIGNAL_TYPES = new Set(["trade", "project", "review"]);
const TRADE_STATE_LABELS = {
  available: "在售",
  reserved: "已预订",
  sold: "已出售",
  cancelled: "已取消",
  hidden: "已隐藏",
};

function readableText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    return readableText(value.label || value.name || value.title || value.id);
  }
  return "";
}

function normalizeFeedPresentationTemplate(value) {
  const intent = normalizeFeedPresentationIntent(value);
  return intent && CARD_TEMPLATES.has(intent) ? intent : null;
}

function normalizeFeedPresentationIntent(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeFeedContentType(value) {
  return readableText(value).toLowerCase();
}

function normalizeFeedRelationTarget(value) {
  if (!value || typeof value !== "object") return undefined;
  const kind = readableText(value.kind);
  const id = readableText(value.id);
  if (!kind || !id) return undefined;
  return { kind, id };
}

function normalizeFeedRelations(value) {
  if (!Array.isArray(value)) return undefined;
  const relations = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const type = readableText(entry.type);
      if (!type) return null;

      const target = normalizeFeedRelationTarget(entry.target);
      if (target?.kind === "post") {
        const targetTid = normalizeFeedItemId(target.id);
        if (targetTid > 0) return { type, targetTid };
      }

      const targetTid = normalizeFeedItemId(entry.targetTid || entry.targetId || entry.tid);
      if (targetTid <= 0) return null;
      return { type, targetTid };
    })
    .filter(Boolean);
  return relations.length ? relations : undefined;
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
  const normalizedServerTemplate = normalizeFeedPresentationTemplate(item.cardTemplate);
  const normalizedServerIntent = normalizeFeedPresentationIntent(item.presentationIntent);
  if (normalizedServerTemplate || normalizedServerIntent) {
    return {
      cardTemplate:
        normalizedServerTemplate ||
        normalizeFeedPresentationTemplate(normalizedServerIntent) ||
        "text",
      cardTemplateSource: "server",
      presentationIntent: normalizedServerIntent,
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
  const contentType = normalizeFeedContentType(
    record.contentType || record.category || record.type,
  );
  const metadata =
    record.metadata && typeof record.metadata === "object" ? record.metadata : undefined;
  const presentationIntentInput =
    normalizeFeedPresentationIntent(record.presentationIntent) ||
    normalizeFeedPresentationIntent(metadata?.presentationIntent);
  const { cardTemplate, cardTemplateSource, presentationIntent } = normalizeFeedCardTemplate({
    cover,
    contentType,
    presentationIntent: presentationIntentInput,
    cardTemplate: normalizeFeedPresentationTemplate(record.cardTemplate),
  });

  return {
    tid: normalizeFeedItemId(record.tid || record.id),
    title: readableText(record.title) || "未命名内容",
    bodyPreview: readableText(
      record.bodyPreview || record.summary || record.excerpt || record.body,
    ),
    cover,
    primaryTag: readableText(record.primaryTag || record.tag),
    actor: typeof record.actor === "object" && record.actor ? record.actor : undefined,
    source: typeof record.source === "object" && record.source ? record.source : undefined,
    timeLabel: readableText(record.timeLabel || record.timeAgo) || "刚刚",
    timestampISO: readableText(record.timestampISO || record.timestamp || record.createdAt),
    likeCount: normalizeCount(record.likeCount || record.likes),
    liked: normalizeBoolean(record.liked),
    locationArea:
      readableText(record.locationArea || record.placeLabel || record.location) || "校园",
    contentType,
    presentationIntent,
    cardTemplate,
    cardTemplateSource,
    relations: normalizeFeedRelations(record.relations ?? metadata?.relations),
  };
}

function resolveTradeStateLabel(components) {
  const trade = components?.find((component) => component.type === "trade");
  return trade?.state ? TRADE_STATE_LABELS[trade.state] : undefined;
}

function buildIntentSignal(intent, components) {
  const stateLabel = intent === "trade" ? resolveTradeStateLabel(components) : undefined;
  return {
    label: INTENT_SIGNAL_LABELS[intent] ?? intent,
    ...(stateLabel ? { stateLabel } : {}),
  };
}

function resolveIntentSignal(item) {
  const explicitIntent =
    typeof item.presentationIntent === "string" ? item.presentationIntent.trim() : "";
  const contentIntent = typeof item.contentType === "string" ? item.contentType.trim() : "";
  const knownExplicitIntent = INTENT_SIGNAL_TYPES.has(explicitIntent);
  const knownContentIntent = INTENT_SIGNAL_TYPES.has(contentIntent);
  if (knownExplicitIntent) {
    return buildIntentSignal(explicitIntent, item.components);
  }
  if (explicitIntent && !CARD_TEMPLATES.has(explicitIntent)) {
    return { label: explicitIntent };
  }
  if (knownContentIntent) {
    return buildIntentSignal(contentIntent, item.components);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeedItemCard intent signal resolution", () => {
  it("returns Chinese-first labels for known trade/project/review intents", () => {
    assert.deepEqual(
      resolveIntentSignal({
        presentationIntent: "trade",
        components: [{ type: "trade", state: "sold" }],
      }),
      { label: "二手交易", stateLabel: "已出售" },
    );
    assert.deepEqual(resolveIntentSignal({ presentationIntent: "project" }), { label: "项目" });
    assert.deepEqual(resolveIntentSignal({ presentationIntent: "review" }), { label: "评价" });
  });

  it("falls back to known contentType when presentationIntent is absent", () => {
    assert.deepEqual(
      resolveIntentSignal({
        contentType: "trade",
        components: [{ type: "trade", state: "available" }],
      }),
      { label: "二手交易", stateLabel: "在售" },
    );
    assert.deepEqual(resolveIntentSignal({ contentType: "project" }), { label: "项目" });
    assert.deepEqual(resolveIntentSignal({ contentType: "review" }), { label: "评价" });
  });

  it("keeps unknown trade states from adding a state sub-label", () => {
    assert.deepEqual(
      resolveIntentSignal({
        presentationIntent: "trade",
        components: [{ type: "trade", state: "future-state" }],
      }),
      { label: "二手交易" },
    );
  });

  it("does not add intent signal data for ordinary feed cards", () => {
    assert.equal(resolveIntentSignal({ contentType: "post", presentationIntent: null }), null);
    assert.equal(
      resolveIntentSignal({ contentType: "merchant", presentationIntent: "merchant" }),
      null,
    );
  });

  it("keeps unknown explicit presentation intents readable", () => {
    assert.deepEqual(
      resolveIntentSignal({ contentType: "post", presentationIntent: "future-intent" }),
      {
        label: "future-intent",
      },
    );
  });

  it("ignores unknown contentType values when there is no explicit intent", () => {
    assert.equal(resolveIntentSignal({ contentType: "future-intent" }), null);
  });
});

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
    assert.equal(result.presentationIntent, "text");
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
  it("server-declared first-class intents render as their matching templates", () => {
    for (const intent of ["trade", "project", "review"]) {
      const result = normalizeFeedCardTemplate({
        cover: "https://img.example.com/a.jpg",
        contentType: "post",
        presentationIntent: intent,
      });
      assert.equal(result.cardTemplate, intent);
      assert.equal(result.cardTemplateSource, "server");
      assert.equal(result.presentationIntent, intent);
    }
  });

  it("keeps unknown presentationIntent readable while rendering the calm text template", () => {
    const result = normalizeFeedCardTemplate({
      cover: "https://img.example.com/a.jpg",
      contentType: "photo",
      presentationIntent: "future-intent",
    });
    assert.equal(result.cardTemplate, "text");
    assert.equal(result.cardTemplateSource, "server");
    assert.equal(result.presentationIntent, "future-intent");
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
    ["project", "project"],
    ["review", "review"],
    ["submission", "text"],
    ["activity", "activity"],
    ["event", "activity"],
    ["opportunity", "activity"],
    ["place", "place"],
    ["location", "place"],
    ["map", "place"],
    ["merchant", "merchant"],
    ["shop", "merchant"],
    ["food", "merchant"],
    ["trade", "trade"],
    ["help", "help"],
    ["support", "help"],
    ["ask", "help"],
    ["club", "club"],
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
    assert.equal(item.presentationIntent, null);
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

  it("maps first-class intents from contentType without a server field", () => {
    for (const intent of ["trade", "project", "review"]) {
      const item = normalizeFeedItem({ id: 1, contentType: intent });
      assert.equal(item.cardTemplate, intent);
      assert.equal(item.cardTemplateSource, "content-type");
      assert.equal(item.presentationIntent, null);
    }
  });

  it("does not add intent presentation data for ordinary feed cards", () => {
    const item = normalizeFeedItem({ id: 1, contentType: "post" });
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "content-type");
    assert.equal(item.presentationIntent, null);
  });

  it("preserves unknown server intents while using the text template fallback", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "post",
      presentationIntent: "future-intent",
    });
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "server");
    assert.equal(item.presentationIntent, "future-intent");
  });

  it("preserves unknown top-level presentationIntent before metadata fallbacks", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "project",
      presentationIntent: "future-intent",
      metadata: { presentationIntent: "help" },
    });
    assert.equal(item.cardTemplate, "text");
    assert.equal(item.cardTemplateSource, "server");
    assert.equal(item.presentationIntent, "future-intent");
  });

  it("falls back to metadata presentationIntent when top-level presentationIntent is absent", () => {
    const item = normalizeFeedItem({
      id: 1,
      contentType: "project",
      metadata: { presentationIntent: "help" },
    });
    assert.equal(item.cardTemplate, "help");
    assert.equal(item.cardTemplateSource, "server");
    assert.equal(item.presentationIntent, "help");
  });

  it("does not expose identity fields from metadata or relation payloads", () => {
    const item = normalizeFeedItem({
      id: 1,
      title: "项目招募",
      contentType: "project",
      metadata: {
        author: { id: "u-secret", displayName: "不应出现" },
        requesterUserId: "u-requester",
        joinerIds: ["u-a", "u-b"],
        relations: [
          {
            type: "project_submission",
            targetTid: 33,
            actor: { displayName: "关系作者" },
            settledBy: "u-settled",
          },
        ],
      },
    });
    assert.equal(item.actor, undefined);
    assert.deepEqual(item.relations, [{ type: "project_submission", targetTid: 33 }]);
    assert.equal(JSON.stringify(item).includes("u-secret"), false);
    assert.equal(JSON.stringify(item).includes("不应出现"), false);
    assert.equal(JSON.stringify(item).includes("u-requester"), false);
    assert.equal(JSON.stringify(item).includes("u-settled"), false);
  });

  it("normalizes relations with known and unknown types, drops invalid entries", () => {
    const item = normalizeFeedItem({
      id: 1,
      relations: [
        { type: "help_event_link", targetTid: 101 },
        { type: "custom_relation", targetTid: "202" },
        { type: "", targetTid: 303 },
        { type: "event_followup", targetTid: 0 },
        { targetTid: 404 },
      ],
    });
    assert.deepEqual(item.relations, [
      { type: "help_event_link", targetTid: 101 },
      { type: "custom_relation", targetTid: 202 },
    ]);
  });
});

it("keeps relations undefined when source is not an array", () => {
  const item = normalizeFeedItem({ id: 1, relations: { type: "help_event_link", targetTid: 10 } });
  assert.equal(item.relations, undefined);
});

it("keeps relations undefined when array normalizes to empty", () => {
  const item = normalizeFeedItem({ id: 1, relations: [{ type: "", targetTid: 0 }] });
  assert.equal(item.relations, undefined);
});

it("supports nested target payloads in relation entries", () => {
  const item = normalizeFeedItem({
    id: 1,
    relations: [
      { type: "help_event_link", target: { kind: "post", id: 31 } },
      { type: "custom_relation", target: { kind: "user", id: 99 } },
    ],
  });
  assert.deepEqual(item.relations, [{ type: "help_event_link", targetTid: 31 }]);
});

it("supports targetId and tid aliases in relation entries", () => {
  const item = normalizeFeedItem({
    id: 1,
    relations: [
      { type: "trade_offer_link", targetId: 11 },
      { type: "event_followup", tid: 12 },
    ],
  });
  assert.deepEqual(item.relations, [
    { type: "trade_offer_link", targetTid: 11 },
    { type: "event_followup", targetTid: 12 },
  ]);
});

it("trims relation type text", () => {
  const item = normalizeFeedItem({
    id: 1,
    relations: [{ type: "  help_event_link  ", targetTid: 21 }],
  });
  assert.deepEqual(item.relations, [{ type: "help_event_link", targetTid: 21 }]);
});
