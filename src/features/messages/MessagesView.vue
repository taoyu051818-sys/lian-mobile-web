<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { useActiveView } from "../../app/useActiveView";
import { useDetailNavigation } from "../../app/detail-navigation";
import { useVisualViewport } from "../../composables/useVisualViewport";
import { MESSAGE_SECTION_LABEL } from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";
import type { MessageTabKey, NotificationItem } from "../../types/messages";
import type { PageChromeSpec } from "../../shell/page-model";
import { usePageChromeSlot } from "../../shell/usePageChromeSlot";
import { useFloatingChromeState } from "../../shell/floatingChromeState";
import { ChannelComposer, ChannelFilterBar, ChannelThread, NotificationList } from "./";
import type { FilterState } from "./ChannelFilterBar.vue";
import { isNotificationInboxTab, itemsForInboxTab, NOTIFICATION_INBOX_SPECS } from "./messageInbox";
import { useChannelMessages } from "./useChannelMessages";
import { useNotifications } from "./useNotifications";
import { useMessageComposer } from "./useMessageComposer";
import { useErrandOrderRoute } from "../errand/useErrandOrderRoute";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

/** Filter bar state: visibility (State A) or category (State B) */
const filterState = ref<FilterState>("visibility");

/** Selected visibility filter */
const selectedVisibility = ref<AudienceVisibility | "all">("all");

/** Active category/tab */
const activeTab = ref<MessageTabKey>("channel");

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

useVisualViewport();

const activeNotificationSpec = computed(() =>
  isNotificationInboxTab(activeTab.value) ? NOTIFICATION_INBOX_SPECS[activeTab.value] : null,
);
const visibleNotificationItems = computed(() =>
  activeNotificationSpec.value
    ? itemsForInboxTab(notificationItems.value, activeNotificationSpec.value.tab)
    : [],
);

// MessagesView no longer paints typed top.tabs into the chrome — the four
// inbox tabs (channel/replies/system/orders) are now rendered as State-B
// chips inside ChannelFilterBar, which is teleported into the top floating
// chrome via the `channel-filter` slot. The detail FSM still owns the slot
// when a post is open; we only stake our claim while it is closed.
const pageChrome = computed<PageChromeSpec>(() => ({
  top: detail.detailOpen.value
    ? {
        // Detail-open: leave the slot alone — the FSM flips it to "detail-topbar".
        tabs: null,
      }
    : {
        tabs: null,
        slot: "channel-filter",
      },
  bottom: {
    visible: true,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

const { shellVisible } = useFloatingChromeState();

// Stake/release the top slot via the shared composable so the slot is freed
// when MessagesView unmounts on a tab switch (otherwise other views inherit
// `slot === "channel-filter"` and ShellChrome suppresses their regular chrome).
usePageChromeSlot("channel-filter");

/** Handle filter state changes.
 *
 * `[...]` always brings the user "home" to State A on the channel tab — if
 * they switched away (e.g. to replies/system/orders) and then toggled back
 * to visibility, ChannelFilterBar would otherwise leave them stranded on a
 * non-channel tab with no way to see channel content. So whenever the bar
 * emits `update:filter-state` -> "visibility", we also flip activeTab back
 * to "channel" if it isn't already there.
 */
function handleFilterStateChange(state: FilterState) {
  filterState.value = state;
  if (state === "visibility" && activeTab.value !== "channel") {
    void switchTab("channel");
  }
}

/** Handle visibility selection changes */
function handleVisibilityChange(visibility: AudienceVisibility | "all") {
  selectedVisibility.value = visibility;
  // TODO: Trigger channel reload with visibility filter when API supports it
}

/** Handle category/tab selection changes */
function handleCategoryChange(category: MessageTabKey) {
  void switchTab(category);
}

async function switchTab(tab: MessageTabKey) {
  activeTab.value = tab;
  if (tab === "channel") {
    if (!channelItems.value.length) await loadChannel(true);
  } else if (!notificationItems.value.length) {
    await loadNotifications();
  }
}

// State-B lock: when a non-channel tab is active, force the bar into category
// state so the user can always see which inbox they're on. State A only makes
// sense for the channel tab (visibility filters channel posts). Switching to
// channel doesn't auto-flip back to State A — that happens via the `[x]`
// toggle or by tapping the channel chip.
const effectiveFilterState = computed<FilterState>(() =>
  activeTab.value === "channel" ? filterState.value : "category",
);

// Mount the teleported bar whenever we own the slot (no detail panel) and
// the shell is visible. The bar handles both filter states internally.
const filterBarMounted = computed(() => !detail.detailOpen.value && shellVisible.value);

onMounted(async () => {
  emit("chrome", pageChrome.value);
  await loadCurrentUser();
  await loadChannel(true);
});
</script>

<template>
  <section class="messages-view" :aria-label="MESSAGE_SECTION_LABEL">
    <!--
      Dual-state filter bar lives in the top floating chrome via the
      `channel-filter` slot. Teleport target is the stable
      `#lian-shell-top-slot` div ShellChrome always renders for the top
      region (mirrors FeedFilterBar's `feed-filter` slot).
    -->
    <Teleport v-if="filterBarMounted" defer to="#lian-shell-top-slot">
      <ChannelFilterBar
        :filter-state="effectiveFilterState"
        :selected-visibility="selectedVisibility"
        :active-category="activeTab"
        :is-guest="isGuest"
        @update:filter-state="handleFilterStateChange"
        @update:selected-visibility="handleVisibilityChange"
        @update:active-category="handleCategoryChange"
      />
    </Teleport>

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
