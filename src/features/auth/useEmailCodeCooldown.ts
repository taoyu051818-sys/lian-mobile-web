import { computed, onBeforeUnmount, ref, type Ref } from "vue";
import { sendEmailCode } from "../../api/auth";
import {
  ERROR_SEND_CODE,
  AUTH_SENDING, AUTH_RESEND, AUTH_SEND,
  AUTH_EMAIL_HINT, AUTH_EMAIL_REQUIRED, AUTH_CODE_SENT,
  AUTH_CODE_RESEND_HINT, AUTH_CODE_COOLDOWN_HINT, AUTH_CODE_RATE_LIMIT,
  AUTH_CODE_RATE_LIMIT_DEFAULT, AUTH_CODE_SENT_INST, AUTH_CODE_RATE_LIMIT_RESEND,
  AUTH_CODE_RATE_LIMIT_FALLBACK,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { LianApiError } from "../../api/http";

export const AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS = 60;

export function formatEmailCodeHint(message: string, remainingSeconds: number) {
  if (remainingSeconds > 0) {
    return message
      ? `${message} ${AUTH_CODE_RESEND_HINT.replace("{n}", String(remainingSeconds))}`
      : AUTH_CODE_COOLDOWN_HINT.replace("{n}", String(remainingSeconds));
  }
  return message || AUTH_EMAIL_HINT;
}

export function formatEmailCodeRateLimitMessage(retryAfterSeconds: number | null) {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return AUTH_CODE_RATE_LIMIT.replace("{n}", String(retryAfterSeconds));
  }
  return AUTH_CODE_RATE_LIMIT_DEFAULT.replace("{n}", String(AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS));
}

export function normalizeCooldownSeconds(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value);
}

export function useEmailCodeCooldown(
  email: Ref<string>,
  errorMessage: Ref<string>,
) {
  const sendingCode = ref(false);
  const codeMessage = ref("");
  const emailCodeCooldownUntil = ref(0);
  const emailCodeCooldownRemaining = ref(0);
  let emailCodeCooldownTimer: ReturnType<typeof globalThis.setInterval> | null = null;

  const emailCodeHint = computed(
    () => formatEmailCodeHint(codeMessage.value, emailCodeCooldownRemaining.value),
  );
  const emailCodeButtonLabel = computed(() => {
    if (sendingCode.value) return AUTH_SENDING;
    if (emailCodeCooldownRemaining.value > 0) return `${AUTH_RESEND} ${emailCodeCooldownRemaining.value}s`;
    return AUTH_SEND;
  });
  const canRequestEmailCode = computed(
    () => !sendingCode.value && emailCodeCooldownRemaining.value === 0,
  );

  function stopEmailCodeCooldownTimer() {
    if (emailCodeCooldownTimer !== null) {
      globalThis.clearInterval(emailCodeCooldownTimer);
      emailCodeCooldownTimer = null;
    }
  }

  function syncEmailCodeCooldown() {
    const remaining = Math.max(0, Math.ceil((emailCodeCooldownUntil.value - Date.now()) / 1000));
    emailCodeCooldownRemaining.value = remaining;
    if (!remaining) {
      emailCodeCooldownUntil.value = 0;
      stopEmailCodeCooldownTimer();
    }
  }

  function startEmailCodeCooldown(seconds: number) {
    const cooldownSeconds = normalizeCooldownSeconds(seconds);
    if (!cooldownSeconds) return;

    emailCodeCooldownUntil.value = Date.now() + cooldownSeconds * 1000;
    syncEmailCodeCooldown();
    if (emailCodeCooldownTimer === null) {
      emailCodeCooldownTimer = globalThis.setInterval(syncEmailCodeCooldown, 1000);
    }
  }

  async function requestEmailCode() {
    const targetEmail = email.value.trim();
    errorMessage.value = "";
    if (!targetEmail) {
      errorMessage.value = AUTH_EMAIL_REQUIRED;
      return;
    }
    if (!canRequestEmailCode.value) {
      codeMessage.value = formatEmailCodeHint("", emailCodeCooldownRemaining.value);
      return;
    }

    sendingCode.value = true;
    try {
      const response = await sendEmailCode(targetEmail);
      startEmailCodeCooldown(AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS);
      codeMessage.value = response.institution
        ? AUTH_CODE_SENT_INST.replace("{n}", response.institution)
        : AUTH_CODE_SENT;
    } catch (error) {
      if (error instanceof LianApiError && error.status === 429) {
        const retryAfterSeconds = normalizeCooldownSeconds(error.retryAfterSeconds)
          || AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS;
        startEmailCodeCooldown(retryAfterSeconds);
        errorMessage.value = formatEmailCodeRateLimitMessage(error.retryAfterSeconds);
        codeMessage.value = error.retryAfterSeconds
          ? AUTH_CODE_RATE_LIMIT_RESEND.replace("{n}", String(retryAfterSeconds))
          : AUTH_CODE_RATE_LIMIT_FALLBACK.replace("{n}", String(AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS));
      } else {
        errorMessage.value = extractErrorMessage(error, ERROR_SEND_CODE);
      }
    } finally {
      sendingCode.value = false;
    }
  }

  onBeforeUnmount(() => {
    stopEmailCodeCooldownTimer();
  });

  return {
    sendingCode,
    codeMessage,
    emailCodeHint,
    emailCodeButtonLabel,
    canRequestEmailCode,
    requestEmailCode,
  };
}
