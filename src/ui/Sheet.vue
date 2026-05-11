<script setup lang="ts">
import { watch, onBeforeUnmount, useTemplateRef, nextTick } from "vue";
import { useVisualViewport } from "../composables/useVisualViewport";

const props = withDefaults(defineProps<{
  title?: string;
  open?: boolean;
}>(), {
  title: "",
  open: true
});

const emit = defineEmits<{
  close: [];
}>();

useVisualViewport();

const overlayRef = useTemplateRef<HTMLElement>("overlay");
let triggerEl: HTMLElement | null = null;

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}

function lockScroll() {
  document.body.style.setProperty("overflow", "hidden");
}

function unlockScroll() {
  document.body.style.removeProperty("overflow");
}

function focusFirst() {
  nextTick(() => {
    if (!overlayRef.value) return;
    const first = overlayRef.value.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? overlayRef.value).focus();
  });
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      triggerEl = document.activeElement as HTMLElement;
      lockScroll();
      document.addEventListener("keydown", handleKeydown);
      focusFirst();
    } else {
      unlockScroll();
      document.removeEventListener("keydown", handleKeydown);
      triggerEl?.focus();
    }
  },
);

onBeforeUnmount(() => {
  unlockScroll();
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" ref="overlay" class="lian-sheet" role="dialog" aria-modal="true" :aria-label="title || '弹层'">
      <div class="lian-sheet__backdrop" @click="emit('close')"></div>
      <section class="lian-sheet__panel">
        <header v-if="title || $slots.actions" class="lian-sheet__header">
          <h2 v-if="title">{{ title }}</h2>
          <slot name="actions">
            <button class="lian-sheet__close" type="button" aria-label="关闭" @click="emit('close')">×</button>
          </slot>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.lian-sheet__panel {
  bottom: var(--keyboard-inset-bottom, 0px);
  max-height: calc(100dvh - env(safe-area-inset-top) - var(--space-4) - var(--keyboard-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom, 0px));
}

.lian-sheet__panel :deep(input),
.lian-sheet__panel :deep(textarea),
.lian-sheet__panel :deep(select),
.lian-sheet__panel :deep(button) {
  scroll-margin-bottom: calc(var(--keyboard-inset-bottom, 0px) + var(--space-8));
}

@media (prefers-reduced-motion: no-preference) {
  .lian-sheet__panel {
    transition:
      bottom var(--motion-fast) var(--motion-ease-standard),
      max-height var(--motion-fast) var(--motion-ease-standard);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lian-sheet__panel {
    transition: none;
  }
}
</style>
