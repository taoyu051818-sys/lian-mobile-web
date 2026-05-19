<script setup lang="ts">
import { LianButton } from "../../ui";
import { RUNNER_GATE_GO_VERIFY, RUNNER_GATE_HINT, RUNNER_GATE_TITLE } from "../../config/brand";

defineEmits<{
  "go-verify": [];
}>();
</script>

<template>
  <section class="runner-gate" :aria-label="RUNNER_GATE_TITLE" data-testid="runner-gate">
    <h2 class="runner-gate__title">{{ RUNNER_GATE_TITLE }}</h2>
    <p class="runner-gate__hint">{{ RUNNER_GATE_HINT }}</p>
    <LianButton variant="primary" @click="$emit('go-verify')">
      {{ RUNNER_GATE_GO_VERIFY }}
    </LianButton>
  </section>
</template>

<style scoped>
.runner-gate {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  max-width: 420px;
  margin: var(--space-6) auto 0;
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.runner-gate__title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.runner-gate__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
