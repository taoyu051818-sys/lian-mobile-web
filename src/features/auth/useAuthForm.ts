import { ref } from "vue";
import type { AuthMode } from "../../api/auth";
import type { ProfileUser } from "../../types/profile";

export {
  AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS,
  formatEmailCodeHint,
  formatEmailCodeRateLimitMessage,
} from "./useEmailCodeCooldown";

export {
  type AuthInterestStatus,
  type AuthInterestSettings,
  toggleSelectedInterest,
  loadAuthInterestSettings,
} from "./useAuthInterests";

export {
  type AuthFormFields,
  validateAuthForm,
} from "./useAuthSubmit";

import { useEmailCodeCooldown } from "./useEmailCodeCooldown";
import { useAuthInterests } from "./useAuthInterests";
import { useAuthSubmit } from "./useAuthSubmit";

export function useAuthForm(onAuthenticated: (user: ProfileUser | null) => void) {
  const mode = ref<AuthMode>("login");
  const login = ref("");
  const username = ref("");
  const email = ref("");
  const emailCode = ref("");
  const password = ref("");
  const inviteCode = ref("");

  const interests = useAuthInterests(mode);

  const submit = useAuthSubmit(
    onAuthenticated,
    mode,
    login,
    username,
    email,
    emailCode,
    password,
    inviteCode,
    interests.selectedInterests,
    interests.interestsRequired,
    interests.interestOptions,
  );

  const emailCodeCooldown = useEmailCodeCooldown(email, submit.errorMessage);

  function toggleInterest(id: string) {
    interests.toggleInterest(id);
    if (interests.selectedInterests.value.length) {
      submit.errorMessage.value = submit.errorMessage.value.includes("兴趣") ? "" : submit.errorMessage.value;
    }
  }

  function skipInterestSelection() {
    interests.skipInterestSelection();
    submit.errorMessage.value = submit.errorMessage.value.includes("兴趣") ? "" : submit.errorMessage.value;
  }

  return {
    mode,
    login,
    username,
    email,
    emailCode,
    password,
    inviteCode,
    interestOptions: interests.interestOptions,
    interestStatus: interests.interestStatus,
    interestsRequired: interests.interestsRequired,
    selectedInterests: interests.selectedInterests,
    submitting: submit.submitting,
    sendingCode: emailCodeCooldown.sendingCode,
    errorMessage: submit.errorMessage,
    successMessage: submit.successMessage,
    codeMessage: emailCodeCooldown.codeMessage,
    primaryLabel: submit.primaryLabel,
    note: submit.note,
    emailCodeHint: emailCodeCooldown.emailCodeHint,
    emailCodeButtonLabel: emailCodeCooldown.emailCodeButtonLabel,
    canRequestEmailCode: emailCodeCooldown.canRequestEmailCode,
    passwordEnterKeyHint: submit.passwordEnterKeyHint,
    loginHasError: submit.loginHasError,
    usernameHasError: submit.usernameHasError,
    emailHasError: submit.emailHasError,
    emailCodeHasError: submit.emailCodeHasError,
    passwordHasError: submit.passwordHasError,
    inviteCodeHasError: submit.inviteCodeHasError,
    hasInterestChoices: interests.hasInterestChoices,
    showInterestSkip: interests.showInterestSkip,
    interestHint: interests.interestHint,
    switchMode: submit.switchMode,
    toggleInterest,
    skipInterestSelection,
    isInterestDisabled: interests.isInterestDisabled,
    refreshInterestSettings: interests.refreshInterestSettings,
    submitAuth: submit.submitAuth,
    requestEmailCode: emailCodeCooldown.requestEmailCode,
  };
}
