<script setup lang="ts">
import { computed } from "vue";
import { Group, Image as KonvaImage, Rect, Text, useImage } from "vue-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { MapSceneAsset } from "./mapScene";

const props = defineProps<{ asset: MapSceneAsset; editable?: boolean }>();
const emit = defineEmits<{
  change: [payload: { id: string; x: number; y: number; rotation: number }];
}>();

const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const [image] = useImage(computed(() => props.asset.url || EMPTY_IMAGE));
const groupConfig = computed(() => ({
  id: `map-asset-${props.asset.id}`,
  x: props.asset.x,
  y: props.asset.y,
  rotation: props.asset.rotation,
  opacity: props.asset.opacity,
  draggable: props.editable === true,
}));

function handleDragEnd(event: KonvaEventObject<DragEvent>) {
  emit("change", {
    id: props.asset.id,
    x: event.target.x(),
    y: event.target.y(),
    rotation: event.target.rotation(),
  });
}
</script>

<template>
  <Group :config="groupConfig" @dragend="handleDragEnd">
    <KonvaImage
      v-if="image && asset.url"
      :config="{
        image,
        x: -asset.width / 2,
        y: -asset.height / 2,
        width: asset.width,
        height: asset.height,
      }"
    />
    <template v-else>
      <Rect
        :config="{
          x: -asset.width / 2,
          y: -asset.height / 2,
          width: asset.width,
          height: asset.height,
          cornerRadius: 10,
          fill: '#0f766e',
          shadowColor: '#0f172a',
          shadowBlur: 8,
          shadowOpacity: 0.2,
        }"
      />
      <Text
        :config="{
          x: -asset.width / 2,
          y: -7,
          width: asset.width,
          text: asset.kind.slice(0, 2).toUpperCase(),
          align: 'center',
          fill: '#ffffff',
          fontSize: 12,
          fontStyle: 'bold',
        }"
      />
    </template>
  </Group>
</template>
