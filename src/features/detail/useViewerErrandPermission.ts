/**
 * useViewerErrandPermission — wave 3-A capability probe (mw#827).
 *
 * Detail-page wrapper around the campus_verified gate that the
 * errand-help CTA needs. Reuses the same `/api/auth/me` call the rest of
 * the detail surface already makes via `usePostDetailExtensions`, but
 * surfaces just the boolean answer the merchant block cares about.
 *
 * Failure (anonymous viewer 401, transport error) lands as `false` —
 * which routes the CTA into the disabled-permission branch, the same
 * outcome a confirmed unverified user would see. We never throw.
 *
 * Splitting the probe out of `PostDetailPanel.vue` keeps the view-boundary
 * guard happy: the panel only imports composables, the composable owns
 * the api call.
 */
import { onMounted, ref } from "vue";
import { fetchAuthMe } from "../../api/profile";

export function useViewerErrandPermission() {
  const campusVerified = ref(false);
  const probed = ref(false);

  async function refresh() {
    try {
      const me = await fetchAuthMe();
      campusVerified.value = Boolean(me?.verificationState?.campus_verified?.active);
    } catch {
      campusVerified.value = false;
    } finally {
      probed.value = true;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    campusVerified,
    probed,
    refresh,
  };
}
