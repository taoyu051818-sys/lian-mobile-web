import { computed, ref } from "vue";
import { fetchAuthMe } from "../../api/profile";
import {
  DEFAULT_USER_LABEL,
  ERROR_SEND_MESSAGE,
  MESSAGE_IDENTITY_SIGNAL_PREFIX,
  MESSAGE_NO_IDENTITY_SIGNAL,
  USER_AVATAR_FALLBACK,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { actorDisplayName } from "../../domain/actor";
import type { ProfileUser } from "../../types/profile";
import type { AudienceVisibility } from "../../types/audience";

export function useMessageComposer(options: {
  onSend: (
    content: string,
    identityTag: string,
    currentUser: ProfileUser | null,
    visibility: AudienceVisibility,
  ) => Promise<void>;
  onRetry: (pendingId: string, identityTag: string) => Promise<void>;
}) {
  const composerContent = ref("");
  const composerIdentityTag = ref("");
  const composerVisibility = ref<AudienceVisibility>("public");
  const currentUser = ref<ProfileUser | null>(null);
  const identityTags = ref<string[]>([]);
  const sending = ref(false);
  const sendError = ref("");

  const isGuest = computed(() => !currentUser.value);

  const activeAlias = computed(() => {
    const user = currentUser.value;
    if (!user?.aliases?.length) return null;
    return user.aliases.find((alias) => alias.id === user.activeAliasId) || user.aliases[0] || null;
  });
  // When an alias is active the composer is in alias/anonymous mode — empty
  // alias.name must NOT fall back to username, which would leak the real
  // account identity onto an anonymity-sensitive surface (#952). Username is
  // only an acceptable display when there is no alias at all (real identity).
  const composerActorName = computed(() => {
    const alias = activeAlias.value;
    if (alias) {
      return actorDisplayName(
        {
          aliasId: alias.id,
          displayName: alias.name,
        },
        DEFAULT_USER_LABEL,
      );
    }
    return currentUser.value?.username || DEFAULT_USER_LABEL;
  });
  const composerAvatarText = computed(
    () => composerActorName.value.slice(0, 2) || USER_AVATAR_FALLBACK,
  );
  const composerSignalMeta = computed(() =>
    composerIdentityTag.value
      ? `${MESSAGE_IDENTITY_SIGNAL_PREFIX}${composerIdentityTag.value}`
      : MESSAGE_NO_IDENTITY_SIGNAL,
  );

  async function loadCurrentUser() {
    try {
      const user = await fetchAuthMe();
      currentUser.value = user || null;
      identityTags.value = user?.identityTags?.length ? user.identityTags : [];
      composerIdentityTag.value = "";
      // Reset visibility to public when user changes (guest can only use public)
      if (!user) {
        composerVisibility.value = "public";
      }
    } catch {
      currentUser.value = null;
      identityTags.value = [];
      composerIdentityTag.value = "";
      composerVisibility.value = "public";
    }
  }

  async function submitMessage() {
    const content = composerContent.value.trim();
    if (!content || sending.value) return;

    sending.value = true;
    sendError.value = "";
    composerContent.value = "";

    try {
      await options.onSend(
        content,
        composerIdentityTag.value,
        currentUser.value,
        composerVisibility.value,
      );
    } catch (error) {
      sendError.value = extractErrorMessage(error, ERROR_SEND_MESSAGE);
    } finally {
      sending.value = false;
    }
  }

  async function retryMessage(pendingId: string) {
    if (sending.value) return;

    sending.value = true;
    sendError.value = "";

    try {
      await options.onRetry(pendingId, composerIdentityTag.value);
    } catch (error) {
      sendError.value = extractErrorMessage(error, ERROR_SEND_MESSAGE);
    } finally {
      sending.value = false;
    }
  }

  return {
    composerContent,
    composerIdentityTag,
    composerVisibility,
    currentUser,
    identityTags,
    sending,
    sendError,
    isGuest,
    activeAlias,
    composerActorName,
    composerAvatarText,
    composerSignalMeta,
    loadCurrentUser,
    submitMessage,
    retryMessage,
  };
}
