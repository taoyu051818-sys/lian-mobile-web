/**
 * Side-effect helper that bridges the reducer's `fetch` effect to the network.
 *
 * The reducer is pure; it never holds a Promise. When it emits a fetch effect
 * with a tid + token, this function resolves that to a `fetch-result` action
 * and dispatches it back. Stale results (token mismatch) are dropped inside
 * the reducer, not here — keeping the staleness check in one place.
 */

import { fetchPostDetail } from "../../api/posts";
import type { DetailAction } from "./state";

export type DetailDispatch = (action: DetailAction) => void;

export async function fetchDetailWithToken(
  tid: number,
  token: number,
  dispatch: DetailDispatch,
): Promise<void> {
  try {
    const post = await fetchPostDetail(tid);
    dispatch({ type: "fetch-result", token, result: { ok: post } });
  } catch (err) {
    dispatch({ type: "fetch-result", token, result: { err } });
  }
}
