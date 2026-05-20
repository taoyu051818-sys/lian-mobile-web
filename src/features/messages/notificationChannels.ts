import {
  NOTIFICATION_CHANNEL_ADMIN_REVIEW_DESC,
  NOTIFICATION_CHANNEL_ADMIN_REVIEW_TITLE,
  NOTIFICATION_CHANNEL_ERRAND_DESC,
  NOTIFICATION_CHANNEL_ERRAND_TITLE,
  NOTIFICATION_CHANNEL_EVENT_DESC,
  NOTIFICATION_CHANNEL_EVENT_TITLE,
  NOTIFICATION_CHANNEL_REPLY_DESC,
  NOTIFICATION_CHANNEL_REPLY_TITLE,
  NOTIFICATION_CHANNEL_VERIFICATION_DESC,
  NOTIFICATION_CHANNEL_VERIFICATION_TITLE,
} from "../../config/brand";

export type NotificationChannelStatus = "connected" | "pending";

export interface NotificationChannelInfo {
  id: "reply" | "verification" | "admin-review" | "errand-status" | "event-completion";
  title: string;
  description: string;
  status: NotificationChannelStatus;
  /**
   * Backend issue tracking the channel. `null` when the channel is already
   * shipping (no follow-up needed).
   */
  issueUrl: string | null;
}

/**
 * Snapshot of which `/api/messages` channels the messages page currently knows
 * how to render. Pending entries link to the backend issue tracking the gap so
 * the readout stays honest about what is and is not wired up.
 */
export const NOTIFICATION_CHANNELS: readonly NotificationChannelInfo[] = [
  {
    id: "reply",
    title: NOTIFICATION_CHANNEL_REPLY_TITLE,
    description: NOTIFICATION_CHANNEL_REPLY_DESC,
    status: "connected",
    issueUrl: null,
  },
  {
    id: "verification",
    title: NOTIFICATION_CHANNEL_VERIFICATION_TITLE,
    description: NOTIFICATION_CHANNEL_VERIFICATION_DESC,
    status: "pending",
    issueUrl: "https://github.com/taoyu051818-sys/lian-mobile-web/issues/700",
  },
  {
    id: "errand-status",
    title: NOTIFICATION_CHANNEL_ERRAND_TITLE,
    description: NOTIFICATION_CHANNEL_ERRAND_DESC,
    status: "pending",
    issueUrl: "https://github.com/taoyu051818-sys/lian-mobile-web/issues/701",
  },
  {
    id: "event-completion",
    title: NOTIFICATION_CHANNEL_EVENT_TITLE,
    description: NOTIFICATION_CHANNEL_EVENT_DESC,
    status: "pending",
    issueUrl: "https://github.com/taoyu051818-sys/lian-mobile-web/issues/702",
  },
  {
    id: "admin-review",
    title: NOTIFICATION_CHANNEL_ADMIN_REVIEW_TITLE,
    description: NOTIFICATION_CHANNEL_ADMIN_REVIEW_DESC,
    status: "pending",
    issueUrl: null,
  },
] as const;
