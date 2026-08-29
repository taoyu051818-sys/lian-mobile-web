<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  Group,
  Image as KonvaImage,
  Rect,
  Text,
  Transformer,
  useImage,
  type VueKonvaRef,
} from "vue-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import type { MapSceneAsset } from "./mapScene";

const props = defineProps<{ asset: MapSceneAsset; editable?: boolean; selected?: boolean }>();
const emit = defineEmits<{
  select: [id: string];
  change: [
    payload: {
      id: string;
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    },
  ];
}>();

const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const [image] = useImage(computed(() => props.asset.url || EMPTY_IMAGE));
const assetRef = ref<VueKonvaRef | null>(null);
const transformerRef = ref<VueKonvaRef | null>(null);
const groupConfig = computed(() => ({
  id: `map-asset-${props.asset.id}`,
  x: props.asset.x,
  y: props.asset.y,
  rotation: props.asset.rotation,
  opacity: props.asset.opacity,
  draggable: props.editable === true,
  onClick: selectAsset,
  onTap: selectAsset,
  onDragend: handleDragEnd,
  onTransformend: handleTransformEnd,
}));

function transformerBounds(
  previous: { width: number; height: number },
  next: { width: number; height: number },
) {
  return Math.abs(next.width) < 8 || Math.abs(next.height) < 8 ? previous : next;
}

function selectAsset(event: KonvaEventObject<MouseEvent | TouchEvent>) {
  if (!props.editable) return;
  event.cancelBubble = true;
  emit("select", props.asset.id);
}

function handleDragEnd(event: KonvaEventObject<DragEvent>) {
  emit("change", {
    id: props.asset.id,
    x: event.target.x(),
    y: event.target.y(),
    rotation: event.target.rotation(),
    width: props.asset.width,
    height: props.asset.height,
  });
}

function handleTransformEnd(event: KonvaEventObject<Event>) {
  const assetNode = event.target;
  const width = Math.max(8, props.asset.width * Math.abs(assetNode.scaleX()));
  const height = Math.max(8, props.asset.height * Math.abs(assetNode.scaleY()));
  assetNode.scaleX(1);
  assetNode.scaleY(1);
  emit("change", {
    id: props.asset.id,
    x: assetNode.x(),
    y: assetNode.y(),
    rotation: assetNode.rotation(),
    width,
    height,
  });
}

async function bindTransformer() {
  await nextTick();
  const transformerNode = transformerRef.value?.getNode() as KonvaTransformer | undefined;
  const assetNode = assetRef.value?.getNode();
  if (!transformerNode) return;
  if (props.selected && props.editable && assetNode) transformerNode.nodes([assetNode]);
  else transformerNode.nodes([]);
  transformerNode.forceUpdate();
  transformerNode.getLayer()?.batchDraw();
}

watch(
  () => [
    props.selected,
    props.editable,
    props.asset.id,
    props.asset.width,
    props.asset.height,
    props.asset.anchorX,
    props.asset.anchorY,
    props.asset.rotation,
  ],
  bindTransformer,
  { immediate: true },
);
</script>

<template>
  <Group ref="assetRef" :config="groupConfig">
    <KonvaImage
      v-if="image && asset.url"
      :config="{
        image,
        x: -asset.anchorX,
        y: -asset.anchorY,
        width: asset.width,
        height: asset.height,
      }"
    />
    <template v-else>
      <Rect
        :config="{
          x: -asset.anchorX,
          y: -asset.anchorY,
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
          x: -asset.anchorX,
          y: -asset.anchorY + asset.height / 2 - 7,
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
  <Transformer
    v-if="selected && editable"
    ref="transformerRef"
    :config="{
      rotateEnabled: true,
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      borderStroke: '#2563eb',
      anchorFill: '#ffffff',
      anchorStroke: '#2563eb',
      anchorSize: 12,
      boundBoxFunc: transformerBounds,
    }"
  />
</template>
