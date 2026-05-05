<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchAuthRules, loginAuth, registerAuth, sendEmailCode } from "../../api/auth";
import { InlineError, TrustBadge, TypeChip } from "../../ui";
import type { AuthInterestOption, AuthMode } from "../../api/auth";
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
const interestOptions = ref<AuthInterestOption[]>([]);
const selectedInterests = ref<string[]>([]);
const submitting = ref(false);
const sendingCode = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const codeMessage = ref("");

const primaryLabel = computed(() => mode.value === "login" ? "登录" : "注册并登录");
const note = computed(() => mode.value === "login"
  ? "使用邮箱或昵称登录。"
  : "选择兴趣后，会用于首页推荐和第一个马甲。"
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

function validate() {
  if (password.value.length < 8) return "密码至少需要 8 位。";
  if (mode.value === "login") {
    if (!login.value.trim()) return "请填写邮箱或昵称。";
    return "";
  }
  if (!username.value.trim()) return "请填写昵称。";
  if (!email.value.trim() && !inviteCode.value.trim()) return "请填写高校邮箱，或填写邀请码。";
  if (email.value.trim() && !emailCode.value.trim()) return "高校邮箱注册需要填写验证码。";
  if (!selectedInterests.value.length) return "至少选择一个兴趣，用来初始化推荐流。";
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
        interests: selectedInterests.value,
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
  try {
    const rules = await fetchAuthRules();
    interestOptions.value = rules.interests || [];
  } catch {
    interestOptions.value = [];
  }
});
</script>

<template>
  <section class="auth-panel" aria-labelledby="auth-panel-title">
    <div class="auth-panel__header">
      <div>
        <TypeChip type="official">账号</TypeChip>
        <h3 id="auth-panel-title">登录 / 注册</h3>
      </div>
      <TrustBadge tone="pending">Vue canary</TrustBadge>
    </div>

    <p>{{ note }}</p>

    <nav class="auth-panel__tabs" aria-label="认证模式">
      <button type="button" :class="{ 'is-active': mode === 'login' }" @click="switchMode('login')">登录</button>
      <button type="button" :class="{ 'is-active': mode === 'register' }" @click="switchMode('register')">注册</button>
    </nav>

    <form class="auth-panel__form" @submit.prevent="submitAuth">
      <label v-if="mode === 'login'">
        <span>邮箱或昵称</span>
        <input v-model="login" autocomplete="username" placeholder="邮箱或昵称" />
      </label>

      <template v-else>
        <label>
          <span>昵称</span>
          <input v-model="username" maxlength="30" autocomplete="nickname" placeholder="怎么称呼你" />
        </label>
        <label>
          <span>高校邮箱</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="邀请码注册可不填" />
        </label>
        <label>
          <span>邮箱验证码</span>
          <div class="auth-panel__code-row">
            <input v-model="emailCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位验证码" />
            <button type="button" :disabled="sendingCode" @click="requestEmailCode">
              {{ sendingCode ? "发送中" : "发送" }}
            </button>
          </div>
        </label>

        <section v-if="interestOptions.length" class="auth-panel__interests" aria-label="兴趣选择">
          <div class="auth-panel__section-title">
            <strong>兴趣</strong>
            <span>{{ selectedInterests.length }}/5</span>
          </div>
          <div class="auth-panel__interest-grid">
            <button
              v-for="interest in interestOptions"
              :key="interest.id"
              type="button"
              class="auth-panel__interest"
              :class="{ 'is-active': selectedInterests.includes(interest.id) }"
              @click="toggleInterest(interest.id)"
            >
              <strong>{{ interest.label }}</strong>
              <span>{{ interest.description }}</span>
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
          minlength="8"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="至少 8 位"
        />
      </label>

      <label v-if="mode === 'register'">
        <span>邀请码</span>
        <input v-model="inviteCode" autocomplete="off" placeholder="非高校邮箱时填写" />
      </label>

      <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
      <p v-if="codeMessage" class="auth-panel__success">{{ codeMessage }}</p>
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
.auth-panel__section-title {
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
.auth-panel__section-title span {
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

.auth-panel label {
  display: grid;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 800;
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
.auth-panel__submit {
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.auth-panel__code-row button {
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

.auth-panel__submit {
  background: var(--lian-ink);
  color: #fff;
}

.auth-panel__submit:disabled,
.auth-panel__code-row button:disabled {
  opacity: 0.62;
}

.auth-panel__success {
  color: var(--lian-primary);
  font-weight: 850;
}
</style>
