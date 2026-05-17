<script setup lang="ts">
import { PUBLISH_RESET_CONTINUE, PUBLISH_RESET_CONFIRM_ACTION } from "../../config/brand";
import { LianButton } from "../../ui";

defineProps<{
  visible: boolean;
  message: string;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div
    v-if="visible"
    class="publish-reset-confirm"
    aria-live="polite"
    data-testid="publish-reset-confirm"
  >
    <p>{{ message }}</p>
    <div class="publish-reset-confirm__actions">
      <LianButton type="button" variant="ghost" @click="$emit('cancel')">
        {{ PUBLISH_RESET_CONTINUE }}
      </LianButton>
      <LianButton type="button" variant="danger" @click="$emit('confirm')">
        {{ PUBLISH_RESET_CONFIRM_ACTION }}
      </LianButton>
    </div>
  </div>
</template>

<style scoped>
.publish-reset-confirm {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid rgba(214, 78, 58, 0.18);
  border-radius: var(--radius-card);
  background: rgba(214, 78, 58, 0.08);
  color: var(--lian-ink);
}

.publish-reset-confirm p {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
}

.publish-reset-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>
