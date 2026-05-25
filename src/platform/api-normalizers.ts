import type { DisplayActor, SourceSignal } from "../types/feed";
import type { PlaceRef, PlaceStatus } from "../types/place";
import type {
  EventComponentV2,
  EventPostExtension,
  EventRewardSettlement,
  EventStatus,
  HelpComponentV2,
  HelpPostExtension,
  HelpStatus,
  MerchantCategory,
  MerchantComponentV2,
  MerchantPostExtension,
  MetadataComponentV2,
  TradeComponentV2,
  TradePostExtension,
  TradeState,
} from "../types/post-extensions";

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

/**
 * Coerce to a non-negative integer, defaulting to 0. Convenience wrapper for
 * the count/capacity fields backends sometimes ship as strings or floats —
 * `Math.max(0, Math.trunc(asNumber(x, 0)))` was repeated in every normalizer.
 */
export function asNonNegInt(value: unknown): number {
  return Math.max(0, Math.trunc(asNumber(value, 0)));
}

/**
 * Coerce to a positive integer, returning undefined for missing/invalid input.
 * Used for optional fields like `linkedEventTid` and `capacity` that backends
 * may omit entirely — distinct from 0, which is a valid count.
 */
export function asOptionalPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return undefined;
}

/**
 * Coerce to a value from a known enum set, or undefined when the input is
 * unrecognized. Replaces the `optionalString(x) && SET.has(x as T) ? (x as T)
 * : undefined` pattern that recurred for status enums.
 */
export function asEnum<E extends string>(value: unknown, allowed: ReadonlySet<E>): E | undefined {
  const str = asString(value);
  return str && allowed.has(str as E) ? (str as E) : undefined;
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
  const aliasId = optionalString(record.aliasId);

  if (id) actor.id = id;
  if (displayName) actor.displayName = displayName;
  if (username) actor.username = username;
  if (name) actor.name = name;
  if (avatarUrl) actor.avatarUrl = avatarUrl;
  if (avatarText) actor.avatarText = avatarText;
  if (identityTag) actor.identityTag = identityTag;
  if (aliasId) actor.aliasId = aliasId;

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
  const status = asEnum(record.status, PLACE_STATUSES);

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

/**
 * Coerce a raw payload into an EventPostExtension. Returns undefined only when
 * eventId is absent — every other field is optional and degrades gracefully.
 * Wire shape mirrors backend `metadata.event` after PR-V4b: additive,
 * time/capacity/joinedCount only. When the backend ships an authoritative
 * `status` (e.g. after `POST /events/:id/complete` or a moderator cancel),
 * round-trip it; `derivedEventStatus` then honors `cancelled` / `completed`
 * over the time-based fallback. Unknown / malformed status drops to undefined
 * — we do not invent a value.
 */
export function normalizeEventExtension(value: unknown): EventPostExtension | undefined {
  const record = asRecord(value);
  const eventId = optionalString(record.eventId);
  if (!eventId) return undefined;
  const startsAt = optionalString(record.startsAt) || optionalString(record.startAt);
  const endsAt = optionalString(record.endsAt) || optionalString(record.endAt);
  const location = optionalString(record.location);
  const rewardSummary = optionalString(record.rewardSummary);
  const capacity = asOptionalPositiveInt(record.capacity);
  const joinedCount = asNonNegInt(record.joinedCount ?? record.participantCount);
  // Issue #703 — formal lifecycle from server. When set, overrides the time +
  // capacity derivation in `derivedEventStatus`. Today only "completed" is
  // observed on the wire; future cancel will land here as well.
  const status = asEnum(record.status, EVENT_STATUSES);
  const completedAt = optionalString(record.completedAt);
  const rewardSettlement = normalizeEventRewardSettlement(record.rewardSettlement);

  return {
    eventId,
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    ...(location ? { location } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    ...(rewardSummary ? { rewardSummary } : {}),
    joinedCount,
    ...(status ? { status } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(rewardSettlement ? { rewardSettlement } : {}),
  };
}

/**
 * Coerce a raw payload into an `EventRewardSettlement`. Mirrors the wire shape
 * persisted by lian-platform-server B1 (#444 / merge
 * 6c37ece93fc1ffcf255f26896563458f72526503) on `metadata.event.rewardSettlement`.
 *
 * Drops the whole settlement when `settlementId` is missing or malformed —
 * never invents values. `totalPaid !== perJoiner * joinerCount` is NOT a drop
 * trigger: render whatever the server says rather than second-guess it.
 */
export function normalizeEventRewardSettlement(value: unknown): EventRewardSettlement | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const settlementId = optionalString(record.settlementId);
  if (!settlementId) return undefined;

  const settledAt = optionalString(record.settledAt);
  const settledBy = optionalString(record.settledBy);
  const perJoiner = asNonNegInt(record.perJoiner);
  const joinerCount = asNonNegInt(record.joinerCount);
  const totalPaid = asNonNegInt(record.totalPaid);
  const remainder = asNonNegInt(record.remainder);
  const joinerIds = asStringArray(record.joinerIds);
  const honorAwarded = normalizeHonorAwarded(record.honorAwarded);

  return {
    settlementId,
    ...(settledAt ? { settledAt } : {}),
    ...(settledBy ? { settledBy } : {}),
    perJoiner,
    joinerCount,
    totalPaid,
    remainder,
    joinerIds,
    ...(honorAwarded ? { honorAwarded } : {}),
  };
}

function normalizeHonorAwarded(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const uid = asString(key);
    if (!uid) continue;
    out[uid] = asNonNegInt(raw);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Coerce the join/cancel-join response shape `{ ok, eventId, joinedCount, joined }`
 * — the backend returns only these three authoritative fields, the rest of the
 * event block stays as the previously fetched detail.
 */
export function normalizeEventJoinResult(value: unknown): {
  eventId: string;
  joinedCount: number;
  joined: boolean;
} {
  const record = asRecord(value);
  return {
    eventId: optionalString(record.eventId) || "",
    joinedCount: asNonNegInt(record.joinedCount),
    joined: asBoolean(record.joined),
  };
}

/**
 * Coerce the `/complete` response shape (issue #703). Backend
 * `event-routes.js#handleEventComplete` returns
 * `{ ok, eventId, status: "completed", joinedCount, completedAt }`.
 * The frontend merges only the fields it owns (joinedCount, completedAt)
 * back into the existing event ref, never replacing the whole block.
 */
export function normalizeEventCompleteResult(value: unknown): {
  eventId: string;
  status: "completed";
  joinedCount: number;
  completedAt: string;
} {
  const record = asRecord(value);
  return {
    eventId: optionalString(record.eventId) || "",
    status: "completed",
    joinedCount: asNonNegInt(record.joinedCount),
    completedAt: optionalString(record.completedAt) || "",
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
  const status = asEnum(record.status, HELP_STATUSES);
  if (!status) return undefined;
  const voteCount = asNonNegInt(record.voteCount);
  const commentCount = asNonNegInt(record.commentCount);
  const linkedEventTid = asOptionalPositiveInt(record.linkedEventTid);
  return {
    helpId,
    voteCount,
    commentCount,
    status,
    ...(linkedEventTid !== undefined ? { linkedEventTid } : {}),
  };
}

const MERCHANT_CATEGORIES: ReadonlySet<MerchantCategory> = new Set(["food", "service", "retail"]);

/**
 * Coerce a raw payload into a MerchantPostExtension. Returns undefined when
 * `name` is missing — backend `normalizeMerchantMetadata` already rejects
 * nameless input, so a missing name on the wire means the publisher never
 * intended a merchant block. Unknown categories fall back to "service" to
 * mirror the backend default.
 */
export function normalizeMerchantExtension(value: unknown): MerchantPostExtension | undefined {
  const record = asRecord(value);
  const name = optionalString(record.name);
  if (!name) return undefined;
  const rawCategory = (optionalString(record.category) || "").toLowerCase();
  const category = MERCHANT_CATEGORIES.has(rawCategory as MerchantCategory)
    ? (rawCategory as MerchantCategory)
    : "service";
  return {
    name,
    category,
    hours: asString(record.hours),
    contact: asString(record.contact),
    errandSupported: asBoolean(record.errandSupported),
    verifiedAt: asString(record.verifiedAt),
  };
}

const TRADE_STATES: ReadonlySet<TradeState> = new Set([
  "available",
  "reserved",
  "sold",
  "cancelled",
]);

/**
 * Coerce a raw payload into a TradePostExtension. Returns undefined when
 * `price` is missing — backend `normalizeTradeMetadata` rejects priceless
 * input, so a missing price on the wire means the publisher never intended a
 * trade block. Unknown states fall back to "available" to mirror the backend
 * default.
 */
export function normalizeTradeExtension(value: unknown): TradePostExtension | undefined {
  const record = asRecord(value);
  const price = optionalString(record.price);
  if (!price) return undefined;
  const rawState = (optionalString(record.state) || "").toLowerCase();
  const state = TRADE_STATES.has(rawState as TradeState) ? (rawState as TradeState) : "available";
  return {
    price,
    state,
    category: asString(record.category),
    verifiedAt: asString(record.verifiedAt),
  };
}

// ---------------------------------------------------------------------------
// V2 Metadata Component Extraction (lian-platform-server #560)
// ---------------------------------------------------------------------------

/**
 * Extract the V2 components array from a raw payload. Returns undefined when
 * the payload does not contain a valid V2 components block.
 *
 * Wire contract (mw#965): `metadata.components` is array-shaped on the API
 * boundary. Backend storage may keep an object map keyed by component kind,
 * but the DTO/serializer is responsible for converting that map into an array
 * before it leaves the server. The frontend deliberately does NOT detect
 * object shape — array-only keeps the wire contract explicit and keeps
 * normalization on one side of the boundary instead of two.
 */
export function extractV2Components(value: unknown): MetadataComponentV2[] | undefined {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  if (!Array.isArray(metadata.components)) return undefined;
  return metadata.components.filter(
    (c): c is MetadataComponentV2 => c && typeof c === "object" && typeof c.type === "string",
  );
}

/**
 * Find a component of a specific type from the V2 components array.
 */
function findComponent<T extends MetadataComponentV2>(
  components: MetadataComponentV2[] | undefined,
  type: T["type"],
): T | undefined {
  if (!components) return undefined;
  return components.find((c) => c.type === type) as T | undefined;
}

/**
 * Extract EventPostExtension from V2 EventComponent, falling back to V1 flat
 * fields. Returns undefined when neither V2 nor V1 data is present.
 */
export function normalizeEventExtensionV2(
  v2Components: MetadataComponentV2[] | undefined,
  v1Value: unknown,
): EventPostExtension | undefined {
  const v2 = findComponent<EventComponentV2>(v2Components, "event");
  if (v2) {
    const eventId = optionalString(v2.eventId);
    if (!eventId) return normalizeEventExtension(v1Value);
    return {
      eventId,
      ...(v2.location ? { location: v2.location } : {}),
      ...(v2.capacity !== undefined ? { capacity: v2.capacity } : {}),
      ...(v2.rewardSummary ? { rewardSummary: v2.rewardSummary } : {}),
      joinedCount: asNonNegInt(v2.joinedCount),
      ...(v2.status ? { status: v2.status } : {}),
      ...(v2.completedAt ? { completedAt: v2.completedAt } : {}),
    };
  }
  return normalizeEventExtension(v1Value);
}

/**
 * Extract HelpPostExtension from V2 HelpComponent, falling back to V1 flat
 * fields. Returns undefined when neither V2 nor V1 data is present.
 */
export function normalizeHelpExtensionV2(
  v2Components: MetadataComponentV2[] | undefined,
  v1Value: unknown,
): HelpPostExtension | undefined {
  const v2 = findComponent<HelpComponentV2>(v2Components, "help");
  if (v2) {
    const helpId = optionalString(v2.helpId);
    if (!helpId) return normalizeHelpExtension(v1Value);
    const status = asEnum(v2.status, HELP_STATUSES);
    if (!status) return normalizeHelpExtension(v1Value);
    return {
      helpId,
      status,
      voteCount: asNonNegInt(v2.voteCount),
      commentCount: asNonNegInt(v2.commentCount),
      ...(v2.linkedEventTid !== undefined ? { linkedEventTid: v2.linkedEventTid } : {}),
    };
  }
  return normalizeHelpExtension(v1Value);
}

/**
 * Extract MerchantPostExtension from V2 MerchantComponent, falling back to V1
 * flat fields. Returns undefined when neither V2 nor V1 data is present.
 */
export function normalizeMerchantExtensionV2(
  v2Components: MetadataComponentV2[] | undefined,
  v1Value: unknown,
): MerchantPostExtension | undefined {
  const v2 = findComponent<MerchantComponentV2>(v2Components, "merchant");
  if (v2) {
    const name = optionalString(v2.name);
    if (!name) return normalizeMerchantExtension(v1Value);
    const rawCategory = (optionalString(v2.category) || "").toLowerCase();
    const category = MERCHANT_CATEGORIES.has(rawCategory as MerchantCategory)
      ? (rawCategory as MerchantCategory)
      : "service";
    return {
      name,
      category,
      hours: asString(v2.hours),
      contact: asString(v2.contact),
      errandSupported: asBoolean(v2.errandSupported),
      verifiedAt: asString(v2.verifiedAt),
    };
  }
  return normalizeMerchantExtension(v1Value);
}

/**
 * Extract TradePostExtension from V2 TradeComponent, falling back to V1 flat
 * fields. Returns undefined when neither V2 nor V1 data is present.
 * Accepts an optional state override for detail endpoint compatibility.
 */
export function normalizeTradeExtensionV2(
  v2Components: MetadataComponentV2[] | undefined,
  v1Value: unknown,
  stateOverride?: unknown,
): TradePostExtension | undefined {
  const v2 = findComponent<TradeComponentV2>(v2Components, "trade");
  if (v2) {
    const price = optionalString(v2.price);
    if (!price) return normalizeTradeExtension(v1Value);
    const rawState = (optionalString(stateOverride ?? v2.state) || "").toLowerCase();
    const state = TRADE_STATES.has(rawState as TradeState) ? (rawState as TradeState) : "available";
    return {
      price,
      state,
      category: asString(v2.category),
      verifiedAt: asString(v2.verifiedAt),
    };
  }
  return normalizeTradeExtension(v1Value);
}
