<script setup lang="ts">
import { computed } from "vue";
import type { ProfileUser } from "../../types/profile";
import { useProfileAliasSwitch } from "./useProfileAliasSwitch";

const props = defineProps<{
  user: ProfileUser;
  displayName: string;
}>();

const emit = defineEmits<{
  switched: [];
  error: [message: string];
}>();

const { busy, switchAlias } = useProfileAliasSwitch();

const aliases = computed(() => props.user.aliases || []);
const activeAliasId = computed(() => props.user.activeAliasId || "");
const activeAliasName = computed(
  () => aliases.value.find((alias) => alias.id === activeAliasId.value)?.name || "真实身份",
);

function handleSwitch(aliasId: string) {
  switchAlias(
    aliasId,
    () => emit("switched"),
    (message) => emit("error", message),
  );
}

defineExpose({ activeAliasName });
</script>

<template>
  <section class="profile-editor__block" aria-labelledby="profile-alias-title">
    <div class="profile-editor__block-title">
      <strong id="profile-alias-title">发布身份</strong>
      <span>{{ activeAliasName }}</span>
    </div>
    <div class="profile-editor__alias-list">
      <label class="profile-editor__alias" :class="{ 'is-active': !activeAliasId }">
        <input
          type="radio"
          name="profileAlias"
          value=""
          :checked="!activeAliasId"
          :disabled="busy"
          @change="handleSwitch('')"
        />
        <span>{{ displayName }}</span>
        <small>真实身份</small>
      </label>
      <label
        v-for="alias in aliases"
        :key="alias.id"
        class="profile-editor__alias"
        :class="{ 'is-active': alias.id === activeAliasId }"
      >
        <input
          type="radio"
          name="profileAlias"
          :value="alias.id"
          :checked="alias.id === activeAliasId"
          :disabled="busy"
          @change="handleSwitch(alias.id)"
        />
        <span>{{ alias.name }}</span>
        <small>官方马甲</small>
      </label>
    </div>
    <p v-if="!aliases.length" class="profile-editor__hint">
      暂无可用官方马甲，当前使用真实身份发布。
    </p>
  </section>
</template>
