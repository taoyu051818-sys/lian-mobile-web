<script setup lang="ts">
import { ref } from "vue";
import {
  ADMIN_QUEUE_RELOAD,
  ADMIN_VERIFICATION_APPROVE,
  ADMIN_VERIFICATION_FILTER_ALL,
  ADMIN_VERIFICATION_FILTER_APPROVED,
  ADMIN_VERIFICATION_FILTER_PENDING,
  ADMIN_VERIFICATION_FILTER_REJECTED,
  ADMIN_VERIFICATION_NOTE_LABEL,
  ADMIN_VERIFICATION_NOTE_PLACEHOLDER,
  ADMIN_VERIFICATION_QUEUE_EMPTY,
  ADMIN_VERIFICATION_QUEUE_LOADING,
  ADMIN_VERIFICATION_REDACTED_HINT,
  ADMIN_VERIFICATION_REJECT,
  ADMIN_VERIFICATION_REVEAL,
  ADMIN_VERIFICATION_REVEAL_LOADING,
} from "../../config/brand";
import { InlineError, LianButton } from "../../ui";
import type {
  AdminRealnameVerificationReveal,
  AdminVerificationDecisionStatus,
  AdminVerificationRecord,
  AdminVerificationStatus,
  AdminVerificationType,
} from "../../types/admin";
import { formatAdminTime } from "./admin-format";

const props = defineProps<{
  requests: AdminVerificationRecord[];
  loading: boolean;
  errorMessage: string;
  statusFilter: AdminVerificationStatus | "";
  revealedRealnames: Record<string, AdminRealnameVerificationReveal | undefined>;
  revealLoadingIds: Record<string, boolean>;
}>();

const emit = defineEmits<{
  filterChange: [value: AdminVerificationStatus | ""];
  reload: [];
  review: [
    request: AdminVerificationRecord,
    payload: {
      status: AdminVerificationDecisionStatus;
      reviewerNote?: string | null;
    },
  ];
  reveal: [verificationId: string];
}>();

const TYPE_LABELS: Record<AdminVerificationType, string> = {
  "org-join": "组织成员",
  realname: "实名认证",
  merchant: "商家认证",
  runner: "跑腿认证",
};

const STATUS_LABELS: Record<AdminVerificationStatus | "", string> = {
  "": ADMIN_VERIFICATION_FILTER_ALL,
  pending: ADMIN_VERIFICATION_FILTER_PENDING,
  approved: ADMIN_VERIFICATION_FILTER_APPROVED,
  rejected: ADMIN_VERIFICATION_FILTER_REJECTED,
};

const SUMMARY_LABELS: Record<string, string> = {
  orgId: "组织 ID",
  orgName: "组织名称",
  note: "备注",
  idType: "证件类型",
  realName: "姓名",
  idNumber: "证件号",
  contact: "联系方式",
  merchantName: "商家名称",
};

const filters: Array<{ value: AdminVerificationStatus | ""; label: string }> = [
  { value: "", label: ADMIN_VERIFICATION_FILTER_ALL },
  { value: "pending", label: ADMIN_VERIFICATION_FILTER_PENDING },
  { value: "approved", label: ADMIN_VERIFICATION_FILTER_APPROVED },
  { value: "rejected", label: ADMIN_VERIFICATION_FILTER_REJECTED },
];

const noteDrafts = ref<Record<string, string>>({});

function typeLabel(type: AdminVerificationType): string {
  return TYPE_LABELS[type] || type;
}

function formatSummaryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function summaryEntries(request: AdminVerificationRecord) {
  return Object.entries(request.publicSummary || {})
    .filter(([, value]) => value !== null && value !== undefined && String(value) !== "")
    .map(([key, value]) => ({
      key,
      label: SUMMARY_LABELS[key] || key,
      value: formatSummaryValue(value),
    }));
}

function revealEntries(detail: AdminRealnameVerificationReveal | undefined) {
  if (!detail) return [];
  return [
    { key: "realName", label: SUMMARY_LABELS.realName, value: detail.realName },
    { key: "idType", label: SUMMARY_LABELS.idType, value: detail.idType },
    { key: "idNumber", label: SUMMARY_LABELS.idNumber, value: detail.idNumber },
    { key: "contact", label: SUMMARY_LABELS.contact, value: detail.contact },
  ];
}

function submitReview(request: AdminVerificationRecord, status: AdminVerificationDecisionStatus) {
  emit("review", request, {
    status,
    reviewerNote: noteDrafts.value[request.verificationId]?.trim() || null,
  });
}
</script>

<template>
  <section class="admin-verification-list" data-testid="admin-verification-list">
    <nav class="admin-verification-list__filters" aria-label="认证审核状态筛选">
      <button
        v-for="option in filters"
        :key="option.value || 'all'"
        type="button"
        class="admin-verification-list__filter"
        :class="{ 'is-active': option.value === statusFilter }"
        :aria-pressed="option.value === statusFilter"
        @click="emit('filterChange', option.value)"
      >
        {{ option.label }}
      </button>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">{{ ADMIN_QUEUE_RELOAD }}</LianButton>
    </nav>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>

    <div v-if="loading" class="admin-verification-list__state" role="status">
      {{ ADMIN_VERIFICATION_QUEUE_LOADING }}
    </div>

    <p v-else-if="!requests.length" class="admin-verification-list__state">
      {{ ADMIN_VERIFICATION_QUEUE_EMPTY }}
    </p>

    <div v-else class="admin-verification-list__items">
      <article
        v-for="request in requests"
        :key="request.verificationId"
        class="admin-verification-list__item"
        :data-status="request.status"
      >
        <header class="admin-verification-list__header">
          <div>
            <p class="admin-verification-list__type">{{ typeLabel(request.verificationType) }}</p>
            <p class="admin-verification-list__id">{{ request.verificationId }}</p>
          </div>
          <span class="admin-verification-list__status">
            {{ STATUS_LABELS[request.status] || request.status }}
          </span>
        </header>

        <dl class="admin-verification-list__meta">
          <div>
            <dt>用户 ID</dt>
            <dd>{{ request.userId }}</dd>
          </div>
          <div>
            <dt>提交时间</dt>
            <dd>{{ formatAdminTime(request.createdAt) }}</dd>
          </div>
          <div v-if="request.reviewedAt">
            <dt>处理时间</dt>
            <dd>{{ formatAdminTime(request.reviewedAt) }}</dd>
          </div>
          <div v-if="request.reviewerId">
            <dt>审核人</dt>
            <dd>{{ request.reviewerId }}</dd>
          </div>
        </dl>

        <dl v-if="summaryEntries(request).length" class="admin-verification-list__summary">
          <div v-for="entry in summaryEntries(request)" :key="entry.key">
            <dt>{{ entry.label }}</dt>
            <dd>{{ entry.value }}</dd>
          </div>
        </dl>

        <section
          v-if="request.verificationType === 'realname'"
          class="admin-verification-list__reveal"
        >
          <p class="admin-verification-list__hint">{{ ADMIN_VERIFICATION_REDACTED_HINT }}</p>
          <LianButton
            size="sm"
            variant="ghost"
            data-testid="admin-realname-reveal"
            @click="emit('reveal', request.verificationId)"
          >
            {{ ADMIN_VERIFICATION_REVEAL }}
          </LianButton>
          <div
            v-if="props.revealLoadingIds[request.verificationId]"
            class="admin-verification-list__reveal-state"
            role="status"
          >
            {{ ADMIN_VERIFICATION_REVEAL_LOADING }}
          </div>
          <dl
            v-else-if="props.revealedRealnames[request.verificationId]"
            class="admin-verification-list__reveal-summary"
          >
            <div
              v-for="entry in revealEntries(props.revealedRealnames[request.verificationId])"
              :key="entry.key"
            >
              <dt>{{ entry.label }}</dt>
              <dd>{{ entry.value }}</dd>
            </div>
          </dl>
        </section>

        <p v-if="request.reviewerNote" class="admin-verification-list__reviewer-note">
          审核备注：{{ request.reviewerNote }}
        </p>

        <template v-if="request.status === 'pending'">
          <label class="admin-verification-list__note">
            <span>{{ ADMIN_VERIFICATION_NOTE_LABEL }}</span>
            <textarea
              v-model="noteDrafts[request.verificationId]"
              rows="2"
              maxlength="240"
              :placeholder="ADMIN_VERIFICATION_NOTE_PLACEHOLDER"
            ></textarea>
          </label>

          <div class="admin-verification-list__actions">
            <LianButton size="sm" variant="primary" @click="submitReview(request, 'approved')">
              {{ ADMIN_VERIFICATION_APPROVE }}
            </LianButton>
            <LianButton size="sm" variant="danger" @click="submitReview(request, 'rejected')">
              {{ ADMIN_VERIFICATION_REJECT }}
            </LianButton>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-verification-list {
  display: grid;
  gap: var(--space-3);
}

.admin-verification-list__filters,
.admin-verification-list__actions,
.admin-verification-list__reveal {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-verification-list__reveal {
  align-items: flex-start;
  flex-direction: column;
}

.admin-verification-list__filter {
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.admin-verification-list__filter.is-active {
  border-color: var(--lian-primary-deep);
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
}

.admin-verification-list__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-verification-list__items {
  display: grid;
  gap: var(--space-3);
}

.admin-verification-list__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-verification-list__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-verification-list__type,
.admin-verification-list__id {
  margin: 0;
}

.admin-verification-list__type {
  font-size: 14px;
  font-weight: 900;
}

.admin-verification-list__id {
  color: var(--lian-muted);
  font-size: 11px;
}

.admin-verification-list__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.admin-verification-list__item[data-status="approved"] .admin-verification-list__status {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(21, 128, 61);
}

.admin-verification-list__item[data-status="rejected"] .admin-verification-list__status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-verification-list__meta,
.admin-verification-list__summary,
.admin-verification-list__reveal-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-verification-list__meta div,
.admin-verification-list__summary div,
.admin-verification-list__reveal-summary div,
.admin-verification-list__note {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.admin-verification-list__meta dt,
.admin-verification-list__summary dt,
.admin-verification-list__reveal-summary dt,
.admin-verification-list__note span {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-verification-list__meta dd,
.admin-verification-list__summary dd,
.admin-verification-list__reveal-summary dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.admin-verification-list__hint,
.admin-verification-list__reviewer-note,
.admin-verification-list__reveal-state {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.admin-verification-list__note textarea {
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  resize: vertical;
}
</style>
