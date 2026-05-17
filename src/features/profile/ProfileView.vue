<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_PROFILE_STATS,
  fetchAuthMe,
  fetchProfileSettings,
  fetchProfileStats,
  logoutAuth,
} from "../../api/profile";
import {
  ERROR_LOAD_GENERIC,
  ERROR_LOGOUT,
  LOADING_PROFILE,
  PROFILE_LOAD_ERROR_PREFIX,
  PROFILE_RELOAD,
  PROFILE_SECTION_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type {
  ProfileSettings,
  ProfileStats,
  ProfileUser,
} from "../../types/profile";
import { InlineError } from "../../ui";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { usePostDetail } from "../detail/usePostDetail";
import AuthPanel from "../auth/AuthPanel.vue";
import ProfileCollectionList from "./ProfileCollectionList.vue";
import ProfileDetailOverlay from "./ProfileDetailOverlay.vue";
import ProfileEditorPanel from "./ProfileEditorPanel.vue";
import ProfileHeader from "./ProfileHeader.vue";
import ProfileSummary from "./ProfileSummary.vue";
import ProfileTabs from "./ProfileTabs.vue";
import { useProfileAliasPicker } from "./useProfileAliasPicker";
import { useProfileChrome } from "./useProfileChrome";
import { useProfileSession } from "./useProfileSession";
import { useProfileTabs } from "./useProfileTabs";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const PROFILE_SUMMARY_ERROR_PREFIX = "概览";

const {
  user,
  loading,
  errorMessage,
  isMissingSessionError,
  refreshCurrentSession,
} = useProfileSession();

const editorOpen = ref(false);
const summaryLoading = ref(false);
const summaryError = ref("");
const profileStats = ref<ProfileStats>({ ...DEFAULT_PROFILE_STATS });
const profileSettings = ref<ProfileSettings>({ ...DEFAULT_PROFILE_SETTINGS });
const hasForumLink = computed(() => Boolean(user.value?.nodebbUid));

const {
  listLoading,
  listError,
  activeTab,
  profileItems,
  tabs,
  listEmptyText,
  loadProfileList,
  resetList,
} = useProfileTabs({
  user,
  enterGuestState: () => enterGuestState(),
  isMissingSessionError,
  refreshCurrentSession,
});

const {
  selectedPostId: _selectedPostId,
  selectedPost,
  detailLoading,
  detailError,
  detailOpen,
  openDetail: openItem,
  closeDetail,
  retryDetail,
} = usePostDetail();

const {
  aliasPickerOpen,
  activeAlias,
  activeAliasSummary,
  activeAliasHint,
  identityMeta,
  userTags,
  aliases,
  handleProfileUpdated,
  switchAlias,
} = useProfileAliasPicker({
  user,
  loadProfile: () => loadProfile(),
});

const { displayName, avatarText, pageChrome } = useProfileChrome({
  user,
  editorOpen,
  identityMeta,
  onLogout: () => logout(),
  onChromeChange: (spec) => emit("chrome", spec),
});

function resetProfileOverview() {
  summaryLoading.value = false;
  summaryError.value = "";
  profileStats.value = { ...DEFAULT_PROFILE_STATS };
  profileSettings.value = { ...DEFAULT_PROFILE_SETTINGS };
}

function enterGuestState() {
  user.value = null;
  profileItems.value = [];
  editorOpen.value = false;
  errorMessage.value = "";
  listError.value = "";
  resetProfileOverview();
  resetList();
}

async function fetchProfileOverviewWithSessionRefresh() {
  try {
    return await Promise.all([fetchProfileStats(), fetchProfileSettings()]);
  } catch (error) {
    if (!isMissingSessionError(error)) throw error;
    const sessionStillValid = await refreshCurrentSession();
    if (!sessionStillValid) throw error;

    try {
      return await Promise.all([fetchProfileStats(), fetchProfileSettings()]);
    } catch (retryError) {
      if (isMissingSessionError(retryError)) {
        throw new Error(
          "登录状态已刷新，但个人概览接口仍返回未授权。请稍后重试，或重新登录后再打开个人主页。",
          { cause: retryError },
        );
      }
      throw retryError;
    }
  }
}

async function loadProfileOverview() {
  if (!user.value) {
    resetProfileOverview();
    return;
  }

  summaryLoading.value = true;
  summaryError.value = "";
  try {
    const [stats, settings] = await fetchProfileOverviewWithSessionRefresh();
    profileStats.value = stats;
    profileSettings.value = settings;
  } catch (error) {
    if (isMissingSessionError(error)) {
      enterGuestState();
    } else {
      summaryError.value = extractErrorMessage(
        error,
        PROFILE_SUMMARY_ERROR_PREFIX + ERROR_LOAD_GENERIC,
      );
      profileStats.value = { ...DEFAULT_PROFILE_STATS };
      profileSettings.value = { ...DEFAULT_PROFILE_SETTINGS };
    }
  } finally {
    summaryLoading.value = false;
  }
}

async function loadProfile() {
  loading.value = true;
  errorMessage.value = "";
  try {
    user.value = await fetchAuthMe();
    if (user.value) {
      await Promise.all([
        loadProfileOverview(),
        loadProfileList(activeTab.value),
      ]);
    } else {
      resetProfileOverview();
      resetList();
    }
  } catch (error) {
    if (isMissingSessionError(error)) {
      enterGuestState();
    } else {
      errorMessage.value = extractErrorMessage(
        error,
        PROFILE_LOAD_ERROR_PREFIX + ERROR_LOAD_GENERIC,
      );
    }
  } finally {
    loading.value = false;
  }
}

async function logout() {
  loading.value = true;
  errorMessage.value = "";
  try {
    await logoutAuth();
    enterGuestState();
  } catch (error) {
    if (isMissingSessionError(error)) {
      enterGuestState();
    } else {
      errorMessage.value = extractErrorMessage(error, ERROR_LOGOUT);
    }
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

    <div v-if="loading" class="profile-view__state" role="status">
      {{ LOADING_PROFILE }}
    </div>

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

      <ProfileSummary
        :stats="profileStats"
        :settings="profileSettings"
        :loading="summaryLoading"
        :error="summaryError"
        :has-forum-link="hasForumLink"
        @retry="loadProfileOverview"
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

      <ProfileDetailOverlay
        v-if="detailOpen"
        :post="selectedPost"
        :loading="detailLoading"
        :error="detailError"
        @close="closeDetail"
        @retry="retryDetail"
      />
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
