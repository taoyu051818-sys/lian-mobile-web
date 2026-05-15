import type { DisplayActor, SourceSignal } from "./feed";

export type MessageTabKey = "channel" | "notifications";

export type MessageDeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

export interface ChannelMessageActor extends DisplayActor {
  id?: string;
  authoritative?: boolean;
}

export interface ChannelMessage {
  id: string | number;
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

export interface NotificationActor extends DisplayActor {}

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
}

export interface NotificationResponse {
  items?: NotificationItem[];
}

export interface SendChannelMessagePayload {
  content: string;
  identityTag?: string;
}

export interface ChannelReadPayload {
  messageIds: Array<string | number>;
  readerId: string;
}
