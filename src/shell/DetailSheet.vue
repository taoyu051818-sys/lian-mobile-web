<script setup lang="ts">
import { computed, watch } from "vue";
import { useDetailSheet } from "./useDetailSheet";
import { useBodyScrollLock } from "../composables/useBodyScrollLock";
import { useEscapeListener } from "../composables/useEscapeListener";
import { useFocusRestore } from "../composables/useFocusRestore";
import { DETAIL_SHEET_LABEL, DETAIL_SHEET_TITLE, CLOSE_BUTTON_LABEL } from "../config/brand";

const emit = defineEmits<{
  close: [];
}>();

const { state, close } = useDetailSheet();
const isOpen = computed(() => state.open);
const focusRestore = useFocusRestore();

useBodyScrollLock(isOpen);
useEscapeListener(isOpen, handleClose);

function handleClose() {
  close();
  emit("close");
}

watch(isOpen, (open) => {
  if (open) {
    focusRestore.save();
  } else {
    focusRestore.restore();
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="detail-sheet-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="DETAIL_SHEET_LABEL"
    >
      <div class="detail-sheet__backdrop" @click="handleClose" />
      <section class="detail-sheet__panel">
        <header class="detail-sheet__header">
          <slot name="header">
            <h2 class="detail-sheet__title">{{ DETAIL_SHEET_TITLE }}</h2>
          </slot>
          <button
            class="detail-sheet__close"
            type="button"
            :aria-label="CLOSE_BUTTON_LABEL"
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
