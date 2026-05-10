<script setup lang="ts">
import { IdentityBadge, TagChip } from "../../ui";
import type { ProfileAlias, ProfileUser } from "../../types/profile";

defineProps<{
  user: ProfileUser;
  avatarText: string;
  displayName: string;
  identityMeta: string;
  userTags: string[];
  activeAlias: ProfileAlias | null;
  activeAliasHint: string;
  activeAliasSummary: Array<{ label: string; value: string }>;
}>();
</script>

<template>
  <div class="profile-header">
    <section class="profile-header__identity" aria-label="当前身份">
      <IdentityBadge :avatar-text="avatarText" :label="displayName" :meta="identityMeta" />
      <p>{{ user.email || "邀请码用户" }} · {{ user.institution || "校园用户" }}</p>
      <div v-if="userTags.length" class="profile-header__chips" aria-label="身份标签">
        <TagChip v-for="tag in userTags" :key="tag" :tag="tag" />
      </div>
    </section>

    <section class="profile-header__alias-card" aria-label="马甲身份说明">
      <div>
        <strong>{{ activeAlias ? activeAlias.name : "真实身份" }}</strong>
        <p>{{ activeAliasHint }}</p>
      </div>
      <dl v-if="activeAliasSummary.length" class="profile-header__alias-grid">
        <div v-for="item in activeAliasSummary" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.profile-header,
.profile-header__identity {
  display: grid;
  gap: var(--space-4);
}

.profile-header p {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.6;
}

.profile-header__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.profile-header__alias-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.16);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.08);
}

.profile-header__alias-card strong {
  display: block;
  margin-bottom: 4px;
  color: var(--lian-ink);
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
  border: 1px solid rgba(31, 41, 51, 0.08);
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
</style>
