<script setup lang="ts">
import { LianButton } from "../../ui";
import { ADMIN_AUDIT_REFRESH } from "../../config/brand";
import AdminAuditLogList from "./AdminAuditLogList.vue";
import type { AdminAuditEvent } from "../../types/admin";

defineProps<{
  events: AdminAuditEvent[];
  loading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <section class="admin-audit-block">
    <div class="admin-audit-block__toolbar">
      <LianButton size="sm" variant="ghost" @click="emit('refresh')">
        {{ ADMIN_AUDIT_REFRESH }}
      </LianButton>
    </div>
    <AdminAuditLogList :events="events" :loading="loading" :error-message="errorMessage" />
  </section>
</template>

<style scoped>
.admin-audit-block {
  display: grid;
  gap: var(--space-3);
}

.admin-audit-block__toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
