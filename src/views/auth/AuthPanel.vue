<script setup lang="ts">
import {
  AUTH_EMAIL_CODE_LENGTH,
  AUTH_MAX_INTEREST_SELECTIONS,
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_USERNAME_MAX_LENGTH,
} from "../../domain/validation/forms";
import type { ProfileUser } from "../../types/profile";
import { InlineError, TypeChip } from "../../ui";
import { useAuthForm } from "./useAuthForm";

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
  sendingCode,
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
  <section class="auth-panel" aria-labelledby="auth-panel-title">
    <div class="auth-panel__header">
      <div>
        <TypeChip type="official">账号</TypeChip>
        <h3 id="auth-panel-title">登录 / 注册</h3>
      </div>
    </div>

    <p>{{ note }}</p>

    <nav class="auth-panel__tabs" aria-label="认证模式">
      <button type="button" :class="{ 'is-active': mode === 'login' }" @click="switchMode('login')">登录</button>
      <button type="button" :class="{ 'is-active': mode === 'register' }" @click="switchMode('register')">注册</button>
    </nav>

    <form class="auth-panel__form" @submit.prevent="submitAuth">
      <label v-if="mode === 'login'">
        <span>邮箱或昵称</span>
        <input
          v-model="login"
          autocomplete="username"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="next"
          required
          :aria-invalid="loginHasError"
          :aria-describedby="[loginHintId, loginHasError ? formErrorId : null].filter(Boolean).join(' ')"
          placeholder="邮箱或昵称"
        />
        <small :id="loginHintId" class="auth-panel__hint">支持邮箱或昵称登录。</small>
      </label>

      <template v-else>
        <label>
          <span>昵称</span>
          <input
            v-model="username"
            :maxlength="AUTH_USERNAME_MAX_LENGTH"
            autocomplete="nickname"
            autocapitalize="words"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            required
            :aria-invalid="usernameHasError"
            :aria-describedby="[usernameHintId, usernameHasError ? formErrorId : null].filter(Boolean).join(' ')"
            placeholder="怎么称呼你"
          />
          <small :id="usernameHintId" class="auth-panel__hint">这个昵称会用于你的初始身份展示。</small>
        </label>
        <label>
          <span>高校邮箱</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            inputmode="email"
            :aria-invalid="emailHasError"
            :aria-describedby="[emailHintId, emailHasError ? formErrorId : null].filter(Boolean).join(' ')"
            placeholder="邀请码注册可不填"
          />
          <small :id="emailHintId" class="auth-panel__hint">高校邮箱注册需要先获取 {{ AUTH_EMAIL_CODE_LENGTH }} 位验证码；邀请码注册时可以留空。</small>
        </label>
        <label>
          <span>邮箱验证码</span>
          <div class="auth-panel__code-row">
            <input
              v-model="emailCode"
              inputmode="numeric"
              :maxlength="AUTH_EMAIL_CODE_LENGTH"
              pattern="[0-9]*"
              autocomplete="one-time-code"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="next"
              :aria-invalid="emailCodeHasError"
              :aria-describedby="[emailCodeHintId, emailCodeHasError ? formErrorId : null].filter(Boolean).join(' ')"
              :placeholder="`${AUTH_EMAIL_CODE_LENGTH} 位验证码`"
            />
            <button
              type="button"
              :disabled="!canRequestEmailCode"
              :aria-describedby="emailCodeHintId"
              @click="requestEmailCode"
            >
              {{ emailCodeButtonLabel }}
            </button>
          </div>
          <small :id="emailCodeHintId" class="auth-panel__hint" aria-live="polite">{{ emailCodeHint }}</small>
        </label>

        <section class="auth-panel__interests" aria-label="兴趣偏好">
          <div class="auth-panel__section-title">
            <div class="auth-panel__section-copy">
              <strong>兴趣偏好</strong>
              <small class="auth-panel__hint">{{ interestHint }}</small>
            </div>
            <span v-if="hasInterestChoices">{{ selectedInterests.length }}/{{ AUTH_MAX_INTEREST_SELECTIONS }}</span>
          </div>

          <div v-if="hasInterestChoices" class="auth-panel__interest-grid">
            <button
              v-for="interest in interestOptions"
              :key="interest.id"
              type="button"
              class="auth-panel__interest"
              :class="{ 'is-active': selectedInterests.includes(interest.id) }"
              :aria-pressed="selectedInterests.includes(interest.id)"
              :disabled="isInterestDisabled(interest.id)"
              @click="toggleInterest(interest.id)"
            >
              <strong>{{ interest.label }}</strong>
              <span>{{ interest.description }}</span>
            </button>
          </div>

          <div v-else-if="interestStatus === 'unavailable'" class="auth-panel__interest-state">
            <button type="button" class="auth-panel__secondary-action" @click="refreshInterestSettings">
              重新加载兴趣选项
            </button>
          </div>

          <div v-if="showInterestSkip" class="auth-panel__interest-actions">
            <button type="button" class="auth-panel__secondary-action" @click="skipInterestSelection">
              暂时跳过
            </button>
          </div>
        </section>
      </template>

      <label>
        <span>密码</span>
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
          :placeholder="`至少 ${AUTH_PASSWORD_MIN_LENGTH} 位`"
        />
        <small :id="passwordHintId" class="auth-panel__hint">至少 {{ AUTH_PASSWORD_MIN_LENGTH }} 位，支持密码管理器自动填充。</small>
      </label>

      <label v-if="mode === 'register'">
        <span>邀请码</span>
        <input
          v-model="inviteCode"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          :aria-invalid="inviteCodeHasError"
          :aria-describedby="[inviteCodeHintId, inviteCodeHasError ? formErrorId : null].filter(Boolean).join(' ')"
          placeholder="非高校邮箱时填写"
        />
        <small :id="inviteCodeHintId" class="auth-panel__hint">没有高校邮箱时，可以改用邀请码注册。</small>
      </label>

      <InlineError v-if="errorMessage" :id="formErrorId">{{ errorMessage }}</InlineError>
      <p v-if="successMessage" class="auth-panel__success">{{ successMessage }}</p>

      <button class="auth-panel__submit" type="submit" :disabled="submitting">
        {{ submitting ? "处理中…" : primaryLabel }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.auth-panel,
.auth-panel__form,
.auth-panel__interests {
  display: grid;
  gap: var(--space-4);
}

.auth-panel {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.auth-panel__header,
.auth-panel__tabs,
.auth-panel__code-row,
.auth-panel__section-title,
.auth-panel__interest-actions {
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
.auth-panel label span,
.auth-panel__section-title span,
.auth-panel__hint {
  color: var(--lian-muted);
  line-height: 1.6;
}

.auth-panel__tabs {
  justify-content: flex-start;
}

.auth-panel__tabs button,
.auth-panel__interest {
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.auth-panel__tabs button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-chip);
}

.auth-panel__tabs button.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.auth-panel label,
.auth-panel__section-copy {
  display: grid;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 800;
}

.auth-panel__hint {
  font-size: 12px;
  font-weight: 700;
}

.auth-panel input {
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  padding: 0 var(--space-3);
}

.auth-panel__code-row {
  flex-wrap: nowrap;
}

.auth-panel__code-row input {
  flex: 1;
  min-width: 0;
}

.auth-panel__code-row button,
.auth-panel__submit,
.auth-panel__secondary-action {
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.auth-panel__code-row button,
.auth-panel__secondary-action {
  padding: 0 var(--space-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
}

.auth-panel__interest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: var(--space-2);
}

.auth-panel__interest {
  display: grid;
  gap: 4px;
  min-height: 76px;
  padding: var(--space-3);
  border-radius: var(--radius-card);
  text-align: left;
}

.auth-panel__interest strong {
  color: var(--lian-ink);
}

.auth-panel__interest span {
  font-size: 12px;
  line-height: 1.45;
}

.auth-panel__interest.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.14);
  color: var(--lian-ink);
}

.auth-panel__interest:disabled,
.auth-panel__submit:disabled,
.auth-panel__code-row button:disabled {
  opacity: 0.62;
}

.auth-panel__interest-state {
  display: flex;
  justify-content: flex-start;
}

.auth-panel__submit {
  background: var(--lian-ink);
  color: #fff;
}

.auth-panel__success {
  color: var(--lian-primary);
  font-weight: 850;
}
</style>
