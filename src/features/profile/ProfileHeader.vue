<script setup lang="ts">
import { computed } from "vue";
import { TagChip } from "../../ui";
import {
  PROFILE_CAMPUS_USER,
  PROFILE_INVITE_USER,
  PROFILE_IDENTITY_TAGS,
  PROFILE_ALIAS_DESC,
  PROFILE_REAL_IDENTITY,
  PROFILE_ALIAS_COUNT_SUFFIX,
  PROFILE_SELECT_IDENTITY,
  PROFILE_OFFICIAL_ALIAS,
} from "../../config/brand";
import type { ProfileAlias, ProfileUser } from "../../types/profile";
import ProfileVerificationBadges from "./ProfileVerificationBadges.vue";

const props = defineProps<{
  user: ProfileUser;
  avatarText: string;
  displayName: string;
  identityMeta: string;
  userTags: string[];
  aliases: ProfileAlias[];
  activeAlias: ProfileAlias | null;
  activeAliasHint: string;
  activeAliasSummary: Array<{ label: string; value: string }>;
  aliasPickerOpen: boolean;
}>();

const emit = defineEmits<{
  "toggle-alias-picker": [];
  "select-alias": [aliasId: string];
}>();

const hasMultipleAliases = computed(() => props.aliases.length > 0);
</script>

<template>
  <div class="profile-header">
    <div class="profile-header__hero">
      <div class="profile-header__avatar" aria-hidden="true">{{ avatarText }}</div>
      <h1 class="profile-header__name">{{ displayName }}</h1>
      <p class="profile-header__meta">{{ identityMeta }}</p>
      <p class="profile-header__sub">
        {{ user.institution || PROFILE_CAMPUS_USER }} · {{ user.email || PROFILE_INVITE_USER }}
      </p>
    </div>

    <ProfileVerificationBadges :user="user" />

    <div v-if="userTags.length" class="profile-header__chips" :aria-label="PROFILE_IDENTITY_TAGS">
      <TagChip v-for="tag in userTags" :key="tag" :tag="tag" />
    </div>

    <section
      v-if="activeAlias || activeAliasSummary.length"
      class="profile-header__alias-card"
      :class="{ 'profile-header__alias-card--clickable': hasMultipleAliases }"
      :aria-label="PROFILE_ALIAS_DESC"
      v-bind="
        hasMultipleAliases
          ? {
              role: 'button',
              tabindex: 0,
              'aria-expanded': aliasPickerOpen,
              'aria-haspopup': 'listbox',
            }
          : {}
      "
      @click="hasMultipleAliases ? emit('toggle-alias-picker') : undefined"
      @keydown.enter="hasMultipleAliases ? emit('toggle-alias-picker') : undefined"
      @keydown.space.prevent="hasMultipleAliases ? emit('toggle-alias-picker') : undefined"
    >
      <div class="profile-header__alias-head">
        <strong>{{ activeAlias ? activeAlias.name : PROFILE_REAL_IDENTITY }}</strong>
        <span class="profile-header__alias-head-row">
          <span>{{ activeAliasHint }}</span>
          <span v-if="hasMultipleAliases" class="profile-header__alias-count"
            >{{ aliases.length }}{{ PROFILE_ALIAS_COUNT_SUFFIX }}</span
          >
        </span>
      </div>
      <dl v-if="activeAliasSummary.length" class="profile-header__alias-grid">
        <div v-for="item in activeAliasSummary" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <div
      v-if="aliasPickerOpen && aliases.length"
      class="profile-header__alias-picker"
      role="listbox"
      :aria-label="PROFILE_SELECT_IDENTITY"
    >
      <button
        type="button"
        class="profile-header__alias-option"
        :class="{ 'is-active': !user.activeAliasId }"
        role="option"
        :aria-selected="!user.activeAliasId"
        @click.stop="emit('select-alias', '')"
      >
        <span>{{ displayName }}</span>
        <small>{{ PROFILE_REAL_IDENTITY }}</small>
      </button>
      <button
        v-for="alias in aliases"
        :key="alias.id"
        type="button"
        class="profile-header__alias-option"
        :class="{ 'is-active': alias.id === user.activeAliasId }"
        role="option"
        :aria-selected="alias.id === user.activeAliasId"
        @click.stop="emit('select-alias', alias.id)"
      >
        <span>{{ alias.name }}</span>
        <small>{{ alias.categoryLabel || PROFILE_OFFICIAL_ALIAS }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
@import "./profile-header.css";
</style>
