import type { DisplayActor, SourceSignal } from "../types/feed";
import type { PlaceRef, PlaceStatus } from "../types/place";
import type { Audience } from "../types/audience";
import { normalizeAudience } from "../types/audience";
import type {
  EventJoinPolicy,
  EventPostExtension,
  EventReward,
  EventStatus,
  HelpPostExtension,
  HelpStatus,
} from "../types/post-extensions";
import type { PostLocation } from "../types/post";

type JsonRecord = Record<string, unknown>;

const PLACE_STATUSES = new Set<PlaceStatus>([
  "confirmed",
  "pending",
  "disputed",
  "expired",
  "ai-organized",
  "official",
]);

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asString(entry)).filter((entry) => entry.length > 0);
}

export function normalizeFeedItemId(value: unknown, fallback = 0): number {
  const normalized = Math.trunc(asNumber(value, Number.NaN));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function optionalString(value: unknown): string | undefined {
  const normalized = asString(value);
  return normalized || undefined;
}

export function normalizeDisplayActor(value: unknown): DisplayActor | undefined {
  const record = asRecord(value);
  const actor: DisplayActor = {};

  const id = optionalString(record.id);
  const displayName = optionalString(record.displayName);
  const username = optionalString(record.username);
  const name = optionalString(record.name);
  const avatarUrl = optionalString(record.avatarUrl);
  const avatarText = optionalString(record.avatarText);
  const identityTag = optionalString(record.identityTag);

  if (id) actor.id = id;
  if (displayName) actor.displayName = displayName;
  if (username) actor.username = username;
  if (name) actor.name = name;
  if (avatarUrl) actor.avatarUrl = avatarUrl;
  if (avatarText) actor.avatarText = avatarText;
  if (identityTag) actor.identityTag = identityTag;

  return Object.keys(actor).length ? actor : undefined;
}

export function normalizeSourceSignal(value: unknown): SourceSignal | undefined {
  const record = asRecord(value);
  const source: SourceSignal = {};

  const provider = optionalString(record.provider);
  const label = optionalString(record.label);

  if (provider) source.provider = provider;
  if (label) source.label = label;
  if ("visible" in record) source.visible = asBoolean(record.visible);

  return Object.keys(source).length ? source : undefined;
}

export function normalizePlaceRef(value: unknown): PlaceRef | undefined {
  const record = asRecord(value);
  const id = optionalString(record.id);
  const name = optionalString(record.name);

  if (!id || !name) return undefined;

  const type = optionalString(record.type);
  const rawStatus = optionalString(record.status);
  const status =
    rawStatus && PLACE_STATUSES.has(rawStatus as PlaceStatus)
      ? (rawStatus as PlaceStatus)
      : undefined;

  return {
    id,
    name,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
}

const EVENT_STATUSES: ReadonlySet<EventStatus> = new Set([
  "open",
  "full",
  "closed",
  "completed",
  "cancelled",
]);

const EVENT_JOIN_POLICIES: ReadonlySet<EventJoinPolicy> = new Set([
  "open",
  "approval_required",
  "org_only",
  "school_only",
]);

const EVENT_REWARD_TYPES: ReadonlySet<EventReward["type"]> = new Set([
  "contribution",
  "honor",
  "coupon",
  "credit",
  "custom",
]);

function normalizeEventReward(value: unknown): EventReward | undefined {
  const record = asRecord(value);
  const rawType = optionalString(record.type);
  if (!rawType || !EVENT_REWARD_TYPES.has(rawType as EventReward["type"])) return undefined;
  const reward: EventReward = { type: rawType as EventReward["type"] };
  if (typeof record.amount === "number" && Number.isFinite(record.amount)) {
    reward.amount = record.amount;
  } else if (typeof record.amount === "string" && record.amount.trim()) {
    const parsed = Number(record.amount);
    if (Number.isFinite(parsed)) reward.amount = parsed;
  }
  const label = optionalString(record.label);
  if (label) reward.label = label;
  return reward;
}

function normalizePostLocation(value: unknown): PostLocation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const placeId = asString(record.placeId);
  const label = asString(record.label);
  if (!placeId && !label) return undefined;
  const lat = typeof record.lat === "number" && Number.isFinite(record.lat) ? record.lat : null;
  const lng = typeof record.lng === "number" && Number.isFinite(record.lng) ? record.lng : null;
  return {
    placeId,
    label,
    lat,
    lng,
    place: normalizePlaceRef(record.place),
  };
}

/**
 * Coerce a raw payload into an EventPostExtension. Returns undefined when the
 * payload does not look like an event (no eventId or unknown status). Never
 * throws — callers can render the post even when the event extension is
 * missing or malformed.
 */
export function normalizeEventExtension(value: unknown): EventPostExtension | undefined {
  const record = asRecord(value);
  const eventId = optionalString(record.eventId);
  if (!eventId) return undefined;
  const rawStatus = optionalString(record.eventStatus);
  if (!rawStatus || !EVENT_STATUSES.has(rawStatus as EventStatus)) return undefined;
  const rawJoin = optionalString(record.joinPolicy);
  const joinPolicy: EventJoinPolicy = EVENT_JOIN_POLICIES.has(rawJoin as EventJoinPolicy)
    ? (rawJoin as EventJoinPolicy)
    : "open";
  const participantScope: Audience = normalizeAudience(record.participantScope);
  const allowedOrganizations = asStringArray(record.allowedOrganizations);
  const reward = normalizeEventReward(record.reward);
  const startAt = optionalString(record.startAt);
  const endAt = optionalString(record.endAt);
  const location = normalizePostLocation(record.location);
  const capacityRaw = record.capacity;
  let capacity: number | undefined;
  if (typeof capacityRaw === "number" && Number.isFinite(capacityRaw) && capacityRaw >= 0) {
    capacity = Math.trunc(capacityRaw);
  } else if (typeof capacityRaw === "string" && capacityRaw.trim()) {
    const parsed = Number(capacityRaw);
    if (Number.isFinite(parsed) && parsed >= 0) capacity = Math.trunc(parsed);
  }
  const participantCount = Math.max(0, Math.trunc(asNumber(record.participantCount, 0)));

  return {
    eventId,
    participantScope,
    allowedOrganizations,
    ...(reward ? { reward } : {}),
    eventStatus: rawStatus as EventStatus,
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
    ...(location ? { location } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    participantCount,
    joinPolicy,
  };
}

const HELP_STATUSES: ReadonlySet<HelpStatus> = new Set([
  "open",
  "linked_event",
  "resolved",
  "closed",
]);

/**
 * Coerce a raw payload into a HelpPostExtension. Returns undefined when the
 * payload does not look like a help (no helpId or unknown status). Never
 * throws — callers can render the post even when the help extension is
 * missing or malformed.
 */
export function normalizeHelpExtension(value: unknown): HelpPostExtension | undefined {
  const record = asRecord(value);
  const helpId = optionalString(record.helpId);
  if (!helpId) return undefined;
  const rawStatus = optionalString(record.status);
  if (!rawStatus || !HELP_STATUSES.has(rawStatus as HelpStatus)) return undefined;
  const voteCount = Math.max(0, Math.trunc(asNumber(record.voteCount, 0)));
  const commentCount = Math.max(0, Math.trunc(asNumber(record.commentCount, 0)));
  const linkedRaw = record.linkedEventTid;
  let linkedEventTid: number | undefined;
  if (typeof linkedRaw === "number" && Number.isFinite(linkedRaw) && linkedRaw > 0) {
    linkedEventTid = Math.trunc(linkedRaw);
  } else if (typeof linkedRaw === "string" && linkedRaw.trim()) {
    const parsed = Number(linkedRaw);
    if (Number.isFinite(parsed) && parsed > 0) linkedEventTid = Math.trunc(parsed);
  }
  return {
    helpId,
    voteCount,
    commentCount,
    status: rawStatus as HelpStatus,
    ...(linkedEventTid !== undefined ? { linkedEventTid } : {}),
  };
}
