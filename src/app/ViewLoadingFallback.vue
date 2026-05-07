<template>
  <section class="view-loading-fallback" role="status" aria-label="页面加载中">
    <div class="view-loading-fallback__spinner" aria-hidden="true"></div>
    <p>页面加载中…</p>
  </section>
</template>

<style scoped>
.view-loading-fallback {
  display: grid;
  gap: var(--space-3);
  min-height: 40vh;
  place-content: center;
  place-items: center;
  color: var(--lian-muted);
  font-size: 14px;
  font-weight: 800;
}

.view-loading-fallback__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(31, 41, 51, 0.1);
  border-top-color: var(--lian-primary, #1fa7a0);
  border-radius: 999px;
  animation: view-loading-spin 680ms linear infinite;
}

@keyframes view-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
