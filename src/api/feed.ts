import { apiGet } from "./http";
import { UNTITLED_CONTENT } from "../config/brand";
import {
  asBoolean,
  asNumber,
  normalizeFeedItemId as normalizeFeedItemIdNum,
} from "../platform/api-normalizers";
import type {
  FeedItem,
  FeedItemCardTemplateSource,
  FeedPresentationIntent,
  FeedQuery,
  FeedResponse,
  FeedTab,
} from "../types/feed";

export const DEFAULT_TABS: FeedTab[] = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];

const CARD_TEMPLATES: ReadonlySet<FeedPresentationIntent> = new Set([
  "image",
  "text",
  "activity",
  "place",
  "merchant",
  "help",
]);
const CONTENT_TYPE_CARD_TEMPLATES: Readonly<Record<string, FeedPresentationIntent>> = {
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

function readableText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readableText(record.label || record.name || record.title || record.id);
  }
  return "";
}

function normalizeTabs(value: unknown): FeedTab[] {
  if (!Array.isArray(value)) return DEFAULT_TABS;

  const tabs = value
    .map((entry) => {
      const label = readableText(entry);
      const id =
        typeof entry === "object" && entry
          ? readableText((entry as Record<string, unknown>).id) || label
          : label;
      return id && label ? { id, label } : null;
    })
    .filter((tab): tab is FeedTab => Boolean(tab));

  return tabs.length ? tabs : DEFAULT_TABS;
}

function normalizeFeedPresentationIntent(value: unknown): FeedPresentationIntent | null {
  return typeof value === "string" && CARD_TEMPLATES.has(value as FeedPresentationIntent)
    ? (value as FeedPresentationIntent)
    : null;
}

function normalizeFeedContentType(value: unknown): string {
  return readableText(value).toLowerCase();
}

export function normalizeFeedCardTemplate(
  item: Pick<FeedItem, "cover" | "contentType" | "presentationIntent" | "cardTemplate">,
): {
  cardTemplate: FeedPresentationIntent;
  cardTemplateSource: FeedItemCardTemplateSource;
  presentationIntent: FeedPresentationIntent | null;
} {
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

export function normalizeFeedItem(value: unknown): FeedItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const cover = readableText(record.cover || record.coverUrl || record.image || record.imageUrl);
  const contentType = normalizeFeedContentType(
    record.contentType || record.category || record.type,
  );
  const { cardTemplate, cardTemplateSource, presentationIntent } = normalizeFeedCardTemplate({
    cover,
    contentType,
    presentationIntent: record.presentationIntent as
      | FeedPresentationIntent
      | string
      | null
      | undefined,
    cardTemplate: record.cardTemplate as FeedPresentationIntent | null | undefined,
  });

  return {
    tid: normalizeFeedItemIdNum(record.tid || record.id),
    title: readableText(record.title) || UNTITLED_CONTENT,
    bodyPreview: readableText(
      record.bodyPreview || record.summary || record.excerpt || record.body,
    ),
    cover,
    primaryTag: readableText(record.primaryTag || record.tag),
    actor:
      typeof record.actor === "object" && record.actor
        ? (record.actor as FeedItem["actor"])
        : undefined,
    source:
      typeof record.source === "object" && record.source
        ? (record.source as FeedItem["source"])
        : undefined,
    timeLabel: readableText(record.timeLabel || record.timeAgo) || "刚刚",
    timestampISO: readableText(record.timestampISO || record.timestamp || record.createdAt),
    likeCount: Math.max(0, asNumber(record.likeCount || record.likes, 0)),
    liked: asBoolean(record.liked),
    locationArea:
      readableText(record.locationArea || record.placeLabel || record.location) || "校园",
    contentType,
    presentationIntent,
    cardTemplate,
    cardTemplateSource,
  };
}

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || DEFAULT_TABS[0].id);
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);

  const data = await apiGet<FeedResponse>(`/api/feed?${params.toString()}`);

  return {
    tabs: normalizeTabs(data.tabs),
    items: Array.isArray(data.items)
      ? data.items
          .map((item) => normalizeFeedItem(item))
          .filter((item): item is FeedItem => Boolean(item))
      : [],
    hasMore: Boolean(data.hasMore),
    nextPage: typeof data.nextPage === "number" ? data.nextPage : null,
  };
}
