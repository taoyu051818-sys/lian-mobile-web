import { ref } from "vue";
import { createInviteCode } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  PROFILE_INVITE_GENERATED,
  PROFILE_INVITE_SUBMITTED,
  PROFILE_INVITE_ERROR,
} from "../../config/brand";

export function useInviteCode() {
  const busy = ref(false);
  const inviteCode = ref("");

  async function generate(
    onSuccess: (message: string) => void,
    onError: (message: string) => void,
  ) {
    if (busy.value) return;
    busy.value = true;
    try {
      const response = await createInviteCode();
      inviteCode.value = response.code || "";
      onSuccess(inviteCode.value ? PROFILE_INVITE_GENERATED : PROFILE_INVITE_SUBMITTED);
    } catch (error) {
      onError(extractErrorMessage(error, PROFILE_INVITE_ERROR));
    } finally {
      busy.value = false;
    }
  }

  return { busy, inviteCode, generate };
}
