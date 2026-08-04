import { apiGet, apiSend } from "./http";
import { DEFAULT_USER_LABEL } from "../config/brand";
import { ensureClientId } from "../platform/clientIdentity";
import { normalizeAudience, type AudienceVisibility } from "../types/audience";
import type {
  ChannelMessage,
  ChannelMessageVisibility,
  ChannelReadPayload,
  ChannelResponse,
  SendChannelMessagePayload,
} from "../types/messages";

export function extractChannelMessagePlainText(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveChannelMessagePlainText(
  message: Pick<ChannelMessage, "content" | "contentHtml" | "plainText">,
): string {
  return (
    message.plainText?.trim() ||
    message.content?.trim() ||
    extractChannelMessagePlainText(message.contentHtml)
  );
}

const KNOWN_CHANNEL_VISIBILITIES: ReadonlySet<AudienceVisibility> = new Set([
  "public",
  "campus",
  "school",
  "private",
  "linkOnly",
]);

export function isChannelVisibility(value: unknown): value is AudienceVisibility {
  return typeof value === "string" && KNOWN_CHANNEL_VISIBILITIES.has(value as AudienceVisibility);
}

function normalizeKnownChannelVisibility(value: unknown): AudienceVisibility | undefined {
  return isChannelVisibility(value) ? value : undefined;
}

function normalizeChannelAudience(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const hasVisibility = isChannelVisibility(record.visibility);
  const hasArrayFields = [record.schoolIds, record.orgIds, record.roleIds, record.userIds].every(
    (field) => field === undefined || Array.isArray(field),
  );
  const hasValidLinkOnly = record.linkOnly === undefined || typeof record.linkOnly === "boolean";
  return hasVisibility && hasArrayFields && hasValidLinkOnly ? normalizeAudience(value) : undefined;
}

function normalizeChannelMessageVisibility(
  raw: ChannelMessage,
): ChannelMessageVisibility | undefined {
  const topLevelVisibility = normalizeKnownChannelVisibility(raw.visibility);
  const audience = raw.audience;
  if (!audience || typeof audience !== "object") return topLevelVisibility;
  const record = audience as unknown as Record<string, unknown>;
  const audienceVisibility = normalizeKnownChannelVisibility(record.visibility);
  if (!audienceVisibility) return topLevelVisibility;
  const hasArrayFields = [record.schoolIds, record.orgIds, record.roleIds, record.userIds].every(
    (field) => field === undefined || Array.isArray(field),
  );
  const hasValidLinkOnly = record.linkOnly === undefined || typeof record.linkOnly === "boolean";
  return hasArrayFields && hasValidLinkOnly
    ? (topLevelVisibility ?? audienceVisibility)
    : topLevelVisibility;
}

export function normalizeChannelMessage(raw: ChannelMessage): ChannelMessage {
  const clientId = ensureClientId();
  const actor = raw.actor
    ? {
        ...raw.actor,
        ...(raw.actor.id ? { id: raw.actor.id, authoritative: true } : {}),
      }
    : undefined;
  const plainText = resolveChannelMessagePlainText(raw);
  const audience = normalizeChannelAudience(raw.audience);
  const visibility = normalizeChannelMessageVisibility(raw);
  return {
    ...raw,
    actor,
    plainText,
    visibility,
    audience,
    deliveryState: raw.deliveryState || "sent",
    isSelf: raw.isSelf ?? (actor?.authoritative ? actor.id === clientId : false),
  };
}

function channelMessageSortValue(item: ChannelMessage) {
  return item.timestampISO || item.time || "";
}

function compareChannelMessagesChronologically(a: ChannelMessage, b: ChannelMessage) {
  const aTime = channelMessageSortValue(a);
  const bTime = channelMessageSortValue(b);
  if (aTime !== bTime) {
    if (!aTime) return -1;
    if (!bTime) return 1;
    return aTime < bTime ? -1 : 1;
  }
  return String(a.id).localeCompare(String(b.id));
}

export function mergeChannelMessagesChronologically(
  existing: ChannelMessage[],
  incoming: ChannelMessage[],
): ChannelMessage[] {
  const merged = new Map<string, ChannelMessage>();
  for (const item of existing) merged.set(String(item.id), item);
  for (const item of incoming) merged.set(String(item.id), item);
  return Array.from(merged.values()).sort(compareChannelMessagesChronologically);
}

export function normalizeChannelResponse(
  response: ChannelResponse,
  requestedOffset = 0,
): ChannelResponse {
  const rawItems = response.items || [];
  const normalizedItems = mergeChannelMessagesChronologically(
    [],
    rawItems.map(normalizeChannelMessage),
  );
  return {
    ...response,
    items: normalizedItems,
    nextOffset: response.nextOffset ?? Math.max(0, requestedOffset) + rawItems.length,
  };
}

export async function fetchChannelMessages(
  offset = 0,
  limit = 30,
  visibility?: AudienceVisibility,
): Promise<ChannelResponse> {
  const params = new URLSearchParams();
  const requestedOffset = Math.max(0, offset);
  params.set("limit", String(limit));
  params.set("offset", String(requestedOffset));
  if (visibility) params.set("visibility", visibility);
  const response = await apiGet<ChannelResponse>(`/api/channel?${params.toString()}`);
  return normalizeChannelResponse(response, requestedOffset);
}

export function buildPendingChannelMessage(
  content: string,
  identityTag: string | undefined,
  currentUser: { username?: string; displayName?: string; avatarText?: string; id?: string } | null,
  visibility: AudienceVisibility = "public",
): ChannelMessage {
  void identityTag;
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const id = `pending-${nonce}`;
  const now = new Date().toISOString();
  const name = currentUser?.displayName || currentUser?.username || DEFAULT_USER_LABEL;
  return {
    id,
    clientNonce: nonce,
    content,
    plainText: content,
    visibility,
    actor: {
      id: currentUser?.id || "",
      name,
      displayName: name,
      avatarText: currentUser?.avatarText || name.slice(0, 2) || "同",
      authoritative: false,
    },
    timestampISO: now,
    time: now,
    deliveryState: "sending",
    isSelf: true,
  };
}

export async function sendChannelMessage(payload: SendChannelMessagePayload): Promise<void> {
  const readerId = ensureClientId();
  await apiSend("/api/channel/messages", {
    method: "POST",
    body: JSON.stringify({
      readerId,
      content: payload.content,
      identityTag: payload.identityTag || "",
      visibility: payload.visibility || "public",
      // Backends that don't recognize this field will ignore it. Once the
      // server echoes it back on the corresponding ChannelMessage, the optimistic
      // pending item is replaced by exact nonce match instead of content equality.
      clientNonce: payload.clientNonce || "",
    }),
  });
}

export function buildChannelReadPayload(messageIds: Array<string | number>): ChannelReadPayload {
  return { eventIds: messageIds, readerId: ensureClientId() };
}

export async function markChannelMessagesRead(messageIds: Array<string | number>): Promise<void> {
  if (!messageIds.length) return;
  const payload = buildChannelReadPayload(messageIds);
  await apiSend("/api/channel/read", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
