/**
 * Generic async operation composable.
 *
 * Extracts the common pattern found across many composables:
 * - busy/loading ref to track in-flight state
 * - errorMessage ref to surface failures
 * - try-catch-finally with extractErrorMessage
 * - guard clause to prevent concurrent execution
 *
 * Usage:
 * ```ts
 * const { busy, errorMessage, run } = useAsyncOperation();
 *
 * async function doSomething() {
 *   await run(
 *     () => apiCall(),
 *     'Something went wrong',
 *     (result) => { ... }
 *   );
 * }
 * ```
 */

import { ref, type Ref } from "vue";
import { extractErrorMessage } from "../utils/extractErrorMessage";

export interface AsyncOperationState {
  /** True while the operation is in flight. */
  busy: Ref<boolean>;
  /** Error message from the last failed operation, empty string if none. */
  errorMessage: Ref<string>;
}

export interface AsyncOperationResult<T> extends AsyncOperationState {
  /**
   * Execute an async operation with automatic busy/error state management.
   *
   * @param operation - The async function to execute
   * @param fallbackError - Fallback error message if the error has no message
   * @param onSuccess - Optional callback invoked with the result on success
   * @returns The result of the operation, or undefined if it failed or was skipped
   */
  run: <R = T>(
    operation: () => Promise<R>,
    fallbackError: string,
    onSuccess?: (result: R) => void | Promise<void>,
  ) => Promise<R | undefined>;

  /** Clear the error message. */
  clearError: () => void;

  /** Reset both busy and error state. */
  reset: () => void;
}

/**
 * Creates a reusable async operation handler with busy/error state management.
 *
 * The returned `run` function:
 * - Guards against concurrent execution (returns early if already busy)
 * - Sets busy=true before the operation, busy=false after
 * - Clears errorMessage before the operation
 * - On catch, sets errorMessage using extractErrorMessage
 * - On success, optionally invokes the onSuccess callback
 *
 * @example
 * ```ts
 * const { busy, errorMessage, run } = useAsyncOperation();
 *
 * async function submitForm() {
 *   const result = await run(
 *     () => submitApi(formData),
 *     'Failed to submit form',
 *     (response) => {
 *       showToast('Submitted successfully');
 *       navigateTo(response.id);
 *     }
 *   );
 *   // result is undefined if the operation failed or was skipped
 * }
 * ```
 */
export function useAsyncOperation<T = unknown>(): AsyncOperationResult<T> {
  const busy = ref(false);
  const errorMessage = ref("");

  async function run<R = T>(
    operation: () => Promise<R>,
    fallbackError: string,
    onSuccess?: (result: R) => void | Promise<void>,
  ): Promise<R | undefined> {
    if (busy.value) return undefined;

    busy.value = true;
    errorMessage.value = "";

    try {
      const result = await operation();
      if (onSuccess) {
        await onSuccess(result);
      }
      return result;
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, fallbackError);
      return undefined;
    } finally {
      busy.value = false;
    }
  }

  function clearError() {
    errorMessage.value = "";
  }

  function reset() {
    busy.value = false;
    errorMessage.value = "";
  }

  return {
    busy,
    errorMessage,
    run,
    clearError,
    reset,
  };
}

/**
 * Creates multiple named async operation handlers.
 *
 * Useful when a composable needs to track multiple independent operations
 * (e.g., save vs delete, like vs bookmark).
 *
 * @example
 * ```ts
 * const ops = useAsyncOperations(['save', 'delete'] as const);
 *
 * // Each operation has its own busy/error state
 * ops.save.busy.value  // false
 * ops.delete.busy.value // false
 *
 * await ops.save.run(() => saveApi(), 'Save failed');
 * await ops.delete.run(() => deleteApi(), 'Delete failed');
 * ```
 */
export function useAsyncOperations<K extends string>(
  keys: readonly K[],
): Record<K, AsyncOperationResult<unknown>> {
  const result = {} as Record<K, AsyncOperationResult<unknown>>;
  for (const key of keys) {
    result[key] = useAsyncOperation();
  }
  return result;
}
