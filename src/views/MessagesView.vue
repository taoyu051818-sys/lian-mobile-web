<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchAuthMe } from "../api/profile";
import { fetchChannelMessages, fetchNotifications, sendChannelMessage } from "../api/messages";
import { GlassPanel, IdentityBadge, InlineError, LianButton, TrustBadge, TypeChip } from "../ui";
import type { ChannelMessage, MessageTabKey, NotificationItem } from "../types/messages";

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
const identityTags = ref<string[]>([]);
const sending = ref(false);
const sendError = ref("");

const tabs: Array<{ key: MessageTabKey; label: string }> = [
  { key: "channel", label: "频道" },
  { key: "notifications", label: "通知" },
];

const composerName = computed(() => composerIdentityTag.value || identityTags.value[0] || "同学");
const composerAvatarText = computed(() => composerName.value.slice(0, 2) || "同");
const channelSummary = computed(() => {
  const totalReads = channelItems.value.reduce((sum, item) => sum + Number(item.readCount || 0), 0);
  return `${channelItems.value.length} 条动态${totalReads ? ` · 累计 ${totalReads} 次已读` : ""}`;
});

function stripHtml(html?: string) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent || container.innerText || "";
}

function messageText(item: ChannelMessage) {
  return item.content || stripHtml(item.contentHtml) || "这条消息暂时没有内容。";
}

function messageAuthor(item: ChannelMessage) {
  return item.author?.displayName || item.author?.username || item.displayName || item.username || "同学";
}

function messageMeta(item: ChannelMessage) {
  return item.identityTag || item.author?.identityTag || "校园频道";
}

function notificationActor(item: NotificationItem) {
  return item.actor?.displayName || item.actor?.username || (isReplyNotification(item) ? "回复" : "通知");
}

function isReplyNotification(item: NotificationItem) {
  return ["new-reply", "reply", "new-post", "post-reply"].includes(String(item.type || ""));
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 172_800_000) return "昨天";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

async function loadCurrentUser() {
  try {
    const user = await fetchAuthMe();
    identityTags.value = user?.identityTags?.length ? user.identityTags : [];
    composerIdentityTag.value = identityTags.value[0] || "";
  } catch {
    identityTags.value = [];
  }
}

async function loadChannel(reset = true) {
  if (channelLoading.value) return;
  channelLoading.value = true;
  channelError.value = "";
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
    channelOffset.value = response.nextOffset || channelOffset.value + (response.items?.length || 0);
  } catch (error) {
    channelError.value = error instanceof Error ? error.message : "频道消息暂时没加载出来，可以稍后再试。";
  } finally {
    channelLoading.value = false;
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
  if (tab === "channel" && !channelItems.value.length) await loadChannel(true);
  if (tab === "notifications" && !notificationItems.value.length) await loadNotifications();
}

async function submitMessage() {
  const content = composerContent.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  sendError.value = "";
  try {
    await sendChannelMessage({ content, identityTag: composerIdentityTag.value });
    composerContent.value = "";
    await loadChannel(true);
  } catch (error) {
    sendError.value = error instanceof Error ? error.message : "消息没有发送成功，可以稍后再试。";
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  await loadCurrentUser();
  await loadChannel(true);
});
</script>

<template>
  <section class="messages-view" aria-labelledby="messages-view-title">
    <GlassPanel class="messages-view__card">
      <header class="messages-view__header">
        <div>
          <TypeChip type="discussion">消息中心</TypeChip>
          <h2 id="messages-view-title">消息中心</h2>
        </div>
        <TrustBadge tone="pending">Vue canary</TrustBadge>
      </header>

      <p class="messages-view__intro">先迁移频道和通知的真实读写路径，归档和详情联动后续补齐。</p>

      <nav class="messages-view__tabs" aria-label="消息分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="messages-view__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeTab === 'channel'" class="messages-view__pane" aria-label="校园频道">
        <form class="messages-view__composer" @submit.prevent="submitMessage">
          <IdentityBadge :avatar-text="composerAvatarText" :label="composerName" meta="频道发言身份" />
          <label v-if="identityTags.length" class="messages-view__field">
            <span>身份</span>
            <select v-model="composerIdentityTag">
              <option v-for="tag in identityTags" :key="tag" :value="tag">{{ tag }}</option>
            </select>
          </label>
          <label class="messages-view__field messages-view__field--content">
            <span>说点什么</span>
            <textarea v-model="composerContent" rows="3" placeholder="发到校园频道…" />
          </label>
          <InlineError v-if="sendError">{{ sendError }}</InlineError>
          <LianButton type="submit" :loading="sending">发送</LianButton>
        </form>

        <div class="messages-view__pane-header">
          <strong>{{ channelSummary }}</strong>
          <LianButton size="sm" variant="ghost" :loading="channelLoading" @click="loadChannel(true)">刷新</LianButton>
        </div>

        <InlineError v-if="channelError">
          {{ channelError }}
          <button type="button" @click="loadChannel(true)">重新加载</button>
        </InlineError>

        <div v-if="channelLoading && !channelItems.length" class="messages-view__state" role="status">正在加载频道消息…</div>
        <div v-else-if="!channelItems.length" class="messages-view__state">还没有消息</div>
        <div v-else class="messages-view__list" aria-live="polite">
          <article v-for="item in channelItems" :key="String(item.id)" class="messages-view__message">
            <IdentityBadge :avatar-text="messageAuthor(item).slice(0, 2)" :label="messageAuthor(item)" :meta="messageMeta(item)" />
            <p>{{ messageText(item) }}</p>
            <footer>
              <span>{{ formatRelativeTime(item.timestampISO || item.time) || "刚刚" }}</span>
              <span v-if="item.readCount">{{ item.readCount }} 次已读</span>
            </footer>
          </article>
        </div>

        <div class="messages-view__load-more">
          <LianButton v-if="channelHasMore" variant="ghost" :loading="channelLoading" @click="loadChannel(false)">加载更早消息</LianButton>
        </div>
      </section>

      <section v-else class="messages-view__pane" aria-label="通知">
        <div class="messages-view__pane-header">
          <strong>{{ notificationItems.length }} 条通知</strong>
          <LianButton size="sm" variant="ghost" :loading="notificationLoading" @click="loadNotifications">刷新</LianButton>
        </div>

        <InlineError v-if="notificationError">
          {{ notificationError }}
          <button type="button" @click="loadNotifications">重新加载</button>
        </InlineError>

        <div v-if="notificationLoading && !notificationItems.length" class="messages-view__state" role="status">正在加载通知…</div>
        <div v-else-if="!notificationItems.length" class="messages-view__state">暂无通知</div>
        <div v-else class="messages-view__list" aria-live="polite">
          <article
            v-for="item in notificationItems"
            :key="String(item.id || item.tid || item.title)"
            class="messages-view__notification"
            :class="{ 'is-unread': !item.read }"
          >
            <header>
              <strong>{{ notificationActor(item) }}</strong>
              <TrustBadge :tone="item.read ? 'confirmed' : 'pending'">{{ item.read ? "已读" : "未读" }}</TrustBadge>
            </header>
            <h3>{{ item.title || "新通知" }}</h3>
            <p v-if="item.excerpt && item.excerpt !== item.title">{{ item.excerpt }}</p>
            <time>{{ formatRelativeTime(item.timestampISO || item.time) }}</time>
          </article>
        </div>
      </section>
    </GlassPanel>
  </section>
</template>

<style scoped>
.messages-view,
.messages-view__card,
.messages-view__pane,
.messages-view__list,
.messages-view__composer {
  display: grid;
  gap: var(--space-4);
}

.messages-view__header,
.messages-view__tabs,
.messages-view__pane-header,
.messages-view__message footer,
.messages-view__notification header,
.messages-view__load-more {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.messages-view h2,
.messages-view h3,
.messages-view p {
  margin: 0;
}

.messages-view__intro,
.messages-view__message p,
.messages-view__notification p,
.messages-view__message footer,
.messages-view__notification time {
  color: var(--lian-muted);
  line-height: 1.6;
}

.messages-view__tabs,
.messages-view__load-more {
  justify-content: flex-start;
}

.messages-view__tab {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.messages-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.messages-view__composer,
.messages-view__message,
.messages-view__notification {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.messages-view__field {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.messages-view__field select,
.messages-view__field textarea {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.messages-view__field textarea {
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.messages-view__field select {
  padding: 0 var(--space-3);
}

.messages-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.messages-view__notification.is-unread {
  border-color: rgba(31, 167, 160, 0.28);
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}
</style>
