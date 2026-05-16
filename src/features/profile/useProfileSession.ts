import { computed, ref } from "vue";
import { LianApiError } from "../../api/http";
import { fetchAuthMe, logoutAuth } from "../../api/profile";
import {
  GUEST_DISPLAY_NAME,
  ERROR_LOAD_GENERIC,
  ERROR_LOGOUT,
  PROFILE_ALIAS_DEFAULT_HINT,
  PROFILE_ALIAS_DESCRIPTION,
  PROFILE_ALIAS_MORE_HINT,
  PROFILE_ALIAS_PERSONA,
  PROFILE_ALIAS_SIGNAL,
  PROFILE_ALIAS_TYPE,
  PROFILE_IDENTITY_FALLBACK,
  PROFILE_LOAD_ERROR_PREFIX,
  PROFILE_REAL_IDENTITY_HINT,
  USER_AVATAR_FALLBACK,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { ProfileUser } from "../../types/profile";

export function useProfileSession() {
  const user = ref<ProfileUser | null>(null);
  const loading = ref(false);
  const errorMessage = ref("");
  const editorOpen = ref(false);

  const displayName = computed(() => user.value?.username || GUEST_DISPLAY_NAME);
  const avatarText = computed(() => displayName.value.slice(0, 2) || USER_AVATAR_FALLBACK);
  const aliases = computed(() => user.value?.aliases || []);
  const activeAlias = computed(() => {
    if (!user.value?.activeAliasId) return null;
    return aliases.value.find((alias) => alias.id === user.value?.activeAliasId) || null;
  });
  const identityMeta = computed(
    () => activeAlias.value?.name || user.value?.identityTags?.[0] || user.value?.institution || PROFILE_IDENTITY_FALLBACK,
  );
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
    return activeAliasSummary.value.length ? PROFILE_ALIAS_DEFAULT_HINT : PROFILE_ALIAS_MORE_HINT;
  });
  const userTags = computed(() => {
    const tags = user.value?.tags || user.value?.identityTags || [];
    return tags.slice(0, 5);
  });

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

  function enterGuestState() {
    user.value = null;
    editorOpen.value = false;
    errorMessage.value = "";
  }

  async function loadProfile(loadActiveTab: () => Promise<void>, onUnauthenticated: () => void) {
    loading.value = true;
    errorMessage.value = "";
    try {
      user.value = await fetchAuthMe();
      if (user.value) {
        await loadActiveTab();
      } else {
        enterGuestState();
        onUnauthenticated();
      }
    } catch (error) {
      if (isMissingSessionError(error)) {
        enterGuestState();
        onUnauthenticated();
      } else {
        errorMessage.value = extractErrorMessage(error, PROFILE_LOAD_ERROR_PREFIX + ERROR_LOAD_GENERIC);
      }
    } finally {
      loading.value = false;
    }
  }

  async function logout(onUnauthenticated: () => void) {
    loading.value = true;
    errorMessage.value = "";
    try {
      await logoutAuth();
      enterGuestState();
      onUnauthenticated();
    } catch (error) {
      if (isMissingSessionError(error)) {
        enterGuestState();
        onUnauthenticated();
      } else {
        errorMessage.value = extractErrorMessage(error, ERROR_LOGOUT);
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    loading,
    errorMessage,
    editorOpen,
    displayName,
    avatarText,
    aliases,
    activeAlias,
    identityMeta,
    activeAliasSummary,
    activeAliasHint,
    userTags,
    isMissingSessionError,
    refreshCurrentSession,
    enterGuestState,
    loadProfile,
    logout,
  };
}
