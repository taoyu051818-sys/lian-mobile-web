<script setup lang="ts">
import { computed } from "vue";
import { LianButton } from "../../ui";
import type { ProfileUser } from "../../types/profile";
import { useInviteCode } from "./useInviteCode";

const props = defineProps<{
  user: ProfileUser;
}>();

const emit = defineEmits<{
  success: [message: string];
  error: [message: string];
}>();

const { busy, inviteCode, generate } = useInviteCode();
const canCreateInvite = computed(() => Boolean(props.user.invitePermission));

function handleGenerate() {
  generate(
    (message) => emit("success", message),
    (message) => emit("error", message),
  );
}
</script>

<template>
  <section class="profile-editor__block" aria-labelledby="profile-invite-title">
    <div class="profile-editor__block-title">
      <strong id="profile-invite-title">邀请码</strong>
      <span>{{ canCreateInvite ? "可生成" : "暂无权限" }}</span>
    </div>
    <div class="profile-editor__invite-row">
      <LianButton type="button" variant="ghost" :disabled="!canCreateInvite" :loading="busy" @click="handleGenerate">
        生成邀请码
      </LianButton>
      <code v-if="inviteCode">{{ inviteCode }}</code>
    </div>
    <p class="profile-editor__hint">邀请码用于非高校邮箱注册场景。</p>
  </section>
</template>
