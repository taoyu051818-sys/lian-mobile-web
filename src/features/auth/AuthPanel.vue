<script setup lang="ts">
import {
  AUTH_PASSWORD_MIN_LENGTH,
} from "../../domain/validation/forms";
import type { ProfileUser } from "../../types/profile";
import { TypeChip } from "../../ui";
import {
  AUTH_PANEL_TITLE, AUTH_ACCOUNT_CHIP,
  AUTH_PASSWORD_LABEL, AUTH_PASSWORD_PLACEHOLDER,
  AUTH_PASSWORD_HINT, AUTH_INVITE_CODE, AUTH_INVITE_CODE_PLACEHOLDER,
  AUTH_INVITE_CODE_HINT,
} from "../../config/brand";
import { useAuthForm } from "./useAuthForm";
import AuthModeTabs from "./AuthModeTabs.vue";
import AuthLoginFields from "./AuthLoginFields.vue";
import AuthRegisterFields from "./AuthRegisterFields.vue";
import AuthSubmitState from "./AuthSubmitState.vue";

const emit = defineEmits<{
  authenticated: [user: ProfileUser | null];
}>();

const {
  mode,
  login,
  username,
  email,
  emailCode,
  password,
  inviteCode,
  interestOptions,
  interestStatus,
  selectedInterests,
  submitting,
  errorMessage,
  successMessage,
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
} = useAuthForm((user) => emit("authenticated", user));

const formErrorId = "auth-form-error";
const loginHintId = "auth-login-hint";
const usernameHintId = "auth-username-hint";
const emailHintId = "auth-email-hint";
const emailCodeHintId = "auth-email-code-hint";
const passwordHintId = "auth-password-hint";
const inviteCodeHintId = "auth-invite-code-hint";
</script>

<template>
  <section class="auth-panel keyboard-aware-surface" aria-labelledby="auth-panel-title">
    <div class="auth-panel__header">
      <div>
        <TypeChip type="official">{{ AUTH_ACCOUNT_CHIP }}</TypeChip>
        <h3 id="auth-panel-title">{{ AUTH_PANEL_TITLE }}</h3>
      </div>
    </div>

    <p>{{ note }}</p>

    <AuthModeTabs :mode="mode" @switch-mode="switchMode" />

    <form class="auth-panel__form keyboard-aware-surface" @submit.prevent="submitAuth">
      <AuthLoginFields
        v-if="mode === 'login'"
        :login="login"
        :has-error="loginHasError"
        :form-error-id="formErrorId"
        :hint-id="loginHintId"
        @update:login="login = $event"
      />

      <AuthRegisterFields
        v-else
        :username="username"
        :email="email"
        :email-code="emailCode"
        :username-has-error="usernameHasError"
        :email-has-error="emailHasError"
        :email-code-has-error="emailCodeHasError"
        :form-error-id="formErrorId"
        :username-hint-id="usernameHintId"
        :email-hint-id="emailHintId"
        :email-code-hint-id="emailCodeHintId"
        :can-request-email-code="canRequestEmailCode"
        :email-code-button-label="emailCodeButtonLabel"
        :email-code-hint="emailCodeHint"
        :interest-options="interestOptions"
        :selected-interests="selectedInterests"
        :interest-status="interestStatus"
        :has-interest-choices="hasInterestChoices"
        :show-interest-skip="showInterestSkip"
        :interest-hint="interestHint"
        :is-interest-disabled="isInterestDisabled"
        @update:username="username = $event"
        @update:email="email = $event"
        @update:email-code="emailCode = $event"
        @request-email-code="requestEmailCode"
        @toggle-interest="toggleInterest"
        @skip-interest-selection="skipInterestSelection"
        @refresh-interest-settings="refreshInterestSettings"
      />

      <label>
        <span>{{ AUTH_PASSWORD_LABEL }}</span>
        <input
          v-model="password"
          type="password"
          required
          :minlength="AUTH_PASSWORD_MIN_LENGTH"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          :enterkeyhint="passwordEnterKeyHint"
          :aria-invalid="passwordHasError"
          :aria-describedby="[passwordHintId, passwordHasError ? formErrorId : null].filter(Boolean).join(' ')"
          :placeholder="AUTH_PASSWORD_PLACEHOLDER.replace('{n}', String(AUTH_PASSWORD_MIN_LENGTH))"
        />
        <small :id="passwordHintId" class="auth-panel__hint">{{ AUTH_PASSWORD_HINT.replace('{n}', String(AUTH_PASSWORD_MIN_LENGTH)) }}</small>
      </label>

      <label v-if="mode === 'register'">
        <span>{{ AUTH_INVITE_CODE }}</span>
        <input
          v-model="inviteCode"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          :aria-invalid="inviteCodeHasError"
          :aria-describedby="[inviteCodeHintId, inviteCodeHasError ? formErrorId : null].filter(Boolean).join(' ')"
          :placeholder="AUTH_INVITE_CODE_PLACEHOLDER"
        />
        <small :id="inviteCodeHintId" class="auth-panel__hint">{{ AUTH_INVITE_CODE_HINT }}</small>
      </label>

      <AuthSubmitState
        :error-message="errorMessage"
        :success-message="successMessage"
        :submitting="submitting"
        :primary-label="primaryLabel"
        :form-error-id="formErrorId"
      />
    </form>
  </section>
</template>

<style scoped>
.auth-panel,
.auth-panel__form {
  display: grid;
  gap: var(--space-4);
}

.auth-panel {
  padding: var(--space-3);
  padding-bottom: calc(var(--space-3) + min(var(--keyboard-inset-bottom), 240px));
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.auth-panel__form {
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.auth-panel__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.auth-panel h3,
.auth-panel p {
  margin: 0;
}

.auth-panel > p,
.auth-panel :deep(label span),
.auth-panel__section-title span,
.auth-panel :deep(.auth-panel__hint) {
  color: var(--lian-muted);
  line-height: 1.6;
}

.auth-panel :deep(label) {
  display: grid;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 800;
}

.auth-panel :deep(.auth-panel__hint) {
  font-size: 12px;
  font-weight: 700;
}

.auth-panel :deep(input) {
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  padding: 0 var(--space-3);
}
</style>
