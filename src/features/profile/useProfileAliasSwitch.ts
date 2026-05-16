import { ref } from "vue";
import { activateProfileAlias, deactivateProfileAlias } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

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
      onError(extractErrorMessage(error, "发布身份没有切换成功，可以稍后再试。"));
    } finally {
      busy.value = false;
    }
  }

  return { busy, switchAlias };
}
