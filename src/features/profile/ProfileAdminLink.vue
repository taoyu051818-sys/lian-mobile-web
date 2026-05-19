<script setup lang="ts">
import { computed } from "vue";
import { ADMIN_ENTER_LABEL } from "../../config/brand";

const emit = defineEmits<{
  "enter-admin": [];
}>();

// Mirror the env-gate that lived inline in ProfileView before the IdentityGroup
// extraction. The admin entry is dev/staging-only — gating it here keeps both
// the markup and the env-var dependency out of ProfileView.
const visible = computed(() => import.meta.env.VITE_ADMIN_VISIBLE === "true");
</script>

<template>
  <footer v-if="visible" class="profile-admin-link">
    <button type="button" class="profile-admin-link__button" @click="emit('enter-admin')">
      {{ ADMIN_ENTER_LABEL }}
    </button>
  </footer>
</template>

<style scoped>
.profile-admin-link {
  display: flex;
  justify-content: center;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--lian-line);
}

.profile-admin-link__button {
  padding: var(--space-1) var(--space-3);
  border: 0;
  background: none;
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--motion-fast) var(--motion-ease-standard);
}

.profile-admin-link__button:hover,
.profile-admin-link__button:focus-visible {
  opacity: 1;
  text-decoration: underline;
}
</style>
