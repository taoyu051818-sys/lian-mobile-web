<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchMapV2Items } from "../api/map";
import { buildPublishPayload, createMapV2LocationDraft, normalizePublishTags, publishPost, uploadPublishImage } from "../api/publish";
import { fetchAuthMe } from "../api/profile";
import { GlassPanel, IdentityBadge, InlineError, LianButton, LocationChip, TagChip } from "../ui";
import type { MapLocation } from "../types/map";
import type { PublishLocationDraft, PublishVisibility } from "../types/publish";

const MAX_IMAGE_COUNT = 9;

const title = ref("");
const body = ref("");
const tagInput = ref("");
const placeName = ref("");
const visibility = ref<PublishVisibility>("public");
const selectedFiles = ref<File[]>([]);
const localPreviewUrls = ref<string[]>([]);
const uploadedImageUrls = ref<string[]>([]);
const aliasId = ref<string | undefined>(undefined);
const identityName = ref("同学");
const identityMeta = ref("当前身份");
const uploading = ref(false);
const publishing = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const lastTid = ref<string | number | null>(null);
const mapLocations = ref<MapLocation[]>([]);
const selectedMapLocation = ref<MapLocation | null>(null);
const mapLocationLoading = ref(false);
const mapLocationError = ref("");
const locationSearch = ref("");

const normalizedTags = computed(() => normalizePublishTags(tagInput.value));
const avatarText = computed(() => identityName.value.slice(0, 2) || "同");
const canSubmit = computed(() => title.value.trim().length > 0 && body.value.trim().length > 0 && !uploading.value && !publishing.value);
const imageStatus = computed(() => {
  if (!selectedFiles.value.length) return "可不传图片";
  if (uploading.value) return `图片上传中 ${uploadedImageUrls.value.length}/${selectedFiles.value.length}`;
  return `已准备 ${uploadedImageUrls.value.length}/${selectedFiles.value.length} 张图片`;
});
const filteredMapLocations = computed(() => {
  const keyword = locationSearch.value.trim().toLowerCase();
  const list = keyword
    ? mapLocations.value.filter((location) => `${location.name} ${location.type || ""}`.toLowerCase().includes(keyword))
    : mapLocations.value;
  return list.slice(0, 18);
});
const selectedLocationDraft = computed<PublishLocationDraft | null>(() => {
  const location = selectedMapLocation.value;
  if (!location) return null;
  return createMapV2LocationDraft({
    locationId: location.id,
    name: location.name,
    lat: location.lat,
    lng: location.lng,
  });
});
const locationPreviewLabel = computed(() => selectedMapLocation.value?.name || placeName.value.trim() || "未绑定地点");

const visibilityOptions: Array<{ value: PublishVisibility; label: string }> = [
  { value: "public", label: "公开" },
  { value: "campus", label: "校园" },
  { value: "school", label: "本校" },
  { value: "private", label: "仅自己" },
];

async function loadIdentity() {
  try {
    const user = await fetchAuthMe();
    identityName.value = user?.username || "同学";
    aliasId.value = user?.activeAliasId || undefined;
    const activeAlias = aliasId.value ? user?.aliases?.find((alias) => alias.id === aliasId.value) : null;
    identityMeta.value = activeAlias?.name || user?.identityTags?.[0] || user?.institution || "当前身份";
  } catch {
    identityName.value = "同学";
    identityMeta.value = "未确认身份";
  }
}

async function loadMapLocations() {
  mapLocationLoading.value = true;
  mapLocationError.value = "";
  try {
    const data = await fetchMapV2Items();
    mapLocations.value = data.locations || [];
  } catch (error) {
    mapLocationError.value = error instanceof Error ? error.message : "地图地点暂时没加载出来，可以手填地点发布。";
  } finally {
    mapLocationLoading.value = false;
  }
}

function selectMapLocation(location: MapLocation) {
  selectedMapLocation.value = location;
  placeName.value = location.name;
  locationSearch.value = location.name;
  mapLocationError.value = "";
}

function clearMapLocation() {
  selectedMapLocation.value = null;
}

function isSelectedMapLocation(location: MapLocation) {
  return selectedMapLocation.value?.id === location.id;
}

function revokePreviewUrls() {
  localPreviewUrls.value.forEach((url) => URL.revokeObjectURL(url));
  localPreviewUrls.value = [];
}

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  errorMessage.value = "";
  successMessage.value = "";
  const remaining = Math.max(0, MAX_IMAGE_COUNT - selectedFiles.value.length);
  const nextFiles = files.slice(0, remaining);
  selectedFiles.value = [...selectedFiles.value, ...nextFiles];
  localPreviewUrls.value = [...localPreviewUrls.value, ...nextFiles.map((file) => URL.createObjectURL(file))];
  input.value = "";
  await uploadPendingImages();
}

async function uploadPendingImages() {
  if (uploading.value) return;
  uploading.value = true;
  errorMessage.value = "";
  try {
    for (let index = uploadedImageUrls.value.length; index < selectedFiles.value.length; index += 1) {
      const url = await uploadPublishImage(selectedFiles.value[index]);
      uploadedImageUrls.value[index] = url;
    }
    uploadedImageUrls.value = uploadedImageUrls.value.filter(Boolean);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "图片上传失败，可以换一张图片或稍后再试。";
  } finally {
    uploading.value = false;
  }
}

function removeImage(index: number) {
  if (localPreviewUrls.value[index]) URL.revokeObjectURL(localPreviewUrls.value[index]);
  selectedFiles.value.splice(index, 1);
  localPreviewUrls.value.splice(index, 1);
  uploadedImageUrls.value.splice(index, 1);
}

function validate() {
  if (!title.value.trim()) return "请填写标题。";
  if (title.value.trim().length > 40) return "标题最多 40 个字。";
  if (!body.value.trim()) return "请填写正文。";
  if (body.value.trim().length > 300) return "正文最多 300 个字。";
  if (uploading.value) return "图片还在上传，稍等一下再发布。";
  if (selectedFiles.value.length !== uploadedImageUrls.value.length) return "还有图片没有上传成功，请重新选择或移除。";
  return "";
}

async function submitPublish() {
  const validation = validate();
  errorMessage.value = validation;
  successMessage.value = "";
  lastTid.value = null;
  if (validation || publishing.value) return;

  publishing.value = true;
  try {
    const payload = buildPublishPayload({
      imageUrls: uploadedImageUrls.value,
      title: title.value,
      body: body.value,
      tags: normalizedTags.value,
      placeName: placeName.value,
      visibility: visibility.value,
      aliasId: aliasId.value,
      locationDraft: selectedLocationDraft.value,
    });
    const response = await publishPost(payload);
    lastTid.value = response.tid || null;
    successMessage.value = response.tid
      ? `发布成功，帖子 ID：${response.tid}`
      : "发布成功，稍后可以在首页看到。";
    resetForm();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "发布没有成功，可以稍后再试。";
  } finally {
    publishing.value = false;
  }
}

function resetForm() {
  title.value = "";
  body.value = "";
  tagInput.value = "";
  placeName.value = "";
  visibility.value = "public";
  selectedFiles.value = [];
  uploadedImageUrls.value = [];
  selectedMapLocation.value = null;
  locationSearch.value = "";
  revokePreviewUrls();
}

onMounted(() => {
  void loadIdentity();
  void loadMapLocations();
});
</script>

<template>
  <section class="publish-view" aria-label="发布">
    <GlassPanel class="publish-view__card">
      <section class="publish-view__identity" aria-label="当前发布身份">
        <IdentityBadge :avatar-text="avatarText" :label="identityName" :meta="identityMeta" />
      </section>

      <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
      <p v-if="successMessage" class="publish-view__success">{{ successMessage }}</p>

      <form class="publish-view__form" @submit.prevent="submitPublish">
        <section class="publish-view__section">
          <div class="publish-view__section-title">
            <strong>图片</strong>
            <span>{{ imageStatus }}</span>
          </div>
          <div v-if="localPreviewUrls.length" class="publish-view__image-grid" aria-label="已选图片">
            <div v-for="(url, index) in localPreviewUrls" :key="url" class="publish-view__image">
              <img :src="url" alt="待发布图片" />
              <button type="button" aria-label="移除图片" @click="removeImage(index)">×</button>
            </div>
          </div>
          <label class="publish-view__upload">
            <span>选择图片</span>
            <input type="file" accept="image/*" multiple @change="handleFiles" />
          </label>
        </section>

        <label class="publish-view__field">
          <span>标题</span>
          <input v-model="title" maxlength="40" placeholder="发生了什么？" />
        </label>

        <label class="publish-view__field">
          <span>正文</span>
          <textarea v-model="body" rows="6" maxlength="300" placeholder="写清楚内容、时间、限制或下一步。" />
        </label>

        <section class="publish-view__section publish-view__map-picker" aria-labelledby="publish-map-title">
          <div class="publish-view__section-title">
            <strong id="publish-map-title">地图地点</strong>
            <span>{{ selectedMapLocation ? '已绑定' : '可选' }}</span>
          </div>

          <label class="publish-view__field publish-view__map-search">
            <span>搜索地点</span>
            <input v-model="locationSearch" maxlength="40" placeholder="搜索图书馆、食堂、教学楼…" />
          </label>

          <InlineError v-if="mapLocationError">
            {{ mapLocationError }}
            <button type="button" @click="loadMapLocations">重新加载</button>
          </InlineError>

          <div v-if="mapLocationLoading" class="publish-view__mini-state" role="status">正在加载地点…</div>
          <div v-else-if="filteredMapLocations.length" class="publish-view__map-locations" aria-label="地点列表">
            <button
              v-for="location in filteredMapLocations"
              :key="location.id"
              type="button"
              class="publish-view__map-location"
              :class="{ 'is-active': isSelectedMapLocation(location) }"
              @click="selectMapLocation(location)"
            >
              <strong>{{ location.name }}</strong>
              <span>{{ location.type || '校园地点' }}</span>
            </button>
          </div>
          <div v-else class="publish-view__mini-state">没有匹配地点，可以手填地点发布。</div>

          <div v-if="selectedMapLocation" class="publish-view__map-selected">
            <LocationChip>{{ selectedMapLocation.name }}</LocationChip>
            <LianButton type="button" size="sm" variant="ghost" @click="clearMapLocation">改用手填</LianButton>
          </div>
        </section>

        <label class="publish-view__field">
          <span>手填地点</span>
          <input v-model="placeName" maxlength="40" placeholder="例如 图书馆、食堂、教学楼，也可以留空" />
        </label>

        <div class="publish-view__location-preview">
          <LocationChip>{{ locationPreviewLabel }}</LocationChip>
        </div>

        <label class="publish-view__field">
          <span>标签</span>
          <input v-model="tagInput" maxlength="96" placeholder="最多 5 个，例如 #校园 #晚霞" />
        </label>

        <div v-if="normalizedTags.length" class="publish-view__tags" aria-label="标签预览">
          <TagChip v-for="tag in normalizedTags" :key="tag" :tag="tag" />
        </div>

        <section class="publish-view__section" aria-labelledby="publish-visibility-title">
          <div class="publish-view__section-title">
            <strong id="publish-visibility-title">可见范围</strong>
            <span>{{ visibilityOptions.find((item) => item.value === visibility)?.label }}</span>
          </div>
          <div class="publish-view__visibility-grid">
            <button
              v-for="option in visibilityOptions"
              :key="option.value"
              type="button"
              class="publish-view__visibility"
              :class="{ 'is-active': visibility === option.value }"
              @click="visibility = option.value"
            >
              <strong>{{ option.label }}</strong>
            </button>
          </div>
        </section>

        <div class="publish-view__actions">
          <LianButton type="button" variant="ghost" :disabled="publishing || uploading" @click="resetForm">清空</LianButton>
          <LianButton type="submit" variant="tonal" :loading="publishing" :disabled="!canSubmit">发布到 LIAN</LianButton>
        </div>
      </form>
    </GlassPanel>
  </section>
</template>

<style scoped>
.publish-view,
.publish-view__card,
.publish-view__form,
.publish-view__section {
  display: grid;
  gap: var(--space-4);
}

.publish-view__section-title,
.publish-view__actions,
.publish-view__location-preview,
.publish-view__tags,
.publish-view__map-selected {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-view p {
  margin: 0;
}

.publish-view__section-title span,
.publish-view__map-selected span {
  color: var(--lian-muted);
  line-height: 1.6;
}

.publish-view__success {
  color: var(--lian-primary);
  font-weight: 850;
}

.publish-view__identity,
.publish-view__section,
.publish-view__field,
.publish-view__upload {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.publish-view__field,
.publish-view__upload {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-view__field input,
.publish-view__field textarea {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.publish-view__field input {
  padding: 0 var(--space-3);
}

.publish-view__field textarea {
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.publish-view__upload {
  position: relative;
  min-height: 72px;
  place-items: center;
  border-style: dashed;
  color: var(--lian-ink);
  cursor: pointer;
}

.publish-view__upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.publish-view__image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-2);
}

.publish-view__image {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-3);
  background: rgba(31, 41, 51, 0.06);
}

.publish-view__image img {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  object-fit: cover;
}

.publish-view__image button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 32px;
  height: 32px;
  min-width: 32px;
  place-items: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.82);
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 900;
}

.publish-view__map-picker {
  background: rgba(31, 167, 160, 0.07);
}

.publish-view__map-search {
  padding: 0;
  border: 0;
  background: transparent;
}

.publish-view__map-locations {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: var(--space-2);
  max-height: 240px;
  overflow: auto;
}

.publish-view__map-location {
  display: grid;
  gap: 4px;
  min-height: 62px;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-ink);
  text-align: left;
}

.publish-view__map-location span {
  color: var(--lian-muted);
  font-size: 12px;
}

.publish-view__map-location.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.16);
}

.publish-view__map-selected {
  justify-content: flex-start;
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.2);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.58);
}

.publish-view__mini-state {
  display: grid;
  min-height: 72px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.publish-view__tags,
.publish-view__actions,
.publish-view__location-preview {
  justify-content: flex-start;
}

.publish-view__visibility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.publish-view__visibility {
  display: grid;
  min-height: 48px;
  place-items: center;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-ink);
  text-align: center;
}

.publish-view__visibility.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.12);
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
  .publish-view__visibility-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
