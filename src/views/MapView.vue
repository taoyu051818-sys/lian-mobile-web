<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchMapV2Items } from "../api/map";
import { fetchPlaceSheet } from "../api/places";
import { fetchPostDetail } from "../api/posts";
import { GlassPanel, InlineError, LianButton, LocationChip, TrustBadge } from "../ui";
import type { DisplayActor, FeedItemId } from "../types/feed";
import type { MapBounds, MapLocation, MapPost, MapV2ItemsResponse } from "../types/map";
import type { PlaceSheet, PlaceStatus } from "../types/place";
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
const selectedPlaceSheet = ref<PlaceSheet | null>(null);
const placeSheetLoading = ref(false);
const placeSheetError = ref("");
const openPlaceId = ref("");

const bounds = computed(() => mapData.value?.bounds || DEFAULT_BOUNDS);
const locations = computed(() => mapData.value?.locations || []);
const posts = computed(() => mapData.value?.posts || []);
const areas = computed(() => mapData.value?.layers?.areas || []);
const routes = computed(() => mapData.value?.layers?.routes || []);
const filteredLocations = computed(() => activeFilter.value === "posts" ? [] : locations.value);
const filteredPosts = computed(() => activeFilter.value === "locations" ? [] : posts.value);

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

function placeIdForLocation(location: MapLocation) {
  return location.place?.id || location.placeId || location.id;
}

function placeStatusLabel(status?: PlaceStatus) {
  const labels: Record<PlaceStatus, string> = {
    confirmed: "已确认",
    pending: "待确认",
    disputed: "有争议",
    expired: "可能过期",
    "ai-organized": "AI 整理",
    official: "官方",
  };
  return status ? labels[status] || "地点" : "地点";
}

function actorLabel(actor?: DisplayActor) {
  return actor?.displayName || actor?.username || actor?.name || "同学";
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 172_800_000) return "昨天";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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
  selectedPlaceSheet.value = null;
  placeSheetError.value = "";
  openPlaceId.value = "";
}

async function openPlaceSheet(location: MapLocation) {
  const placeId = placeIdForLocation(location);
  if (!placeId) return;
  openPlaceId.value = placeId;
  selectedPlaceSheet.value = null;
  placeSheetError.value = "";
  placeSheetLoading.value = true;
  try {
    const sheet = await fetchPlaceSheet(placeId);
    if (openPlaceId.value === placeId) {
      selectedPlaceSheet.value = sheet;
    }
  } catch (error) {
    if (openPlaceId.value === placeId) {
      placeSheetError.value = error instanceof Error ? error.message : "地点信息暂时没加载出来，可以稍后再试。";
    }
  } finally {
    if (openPlaceId.value === placeId) {
      placeSheetLoading.value = false;
    }
  }
}

async function openPost(item: MapPost) {
  selectedTarget.value = { kind: "post", item };
  selectedPlaceSheet.value = null;
  placeSheetError.value = "";
  openPlaceId.value = "";
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
  <section class="map-view" aria-label="探索">
    <GlassPanel class="map-view__card">
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
        <section class="map-view__stage" aria-label="校园地图">
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

        <section v-if="selectedTarget" class="map-view__detail" aria-label="选中地点或内容">
          <template v-if="selectedTarget.kind === 'location'">
            <div>
              <LocationChip>{{ selectedTarget.item.name }}</LocationChip>
              <h3>{{ selectedTarget.item.name }}</h3>
              <p>{{ selectedTarget.item.type || selectedTarget.item.place?.type || '校园地点' }}</p>
            </div>
            <div class="map-view__actions">
              <LianButton size="sm" variant="ghost" :loading="placeSheetLoading" @click="openPlaceSheet(selectedTarget.item)">打开地点</LianButton>
              <LianButton size="sm" variant="ghost" @click="selectNearestPostForLocation(selectedTarget.item)">查看附近内容</LianButton>
            </div>
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

        <section v-if="openPlaceId" class="map-view__place-sheet" aria-label="地点信息">
          <div class="map-view__place-sheet-header">
            <div>
              <LocationChip>{{ selectedPlaceSheet?.name || (selectedTarget?.kind === 'location' ? selectedTarget.item.name : '地点') }}</LocationChip>
              <h3>{{ selectedPlaceSheet?.name || (selectedTarget?.kind === 'location' ? selectedTarget.item.name : '地点信息') }}</h3>
            </div>
            <button type="button" @click="openPlaceId = ''; selectedPlaceSheet = null; placeSheetError = ''">收起</button>
          </div>
          <p v-if="placeSheetLoading" class="map-view__state">正在加载地点信息…</p>
          <InlineError v-else-if="placeSheetError">
            {{ placeSheetError }}
            <button
              v-if="selectedTarget?.kind === 'location'"
              type="button"
              @click="openPlaceSheet(selectedTarget.item)"
            >重新加载</button>
          </InlineError>
          <template v-else>
            <div class="map-view__place-meta">
              <TrustBadge tone="confirmed">{{ placeStatusLabel(selectedPlaceSheet?.status || (selectedTarget?.kind === 'location' ? selectedTarget.item.place?.status : undefined)) }}</TrustBadge>
              <span v-if="selectedPlaceSheet?.type">{{ selectedPlaceSheet.type }}</span>
              <span v-if="selectedPlaceSheet?.updatedAt">更新于 {{ formatRelativeTime(selectedPlaceSheet.updatedAt) || selectedPlaceSheet.updatedAt }}</span>
            </div>
            <p v-if="selectedPlaceSheet?.summary?.text">{{ selectedPlaceSheet.summary.text }}</p>
            <p v-else>这个地点还在沉淀信息。</p>
            <div v-if="selectedPlaceSheet?.stats" class="map-view__place-meta">
              <span v-if="selectedPlaceSheet.stats.postCount != null">{{ selectedPlaceSheet.stats.postCount }} 条内容</span>
              <span v-if="selectedPlaceSheet.stats.correctionCount != null">{{ selectedPlaceSheet.stats.correctionCount }} 条修正</span>
              <span v-if="selectedPlaceSheet.stats.savedCount != null">{{ selectedPlaceSheet.stats.savedCount }} 次收藏</span>
            </div>
            <div v-if="selectedPlaceSheet?.recentPosts?.length" class="map-view__place-posts">
              <article v-for="post in selectedPlaceSheet.recentPosts.slice(0, 3)" :key="String(post.tid)">
                <strong>{{ post.title || '相关内容' }}</strong>
                <p v-if="post.excerpt">{{ post.excerpt }}</p>
                <small>{{ actorLabel(post.actor) }} · {{ formatRelativeTime(post.timestampISO) || '刚刚' }}</small>
              </article>
            </div>
          </template>
        </section>

        <section class="map-view__places" aria-label="地点入口">
          <article v-for="location in locations.slice(0, 12)" :key="location.id" class="map-view__place" @click="selectLocation(location)">
            <LocationChip>{{ location.name }}</LocationChip>
            <TrustBadge tone="confirmed">{{ location.type || location.place?.type || '地点' }}</TrustBadge>
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
.map-view__places,
.map-view__place-sheet,
.map-view__place-posts {
  display: grid;
  gap: var(--space-4);
}

.map-view__toolbar,
.map-view__detail,
.map-view__place,
.map-view__actions,
.map-view__place-sheet-header,
.map-view__place-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.map-view h3,
.map-view p {
  margin: 0;
}

.map-view__detail p,
.map-view__place-sheet p,
.map-view__place-posts small {
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

.map-view__detail,
.map-view__place,
.map-view__place-sheet,
.map-view__place-posts article {
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.map-view__detail {
  align-items: flex-start;
}

.map-view__detail > div,
.map-view__place-sheet-header > div,
.map-view__place-posts article {
  display: grid;
  gap: var(--space-2);
}

.map-view__actions,
.map-view__place-meta {
  justify-content: flex-start;
}

.map-view__place-meta span {
  padding: 5px 8px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.58);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.map-view__place {
  cursor: pointer;
}

.map-view__place-sheet-header button {
  min-height: 32px;
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-weight: 900;
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
