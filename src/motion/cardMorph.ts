export interface MotionRectSnapshot {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type MotionRoleRects = Record<string, MotionRectSnapshot>;

export interface MotionElementSnapshot {
  role: string;
  rect: MotionRectSnapshot;
  text: string;
  html: string;
  tagName: string;
}

export type MotionElementSnapshots = Record<string, MotionElementSnapshot>;

export interface CardMorphSnapshot {
  card: MotionRectSnapshot;
  roles: MotionRoleRects;
  elements: MotionElementSnapshots;
}

export interface CloneAnimationOptions extends KeyframeAnimationOptions {
  delay?: number;
}

export interface FeedCardMorphOptions {
  duration?: number;
  onReady?: () => void;
}

const DEFAULT_MORPH_TIMING: KeyframeAnimationOptions = {
  duration: 420,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  fill: "forwards",
};

export function toMotionRect(rect: DOMRect | DOMRectReadOnly): MotionRectSnapshot {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function collectMotionSnapshot(root: HTMLElement): CardMorphSnapshot {
  const roles: MotionRoleRects = {};
  const elements: MotionElementSnapshots = {};

  root.querySelectorAll<HTMLElement>("[data-motion-role]").forEach((element) => {
    const role = element.dataset.motionRole;
    if (!role) return;

    const rect = toMotionRect(element.getBoundingClientRect());
    roles[role] = rect;
    elements[role] = {
      role,
      rect,
      text: element.textContent?.trim() || "",
      html: element.innerHTML,
      tagName: element.tagName.toLowerCase(),
    };
  });

  return {
    card: toMotionRect(root.getBoundingClientRect()),
    roles,
    elements,
  };
}

export function createMorphLayer() {
  const layer = document.createElement("div");
  layer.className = "card-morph-layer";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    pointerEvents: "none",
    contain: "layout style paint",
  });
  document.body.appendChild(layer);
  return layer;
}

export function createMorphClone(source: HTMLElement, rect: MotionRectSnapshot) {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add("card-morph-clone");
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "translate3d(0, 0, 0) scale(1, 1)",
    transformOrigin: "top left",
    pointerEvents: "none",
    willChange: "transform, opacity, clip-path",
  });
  return clone;
}

export function animateMorphClone(
  clone: HTMLElement,
  from: MotionRectSnapshot,
  to: MotionRectSnapshot,
  options: CloneAnimationOptions = {},
) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / Math.max(1, from.width);
  const sy = to.height / Math.max(1, from.height);

  return clone.animate(
    [
      {
        transform: "translate3d(0, 0, 0) scale(1, 1)",
        opacity: 1,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
        opacity: 1,
      },
    ],
    {
      ...DEFAULT_MORPH_TIMING,
      ...options,
    },
  );
}

export function matchingMotionRoles(source: MotionRoleRects, target: MotionRoleRects) {
  return Object.keys(source).filter((role) => Boolean(target[role]));
}

export async function playRoleMorph(
  sourceRoot: HTMLElement,
  targetRoot: HTMLElement,
  options: CloneAnimationOptions = {},
) {
  const sourceSnapshot = collectMotionSnapshot(sourceRoot);
  const targetSnapshot = collectMotionSnapshot(targetRoot);
  const layer = createMorphLayer();
  const animations: Animation[] = [];

  for (const role of matchingMotionRoles(sourceSnapshot.roles, targetSnapshot.roles)) {
    const sourceElement = sourceRoot.querySelector<HTMLElement>(`[data-motion-role="${role}"]`);
    if (!sourceElement) continue;

    const from = sourceSnapshot.roles[role];
    const to = targetSnapshot.roles[role];
    const clone = createMorphClone(sourceElement, from);
    clone.dataset.morphRole = role;
    layer.appendChild(clone);
    animations.push(animateMorphClone(clone, from, to, options));
  }

  try {
    await Promise.all(animations.map((animation) => animation.finished));
  } finally {
    layer.remove();
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function viewportRect() {
  const width = typeof window !== "undefined" ? window.innerWidth || 390 : 390;
  const height = typeof window !== "undefined" ? window.innerHeight || 844 : 844;
  return { width, height };
}

function rectFromBox(left: number, top: number, width: number, height: number): MotionRectSnapshot {
  return { left, top, width, height };
}

function sourceRoleElement(root: HTMLElement, role: string) {
  return root.querySelector<HTMLElement>(`[data-motion-role="${role}"]`);
}

function fallbackRect(snapshot: CardMorphSnapshot, role: string, fallbackRole = "meta-row") {
  return snapshot.roles[role] || snapshot.roles[fallbackRole] || snapshot.card;
}

function createSurfaceClone(root: HTMLElement, rect: MotionRectSnapshot) {
  const computedStyle = window.getComputedStyle(root);
  const clone = document.createElement("div");
  clone.className = "card-morph-surface";
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    border: computedStyle.border,
    borderRadius: computedStyle.borderRadius,
    background: computedStyle.background,
    boxShadow: computedStyle.boxShadow,
    transform: "translate3d(0, 0, 0) scale(1, 1)",
    transformOrigin: "top left",
    overflow: "hidden",
    willChange: "transform, border-radius, opacity",
  });
  return clone;
}

function createTextClone(text: string, rect: MotionRectSnapshot, className: string) {
  const clone = document.createElement("div");
  clone.className = className;
  clone.textContent = text;
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    transform: "translate3d(0, 0, 0) scale(1, 1)",
    transformOrigin: "top left",
    pointerEvents: "none",
    willChange: "transform, opacity",
  });
  return clone;
}

function applyCloneReset(clone: HTMLElement) {
  clone.style.clip = "auto";
  clone.style.clipPath = "none";
  clone.style.whiteSpace = "normal";
  clone.style.overflow = "hidden";
  clone.style.contain = "layout style paint";
  clone.querySelectorAll<HTMLElement>("button, a, input, textarea, select").forEach((element) => {
    element.style.pointerEvents = "none";
  });
}

function waitForAnimations(animations: Animation[]) {
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}

export async function playFeedCardToDetailMorph(root: HTMLElement, options: FeedCardMorphOptions = {}) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;

  const snapshot = collectMotionSnapshot(root);
  const viewport = viewportRect();
  const duration = options.duration || 520;
  const layer = createMorphLayer();
  const animations: Animation[] = [];
  const sideInset = Math.max(12, Math.round(viewport.width * 0.045));
  const maxContentWidth = Math.min(viewport.width - sideInset * 2, 420);
  const contentLeft = Math.round((viewport.width - maxContentWidth) / 2);
  const imageTop = Math.max(70, Math.round(viewport.height * 0.09));
  const imageHeight = Math.min(460, Math.max(240, Math.round(viewport.height * 0.52)));
  const titleTop = imageTop + imageHeight + 24;
  const metaTop = titleTop + 82;
  const replyTop = viewport.height - 84;

  const surfaceTarget = rectFromBox(0, 0, viewport.width, viewport.height);
  const imageTarget = rectFromBox(contentLeft, imageTop, maxContentWidth, imageHeight);
  const tagTarget = rectFromBox(contentLeft + 12, imageTop + imageHeight - 42, Math.min(140, maxContentWidth - 24), 28);
  const titleTarget = rectFromBox(contentLeft, titleTop, maxContentWidth, 72);
  const metaTarget = rectFromBox(contentLeft, metaTop, maxContentWidth, 34);
  const replyTarget = rectFromBox(contentLeft, replyTop, maxContentWidth, 50);

  const surfaceClone = createSurfaceClone(root, snapshot.card);
  layer.appendChild(surfaceClone);
  animations.push(animateMorphClone(surfaceClone, snapshot.card, surfaceTarget, {
    duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  }));
  surfaceClone.animate(
    [
      { borderRadius: window.getComputedStyle(root).borderRadius },
      { borderRadius: "0px" },
    ],
    { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );

  const imageSource = sourceRoleElement(root, "image") || sourceRoleElement(root, "image-frame") || sourceRoleElement(root, "image-placeholder");
  if (imageSource) {
    const from = fallbackRect(snapshot, imageSource.dataset.motionRole || "image", "image-frame");
    const imageClone = createMorphClone(imageSource, from);
    imageClone.dataset.morphRole = "image";
    applyCloneReset(imageClone);
    layer.appendChild(imageClone);
    animations.push(animateMorphClone(imageClone, from, imageTarget, {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }));
  }

  const tagSource = sourceRoleElement(root, "tag");
  if (tagSource) {
    const from = fallbackRect(snapshot, "tag", "author");
    const tagClone = createMorphClone(tagSource, from);
    tagClone.dataset.morphRole = "tag";
    applyCloneReset(tagClone);
    layer.appendChild(tagClone);
    animations.push(animateMorphClone(tagClone, from, tagTarget, {
      duration: duration - 60,
      delay: 90,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }));
  }

  const titleSource = sourceRoleElement(root, "title");
  if (titleSource) {
    const from = fallbackRect(snapshot, "title", "body");
    const titleClone = createMorphClone(titleSource, from);
    titleClone.dataset.morphRole = "title";
    applyCloneReset(titleClone);
    titleClone.style.fontSize = "22px";
    titleClone.style.lineHeight = "1.32";
    layer.appendChild(titleClone);
    animations.push(animateMorphClone(titleClone, from, titleTarget, {
      duration: duration - 90,
      delay: 130,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }));
  }

  const timeText = root.dataset.motionTime || snapshot.elements.time?.text || "刚刚";
  const placeText = root.dataset.motionPlace || snapshot.elements.place?.text || "校园";
  const metaText = [timeText, placeText].filter(Boolean).join(" · ");
  if (metaText) {
    const from = fallbackRect(snapshot, "meta-row", "like");
    const metaClone = createTextClone(metaText, from, "card-morph-meta-row");
    metaClone.dataset.morphRole = "metadata";
    layer.appendChild(metaClone);
    animations.push(animateMorphClone(metaClone, from, metaTarget, {
      duration: duration - 120,
      delay: 170,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }));
  }

  const likeSource = sourceRoleElement(root, "like");
  if (likeSource) {
    const from = fallbackRect(snapshot, "like", "meta-row");
    const replyClone = createMorphClone(likeSource, from);
    replyClone.dataset.morphRole = "reply";
    replyClone.textContent = "写回复";
    applyCloneReset(replyClone);
    replyClone.style.display = "flex";
    replyClone.style.alignItems = "center";
    replyClone.style.justifyContent = "flex-start";
    replyClone.style.paddingInline = "16px";
    layer.appendChild(replyClone);
    animations.push(animateMorphClone(replyClone, from, replyTarget, {
      duration: duration - 160,
      delay: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }));
  }

  options.onReady?.();

  try {
    await waitForAnimations(animations);
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: "forwards" });
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  } finally {
    layer.remove();
  }
}
