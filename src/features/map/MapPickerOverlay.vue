<script setup lang="ts">
/**
 * MapPickerOverlay — picker-mode UX for the map view (mw#943).
 *
 * Sits as a floating bottom bar on top of the Konva canvas while the user
 * is choosing a location for the publish form. Renders only in picker mode;
 * the regular browse UX is untouched.
 *
 * The overlay is intentionally a presentational component: confirm/cancel
 * are emitted up to MapView, which holds the picker-mode composable
 * and owns the side effects (handoff write + history.back). This keeps the
 * picker logic testable without mounting Konva.
 */

import { computed } from "vue";
import {
  MAP_PICKER_CANCEL,
  MAP_PICKER_CONFIRM,
  MAP_PICKER_DROPPED_PIN,
  MAP_PICKER_HINT,
  MAP_PICKER_NO_SELECTION,
  MAP_PICKER_TITLE,
} from "../../config/brand";
import { GlassPanel, LianButton, LocationChip } from "../../ui";
import type { MapPickerSelection } from "./useMapPickerMode";

const props = defineProps<{
  selection: MapPickerSelection;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();

const previewLabel = computed(() => {
  if (props.selection.location) return props.selection.location.name;
  if (props.selection.pin) return MAP_PICKER_DROPPED_PIN;
  return MAP_PICKER_NO_SELECTION;
});

const previewMeta = computed(() => {
  if (props.selection.pin) {
    return `${props.selection.pin.lat.toFixed(5)}, ${props.selection.pin.lng.toFixed(5)}`;
  }
  if (props.selection.location) {
    return `${props.selection.location.lat.toFixed(5)}, ${props.selection.location.lng.toFixed(5)}`;
  }
  return MAP_PICKER_HINT;
});

const hasSelection = computed(
  () => props.selection.location !== null || props.selection.pin !== null,
);
</script>

<template>
  <div class="map-picker-overlay" role="region" :aria-label="MAP_PICKER_TITLE">
    <GlassPanel class="map-picker-overlay__panel">
      <div class="map-picker-overlay__header">
        <strong>{{ MAP_PICKER_TITLE }}</strong>
        <span>{{ previewMeta }}</span>
      </div>
      <div class="map-picker-overlay__preview">
        <LocationChip>{{ previewLabel }}</LocationChip>
      </div>
      <div class="map-picker-overlay__actions">
        <LianButton
          type="button"
          variant="ghost"
          size="md"
          data-testid="map-picker-cancel"
          @click="$emit('cancel')"
        >
          {{ MAP_PICKER_CANCEL }}
        </LianButton>
        <LianButton
          type="button"
          variant="primary"
          size="md"
          :disabled="!hasSelection"
          data-testid="map-picker-confirm"
          @click="$emit('confirm')"
        >
          {{ MAP_PICKER_CONFIRM }}
        </LianButton>
      </div>
    </GlassPanel>
  </div>
</template>

<style scoped>
.map-picker-overlay {
  position: absolute;
  inset: auto var(--space-3) calc(var(--space-3) + env(safe-area-inset-bottom)) var(--space-3);
  z-index: 760;
  pointer-events: none;
}

.map-picker-overlay__panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  pointer-events: auto;
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-card);
}

.map-picker-overlay__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.map-picker-overlay__header strong {
  font-size: 15px;
  font-weight: 900;
}

.map-picker-overlay__header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
}

.map-picker-overlay__preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.map-picker-overlay__actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
