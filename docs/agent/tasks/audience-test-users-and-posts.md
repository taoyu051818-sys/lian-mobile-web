# Audience System: Test Users & Test Posts Plan

Date: 2026-05-02

## Overview

10 个测试用户 + 15 条测试帖子，覆盖公开、校园、校内、组织、私密、仅链接等全部可见性场景。

### 关键约定

- **canonical schoolId** = 中文短名（如 `中国传媒大学`），由 `deriveSchoolId(institution)` 从 `authInstitutions.tags[0]` 派生。
- **组织帖** 使用 `visibility: "private"` + `orgIds` 数组表达，Phase 1-3 不新增 `organization` visibility 枚举。
- **linkOnly** = 分发限制：不进 feed/map/search；详情页按 base visibility 判断访问权限。

---

## 测试用户

| ID | 昵称 | 用户名 | 邮箱 | 学校 | schoolId | 组织 orgIds | 角色 | 用途 |
|---|---|---|---|---|---|---|---|---|
| U1 | 林小雨 | test_linxiaoyu | linxy@cuc.edu.cn | 中传 | 中国传媒大学 | [council, photo-club] | user | 学生会+摄影社成员 |
| U2 | 王浩然 | test_wanghaoran | wanghr@bupt.edu.cn | 北邮 | 北京邮电大学 | [council] | user | 学生会成员 |
| U3 | 陈思琪 | test_chensiqi | chensq@cuc.edu.cn | 中传 | 中国传媒大学 | [photo-club] | user | 仅摄影社成员 |
| U4 | 赵天宇 | test_zhaotianyu | zhaoty@bupt.edu.cn | 北邮 | 北京邮电大学 | [basketball-club] | user | 仅篮球社成员 |
| U5 | 刘佳怡 | test_liujiayi | liujy@bsu.edu.cn | 体大 | 北京体育大学 | [] | user | 无组织学生 |
| U6 | 杨老师 | test_teacher_yang | yang@cuc.edu.cn | 中传 | 中国传媒大学 | [] | admin | 管理员 |
| U7 | 张三 | test_zhangsan | zhangsan@gmail.com | — | — | [] | user | 外部访客 |
| U8 | 李文静 | test_liwenjing | liwj@cuc.edu.cn | 中传 | 中国传媒大学 | [photo-club] | user | 摄影社社长 |
| U9 | 周子轩 | test_zhouzixuan | zhouzx@bupt.edu.cn | 北邮 | 北京邮电大学 | [basketball-club] | user | 篮球社社长 |
| U10 | 黄雨萱 | test_huangyuxuan | huangyx@muc.edu.cn | 民大 | 中央民族大学 | [council] | user | 学生会成员(民大) |

### 组织定义

| orgId | 名称 | 成员 |
|---|---|---|
| council | 试验区学生会 | U1(中传), U2(北邮), U10(民大) |
| photo-club | 光影摄影社 | U1(中传), U3(中传), U8(中传·社长) |
| basketball-club | 飞鹰篮球社 | U4(北邮), U9(北邮·社长) |

### 用户密码

所有测试用户统一密码：`Test@2026`

---

## 测试帖子

### 公开与校园

| tid | 标题 | 作者 | visibility | audience | 内容 |
|---|---|---|---|---|---|
| T01 | 五一假期图书馆开放时间调整 | U6(杨老师) | public | public | 各位同学好，五一假期期间图书馆开放时间调整为 9:00-17:00，5月5日起恢复正常。自习室座位预约系统照常运行，请提前预约。 |
| T02 | 试验区首届草地音乐节来啦！ | U1(林小雨) | campus | campus | 5月10日晚7点，生活一区大草坪！有乐队演出、街舞battle、美食摊位，凭学生证入场。转发集赞20个可领荧光手环～ |
| T03 | 食堂二楼新窗口测评 | U5(刘佳怡) | campus | campus | 试了二食堂新开的螺蛳粉窗口，味道还不错！加了酸笋和腐竹，一碗12块，分量很足。推荐指数四颗星，唯一的缺点是排队太长了。 |

### 校内帖子

| tid | 标题 | 作者 | visibility | audience | 内容 |
|---|---|---|---|---|---|
| T04 | 中传选课系统即将开放 | U3(陈思琪) | school | schoolIds:[中国传媒大学] | 提醒中传的同学们，下学期选课系统5月8日早上9点开放，热门课拼手速！建议提前看好课表，准备好备选方案。 |
| T05 | 北邮实验室招助研 | U4(赵天宇) | school | schoolIds:[北京邮电大学] | 张教授课题组招两名助研，方向是5G边缘计算。要求有Python基础，每周至少10小时。有兴趣的同学私信我发简历。 |
| T06 | 民大期末考试安排 | U10(黄雨萱) | school | schoolIds:[中央民族大学] | 民大的同学们注意啦，期末考试安排已出，请登录教务系统查看。考试周从6月16日开始，大家提前复习哦。 |

### 组织帖子（visibility: private + orgIds）

| tid | 标题 | 作者 | visibility | audience | 内容 |
|---|---|---|---|---|---|
| T07 | 学生会全体大会通知 | U2(王浩然) | private | orgIds:[council] | 本周六下午3点，学生会堂201开全体大会。议程：①五一活动总结 ②毕业季活动策划 ③新学期预算讨论。请各部部长准时出席。 |
| T08 | 摄影社外拍活动报名 | U8(李文静) | private | orgIds:[photo-club] | 本周日早上8点，清水湾外拍活动！主题是「海与建筑」。自带器材，社里提供三脚架和反光板。名额15人，先到先得，群里接龙报名。 |
| T09 | 篮球社友谊赛对手征集 | U9(周子轩) | private | orgIds:[basketball-club] | 下周三晚上想打一场友谊赛，3v3或5v5都行。有没有队伍愿意切磋一下？场地已经订好了综合体育馆二楼。 |
| T10 | 学生会财务公示 | U1(林小雨) | private | orgIds:[council] | 四月份财务公示：活动经费支出￥3,200（草地音乐节筹备），办公用品￥180，交通费￥95。明细表已上传共享文档，请各部门负责人核对。 |

### 私密与仅链接

| tid | 标题 | 作者 | visibility | audience | 内容 |
|---|---|---|---|---|---|
| T11 | 给小雨的生日惊喜 | U3(陈思琪) | private | userIds:[U1] | 小雨生日快乐！我们几个偷偷准备了一个惊喜派对，周五晚上7点在食堂三楼包间。记得装作不知道哦～ |
| T12 | 校园卡充值链接 | U6(杨老师) | public | linkOnly:true | 校园卡线上充值链接：http://card.lian.edu.cn/recharge（仅供校内使用，请勿外传） |
| T13 | 转让一台iPad | U7(张三) | public | linkOnly:true | 出一台iPad Air 5，256G，国行，保修到明年3月。带Apple Pencil二代和键盘。价格私聊，校区面交。 |

### 向后兼容

| tid | 标题 | 作者 | visibility | audience | 内容 |
|---|---|---|---|---|---|
| T14 | 旧版帖子-无audience字段 | U1(林小雨) | public | (无) | 这是一条模拟旧版帖子，没有audience字段，应默认向所有人可见。 |
| T15 | 旧版帖子-仅有visibility | U3(陈思琪) | campus | (无，仅visibility) | 这是另一条旧版帖子，只有flat visibility字段，没有audience对象。应默认为campus可见。 |

---

## 测试矩阵

### Feed 测试

| # | 请求者 | 预期可见帖子 | 预期不可见帖子 |
|---|---|---|---|
| F1 | 匿名 | T01, T14 | T02-T13, T15 |
| F2 | U1 林小雨(中传+学生会+摄影社) | T01-T04, T07, T08, T10, T11, T14, T15 | T05, T06, T09, T12, T13 |
| F3 | U2 王浩然(北邮+学生会) | T01-T03, T05, T07, T10, T14, T15 | T04, T06, T08, T09, T11-T13 |
| F4 | U3 陈思琪(中传+摄影社) | T01-T04, T08, T14, T15 | T05-T07, T09-T13 |
| F5 | U4 赵天宇(北邮+篮球社) | T01-T03, T05, T09, T14, T15 | T04, T06-T08, T10-T13 |
| F6 | U5 刘佳怡(体大,无组织) | T01-T03, T14, T15 | T04-T13 |
| F7 | U6 杨老师(admin) | T01-T04, T12, T14, T15 | T05-T11, T13 |
| F8 | U7 张三(外部访客) | T01, T14 | T02-T13, T15 |
| F9 | U10 黄雨萱(民大+学生会) | T01-T03, T06, T07, T10, T14, T15 | T04, T05, T08, T09, T11-T13 |

### Detail 测试

| # | 帖子 | 请求者 | 预期 |
|---|---|---|---|
| D1 | T01 公开 | 匿名 | 200 |
| D2 | T02 校园 | 匿名 | 403 |
| D3 | T02 校园 | U1 | 200 |
| D4 | T04 中传校内 | U1(中传) | 200 |
| D5 | T04 中传校内 | U2(北邮) | 403 |
| D6 | T05 北邮校内 | U4(北邮) | 200 |
| D7 | T05 北邮校内 | U1(中传) | 403 |
| D8 | T06 民大校内 | U10(民大) | 200 |
| D9 | T06 民大校内 | U1(中传) | 403 |
| D10 | T07 学生会 | U1(会员) | 200 |
| D11 | T07 学生会 | U5(非会员) | 403 |
| D12 | T08 摄影社 | U3(社员) | 200 |
| D13 | T08 摄影社 | U4(非社员) | 403 |
| D14 | T09 篮球社 | U9(社长) | 200 |
| D15 | T09 篮球社 | U1(非社员) | 403 |
| D16 | T11 私密 | U1(目标用户) | 200 |
| D17 | T11 私密 | U2(非目标) | 403 |
| D18 | T12 仅链接(公开基础) | 匿名 | 200 | linkOnly 是分发限制，详情页按 base visibility 判断；公开帖匿名可访问 |
| D19 | T12 仅链接 | U6(作者) | 200 |
| D20 | T14 旧版无audience | 匿名 | 200 |
| D21 | T15 旧版仅visibility | 匿名 | 403 |
| D22 | T15 旧版仅visibility | U1 | 200 |

### Map 测试

| # | 请求者 | 预期可见 | 预期不可见 |
|---|---|---|---|
| M1 | 匿名 | T01 | T02, T03 |
| M2 | U1 | T01-T04 | T05 |
| M3 | U4 | T01-T03, T05 | T04 |

### Reply 测试

| # | 帖子 | 请求者 | 预期 |
|---|---|---|---|
| R1 | T01 | U7 | 200 |
| R2 | T02 | 匿名 | 401 |
| R3 | T04 | U2(北邮) | 403 |
| R4 | T07 | U1(学生会) | 200 |
| R5 | T07 | U5(非学生会) | 403 |

---

## 清理与回滚

```bash
# 清理测试数据
node scripts/cleanup-audience-test.js

# 回滚到测试前状态
git checkout -- data/post-metadata.json data/auth-users.json
```
