<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchAuthMe, logoutAuth } from "../../api/profile";
import { clearAllPublishDrafts } from "../publish";
import {
  ADMIN_ENTER_LABEL,
  LOADING_PROFILE,
  ERROR_LOAD_GENERIC,
  ERROR_LOGOUT,
  MERCHANT_CENTER_ENTER_LABEL,
  PROFILE_SECTION_LABEL,
  PROFILE_LOAD_ERROR_PREFIX,
  PROFILE_RELOAD,
  RUNNER_ENTER_LABEL,
  VERIFICATION_ENTER_LABEL,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { useDetailNavigation } from "../../app/detail-navigation";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import { InlineError } from "../../ui";
import { AuthPanel } from "../auth";
import { useIsMerchantVerified } from "../merchant";
import { useIsRunnerVerified } from "../runner";
import ProfileEditorPanel from "./ProfileEditorPanel.vue";
import ProfileHeader from "./ProfileHeader.vue";
import ProfileSettingsBlock from "./ProfileSettingsBlock.vue";
import ProfileStatsBlock from "./ProfileStatsBlock.vue";
import ProfileTabs from "./ProfileTabs.vue";
import ProfileCollectionList from "./ProfileCollectionList.vue";
import { ProfileErrandOrdersBlock } from "../errand";
import { useProfileSession } from "./useProfileSession";
import { useProfileTabs } from "./useProfileTabs";
import { useProfileChrome } from "./useProfileChrome";
import { useProfileAliasPicker } from "./useProfileAliasPicker";
import { useActiveView } from "../../app/useActiveView";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const { setActiveView } = useActiveView();
const adminEntryVisible = computed(() => import.meta.env.VITE_ADMIN_VISIBLE === "true");

const { user, loading, errorMessage, isMissingSessionError, refreshCurrentSession } =
  useProfileSession();

const isMerchantVerified = useIsMerchantVerified(user);
const isRunnerVerified = useIsRunnerVerified(user);

const editorOpen = ref(false);

const {
  listLoading,
  listError,
  activeTab,
  profileItems,
  tabs,
  listEmptyText,
  loadProfileList,
  resetList: _resetList,
} = useProfileTabs({
  user,
  enterGuestState: () => enterGuestState(),
  isMissingSessionError,
  refreshCurrentSession,
});

const detail = useDetailNavigation();
function openItem(id: number | string) {
  detail.open(Number(id), "card");
}

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

function enterGuestState() {
  user.value = null;
  profileItems.value = [];
  editorOpen.value = false;
  errorMessage.value = "";
  listError.value = "";
  // issue #692: drafts authored by the previous account must not survive
  // logout / account switch — they were leaking into the next sign-in.
  clearAllPublishDrafts();
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

      <ProfileStatsBlock />

      <ProfileSettingsBlock />

      <ProfileTabs :tabs="tabs" :active-tab="activeTab" @select="loadProfileList" />

      <ProfileCollectionList
        :items="profileItems"
        :loading="listLoading"
        :empty-text="listEmptyText"
        :error="listError"
        @retry="loadProfileList(activeTab)"
        @open-item="openItem"
      />

      <ProfileErrandOrdersBlock />

      <footer class="profile-view__verification-entry">
        <button
          type="button"
          class="profile-view__verification-link"
          @click="setActiveView('verification')"
        >
          {{ VERIFICATION_ENTER_LABEL }}
        </button>
      </footer>

      <footer
        v-if="isMerchantVerified"
        class="profile-view__merchant-entry"
        data-testid="profile-merchant-entry"
      >
        <button
          type="button"
          class="profile-view__merchant-link"
          @click="setActiveView('merchant')"
        >
          {{ MERCHANT_CENTER_ENTER_LABEL }}
        </button>
      </footer>

      <footer
        v-if="isRunnerVerified"
        class="profile-view__runner-entry"
        data-testid="profile-runner-entry"
      >
        <button type="button" class="profile-view__runner-link" @click="setActiveView('runner')">
          {{ RUNNER_ENTER_LABEL }}
        </button>
      </footer>

      <footer v-if="adminEntryVisible" class="profile-view__admin-entry">
        <button type="button" class="profile-view__admin-link" @click="setActiveView('admin')">
          {{ ADMIN_ENTER_LABEL }}
        </button>
      </footer>
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

.profile-view__admin-entry {
  display: flex;
  justify-content: center;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--lian-line);
}

.profile-view__merchant-entry,
.profile-view__runner-entry {
  display: flex;
  justify-content: center;
}

.profile-view__merchant-link {
  padding: var(--space-2) var(--space-4);
  border: 1px solid rgba(255, 159, 67, 0.34);
  border-radius: var(--radius-chip);
  background: rgba(255, 159, 67, 0.14);
  color: #8a4a00;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  transition: background var(--motion-fast) var(--motion-ease-standard);
}

.profile-view__merchant-link:hover,
.profile-view__merchant-link:focus-visible {
  background: rgba(255, 159, 67, 0.22);
}

.profile-view__runner-link {
  padding: var(--space-2) var(--space-4);
  border: 1px solid rgba(124, 92, 255, 0.32);
  border-radius: var(--radius-chip);
  background: rgba(124, 92, 255, 0.12);
  color: #5a3fbf;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  transition: background var(--motion-fast) var(--motion-ease-standard);
}

.profile-view__runner-link:hover,
.profile-view__runner-link:focus-visible {
  background: rgba(124, 92, 255, 0.2);
}

.profile-view__admin-link {
  padding: var(--space-1) var(--space-3);
  border: 0;
  background: none;
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--motion-fast) var(--motion-ease-standard);
}

.profile-view__admin-link:hover,
.profile-view__admin-link:focus-visible {
  opacity: 1;
  text-decoration: underline;
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
