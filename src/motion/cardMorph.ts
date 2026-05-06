export type MotionRole =
  | "surface"
  | "image"
  | "tag"
  | "title"
  | "title-body"
  | "meta"
  | "time"
  | "place"
  | "action"
  | "like"
  | "reply";

export interface MotionRectSnapshot {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface MotionElementSnapshot {
  role: MotionRole;
  targetRole: MotionRole;
  rect: MotionRectSnapshot;
  tagName: string;
}

export type MotionSnapshot = Partial<Record<MotionRole, MotionElementSnapshot>>;

export interface RolePair {
  sourceRole: MotionRole;
  targetRole: MotionRole;
  source?: MotionElementSnapshot;
  target?: MotionElementSnapshot;
}

export interface EnterMorphOptions {
  duration?: number;
  easing?: string;
  reducedMotion?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

export interface EnterMorphHandle {
  finished: Promise<void>;
  cancel: () => void;
}

export const ROLE_MAP: Record<MotionRole, MotionRole> = {
  surface: "surface",
  image: "image",
  tag: "tag",
  title: "title-body",
  "title-body": "title-body",
  meta: "meta",
  time: "meta",
  place: "meta",
  action: "reply",
  like: "reply",
  reply: "reply",
};

const DEFAULT_DURATION = 420;
const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const SURFACE_ROLE: MotionRole = "surface";

export function toMotionRect(rect: DOMRect | DOMRectReadOnly): MotionRectSnapshot {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function normalizeMotionRole(role: string | undefined | null): MotionRole | null {
  if (!role) return null;
  if (role === "meta-row") return "meta";
  if (role === "image-frame" || role === "image-placeholder") return "image";
  if (role === "like") return "like";
  if (role in ROLE_MAP) return role as MotionRole;
  return null;
}

export function targetRoleForSource(sourceRole: MotionRole): MotionRole {
  return ROLE_MAP[sourceRole] || sourceRole;
}

export function collectMotionSnapshot(root: HTMLElement): MotionSnapshot {
  const snapshot: MotionSnapshot = {};

  const rootRole = normalizeMotionRole(root.dataset.motionRole) || SURFACE_ROLE;
  snapshot[rootRole] = {
    role: rootRole,
    targetRole: targetRoleForSource(rootRole),
    rect: toMotionRect(root.getBoundingClientRect()),
    tagName: root.tagName.toLowerCase(),
  };

  root.querySelectorAll<HTMLElement>("[data-motion-role]").forEach((element) => {
    const role = normalizeMotionRole(element.dataset.motionRole);
    if (!role) return;
    if (snapshot[role]) return;

    snapshot[role] = {
      role,
      targetRole: targetRoleForSource(role),
      rect: toMotionRect(element.getBoundingClientRect()),
      tagName: element.tagName.toLowerCase(),
    };
  });

  return snapshot;
}

export function pairMotionRoles(source: MotionSnapshot, target: MotionSnapshot): RolePair[] {
  const sourceRoles = Object.keys(source) as MotionRole[];
  const targetRoles = new Set(Object.keys(target) as MotionRole[]);
  const pairs: RolePair[] = [];

  sourceRoles.forEach((sourceRole) => {
    const targetRole = targetRoleForSource(sourceRole);
    pairs.push({
      sourceRole,
      targetRole,
      source: source[sourceRole],
      target: target[targetRole],
    });
    targetRoles.delete(targetRole);
  });

  targetRoles.forEach((targetRole) => {
    pairs.push({
      sourceRole: targetRole,
      targetRole,
      target: target[targetRole],
    });
  });

  return pairs;
}

export function createMorphLayer(ownerDocument: Document = document): HTMLElement {
  const layer = ownerDocument.createElement("div");
  layer.className = "card-morph-layer";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    pointerEvents: "none",
    contain: "layout style paint",
  });
  ownerDocument.body.appendChild(layer);
  return layer;
}

function cloneElementForRole(root: HTMLElement, role: MotionRole): HTMLElement | null {
  const selector = role === SURFACE_ROLE
    ? null
    : `[data-motion-role="${role}"]`;
  const element = selector ? root.querySelector<HTMLElement>(selector) : root;
  return element ? cloneVisualElement(element) : null;
}

function cloneVisualElement(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll<HTMLElement>("[id]").forEach((node) => node.removeAttribute("id"));
  clone.querySelectorAll<HTMLElement>("button, a, input, textarea, select, [role='button']").forEach((node) => {
    node.style.pointerEvents = "none";
  });
  clone.style.pointerEvents = "none";
  clone.style.margin = "0";
  clone.style.transformOrigin = "top left";
  clone.style.willChange = "transform, opacity";
  return clone;
}

function placeClone(clone: HTMLElement, rect: MotionRectSnapshot) {
  Object.assign(clone.style, {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: "hidden",
    transform: "translate3d(0, 0, 0) scale(1, 1)",
  });
}

function transformBetween(from: MotionRectSnapshot, to: MotionRectSnapshot) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / Math.max(1, from.width);
  const sy = to.height / Math.max(1, from.height);
  return `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
}

function animateClone(
  clone: HTMLElement,
  from: MotionRectSnapshot,
  to: MotionRectSnapshot | undefined,
  timing: KeyframeAnimationOptions,
): Animation {
  if (!to) {
    return clone.animate([
      { transform: "translate3d(0, 0, 0) scale(1, 1)", opacity: 1 },
      { transform: "translate3d(0, 0, 0) scale(0.98, 0.98)", opacity: 0 },
    ], timing);
  }

  return clone.animate([
    { transform: "translate3d(0, 0, 0) scale(1, 1)", opacity: 1 },
    { transform: transformBetween(from, to), opacity: 1 },
  ], timing);
}

function waitForAnimations(animations: Animation[]) {
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
}

export function playEnterMorph(
  sourceRoot: HTMLElement,
  targetRoot: HTMLElement,
  options: EnterMorphOptions = {},
): EnterMorphHandle {
  const duration = options.duration ?? DEFAULT_DURATION;
  const easing = options.easing ?? DEFAULT_EASING;
  const reducedMotion = options.reducedMotion
    ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ?? false;

  let cancelled = false;
  let layer: HTMLElement | null = null;
  const animations: Animation[] = [];

  const cleanup = () => {
    animations.forEach((animation) => animation.cancel());
    layer?.remove();
    layer = null;
  };

  const finished = (async () => {
    if (reducedMotion) {
      options.onStart?.();
      options.onComplete?.();
      return;
    }

    options.onStart?.();
    const source = collectMotionSnapshot(sourceRoot);
    const target = collectMotionSnapshot(targetRoot);
    const pairs = pairMotionRoles(source, target);
    layer = createMorphLayer(sourceRoot.ownerDocument);

    const timing: KeyframeAnimationOptions = {
      duration,
      easing,
      fill: "forwards",
    };

    for (const pair of pairs) {
      if (!pair.source) continue;
      const clone = cloneElementForRole(sourceRoot, pair.sourceRole);
      if (!clone) continue;
      clone.dataset.morphSourceRole = pair.sourceRole;
      clone.dataset.morphTargetRole = pair.targetRole;
      placeClone(clone, pair.source.rect);
      layer.appendChild(clone);
      animations.push(animateClone(clone, pair.source.rect, pair.target?.rect, timing));
    }

    options.signal?.addEventListener("abort", () => {
      cancelled = true;
      cleanup();
    }, { once: true });

    await waitForAnimations(animations);
    if (cancelled) return;
    cleanup();
    options.onComplete?.();
  })().catch((error) => {
    cleanup();
    throw error;
  });

  return {
    finished,
    cancel: () => {
      cancelled = true;
      cleanup();
    },
  };
}
