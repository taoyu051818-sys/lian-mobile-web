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
 *
 * mw#827 PR-3: every author-side action button derives the 6-state CTA
 * vocabulary from `DetailCtaButton` so the manage row reads through the
 * same ARIA contract as vote / errand. Per-button "active" tracking
 * keeps the spinner localized to the action that is actually mid-flight,
 * the other rows go muted but do not spin (mirrors the trade-manage
 * block in this PR).
 */
import { computed, ref } from "vue";
import {
  HELP_MANAGE_BLOCK_LABEL,
  HELP_MANAGE_CLOSE,
  HELP_MANAGE_LINK_EVENT,
  HELP_MANAGE_LINK_EVENT_HINT,
  HELP_MANAGE_LINK_EVENT_INVALID,
  HELP_MANAGE_LINK_EVENT_PLACEHOLDER,
  HELP_MANAGE_PENDING,
  HELP_MANAGE_RESOLVE,
} from "../../config/brand";
import { parseEventTidInput, type HelpManagePlan } from "../../domain/helpManagePolicy";
import DetailCtaButton from "./DetailCtaButton.vue";
import { selectHelpManageCtaState } from "./detailCtaState";

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

type ManageActionId = "link" | "unlink" | "resolve" | "close";

const linkInput = ref("");
const localError = ref("");
// Per-action spin tracking — only the row the user clicked spins, the rest
// turn muted. Reset on the next click; `busy` tracks the actual fetch and
// drives the disabled state for everything else.
const activeAction = ref<ManageActionId | null>(null);

const allowed = computed(() => props.plan.allowed);
const canLink = computed(() => props.showLinkEvent ?? allowed.value.has("linkEvent"));
const canUnlink = computed(() => props.showUnlinkEvent ?? allowed.value.has("unlinkEvent"));
const canResolve = computed(() => props.showResolve ?? allowed.value.has("resolve"));
const canClose = computed(() => props.showClose ?? allowed.value.has("close"));
const hasVisibleActions = computed(
  () => canLink.value || canUnlink.value || canResolve.value || canClose.value,
);

const ctaState = (id: ManageActionId) =>
  computed(() =>
    selectHelpManageCtaState({
      busy: props.busy,
      active: activeAction.value === id,
      hasError: Boolean(props.actionError) && activeAction.value === id,
    }),
  );

const linkState = ctaState("link");
const unlinkState = ctaState("unlink");
const resolveState = ctaState("resolve");
const closeState = ctaState("close");

const linkLabel = computed(() => (props.busy ? HELP_MANAGE_PENDING : HELP_MANAGE_LINK_EVENT));
const unlinkLabel = computed(() => (props.busy ? HELP_MANAGE_PENDING : HELP_MANAGE_LINK_EVENT));
const resolveLabel = computed(() => (props.busy ? HELP_MANAGE_PENDING : HELP_MANAGE_RESOLVE));
const closeLabel = computed(() => (props.busy ? HELP_MANAGE_PENDING : HELP_MANAGE_CLOSE));

function submitLink() {
  if (!canLink.value || props.busy) return;
  const tid = parseEventTidInput(linkInput.value);
  if (tid === null) {
    localError.value = HELP_MANAGE_LINK_EVENT_INVALID;
    return;
  }
  localError.value = "";
  activeAction.value = "link";
  emit("linkEvent", tid);
  linkInput.value = "";
}

function handleUnlink() {
  if (!canUnlink.value || props.busy) return;
  activeAction.value = "unlink";
  emit("unlinkEvent");
}

function handleResolve() {
  if (!canResolve.value || props.busy) return;
  activeAction.value = "resolve";
  emit("resolve");
}

function handleClose() {
  if (!canClose.value || props.busy) return;
  activeAction.value = "close";
  emit("close");
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
        <DetailCtaButton
          :label="linkLabel"
          :state="linkState.value"
          test-id="detail-cta-help-link-event"
          @click="submitLink"
        />
      </div>
      <p
        v-if="localError"
        class="post-detail-help-manage__error"
        role="alert"
        data-testid="help-manage-link-error"
      >
        {{ localError }}
      </p>
    </div>

    <DetailCtaButton
      v-if="canUnlink"
      :label="unlinkLabel"
      :state="unlinkState.value"
      test-id="detail-cta-help-unlink-event"
      @click="handleUnlink"
    />

    <div class="post-detail-help-manage__row post-detail-help-manage__row--terminal">
      <DetailCtaButton
        v-if="canResolve"
        :label="resolveLabel"
        :state="resolveState.value"
        test-id="detail-cta-help-resolve"
        @click="handleResolve"
      />
      <DetailCtaButton
        v-if="canClose"
        :label="closeLabel"
        :state="closeState.value"
        test-id="detail-cta-help-close"
        @click="handleClose"
      />
    </div>

    <p
      v-if="actionError"
      class="post-detail-help-manage__error"
      role="alert"
      data-testid="post-detail-help-manage-error"
    >
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

.post-detail-help-manage__error {
  margin: 0;
  color: var(--lian-danger, #a14040);
  font-size: 13px;
}
</style>
