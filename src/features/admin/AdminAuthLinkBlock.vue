<script setup lang="ts">
import { computed, ref } from "vue";
import { InlineError, LianButton } from "../../ui";
import {
  ADMIN_AUTH_LINK_AUDIENCE_LABEL,
  ADMIN_AUTH_LINK_COPY_SUCCESS,
  ADMIN_AUTH_LINK_COPY_URL,
  ADMIN_AUTH_LINK_CREATE,
  ADMIN_AUTH_LINK_CREATED_AT_LABEL,
  ADMIN_AUTH_LINK_EMPTY_BODY,
  ADMIN_AUTH_LINK_EMPTY_TITLE,
  ADMIN_AUTH_LINK_EXPIRES_AT_LABEL,
  ADMIN_AUTH_LINK_FORM_AUDIENCE_LABEL,
  ADMIN_AUTH_LINK_FORM_AUDIENCE_PLACEHOLDER,
  ADMIN_AUTH_LINK_FORM_CANCEL,
  ADMIN_AUTH_LINK_FORM_GRANT_ROLE_LABEL,
  ADMIN_AUTH_LINK_FORM_GRANT_ROLE_NONE,
  ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_LABEL,
  ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_NONE,
  ADMIN_AUTH_LINK_FORM_MAX_USES_LABEL,
  ADMIN_AUTH_LINK_FORM_SUBMIT,
  ADMIN_AUTH_LINK_FORM_TITLE,
  ADMIN_AUTH_LINK_FORM_TTL_1H,
  ADMIN_AUTH_LINK_FORM_TTL_24H,
  ADMIN_AUTH_LINK_FORM_TTL_30D,
  ADMIN_AUTH_LINK_FORM_TTL_7D,
  ADMIN_AUTH_LINK_FORM_TTL_LABEL,
  ADMIN_AUTH_LINK_GRANT_CAMPUS_VERIFIED,
  ADMIN_AUTH_LINK_GRANT_LABEL,
  ADMIN_AUTH_LINK_GRANT_MERCHANT_VERIFIED,
  ADMIN_AUTH_LINK_GRANT_ORG_MEMBER,
  ADMIN_AUTH_LINK_GRANT_REALNAME_VERIFIED,
  ADMIN_AUTH_LINK_GRANT_RUNNER,
  ADMIN_AUTH_LINK_LIST_LOADING,
  ADMIN_AUTH_LINK_REVOKE,
  ADMIN_AUTH_LINK_REVOKE_CONFIRM,
  ADMIN_AUTH_LINK_STATUS_ACTIVE,
  ADMIN_AUTH_LINK_STATUS_EXHAUSTED,
  ADMIN_AUTH_LINK_STATUS_EXPIRED,
  ADMIN_AUTH_LINK_TOKEN_LABEL,
  ADMIN_AUTH_LINK_USAGE_LABEL,
  ADMIN_QUEUE_RELOAD,
} from "../../config/brand";
import { formatAdminTime } from "./admin-format";
import type { AuthLink, AuthLinkGrantKind } from "../../api/adminAuthLink";
import { buildAuthLinkUrl, getAuthLinkStatus } from "../../api/adminAuthLink";

const props = defineProps<{
  links: AuthLink[];
  loading: boolean;
  errorMessage: string;
  creating: boolean;
  createError: string;
}>();

const emit = defineEmits<{
  reload: [];
  create: [
    payload: {
      audienceLabel: string;
      maxUses: number;
      ttlSeconds: number;
      grant: { roleId?: string; verificationKind?: AuthLinkGrantKind };
    },
  ];
  revoke: [token: string];
  copyUrl: [token: string];
}>();

const showCreateForm = ref(false);
const formAudienceLabel = ref("");
const formMaxUses = ref(10);
const formTtlSeconds = ref(86400);
const formGrantRole = ref("");
const formGrantVerification = ref<AuthLinkGrantKind | "">("");
const copyFeedback = ref("");

const ttlOptions = [
  { value: 3600, label: ADMIN_AUTH_LINK_FORM_TTL_1H },
  { value: 86400, label: ADMIN_AUTH_LINK_FORM_TTL_24H },
  { value: 604800, label: ADMIN_AUTH_LINK_FORM_TTL_7D },
  { value: 2592000, label: ADMIN_AUTH_LINK_FORM_TTL_30D },
];

const verificationOptions: Array<{ value: AuthLinkGrantKind | ""; label: string }> = [
  { value: "", label: ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_NONE },
  { value: "campus_verified", label: ADMIN_AUTH_LINK_GRANT_CAMPUS_VERIFIED },
  { value: "org_member", label: ADMIN_AUTH_LINK_GRANT_ORG_MEMBER },
  { value: "realname_verified", label: ADMIN_AUTH_LINK_GRANT_REALNAME_VERIFIED },
  { value: "merchant_verified", label: ADMIN_AUTH_LINK_GRANT_MERCHANT_VERIFIED },
  { value: "runner", label: ADMIN_AUTH_LINK_GRANT_RUNNER },
];

const statusLabels: Record<string, string> = {
  active: ADMIN_AUTH_LINK_STATUS_ACTIVE,
  expired: ADMIN_AUTH_LINK_STATUS_EXPIRED,
  exhausted: ADMIN_AUTH_LINK_STATUS_EXHAUSTED,
};

const grantKindLabels: Record<AuthLinkGrantKind, string> = {
  campus_verified: ADMIN_AUTH_LINK_GRANT_CAMPUS_VERIFIED,
  org_member: ADMIN_AUTH_LINK_GRANT_ORG_MEMBER,
  realname_verified: ADMIN_AUTH_LINK_GRANT_REALNAME_VERIFIED,
  merchant_verified: ADMIN_AUTH_LINK_GRANT_MERCHANT_VERIFIED,
  runner: ADMIN_AUTH_LINK_GRANT_RUNNER,
};

const isEmpty = computed(() => !props.loading && props.links.length === 0);

function resetForm() {
  formAudienceLabel.value = "";
  formMaxUses.value = 10;
  formTtlSeconds.value = 86400;
  formGrantRole.value = "";
  formGrantVerification.value = "";
}

function openCreateForm() {
  resetForm();
  showCreateForm.value = true;
}

function cancelCreate() {
  showCreateForm.value = false;
}

function submitCreate() {
  const grant: { roleId?: string; verificationKind?: AuthLinkGrantKind } = {};
  if (formGrantRole.value.trim()) grant.roleId = formGrantRole.value.trim();
  if (formGrantVerification.value) grant.verificationKind = formGrantVerification.value;
  emit("create", {
    audienceLabel: formAudienceLabel.value.trim(),
    maxUses: formMaxUses.value,
    ttlSeconds: formTtlSeconds.value,
    grant,
  });
  showCreateForm.value = false;
}

function handleRevoke(link: AuthLink) {
  if (window.confirm(ADMIN_AUTH_LINK_REVOKE_CONFIRM)) {
    emit("revoke", link.token);
  }
}

async function handleCopyUrl(link: AuthLink) {
  const url = buildAuthLinkUrl(link.token);
  try {
    await navigator.clipboard.writeText(url);
    copyFeedback.value = link.token;
    setTimeout(() => {
      if (copyFeedback.value === link.token) copyFeedback.value = "";
    }, 2000);
    emit("copyUrl", link.token);
  } catch {
    // fallback: select text
  }
}

function formatGrant(link: AuthLink): string {
  const parts: string[] = [];
  if (link.grant.roleId) parts.push(link.grant.roleId);
  if (link.grant.verificationKind) {
    parts.push(grantKindLabels[link.grant.verificationKind] || link.grant.verificationKind);
  }
  return parts.join(" + ") || "-";
}

function truncateToken(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}
</script>

<template>
  <section class="admin-auth-link-block">
    <nav class="admin-auth-link-block__actions">
      <LianButton size="sm" variant="primary" @click="openCreateForm">
        {{ ADMIN_AUTH_LINK_CREATE }}
      </LianButton>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">
        {{ ADMIN_QUEUE_RELOAD }}
      </LianButton>
    </nav>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <InlineError v-else-if="createError">{{ createError }}</InlineError>

    <div v-if="loading" class="admin-auth-link-block__state" role="status">
      {{ ADMIN_AUTH_LINK_LIST_LOADING }}
    </div>

    <section
      v-else-if="isEmpty"
      class="admin-auth-link-block__state admin-auth-link-block__state-card"
      data-testid="admin-auth-link-empty"
    >
      <strong>{{ ADMIN_AUTH_LINK_EMPTY_TITLE }}</strong>
      <p>{{ ADMIN_AUTH_LINK_EMPTY_BODY }}</p>
    </section>

    <div v-else class="admin-auth-link-block__items">
      <article
        v-for="link in links"
        :key="link.token"
        class="admin-auth-link-block__item"
        :data-status="getAuthLinkStatus(link)"
      >
        <header class="admin-auth-link-block__header">
          <span class="admin-auth-link-block__token" :title="link.token">
            {{ truncateToken(link.token) }}
          </span>
          <span class="admin-auth-link-block__status">
            {{ statusLabels[getAuthLinkStatus(link)] }}
          </span>
        </header>

        <dl class="admin-auth-link-block__meta">
          <div>
            <dt>{{ ADMIN_AUTH_LINK_TOKEN_LABEL }}</dt>
            <dd class="admin-auth-link-block__token-full">{{ link.token }}</dd>
          </div>
          <div>
            <dt>{{ ADMIN_AUTH_LINK_CREATED_AT_LABEL }}</dt>
            <dd>{{ formatAdminTime(link.createdAt) }}</dd>
          </div>
          <div>
            <dt>{{ ADMIN_AUTH_LINK_EXPIRES_AT_LABEL }}</dt>
            <dd>{{ formatAdminTime(link.expiresAt) }}</dd>
          </div>
          <div>
            <dt>{{ ADMIN_AUTH_LINK_USAGE_LABEL }}</dt>
            <dd>{{ link.usedCount }} / {{ link.maxUses }}</dd>
          </div>
          <div v-if="link.audienceLabel">
            <dt>{{ ADMIN_AUTH_LINK_AUDIENCE_LABEL }}</dt>
            <dd>{{ link.audienceLabel }}</dd>
          </div>
          <div>
            <dt>{{ ADMIN_AUTH_LINK_GRANT_LABEL }}</dt>
            <dd>{{ formatGrant(link) }}</dd>
          </div>
        </dl>

        <div class="admin-auth-link-block__item-actions">
          <LianButton size="sm" variant="ghost" @click="handleCopyUrl(link)">
            {{
              copyFeedback === link.token ? ADMIN_AUTH_LINK_COPY_SUCCESS : ADMIN_AUTH_LINK_COPY_URL
            }}
          </LianButton>
          <LianButton
            v-if="getAuthLinkStatus(link) === 'active'"
            size="sm"
            variant="danger"
            @click="handleRevoke(link)"
          >
            {{ ADMIN_AUTH_LINK_REVOKE }}
          </LianButton>
        </div>
      </article>
    </div>

    <div v-if="showCreateForm" class="admin-auth-link-block__form-overlay">
      <form class="admin-auth-link-block__form" @submit.prevent="submitCreate">
        <h3>{{ ADMIN_AUTH_LINK_FORM_TITLE }}</h3>

        <label class="admin-auth-link-block__field">
          <span>{{ ADMIN_AUTH_LINK_FORM_AUDIENCE_LABEL }}</span>
          <input
            v-model="formAudienceLabel"
            type="text"
            maxlength="80"
            :placeholder="ADMIN_AUTH_LINK_FORM_AUDIENCE_PLACEHOLDER"
          />
        </label>

        <label class="admin-auth-link-block__field">
          <span>{{ ADMIN_AUTH_LINK_FORM_MAX_USES_LABEL }}</span>
          <input v-model.number="formMaxUses" type="number" min="1" max="1000" />
        </label>

        <label class="admin-auth-link-block__field">
          <span>{{ ADMIN_AUTH_LINK_FORM_TTL_LABEL }}</span>
          <select v-model.number="formTtlSeconds">
            <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="admin-auth-link-block__field">
          <span>{{ ADMIN_AUTH_LINK_FORM_GRANT_ROLE_LABEL }}</span>
          <input
            v-model="formGrantRole"
            type="text"
            :placeholder="ADMIN_AUTH_LINK_FORM_GRANT_ROLE_NONE"
          />
        </label>

        <label class="admin-auth-link-block__field">
          <span>{{ ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_LABEL }}</span>
          <select v-model="formGrantVerification">
            <option v-for="opt in verificationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <div class="admin-auth-link-block__form-actions">
          <LianButton type="button" size="sm" variant="ghost" @click="cancelCreate">
            {{ ADMIN_AUTH_LINK_FORM_CANCEL }}
          </LianButton>
          <LianButton type="submit" size="sm" variant="primary" :disabled="creating">
            {{ ADMIN_AUTH_LINK_FORM_SUBMIT }}
          </LianButton>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.admin-auth-link-block {
  display: grid;
  gap: var(--space-3);
}

.admin-auth-link-block__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-auth-link-block__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-auth-link-block__state-card {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
}

.admin-auth-link-block__state-card strong {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.admin-auth-link-block__state-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.admin-auth-link-block__items {
  display: grid;
  gap: var(--space-3);
}

.admin-auth-link-block__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-auth-link-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-auth-link-block__token {
  font-family: monospace;
  font-size: 13px;
  font-weight: 900;
  color: var(--lian-ink);
}

.admin-auth-link-block__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.admin-auth-link-block__item[data-status="expired"] .admin-auth-link-block__status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-auth-link-block__item[data-status="exhausted"] .admin-auth-link-block__status {
  background: rgba(234, 179, 8, 0.18);
  color: rgb(161, 98, 7);
}

.admin-auth-link-block__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-auth-link-block__meta div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.admin-auth-link-block__meta dt {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-auth-link-block__meta dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.admin-auth-link-block__token-full {
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

.admin-auth-link-block__item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.admin-auth-link-block__form-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.4);
}

.admin-auth-link-block__form {
  display: grid;
  gap: var(--space-3);
  width: 100%;
  max-width: 400px;
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-auth-link-block__form h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--lian-ink);
}

.admin-auth-link-block__field {
  display: grid;
  gap: var(--space-1);
}

.admin-auth-link-block__field span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
}

.admin-auth-link-block__field input,
.admin-auth-link-block__field select {
  width: 100%;
  min-height: 40px;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.admin-auth-link-block__form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
