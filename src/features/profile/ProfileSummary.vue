<script setup lang="ts">
import { computed } from "vue";
import { PROFILE_RELOAD } from "../../config/brand";
import type { ProfileSettings, ProfileStats } from "../../types/profile";
import { InlineError } from "../../ui";

const PROFILE_SUMMARY_TITLE = "个人概览";
const PROFILE_STATS_TITLE = "活动统计";
const PROFILE_SETTINGS_TITLE = "当前设置";
const PROFILE_SUMMARY_LOADING = "正在同步个人概览…";
const PROFILE_FORUM_LINK_NOTICE = "论坛同步";
const PROFILE_FORUM_LINK_READY = "论坛活动已接入当前账号。";
const PROFILE_FORUM_LINK_MISSING =
  "当前账号还没有绑定论坛身份，发布、回复和地图贡献会暂时显示为空。";
const PROFILE_SETTING_ENABLED = "已开启";
const PROFILE_SETTING_DISABLED = "已关闭";
const PROFILE_SETTING_NOTIFICATIONS = "消息提醒";
const PROFILE_SETTING_VISIBILITY = "资料可见范围";
const PROFILE_SETTING_MENTIONS = "允许提及";
const PROFILE_SETTING_VISIBILITY_PUBLIC = "公开";
const PROFILE_SETTING_VISIBILITY_PRIVATE = "仅自己";
const PROFILE_SETTING_VISIBILITY_CAMPUS = "校内";
const PROFILE_STATS_POSTS = "发布";
const PROFILE_STATS_REPLIES = "回复";
const PROFILE_STATS_SAVED = "收藏";
const PROFILE_STATS_LIKED = "赞过";
const PROFILE_STATS_DRAFTS = "草稿";
const PROFILE_STATS_MAP = "地图贡献";

const props = defineProps<{
  stats: ProfileStats;
  settings: ProfileSettings;
  loading: boolean;
  error: string;
  hasForumLink: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const statsCards = computed(() => [
  { label: PROFILE_STATS_POSTS, value: props.stats.posts },
  { label: PROFILE_STATS_REPLIES, value: props.stats.replies },
  { label: PROFILE_STATS_SAVED, value: props.stats.saved },
  { label: PROFILE_STATS_LIKED, value: props.stats.liked },
  { label: PROFILE_STATS_DRAFTS, value: props.stats.drafts },
  { label: PROFILE_STATS_MAP, value: props.stats.mapContributions },
]);

const settingsRows = computed(() => [
  {
    label: PROFILE_SETTING_NOTIFICATIONS,
    value: props.settings.notificationEnabled
      ? PROFILE_SETTING_ENABLED
      : PROFILE_SETTING_DISABLED,
  },
  {
    label: PROFILE_SETTING_VISIBILITY,
    value:
      props.settings.profileVisibility === "public"
        ? PROFILE_SETTING_VISIBILITY_PUBLIC
        : props.settings.profileVisibility === "private"
          ? PROFILE_SETTING_VISIBILITY_PRIVATE
          : PROFILE_SETTING_VISIBILITY_CAMPUS,
  },
  {
    label: PROFILE_SETTING_MENTIONS,
    value: props.settings.allowMessageMentions
      ? PROFILE_SETTING_ENABLED
      : PROFILE_SETTING_DISABLED,
  },
]);

const forumLinkText = computed(
  () =>
    props.hasForumLink
      ? PROFILE_FORUM_LINK_READY
      : PROFILE_FORUM_LINK_MISSING,
);
</script>

<template>
  <section class="profile-summary" aria-labelledby="profile-summary-title">
    <header class="profile-summary__header">
      <div>
        <p class="profile-summary__eyebrow">{{ PROFILE_SUMMARY_TITLE }}</p>
        <h2 id="profile-summary-title">{{ PROFILE_STATS_TITLE }}</h2>
      </div>
      <button
        v-if="error"
        type="button"
        class="profile-summary__retry"
        @click="emit('retry')"
      >
        {{ PROFILE_RELOAD }}
      </button>
    </header>

    <InlineError v-if="error">{{ error }}</InlineError>

    <div v-if="loading" class="profile-summary__state" role="status">
      {{ PROFILE_SUMMARY_LOADING }}
    </div>

    <template v-else>
      <dl class="profile-summary__metrics" :aria-label="PROFILE_STATS_TITLE">
        <div
          v-for="card in statsCards"
          :key="card.label"
          class="profile-summary__metric"
        >
          <dt>{{ card.label }}</dt>
          <dd>{{ card.value }}</dd>
        </div>
      </dl>

      <section class="profile-summary__settings" aria-labelledby="profile-settings-title">
        <h3 id="profile-settings-title">{{ PROFILE_SETTINGS_TITLE }}</h3>
        <dl class="profile-summary__settings-grid">
          <div
            v-for="row in settingsRows"
            :key="row.label"
            class="profile-summary__setting-row"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="profile-summary__forum-note" aria-labelledby="profile-forum-title">
        <h3 id="profile-forum-title">{{ PROFILE_FORUM_LINK_NOTICE }}</h3>
        <p>{{ forumLinkText }}</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.profile-summary {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.profile-summary__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: flex-start;
  justify-content: space-between;
}

.profile-summary__header h2,
.profile-summary__settings h3,
.profile-summary__forum-note h3,
.profile-summary__metrics dt,
.profile-summary__settings-grid dt,
.profile-summary__settings-grid dd,
.profile-summary__metrics dd,
.profile-summary__forum-note p {
  margin: 0;
}

.profile-summary__eyebrow {
  margin: 0 0 4px;
  color: var(--lian-primary);
  font-size: 12px;
  font-weight: 850;
}

.profile-summary__retry {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.12);
  color: var(--lian-primary-deep);
  font: inherit;
  font-weight: 850;
}

.profile-summary__state {
  display: grid;
  min-height: 96px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.profile-summary__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.profile-summary__metric,
.profile-summary__setting-row,
.profile-summary__forum-note {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.58);
}

.profile-summary__metric {
  display: grid;
  gap: 4px;
}

.profile-summary__metric dt,
.profile-summary__setting-row dt {
  color: var(--lian-muted);
  font-size: 12px;
}

.profile-summary__metric dd {
  color: var(--lian-ink);
  font-size: 22px;
  font-weight: 900;
}

.profile-summary__settings {
  display: grid;
  gap: var(--space-2);
}

.profile-summary__settings-grid {
  display: grid;
  gap: var(--space-2);
}

.profile-summary__setting-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-summary__setting-row dd {
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 850;
}

.profile-summary__forum-note {
  display: grid;
  gap: 6px;
}

.profile-summary__forum-note p {
  color: var(--lian-muted);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .profile-summary__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
