import { computed, watch, type Ref } from "vue";
import {
  GUEST_DISPLAY_NAME,
  USER_AVATAR_FALLBACK,
  PROFILE_COLLAPSE_EDITOR,
  PROFILE_EDIT,
  PROFILE_LOGOUT,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";

export function useProfileChrome(options: {
  user: Ref<ProfileUser | null>;
  editorOpen: Ref<boolean>;
  identityMeta: Ref<string>;
  onLogout: () => void;
  onChromeChange: (spec: PageChromeSpec) => void;
}) {
  const { user, editorOpen, identityMeta, onLogout, onChromeChange } = options;

  const displayName = computed(() => user.value?.username || GUEST_DISPLAY_NAME);
  const avatarText = computed(() => displayName.value.slice(0, 2) || USER_AVATAR_FALLBACK);

  const pageChrome = computed<PageChromeSpec>(() => ({
    top: user.value
      ? {
          visible: true,
          identity: {
            avatarText: avatarText.value,
            name: displayName.value,
            meta: identityMeta.value,
          },
          buttons: [
            {
              id: "profile:toggle-editor",
              label: editorOpen.value ? PROFILE_COLLAPSE_EDITOR : PROFILE_EDIT,
              variant: "tonal",
            },
            { id: "profile:logout", label: PROFILE_LOGOUT, variant: "ghost" },
          ],
          onButtonClick: handleChromeButtonClick,
        }
      : { visible: false },
  }));

  function handleChromeButtonClick(buttonId: string) {
    if (buttonId === "profile:toggle-editor") {
      editorOpen.value = !editorOpen.value;
    } else if (buttonId === "profile:logout") {
      onLogout();
    }
  }

  watch(pageChrome, (spec) => onChromeChange(spec), { deep: true });

  return {
    displayName,
    avatarText,
    pageChrome,
    handleChromeButtonClick,
  };
}
