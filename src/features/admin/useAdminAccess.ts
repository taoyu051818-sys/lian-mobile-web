import { ref, type Ref } from "vue";
import type { AdminLaMerchantEnvelope } from "../../api/adminLaPlatform";

export type AdminLane =
  | "probing"
  | "session-merchants"
  | "ops"
  | "gate"
  | "probe-error"
  | "disposed";

interface SafeProbeError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;
}

interface UseAdminAccessOptions {
  token: Ref<string>;
  authEpoch: Ref<number>;
  setToken(value: string): void;
  clearToken(): void;
  advanceAuthEpoch(): number;
  probeMerchants(signal: AbortSignal): Promise<AdminLaMerchantEnvelope>;
  adoptMerchants(value: AdminLaMerchantEnvelope): void;
  retireMerchants(): void;
  clearMerchants(): void;
  loadReports(): Promise<unknown>;
}

function isSafeProbeError(value: unknown): value is SafeProbeError {
  return (
    value instanceof Error &&
    typeof Reflect.get(value, "status") === "number" &&
    typeof Reflect.get(value, "code") === "string"
  );
}

function fallbackProbeError(): SafeProbeError {
  return Object.assign(new Error("The merchants directory is temporarily unavailable."), {
    status: 0,
    code: "NETWORK_FAILURE",
    retryAfterSeconds: null,
  });
}

export function useAdminAccess({
  token,
  authEpoch,
  setToken,
  clearToken,
  advanceAuthEpoch,
  probeMerchants,
  adoptMerchants,
  retireMerchants,
  clearMerchants,
  loadReports,
}: UseAdminAccessOptions) {
  const lane = ref<AdminLane>("probing");
  const reason = ref("");
  const probeError = ref<SafeProbeError | null>(null);
  const retryBlocked = ref(false);

  let probeSequence = 0;
  let activeProbe: AbortController | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  let initialized = false;

  function clearCooldown() {
    if (cooldownTimer !== null) clearTimeout(cooldownTimer);
    cooldownTimer = null;
    retryBlocked.value = false;
  }

  function retireProbe() {
    probeSequence += 1;
    activeProbe?.abort();
    activeProbe = null;
    clearCooldown();
  }

  function owns(sequence: number, epoch: number, controller: AbortController) {
    return (
      lane.value === "probing" &&
      probeSequence === sequence &&
      activeProbe === controller &&
      !controller.signal.aborted &&
      authEpoch.value === epoch
    );
  }

  function ownsSlot(sequence: number, controller: AbortController) {
    return probeSequence === sequence && activeProbe === controller;
  }

  function beginCooldown(seconds: unknown, sequence: number, epoch: number) {
    if (!Number.isInteger(seconds) || (seconds as number) < 1 || (seconds as number) > 60) return;
    retryBlocked.value = true;
    cooldownTimer = setTimeout(
      () => {
        if (
          lane.value !== "probe-error" ||
          probeSequence !== sequence ||
          authEpoch.value !== epoch
        ) {
          return;
        }
        cooldownTimer = null;
        retryBlocked.value = false;
      },
      (seconds as number) * 1_000,
    );
  }

  async function runProbe() {
    if (lane.value === "disposed") return;
    clearCooldown();
    activeProbe?.abort();
    const controller = new AbortController();
    activeProbe = controller;
    const sequence = ++probeSequence;
    const epoch = authEpoch.value;
    lane.value = "probing";
    reason.value = "";
    probeError.value = null;

    try {
      const value = await probeMerchants(controller.signal);
      if (!owns(sequence, epoch, controller)) return;
      adoptMerchants(value);
      lane.value = "session-merchants";
    } catch (caught) {
      if (!owns(sequence, epoch, controller)) return;
      if (token.value.trim()) {
        retireProbe();
        retireMerchants();
        probeError.value = null;
        reason.value = "";
        lane.value = "ops";
        await loadReports();
        return;
      }
      const safe = isSafeProbeError(caught) ? caught : fallbackProbeError();
      probeError.value = safe;
      reason.value = safe.code;
      lane.value = safe.status === 401 || safe.status === 403 ? "gate" : "probe-error";
      if (safe.status === 429) {
        beginCooldown(safe.retryAfterSeconds, sequence, epoch);
      }
    } finally {
      if (ownsSlot(sequence, controller)) activeProbe = null;
    }
  }

  async function initialize() {
    if (initialized || lane.value === "disposed") return;
    initialized = true;
    await runProbe();
  }

  async function retryProbe() {
    if (lane.value !== "probe-error" || retryBlocked.value) return;
    await runProbe();
  }

  async function submitOpsToken(value: string) {
    if (lane.value !== "gate" && lane.value !== "probe-error") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    retireProbe();
    retireMerchants();
    clearMerchants();
    setToken(trimmed);
    probeError.value = null;
    reason.value = "";
    lane.value = "ops";
    await loadReports();
  }

  function loseSessionAuthorization(status: 401 | 403) {
    if (lane.value !== "session-merchants") return;
    retireProbe();
    retireMerchants();
    advanceAuthEpoch();
    clearToken();
    clearMerchants();
    probeError.value = null;
    retryBlocked.value = false;
    reason.value = status === 401 ? "AUTH_REQUIRED" : "CAPABILITY_REQUIRED";
    lane.value = "gate";
  }

  function resetAccess(nextLane: "gate" | "disposed") {
    if (lane.value === "disposed") return;
    retireProbe();
    retireMerchants();
    advanceAuthEpoch();
    clearToken();
    clearMerchants();
    probeError.value = null;
    retryBlocked.value = false;
    reason.value = "";
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
    reason,
    probeError,
    retryBlocked,
    initialize,
    retryProbe,
    submitOpsToken,
    loseSessionAuthorization,
    exit,
    accountChanged,
    logout,
    dispose,
  };
}
