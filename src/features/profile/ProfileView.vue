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
  PROFILE_UNLOCKS_SECTION_LABEL,
  RUNNER_ENTER_LABEL,
  VERIFICATION_ENTER_LABEL,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { useDetailNavigation } from "../../app/detail-navigation";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import { InlineError } from "../../ui";
import { AuthPanel } from "../auth";
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
import { buildProfileUnlockCards, hasActiveVerificationTag } from "./profileUnlocks";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const { setActiveView } = useActiveView();
const adminEntryVisible = computed(() => import.meta.env.VITE_ADMIN_VISIBLE === "true");

const { user, loading, errorMessage, isMissingSessionError, refreshCurrentSession } =
  useProfileSession();

const isMerchantVerified = computed(() =>
  hasActiveVerificationTag(user.value, "merchant_verified"),
);
const isRunnerVerified = computed(() => hasActiveVerificationTag(user.value, "runner"));
const unlockCards = computed(() => buildProfileUnlockCards(user.value));

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

      <!--
        issue #609 PR1: orders tab renders ProfileErrandOrdersBlock; every
        other tab uses the shared collection list. Both branches stay inside
        the v-else-if="user" block so the guest state is unchanged. The
        block had been a runner-gated footer (which was wrong — the
        requester is the user themselves, not a runner), so we move it up
        and drop the verification gate.
      -->
      <ProfileErrandOrdersBlock v-if="activeTab === 'orders'" />

      <ProfileCollectionList
        v-else
        :items="profileItems"
        :loading="listLoading"
        :empty-text="listEmptyText"
        :error="listError"
        @retry="loadProfileList(activeTab)"
        @open-item="openItem"
      />

      <section
        v-if="unlockCards.length"
        class="profile-view__unlock-section"
        :aria-label="PROFILE_UNLOCKS_SECTION_LABEL"
      >
        <article
          v-for="card in unlockCards"
          :key="card.key"
          class="profile-view__unlock-card"
          :data-kind="card.key"
          :data-testid="card.testId"
        >
          <div class="profile-view__unlock-copy">
            <strong>{{ card.title }}</strong>
            <p>{{ card.hint }}</p>
          </div>
          <button
            type="button"
            class="profile-view__unlock-cta"
            data-testid="profile-unlock-card-cta"
            @click="setActiveView(card.targetView)"
          >
            {{ card.ctaLabel }}
          </button>
        </article>
      </section>

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

.profile-view__unlock-section {
  display: grid;
  gap: var(--space-3);
}

.profile-view__unlock-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
}

.profile-view__unlock-card[data-kind="campus"] {
  border-color: rgba(31, 167, 160, 0.24);
  background: rgba(31, 167, 160, 0.09);
}

.profile-view__unlock-card[data-kind="merchant"] {
  border-color: rgba(255, 159, 67, 0.3);
  background: rgba(255, 159, 67, 0.1);
}

.profile-view__unlock-card[data-kind="runner"] {
  border-color: rgba(124, 92, 255, 0.28);
  background: rgba(124, 92, 255, 0.09);
}

.profile-view__unlock-copy {
  display: grid;
  gap: var(--space-1);
}

.profile-view__unlock-copy strong {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
}

.profile-view__unlock-copy p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-view__unlock-cta {
  flex: none;
  min-height: 34px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--lian-primary, #1fa7a0);
  color: #fff;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
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

@media (max-width: 640px) {
  .profile-view__unlock-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-view__unlock-cta {
    width: 100%;
  }
}
</style>
