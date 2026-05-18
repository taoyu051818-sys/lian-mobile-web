import type { LianIconName } from "../ui/icons/paths";

export type AppViewKey =
  | "feed"
  | "map"
  | "publish"
  | "messages"
  | "profile"
  | "admin"
  | "verification";

export type ShellLayoutMode = "content" | "full-bleed" | "composer-safe";

export interface AppViewDefinition {
  key: AppViewKey;
  label: string;
  icon: LianIconName;
}

export const shellLayoutModes: Record<AppViewKey, ShellLayoutMode> = {
  feed: "content",
  map: "full-bleed",
  publish: "content",
  messages: "composer-safe",
  profile: "content",
  admin: "content",
  verification: "content",
};

export function getShellLayoutMode(key: AppViewKey): ShellLayoutMode {
  return shellLayoutModes[key] ?? "content";
}

export const appViews: AppViewDefinition[] = [
  {
    key: "feed",
    label: "首页",
    icon: "home",
  },
  {
    key: "map",
    label: "探索",
    icon: "map-pin",
  },
  {
    key: "publish",
    label: "发布",
    icon: "plus-circle",
  },
  {
    key: "messages",
    label: "消息",
    icon: "message-circle",
  },
  {
    key: "profile",
    label: "我的",
    icon: "user-circle",
  },
];

export function getViewDefinition(key: AppViewKey) {
  return appViews.find((view) => view.key === key) || appViews[0];
}
