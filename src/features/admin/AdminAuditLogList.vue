<script setup lang="ts">
import { InlineError } from "../../ui";
import {
  ADMIN_AUDIT_ACTION_LABEL,
  ADMIN_AUDIT_ACTOR_LABEL,
  ADMIN_AUDIT_EMPTY,
  ADMIN_AUDIT_TARGET_LABEL,
  ADMIN_AUDIT_TIME_LABEL,
} from "../../config/brand";
import type { AdminAuditEvent } from "../../types/admin";
import { formatAdminTime } from "./admin-format";

defineProps<{
  events: AdminAuditEvent[];
  loading: boolean;
  errorMessage: string;
}>();
</script>

<template>
  <section class="admin-audit-list">
    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>

    <p v-if="!events.length && !loading" class="admin-audit-list__state">
      {{ ADMIN_AUDIT_EMPTY }}
    </p>

    <ul v-else class="admin-audit-list__items">
      <li v-for="event in events" :key="event.eventId" class="admin-audit-list__item">
        <header class="admin-audit-list__header">
          <span class="admin-audit-list__action">
            {{ ADMIN_AUDIT_ACTION_LABEL }}: {{ event.action }}
          </span>
          <span class="admin-audit-list__time">{{ formatAdminTime(event.createdAt) }}</span>
        </header>
        <dl class="admin-audit-list__meta">
          <div>
            <dt>{{ ADMIN_AUDIT_ACTOR_LABEL }}</dt>
            <dd>{{ event.actorId }}</dd>
          </div>
          <div v-if="event.targetType || event.targetId">
            <dt>{{ ADMIN_AUDIT_TARGET_LABEL }}</dt>
            <dd>{{ event.targetType || "" }} {{ event.targetId || "" }}</dd>
          </div>
          <div v-if="event.detail">
            <dt>{{ ADMIN_AUDIT_TIME_LABEL }}</dt>
            <dd class="admin-audit-list__detail">{{ JSON.stringify(event.detail) }}</dd>
          </div>
        </dl>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.admin-audit-list {
  display: grid;
  gap: var(--space-3);
}

.admin-audit-list__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-audit-list__items {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-audit-list__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-audit-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-audit-list__action {
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 900;
}

.admin-audit-list__time {
  color: var(--lian-muted);
  font-size: 12px;
}

.admin-audit-list__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2);
  margin: 0;
}

.admin-audit-list__meta div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.admin-audit-list__meta dt {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-audit-list__meta dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.admin-audit-list__detail {
  font-family: var(--lian-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 1.4;
}
</style>
