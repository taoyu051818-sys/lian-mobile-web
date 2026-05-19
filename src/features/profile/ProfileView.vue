<script setup lang="ts">
import { onMounted } from "vue";
import { fetchAuthMe, logoutAuth } from "../../api/profile";
import {
  LOADING_PROFILE,
  ERROR_LOAD_GENERIC,
  ERROR_LOGOUT,
  PROFILE_SECTION_LABEL,
  PROFILE_LOAD_ERROR_PREFIX,
  PROFILE_RELOAD,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { useDetailNavigation } from "../../app/detail-navigation";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import { InlineError } from "../../ui";
import { AuthPanel } from "../auth";
import ProfileAdminLink from "./ProfileAdminLink.vue";
import ProfileIdentityGroup from "./ProfileIdentityGroup.vue";
import ProfileTabs from "./ProfileTabs.vue";
import ProfileCollectionList from "./ProfileCollectionList.vue";
import ProfileDetailOverlay from "./ProfileDetailOverlay.vue";
import { useProfileSession } from "./useProfileSession";
import { useProfileTabs } from "./useProfileTabs";
import { useActiveView } from "../../app/useActiveView";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const { setActiveView } = useActiveView();

const { user, loading, errorMessage, isMissingSessionError, refreshCurrentSession } =
  useProfileSession();

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

function enterGuestState() {
  user.value = null;
  profileItems.value = [];
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
  // Initial paint emits a no-op chrome spec because the IdentityGroup is gated
  // behind v-else-if="user" — it doesn't mount during the loading/guest paths,
  // so it can't drive chrome until after loadProfile resolves. Once user lands,
  // the IdentityGroup re-emits the real spec via its own chrome watcher.
  emit("chrome", { top: { visible: false }, bottom: { visible: false } });
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

      <ProfileIdentityGroup
        :user="user"
        :load-profile="loadProfile"
        :on-logout="logout"
        @chrome="(spec) => emit('chrome', spec)"
        @enter-verification="setActiveView('verification')"
      />

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
        v-if="detail.detailOpen.value"
        :post="detail.detailPost.value"
        :loading="detail.detailLoading.value"
        :error="detail.detailError.value"
        @close="detail.close('user-tap')"
        @retry="detail.retry()"
      />

      <ProfileAdminLink @enter-admin="setActiveView('admin')" />
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
