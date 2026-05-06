<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{
  variant?: "primary" | "tonal" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}>(), {
  variant: "tonal",
  size: "md",
  disabled: false,
  loading: false,
  type: "button"
});

const emit = defineEmits<{
  click: [event: Event];
}>();

const buttonRef = ref<HTMLButtonElement | null>(null);
let autoLoadObserver: IntersectionObserver | null = null;
let lastAutoLoadAt = 0;

function isDisabled() {
  return props.disabled || props.loading;
}

function handleClick(event: MouseEvent) {
  if (isDisabled()) return;
  emit("click", event);
}

function emitAutoLoadMore() {
  if (isDisabled()) return;
  const now = Date.now();
  if (now - lastAutoLoadAt < 900) return;
  lastAutoLoadAt = now;
  emit("click", new Event("click"));
}

onMounted(() => {
  const button = buttonRef.value;
  if (!button || !button.closest(".feed-view__load-more") || typeof IntersectionObserver === "undefined") return;

  autoLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    emitAutoLoadMore();
  }, {
    root: null,
    rootMargin: "720px 0px 720px 0px",
    threshold: 0.01,
  });

  autoLoadObserver.observe(button);
});

onBeforeUnmount(() => {
  autoLoadObserver?.disconnect();
  autoLoadObserver = null;
});
</script>

<template>
  <button
    ref="buttonRef"
    class="lian-button"
    :class="[`lian-button--${variant}`, `lian-button--${size}`, { 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="lian-button__spinner" aria-hidden="true"></span>
    <span class="lian-button__content"><slot /></span>
  </button>
</template>
