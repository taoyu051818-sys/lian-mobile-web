import {
  NOTIFICATION_ORDER_EMPTY_BODY,
  NOTIFICATION_ORDER_EMPTY_TITLE,
  NOTIFICATION_ORDER_INBOX_HINT,
  NOTIFICATION_ORDER_INBOX_LABEL,
  NOTIFICATION_REPLY_EMPTY_BODY,
  NOTIFICATION_REPLY_EMPTY_TITLE,
  NOTIFICATION_REPLY_INBOX_HINT,
  NOTIFICATION_REPLY_INBOX_LABEL,
  NOTIFICATION_SYSTEM_EMPTY_BODY,
  NOTIFICATION_SYSTEM_EMPTY_TITLE,
  NOTIFICATION_SYSTEM_INBOX_HINT,
  NOTIFICATION_SYSTEM_INBOX_LABEL,
} from "../../config/brand";
import type { MessageTabKey, NotificationItem } from "../../types/messages";

/**
 * Per-tab inbox copy for the messages page (#828 product inbox).
 *
 * The previous spec carried `channels` / `gapLinks` arrays so the view could
 * render an engineering "channel readout" block above the items list (status
 * pills + GitHub issue links). That readout was the single biggest signal
 * that the inbox was a debugging surface, not a product surface, so #828
 * stripped it. The remaining shape is intentionally narrow: title + hint +
 * empty title/body — everything the product copy surface needs and nothing
 * more.
 */
export interface NotificationInboxSpec {
  tab: "replies" | "system" | "orders";
  title: string;
  hint: string;
  emptyTitle: string;
  emptyBody: string;
}

export const NOTIFICATION_INBOX_SPECS: Record<NotificationInboxSpec["tab"], NotificationInboxSpec> =
  {
    replies: {
      tab: "replies",
      title: NOTIFICATION_REPLY_INBOX_LABEL,
      hint: NOTIFICATION_REPLY_INBOX_HINT,
      emptyTitle: NOTIFICATION_REPLY_EMPTY_TITLE,
      emptyBody: NOTIFICATION_REPLY_EMPTY_BODY,
    },
    system: {
      tab: "system",
      title: NOTIFICATION_SYSTEM_INBOX_LABEL,
      hint: NOTIFICATION_SYSTEM_INBOX_HINT,
      emptyTitle: NOTIFICATION_SYSTEM_EMPTY_TITLE,
      emptyBody: NOTIFICATION_SYSTEM_EMPTY_BODY,
    },
    orders: {
      tab: "orders",
      title: NOTIFICATION_ORDER_INBOX_LABEL,
      hint: NOTIFICATION_ORDER_INBOX_HINT,
      emptyTitle: NOTIFICATION_ORDER_EMPTY_TITLE,
      emptyBody: NOTIFICATION_ORDER_EMPTY_BODY,
    },
  };

export function itemsForInboxTab(items: NotificationItem[], tab: NotificationInboxSpec["tab"]) {
  return items.filter((item) => {
    if (item.kind === "reply") return tab === "replies";
    if (item.kind === "order") return tab === "orders";
    // ps#493 — admin moderation notifications (report-* / post-*) land in
    // the system tab. The default-system fallback below would already catch
    // them, but pinning the branch keeps the routing audit-trail explicit
    // so a future refactor that splits the system tab can't silently
    // misroute moderation items.
    if (item.kind === "moderation") return tab === "system";
    return tab === "system";
  });
}

export function isNotificationInboxTab(tab: MessageTabKey): tab is NotificationInboxSpec["tab"] {
  return tab === "replies" || tab === "system" || tab === "orders";
}
