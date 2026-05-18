<script setup lang="ts">
import { ref } from "vue";
import { LianButton } from "../../ui";
import {
  ADMIN_ACTION_USER_REASON_LABEL,
  ADMIN_ACTION_USER_REASON_PLACEHOLDER,
  ADMIN_ACTION_USER_STATUS_LABEL,
  ADMIN_ACTION_USER_SUBMIT,
  ADMIN_ACTION_USER_TARGET_LABEL,
  ADMIN_ACTION_USER_TITLE,
  ADMIN_USER_STATUS_ACTIVE,
  ADMIN_USER_STATUS_BANNED,
  ADMIN_USER_STATUS_LIMITED,
} from "../../config/brand";
import type { AdminUserStatus } from "../../types/admin";

const emit = defineEmits<{
  apply: [target: string, payload: { status: AdminUserStatus; reason?: string }];
}>();

const target = ref("");
const status = ref<AdminUserStatus>("limited");
const reason = ref("");

const statusOptions: Array<{ value: AdminUserStatus; label: string }> = [
  { value: "active", label: ADMIN_USER_STATUS_ACTIVE },
  { value: "limited", label: ADMIN_USER_STATUS_LIMITED },
  { value: "banned", label: ADMIN_USER_STATUS_BANNED },
];

function handleSubmit() {
  const trimmedTarget = target.value.trim();
  if (!trimmedTarget) return;
  emit("apply", trimmedTarget, {
    status: status.value,
    reason: reason.value.trim() || undefined,
  });
}
</script>

<template>
  <section class="admin-user-action" :aria-label="ADMIN_ACTION_USER_TITLE">
    <h3 class="admin-user-action__title">{{ ADMIN_ACTION_USER_TITLE }}</h3>
    <label class="admin-user-action__field">
      <span>{{ ADMIN_ACTION_USER_TARGET_LABEL }}</span>
      <input v-model="target" type="text" autocomplete="off" spellcheck="false" />
    </label>
    <label class="admin-user-action__field">
      <span>{{ ADMIN_ACTION_USER_STATUS_LABEL }}</span>
      <select v-model="status">
        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </label>
    <label class="admin-user-action__field">
      <span>{{ ADMIN_ACTION_USER_REASON_LABEL }}</span>
      <textarea
        v-model="reason"
        rows="2"
        maxlength="200"
        :placeholder="ADMIN_ACTION_USER_REASON_PLACEHOLDER"
      ></textarea>
    </label>
    <LianButton variant="danger" size="sm" :disabled="!target.trim()" @click="handleSubmit">{{
      ADMIN_ACTION_USER_SUBMIT
    }}</LianButton>
  </section>
</template>

<style scoped>
.admin-user-action {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-user-action__title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
}

.admin-user-action__field {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
}

.admin-user-action__field input,
.admin-user-action__field select,
.admin-user-action__field textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 36px;
  padding: var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.admin-user-action__field textarea {
  min-height: 64px;
  resize: vertical;
}
</style>
