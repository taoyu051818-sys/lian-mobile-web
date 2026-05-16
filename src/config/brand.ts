/** 黎安屿你 — 品牌文案标准 */

export const APP_NAME = "黎安屿你";

/** 默认用户称呼 */
export const DEFAULT_USER_LABEL = "同学";

/** 未登录时的显示名 */
export const GUEST_DISPLAY_NAME = "未登录同学";

/** 频道默认标签 */
export const CHANNEL_DEFAULT_TAG = "校园频道";

/** 地图 aria-label */
export const MAP_ARIA_LABEL = "校园地图";

/** 加载态文案 */
export const LOADING_PROFILE = "正在加载个人资料…";
export const LOADING_FEED = "正在加载校园内容…";
export const LOADING_MAP = "正在加载校园地图…";
export const LOADING_LIST = "正在加载列表…";
export const LOADING_DETAIL = "正在加载详情…";
export const LOADING_CHANNEL = "正在加载频道消息…";
export const LOADING_NOTIFICATION = "正在加载通知…";
export const LOADING_PLACE = "正在加载地点…";

/** 空态文案 */
export const EMPTY_HISTORY = "暂无浏览记录";
export const EMPTY_SAVED = "暂无收藏";
export const EMPTY_LIKED = "暂无点赞";
export const EMPTY_FEED = "暂时没有内容";
export const EMPTY_CHANNEL = "暂无频道消息";
export const EMPTY_NOTIFICATION = "暂无通知";
export const EMPTY_REPLIES = "暂无";

/** 错误态文案 */
export const ERROR_LOAD_GENERIC = "暂时没加载出来，可以稍后再试。";
export const ERROR_SEND_GENERIC = "没有发送成功，可以稍后再试。";
export const ERROR_LOAD_MAP = "地图数据暂时没加载出来，可以稍后再试。";
export const ERROR_LOAD_PLACE = "地点信息暂时没加载出来，可以稍后再试。";
export const ERROR_LOAD_DETAIL = "详情暂时没加载出来，可以稍后再试。";
export const ERROR_LOAD_CHANNEL = "频道消息暂时没加载出来，可以稍后再试。";
export const ERROR_LOAD_NOTIFICATION = "通知暂时没加载出来，可以稍后再试。";
export const ERROR_SEND_MESSAGE = "消息没有发送成功，可以稍后再试。";
export const ERROR_SEND_REPLY = "回复没有发送成功，可以稍后再试。";
export const ERROR_PUBLISH_IMAGE = "图片上传失败，可以换一张图片或稍后再试。";
export const ERROR_PUBLISH_LOCATION = "地图地点暂时没加载出来，可以手填地点发布。";
export const ERROR_LIKE_ACTION = "喜欢操作没有成功，可以稍后再试。";
export const ERROR_SAVE_ACTION = "收藏操作没有成功，可以稍后再试。";
export const ERROR_AUTH_GENERIC = "登录/注册没有成功，可以稍后再试。";
export const ERROR_SEND_CODE = "验证码没有发送成功，可以稍后再试。";
export const ERROR_PUBLISH_GENERIC = "发布没有成功，可以稍后再试。";
export const ERROR_LOGOUT = "退出登录没有成功，可以稍后再试。";
export const ERROR_RATE_LIMIT = "发送太频繁，请稍后再试。";

/** 参数校验 */
export const ERROR_MISSING_PLACE_ID = "缺少地点 ID";

/** 表单校验 */
export const VALIDATION_PASSWORD_MIN = "密码至少需要 {n} 位。";
export const VALIDATION_LOGIN_REQUIRED = "请填写邮箱或昵称。";
export const VALIDATION_USERNAME_REQUIRED = "请填写昵称。";
export const VALIDATION_EMAIL_OR_INVITE = "请填写高校邮箱，或填写邀请码。";
export const VALIDATION_EMAIL_CODE_REQUIRED = "高校邮箱注册需要填写验证码。";
export const VALIDATION_INTEREST_REQUIRED = "至少选择一个兴趣，用来初始化推荐流。";
export const VALIDATION_TITLE_REQUIRED = "请填写标题。";
export const VALIDATION_TITLE_MAX = "标题最多 {n} 个字。";
export const VALIDATION_BODY_REQUIRED = "请填写正文。";
export const VALIDATION_BODY_MAX = "正文最多 {n} 个字。";
export const VALIDATION_UPLOAD_IN_PROGRESS = "图片还在上传，稍等一下再发布。";
export const VALIDATION_UPLOAD_INCOMPLETE = "还有图片没有上传成功，请重新选择或移除。";

/** 内容占位 */
export const UNTITLED_CONTENT = "未命名内容";

/** 消息占位 */
export const MESSAGE_EMPTY_CONTENT = "这条消息暂时没有内容。";

/** 地点状态标签 */
export const PLACE_STATUS_CONFIRMED = "已确认";
export const PLACE_STATUS_PENDING = "待确认";
export const PLACE_STATUS_DISPUTED = "有争议";
export const PLACE_STATUS_EXPIRED = "可能过期";
export const PLACE_STATUS_AI_ORGANIZED = "AI 整理";
export const PLACE_STATUS_OFFICIAL = "官方";

/** 地点类型标签 */
export const PLACE_TYPE_CANTEEN = "食堂";
export const PLACE_TYPE_LIBRARY = "图书馆";
export const PLACE_TYPE_BUILDING = "教学楼";
export const PLACE_TYPE_DORMITORY = "宿舍";
export const PLACE_TYPE_TRANSIT = "交通站点";
export const PLACE_TYPE_SPORTS = "体育场馆";
export const PLACE_TYPE_LAB = "实验室";
export const PLACE_TYPE_OFFICE = "办公楼";
export const PLACE_TYPE_GARDEN = "校园绿地";
export const PLACE_TYPE_SHOP = "商店";

/** 地点 fallback */
export const PLACE_FALLBACK_LABEL = "地点";
export const PLACE_TYPE_FALLBACK = "校园地点";

/** 举报分类 */
export const REPORT_CAT_PRIVACY = "隐私问题";
export const REPORT_CAT_FALSE_INFO = "虚假信息";
export const REPORT_CAT_ABUSE = "违规内容";
export const REPORT_CAT_WRONG_LOCATION = "位置错误";
export const REPORT_CAT_EXPIRED = "过期内容";
export const REPORT_CAT_OTHER = "其他";

/** 举报说明占位 */
export const REPORT_PLACEHOLDER_PRIVACY = "可以补充说明泄露了哪些隐私信息，帮助平台更快处理。";
export const REPORT_PLACEHOLDER_ABUSE = "可以补充说明骚扰、攻击或违规的具体情况。";
export const REPORT_PLACEHOLDER_OTHER = "可以补充说明你想反馈的问题。";

/** 举报结果 */
export const REPORT_DUPLICATE = "这条内容已经提交过举报了，我们会继续跟进。";
export const REPORT_RATE_LIMIT = "提交太频繁了，请稍后再试。";
export const REPORT_AUTH_REQUIRED = "需要先登录后才能举报这条内容。";
export const REPORT_GENERIC = "举报没有提交成功，可以稍后再试。";

/** 频道消息 UI */
export const CHANNEL_RELOAD = "重新加载";
export const CHANNEL_LOAD_MORE = "加载更早消息";
export const CHANNEL_SENDING = "发送中…";
export const CHANNEL_SEND_FAILED = "发送失败";
export const CHANNEL_RETRY = "重试";
export const CHANNEL_READ_COUNT = "次已读";

/** 信息流视图 UI */
export const FEED_VIEW_TITLE = "首页";
export const FEED_FILTER_LABEL = "信息分类";
export const FEED_EMPTY_HINT = "可以换个分类，或稍后再来看看。";

/** 地图筛选 */
export const MAP_FILTER_LOCATIONS = "地点";
export const MAP_FILTER_POSTS = "内容";
export const MAP_CONTENT_FALLBACK = "地图内容";

/** Shell chrome aria */
export const SHELL_TOP_REGION = "顶部操作区";
export const SHELL_BOTTOM_REGION = "底部操作区";
export const SHELL_TAB_SWITCH = "标签切换";
export const SHELL_CURRENT_IDENTITY = "当前身份";
export const SHELL_FILTER = "筛选";
export const SHELL_MAIN_CONTENT = "主内容";

/** 消息 tab */
export const MESSAGE_TAB_LABEL = "消息分类";

/** 信息流卡片 UI */
export const FEED_PLACE_CAMPUS = "校园";
export const FEED_TIME_JUST_NOW = "刚刚";
export const FEED_LIKE = "喜欢";
export const FEED_UNLIKE = "取消喜欢";
export const FEED_COLLAPSE = "收起";
export const FEED_EXPAND = "展开";

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

/** 回复 dock UI */
export const REPLY_DOCK_PLACEHOLDER = "写回复";
export const REPLY_DOCK_SEND = "发送";
export const REPLY_DOCK_REPLY = "回复";

/** 个人资料头部 */
export const PROFILE_CAMPUS_USER = "校园用户";
export const PROFILE_INVITE_USER = "邀请码用户";
export const PROFILE_IDENTITY_TAGS = "身份标签";
export const PROFILE_ALIAS_DESC = "马甲身份说明";
export const PROFILE_REAL_IDENTITY = "真实身份";
export const PROFILE_ALIAS_COUNT_SUFFIX = "个身份";
export const PROFILE_SELECT_IDENTITY = "选择发布身份";
export const PROFILE_OFFICIAL_ALIAS = "官方马甲";

/** 频道 composer UI */
export const COMPOSER_IDENTITY_SIGNAL = "身份信号";
export const COMPOSER_NO_IDENTITY_SIGNAL = "不使用身份信号";
export const COMPOSER_SAY_SOMETHING = "说点什么";
export const COMPOSER_SEND = "发送";

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

/** 个人资料 UI */
export const PROFILE_COLLAPSE_EDITOR = "收起编辑";
export const PROFILE_EDIT = "编辑资料";
export const PROFILE_LOGOUT = "退出登录";

/** 帖子详情 topbar */
export const POST_DETAIL_CLOSE = "关闭详情";
export const POST_DETAIL_AUTHOR_AVATAR = "作者头像";
export const POST_DETAIL_SHARE = "分享";

/** 认证面板 UI */
export const AUTH_PANEL_TITLE = "登录 / 注册";
export const AUTH_TAB_LOGIN = "登录";
export const AUTH_TAB_REGISTER = "注册";
export const AUTH_EMAIL_OR_NICKNAME = "邮箱或昵称";
export const AUTH_EMAIL_OR_NICKNAME_HINT = "支持邮箱或昵称登录。";
export const AUTH_NICKNAME = "昵称";
export const AUTH_NICKNAME_PLACEHOLDER = "怎么称呼你";
export const AUTH_NICKNAME_HINT = "这个昵称会用于你的初始身份展示。";
export const AUTH_EMAIL_LABEL = "高校邮箱";
export const AUTH_EMAIL_PLACEHOLDER = "邀请码注册可不填";
export const AUTH_EMAIL_HINT_FULL = "高校邮箱注册需要先获取 {n} 位验证码；邀请码注册时可以留空。";
export const AUTH_EMAIL_CODE_LABEL = "邮箱验证码";
export const AUTH_INTEREST_SECTION = "兴趣偏好";
export const AUTH_INTEREST_RELOAD = "重新加载兴趣选项";
export const AUTH_INTEREST_SKIP = "暂时跳过";
export const AUTH_PASSWORD_LABEL = "密码";
export const AUTH_PASSWORD_PLACEHOLDER = "至少 {n} 位";
export const AUTH_PASSWORD_HINT = "至少 {n} 位，支持密码管理器自动填充。";
export const AUTH_INVITE_CODE = "邀请码";
export const AUTH_INVITE_CODE_PLACEHOLDER = "非高校邮箱时填写";
export const AUTH_INVITE_CODE_HINT = "没有高校邮箱时，可以改用邀请码注册。";
export const AUTH_PROCESSING = "处理中…";

/** 认证 UI */
export const AUTH_SENDING = "发送中";
export const AUTH_RESEND = "重发";
export const AUTH_SEND = "发送";
export const AUTH_LOGIN = "登录";
export const AUTH_REGISTER_AND_LOGIN = "注册并登录";
export const AUTH_EMAIL_HINT = "验证码会发送到你的高校邮箱。邀请码注册时可以留空。";
export const AUTH_LOGIN_PLACEHOLDER = "使用邮箱或昵称登录。";
export const AUTH_INTEREST_SKIP_HINT = "兴趣会帮助初始化首页推荐，可先跳过，之后再调整推荐偏好。";
export const AUTH_INTEREST_LOADING = "正在加载首页推荐偏好选项。";
export const AUTH_INTEREST_EMPTY = "当前没有可选兴趣，也可以先完成注册，之后再调整首页推荐偏好。";
export const AUTH_INTEREST_ERROR = "兴趣选项暂时加载失败，也可以先完成注册，之后再调整首页推荐偏好。";
export const AUTH_INTEREST_PICK_HINT = "选择至少 1 个兴趣，用于初始化首页推荐；之后仍可以再调整。";
export const AUTH_INTEREST_SKIP_DEFAULT = "兴趣会帮助初始化首页推荐，可先跳过，之后再调整。";
export const AUTH_LOGGED_IN_REFRESH = "已登录，正在刷新个人资料。";
export const AUTH_EMAIL_REQUIRED = "请先填写高校邮箱。";
export const AUTH_CODE_SENT = "验证码已发送，请查看邮箱。";

/** 信息流 UI */
export const FEED_LOAD_MORE = "加载更多";
export const FEED_SEEN_ALL = "已经看到这里啦";

/** 通知 UI */
export const NOTIFICATION_SECTION_LABEL = "通知";
export const NOTIFICATION_READ = "已读";
export const NOTIFICATION_UNREAD = "未读";
export const NOTIFICATION_DEFAULT_TITLE = "新通知";

/** 回复 UI */
export const REPLY_SECTION_TITLE = "回复";
export const REPLY_COUNT_LABEL = "条";
export const REPLY_EMPTY_PROMPT = "还没有回复，来写第一条。";

/** 地点详情 UI */
export const PLACE_SHEET_LABEL = "地点详情";
export const CLOSE_BUTTON_LABEL = "关闭";

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

/** 认证面板补充 UI */
export const AUTH_ACCOUNT_CHIP = "账号";
export const AUTH_MODE_LABEL = "认证模式";
export const AUTH_CODE_SUFFIX = "位验证码";

/** 个人资料视图 UI */
export const PROFILE_SECTION_LABEL = "我的";
export const PROFILE_TAB_HISTORY = "浏览";
export const PROFILE_TAB_SAVED = "收藏";
export const PROFILE_TAB_LIKED = "赞过";
export const PROFILE_IDENTITY_FALLBACK = "校园身份";
export const PROFILE_ALIAS_TYPE = "类型";
export const PROFILE_ALIAS_SIGNAL = "信号";
export const PROFILE_ALIAS_PERSONA = "人格";
export const PROFILE_ALIAS_DESCRIPTION = "说明";
export const PROFILE_REAL_IDENTITY_HINT = "当前使用真实身份。";
export const PROFILE_ALIAS_DEFAULT_HINT = "这个马甲会作为你在 LIAN 中出现的默认身份。";
export const PROFILE_ALIAS_MORE_HINT = "这个马甲会作为你在 LIAN 中出现的默认身份，更多身份说明会在后续补齐。";
export const PROFILE_EMPTY_CONTENT = "暂无内容";
export const PROFILE_LOAD_ERROR_PREFIX = "个人资料";
export const PROFILE_LIST_ERROR_PREFIX = "列表";
export const PROFILE_TABS_LABEL = "个人内容分类";
export const PROFILE_RELOAD = "重新加载";

/** 帖子详情对话框 */
export const POST_DETAIL_DIALOG_LABEL = "帖子详情";

/** 消息视图 UI */
export const MESSAGE_SECTION_LABEL = "消息";
export const MESSAGE_TAB_CHANNEL = "频道";
export const MESSAGE_TAB_NOTIFICATION = "通知";
export const MESSAGE_IDENTITY_SIGNAL_PREFIX = "身份信号：";
export const MESSAGE_NO_IDENTITY_SIGNAL = "未选择身份信号";

/** 频道线程 UI */
export const CHANNEL_THREAD_LABEL = "校园频道";

/** 通知补充 UI */
export const NOTIFICATION_REPLY_LABEL = "回复";
export const NOTIFICATION_ACTOR_LABEL = "通知";

/** 内容封面 */
export const CONTENT_COVER_ALT = "内容封面";
export const CONTENT_AVATAR_FALLBACK = "内";
export const TIME_UNKNOWN = "时间未知";

/** 地图图标 */
export const MAP_POST_AVATAR_FALLBACK = "帖";

/** 用户头像 fallback */
export const USER_AVATAR_FALLBACK = "同";

/** 详情弹层 UI */
export const DETAIL_SHEET_LABEL = "详情弹层";
export const DETAIL_SHEET_TITLE = "详情";

/** 页面框架 UI */
export const CONTENT_FRAME_LABEL = "页面内容";

/** 分享错误 */
export const SHARE_ERROR_NO_URL = "无法生成分享链接。";
export const SHARE_ERROR_SHARE_FAILED = "分享没有完成，可以稍后再试。";
export const SHARE_ERROR_NO_CLIPBOARD = "当前浏览器不支持复制链接。";
export const SHARE_ERROR_COPY_FAILED = "复制链接失败，可以稍后再试。";

/** 验证码提示 */
export const AUTH_CODE_RESEND_HINT = "{n} 秒后可重新发送。";
export const AUTH_CODE_COOLDOWN_HINT = "验证码发送后会进入冷却，请在 {n} 秒后重试。";
export const AUTH_CODE_RATE_LIMIT = "发送太频繁，请在 {n} 秒后再试。";
export const AUTH_CODE_RATE_LIMIT_DEFAULT = "发送太频繁，请稍后再试。页面会先按 {n} 秒冷却处理。";
export const AUTH_CODE_SENT_INST = "验证码已发送，识别为 {n}。";
export const AUTH_CODE_RATE_LIMIT_RESEND = "当前发送过于频繁，请在 {n} 秒后重新获取验证码。";
export const AUTH_CODE_RATE_LIMIT_FALLBACK = "如果服务端没有返回具体等待时间，页面会先按 {n} 秒冷却处理。";
