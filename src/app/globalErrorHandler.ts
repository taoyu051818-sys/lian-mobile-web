/**
 * Global error handling setup for the Vue application.
 *
 * This module configures:
 * 1. Vue's app.config.errorHandler for component errors
 * 2. Window-level unhandledrejection for uncaught Promise rejections
 * 3. Window-level error for uncaught synchronous errors
 *
 * All errors are logged in development and can be reported to a monitoring
 * service in production. The goal is to prevent silent failures and provide
 * visibility into runtime errors.
 */

import type { App, ComponentPublicInstance } from "vue";
import { pushToast } from "../ui/feedback/toast-state";
import { ERROR_LOAD_GENERIC } from "../config/brand";

interface ErrorContext {
  component?: string;
  info?: string;
  url?: string;
  line?: number;
  column?: number;
}

/**
 * Format error for logging with relevant context.
 */
function formatErrorLog(error: unknown, context: ErrorContext): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const parts = [`[GlobalError] ${errorMessage}`];

  if (context.component) parts.push(`Component: ${context.component}`);
  if (context.info) parts.push(`Info: ${context.info}`);
  if (context.url) parts.push(`URL: ${context.url}`);
  if (context.line !== undefined) parts.push(`Line: ${context.line}`);

  return parts.join(" | ");
}

/**
 * Determine if an error should show a user-facing toast.
 *
 * Some errors (like chunk loading failures) are already handled by
 * ViewAsyncError, so we don't need to double-notify the user.
 */
function shouldShowToast(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Chunk loading errors are handled by defineAsyncComponent's errorComponent
  if (error.message.includes("Loading chunk") || error.message.includes("Failed to fetch")) {
    return false;
  }

  // Network errors during API calls are typically handled by the calling code
  if (error.name === "LianApiError") {
    return false;
  }

  return true;
}

/**
 * Vue error handler for component errors.
 *
 * Called when an error is thrown during:
 * - Component render
 * - Lifecycle hooks
 * - Watchers
 * - Event handlers (if not caught)
 */
function vueErrorHandler(
  error: unknown,
  instance: ComponentPublicInstance | null,
  info: string,
): void {
  const componentName = instance?.$options?.name || instance?.$options?.__name || "Unknown";

  const context: ErrorContext = {
    component: componentName,
    info,
  };

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- surface unhandled component errors to dev console for triage
    console.error(formatErrorLog(error, context));
    if (error instanceof Error && error.stack) {
      // eslint-disable-next-line no-console -- preserve stack trace alongside the formatted log line
      console.error(error.stack);
    }
  }

  // Show toast for unexpected errors that aren't already handled
  if (shouldShowToast(error)) {
    pushToast(ERROR_LOAD_GENERIC, { tone: "error" });
  }
}

/**
 * Handler for uncaught Promise rejections.
 */
function unhandledRejectionHandler(event: PromiseRejectionEvent): void {
  const error = event.reason;

  const context: ErrorContext = {
    info: "Unhandled Promise rejection",
  };

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- surface unhandled rejections to dev console for triage
    console.error(formatErrorLog(error, context));
    if (error instanceof Error && error.stack) {
      // eslint-disable-next-line no-console -- preserve stack trace alongside the formatted log line
      console.error(error.stack);
    }
  }

  // Prevent the default browser handling (console error)
  // since we're handling it ourselves
  event.preventDefault();

  if (shouldShowToast(error)) {
    pushToast(ERROR_LOAD_GENERIC, { tone: "error" });
  }
}

/**
 * Handler for uncaught synchronous errors.
 */
function windowErrorHandler(event: ErrorEvent): void {
  const context: ErrorContext = {
    info: "Uncaught error",
    url: event.filename,
    line: event.lineno,
    column: event.colno,
  };

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- surface uncaught window errors to dev console for triage
    console.error(formatErrorLog(event.error || event.message, context));
  }

  // Don't prevent default - let the browser also log it
  // This ensures errors are visible in the console

  if (shouldShowToast(event.error)) {
    pushToast(ERROR_LOAD_GENERIC, { tone: "error" });
  }
}

/**
 * Install global error handlers on the Vue app and window.
 *
 * Call this once during app initialization:
 * ```ts
 * const app = createVueApp(App);
 * installGlobalErrorHandler(app);
 * app.mount('#app');
 * ```
 */
export function installGlobalErrorHandler(app: App): void {
  // Vue component error handler
  app.config.errorHandler = vueErrorHandler;

  // Only install window handlers in browser environment
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", unhandledRejectionHandler);
    window.addEventListener("error", windowErrorHandler);
  }
}

/**
 * Remove global error handlers.
 *
 * Useful for testing or when unmounting the app.
 */
export function removeGlobalErrorHandler(app: App): void {
  app.config.errorHandler = undefined;

  if (typeof window !== "undefined") {
    window.removeEventListener("unhandledrejection", unhandledRejectionHandler);
    window.removeEventListener("error", windowErrorHandler);
  }
}
