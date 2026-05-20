import { computed, ref } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  DEFAULT_USER_LABEL,
  PUBLISH_IDENTITY_META,
  PUBLISH_IDENTITY_UNCONFIRMED,
  USER_AVATAR_FALLBACK,
} from "../../config/brand";
import { normalizeIdentityTag } from "../../api/publish";
import { fetchAuthMe } from "../../api/profile";

/**
 * Identity-side of the publish view: the avatar/name/meta strip that the
 * shell renders, the alias the post is attributed to, and the user-curated
 * identity-tag pool. Lives in its own file so `usePublishDraft` can stay
 * focused on form/file/upload state — the two used to be one 314-line
 * composable returning 27 fields.
 */
export function usePublishIdentity() {
  const aliasId = ref<string | undefined>(undefined);
  const identityName = ref(DEFAULT_USER_LABEL);
  const identityMeta = ref(PUBLISH_IDENTITY_META);
  const identityTag = ref("");
  const identityTagOptions = ref<string[]>([]);
  // Stable user identifier used to scope the publish draft to the signed-in
  // account (issue #692). `null` while we have not yet resolved an identity,
  // so callers can wait before restoring a draft and avoid leaking another
  // account's draft into the form during the auth/me round trip.
  const userId = ref<string | null>(null);
  const identityLoaded = ref(false);

  const normalizedIdentityTag = computed(() => normalizeIdentityTag(identityTag.value));
  const avatarText = computed(() => identityName.value.slice(0, 2) || USER_AVATAR_FALLBACK);

  const pageChrome = computed<PageChromeSpec>(() => ({
    top: {
      identity: {
        avatarText: avatarText.value,
        name: identityName.value,
        meta: identityMeta.value,
      },
    },
  }));

  async function loadIdentity() {
    try {
      const user = await fetchAuthMe();
      identityName.value = user?.username || DEFAULT_USER_LABEL;
      aliasId.value = user?.activeAliasId || undefined;
      identityTagOptions.value = user?.identityTags || [];
      identityTag.value = "";
      userId.value = typeof user?.id === "string" && user.id ? user.id : null;
      const activeAlias = aliasId.value
        ? user?.aliases?.find((alias) => alias.id === aliasId.value)
        : null;
      identityMeta.value = activeAlias?.name || user?.institution || PUBLISH_IDENTITY_META;
    } catch {
      identityName.value = DEFAULT_USER_LABEL;
      identityMeta.value = PUBLISH_IDENTITY_UNCONFIRMED;
      identityTagOptions.value = [];
      identityTag.value = "";
      userId.value = null;
    } finally {
      identityLoaded.value = true;
    }
  }

  return {
    aliasId,
    identityName,
    identityMeta,
    identityTag,
    identityTagOptions,
    userId,
    identityLoaded,
    normalizedIdentityTag,
    avatarText,
    pageChrome,
    loadIdentity,
  };
}
