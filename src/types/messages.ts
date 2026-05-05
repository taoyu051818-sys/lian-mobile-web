export type MessageTabKey = "channel" | "notifications";

export interface ChannelMessageAuthor {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  identityTag?: string;
}

export interface ChannelMessage {
  id: string | number;
  content?: string;
  contentHtml?: string;
  identityTag?: string;
  author?: ChannelMessageAuthor;
  username?: string;
  displayName?: string;
  time?: string;
  timestampISO?: string;
  readCount?: number;
}

export interface ChannelResponse {
  items?: ChannelMessage[];
  hasMore?: boolean;
  nextOffset?: number;
}

export interface NotificationActor {
  displayName?: string;
  username?: string;
  identityTag?: string;
}

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
