<script setup lang="ts">
/**
 * One-shot opt-in confirmation dialog for Server酱 reminders (ps#504 I2).
 *
 * Used by:
 *  - the event-join handler ("是否在活动开始前提醒你？")
 *  - the errand-order create handler ("是否接收此订单的关键状态提醒？")
 *
 * Presentational only — receives state from the caller and emits primary /
 * secondary intents. The decision to show/suppress lives in the caller; this
 * component just renders when `open` is true. Suppression for already-on
 * preferences and once-per-session dismissal is the caller's responsibility.
 */
import { computed, watch, useTemplateRef, nextTick } from "vue";
import { useBodyScrollLock } from "../../composables/useBodyScrollLock";
import { useEscapeListener } from "../../composables/useEscapeListener";
import { useFocusRestore } from "../../composables/useFocusRestore";
import { LianButton } from "../../ui";
import { SERVERCHAN_DIALOG_LABEL, DIALOG_BACKDROP_LABEL } from "../../config/brand";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    title: string;
    body: string;
    primaryLabel: string;
    secondaryLabel: string;
    busy?: boolean;
  }>(),
  {
    open: false,
    busy: false,
  },
);

const emit = defineEmits<{
  primary: [];
  secondary: [];
  close: [];
}>();

const isOpen = computed(() => props.open);
const overlayRef = useTemplateRef<HTMLElement>("overlay");
const focusRestore = useFocusRestore();

useBodyScrollLock(isOpen);
useEscapeListener(isOpen, () => emit("secondary"));

function focusFirst() {
  nextTick(() => {
    if (!overlayRef.value) return;
    const first = overlayRef.value.querySelector<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? overlayRef.value).focus();
  });
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
      class="sc-optin"
      role="dialog"
      aria-modal="true"
      :aria-label="SERVERCHAN_DIALOG_LABEL"
      data-testid="serverchan-optin-dialog"
    >
      <div
        class="sc-optin__backdrop"
        role="button"
        tabindex="-1"
        :aria-label="DIALOG_BACKDROP_LABEL"
        @click="emit('secondary')"
      ></div>
      <section class="sc-optin__panel">
        <h2 class="sc-optin__title">{{ title }}</h2>
        <p class="sc-optin__body">{{ body }}</p>
        <footer class="sc-optin__footer">
          <LianButton
            variant="ghost"
            size="md"
            :disabled="busy"
            data-testid="serverchan-optin-secondary"
            @click="emit('secondary')"
          >
            {{ secondaryLabel }}
          </LianButton>
          <LianButton
            variant="primary"
            size="md"
            :disabled="busy"
            data-testid="serverchan-optin-primary"
            @click="emit('primary')"
          >
            {{ primaryLabel }}
          </LianButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sc-optin {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
}

.sc-optin__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.sc-optin__panel {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--lian-bg, #fff);
  border-radius: var(--radius-card, 12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
}

.sc-optin__title {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.sc-optin__body {
  margin: 0;
  color: var(--lian-muted);
  font-size: 14px;
  line-height: 1.5;
}

.sc-optin__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
