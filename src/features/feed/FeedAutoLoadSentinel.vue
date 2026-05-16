<script setup lang="ts">
import { ref } from "vue";
import { useAutoLoadSentinel } from "../../composables/useAutoLoadSentinel";

const props = withDefaults(defineProps<{
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
  cooldownMs?: number;
}>(), {
  enabled: true,
  rootMargin: "720px 0px 720px 0px",
  threshold: 0.01,
  cooldownMs: 900,
});

const emit = defineEmits<{
  intersect: [];
}>();

const targetRef = ref<HTMLElement | null>(null);

useAutoLoadSentinel(targetRef, () => {
  emit("intersect");
}, {
  enabled: () => props.enabled,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
  cooldownMs: props.cooldownMs,
});
</script>

<template>
  <div ref="targetRef" aria-hidden="true"></div>
</template>
