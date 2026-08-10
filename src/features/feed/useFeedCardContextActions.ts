import { computed, onScopeDispose, ref, toRaw, watch, type Ref } from "vue";
import { togglePostSave } from "../../api/posts";
import {
  ERROR_SAVE_ACTION,
  FEED_BOOKMARK_REMOVED,
  FEED_BOOKMARK_SAVED,
  SHARE_ERROR_SHARE_FAILED,
  SHARE_LINK_COPIED,
} from "../../config/brand";
import { hapticMedium } from "../../composables/useHapticFeedback";
import { sharePost, type SharePostResult } from "../../platform/share";
import type { FeedItem, FeedItemId } from "../../types/feed";
import { useToast } from "../../ui/feedback/useToast";
import { postReactionSettlements, type PostReactionSettlementPort } from "../reactions";

export type FeedCardBounds = Readonly<{
  top: number;
  left: number;
  width: number;
  height: number;
}>;

export interface FeedCardContextMenuRequest {
  x: number;
  y: number;
  target: HTMLElement | null;
  ownerToken: unknown;
}

export interface FeedCardMenuSnapshot {
  readonly ownerToken: unknown;
  readonly tid: FeedItemId;
  readonly title: string;
  readonly item: Readonly<FeedItem>;
  readonly rect: FeedCardBounds | null;
}

export interface FeedCardContextActionDependencies {
  savePost?: typeof togglePostSave;
  share?: typeof sharePost;
  toast?: Pick<ReturnType<typeof useToast>, "success" | "info" | "error">;
  haptic?: typeof hapticMedium;
}

export interface UseFeedCardContextActionsOptions {
  item: Readonly<Ref<FeedItem>>;
  title: () => string;
  emitOpen: (id: FeedItemId, payload?: { item: FeedItem; rect: FeedCardBounds }) => void;
  settlements?: PostReactionSettlementPort;
  dependencies?: FeedCardContextActionDependencies;
}

const REACTION_ITEM_KEYS = new Set<PropertyKey>(["liked", "likeCount", "bookmarked"]);

function isReactionOnlyReplacement(previousItem: FeedItem, nextItem: FeedItem): boolean {
  if (previousItem.tid !== nextItem.tid) return false;

  const previousKeys = Reflect.ownKeys(previousItem).filter((key) => !REACTION_ITEM_KEYS.has(key));
  const nextKeys = Reflect.ownKeys(nextItem).filter((key) => !REACTION_ITEM_KEYS.has(key));
  if (previousKeys.length !== nextKeys.length) return false;

  const nextKeySet = new Set(nextKeys);
  const previousRecord = previousItem as unknown as Record<PropertyKey, unknown>;
  const nextRecord = nextItem as unknown as Record<PropertyKey, unknown>;
  return previousKeys.every(
    (key) => nextKeySet.has(key) && Object.is(previousRecord[key], nextRecord[key]),
  );
}

function cloneDetached<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object") return value;

  const source = toRaw(value) as object;
  const existing = seen.get(source);
  if (existing !== undefined) return existing as T;

  if (Array.isArray(source)) {
    const clone: unknown[] = [];
    seen.set(source, clone);
    for (const entry of source) clone.push(cloneDetached(entry, seen));
    return clone as T;
  }

  const clone: Record<string, unknown> = {};
  seen.set(source, clone);
  for (const [key, entry] of Object.entries(source)) {
    clone[key] = cloneDetached(entry, seen);
  }
  return clone as T;
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;

  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const entry of Object.values(object)) freezeDeep(entry, seen);
  return Object.freeze(value);
}

function copyBounds(target: HTMLElement | null): FeedCardBounds | null {
  if (!target) return null;
  const bounds = target.getBoundingClientRect();
  return Object.freeze({
    top: bounds.top,
    left: bounds.left,
    width: bounds.width,
    height: bounds.height,
  });
}

function feedbackForShare(
  result: SharePostResult,
  toast: Pick<ReturnType<typeof useToast>, "success" | "info" | "error">,
): void {
  switch (result.outcome) {
    case "copied":
      toast.success(SHARE_LINK_COPIED);
      break;
    case "use-wechat-menu":
      toast.info(result.message);
      break;
    case "failed":
      toast.error(result.message);
      break;
    case "shared":
    case "cancelled":
      break;
  }
}

function deliverFeedback(effect: () => void): void {
  try {
    effect();
  } catch {
    // Feedback is best-effort and must not reinterpret an authoritative API result.
  }
}

export function useFeedCardContextActions(options: UseFeedCardContextActionsOptions) {
  const dependencies = options.dependencies;
  const settlements = options.settlements ?? postReactionSettlements;
  const savePost = dependencies?.savePost ?? togglePostSave;
  const share = dependencies?.share ?? sharePost;
  const toast = dependencies?.toast ?? useToast();
  const haptic = dependencies?.haptic ?? hapticMedium;

  const visible = ref(false);
  const x = ref(0);
  const y = ref(0);
  const bookmarked = ref(Boolean(options.item.value.bookmarked));
  const bookmarkBusy = ref(false);
  const shareBusy = ref(false);
  const requestPending = computed(() => bookmarkBusy.value || shareBusy.value);

  let snapshot: FeedCardMenuSnapshot | null = null;
  let ownerGeneration = 0;
  let saveTicket = 0;
  let shareTicket = 0;
  let disposed = false;

  function closeMenu(): void {
    visible.value = false;
    snapshot = null;
  }

  function invalidateOwner(): void {
    ownerGeneration += 1;
    saveTicket += 1;
    shareTicket += 1;
    bookmarkBusy.value = false;
    shareBusy.value = false;
    closeMenu();
  }

  const stopItemWatch = watch(
    () => options.item.value,
    (nextItem, previousItem) => {
      if (nextItem === previousItem) return;
      if (isReactionOnlyReplacement(previousItem, nextItem)) {
        bookmarked.value = Boolean(nextItem.bookmarked);
        return;
      }
      invalidateOwner();
      bookmarked.value = Boolean(nextItem.bookmarked);
    },
    { flush: "sync" },
  );

  function openMenu(request: FeedCardContextMenuRequest): boolean {
    if (disposed) return false;
    const liveItem = options.item.value;
    if (request.ownerToken !== liveItem) return false;

    const title = options.title();
    if (options.item.value !== liveItem) return false;
    const detachedItem = freezeDeep(cloneDetached(liveItem));
    const rect = copyBounds(request.target);

    snapshot = Object.freeze({
      ownerToken: request.ownerToken,
      tid: liveItem.tid,
      title,
      item: detachedItem,
      rect,
    });
    x.value = request.x;
    y.value = request.y;
    visible.value = true;
    return true;
  }

  function ownsSave(generation: number, ticket: number): boolean {
    return !disposed && ownerGeneration === generation && saveTicket === ticket;
  }

  function ownsShare(generation: number, ticket: number): boolean {
    return !disposed && ownerGeneration === generation && shareTicket === ticket;
  }

  async function handleBookmark(): Promise<void> {
    if (disposed || bookmarkBusy.value || !snapshot) return;

    const actionSnapshot = snapshot;
    const desiredSaved = !bookmarked.value;
    const generation = ownerGeneration;
    const ticket = ++saveTicket;
    bookmarkBusy.value = true;
    closeMenu();

    let response: Awaited<ReturnType<typeof savePost>>;
    try {
      response = await savePost(actionSnapshot.tid, desiredSaved);
    } catch {
      if (!ownsSave(generation, ticket)) return;
      bookmarkBusy.value = false;
      deliverFeedback(() => toast.error(ERROR_SAVE_ACTION));
      return;
    }

    if (!ownsSave(generation, ticket)) return;
    const settledSaved = Boolean(response.saved);
    bookmarked.value = settledSaved;
    bookmarkBusy.value = false;
    deliverFeedback(haptic);
    deliverFeedback(() =>
      toast.success(settledSaved ? FEED_BOOKMARK_SAVED : FEED_BOOKMARK_REMOVED),
    );
    settlements.publish({
      kind: "save",
      tid: actionSnapshot.tid,
      bookmarked: settledSaved,
    });
  }

  async function handleShare(): Promise<void> {
    if (disposed || shareBusy.value || !snapshot) return;

    const actionSnapshot = snapshot;
    const generation = ownerGeneration;
    const ticket = ++shareTicket;
    shareBusy.value = true;
    closeMenu();

    try {
      const result = await share({ tid: actionSnapshot.tid, title: actionSnapshot.title });
      if (!ownsShare(generation, ticket)) return;
      feedbackForShare(result, toast);
    } catch {
      if (ownsShare(generation, ticket)) toast.error(SHARE_ERROR_SHARE_FAILED);
    } finally {
      if (ownsShare(generation, ticket)) shareBusy.value = false;
    }
  }

  function handleReport(): void {
    if (disposed || !snapshot) return;

    const actionSnapshot = snapshot;
    closeMenu();
    if (actionSnapshot.rect) {
      options.emitOpen(actionSnapshot.tid, {
        item: actionSnapshot.item as FeedItem,
        rect: actionSnapshot.rect,
      });
      return;
    }
    options.emitOpen(actionSnapshot.tid);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stopItemWatch();
    invalidateOwner();
  }

  onScopeDispose(dispose);

  return {
    visible,
    x,
    y,
    bookmarked,
    bookmarkBusy,
    shareBusy,
    requestPending,
    openMenu,
    closeMenu,
    handleBookmark,
    handleShare,
    handleReport,
    dispose,
  };
}
