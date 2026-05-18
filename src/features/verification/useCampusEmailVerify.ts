import { ref } from "vue";
import { confirmCampusEmailCode, sendCampusEmailCode } from "../../api/verification";
import { LianApiError } from "../../api/http";
import {
  VERIFICATION_CAMPUS_CODE_REQUIRED,
  VERIFICATION_CAMPUS_CODE_SENT,
  VERIFICATION_CAMPUS_CONFIRM_FAIL,
  VERIFICATION_CAMPUS_EMAIL_REQUIRED,
  VERIFICATION_CAMPUS_SEND_FAIL,
  VERIFICATION_CAMPUS_SUCCESS,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS,
  formatEmailCodeRateLimitMessage,
  normalizeCooldownSeconds,
} from "../auth";
import type { CampusEmailConfirmResponse } from "../../types/verification";

export interface UseCampusEmailVerifyOptions {
  onConfirmed?: (response: CampusEmailConfirmResponse) => void | Promise<void>;
}

export function useCampusEmailVerify(options: UseCampusEmailVerifyOptions = {}) {
  const email = ref("");
  const code = ref("");
  const sending = ref(false);
  const submitting = ref(false);
  const errorMessage = ref("");
  const noticeMessage = ref("");
  const cooldownUntil = ref(0);
  const cooldownRemaining = ref(0);
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;

  function clearTimer() {
    if (timer !== null) {
      globalThis.clearInterval(timer);
      timer = null;
    }
  }

  function syncCooldown() {
    const remaining = Math.max(0, Math.ceil((cooldownUntil.value - Date.now()) / 1000));
    cooldownRemaining.value = remaining;
    if (!remaining) {
      cooldownUntil.value = 0;
      clearTimer();
    }
  }

  function startCooldown(seconds: number) {
    const cooldownSeconds = normalizeCooldownSeconds(seconds);
    if (!cooldownSeconds) return;
    cooldownUntil.value = Date.now() + cooldownSeconds * 1000;
    syncCooldown();
    if (timer === null) {
      timer = globalThis.setInterval(syncCooldown, 1000);
    }
  }

  async function requestCode() {
    const targetEmail = email.value.trim();
    errorMessage.value = "";
    if (!targetEmail) {
      errorMessage.value = VERIFICATION_CAMPUS_EMAIL_REQUIRED;
      return;
    }
    if (cooldownRemaining.value > 0 || sending.value) return;

    sending.value = true;
    try {
      const response = await sendCampusEmailCode(targetEmail);
      startCooldown(AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS);
      noticeMessage.value = response.institution
        ? VERIFICATION_CAMPUS_CODE_SENT.replace("{n}", response.institution)
        : VERIFICATION_CAMPUS_CODE_SENT.replace("{n}", targetEmail);
    } catch (error) {
      if (error instanceof LianApiError && error.status === 429) {
        const retryAfterSeconds =
          normalizeCooldownSeconds(error.retryAfterSeconds) ||
          AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS;
        startCooldown(retryAfterSeconds);
        errorMessage.value = formatEmailCodeRateLimitMessage(error.retryAfterSeconds);
      } else {
        errorMessage.value = extractErrorMessage(error, VERIFICATION_CAMPUS_SEND_FAIL);
      }
    } finally {
      sending.value = false;
    }
  }

  async function submitCode() {
    const targetEmail = email.value.trim();
    const targetCode = code.value.trim();
    errorMessage.value = "";
    if (!targetEmail) {
      errorMessage.value = VERIFICATION_CAMPUS_EMAIL_REQUIRED;
      return;
    }
    if (!targetCode) {
      errorMessage.value = VERIFICATION_CAMPUS_CODE_REQUIRED;
      return;
    }
    submitting.value = true;
    try {
      const response = await confirmCampusEmailCode(targetEmail, targetCode);
      noticeMessage.value = VERIFICATION_CAMPUS_SUCCESS;
      code.value = "";
      if (options.onConfirmed) await options.onConfirmed(response);
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, VERIFICATION_CAMPUS_CONFIRM_FAIL);
    } finally {
      submitting.value = false;
    }
  }

  function dispose() {
    clearTimer();
  }

  return {
    email,
    code,
    sending,
    submitting,
    errorMessage,
    noticeMessage,
    cooldownRemaining,
    requestCode,
    submitCode,
    dispose,
  };
}
