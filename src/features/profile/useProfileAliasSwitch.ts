import { activateProfileAlias, deactivateProfileAlias } from "../../api/profile";
import { useAsyncOperation } from "../../composables/useAsyncOperation";
import { PROFILE_IDENTITY_SWITCH_ERROR } from "../../config/brand";

export function useProfileAliasSwitch() {
  const { busy, errorMessage, run } = useAsyncOperation();

  async function switchAlias(
    aliasId: string,
    onSuccess: () => void,
    onError: (message: string) => void,
  ) {
    const result = await run(
      async () => {
        if (aliasId) {
          await activateProfileAlias(aliasId);
        } else {
          await deactivateProfileAlias();
        }
      },
      PROFILE_IDENTITY_SWITCH_ERROR,
      onSuccess,
    );
    // Surface error to caller via callback for backward compatibility
    if (result === undefined && errorMessage.value) {
      onError(errorMessage.value);
    }
  }

  return { busy, switchAlias };
}
