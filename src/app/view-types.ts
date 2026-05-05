export type AppViewKey = "feed" | "map" | "publish" | "messages" | "profile";

export interface AppViewDefinition {
  key: AppViewKey;
  label: string;
  icon: string;
}

export const appViews: AppViewDefinition[] = [
  {
    key: "feed",
    label: "首页",
    icon: "⌂"
  },
  {
    key: "map",
    label: "探索",
    icon: "⌖"
  },
  {
    key: "publish",
    label: "发布",
    icon: "+"
  },
  {
    key: "messages",
    label: "消息",
    icon: "✉"
  },
  {
    key: "profile",
    label: "我的",
    icon: "○"
  }
];

export function getViewDefinition(key: AppViewKey) {
  return appViews.find((view) => view.key === key) || appViews[0];
}
