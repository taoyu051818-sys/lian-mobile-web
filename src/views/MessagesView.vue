<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchAuthMe } from "../api/profile";
import { fetchChannelMessages, fetchNotifications, markChannelMessagesRead, sendChannelMessage } from "../api/messages";
import { useFloatingChromeController } from "../motion/floatingChrome";
import { GlassPanel } from "../ui";
import type { DisplayActor } from "../types/feed";
import type { ChannelMessage, ChannelMessageActor, MessageTabKey, NotificationItem } from "../types/messages";
import type { ProfileUser } from "../types/profile";
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

function stripHtml(html?: string) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actorDisplayName(actor?: DisplayActor | null, fallback = "") {
  return actor?.displayName || actor?.username || actor?.name || fallback || "同学";
}

function actorAvatarText(actor?: DisplayActor | null, fallback = "") {
  return actor?.avatarText || actorDisplayName(actor, fallback).slice(0, 2) || "同";
}

function messageText(item: ChannelMessage) {
  return item.content || stripHtml(item.contentHtml) || "这条消息暂时没有内容。";
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
    const nextItems = (response.items || []).slice().reverse();
    const known = new Set(channelItems.value.map((item) => String(item.id)));
    const uniqueItems = nextItems.filter((item) => !known.has(String(item.id)));
    channelItems.value = reset ? uniqueItems : [...uniqueItems, ...channelItems.value];
    channelHasMore.value = Boolean(response.hasMore);
    channelOffset.value = response.nextOffset ?? channelOffset.value + (response.items?.length || 0);

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
    }
  } catch (error) {
    channelError.value = error instanceof Error ? error.message : "频道消息暂时没加载出来，可以稍后再试。";
  } finally {
    channelLoading.value = false;
  }
}

async function refreshLatest() {
  try {
    const response = await fetchChannelMessages(0, 30);
    const latestItems = (response.items || []).slice().reverse();
    const existingIds = new Set(channelItems.value.map((item) => String(item.id)));
    const newItems = latestItems.filter((item) => !existingIds.has(String(item.id)));
    if (newItems.length) {
      const merged = [...channelItems.value, ...newItems];
      merged.sort((a, b) => {
        const ta = a.timestampISO || a.time || "";
        const tb = b.timestampISO || b.time || "";
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
      channelItems.value = merged;
    }
    await nextTick();
    window.scrollTo(0, document.documentElement.scrollHeight);
  } catch {
    /* silent — the message was already sent successfully */
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
    emit("chrome", true);
    if (!channelItems.value.length) await loadChannel(true);
  } else {
    composerChrome.hide();
    emit("chrome", false);
    if (!notificationItems.value.length) await loadNotifications();
  }
}

async function submitMessage() {
  const content = composerContent.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  sendError.value = "";
  try {
    await sendChannelMessage({ content, identityTag: composerIdentityTag.value });
    composerContent.value = "";
    await refreshLatest();
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : "消息没有发送成功，可以稍后再试。";
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  emit("chrome", true);
  await loadCurrentUser();
  await loadChannel(true);
});

onBeforeUnmount(() => {
  composerChrome.dispose();
  emit("chrome", false);
});
</script>

<template>
  <section class="messages-view" aria-label="消息">
    <MessagesTabs
      class="messages-view__chrome-tabs lian-floating-chrome lian-floating-chrome--top"
      data-floating-chrome="top"
      data-floating-state="visible"
      :tabs="tabs"
      :active-tab="activeTab"
      @switch="switchTab"
    />

    <GlassPanel class="messages-view__card">
      <ChannelThread
        v-if="activeTab === 'channel'"
        :items="channelItems"
        :loading="channelLoading"
        :error="channelError"
        :has-more="channelHasMore"
        @retry="loadChannel(true)"
        @load-more="loadChannel(false)"
      />

      <NotificationList
        v-else
        :items="notificationItems"
        :loading="notificationLoading"
        :error="notificationError"
        @retry="loadNotifications"
      />
    </GlassPanel>

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
  </section>
</template>

<style scoped>
.messages-view {
  display: grid;
  gap: var(--space-4);
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
  padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom));
}

.messages-view__card {
  display: grid;
  gap: var(--space-4);
}

.messages-view__chrome-tabs {
  position: fixed;
  top: var(--floating-bar-top-offset);
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  z-index: var(--floating-bar-z);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  min-height: var(--floating-bar-height);
  margin: 0 auto;
  padding: var(--floating-bar-padding);
  border: 1px solid var(--glass-border);
  border-radius: var(--floating-bar-radius);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.messages-view__chrome-composer {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0px);
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  z-index: var(--floating-bar-z);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  margin: 0 auto;
  padding: var(--floating-bar-padding);
  border: 1px solid var(--glass-border);
  border-radius: var(--floating-bar-radius);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
</style>
