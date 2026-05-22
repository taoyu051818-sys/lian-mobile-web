<script setup lang="ts">
import { computed } from "vue";
import { InlineError, LianButton } from "../../ui";
import {
  ADMIN_QUEUE_RELOAD,
  ADMIN_VERIFICATION_DECISION_APPROVE,
  ADMIN_VERIFICATION_DECISION_REJECT,
  ADMIN_VERIFICATION_FILTER_GROUP_LABEL,
  ADMIN_VERIFICATION_LIST_LOADING,
  ADMIN_VERIFICATION_REALNAME_MASKED_HINT,
  ADMIN_VERIFICATION_REVEAL_AGAIN,
  ADMIN_VERIFICATION_REVEAL_FIRST,
  ADMIN_VERIFICATION_REVEAL_PENDING,
  ADMIN_VERIFICATION_REVIEWED_AT_LABEL,
  ADMIN_VERIFICATION_REVIEWER_LABEL,
  ADMIN_VERIFICATION_REVIEWER_NOTE_LABEL,
  ADMIN_VERIFICATION_REVIEWER_NOTE_PLACEHOLDER,
  ADMIN_VERIFICATION_REVIEWER_NOTE_PREFIX,
  ADMIN_VERIFICATION_SUBMITTED_AT_LABEL,
  ADMIN_VERIFICATION_USER_ID_LABEL,
} from "../../config/brand";
import { formatAdminTime } from "./admin-format";
import {
  canReviewRequest,
  canRevealRealname,
  getVerificationEmptyState,
  revealedRealnameRows,
  verificationFilters,
  verificationStatusLabel,
  verificationSummaryRows,
  verificationTypeLabel,
  type AdminVerificationDecisionStatus,
  type AdminVerificationDetail,
  type AdminVerificationRequest,
  type AdminVerificationStatus,
} from "./admin-verification";

const props = defineProps<{
  requests: AdminVerificationRequest[];
  loading: boolean;
  errorMessage: string;
  revealError: string;
  statusFilter: AdminVerificationStatus | "";
  revealingVerificationId: string;
  revealedDetails: Record<string, AdminVerificationDetail | undefined>;
  notes: Record<string, string>;
}>();

const emit = defineEmits<{
  filterChange: [value: AdminVerificationStatus | ""];
  reload: [];
  review: [request: AdminVerificationRequest, status: AdminVerificationDecisionStatus];
  reveal: [request: AdminVerificationRequest];
  noteUpdate: [verificationId: string, value: string];
}>();

const emptyState = computed(() => getVerificationEmptyState(props.statusFilter));

function revealedDetail(request: AdminVerificationRequest) {
  return props.revealedDetails[request.verificationId];
}

function noteValue(request: AdminVerificationRequest) {
  return props.notes[request.verificationId] ?? "";
}

function onNoteInput(request: AdminVerificationRequest, event: Event) {
  const target = event.target as HTMLTextAreaElement | null;
  emit("noteUpdate", request.verificationId, target?.value ?? "");
}
</script>

<template>
  <section class="admin-verification-block">
    <nav
      class="admin-verification-block__filters"
      :aria-label="ADMIN_VERIFICATION_FILTER_GROUP_LABEL"
    >
      <button
        v-for="opt in verificationFilters"
        :key="opt.value || 'all'"
        type="button"
        class="admin-verification-block__filter"
        :class="{ 'is-active': opt.value === statusFilter }"
        :aria-pressed="opt.value === statusFilter"
        @click="emit('filterChange', opt.value)"
      >
        {{ opt.label }}
      </button>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">
        {{ ADMIN_QUEUE_RELOAD }}
      </LianButton>
    </nav>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <InlineError v-else-if="revealError">{{ revealError }}</InlineError>

    <div v-if="loading" class="admin-verification-block__state" role="status">
      {{ ADMIN_VERIFICATION_LIST_LOADING }}
    </div>

    <section
      v-else-if="!requests.length"
      class="admin-verification-block__state admin-verification-block__state-card"
      data-testid="admin-verification-empty"
    >
      <strong>{{ emptyState.title }}</strong>
      <p>{{ emptyState.body }}</p>
    </section>

    <div v-else class="admin-verification-block__items">
      <article
        v-for="request in requests"
        :key="request.verificationId"
        class="admin-verification-block__item"
        :data-status="request.status"
      >
        <header class="admin-verification-block__header">
          <span class="admin-verification-block__type">
            {{ verificationTypeLabel(request.verificationType) }}
          </span>
          <span class="admin-verification-block__status">
            {{ verificationStatusLabel(request.status) }}
          </span>
        </header>

        <dl class="admin-verification-block__meta">
          <div>
            <dt>{{ ADMIN_VERIFICATION_USER_ID_LABEL }}</dt>
            <dd>{{ request.userId }}</dd>
          </div>
          <div>
            <dt>{{ ADMIN_VERIFICATION_SUBMITTED_AT_LABEL }}</dt>
            <dd>{{ formatAdminTime(request.createdAt || request.updatedAt) }}</dd>
          </div>
          <div v-if="request.reviewerId">
            <dt>{{ ADMIN_VERIFICATION_REVIEWER_LABEL }}</dt>
            <dd>{{ request.reviewerId }}</dd>
          </div>
          <div v-if="request.reviewedAt">
            <dt>{{ ADMIN_VERIFICATION_REVIEWED_AT_LABEL }}</dt>
            <dd>{{ formatAdminTime(request.reviewedAt) }}</dd>
          </div>
        </dl>

        <dl
          v-if="verificationSummaryRows(request).length"
          class="admin-verification-block__summary"
        >
          <div
            v-for="row in verificationSummaryRows(request)"
            :key="`${request.verificationId}:${row.label}`"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>

        <p
          v-if="request.verificationType === 'realname'"
          class="admin-verification-block__note admin-verification-block__note--muted"
        >
          {{ ADMIN_VERIFICATION_REALNAME_MASKED_HINT }}
        </p>

        <div v-if="canRevealRealname(request)" class="admin-verification-block__reveal">
          <LianButton
            size="sm"
            variant="ghost"
            :disabled="revealingVerificationId === request.verificationId"
            @click="emit('reveal', request)"
          >
            {{
              revealingVerificationId === request.verificationId
                ? ADMIN_VERIFICATION_REVEAL_PENDING
                : revealedDetail(request)
                  ? ADMIN_VERIFICATION_REVEAL_AGAIN
                  : ADMIN_VERIFICATION_REVEAL_FIRST
            }}
          </LianButton>
        </div>

        <dl
          v-if="revealedRealnameRows(revealedDetail(request)).length"
          class="admin-verification-block__detail"
        >
          <div
            v-for="row in revealedRealnameRows(revealedDetail(request))"
            :key="`${request.verificationId}:detail:${row.label}`"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>

        <p v-if="request.reviewerNote" class="admin-verification-block__note">
          {{ ADMIN_VERIFICATION_REVIEWER_NOTE_PREFIX }}{{ request.reviewerNote }}
        </p>

        <template v-if="canReviewRequest(request)">
          <label class="admin-verification-block__editor">
            <span>{{ ADMIN_VERIFICATION_REVIEWER_NOTE_LABEL }}</span>
            <textarea
              :value="noteValue(request)"
              rows="2"
              maxlength="240"
              :placeholder="ADMIN_VERIFICATION_REVIEWER_NOTE_PLACEHOLDER"
              @input="(event) => onNoteInput(request, event)"
            ></textarea>
          </label>

          <div class="admin-verification-block__actions">
            <LianButton size="sm" variant="primary" @click="emit('review', request, 'approved')">
              {{ ADMIN_VERIFICATION_DECISION_APPROVE }}
            </LianButton>
            <LianButton size="sm" variant="danger" @click="emit('review', request, 'rejected')">
              {{ ADMIN_VERIFICATION_DECISION_REJECT }}
            </LianButton>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-verification-block {
  display: grid;
  gap: var(--space-3);
}

.admin-verification-block__filters,
.admin-verification-block__actions,
.admin-verification-block__reveal {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-verification-block__filter {
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

.admin-verification-block__filter.is-active {
  border-color: var(--lian-primary-deep);
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
}

.admin-verification-block__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-verification-block__state-card {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
}

.admin-verification-block__state-card strong {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.admin-verification-block__state-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.admin-verification-block__items {
  display: grid;
  gap: var(--space-3);
}

.admin-verification-block__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-verification-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-verification-block__type,
.admin-verification-block__status {
  font-size: 13px;
  font-weight: 900;
}

.admin-verification-block__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
}

.admin-verification-block__item[data-status="approved"] .admin-verification-block__status {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(21, 128, 61);
}

.admin-verification-block__item[data-status="rejected"] .admin-verification-block__status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-verification-block__meta,
.admin-verification-block__summary,
.admin-verification-block__detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-verification-block__meta div,
.admin-verification-block__summary div,
.admin-verification-block__detail div,
.admin-verification-block__editor {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.admin-verification-block__meta dt,
.admin-verification-block__summary dt,
.admin-verification-block__detail dt,
.admin-verification-block__editor span {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-verification-block__meta dd,
.admin-verification-block__summary dd,
.admin-verification-block__detail dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.admin-verification-block__note {
  margin: 0;
  color: var(--lian-ink);
  font-size: 12px;
  line-height: 1.5;
}

.admin-verification-block__note--muted {
  color: var(--lian-muted);
}

.admin-verification-block__editor textarea {
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
