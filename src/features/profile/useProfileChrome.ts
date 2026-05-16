import { computed, type ComputedRef, type Ref } from "vue";
import {
  PROFILE_COLLAPSE_EDITOR,
  PROFILE_EDIT,
  PROFILE_LOGOUT,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type { ProfileUser } from "../../types/profile";

export function useProfileChrome(options: {
  user: Ref<ProfileUser | null>;
  editorOpen: Ref<boolean>;
  avatarText: ComputedRef<string>;
  displayName: ComputedRef<string>;
  identityMeta: ComputedRef<string>;
  onLogout: () => void | Promise<void>;
}) {
  function handleChromeButtonClick(buttonId: string) {
    if (buttonId === "profile:toggle-editor") {
      options.editorOpen.value = !options.editorOpen.value;
    } else if (buttonId === "profile:logout") {
      void options.onLogout();
    }
  }

  const pageChrome = computed<PageChromeSpec>(() => ({
    top: options.user.value
      ? {
          visible: true,
          identity: {
            avatarText: options.avatarText.value,
            name: options.displayName.value,
            meta: options.identityMeta.value,
          },
          buttons: [
            {
              id: "profile:toggle-editor",
              label: options.editorOpen.value ? PROFILE_COLLAPSE_EDITOR : PROFILE_EDIT,
              variant: "tonal",
            },
            { id: "profile:logout", label: PROFILE_LOGOUT, variant: "ghost" },
          ],
          onButtonClick: handleChromeButtonClick,
        }
      : { visible: false },
  }));

  return {
    pageChrome,
  };
}
