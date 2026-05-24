<script setup lang="ts">
/**
 * Sheet - Modal bottom sheet overlay component.
 *
 * A teleported modal dialog that slides up from the bottom of the viewport.
 * Implements proper focus management, scroll locking, and keyboard navigation.
 * Uses Apple Music-style motion easing for enter/leave transitions.
 *
 * @component
 * @example
 * ```vue
 * <Sheet :open="isOpen" title="Settings" @close="isOpen = false">
 *   <p>Sheet content here</p>
 * </Sheet>
 * ```
 *
 * @fires close - Emitted when the sheet should close (backdrop click, escape key, or close button)
 *
 * @slot default - Main content of the sheet panel
 * @slot actions - Custom header actions (replaces default close button when provided)
 */
import { computed, watch, useTemplateRef, nextTick } from "vue";
import { useBodyScrollLock } from "../composables/useBodyScrollLock";
import { useEscapeListener } from "../composables/useEscapeListener";
import { useFocusRestore } from "../composables/useFocusRestore";

/**
 * @property {string} [title=''] - Optional title displayed in the sheet header
 * @property {boolean} [open=true] - Controls sheet visibility
 */
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
    <Transition name="lian-sheet" appear>
      <div
        v-if="open"
        ref="overlay"
        class="lian-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title || '弹层'"
        @focusin="handleFocusIn"
      >
        <div
          class="lian-sheet__backdrop"
          role="button"
          tabindex="-1"
          aria-label="关闭"
          @click="emit('close')"
        ></div>
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
    </Transition>
  </Teleport>
</template>

<style>
/*
 * Apple Music gap PR-α: bottom-sheet enter/leave uses --motion-ease-decelerate
 * so the panel slides into rest at a slowing pace (matches Apple Music's
 * sheet timing). The backdrop fades on the standard ease.
 * Reduced-motion is honored via the global CSS guard in floating-chrome.css
 * and the per-property `transition: none` overrides below.
 */
.lian-sheet-enter-active .lian-sheet__panel,
.lian-sheet-leave-active .lian-sheet__panel {
  transition:
    transform var(--motion-standard) var(--motion-ease-decelerate),
    opacity var(--motion-fast) var(--motion-ease-decelerate);
}

.lian-sheet-enter-active .lian-sheet__backdrop,
.lian-sheet-leave-active .lian-sheet__backdrop {
  transition: opacity var(--motion-fast) var(--motion-ease-standard);
}

.lian-sheet-enter-from .lian-sheet__panel,
.lian-sheet-leave-to .lian-sheet__panel {
  transform: translateY(16px);
  opacity: 0;
}

.lian-sheet-enter-from .lian-sheet__backdrop,
.lian-sheet-leave-to .lian-sheet__backdrop {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lian-sheet-enter-active .lian-sheet__panel,
  .lian-sheet-leave-active .lian-sheet__panel,
  .lian-sheet-enter-active .lian-sheet__backdrop,
  .lian-sheet-leave-active .lian-sheet__backdrop {
    transition: none;
  }
}
</style>
