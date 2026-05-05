<script setup lang="ts">
import { computed, ref } from "vue";
import {
  activateProfileAlias,
  createInviteCode,
  deactivateProfileAlias,
  updateProfileAvatar,
  uploadProfileAvatar,
} from "../../api/profile";
import { IdentityBadge, InlineError, LianButton, TrustBadge, TypeChip } from "../../ui";
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
const avatarBusy = ref(false);
const aliasBusy = ref(false);
const inviteBusy = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const inviteCode = ref("");

const displayName = computed(() => props.user.username || "同学");
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
  errorMessage.value = error instanceof Error ? error.message : fallback;
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
  errorMessage.value = "";
  successMessage.value = "";
}

async function createCroppedAvatarBlob(file: File, scale: number) {
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器暂时不能裁剪头像，请换一个浏览器再试。");

  const sourceSize = Math.min(bitmap.width, bitmap.height) / Math.max(1, scale);
  const sourceX = (bitmap.width - sourceSize) / 2;
  const sourceY = (bitmap.height - sourceSize) / 2;
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
    const croppedBlob = await createCroppedAvatarBlob(avatarFile.value, avatarScale.value);
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
</script>

<template>
  <section class="profile-editor" aria-labelledby="profile-editor-title">
    <header class="profile-editor__header">
      <div>
        <TypeChip type="official">资料管理</TypeChip>
        <h3 id="profile-editor-title">编辑资料</h3>
      </div>
      <TrustBadge tone="pending">Vue canary</TrustBadge>
    </header>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <p v-if="successMessage" class="profile-editor__success">{{ successMessage }}</p>

    <section class="profile-editor__block" aria-labelledby="profile-avatar-title">
      <div class="profile-editor__block-title">
        <strong id="profile-avatar-title">头像</strong>
        <span>中心裁剪，支持缩放</span>
      </div>
      <div class="profile-editor__avatar-row">
        <IdentityBadge :avatar-text="avatarText" :label="displayName" :meta="activeAliasName" />
        <div v-if="avatarPreviewUrl" class="profile-editor__avatar-preview" :style="{ '--avatar-scale': avatarScale }">
          <img :src="avatarPreviewUrl" alt="头像裁剪预览" />
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
        <LianButton type="button" variant="ghost" :disabled="avatarBusy" @click="() => { avatarFile = null; revokePreview(); }">取消</LianButton>
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
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
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
}

.profile-editor__avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(var(--avatar-scale));
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
