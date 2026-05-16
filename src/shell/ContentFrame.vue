<script setup lang="ts">
import type { ShellLayoutMode } from "../app/view-types";
import { CONTENT_FRAME_LABEL } from "../config/brand";

withDefaults(
  defineProps<{
    layoutMode?: ShellLayoutMode;
  }>(),
  {
    layoutMode: "content",
  },
);
</script>

<template>
  <div
    class="content-frame vue-shell__grid"
    :class="[
      layoutMode !== 'content' && `content-frame--${layoutMode}`,
      layoutMode !== 'content' && `vue-shell__grid--${layoutMode}`,
    ]"
    role="region"
    :aria-label="CONTENT_FRAME_LABEL"
  >
    <slot />
  </div>
</template>
