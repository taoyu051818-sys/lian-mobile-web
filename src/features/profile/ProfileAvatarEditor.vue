<script setup lang="ts">
import { IdentityBadge, LianButton } from "../../ui";
import { updateProfileAvatar, uploadProfileAvatar } from "../../api/profile";
import { useAvatarCropper } from "./useAvatarCropper";

const props = defineProps<{
  avatarText: string;
  displayName: string;
  activeAliasName: string;
}>();

const emit = defineEmits<{
  updated: [];
  error: [message: string];
}>();

const {
  file,
  previewUrl,
  scale,
  offsetX,
  offsetY,
  busy,
  previewRef,
  previewStyle,
  handleInput,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleTouchMove,
  handleTouchEnd,
  createCroppedBlob,
  revokePreview,
  cancel,
} = useAvatarCropper();

async function saveAvatar() {
  if (!file.value || busy.value) return;
  busy.value = true;
  try {
    const blob = await createCroppedBlob(file.value, scale.value, offsetX.value, offsetY.value);
    const croppedFile = new File([blob], file.value.name || "avatar.jpg", { type: "image/jpeg" });
    const avatarUrl = await uploadProfileAvatar(croppedFile);
    await updateProfileAvatar(avatarUrl);
    file.value = null;
    revokePreview();
    emit("updated");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "头像没有更新成功，可以稍后再试。";
    emit("error", msg);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="profile-editor__block" aria-labelledby="profile-avatar-title">
    <div class="profile-editor__block-title">
      <strong id="profile-avatar-title">头像</strong>
      <span>拖拽调整位置，捏合或滑块缩放</span>
    </div>
    <div class="profile-editor__avatar-row">
      <IdentityBadge
        :avatar-text="props.avatarText"
        :label="props.displayName"
        :meta="props.activeAliasName"
      />
      <div
        v-if="previewUrl"
        ref="previewRef"
        class="profile-editor__avatar-preview"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <img :src="previewUrl" alt="头像裁剪预览" :style="previewStyle()" />
      </div>
    </div>
    <label class="profile-editor__upload">
      <span>{{ previewUrl ? "重新选择图片" : "选择头像图片" }}</span>
      <input type="file" accept="image/*" @change="handleInput" />
    </label>
    <label v-if="previewUrl" class="profile-editor__range">
      <span>缩放</span>
      <input v-model.number="scale" type="range" min="1" max="2.4" step="0.05" />
    </label>
    <div v-if="previewUrl" class="profile-editor__actions">
      <LianButton type="button" variant="ghost" :disabled="busy" @click="cancel">取消</LianButton>
      <LianButton type="button" variant="tonal" :loading="busy" @click="saveAvatar"
        >保存头像</LianButton
      >
    </div>
  </section>
</template>

<style scoped>
.profile-editor__avatar-row,
.profile-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
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

.profile-editor__actions {
  justify-content: flex-start;
}
</style>
