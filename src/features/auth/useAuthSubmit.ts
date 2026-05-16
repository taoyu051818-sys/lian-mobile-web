import { computed, ref, type Ref } from "vue";
import { loginAuth, registerAuth } from "../../api/auth";
import {
  ERROR_AUTH_GENERIC,
  AUTH_LOGIN,
  AUTH_REGISTER_AND_LOGIN,
  AUTH_LOGIN_PLACEHOLDER,
  AUTH_INTEREST_SKIP_HINT,
  AUTH_LOGGED_IN_REFRESH,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { AuthInterestOption, AuthMode } from "../../api/auth";
import {
  type AuthValidationFields,
  validateAuthForm as validateSharedAuthForm,
} from "../../domain/validation/forms";
import type { ProfileUser } from "../../types/profile";

export type AuthFormFields = AuthValidationFields;

export const validateAuthForm = validateSharedAuthForm;

export function useAuthSubmit(
  onAuthenticated: (user: ProfileUser | null) => void,
  mode: Ref<AuthMode>,
  login: Ref<string>,
  username: Ref<string>,
  email: Ref<string>,
  emailCode: Ref<string>,
  password: Ref<string>,
  inviteCode: Ref<string>,
  selectedInterests: Ref<string[]>,
  interestsRequired: Ref<boolean>,
  interestOptions: Ref<AuthInterestOption[]>,
) {
  const submitting = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");

  const primaryLabel = computed(() =>
    mode.value === "login" ? AUTH_LOGIN : AUTH_REGISTER_AND_LOGIN,
  );
  const note = computed(() =>
    mode.value === "login" ? AUTH_LOGIN_PLACEHOLDER : AUTH_INTEREST_SKIP_HINT,
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
      errorMessage.value = extractErrorMessage(error, ERROR_AUTH_GENERIC);
    } finally {
      submitting.value = false;
    }
  }

  return {
    submitting,
    errorMessage,
    successMessage,
    primaryLabel,
    note,
    passwordEnterKeyHint,
    loginHasError,
    usernameHasError,
    emailHasError,
    emailCodeHasError,
    passwordHasError,
    inviteCodeHasError,
    switchMode,
    submitAuth,
  };
}
