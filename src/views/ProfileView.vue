<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { LianApiError } from "../api/http";
import { fetchAuthMe, fetchProfileTab, logoutAuth } from "../api/profile";
import { GlassPanel, IdentityBadge, InlineError, LianButton, TagChip } from "../ui";
import type { FeedItemId } from "../types/feed";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../types/profile";
import AuthPanel from "./auth/AuthPanel.vue";
import ProfileEditorPanel from "./profile/ProfileEditorPanel.vue";

const user = ref<ProfileUser | null>(null);
const loading = ref(false);
const listLoading = ref(false);
const errorMessage = ref("");
const listError = ref("");
const activeTab = ref<ProfileTabKey>("history");
const profileItems = ref<ProfileListItem[]>([]);
const editorOpen = ref(false);

const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
  { key: "history", label: "浏览记录", empty: "暂无浏览记录" },
  { key: "saved", label: "收藏", empty: "暂无收藏" },
  { key: "liked", label: "赞过", empty: "暂无点赞" },
];

const displayName = computed(() => user.value?.username || "未登录同学");
const avatarText = computed(() => displayName.value.slice(0, 2) || "同");
const activeAlias = computed(() => {
  if (!user.value?.activeAliasId) return null;
  return user.value.aliases?.find((alias) => alias.id === user.value?.activeAliasId) || null;
});
const identityMeta = computed(() => activeAlias.value?.name || user.value?.identityTags?.[0] || user.value?.institution || "校园身份");
const activeAliasSummary = computed(() => {
  const alias = activeAlias.value;
  if (!alias) return [];
  return [
    alias.categoryLabel ? { label: "类型", value: alias.categoryLabel } : null,
    alias.identitySignal ? { label: "信号", value: alias.identitySignal } : null,
    alias.persona ? { label: "人格", value: alias.persona } : null,
    alias.description ? { label: "说明", value: alias.description } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
});
const activeAliasHint = computed(() => {
  if (!activeAlias.value) return "当前使用真实身份。";
  return activeAliasSummary.value.length
    ? "这个马甲会作为你在 LIAN 中出现的默认身份。"
    : "这个马甲会作为你在 LIAN 中出现的默认身份，更多身份说明会在后续补齐。";
});
const userTags = computed(() => {
  const tags = user.value?.tags || user.value?.identityTags || [];
  return tags.slice(0, 5);
});
const listEmptyText = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.empty || "暂无内容");

function readHistoryIds() {
  try {
    const history = JSON.parse(localStorage.getItem("lian.readHistory") || "[]") as Array<{ tid: FeedItemId }>;
    return history.slice().reverse().map((entry) => entry.tid).slice(0, 50);
  } catch {
    return [];
  }
}

function isMissingSessionError(error: unknown) {
  return error instanceof LianApiError && (error.code === "not-authorised" || error.status === 401 || error.status === 403);
}

async function refreshCurrentSession() {
  try {
    const refreshedUser = await fetchAuthMe();
    if (!refreshedUser) return false;
    user.value = refreshedUser;
    return true;
  } catch {
    return false;
  }
}

async function fetchProfileTabWithSessionRefresh(tab: ProfileTabKey, tids: FeedItemId[] = []) {
  try {
    return await fetchProfileTab(tab, tids);
  } catch (error) {
    if (!isMissingSessionError(error)) throw error;
    const sessionStillValid = await refreshCurrentSession();
    if (!sessionStillValid) throw error;

    try {
      return await fetchProfileTab(tab, tids);
    } catch (retryError) {
      if (isMissingSessionError(retryError)) {
        throw new Error("登录状态已刷新，但个人列表接口仍返回未授权。请稍后重试，或重新登录后再打开赞过 / 收藏。");
      }
      throw retryError;
    }
  }
}

function enterGuestState() {
  user.value = null;
  profileItems.value = [];
  editorOpen.value = false;
  errorMessage.value = "";
  listError.value = "";
}

async function loadProfile() {
  loading.value = true;
  errorMessage.value = "";
  try {
    user.value = await fetchAuthMe();
    if (user.value) await loadProfileList(activeTab.value);
  } catch (error) {
    if (isMissingSessionError(error)) {
      enterGuestState();
    } else {
      errorMessage.value = error instanceof Error ? error.message : "个人资料暂时没加载出来，可以稍后再试。";
    }
  } finally {
    loading.value = false;
  }
}

async function loadProfileList(tab: ProfileTabKey) {
  activeTab.value = tab;
  listLoading.value = true;
  listError.value = "";
  try {
    const response = await fetchProfileTabWithSessionRefresh(tab, tab === "history" ? readHistoryIds() : []);
    profileItems.value = response.items || [];
  } catch (error) {
    if (isMissingSessionError(error)) {
      enterGuestState();
    } else {
      listError.value = error instanceof Error ? error.message : "列表暂时没加载出来，可以稍后再试。";
      profileItems.value = [];
    }
  } finally {
    listLoading.value = false;
  }
}

async function logout() {
  loading.value = true;
  errorMessage.value = "";
  try {
    await logoutAuth();
    enterGuestState();
  } catch (error) {
    if (isMissingSessionError(error)) enterGuestState();
    else errorMessage.value = error instanceof Error ? error.message : "退出登录没有成功，可以稍后再试。";
  } finally {
    loading.value = false;
  }
}

async function handleAuthenticated(authenticatedUser: ProfileUser | null) {
  if (authenticatedUser) {
    user.value = authenticatedUser;
  }
  await loadProfile();
}

async function handleProfileUpdated() {
  await loadProfile();
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

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <section class="profile-view" aria-label="我的">
    <GlassPanel class="profile-view__card">
      <InlineError v-if="errorMessage">
        {{ errorMessage }}
        <button type="button" @click="loadProfile">重新加载</button>
      </InlineError>

      <div v-if="loading" class="profile-view__state" role="status">正在加载个人资料…</div>

      <template v-else-if="user">
        <section class="profile-view__identity" aria-label="当前身份">
          <IdentityBadge :avatar-text="avatarText" :label="displayName" :meta="identityMeta" />
          <p>{{ user.email || "邀请码用户" }} · {{ user.institution || "校园用户" }}</p>
          <div v-if="userTags.length" class="profile-view__chips" aria-label="身份标签">
            <TagChip v-for="tag in userTags" :key="tag" :tag="tag" />
          </div>
        </section>

        <section class="profile-view__alias-card" aria-label="马甲身份说明">
          <div>
            <strong>{{ activeAlias ? activeAlias.name : "真实身份" }}</strong>
            <p>{{ activeAliasHint }}</p>
          </div>
          <dl v-if="activeAliasSummary.length" class="profile-view__alias-grid">
            <div v-for="item in activeAliasSummary" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>

        <div class="profile-view__actions">
          <LianButton variant="tonal" @click="editorOpen = !editorOpen">
            {{ editorOpen ? "收起编辑" : "编辑资料" }}
          </LianButton>
          <LianButton variant="ghost" @click="logout">退出登录</LianButton>
        </div>

        <ProfileEditorPanel v-if="editorOpen" :user="user" @updated="handleProfileUpdated" />

        <nav class="profile-view__tabs" aria-label="个人内容分类">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="profile-view__tab"
            :class="{ 'is-active': activeTab === tab.key }"
            @click="loadProfileList(tab.key)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <InlineError v-if="listError">
          {{ listError }}
          <button type="button" @click="loadProfileList(activeTab)">重新加载</button>
        </InlineError>

        <div v-if="listLoading" class="profile-view__state" role="status">正在加载列表…</div>
        <div v-else-if="!profileItems.length" class="profile-view__state">{{ listEmptyText }}</div>
        <div v-else class="profile-view__list" aria-live="polite">
          <article v-for="item in profileItems" :key="String(item.tid)" class="profile-view__item">
            <img v-if="item.cover" :src="item.cover" :alt="item.title || '内容封面'" loading="lazy" />
            <div v-else class="profile-view__thumb" aria-hidden="true">{{ (item.title || '内').slice(0, 1) }}</div>
            <div>
              <h3>{{ item.title || "未命名内容" }}</h3>
              <p>{{ formatRelativeTime(item.lastViewedAt || item.timestampISO) || "时间未知" }}</p>
            </div>
          </article>
        </div>
      </template>

      <section v-else class="profile-view__guest">
        <AuthPanel @authenticated="handleAuthenticated" />
      </section>
    </GlassPanel>
  </section>
</template>

<style scoped>
.profile-view,
.profile-view__card,
.profile-view__identity,
.profile-view__guest,
.profile-view__list {
  display: grid;
  gap: var(--space-4);
}

.profile-view__chips,
.profile-view__tabs,
.profile-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-view h3,
.profile-view p {
  margin: 0;
}

.profile-view__identity p,
.profile-view__item p,
.profile-view__alias-card p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.profile-view__chips,
.profile-view__tabs,
.profile-view__actions {
  justify-content: flex-start;
}

.profile-view__alias-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.16);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.08);
}

.profile-view__alias-card strong {
  display: block;
  margin-bottom: 4px;
  color: var(--lian-ink);
}

.profile-view__alias-grid {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.profile-view__alias-grid div {
  display: grid;
  gap: 4px;
  padding: var(--space-2);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.profile-view__alias-grid dt {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.profile-view__alias-grid dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.5;
}

.profile-view__tab {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.profile-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.profile-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.profile-view__item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.profile-view__item img,
.profile-view__thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-3);
  object-fit: cover;
}

.profile-view__thumb {
  display: grid;
  place-items: center;
  background: rgba(31, 41, 51, 0.06);
  color: var(--lian-muted);
  font-weight: 900;
}

.profile-view__item h3 {
  margin-bottom: 4px;
  font-size: 15px;
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
