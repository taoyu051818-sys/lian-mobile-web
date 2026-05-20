import { computed } from "vue";

import { appViews, getViewDefinition, type AppViewKey } from "./view-types";
import { getViewFromHashRef, pushViewHash } from "./view-hash";

// Active view is independent of the detail-navigation FSM.
// Post detail is now an App-level overlay (see src/app/DetailSurface.vue,
// issue #636), so opening or closing a detail must not move the user off
// whichever tab they're on.
//
// `viewFromHash` is the single source of truth for which view is active.
// It accepts the full `AppViewKey` set — the five visible tabs plus the
// secret views (admin/verification/merchant/errand-order/runner). Direct
// hash opens and refreshes therefore mount the matching component without
// any extra in-memory ref. The bottom tab bar still renders only the five
// `appViews`, so secret views simply leave every tab inactive — that's the
// intended UX.
const viewFromHash = getViewFromHashRef();

export function useActiveView() {
  const activeView = computed(() => getViewDefinition(viewFromHash.value));

  function setActiveView(key: AppViewKey) {
    // URL is the source of truth. The view hash is the only writer here.
    // A separate detail-navigation/url-sync listener will close any open
    // post-detail overlay when this hashchange lands. This path also
    // works for secret views: pushing `#/merchant` updates the singleton
    // ref via the view-hash listener, so refreshes round-trip correctly.
    pushViewHash(key);
  }

  return {
    activeViewKey: viewFromHash,
    activeView,
    views: appViews,
    setActiveView,
  };
}
