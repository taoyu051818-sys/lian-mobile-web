<script setup lang="ts">
/**
 * Errand order form view (issue #647).
 *
 * Single secret view with two routing modes — orderId set → render the
 * timeline (post-submit), merchantPostId set → render the form. The form
 * branches on the gate first (loading / error / blocked / ready) so users
 * never see the submit button when they cannot use it.
 *
 * On successful submit we hand the new orderId to the route singleton,
 * which flips the same secret view into its timeline branch — same view
 * key, no second registration needed in `useActiveView`.
 */
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import {
  ERRAND_ORDER_BACK,
  ERRAND_ORDER_BALANCE_LABEL,
  ERRAND_ORDER_DROPOFF_HINT,
  ERRAND_ORDER_DROPOFF_PLACEHOLDER,
  ERRAND_ORDER_DROPOFF_TITLE,
  ERRAND_ORDER_FEE_LABEL,
  ERRAND_ORDER_LOADING,
  ERRAND_ORDER_LOAD_ERROR,
  ERRAND_ORDER_MODE_BATCH_HINT,
  ERRAND_ORDER_MODE_DEDICATED_HINT,
  ERRAND_ORDER_MODE_TITLE,
  ERRAND_ORDER_NOTES_PLACEHOLDER,
  ERRAND_ORDER_NOTES_TITLE,
  ERRAND_ORDER_PICKUP_HINT,
  ERRAND_ORDER_PICKUP_PLACEHOLDER,
  ERRAND_ORDER_PICKUP_TITLE,
  ERRAND_ORDER_POINTS_SUFFIX,
  ERRAND_ORDER_RETRY,
  ERRAND_ORDER_SECTION_LABEL,
  ERRAND_ORDER_SUBMIT,
  ERRAND_ORDER_SUBMITTING,
} from "../../config/brand";
import type { ErrandMode } from "../../types/post-extensions";
import ErrandOrderGate from "./ErrandOrderGate.vue";
import ErrandOrderTimelineView from "./ErrandOrderTimelineView.vue";
import { useErrandOrderDraft } from "./useErrandOrderDraft";
import { useErrandOrderRoute } from "./useErrandOrderRoute";
import { modeLabel } from "./errand-format";
import { useActiveView } from "../../app/useActiveView";

const route = useErrandOrderRoute();
const { setActiveView } = useActiveView();

const initialMerchantPostId = route.merchantPostId.value || 0;
// Destructure refs so the template can read them via auto-unwrap instead of
// `draftCtx.foo.value` everywhere — Vue's auto-unwrap only applies to refs
// returned at the top level of <script setup>, not nested keys on an object.
const {
  draft,
  gate,
  gateLoading,
  gateLoaded,
  gateError,
  submitting,
  submitError,
  canSubmit,
  refresh: refreshDraft,
  setMode,
  setNotes,
  setPickup,
  setDropoff,
  submit: submitDraft,
  reset: resetDraft,
} = useErrandOrderDraft(initialMerchantPostId);

const isTimelineMode = computed(() => Boolean(route.orderId.value));

const pickupLabel = computed({
  get: () => draft.value.pickupLocation?.label || "",
  set: (next: string) => setPickup(next),
});

const dropoffLabel = computed({
  get: () => draft.value.dropoffLocation?.label || "",
  set: (next: string) => setDropoff(next),
});

const notesValue = computed({
  get: () => draft.value.notes,
  set: (next: string) => setNotes(next),
});

const modes: { value: ErrandMode; hint: string }[] = [
  { value: "dedicated", hint: ERRAND_ORDER_MODE_DEDICATED_HINT },
  { value: "meal_peak_batch", hint: ERRAND_ORDER_MODE_BATCH_HINT },
];

onMounted(() => {
  if (!isTimelineMode.value && route.merchantPostId.value) {
    void refreshDraft(route.merchantPostId.value);
  }
});

// When the merchant CTA opens this view a second time for a different post,
// `useActiveView` keeps the same view alive — re-pull eligibility for the new
// merchant id so the form/gate reflect the right merchant.
watch(
  () => route.merchantPostId.value,
  (next) => {
    if (next && !isTimelineMode.value) {
      resetDraft(next);
      void refreshDraft(next);
    }
  },
);

// Belt-and-suspenders: the route singleton lives at module scope, so a
// tab-bar switch (which unmounts this view without going through the close
// button) would otherwise leave merchantPostId/orderId set, and the next
// re-entry would render with stale state. Reset on unmount so the view is
// always re-armed via an explicit enterFor* call.
onBeforeUnmount(() => {
  route.reset();
});

function handleClose() {
  const back = route.origin.value;
  route.reset();
  setActiveView(back);
}

function goLogin() {
  // The auth panel lives on the profile tab — sending the user there gives
  // them the login surface. We deliberately do NOT reset the route here:
  // once they finish logging in and return to errand-order, we want the
  // merchantPostId still in place so the form opens against the right post.
  setActiveView("profile");
}

function goVerify() {
  setActiveView("verification");
}

function goWallet() {
  setActiveView("profile");
}

async function handleSubmit() {
  const orderId = await submitDraft();
  if (orderId) {
    route.enterForOrder(orderId);
  }
}

function handleTimelineBack() {
  const back = route.origin.value;
  route.reset();
  setActiveView(back);
}
</script>

<template>
  <ErrandOrderTimelineView
    v-if="isTimelineMode"
    :order-id="route.orderId.value"
    @back="handleTimelineBack"
  />

  <section
    v-else
    class="errand-order-view"
    :aria-label="ERRAND_ORDER_SECTION_LABEL"
    data-testid="errand-order-view"
  >
    <header class="errand-order-view__header">
      <button
        type="button"
        class="errand-order-view__back"
        data-testid="errand-order-back"
        @click="handleClose"
      >
        {{ ERRAND_ORDER_BACK }}
      </button>
      <h2>{{ ERRAND_ORDER_SECTION_LABEL }}</h2>
    </header>

    <p v-if="gateLoading && !gateLoaded" class="errand-order-view__status" role="status">
      {{ ERRAND_ORDER_LOADING }}
    </p>

    <p
      v-else-if="gateError"
      class="errand-order-view__status is-error"
      role="alert"
      data-testid="errand-order-load-error"
    >
      {{ gateError || ERRAND_ORDER_LOAD_ERROR }}
      <button
        type="button"
        class="errand-order-view__retry"
        @click="() => void refreshDraft(route.merchantPostId.value || 0)"
      >
        {{ ERRAND_ORDER_RETRY }}
      </button>
    </p>

    <ErrandOrderGate
      v-else-if="gateLoaded && !gate.ok"
      :gate="gate"
      data-testid="errand-order-view-gate"
      @go-login="goLogin"
      @go-verify="goVerify"
      @go-wallet="goWallet"
      @retry="() => void refreshDraft(route.merchantPostId.value || 0)"
    />

    <form
      v-else-if="gateLoaded"
      class="errand-order-view__form"
      data-testid="errand-order-form"
      @submit.prevent="() => void handleSubmit()"
    >
      <label class="errand-order-view__field">
        <span>{{ ERRAND_ORDER_PICKUP_TITLE }}</span>
        <input
          v-model="pickupLabel"
          :placeholder="ERRAND_ORDER_PICKUP_PLACEHOLDER"
          data-testid="errand-order-pickup-input"
          required
        />
        <small>{{ ERRAND_ORDER_PICKUP_HINT }}</small>
      </label>

      <label class="errand-order-view__field">
        <span>{{ ERRAND_ORDER_DROPOFF_TITLE }}</span>
        <input
          v-model="dropoffLabel"
          :placeholder="ERRAND_ORDER_DROPOFF_PLACEHOLDER"
          data-testid="errand-order-dropoff-input"
          required
        />
        <small>{{ ERRAND_ORDER_DROPOFF_HINT }}</small>
      </label>

      <label class="errand-order-view__field">
        <span>{{ ERRAND_ORDER_NOTES_TITLE }}</span>
        <textarea
          v-model="notesValue"
          :placeholder="ERRAND_ORDER_NOTES_PLACEHOLDER"
          rows="3"
          data-testid="errand-order-notes-input"
        />
      </label>

      <fieldset class="errand-order-view__modes">
        <legend>{{ ERRAND_ORDER_MODE_TITLE }}</legend>
        <label
          v-for="mode in modes"
          :key="mode.value"
          class="errand-order-view__mode"
          :class="{ 'is-selected': draft.mode === mode.value }"
        >
          <input
            type="radio"
            name="errand-order-mode"
            :value="mode.value"
            :checked="draft.mode === mode.value"
            @change="setMode(mode.value)"
          />
          <span class="errand-order-view__mode-label">{{ modeLabel(mode.value) }}</span>
          <small>{{ mode.hint }}</small>
        </label>
      </fieldset>

      <dl class="errand-order-view__totals">
        <div>
          <dt>{{ ERRAND_ORDER_FEE_LABEL }}</dt>
          <dd>{{ gate.estimatedFeePoints }} {{ ERRAND_ORDER_POINTS_SUFFIX }}</dd>
        </div>
        <div>
          <dt>{{ ERRAND_ORDER_BALANCE_LABEL }}</dt>
          <dd>{{ gate.availablePoints }} {{ ERRAND_ORDER_POINTS_SUFFIX }}</dd>
        </div>
      </dl>

      <p
        v-if="submitError"
        class="errand-order-view__status is-error"
        role="alert"
        data-testid="errand-order-submit-error"
      >
        {{ submitError }}
      </p>

      <button
        type="submit"
        class="errand-order-view__submit"
        :disabled="!canSubmit"
        data-testid="errand-order-submit"
      >
        {{ submitting ? ERRAND_ORDER_SUBMITTING : ERRAND_ORDER_SUBMIT }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.errand-order-view {
  display: grid;
  gap: var(--space-3);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.errand-order-view__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.errand-order-view__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.errand-order-view__back {
  appearance: none;
  border: 0;
  background: rgba(255, 255, 255, 0.72);
  border-radius: var(--radius-chip, 999px);
  color: var(--lian-ink);
  font-weight: 800;
  height: 32px;
  padding: 0 var(--space-3);
}

.errand-order-view__status {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(120, 120, 120, 0.12);
  color: var(--lian-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.errand-order-view__status.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.errand-order-view__retry {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 800;
  padding: 4px var(--space-2);
}

.errand-order-view__form {
  display: grid;
  gap: var(--space-3);
}

.errand-order-view__field {
  display: grid;
  gap: var(--space-1);
}

.errand-order-view__field span {
  font-weight: 800;
  font-size: 13px;
}

.errand-order-view__field input,
.errand-order-view__field textarea {
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  box-sizing: border-box;
}

.errand-order-view__field small {
  color: var(--lian-muted);
  font-size: 12px;
}

.errand-order-view__modes {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  background: var(--lian-card-strong);
}

.errand-order-view__modes legend {
  font-weight: 800;
  font-size: 13px;
  padding: 0 var(--space-1);
}

.errand-order-view__mode {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(120, 120, 120, 0.06);
  cursor: pointer;
}

.errand-order-view__mode.is-selected {
  background: rgba(31, 167, 160, 0.1);
  border: 1px solid rgba(31, 167, 160, 0.32);
}

.errand-order-view__mode input {
  margin-top: 4px;
}

.errand-order-view__mode-label {
  font-weight: 800;
  font-size: 14px;
}

.errand-order-view__mode small {
  grid-column: 2 / -1;
  color: var(--lian-muted);
  font-size: 12px;
}

.errand-order-view__totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.6);
}

.errand-order-view__totals dt {
  color: var(--lian-muted);
  font-size: 12px;
}

.errand-order-view__totals dd {
  margin: 0;
  font-weight: 800;
  font-size: 16px;
  color: var(--lian-ink);
}

.errand-order-view__submit {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.92);
  color: #fff;
  font-weight: 900;
  height: 44px;
}

.errand-order-view__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
