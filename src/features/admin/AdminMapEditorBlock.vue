<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MapAsset } from "../../types/map";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { MapCanvas } from "../map";
import {
  addMapAsset,
  buildEditableMapData,
  removeMapAsset,
  updateMapAsset,
  type MapAssetTransform,
} from "./adminMapEditorState";
import { useAdminMapApi, type AdminMapDocument } from "./useAdminMapApi";

const props = defineProps<{ token: string; authEpoch: number }>();
const emit = defineEmits<{ "authorization-lost": [] }>();
const adminMapApi = useAdminMapApi();

const mapDocument = ref<AdminMapDocument | null>(null);
const selectedAssetId = ref("");
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const dirty = ref(false);
const editRevision = ref(0);
const pendingReloadConfirmation = ref(false);
const pendingDeleteAssetId = ref("");
const errorMessage = ref("");
const statusMessage = ref("");
const newAssetKind = ref("camera");

let disposed = false;
let lifecycle = 0;
const controllers = new Set<AbortController>();

interface RequestOwner {
  token: string;
  authEpoch: number;
  lifecycle: number;
  controller: AbortController;
}

const mapData = computed(() =>
  mapDocument.value ? buildEditableMapData(mapDocument.value) : null,
);
const selectedAsset = computed(() =>
  (mapDocument.value?.layers.assets || []).find(
    (asset) => String(asset.id || "") === selectedAssetId.value,
  ),
);

const selectedKind = computed({
  get: () => String(selectedAsset.value?.kind || "asset"),
  set: (kind: string) => updateSelectedAsset({ kind }),
});
const selectedWidth = computed({
  get: () => Number(selectedAsset.value?.size?.[0] || 48),
  set: (width: number) => updateSelectedAsset({ width }),
});
const selectedHeight = computed({
  get: () => Number(selectedAsset.value?.size?.[1] || 48),
  set: (height: number) => updateSelectedAsset({ height }),
});
const selectedRotation = computed({
  get: () => Number(selectedAsset.value?.rotation || 0),
  set: (rotation: number) => updateSelectedAsset({ rotation }),
});

function cloneDocument(source: AdminMapDocument): AdminMapDocument {
  return JSON.parse(JSON.stringify(source)) as AdminMapDocument;
}

function beginRequest(): RequestOwner | null {
  const token = props.token.trim();
  if (disposed || !token) return null;
  const controller = new AbortController();
  controllers.add(controller);
  return {
    token,
    authEpoch: props.authEpoch,
    lifecycle,
    controller,
  };
}

function isCurrent(owner: RequestOwner): boolean {
  return (
    !disposed &&
    !owner.controller.signal.aborted &&
    owner.lifecycle === lifecycle &&
    owner.token === props.token.trim() &&
    owner.authEpoch === props.authEpoch
  );
}

function finishRequest(owner: RequestOwner) {
  controllers.delete(owner.controller);
}

function retireRequests() {
  lifecycle += 1;
  for (const controller of controllers) controller.abort();
  controllers.clear();
  loading.value = false;
  saving.value = false;
  uploading.value = false;
}

function handleRequestError(error: unknown, owner: RequestOwner, fallback: string) {
  if (!isCurrent(owner)) return;
  if (adminMapApi.isAuthorizationError(error)) {
    retireRequests();
    emit("authorization-lost");
    return;
  }
  errorMessage.value = extractErrorMessage(error, fallback);
}

async function loadMap(options: { discardDirty?: boolean } = {}) {
  if (dirty.value && !options.discardDirty) return;
  const owner = beginRequest();
  if (!owner) return;
  loading.value = true;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    const next = await adminMapApi.load(owner.token, owner.controller.signal);
    if (!isCurrent(owner)) return;
    mapDocument.value = cloneDocument(next);
    selectedAssetId.value = "";
    pendingReloadConfirmation.value = false;
    pendingDeleteAssetId.value = "";
    dirty.value = false;
    editRevision.value = 0;
    statusMessage.value = "地图数据已加载。";
  } catch (error) {
    handleRequestError(error, owner, "地图数据加载失败，请稍后重试。");
  } finally {
    if (isCurrent(owner)) loading.value = false;
    finishRequest(owner);
  }
}

async function saveMap() {
  if (!mapDocument.value || !dirty.value || saving.value) return;
  const owner = beginRequest();
  if (!owner) return;
  const revisionAtStart = editRevision.value;
  const snapshot = cloneDocument(mapDocument.value);
  saving.value = true;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    const saved = await adminMapApi.save(owner.token, snapshot, owner.controller.signal);
    if (!isCurrent(owner)) return;
    if (editRevision.value === revisionAtStart) {
      mapDocument.value = cloneDocument(saved);
      dirty.value = false;
      pendingReloadConfirmation.value = false;
      pendingDeleteAssetId.value = "";
      statusMessage.value = "地图已保存并重新读取服务端结果。";
    } else {
      statusMessage.value = "已保存此前版本；编辑期间产生的新修改仍未保存。";
    }
  } catch (error) {
    handleRequestError(error, owner, "地图保存失败，请检查数据后重试。");
  } finally {
    if (isCurrent(owner)) saving.value = false;
    finishRequest(owner);
  }
}

function markEdited(next: AdminMapDocument) {
  mapDocument.value = next;
  dirty.value = true;
  editRevision.value += 1;
  pendingReloadConfirmation.value = false;
  pendingDeleteAssetId.value = "";
  errorMessage.value = "";
  statusMessage.value = "有未保存修改。";
}

function selectAsset(id: string) {
  selectedAssetId.value = id;
  pendingDeleteAssetId.value = "";
}

function handleObjectChange(payload: {
  id: string;
  lat: number;
  lng: number;
  rotation: number;
  width: number;
  height: number;
}) {
  if (!mapDocument.value) return;
  selectedAssetId.value = payload.id;
  markEdited(updateMapAsset(mapDocument.value, payload));
}

function updateSelectedAsset(update: Omit<MapAssetTransform, "id">) {
  if (!mapDocument.value || !selectedAssetId.value) return;
  markEdited(updateMapAsset(mapDocument.value, { id: selectedAssetId.value, ...update }));
}

function createAssetId(kind: string): string {
  const prefix =
    kind
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "asset";
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || Date.now().toString(36);
  return `${prefix}-${suffix}`;
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !mapDocument.value || uploading.value) return;
  const owner = beginRequest();
  if (!owner) return;
  uploading.value = true;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    const url = await adminMapApi.upload(owner.token, file, owner.controller.signal);
    if (!isCurrent(owner) || !mapDocument.value) return;
    const id = createAssetId(newAssetKind.value);
    const asset: MapAsset = {
      id,
      kind: newAssetKind.value,
      url,
      position: { ...mapDocument.value.layers.center },
      size: [48, 48],
      anchor: [24, 24],
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      clickBehavior: "none",
    };
    markEdited(addMapAsset(mapDocument.value, asset));
    selectedAssetId.value = id;
    statusMessage.value = "素材已上传并放到地图中心，拖拽后点击保存。";
  } catch (error) {
    handleRequestError(error, owner, "地图素材上传失败，请稍后重试。");
  } finally {
    if (isCurrent(owner)) uploading.value = false;
    input.value = "";
    finishRequest(owner);
  }
}

function requestReload() {
  if (!dirty.value) {
    void loadMap({ discardDirty: true });
    return;
  }
  if (!pendingReloadConfirmation.value) {
    pendingReloadConfirmation.value = true;
    pendingDeleteAssetId.value = "";
    statusMessage.value = "再次点击“确认丢弃并重载”才会丢弃未保存修改。";
    return;
  }
  pendingReloadConfirmation.value = false;
  void loadMap({ discardDirty: true });
}

function deleteSelectedAsset() {
  if (!mapDocument.value || !selectedAssetId.value) return;
  const id = selectedAssetId.value;
  if (pendingDeleteAssetId.value !== id) {
    pendingDeleteAssetId.value = id;
    pendingReloadConfirmation.value = false;
    statusMessage.value = `再次点击“确认删除 ${id}”才会移除素材；保存后才会写入服务端。`;
    return;
  }
  markEdited(removeMapAsset(mapDocument.value, id));
  selectedAssetId.value = "";
}

function exportMapJson() {
  if (!mapDocument.value) return;
  const blob = new Blob([JSON.stringify(mapDocument.value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lian-map-v2-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

watch(
  () => [props.token, props.authEpoch] as const,
  () => {
    retireRequests();
    mapDocument.value = null;
    selectedAssetId.value = "";
    pendingReloadConfirmation.value = false;
    pendingDeleteAssetId.value = "";
    dirty.value = false;
    if (props.token.trim()) void loadMap({ discardDirty: true });
  },
);

onMounted(() => void loadMap({ discardDirty: true }));
onBeforeUnmount(() => {
  disposed = true;
  retireRequests();
  mapDocument.value = null;
});
</script>

<template>
  <section class="admin-map-editor" aria-label="地图编辑器">
    <header class="admin-map-editor__header">
      <div>
        <h2>地图编辑器</h2>
        <p>上传素材后可在画布中拖拽、缩放和旋转；点击保存才会写入服务端。</p>
      </div>
      <div class="admin-map-editor__actions">
        <button type="button" :disabled="loading || saving" @click="requestReload">
          {{ pendingReloadConfirmation ? "确认丢弃并重载" : "重新加载" }}
        </button>
        <button type="button" :disabled="!mapDocument" @click="exportMapJson">导出 JSON</button>
        <button
          type="button"
          data-testid="admin-map-save"
          :disabled="!dirty || saving || loading"
          @click="saveMap"
        >
          {{ saving ? "保存中…" : dirty ? "保存修改" : "已保存" }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="admin-map-editor__message is-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="statusMessage" class="admin-map-editor__message" role="status">
      {{ statusMessage }}
    </p>

    <div class="admin-map-editor__toolbar">
      <label>
        素材类型
        <select v-model="newAssetKind">
          <option value="camera">摄像头</option>
          <option value="street-light">路灯</option>
          <option value="stall">摊位</option>
          <option value="sign">标牌</option>
          <option value="asset">其他</option>
        </select>
      </label>
      <label class="admin-map-editor__upload">
        {{ uploading ? "上传中…" : "上传并添加素材" }}
        <input
          data-testid="admin-map-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          :disabled="uploading || !mapDocument"
          @change="handleUpload"
        />
      </label>
      <span>素材 {{ mapDocument?.layers.assets?.length || 0 }} 个</span>
    </div>

    <div v-if="selectedAsset" class="admin-map-editor__selection">
      <strong>{{ selectedAsset.id }}</strong>
      <label>类型 <input v-model.trim="selectedKind" type="text" /></label>
      <label>宽 <input v-model.number="selectedWidth" type="number" min="8" max="512" /></label>
      <label>高 <input v-model.number="selectedHeight" type="number" min="8" max="512" /></label>
      <label>
        旋转
        <input v-model.number="selectedRotation" type="number" min="-360" max="360" />
      </label>
      <button
        type="button"
        class="admin-map-editor__danger"
        data-testid="admin-map-delete"
        @click="deleteSelectedAsset"
      >
        {{
          pendingDeleteAssetId === selectedAsset.id ? `确认删除 ${selectedAsset.id}` : "删除素材"
        }}
      </button>
    </div>

    <div class="admin-map-editor__canvas">
      <p v-if="loading && !mapData" class="admin-map-editor__loading">正在加载地图数据…</p>
      <MapCanvas
        v-else
        :map-data="mapData"
        :road-preview="null"
        :loading="loading"
        :editable="true"
        :selected-asset-id="selectedAssetId"
        @object-select="selectAsset"
        @object-change="handleObjectChange"
      />
    </div>
  </section>
</template>

<style scoped>
.admin-map-editor {
  display: grid;
  gap: var(--space-3);
}

.admin-map-editor__header,
.admin-map-editor__toolbar,
.admin-map-editor__selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-map-editor__header h2,
.admin-map-editor__header p {
  margin: 0;
}

.admin-map-editor__header p {
  margin-top: var(--space-1);
  color: var(--lian-muted);
  font-size: 13px;
}

.admin-map-editor__actions,
.admin-map-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.admin-map-editor button,
.admin-map-editor select,
.admin-map-editor input {
  min-height: 38px;
  border: 1px solid var(--lian-border);
  border-radius: 10px;
  background: var(--lian-card-strong);
  color: var(--lian-ink);
  font: inherit;
}

.admin-map-editor button {
  padding: 0 var(--space-3);
  font-weight: 800;
  cursor: pointer;
}

.admin-map-editor button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.admin-map-editor__toolbar,
.admin-map-editor__selection {
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-card);
  background: var(--lian-card);
}

.admin-map-editor__toolbar label,
.admin-map-editor__selection label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 13px;
  font-weight: 800;
}

.admin-map-editor__selection input {
  width: 88px;
  padding: 0 var(--space-2);
}

.admin-map-editor__upload {
  position: relative;
  min-height: 38px;
  padding: 0 var(--space-3);
  overflow: hidden;
  border-radius: 10px;
  background: #0f766e;
  color: #ffffff;
  cursor: pointer;
}

.admin-map-editor__upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.admin-map-editor__message {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-weight: 800;
}

.admin-map-editor__message.is-error,
.admin-map-editor button.admin-map-editor__danger {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.admin-map-editor__canvas {
  position: relative;
  min-height: 560px;
  overflow: hidden;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-card);
}

.admin-map-editor__canvas :deep(.map-canvas) {
  min-height: 560px;
  height: min(72vh, 760px);
}

.admin-map-editor__loading {
  padding: var(--space-4);
  color: var(--lian-muted);
}

@media (max-width: 720px) {
  .admin-map-editor__header,
  .admin-map-editor__toolbar,
  .admin-map-editor__selection {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-map-editor__canvas,
  .admin-map-editor__canvas :deep(.map-canvas) {
    min-height: 480px;
    height: 68vh;
  }
}
</style>
