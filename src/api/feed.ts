import type { AudienceVisibility } from "../types/audience";
import type { ClubCategory, ClubMetadata } from "../types/post";
import { apiGet } from "./http";
import { UNTITLED_CONTENT } from "../config/brand";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  extractV2Components,
  normalizeDisplayActor,
  normalizeFeedItemId as normalizeFeedItemIdNum,
  normalizeMetadataComponents,
  normalizeSourceSignal,
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
  "trade",
  "project",
  "review",
  "help",
  "club",
]);
const CONTENT_TYPE_CARD_TEMPLATES: Readonly<Record<string, FeedPresentationIntent>> = {
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

const KNOWN_VISIBILITIES: ReadonlySet<AudienceVisibility> = new Set([
  "public",
  "campus",
  "school",
  "private",
  "linkOnly",
]);
const KNOWN_CLUB_CATEGORIES: ReadonlySet<ClubCategory> = new Set([
  "academic",
  "sports",
  "arts",
  "volunteer",
  "tech",
  "culture",
  "other",
]);

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

function normalizeRawPresentationIntent(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const FEED_RELATION_HINTS: ReadonlySet<string> = new Set([
  "help_event_link",
  "trade_offer_link",
  "event_followup",
  "solution_event",
  "merchant_errand",
  "project_submission",
  "project_review",
  "review_submission",
  "submission_review",
  "event_reward",
  "groupbuy_joined",
  "groupbuy_created",
]);

function normalizeFeedRelationHint(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function relationHintFromRelation(
  relation: NonNullable<FeedItem["relations"]>[number],
): FeedItem["relationHint"] {
  const type = normalizeFeedRelationHint(relation.type);
  return type ? { type, targetTid: relation.targetTid } : undefined;
}

function deriveFeedRelationHint(
  relationHint: string | undefined,
  relations: FeedItem["relations"],
): FeedItem["relationHint"] {
  if (relationHint) return { type: relationHint };
  const knownRelation = relations
    ?.map(relationHintFromRelation)
    .find((hint) => hint && FEED_RELATION_HINTS.has(hint.type));
  if (knownRelation) return knownRelation;
  return relations?.map(relationHintFromRelation).find(Boolean);
}

function normalizeFeedContentType(value: unknown): string {
  return readableText(value).toLowerCase();
}

function normalizeVisibility(value: unknown): AudienceVisibility | undefined {
  return typeof value === "string" && KNOWN_VISIBILITIES.has(value as AudienceVisibility)
    ? value === "public"
      ? undefined
      : (value as AudienceVisibility)
    : undefined;
}

function normalizeClubCategory(value: unknown): ClubCategory {
  return typeof value === "string" && KNOWN_CLUB_CATEGORIES.has(value as ClubCategory)
    ? (value as ClubCategory)
    : "other";
}

function normalizeClubMetadata(value: unknown): ClubMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const clubId = readableText(record.clubId || record.id);
  const name = readableText(record.name || record.title);
  if (!clubId || !name) return undefined;

  const president = readableText(record.president || record.leader);
  const foundedAt = readableText(record.foundedAt || record.createdAt);
  const memberCount = Math.max(0, Math.trunc(asNumber(record.memberCount || record.members, 0)));
  const description = readableText(record.description || record.summary);
  const logoUrl = readableText(
    record.logoUrl || record.avatarUrl || record.coverUrl || record.logo,
  );

  return {
    clubId,
    name,
    category: normalizeClubCategory(record.category),
    president,
    foundedAt,
    memberCount,
    ...(description ? { description } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  };
}

function normalizeFeedRelationTarget(value: unknown): { kind: string; id: string } | undefined {
  const record = asRecord(value);
  const kind = asString(record.kind);
  const id = asString(record.id);
  if (!kind || !id) return undefined;
  return { kind, id };
}

function normalizeFeedPostRelations(value: unknown): FeedItem["relations"] {
  if (!Array.isArray(value)) return undefined;
  const relations = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const type = readableText(record.type);
      if (!type) return null;

      const target = normalizeFeedRelationTarget(record.target);
      if (target?.kind === "post") {
        const targetTid = normalizeFeedItemIdNum(target.id);
        if (targetTid > 0) return { type, targetTid };
      }
      if (target && target.kind !== "post") return { type };

      const legacyTargetTid = normalizeFeedItemIdNum(
        record.targetTid || record.targetId || record.tid,
      );
      if (legacyTargetTid <= 0) return null;
      return { type, targetTid: legacyTargetTid };
    })
    .filter((entry): entry is NonNullable<FeedItem["relations"]>[number] => Boolean(entry));
  return relations.length ? relations : undefined;
}

function normalizeFeedAvailableActions(value: unknown): FeedItem["availableActions"] {
  if (!Array.isArray(value)) return undefined;
  const actions = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const type = readableText(record.type);
      if (!type) return null;
      const enabled = "enabled" in record ? asBoolean(record.enabled) : undefined;
      const reason = readableText(record.reason);
      const reasonText = readableText(record.reasonText);
      return {
        type,
        ...(enabled !== undefined ? { enabled } : {}),
        ...(reason ? { reason } : {}),
        ...(reasonText ? { reasonText } : {}),
      };
    })
    .filter((entry): entry is NonNullable<FeedItem["availableActions"]>[number] => Boolean(entry));
  return actions.length ? actions : undefined;
}

function normalizeFeedRelations(value: unknown): FeedItem["relations"] {
  return normalizeFeedPostRelations(value);
}

export function normalizeFeedCardTemplate(
  item: Pick<FeedItem, "cover" | "contentType" | "presentationIntent" | "cardTemplate">,
): {
  cardTemplate: FeedPresentationIntent;
  cardTemplateSource: FeedItemCardTemplateSource;
  presentationIntent: string | null;
} {
  const rawPresentationIntent = normalizeRawPresentationIntent(item.presentationIntent);
  const normalizedServerTemplate = normalizeFeedPresentationIntent(item.cardTemplate);
  if (normalizedServerTemplate) {
    return {
      cardTemplate: normalizedServerTemplate,
      cardTemplateSource: "server",
      presentationIntent: normalizedServerTemplate,
    };
  }
  if (rawPresentationIntent) {
    const knownIntent = normalizeFeedPresentationIntent(rawPresentationIntent);
    return {
      cardTemplate: knownIntent || "text",
      cardTemplateSource: "server",
      presentationIntent: rawPresentationIntent,
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
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : undefined;
  const club = normalizeClubMetadata(record.club || metadata?.club);
  const contentType = normalizeFeedContentType(
    record.contentType || record.category || record.type || (club ? "club" : undefined),
  );
  const visibility = normalizeVisibility(
    record.visibility || metadata?.visibility || metadata?.audienceVisibility,
  );
  const { cardTemplate, cardTemplateSource, presentationIntent } = normalizeFeedCardTemplate({
    cover,
    contentType,
    presentationIntent:
      normalizeRawPresentationIntent(record.presentationIntent) ||
      normalizeRawPresentationIntent(metadata?.presentationIntent),
    cardTemplate: record.cardTemplate as FeedPresentationIntent | null | undefined,
  });
  const components = normalizeMetadataComponents(record) ?? extractV2Components(record);
  const relations = normalizeFeedRelations(record.relations ?? metadata?.relations);
  const relationHint = deriveFeedRelationHint(
    normalizeFeedRelationHint(record.relationHint || metadata?.relationHint),
    relations,
  );
  const availableActions = normalizeFeedAvailableActions(
    record.availableActions ?? metadata?.availableActions,
  );

  return {
    tid: normalizeFeedItemIdNum(record.tid || record.id),
    title: readableText(record.title) || UNTITLED_CONTENT,
    bodyPreview: readableText(
      record.bodyPreview || record.summary || record.excerpt || record.body,
    ),
    cover,
    primaryTag: readableText(record.primaryTag || record.tag),
    actor: normalizeDisplayActor(record.actor || record.user),
    source: normalizeSourceSignal(record.source),
    timeLabel: readableText(record.timeLabel || record.timeAgo) || "刚刚",
    timestampISO: readableText(record.timestampISO || record.timestamp || record.createdAt),
    likeCount: Math.max(0, asNumber(record.likeCount || record.likes, 0)),
    liked: asBoolean(record.liked),
    bookmarked: asBoolean(record.bookmarked ?? record.saved),
    locationArea:
      readableText(record.locationArea || record.placeLabel || record.location) || "校园",
    contentType,
    presentationIntent,
    cardTemplate,
    cardTemplateSource,
    ...(relationHint ? { relationHint } : {}),
    ...(components?.length ? { components } : {}),
    ...(relations?.length ? { relations } : {}),
    ...(availableActions?.length ? { availableActions } : {}),
    ...(club ? { club } : {}),
    ...(visibility && visibility !== "public" ? { visibility } : {}),
  };
}

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || DEFAULT_TABS[0].id);
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);
  if (query.visibility?.length) params.set("visibility", query.visibility.join(","));

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
