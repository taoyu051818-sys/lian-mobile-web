<script setup lang="ts">
import { PROFILE_COLLAPSE_EDITOR, PROFILE_EDIT, PROFILE_LOGOUT } from "../../config/brand";

defineProps<{
  editorOpen: boolean;
}>();

const emit = defineEmits<{
  "toggle-editor": [];
  logout: [];
}>();
</script>

<template>
  <div class="profile-actions">
    <button type="button" class="profile-actions__btn" @click="emit('toggle-editor')">
      {{ editorOpen ? PROFILE_COLLAPSE_EDITOR : PROFILE_EDIT }}
    </button>
    <span class="profile-actions__divider" aria-hidden="true">·</span>
    <button type="button" class="profile-actions__btn profile-actions__btn--muted" @click="emit('logout')">
      {{ PROFILE_LOGOUT }}
    </button>
  </div>
</template>

<style scoped>
.profile-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
}

.profile-actions__divider {
  color: var(--lian-faint);
}

.profile-actions__btn {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: none;
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.profile-actions__btn--muted {
  color: var(--lian-muted);
}
</style>
