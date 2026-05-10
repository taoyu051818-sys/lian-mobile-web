<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchMapV2Items } from "../api/map";
import { buildPublishPayload, createMapV2LocationDraft, normalizeIdentityTag, normalizePublishTag, publishPost, uploadPublishImage } from "../api/publish";
import { fetchAuthMe } from "../api/profile";
import { GlassPanel, IdentityBadge, InlineError } from "../ui";
import type { MapLocation } from "../types/map";
import type { PlaceRef } from "../types/place";
import type { PublishLocationDraft, PublishVisibility } from "../types/publish";
import PublishComposer from "./publish/PublishComposer.vue";
import PublishLocationControls from "./publish/PublishLocationControls.vue";
import PublishMetaControls from "./publish/PublishMetaControls.vue";
import PublishActionBar from "./publish/PublishActionBar.vue";

const MAX_IMAGE_COUNT = 9;

const title = ref("");
const body = ref("");
const tagInput = ref("");
const identityTag = ref("");
const identityTagOptions = ref<string[]>([]);
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

const normalizedTag = computed(() => normalizePublishTag(tagInput.value));
const normalizedIdentityTag = computed(() => normalizeIdentityTag(identityTag.value));
const avatarText = computed(() => identityName.value.slice(0, 2) || "同");
const publishIdentityCopy = computed(() => `你将以「${identityName.value} · ${identityMeta.value}」发布`);
const canSubmit = computed(() => title.value.trim().length > 0 && body.value.trim().length > 0 && !uploading.value && !publishing.value);
const imageStatus = computed(() => {
  if (!selectedFiles.value.length) return "可不传图片";
  if (uploading.value) return `图片上传中 ${uploadedImageUrls.value.length}/${selectedFiles.value.length}`;
  return `已准备 ${uploadedImageUrls.value.length}/${selectedFiles.value.length} 张图片`;
});
const filteredMapLocations = computed(() => {
  const keyword = locationSearch.value.trim().toLowerCase();
  const list = keyword
    ? mapLocations.value.filter((location) => `${location.name} ${location.type || ""} ${location.place?.name || ""} ${location.place?.type || ""}`.toLowerCase().includes(keyword))
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
    placeId: placeIdForLocation(location),
    place: placeRefForLocation(location),
  });
});
const knownPlaceLabel = computed(() => {
  const location = selectedMapLocation.value;
  if (!location) return "";
  return placeRefForLocation(location)?.name || location.name;
});
const locationPreviewLabel = computed(() => knownPlaceLabel.value || placeName.value.trim() || "未绑定地点");
const locationBindingMeta = computed(() => selectedMapLocation.value ? "已绑定已知地点" : "手填地点仅作为展示文本");

const visibilityOptions: Array<{ value: PublishVisibility; label: string }> = [
  { value: "public", label: "公开" },
  { value: "campus", label: "校园" },
  { value: "school", label: "本校" },
  { value: "private", label: "仅自己" },
];

function placeIdForLocation(location: MapLocation) {
  return location.place?.id || location.placeId || "";
}

function placeRefForLocation(location: MapLocation): PlaceRef | undefined {
  const id = placeIdForLocation(location);
  if (!id) return undefined;
  return location.place || {
    id,
    name: location.name,
    type: location.type,
  };
}

async function loadIdentity() {
  try {
    const user = await fetchAuthMe();
    identityName.value = user?.username || "同学";
    aliasId.value = user?.activeAliasId || undefined;
    identityTagOptions.value = user?.identityTags || [];
    identityTag.value = "";
    const activeAlias = aliasId.value ? user?.aliases?.find((alias) => alias.id === aliasId.value) : null;
    identityMeta.value = activeAlias?.name || user?.institution || "当前身份";
  } catch {
    identityName.value = "同学";
    identityMeta.value = "未确认身份";
    identityTagOptions.value = [];
    identityTag.value = "";
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
    const publishedLocationLabel = locationPreviewLabel.value;
    const payload = buildPublishPayload({
      imageUrls: uploadedImageUrls.value,
      title: title.value,
      body: body.value,
      tag: normalizedTag.value,
      identityTag: normalizedIdentityTag.value,
      placeName: placeName.value,
      visibility: visibility.value,
      aliasId: aliasId.value,
      locationDraft: selectedLocationDraft.value,
    });
    const response = await publishPost(payload);
    lastTid.value = response.tid || null;
    const boundPlaceName = response.place?.name || publishedLocationLabel;
    successMessage.value = boundPlaceName && boundPlaceName !== "未绑定地点"
      ? `发布成功，已绑定到「${boundPlaceName}」。`
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
  identityTag.value = "";
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

onBeforeUnmount(() => {
  revokePreviewUrls();
});
</script>

<template>
  <section class="publish-view" aria-label="发布">
    <GlassPanel class="publish-view__card">
      <section class="publish-view__identity" aria-label="当前发布身份">
        <IdentityBadge :avatar-text="avatarText" :label="identityName" :meta="identityMeta" />
        <p class="publish-view__identity-copy">{{ publishIdentityCopy }}</p>
      </section>

      <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
      <p v-if="successMessage" class="publish-view__success">{{ successMessage }}</p>

      <form class="publish-view__form" @submit.prevent="submitPublish">
        <PublishComposer
          :local-preview-urls="localPreviewUrls"
          :image-status="imageStatus"
          :title="title"
          :body="body"
          :uploading="uploading"
          :publishing="publishing"
          @update:title="title = $event"
          @update:body="body = $event"
          @handle-files="handleFiles"
          @remove-image="removeImage"
        />

        <PublishLocationControls
          :filtered-map-locations="filteredMapLocations"
          :selected-map-location="selectedMapLocation"
          :map-location-loading="mapLocationLoading"
          :map-location-error="mapLocationError"
          :location-search="locationSearch"
          :place-name="placeName"
          :known-place-label="knownPlaceLabel"
          :location-preview-label="locationPreviewLabel"
          :location-binding-meta="locationBindingMeta"
          @update:location-search="locationSearch = $event"
          @update:place-name="placeName = $event"
          @select-map-location="selectMapLocation"
          @clear-map-location="clearMapLocation"
          @load-map-locations="loadMapLocations"
        />

        <PublishMetaControls
          :tag-input="tagInput"
          :normalized-tag="normalizedTag"
          :identity-tag="identityTag"
          :identity-tag-options="identityTagOptions"
          :visibility="visibility"
          :visibility-options="visibilityOptions"
          @update:tag-input="tagInput = $event"
          @update:identity-tag="identityTag = $event"
          @update:visibility="visibility = $event"
        />

        <PublishActionBar
          :publishing="publishing"
          :uploading="uploading"
          :can-submit="canSubmit"
          @reset-form="resetForm"
        />
      </form>
    </GlassPanel>
  </section>
</template>

<style scoped>
.publish-view,
.publish-view__card,
.publish-view__form {
  display: grid;
  gap: var(--space-4);
}

.publish-view p {
  margin: 0;
}

.publish-view__identity-copy {
  margin-top: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.5;
}

.publish-view__success {
  color: var(--lian-primary);
  font-weight: 850;
}

.publish-view__identity {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}
</style>
