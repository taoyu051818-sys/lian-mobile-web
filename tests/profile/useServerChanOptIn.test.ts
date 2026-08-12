import { computed, ref } from "vue";
import { beforeEach, describe, expect, it } from "vitest";

import type { ServerChanPreferences } from "../../src/api/serverchan";
import {
  resetServerChanOptInSessionState,
  useServerChanOptIn,
  __resetServerChanOptInDismissedForTesting,
} from "../../src/features/profile/useServerChanOptIn";
import type { UseServerChanBinding } from "../../src/features/profile/useServerChanBinding";
import type { UseServerChanPreferences } from "../../src/features/profile/useServerChanPreferences";

const ALL_OFF: ServerChanPreferences = {
  eventStartingReminder: false,
  rewardSettledReminder: false,
};

function makeBinding(): UseServerChanBinding {
  const binding = ref({ bound: true, enabled: true });
  return {
    binding,
    isBound: computed(() => binding.value.bound),
    isEnabled: computed(() => binding.value.enabled),
  } as unknown as UseServerChanBinding;
}

function makePreferences(toggle: UseServerChanPreferences["toggle"]): UseServerChanPreferences {
  return {
    preferences: ref<ServerChanPreferences | null>({ ...ALL_OFF }),
    toggle,
  } as unknown as UseServerChanPreferences;
}

describe("useServerChanOptIn session lifecycle", () => {
  beforeEach(() => {
    __resetServerChanOptInDismissedForTesting();
  });

  it("session reset closes the dialog and clears in-session dismissals", () => {
    const optIn = useServerChanOptIn({
      binding: makeBinding(),
      preferences: makePreferences(async () => true),
    });

    optIn.openEventStartDialog();
    expect(optIn.state.value.open).toBe(true);
    optIn.dismiss();
    expect(optIn.shouldOfferEventStart()).toBe(false);

    resetServerChanOptInSessionState();

    expect(optIn.state.value).toEqual({ open: false, kind: null, busy: false, orderId: "" });
    expect(optIn.shouldOfferEventStart()).toBe(true);
  });

  it("ignores completion of an opt-in started before the session reset", async () => {
    let resolveToggle: ((value: boolean) => void) | null = null;
    const preferences = makePreferences(
      () =>
        new Promise<boolean>((resolve) => {
          resolveToggle = resolve;
        }),
    );
    const optIn = useServerChanOptIn({ binding: makeBinding(), preferences });
    optIn.openEventStartDialog();

    const confirmation = optIn.confirmOptIn();
    expect(optIn.state.value.busy).toBe(true);
    resetServerChanOptInSessionState();
    optIn.openEventStartDialog();
    expect(optIn.state.value).toEqual({
      open: true,
      kind: "event-start",
      busy: false,
      orderId: "",
    });
    resolveToggle?.(true);

    await expect(confirmation).resolves.toBe(false);
    expect(optIn.state.value).toEqual({
      open: true,
      kind: "event-start",
      busy: false,
      orderId: "",
    });
    expect(optIn.shouldOfferEventStart()).toBe(true);
  });
});
