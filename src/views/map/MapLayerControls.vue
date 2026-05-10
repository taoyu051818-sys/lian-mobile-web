<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import {
  type LeafletMapLike,
  type LeafletZoomControlLike,
  getLeaflet,
} from "../../platform/leaflet";

const props = defineProps<{
  map: LeafletMapLike | null;
}>();

let zoomControl: LeafletZoomControlLike | null = null;

function attachControls(map: LeafletMapLike) {
  const L = getLeaflet();
  zoomControl = L.control.zoom({ position: "topright" }).addTo(map);
}

function detachControls() {
  if (zoomControl && "remove" in zoomControl && typeof (zoomControl as { remove(): void }).remove === "function") {
    (zoomControl as { remove(): void }).remove();
  }
  zoomControl = null;
}

watch(
  () => props.map,
  (next, prev) => {
    if (prev) detachControls();
    if (next) attachControls(next);
  },
);

onBeforeUnmount(() => {
  detachControls();
});
</script>

<template>
  <slot />
</template>
