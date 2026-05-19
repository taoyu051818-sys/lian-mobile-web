/**
 * Side-effect helper that bridges the settings reducer's `fetch` and `patch`
 * effects to the network. The reducer is pure; it never holds a Promise. When
 * it emits an effect with a token, this resolves it to a `*-result` action and
 * dispatches it back. Stale results (token mismatch) are dropped inside the
 * reducer, not here — keeping the staleness check in one place.
 */

import { fetchProfileSettings, patchProfileSettings } from "../../../api/profile";
import type { ProfileSettingsPatch } from "../../../types/profile";
import type { SettingsAction } from "./state";

export type SettingsDispatch = (action: SettingsAction) => void;

export async function fetchSettingsWithToken(
  token: number,
  dispatch: SettingsDispatch,
): Promise<void> {
  try {
    const settings = await fetchProfileSettings();
    dispatch({ type: "load-result", token, result: { ok: settings } });
  } catch (err) {
    dispatch({ type: "load-result", token, result: { err } });
  }
}

export async function patchSettingsWithToken(
  token: number,
  patch: ProfileSettingsPatch,
  dispatch: SettingsDispatch,
): Promise<void> {
  try {
    const settings = await patchProfileSettings(patch);
    dispatch({ type: "patch-result", token, result: { ok: settings } });
  } catch (err) {
    dispatch({ type: "patch-result", token, result: { err } });
  }
}
