<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePostDetail } from "../detail/usePostDetail";
import { useVisualViewport } from "../../composables/useVisualViewport";
import type { MessageTabKey } from "../../types/messages";
import type { PageChromeSpec } from "../../shell/page-model";
import PostDetailPanel from "../detail/PostDetailPanel.vue";
import { ChannelComposer, ChannelThread, NotificationList } from "./";
import {
  MESSAGE_TAB_CHANNEL, MESSAGE_TAB_NOTIFICATION,
  MESSAGE_SECTION_LABEL, MESSAGE_TAB_LABEL,
  POST_DETAIL_DIALOG_LABEL,
} from "../../config/brand";
import { useChannelMessages } from "./useChannelMessages";
import { useNotifications } from "./useNotifications";
import { useMessageComposer } from "./useMessageComposer";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const activeTab = ref<MessageTabKey>("channel");

const { channelItems, channelLoading, channelError, channelHasMore, loadChannel, sendMessage, retryMessage: channelRetryMessage } = useChannelMessages();
const { notificationItems, notificationLoading, notificationError, loadNotifications } = useNotifications();
const {
  composerContent, composerIdentityTag, currentUser, identityTags,
  sending, sendError,
  composerActorName, composerAvatarText, composerSignalMeta,
  loadCurrentUser, submitMessage, retryMessage,
} = useMessageComposer({
  onSend: sendMessage,
  onRetry: channelRetryMessage,
});

const {
  selectedPostId, selectedPost, detailLoading, detailError, detailOpen,
  openDetail: openNotification, closeDetail, retryDetail,
} = usePostDetail();

useVisualViewport();

const tabs: Array<{ key: MessageTabKey; label: string }> = [
  { key: "channel", label: MESSAGE_TAB_CHANNEL },
  { key: "notifications", label: MESSAGE_TAB_NOTIFICATION },
];

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    tabs: {
      kind: "tabs",
      items: tabs.map((t) => ({ id: t.key, label: t.label })),
      activeKey: activeTab.value,
      ariaLabel: MESSAGE_TAB_LABEL,
    },
    identity: currentUser.value ? {
      avatarText: composerAvatarText.value,
      name: composerActorName.value,
    } : null,
    onTabSelect: (tabId: string) => { void switchTab(tabId as MessageTabKey); },
  },
  bottom: {
    visible: activeTab.value === "channel",
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

async function switchTab(tab: MessageTabKey) {
  activeTab.value = tab;
  if (tab === "channel") {
    if (!channelItems.value.length) await loadChannel(true);
  } else {
    if (!notificationItems.value.length) await loadNotifications();
  }
}

onMounted(async () => {
  emit("chrome", pageChrome.value);
  await loadCurrentUser();
  await loadChannel(true);
});
</script>

<template>
  <section class="messages-view" :aria-label="MESSAGE_SECTION_LABEL">
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
      class="messages-view__chrome-composer"
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

    <div v-if="detailOpen" class="messages-view__detail-overlay" role="dialog" aria-modal="true" :aria-label="POST_DETAIL_DIALOG_LABEL">
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
  position: fixed;
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  bottom: calc(var(--floating-bar-bottom-offset) + var(--floating-bar-height) + var(--space-2) + var(--keyboard-inset-bottom, 0px));
  z-index: var(--floating-bar-z, 70);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.messages-view__detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  background: var(--lian-surface, #fff);
}
</style>
