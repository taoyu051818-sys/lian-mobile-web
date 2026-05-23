/**
 * Auth-link redeem composable (RFC §2.3 mw#B).
 *
 * Owns the load + redeem lifecycle for the auth-link token so the AuthPanel
 * view stays presentational. Detects `?link=<token>` on mount and triggers
 * the card preview fetch.
 *
 * Lifecycle:
 *   - `init()` checks URL for `?link=` param and opens the sheet if present.
 *   - `retry()` re-fetches the same token after a network error.
 *   - `redeem()` calls the redeem API and refreshes session on success.
 *   - `close()` resets the sheet state and clears the URL param.
 *
 * Error model mapped from `AuthLinkError.reason`:
 *   - `not-found` → token does not exist
 *   - `expired` → token TTL exceeded
 *   - `exhausted` → token maxUses reached
 *   - `network` → transient failure, show retry
 */

import { computed, ref, onMounted } from "vue";
import { fetchAuthLinkCard, redeemAuthLink, AuthLinkError } from "../../api/authLink";
export type { AuthLinkCard } from "../../api/authLink";
import {
  AUTH_LINK_ERROR_NOT_FOUND,
  AUTH_LINK_ERROR_EXPIRED,
  AUTH_LINK_ERROR_EXHAUSTED,
  AUTH_LINK_ERROR_NETWORK,
  AUTH_LINK_REDEEM_SUCCESS,
} from "../../config/brand";

export type AuthLinkRedeemStatus = "idle" | "loading" | "ready" | "redeeming" | "success" | "error";

export interface UseAuthLinkRedeemOptions {
  cardLoader?: (token: string) => Promise<AuthLinkCard>;
  redeemer?: (token: string) => Promise<unknown>;
  onRedeemed?: () => void;
}

function getAuthLinkToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("link") || "";
  } catch {
    return "";
  }
}

function clearAuthLinkToken() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("link");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

export function useAuthLinkRedeem(options: UseAuthLinkRedeemOptions = {}) {
  const cardLoader = options.cardLoader ?? fetchAuthLinkCard;
  const redeemer = options.redeemer ?? redeemAuthLink;
  const onRedeemed = options.onRedeemed;

  const open = ref(false);
  const status = ref<AuthLinkRedeemStatus>("idle");
  const card = ref<AuthLinkCard | null>(null);
  const errorReason = ref<"not-found" | "expired" | "exhausted" | "network" | "">("");
  const errorMessage = ref("");
  const successMessage = ref("");
  const currentToken = ref("");
  let requestToken = 0;

  const isOpen = computed(() => open.value);
  const isLoading = computed(() => status.value === "loading");
  const isReady = computed(() => status.value === "ready");
  const isRedeeming = computed(() => status.value === "redeeming");
  const isSuccess = computed(() => status.value === "success");
  const isError = computed(() => status.value === "error");
  const canRetry = computed(() => status.value === "error" && errorReason.value === "network");
  const canRedeem = computed(() => status.value === "ready" && card.value !== null);

  function mapErrorMessage(reason: string): string {
    switch (reason) {
      case "not-found":
        return AUTH_LINK_ERROR_NOT_FOUND;
      case "expired":
        return AUTH_LINK_ERROR_EXPIRED;
      case "exhausted":
        return AUTH_LINK_ERROR_EXHAUSTED;
      default:
        return AUTH_LINK_ERROR_NETWORK;
    }
  }

  function reset() {
    status.value = "idle";
    card.value = null;
    errorReason.value = "";
    errorMessage.value = "";
    successMessage.value = "";
  }

  async function loadCard(token: string) {
    const reqToken = ++requestToken;
    status.value = "loading";
    card.value = null;
    errorReason.value = "";
    errorMessage.value = "";

    try {
      const result = await cardLoader(token);
      if (reqToken !== requestToken) return;
      card.value = result;
      status.value = "ready";
    } catch (err) {
      if (reqToken !== requestToken) return;
      if (err instanceof AuthLinkError) {
        errorReason.value = err.reason;
        errorMessage.value = mapErrorMessage(err.reason);
      } else {
        errorReason.value = "network";
        errorMessage.value = AUTH_LINK_ERROR_NETWORK;
      }
      status.value = "error";
    }
  }

  function init() {
    const token = getAuthLinkToken();
    if (!token) return;

    currentToken.value = token;
    open.value = true;
    void loadCard(token);
  }

  function close() {
    open.value = false;
    currentToken.value = "";
    requestToken++;
    clearAuthLinkToken();
    reset();
  }

  function retry() {
    const token = currentToken.value;
    if (!token) return;
    void loadCard(token);
  }

  async function redeem() {
    const token = currentToken.value;
    if (!token || status.value !== "ready") return;

    const reqToken = ++requestToken;
    status.value = "redeeming";
    errorReason.value = "";
    errorMessage.value = "";

    try {
      await redeemer(token);
      if (reqToken !== requestToken) return;
      status.value = "success";
      successMessage.value = AUTH_LINK_REDEEM_SUCCESS;
      clearAuthLinkToken();
      onRedeemed?.();
    } catch (err) {
      if (reqToken !== requestToken) return;
      if (err instanceof AuthLinkError) {
        errorReason.value = err.reason;
        errorMessage.value = mapErrorMessage(err.reason);
      } else {
        errorReason.value = "network";
        errorMessage.value = AUTH_LINK_ERROR_NETWORK;
      }
      status.value = "error";
    }
  }

  onMounted(() => {
    init();
  });

  return {
    open: isOpen,
    status,
    card,
    errorReason,
    errorMessage,
    successMessage,
    isLoading,
    isReady,
    isRedeeming,
    isSuccess,
    isError,
    canRetry,
    canRedeem,
    init,
    close,
    retry,
    redeem,
  };
}
