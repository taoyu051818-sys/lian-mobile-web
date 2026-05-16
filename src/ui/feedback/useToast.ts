import type { ToastTone } from "./toast-state";
import { pushToast, removeToast, toastState } from "./toast-state";

function show(message: string, tone: ToastTone = "info", duration?: number) {
  return pushToast(message, { tone, duration });
}

function useToast() {
  return {
    items: toastState.items,
    show,
    info: (message: string, duration?: number) => show(message, "info", duration),
    success: (message: string, duration?: number) => show(message, "success", duration),
    warning: (message: string, duration?: number) => show(message, "warning", duration),
    error: (message: string, duration?: number) => show(message, "error", duration),
    remove: removeToast,
  };
}

export { useToast };
