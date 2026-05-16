import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchAuthRules, loginAuth, registerAuth, sendEmailCode } from "../../api/auth";
import {
  ERROR_AUTH_GENERIC, ERROR_SEND_CODE,
  AUTH_SENDING, AUTH_RESEND, AUTH_SEND, AUTH_LOGIN, AUTH_REGISTER_AND_LOGIN,
  AUTH_EMAIL_HINT, AUTH_LOGIN_PLACEHOLDER, AUTH_INTEREST_SKIP_HINT,
  AUTH_INTEREST_LOADING, AUTH_INTEREST_EMPTY, AUTH_INTEREST_ERROR,
  AUTH_INTEREST_PICK_HINT, AUTH_INTEREST_SKIP_DEFAULT,
  AUTH_LOGGED_IN_REFRESH, AUTH_EMAIL_REQUIRED, AUTH_CODE_SENT,
  AUTH_CODE_RESEND_HINT, AUTH_CODE_COOLDOWN_HINT, AUTH_CODE_RATE_LIMIT,
  AUTH_CODE_RATE_LIMIT_DEFAULT, AUTH_CODE_SENT_INST, AUTH_CODE_RATE_LIMIT_RESEND,
  AUTH_CODE_RATE_LIMIT_FALLBACK,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { LianApiError } from "../../api/http";
import type { AuthInterestOption, AuthMode, AuthRulesResponse } from "../../api/auth";
import {
  AUTH_MAX_INTEREST_SELECTIONS,
  type AuthValidationFields,
  toggleSelectedInterest as toggleSharedSelectedInterest,
  validateAuthForm as validateSharedAuthForm,
} from "../../domain/validation/forms";
import type { ProfileUser } from "../../types/profile";

export type AuthInterestStatus = "loading" | "ready" | "empty" | "unavailable";

export interface AuthInterestSettings {
  options: AuthInterestOption[];
  status: AuthInterestStatus;
  required: boolean;
}

export type AuthFormFields = AuthValidationFields;

export const validateAuthForm = validateSharedAuthForm;

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

function normalizeCooldownSeconds(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value);
}

export function toggleSelectedInterest(current: string[], id: string, max = AUTH_MAX_INTEREST_SELECTIONS): string[] {
  return toggleSharedSelectedInterest(current, id, max);
}

export async function loadAuthInterestSettings(
  fetchRules: () => Promise<AuthRulesResponse> = fetchAuthRules,
): Promise<AuthInterestSettings> {
  try {
    const rules = await fetchRules();
    const options = rules.interests || [];
    if (!options.length) {
      return { options: [], status: "empty", required: false };
    }
    return {
      options,
      status: "ready",
      required: rules.interestsRequired === true,
    };
  } catch {
    return { options: [], status: "unavailable", required: false };
  }
}

export function useAuthForm(onAuthenticated: (user: ProfileUser | null) => void) {
  const mode = ref<AuthMode>("login");
  const login = ref("");
  const username = ref("");
  const email = ref("");
  const emailCode = ref("");
  const password = ref("");
  const inviteCode = ref("");
  const interestOptions = ref<AuthInterestOption[]>([]);
  const interestStatus = ref<AuthInterestStatus>("loading");
  const interestsRequired = ref(false);
  const selectedInterests = ref<string[]>([]);
  const submitting = ref(false);
  const sendingCode = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const codeMessage = ref("");
  const emailCodeCooldownUntil = ref(0);
  const emailCodeCooldownRemaining = ref(0);
  let emailCodeCooldownTimer: ReturnType<typeof globalThis.setInterval> | null = null;

  const primaryLabel = computed(() => (mode.value === "login" ? AUTH_LOGIN : AUTH_REGISTER_AND_LOGIN));
  const note = computed(() =>
    mode.value === "login"
      ? AUTH_LOGIN_PLACEHOLDER
      : AUTH_INTEREST_SKIP_HINT,
  );
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
  const passwordEnterKeyHint = computed(() => (mode.value === "login" ? "go" : "next"));
  const loginHasError = computed(
    () => mode.value === "login" && errorMessage.value.includes("邮箱或昵称"),
  );
  const usernameHasError = computed(
    () => mode.value === "register" && errorMessage.value.includes("昵称"),
  );
  const emailHasError = computed(
    () => mode.value === "register" && errorMessage.value.includes("高校邮箱"),
  );
  const emailCodeHasError = computed(
    () => mode.value === "register" && errorMessage.value.includes("验证码"),
  );
  const passwordHasError = computed(() => errorMessage.value.includes("密码至少"));
  const inviteCodeHasError = computed(
    () => mode.value === "register" && errorMessage.value.includes("邀请码"),
  );
  const hasInterestChoices = computed(
    () => interestStatus.value === "ready" && interestOptions.value.length > 0,
  );
  const showInterestSkip = computed(() => mode.value === "register" && !interestsRequired.value);
  const interestHint = computed(() => {
    if (interestStatus.value === "loading") {
      return AUTH_INTEREST_LOADING;
    }
    if (interestStatus.value === "empty") {
      return AUTH_INTEREST_EMPTY;
    }
    if (interestStatus.value === "unavailable") {
      return AUTH_INTEREST_ERROR;
    }
    if (interestsRequired.value) {
      return AUTH_INTEREST_PICK_HINT;
    }
    return AUTH_INTEREST_SKIP_DEFAULT;
  });

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

  function switchMode(nextMode: AuthMode) {
    mode.value = nextMode;
    errorMessage.value = "";
    successMessage.value = "";
  }

  function toggleInterest(id: string) {
    selectedInterests.value = toggleSelectedInterest(selectedInterests.value, id);
    if (selectedInterests.value.length) {
      errorMessage.value = errorMessage.value.includes("兴趣") ? "" : errorMessage.value;
    }
  }

  function skipInterestSelection() {
    selectedInterests.value = [];
    errorMessage.value = errorMessage.value.includes("兴趣") ? "" : errorMessage.value;
  }

  function isInterestDisabled(id: string): boolean {
    return selectedInterests.value.length >= AUTH_MAX_INTEREST_SELECTIONS && !selectedInterests.value.includes(id);
  }

  function validate(): string {
    return validateAuthForm({
      mode: mode.value,
      login: login.value,
      username: username.value,
      email: email.value,
      emailCode: emailCode.value,
      password: password.value,
      inviteCode: inviteCode.value,
      selectedInterests: selectedInterests.value,
      interestSelectionRequired: interestsRequired.value && interestOptions.value.length > 0,
    });
  }

  async function refreshInterestSettings() {
    interestStatus.value = "loading";
    const settings = await loadAuthInterestSettings();
    interestOptions.value = settings.options;
    interestStatus.value = settings.status;
    interestsRequired.value = settings.required;
    if (!settings.options.length) {
      selectedInterests.value = [];
      return;
    }
    const optionIds = new Set(settings.options.map((option) => option.id));
    selectedInterests.value = selectedInterests.value.filter((id) => optionIds.has(id));
  }

  async function submitAuth() {
    const validation = validate();
    errorMessage.value = validation;
    successMessage.value = "";
    if (validation || submitting.value) return;

    submitting.value = true;
    try {
      const user =
        mode.value === "login"
          ? await loginAuth({ login: login.value.trim(), password: password.value })
          : await registerAuth({
              username: username.value.trim(),
              email: email.value.trim() || undefined,
              emailCode: emailCode.value.trim() || undefined,
              password: password.value,
              inviteCode: inviteCode.value.trim() || undefined,
              interests: selectedInterests.value.length ? selectedInterests.value : undefined,
            });
      successMessage.value = AUTH_LOGGED_IN_REFRESH;
      onAuthenticated(user);
    } catch (error) {
      errorMessage.value =
        extractErrorMessage(error, ERROR_AUTH_GENERIC);
    } finally {
      submitting.value = false;
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

  onMounted(() => {
    void refreshInterestSettings();
  });

  onBeforeUnmount(() => {
    stopEmailCodeCooldownTimer();
  });

  return {
    mode,
    login,
    username,
    email,
    emailCode,
    password,
    inviteCode,
    interestOptions,
    interestStatus,
    interestsRequired,
    selectedInterests,
    submitting,
    sendingCode,
    errorMessage,
    successMessage,
    codeMessage,
    primaryLabel,
    note,
    emailCodeHint,
    emailCodeButtonLabel,
    canRequestEmailCode,
    passwordEnterKeyHint,
    loginHasError,
    usernameHasError,
    emailHasError,
    emailCodeHasError,
    passwordHasError,
    inviteCodeHasError,
    hasInterestChoices,
    showInterestSkip,
    interestHint,
    switchMode,
    toggleInterest,
    skipInterestSelection,
    isInterestDisabled,
    refreshInterestSettings,
    submitAuth,
    requestEmailCode,
  };
}
