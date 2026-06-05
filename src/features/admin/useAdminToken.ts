import { ref } from "vue";

const STORAGE_KEY = "lian.adminToken";
const tokenRef = ref<string>(readInitialToken());
const sessionAdminRef = ref<boolean>(false);

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

export function clearAdminAccessState() {
  tokenRef.value = "";
  sessionAdminRef.value = false;
  writeStorage("");
}

export function useAdminToken() {
  function setToken(value: string) {
    const trimmed = value.trim();
    sessionAdminRef.value = false;
    tokenRef.value = trimmed;
    writeStorage(trimmed);
  }

  function clearToken() {
    tokenRef.value = "";
    writeStorage("");
  }

  function setSessionAdmin(value: boolean) {
    sessionAdminRef.value = Boolean(value);
    if (sessionAdminRef.value) clearToken();
  }

  function clearSessionAdmin() {
    sessionAdminRef.value = false;
  }

  return {
    token: tokenRef,
    sessionAdmin: sessionAdminRef,
    setToken,
    clearToken,
    setSessionAdmin,
    clearSessionAdmin,
  };
}
