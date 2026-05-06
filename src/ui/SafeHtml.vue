<script setup lang="ts">
import { computed } from "vue";
import { sanitizeHtml } from "../utils/html";

const props = withDefaults(defineProps<{
  html?: string;
  as?: "div" | "span" | "p" | "section" | "article";
}>(), {
  html: "",
  as: "div",
});

const sanitizedHtml = computed(() => sanitizeHtml(props.html));
</script>

<template>
  <component :is="as" v-if="sanitizedHtml" v-html="sanitizedHtml" />
</template>
