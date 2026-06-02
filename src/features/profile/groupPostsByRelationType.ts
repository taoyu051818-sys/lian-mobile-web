/**
 * PRD V0.3 §2.4 / B3-2 — profile 页"关系视角"分组纯函数。
 *
 * 把当前用户的 ProfileListItem[] 按 V2 relation type 分到三个产品桶：
 *   - participated:  `event_recap` / `event_reward`     (我参与的活动)
 *   - helped:        `help_event_link` / `solution_event` (我求助过的帖)
 *   - merchant:      `merchant_errand` / `project_submission` (商家关联)
 *
 * 设计要点：
 *   1. **纯函数** — 不依赖 Vue / store / DOM，方便单测。`groupPostsByRelationType`
 *      接受拍平好的 items + currentUserId，返回三个桶。
 *   2. **同帖去重** — 一个帖子可能挂多条 relation（例如同一帖既是 event_recap
 *      又是 event_reward），只在第一个匹配的桶里出现一次，后续桶不重复。
 *      去重 key 是 `tid || id`，这与 ProfileCollectionList 的 `key` 取值一致。
 *   3. **空 relations** — 没有 `relations[]` 或者 relations 全是未识别 type 的
 *      item 不进入任何桶（"暂无内容"由调用方负责渲染）。
 *   4. **匿名性** — 函数完全不读 actor / alias / user / displayName / avatarUrl
 *      字段，渲染层也只用 post.title / tid / relation type label。匿名设计原
 *      则 [[anonymous-design-principle]] 要求即便后端漏了 alias 也不能 fallback
 *      到真实身份字段；这一层不读身份字段所以从根上避开了这个风险。
 *   5. **currentUserId 暂未消费** — 列表本身就来自 `/api/me/posts`，所以"当前
 *      用户的 post"是后端筛过的；保留参数是为了未来 filter 出"用户作为求助方
 *      vs 解题方"的子角色（relation.role）。今天 role 不参与桶决策，避免在
 *      角色字段还没全量上线前误分类。
 */
import type { ProfileListItem } from "../../types/profile";

export type ProfileRelationGroupKey = "participated" | "helped" | "merchant" | "groupbuy";

/**
 * 桶 → 该桶承载的 V2 relation type 集合。新增 relation type 走这里加，
 * 不动 grouping 主流程。
 */
export const PROFILE_RELATION_GROUP_TYPES: Record<ProfileRelationGroupKey, ReadonlySet<string>> = {
  participated: new Set(["event_recap", "event_reward"]),
  helped: new Set(["help_event_link", "solution_event"]),
  merchant: new Set(["merchant_errand", "project_submission"]),
  groupbuy: new Set(["groupbuy_joined", "groupbuy_created"]),
};

/** 桶在 UI 里的展示顺序。SSR / hydration 都按这个顺序遍历，避免抖动。 */
export const PROFILE_RELATION_GROUP_ORDER: readonly ProfileRelationGroupKey[] = [
  "participated",
  "helped",
  "merchant",
  "groupbuy",
];

export interface ProfileRelationGroupResult {
  participated: ProfileListItem[];
  helped: ProfileListItem[];
  merchant: ProfileListItem[];
  groupbuy: ProfileListItem[];
}

function itemKey(item: ProfileListItem): string {
  if (typeof item.tid === "number" && item.tid > 0) return String(item.tid);
  return item.id || "";
}

/**
 * 主入口。把 items 按 relation type 分桶。
 *
 * 行为：
 *   - 没有 relations / 空数组 / 未识别 type 的 item 不进入任何桶。
 *   - 每个 item 在多桶匹配时只进入第一个匹配的桶（顺序由
 *     `PROFILE_RELATION_GROUP_ORDER` 决定）。
 *   - 同一桶内不会因为同 item 多 relation 而出现两次（按 tid/id 去重）。
 *
 * @param items 来自 `/api/me/posts` 等活动列表 API 的 `ProfileListItem[]`。
 * @param currentUserId 预留参数，今天不参与决策，未来 role 字段稳定后用于
 *   "求助方 vs 解题方"子分类。
 */
export function groupPostsByRelationType(
  items: readonly ProfileListItem[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for role-aware grouping
  currentUserId?: string,
): ProfileRelationGroupResult {
  const result: ProfileRelationGroupResult = {
    participated: [],
    helped: [],
    merchant: [],
    groupbuy: [],
  };
  const seenInBucket: Record<ProfileRelationGroupKey, Set<string>> = {
    participated: new Set(),
    helped: new Set(),
    merchant: new Set(),
    groupbuy: new Set(),
  };

  for (const item of items) {
    const relations = item.relations;
    if (!Array.isArray(relations) || relations.length === 0) continue;

    // 在 ORDER 顺序下找第一个有匹配 relation 的桶。一旦命中桶就把 item 放
    // 进去并 break — 同 item 不会跨桶出现两次。
    for (const group of PROFILE_RELATION_GROUP_ORDER) {
      const accepted = PROFILE_RELATION_GROUP_TYPES[group];
      const hit = relations.some((relation) => accepted.has(relation.type));
      if (!hit) continue;

      const key = itemKey(item);
      if (key && seenInBucket[group].has(key)) break;
      if (key) seenInBucket[group].add(key);
      result[group].push(item);
      break;
    }
  }

  return result;
}
