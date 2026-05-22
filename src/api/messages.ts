import { apiGet, apiSend } from "./http";
import {
  DEFAULT_USER_LABEL,
  NOTIF_ERRAND_ORDER_ACCEPTED_BODY,
  NOTIF_ERRAND_ORDER_ACCEPTED_TITLE,
  NOTIF_ERRAND_ORDER_CANCELLED_BODY,
  NOTIF_ERRAND_ORDER_CANCELLED_TITLE,
  NOTIF_ERRAND_ORDER_COMPLETED_BODY,
  NOTIF_ERRAND_ORDER_COMPLETED_TITLE,
  NOTIF_ERRAND_ORDER_DELIVERED_BODY,
  NOTIF_ERRAND_ORDER_DELIVERED_TITLE,
  NOTIF_ERRAND_ORDER_DELIVERING_BODY,
  NOTIF_ERRAND_ORDER_DELIVERING_TITLE,
  NOTIF_ERRAND_ORDER_PICKED_UP_BODY,
  NOTIF_ERRAND_ORDER_PICKED_UP_TITLE,
  NOTIF_ERRAND_ORDER_REFUNDED_BODY,
  NOTIF_ERRAND_ORDER_REFUNDED_TITLE,
  NOTIF_ERRAND_ORDER_TITLE_FALLBACK,
  NOTIF_EVENT_COMPLETED_BODY,
  NOTIF_EVENT_COMPLETED_TITLE,
  NOTIF_EVENT_EXPIRED_BODY,
  NOTIF_EVENT_EXPIRED_TITLE,
  NOTIF_EVENT_REWARD_SETTLED_BODY,
  NOTIF_EVENT_REWARD_SETTLED_TITLE,
  NOTIF_EVENT_TITLE_FALLBACK,
  NOTIF_MOD_POST_HIDDEN_BODY,
  NOTIF_MOD_POST_HIDDEN_TITLE,
  NOTIF_MOD_POST_LOCKED_BODY,
  NOTIF_MOD_POST_LOCKED_TITLE,
  NOTIF_MOD_POST_RESTORED_BODY,
  NOTIF_MOD_POST_RESTORED_TITLE,
  NOTIF_MOD_POST_UNLOCKED_BODY,
  NOTIF_MOD_POST_UNLOCKED_TITLE,
  NOTIF_MOD_REPORT_ACCEPTED_BODY,
  NOTIF_MOD_REPORT_ACCEPTED_TITLE,
  NOTIF_MOD_REPORT_IGNORED_BODY,
  NOTIF_MOD_REPORT_IGNORED_TITLE,
  NOTIF_MOD_REPORT_RESOLVED_BODY,
  NOTIF_MOD_REPORT_RESOLVED_TITLE,
} from "../config/brand";
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

export async function fetchChannelMessages(offset = 0, limit = 30): Promise<ChannelResponse> {
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

const REPLY_NOTIFICATION_TYPES = ["reply", "post-reply", "new-reply", "new-post", "comment"];
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

/**
 * Server-side `type` slugs that B2 (#438 / lian-platform-server#445) writes for
 * the three event-lifecycle fan-outs. The renderer dispatches on `kind`, so we
 * recognize the type here and produce a typed kind. Kept exact (no fuzzy match
 * via `notificationHaystack`) because the wire shape is locked and a partial
 * match against e.g. "completed" must NOT route an unrelated future notification
 * here.
 */
const EVENT_TYPE_TO_KIND: Record<string, NotificationKind> = {
  "event-completed": "event-completed",
  "event-reward-settled": "event-reward-settled",
  "event-expired": "event-expired",
};

/**
 * Server-side `type` slugs that ps#477 / ps#495 emit for the seven
 * errand-order lifecycle fan-outs. We dispatch on `kind === "order"` (no new
 * NotificationKind), but recognising the wire type EXACTLY lets us project
 * a stable internal status enum (`accepted` / `picked_up` / …) into the
 * `target.reason` body and brand-fallback copy without trusting the fuzzy
 * haystack. Wire types are kebab-case (`errand-order-picked-up`); internal
 * status enums are snake_case (`picked_up`).
 *
 * Once we wire actual order-detail navigation behind these (separate PR), the
 * exact map is what gates the deep-link — the fuzzy `["order", "errand", ...]`
 * fallback would otherwise route admin/settlement notifications onto the
 * wrong screen.
 */
const ERRAND_ORDER_TYPE_TO_STATUS: Record<string, ErrandOrderStatus> = {
  "errand-order-accepted": "accepted",
  "errand-order-picked-up": "picked_up",
  "errand-order-delivering": "delivering",
  "errand-order-delivered": "delivered",
  "errand-order-completed": "completed",
  "errand-order-cancelled": "cancelled",
  "errand-order-refunded": "refunded",
};

type ErrandOrderStatus =
  | "accepted"
  | "picked_up"
  | "delivering"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

/**
 * Server-side `type` slugs that ps#493 emits for the seven admin-moderation
 * fan-outs. Two families:
 *   - `report-*` (recipient = original reporter): accepted / ignored / resolved
 *   - `post-*` (recipient = post author): hidden / locked / unlocked / restored
 *
 * All seven roll up to a single NotificationKind ("moderation") because they
 * land in the same system tab, share the same actor (LIAN), and only differ
 * in fallback copy + tap-target. Kept exact (no fuzzy match) so a future type
 * containing the substring "post" or "report" never poaches this bucket.
 *
 * Backend (ps#493) hardcodes actor={id:"system", name:"LIAN"}; admin reviewer
 * identity and free-text notes never reach the wire. The frontend never tries
 * to derive them.
 */
const MODERATION_TYPE_TO_KIND: Record<string, NotificationKind> = {
  "report-accepted": "moderation",
  "report-ignored": "moderation",
  "report-resolved": "moderation",
  "post-hidden": "moderation",
  "post-locked": "moderation",
  "post-unlocked": "moderation",
  "post-restored": "moderation",
};

type ModerationFamily = "report" | "post";

function moderationFamily(rawType: string): ModerationFamily | null {
  if (rawType.startsWith("report-")) return "report";
  if (rawType.startsWith("post-")) return "post";
  return null;
}

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
  // Exact match on the raw `type` slug first — B2 (#445) writes a known set
  // for the three event lifecycle fan-outs and we never want them to fall
  // into the fuzzy "reply"/"order" buckets when their excerpt happens to
  // contain those words.
  const rawType = stringValue(raw.type).toLowerCase();
  const eventKind = EVENT_TYPE_TO_KIND[rawType];
  if (eventKind) return eventKind;

  // ps#477 / ps#495 — the seven errand-order-* slugs lock onto kind="order"
  // exactly so admin or settlement notifications that happen to mention the
  // word "order" can't poach the bucket. The status itself is projected via
  // ERRAND_ORDER_TYPE_TO_STATUS at copy time.
  if (rawType in ERRAND_ORDER_TYPE_TO_STATUS) return "order";

  // ps#493 — admin moderation fan-out. Exact match before the fuzzy bucket
  // so a future user-facing slug containing "report" or "post" can't poach
  // the moderation bucket; conversely, the haystack heuristic below would
  // otherwise miss `post-locked` or `report-resolved` entirely.
  const moderationKind = MODERATION_TYPE_TO_KIND[rawType];
  if (moderationKind) return moderationKind;

  const haystack = notificationHaystack(raw);
  if (includesAny(haystack, REPLY_NOTIFICATION_TYPES)) return "reply";
  if (includesAny(haystack, VERIFICATION_NOTIFICATION_TYPES)) return "verification";
  if (includesAny(haystack, ORDER_NOTIFICATION_TYPES)) return "order";
  return "generic";
}

/** Pattern-fill `「{title}」每人发放 {perJoiner} {currency}` style templates. */
function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * Build the localized title + excerpt for the three event lifecycle types
 * shipped by B2 (#445). The backend `raw.title` already includes the lifecycle
 * suffix (`<eventTitle> <活动已结束|活动奖励已发放|活动已过期>`), so we only use
 * truly structured event-name fields here. Otherwise we fall back to generic
 * wording instead of duplicating the backend phrase inside the body.
 */
function buildEventNotificationCopy(
  kind: NotificationKind,
  raw: RawNotificationItem,
): {
  title: string;
  excerpt: string;
} {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  const eventTitle =
    firstString(
      data?.eventTitle,
      data?.eventName,
      meta?.eventTitle,
      meta?.eventName,
      target?.eventTitle,
      target?.eventName,
    ) || NOTIF_EVENT_TITLE_FALLBACK;

  if (kind === "event-completed") {
    return {
      title: NOTIF_EVENT_COMPLETED_TITLE,
      excerpt: fillTemplate(NOTIF_EVENT_COMPLETED_BODY, { title: eventTitle }),
    };
  }
  if (kind === "event-expired") {
    return {
      title: NOTIF_EVENT_EXPIRED_TITLE,
      excerpt: fillTemplate(NOTIF_EVENT_EXPIRED_BODY, { title: eventTitle }),
    };
  }
  // event-reward-settled — perJoiner / totalPaid / currency live on data.
  // B2 ships `points` (legacy) and the F3 brief calls for `perJoiner`; accept
  // either so we don't break if the server name shifts.
  const perJoiner = firstNumber(data?.perJoiner, data?.points) ?? 0;
  const totalPaid = firstNumber(data?.totalPaid) ?? 0;
  const currency = firstString(data?.currency) || "积分";
  return {
    title: NOTIF_EVENT_REWARD_SETTLED_TITLE,
    excerpt: fillTemplate(NOTIF_EVENT_REWARD_SETTLED_BODY, {
      title: eventTitle,
      perJoiner,
      currency,
      totalPaid,
    }),
  };
}

function isEventKind(kind: NotificationKind): boolean {
  return kind === "event-completed" || kind === "event-reward-settled" || kind === "event-expired";
}

const ERRAND_ORDER_COPY: Record<
  ErrandOrderStatus,
  { title: string; body: string }
> = {
  accepted: {
    title: NOTIF_ERRAND_ORDER_ACCEPTED_TITLE,
    body: NOTIF_ERRAND_ORDER_ACCEPTED_BODY,
  },
  picked_up: {
    title: NOTIF_ERRAND_ORDER_PICKED_UP_TITLE,
    body: NOTIF_ERRAND_ORDER_PICKED_UP_BODY,
  },
  delivering: {
    title: NOTIF_ERRAND_ORDER_DELIVERING_TITLE,
    body: NOTIF_ERRAND_ORDER_DELIVERING_BODY,
  },
  delivered: {
    title: NOTIF_ERRAND_ORDER_DELIVERED_TITLE,
    body: NOTIF_ERRAND_ORDER_DELIVERED_BODY,
  },
  completed: {
    title: NOTIF_ERRAND_ORDER_COMPLETED_TITLE,
    body: NOTIF_ERRAND_ORDER_COMPLETED_BODY,
  },
  cancelled: {
    title: NOTIF_ERRAND_ORDER_CANCELLED_TITLE,
    body: NOTIF_ERRAND_ORDER_CANCELLED_BODY,
  },
  refunded: {
    title: NOTIF_ERRAND_ORDER_REFUNDED_TITLE,
    body: NOTIF_ERRAND_ORDER_REFUNDED_BODY,
  },
};

function resolveErrandOrderStatus(raw: RawNotificationItem): ErrandOrderStatus | null {
  const rawType = stringValue(raw.type).toLowerCase();
  const fromType = ERRAND_ORDER_TYPE_TO_STATUS[rawType];
  if (fromType) return fromType;
  // The wire envelope also carries `data.status` (snake_case enum). When the
  // type slug is missing or unrecognised but the `data` block is well-formed
  // we fall back to it so the renderer still gets locked-down copy. We do
  // NOT use this for kind dispatch — that stays driven by the exact slug in
  // ERRAND_ORDER_TYPE_TO_STATUS so unrelated payloads can't poach the bucket.
  const data = asRecord(raw.data);
  const fromData = stringValue(data?.status).toLowerCase();
  if (fromData && fromData in ERRAND_ORDER_COPY) {
    return fromData as ErrandOrderStatus;
  }
  return null;
}

/**
 * Build the localized title + excerpt for the seven errand-order lifecycle
 * types shipped by ps#477 / ps#495. Backend already populates `title` /
 * `excerpt` in the envelope; this is the front-end fallback used when those
 * fields are missing or empty. The order title is pulled from common
 * structured fields (`data.orderTitle` / merchantPostId-resolved title is
 * future work) and falls back to a generic placeholder so the body never
 * renders `「」` or `undefined`.
 */
function buildErrandNotificationCopy(
  status: ErrandOrderStatus,
  raw: RawNotificationItem,
): { title: string; excerpt: string } {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  const orderTitle =
    firstString(
      data?.orderTitle,
      data?.title,
      meta?.orderTitle,
      meta?.title,
      target?.orderTitle,
      target?.title,
    ) || NOTIF_ERRAND_ORDER_TITLE_FALLBACK;
  const copy = ERRAND_ORDER_COPY[status];
  return {
    title: copy.title,
    excerpt: fillTemplate(copy.body, { title: orderTitle }),
  };
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
    return tid ? { kind: "detail", tid } : { kind: "none", reason: "该回复通知暂时无法直接打开。" };
  }
  if (kind === "verification") {
    return { kind: "verification" };
  }
  if (kind === "order") {
    return { kind: "none", reason: "订单类通知会在后续版本接入目标页。" };
  }
  return tid ? { kind: "detail", tid } : { kind: "none", reason: "该系统通知暂时只支持查看摘要。" };
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
  const rawTitle = firstString(raw.title, data?.title, meta?.title, targetRecord?.title);
  const rawExcerpt = firstString(raw.excerpt, raw.body, raw.text, data?.excerpt, meta?.excerpt);
  const type = firstString(raw.type, data?.type, meta?.type, targetRecord?.type);

  // For the three event-lifecycle types we always own the brand strings — the
  // backend (#445) already shapes `title` / `excerpt`, but `raw.title` is not a
  // safe bare event name for localized body composition, so event copy comes
  // only from structured event-name fields plus the frontend templates here.
  let title = rawTitle;
  let excerpt = rawExcerpt;
  if (isEventKind(kind)) {
    const copy = buildEventNotificationCopy(kind, raw);
    title = copy.title;
    excerpt = copy.excerpt;
  } else if (kind === "order") {
    // ps#477 / ps#495 — backend ships title + excerpt in the envelope, so
    // we trust those when present and only synthesise from the locked
    // status enum when the wire fields are missing/empty. This keeps the
    // server as the source of truth for the body, but guarantees the UI
    // never renders a blank order row when the envelope is sparse.
    const status = resolveErrandOrderStatus(raw);
    if (status) {
      const copy = buildErrandNotificationCopy(status, raw);
      if (!title) title = copy.title;
      if (!excerpt) excerpt = copy.excerpt;
    }
  }

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
  const rawItems =
    "notifications" in response ? response.notifications || [] : response.items || [];
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

export function buildChannelReadPayload(messageIds: Array<string | number>): ChannelReadPayload {
  return { messageIds, readerId: ensureClientId() };
}

export async function markChannelMessagesRead(messageIds: Array<string | number>): Promise<void> {
  if (!messageIds.length) return;
  const payload = buildChannelReadPayload(messageIds);
  await apiSend("/api/channel/read", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
