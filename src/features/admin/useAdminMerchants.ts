import { computed, ref, type Ref } from "vue";
import {
  AdminLaPlatformError,
  type AdminLaMerchant,
  type AdminLaMerchantEnvelope,
  type AdminLaMerchantQuery,
} from "../../api/adminLaPlatform";

interface UseAdminMerchantsOptions {
  authEpoch: Ref<number>;
  isSessionLane(): boolean;
  fetchMerchants(
    query: AdminLaMerchantQuery,
    signal: AbortSignal,
  ): Promise<AdminLaMerchantEnvelope>;
  onAuthorizationLost(status: 401 | 403): void;
}

const DEFAULT_PAGE = Object.freeze({ limit: 20, offset: 0, total: 0 });
const NON_RETRY_CODES = new Set([
  "REQUEST_CONTRACT",
  "BFF_NOT_DEPLOYED",
  "PREREQUISITE_UNAVAILABLE",
]);

function copyQuery(query: AdminLaMerchantQuery): AdminLaMerchantQuery {
  return {
    limit: query.limit,
    offset: query.offset,
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

function localContractError() {
  return new AdminLaPlatformError(
    "The merchants search does not match the local contract.",
    0,
    "REQUEST_CONTRACT",
    null,
  );
}

function localFailure() {
  return new AdminLaPlatformError(
    "The merchants directory is temporarily unavailable.",
    0,
    "NETWORK_FAILURE",
    null,
  );
}

function asSafeError(error: unknown) {
  if (
    error instanceof Error &&
    typeof Reflect.get(error, "status") === "number" &&
    typeof Reflect.get(error, "code") === "string"
  ) {
    return error as AdminLaPlatformError;
  }
  return localFailure();
}

export function useAdminMerchants({
  authEpoch,
  isSessionLane,
  fetchMerchants,
  onAuthorizationLost,
}: UseAdminMerchantsOptions) {
  const rows = ref<AdminLaMerchant[]>([]);
  const page = ref<{ limit: number; offset: number; total: number }>({ ...DEFAULT_PAGE });
  const requestId = ref("");
  const loading = ref(false);
  const error = ref<AdminLaPlatformError | null>(null);
  const empty = ref(false);
  const draftQ = ref("");
  const status = ref<"all" | "active" | "inactive">("all");
  const retryBlocked = ref(false);

  let committedQ = "";
  let failedQuery: AdminLaMerchantQuery | null = null;
  let requestSequence = 0;
  let activeController: AbortController | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const canPrevious = computed(
    () => Number.isSafeInteger(page.value.offset) && page.value.offset > 0,
  );
  const canNext = computed(() => {
    const current = page.value;
    if (
      !Number.isSafeInteger(current.offset) ||
      !Number.isInteger(current.limit) ||
      !Number.isSafeInteger(current.total) ||
      current.offset < 0 ||
      current.limit < 1 ||
      current.total < 0
    ) {
      return false;
    }
    const nextOffset = current.offset + current.limit;
    return (
      current.offset + rows.value.length < current.total &&
      Number.isSafeInteger(nextOffset) &&
      nextOffset <= 1_000_000
    );
  });
  const canRetry = computed(
    () => Boolean(error.value) && !NON_RETRY_CODES.has(error.value!.code) && !retryBlocked.value,
  );

  function clearCooldown() {
    if (cooldownTimer !== null) clearTimeout(cooldownTimer);
    cooldownTimer = null;
    retryBlocked.value = false;
  }

  function retire() {
    requestSequence += 1;
    activeController?.abort();
    activeController = null;
    clearCooldown();
    loading.value = false;
  }

  function clearVisibleState() {
    rows.value = [];
    page.value = { ...DEFAULT_PAGE };
    requestId.value = "";
    loading.value = false;
    error.value = null;
    empty.value = false;
    draftQ.value = "";
    status.value = "all";
    committedQ = "";
    failedQuery = null;
  }

  function clear() {
    retire();
    clearVisibleState();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
  }

  function owns(sequence: number, epoch: number, controller: AbortController) {
    return (
      !disposed &&
      requestSequence === sequence &&
      activeController === controller &&
      !controller.signal.aborted &&
      authEpoch.value === epoch &&
      isSessionLane()
    );
  }

  function adoptEnvelope(value: AdminLaMerchantEnvelope) {
    rows.value = value.data.map((merchant) => ({ ...merchant }));
    page.value = { ...value.page };
    requestId.value = value.meta.requestId;
    error.value = null;
    empty.value = value.data.length === 0;
    failedQuery = null;
  }

  function adoptInitial(value: AdminLaMerchantEnvelope) {
    if (disposed) return;
    committedQ = "";
    status.value = "all";
    adoptEnvelope(value);
    loading.value = false;
  }

  function beginCooldown(seconds: unknown, sequence: number, epoch: number) {
    if (!Number.isInteger(seconds) || (seconds as number) < 1 || (seconds as number) > 60) return;
    retryBlocked.value = true;
    cooldownTimer = setTimeout(
      () => {
        if (
          disposed ||
          requestSequence !== sequence ||
          authEpoch.value !== epoch ||
          !isSessionLane()
        ) {
          return;
        }
        cooldownTimer = null;
        retryBlocked.value = false;
      },
      (seconds as number) * 1_000,
    );
  }

  async function load(requestedQuery: AdminLaMerchantQuery) {
    if (disposed || !isSessionLane()) return;
    const query = copyQuery(requestedQuery);
    clearCooldown();
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const sequence = ++requestSequence;
    const epoch = authEpoch.value;
    rows.value = [];
    requestId.value = "";
    error.value = null;
    empty.value = false;
    loading.value = true;

    try {
      const value = await fetchMerchants(query, controller.signal);
      if (!owns(sequence, epoch, controller)) return;
      adoptEnvelope(value);
    } catch (caught) {
      if (!owns(sequence, epoch, controller)) return;
      const safe = asSafeError(caught);
      if (safe.status === 401 || safe.status === 403) {
        retire();
        onAuthorizationLost(safe.status);
        return;
      }
      error.value = safe;
      failedQuery = copyQuery(query);
      empty.value = false;
      if (safe.status === 429) {
        beginCooldown(safe.retryAfterSeconds, sequence, epoch);
      }
    } finally {
      if (owns(sequence, epoch, controller)) {
        loading.value = false;
        activeController = null;
      }
    }
  }

  function currentQuery(offset: number): AdminLaMerchantQuery {
    return {
      limit: 20,
      offset,
      ...(committedQ ? { q: committedQ } : {}),
      ...(status.value === "all" ? {} : { status: status.value }),
    };
  }

  async function submitSearch() {
    if (disposed || !isSessionLane()) return;
    const q = draftQ.value.trim();
    if (q.length > 160) {
      clearCooldown();
      error.value = localContractError();
      empty.value = false;
      return;
    }
    committedQ = q;
    await load(currentQuery(0));
  }

  async function selectStatus(value: "all" | "active" | "inactive") {
    if (value !== "all" && value !== "active" && value !== "inactive") return;
    if (value === status.value || disposed || !isSessionLane()) return;
    status.value = value;
    await load(currentQuery(0));
  }

  async function previousPage() {
    if (!canPrevious.value || disposed || !isSessionLane()) return;
    const offset = Math.max(0, page.value.offset - page.value.limit);
    await load(currentQuery(offset));
  }

  async function nextPage() {
    if (!canNext.value || disposed || !isSessionLane()) return;
    const nextOffset = page.value.offset + page.value.limit;
    if (!Number.isSafeInteger(nextOffset) || nextOffset > 1_000_000) return;
    await load(currentQuery(nextOffset));
  }

  async function refresh() {
    if (disposed || !isSessionLane()) return;
    await load(currentQuery(page.value.offset));
  }

  async function retry() {
    if (!canRetry.value || !failedQuery || disposed || !isSessionLane()) return;
    await load(copyQuery(failedQuery));
  }

  return {
    rows,
    page,
    requestId,
    loading,
    error,
    empty,
    draftQ,
    status,
    canPrevious,
    canNext,
    canRetry,
    retryBlocked,
    adoptInitial,
    submitSearch,
    selectStatus,
    previousPage,
    nextPage,
    refresh,
    retry,
    retire,
    clear,
    dispose,
  };
}
