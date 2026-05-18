import type { DisplayActor, SourceSignal } from "../types/feed";
import type { PlaceRef, PlaceStatus } from "../types/place";
import type { EventPostExtension, HelpPostExtension, HelpStatus } from "../types/post-extensions";

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

/**
 * Coerce a raw payload into an EventPostExtension. Returns undefined only when
 * eventId is absent — every other field is optional and degrades gracefully.
 * Wire shape mirrors backend `metadata.event` after PR-V4b: additive,
 * time/capacity/joinedCount only. The frontend derives event status from
 * those fields (see `derivedEventStatus` in domain/eventActionPolicy).
 */
export function normalizeEventExtension(value: unknown): EventPostExtension | undefined {
  const record = asRecord(value);
  const eventId = optionalString(record.eventId);
  if (!eventId) return undefined;
  const startsAt = optionalString(record.startsAt) || optionalString(record.startAt);
  const endsAt = optionalString(record.endsAt) || optionalString(record.endAt);
  const location = optionalString(record.location);
  const rewardSummary = optionalString(record.rewardSummary);
  const capacityRaw = record.capacity;
  let capacity: number | undefined;
  if (typeof capacityRaw === "number" && Number.isFinite(capacityRaw) && capacityRaw >= 0) {
    capacity = Math.trunc(capacityRaw);
  } else if (typeof capacityRaw === "string" && capacityRaw.trim()) {
    const parsed = Number(capacityRaw);
    if (Number.isFinite(parsed) && parsed >= 0) capacity = Math.trunc(parsed);
  }
  const joinedCount = Math.max(
    0,
    Math.trunc(asNumber(record.joinedCount ?? record.participantCount, 0)),
  );

  return {
    eventId,
    ...(startsAt ? { startsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
    ...(location ? { location } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    ...(rewardSummary ? { rewardSummary } : {}),
    joinedCount,
  };
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
    joinedCount: Math.max(0, Math.trunc(asNumber(record.joinedCount, 0))),
    joined: asBoolean(record.joined),
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
