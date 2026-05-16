import { computed, ref } from "vue";
import { fetchAuthMe } from "../../api/profile";
import {
  DEFAULT_USER_LABEL,
  MESSAGE_IDENTITY_SIGNAL_PREFIX,
  MESSAGE_NO_IDENTITY_SIGNAL,
  USER_AVATAR_FALLBACK,
} from "../../config/brand";
import type { ProfileUser } from "../../types/profile";

export function useMessageComposer() {
  const composerContent = ref("");
  const composerIdentityTag = ref("");
  const currentUser = ref<ProfileUser | null>(null);
  const identityTags = ref<string[]>([]);
  const sending = ref(false);
  const sendError = ref("");

  const activeAlias = computed(() => {
    const user = currentUser.value;
    if (!user?.aliases?.length) return null;
    return user.aliases.find((alias) => alias.id === user.activeAliasId) || user.aliases[0] || null;
  });

  const composerActorName = computed(
    () => activeAlias.value?.name || currentUser.value?.username || DEFAULT_USER_LABEL,
  );
  const composerAvatarText = computed(
    () => composerActorName.value.slice(0, 2) || USER_AVATAR_FALLBACK,
  );
  const composerSignalMeta = computed(() => (
    composerIdentityTag.value
      ? `${MESSAGE_IDENTITY_SIGNAL_PREFIX}${composerIdentityTag.value}`
      : MESSAGE_NO_IDENTITY_SIGNAL
  ));

  async function loadCurrentUser() {
    try {
      const user = await fetchAuthMe();
      currentUser.value = user || null;
      identityTags.value = user?.identityTags?.length ? user.identityTags : [];
      composerIdentityTag.value = "";
    } catch {
      currentUser.value = null;
      identityTags.value = [];
      composerIdentityTag.value = "";
    }
  }

  return {
    composerContent,
    composerIdentityTag,
    currentUser,
    identityTags,
    sending,
    sendError,
    composerActorName,
    composerAvatarText,
    composerSignalMeta,
    loadCurrentUser,
  };
}
