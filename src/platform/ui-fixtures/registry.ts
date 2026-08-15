/**
 * Route registry for the offline fixture runtime.
 *
 * Handlers register themselves here (inversion of control) so this module never
 * imports fixture data. That keeps `src/platform/**` free of feature imports
 * and lets the registry stay a pure lookup table.
 */

import type { FixtureHandler, FixtureRoute } from "./types";

const routes: FixtureRoute[] = [];

export interface RegisterOptions {
  family: string;
}

/** Registers one endpoint. Later registrations win on exact duplicates. */
export function registerFixtureRoute(
  method: string,
  pattern: string,
  handler: FixtureHandler,
  options: RegisterOptions,
): void {
  const normalizedMethod = method.trim().toUpperCase();
  const normalizedPattern = normalizePattern(pattern);
  const existingIndex = routes.findIndex(
    (route) => route.method === normalizedMethod && route.pattern === normalizedPattern,
  );
  const entry: FixtureRoute = {
    method: normalizedMethod,
    pattern: normalizedPattern,
    handler,
    family: options.family,
  };
  if (existingIndex >= 0) {
    routes[existingIndex] = entry;
    return;
  }
  routes.push(entry);
}

/** Convenience wrapper for registering many routes in one family. */
export function registerFixtureFamily(
  family: string,
  definitions: ReadonlyArray<readonly [method: string, pattern: string, handler: FixtureHandler]>,
): void {
  for (const [method, pattern, handler] of definitions) {
    registerFixtureRoute(method, pattern, handler, { family });
  }
}

function normalizePattern(pattern: string): string {
  const trimmed = pattern.trim();
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  if (!withoutQuery.startsWith("/")) return `/${withoutQuery}`;
  return withoutQuery.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
}

export interface RouteMatch {
  route: FixtureRoute;
  params: Record<string, string>;
}

/**
 * Matches a concrete pathname to a registered route. Static segments are
 * preferred over `:param` segments so `/api/errands/orders/available` never
 * gets swallowed by `/api/errands/orders/:orderId`.
 */
export function matchFixtureRoute(method: string, pathname: string): RouteMatch | null {
  const normalizedMethod = method.trim().toUpperCase();
  const target = normalizePattern(pathname);
  const targetSegments = target.split("/").filter(Boolean);

  let best: { match: RouteMatch; staticScore: number } | null = null;

  for (const route of routes) {
    if (route.method !== normalizedMethod) continue;
    const patternSegments = route.pattern.split("/").filter(Boolean);
    if (patternSegments.length !== targetSegments.length) continue;

    const params: Record<string, string> = {};
    let staticScore = 0;
    let matched = true;

    for (let index = 0; index < patternSegments.length; index += 1) {
      const patternSegment = patternSegments[index] as string;
      const targetSegment = targetSegments[index] as string;
      if (patternSegment.startsWith(":")) {
        params[patternSegment.slice(1)] = decodeURIComponent(targetSegment);
        continue;
      }
      if (patternSegment !== targetSegment) {
        matched = false;
        break;
      }
      staticScore += 1;
    }

    if (!matched) continue;
    if (!best || staticScore > best.staticScore) {
      best = { match: { route, params }, staticScore };
    }
  }

  return best ? best.match : null;
}

export function getRegisteredFixtureRoutes(): ReadonlyArray<Omit<FixtureRoute, "handler">> {
  return routes.map(({ method, pattern, family }) => ({ method, pattern, family }));
}

export function getRegisteredFixtureFamilies(): string[] {
  return [...new Set(routes.map((route) => route.family))].sort();
}

export function clearFixtureRoutes(): void {
  routes.length = 0;
}
