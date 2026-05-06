import type { DisplayActor, SourceSignal } from "./feed";

export type MessageTabKey = "channel" | "notifications";

export interface ChannelMessageAuthor extends DisplayActor {}

export interface ChannelMessage {
  id: string | number;
  content?: string;
  contentHtml?: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  identityTag?: string;
  author?: ChannelMessageAuthor;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  avatarText?: string;
  time?: string;
  timestampISO?: string;
  readCount?: number;
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
