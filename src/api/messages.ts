import { apiGet, apiSend } from "./http";
import { DEFAULT_USER_LABEL } from "../config/brand";
import { ensureClientId } from "../platform/clientIdentity";
import type {
  ChannelMessage,
  ChannelReadPayload,
  ChannelResponse,
  NotificationActor,
  NotificationItem,
  NotificationKind,
  NotificationResponse,
  NotificationTarget,
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

export function normalizeChannelMessage(raw: ChannelMessage): ChannelMessage {
  const clientId = ensureClientId();
  const actor = raw.actor
    ? {
        ...raw.actor,
        ...(raw.actor.id ? { id: raw.actor.id, authoritative: true } : {}),
      }
    : undefined;
  const plainText = resolveChannelMessagePlainText(raw);
  return {
    ...raw,
    actor,
    plainText,
    deliveryState: raw.deliveryState || "sent",
    isSelf: raw.isSelf ?? (actor?.authoritative ? actor.id === clientId : false),
  };
}

function channelMessageSortValue(item: ChannelMessage) {
  return item.timestampISO || item.time || "";
}

function compareChannelMessagesChronologically(
  a: ChannelMessage,
  b: ChannelMessage,
) {
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
): Promise<ChannelResponse> {
  const params = new URLSearchParams();
  const requestedOffset = Math.max(0, offset);
  params.set("limit", String(limit));
  params.set("offset", String(requestedOffset));
  const response = await apiGet<ChannelResponse>(`/api/channel?${params.toString()}`);
  return normalizeChannelResponse(response, requestedOffset);
}

type UnknownRecord = Record<string, unknown>;

interface RawNotificationItem {
  id?: string | number;
  tid?: string | number;
  targetTid?: string | number;
  postId?: string | number;
  targetId?: string | number;
  type?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  text?: string;
  actor?: NotificationActor;
  read?: boolean;
  time?: string;
  timestampISO?: string;
  path?: string;
  href?: string;
  url?: string;
  link?: string;
  data?: UnknownRecord | null;
  meta?: UnknownRecord | null;
  target?: UnknownRecord | null;
}

interface RawNotificationResponse {
  items?: RawNotificationItem[];
  notifications?: RawNotificationItem[];
}

const REPLY_NOTIFICATION_TYPES = [
  "reply",
  "post-reply",
  "new-reply",
  "new-post",
  "comment",
];
const VERIFICATION_NOTIFICATION_TYPES = [
  "verification",
  "campus",
  "merchant",
  "runner",
  "realname",
  "approved",
  "rejected",
];
const ORDER_NOTIFICATION_TYPES = ["order", "errand", "trade", "delivery"];

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = stringValue(value);
    if (candidate) return candidate;
  }
  return "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const candidate = numberValue(value);
    if (candidate !== null) return candidate;
  }
  return null;
}

function notificationHaystack(raw: RawNotificationItem): string {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  return [
    raw.type,
    raw.title,
    raw.excerpt,
    raw.body,
    raw.text,
    raw.path,
    raw.href,
    raw.url,
    raw.link,
    data?.type,
    data?.title,
    data?.targetType,
    meta?.type,
    meta?.title,
    meta?.targetType,
    target?.type,
    target?.targetType,
  ]
    .map((value) => firstString(value))
    .join(" ")
    .toLowerCase();
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function resolveNotificationKind(raw: RawNotificationItem): NotificationKind {
  const haystack = notificationHaystack(raw);
  if (includesAny(haystack, REPLY_NOTIFICATION_TYPES)) return "reply";
  if (includesAny(haystack, VERIFICATION_NOTIFICATION_TYPES)) return "verification";
  if (includesAny(haystack, ORDER_NOTIFICATION_TYPES)) return "order";
  return "generic";
}

function resolveNotificationTid(raw: RawNotificationItem): number | null {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  return firstNumber(
    raw.tid,
    raw.targetTid,
    raw.postId,
    raw.targetId,
    data?.tid,
    data?.targetTid,
    data?.postId,
    data?.targetId,
    meta?.tid,
    meta?.targetTid,
    meta?.postId,
    meta?.targetId,
    target?.tid,
    target?.targetTid,
    target?.postId,
    target?.targetId,
  );
}

function resolveNotificationTarget(
  raw: RawNotificationItem,
  kind: NotificationKind,
): NotificationTarget {
  const tid = resolveNotificationTid(raw);
  if (kind === "reply") {
    return tid
      ? { kind: "detail", tid }
      : { kind: "none", reason: "该回复通知暂时无法直接打开。" };
  }
  if (kind === "verification") {
    return { kind: "verification" };
  }
  if (kind === "order") {
    return { kind: "none", reason: "订单类通知会在后续版本接入目标页。" };
  }
  return tid
    ? { kind: "detail", tid }
    : { kind: "none", reason: "该系统通知暂时只支持查看摘要。" };
}

function resolveNotificationActionLabel(
  kind: NotificationKind,
  target: NotificationTarget,
): string {
  if (target.kind === "detail") {
    return kind === "reply" ? "查看回复详情" : "查看详情";
  }
  if (target.kind === "verification") {
    return "前往认证中心";
  }
  return target.reason;
}

export function normalizeNotificationItem(raw: RawNotificationItem): NotificationItem {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const targetRecord = asRecord(raw.target);
  const kind = resolveNotificationKind(raw);
  const target = resolveNotificationTarget(raw, kind);
  const tid = resolveNotificationTid(raw);
  const title = firstString(raw.title, data?.title, meta?.title, targetRecord?.title);
  const excerpt = firstString(raw.excerpt, raw.body, raw.text, data?.excerpt, meta?.excerpt);
  const type = firstString(raw.type, data?.type, meta?.type, targetRecord?.type);

  return {
    id: raw.id || raw.targetId || tid || title,
    tid: tid ?? undefined,
    type: type || undefined,
    title: title || undefined,
    excerpt: excerpt || undefined,
    actor: raw.actor,
    read: raw.read ?? true,
    time: firstString(raw.time, data?.time, meta?.time) || undefined,
    timestampISO:
      firstString(raw.timestampISO, data?.timestampISO, meta?.timestampISO) || undefined,
    kind,
    actionLabel: resolveNotificationActionLabel(kind, target),
    fallbackText: target.kind === "none" ? target.reason : undefined,
    target,
  };
}

export function normalizeNotificationResponse(
  response: RawNotificationResponse | NotificationResponse,
): NotificationResponse {
  const rawItems = "notifications" in response ? response.notifications || [] : response.items || [];
  return {
    ...response,
    items: rawItems.map((item) => normalizeNotificationItem(item as RawNotificationItem)),
  };
}

export async function fetchNotifications(): Promise<NotificationResponse> {
  const response = await apiGet<RawNotificationResponse>("/api/messages");
  return normalizeNotificationResponse(response);
}

export function buildPendingChannelMessage(
  content: string,
  identityTag: string | undefined,
  currentUser: { username?: string; displayName?: string; avatarText?: string; id?: string } | null,
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
      // Backends that don't recognize this field will ignore it. Once the
      // server echoes it back on the corresponding ChannelMessage, the optimistic
      // pending item is replaced by exact nonce match instead of content equality.
      clientNonce: payload.clientNonce || "",
    }),
  });
}

export function buildChannelReadPayload(
  messageIds: Array<string | number>,
): ChannelReadPayload {
  return { messageIds, readerId: ensureClientId() };
}

export async function markChannelMessagesRead(
  messageIds: Array<string | number>,
): Promise<void> {
  if (!messageIds.length) return;
  const payload = buildChannelReadPayload(messageIds);
  await apiSend("/api/channel/read", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
