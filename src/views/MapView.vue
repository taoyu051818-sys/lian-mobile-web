<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchMapV2Items } from "../api/map";
import { fetchPostDetail } from "../api/posts";
import { GlassPanel, InlineError, LianButton, LocationChip, TrustBadge, TypeChip } from "../ui";
import type { FeedItemId } from "../types/feed";
import type { MapBounds, MapLocation, MapPost, MapV2ItemsResponse } from "../types/map";
import type { PostDetail } from "../types/post";
import PostDetailPanel from "./detail/PostDetailPanel.vue";

type MapTarget = { kind: "location"; item: MapLocation } | { kind: "post"; item: MapPost };

const DEFAULT_BOUNDS: MapBounds = { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };

const mapData = ref<MapV2ItemsResponse | null>(null);
const loading = ref(false);
const errorMessage = ref("");
const activeFilter = ref<"all" | "locations" | "posts">("all");
const selectedTarget = ref<MapTarget | null>(null);
const selectedPostId = ref<FeedItemId | null>(null);
const selectedPost = ref<PostDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref("");

const bounds = computed(() => mapData.value?.bounds || DEFAULT_BOUNDS);
const locations = computed(() => mapData.value?.locations || []);
const posts = computed(() => mapData.value?.posts || []);
const areas = computed(() => mapData.value?.layers?.areas || []);
const routes = computed(() => mapData.value?.layers?.routes || []);
const assets = computed(() => mapData.value?.layers?.assets || []);
const filteredLocations = computed(() => activeFilter.value === "posts" ? [] : locations.value);
const filteredPosts = computed(() => activeFilter.value === "locations" ? [] : posts.value);
const summaryLine = computed(() => `${locations.value.length} 个地点 · ${posts.value.length} 条地图内容 · ${areas.value.length + routes.value.length + assets.value.length} 个图层元素`);

function projectPoint(lat?: number, lng?: number) {
  const safeLat = Number(lat || bounds.value.south);
  const safeLng = Number(lng || bounds.value.west);
  const x = ((safeLng - bounds.value.west) / Math.max(0.000001, bounds.value.east - bounds.value.west)) * 100;
  const y = ((bounds.value.north - safeLat) / Math.max(0.000001, bounds.value.north - bounds.value.south)) * 100;
  return {
    left: `${Math.min(100, Math.max(0, x)).toFixed(2)}%`,
    top: `${Math.min(100, Math.max(0, y)).toFixed(2)}%`,
  };
}

function markerStyle(item: { lat?: number; lng?: number }) {
  return projectPoint(item.lat, item.lng);
}

function areaPoints(points: Array<{ lat: number; lng: number }> = []) {
  return points.map((point) => {
    const projected = projectPoint(point.lat, point.lng);
    return `${projected.left} ${projected.top}`;
  }).join(", ");
}

async function loadMap() {
  loading.value = true;
  errorMessage.value = "";
  try {
    mapData.value = await fetchMapV2Items();
    if (!selectedTarget.value && locations.value.length) {
      selectedTarget.value = { kind: "location", item: locations.value[0] };
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "地图数据暂时没加载出来，可以稍后再试。";
  } finally {
    loading.value = false;
  }
}

function selectLocation(item: MapLocation) {
  selectedTarget.value = { kind: "location", item };
}

async function openPost(item: MapPost) {
  selectedTarget.value = { kind: "post", item };
  selectedPostId.value = item.tid;
  selectedPost.value = null;
  detailError.value = "";
  detailLoading.value = true;
  try {
    const detail = await fetchPostDetail(item.tid);
    if (String(selectedPostId.value) === String(item.tid)) {
      selectedPost.value = detail;
    }
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : "详情暂时没加载出来，可以稍后再试。";
  } finally {
    if (String(selectedPostId.value) === String(item.tid)) {
      detailLoading.value = false;
    }
  }
}

function retryDetail() {
  const target = selectedTarget.value;
  if (target?.kind !== "post") return;
  void openPost(target.item);
}

function closeDetail() {
  selectedPostId.value = null;
  selectedPost.value = null;
  detailLoading.value = false;
  detailError.value = "";
}

function selectNearestPostForLocation(location: MapLocation) {
  const nearby = posts.value
    .map((post) => ({ post, distance: Math.hypot((post.lat - location.lat) * 100000, (post.lng - location.lng) * 100000) }))
    .sort((a, b) => a.distance - b.distance)[0]?.post;
  if (nearby) void openPost(nearby);
}

onMounted(() => {
  void loadMap();
});
</script>

<template>
  <section class="map-view" aria-labelledby="map-view-title">
    <GlassPanel class="map-view__card">
      <header class="map-view__header">
        <div>
          <TypeChip type="place">校园地图</TypeChip>
          <h2 id="map-view-title">按地点探索校园信息</h2>
        </div>
        <TrustBadge tone="pending">Vue canary</TrustBadge>
      </header>

      <p class="map-view__intro">读取 MapV2 真实数据，用 Vue 轻量 overlay 展示地点和地图帖子。Leaflet 交互后续再补完整 parity。</p>

      <div class="map-view__toolbar" aria-label="地图筛选">
        <button type="button" :class="{ 'is-active': activeFilter === 'all' }" @click="activeFilter = 'all'">全部</button>
        <button type="button" :class="{ 'is-active': activeFilter === 'locations' }" @click="activeFilter = 'locations'">地点</button>
        <button type="button" :class="{ 'is-active': activeFilter === 'posts' }" @click="activeFilter = 'posts'">内容</button>
        <LianButton size="sm" variant="ghost" :loading="loading" @click="loadMap">刷新</LianButton>
      </div>

      <InlineError v-if="errorMessage">
        {{ errorMessage }}
        <button type="button" @click="loadMap">重新加载</button>
      </InlineError>

      <div v-if="loading" class="map-view__state" role="status">正在加载校园地图…</div>

      <template v-else>
        <section class="map-view__stage" aria-label="校园地图概览">
          <img class="map-view__base" src="/assets/campus-base-map.png" alt="校园底图" loading="lazy" />
          <svg class="map-view__shape-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon
              v-for="area in areas"
              :key="area.id || area.name"
              :points="areaPoints(area.points)"
              class="map-view__area"
            />
            <polyline
              v-for="route in routes"
              :key="route.id || route.name || route.title"
              :points="areaPoints(route.points)"
              class="map-view__route"
            />
          </svg>

          <button
            v-for="location in filteredLocations"
            :key="location.id"
            type="button"
            class="map-view__marker map-view__marker--location"
            :class="{ 'is-active': selectedTarget?.kind === 'location' && selectedTarget.item.id === location.id }"
            :style="markerStyle(location)"
            @click="selectLocation(location)"
          >
            <span>{{ location.name.slice(0, 2) }}</span>
          </button>

          <button
            v-for="post in filteredPosts"
            :key="String(post.tid)"
            type="button"
            class="map-view__marker map-view__marker--post"
            :class="{ 'is-active': selectedTarget?.kind === 'post' && String(selectedTarget.item.tid) === String(post.tid) }"
            :style="markerStyle(post)"
            @click="openPost(post)"
          >
            <img v-if="post.imageUrl" :src="post.imageUrl" :alt="post.title || '地图内容'" loading="lazy" />
            <span v-else>帖</span>
          </button>
        </section>

        <section class="map-view__summary">
          <strong>{{ summaryLine }}</strong>
          <span>当前以 MapV2 bounds 做经纬度投影，优先保证真实数据可见和可点。</span>
        </section>

        <section v-if="selectedTarget" class="map-view__detail" aria-label="选中地点或内容">
          <template v-if="selectedTarget.kind === 'location'">
            <div>
              <LocationChip>{{ selectedTarget.item.name }}</LocationChip>
              <h3>{{ selectedTarget.item.name }}</h3>
              <p>{{ selectedTarget.item.type || '校园地点' }} · {{ selectedTarget.item.lat.toFixed(5) }}, {{ selectedTarget.item.lng.toFixed(5) }}</p>
            </div>
            <LianButton size="sm" variant="ghost" @click="selectNearestPostForLocation(selectedTarget.item)">查看附近内容</LianButton>
          </template>
          <template v-else>
            <div>
              <LocationChip>{{ selectedTarget.item.locationArea || '地图内容' }}</LocationChip>
              <h3>{{ selectedTarget.item.title || '未命名内容' }}</h3>
              <p>{{ selectedTarget.item.locationArea || '地点未知' }}</p>
            </div>
            <LianButton size="sm" variant="ghost" @click="openPost(selectedTarget.item)">打开详情</LianButton>
          </template>
        </section>

        <section class="map-view__places" aria-label="地点入口">
          <article v-for="location in locations.slice(0, 12)" :key="location.id" class="map-view__place" @click="selectLocation(location)">
            <LocationChip>{{ location.name }}</LocationChip>
            <TrustBadge tone="confirmed">{{ location.type || '地点' }}</TrustBadge>
          </article>
        </section>
      </template>
    </GlassPanel>

    <PostDetailPanel
      v-if="selectedPostId !== null"
      class="map-view__post-detail"
      :post="selectedPost"
      :loading="detailLoading"
      :error="detailError"
      @close="closeDetail"
      @retry="retryDetail"
    />
  </section>
</template>

<style scoped>
.map-view,
.map-view__card,
.map-view__places {
  display: grid;
  gap: var(--space-4);
}

.map-view__header,
.map-view__toolbar,
.map-view__detail,
.map-view__place,
.map-view__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.map-view h2,
.map-view h3,
.map-view p {
  margin: 0;
}

.map-view__intro,
.map-view__summary span,
.map-view__detail p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.map-view__toolbar {
  justify-content: flex-start;
}

.map-view__toolbar button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.map-view__toolbar button.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.map-view__state {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.map-view__stage {
  position: relative;
  overflow: hidden;
  min-height: 360px;
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.42);
}

.map-view__base {
  width: 100%;
  height: 100%;
  min-height: 360px;
  display: block;
  object-fit: cover;
}

.map-view__shape-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.map-view__area {
  fill: rgba(31, 167, 160, 0.11);
  stroke: rgba(31, 167, 160, 0.44);
  stroke-width: 0.24;
}

.map-view__route {
  fill: none;
  stroke: rgba(31, 41, 51, 0.42);
  stroke-width: 0.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.map-view__marker {
  position: absolute;
  display: grid;
  place-items: center;
  transform: translate(-50%, -100%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-soft);
}

.map-view__marker--location {
  width: 44px;
  min-width: 44px;
  height: 44px;
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.88);
  color: var(--lian-ink);
  font-size: 12px;
  font-weight: 900;
}

.map-view__marker--post {
  width: 58px;
  min-width: 58px;
  height: 58px;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(31, 41, 51, 0.82);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
}

.map-view__marker--post img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-view__marker.is-active {
  outline: 3px solid rgba(31, 167, 160, 0.36);
  z-index: 5;
}

.map-view__summary,
.map-view__detail,
.map-view__place {
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.map-view__summary,
.map-view__detail {
  align-items: flex-start;
}

.map-view__detail > div {
  display: grid;
  gap: var(--space-2);
}

.map-view__place {
  cursor: pointer;
}

.map-view__post-detail {
  position: sticky;
  bottom: calc(92px + env(safe-area-inset-bottom));
  z-index: 20;
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

@media (max-width: 640px) {
  .map-view__stage,
  .map-view__base {
    min-height: 300px;
  }
}
</style>
