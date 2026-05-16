<script setup lang="ts">
import { onMounted, watch } from "vue";
import { LOADING_PROFILE, PROFILE_RELOAD, PROFILE_SECTION_LABEL } from "../../config/brand";
import { InlineError } from "../../ui";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import AuthPanel from "../auth/AuthPanel.vue";
import { usePostDetail } from "../detail/usePostDetail";
import ProfileCollectionList from "./ProfileCollectionList.vue";
import ProfileDetailOverlay from "./ProfileDetailOverlay.vue";
import ProfileEditorPanel from "./ProfileEditorPanel.vue";
import ProfileHeader from "./ProfileHeader.vue";
import ProfileTabs from "./ProfileTabs.vue";
import { useProfileAliasPicker } from "./useProfileAliasPicker";
import { useProfileChrome } from "./useProfileChrome";
import { useProfileSession } from "./useProfileSession";
import { useProfileTabs } from "./useProfileTabs";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const session = useProfileSession();
const detail = usePostDetail();

function handleUnauthenticated() {
  session.enterGuestState();
  tabs.resetProfileList();
  aliasPicker.closeAliasPicker();
}

const aliasPicker = useProfileAliasPicker({
  user: session.user,
  reloadProfile: async () => {
    await session.loadProfile(
      () => tabs.loadProfileList(tabs.activeTab.value),
      handleUnauthenticated,
    );
  },
});

const tabs = useProfileTabs({
  isMissingSessionError: session.isMissingSessionError,
  refreshCurrentSession: session.refreshCurrentSession,
  onUnauthenticated: handleUnauthenticated,
});

const chrome = useProfileChrome({
  user: session.user,
  editorOpen: session.editorOpen,
  avatarText: session.avatarText,
  displayName: session.displayName,
  identityMeta: session.identityMeta,
  onLogout: () => logout(),
});

watch(chrome.pageChrome, (spec) => emit("chrome", spec), { deep: true });

async function loadProfile() {
  await session.loadProfile(
    () => tabs.loadProfileList(tabs.activeTab.value),
    handleUnauthenticated,
  );
}

async function logout() {
  await session.logout(handleUnauthenticated);
}

async function handleAuthenticated(authenticatedUser: ProfileUser | null) {
  if (authenticatedUser) {
    session.user.value = authenticatedUser;
  }
  await loadProfile();
}

async function handleProfileUpdated() {
  aliasPicker.closeAliasPicker();
  await loadProfile();
}

onMounted(() => {
  emit("chrome", chrome.pageChrome.value);
  void loadProfile();
});
</script>

<template>
  <section class="profile-view" :aria-label="PROFILE_SECTION_LABEL">
    <InlineError v-if="session.errorMessage.value">
      {{ session.errorMessage.value }}
      <button type="button" @click="loadProfile">{{ PROFILE_RELOAD }}</button>
    </InlineError>

    <div v-if="session.loading.value" class="profile-view__state" role="status">{{ LOADING_PROFILE }}</div>

    <template v-else-if="session.user.value">
      <div class="profile-view__hero-bg" aria-hidden="true"></div>

      <ProfileHeader
        :user="session.user.value"
        :avatar-text="session.avatarText.value"
        :display-name="session.displayName.value"
        :identity-meta="session.identityMeta.value"
        :user-tags="session.userTags.value"
        :aliases="session.aliases.value"
        :active-alias="session.activeAlias.value"
        :active-alias-hint="session.activeAliasHint.value"
        :active-alias-summary="session.activeAliasSummary.value"
        :alias-picker-open="aliasPicker.aliasPickerOpen.value"
        @toggle-alias-picker="aliasPicker.toggleAliasPicker"
        @select-alias="aliasPicker.switchAlias"
      />

      <ProfileEditorPanel
        v-if="session.editorOpen.value"
        :user="session.user.value"
        @updated="handleProfileUpdated"
      />

      <ProfileTabs
        :tabs="tabs.tabs"
        :active-tab="tabs.activeTab.value"
        @select="tabs.loadProfileList"
      />

      <ProfileCollectionList
        :items="tabs.profileItems.value"
        :loading="tabs.listLoading.value"
        :empty-text="tabs.listEmptyText.value"
        :error="tabs.listError.value"
        @retry="tabs.loadProfileList(tabs.activeTab.value)"
        @open-item="detail.openDetail"
      />

      <ProfileDetailOverlay
        v-if="detail.detailOpen.value"
        :post="detail.selectedPost.value"
        :loading="detail.detailLoading.value"
        :error="detail.detailError.value"
        @close="detail.closeDetail"
        @retry="detail.retryDetail"
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
