<script setup lang="ts">
import { computed } from "vue";
import { TagChip } from "../../ui";
import type { ProfileAlias, ProfileUser } from "../../types/profile";

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
      <p class="profile-header__sub">{{ user.institution || "校园用户" }} · {{ user.email || "邀请码用户" }}</p>
    </div>

    <div v-if="userTags.length" class="profile-header__chips" aria-label="身份标签">
      <TagChip v-for="tag in userTags" :key="tag" :tag="tag" />
    </div>

    <section v-if="activeAlias || activeAliasSummary.length" class="profile-header__alias-card" :class="{ 'profile-header__alias-card--clickable': hasMultipleAliases }" aria-label="马甲身份说明" v-bind="hasMultipleAliases ? { role: 'button', tabindex: 0, 'aria-expanded': aliasPickerOpen, 'aria-haspopup': 'listbox' } : {}" @click="hasMultipleAliases ? emit('toggle-alias-picker') : undefined" @keydown.enter="hasMultipleAliases ? emit('toggle-alias-picker') : undefined" @keydown.space.prevent="hasMultipleAliases ? emit('toggle-alias-picker') : undefined">
      <div class="profile-header__alias-head">
        <strong>{{ activeAlias ? activeAlias.name : "真实身份" }}</strong>
        <span class="profile-header__alias-head-row">
          <span>{{ activeAliasHint }}</span>
          <span v-if="hasMultipleAliases" class="profile-header__alias-count">{{ aliases.length }}个身份</span>
        </span>
      </div>
      <dl v-if="activeAliasSummary.length" class="profile-header__alias-grid">
        <div v-for="item in activeAliasSummary" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <div v-if="aliasPickerOpen && aliases.length" class="profile-header__alias-picker" role="listbox" aria-label="选择发布身份">
      <button
        type="button"
        class="profile-header__alias-option"
        :class="{ 'is-active': !user.activeAliasId }"
        role="option"
        :aria-selected="!user.activeAliasId"
        @click.stop="emit('select-alias', '')"
      >
        <span>{{ displayName }}</span>
        <small>真实身份</small>
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
        <small>{{ alias.categoryLabel || "官方马甲" }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-header {
  display: grid;
  gap: var(--space-4);
}

.profile-header__hero {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4) var(--space-4);
  text-align: center;
}

.profile-header__avatar {
  display: grid;
  width: 80px;
  height: 80px;
  place-items: center;
  border-radius: var(--radius-orb);
  background: linear-gradient(135deg, var(--lian-primary-soft), rgba(91, 184, 214, 0.18));
  color: var(--lian-primary-deep);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.profile-header__name {
  margin: 0;
  color: var(--lian-ink);
  font-size: 22px;
  font-weight: 900;
  line-height: 1.3;
}

.profile-header__meta {
  margin: 0;
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
}

.profile-header__sub {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-header__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
}

.profile-header__alias-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.14);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.06);
}

.profile-header__alias-card--clickable {
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--motion-ease-standard), background var(--motion-fast) var(--motion-ease-standard);
}

.profile-header__alias-card--clickable:hover {
  border-color: rgba(31, 167, 160, 0.28);
  background: rgba(31, 167, 160, 0.1);
}

.profile-header__alias-card--clickable:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.profile-header__alias-head {
  display: grid;
  gap: 4px;
}

.profile-header__alias-head-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.profile-header__alias-count {
  padding: 2px 8px;
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.12);
  color: var(--lian-primary);
  font-size: 11px;
  font-weight: 850;
  line-height: 1.4;
  white-space: nowrap;
}

.profile-header__alias-head strong {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 900;
}

.profile-header__alias-head span {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-header__alias-grid {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.profile-header__alias-grid div {
  display: grid;
  gap: 4px;
  padding: var(--space-2);
  border: 1px solid rgba(31, 41, 51, 0.06);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.profile-header__alias-grid dt {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.profile-header__alias-grid dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.5;
}

.profile-header__alias-picker {
  display: grid;
  gap: var(--space-2);
}

.profile-header__alias-option {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-ink);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--motion-fast) var(--motion-ease-standard), background var(--motion-fast) var(--motion-ease-standard);
}

.profile-header__alias-option:hover {
  border-color: rgba(31, 167, 160, 0.24);
  background: rgba(31, 167, 160, 0.06);
}

.profile-header__alias-option.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.12);
}

.profile-header__alias-option span {
  font-weight: 900;
}

.profile-header__alias-option small {
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
