export type AppViewKey = "feed" | "map" | "messages" | "profile";

export interface AppViewDefinition {
  key: AppViewKey;
  label: string;
  title: string;
  subtitle: string;
  icon: string;
}

export const appViews: AppViewDefinition[] = [
  {
    key: "feed",
    label: "首页",
    title: "首页",
    subtitle: "校园信息流，负责分发当前最值得看的内容",
    icon: "⌂"
  },
  {
    key: "map",
    label: "探索",
    title: "探索",
    subtitle: "地点组织沉淀，地图负责定位",
    icon: "⌖"
  },
  {
    key: "messages",
    label: "消息",
    title: "消息",
    subtitle: "频道、通知和后续私信都收在这里",
    icon: "✉"
  },
  {
    key: "profile",
    label: "我的",
    title: "我的",
    subtitle: "身份、贡献和发布记录的入口",
    icon: "○"
  }
];

export function getViewDefinition(key: AppViewKey) {
  return appViews.find((view) => view.key === key) || appViews[0];
}
