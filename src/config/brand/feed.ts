/** 信息流视图 UI */
export const FEED_VIEW_TITLE = "首页";
export const FEED_FILTER_LABEL = "信息分类";
export const FEED_EMPTY_HINT = "可以换个分类，或稍后再来看看。";

/** 信息流卡片 UI */
export const FEED_PLACE_CAMPUS = "校园";
export const FEED_TIME_JUST_NOW = "刚刚";
export const FEED_LIKE = "喜欢";
export const FEED_UNLIKE = "取消喜欢";
export const FEED_COLLAPSE = "收起";
export const FEED_EXPAND = "展开";

/** 卡片模板视觉记号（FeedItemCard.vue templateMark 字符标） */
export const FEED_CARD_MARK_MERCHANT = "食";
export const FEED_CARD_MARK_CLUB = "社";

/** 社团卡片 UI */
export const CLUB_CARD_PRESIDENT_LABEL = "社长";
export const CLUB_CARD_FOUNDED_LABEL = "成立于";
export const CLUB_CARD_MEMBERS_LABEL = "成员";
export const CLUB_CATEGORY_LABELS: Record<string, string> = {
  academic: "学术",
  sports: "体育",
  arts: "艺术",
  volunteer: "志愿",
  tech: "科技",
  culture: "文化",
  other: "其他",
};

/** 信息流 UI */
export const FEED_LOAD_MORE = "加载更多";
export const FEED_SEEN_ALL = "已经看到这里啦";

/** 可见性标签 */
export const FEED_VISIBILITY_LABELS: Record<string, string> = {
  campus: "本校",
  school: "校园",
  private: "私密",
  linkOnly: "链接可见",
};

/** 可见性图标（统一用 graduation-cap 表示 campus） */
export const FEED_VISIBILITY_ICONS: Record<string, string> = {
  campus: "graduation-cap",
  school: "building",
  private: "lock",
  linkOnly: "link",
};

/** Feed 筛选 UI */
export const FEED_FILTER_BAR_LABEL = "可见范围筛选";
export const FEED_FILTER_VISIBILITY_ALL = "全部";
export const FEED_FILTER_VISIBILITY_PUBLIC = "公开";
export const FEED_FILTER_VISIBILITY_CAMPUS = "校区";
export const FEED_FILTER_VISIBILITY_SCHOOL = "学校";
export const FEED_FILTER_VISIBILITY_PRIVATE = "私密";
export const FEED_FILTER_VISIBILITY_LINK_ONLY = "仅链接";
export const FEED_FILTER_EXPAND = "展开筛选";
export const FEED_FILTER_COLLAPSE = "收起筛选";
/**
 * Dual-state filter bar (option C) — toggle between visibility chips and
 * feed tabs. The two aria-labels below name the toggle button states; the
 * existing FEED_FILTER_EXPAND / FEED_FILTER_COLLAPSE are kept for the
 * legacy single-state collapse-summary mode if a host opts in.
 */
export const FEED_FILTER_SHOW_TABS = "展开分类";
export const FEED_FILTER_SHOW_VISIBILITY = "显示可见范围";
export const FEED_FILTER_TABS_GROUP_LABEL = "信息分类";

/** 手势操作 UI */
export const GESTURE_PULL_TO_REFRESH = "下拉刷新";
export const GESTURE_RELEASE_TO_REFRESH = "释放刷新";
export const GESTURE_REFRESHING = "刷新中...";
export const GESTURE_SWIPE_DELETE = "删除";
export const GESTURE_SWIPE_MARK_READ = "已读";
export const GESTURE_SWIPE_BOOKMARK = "收藏";
export const GESTURE_CONTEXT_SHARE = "分享";
export const GESTURE_CONTEXT_BOOKMARK = "收藏";
export const GESTURE_CONTEXT_REPORT = "举报";
