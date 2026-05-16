<script setup lang="ts">
import {
  AUTH_USERNAME_MAX_LENGTH,
  AUTH_EMAIL_CODE_LENGTH,
} from "../../domain/validation/forms";
import {
  AUTH_NICKNAME, AUTH_NICKNAME_PLACEHOLDER, AUTH_NICKNAME_HINT,
  AUTH_EMAIL_LABEL, AUTH_EMAIL_PLACEHOLDER, AUTH_EMAIL_HINT_FULL,
} from "../../config/brand";
import AuthEmailCodeField from "./AuthEmailCodeField.vue";
import AuthInterestPicker from "./AuthInterestPicker.vue";
import type { AuthInterestOption } from "../../api/auth";
import type { AuthInterestStatus } from "./useAuthForm";

defineProps<{
  username: string;
  email: string;
  emailCode: string;
  usernameHasError: boolean;
  emailHasError: boolean;
  emailCodeHasError: boolean;
  formErrorId: string;
  usernameHintId: string;
  emailHintId: string;
  emailCodeHintId: string;
  canRequestEmailCode: boolean;
  emailCodeButtonLabel: string;
  emailCodeHint: string;
  interestOptions: AuthInterestOption[];
  selectedInterests: string[];
  interestStatus: AuthInterestStatus;
  hasInterestChoices: boolean;
  showInterestSkip: boolean;
  interestHint: string;
  isInterestDisabled: (id: string) => boolean;
}>();

defineEmits<{
  "update:username": [value: string];
  "update:email": [value: string];
  "update:emailCode": [value: string];
  requestEmailCode: [];
  toggleInterest: [id: string];
  skipInterestSelection: [];
  refreshInterestSettings: [];
}>();
</script>

<template>
  <label>
    <span>{{ AUTH_NICKNAME }}</span>
    <input
      :value="username"
      :maxlength="AUTH_USERNAME_MAX_LENGTH"
      autocomplete="nickname"
      autocapitalize="words"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="next"
      required
      :aria-invalid="usernameHasError"
      :aria-describedby="[usernameHintId, usernameHasError ? formErrorId : null].filter(Boolean).join(' ')"
      :placeholder="AUTH_NICKNAME_PLACEHOLDER"
      @input="$emit('update:username', ($event.target as HTMLInputElement).value)"
    />
    <small :id="usernameHintId" class="auth-panel__hint">{{ AUTH_NICKNAME_HINT }}</small>
  </label>
  <label>
    <span>{{ AUTH_EMAIL_LABEL }}</span>
    <input
      :value="email"
      type="email"
      autocomplete="email"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="next"
      inputmode="email"
      :aria-invalid="emailHasError"
      :aria-describedby="[emailHintId, emailHasError ? formErrorId : null].filter(Boolean).join(' ')"
      :placeholder="AUTH_EMAIL_PLACEHOLDER"
      @input="$emit('update:email', ($event.target as HTMLInputElement).value)"
    />
    <small :id="emailHintId" class="auth-panel__hint">{{ AUTH_EMAIL_HINT_FULL.replace('{n}', String(AUTH_EMAIL_CODE_LENGTH)) }}</small>
  </label>
  <AuthEmailCodeField
    :model-value="emailCode"
    :can-request="canRequestEmailCode"
    :button-label="emailCodeButtonLabel"
    :hint="emailCodeHint"
    :has-error="emailCodeHasError"
    :form-error-id="formErrorId"
    :hint-id="emailCodeHintId"
    @update:model-value="$emit('update:emailCode', $event)"
    @request-code="$emit('requestEmailCode')"
  />
  <AuthInterestPicker
    :options="interestOptions"
    :selected="selectedInterests"
    :status="interestStatus"
    :has-choices="hasInterestChoices"
    :show-skip="showInterestSkip"
    :hint="interestHint"
    :is-disabled="isInterestDisabled"
    @toggle="$emit('toggleInterest', $event)"
    @skip="$emit('skipInterestSelection')"
    @refresh="$emit('refreshInterestSettings')"
  />
</template>
