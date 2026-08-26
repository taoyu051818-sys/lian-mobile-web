/** 商家详情块 (PRD V0.1 §10) */
export const MERCHANT_BLOCK_LABEL = "商家信息";
export const MERCHANT_CATEGORY_FOOD = "餐饮";
export const MERCHANT_CATEGORY_SERVICE = "服务";
export const MERCHANT_CATEGORY_RETAIL = "商家";
export const MERCHANT_CATEGORY_LABEL = "类目";
export const MERCHANT_HOURS_LABEL = "营业时间";
export const MERCHANT_CONTACT_LABEL = "联系方式";
export const MERCHANT_HOURS_UNSET = "营业时间未填写";
export const MERCHANT_CONTACT_UNSET = "未公开联系方式";
export const MERCHANT_VERIFIED_PREFIX = "已认证商家";
export const MERCHANT_VERIFIED_AT_PREFIX = "认证于";
export const MERCHANT_ERRAND_AVAILABLE = "支持帮我取";
export const MERCHANT_ERRAND_CTA = "帮我取";
export const MERCHANT_ERRAND_HINT = "联系附近跑腿同学帮你拿。";
export const MERCHANT_ERRAND_UNAVAILABLE_LABEL = "暂未开放帮我取";
export const MERCHANT_ERRAND_UNAVAILABLE_FALLBACK = "当前暂不能下单帮我取，可以稍后再来看看。";
export const MERCHANT_ERRAND_REASON_NOT_VERIFIED = "商家认证失效，先重新认证再开放帮我取。";
export const MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE = "附近暂无跑腿同学接单，可稍后再试。";
export const MERCHANT_ERRAND_REASON_OFF_HOURS = "已过商家公布的营业时间，下个时段再来。";
export const MERCHANT_ERRAND_REASON_MERCHANT_PAUSED = "商家暂时关闭了帮我取入口。";
/**
 * Apple-gap wave 3-A (mw#827) — `disabled-permission` reason copy.
 *
 * Surfaced when the merchant supports errand-help and the entry is open,
 * but the *viewer* hasn't cleared the role gate to actually place an
 * order. We render this without going to the server so an anonymous /
 * unverified user gets a stable explanation of why the CTA is muted
 * before they tap. The TITLE variant is the native tooltip; the HINT
 * variant is the body copy below the button.
 */
export const MERCHANT_ERRAND_PERMISSION_BLOCKED_TITLE = "需要先完成校园认证";
export const MERCHANT_ERRAND_PERMISSION_BLOCKED_HINT = "完成校园认证后即可使用帮我取下单。";

/** 跑腿下单 (PRD V0.1 §12 / issue #647) */
export const ERRAND_ORDER_SECTION_LABEL = "帮我取下单";
export const ERRAND_ORDER_BACK = "返回";
export const ERRAND_ORDER_LOADING = "正在加载下单条件…";
export const ERRAND_ORDER_LOAD_ERROR = "加载下单条件失败，可以稍后重试。";
export const ERRAND_ORDER_RETRY = "重新加载";
export const ERRAND_ORDER_PICKUP_TITLE = "取件地点";
export const ERRAND_ORDER_PICKUP_HINT = "默认使用商家地址，可在备注里补充门店细节。";
export const ERRAND_ORDER_PICKUP_PLACEHOLDER = "如：海大食堂三楼吧台";
export const ERRAND_ORDER_DROPOFF_TITLE = "送达地点";
export const ERRAND_ORDER_DROPOFF_PLACEHOLDER = "如：明德楼一楼大厅";
export const ERRAND_ORDER_DROPOFF_HINT = "可填写宿舍门牌或楼层入口，方便跑腿同学找到你。";
export const ERRAND_ORDER_DROPOFF_PICKER_DEFERRED =
  "地图选点 V0.2 即将开放，目前先用文字描述送达地点。";
export const ERRAND_ORDER_DROPOFF_PICKER_TITLE = "常用送达地点";
export const ERRAND_ORDER_DROPOFF_PICKER_LOADING = "正在加载地点…";
export const ERRAND_ORDER_DROPOFF_PICKER_EMPTY = "暂无可选地点，可直接手动填写。";
export const ERRAND_ORDER_NOTES_TITLE = "备注（可选）";
export const ERRAND_ORDER_NOTES_PLACEHOLDER = "如：少冰半糖、不要香菜，记得拿小票。";
export const ERRAND_ORDER_MODE_TITLE = "下单方式";
export const ERRAND_ORDER_MODE_DEDICATED = "专属跑腿";
export const ERRAND_ORDER_MODE_DEDICATED_HINT = "单人专程，速度更快。";
export const ERRAND_ORDER_MODE_BATCH = "饭点拼单";
export const ERRAND_ORDER_MODE_BATCH_HINT = "饭点高峰拼单，价格更优。";
export const ERRAND_ORDER_FEE_LABEL = "预计费用";
export const ERRAND_ORDER_BALANCE_LABEL = "钱包余额";
export const ERRAND_ORDER_POINTS_SUFFIX = "积分";
export const ERRAND_ORDER_VALIDATE_PICKUP = "请填写取件地点。";
export const ERRAND_ORDER_VALIDATE_DROPOFF = "请填写送达地点。";
export const ERRAND_ORDER_VALIDATE_MERCHANT = "缺少商家信息，无法下单。";
export const ERRAND_ORDER_SUBMIT = "确认下单";
export const ERRAND_ORDER_SUBMITTING = "正在提交下单…";
export const ERRAND_ORDER_SUBMIT_FAILED = "下单失败，可以稍后再试。";
export const ERRAND_ORDER_GATE_NOT_LOGGED_IN = "需要先登录才能下单帮我取。";
export const ERRAND_ORDER_GATE_NOT_LOGGED_IN_CTA = "去登录";
export const ERRAND_ORDER_GATE_NOT_VERIFIED = "需要完成校园认证才能下单。";
export const ERRAND_ORDER_GATE_NOT_VERIFIED_CTA = "去认证中心";
export const ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE = "钱包余额不足以锁定本次费用，请先充值。";
export const ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE_CTA = "查看钱包";
export const ERRAND_ORDER_GATE_MERCHANT_PAUSED = "商家暂时关闭了帮我取入口。";
export const ERRAND_ORDER_GATE_NO_RUNNER_COVERAGE = "附近暂无跑腿同学接单，可稍后再试。";
export const ERRAND_ORDER_GATE_UNKNOWN = "暂时无法下单帮我取，可以稍后再来看看。";
export const ERRAND_ORDER_DETAIL_LABEL = "下单详情";
export const ERRAND_ORDER_DETAIL_STATUS_LABEL = "当前状态";
export const ERRAND_ORDER_DETAIL_TIMELINE = "进度";
export const ERRAND_ORDER_DETAIL_NOTES_LABEL = "备注";
export const ERRAND_ORDER_DETAIL_BACK = "返回";
export const ERRAND_ORDER_DETAIL_LOAD_ERROR = "订单详情加载失败，可以稍后再试。";
export const ERRAND_ORDER_DETAIL_REFRESH = "刷新";
export const ERRAND_ORDER_DETAIL_REFRESHING = "正在刷新…";
export const ERRAND_ORDER_DETAIL_AUTO_REFRESH_HINT = "进行中订单每 12 秒自动刷新。";
export const ERRAND_ORDER_COMPLETE_CTA = "确认收货并完成";
export const ERRAND_ORDER_COMPLETE_PENDING = "正在完成…";
export const ERRAND_ORDER_COMPLETE_FAILED = "完成订单失败，可以稍后再试。";
export const ERRAND_ORDER_STATUS_CREATED = "已下单";
export const ERRAND_ORDER_STATUS_PAID_LOCKED = "已扣款锁定";
export const ERRAND_ORDER_STATUS_ASSIGNED = "已分配跑腿";
export const ERRAND_ORDER_STATUS_AT_SHOP = "已到店";
export const ERRAND_ORDER_STATUS_PICKED_UP = "已取件";
export const ERRAND_ORDER_STATUS_DELIVERING = "配送中";
export const ERRAND_ORDER_STATUS_DELIVERED = "已送达";
export const ERRAND_ORDER_STATUS_COMPLETED = "已完成";
export const ERRAND_ORDER_STATUS_CANCELLED = "已取消";
export const ERRAND_ORDER_STATUS_REFUNDED = "已退款";
export const ERRAND_ORDER_STATUS_DISPUTED = "申诉中";
export const ERRAND_ORDER_STATUS_UNKNOWN = "状态更新中";

/** 我的跑腿订单 (profile 入口 / issue #647 follow-up) */
export const PROFILE_ERRAND_ORDERS_SECTION_LABEL = "我的跑腿订单";
export const PROFILE_ERRAND_ORDERS_RELOAD = "重新加载";
export const PROFILE_ERRAND_ORDERS_LOAD_ERROR = "跑腿订单加载失败，可以稍后再试。";
export const PROFILE_ERRAND_ORDERS_EMPTY = "还没有下过帮我取订单。";
export const PROFILE_ERRAND_ORDERS_LOADING = "加载跑腿订单中…";
export const PROFILE_ERRAND_ORDERS_OPEN = "查看进度";
export const PROFILE_ERRAND_ORDERS_PICKUP_PREFIX = "取";
export const PROFILE_ERRAND_ORDERS_DROPOFF_PREFIX = "送";

/**
 * 订单 tab (profile 入口 / issue #609 PR1).
 *
 * 把"我的跑腿订单"从 profile 底部 block 升到 ProfileTabs 一个真正的"订单" tab。
 * 与 PROFILE_ERRAND_ORDERS_* 系列复用，本节只新增 tab 标签 + 两行空状态。
 *
 * 空状态遵循 PR #746 两行 pattern：第一行短标题（HEADLINE），第二行下一步说明（HINT）。
 */
export const PROFILE_TAB_ORDERS = "订单";
export const ORDERS_LIST_EMPTY_HEADLINE = "还没有下过帮我取订单。";
export const ORDERS_LIST_EMPTY_HINT =
  "在商家详情页找到「帮我取」入口即可下单，订单进度会自动出现在这里。";

/**
 * 订单详情 timeline / 取消 / V0.2 占位 (issue #609 PR1).
 *
 * - timeline 标签：全部从 ERRAND_ORDER_STATUS_* 已有 key 派生，本节不再重复定义。
 * - 取消 CTA：仅在非终态状态展示；终态包含 delivered / completed / cancelled /
 *   refunded（与 `isTerminalErrandStatus` 保持一致）。
 * - runner-location V0.2：BE 路由是 501 NOT_IMPLEMENTED_V0_1，UI 显示静态占位面板，
 *   不发请求；与 PRD §12 deferred 列表对齐。
 */
export const ORDERS_TIMELINE_LABEL = "进度";
export const ORDERS_CANCEL_CTA = "取消订单";
export const ORDERS_CANCEL_CONFIRM = "确认取消订单？取消后将无法恢复。";
export const ORDERS_CANCEL_PENDING = "正在取消…";
export const ORDERS_CANCEL_FAILED = "取消失败，可以稍后再试。";
export const ORDERS_RUNNER_LOCATION_TITLE = "实时位置";
export const ORDERS_RUNNER_LOCATION_DEFERRED = "实时位置 V0.2 即将开放";
export const ORDERS_RUNNER_LOCATION_DEFERRED_HINT =
  "等跑腿同学接单后，会在这里显示位置和送达进度。当前版本暂未开放实时位置。";

/** 跑腿订单分享招募 (mw#892) */
export const ORDERS_SHARE_RECRUIT_CTA = "招募跑腿";
export const ORDERS_SHARE_RECRUIT_HINT = "分享订单卡片，邀请同学帮你跑腿。";

/** 商家中心 (issue #646) */
export const MERCHANT_CENTER_SECTION_LABEL = "商家中心";
export const MERCHANT_CENTER_ENTER_LABEL = "商家中心";
export const MERCHANT_CENTER_BACK_TO_PROFILE = "返回我的";
export const MERCHANT_CENTER_GATE_TITLE = "需要商家认证";
export const MERCHANT_CENTER_GATE_HINT =
  "完成「认证中心 → 商家认证」后，即可进入商家中心查看你的商家内容与跑腿状态。";
export const MERCHANT_CENTER_GATE_CTA = "去认证中心";
export const MERCHANT_CENTER_GATE_BLOCK = "尚未通过商家认证。";
export const MERCHANT_CENTER_POSTS_TITLE = "我的商家内容";
export const MERCHANT_CENTER_HOURS_LABEL = "营业时间";
export const MERCHANT_CENTER_ERRAND_AVAILABLE = "支持帮我取";
export const MERCHANT_CENTER_ERRAND_UNAVAILABLE = "暂不支持帮我取";
export const MERCHANT_CENTER_OPEN_DETAIL = "查看详情";
export const MERCHANT_CENTER_EMPTY_HEADLINE = "您暂未发布商家内容";
export const MERCHANT_CENTER_EMPTY_HINT =
  "在发布页选择「商家帖」即可发布商品或菜单，发布后会出现在这里。";
export const MERCHANT_CENTER_LOAD_ERROR = "商家中心加载失败，可以稍后再试。";
export const MERCHANT_CENTER_RELOAD = "重新加载";
export const MERCHANT_CENTER_LOADING = "加载商家中心…";

/** 商家发布 (PRD V0.1 §10) */
export const PUBLISH_TYPE_REGULAR = "普通帖";
export const PUBLISH_TYPE_MERCHANT = "商家帖";
// PR-3 (#813 follow-up): "活动" promoted to a peer of regular/merchant/trade
// in the single publishKind switch — was previously hidden inside
// PublishEventControls as a stacked second-decision card.
export const PUBLISH_TYPE_EVENT = "活动帖";
export const PUBLISH_TYPE_LABEL = "帖子类型";
export const PUBLISH_MERCHANT_GATE_TITLE = "需要商家认证";
export const PUBLISH_MERCHANT_GATE_HINT = "完成「认证中心 → 商家认证」后，可以发布商家帖。";
export const PUBLISH_MERCHANT_GATE_CTA = "去认证中心";
export const PUBLISH_MERCHANT_FORM_LABEL = "商家信息";
export const PUBLISH_MERCHANT_NAME_LABEL = "商家名称";
export const PUBLISH_MERCHANT_NAME_PLACEHOLDER = "如：海大食堂西餐窗口";
export const PUBLISH_MERCHANT_CATEGORY_LABEL = "经营类目";
export const PUBLISH_MERCHANT_HOURS_LABEL = "营业时间";
export const PUBLISH_MERCHANT_HOURS_PLACEHOLDER = "如：09:00-21:00";
export const PUBLISH_MERCHANT_CONTACT_LABEL = "联系方式";
export const PUBLISH_MERCHANT_CONTACT_PLACEHOLDER = "如：138****0001（可留空）";
export const PUBLISH_MERCHANT_ERRAND_LABEL = "支持帮我取";
export const PUBLISH_MERCHANT_ERRAND_HINT = "勾选后会在详情页展示「帮我取」入口。";
export const PUBLISH_MERCHANT_NAME_REQUIRED = "请填写商家名称。";
export const PUBLISH_MERCHANT_GATE_BLOCK = "未通过商家认证，暂不能发布商家帖。";
