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
export const AUTH_INTEREST_ERROR =
  "兴趣选项暂时加载失败，也可以先完成注册，之后再调整首页推荐偏好。";
export const AUTH_INTEREST_PICK_HINT = "选择至少 1 个兴趣，用于初始化首页推荐；之后仍可以再调整。";
export const AUTH_INTEREST_SKIP_DEFAULT = "兴趣会帮助初始化首页推荐，可先跳过，之后再调整。";
export const AUTH_LOGGED_IN_REFRESH = "已登录，正在刷新个人资料。";
export const AUTH_EMAIL_REQUIRED = "请先填写高校邮箱。";
export const AUTH_CODE_SENT = "验证码已发送，请查看邮箱。";

/** 认证面板补充 UI */
export const AUTH_ACCOUNT_CHIP = "账号";
export const AUTH_MODE_LABEL = "认证模式";
export const AUTH_CODE_SUFFIX = "位验证码";

/** 验证码提示 */
export const AUTH_CODE_RESEND_HINT = "{n} 秒后可重新发送。";
export const AUTH_CODE_COOLDOWN_HINT = "验证码发送后会进入冷却，请在 {n} 秒后重试。";
export const AUTH_CODE_RATE_LIMIT = "发送太频繁，请在 {n} 秒后再试。";
export const AUTH_CODE_RATE_LIMIT_DEFAULT = "发送太频繁，请稍后再试。页面会先按 {n} 秒冷却处理。";
export const AUTH_CODE_SENT_INST = "验证码已发送，识别为 {n}。";
export const AUTH_CODE_RATE_LIMIT_RESEND = "当前发送过于频繁，请在 {n} 秒后重新获取验证码。";
export const AUTH_CODE_RATE_LIMIT_FALLBACK =
  "如果服务端没有返回具体等待时间，页面会先按 {n} 秒冷却处理。";

/** Auth-link redeem flow (RFC §2.3 mw#B) */
export const AUTH_LINK_SHEET_LABEL = "邀请链接";
export const AUTH_LINK_SHEET_TITLE = "你收到了一个邀请";
export const AUTH_LINK_LOADING = "正在加载邀请信息…";
export const AUTH_LINK_THUMBNAIL_ALT = "邀请缩略图";
export const AUTH_LINK_REDEEM = "领取";
export const AUTH_LINK_REDEEMING = "领取中…";
export const AUTH_LINK_CANCEL = "取消";
export const AUTH_LINK_RETRY = "重试";
export const AUTH_LINK_ERROR_NOT_FOUND = "这个邀请链接不存在或已失效。";
export const AUTH_LINK_ERROR_EXPIRED = "这个邀请链接已过期。";
export const AUTH_LINK_ERROR_EXHAUSTED = "这个邀请链接已被使用完毕。";
export const AUTH_LINK_ERROR_NETWORK = "邀请信息暂时取不到，可以稍后再试。";
export const AUTH_LINK_REDEEM_SUCCESS = "领取成功，正在刷新…";
