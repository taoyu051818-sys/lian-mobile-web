const mainViewTransition = (() => {
  const VIEW_SELECTOR = "[data-view]";
  const TRANSITION_MS = 220;
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const NAV_ORDER = ["feed", "map", "messages", "profile"];
  const originalSwitchView = typeof window.switchView === "function" ? window.switchView : null;
  let locked = false;
  let transitionSerial = 0;

  function viewFor(name) {
    if (!name) return null;
    const escapedName = window.CSS?.escape ? CSS.escape(name) : name;
    return document.querySelector(`[data-view="${escapedName}"]`);
  }

  function activeView() {
    return document.querySelector(`${VIEW_SELECTOR}.is-active`);
  }

  function prefersReducedMotion() {
    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
  }

  function resolveDirection(fromName, toName, explicitDirection) {
    if (explicitDirection === "forward" || explicitDirection === "back") return explicitDirection;
    if (!fromName || !toName || fromName === toName) return "forward";
    if (toName === "detail" || toName === "publish") return "forward";
    if (fromName === "detail" || fromName === "publish") return "back";
    const fromIndex = NAV_ORDER.indexOf(fromName);
    const toIndex = NAV_ORDER.indexOf(toName);
    if (fromIndex === -1 || toIndex === -1) return "forward";
    return toIndex >= fromIndex ? "forward" : "back";
  }

  function setViewImmediately(viewName) {
    document.querySelectorAll(VIEW_SELECTOR).forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === viewName);
    });
    document.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === viewName);
    });
    if (viewName === "map") window.MapV2?.init?.();
  }

  function clearTransitionClasses(view) {
    if (!view) return;
    view.classList.remove(
      "is-entering",
      "is-leaving",
      "is-animating",
      "entering-forward",
      "entering-back",
      "leaving-forward",
      "leaving-back"
    );
  }

  function cleanupTransition(fromView, toView) {
    clearTransitionClasses(fromView);
    clearTransitionClasses(toView);
    document
      .querySelectorAll(`${VIEW_SELECTOR}.is-entering, ${VIEW_SELECTOR}.is-leaving, ${VIEW_SELECTOR}.is-animating`)
      .forEach(clearTransitionClasses);
    locked = false;
  }

  function invalidateMapIfNeeded(viewName) {
    if (viewName !== "map") return;
    requestAnimationFrame(() => {
      window.MapV2?.invalidateSize?.();
      if (!window.MapV2?.invalidateSize && window.MapV2?.init) window.MapV2.init();
      if (typeof renderCampusMap === "function") renderCampusMap();
    });
  }

  function finishWithoutAnimation(viewName) {
    cleanupTransition();
    invalidateMapIfNeeded(viewName);
  }

  function animateViews(fromView, toView, direction) {
    if (!fromView || !toView || fromView === toView || prefersReducedMotion()) {
      finishWithoutAnimation(toView?.dataset.view);
      return;
    }

    locked = true;
    transitionSerial += 1;
    const serial = transitionSerial;
    const enteringClass = `entering-${direction}`;
    const leavingClass = `leaving-${direction}`;
    let done = false;

    clearTransitionClasses(fromView);
    clearTransitionClasses(toView);
    fromView.classList.add("is-leaving");
    toView.classList.add("is-entering", enteringClass);

    const finish = () => {
      if (done || serial !== transitionSerial) return;
      done = true;
      cleanupTransition(fromView, toView);
      invalidateMapIfNeeded(toView.dataset.view);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fromView.classList.add("is-animating", leavingClass);
        toView.classList.add("is-animating");
        toView.classList.remove(enteringClass);
      });
    });

    toView.addEventListener("transitionend", (event) => {
      if (event.target === toView && event.propertyName === "transform") finish();
    }, { once: true });
    window.setTimeout(finish, TRANSITION_MS + 120);
  }

  function navigateTo(viewName, options = {}) {
    if (!viewName || locked) return false;
    const fromView = activeView();
    if (fromView?.dataset.view === viewName) return false;
    const fromName = fromView?.dataset.view;
    const resolvedDirection = resolveDirection(fromName, viewName, options.direction);
    if (originalSwitchView) originalSwitchView(viewName, options);
    else setViewImmediately(viewName);
    const toView = viewFor(viewName);
    animateViews(fromView, toView, resolvedDirection);
    return true;
  }

  return {
    navigateTo,
    isLocked: () => locked,
    originalSwitchView
  };
})();

function navigateTo(viewName, options = {}) {
  return mainViewTransition.navigateTo(viewName, options);
}

if (mainViewTransition.originalSwitchView) {
  window.switchView = navigateTo;
  try {
    switchView = navigateTo;
  } catch (error) {
    console.warn("[view-transition] switchView binding was not reassigned", error);
  }
}
window.navigateTo = navigateTo;

document.addEventListener("click", (event) => {
  const lightboxClose = event.target.closest("[data-close-lightbox]");
  if (lightboxClose) {
    closeImageLightbox();
    return;
  }

  const zoomTarget = event.target.closest("[data-zoom-image]");
  if (zoomTarget) {
    openImageLightbox(zoomTarget.dataset.zoomImage, zoomTarget.getAttribute("alt") || "");
    return;
  }

  const galleryDot = event.target.closest("[data-gallery-dot]");
  if (galleryDot) {
    const gallery = $(".detail-gallery");
    const index = Number(galleryDot.dataset.galleryDot || 0);
    if (gallery) {
      const items = $$(".detail-gallery-item", gallery);
      const target = items[index];
      gallery.scrollTo({ left: target ? target.offsetLeft : gallery.clientWidth * index, behavior: "smooth" });
    }
    return;
  }

  const routeControl = event.target.closest("[data-map-route]");
  if (routeControl) {
    if (routeControl.dataset.mapRoute === "all") {
      state.mapRoutesVisible = !(state.mapRoutesVisible && state.mapRouteFilter === "all");
      state.mapRouteFilter = "all";
    } else {
      state.mapRoutesVisible = true;
      state.mapRouteFilter = routeControl.dataset.mapRoute;
    }
    renderCampusMap();
    return;
  }

  const mapToggle = event.target.closest("[data-map-toggle]");
  if (mapToggle) {
    if (mapToggle.dataset.mapToggle === "places") state.mapShowPlaces = !state.mapShowPlaces;
    if (mapToggle.dataset.mapToggle === "memories") state.mapShowMemories = !state.mapShowMemories;
    if (mapToggle.dataset.mapToggle === "foodMenus") state.mapShowFoodMenus = !state.mapShowFoodMenus;
    renderCampusMap();
    return;
  }

  const mapStage = event.target.closest("#campusMapStage");
  if (mapStage && state.mapPickingLocation && !event.target.closest("[data-tid], .map-filterbar")) {
    if (Date.now() - state.lastMapDragAt < 220) return;
    pickPublishMapLocation(event);
    return;
  }

  const feedTab = event.target.closest("[data-feed-tab]");
  if (feedTab) {
    state.tab = feedTab.dataset.feedTab;
    loadFeed(true);
    return;
  }

  const likeButton = event.target.closest("[data-like-tid]");
  if (likeButton) {
    event.preventDefault();
    event.stopPropagation();
    togglePostLike(likeButton);
    return;
  }

  const saveButton = event.target.closest("[data-save-tid]");
  if (saveButton) {
    event.preventDefault();
    event.stopPropagation();
    togglePostSave(saveButton);
    return;
  }

  const reportButton = event.target.closest("[data-report-tid]");
  if (reportButton) {
    event.preventDefault();
    event.stopPropagation();
    handleReportPost(reportButton.dataset.reportTid);
    return;
  }

  const focusReplyButton = event.target.closest("[data-focus-reply]");
  if (focusReplyButton) {
    event.preventDefault();
    const form = $("[data-reply-form]");
    const input = form?.elements?.content;
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => input?.focus(), 120);
    return;
  }

  const card = event.target.closest("[data-tid]");
  if (card) {
    if (card.closest("#messageList")) return;
    if (card.closest("#notificationList")) {
      openDetail(card.dataset.tid);
      return;
    }
    openDetail(card.dataset.tid);
    return;
  }

  const messageTab = event.target.closest("[data-message-tab]");
  if (messageTab) {
    switchMessageTab(messageTab.dataset.messageTab);
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    switchView(tab.dataset.tab);
    return;
  }

  const authOpen = event.target.closest("[data-open-auth]");
  if (authOpen) {
    openAuth(authOpen.dataset.openAuth || "login");
    return;
  }

  const authMode = event.target.closest("[data-auth-mode]");
  if (authMode) {
    openAuth(authMode.dataset.authMode);
    return;
  }

  if (event.target.closest("[data-create-invite]")) {
    createInviteCode();
    return;
  }

  if (event.target.closest("[data-send-email-code]")) {
    sendEmailCode();
    return;
  }

  if (event.target.closest("[data-auth-logout]")) {
    logoutAuth();
    return;
  }

  if (event.target.closest("[data-open-publish]")) {
    if (!requireLoginUi()) return;
    publishPageOpen();
    return;
  }
  if (event.target.closest("[data-pick-time]")) {
    pickTime();
    return;
  }
  if (event.target.closest("[data-use-current-location]")) {
    fillCurrentLocation();
    return;
  }
  if (event.target.closest("[data-pick-map-location]")) {
    if (state.aiPublish.active) syncAiLocationFromInput();
    startMapLocationPick();
    return;
  }
  if (event.target.closest("[data-skip-ai-location]")) {
    state.aiPublish.locationDraft = skippedAiLocationDraft();
    renderAiPublishSheet();
    return;
  }
  const removeImageBtn = event.target.closest("[data-remove-ai-image]");
  if (removeImageBtn) {
    removeAiImage(Number(removeImageBtn.dataset.removeAiImage));
    return;
  }
  if (event.target.closest("[data-regenerate-ai]")) {
    syncAiLocationFromInput();
    requestAiPreview();
    return;
  }
  if (event.target.closest("[data-back-feed]")) {
    backToFeed();
    return;
  }

  if (event.target.closest("[data-publish-back]")) {
    publishPageBack();
    return;
  }
  if (event.target.closest("[data-publish-confirm-images]")) {
    publishPageConfirmImages();
    return;
  }
  if (event.target.closest("[data-publish-skip-location]")) {
    publishPageSkipLocation();
    return;
  }
  if (event.target.closest("[data-publish-confirm-location]")) {
    publishPageConfirmLocation();
    return;
  }
  if (event.target.closest("[data-publish-remove-image]")) {
    const btn = event.target.closest("[data-publish-remove-image]");
    publishPageRemoveImage(Number(btn.dataset.publishRemoveImage));
    return;
  }
  if (event.target.closest("[data-publish-save-draft]")) {
    publishPageSaveDraft();
    return;
  }
  if (event.target.closest("[data-publish-submit]")) {
    publishPagePublish();
    return;
  }
  if (event.target.closest("[data-publish-regenerate]")) {
    publishPageRegenerate();
    return;
  }
  if (event.target.closest("[data-publish-audience]")) {
    const btn = event.target.closest("[data-publish-audience]");
    publishPageSetAudience(btn.dataset.publishAudience);
    return;
  }

  if (event.target.closest("[data-close-publish]")) $("#publishSheet").close();
  if (event.target.closest("[data-close-auth]")) $("#authSheet").close();
  if (event.target.closest("[data-close-avatar-crop]")) closeAvatarCrop();
  if (event.target.closest("[data-confirm-avatar-crop]")) confirmAvatarCrop();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageLightbox();
});

window.addEventListener("popstate", () => {
  if (location.hash.startsWith("#/post/")) return;
  if ($('[data-view="detail"]').classList.contains("is-active")) backToFeed();
});

$("#publishForm").addEventListener("submit", submitPost);
$("#channelForm")?.addEventListener("submit", submitChannelMessage);
$("#authForm")?.addEventListener("submit", submitAuth);
document.addEventListener("submit", submitReply);
document.addEventListener("change", (event) => {
  if (event.target?.id === "avatarInput") openAvatarCrop(event.target.files?.[0]);
  if (event.target?.id === "publishImageInput") startAiImageUpload(Array.from(event.target.files || []));
  if (event.target?.id === "publishPageImageInput") publishPageHandleImageSelect(Array.from(event.target.files || []));
  if (event.target?.name === "placeName" && state.aiPublish.active) syncAiLocationFromInput();
});
document.addEventListener("input", (event) => {
  if (event.target?.name === "placeName" && state.aiPublish.active) syncAiLocationFromInput();
});

$("#avatarZoom")?.addEventListener("input", (event) => setAvatarZoom(event.target.value));
$("#avatarCropFrame")?.addEventListener("pointerdown", (event) => {
  const crop = state.avatarCrop;
  if (!crop) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  crop.drag = { startX: event.clientX, startY: event.clientY, x: crop.x, y: crop.y };
});
$("#avatarCropFrame")?.addEventListener("pointermove", (event) => {
  const crop = state.avatarCrop;
  if (!crop?.drag) return;
  crop.x = crop.drag.x + event.clientX - crop.drag.startX;
  crop.y = crop.drag.y + event.clientY - crop.drag.startY;
  renderAvatarCrop();
});
$("#avatarCropFrame")?.addEventListener("pointerup", (event) => {
  if (state.avatarCrop) state.avatarCrop.drag = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
});
$("#avatarCropFrame")?.addEventListener("pointercancel", () => {
  if (state.avatarCrop) state.avatarCrop.drag = null;
});

window.addEventListener("scroll", maybePreloadFeed, { passive: true });
window.addEventListener("scroll", maybeLoadOlderMessages, { passive: true });

const feedObserver = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) maybePreloadFeed();
}, {
  root: null,
  rootMargin: "900px 0px 1200px 0px",
  threshold: 0
});

window.addEventListener("touchstart", (event) => {
  if (window.scrollY > 0) return;
  state.pullStartY = event.touches[0].clientY;
}, { passive: true });

window.addEventListener("touchmove", (event) => {
  if (state.pullStartY === null || window.scrollY > 0) return;
  const distance = event.touches[0].clientY - state.pullStartY;
  const active = distance > 58;
  state.pullActive = active;
  $("#pullIndicator").classList.toggle("is-visible", active);
}, { passive: true });

window.addEventListener("touchend", () => {
  if (state.pullActive) loadFeed(true);
  state.pullStartY = null;
  if (!state.loading) $("#pullIndicator").classList.remove("is-visible");
}, { passive: true });

async function initApp() {
  renderTabs(["此刻", "精选"]);
  ensureMasonryColumns(true);
  await loadFeed(true);
  state.initialized = true;
  feedObserver.observe($("#feedSentinel"));
  maybePreloadFeed();
  loadAuthMe().catch((error) => console.warn("[auth] me failed", error));
}

initApp();
