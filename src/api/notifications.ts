import { apiGet } from "./http";
import {
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
import type {
  NotificationActor,
  NotificationItem,
  NotificationKind,
  NotificationResponse,
  NotificationTarget,
} from "../types/messages";

type UnknownRecord = Record<string, unknown>;

interface RawNotificationItem {
  id?: string | number;
  tid?: string | number;
  targetTid?: string | number;
  postId?: string | number;
  targetId?: string | number;
  orderId?: string | number;
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

const EVENT_TYPE_TO_KIND: Record<string, NotificationKind> = {
  "event-completed": "event-completed",
  "event-reward-settled": "event-reward-settled",
  "event-expired": "event-expired",
};

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
  const rawType = stringValue(raw.type).toLowerCase();
  const eventKind = EVENT_TYPE_TO_KIND[rawType];
  if (eventKind) return eventKind;
  if (rawType in ERRAND_ORDER_TYPE_TO_STATUS) return "order";
  const moderationKind = MODERATION_TYPE_TO_KIND[rawType];
  if (moderationKind) return moderationKind;

  const haystack = notificationHaystack(raw);
  if (includesAny(haystack, REPLY_NOTIFICATION_TYPES)) return "reply";
  if (includesAny(haystack, VERIFICATION_NOTIFICATION_TYPES)) return "verification";
  if (includesAny(haystack, ORDER_NOTIFICATION_TYPES)) return "order";
  return "generic";
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

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

const ERRAND_ORDER_COPY: Record<ErrandOrderStatus, { title: string; body: string }> = {
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
  const data = asRecord(raw.data);
  const fromData = stringValue(data?.status).toLowerCase();
  if (fromData && fromData in ERRAND_ORDER_COPY) {
    return fromData as ErrandOrderStatus;
  }
  return null;
}

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

const MODERATION_COPY: Record<string, { title: string; body: string }> = {
  "report-accepted": {
    title: NOTIF_MOD_REPORT_ACCEPTED_TITLE,
    body: NOTIF_MOD_REPORT_ACCEPTED_BODY,
  },
  "report-ignored": {
    title: NOTIF_MOD_REPORT_IGNORED_TITLE,
    body: NOTIF_MOD_REPORT_IGNORED_BODY,
  },
  "report-resolved": {
    title: NOTIF_MOD_REPORT_RESOLVED_TITLE,
    body: NOTIF_MOD_REPORT_RESOLVED_BODY,
  },
  "post-hidden": {
    title: NOTIF_MOD_POST_HIDDEN_TITLE,
    body: NOTIF_MOD_POST_HIDDEN_BODY,
  },
  "post-locked": {
    title: NOTIF_MOD_POST_LOCKED_TITLE,
    body: NOTIF_MOD_POST_LOCKED_BODY,
  },
  "post-unlocked": {
    title: NOTIF_MOD_POST_UNLOCKED_TITLE,
    body: NOTIF_MOD_POST_UNLOCKED_BODY,
  },
  "post-restored": {
    title: NOTIF_MOD_POST_RESTORED_TITLE,
    body: NOTIF_MOD_POST_RESTORED_BODY,
  },
};

function buildModerationNotificationCopy(
  raw: RawNotificationItem,
): { title: string; excerpt: string } | null {
  const rawType = stringValue(raw.type).toLowerCase();
  const copy = MODERATION_COPY[rawType];
  if (!copy) return null;
  return { title: copy.title, excerpt: copy.body };
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

function resolveNotificationOrderId(raw: RawNotificationItem): string {
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  return firstString(raw.orderId, data?.orderId, meta?.orderId, target?.orderId);
}

function isErrandOrderNotification(raw: RawNotificationItem): boolean {
  const rawType = stringValue(raw.type).toLowerCase();
  if (rawType === "errand-order-status") return true;
  if (rawType.startsWith("errand-order-")) return true;
  const data = asRecord(raw.data);
  const meta = asRecord(raw.meta);
  const target = asRecord(raw.target);
  return (
    firstString(data?.targetType, meta?.targetType, target?.targetType).toLowerCase() ===
    "errand-order"
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
    const orderId = resolveNotificationOrderId(raw);
    if (orderId && isErrandOrderNotification(raw)) {
      return { kind: "errand-order", orderId };
    }
    return { kind: "none", reason: "订单类通知会在后续版本接入目标页。" };
  }
  if (kind === "moderation") {
    const family = moderationFamily(stringValue(raw.type).toLowerCase());
    if (family === "report") {
      return tid ? { kind: "detail", tid } : { kind: "none", reason: "举报详情已记录在管理后台。" };
    }
    if (family === "post") {
      return tid ? { kind: "detail", tid } : { kind: "none", reason: "该帖子暂时无法打开。" };
    }
  }
  return tid ? { kind: "detail", tid } : { kind: "none", reason: "该系统通知暂时只支持查看摘要。" };
}

function resolveNotificationActionLabel(
  kind: NotificationKind,
  target: NotificationTarget,
  raw?: RawNotificationItem,
): string {
  if (target.kind === "detail") {
    if (kind === "reply") return "查看回复详情";
    if (kind === "moderation" && raw) {
      const family = moderationFamily(stringValue(raw.type).toLowerCase());
      if (family === "report") return "查看被举报内容";
      if (family === "post") return "查看相关帖子";
    }
    return "查看详情";
  }
  if (target.kind === "verification") {
    return "前往认证中心";
  }
  if (target.kind === "errand-order") {
    return "查看订单详情";
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

  let title = rawTitle;
  let excerpt = rawExcerpt;
  if (isEventKind(kind)) {
    const copy = buildEventNotificationCopy(kind, raw);
    title = copy.title;
    excerpt = copy.excerpt;
  } else if (kind === "order") {
    const status = resolveErrandOrderStatus(raw);
    if (status) {
      const copy = buildErrandNotificationCopy(status, raw);
      if (!title) title = copy.title;
      if (!excerpt) excerpt = copy.excerpt;
    }
  } else if (kind === "moderation") {
    const copy = buildModerationNotificationCopy(raw);
    if (copy) {
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
    actionLabel: resolveNotificationActionLabel(kind, target, raw),
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
