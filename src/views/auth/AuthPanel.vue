<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  AUTH_ONBOARDING_INTEREST_LIMIT,
  createLoadingAuthInterestSelectionState,
  loadAuthInterestSelectionState,
  loginAuth,
  registerAuth,
  sendEmailCode,
  toggleAuthInterestSelection,
} from "../../api/auth";
import { InlineError, TypeChip } from "../../ui";
import type { AuthInterestSelectionState, AuthMode } from "../../api/auth";
import type { ProfileUser } from "../../types/profile";

const emit = defineEmits<{
  authenticated: [user: ProfileUser | null];
}>();

const mode = ref<AuthMode>("login");
const login = ref("");
const username = ref("");
const email = ref("");
const emailCode = ref("");
const password = ref("");
const inviteCode = ref("");
const interestState = ref<AuthInterestSelectionState>(createLoadingAuthInterestSelectionState());
const selectedInterests = ref<string[]>([]);
const skippedInterests = ref(false);
const submitting = ref(false);
const sendingCode = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const codeMessage = ref("");

const formErrorId = "auth-form-error";
const loginHintId = "auth-login-hint";
const usernameHintId = "auth-username-hint";
const emailHintId = "auth-email-hint";
const emailCodeHintId = "auth-email-code-hint";
const passwordHintId = "auth-password-hint";
const inviteCodeHintId = "auth-invite-code-hint";
const interestHintId = "auth-interest-hint";

const primaryLabel = computed(() => mode.value === "login" ? "登录" : "注册并登录");
const note = computed(() => mode.value === "login"
  ? "使用邮箱或昵称登录。"
  : "选择兴趣可帮助初始化首页推荐。可稍后再设置，不会直接绑定到身份展示。"
);
const emailCodeHint = computed(() => codeMessage.value || "验证码会发送到你的高校邮箱。邀请码注册时可以留空。");
const passwordEnterKeyHint = computed(() => mode.value === "login" ? "go" : "next");
const loginHasError = computed(() => mode.value === "login" && errorMessage.value.includes("邮箱或昵称"));
const usernameHasError = computed(() => mode.value === "register" && errorMessage.value.includes("昵称"));
const emailHasError = computed(() => mode.value === "register" && errorMessage.value.includes("高校邮箱"));
const emailCodeHasError = computed(() => mode.value === "register" && errorMessage.value.includes("验证码"));
const passwordHasError = computed(() => errorMessage.value.includes("密码至少"));
const inviteCodeHasError = computed(() => mode.value === "register" && errorMessage.value.includes("邀请码"));
const interestsAreSelectable = computed(() => interestState.value.availability === "ready" && interestState.value.options.length > 0);
const interestCountLabel = computed(() => `${selectedInterests.value.length}/${AUTH_ONBOARDING_INTEREST_LIMIT}`);
const interestHint = computed(() => {
  if (skippedInterests.value) {
    return "你已选择稍后再设置兴趣偏好，注册后也可以在后续流程里补充。";
  }
  return interestState.value.helperText;
});

function switchMode(nextMode: AuthMode) {
  mode.value = nextMode;
  errorMessage.value = "";
  successMessage.value = "";
  codeMessage.value = "";
}

function toggleInterest(id: string) {
  skippedInterests.value = false;
  selectedInterests.value = toggleAuthInterestSelection(selectedInterests.value, id);
}

function skipInterestsForNow() {
  skippedInterests.value = true;
  selectedInterests.value = [];
  if (errorMessage.value.includes("兴趣")) {
    errorMessage.value = "";
  }
}

function validate() {
  if (password.value.length < 8) return "密码至少需要 8 位。";
  if (selectedInterests.value.length > AUTH_ONBOARDING_INTEREST_LIMIT) {
    return `最多选择 ${AUTH_ONBOARDING_INTEREST_LIMIT} 个兴趣。`;
  }
  if (mode.value === "login") {
    if (!login.value.trim()) return "请填写邮箱或昵称。";
    return "";
  }
  if (!username.value.trim()) return "请填写昵称。";
  if (!email.value.trim() && !inviteCode.value.trim()) return "请填写高校邮箱，或填写邀请码。";
  if (email.value.trim() && !emailCode.value.trim()) return "高校邮箱注册需要填写验证码。";
  return "";
}

async function submitAuth() {
  const validation = validate();
  errorMessage.value = validation;
  successMessage.value = "";
  if (validation || submitting.value) return;

  submitting.value = true;
  try {
    const user = mode.value === "login"
      ? await loginAuth({ login: login.value.trim(), password: password.value })
      : await registerAuth({
        username: username.value.trim(),
        email: email.value.trim() || undefined,
        emailCode: emailCode.value.trim() || undefined,
        password: password.value,
        inviteCode: inviteCode.value.trim() || undefined,
        interests: selectedInterests.value.length ? selectedInterests.value : [],
      });
    successMessage.value = "已登录，正在刷新个人资料。";
    emit("authenticated", user);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "登录/注册没有成功，可以稍后再试。";
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
    errorMessage.value = error instanceof Error ? error.message : "验证码没有发送成功，可以稍后再试。";
  } finally {
    sendingCode.value = false;
  }
}

onMounted(async () => {
  interestState.value = await loadAuthInterestSelectionState();
});
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
            maxlength="30"
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
          <small :id="emailHintId" class="auth-panel__hint">高校邮箱注册需要先获取 6 位验证码；邀请码注册时可以留空。</small>
        </label>
        <label>
          <span>邮箱验证码</span>
          <div class="auth-panel__code-row">
            <input
              v-model="emailCode"
              inputmode="numeric"
              maxlength="6"
              pattern="[0-9]*"
              autocomplete="one-time-code"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="next"
              :aria-invalid="emailCodeHasError"
              :aria-describedby="[emailCodeHintId, emailCodeHasError ? formErrorId : null].filter(Boolean).join(' ')"
              placeholder="6 位验证码"
            />
            <button
              type="button"
              :disabled="sendingCode"
              :aria-describedby="emailCodeHintId"
              @click="requestEmailCode"
            >
              {{ sendingCode ? "发送中" : "发送" }}
            </button>
          </div>
          <small :id="emailCodeHintId" class="auth-panel__hint" aria-live="polite">{{ emailCodeHint }}</small>
        </label>

        <section class="auth-panel__interests" aria-labelledby="auth-interest-title">
          <div class="auth-panel__section-title auth-panel__section-title--stacked">
            <div>
              <strong id="auth-interest-title">兴趣偏好</strong>
              <p :id="interestHintId" class="auth-panel__interest-copy" aria-live="polite">{{ interestHint }}</p>
            </div>
            <span v-if="interestsAreSelectable">{{ interestCountLabel }}</span>
          </div>

          <div v-if="interestsAreSelectable" class="auth-panel__interest-grid">
            <button
              v-for="interest in interestState.options"
              :key="interest.id"
              type="button"
              class="auth-panel__interest"
              :class="{
                'is-active': selectedInterests.includes(interest.id),
                'is-disabled': !selectedInterests.includes(interest.id) && selectedInterests.length >= AUTH_ONBOARDING_INTEREST_LIMIT,
              }"
              :aria-pressed="selectedInterests.includes(interest.id)"
              :aria-describedby="interestHintId"
              :disabled="!selectedInterests.includes(interest.id) && selectedInterests.length >= AUTH_ONBOARDING_INTEREST_LIMIT"
              @click="toggleInterest(interest.id)"
            >
              <strong>{{ interest.label }}</strong>
              <span>{{ interest.description }}</span>
            </button>
          </div>
          <p v-else class="auth-panel__interest-status">{{ interestHint }}</p>

          <div class="auth-panel__interest-actions">
            <button type="button" class="auth-panel__skip" @click="skipInterestsForNow">跳过，稍后设置</button>
            <span v-if="skippedInterests" class="auth-panel__skip-note">当前会先以空兴趣偏好完成注册。</span>
          </div>
        </section>
      </template>

      <label>
        <span>密码</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="8"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          :enterkeyhint="passwordEnterKeyHint"
          :aria-invalid="passwordHasError"
          :aria-describedby="[passwordHintId, passwordHasError ? formErrorId : null].filter(Boolean).join(' ')"
          placeholder="至少 8 位"
        />
        <small :id="passwordHintId" class="auth-panel__hint">至少 8 位，支持密码管理器自动填充。</small>
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
.auth-panel__hint,
.auth-panel__interest-copy,
.auth-panel__interest-status,
.auth-panel__skip-note {
  color: var(--lian-muted);
  line-height: 1.6;
}

.auth-panel__tabs {
  justify-content: flex-start;
}

.auth-panel__tabs button,
.auth-panel__interest,
.auth-panel__skip {
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

.auth-panel label {
  display: grid;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 800;
}

.auth-panel__hint,
.auth-panel__interest-copy,
.auth-panel__interest-status,
.auth-panel__skip-note {
  font-size: 12px;
  font-weight: 700;
}

.auth-panel__interest-copy,
.auth-panel__interest-status {
  margin-top: 4px;
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
.auth-panel__skip {
  min-height: 44px;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.auth-panel__code-row button,
.auth-panel__skip {
  padding: 0 var(--space-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
}

.auth-panel__code-row button,
.auth-panel__skip,
.auth-panel__submit {
  border: 0;
}

.auth-panel__section-title--stacked {
  align-items: flex-start;
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

.auth-panel__interest.is-disabled {
  opacity: 0.6;
}

.auth-panel__submit {
  background: var(--lian-ink);
  color: #fff;
}

.auth-panel__submit:disabled,
.auth-panel__code-row button:disabled,
.auth-panel__interest:disabled {
  opacity: 0.62;
}

.auth-panel__success {
  color: var(--lian-primary);
  font-weight: 850;
}
</style>
