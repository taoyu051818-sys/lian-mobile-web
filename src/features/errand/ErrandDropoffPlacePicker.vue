<script setup lang="ts">
import { onMounted } from "vue";
import {
  ERRAND_ORDER_DROPOFF_PICKER_EMPTY,
  ERRAND_ORDER_DROPOFF_PICKER_LOADING,
  ERRAND_ORDER_DROPOFF_PICKER_TITLE,
} from "../../config/brand";
import type { MapLocation } from "../../types/map";
import {
  errandDropoffPlaceId,
  errandDropoffPlaceLabel,
  useErrandDropoffPlaces,
} from "./useErrandOrderDraft";

const emit = defineEmits<{
  select: [place: MapLocation];
}>();

const { loading, loaded, selectableLocations, loadPlaces } = useErrandDropoffPlaces();

onMounted(() => {
  void loadPlaces();
});
</script>

<template>
  <section
    class="errand-dropoff-place-picker"
    :aria-label="ERRAND_ORDER_DROPOFF_PICKER_TITLE"
    data-testid="errand-order-dropoff-place-picker"
  >
    <h3>{{ ERRAND_ORDER_DROPOFF_PICKER_TITLE }}</h3>
    <p v-if="loading && !loaded" class="errand-dropoff-place-picker__status">
      {{ ERRAND_ORDER_DROPOFF_PICKER_LOADING }}
    </p>
    <p v-else-if="!selectableLocations.length" class="errand-dropoff-place-picker__status">
      {{ ERRAND_ORDER_DROPOFF_PICKER_EMPTY }}
    </p>
    <div v-else class="errand-dropoff-place-picker__options">
      <button
        v-for="location in selectableLocations"
        :key="errandDropoffPlaceId(location)"
        type="button"
        class="errand-dropoff-place-picker__option"
        data-testid="errand-order-dropoff-place-option"
        @click="emit('select', location)"
      >
        {{ errandDropoffPlaceLabel(location) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.errand-dropoff-place-picker {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.errand-dropoff-place-picker h3 {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.errand-dropoff-place-picker__status {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.errand-dropoff-place-picker__options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.errand-dropoff-place-picker__option {
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.28);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.08);
  color: var(--lian-primary-deep, #0f6b66);
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}
</style>
