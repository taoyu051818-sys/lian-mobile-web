<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  PROFILE_SETTINGS_SECTION_LABEL,
  PROFILE_SETTINGS_NOTIFICATION_LABEL,
  PROFILE_SETTINGS_NOTIFICATION_HINT,
  PROFILE_SETTINGS_VISIBILITY_LABEL,
  PROFILE_SETTINGS_VISIBILITY_HINT,
  PROFILE_SETTINGS_VISIBILITY_PUBLIC,
  PROFILE_SETTINGS_VISIBILITY_CAMPUS,
  PROFILE_SETTINGS_VISIBILITY_PRIVATE,
  PROFILE_SETTINGS_MENTIONS_LABEL,
  PROFILE_SETTINGS_MENTIONS_HINT,
  PROFILE_SETTINGS_LOAD_ERROR,
  PROFILE_SETTINGS_PATCH_ERROR,
  PROFILE_SETTINGS_SAVING,
  PROFILE_SETTINGS_RELOAD,
} from "../../config/brand";
import { fetchProfileSettings, patchProfileSettings } from "../../api/profile";
import type { ProfileSettings, ProfileSettingsPatch, ProfileVisibility } from "../../types/profile";

interface VisibilityOption {
  value: ProfileVisibility;
  label: string;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { value: "public", label: PROFILE_SETTINGS_VISIBILITY_PUBLIC },
  { value: "campus", label: PROFILE_SETTINGS_VISIBILITY_CAMPUS },
  { value: "private", label: PROFILE_SETTINGS_VISIBILITY_PRIVATE },
];

const settings = ref<ProfileSettings | null>(null);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");

const isReady = computed(() => settings.value !== null && !loading.value);

async function loadSettings() {
  loading.value = true;
  errorMessage.value = "";
  try {
    settings.value = await fetchProfileSettings();
  } catch {
    settings.value = null;
    errorMessage.value = PROFILE_SETTINGS_LOAD_ERROR;
  } finally {
    loading.value = false;
  }
}

async function applyPatch(patch: ProfileSettingsPatch) {
  if (!settings.value || saving.value) return;
  const previous = { ...settings.value };
  // Optimistic update so the toggle / select feels immediate. Revert
  // on backend rejection so the UI never falls out of sync with /me/settings.
  settings.value = { ...previous, ...patch };
  saving.value = true;
  errorMessage.value = "";
  try {
    settings.value = await patchProfileSettings(patch);
  } catch {
    settings.value = previous;
    errorMessage.value = PROFILE_SETTINGS_PATCH_ERROR;
  } finally {
    saving.value = false;
  }
}

function onNotificationToggle(event: Event) {
  const target = event.target as HTMLInputElement;
  void applyPatch({ notificationEnabled: target.checked });
}

function onMentionsToggle(event: Event) {
  const target = event.target as HTMLInputElement;
  void applyPatch({ allowMessageMentions: target.checked });
}

function onVisibilityChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = target.value as ProfileVisibility;
  void applyPatch({ profileVisibility: value });
}

onMounted(() => {
  void loadSettings();
});

defineExpose({ reload: loadSettings });
</script>

<template>
  <section
    class="profile-settings-block"
    :aria-label="PROFILE_SETTINGS_SECTION_LABEL"
    data-testid="profile-settings-block"
  >
    <header class="profile-settings-block__head">
      <h2>{{ PROFILE_SETTINGS_SECTION_LABEL }}</h2>
      <span
        v-if="saving"
        class="profile-settings-block__saving"
        role="status"
        aria-live="polite"
        data-testid="profile-settings-saving"
      >
        {{ PROFILE_SETTINGS_SAVING }}
      </span>
    </header>

    <p
      v-if="errorMessage"
      class="profile-settings-block__error"
      role="alert"
      data-testid="profile-settings-error"
    >
      {{ errorMessage }}
      <button v-if="!settings" type="button" @click="loadSettings">
        {{ PROFILE_SETTINGS_RELOAD }}
      </button>
    </p>

    <dl v-if="isReady && settings" class="profile-settings-block__list" :aria-busy="saving">
      <div class="profile-settings-block__row" data-setting="notificationEnabled">
        <div>
          <dt>{{ PROFILE_SETTINGS_NOTIFICATION_LABEL }}</dt>
          <dd>{{ PROFILE_SETTINGS_NOTIFICATION_HINT }}</dd>
        </div>
        <label class="profile-settings-block__toggle">
          <input
            type="checkbox"
            data-testid="profile-settings-notification"
            :checked="settings.notificationEnabled"
            :disabled="saving"
            @change="onNotificationToggle"
          />
          <span aria-hidden="true"></span>
        </label>
      </div>

      <div class="profile-settings-block__row" data-setting="profileVisibility">
        <div>
          <dt>{{ PROFILE_SETTINGS_VISIBILITY_LABEL }}</dt>
          <dd>{{ PROFILE_SETTINGS_VISIBILITY_HINT }}</dd>
        </div>
        <select
          class="profile-settings-block__select"
          data-testid="profile-settings-visibility"
          :value="settings.profileVisibility"
          :disabled="saving"
          @change="onVisibilityChange"
        >
          <option v-for="option in VISIBILITY_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="profile-settings-block__row" data-setting="allowMessageMentions">
        <div>
          <dt>{{ PROFILE_SETTINGS_MENTIONS_LABEL }}</dt>
          <dd>{{ PROFILE_SETTINGS_MENTIONS_HINT }}</dd>
        </div>
        <label class="profile-settings-block__toggle">
          <input
            type="checkbox"
            data-testid="profile-settings-mentions"
            :checked="settings.allowMessageMentions"
            :disabled="saving"
            @change="onMentionsToggle"
          />
          <span aria-hidden="true"></span>
        </label>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.profile-settings-block {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 167, 160, 0.14);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.profile-settings-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.profile-settings-block__head h2 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.profile-settings-block__saving {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
}

.profile-settings-block__error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(255, 159, 67, 0.32);
  border-radius: var(--radius-3);
  background: rgba(255, 159, 67, 0.1);
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 700;
}

.profile-settings-block__error button {
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

.profile-settings-block__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.profile-settings-block__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3);
  align-items: center;
}

.profile-settings-block__row dt {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 900;
}

.profile-settings-block__row dd {
  margin: 4px 0 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-settings-block__toggle {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 24px;
  border-radius: var(--radius-chip, 999px);
}

.profile-settings-block__toggle input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.profile-settings-block__toggle span {
  display: inline-block;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 41, 51, 0.18);
  transition: background var(--motion-fast) var(--motion-ease-standard);
}

.profile-settings-block__toggle span::after {
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

.profile-settings-block__toggle input:checked + span {
  background: rgba(31, 167, 160, 0.7);
}

.profile-settings-block__toggle input:checked + span::after {
  transform: translateX(16px);
}

.profile-settings-block__toggle input:disabled + span {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-settings-block__select {
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid rgba(31, 41, 51, 0.16);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 700;
}

.profile-settings-block__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
