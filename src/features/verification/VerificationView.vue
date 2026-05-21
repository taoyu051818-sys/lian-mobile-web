<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LianButton } from "../../ui";
import {
  VERIFICATION_BACK_TO_PROFILE,
  VERIFICATION_CAMPUS_CODE_LABEL,
  VERIFICATION_CAMPUS_CODE_PLACEHOLDER,
  VERIFICATION_CAMPUS_EMAIL_LABEL,
  VERIFICATION_CAMPUS_EMAIL_PLACEHOLDER,
  VERIFICATION_CAMPUS_HINT,
  VERIFICATION_CAMPUS_LOAD_ERROR,
  VERIFICATION_CAMPUS_RESEND,
  VERIFICATION_CAMPUS_SEND_BUTTON,
  VERIFICATION_CAMPUS_SEND_PENDING,
  VERIFICATION_CAMPUS_SUBMIT,
  VERIFICATION_CAMPUS_SUBMITTING,
  VERIFICATION_CAMPUS_TITLE,
  VERIFICATION_EXPIRES_AT_LABEL,
  VERIFICATION_GRANTED_AT_LABEL,
  VERIFICATION_NO_GRANT_HINT,
  VERIFICATION_NO_GRANT_NEXT,
  VERIFICATION_OTHER_PLACEHOLDER,
  VERIFICATION_SECTION_LABEL,
  VERIFICATION_SOURCE_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import { fetchAuthMe } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { ProfileUser } from "../../types/profile";
import type { VerificationState } from "../../types/verification";
import { useCampusEmailVerify } from "./useCampusEmailVerify";
import { formatTimestamp, statusLabelFor, VERIFICATION_DESCRIPTORS } from "./verification-format";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const user = ref<ProfileUser | null>(null);
const loading = ref(false);
const loadError = ref("");

const campus = useCampusEmailVerify({
  onConfirmed: async () => {
    await refreshUser();
  },
});

const verificationState = computed<VerificationState>(() => {
  const raw = (user.value as { verificationState?: VerificationState } | null)?.verificationState;
  return raw && typeof raw === "object" ? raw : {};
});

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    visible: true,
    identity: { avatarText: "认", name: VERIFICATION_SECTION_LABEL },
    buttons: [{ id: "verification:close", label: VERIFICATION_BACK_TO_PROFILE, variant: "ghost" }],
    onButtonClick: (id) => {
      if (id === "verification:close") emit("close");
    },
  },
}));

async function refreshUser() {
  loading.value = true;
  loadError.value = "";
  try {
    user.value = await fetchAuthMe();
    const inst = (user.value as { institution?: string } | null)?.institution || "";
    const seeded = (user.value as { email?: string } | null)?.email || "";
    if (!campus.email.value && (seeded || inst)) {
      campus.email.value = seeded;
    }
  } catch (error) {
    loadError.value = extractErrorMessage(error, VERIFICATION_CAMPUS_LOAD_ERROR);
  } finally {
    loading.value = false;
  }
}

const sendButtonLabel = computed(() => {
  if (campus.sending.value) return VERIFICATION_CAMPUS_SEND_PENDING;
  if (campus.cooldownRemaining.value > 0)
    return `${VERIFICATION_CAMPUS_RESEND} ${campus.cooldownRemaining.value}s`;
  return VERIFICATION_CAMPUS_SEND_BUTTON;
});

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void refreshUser();
});

onBeforeUnmount(() => {
  campus.dispose();
});
</script>

<template>
  <section class="verification-view" :aria-label="VERIFICATION_SECTION_LABEL">
    <p v-if="loadError" class="verification-view__feedback is-error" role="status">
      {{ loadError }}
    </p>

    <header class="verification-view__intro">
      <h2>{{ VERIFICATION_SECTION_LABEL }}</h2>
    </header>

    <ul class="verification-view__list">
      <li
        v-for="descriptor in VERIFICATION_DESCRIPTORS"
        :key="descriptor.tag"
        class="verification-view__item"
      >
        <div class="verification-view__row">
          <span class="verification-view__label">{{ descriptor.label }}</span>
          <span
            class="verification-view__status"
            :class="{
              'is-active': verificationState[descriptor.tag]?.active,
              'is-revoked': verificationState[descriptor.tag]?.revokedAt,
            }"
          >
            {{ statusLabelFor(verificationState[descriptor.tag]) }}
          </span>
        </div>
        <dl v-if="verificationState[descriptor.tag]" class="verification-view__meta">
          <template v-if="verificationState[descriptor.tag]?.grantedAt">
            <dt>{{ VERIFICATION_GRANTED_AT_LABEL }}</dt>
            <dd>{{ formatTimestamp(verificationState[descriptor.tag]?.grantedAt) }}</dd>
          </template>
          <template v-if="verificationState[descriptor.tag]?.expiresAt">
            <dt>{{ VERIFICATION_EXPIRES_AT_LABEL }}</dt>
            <dd>{{ formatTimestamp(verificationState[descriptor.tag]?.expiresAt) }}</dd>
          </template>
          <template v-if="verificationState[descriptor.tag]?.source">
            <dt>{{ VERIFICATION_SOURCE_LABEL }}</dt>
            <dd>{{ verificationState[descriptor.tag]?.source }}</dd>
          </template>
        </dl>
        <p v-else class="verification-view__placeholder" data-testid="verification-empty-grant">
          <span class="verification-view__placeholder-headline">{{
            VERIFICATION_NO_GRANT_HINT
          }}</span>
          <span class="verification-view__placeholder-hint">{{ VERIFICATION_NO_GRANT_NEXT }}</span>
        </p>
      </li>
    </ul>

    <section class="verification-view__campus" aria-labelledby="verification-campus-title">
      <h3 id="verification-campus-title">{{ VERIFICATION_CAMPUS_TITLE }}</h3>
      <p class="verification-view__hint">{{ VERIFICATION_CAMPUS_HINT }}</p>

      <label class="verification-view__field">
        <span>{{ VERIFICATION_CAMPUS_EMAIL_LABEL }}</span>
        <input
          v-model="campus.email.value"
          type="email"
          inputmode="email"
          autocomplete="email"
          spellcheck="false"
          :placeholder="VERIFICATION_CAMPUS_EMAIL_PLACEHOLDER"
          :disabled="campus.submitting.value"
        />
      </label>

      <label class="verification-view__field">
        <span>{{ VERIFICATION_CAMPUS_CODE_LABEL }}</span>
        <div class="verification-view__code-row">
          <input
            v-model="campus.code.value"
            inputmode="numeric"
            autocomplete="one-time-code"
            spellcheck="false"
            maxlength="6"
            :placeholder="VERIFICATION_CAMPUS_CODE_PLACEHOLDER"
            :disabled="campus.submitting.value"
          />
          <button
            type="button"
            class="verification-view__send"
            :disabled="campus.sending.value || campus.cooldownRemaining.value > 0"
            @click="() => void campus.requestCode()"
          >
            {{ sendButtonLabel }}
          </button>
        </div>
      </label>

      <p v-if="campus.errorMessage.value" class="verification-view__feedback is-error" role="alert">
        {{ campus.errorMessage.value }}
      </p>
      <p v-else-if="campus.noticeMessage.value" class="verification-view__feedback" role="status">
        {{ campus.noticeMessage.value }}
      </p>

      <LianButton
        variant="primary"
        :disabled="campus.submitting.value"
        @click="() => void campus.submitCode()"
      >
        {{ campus.submitting.value ? VERIFICATION_CAMPUS_SUBMITTING : VERIFICATION_CAMPUS_SUBMIT }}
      </LianButton>
    </section>

    <p class="verification-view__placeholder verification-view__other">
      {{ VERIFICATION_OTHER_PLACEHOLDER }}
    </p>
  </section>
</template>

<style scoped>
.verification-view {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.verification-view__intro h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.verification-view__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.verification-view__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.verification-view__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.verification-view__label {
  font-size: 15px;
  font-weight: 800;
}

.verification-view__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(120, 120, 120, 0.12);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.verification-view__status.is-active {
  background: rgba(34, 197, 94, 0.16);
  color: rgb(21, 128, 61);
}

.verification-view__status.is-revoked {
  background: rgba(239, 68, 68, 0.16);
  color: rgb(185, 28, 28);
}

.verification-view__meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px var(--space-2);
  margin: 0;
  font-size: 12px;
  color: var(--lian-muted);
}

.verification-view__meta dt {
  font-weight: 700;
}

.verification-view__meta dd {
  margin: 0;
}

.verification-view__placeholder {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.verification-view__placeholder-headline {
  display: block;
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 800;
}

.verification-view__placeholder-hint {
  display: block;
  margin-top: 2px;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.verification-view__campus {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.verification-view__campus h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.verification-view__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.verification-view__field {
  display: grid;
  gap: var(--space-1);
}

.verification-view__field span {
  font-size: 13px;
  font-weight: 800;
}

.verification-view__field input {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  box-sizing: border-box;
}

.verification-view__code-row {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-2);
  align-items: center;
}

.verification-view__code-row input {
  flex: 1;
  min-width: 0;
}

.verification-view__send {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font-weight: 900;
}

.verification-view__send:disabled {
  opacity: 0.62;
}

.verification-view__feedback {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 800;
}

.verification-view__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.verification-view__other {
  text-align: center;
}
</style>
