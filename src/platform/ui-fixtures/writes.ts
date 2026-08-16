/**
 * In-memory write store for the offline fixture runtime.
 *
 * Every write surface (like, save, vote, reply, publish, join, errand claim,
 * settings, cart) mutates only this store. Nothing here is persisted to a
 * database, nothing triggers a real payment, order or notification, and the
 * whole store is discarded on reload unless the caller opts into the DEV-only
 * localStorage mirror below.
 *
 * The store is intentionally *not* the app's production state: features keep
 * their own stores and simply observe the fixture responses that read from here.
 */

const STORAGE_KEY = "lian.dev.ui-fixtures.writes.v1";

interface WriteStore {
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;
  votes: Map<string, "up" | "down">;
  replies: Map<string, Array<{ id: string; body: string; createdAt: string }>>;
  joinedEventIds: Set<string>;
  claimedErrandOrderIds: Set<string>;
  cart: Map<string, { productId: string; skuId: string; quantity: number }>;
  settings: Record<string, unknown>;
  publishedPostIds: string[];
  /**
   * Channel messages sent during the session. Kept as opaque records because
   * only the messages fixture family reads them back, and it owns the shape.
   */
  sentChannelMessages: Array<Record<string, unknown>>;
  readNotificationIds: Set<string>;
  counter: number;
}

function createStore(): WriteStore {
  return {
    likedPostIds: new Set(),
    savedPostIds: new Set(),
    votes: new Map(),
    replies: new Map(),
    joinedEventIds: new Set(),
    claimedErrandOrderIds: new Set(),
    cart: new Map(),
    settings: {},
    publishedPostIds: [],
    sentChannelMessages: [],
    readNotificationIds: new Set(),
    counter: 0,
  };
}

let store = createStore();

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** DEV-only mirror so a reload keeps the toggles you were poking at. */
function persist(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        likedPostIds: [...store.likedPostIds],
        savedPostIds: [...store.savedPostIds],
        votes: [...store.votes],
        replies: [...store.replies],
        joinedEventIds: [...store.joinedEventIds],
        claimedErrandOrderIds: [...store.claimedErrandOrderIds],
        cart: [...store.cart],
        settings: store.settings,
        publishedPostIds: store.publishedPostIds,
        sentChannelMessages: store.sentChannelMessages,
        readNotificationIds: [...store.readNotificationIds],
        counter: store.counter,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function hydrateFixtureWrites(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = createStore();
    if (Array.isArray(parsed.likedPostIds))
      next.likedPostIds = new Set(parsed.likedPostIds as string[]);
    if (Array.isArray(parsed.savedPostIds))
      next.savedPostIds = new Set(parsed.savedPostIds as string[]);
    if (Array.isArray(parsed.votes))
      next.votes = new Map(parsed.votes as Array<[string, "up" | "down"]>);
    if (Array.isArray(parsed.replies)) {
      next.replies = new Map(
        parsed.replies as Array<[string, Array<{ id: string; body: string; createdAt: string }>]>,
      );
    }
    if (Array.isArray(parsed.joinedEventIds))
      next.joinedEventIds = new Set(parsed.joinedEventIds as string[]);
    if (Array.isArray(parsed.claimedErrandOrderIds)) {
      next.claimedErrandOrderIds = new Set(parsed.claimedErrandOrderIds as string[]);
    }
    if (Array.isArray(parsed.cart)) {
      next.cart = new Map(
        parsed.cart as Array<[string, { productId: string; skuId: string; quantity: number }]>,
      );
    }
    if (parsed.settings && typeof parsed.settings === "object") {
      next.settings = parsed.settings as Record<string, unknown>;
    }
    if (Array.isArray(parsed.publishedPostIds))
      next.publishedPostIds = parsed.publishedPostIds as string[];
    if (Array.isArray(parsed.sentChannelMessages)) {
      next.sentChannelMessages = parsed.sentChannelMessages as Array<Record<string, unknown>>;
    }
    if (Array.isArray(parsed.readNotificationIds)) {
      next.readNotificationIds = new Set(parsed.readNotificationIds as string[]);
    }
    if (typeof parsed.counter === "number") next.counter = parsed.counter;
    store = next;
  } catch {
    /* ignore malformed dev state */
  }
}

/** Wipes every simulated write. Wired to the toolbar Reset button. */
export function resetFixtureWrites(): void {
  store = createStore();
  try {
    safeLocalStorage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function nextId(prefix: string): string {
  store.counter += 1;
  return `${prefix}-${store.counter}`;
}

export function isPostLiked(postId: string, fallback = false): boolean {
  if (store.likedPostIds.has(postId)) return true;
  if (store.likedPostIds.has(`!${postId}`)) return false;
  return fallback;
}

/** Returns the new liked state. Explicit un-like is recorded as `!id`. */
export function togglePostLike(postId: string, fallback = false): boolean {
  const liked = isPostLiked(postId, fallback);
  store.likedPostIds.delete(postId);
  store.likedPostIds.delete(`!${postId}`);
  if (liked) {
    store.likedPostIds.add(`!${postId}`);
  } else {
    store.likedPostIds.add(postId);
  }
  persist();
  return !liked;
}

export function isPostSaved(postId: string, fallback = false): boolean {
  if (store.savedPostIds.has(postId)) return true;
  if (store.savedPostIds.has(`!${postId}`)) return false;
  return fallback;
}

export function togglePostSave(postId: string, fallback = false): boolean {
  const saved = isPostSaved(postId, fallback);
  store.savedPostIds.delete(postId);
  store.savedPostIds.delete(`!${postId}`);
  if (saved) {
    store.savedPostIds.add(`!${postId}`);
  } else {
    store.savedPostIds.add(postId);
  }
  persist();
  return !saved;
}

export function setPostVote(postId: string, direction: "up" | "down" | null): "up" | "down" | null {
  if (direction === null) {
    store.votes.delete(postId);
  } else if (store.votes.get(postId) === direction) {
    store.votes.delete(postId);
  } else {
    store.votes.set(postId, direction);
  }
  persist();
  return store.votes.get(postId) ?? null;
}

export function getPostVote(postId: string): "up" | "down" | null {
  return store.votes.get(postId) ?? null;
}

export function addReply(
  postId: string,
  body: string,
): { id: string; body: string; createdAt: string } {
  const reply = { id: nextId("reply"), body, createdAt: new Date().toISOString() };
  const existing = store.replies.get(postId) ?? [];
  store.replies.set(postId, [...existing, reply]);
  persist();
  return reply;
}

export function getReplies(postId: string): Array<{ id: string; body: string; createdAt: string }> {
  return [...(store.replies.get(postId) ?? [])];
}

export function toggleEventJoin(eventId: string): boolean {
  if (store.joinedEventIds.has(eventId)) {
    store.joinedEventIds.delete(eventId);
    persist();
    return false;
  }
  store.joinedEventIds.add(eventId);
  persist();
  return true;
}

export function isEventJoined(eventId: string): boolean {
  return store.joinedEventIds.has(eventId);
}

export function claimErrandOrder(orderId: string): void {
  store.claimedErrandOrderIds.add(orderId);
  persist();
}

export function isErrandOrderClaimed(orderId: string): boolean {
  return store.claimedErrandOrderIds.has(orderId);
}

export function upsertCartLine(productId: string, skuId: string, quantity: number): void {
  const key = `${productId}:${skuId}`;
  if (quantity <= 0) {
    store.cart.delete(key);
  } else {
    store.cart.set(key, { productId, skuId, quantity: Math.min(quantity, 99) });
  }
  persist();
}

export function getCartLines(): Array<{ productId: string; skuId: string; quantity: number }> {
  return [...store.cart.values()];
}

export function mergeSettings(patch: Record<string, unknown>): Record<string, unknown> {
  store.settings = { ...store.settings, ...patch };
  persist();
  return { ...store.settings };
}

export function getSettings(): Record<string, unknown> {
  return { ...store.settings };
}

export function recordPublishedPost(): string {
  const id = nextId("draft");
  store.publishedPostIds.push(id);
  persist();
  return id;
}

export function getPublishedPostIds(): string[] {
  return [...store.publishedPostIds];
}

/**
 * Records a channel message sent this session. `/api/channel` is a single
 * campus-wide channel, so there is nothing to key by.
 *
 * This matters for realism: POST `/api/channel/messages` returns no body and
 * `useChannelMessages` reconciles its optimistic item by re-fetching, so the
 * send only survives if the message is persisted here first.
 */
export function appendChannelMessage(message: Record<string, unknown>): string {
  const id = nextId("msg");
  store.sentChannelMessages.push({ ...message, id });
  persist();
  return id;
}

export function getChannelMessages(): Array<Record<string, unknown>> {
  return [...store.sentChannelMessages];
}

export function markNotificationRead(notificationId: string): void {
  store.readNotificationIds.add(notificationId);
  persist();
}

export function markAllNotificationsRead(ids: readonly string[]): void {
  for (const id of ids) store.readNotificationIds.add(id);
  persist();
}

export function isNotificationRead(notificationId: string, fallback = false): boolean {
  return store.readNotificationIds.has(notificationId) || fallback;
}
