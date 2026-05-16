<script setup lang="ts">
import { computed } from "vue";
import { LianButton } from "../../ui";
import type { ProfileUser } from "../../types/profile";
import {
  PROFILE_INVITE_TITLE,
  PROFILE_INVITE_GENERATE,
  PROFILE_INVITE_HINT,
  PROFILE_INVITE_AVAILABLE,
  PROFILE_INVITE_UNAVAILABLE,
} from "../../config/brand";
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
      <strong id="profile-invite-title">{{ PROFILE_INVITE_TITLE }}</strong>
      <span>{{ canCreateInvite ? PROFILE_INVITE_AVAILABLE : PROFILE_INVITE_UNAVAILABLE }}</span>
    </div>
    <div class="profile-editor__invite-row">
      <LianButton
        type="button"
        variant="ghost"
        :disabled="!canCreateInvite"
        :loading="busy"
        @click="handleGenerate"
      >
        {{ PROFILE_INVITE_GENERATE }}
      </LianButton>
      <code v-if="inviteCode">{{ inviteCode }}</code>
    </div>
    <p class="profile-editor__hint">{{ PROFILE_INVITE_HINT }}</p>
  </section>
</template>
