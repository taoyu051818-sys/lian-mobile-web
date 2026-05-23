<script setup lang="ts">
/**
 * Help manage block (PRD V0.1 §6.5 / §11.3).
 *
 * Manager-side actions for help posts: link to an event, mark resolved, mark
 * closed. The parent keeps deciding whether the block belongs on-screen; this
 * component only applies the final action-surface visibility it was given.
 *
 * Status transitions follow `planHelpManage()` — the view never reasons
 * about HelpStatus directly. All copy comes from brand/i18n.
 */
import { computed, ref } from "vue";
import {
  HELP_MANAGE_BLOCK_LABEL,
  HELP_MANAGE_LINK_EVENT,
  HELP_MANAGE_LINK_EVENT_PLACEHOLDER,
  HELP_MANAGE_LINK_EVENT_HINT,
  HELP_MANAGE_LINK_EVENT_INVALID,
  HELP_MANAGE_RESOLVE,
  HELP_MANAGE_CLOSE,
  HELP_MANAGE_PENDING,
} from "../../config/brand";
import { parseEventTidInput, type HelpManagePlan } from "../../domain/helpManagePolicy";

const props = defineProps<{
  plan: HelpManagePlan;
  busy: boolean;
  actionError?: string;
  showLinkEvent?: boolean;
  showUnlinkEvent?: boolean;
  showResolve?: boolean;
  showClose?: boolean;
}>();

const emit = defineEmits<{
  linkEvent: [eventTid: number];
  unlinkEvent: [];
  resolve: [];
  close: [];
}>();

const linkInput = ref("");
const localError = ref("");

const allowed = computed(() => props.plan.allowed);
const canLink = computed(() => props.showLinkEvent ?? allowed.value.has("linkEvent"));
const canUnlink = computed(() => props.showUnlinkEvent ?? allowed.value.has("unlinkEvent"));
const canResolve = computed(() => props.showResolve ?? allowed.value.has("resolve"));
const canClose = computed(() => props.showClose ?? allowed.value.has("close"));
const hasVisibleActions = computed(
  () => canLink.value || canUnlink.value || canResolve.value || canClose.value,
);

function submitLink() {
  if (!canLink.value || props.busy) return;
  const tid = parseEventTidInput(linkInput.value);
  if (tid === null) {
    localError.value = HELP_MANAGE_LINK_EVENT_INVALID;
    return;
  }
  localError.value = "";
  emit("linkEvent", tid);
  linkInput.value = "";
}
</script>

<template>
  <section
    v-if="plan.canManage && hasVisibleActions"
    class="post-detail-help-manage"
    :aria-label="HELP_MANAGE_BLOCK_LABEL"
    data-testid="post-detail-help-manage"
  >
    <header class="post-detail-help-manage__header">
      <span class="post-detail-help-manage__title">{{ HELP_MANAGE_BLOCK_LABEL }}</span>
    </header>

    <div v-if="canLink" class="post-detail-help-manage__link" data-testid="help-manage-link-form">
      <p class="post-detail-help-manage__hint">{{ HELP_MANAGE_LINK_EVENT_HINT }}</p>
      <div class="post-detail-help-manage__row">
        <input
          v-model="linkInput"
          type="text"
          inputmode="numeric"
          class="post-detail-help-manage__input"
          :placeholder="HELP_MANAGE_LINK_EVENT_PLACEHOLDER"
          :disabled="busy"
          data-testid="help-manage-link-input"
          @keyup.enter="submitLink"
        />
        <button
          type="button"
          class="post-detail-help-manage__button post-detail-help-manage__button--primary"
          :disabled="busy || !linkInput.trim()"
          data-testid="help-manage-link-submit"
          @click="submitLink"
        >
          {{ busy ? HELP_MANAGE_PENDING : HELP_MANAGE_LINK_EVENT }}
        </button>
      </div>
      <p v-if="localError" class="post-detail-help-manage__error" role="alert">
        {{ localError }}
      </p>
    </div>

    <button
      v-if="canUnlink"
      type="button"
      class="post-detail-help-manage__button"
      :disabled="busy"
      data-testid="help-manage-unlink"
      @click="emit('unlinkEvent')"
    >
      {{ busy ? HELP_MANAGE_PENDING : HELP_MANAGE_LINK_EVENT }}
    </button>

    <div class="post-detail-help-manage__row post-detail-help-manage__row--terminal">
      <button
        v-if="canResolve"
        type="button"
        class="post-detail-help-manage__button post-detail-help-manage__button--resolve"
        :disabled="busy"
        data-testid="help-manage-resolve"
        @click="emit('resolve')"
      >
        {{ busy ? HELP_MANAGE_PENDING : HELP_MANAGE_RESOLVE }}
      </button>
      <button
        v-if="canClose"
        type="button"
        class="post-detail-help-manage__button post-detail-help-manage__button--close"
        :disabled="busy"
        data-testid="help-manage-close"
        @click="emit('close')"
      >
        {{ busy ? HELP_MANAGE_PENDING : HELP_MANAGE_CLOSE }}
      </button>
    </div>

    <p v-if="actionError" class="post-detail-help-manage__error" role="alert">
      {{ actionError }}
    </p>
  </section>
</template>

<style scoped>
.post-detail-help-manage {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: rgba(40, 88, 165, 0.06);
  border: 1px dashed rgba(40, 88, 165, 0.24);
}

.post-detail-help-manage__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-help-manage__title {
  color: var(--lian-ink);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.post-detail-help-manage__link {
  display: grid;
  gap: var(--space-2);
}

.post-detail-help-manage__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.post-detail-help-manage__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.post-detail-help-manage__row--terminal {
  margin-top: var(--space-1);
}

.post-detail-help-manage__input {
  flex: 1 1 8rem;
  min-height: 36px;
  padding: 0 var(--space-2);
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-surface-1, white);
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-help-manage__input:disabled {
  opacity: 0.6;
}

.post-detail-help-manage__button {
  appearance: none;
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-surface-1, rgba(255, 255, 255, 0.92));
  color: var(--lian-ink);
  height: 36px;
  padding: 0 var(--space-3);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.post-detail-help-manage__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.post-detail-help-manage__button--primary {
  background: var(--lian-accent, #2858a5);
  color: white;
  border-color: transparent;
}

.post-detail-help-manage__button--resolve {
  background: rgba(80, 160, 100, 0.16);
  color: #2f6f47;
  border-color: rgba(80, 160, 100, 0.32);
}

.post-detail-help-manage__button--close {
  background: rgba(120, 120, 120, 0.12);
  color: #444;
  border-color: rgba(120, 120, 120, 0.24);
}

.post-detail-help-manage__error {
  margin: 0;
  color: var(--lian-danger, #a14040);
  font-size: 13px;
}
</style>
