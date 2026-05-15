/**
 * Centralized localStorage key surface for the Vue canary app.
 *
 * Every key written by Vue source code is declared here so that
 * key collisions and naming drift are visible in one module.
 * Legacy public/ scripts maintain their own copies; this module
 * is the single authority for the Vue surface.
 */

export { CLIENT_ID_KEY, ensureClientId } from "./clientIdentity";

export const READ_HISTORY_KEY = "lian.readHistory";
export const HOME_UPDATE_PROBE_PREFIX = "lian.homeUpdateProbe";
