import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  buildPendingChannelMessage,
  fetchChannelMessages,
  isChannelVisibility,
  markChannelMessagesRead,
  mergeChannelMessagesChronologically,
  sendChannelMessage,
} from "../../api/channel";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { ERROR_LOAD_CHANNEL, MESSAGE_EMPTY_CONTENT } from "../../config/brand";
import type { ChannelMessage } from "../../types/messages";
import type { ProfileUser } from "../../types/profile";
import type { AudienceVisibility } from "../../types/audience";

const SCROLL_BOTTOM_THRESHOLD = 120;
const REPLACE_RETRY_LIMIT = 2;
const REPLACE_RETRY_DELAY_MS = 1200;
const CHANNEL_PAGE_SIZE = 30;

export function useChannelMessages() {
  const channelItems = ref<ChannelMessage[]>([]);
  const channelLoading = ref(false);
  const channelError = ref("");
  const channelHasMore = ref(false);
  const channelOffset = ref(0);
  const channelVisibilityFilter = ref<AudienceVisibility>();
  const isNearBottom = ref(true);
  let channelLoadGeneration = 0;

  function isCurrentChannelLoad(generation: number, visibility?: AudienceVisibility) {
    return generation === channelLoadGeneration && visibility === channelVisibilityFilter.value;
  }

  function messageText(item: ChannelMessage) {
    return item.plainText || item.content || MESSAGE_EMPTY_CONTENT;
  }

  function checkNearBottom() {
    const doc = document.documentElement;
    isNearBottom.value =
      doc.scrollHeight - window.scrollY - window.innerHeight < SCROLL_BOTTOM_THRESHOLD;
  }

  async function scrollToBottom() {
    await nextTick();
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  function resolvePendingState(pendingId: string, deliveryState: "sent" | "failed") {
    const idx = channelItems.value.findIndex((item) => String(item.id) === pendingId);
    if (idx === -1) return;
    const updated = [...channelItems.value];
    updated[idx] = { ...updated[idx], deliveryState };
    channelItems.value = updated;
  }

  async function loadChannel(reset = true, visibility = channelVisibilityFilter.value) {
    if (!reset && channelLoading.value) return;

    const generation = reset ? ++channelLoadGeneration : channelLoadGeneration;
    const requestedOffset = reset ? 0 : channelOffset.value;

    if (reset) {
      channelVisibilityFilter.value = visibility;
      channelItems.value = [];
      channelOffset.value = 0;
      channelHasMore.value = false;
    }

    channelLoading.value = true;
    channelError.value = "";

    let prevScrollHeight = 0;
    let prevScrollTop = 0;
    if (!reset) {
      prevScrollHeight = document.documentElement.scrollHeight;
      prevScrollTop = window.scrollY;
    }

    try {
      const response = await fetchChannelMessages(requestedOffset, CHANNEL_PAGE_SIZE, visibility);
      if (!isCurrentChannelLoad(generation, visibility)) return;

      const nextItems = response.items || [];
      channelItems.value = reset
        ? nextItems
        : mergeChannelMessagesChronologically(channelItems.value, nextItems);
      channelHasMore.value = Boolean(response.hasMore);
      channelOffset.value = response.nextOffset ?? channelOffset.value;

      if (!reset) {
        await nextTick();
        if (!isCurrentChannelLoad(generation, visibility)) return;
        const delta = document.documentElement.scrollHeight - prevScrollHeight;
        if (delta > 0) {
          window.scrollTo(0, prevScrollTop + delta);
        }
      }

      if (reset && channelItems.value.length) {
        const ids = channelItems.value.map((item) => item.id);
        markChannelMessagesRead(ids).catch(() => {});
        await scrollToBottom();
        if (!isCurrentChannelLoad(generation, visibility)) return;
      }
      checkNearBottom();
    } catch (error) {
      if (!isCurrentChannelLoad(generation, visibility)) return;
      channelError.value = extractErrorMessage(error, ERROR_LOAD_CHANNEL);
    } finally {
      if (isCurrentChannelLoad(generation, visibility)) {
        channelLoading.value = false;
      }
    }
  }

  async function setChannelVisibilityFilter(visibility?: AudienceVisibility) {
    if (visibility === channelVisibilityFilter.value) return;
    await loadChannel(true, visibility);
  }

  async function replacePendingWithLatest(pendingId: string, retriesLeft = REPLACE_RETRY_LIMIT) {
    if (!channelItems.value.some((item) => String(item.id) === pendingId)) return;

    const generation = channelLoadGeneration;
    const visibility = channelVisibilityFilter.value;
    try {
      const response = await fetchChannelMessages(0, CHANNEL_PAGE_SIZE, visibility);
      if (!isCurrentChannelLoad(generation, visibility)) return;

      const latestItems = response.items || [];
      const pendingItem = channelItems.value.find((item) => String(item.id) === pendingId);
      const pendingContent = pendingItem?.content || "";
      const pendingNonce = pendingItem?.clientNonce || "";

      // Prefer nonce match — backends that echo `clientNonce` give us an exact
      // 1:1 binding so two rapid messages with identical content don't get
      // crossed over. Falls back to content + isSelf, which keeps working
      // against backends that haven't shipped the nonce echo yet.
      const confirmedFound = latestItems.some((serverItem) => {
        if (String(serverItem.id).startsWith("pending-")) return false;
        if (pendingNonce && serverItem.clientNonce === pendingNonce) return true;
        return serverItem.content === pendingContent && serverItem.isSelf;
      });

      if (confirmedFound) {
        channelItems.value = channelItems.value
          .filter((item) => String(item.id) !== pendingId)
          .concat(
            latestItems.filter((serverItem) => {
              const existingIds = new Set(channelItems.value.map((i) => String(i.id)));
              if (existingIds.has(String(serverItem.id))) return false;
              if (pendingNonce && serverItem.clientNonce === pendingNonce) return true;
              if (serverItem.content === pendingContent && !serverItem.isSelf) return false;
              return true;
            }),
          );

        channelItems.value = channelItems.value.slice().sort((a, b) => {
          const aPending = String(a.id).startsWith("pending-");
          const bPending = String(b.id).startsWith("pending-");
          if (aPending !== bPending) return aPending ? 1 : -1;
          const ta = a.timestampISO || a.time || "";
          const tb = b.timestampISO || b.time || "";
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        });
      } else if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, REPLACE_RETRY_DELAY_MS));
        if (!isCurrentChannelLoad(generation, visibility)) return;
        await replacePendingWithLatest(pendingId, retriesLeft - 1);
        return;
      } else {
        resolvePendingState(pendingId, "sent");
      }

      if (isNearBottom.value) await scrollToBottom();
    } catch {
      if (!isCurrentChannelLoad(generation, visibility)) return;
      resolvePendingState(pendingId, "failed");
    }
  }

  async function sendMessage(
    content: string,
    identityTag: string,
    currentUser: ProfileUser | null,
    visibility: AudienceVisibility = "public",
  ) {
    const pending = buildPendingChannelMessage(
      content,
      identityTag || undefined,
      currentUser,
      visibility,
    );
    channelItems.value = [...channelItems.value, pending];
    await scrollToBottom();

    try {
      await sendChannelMessage({
        content,
        identityTag,
        clientNonce: pending.clientNonce,
        visibility,
      });
      await replacePendingWithLatest(String(pending.id));
    } catch {
      const idx = channelItems.value.findIndex((item) => String(item.id) === String(pending.id));
      if (idx !== -1) {
        const updated = [...channelItems.value];
        updated[idx] = { ...updated[idx], deliveryState: "failed" };
        channelItems.value = updated;
      }
    }
  }

  async function retryMessage(pendingId: string, identityTag: string) {
    const pending = channelItems.value.find((item) => String(item.id) === pendingId);
    if (!pending) return;

    const idx = channelItems.value.findIndex((item) => String(item.id) === pendingId);
    if (idx !== -1) {
      const updated = [...channelItems.value];
      updated[idx] = { ...updated[idx], deliveryState: "sending" };
      channelItems.value = updated;
    }

    try {
      await sendChannelMessage({
        content: pending.content || "",
        identityTag: identityTag || "",
        clientNonce: pending.clientNonce,
        visibility: isChannelVisibility(pending.visibility) ? pending.visibility : "public",
      });
      await replacePendingWithLatest(pendingId);
    } catch {
      const failIdx = channelItems.value.findIndex((item) => String(item.id) === pendingId);
      if (failIdx !== -1) {
        const updated = [...channelItems.value];
        updated[failIdx] = { ...updated[failIdx], deliveryState: "failed" };
        channelItems.value = updated;
      }
    }
  }

  onMounted(() => {
    window.addEventListener("scroll", checkNearBottom, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("scroll", checkNearBottom);
  });

  return {
    channelItems,
    channelLoading,
    channelError,
    channelHasMore,
    channelVisibilityFilter,
    isNearBottom,
    messageText,
    loadChannel,
    setChannelVisibilityFilter,
    replacePendingWithLatest,
    resolvePendingState,
    sendMessage,
    retryMessage,
    scrollToBottom,
    checkNearBottom,
  };
}
