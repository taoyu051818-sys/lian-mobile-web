<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { LianApiError } from "../api/http";
import { activateProfileAlias, deactivateProfileAlias, fetchAuthMe, fetchProfileTab, logoutAuth } from "../api/profile";
import {
  GUEST_DISPLAY_NAME, LOADING_PROFILE, LOADING_LIST, EMPTY_HISTORY, EMPTY_SAVED, EMPTY_LIKED,
  ERROR_LOAD_GENERIC, ERROR_LOGOUT, PROFILE_SECTION_LABEL, PROFILE_TAB_HISTORY, PROFILE_TAB_SAVED,
  PROFILE_TAB_LIKED, PROFILE_IDENTITY_FALLBACK, PROFILE_ALIAS_TYPE, PROFILE_ALIAS_SIGNAL,
  PROFILE_ALIAS_PERSONA, PROFILE_ALIAS_DESCRIPTION, PROFILE_REAL_IDENTITY_HINT,
  PROFILE_ALIAS_DEFAULT_HINT, PROFILE_ALIAS_MORE_HINT, PROFILE_EMPTY_CONTENT,
  PROFILE_LOAD_ERROR_PREFIX, PROFILE_LIST_ERROR_PREFIX, PROFILE_RELOAD,
  POST_DETAIL_DIALOG_LABEL, USER_AVATAR_FALLBACK, CHANNEL_RELOAD,
  PROFILE_COLLAPSE_EDITOR, PROFILE_EDIT, PROFILE_LOGOUT,
} from "../config/brand";
import { extractErrorMessage } from "../utils/extractErrorMessage";
import { usePostDetail } from "../composables/usePostDetail";
import { getRecentReadHistoryIds } from "../platform/browser-storage";
import { InlineError } from "../ui";
import type { FeedItemId } from "../types/feed";
import type { PageChromeSpec } from "../shell/page-model";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../types/profile";
import AuthPanel from "./auth/AuthPanel.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import ProfileEditorPanel from "./profile/ProfileEditorPanel.vue";
import ProfileHeader from "./profile/ProfileHeader.vue";
import ProfileTabs from "./profile/ProfileTabs.vue";
import ProfileCollectionList from "./profile/ProfileCollectionList.vue";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

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
  { key: "history", label: PROFILE_TAB_HISTORY, empty: EMPTY_HISTORY },
  { key: "saved", label: PROFILE_TAB_SAVED, empty: EMPTY_SAVED },
  { key: "liked", label: PROFILE_TAB_LIKED, empty: EMPTY_LIKED },
];

const displayName = computed(() => user.value?.username || GUEST_DISPLAY_NAME);
const avatarText = computed(() => displayName.value.slice(0, 2) || USER_AVATAR_FALLBACK);
const activeAlias = computed(() => {
  if (!user.value?.activeAliasId) return null;
  return user.value.aliases?.find((alias) => alias.id === user.value?.activeAliasId) || null;
});
const identityMeta = computed(() => activeAlias.value?.name || user.value?.identityTags?.[0] || user.value?.institution || PROFILE_IDENTITY_FALLBACK);
const activeAliasSummary = computed(() => {
  const alias = activeAlias.value;
  if (!alias) return [];
  return [
    alias.categoryLabel ? { label: PROFILE_ALIAS_TYPE, value: alias.categoryLabel } : null,
    alias.identitySignal ? { label: PROFILE_ALIAS_SIGNAL, value: alias.identitySignal } : null,
    alias.persona ? { label: PROFILE_ALIAS_PERSONA, value: alias.persona } : null,
    alias.description ? { label: PROFILE_ALIAS_DESCRIPTION, value: alias.description } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
});
const activeAliasHint = computed(() => {
  if (!activeAlias.value) return PROFILE_REAL_IDENTITY_HINT;
  return activeAliasSummary.value.length
    ? PROFILE_ALIAS_DEFAULT_HINT
    : PROFILE_ALIAS_MORE_HINT;
});
const userTags = computed(() => {
  const tags = user.value?.tags || user.value?.identityTags || [];
  return tags.slice(0, 5);
});
const listEmptyText = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT);
const aliases = computed(() => user.value?.aliases || []);

const pageChrome = computed<PageChromeSpec>(() => ({
  top: user.value
    ? {
        visible: true,
        identity: {
          avatarText: avatarText.value,
          name: displayName.value,
          meta: identityMeta.value,
        },
        buttons: [
          { id: "profile:toggle-editor", label: editorOpen.value ? PROFILE_COLLAPSE_EDITOR : PROFILE_EDIT, variant: "tonal" },
          { id: "profile:logout", label: PROFILE_LOGOUT, variant: "ghost" },
        ],
        onButtonClick: handleChromeButtonClick,
      }
    : { visible: false },
}));

function handleChromeButtonClick(buttonId: string) {
  if (buttonId === "profile:toggle-editor") {
    editorOpen.value = !editorOpen.value;
  } else if (buttonId === "profile:logout") {
    void logout();
  }
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

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
      errorMessage.value = extractErrorMessage(error, PROFILE_LOAD_ERROR_PREFIX + ERROR_LOAD_GENERIC);
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
      listError.value = extractErrorMessage(error, PROFILE_LIST_ERROR_PREFIX + ERROR_LOAD_GENERIC);
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
    else errorMessage.value = extractErrorMessage(error, ERROR_LOGOUT);
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
  emit("chrome", pageChrome.value);
  void loadProfile();
});
</script>

<template>
  <section class="profile-view" :aria-label="PROFILE_SECTION_LABEL">
    <InlineError v-if="errorMessage">
      {{ errorMessage }}
      <button type="button" @click="loadProfile">{{ PROFILE_RELOAD }}</button>
    </InlineError>

    <div v-if="loading" class="profile-view__state" role="status">{{ LOADING_PROFILE }}</div>

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

      <div v-if="detailOpen" class="profile-view__detail-overlay" role="dialog" aria-modal="true" :aria-label="POST_DETAIL_DIALOG_LABEL">
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
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
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
