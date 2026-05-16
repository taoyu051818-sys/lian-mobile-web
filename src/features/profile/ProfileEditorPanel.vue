<script setup lang="ts">
import { computed, ref } from "vue";
import {
  activateProfileAlias,
  createInviteCode,
  deactivateProfileAlias,
} from "../../api/profile";
import { InlineError, LianButton, TypeChip } from "../../ui";
import { DEFAULT_USER_LABEL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { ProfileUser } from "../../types/profile";
import ProfileAvatarEditor from "./ProfileAvatarEditor.vue";

const props = defineProps<{
  user: ProfileUser;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const aliasBusy = ref(false);
const inviteBusy = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const inviteCode = ref("");

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

function handleAvatarUpdated() {
  showSuccess("头像已更新。");
  emit("updated");
}

function handleAvatarError(message: string) {
  successMessage.value = "";
  errorMessage.value = message;
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
  <section class="profile-editor keyboard-aware-surface" aria-labelledby="profile-editor-title">
    <header class="profile-editor__header">
      <div>
        <TypeChip type="official">资料管理</TypeChip>
        <h3 id="profile-editor-title">编辑资料</h3>
      </div>
    </header>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>
    <p v-if="successMessage" class="profile-editor__success">{{ successMessage }}</p>

    <ProfileAvatarEditor
      :avatar-text="avatarText"
      :display-name="displayName"
      :active-alias-name="activeAliasName"
      @updated="handleAvatarUpdated"
      @error="handleAvatarError"
    />

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
.profile-editor__hint {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-editor__success {
  color: var(--lian-primary);
  font-weight: 850;
}

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
