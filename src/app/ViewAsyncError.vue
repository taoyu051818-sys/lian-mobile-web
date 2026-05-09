<script setup lang="ts">
defineProps<{
  error: Error;
  retry: () => void;
}>();
</script>

<template>
  <section class="view-async-error" role="alert" aria-label="页面加载失败">
    <p>页面加载失败，请稍后再试。</p>
    <button type="button" class="view-async-error__retry" @click="retry">重新加载</button>
  </section>
</template>

<style scoped>
.view-async-error {
  display: grid;
  gap: var(--space-3);
  min-height: 40vh;
  place-content: center;
  place-items: center;
  color: var(--lian-muted);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.view-async-error p {
  margin: 0;
}

.view-async-error__retry {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font-weight: 900;
  cursor: pointer;
}

.view-async-error__retry:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 2px;
}
</style>
