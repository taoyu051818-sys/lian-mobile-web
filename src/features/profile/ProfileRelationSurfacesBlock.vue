<script setup lang="ts">
/**
 * PRD V0.3 §2.4 / B3-2 — profile 页"关系视角"分组区块。
 *
 * 把当前用户的 ProfileListItem[] 按 V2 relation type 分到三个产品桶并以
 * section 列表渲染。点击单条 → `detail.open(tid, "card")`，沿用 profile
 * 页其它列表的统一 FSM 入口（仓库无 vue-router）。
 *
 * 与 mw#996 的 `PostDetailRelationsBlock` 互不重叠：
 *   - PostDetailRelationsBlock 是单帖详情内嵌"相关"列表（详情 → relations[]）。
 *   - 本组件是 profile 列表分组（用户活动 → 按 relation type 分桶展示）。
 *
 * 匿名性：模板只读 `post.title` / `post.tid` / `relation.type` 中文 label，
 * 完全不读 actor / alias / user / displayName / avatarUrl 字段；空 title fallback
 * 到通用占位 `UNTITLED_CONTENT`，绝不回退到身份字段
 * （[[anonymous-design-principle]]）。
 */
import { computed } from "vue";
import {
  AVAILABLE_ACTION_CLAIM_REWARD,
  AVAILABLE_ACTION_COMPLETE_ERRAND,
  AVAILABLE_ACTION_MARK_SOLVED,
  AVAILABLE_ACTION_MESSAGE_AUTHOR,
  AVAILABLE_ACTION_TRADE_RESERVE,
  PROFILE_RELATION_GROUP_HELPED_TITLE,
  PROFILE_RELATION_GROUP_MERCHANT_TITLE,
  PROFILE_RELATION_GROUP_GROUPBUY_TITLE,
  PROFILE_RELATION_GROUP_PARTICIPATED_TITLE,
  PROFILE_RELATION_GROUP_SECTION_LABEL,
  PROFILE_RELATION_TYPE_EVENT_RECAP_TAG,
  PROFILE_RELATION_TYPE_EVENT_REWARD_TAG,
  PROFILE_RELATION_TYPE_GROUPBUY_CREATED_TAG,
  PROFILE_RELATION_TYPE_GROUPBUY_JOINED_TAG,
  PROFILE_RELATION_TYPE_HELP_EVENT_LINK_TAG,
  PROFILE_RELATION_TYPE_MERCHANT_ERRAND_TAG,
  PROFILE_RELATION_TYPE_PROJECT_SUBMISSION_TAG,
  PROFILE_RELATION_TYPE_SOLUTION_EVENT_TAG,
  UNTITLED_CONTENT,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileListItem } from "../../types/profile";
import { useDetailNavigation } from "../../app/detail-navigation";
import {
  groupPostsByRelationType,
  PROFILE_RELATION_GROUP_ORDER,
  PROFILE_RELATION_GROUP_TYPES,
  type ProfileRelationGroupKey,
} from "./groupPostsByRelationType";

const props = defineProps<{
  items: ProfileListItem[];
  currentUserId?: string;
}>();

const SECTION_TITLES: Record<ProfileRelationGroupKey, string> = {
  participated: PROFILE_RELATION_GROUP_PARTICIPATED_TITLE,
  helped: PROFILE_RELATION_GROUP_HELPED_TITLE,
  merchant: PROFILE_RELATION_GROUP_MERCHANT_TITLE,
  groupbuy: PROFILE_RELATION_GROUP_GROUPBUY_TITLE,
};

// type → 中文 tag。和 detail 侧的 RELATION_TYPE_* 不复用 — 这里的措辞是
// 用户视角（"奖励"/"求助关联活动"），不是关系视角（"事件奖励"/"求助-事件链接"）。
const TYPE_TAG_LABEL: Record<string, string> = {
  event_recap: PROFILE_RELATION_TYPE_EVENT_RECAP_TAG,
  event_reward: PROFILE_RELATION_TYPE_EVENT_REWARD_TAG,
  help_event_link: PROFILE_RELATION_TYPE_HELP_EVENT_LINK_TAG,
  solution_event: PROFILE_RELATION_TYPE_SOLUTION_EVENT_TAG,
  merchant_errand: PROFILE_RELATION_TYPE_MERCHANT_ERRAND_TAG,
  project_submission: PROFILE_RELATION_TYPE_PROJECT_SUBMISSION_TAG,
  groupbuy_joined: PROFILE_RELATION_TYPE_GROUPBUY_JOINED_TAG,
  groupbuy_created: PROFILE_RELATION_TYPE_GROUPBUY_CREATED_TAG,
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  mark_solved: AVAILABLE_ACTION_MARK_SOLVED,
  claim_reward: AVAILABLE_ACTION_CLAIM_REWARD,
  complete_errand: AVAILABLE_ACTION_COMPLETE_ERRAND,
  trade_reserve: AVAILABLE_ACTION_TRADE_RESERVE,
  message_author: AVAILABLE_ACTION_MESSAGE_AUTHOR,
};

function uniqueLabels(types: string[], labels: Record<string, string>) {
  return Array.from(new Set(types.filter(Boolean))).map((type) => labels[type] ?? type);
}

interface RelationItemView {
  key: string;
  tid: FeedItemId | null;
  title: string;
  // 命中本桶的所有 relation type tag — 一帖可能挂多 relation，都展示。
  tags: string[];
  actions: string[];
}

interface RelationSectionView {
  key: ProfileRelationGroupKey;
  title: string;
  items: RelationItemView[];
}

function buildItemView(item: ProfileListItem, group: ProfileRelationGroupKey): RelationItemView {
  const accepted = PROFILE_RELATION_GROUP_TYPES[group];
  const hitTypes = (Array.isArray(item.relations) ? item.relations : [])
    .map((relation) => relation.type)
    .filter((type) => accepted.has(type));
  const tags = uniqueLabels(hitTypes, TYPE_TAG_LABEL);
  const actions = uniqueLabels(
    (Array.isArray(item.availableActions) ? item.availableActions : []).map(
      (action) => action.type,
    ),
    ACTION_TYPE_LABEL,
  );

  const tid = typeof item.tid === "number" && item.tid > 0 ? item.tid : null;
  const key = tid !== null ? `${group}-${tid}` : `${group}-${item.id || item.title || "row"}`;
  return {
    key,
    tid,
    title: item.title || UNTITLED_CONTENT,
    tags,
    actions,
  };
}

const sections = computed<RelationSectionView[]>(() => {
  const grouped = groupPostsByRelationType(props.items, props.currentUserId);
  return PROFILE_RELATION_GROUP_ORDER.map((key) => ({
    key,
    title: SECTION_TITLES[key],
    items: grouped[key].map((item) => buildItemView(item, key)),
  })).filter((section) => section.items.length > 0);
});

const detail = useDetailNavigation();
function openItem(tid: FeedItemId | null) {
  if (tid === null) return;
  detail.open(tid, "card");
}
</script>

<template>
  <section
    v-if="sections.length"
    class="profile-relation-surfaces"
    :aria-label="PROFILE_RELATION_GROUP_SECTION_LABEL"
    data-testid="profile-relation-surfaces"
  >
    <article
      v-for="section in sections"
      :key="section.key"
      class="profile-relation-surfaces__group"
      :data-group="section.key"
      data-testid="profile-relation-surfaces-group"
    >
      <header class="profile-relation-surfaces__group-header">
        <h3 class="profile-relation-surfaces__group-title">{{ section.title }}</h3>
      </header>
      <ul class="profile-relation-surfaces__list">
        <li
          v-for="entry in section.items"
          :key="entry.key"
          class="profile-relation-surfaces__item"
          :data-tid="entry.tid !== null ? String(entry.tid) : ''"
          :role="entry.tid !== null ? 'button' : undefined"
          :tabindex="entry.tid !== null ? 0 : undefined"
          data-testid="profile-relation-surfaces-item"
          @click="openItem(entry.tid)"
          @keydown.enter="openItem(entry.tid)"
          @keydown.space.prevent="openItem(entry.tid)"
        >
          <span class="profile-relation-surfaces__title">{{ entry.title }}</span>
          <span class="profile-relation-surfaces__tags">
            <span
              v-for="tag in entry.tags"
              :key="tag"
              class="profile-relation-surfaces__tag"
              data-testid="profile-relation-surfaces-tag"
            >
              {{ tag }}
            </span>
            <span
              v-for="action in entry.actions"
              :key="action"
              class="profile-relation-surfaces__action"
              data-testid="profile-relation-surfaces-action"
            >
              {{ action }}
            </span>
          </span>
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.profile-relation-surfaces {
  display: grid;
  gap: var(--space-3);
}

.profile-relation-surfaces__group {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-card);
}

.profile-relation-surfaces__group-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.profile-relation-surfaces__group-title {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.4;
}

.profile-relation-surfaces__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-relation-surfaces__item {
  display: grid;
  gap: 4px;
  padding: var(--space-2);
  border-radius: var(--radius-3, 8px);
  background: rgba(31, 167, 160, 0.04);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
}

.profile-relation-surfaces__item:hover {
  background: rgba(31, 167, 160, 0.09);
}

.profile-relation-surfaces__item:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.profile-relation-surfaces__item:active {
  transform: scale(0.99);
}

.profile-relation-surfaces__title {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.profile-relation-surfaces__tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.profile-relation-surfaces__tag,
.profile-relation-surfaces__action {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(31, 167, 160, 0.12);
  color: var(--lian-primary-deep);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.profile-relation-surfaces__action {
  background: rgba(255, 184, 77, 0.18);
  color: var(--lian-warning, #a15c00);
}
</style>
