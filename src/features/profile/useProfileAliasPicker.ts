import { ref, type Ref } from "vue";
import { activateProfileAlias, deactivateProfileAlias } from "../../api/profile";
import type { ProfileUser } from "../../types/profile";

export function useProfileAliasPicker(options: {
  user: Ref<ProfileUser | null>;
  reloadProfile: () => Promise<void>;
}) {
  const aliasPickerOpen = ref(false);
  const aliasBusy = ref(false);

  function toggleAliasPicker() {
    aliasPickerOpen.value = !aliasPickerOpen.value;
  }

  function closeAliasPicker() {
    aliasPickerOpen.value = false;
  }

  async function switchAlias(aliasId: string) {
    if (aliasBusy.value || !options.user.value) return;
    aliasBusy.value = true;
    try {
      if (aliasId) await activateProfileAlias(aliasId);
      else await deactivateProfileAlias();
      closeAliasPicker();
      await options.reloadProfile();
    } catch {
      // non-blocking: keep existing profile state and let the user retry
    } finally {
      aliasBusy.value = false;
    }
  }

  return {
    aliasPickerOpen,
    aliasBusy,
    toggleAliasPicker,
    closeAliasPicker,
    switchAlias,
  };
}
