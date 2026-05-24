<script setup lang="ts">
import { computed } from "vue";
import type { PostDetailMetadataV2 } from "../../types/post";
import { selectRenderableComponents } from "./postComponentRegistry";

/**
 * PRD V0.3 §2.1.3 — V2 components dispatch.
 *
 * The slot is mounted unconditionally on the detail page and reads
 * `metadata.components` (array shape, see PostDetailMetadataV2). For each
 * entry it looks up a renderer in `postComponentRegistry`; unregistered
 * types are skipped. Existing event/help/merchant/trade blocks render via
 * the capability registry path on PostDetailContent — this slot does NOT
 * double-render them. Its job is to be a forward-compatible mounting seam
 * for the four PRD-promised additions (delivery / groupbuy / channel /
 * ledger) so they can land without widening PostDetailContent's prop set.
 *
 * Empty / missing metadata renders nothing (no wrapper element, no
 * placeholder). That keeps the slot byte-identical for posts the backend
 * has not yet dual-written to V2.
 */
const props = defineProps<{
  metadata?: PostDetailMetadataV2;
}>();

const entries = computed(() => selectRenderableComponents(props.metadata?.components));
</script>

<template>
  <template v-if="entries.length">
    <component
      :is="entry.entry.component"
      v-for="(entry, index) in entries"
      :key="`${entry.component.type}-${index}`"
      :component="entry.component"
    />
  </template>
</template>
