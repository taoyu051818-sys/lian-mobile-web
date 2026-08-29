<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  useImage,
  type VueKonvaRef,
} from "vue-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type {
  MapLocation,
  MapPost,
  MapRoadNetworkPreview,
  MapV2ItemsResponse,
  MapViewportQuery,
} from "../../types/map";
import { DEFAULT_MAP_VIEWPORT_POLICY, type MapViewportPolicy } from "../../types/map-policy";
import MapSceneAsset from "./MapSceneAsset.vue";
import { buildMapScene, unprojectScenePoint, type MapScenePoint } from "./mapScene";

const props = defineProps<{
  mapData: MapV2ItemsResponse | null;
  roadPreview: MapRoadNetworkPreview | null;
  loading: boolean;
  visibleLayers?: Record<string, boolean>;
  viewportPolicy?: MapViewportPolicy;
  editable?: boolean;
  selectedAssetId?: string;
}>();

const emit = defineEmits<{
  "load-error": [message: string];
  "place-select": [place: MapLocation | MapPost];
  "viewport-change": [viewport: MapViewportQuery];
  "map-longpress": [latlng: { lat: number; lng: number }];
  "object-select": [id: string];
  "object-change": [
    payload: {
      id: string;
      x: number;
      y: number;
      lat: number;
      lng: number;
      rotation: number;
      width: number;
      height: number;
    },
  ];
}>();

const LONGPRESS_HOLD_MS = 600;
const LONGPRESS_MOVE_TOLERANCE_PX = 10;
const ZOOM_FACTOR = 1.25;

const rootEl = ref<HTMLElement | null>(null);
const stageRef = ref<VueKonvaRef | null>(null);
const stageWidth = ref(1);
const stageHeight = ref(1);
const stageX = ref(0);
const stageY = ref(0);
const stageScale = ref(1);
const initialized = ref(false);
let resizeObserver: ResizeObserver | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdStart: MapScenePoint | null = null;

const policy = computed(() => props.viewportPolicy ?? DEFAULT_MAP_VIEWPORT_POLICY);
const scene = computed(() => buildMapScene(props.mapData, props.roadPreview));
const [backgroundImage, backgroundStatus] = useImage(computed(() => scene.value.background.url));
const visibleLayers = computed(() => props.visibleLayers || {});
const fitScale = computed(() =>
  Math.max(stageWidth.value / scene.value.width, stageHeight.value / scene.value.height),
);
const minimumScale = computed(() => fitScale.value);
const maximumScale = computed(
  () => fitScale.value * ZOOM_FACTOR ** (policy.value.maxZoom - policy.value.minZoom),
);
const currentZoom = computed(() =>
  Math.round(
    policy.value.minZoom + Math.log(stageScale.value / fitScale.value) / Math.log(ZOOM_FACTOR),
  ),
);

const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
  x: stageX.value,
  y: stageY.value,
  scaleX: stageScale.value,
  scaleY: stageScale.value,
  draggable: true,
  dragBoundFunc: (position: MapScenePoint) =>
    clampPosition(position.x, position.y, stageScale.value),
}));

const backgroundConfig = computed(() => ({
  image: backgroundImage.value,
  x: 0,
  y: 0,
  width: scene.value.width,
  height: scene.value.height,
  listening: false,
}));

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampPosition(x: number, y: number, scale: number): MapScenePoint {
  const scaledWidth = scene.value.width * scale;
  const scaledHeight = scene.value.height * scale;
  const minX = Math.min(0, stageWidth.value - scaledWidth);
  const minY = Math.min(0, stageHeight.value - scaledHeight);
  return {
    x: scaledWidth <= stageWidth.value ? (stageWidth.value - scaledWidth) / 2 : clamp(x, minX, 0),
    y:
      scaledHeight <= stageHeight.value
        ? (stageHeight.value - scaledHeight) / 2
        : clamp(y, minY, 0),
  };
}

function resetView() {
  const requestedZoom = clamp(
    Number(props.mapData?.zoom ?? policy.value.minZoom),
    policy.value.minZoom,
    policy.value.maxZoom,
  );
  stageScale.value = clamp(
    fitScale.value * ZOOM_FACTOR ** (requestedZoom - policy.value.minZoom),
    minimumScale.value,
    maximumScale.value,
  );
  const centered = clampPosition(
    (stageWidth.value - scene.value.width * stageScale.value) / 2,
    (stageHeight.value - scene.value.height * stageScale.value) / 2,
    stageScale.value,
  );
  stageX.value = centered.x;
  stageY.value = centered.y;
  initialized.value = true;
  emitViewportChange();
}

function screenToScene(point: MapScenePoint): MapScenePoint {
  return {
    x: (point.x - stageX.value) / stageScale.value,
    y: (point.y - stageY.value) / stageScale.value,
  };
}

function emitViewportChange() {
  if (!initialized.value) return;
  const topLeft = screenToScene({ x: 0, y: 0 });
  const bottomRight = screenToScene({ x: stageWidth.value, y: stageHeight.value });
  const northWest = unprojectScenePoint(scene.value.bounds, {
    x: clamp(topLeft.x, 0, scene.value.width),
    y: clamp(topLeft.y, 0, scene.value.height),
  });
  const southEast = unprojectScenePoint(scene.value.bounds, {
    x: clamp(bottomRight.x, 0, scene.value.width),
    y: clamp(bottomRight.y, 0, scene.value.height),
  });
  emit("viewport-change", {
    bounds: {
      south: southEast.lat,
      west: northWest.lng,
      north: northWest.lat,
      east: southEast.lng,
    },
    zoom: clamp(currentZoom.value, policy.value.minZoom, policy.value.maxZoom),
  });
}

function zoomAt(screenPoint: MapScenePoint, nextScale: number) {
  const oldScale = stageScale.value;
  const targetScale = clamp(nextScale, minimumScale.value, maximumScale.value);
  const scenePoint = {
    x: (screenPoint.x - stageX.value) / oldScale,
    y: (screenPoint.y - stageY.value) / oldScale,
  };
  const nextPosition = clampPosition(
    screenPoint.x - scenePoint.x * targetScale,
    screenPoint.y - scenePoint.y * targetScale,
    targetScale,
  );
  stageScale.value = targetScale;
  stageX.value = nextPosition.x;
  stageY.value = nextPosition.y;
  emitViewportChange();
}

function zoomBy(direction: 1 | -1) {
  zoomAt(
    { x: stageWidth.value / 2, y: stageHeight.value / 2 },
    stageScale.value * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR),
  );
}

function handleWheel(event: KonvaEventObject<WheelEvent>) {
  event.evt.preventDefault();
  const pointer = (stageRef.value?.getNode() as KonvaStage | undefined)?.getPointerPosition();
  if (!pointer) return;
  zoomAt(pointer, stageScale.value * (event.evt.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR));
}

function handleDragEnd(event: KonvaEventObject<DragEvent>) {
  const next = clampPosition(event.target.x(), event.target.y(), stageScale.value);
  stageX.value = next.x;
  stageY.value = next.y;
  emitViewportChange();
}

function pointerPosition(): MapScenePoint | null {
  const pointer = (stageRef.value?.getNode() as KonvaStage | undefined)?.getPointerPosition();
  return pointer ? { x: pointer.x, y: pointer.y } : null;
}

function clearLongpress() {
  if (holdTimer !== null) clearTimeout(holdTimer);
  holdTimer = null;
  holdStart = null;
}

function emitLongpress(screenPoint: MapScenePoint) {
  const point = screenToScene(screenPoint);
  if (point.x < 0 || point.y < 0 || point.x > scene.value.width || point.y > scene.value.height) {
    return;
  }
  emit("map-longpress", unprojectScenePoint(scene.value.bounds, point));
}

function handlePointerDown() {
  clearLongpress();
  const pointer = pointerPosition();
  if (!pointer) return;
  holdStart = pointer;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    if (holdStart) emitLongpress(holdStart);
  }, LONGPRESS_HOLD_MS);
}

function handlePointerMove() {
  if (holdTimer === null || !holdStart) return;
  const pointer = pointerPosition();
  if (!pointer) return clearLongpress();
  if (Math.hypot(pointer.x - holdStart.x, pointer.y - holdStart.y) > LONGPRESS_MOVE_TOLERANCE_PX) {
    clearLongpress();
  }
}

function handleContextMenu(event: KonvaEventObject<PointerEvent>) {
  event.evt.preventDefault();
  clearLongpress();
  const pointer = pointerPosition();
  if (pointer) emitLongpress(pointer);
}

function selectPlace(
  event: KonvaEventObject<MouseEvent | TouchEvent>,
  place: MapLocation | MapPost,
) {
  event.cancelBubble = true;
  clearLongpress();
  emit("place-select", place);
}

function markerScale(): number {
  return 1 / Math.max(stageScale.value, 0.001);
}

function markerGroup(x: number, y: number, place: MapLocation | MapPost) {
  const onSelect = (event: KonvaEventObject<MouseEvent | TouchEvent>) => selectPlace(event, place);
  return {
    x,
    y,
    scaleX: markerScale(),
    scaleY: markerScale(),
    onClick: onSelect,
    onTap: onSelect,
  };
}

function handleAssetChange(payload: {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}) {
  const geographic = unprojectScenePoint(scene.value.bounds, payload);
  emit("object-change", { ...payload, ...geographic });
}

watch(backgroundStatus, (status) => {
  if (status === "error") emit("load-error", "地图底图加载失败，请刷新后重试");
});

watch(
  () =>
    [
      props.mapData?.bounds?.south,
      props.mapData?.bounds?.west,
      props.mapData?.bounds?.north,
      props.mapData?.bounds?.east,
      props.mapData?.zoom,
    ] as const,
  () => {
    if (stageWidth.value > 1 && stageHeight.value > 1) resetView();
  },
  { deep: true },
);

onMounted(() => {
  if (!rootEl.value) return;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    stageWidth.value = Math.max(1, Math.round(entry.contentRect.width));
    stageHeight.value = Math.max(1, Math.round(entry.contentRect.height));
    if (!initialized.value) resetView();
    else {
      const next = clampPosition(stageX.value, stageY.value, stageScale.value);
      stageX.value = next.x;
      stageY.value = next.y;
      emitViewportChange();
    }
  });
  resizeObserver.observe(rootEl.value);
});

onBeforeUnmount(() => {
  clearLongpress();
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div
    ref="rootEl"
    class="map-canvas"
    :class="{ 'is-loading': loading }"
    role="application"
    aria-label="校园地图"
    :aria-busy="loading"
    data-testid="konva-map-stage"
  >
    <Stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="handleWheel"
      @dragstart="clearLongpress"
      @dragend="handleDragEnd"
      @mousedown="handlePointerDown"
      @touchstart="handlePointerDown"
      @mousemove="handlePointerMove"
      @touchmove="handlePointerMove"
      @mouseup="clearLongpress"
      @touchend="clearLongpress"
      @contextmenu="handleContextMenu"
    >
      <Layer>
        <Rect
          :config="{
            x: 0,
            y: 0,
            width: scene.width,
            height: scene.height,
            fill: '#dbeafe',
            listening: false,
          }"
        />
        <KonvaImage v-if="backgroundImage" :config="backgroundConfig" />
      </Layer>

      <Layer :config="{ listening: false }">
        <Line
          v-for="area in scene.areas"
          :key="area.id"
          :config="{
            points: area.points,
            closed: true,
            stroke: area.stroke,
            strokeWidth: area.strokeWidth,
            fill: area.fill,
            opacity: area.opacity,
            lineJoin: 'round',
            strokeScaleEnabled: false,
          }"
        />
        <Line
          v-for="road in scene.roads"
          :key="road.id"
          :config="{
            points: road.points,
            stroke: road.stroke,
            strokeWidth: road.strokeWidth,
            opacity: road.opacity,
            dash: road.dash,
            lineCap: 'round',
            lineJoin: 'round',
            strokeScaleEnabled: false,
          }"
        />
        <Line
          v-for="route in scene.routes"
          :key="route.id"
          :config="{
            points: route.points,
            stroke: route.stroke,
            strokeWidth: route.strokeWidth,
            opacity: route.opacity,
            dash: route.dash,
            lineCap: 'round',
            lineJoin: 'round',
            strokeScaleEnabled: false,
          }"
        />
      </Layer>

      <Layer>
        <MapSceneAsset
          v-for="asset in scene.assets"
          :key="asset.id"
          :asset="asset"
          :editable="editable"
          :selected="selectedAssetId === asset.id"
          @select="emit('object-select', $event)"
          @change="handleAssetChange"
        />

        <Group
          v-for="location in visibleLayers.locations === false ? [] : scene.locations"
          :key="location.id"
          :config="markerGroup(location.x, location.y, location.source)"
        >
          <Circle
            :config="{
              radius: 22,
              fill: '#ffffff',
              stroke: '#0f766e',
              strokeWidth: 4,
              shadowColor: '#0f172a',
              shadowBlur: 10,
              shadowOpacity: 0.22,
            }"
          />
          <Text
            :config="{
              x: -20,
              y: -7,
              width: 40,
              text: location.label.slice(0, 2),
              align: 'center',
              fill: '#0f766e',
              fontSize: 12,
              fontStyle: 'bold',
            }"
          />
        </Group>

        <Group
          v-for="post in visibleLayers.posts === false ? [] : scene.posts"
          :key="post.id"
          :config="markerGroup(post.x, post.y, post.source)"
        >
          <Rect
            :config="{
              x: -42,
              y: -28,
              width: 84,
              height: 56,
              cornerRadius: 18,
              fill: '#ffffff',
              stroke: '#2563eb',
              strokeWidth: 3,
              shadowColor: '#0f172a',
              shadowBlur: 10,
              shadowOpacity: 0.22,
            }"
          />
          <Circle :config="{ x: -24, y: 0, radius: 13, fill: '#2563eb' }" />
          <Text
            :config="{
              x: -32,
              y: -6,
              width: 16,
              text: '帖',
              align: 'center',
              fill: '#ffffff',
              fontSize: 11,
              fontStyle: 'bold',
            }"
          />
          <Text
            :config="{
              x: -7,
              y: -15,
              width: 43,
              height: 32,
              text: post.label,
              fill: '#0f172a',
              fontSize: 11,
              lineHeight: 1.25,
              ellipsis: true,
            }"
          />
        </Group>
      </Layer>
    </Stage>

    <div class="map-canvas__zoom" data-testid="konva-map-zoom-controls">
      <button
        type="button"
        aria-label="放大地图"
        data-testid="konva-map-zoom-in"
        @click="zoomBy(1)"
      >
        +
      </button>
      <button
        type="button"
        aria-label="缩小地图"
        data-testid="konva-map-zoom-out"
        @click="zoomBy(-1)"
      >
        −
      </button>
    </div>
  </div>
</template>

<style scoped>
.map-canvas {
  position: relative;
  width: 100%;
  min-height: inherit;
  height: 100vh;
  overflow: hidden;
  background: rgba(247, 244, 236, 0.72);
  touch-action: none;
}

.map-canvas.is-loading {
  filter: saturate(0.9) blur(0.5px);
}

.map-canvas__zoom {
  position: absolute;
  z-index: 20;
  top: var(--space-3);
  right: var(--space-3);
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--shadow-card);
}

.map-canvas__zoom button {
  width: 42px;
  height: 42px;
  border: 0;
  background: transparent;
  color: var(--lian-text);
  font:
    800 24px/1 system-ui,
    sans-serif;
  cursor: pointer;
}

.map-canvas__zoom button + button {
  border-top: 1px solid rgba(15, 23, 42, 0.12);
}
</style>
