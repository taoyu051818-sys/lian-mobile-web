<script setup lang="ts">
withDefaults(defineProps<{
  tone?: "info" | "success" | "warning" | "error";
}>(), {
  tone: "info"
});
</script>

<template>
  <div class="lian-toast" :class="`lian-toast--${tone}`" role="status" aria-live="polite">
    <slot />
  </div>
</template>
