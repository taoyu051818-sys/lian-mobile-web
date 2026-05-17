import { ref } from "vue";
import { activateProfileAlias, deactivateProfileAlias } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { PROFILE_IDENTITY_SWITCH_ERROR } from "../../config/brand";

export function useProfileAliasSwitch() {
  const busy = ref(false);

  async function switchAlias(
    aliasId: string,
    onSuccess: () => void,
    onError: (message: string) => void,
  ) {
    if (busy.value) return;
    busy.value = true;
    try {
      if (aliasId) await activateProfileAlias(aliasId);
      else await deactivateProfileAlias();
      onSuccess();
    } catch (error) {
      onError(extractErrorMessage(error, PROFILE_IDENTITY_SWITCH_ERROR));
    } finally {
      busy.value = false;
    }
  }

  return { busy, switchAlias };
}
