<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchAuthMe } from "../api/profile";
import { buildPendingChannelMessage, fetchChannelMessages, fetchNotifications, markChannelMessagesRead, mergeChannelMessagesChronologically, sendChannelMessage } from "../api/messages";
import { useFloatingChromeController } from "../motion/floatingChrome";
import { usePostDetail } from "../composables/usePostDetail";
import { useVisualViewport } from "../composables/useVisualViewport";
import { actorAvatarText, actorDisplayName } from "../utils/actor";
import type { FeedItemId } from "../types/feed";
import type { ChannelMessage, ChannelMessageActor, MessageTabKey, NotificationItem } from "../types/messages";
import type { ProfileUser } from "../types/profile";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import { MessagesTabs, ChannelComposer, ChannelThread, NotificationList } from "./messages";

const emit = defineEmits<{
  chrome: [hidden: boolean];
}>();

const activeTab = ref<MessageTabKey>("channel");
const channelItems = ref<ChannelMessage[]>([]);
const notificationItems = ref<NotificationItem[]>([]);
const channelLoading = ref(false);
const notificationLoading = ref(false);
const channelError = ref("");
const notificationError = ref("");
const channelHasMore = ref(false);
const channelOffset = ref(0);
const composerContent = ref("");
const composerIdentityTag = ref("");
const currentUser = ref<ProfileUser | null>(null);
const identityTags = ref<string[]>([]);
const sending = ref(false);
const sendError = ref("");
const isNearBottom = ref(true);
const {
  selectedPostId, selectedPost, detailLoading, detailError, detailOpen,
  openDetail: openNotification, closeDetail, retryDetail,
} = usePostDetail();

useVisualViewport();

const tabsChrome = useFloatingChromeController({ initialPhase: "visible" });
const tabsChromePhase = tabsChrome.phase;
const tabsChromeStyle = tabsChrome.style;

const composerChrome = useFloatingChromeController({ initialPhase: "visible" });
const composerChromePhase = composerChrome.phase;
const composerChromeStyle = composerChrome.style;

const tabs: Array<{ key: MessageTabKey; label: string }> = [
  { key: "channel", label: "频道" },
  { key: "notifications", label: "通知" },
];

const activeAlias = computed(() => {
  const user = currentUser.value;
  if (!user?.aliases?.length) return null;
  return user.aliases.find((alias) => alias.id === user.activeAliasId) || user.aliases[0] || null;
});
const composerActorName = computed(() => activeAlias.value?.name || currentUser.value?.username || "同学");
const composerAvatarText = computed(() => composerActorName.value.slice(0, 2) || "同");
const composerSignalMeta = computed(() => composerIdentityTag.value ? `身份信号：${composerIdentityTag.value}` : "未选择身份信号");

function messageText(item: ChannelMessage) {
  return item.plainText || item.content || "这条消息暂时没有内容。";
}

function messageActor(item: ChannelMessage): ChannelMessageActor {
  return item.actor || { id: "" };
}

function messageAuthor(item: ChannelMessage) {
  return actorDisplayName(messageActor(item));
}

function messageAvatarText(item: ChannelMessage) {
  return actorAvatarText(messageActor(item), messageAuthor(item));
}

function messageMeta(item: ChannelMessage) {
  const actor = messageActor(item);
  return actor.identityTag || "校园频道";
}

function notificationActor(item: NotificationItem) {
  return actorDisplayName(item.actor, isReplyNotification(item) ? "回复" : "通知");
}

function isReplyNotification(item: NotificationItem) {
  return ["new-reply", "reply", "new-post", "post-reply"].includes(String(item.type || ""));
}

const SCROLL_BOTTOM_THRESHOLD = 120;
const REPLACE_RETRY_LIMIT = 2;
const REPLACE_RETRY_DELAY_MS = 1200;

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

async function loadCurrentUser() {
  try {
    const user = await fetchAuthMe();
    currentUser.value = user || null;
    identityTags.value = user?.identityTags?.length ? user.identityTags : [];
    composerIdentityTag.value = "";
  } catch {
    currentUser.value = null;
    identityTags.value = [];
    composerIdentityTag.value = "";
  }
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
    channelError.value = error instanceof Error ? error.message : "频道消息暂时没加载出来，可以稍后再试。";
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
          const existingIds = new Set(channelItems.value.map((i) => String(i.id)));
          if (existingIds.has(String(serverItem.id))) return false;
          if (serverItem.content === pendingContent && !serverItem.isSelf) return false;
          return true;
        }));

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

async function loadNotifications() {
  if (notificationLoading.value) return;
  notificationLoading.value = true;
  notificationError.value = "";

  try {
    const response = await fetchNotifications();
    notificationItems.value = response.items || [];
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : "通知暂时没加载出来，可以稍后再试。";
  } finally {
    notificationLoading.value = false;
  }
}

async function switchTab(tab: MessageTabKey) {
  activeTab.value = tab;
  if (tab === "channel") {
    composerChrome.show();
    if (!channelItems.value.length) await loadChannel(true);
  } else {
    composerChrome.hide();
    if (!notificationItems.value.length) await loadNotifications();
  }
}

async function submitMessage() {
  const content = composerContent.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  sendError.value = "";

  const pending = buildPendingChannelMessage(content, composerIdentityTag.value || undefined, currentUser.value);
  channelItems.value = [...channelItems.value, pending];
  composerContent.value = "";
  await scrollToBottom();

  try {
    await sendChannelMessage({ content, identityTag: composerIdentityTag.value });
    await replacePendingWithLatest(String(pending.id));
  } catch (error) {
    const idx = channelItems.value.findIndex((item) => String(item.id) === String(pending.id));
    if (idx !== -1) {
      const updated = [...channelItems.value];
      updated[idx] = { ...updated[idx], deliveryState: "failed" };
      channelItems.value = updated;
    }
    sendError.value = error instanceof Error ? error.message : "消息没有发送成功，可以稍后再试。";
  } finally {
    sending.value = false;
  }
}

async function retryMessage(pendingId: string) {
  const pending = channelItems.value.find((item) => String(item.id) === pendingId);
  if (!pending || sending.value) return;

  sending.value = true;
  sendError.value = "";

  const idx = channelItems.value.findIndex((item) => String(item.id) === pendingId);
  if (idx !== -1) {
    const updated = [...channelItems.value];
    updated[idx] = { ...updated[idx], deliveryState: "sending" };
    channelItems.value = updated;
  }

  try {
    await sendChannelMessage({ content: pending.content || "", identityTag: composerIdentityTag.value || "" });
    await replacePendingWithLatest(pendingId);
  } catch (error) {
    const failIdx = channelItems.value.findIndex((item) => String(item.id) === pendingId);
    if (failIdx !== -1) {
      const updated = [...channelItems.value];
      updated[failIdx] = { ...updated[failIdx], deliveryState: "failed" };
      channelItems.value = updated;
    }
    sendError.value = error instanceof Error ? error.message : "消息没有发送成功，可以稍后再试。";
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  await loadCurrentUser();
  await loadChannel(true);
  window.addEventListener("scroll", checkNearBottom, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", checkNearBottom);
  tabsChrome.dispose();
  composerChrome.dispose();
});
</script>

<template>
  <section class="messages-view" aria-label="消息">
    <MessagesTabs
      class="lian-floating-chrome lian-floating-chrome--top"
      data-floating-chrome="top"
      :data-floating-state="tabsChromePhase"
      :style="tabsChromeStyle"
      :tabs="tabs"
      :active-tab="activeTab"
      @switch="switchTab"
    />

    <ChannelThread
      v-if="activeTab === 'channel'"
      :items="channelItems"
      :loading="channelLoading"
      :error="channelError"
      :has-more="channelHasMore"
      @retry="loadChannel(true)"
      @load-more="loadChannel(false)"
      @retry-message="retryMessage"
    />

    <NotificationList
      v-else
      :items="notificationItems"
      :loading="notificationLoading"
      :error="notificationError"
      @retry="loadNotifications"
      @open-item="openNotification"
    />

    <ChannelComposer
      v-if="activeTab === 'channel'"
      class="messages-view__chrome-composer lian-floating-chrome lian-floating-chrome--bottom"
      data-floating-chrome="bottom"
      :data-floating-state="composerChromePhase"
      :style="composerChromeStyle"
      :avatar-text="composerAvatarText"
      :actor-name="composerActorName"
      :signal-meta="composerSignalMeta"
      :identity-tags="identityTags"
      :content="composerContent"
      :identity-tag="composerIdentityTag"
      :sending="sending"
      :send-error="sendError"
      @update:content="composerContent = $event"
      @update:identity-tag="composerIdentityTag = $event"
      @submit="submitMessage"
    />

    <div v-if="detailOpen" class="messages-view__detail-overlay" role="dialog" aria-modal="true" aria-label="帖子详情">
      <PostDetailPanel
        :post="selectedPost"
        :loading="detailLoading"
        :error="detailError"
        @close="closeDetail"
        @retry="retryDetail"
      />
    </div>
  </section>
</template>

<style scoped>
.messages-view {
  display: grid;
  gap: var(--space-4);
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
  padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom) + var(--keyboard-inset-bottom));
}

.messages-view__chrome-composer {
  bottom: calc(var(--floating-bar-bottom-offset) + var(--floating-bar-height) + var(--space-2) + var(--keyboard-inset-bottom, 0px));
}

.messages-view__detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  background: var(--lian-surface, #fff);
}
</style>
