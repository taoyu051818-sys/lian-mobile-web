<script setup lang="ts">
import { ref, watch } from "vue";
import { VERIFICATION_ENTER_LABEL } from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";
import ProfileEditorPanel from "./ProfileEditorPanel.vue";
import ProfileHeader from "./ProfileHeader.vue";
import ProfileSettingsBlock from "./ProfileSettingsBlock.vue";
import ProfileStatsBlock from "./ProfileStatsBlock.vue";
import { useProfileAliasPicker } from "./useProfileAliasPicker";
import { useProfileChrome } from "./useProfileChrome";

/**
 * Identity group container — the first "lens" of the 4-lens profile layout
 * (identity / creator / reader / inbox). Wraps everything that describes "who
 * you are" and the tools to act on that: header, editor, contribution stats,
 * personal settings, and the verification-center entry.
 *
 * Why a container, not a flat ProfileView: the four child blocks share state
 * (alias picker, chrome buttons, editor open) that previously lived as ad-hoc
 * refs scattered through ProfileView. Pulling them together makes the
 * "identity" subtree a self-contained unit, and shrinks ProfileView down to
 * the orchestrator role (load / error / guest / tabs / detail overlay).
 *
 * Two things still flow through ProfileView, by design:
 * - `loadProfile`: re-fetching `/api/auth/me` writes ProfileView's user/error
 *   refs, which other parts of the page (tabs, list) also depend on. Passing
 *   the closure in keeps ownership where it belongs.
 * - `chrome` emit: shell chrome is a page-level concern, so this group emits
 *   the spec up and ProfileView re-emits to AppViewHost.
 */
const props = defineProps<{
  user: ProfileUser;
  loadProfile: () => Promise<void>;
  onLogout: () => void;
}>();

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  "enter-verification": [];
}>();

const userRef = ref(props.user);
// Keep the inner ref in step with the prop so the composables (which expect a
// Ref<ProfileUser | null>) see a single source of truth without burdening the
// parent with `ref`-vs-value conventions.
watch(
  () => props.user,
  (next) => {
    userRef.value = next;
  },
);

const editorOpen = ref(false);

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
  user: userRef,
  loadProfile: () => props.loadProfile(),
});

const { displayName, avatarText } = useProfileChrome({
  user: userRef,
  editorOpen,
  identityMeta,
  onLogout: () => props.onLogout(),
  onChromeChange: (spec) => emit("chrome", spec),
});
</script>

<template>
  <div class="profile-identity-group">
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

    <footer class="profile-identity-group__verification-entry">
      <button
        type="button"
        class="profile-identity-group__verification-link"
        data-testid="profile-identity-group-verification"
        @click="emit('enter-verification')"
      >
        {{ VERIFICATION_ENTER_LABEL }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.profile-identity-group {
  display: grid;
  gap: var(--space-4);
}

.profile-identity-group__verification-entry {
  display: flex;
  justify-content: center;
  margin-top: var(--space-2);
}

.profile-identity-group__verification-link {
  min-height: 36px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.profile-identity-group__verification-link:hover,
.profile-identity-group__verification-link:focus-visible {
  background: rgba(31, 167, 160, 0.1);
  border-color: rgba(31, 167, 160, 0.3);
}
</style>
