import type { DisplayActor, SourceSignal } from "./feed";
import type { AudienceVisibility } from "./audience";
import type { PostRelation } from "./post";

export type MessageTabKey = "channel" | "replies" | "system" | "orders";

export type MessageDeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

export interface ChannelMessageActor extends DisplayActor {
  id?: string;
  authoritative?: boolean;
}

export interface ChannelMessage {
  id: string | number;
  /** Audience visibility for this message */
  visibility?: AudienceVisibility;
  /**
   * Client-generated nonce stamped on the optimistic item so we can match the
   * server echo back to it without depending on content equality. Backends
   * that haven't shipped the field yet are tolerated by the content fallback
   * in `useChannelMessages.replacePendingWithLatest`.
   */
  clientNonce?: string;
  content?: string;
  contentHtml?: string;
  plainText?: string;
  actor?: ChannelMessageActor;
  source?: SourceSignal;
  time?: string;
  timestampISO?: string;
  readCount?: number;
  deliveryState?: MessageDeliveryState;
  isSelf?: boolean;
}

export interface ChannelResponse {
  items?: ChannelMessage[];
  hasMore?: boolean;
  nextOffset?: number;
}

export type NotificationActor = DisplayActor;

export type NotificationKind =
  | "reply"
  | "verification"
  | "order"
  | "event-completed"
  | "event-reward-settled"
  | "event-expired"
  | "moderation"
  | "generic";

export type NotificationTarget =
  | { kind: "detail"; tid: number }
  | { kind: "verification" }
  | { kind: "errand-order"; orderId: string }
  | { kind: "none"; reason: string };

export interface NotificationItem {
  id?: string | number;
  tid?: string | number;
  type?: string;
  title?: string;
  excerpt?: string;
  actor?: NotificationActor;
  read?: boolean;
  time?: string;
  timestampISO?: string;
  kind?: NotificationKind;
  actionLabel?: string;
  fallbackText?: string;
  relations?: PostRelation[];
  target?: NotificationTarget;
}

export interface NotificationResponse {
  items?: NotificationItem[];
  hasMore?: boolean;
  nextOffset?: number;
}

export interface NotificationReadPayload {
  eventIds: Array<string | number>;
}

export interface SendChannelMessagePayload {
  content: string;
  identityTag?: string;
  clientNonce?: string;
  visibility?: AudienceVisibility;
}

export interface ChannelReadPayload {
  eventIds: Array<string | number>;
  readerId: string;
}
