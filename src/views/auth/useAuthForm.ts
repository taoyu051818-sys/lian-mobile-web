import { computed, onMounted, ref } from "vue";
import { fetchAuthRules, loginAuth, registerAuth, sendEmailCode } from "../../api/auth";
import type { AuthInterestOption, AuthMode } from "../../api/auth";
import type { ProfileUser } from "../../types/profile";

export interface AuthFormFields {
  mode: AuthMode;
  login: string;
  username: string;
  email: string;
  emailCode: string;
  password: string;
  inviteCode: string;
  selectedInterests: string[];
}

export function validateAuthForm(fields: AuthFormFields): string {
  if (fields.password.length < 8) return "密码至少需要 8 位。";
  if (fields.mode === "login") {
    if (!fields.login.trim()) return "请填写邮箱或昵称。";
    return "";
  }
  if (!fields.username.trim()) return "请填写昵称。";
  if (!fields.email.trim() && !fields.inviteCode.trim())
    return "请填写高校邮箱，或填写邀请码。";
  if (fields.email.trim() && !fields.emailCode.trim())
    return "高校邮箱注册需要填写验证码。";
  if (!fields.selectedInterests.length)
    return "至少选择一个兴趣，用来初始化推荐流。";
  return "";
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
  const selectedInterests = ref<string[]>([]);
  const submitting = ref(false);
  const sendingCode = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const codeMessage = ref("");

  const primaryLabel = computed(() => (mode.value === "login" ? "登录" : "注册并登录"));
  const note = computed(() =>
    mode.value === "login"
      ? "使用邮箱或昵称登录。"
      : "选择兴趣后，会用于首页推荐和第一个马甲。",
  );
  const emailCodeHint = computed(
    () => codeMessage.value || "验证码会发送到你的高校邮箱。邀请码注册时可以留空。",
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

  function switchMode(nextMode: AuthMode) {
    mode.value = nextMode;
    errorMessage.value = "";
    successMessage.value = "";
    codeMessage.value = "";
  }

  function toggleInterest(id: string) {
    if (selectedInterests.value.includes(id)) {
      selectedInterests.value = selectedInterests.value.filter((item) => item !== id);
      return;
    }
    if (selectedInterests.value.length >= 5) return;
    selectedInterests.value = [...selectedInterests.value, id];
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
    });
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
              interests: selectedInterests.value,
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
    codeMessage.value = "";
    errorMessage.value = "";
    if (!targetEmail) {
      errorMessage.value = "请先填写高校邮箱。";
      return;
    }

    sendingCode.value = true;
    try {
      const response = await sendEmailCode(targetEmail);
      codeMessage.value = response.institution
        ? `验证码已发送，识别为 ${response.institution}。`
        : "验证码已发送，请查看邮箱。";
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "验证码没有发送成功，可以稍后再试。";
    } finally {
      sendingCode.value = false;
    }
  }

  onMounted(async () => {
    try {
      const rules = await fetchAuthRules();
      interestOptions.value = rules.interests || [];
    } catch {
      interestOptions.value = [];
    }
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
    selectedInterests,
    submitting,
    sendingCode,
    errorMessage,
    successMessage,
    codeMessage,
    primaryLabel,
    note,
    emailCodeHint,
    passwordEnterKeyHint,
    loginHasError,
    usernameHasError,
    emailHasError,
    emailCodeHasError,
    passwordHasError,
    inviteCodeHasError,
    switchMode,
    toggleInterest,
    submitAuth,
    requestEmailCode,
  };
}
