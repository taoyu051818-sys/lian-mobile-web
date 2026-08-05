<script setup lang="ts">
import LianButton from "./LianButton.vue";

withDefaults(
  defineProps<{
    actionLabel?: string;
    actionLoading?: boolean;
    actionDisabled?: boolean;
  }>(),
  {
    actionLabel: "",
    actionLoading: false,
    actionDisabled: false,
  },
);

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div class="inline-error" role="alert">
    <div class="inline-error__message"><slot /></div>
    <LianButton
      v-if="actionLabel"
      class="inline-error__action"
      variant="ghost"
      size="sm"
      :loading="actionLoading"
      :disabled="actionDisabled"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </LianButton>
  </div>
</template>
