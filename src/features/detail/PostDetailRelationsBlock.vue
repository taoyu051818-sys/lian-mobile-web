<script setup lang="ts">
/**
 * Post graph relations block (PRD V0.3 §2.4 / B3-1).
 *
 * mw#986 landed `PostDetail.relations` as a normalized wire atom — `{ type,
 * target: { kind, id }, role? }`. This block is the first UI consumer: it
 * renders an inline "相关" section listing each relation. `type` maps to a
 * human-readable label via a small inline table; unknown types fall back to
 * the literal `type` string so the backend can grow new relation kinds
 * (delivery / groupbuy / channel / ledger / future) without forcing a frontend
 * release. Anonymous-safe by construction: this block renders only `target.kind`
 * / `target.id`, never author / alias fields, so there is no path that could
 * regress to a real-identity label for an anonymous-author target.
 *
 * Navigation: `target.kind === "post"` taps the in-app detail-navigation FSM
 * (`detail.open(tid, "card")`) — the same entry point feed cards and merchant
 * center use. The codebase has no vue-router, so a `<router-link>` would be a
 * non-functional placeholder. `target.kind === "resource"` is read-only text
 * for now; B3-1 does not own a resource viewer route.
 *
 * Out of scope for B3-1 (tracked on the parent issue): profile / feed-card /
 * notifications surfaces; resource navigation; relation type enum lock; any
 * relation-side write action.
 */
import { computed } from "vue";
import {
  RELATIONS_BLOCK_LABEL,
  RELATION_TARGET_RESOURCE_PREFIX,
  RELATION_TYPE_EVENT_RECAP,
  RELATION_TYPE_EVENT_REWARD,
  RELATION_TYPE_HELP_EVENT_LINK,
  RELATION_TYPE_MERCHANT_ERRAND,
  RELATION_TYPE_PROJECT_SUBMISSION,
  RELATION_TYPE_SOLUTION_EVENT,
} from "../../config/brand";
import type { PostRelation } from "../../types/post";
import { useDetailNavigation } from "../../app/detail-navigation";

const props = defineProps<{
  relations?: PostRelation[];
}>();

// Initial mapper, seeded from mw#966 body. Unknown types fall back to the
// literal `type` string in the template; adding a known type is a
// brand-string + table change, not a renderer change.
const RELATION_TYPE_LABEL: Record<string, string> = {
  help_event_link: RELATION_TYPE_HELP_EVENT_LINK,
  solution_event: RELATION_TYPE_SOLUTION_EVENT,
  event_recap: RELATION_TYPE_EVENT_RECAP,
  merchant_errand: RELATION_TYPE_MERCHANT_ERRAND,
  project_submission: RELATION_TYPE_PROJECT_SUBMISSION,
  event_reward: RELATION_TYPE_EVENT_REWARD,
};

function relationTypeLabel(type: string): string {
  return RELATION_TYPE_LABEL[type] ?? type;
}

interface RelationView {
  key: string;
  type: string;
  typeLabel: string;
  targetKind: string;
  targetId: string;
  isPost: boolean;
  postTid: number | null;
}

const entries = computed<RelationView[]>(() => {
  const list = props.relations;
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((relation, index) => {
    const targetKind = relation.target?.kind ?? "";
    const targetId = relation.target?.id ?? "";
    const isPost = targetKind === "post";
    // The wire shape is `id: string`, but post tids are numeric — coerce
    // when navigating so `detail.open(tid)` gets the number it expects.
    const postTid = isPost ? Number(targetId) : NaN;
    return {
      key: `${relation.type}-${targetKind}-${targetId}-${index}`,
      type: relation.type,
      typeLabel: relationTypeLabel(relation.type),
      targetKind,
      targetId: String(targetId),
      isPost,
      postTid: Number.isFinite(postTid) && postTid > 0 ? postTid : null,
    } satisfies RelationView;
  });
});

const detail = useDetailNavigation();

function openPostTarget(view: RelationView) {
  if (!view.isPost || view.postTid === null) return;
  detail.open(view.postTid, "card");
}
</script>

<template>
  <section
    v-if="entries.length"
    class="post-detail-relations-block"
    :aria-label="RELATIONS_BLOCK_LABEL"
    data-testid="post-detail-relations-block"
  >
    <header class="post-detail-relations-block__header">
      <span class="post-detail-relations-block__title">{{ RELATIONS_BLOCK_LABEL }}</span>
    </header>
    <ul class="post-detail-relations-block__list">
      <li
        v-for="entry in entries"
        :key="entry.key"
        class="post-detail-relations-block__item"
        :data-relation-type="entry.type"
        :data-target-kind="entry.targetKind"
        data-testid="post-detail-relations-item"
      >
        <span class="post-detail-relations-block__type">{{ entry.typeLabel }}</span>
        <button
          v-if="entry.isPost && entry.postTid !== null"
          type="button"
          class="post-detail-relations-block__target post-detail-relations-block__target--link"
          :data-target-id="entry.targetId"
          data-testid="post-detail-relations-target-post"
          @click="openPostTarget(entry)"
        >
          #{{ entry.targetId }}
        </button>
        <span
          v-else
          class="post-detail-relations-block__target post-detail-relations-block__target--text"
          :data-target-id="entry.targetId"
          data-testid="post-detail-relations-target-resource"
        >
          [{{ RELATION_TARGET_RESOURCE_PREFIX }}:{{ entry.targetId }}]
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.post-detail-relations-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-relations-block__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-relations-block__title {
  color: var(--lian-muted);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-detail-relations-block__list {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.post-detail-relations-block__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 14px;
  color: var(--lian-ink);
}

.post-detail-relations-block__type {
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 700;
}

.post-detail-relations-block__target--link {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--lian-accent, #2858a5);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.post-detail-relations-block__target--text {
  color: var(--lian-muted);
}
</style>
