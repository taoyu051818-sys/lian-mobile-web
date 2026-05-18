import { ref } from "vue";

const STORAGE_KEY = "lian.adminToken";
const tokenRef = ref<string>(readInitialToken());

function readInitialToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStorage(value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function useAdminToken() {
  function setToken(value: string) {
    const trimmed = value.trim();
    tokenRef.value = trimmed;
    writeStorage(trimmed);
  }

  function clearToken() {
    tokenRef.value = "";
    writeStorage("");
  }

  return { token: tokenRef, setToken, clearToken };
}
