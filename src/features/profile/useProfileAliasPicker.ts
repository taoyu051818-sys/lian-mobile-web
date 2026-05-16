import { computed, ref, type Ref } from "vue";
import { activateProfileAlias, deactivateProfileAlias } from "../../api/profile";
import {
  PROFILE_ALIAS_TYPE, PROFILE_ALIAS_SIGNAL,
  PROFILE_ALIAS_PERSONA, PROFILE_ALIAS_DESCRIPTION, PROFILE_REAL_IDENTITY_HINT,
  PROFILE_ALIAS_DEFAULT_HINT, PROFILE_ALIAS_MORE_HINT,
} from "../../config/brand";
import type { ProfileUser } from "../../types/profile";

export function useProfileAliasPicker(options: {
  user: Ref<ProfileUser | null>;
  loadProfile: () => Promise<void>;
}) {
  const { user, loadProfile } = options;

  const aliasPickerOpen = ref(false);
  const aliasBusy = ref(false);

  const activeAlias = computed(() => {
    if (!user.value?.activeAliasId) return null;
    return user.value.aliases?.find((alias) => alias.id === user.value?.activeAliasId) || null;
  });

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

  const identityMeta = computed(() => activeAlias.value?.name || user.value?.identityTags?.[0] || user.value?.institution || PROFILE_REAL_IDENTITY_HINT);

  const userTags = computed(() => {
    const tags = user.value?.tags || user.value?.identityTags || [];
    return tags.slice(0, 5);
  });

  const aliases = computed(() => user.value?.aliases || []);

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

  return {
    aliasPickerOpen,
    aliasBusy,
    activeAlias,
    activeAliasSummary,
    activeAliasHint,
    identityMeta,
    userTags,
    aliases,
    handleProfileUpdated,
    switchAlias,
  };
}
