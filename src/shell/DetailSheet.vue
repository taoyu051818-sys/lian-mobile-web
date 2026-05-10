<script setup lang="ts">
import { watch, onBeforeUnmount } from "vue";
import { useDetailSheet } from "./useDetailSheet";

const emit = defineEmits<{
  close: [];
}>();

const { state, close } = useDetailSheet();

function handleClose() {
  close();
  emit("close");
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && state.open) {
    event.stopPropagation();
    handleClose();
  }
}

watch(
  () => state.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeydown);
    } else {
      document.removeEventListener("keydown", handleKeydown);
    }
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="detail-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="详情弹层"
    >
      <div class="detail-sheet__backdrop" @click="handleClose" />
      <section class="detail-sheet__panel">
        <header class="detail-sheet__header">
          <slot name="header">
            <h2 class="detail-sheet__title">详情</h2>
          </slot>
          <button
            class="detail-sheet__close"
            type="button"
            aria-label="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </header>
        <div class="detail-sheet__body">
          <slot :kind="state.kind" :payload="state.payload" />
        </div>
      </section>
    </div>
  </Teleport>
</template>
