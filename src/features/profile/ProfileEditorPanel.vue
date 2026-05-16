<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  activateProfileAlias,
  createInviteCode,
  deactivateProfileAlias,
  updateProfileAvatar,
  uploadProfileAvatar,
} from "../../api/profile";
import { IdentityBadge, InlineError, LianButton, TypeChip } from "../../ui";
import { DEFAULT_USER_LABEL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { ProfileUser } from "../../types/profile";

const props = defineProps<{
  user: ProfileUser;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const avatarFile = ref<File | null>(null);
const avatarPreviewUrl = ref("");
const avatarScale = ref(1);
const avatarOffsetX = ref(0);
const avatarOffsetY = ref(0);
const avatarPreviewRef = ref<HTMLElement | null>(null);
const avatarBusy = ref(false);
const aliasBusy = ref(false);
const inviteBusy = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const inviteCode = ref("");

const AVATAR_PREVIEW_SIZE = 96;
const AVATAR_MIN_SCALE = 1;
const AVATAR_MAX_SCALE = 2.4;

const dragPointerId = ref<number | null>(null);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartOffsetX = ref(0);
const dragStartOffsetY = ref(0);
const pinchStartDist = ref(0);
const pinchStartScale = ref(1);

const displayName = computed(() => props.user.username || DEFAULT_USER_LABEL);
const avatarText = computed(() => displayName.value.slice(0, 2) || "同");
const aliases = computed(() => props.user.aliases || []);
const activeAliasId = computed(() => props.user.activeAliasId || "");
const activeAliasName = computed(() => aliases.value.find((alias) => alias.id === activeAliasId.value)?.name || "真实身份");
const canCreateInvite = computed(() => Boolean(props.user.invitePermission));

function showSuccess(message: string) {
  errorMessage.value = "";
  successMessage.value = message;
}

function showError(error: unknown, fallback: string) {
  successMessage.value = "";
  errorMessage.value = extractErrorMessage(error, fallback);
}

function revokePreview() {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value);
  avatarPreviewUrl.value = "";
}

function handleAvatarInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = Array.from(input.files || []).find((item) => item.type.startsWith("image/"));
  input.value = "";
  if (!file) return;
  revokePreview();
  avatarFile.value = file;
  avatarPreviewUrl.value = URL.createObjectURL(file);
  avatarScale.value = 1;
  avatarOffsetX.value = 0;
  avatarOffsetY.value = 0;
  errorMessage.value = "";
  successMessage.value = "";
}

const avatarPreviewTransform = computed(
  () => `translate(${avatarOffsetX.value}px, ${avatarOffsetY.value}px) scale(${avatarScale.value})`,
);

function avatarPreviewStyle() {
  return {
    transform: avatarPreviewTransform.value,
    touchAction: "none",
  } as Record<string, string>;
}

function clampAvatarOffset() {
  const s = avatarScale.value;
  const maxOffset = ((s - 1) / s) * (AVATAR_PREVIEW_SIZE / 2);
  avatarOffsetX.value = Math.max(-maxOffset, Math.min(maxOffset, avatarOffsetX.value));
  avatarOffsetY.value = Math.max(-maxOffset, Math.min(maxOffset, avatarOffsetY.value));
}

function handleAvatarPointerDown(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (dragPointerId.value !== null) return;
  dragPointerId.value = event.pointerId;
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  dragStartOffsetX.value = avatarOffsetX.value;
  dragStartOffsetY.value = avatarOffsetY.value;
  avatarPreviewRef.value?.setPointerCapture(event.pointerId);
}

function handleAvatarPointerMove(event: PointerEvent) {
  if (dragPointerId.value !== event.pointerId) return;
  event.preventDefault();
  avatarOffsetX.value = dragStartOffsetX.value + (event.clientX - dragStartX.value);
  avatarOffsetY.value = dragStartOffsetY.value + (event.clientY - dragStartY.value);
  clampAvatarOffset();
}

function handleAvatarPointerUp(event: PointerEvent) {
  if (dragPointerId.value === event.pointerId) dragPointerId.value = null;
}

function handleAvatarTouchMove(event: TouchEvent) {
  if (event.touches.length < 2) return;
  event.preventDefault();
  const t0 = event.touches[0];
  const t1 = event.touches[1];
  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  if (pinchStartDist.value === 0) {
    pinchStartDist.value = dist;
    pinchStartScale.value = avatarScale.value;
    return;
  }
  const nextScale = pinchStartScale.value * (dist / pinchStartDist.value);
  avatarScale.value = Math.max(AVATAR_MIN_SCALE, Math.min(AVATAR_MAX_SCALE, nextScale));
  clampAvatarOffset();
}

function handleAvatarTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) {
    pinchStartDist.value = 0;
  }
}

async function createCroppedAvatarBlob(file: File, scale: number, offsetX: number, offsetY: number) {
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器暂时不能裁剪头像，请换一个浏览器再试。");

  const previewScale = AVATAR_PREVIEW_SIZE / Math.min(bitmap.width, bitmap.height);
  const bitmapOffsetX = offsetX / previewScale;
  const bitmapOffsetY = offsetY / previewScale;
  const sourceSize = Math.min(bitmap.width, bitmap.height) / Math.max(1, scale);
  const sourceX = (bitmap.width - sourceSize) / 2 - bitmapOffsetX;
  const sourceY = (bitmap.height - sourceSize) / 2 - bitmapOffsetY;
  context.clearRect(0, 0, size, size);
  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("头像裁剪失败，请换一张图片再试。"));
    }, "image/jpeg", 0.9);
  });
}

async function saveAvatar() {
  if (!avatarFile.value || avatarBusy.value) return;
  avatarBusy.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const croppedBlob = await createCroppedAvatarBlob(avatarFile.value, avatarScale.value, avatarOffsetX.value, avatarOffsetY.value);
    const croppedFile = new File([croppedBlob], avatarFile.value.name || "avatar.jpg", { type: "image/jpeg" });
    const avatarUrl = await uploadProfileAvatar(croppedFile);
    await updateProfileAvatar(avatarUrl);
    avatarFile.value = null;
    revokePreview();
    showSuccess("头像已更新。");
    emit("updated");
  } catch (error) {
    showError(error, "头像没有更新成功，可以稍后再试。");
  } finally {
    avatarBusy.value = false;
  }
}

async function switchAlias(aliasId: string) {
  if (aliasBusy.value) return;
  aliasBusy.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    if (aliasId) await activateProfileAlias(aliasId);
    else await deactivateProfileAlias();
    showSuccess("发布身份已切换。");
    emit("updated");
  } catch (error) {
    showError(error, "发布身份没有切换成功，可以稍后再试。");
  } finally {
    aliasBusy.value = false;
  }
}

async function generateInviteCode() {
  if (inviteBusy.value) return;
  inviteBusy.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const response = await createInviteCode();
    inviteCode.value = response.code || "";
    showSuccess(inviteCode.value ? "邀请码已生成。" : "邀请码请求已提交。");
  } catch (error) {
    showError(error, "邀请码没有生成成功，可以稍后再试。");
  } finally {
    inviteBusy.value = false;
  }
}

onBeforeUnmount(() => {
  revokePreview();
});
</script>

<template>
  <section class="profile-editor keyboard-aware-surface" aria-labelledby="profile-editor-title">
    <header class="profile-editor__header">
      <div>
        <TypeChip type="official">资料管理</TypeChip>
        <h3 id="profile-editor-title">编辑资料</h3>
      </div>
    </header>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <p v-if="successMessage" class="profile-editor__success">{{ successMessage }}</p>

    <section class="profile-editor__block" aria-labelledby="profile-avatar-title">
      <div class="profile-editor__block-title">
        <strong id="profile-avatar-title">头像</strong>
        <span>拖拽调整位置，捏合或滑块缩放</span>
      </div>
      <div class="profile-editor__avatar-row">
        <IdentityBadge :avatar-text="avatarText" :label="displayName" :meta="activeAliasName" />
        <div
          v-if="avatarPreviewUrl"
          ref="avatarPreviewRef"
          class="profile-editor__avatar-preview"
          @pointerdown="handleAvatarPointerDown"
          @pointermove="handleAvatarPointerMove"
          @pointerup="handleAvatarPointerUp"
          @pointercancel="handleAvatarPointerUp"
          @touchmove="handleAvatarTouchMove"
          @touchend="handleAvatarTouchEnd"
        >
          <img :src="avatarPreviewUrl" alt="头像裁剪预览" :style="avatarPreviewStyle()" />
        </div>
      </div>
      <label class="profile-editor__upload">
        <span>{{ avatarPreviewUrl ? "重新选择图片" : "选择头像图片" }}</span>
        <input type="file" accept="image/*" @change="handleAvatarInput" />
      </label>
      <label v-if="avatarPreviewUrl" class="profile-editor__range">
        <span>缩放</span>
        <input v-model.number="avatarScale" type="range" min="1" max="2.4" step="0.05" />
      </label>
      <div v-if="avatarPreviewUrl" class="profile-editor__actions">
        <LianButton type="button" variant="ghost" :disabled="avatarBusy" @click="() => { avatarFile = null; avatarScale = 1; avatarOffsetX = 0; avatarOffsetY = 0; revokePreview(); }">取消</LianButton>
        <LianButton type="button" variant="tonal" :loading="avatarBusy" @click="saveAvatar">保存头像</LianButton>
      </div>
    </section>

    <section class="profile-editor__block" aria-labelledby="profile-alias-title">
      <div class="profile-editor__block-title">
        <strong id="profile-alias-title">发布身份</strong>
        <span>{{ activeAliasName }}</span>
      </div>
      <div class="profile-editor__alias-list">
        <label class="profile-editor__alias" :class="{ 'is-active': !activeAliasId }">
          <input type="radio" name="profileAlias" value="" :checked="!activeAliasId" :disabled="aliasBusy" @change="switchAlias('')" />
          <span>{{ displayName }}</span>
          <small>真实身份</small>
        </label>
        <label
          v-for="alias in aliases"
          :key="alias.id"
          class="profile-editor__alias"
          :class="{ 'is-active': alias.id === activeAliasId }"
        >
          <input type="radio" name="profileAlias" :value="alias.id" :checked="alias.id === activeAliasId" :disabled="aliasBusy" @change="switchAlias(alias.id)" />
          <span>{{ alias.name }}</span>
          <small>官方马甲</small>
        </label>
      </div>
      <p v-if="!aliases.length" class="profile-editor__hint">暂无可用官方马甲，当前使用真实身份发布。</p>
    </section>

    <section class="profile-editor__block" aria-labelledby="profile-invite-title">
      <div class="profile-editor__block-title">
        <strong id="profile-invite-title">邀请码</strong>
        <span>{{ canCreateInvite ? "可生成" : "暂无权限" }}</span>
      </div>
      <div class="profile-editor__invite-row">
        <LianButton type="button" variant="ghost" :disabled="!canCreateInvite" :loading="inviteBusy" @click="generateInviteCode">
          生成邀请码
        </LianButton>
        <code v-if="inviteCode">{{ inviteCode }}</code>
      </div>
      <p class="profile-editor__hint">邀请码用于非高校邮箱注册场景。</p>
    </section>
  </section>
</template>

<style scoped>
.profile-editor,
.profile-editor__block,
.profile-editor__alias-list {
  display: grid;
  gap: var(--space-4);
}

.profile-editor {
  padding: var(--space-3);
  padding-bottom: calc(var(--space-3) + min(var(--keyboard-inset-bottom), 240px));
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.profile-editor__header,
.profile-editor__block-title,
.profile-editor__avatar-row,
.profile-editor__actions,
.profile-editor__invite-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-editor h3,
.profile-editor p {
  margin: 0;
}

.profile-editor__block {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.42);
  scroll-margin-bottom: calc(var(--space-6) + var(--keyboard-inset-bottom));
}

.profile-editor__block-title span,
.profile-editor__hint,
.profile-editor__range span {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-editor__success {
  color: var(--lian-primary);
  font-weight: 850;
}

.profile-editor__avatar-preview {
  width: 96px;
  height: 96px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-orb);
  background: rgba(31, 41, 51, 0.06);
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.profile-editor__avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center center;
  pointer-events: none;
  -webkit-user-drag: none;
}

.profile-editor__upload,
.profile-editor__range {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 850;
}

.profile-editor__upload {
  position: relative;
  min-height: 52px;
  place-items: center;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.58);
  color: var(--lian-ink);
  cursor: pointer;
}

.profile-editor__upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.profile-editor__range input {
  width: 100%;
}

.profile-editor__actions,
.profile-editor__invite-row {
  justify-content: flex-start;
}

.profile-editor__alias {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
}

.profile-editor__alias.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.12);
}

.profile-editor__alias span {
  font-weight: 900;
}

.profile-editor__alias small {
  color: var(--lian-muted);
}

.profile-editor code {
  padding: 8px 10px;
  border-radius: var(--radius-3);
  background: rgba(31, 41, 51, 0.08);
  color: var(--lian-ink);
  font-weight: 900;
}
</style>
