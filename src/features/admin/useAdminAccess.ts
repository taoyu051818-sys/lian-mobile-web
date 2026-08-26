import { ref, type Ref } from "vue";

export type AdminLane = "ops" | "gate" | "disposed";

interface UseAdminAccessOptions {
  token: Ref<string>;
  setToken(value: string): void;
  clearToken(): void;
  advanceAuthEpoch(): number;
  retireConsole(): void;
  loadReports(): Promise<unknown>;
}

export function useAdminAccess({
  token,
  setToken,
  clearToken,
  advanceAuthEpoch,
  retireConsole,
  loadReports,
}: UseAdminAccessOptions) {
  const lane = ref<AdminLane>(token.value.trim() ? "ops" : "gate");
  let initialized = false;

  async function initialize() {
    if (initialized || lane.value === "disposed") return;
    initialized = true;
    if (!token.value.trim()) {
      lane.value = "gate";
      return;
    }
    lane.value = "ops";
    await loadReports();
  }

  async function submitOpsToken(value: string) {
    if (lane.value !== "gate") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    retireConsole();
    setToken(trimmed);
    lane.value = "ops";
    await loadReports();
  }

  function resetAccess(nextLane: "gate" | "disposed") {
    if (lane.value === "disposed") return;
    retireConsole();
    advanceAuthEpoch();
    clearToken();
    lane.value = nextLane;
  }

  function exit() {
    resetAccess("gate");
  }

  function accountChanged() {
    resetAccess("gate");
  }

  function logout() {
    resetAccess("gate");
  }

  function dispose() {
    resetAccess("disposed");
  }

  return {
    lane,
    initialize,
    submitOpsToken,
    exit,
    accountChanged,
    logout,
    dispose,
  };
}
