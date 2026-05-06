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

const CAMERA_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

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
  layer.className = "card-morph-layer card-camera-layer";
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
    willChange: "transform, opacity, clip-path, border-radius",
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForAnimations(animations: Animation[]) {
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}

function cleanCloneIds(root: HTMLElement) {
  root.removeAttribute("id");
  root.querySelectorAll<HTMLElement>("[id]").forEach((element) => element.removeAttribute("id"));
}

function disableCloneInteractivity(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("button, a, input, textarea, select, [role='button']").forEach((element) => {
    element.style.pointerEvents = "none";
  });
}

function cameraDetailRect(source: MotionRectSnapshot) {
  const viewport = viewportRect();
  const sideInset = Math.max(12, Math.round(viewport.width * 0.035));
  const width = Math.min(viewport.width - sideInset * 2, 440);
  const height = Math.min(
    viewport.height - Math.max(72, viewport.height * 0.1),
    Math.max(source.height * 2.1, viewport.height * 0.78),
  );
  const left = Math.round((viewport.width - width) / 2);
  const top = Math.max(0, Math.round((viewport.height - height) / 2));
  return rectFromBox(left, top, width, height);
}

function sourceCenterRect(source: MotionRectSnapshot) {
  const viewport = viewportRect();
  const scale = Math.min(1.12, Math.max(1.02, Math.min(viewport.width * 0.78 / Math.max(1, source.width), 1.12)));
  const width = source.width * scale;
  const height = source.height * scale;
  return rectFromBox(
    Math.round((viewport.width - width) / 2),
    Math.round((viewport.height - height) / 2),
    width,
    height,
  );
}

function transformBetween(from: MotionRectSnapshot, to: MotionRectSnapshot) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / Math.max(1, from.width);
  const sy = to.height / Math.max(1, from.height);
  return `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
}

function createCameraActor(source: HTMLElement, rect: MotionRectSnapshot) {
  const actor = source.cloneNode(true) as HTMLElement;
  cleanCloneIds(actor);
  disableCloneInteractivity(actor);
  actor.classList.add("card-camera-actor");
  actor.dataset.cameraActor = "card";

  const computedStyle = window.getComputedStyle(source);
  Object.assign(actor.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "1",
    pointerEvents: "none",
    transform: "translate3d(0, 0, 0) scale(1, 1)",
    transformOrigin: "top left",
    willChange: "transform, border-radius, box-shadow, background, filter",
    overflow: "hidden",
    border: computedStyle.border,
    borderRadius: computedStyle.borderRadius,
    background: computedStyle.background,
    boxShadow: computedStyle.boxShadow,
  });

  actor.querySelectorAll<HTMLElement>("img").forEach((image) => {
    image.style.pointerEvents = "none";
    image.style.userSelect = "none";
  });

  return actor;
}

function createFrozenViewBackdrop() {
  const backdrop = document.createElement("div");
  backdrop.className = "card-camera-backdrop";
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    zIndex: "0",
    background: "rgba(248, 250, 247, 0.18)",
    opacity: "0",
    backdropFilter: "blur(0px)",
    willChange: "opacity, backdrop-filter",
  });
  return backdrop;
}

function animateActorChrome(layer: HTMLElement, duration: number) {
  const topChrome = document.querySelector<HTMLElement>(".top-bar, .feed-view__tabs, [data-floating-chrome='top']");
  const bottomChrome = document.querySelector<HTMLElement>(".bottom-nav, .bottom-chrome, [data-floating-chrome='bottom']");
  const animations: Animation[] = [];

  if (topChrome) {
    animations.push(topChrome.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(-24px)", opacity: 0 },
      ],
      { duration: Math.min(260, duration * 0.45), easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (bottomChrome) {
    animations.push(bottomChrome.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(24px)", opacity: 0 },
      ],
      { duration: Math.min(260, duration * 0.45), easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  layer.addEventListener("card-camera-finish", () => {
    animations.forEach((animation) => animation.cancel());
  }, { once: true });
}

function animateActorInternals(actor: HTMLElement, duration: number) {
  const animations: Animation[] = [];
  const imageFrame = actor.querySelector<HTMLElement>("[data-motion-role='image-frame'], [data-motion-role='image'], [data-motion-role='image-placeholder']");
  const tag = actor.querySelector<HTMLElement>("[data-motion-role='tag']");
  const title = actor.querySelector<HTMLElement>("[data-motion-role='title']");
  const meta = actor.querySelector<HTMLElement>("[data-motion-role='meta-row']");
  const like = actor.querySelector<HTMLElement>("[data-motion-role='like']");
  const author = actor.querySelector<HTMLElement>("[data-motion-role='author']");

  if (imageFrame) {
    animations.push(imageFrame.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", borderRadius: "inherit", filter: "saturate(1)" },
        { transform: "translate3d(0, 0, 0) scale(1.035)", borderRadius: "24px", filter: "saturate(1.04)" },
      ],
      { duration: duration * 0.82, delay: duration * 0.1, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (tag) {
    animations.push(tag.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
        { transform: "translate3d(0, 12px, 0) scale(1.08)", opacity: 1 },
      ],
      { duration: duration * 0.48, delay: duration * 0.32, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (title) {
    animations.push(title.animate(
      [
        { transform: "translate3d(0, 0, 0)", opacity: 1, fontSize: window.getComputedStyle(title).fontSize },
        { transform: "translate3d(0, 10px, 0)", opacity: 1, fontSize: "22px" },
      ],
      { duration: duration * 0.46, delay: duration * 0.42, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (meta) {
    animations.push(meta.animate(
      [
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
        { transform: "translate3d(0, 18px, 0)", opacity: 0.9 },
      ],
      { duration: duration * 0.42, delay: duration * 0.52, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (author) {
    animations.push(author.animate(
      [
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
        { transform: "translate3d(0, 10px, 0)", opacity: 0 },
      ],
      { duration: duration * 0.34, delay: duration * 0.28, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  if (like) {
    like.textContent = "写回复";
    animations.push(like.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
        { transform: "translate3d(-18px, 22px, 0) scale(1.14)", opacity: 1 },
      ],
      { duration: duration * 0.38, delay: duration * 0.62, easing: CAMERA_EASING, fill: "forwards" },
    ));
  }

  return animations;
}

export async function playFeedCardToDetailMorph(root: HTMLElement, options: FeedCardMorphOptions = {}) {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    options.onReady?.();
    return;
  }

  const snapshot = collectMotionSnapshot(root);
  const duration = options.duration || 620;
  const centerRect = sourceCenterRect(snapshot.card);
  const detailRect = cameraDetailRect(snapshot.card);
  const layer = createMorphLayer();
  const backdrop = createFrozenViewBackdrop();
  const actor = createCameraActor(root, snapshot.card);
  const previousVisibility = root.style.visibility;
  const animations: Animation[] = [];

  layer.appendChild(backdrop);
  layer.appendChild(actor);
  root.style.visibility = "hidden";
  document.documentElement.classList.add("is-card-camera-opening");

  animations.push(backdrop.animate(
    [
      { opacity: 0, backdropFilter: "blur(0px)" },
      { opacity: 1, backdropFilter: "blur(8px)" },
    ],
    { duration: duration * 0.55, easing: CAMERA_EASING, fill: "forwards" },
  ));

  animations.push(actor.animate(
    [
      {
        offset: 0,
        transform: "translate3d(0, 0, 0) scale(1, 1)",
        borderRadius: window.getComputedStyle(root).borderRadius,
        boxShadow: window.getComputedStyle(root).boxShadow,
      },
      {
        offset: 0.38,
        transform: transformBetween(snapshot.card, centerRect),
        borderRadius: "22px",
        boxShadow: "0 18px 46px rgba(15, 23, 42, 0.18)",
      },
      {
        offset: 1,
        transform: transformBetween(snapshot.card, detailRect),
        borderRadius: "28px",
        boxShadow: "0 28px 72px rgba(15, 23, 42, 0.2)",
      },
    ],
    { duration, easing: CAMERA_EASING, fill: "forwards" },
  ));

  animations.push(...animateActorInternals(actor, duration));
  animateActorChrome(layer, duration);

  await sleep(Math.round(duration * 0.36));
  options.onReady?.();

  try {
    await waitForAnimations(animations);
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: "forwards" });
    await sleep(110);
  } finally {
    layer.dispatchEvent(new Event("card-camera-finish"));
    layer.remove();
    root.style.visibility = previousVisibility;
    document.documentElement.classList.remove("is-card-camera-opening");
  }
}
