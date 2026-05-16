import { ref } from "vue";
import { createInviteCode } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

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
      onSuccess(inviteCode.value ? "邀请码已生成。" : "邀请码请求已提交。");
    } catch (error) {
      onError(extractErrorMessage(error, "邀请码没有生成成功，可以稍后再试。"));
    } finally {
      busy.value = false;
    }
  }

  return { busy, inviteCode, generate };
}
