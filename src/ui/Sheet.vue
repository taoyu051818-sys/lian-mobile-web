<script setup lang="ts">
import { computed, watch, useTemplateRef, nextTick } from "vue";
import { useBodyScrollLock } from "../composables/useBodyScrollLock";
import { useEscapeListener } from "../composables/useEscapeListener";
import { useFocusRestore } from "../composables/useFocusRestore";

const props = withDefaults(
  defineProps<{
    title?: string;
    open?: boolean;
  }>(),
  {
    title: "",
    open: true,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const isOpen = computed(() => props.open);
const overlayRef = useTemplateRef<HTMLElement>("overlay");
const focusRestore = useFocusRestore();

useBodyScrollLock(isOpen);
useEscapeListener(isOpen, () => emit("close"));

function keepFocusVisible(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function focusFirst() {
  nextTick(() => {
    if (!overlayRef.value) return;
    const first = overlayRef.value.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const focusTarget = first ?? overlayRef.value;
    focusTarget.focus();
    keepFocusVisible(focusTarget);
  });
}

function handleFocusIn(event: FocusEvent) {
  keepFocusVisible(event.target);
}

watch(isOpen, (open) => {
  if (open) {
    focusRestore.save();
    focusFirst();
  } else {
    focusRestore.restore();
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="overlay"
      class="lian-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="title || '弹层'"
      @focusin="handleFocusIn"
    >
      <div class="lian-sheet__backdrop" @click="emit('close')"></div>
      <section class="lian-sheet__panel keyboard-aware-surface">
        <header v-if="title || $slots.actions" class="lian-sheet__header">
          <h2 v-if="title">{{ title }}</h2>
          <slot name="actions">
            <button
              class="lian-sheet__close"
              type="button"
              aria-label="关闭"
              @click="emit('close')"
            >
              ×
            </button>
          </slot>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
