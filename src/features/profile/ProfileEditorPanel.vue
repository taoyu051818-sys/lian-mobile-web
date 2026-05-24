<script setup lang="ts">
import { computed, ref } from "vue";
import { InlineError, TypeChip } from "../../ui";
import {
  DEFAULT_USER_LABEL,
  USER_AVATAR_FALLBACK,
  PROFILE_REAL_IDENTITY,
  PROFILE_EDITOR_CHIP,
  PROFILE_EDIT,
  PROFILE_AVATAR_UPDATED,
  PROFILE_IDENTITY_SWITCHED,
} from "../../config/brand";
import type { ProfileUser } from "../../types/profile";
import ProfileAliasSelector from "./ProfileAliasSelector.vue";
import ProfileAvatarEditor from "./ProfileAvatarEditor.vue";

const props = defineProps<{
  user: ProfileUser;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const errorMessage = ref("");
const successMessage = ref("");
const aliasSelectorRef = ref<InstanceType<typeof ProfileAliasSelector> | null>(null);

const displayName = computed(() => props.user.username || DEFAULT_USER_LABEL);
const avatarText = computed(() => displayName.value.slice(0, 2) || USER_AVATAR_FALLBACK);
const activeAliasName = computed(
  () => aliasSelectorRef.value?.activeAliasName || PROFILE_REAL_IDENTITY,
);

function showSuccess(message: string) {
  errorMessage.value = "";
  successMessage.value = message;
}

function showError(message: string) {
  successMessage.value = "";
  errorMessage.value = message;
}

function handleAvatarUpdated() {
  showSuccess(PROFILE_AVATAR_UPDATED);
  emit("updated");
}

function handleAvatarError(message: string) {
  showError(message);
}

function handleAliasSwitched() {
  showSuccess(PROFILE_IDENTITY_SWITCHED);
  emit("updated");
}

function handleAliasError(message: string) {
  showError(message);
}
</script>

<template>
  <section class="profile-editor keyboard-aware-surface" aria-labelledby="profile-editor-title">
    <header class="profile-editor__header">
      <div>
        <TypeChip type="official">{{ PROFILE_EDITOR_CHIP }}</TypeChip>
        <h3 id="profile-editor-title">{{ PROFILE_EDIT }}</h3>
      </div>
    </header>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <p v-if="successMessage" class="profile-editor__success">{{ successMessage }}</p>

    <ProfileAvatarEditor
      :avatar-text="avatarText"
      :display-name="displayName"
      :active-alias-name="activeAliasName"
      @updated="handleAvatarUpdated"
      @error="handleAvatarError"
    />

    <ProfileAliasSelector
      ref="aliasSelectorRef"
      :user="user"
      :display-name="displayName"
      @switched="handleAliasSwitched"
      @error="handleAliasError"
    />
  </section>
</template>

<style scoped>
.profile-editor,
.profile-editor__block,
.profile-editor__alias-list {
  display: grid;
  gap: var(--space-4);
}

.profile-editor {
  padding: var(--space-3);
  padding-bottom: calc(var(--space-3) + min(var(--keyboard-inset-bottom), 240px));
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.profile-editor__header,
.profile-editor__block-title,
.profile-editor__invite-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-editor h3,
.profile-editor p {
  margin: 0;
}

.profile-editor__block {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.42);
  scroll-margin-bottom: calc(var(--space-6) + var(--keyboard-inset-bottom));
}

.profile-editor__block-title span,
.profile-editor__hint {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-editor__success {
  color: var(--lian-primary);
  font-weight: 850;
}

.profile-editor__invite-row {
  justify-content: flex-start;
}

.profile-editor__alias {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
}

.profile-editor__alias.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.12);
}

.profile-editor__alias span {
  font-weight: 900;
}

.profile-editor__alias small {
  color: var(--lian-muted);
}

.profile-editor code {
  padding: 8px 10px;
  border-radius: var(--radius-3);
  background: rgba(31, 41, 51, 0.08);
  color: var(--lian-ink);
  font-weight: 900;
}
</style>
