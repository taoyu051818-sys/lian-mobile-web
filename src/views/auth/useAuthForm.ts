import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchAuthRules, loginAuth, registerAuth, sendEmailCode } from "../../api/auth";
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
      ? `${message} ${remainingSeconds} 秒后可重新发送。`
      : `验证码发送后会进入冷却，请在 ${remainingSeconds} 秒后重试。`;
  }
  return message || "验证码会发送到你的高校邮箱。邀请码注册时可以留空。";
}

export function formatEmailCodeRateLimitMessage(retryAfterSeconds: number | null) {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `发送太频繁，请在 ${retryAfterSeconds} 秒后再试。`;
  }
  return `发送太频繁，请稍后再试。页面会先按 ${AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS} 秒冷却处理。`;
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

  const primaryLabel = computed(() => (mode.value === "login" ? "登录" : "注册并登录"));
  const note = computed(() =>
    mode.value === "login"
      ? "使用邮箱或昵称登录。"
      : "兴趣会帮助初始化首页推荐，可先跳过，之后再调整推荐偏好。",
  );
  const emailCodeHint = computed(
    () => formatEmailCodeHint(codeMessage.value, emailCodeCooldownRemaining.value),
  );
  const emailCodeButtonLabel = computed(() => {
    if (sendingCode.value) return "发送中";
    if (emailCodeCooldownRemaining.value > 0) return `重发 ${emailCodeCooldownRemaining.value}s`;
    return "发送";
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
      return "正在加载首页推荐偏好选项。";
    }
    if (interestStatus.value === "empty") {
      return "当前没有可选兴趣，也可以先完成注册，之后再调整首页推荐偏好。";
    }
    if (interestStatus.value === "unavailable") {
      return "兴趣选项暂时加载失败，也可以先完成注册，之后再调整首页推荐偏好。";
    }
    if (interestsRequired.value) {
      return "选择至少 1 个兴趣，用于初始化首页推荐；之后仍可以再调整。";
    }
    return "兴趣会帮助初始化首页推荐，可先跳过，之后再调整。";
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
      successMessage.value = "已登录，正在刷新个人资料。";
      onAuthenticated(user);
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "登录/注册没有成功，可以稍后再试。";
    } finally {
      submitting.value = false;
    }
  }

  async function requestEmailCode() {
    const targetEmail = email.value.trim();
    errorMessage.value = "";
    if (!targetEmail) {
      errorMessage.value = "请先填写高校邮箱。";
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
        ? `验证码已发送，识别为 ${response.institution}。`
        : "验证码已发送，请查看邮箱。";
    } catch (error) {
      if (error instanceof LianApiError && error.status === 429) {
        const retryAfterSeconds = normalizeCooldownSeconds(error.retryAfterSeconds)
          || AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS;
        startEmailCodeCooldown(retryAfterSeconds);
        errorMessage.value = formatEmailCodeRateLimitMessage(error.retryAfterSeconds);
        codeMessage.value = error.retryAfterSeconds
          ? `当前发送过于频繁，请在 ${retryAfterSeconds} 秒后重新获取验证码。`
          : `如果服务端没有返回具体等待时间，页面会先按 ${AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS} 秒冷却处理。`;
      } else {
        errorMessage.value =
          error instanceof Error ? error.message : "验证码没有发送成功，可以稍后再试。";
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
