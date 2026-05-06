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
