<script setup lang="ts">
/**
 * Server酱 external notification settings block (ps#504 I2).
 *
 * Mounts inside ProfileView between the existing ProfileSettingsBlock and the
 * profile tabs. Three states render under one root section:
 *
 *  1. Unbound — primary "绑定" CTA + manual paste affordance.
 *  2. Bound + enabled — bound timestamp, unbind button, two reminder toggles.
 *  3. Bound + disabled — "已绑定但已停用" + unbind button. Toggles hidden.
 *
 * Layer purity: this view imports composables only (useServerChanBinding +
 * useServerChanPreferences); it does NOT reach into `src/api/serverchan`
 * directly. The composables own the api seam.
 */

import { computed, onMounted, ref } from "vue";
import {
  SERVERCHAN_AUTH_REQUIRED,
  SERVERCHAN_BIND_BUTTON,
  SERVERCHAN_BIND_MANUAL_CANCEL,
  SERVERCHAN_BIND_MANUAL_HINT,
  SERVERCHAN_BIND_MANUAL_LABEL,
  SERVERCHAN_BIND_MANUAL_OPEN,
  SERVERCHAN_BIND_MANUAL_PLACEHOLDER,
  SERVERCHAN_BIND_MANUAL_SUBMIT,
  SERVERCHAN_BIND_MANUAL_SUBMITTING,
  SERVERCHAN_BIND_SUCCESS,
  SERVERCHAN_BOUND_AT_PREFIX,
  SERVERCHAN_PREFERENCES_LOAD_FAILED,
  SERVERCHAN_RELOAD,
  SERVERCHAN_SECTION_HELPER,
  SERVERCHAN_SECTION_LABEL,
  SERVERCHAN_STATE_BOUND,
  SERVERCHAN_STATE_BOUND_DISABLED,
  SERVERCHAN_STATE_UNBOUND,
  SERVERCHAN_TOGGLE_EVENT_START_HINT,
  SERVERCHAN_TOGGLE_EVENT_START_LABEL,
  SERVERCHAN_TOGGLE_REWARD_HINT,
  SERVERCHAN_TOGGLE_REWARD_LABEL,
  SERVERCHAN_UNBIND_BUTTON,
  SERVERCHAN_UNBIND_CONFIRM,
  SERVERCHAN_UNBIND_CONFIRM_PROMPT,
} from "../../config/brand";
import { useToast } from "../../ui";
import { useServerChanBinding } from "./useServerChanBinding";
import { useServerChanPreferences } from "./useServerChanPreferences";

interface Props {
  /** Skip the load on mount when the user is not signed in. */
  isAuthenticated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isAuthenticated: true,
});

const toast = useToast();
const binding = useServerChanBinding();
const preferences = useServerChanPreferences();

const unbindArmed = ref(false);

const bindingTimestamp = computed(() => {
  const at = binding.binding.value?.createdAt;
  if (!at) return "";
  // Best-effort localized rendering. If the input is a malformed timestamp,
  // fall back to the raw string rather than blanking the row entirely.
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return at;
  return parsed.toLocaleString("zh-CN", { hour12: false });
});

const stateLabel = computed(() => {
  if (!binding.isBound.value) return SERVERCHAN_STATE_UNBOUND;
  if (binding.isEnabled.value) return SERVERCHAN_STATE_BOUND;
  return SERVERCHAN_STATE_BOUND_DISABLED;
});

const showReminderToggles = computed(
  () => binding.isBound.value && binding.isEnabled.value && preferences.isReady.value,
);

function armUnbind() {
  unbindArmed.value = true;
}

function cancelUnbind() {
  unbindArmed.value = false;
}

async function handleStartBind() {
  if (!props.isAuthenticated) {
    toast.warning(SERVERCHAN_AUTH_REQUIRED);
    return;
  }
  await binding.startBindFlow();
}

function handleOpenManual() {
  binding.openManualForm();
}

function handleCancelManual() {
  binding.closeManualForm();
}

async function handleSubmitManual() {
  const ok = await binding.submitManualKey();
  if (ok) {
    toast.success(SERVERCHAN_BIND_SUCCESS);
    // Re-pull preferences now that the binding is in place.
    void preferences.load();
  }
}

async function confirmUnbind() {
  unbindArmed.value = false;
  await binding.unbindNow();
}

async function handleToggleEventStart(event: Event) {
  const target = event.target as HTMLInputElement;
  await preferences.toggle("eventStartingReminder", target.checked);
}

async function handleToggleReward(event: Event) {
  const target = event.target as HTMLInputElement;
  await preferences.toggle("rewardSettledReminder", target.checked);
}

onMounted(async () => {
  if (!props.isAuthenticated) return;
  await binding.load();
  // Consume the post-callback hash query so the user gets a toast or the
  // manual-paste form pre-opened. The auth flow forwards back to
  // `#/profile?serverchan=bound` (or `&serverchan=manual`) and we react here.
  const signal = binding.consumeCallbackSignal();
  if (signal === "bound") {
    toast.success(SERVERCHAN_BIND_SUCCESS);
  } else if (signal === "manual") {
    binding.openManualForm();
  }
  if (binding.isBound.value) {
    void preferences.load();
  }
});
</script>

<template>
  <section
    class="serverchan-block"
    :aria-label="SERVERCHAN_SECTION_LABEL"
    data-testid="serverchan-settings-block"
  >
    <header class="serverchan-block__head">
      <h2>{{ SERVERCHAN_SECTION_LABEL }}</h2>
      <span
        class="serverchan-block__state"
        :data-state="
          binding.isBound.value ? (binding.isEnabled.value ? 'bound' : 'disabled') : 'unbound'
        "
        data-testid="serverchan-state-label"
      >
        {{ stateLabel }}
      </span>
    </header>

    <p class="serverchan-block__helper" data-testid="serverchan-helper">
      {{ SERVERCHAN_SECTION_HELPER }}
    </p>

    <p
      v-if="binding.loadError.value"
      class="serverchan-block__error"
      role="alert"
      data-testid="serverchan-load-error"
    >
      {{ binding.loadError.value }}
      <button type="button" @click="binding.load()">{{ SERVERCHAN_RELOAD }}</button>
    </p>

    <!-- Unbound state -->
    <div v-if="!binding.isBound.value" class="serverchan-block__panel" data-state="unbound">
      <button
        type="button"
        class="serverchan-block__primary"
        :disabled="binding.loading.value"
        data-testid="serverchan-bind-button"
        @click="() => void handleStartBind()"
      >
        {{ SERVERCHAN_BIND_BUTTON }}
      </button>

      <p class="serverchan-block__manual-hint">{{ SERVERCHAN_BIND_MANUAL_HINT }}</p>

      <button
        v-if="!binding.manualOpen.value"
        type="button"
        class="serverchan-block__secondary"
        data-testid="serverchan-manual-open"
        @click="handleOpenManual"
      >
        {{ SERVERCHAN_BIND_MANUAL_OPEN }}
      </button>

      <form
        v-else
        class="serverchan-block__manual-form"
        data-testid="serverchan-manual-form"
        @submit.prevent="() => void handleSubmitManual()"
      >
        <label class="serverchan-block__field">
          <span>{{ SERVERCHAN_BIND_MANUAL_LABEL }}</span>
          <!--
            Field intentionally type="password" + autocomplete="off" so the
            value is masked by default and password managers do not store it.
            The composable holds the only reactive ref and clears it after a
            successful POST. The value is NEVER logged or echoed elsewhere.
          -->
          <input
            v-model="binding.manualKey.value"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="SERVERCHAN_BIND_MANUAL_PLACEHOLDER"
            :disabled="binding.submitting.value"
            data-testid="serverchan-manual-input"
          />
        </label>
        <p
          v-if="binding.submitError.value"
          class="serverchan-block__error"
          role="alert"
          data-testid="serverchan-submit-error"
        >
          {{ binding.submitError.value }}
        </p>
        <div class="serverchan-block__manual-actions">
          <button
            type="button"
            class="serverchan-block__secondary"
            :disabled="binding.submitting.value"
            data-testid="serverchan-manual-cancel"
            @click="handleCancelManual"
          >
            {{ SERVERCHAN_BIND_MANUAL_CANCEL }}
          </button>
          <button
            type="submit"
            class="serverchan-block__primary"
            :disabled="binding.submitting.value"
            data-testid="serverchan-manual-submit"
          >
            {{
              binding.submitting.value
                ? SERVERCHAN_BIND_MANUAL_SUBMITTING
                : SERVERCHAN_BIND_MANUAL_SUBMIT
            }}
          </button>
        </div>
      </form>
    </div>

    <!-- Bound state (enabled or disabled) -->
    <div v-else class="serverchan-block__panel" data-state="bound">
      <p
        v-if="bindingTimestamp"
        class="serverchan-block__timestamp"
        data-testid="serverchan-bound-at"
      >
        {{ SERVERCHAN_BOUND_AT_PREFIX }}{{ bindingTimestamp }}
      </p>
      <button
        v-if="!unbindArmed"
        type="button"
        class="serverchan-block__secondary"
        :disabled="binding.unbindBusy.value"
        data-testid="serverchan-unbind-button"
        @click="armUnbind"
      >
        {{ SERVERCHAN_UNBIND_BUTTON }}
      </button>
      <div
        v-else
        class="serverchan-block__unbind-confirm"
        data-testid="serverchan-unbind-confirm"
        role="alertdialog"
      >
        <p class="serverchan-block__unbind-prompt">{{ SERVERCHAN_UNBIND_CONFIRM }}</p>
        <div class="serverchan-block__manual-actions">
          <button
            type="button"
            class="serverchan-block__secondary"
            :disabled="binding.unbindBusy.value"
            data-testid="serverchan-unbind-cancel"
            @click="cancelUnbind"
          >
            {{ SERVERCHAN_BIND_MANUAL_CANCEL }}
          </button>
          <button
            type="button"
            class="serverchan-block__primary"
            :disabled="binding.unbindBusy.value"
            data-testid="serverchan-unbind-confirm-button"
            @click="() => void confirmUnbind()"
          >
            {{ SERVERCHAN_UNBIND_CONFIRM_PROMPT }}
          </button>
        </div>
      </div>
    </div>

    <!--
      Reminder toggles only render when bound + enabled + preferences loaded.
      `bound === false` gating mirrors the contract from the issue brief:
      reminder toggles are meaningless when there is no channel to push to.
    -->
    <dl
      v-if="showReminderToggles"
      class="serverchan-block__toggles"
      data-testid="serverchan-toggles"
      :aria-busy="preferences.saving.value"
    >
      <div class="serverchan-block__toggle-row" data-setting="eventStartingReminder">
        <div>
          <dt>{{ SERVERCHAN_TOGGLE_EVENT_START_LABEL }}</dt>
          <dd>{{ SERVERCHAN_TOGGLE_EVENT_START_HINT }}</dd>
        </div>
        <label class="serverchan-block__toggle">
          <input
            type="checkbox"
            data-testid="serverchan-toggle-event-start"
            :checked="preferences.preferences.value?.eventStartingReminder ?? false"
            :disabled="preferences.saving.value"
            @change="(event) => void handleToggleEventStart(event)"
          />
          <span aria-hidden="true"></span>
        </label>
      </div>

      <div class="serverchan-block__toggle-row" data-setting="rewardSettledReminder">
        <div>
          <dt>{{ SERVERCHAN_TOGGLE_REWARD_LABEL }}</dt>
          <dd>{{ SERVERCHAN_TOGGLE_REWARD_HINT }}</dd>
        </div>
        <label class="serverchan-block__toggle">
          <input
            type="checkbox"
            data-testid="serverchan-toggle-reward"
            :checked="preferences.preferences.value?.rewardSettledReminder ?? false"
            :disabled="preferences.saving.value"
            @change="(event) => void handleToggleReward(event)"
          />
          <span aria-hidden="true"></span>
        </label>
      </div>
    </dl>

    <p
      v-if="preferences.loadError.value && binding.isBound.value"
      class="serverchan-block__error"
      role="alert"
      data-testid="serverchan-prefs-load-error"
    >
      {{ preferences.loadError.value || SERVERCHAN_PREFERENCES_LOAD_FAILED }}
      <button type="button" @click="() => void preferences.load()">{{ SERVERCHAN_RELOAD }}</button>
    </p>

    <p
      v-if="preferences.saveError.value"
      class="serverchan-block__error"
      role="alert"
      data-testid="serverchan-prefs-save-error"
    >
      {{ preferences.saveError.value }}
    </p>
  </section>
</template>

<style scoped>
.serverchan-block {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 167, 160, 0.14);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.serverchan-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.serverchan-block__head h2 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.serverchan-block__state {
  padding: 2px 8px;
  border-radius: var(--radius-chip, 8px);
  background: rgba(120, 120, 120, 0.12);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
}

.serverchan-block__state[data-state="bound"] {
  background: rgba(31, 167, 160, 0.12);
  color: rgb(15, 109, 105);
}

.serverchan-block__state[data-state="disabled"] {
  background: rgba(255, 159, 67, 0.12);
  color: rgb(170, 84, 0);
}

.serverchan-block__helper {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.serverchan-block__error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(255, 159, 67, 0.32);
  border-radius: var(--radius-3);
  background: rgba(255, 159, 67, 0.1);
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 700;
}

.serverchan-block__error button {
  min-height: 28px;
  margin-left: var(--space-2);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.74);
  color: currentColor;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.serverchan-block__panel {
  display: grid;
  gap: var(--space-2);
}

.serverchan-block__primary {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.92);
  color: #fff;
  font-weight: 900;
  height: 40px;
  padding: 0 var(--space-3);
  cursor: pointer;
}

.serverchan-block__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.serverchan-block__secondary {
  appearance: none;
  border: 1px solid rgba(31, 41, 51, 0.16);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 800;
  height: 36px;
  padding: 0 var(--space-3);
  cursor: pointer;
}

.serverchan-block__secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.serverchan-block__manual-hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.serverchan-block__manual-form {
  display: grid;
  gap: var(--space-2);
}

.serverchan-block__field {
  display: grid;
  gap: var(--space-1);
}

.serverchan-block__field span {
  font-weight: 800;
  font-size: 13px;
}

.serverchan-block__field input {
  width: 100%;
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lian-border, rgba(31, 41, 51, 0.16));
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  box-sizing: border-box;
}

.serverchan-block__manual-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.serverchan-block__timestamp {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.serverchan-block__toggles {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.serverchan-block__toggle-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3);
  align-items: center;
}

.serverchan-block__toggle-row dt {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 900;
}

.serverchan-block__toggle-row dd {
  margin: 4px 0 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.serverchan-block__toggle {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 24px;
  border-radius: var(--radius-chip, 999px);
}

.serverchan-block__toggle input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.serverchan-block__toggle span {
  display: inline-block;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 41, 51, 0.18);
  transition: background var(--motion-fast) var(--motion-ease-standard);
}

.serverchan-block__toggle span::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: var(--shadow-card);
  transition: transform var(--motion-fast) var(--motion-ease-standard);
}

.serverchan-block__toggle input:checked + span {
  background: rgba(31, 167, 160, 0.7);
}

.serverchan-block__toggle input:checked + span::after {
  transform: translateX(16px);
}

.serverchan-block__toggle input:disabled + span {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
