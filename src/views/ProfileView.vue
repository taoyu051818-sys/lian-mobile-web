<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LianApiError } from "../api/http";
import { activateProfileAlias, deactivateProfileAlias, fetchAuthMe, fetchProfileTab, logoutAuth } from "../api/profile";
import { usePostDetail } from "../composables/usePostDetail";
import { getRecentReadHistoryIds } from "../platform/browser-storage";
import { useShellChrome } from "../shell/useShellChrome";
import { InlineError } from "../ui";
import type { FeedItemId } from "../types/feed";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../types/profile";
import AuthPanel from "./auth/AuthPanel.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import ProfileEditorPanel from "./profile/ProfileEditorPanel.vue";
import ProfileHeader from "./profile/ProfileHeader.vue";
import ProfileActions from "./profile/ProfileActions.vue";
import ProfileTabs from "./profile/ProfileTabs.vue";
import ProfileCollectionList from "./profile/ProfileCollectionList.vue";

const { setRegion, resetRegions } = useShellChrome();

const user = ref<ProfileUser | null>(null);
const loading = ref(false);
const listLoading = ref(false);
const errorMessage = ref("");
const listError = ref("");
const activeTab = ref<ProfileTabKey>("history");
const profileItems = ref<ProfileListItem[]>([]);
const editorOpen = ref(false);
const aliasPickerOpen = ref(false);
const aliasBusy = ref(false);
const {
  selectedPostId, selectedPost, detailLoading, detailError, detailOpen,
  openDetail: openItem, closeDetail, retryDetail,
} = usePostDetail();

const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
  { key: "history", label: "浏览", empty: "暂无浏览记录" },
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
const aliases = computed(() => user.value?.aliases || []);

function applyProfileChrome() {
  if (!user.value) {
    resetRegions();
    return;
  }
  setRegion("top", {
    visible: true,
    slot: "tabs",
    buttons: [
      { id: "profile:toggle-editor", label: editorOpen.value ? "收起编辑" : "编辑资料", variant: "tonal" },
      { id: "profile:logout", label: "退出登录", variant: "ghost" },
    ],
  });
}

watch([user, editorOpen], applyProfileChrome);

function readHistoryIds() {
  return getRecentReadHistoryIds(localStorage, 50);
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
  aliasPickerOpen.value = false;
  await loadProfile();
}

async function switchAlias(aliasId: string) {
  if (aliasBusy.value || !user.value) return;
  aliasBusy.value = true;
  try {
    if (aliasId) await activateProfileAlias(aliasId);
    else await deactivateProfileAlias();
    aliasPickerOpen.value = false;
    await loadProfile();
  } catch {
    // error is non-critical; user can retry
  } finally {
    aliasBusy.value = false;
  }
}

onMounted(() => {
  void loadProfile();
});

onBeforeUnmount(() => {
  resetRegions();
});
</script>

<template>
  <section class="profile-view" aria-label="我的">
    <InlineError v-if="errorMessage">
      {{ errorMessage }}
      <button type="button" @click="loadProfile">重新加载</button>
    </InlineError>

    <div v-if="loading" class="profile-view__state" role="status">正在加载个人资料…</div>

    <template v-else-if="user">
      <div class="profile-view__hero-bg" aria-hidden="true"></div>

      <ProfileHeader
        :user="user"
        :avatar-text="avatarText"
        :display-name="displayName"
        :identity-meta="identityMeta"
        :user-tags="userTags"
        :aliases="aliases"
        :active-alias="activeAlias"
        :active-alias-hint="activeAliasHint"
        :active-alias-summary="activeAliasSummary"
        :alias-picker-open="aliasPickerOpen"
        @toggle-alias-picker="aliasPickerOpen = !aliasPickerOpen"
        @select-alias="switchAlias"
      />

      <ProfileActions :editor-open="editorOpen" @toggle-editor="editorOpen = !editorOpen" @logout="logout" />

      <ProfileEditorPanel v-if="editorOpen" :user="user" @updated="handleProfileUpdated" />

      <ProfileTabs :tabs="tabs" :active-tab="activeTab" @select="loadProfileList" />

      <ProfileCollectionList
        :items="profileItems"
        :loading="listLoading"
        :empty-text="listEmptyText"
        :error="listError"
        @retry="loadProfileList(activeTab)"
        @open-item="openItem"
      />

      <div v-if="detailOpen" class="profile-view__detail-overlay" role="dialog" aria-modal="true" aria-label="帖子详情">
        <PostDetailPanel
          :post="selectedPost"
          :loading="detailLoading"
          :error="detailError"
          @close="closeDetail"
          @retry="retryDetail"
        />
      </div>
    </template>

    <section v-else class="profile-view__guest">
      <AuthPanel @authenticated="handleAuthenticated" />
    </section>
  </section>
</template>

<style scoped>
.profile-view {
  position: relative;
  display: grid;
  gap: var(--space-4);
  padding-bottom: var(--space-6);
}

.profile-view__hero-bg {
  position: absolute;
  top: 0;
  left: calc(-1 * var(--space-4));
  right: calc(-1 * var(--space-4));
  height: 200px;
  background: linear-gradient(180deg, var(--lian-primary-soft) 0%, transparent 100%);
  pointer-events: none;
}

.profile-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.profile-view__guest {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-6);
}

.profile-view__detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  background: var(--lian-surface, #fff);
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
