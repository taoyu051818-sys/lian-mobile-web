import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import {
  buildPendingChannelMessage,
  fetchChannelMessages,
  markChannelMessagesRead,
  mergeChannelMessagesChronologically,
  sendChannelMessage,
} from "../../api/messages";
import { ERROR_LOAD_CHANNEL, ERROR_SEND_MESSAGE } from "../../config/brand";
import type { ChannelMessage } from "../../types/messages";
import type { ProfileUser } from "../../types/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

const SCROLL_BOTTOM_THRESHOLD = 120;
const REPLACE_RETRY_LIMIT = 2;
const REPLACE_RETRY_DELAY_MS = 1200;

interface UseChannelMessagesOptions {
  currentUser: Ref<ProfileUser | null>;
  composerContent: Ref<string>;
  composerIdentityTag: Ref<string>;
  sending: Ref<boolean>;
  sendError: Ref<string>;
}

export function useChannelMessages(options: UseChannelMessagesOptions) {
  const channelItems = ref<ChannelMessage[]>([]);
  const channelLoading = ref(false);
  const channelError = ref("");
  const channelHasMore = ref(false);
  const channelOffset = ref(0);
  const isNearBottom = ref(true);

  function checkNearBottom() {
    const doc = document.documentElement;
    isNearBottom.value = doc.scrollHeight - window.scrollY - window.innerHeight < SCROLL_BOTTOM_THRESHOLD;
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

  async function loadChannel(reset = true) {
    if (channelLoading.value) return;
    channelLoading.value = true;
    channelError.value = "";

    let prevScrollHeight = 0;
    let prevScrollTop = 0;
    if (!reset) {
      prevScrollHeight = document.documentElement.scrollHeight;
      prevScrollTop = window.scrollY;
    }

    if (reset) {
      channelItems.value = [];
      channelOffset.value = 0;
    }

    try {
      const response = await fetchChannelMessages(reset ? 0 : channelOffset.value, 30);
      const nextItems = response.items || [];
      channelItems.value = reset
        ? nextItems
        : mergeChannelMessagesChronologically(channelItems.value, nextItems);
      channelHasMore.value = Boolean(response.hasMore);
      channelOffset.value = response.nextOffset ?? channelOffset.value;

      if (!reset) {
        await nextTick();
        const delta = document.documentElement.scrollHeight - prevScrollHeight;
        if (delta > 0) {
          window.scrollTo(0, prevScrollTop + delta);
        }
      }

      if (reset && channelItems.value.length) {
        const ids = channelItems.value.map((item) => item.id);
        markChannelMessagesRead(ids).catch(() => {});
        await scrollToBottom();
      }
      checkNearBottom();
    } catch (error) {
      channelError.value = extractErrorMessage(error, ERROR_LOAD_CHANNEL);
    } finally {
      channelLoading.value = false;
    }
  }

  async function replacePendingWithLatest(pendingId: string, retriesLeft = REPLACE_RETRY_LIMIT) {
    try {
      const response = await fetchChannelMessages(0, 30);
      const latestItems = response.items || [];
      const pendingItem = channelItems.value.find((item) => String(item.id) === pendingId);
      const pendingContent = pendingItem?.content || "";

      const confirmedFound = latestItems.some(
        (serverItem) => serverItem.content === pendingContent && serverItem.isSelf && !String(serverItem.id).startsWith("pending-"),
      );

      if (confirmedFound) {
        channelItems.value = channelItems.value
          .filter((item) => String(item.id) !== pendingId)
          .concat(latestItems.filter((serverItem) => {
            const existingIds = new Set(channelItems.value.map((item) => String(item.id)));
            if (existingIds.has(String(serverItem.id))) return false;
            if (serverItem.content === pendingContent && !serverItem.isSelf) return false;
            return true;
          }));

        channelItems.value = channelItems.value.slice().sort((a, b) => {
          const aPending = String(a.id).startsWith("pending-");
          const bPending = String(b.id).startsWith("pending-");
          if (aPending !== bPending) return aPending ? 1 : -1;
          const aTime = a.timestampISO || a.time || "";
          const bTime = b.timestampISO || b.time || "";
          return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
        });
      } else if (retriesLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, REPLACE_RETRY_DELAY_MS));
        await replacePendingWithLatest(pendingId, retriesLeft - 1);
        return;
      } else {
        resolvePendingState(pendingId, "sent");
      }

      if (isNearBottom.value) await scrollToBottom();
    } catch {
      resolvePendingState(pendingId, "failed");
    }
  }

  async function submitMessage() {
    const content = options.composerContent.value.trim();
    if (!content || options.sending.value) return;

    options.sending.value = true;
    options.sendError.value = "";

    const pending = buildPendingChannelMessage(
      content,
      options.composerIdentityTag.value || undefined,
      options.currentUser.value,
    );
    channelItems.value = [...channelItems.value, pending];
    options.composerContent.value = "";
    await scrollToBottom();

    try {
      await sendChannelMessage({
        content,
        identityTag: options.composerIdentityTag.value,
      });
      await replacePendingWithLatest(String(pending.id));
    } catch (error) {
      const pendingIndex = channelItems.value.findIndex((item) => String(item.id) === String(pending.id));
      if (pendingIndex !== -1) {
        const updated = [...channelItems.value];
        updated[pendingIndex] = { ...updated[pendingIndex], deliveryState: "failed" };
        channelItems.value = updated;
      }
      options.sendError.value = extractErrorMessage(error, ERROR_SEND_MESSAGE);
    } finally {
      options.sending.value = false;
    }
  }

  async function retryMessage(pendingId: string) {
    const pending = channelItems.value.find((item) => String(item.id) === pendingId);
    if (!pending || options.sending.value) return;

    options.sending.value = true;
    options.sendError.value = "";

    const retryIndex = channelItems.value.findIndex((item) => String(item.id) === pendingId);
    if (retryIndex !== -1) {
      const updated = [...channelItems.value];
      updated[retryIndex] = { ...updated[retryIndex], deliveryState: "sending" };
      channelItems.value = updated;
    }

    try {
      await sendChannelMessage({
        content: pending.content || "",
        identityTag: options.composerIdentityTag.value || "",
      });
      await replacePendingWithLatest(pendingId);
    } catch (error) {
      const failedIndex = channelItems.value.findIndex((item) => String(item.id) === pendingId);
      if (failedIndex !== -1) {
        const updated = [...channelItems.value];
        updated[failedIndex] = { ...updated[failedIndex], deliveryState: "failed" };
        channelItems.value = updated;
      }
      options.sendError.value = extractErrorMessage(error, ERROR_SEND_MESSAGE);
    } finally {
      options.sending.value = false;
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
    loadChannel,
    retryMessage,
    submitMessage,
  };
}
