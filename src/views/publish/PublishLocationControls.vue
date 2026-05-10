<script setup lang="ts">
import { placeTypeLabel } from "../../utils/placeTypeLabel";
import { InlineError, LianButton, LocationChip } from "../../ui";
import type { MapLocation } from "../../types/map";

defineProps<{
  panelOpen: boolean;
  filteredMapLocations: MapLocation[];
  selectedMapLocation: MapLocation | null;
  mapLocationLoading: boolean;
  mapLocationError: string;
  locationSearch: string;
  placeName: string;
  knownPlaceLabel: string;
  locationPreviewLabel: string;
  locationBindingMeta: string;
}>();

const emit = defineEmits<{
  "update:locationSearch": [value: string];
  "update:placeName": [value: string];
  selectMapLocation: [location: MapLocation];
  clearMapLocation: [];
  loadMapLocations: [];
}>();
</script>

<template>
  <section
    v-if="panelOpen || selectedMapLocation || placeName.trim()"
    class="publish-location__panel"
    aria-labelledby="publish-map-title"
  >
    <div class="publish-location__panel-header">
      <strong id="publish-map-title">地点</strong>
      <span>{{ selectedMapLocation ? "已绑定已知地点" : "默认收起，按需展开" }}</span>
    </div>

    <div v-if="selectedMapLocation || placeName.trim()" class="publish-location__preview">
      <LocationChip>{{ locationPreviewLabel }}</LocationChip>
      <span>{{ locationBindingMeta }}</span>
    </div>

    <label class="publish-location__field publish-location__field--compact">
      <span>手填地点</span>
      <input :value="placeName" maxlength="40" placeholder="例如 图书馆、食堂、教学楼，也可以留空" @input="emit('update:placeName', ($event.target as HTMLInputElement).value)" />
    </label>

    <label class="publish-location__field publish-location__field--compact publish-location__map-search">
      <span>搜索已知地点</span>
      <input :value="locationSearch" maxlength="40" placeholder="搜索图书馆、食堂、教学楼…" @input="emit('update:locationSearch', ($event.target as HTMLInputElement).value)" />
    </label>

    <InlineError v-if="mapLocationError">
      {{ mapLocationError }}
      <button type="button" @click="emit('loadMapLocations')">重新加载</button>
    </InlineError>

    <div v-if="mapLocationLoading" class="publish-location__mini-state" role="status">正在加载地点…</div>
    <div v-else-if="filteredMapLocations.length" class="publish-location__list" aria-label="地点列表">
      <button
        v-for="location in filteredMapLocations"
        :key="location.id"
        type="button"
        class="publish-location__item"
        :class="{ 'is-active': selectedMapLocation?.id === location.id }"
        @click="emit('selectMapLocation', location)"
      >
        <strong>{{ location.name }}</strong>
        <span>{{ placeTypeLabel(location.place?.type, location.type) }}</span>
      </button>
    </div>
    <div v-else class="publish-location__mini-state">没有匹配地点，可以手填地点发布。</div>

    <div v-if="selectedMapLocation" class="publish-location__selected">
      <div>
        <LocationChip>{{ knownPlaceLabel }}</LocationChip>
        <span>{{ placeTypeLabel(selectedMapLocation?.place?.type, selectedMapLocation?.type) }}</span>
      </div>
      <LianButton type="button" size="sm" variant="ghost" @click="emit('clearMapLocation')">改用手填</LianButton>
    </div>
  </section>
</template>

<style scoped>
.publish-location__panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.62)),
    radial-gradient(circle at top right, rgba(31, 167, 160, 0.1), transparent 42%);
}

.publish-location__panel-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-location__panel-header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-location__preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.publish-location__preview span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-location__field {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-location__field input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-location__field--compact {
  gap: 6px;
}

.publish-location__field span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-location__map-search {
  background: rgba(248, 251, 252, 0.9);
}

.publish-location__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: var(--space-2);
  max-height: 240px;
  overflow: auto;
}

.publish-location__item {
  display: grid;
  gap: 4px;
  min-height: 54px;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.1);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  text-align: left;
}

.publish-location__item span {
  color: var(--lian-muted);
  font-size: 12px;
}

.publish-location__item.is-active {
  border-color: rgba(31, 167, 160, 0.3);
  background: rgba(31, 167, 160, 0.14);
}

.publish-location__selected {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-location__selected > div {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.publish-location__selected span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-location__mini-state {
  display: grid;
  min-height: 72px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}
</style>
