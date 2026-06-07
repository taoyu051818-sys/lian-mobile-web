/**
 * useViewerErrandPermission — wave 3-A capability probe (mw#827).
 *
 * Detail-page wrapper around the campus_verified gate that the
 * errand-help CTA needs. Calls `/api/auth/me` for detail action surfaces
 * and exposes the campus verification and authentication booleans they need.
 *
 * Failure (anonymous viewer 401, transport error) lands as `false` —
 * which routes the CTA into the disabled-permission branch, the same
 * outcome a confirmed unverified user would see. We never throw.
 *
 * Splitting the probe out of `PostDetailPanel.vue` keeps the view-boundary
 * guard happy: the panel only imports composables, the composable owns
 * the api call.
 */
import { ref } from "vue";
import { fetchAuthMe } from "../../api/profile";

export function useViewerErrandPermission() {
  const campusVerified = ref(false);
  const probed = ref(false);
  const isAuthenticated = ref(false);

  async function refresh() {
    try {
      const me = await fetchAuthMe();
      isAuthenticated.value = Boolean(me);
      campusVerified.value = Boolean(me?.verificationState?.campus_verified?.active);
    } catch {
      isAuthenticated.value = false;
      campusVerified.value = false;
    } finally {
      probed.value = true;
    }
  }

  return {
    campusVerified,
    isAuthenticated,
    probed,
    refresh,
  };
}
