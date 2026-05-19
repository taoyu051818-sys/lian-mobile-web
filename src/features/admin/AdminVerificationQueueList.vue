<script setup lang="ts">
import { ref } from "vue";
import { InlineError, LianButton } from "../../ui";
import type {
  AdminVerificationDecisionStatus,
  AdminVerificationRequest,
  AdminVerificationStatus,
} from "../../api/admin";
import type { VerificationTag } from "../../types/verification";
import { formatAdminTime } from "./admin-format";

defineProps<{
  requests: AdminVerificationRequest[];
  loading: boolean;
  errorMessage: string;
  statusFilter: AdminVerificationStatus | "";
}>();

const emit = defineEmits<{
  filterChange: [value: AdminVerificationStatus | ""];
  reload: [];
  review: [
    requestId: string,
    payload: {
      status: AdminVerificationDecisionStatus;
      note?: string | null;
    },
  ];
}>();

const REVIEW_STATUS_LABELS: Record<AdminVerificationStatus | "", string> = {
  "": "全部",
  pending: "待审核",
  reviewing: "审核中",
  approved: "已通过",
  rejected: "已拒绝",
};

const TAG_LABELS: Record<VerificationTag, string> = {
  campus_verified: "高校认证",
  org_member: "组织成员",
  realname_verified: "实名认证",
  merchant_verified: "商户认证",
  runner: "跑腿员",
};

const filters: Array<{ value: AdminVerificationStatus | ""; label: string }> = [
  { value: "", label: REVIEW_STATUS_LABELS[""] },
  { value: "pending", label: REVIEW_STATUS_LABELS.pending },
  { value: "reviewing", label: REVIEW_STATUS_LABELS.reviewing },
  { value: "approved", label: REVIEW_STATUS_LABELS.approved },
  { value: "rejected", label: REVIEW_STATUS_LABELS.rejected },
];

const noteDrafts = ref<Record<string, string>>({});

function tagLabel(tag: VerificationTag) {
  return TAG_LABELS[tag] || tag;
}

function requestTime(request: AdminVerificationRequest) {
  return request.submittedAt || request.createdAt || request.updatedAt || "";
}

function submitReview(request: AdminVerificationRequest, status: AdminVerificationDecisionStatus) {
  emit("review", request.requestId, {
    status,
    note: noteDrafts.value[request.requestId]?.trim() || null,
  });
}
</script>

<template>
  <section class="admin-verification-list">
    <nav class="admin-verification-list__filters" aria-label="认证审核状态筛选">
      <button
        v-for="opt in filters"
        :key="opt.value || 'all'"
        type="button"
        class="admin-verification-list__filter"
        :class="{ 'is-active': opt.value === statusFilter }"
        :aria-pressed="opt.value === statusFilter"
        @click="emit('filterChange', opt.value)"
      >
        {{ opt.label }}
      </button>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">重新加载</LianButton>
    </nav>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>

    <div v-if="loading" class="admin-verification-list__state" role="status">加载认证审核队列…</div>

    <p v-else-if="!requests.length" class="admin-verification-list__state">暂无认证申请。</p>

    <div v-else class="admin-verification-list__items">
      <article
        v-for="request in requests"
        :key="request.requestId"
        class="admin-verification-list__item"
        :data-status="request.status"
      >
        <header class="admin-verification-list__header">
          <span class="admin-verification-list__tag">{{ tagLabel(request.tag) }}</span>
          <span class="admin-verification-list__status">
            {{ REVIEW_STATUS_LABELS[request.status] || request.status }}
          </span>
        </header>

        <dl class="admin-verification-list__meta">
          <div>
            <dt>申请人</dt>
            <dd>{{ request.displayName || request.email || request.userId }}</dd>
          </div>
          <div>
            <dt>用户 ID</dt>
            <dd>{{ request.userId }}</dd>
          </div>
          <div>
            <dt>申请时间</dt>
            <dd>{{ formatAdminTime(requestTime(request)) }}</dd>
          </div>
          <div v-if="request.reviewedAt">
            <dt>处理时间</dt>
            <dd>{{ formatAdminTime(request.reviewedAt) }}</dd>
          </div>
        </dl>

        <pre v-if="request.payload" class="admin-verification-list__payload">{{
          JSON.stringify(request.payload, null, 2)
        }}</pre>

        <label class="admin-verification-list__note">
          <span>审核备注</span>
          <textarea
            v-model="noteDrafts[request.requestId]"
            rows="2"
            maxlength="240"
            placeholder="可填写通过或拒绝理由（选填）。"
          ></textarea>
        </label>

        <div class="admin-verification-list__actions">
          <LianButton size="sm" variant="primary" @click="submitReview(request, 'approved')">
            通过
          </LianButton>
          <LianButton size="sm" variant="danger" @click="submitReview(request, 'rejected')">
            拒绝
          </LianButton>
        </div>
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
.admin-verification-list__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
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
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-verification-list__tag,
.admin-verification-list__status {
  font-size: 13px;
  font-weight: 900;
}

.admin-verification-list__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
}

.admin-verification-list__item[data-status="approved"] .admin-verification-list__status {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(21, 128, 61);
}

.admin-verification-list__item[data-status="rejected"] .admin-verification-list__status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-verification-list__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-verification-list__meta div,
.admin-verification-list__note {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.admin-verification-list__meta dt,
.admin-verification-list__note span {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-verification-list__meta dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.admin-verification-list__payload {
  max-height: 160px;
  margin: 0;
  overflow: auto;
  padding: var(--space-2);
  border-radius: var(--radius-3);
  background: rgba(15, 23, 42, 0.06);
  color: var(--lian-ink);
  font-family: var(--lian-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 1.45;
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
