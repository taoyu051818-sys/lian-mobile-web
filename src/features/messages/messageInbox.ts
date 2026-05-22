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
import { NOTIFICATION_CHANNELS, type NotificationChannelInfo } from "./notificationChannels";

export interface NotificationGapLink {
  label: string;
  issueUrl: string;
}

export interface NotificationInboxSpec {
  tab: "replies" | "system" | "orders";
  title: string;
  hint: string;
  emptyTitle: string;
  emptyBody: string;
  channels: readonly NotificationChannelInfo[];
  gapLinks: readonly NotificationGapLink[];
}

function selectChannels(ids: NotificationChannelInfo["id"][]) {
  return NOTIFICATION_CHANNELS.filter((channel) => ids.includes(channel.id));
}

export const NOTIFICATION_INBOX_SPECS: Record<NotificationInboxSpec["tab"], NotificationInboxSpec> =
  {
    replies: {
      tab: "replies",
      title: NOTIFICATION_REPLY_INBOX_LABEL,
      hint: NOTIFICATION_REPLY_INBOX_HINT,
      emptyTitle: NOTIFICATION_REPLY_EMPTY_TITLE,
      emptyBody: NOTIFICATION_REPLY_EMPTY_BODY,
      channels: selectChannels(["reply"]),
      gapLinks: [],
    },
    system: {
      tab: "system",
      title: NOTIFICATION_SYSTEM_INBOX_LABEL,
      hint: NOTIFICATION_SYSTEM_INBOX_HINT,
      emptyTitle: NOTIFICATION_SYSTEM_EMPTY_TITLE,
      emptyBody: NOTIFICATION_SYSTEM_EMPTY_BODY,
      channels: selectChannels(["verification", "event-completion", "admin-review"]),
      gapLinks: [
        {
          label: "认证结果通知 #700",
          issueUrl: "https://github.com/taoyu051818-sys/lian-mobile-web/issues/700",
        },
        {
          label: "活动状态通知 #706",
          issueUrl: "https://github.com/taoyu051818-sys/lian-mobile-web/issues/706",
        },
      ],
    },
    orders: {
      tab: "orders",
      title: NOTIFICATION_ORDER_INBOX_LABEL,
      hint: NOTIFICATION_ORDER_INBOX_HINT,
      emptyTitle: NOTIFICATION_ORDER_EMPTY_TITLE,
      emptyBody: NOTIFICATION_ORDER_EMPTY_BODY,
      channels: selectChannels(["errand-status"]),
      gapLinks: [],
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
