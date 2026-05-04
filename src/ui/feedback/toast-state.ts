import { reactive } from "vue";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
  createdAt: number;
}

interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

const DEFAULT_DURATION = 3600;
let nextToastId = 1;

const toastState = reactive<{ items: ToastMessage[] }>({
  items: []
});

function removeToast(id: number) {
  const index = toastState.items.findIndex((item) => item.id === id);
  if (index >= 0) toastState.items.splice(index, 1);
}

function pushToast(message: string, options: ToastOptions = {}) {
  const text = String(message || "").trim();
  if (!text) return 0;
  const id = nextToastId;
  nextToastId += 1;
  const toast: ToastMessage = {
    id,
    message: text,
    tone: options.tone || "info",
    duration: Number.isFinite(options.duration) ? Number(options.duration) : DEFAULT_DURATION,
    createdAt: Date.now()
  };
  toastState.items.push(toast);
  if (toast.duration > 0) {
    window.setTimeout(() => removeToast(id), toast.duration);
  }
  return id;
}

export { pushToast, removeToast, toastState };
