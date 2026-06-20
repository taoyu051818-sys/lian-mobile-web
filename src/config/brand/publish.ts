/** 发布操作栏 */
export const PUBLISH_CLEAR = "清空";
export const PUBLISH_SUBMIT = "发布";

/** 发布地点 UI */
export const PUBLISH_LOCATION_LABEL = "地点";
export const PUBLISH_LOCATION_BOUND = "已绑定已知地点";
export const PUBLISH_LOCATION_HINT = "默认收起，按需展开";
export const PUBLISH_LOCATION_MANUAL = "手填地点";
export const PUBLISH_LOCATION_MANUAL_PLACEHOLDER = "例如 图书馆、食堂、教学楼，也可以留空";
export const PUBLISH_LOCATION_SEARCH = "搜索已知地点";
export const PUBLISH_LOCATION_SEARCH_PLACEHOLDER = "搜索图书馆、食堂、教学楼…";
export const PUBLISH_LOCATION_NO_MATCH = "没有匹配地点，可以手填地点发布。";
export const PUBLISH_LOCATION_SWITCH_MANUAL = "改用手填";

/** 发布地点选择器 (mw#943 — map picker + geolocation) */
export const PUBLISH_LOCATION_USE_CURRENT = "📍 使用当前位置";
export const PUBLISH_LOCATION_PICK_ON_MAP = "🗺️ 在地图上选";
export const PUBLISH_LOCATION_GEOLOC_FETCHING = "正在定位…";
export const PUBLISH_LOCATION_GEOLOC_DENIED = "位置权限被拒绝，请在浏览器设置开启";
export const PUBLISH_LOCATION_GEOLOC_UNAVAILABLE = "无法获取当前位置";
export const PUBLISH_LOCATION_GEOLOC_TIMEOUT = "定位超时，请重试";
export const PUBLISH_LOCATION_GEOLOC_UNSUPPORTED = "当前设备不支持定位";
export const PUBLISH_LOCATION_GEOLOC_HINT = "使用了当前坐标，可以手填一个名字让别人更好认";
export const PUBLISH_LOCATION_PIN_LABEL = "自定义坐标";

/** 地图选择模式 (mw#943 — picker overlay) */
export const MAP_PICKER_TITLE = "选择地点";
export const MAP_PICKER_HINT = "点击已有地点，或长按地图任意位置放置自定义坐标";
export const MAP_PICKER_CONFIRM = "选这里";
export const MAP_PICKER_CANCEL = "取消";
export const MAP_PICKER_NO_SELECTION = "尚未选择地点";
export const MAP_PICKER_DROPPED_PIN = "自定义坐标";

/** 发布 meta UI */
export const PUBLISH_TAG_SETTINGS = "标签设置";
export const PUBLISH_TAG_LABEL = "标签";
export const PUBLISH_TAG_HINT = "让内容更好被理解";
export const PUBLISH_POST_TAG = "帖子标签";
export const PUBLISH_TAG_PLACEHOLDER = "一个标签，例如 #晚霞";
export const PUBLISH_TAG_PREVIEW = "帖子标签预览";
export const PUBLISH_IDENTITY_TAG = "身份标签";
export const PUBLISH_NO_IDENTITY_TAG = "不使用身份标签";
export const PUBLISH_VISIBILITY = "可见范围";

/** 发布视图 UI */
export const PUBLISH_SECTION_LABEL = "发布";
export const PUBLISH_IDENTITY_META = "当前身份";
export const PUBLISH_IDENTITY_UNCONFIRMED = "未确认身份";
export const PUBLISH_OPTIONAL = "可选";
export const PUBLISH_VIS_PUBLIC = "公开";
export const PUBLISH_VIS_CAMPUS = "校园";
export const PUBLISH_VIS_SCHOOL = "本校";
export const PUBLISH_VIS_PRIVATE = "仅自己";
export const PUBLISH_LOCATION_UNBOUND = "未绑定地点";
export const PUBLISH_LOCATION_MANUAL_HINT = "手填地点仅作为展示文本";
export const PUBLISH_IMAGE_MAX = "最多 {n} 张";
export const PUBLISH_IMAGE_UPLOADING = "上传中";
export const PUBLISH_IMAGE_READY = "已准备";
export const PUBLISH_IMAGE_COUNT_SUFFIX = "张";
export const PUBLISH_SUCCESS = "发布成功，稍后可以在首页看到。";
export const PUBLISH_SUCCESS_BOUND = "发布成功，已绑定到「{n}」。";
export const PUBLISH_VIEW_POST = "查看帖子";

/** 发布 composer UI */
export const PUBLISH_COMPOSER_LABEL = "发布内容";
export const PUBLISH_TITLE_LABEL = "标题";
export const PUBLISH_TITLE_PLACEHOLDER = "发生了什么？";
export const PUBLISH_BODY_LABEL = "正文";
export const PUBLISH_BODY_PLACEHOLDER = "写清楚内容、时间、限制或下一步。";
export const PUBLISH_SUMMARY_LABEL = "发布摘要";
export const PUBLISH_IMAGE_PILL_SUFFIX = "张图片";
export const PUBLISH_IDENTITY_PILL_PREFIX = "身份：";
export const PUBLISH_SETTINGS_LABEL = "发布附加设置";
export const PUBLISH_IMAGE_TOOLBAR = "图片";
export const PUBLISH_LOCATION_TOOLBAR = "地点";
export const PUBLISH_TAG_TOOLBAR = "标签";
export const PUBLISH_IMAGE_PREVIEW_LABEL = "图片预览";
export const PUBLISH_IMAGE_PREVIEW_ALT = "待发布图片";
export const PUBLISH_IMAGE_REMOVE_LABEL = "移除图片";

/** 发布结构化预览 */
export const PUBLISH_ACTIONABLE_PREVIEW_TITLE = "发布结构预览";
export const PUBLISH_ACTIONABLE_PREVIEW_KIND = "类型";
export const PUBLISH_ACTIONABLE_PREVIEW_WIRE_KIND = "发布为";
export const PUBLISH_ACTIONABLE_PREVIEW_LOCATION = "地点";
export const PUBLISH_ACTIONABLE_PREVIEW_EVENT = "活动";
export const PUBLISH_ACTIONABLE_PREVIEW_MERCHANT = "商家";
export const PUBLISH_ACTIONABLE_PREVIEW_TRADE = "交易";
export const PUBLISH_ACTIONABLE_PREVIEW_COMPONENTS = "待补充";
export const PUBLISH_ACTIONABLE_PREVIEW_ACTION = "行动";
export const PUBLISH_ACTIONABLE_PREVIEW_PUBLISHED = "将发布为";
export const PUBLISH_ACTIONABLE_PREVIEW_STRUCTURED_FIELD = "结构字段";
export const PUBLISH_ACTIONABLE_PREVIEW_UNSTRUCTURED =
  "当前只会发布为自由文本，补充地点、标签或建议组件后会生成结构化帖子。";

/** 发布确认与恢复 */
export const PUBLISH_CLEAR_CONFIRM = "当前发布内容还没有提交，确认清空吗？";
export const PUBLISH_IMAGE_RESELECT = "已选择的图片需要重新添加。";
export const PUBLISH_DRAFT_RECOVERED = "已恢复同一会话中的未发布内容。";
export const PUBLISH_RESET_CONTINUE = "继续编辑";
export const PUBLISH_RESET_CONFIRM_ACTION = "确认清空";

/** 发布 AI 草稿 */
export const PUBLISH_AI_PENDING = "AI 正在分析图片，稍后会自动填入草稿，先选择地点也可以…";
export const PUBLISH_AI_RISK_LABEL = "AI 风险提示";
export const PUBLISH_AI_UNAVAILABLE = "AI 草稿暂时不可用，可以手动填写后直接发布。";

/**
 * 发布 LLM 润色候选 (PRD V0.2 step B).
 *
 * 候选区是给 LLM 改写正文留的“候选槽位”——不会静默覆盖用户写的内容，
 * 必须由用户在 PublishCandidateBar 里点 `帮我润色` 显式应用，再可一键
 * `撤回润色` 回到上一步。Step B 仅落 UI 状态机，候选来源（实际 LLM
 * 调用）由 step C 接入。
 */
export const PUBLISH_BODY_CANDIDATE_APPLY = "✨ 帮我润色";
export const PUBLISH_BODY_CANDIDATE_REVERT = "↶ 撤回润色";
export const PUBLISH_BODY_CANDIDATE_LABEL = "AI 正文润色候选";

/**
 * 发布 LLM 标题候选 (PRD V0.2 step D).
 *
 * 标题候选与正文候选共用同一套「候选槽 + 一键应用 / 一键撤回」状态机
 * (见 §4.2.1 / §4.2.2)。本 step 仅落槽位与 UI，标题候选来源（实际 LLM
 * 调用）由 step E/F 接入。当前 PR 只保证：注入 candidate -> 出 bar；点应用
 * -> title 被替换；点撤回 -> title 被还原；用户键入 -> candidate 失效。
 */
export const PUBLISH_TITLE_CANDIDATE_APPLY = "✨ 帮我起标题";
export const PUBLISH_TITLE_CANDIDATE_REVERT = "↶ 撤回标题";
export const PUBLISH_TITLE_CANDIDATE_LABEL = "AI 标题候选";

/**
 * 发布 LLM inline ghost component (PRD V0.2 step E-main, §4.2.3).
 *
 * LLM 推断当前内容应该补充的字段时，在卡片下方以"虚线 ghost 卡片"的形式
 * 列出建议（地点 / 时间 / 价格 / 商家信息 / 物品状态 / 求助标签）。
 *
 *   - 加入 → acceptSuggestedComponent：把 ghost "实化"成对应 sub-draft
 *     （切换 publishKind / 写入 tagInput 等），然后从列表里移除。
 *   - 忽略 → dismissSuggestedComponent：仅从列表里移除，不影响 draft。
 *   - 用户继续输入触发下一次 LLM tick 时，整段列表会被新响应覆盖（pipe
 *     由 usePublishLlmTick 持续维护）。
 *
 * 屏幕阅读器读为「建议添加 X」(PRD §4.2.3 a11y 要求)。
 */
export const PUBLISH_SUGGESTED_COMPONENTS_LABEL = "AI 建议添加";
export const PUBLISH_SUGGESTED_ACCEPT = "加入";
export const PUBLISH_SUGGESTED_DISMISS = "忽略";
export const PUBLISH_SUGGESTED_HINT_PREFIX = "建议添加";
/** Per-kind 视觉前缀，紧跟 LLM 自带的 reason 文案。Emoji 与 PRD §2.1 / §4.2.3 示例对齐。
 * V0.3 stage B2 (paired with ps#624)：升级到 V2 component kinds（10 个）。 */
export const PUBLISH_SUGGESTED_KIND_ICON_LOCATION = "📍";
export const PUBLISH_SUGGESTED_KIND_ICON_TIME = "⏰";
export const PUBLISH_SUGGESTED_KIND_ICON_MEDIA = "🖼️";
export const PUBLISH_SUGGESTED_KIND_ICON_QUALITY = "✨";
export const PUBLISH_SUGGESTED_KIND_ICON_AUDIENCE = "👥";
export const PUBLISH_SUGGESTED_KIND_ICON_TAGS = "🏷️";
export const PUBLISH_SUGGESTED_KIND_ICON_EVENT = "📅";
export const PUBLISH_SUGGESTED_KIND_ICON_MERCHANT = "🏪";
export const PUBLISH_SUGGESTED_KIND_ICON_TRADE = "📦";
export const PUBLISH_SUGGESTED_KIND_ICON_HELP = "🤝";
export const PUBLISH_SUGGESTED_KIND_ICON_GROUPBUY = "拼";

/** 发布事件 (PRD V0.1 §6.3 / §11.2) */
export const PUBLISH_POST_TYPE_LABEL = "内容类型";
export const PUBLISH_POST_TYPE_POST = "普通帖子";
export const PUBLISH_POST_TYPE_EVENT = "活动 / 事件";
export const PUBLISH_EVENT_PANEL_LABEL = "活动设置";
export const PUBLISH_EVENT_START_AT = "开始时间";
export const PUBLISH_EVENT_END_AT = "结束时间";
export const PUBLISH_EVENT_TIME_HINT = "建议设置具体时间，便于他人安排参与";
export const PUBLISH_EVENT_CAPACITY = "人数上限";
export const PUBLISH_EVENT_CAPACITY_PLACEHOLDER = "留空表示不限";
export const PUBLISH_EVENT_JOIN_POLICY = "报名方式";
export const PUBLISH_EVENT_JOIN_OPEN = "自由报名";
export const PUBLISH_EVENT_JOIN_APPROVAL = "需要审核";
export const PUBLISH_EVENT_JOIN_ORG = "限本社团";
export const PUBLISH_EVENT_JOIN_SCHOOL = "限本校";
export const PUBLISH_EVENT_INVALID_TIME = "结束时间需要在开始时间之后。";
export const PUBLISH_EVENT_CAPACITY_NOT_INT = "人数上限需要填整数。";
export const PUBLISH_EVENT_CAPACITY_NEGATIVE = "人数上限不能小于 0。";
export const PUBLISH_EVENT_JOIN_POLICY_UNKNOWN = "请选择一种报名方式。";
export const PUBLISH_EVENT_SUCCESS = "活动已发布，参与者可以在活动详情页报名。";
export const PUBLISH_EVENT_UNAVAILABLE = "活动发布暂时不可用，可以稍后再试或先发普通帖子。";

/** 发布登录门禁 */
export const PUBLISH_AUTH_GATE_TITLE = "请先登录";
export const PUBLISH_AUTH_GATE_HINT = "登录后才能发布内容。";
export const PUBLISH_AUTH_GATE_CTA = "去登录";
