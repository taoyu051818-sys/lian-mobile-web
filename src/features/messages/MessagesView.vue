<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { useActiveView } from "../../app/useActiveView";
import { useDetailNavigation } from "../../app/detail-navigation";
import { useVisualViewport } from "../../composables/useVisualViewport";
import {
  MESSAGE_AUTH_GATE_CTA,
  MESSAGE_AUTH_GATE_HINT,
  MESSAGE_AUTH_GATE_TITLE,
  MESSAGE_SECTION_LABEL,
  MESSAGE_TAB_CHANNEL,
  MESSAGE_TAB_LABEL,
  MESSAGE_TAB_ORDERS,
  MESSAGE_TAB_REPLIES,
  MESSAGE_TAB_SYSTEM,
} from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";
import type { MessageTabKey, NotificationItem } from "../../types/messages";
import type { PageChromeSpec } from "../../shell/page-model";
import { ChannelComposer, ChannelFilterBar, ChannelThread, NotificationList } from "./";
import { isNotificationInboxTab, itemsForInboxTab, NOTIFICATION_INBOX_SPECS } from "./messageInbox";
import { useChannelMessages } from "./useChannelMessages";
import { useNotifications } from "./useNotifications";
import { useMessageComposer } from "./useMessageComposer";
import { useErrandOrderRoute } from "../errand/useErrandOrderRoute";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const activeTab = ref<MessageTabKey>("channel");

/** Filter bar state: "visibility" (State A) or "category" (State B) */
type FilterState = "visibility" | "category";
const filterState = ref<FilterState>("visibility");
const selectedVisibility = ref<AudienceVisibility | "all">("all");

const {
  channelItems,
  channelLoading,
  channelError,
  channelHasMore,
  loadChannel,
  sendMessage,
  retryMessage: channelRetryMessage,
} = useChannelMessages();
const { notificationItems, notificationLoading, notificationFetchState, loadNotifications } =
  useNotifications();
const {
  composerContent,
  composerIdentityTag,
  composerVisibility,
  currentUser,
  identityTags,
  sending,
  sendError,
  isGuest,
  composerActorName,
  composerAvatarText,
  composerSignalMeta,
  loadCurrentUser,
  submitMessage,
  retryMessage,
} = useMessageComposer({
  onSend: sendMessage,
  onRetry: channelRetryMessage,
});

const { setActiveView } = useActiveView();
const detail = useDetailNavigation();
const errandOrderRoute = useErrandOrderRoute();

function openNotification(item: NotificationItem) {
  const target = item.target;
  if (!target) return;
  if (target.kind === "detail") {
    detail.open(target.tid, "card");
    return;
  }
  if (target.kind === "verification") {
    setActiveView("verification");
    return;
  }
  if (target.kind === "errand-order") {
    errandOrderRoute.enterForOrder(target.orderId, "messages");
    setActiveView("errand-order");
  }
}

function goLogin() {
  setActiveView("profile");
}

useVisualViewport();

const tabs: Array<{ key: MessageTabKey; label: string }> = [
  { key: "channel", label: MESSAGE_TAB_CHANNEL },
  { key: "replies", label: MESSAGE_TAB_REPLIES },
  { key: "system", label: MESSAGE_TAB_SYSTEM },
  { key: "orders", label: MESSAGE_TAB_ORDERS },
];

const activeNotificationSpec = computed(() =>
  isNotificationInboxTab(activeTab.value) ? NOTIFICATION_INBOX_SPECS[activeTab.value] : null,
);
const visibleNotificationItems = computed(() =>
  activeNotificationSpec.value
    ? itemsForInboxTab(notificationItems.value, activeNotificationSpec.value.tab)
    : [],
);

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    tabs: {
      kind: "tabs",
      items: tabs.map((t) => ({ id: t.key, label: t.label })),
      activeKey: activeTab.value,
      ariaLabel: MESSAGE_TAB_LABEL,
    },
    identity: currentUser.value
      ? {
          avatarText: composerAvatarText.value,
          name: composerActorName.value,
        }
      : null,
    onTabSelect: (tabId: string) => {
      void switchTab(tabId as MessageTabKey);
    },
  },
  bottom: {
    visible: true,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

async function switchTab(tab: MessageTabKey) {
  activeTab.value = tab;
  // When switching to channel via filter bar, auto-switch to visibility state
  if (tab === "channel") {
    filterState.value = "visibility";
    if (!channelItems.value.length) await loadChannel(true);
  } else if (!notificationItems.value.length) {
    await loadNotifications();
  }
}

/** Handle filter state changes from ChannelFilterBar */
function handleFilterStateChange(state: FilterState) {
  filterState.value = state;
}

/** Handle visibility selection from ChannelFilterBar */
function handleVisibilityChange(visibility: AudienceVisibility | "all") {
  selectedVisibility.value = visibility;
  // TODO: Trigger channel reload with visibility filter
}

/** Handle category selection from ChannelFilterBar */
function handleCategoryChange(category: MessageTabKey) {
  void switchTab(category);
}

onMounted(async () => {
  emit("chrome", pageChrome.value);
  await loadCurrentUser();
  await loadChannel(true);
});
</script>

<template>
  <section class="messages-view" :aria-label="MESSAGE_SECTION_LABEL">
    <!-- Dual-state filter bar -->
    <ChannelFilterBar
      class="messages-view__filter-bar"
      :filter-state="filterState"
      :selected-visibility="selectedVisibility"
      :active-category="activeTab"
      :is-guest="isGuest"
      @update:filter-state="handleFilterStateChange"
      @update:selected-visibility="handleVisibilityChange"
      @update:active-category="handleCategoryChange"
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
      :items="visibleNotificationItems"
      :loading="notificationLoading"
      :fetch-state="notificationFetchState"
      :title="activeNotificationSpec?.title"
      :hint="activeNotificationSpec?.hint"
      :empty-title="activeNotificationSpec?.emptyTitle"
      :empty-body="activeNotificationSpec?.emptyBody"
      @retry="loadNotifications"
      @auth-required="setActiveView('profile')"
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
      :visibility="composerVisibility"
      :sending="sending"
      :send-error="sendError"
      :is-guest="isGuest"
      @update:content="composerContent = $event"
      @update:identity-tag="composerIdentityTag = $event"
      @update:visibility="composerVisibility = $event"
      @submit="submitMessage"
    />
  </section>
</template>

<style scoped>
.messages-view {
  display: grid;
  gap: var(--space-4);
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
  padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom) + var(--keyboard-inset-bottom));
}

.messages-view__filter-bar {
  position: sticky;
  top: calc(var(--floating-bar-height) + env(safe-area-inset-top) + var(--space-2));
  z-index: calc(var(--floating-bar-z, 70) - 1);
  padding: 0 var(--space-3);
  margin: 0 var(--space-3);
  border-radius: var(--radius-chip);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur-light)) saturate(var(--glass-saturate));
}

.messages-view__chrome-composer {
  position: fixed;
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  bottom: calc(
    var(--floating-bar-bottom-offset) + var(--floating-bar-height) + var(--space-2) +
      var(--keyboard-inset-bottom, 0px)
  );
  z-index: var(--floating-bar-z, 70);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
</style>
