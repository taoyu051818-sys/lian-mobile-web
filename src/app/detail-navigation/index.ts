// Public surface of the detail-navigation FSM. Importing this barrel ensures
// the URL-sync side effect gets installed.
import "./url-sync";

export { useDetailNavigation, getDetailStateRef } from "./store";
export type { DetailNavigation } from "./store";
export type { DetailState, DetailAction, OpenSource, CloseSource, SideEffect } from "./state";
