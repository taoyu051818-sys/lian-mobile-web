<script setup lang="ts">
/**
 * Auth-link redeem sheet (RFC §2.3 mw#B).
 *
 * Presentational only — receives state from `useAuthLinkRedeem` via the
 * parent and emits user intents. Five visible states:
 *
 *   - loading   → "正在加载邀请信息…"
 *   - ready     → renders title + summary + thumbnail + "领取" button
 *   - redeeming → "领取中…" with disabled button
 *   - success   → shows success message, auto-closes
 *   - error     → shows the localized error copy. For `network` errors a
 *                 "重试" affordance is exposed; for other errors it is hidden.
 *
 * Layout reuses the ShareCardSheet look-and-feel. The sheet is rendered
 * through Vue's <Teleport> to the document body so it floats above the
 * auth panel surface.
 */

import { computed, watch, useTemplateRef, nextTick } from "vue";
import {
  AUTH_LINK_CANCEL,
  AUTH_LINK_LOADING,
  AUTH_LINK_REDEEM,
  AUTH_LINK_REDEEMING,
  AUTH_LINK_RETRY,
  AUTH_LINK_SHEET_LABEL,
  AUTH_LINK_SHEET_TITLE,
  AUTH_LINK_THUMBNAIL_ALT,
  DIALOG_BACKDROP_LABEL,
} from "../../config/brand";
import { useBodyScrollLock } from "../../composables/useBodyScrollLock";
import { useEscapeListener } from "../../composables/useEscapeListener";
import { useFocusRestore } from "../../composables/useFocusRestore";
import { LianButton } from "../../ui";
import type { AuthLinkCard } from "./useAuthLinkRedeem";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    status?: "idle" | "loading" | "ready" | "redeeming" | "success" | "error";
    card?: AuthLinkCard | null;
    errorMessage?: string;
    successMessage?: string;
    canRetry?: boolean;
  }>(),
  {
    open: false,
    status: "idle",
    card: null,
    errorMessage: "",
    successMessage: "",
    canRetry: false,
  },
);

const emit = defineEmits<{
  close: [];
  redeem: [];
  retry: [];
}>();

const isOpen = computed(() => props.open);
const overlayRef = useTemplateRef<HTMLElement>("overlay");
const focusRestore = useFocusRestore();

useBodyScrollLock(isOpen);
useEscapeListener(isOpen, () => emit("close"));

function focusFirst() {
  nextTick(() => {
    if (!overlayRef.value) return;
    const first = overlayRef.value.querySelector<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
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

const isRedeeming = computed(() => props.status === "redeeming");
const redeemLabel = computed(() => (isRedeeming.value ? AUTH_LINK_REDEEMING : AUTH_LINK_REDEEM));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="overlay"
      class="auth-link-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="AUTH_LINK_SHEET_LABEL"
      data-testid="auth-link-sheet"
    >
      <div
        class="auth-link-sheet__backdrop"
        role="button"
        tabindex="-1"
        :aria-label="DIALOG_BACKDROP_LABEL"
        @click="emit('close')"
      ></div>
      <section class="auth-link-sheet__panel">
        <header class="auth-link-sheet__header">
          <h2>{{ AUTH_LINK_SHEET_TITLE }}</h2>
          <button
            class="auth-link-sheet__close"
            type="button"
            :aria-label="AUTH_LINK_CANCEL"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div
          v-if="status === 'loading'"
          class="auth-link-sheet__state"
          role="status"
          data-testid="auth-link-loading"
        >
          {{ AUTH_LINK_LOADING }}
        </div>

        <div
          v-else-if="status === 'error'"
          class="auth-link-sheet__state auth-link-sheet__state--error"
          role="alert"
          data-testid="auth-link-error"
        >
          <p>{{ errorMessage }}</p>
          <LianButton
            v-if="canRetry"
            size="sm"
            variant="tonal"
            data-testid="auth-link-retry"
            @click="emit('retry')"
          >
            {{ AUTH_LINK_RETRY }}
          </LianButton>
        </div>

        <div
          v-else-if="status === 'success'"
          class="auth-link-sheet__state auth-link-sheet__state--success"
          role="status"
          data-testid="auth-link-success"
        >
          <p>{{ successMessage }}</p>
        </div>

        <article
          v-else-if="(status === 'ready' || status === 'redeeming') && card"
          class="auth-link-sheet__card"
          data-testid="auth-link-preview"
        >
          <img
            v-if="card.thumbnailUrl"
            class="auth-link-sheet__thumb"
            :src="card.thumbnailUrl"
            :alt="AUTH_LINK_THUMBNAIL_ALT"
            loading="lazy"
          />
          <div class="auth-link-sheet__text">
            <h3 class="auth-link-sheet__title">{{ card.title }}</h3>
            <p v-if="card.summary" class="auth-link-sheet__summary">{{ card.summary }}</p>
            <span
              v-if="card.audienceLabel"
              class="auth-link-sheet__audience"
              data-testid="auth-link-audience"
            >
              {{ card.audienceLabel }}
            </span>
          </div>
        </article>

        <footer class="auth-link-sheet__footer">
          <LianButton variant="ghost" size="md" @click="emit('close')">{{
            AUTH_LINK_CANCEL
          }}</LianButton>
          <LianButton
            variant="primary"
            size="md"
            :disabled="(status !== 'ready' && status !== 'redeeming') || !card || isRedeeming"
            data-testid="auth-link-redeem"
            @click="emit('redeem')"
          >
            {{ redeemLabel }}
          </LianButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-link-sheet {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: end center;
}

.auth-link-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.auth-link-sheet__panel {
  position: relative;
  width: 100%;
  max-width: 480px;
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--lian-bg, #fff);
  border-radius: var(--radius-sheet, 16px) var(--radius-sheet, 16px) 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.16);
}

.auth-link-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auth-link-sheet__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.auth-link-sheet__close {
  border: 0;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--lian-muted);
}

.auth-link-sheet__state {
  padding: var(--space-4) 0;
  text-align: center;
  color: var(--lian-muted);
  display: grid;
  gap: var(--space-2);
  justify-items: center;
}

.auth-link-sheet__state p {
  margin: 0;
}

.auth-link-sheet__state--error {
  color: var(--lian-danger, #b3261e);
}

.auth-link-sheet__state--success {
  color: var(--lian-primary, #1fa7a0);
}

.auth-link-sheet__card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface, rgba(0, 0, 0, 0.03));
}

.auth-link-sheet__thumb {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: var(--radius-chip, 8px);
}

.auth-link-sheet__text {
  display: grid;
  gap: var(--space-2);
}

.auth-link-sheet__title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
}

.auth-link-sheet__summary {
  margin: 0;
  font-size: 13px;
  color: var(--lian-muted);
  line-height: 1.5;
}

.auth-link-sheet__audience {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-chip, 8px);
  background: var(--lian-primary-soft, rgba(0, 0, 0, 0.06));
  color: var(--lian-primary-deep, inherit);
  font-size: 12px;
  font-weight: 700;
  width: fit-content;
}

.auth-link-sheet__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
