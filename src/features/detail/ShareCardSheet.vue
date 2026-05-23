<script setup lang="ts">
/**
 * Share-card preview sheet (ps#484 V1 envelope consumer).
 *
 * Presentational only — receives state from `useShareCardPreview` via the
 * parent and emits user intents. Three visible states:
 *
 *   - loading   → "正在准备分享卡片…"
 *   - ready     → renders title + summary + thumbnail + audience + author,
 *                 with a primary "确认分享" button that emits `confirm`.
 *   - error     → shows the localized error copy. For `network` errors a
 *                 "重试" affordance is exposed; for `not-found` it is hidden
 *                 since retrying a deleted/audience-blocked post will fail
 *                 again the same way.
 *
 * Layout reuses the existing post-detail look-and-feel (centered card with
 * thumbnail above text). The sheet is rendered through Vue's <Teleport> to
 * the document body via the `lian-share-card-sheet` overlay so it floats
 * above the post detail surface and the floating chrome.
 */

import { computed, watch, useTemplateRef, nextTick } from "vue";
import {
  SHARE_CARD_AUTHOR_PREFIX,
  SHARE_CARD_CANCEL,
  SHARE_CARD_CONFIRM,
  SHARE_CARD_LOADING,
  SHARE_CARD_RETRY,
  SHARE_CARD_SHEET_LABEL,
  SHARE_CARD_SHEET_TITLE,
  SHARE_CARD_THUMBNAIL_ALT,
} from "../../config/brand";
import { useBodyScrollLock } from "../../composables/useBodyScrollLock";
import { useEscapeListener } from "../../composables/useEscapeListener";
import { useFocusRestore } from "../../composables/useFocusRestore";
import { LianButton } from "../../ui";
// Type-only re-export from the composable so the view does not reach into
// `src/api/*` directly. The composable owns the api seam (issue #795).
import type { ShareCardBase } from "./useShareCardPreview";

const props = withDefaults(
  defineProps<{
    open?: boolean;
    status?: "idle" | "loading" | "ready" | "error";
    card?: ShareCardBase | null;
    errorMessage?: string;
    canRetry?: boolean;
  }>(),
  {
    open: false,
    status: "idle",
    card: null,
    errorMessage: "",
    canRetry: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="overlay"
      class="share-card-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="SHARE_CARD_SHEET_LABEL"
      data-testid="share-card-sheet"
    >
      <div class="share-card-sheet__backdrop" @click="emit('close')"></div>
      <section class="share-card-sheet__panel">
        <header class="share-card-sheet__header">
          <h2>{{ SHARE_CARD_SHEET_TITLE }}</h2>
          <button
            class="share-card-sheet__close"
            type="button"
            :aria-label="SHARE_CARD_CANCEL"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div
          v-if="status === 'loading'"
          class="share-card-sheet__state"
          role="status"
          data-testid="share-card-loading"
        >
          {{ SHARE_CARD_LOADING }}
        </div>

        <div
          v-else-if="status === 'error'"
          class="share-card-sheet__state share-card-sheet__state--error"
          role="alert"
          data-testid="share-card-error"
        >
          <p>{{ errorMessage }}</p>
          <LianButton
            v-if="canRetry"
            size="sm"
            variant="tonal"
            data-testid="share-card-retry"
            @click="emit('retry')"
          >
            {{ SHARE_CARD_RETRY }}
          </LianButton>
        </div>

        <article
          v-else-if="status === 'ready' && card"
          class="share-card-sheet__card"
          data-testid="share-card-preview"
        >
          <img
            v-if="card.thumbnailUrl"
            class="share-card-sheet__thumb"
            :src="card.thumbnailUrl"
            :alt="SHARE_CARD_THUMBNAIL_ALT"
            loading="lazy"
          />
          <div class="share-card-sheet__text">
            <h3 class="share-card-sheet__title">{{ card.title }}</h3>
            <p v-if="card.summary" class="share-card-sheet__summary">{{ card.summary }}</p>
            <div class="share-card-sheet__meta">
              <span
                v-if="card.audienceLabel"
                class="share-card-sheet__audience"
                data-testid="share-card-audience"
              >
                {{ card.audienceLabel }}
              </span>
              <span v-if="card.authorName" class="share-card-sheet__author">
                {{ SHARE_CARD_AUTHOR_PREFIX }} {{ card.authorName }}
              </span>
            </div>
          </div>
        </article>

        <footer class="share-card-sheet__footer">
          <LianButton variant="ghost" size="md" @click="emit('close')">{{
            SHARE_CARD_CANCEL
          }}</LianButton>
          <LianButton
            variant="primary"
            size="md"
            :disabled="status !== 'ready' || !card"
            data-testid="share-card-confirm"
            @click="emit('confirm')"
          >
            {{ SHARE_CARD_CONFIRM }}
          </LianButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.share-card-sheet {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: end center;
}

.share-card-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.share-card-sheet__panel {
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

.share-card-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.share-card-sheet__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.share-card-sheet__close {
  border: 0;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--lian-muted);
}

.share-card-sheet__state {
  padding: var(--space-4) 0;
  text-align: center;
  color: var(--lian-muted);
  display: grid;
  gap: var(--space-2);
  justify-items: center;
}

.share-card-sheet__state--error {
  color: var(--lian-danger, #b3261e);
}

.share-card-sheet__card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface, rgba(0, 0, 0, 0.03));
}

.share-card-sheet__thumb {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: var(--radius-chip, 8px);
}

.share-card-sheet__text {
  display: grid;
  gap: var(--space-2);
}

.share-card-sheet__title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
}

.share-card-sheet__summary {
  margin: 0;
  font-size: 13px;
  color: var(--lian-muted);
  line-height: 1.5;
}

.share-card-sheet__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: 12px;
  color: var(--lian-muted);
}

.share-card-sheet__audience {
  padding: 2px 8px;
  border-radius: var(--radius-chip, 8px);
  background: var(--lian-primary-soft, rgba(0, 0, 0, 0.06));
  color: var(--lian-primary-deep, inherit);
  font-weight: 700;
}

.share-card-sheet__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
