const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const GLOBAL_ALLOWED_ATTRIBUTES = new Set(["class"]);
const TAG_ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "loading", "width", "height"]),
};

function isSafeUrl(value: string) {
  const trimmed = value.trim().replace(/&amp;/g, "&");
  if (!trimmed) return false;
  if (trimmed.startsWith("#") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) return true;

  try {
    const url = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "https://lian.invalid");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function shouldKeepAttribute(tagName: string, attribute: Attr) {
  const name = attribute.name.toLowerCase();
  const value = attribute.value || "";
  const allowedForTag = TAG_ALLOWED_ATTRIBUTES[tagName];

  if (name.startsWith("on")) return false;
  if (name === "style") return false;
  if (GLOBAL_ALLOWED_ATTRIBUTES.has(name)) return true;
  if (!allowedForTag?.has(name)) return false;
  if ((name === "href" || name === "src") && !isSafeUrl(value)) return false;
  if (name === "target" && !["_blank", "_self"].includes(value)) return false;
  if (name === "loading" && !["lazy", "eager"].includes(value)) return false;
  if ((name === "width" || name === "height") && !/^\d{1,4}$/.test(value)) return false;
  return true;
}

function sanitizeElement(element: Element) {
  const tagName = element.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    if (!shouldKeepAttribute(tagName, attribute)) {
      element.removeAttribute(attribute.name);
    }
  }

  if (tagName === "a") {
    element.setAttribute("rel", "nofollow noopener noreferrer");
    if (element.getAttribute("target") === "_blank") return;
    element.removeAttribute("target");
  }
}

export function sanitizeHtml(value: string) {
  const raw = String(value || "");
  if (!raw) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return raw
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(?:href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(raw, "text/html");
  document.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    sanitizeElement(element);
  }

  return document.body.innerHTML.trim();
}

export function stripHtml(value: string) {
  const raw = String(value || "");
  if (!raw) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(raw, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() || "";
}
