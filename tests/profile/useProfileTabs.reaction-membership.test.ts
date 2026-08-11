import { effectScope, ref, toRaw, watch, type EffectScope, type Ref } from "vue";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProfileListItem,
  ProfileListResponse,
  ProfileTabKey,
  ProfileUser,
} from "../../src/types/profile";

vi.mock("../../src/api/profile", () => ({
  fetchProfileTab: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  accountReadHistoryScope: vi.fn((userId: string) => {
    const normalized = typeof userId === "string" ? userId.trim() : "";
    return normalized ? { kind: "account", userId: normalized } : null;
  }),
  getRecentReadHistoryIds: vi.fn(() => []),
}));

import * as profileApi from "../../src/api/profile";
import { useProfileTabs } from "../../src/features/profile/useProfileTabs";
import {
  createPostReactionSettlementChannel,
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../src/features/reactions";

type ProfileTabs = ReturnType<typeof useProfileTabs> & { dispose?: () => void };
type ProfileTabsOptions = Parameters<typeof useProfileTabs>[0] & {
  settlements?: PostReactionSettlementPort;
};

const useProfileTabsWithSettlements = useProfileTabs as unknown as (
  options: ProfileTabsOptions,
) => ProfileTabs;
const fetchProfileTabMock = vi.mocked(profileApi.fetchProfileTab);
const MISSING_SESSION = new Error("missing session");

interface Harness {
  profile: ProfileTabs;
  user: Ref<ProfileUser | null>;
  port: PostReactionSettlementPort;
  scope: EffectScope;
  enterGuestState: ReturnType<typeof vi.fn>;
  resetAccountPresentation: ReturnType<typeof vi.fn>;
  refreshCurrentSession: ReturnType<typeof vi.fn<() => Promise<ProfileUser | null>>>;
}

const activeHarnesses: Harness[] = [];
const activeUnsubscribers: Array<() => void> = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function item(
  tid: number | undefined,
  title: string,
  overrides: Partial<ProfileListItem> = {},
): ProfileListItem {
  const components = [
    { type: "text", text: `component-${title}` },
  ] as ProfileListItem["components"];
  return {
    ...(tid === undefined ? {} : { tid }),
    id: tid === undefined ? `row-${title}` : String(tid),
    title,
    cover: `cover-${title}`,
    timeLabel: `time-${title}`,
    components,
    ...overrides,
  };
}

function response(items: ProfileListItem[]): ProfileListResponse {
  return { items };
}

function makeHarness(
  options: {
    initialUser?: ProfileUser | null;
    user?: Ref<ProfileUser | null>;
    settlements?: PostReactionSettlementPort;
    defaultSettlements?: boolean;
    isMissingSessionError?: (error: unknown) => boolean;
    refreshCurrentSession?: () => Promise<ProfileUser | null>;
  } = {},
): Harness {
  const initialUser = Object.prototype.hasOwnProperty.call(options, "initialUser")
    ? (options.initialUser ?? null)
    : { id: "user-a" };
  const user = options.user ?? ref<ProfileUser | null>(initialUser);
  const port =
    options.settlements ??
    (options.defaultSettlements ? postReactionSettlements : createPostReactionSettlementChannel());
  const enterGuestState = vi.fn();
  const resetAccountPresentation = vi.fn();
  const refreshCurrentSession = vi.fn(
    options.refreshCurrentSession ?? (async () => options.user?.value ?? user.value),
  );
  const scope = effectScope();
  let profile!: ProfileTabs;
  scope.run(() => {
    profile = useProfileTabsWithSettlements({
      user,
      enterGuestState,
      isMissingSessionError:
        options.isMissingSessionError ?? ((error: unknown) => error === MISSING_SESSION),
      refreshCurrentSession,
      resetAccountPresentation,
      ...(options.defaultSettlements ? {} : { settlements: port }),
    });
  });
  const harness = {
    profile,
    user,
    port,
    scope,
    enterGuestState,
    resetAccountPresentation,
    refreshCurrentSession,
  };
  activeHarnesses.push(harness);
  return harness;
}

async function loadRows(
  harness: Harness,
  tab: ProfileTabKey,
  rows: ProfileListItem[],
): Promise<void> {
  fetchProfileTabMock.mockResolvedValueOnce(response(rows));
  await harness.profile.loadProfileList(tab);
}

function publishMembership(
  port: PostReactionSettlementPort,
  tab: "liked" | "saved",
  tid: number,
  present: boolean,
) {
  return tab === "liked"
    ? port.publish({ kind: "like", tid, liked: present, likeCount: present ? 9 : 8 })
    : port.publish({ kind: "save", tid, bookmarked: present });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function trackedPort(
  base: PostReactionSettlementPort,
  options: {
    onCurrentSequence?: () => void;
    throwAfterUnsubscribe?: boolean;
    retainListener?: boolean;
  } = {},
) {
  let active = 0;
  let retainedListener: ((event: PostReactionSettlement) => void) | undefined;
  const port: PostReactionSettlementPort = {
    publish(input) {
      return base.publish(input);
    },
    currentSequence() {
      options.onCurrentSequence?.();
      return base.currentSequence();
    },
    subscribe(listener) {
      if (options.retainListener) retainedListener = listener;
      const unsubscribeBase = base.subscribe(listener);
      active += 1;
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        active -= 1;
        unsubscribeBase();
        if (options.throwAfterUnsubscribe) throw new Error("unsubscribe failed after delegation");
      };
    },
  };
  return {
    port,
    active: () => active,
    retainedListener: () => retainedListener,
  };
}

beforeAll(() => {
  vi.stubGlobal("localStorage", {} as Storage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchProfileTabMock.mockReset();
});

afterEach(() => {
  for (const unsubscribe of activeUnsubscribers.splice(0)) unsubscribe();
  for (const harness of activeHarnesses.splice(0)) {
    harness.scope.stop();
    harness.profile.dispose?.();
  }
});

describe("mounted Profile reaction membership", () => {
  it("#1 removes every liked duplicate and restores only the first known row once", async () => {
    const harness = makeHarness();
    const rows = [item(1, "A"), item(2, "B-first"), item(2, "B-second"), item(3, "C")];
    await loadRows(harness, "liked", rows);
    const [observedA, observedFirstB, , observedC] = harness.profile.profileItems.value;
    const apiCalls = fetchProfileTabMock.mock.calls.length;

    publishMembership(harness.port, "liked", 2, false);

    expect(fetchProfileTabMock).toHaveBeenCalledTimes(apiCalls);
    expect(harness.profile.profileItems.value).toEqual([observedA, observedC]);
    expect(harness.profile.profileItems.value[0]).toBe(observedA);
    expect(harness.profile.profileItems.value[1]).toBe(observedC);

    publishMembership(harness.port, "liked", 2, true);
    const restoredArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "liked", 2, true);

    expect(harness.profile.profileItems.value).toBe(restoredArray);
    expect(harness.profile.profileItems.value).toEqual([observedA, observedFirstB, observedC]);
    expect(harness.profile.profileItems.value[1]).toBe(observedFirstB);
    expect(harness.profile.profileItems.value.filter((row) => row.tid === 2)).toHaveLength(1);
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(apiCalls);
  });

  it("#2 applies saved membership symmetrically and isolates the sibling kind", async () => {
    const harness = makeHarness();
    await loadRows(harness, "saved", [item(1, "saved-A"), item(2, "saved-B")]);
    const arrayBeforeLike = harness.profile.profileItems.value;
    const savedB = arrayBeforeLike[1];

    publishMembership(harness.port, "liked", 2, false);
    expect(harness.profile.profileItems.value).toBe(arrayBeforeLike);

    publishMembership(harness.port, "saved", 2, false);
    expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1]);

    publishMembership(harness.port, "liked", 2, true);
    expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1]);

    publishMembership(harness.port, "saved", 2, true);
    expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1, 2]);
    expect(harness.profile.profileItems.value[1]).toBe(savedB);

    await loadRows(harness, "liked", [item(3, "liked-C")]);
    const likedArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "saved", 3, false);
    expect(harness.profile.profileItems.value).toBe(likedArray);
  });

  it("#3 never fabricates an unknown row", async () => {
    const base = createPostReactionSettlementChannel();
    const tracked = trackedPort(base, { retainListener: true });
    const harness = makeHarness({ settlements: tracked.port });
    await loadRows(harness, "liked", [item(1, "known")]);
    const committedArray = harness.profile.profileItems.value;
    const callsBefore = fetchProfileTabMock.mock.calls.length;

    publishMembership(base, "liked", 999, true);
    expect(harness.profile.profileItems.value).toBe(committedArray);
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(callsBefore);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ] as const)(
    "#3 rejects a matching malformed %s tid in committed and request branches",
    async (_label, invalidTid) => {
      const base = createPostReactionSettlementChannel();
      const tracked = trackedPort(base, { retainListener: true });
      const harness = makeHarness({ settlements: tracked.port });
      const invalidRow = item(invalidTid, `invalid-${String(invalidTid)}`);
      const validRow = item(1, "valid-control");
      await loadRows(harness, "liked", [invalidRow, validRow]);
      const committedArray = harness.profile.profileItems.value;
      const invalidProxy = harness.profile.profileItems.value[0];
      const listener = tracked.retainedListener();
      expect(typeof listener).toBe("function");

      listener?.({
        sequence: base.currentSequence() + 100,
        kind: "like",
        tid: invalidTid,
        liked: false,
        likeCount: 0,
      });

      expect(harness.profile.profileItems.value).toBe(committedArray);
      expect(harness.profile.profileItems.value).toHaveLength(2);
      expect(harness.profile.profileItems.value[0]).toBe(invalidProxy);
      publishMembership(base, "liked", 1, false);
      expect(harness.profile.profileItems.value).toEqual([invalidProxy]);

      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      const load = harness.profile.loadProfileList("liked");
      listener?.({
        sequence: base.currentSequence() + 200,
        kind: "like",
        tid: invalidTid,
        liked: false,
        likeCount: 0,
      });
      const pendingInvalidRow = item(invalidTid, `pending-invalid-${String(invalidTid)}`);
      const pendingRows = [pendingInvalidRow];
      pending.resolve(response(pendingRows));
      await load;

      expect(toRaw(harness.profile.profileItems.value)).toBe(pendingRows);
      expect(harness.profile.profileItems.value).toHaveLength(1);
      expect(toRaw(harness.profile.profileItems.value[0])).toBe(pendingInvalidRow);
    },
  );

  it("#3 does not cache an unknown positive for a later request or instance", async () => {
    const port = createPostReactionSettlementChannel();
    const first = makeHarness({ settlements: port });
    await loadRows(first, "liked", []);
    publishMembership(port, "liked", 88, true);

    const firstResponse: ProfileListItem[] = [];
    await loadRows(first, "liked", firstResponse);
    expect(first.profile.profileItems.value).toEqual([]);

    const second = makeHarness({ settlements: port });
    const secondResponse: ProfileListItem[] = [];
    await loadRows(second, "liked", secondResponse);
    expect(second.profile.profileItems.value).toEqual([]);
  });

  it("#4 uses per-tid floors for nested committed-list delivery", async () => {
    const port = createPostReactionSettlementChannel();
    let nestedCrossTid = false;
    let nestedIrrelevantKind = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && event.tid === 1 && !nestedCrossTid) {
          nestedCrossTid = true;
          publishMembership(port, "liked", 2, false);
        }
        if (event.kind === "like" && event.tid === 3 && !nestedIrrelevantKind) {
          nestedIrrelevantKind = true;
          publishMembership(port, "saved", 3, false);
        }
      }),
    );
    const harness = makeHarness({ settlements: port });
    await loadRows(harness, "liked", [item(1, "A"), item(2, "B"), item(3, "C")]);

    publishMembership(port, "liked", 1, false);
    publishMembership(port, "liked", 3, false);

    expect(nestedCrossTid).toBe(true);
    expect(nestedIrrelevantKind).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#4 lets a newer nested inverse win for the same committed tid", async () => {
    const port = createPostReactionSettlementChannel();
    let nested = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && event.tid === 1 && !nested) {
          nested = true;
          publishMembership(port, "liked", 1, true);
        }
      }),
    );
    const harness = makeHarness({ settlements: port });
    await loadRows(harness, "liked", [item(1, "A")]);
    const row = harness.profile.profileItems.value[0];

    publishMembership(port, "liked", 1, false);

    expect(nested).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([row]);
    expect(harness.profile.profileItems.value[0]).toBe(row);
  });

  it("#4 uses per-tid floors for nested delivery during the initial physical request", async () => {
    const port = createPostReactionSettlementChannel();
    let nestedCrossTid = false;
    let nestedIrrelevantKind = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && event.tid === 1 && !nestedCrossTid) {
          nestedCrossTid = true;
          publishMembership(port, "liked", 2, false);
        }
        if (event.kind === "like" && event.tid === 3 && !nestedIrrelevantKind) {
          nestedIrrelevantKind = true;
          publishMembership(port, "saved", 3, false);
        }
      }),
    );
    const harness = makeHarness({ settlements: port });
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);

    publishMembership(port, "liked", 1, false);
    publishMembership(port, "liked", 3, false);
    pending.resolve(response([item(1, "A"), item(2, "B"), item(3, "C")]));
    await load;

    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#4 keeps a row when a newer nested inverse wins during an initial request", async () => {
    const port = createPostReactionSettlementChannel();
    let nested = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && event.tid === 1 && !nested) {
          nested = true;
          publishMembership(port, "liked", 1, true);
        }
      }),
    );
    const harness = makeHarness({ settlements: port });
    const pending = deferred<ProfileListResponse>();
    const transportRow = item(1, "A");
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");

    publishMembership(port, "liked", 1, false);
    pending.resolve(response([transportRow]));
    await load;

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(transportRow);
  });

  it.each(["saved", "history"] as const)(
    "#5 retires liked ownership before a retained callback enters the %s tab",
    async (nextTab) => {
      const port = createPostReactionSettlementChannel();
      const nextRequest = deferred<ProfileListResponse>();
      let switched = false;
      let nextLoad: Promise<void> | undefined;
      activeUnsubscribers.push(
        port.subscribe((event) => {
          if (event.kind === "like" && event.tid === 1 && !switched) {
            switched = true;
            nextLoad = harness.profile.loadProfileList(nextTab);
          }
        }),
      );
      const harness = makeHarness({ settlements: port });
      await loadRows(harness, "liked", [item(1, "liked-A")]);
      const oldCommittedArray = harness.profile.profileItems.value;
      const oldCommittedRow = oldCommittedArray[0];
      fetchProfileTabMock.mockReturnValueOnce(nextRequest.promise);

      publishMembership(port, "liked", 1, false);

      expect(switched).toBe(true);
      expect(harness.profile.activeTab.value).toBe(nextTab);
      expect(fetchProfileTabMock).toHaveBeenCalledTimes(2);
      expect(harness.profile.profileItems.value).toBe(oldCommittedArray);
      expect(harness.profile.profileItems.value[0]).toBe(oldCommittedRow);
      const nextRow = item(2, `${nextTab}-B`);
      nextRequest.resolve(response([nextRow]));
      await nextLoad;
      publishMembership(port, "liked", 1, true);

      expect(harness.profile.profileItems.value).toHaveLength(1);
      expect(toRaw(harness.profile.profileItems.value[0])).toBe(nextRow);

      await loadRows(harness, "liked", []);
      const emptyLikedOwner = harness.profile.profileItems.value;
      publishMembership(port, "liked", 1, true);
      expect(harness.profile.profileItems.value).toBe(emptyLikedOwner);
    },
  );

  it("#5 clears candidates on reset and orders admission without a profile API call", async () => {
    const harness = makeHarness();
    await loadRows(harness, "liked", [item(1, "A")]);
    publishMembership(harness.port, "liked", 1, false);
    expect(harness.profile.profileItems.value).toEqual([]);

    harness.profile.resetList();
    publishMembership(harness.port, "liked", 1, true);
    expect(harness.profile.profileItems.value).toEqual([]);

    await loadRows(harness, "liked", [item(1, "new-A")]);
    publishMembership(harness.port, "liked", 1, false);
    const callsBeforeOrders = fetchProfileTabMock.mock.calls.length;
    await harness.profile.loadProfileList("orders");
    publishMembership(harness.port, "liked", 1, true);

    expect(fetchProfileTabMock).toHaveBeenCalledTimes(callsBeforeOrders);
    expect(harness.profile.activeTab.value).toBe("orders");
    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listLoading.value).toBe(false);
  });

  it.each(["resetList", "orders"] as const)(
    "#5 preserves a nested saved request admitted from the %s visible reset",
    async (boundary) => {
      const harness = makeHarness();
      await loadRows(harness, "liked", [item(1, `before-${boundary}`)]);
      const pendingSaved = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pendingSaved.promise);
      let nestedLoad: Promise<void> | undefined;
      const stop = watch(
        harness.profile.profileItems,
        (rows) => {
          if (rows.length === 0 && !nestedLoad) {
            nestedLoad = harness.profile.loadProfileList("saved");
          }
        },
        { flush: "sync" },
      );

      if (boundary === "resetList") {
        harness.profile.resetList();
      } else {
        await harness.profile.loadProfileList("orders");
      }

      expect(nestedLoad).toBeDefined();
      expect(fetchProfileTabMock).toHaveBeenCalledTimes(2);
      expect(fetchProfileTabMock).toHaveBeenLastCalledWith("saved", [], {
        contentFilter: "all",
      });
      expect(harness.profile.activeTab.value).toBe("saved");
      expect(harness.profile.listLoading.value).toBe(true);
      expect(harness.profile.profileItems.value).toEqual([]);

      const savedRow = item(2, `saved-after-${boundary}`);
      pendingSaved.resolve(response([savedRow]));
      await nestedLoad;
      stop();

      expect(harness.profile.activeTab.value).toBe("saved");
      expect(harness.profile.listLoading.value).toBe(false);
      expect(harness.profile.profileItems.value).toHaveLength(1);
      expect(toRaw(harness.profile.profileItems.value[0])).toBe(savedRow);
    },
  );

  it("#6 retires A candidates and retained callbacks before installing account B", async () => {
    const port = createPostReactionSettlementChannel();
    const bRequest = deferred<ProfileListResponse>();
    let switched = false;
    let bLoad: Promise<void> | undefined;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && event.tid === 1 && event.liked && !switched) {
          switched = true;
          harness.profile.resetList();
          harness.user.value = { id: "user-b" };
          bLoad = harness.profile.loadProfileList("liked");
        }
      }),
    );
    const harness = makeHarness({ settlements: port, initialUser: { id: "user-a" } });
    await loadRows(harness, "liked", [item(1, "account-A")]);
    publishMembership(port, "liked", 1, false);
    expect(harness.profile.profileItems.value).toEqual([]);
    fetchProfileTabMock.mockReturnValueOnce(bRequest.promise);

    publishMembership(port, "liked", 1, true);

    expect(switched).toBe(true);
    expect(harness.user.value?.id).toBe("user-b");
    expect(harness.profile.profileItems.value).toEqual([]);
    const bRow = item(2, "account-B");
    bRequest.resolve(response([bRow]));
    await bLoad;
    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(bRow);
  });

  it("#6 fences stale A-B-A physical responses with account and generation ownership", async () => {
    const harness = makeHarness({ initialUser: { id: "user-a" } });
    const oldA = deferred<ProfileListResponse>();
    const b = deferred<ProfileListResponse>();
    const newA = deferred<ProfileListResponse>();
    fetchProfileTabMock
      .mockReturnValueOnce(oldA.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(newA.promise);

    const oldALoad = harness.profile.loadProfileList("liked");
    harness.profile.resetList();
    harness.user.value = { id: "user-b" };
    const bLoad = harness.profile.loadProfileList("liked");
    harness.profile.resetList();
    harness.user.value = { id: "user-a" };
    const newALoad = harness.profile.loadProfileList("liked");

    oldA.resolve(response([item(1, "old-A")]));
    b.resolve(response([item(2, "B")]));
    await Promise.all([oldALoad, bLoad]);
    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listLoading.value).toBe(true);

    const currentA = item(3, "new-A");
    newA.resolve(response([currentA]));
    await newALoad;
    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(currentA);
    expect(harness.profile.listLoading.value).toBe(false);
  });

  it.each([
    ["different stable account", { id: "user-b" } as ProfileUser],
    ["guest", null],
  ] as const)(
    "#6 prevents direct %s A-boundary ABA from reviving the committed owner",
    async (_label, boundaryUser) => {
      const harness = makeHarness({ initialUser: { id: "user-a" } });
      await loadRows(harness, "liked", [item(1, "account-A")]);
      const committedArray = harness.profile.profileItems.value;

      harness.user.value = boundaryUser;
      harness.user.value = { id: "user-a", username: "returned A" };
      publishMembership(harness.port, "liked", 1, false);

      expect(harness.profile.profileItems.value).toBe(committedArray);
      expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1]);
    },
  );

  it.each([
    ["different stable account", { id: "user-b" } as ProfileUser],
    ["guest", null],
  ] as const)(
    "#6 retires a pending A request across direct %s A-boundary ABA without reset",
    async (_label, boundaryUser) => {
      const harness = makeHarness({ initialUser: { id: "user-a" } });
      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      const load = harness.profile.loadProfileList("liked");
      expect(harness.profile.listLoading.value).toBe(true);

      harness.user.value = boundaryUser;
      harness.user.value = { id: "user-a", username: "returned A" };
      const staleRow = item(1, "stale-A-response");
      pending.resolve(response([staleRow]));
      await load;

      expect(harness.profile.profileItems.value).toEqual([]);
    },
  );

  it("#6 keeps an active request continuous across a new same-normalized-id user object", async () => {
    const harness = makeHarness({ initialUser: { id: "  user-a  ", username: "old" } });
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");
    harness.user.value = { id: "user-a", username: "new object" };
    publishMembership(harness.port, "liked", 1, false);
    const staleRow = item(1, "same-owner-stale-response");
    pending.resolve(response([staleRow]));
    await load;

    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listLoading.value).toBe(false);
  });

  it("#6 lets a guest load transport data without installing event projection", async () => {
    const harness = makeHarness({ initialUser: null });
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");
    publishMembership(harness.port, "liked", 1, false);
    const guestRow = item(1, "guest-transport");
    pending.resolve(response([guestRow]));
    await load;

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(guestRow);
    const guestArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "liked", 1, false);
    expect(harness.profile.profileItems.value).toBe(guestArray);
  });

  it("#6 fails closed for missing ids but keeps a normalized same-id owner continuous", async () => {
    const missing = makeHarness({ initialUser: { username: "missing-id" } });
    await loadRows(missing, "liked", [item(1, "missing-id-row")]);
    const missingArray = missing.profile.profileItems.value;
    publishMembership(missing.port, "liked", 1, false);
    expect(missing.profile.profileItems.value).toBe(missingArray);

    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const missingLoad = missing.profile.loadProfileList("liked");
    publishMembership(missing.port, "liked", 1, false);
    const missingTransportRow = item(1, "missing-id-transport");
    pending.resolve(response([missingTransportRow]));
    await missingLoad;
    expect(toRaw(missing.profile.profileItems.value[0])).toBe(missingTransportRow);

    const stable = makeHarness({ initialUser: { id: "  user-a  ", username: "old" } });
    await loadRows(stable, "liked", [item(2, "stable-row")]);
    stable.user.value = { id: "user-a", username: "new object" };
    publishMembership(stable.port, "liked", 2, false);
    expect(stable.profile.profileItems.value).toEqual([]);
  });

  it("#6 records that a truly late old-account event is unclassifiable after B is mounted", async () => {
    const harness = makeHarness({ initialUser: { id: "user-b" } });
    await loadRows(harness, "liked", [item(1, "B row sharing old tid")]);

    const event = publishMembership(harness.port, "liked", 1, false);

    expect(event).not.toBeNull();
    expect(event).not.toHaveProperty("accountId");
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it.each(["liked", "saved"] as const)(
    "#7 overlays a pending %s response and preserves surviving transport references",
    async (tab) => {
      const harness = makeHarness();
      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      const load = harness.profile.loadProfileList(tab);
      expect(fetchProfileTabMock).toHaveBeenCalledWith(tab, [], { contentFilter: "all" });
      expect(harness.profile.listLoading.value).toBe(true);

      publishMembership(harness.port, tab, 2, false);
      const a = item(1, `${tab}-new-title`, { cover: `${tab}-new-cover` });
      const removed = item(2, `${tab}-stale-member`);
      const c = item(3, `${tab}-new-C`);
      pending.resolve(response([a, removed, c]));
      await load;

      expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1, 3]);
      expect(toRaw(harness.profile.profileItems.value[0])).toBe(a);
      expect(toRaw(harness.profile.profileItems.value[1])).toBe(c);
      expect(harness.profile.profileItems.value[0].cover).toBe(`${tab}-new-cover`);
    },
  );

  it("#7 never captures a visible liked row as a saved-request candidate", async () => {
    const harness = makeHarness();
    const likedRow = item(1, "liked-only-row");
    await loadRows(harness, "liked", [likedRow]);
    const likedProxy = harness.profile.profileItems.value[0];

    const pendingSaved = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pendingSaved.promise);
    const savedLoad = harness.profile.loadProfileList("saved");
    expect(fetchProfileTabMock).toHaveBeenCalledWith("saved", [], { contentFilter: "all" });
    expect(harness.profile.activeTab.value).toBe("saved");
    expect(harness.profile.profileItems.value[0]).toBe(likedProxy);

    publishMembership(harness.port, "saved", 1, false);
    publishMembership(harness.port, "saved", 1, true);
    expect(harness.profile.profileItems.value[0]).toBe(likedProxy);

    const savedRows: ProfileListItem[] = [];
    pendingSaved.resolve(response(savedRows));
    await savedLoad;

    expect(toRaw(harness.profile.profileItems.value)).toBe(savedRows);
    expect(harness.profile.profileItems.value).toEqual([]);
    const acceptedSavedArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "saved", 1, true);
    expect(harness.profile.profileItems.value).toBe(acceptedSavedArray);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#7 removes duplicate response tids, stashes only the first, and restores it once", async () => {
    const harness = makeHarness();
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");
    publishMembership(harness.port, "liked", 2, false);
    const a = item(1, "transport-A");
    const firstB = item(2, "transport-B-first");
    const secondB = item(2, "transport-B-second");
    const c = item(3, "transport-C");
    pending.resolve(response([a, firstB, secondB, c]));
    await load;

    expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1, 3]);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(a);
    expect(toRaw(harness.profile.profileItems.value[1])).toBe(c);

    publishMembership(harness.port, "liked", 2, true);
    publishMembership(harness.port, "liked", 2, true);

    expect(harness.profile.profileItems.value.map((row) => row.tid)).toEqual([1, 2, 3]);
    expect(toRaw(harness.profile.profileItems.value[1])).toBe(firstB);
    expect(harness.profile.profileItems.value.filter((row) => row.tid === 2)).toHaveLength(1);
  });

  it("#7 installs the new owner before a sync assignment watcher publishes", async () => {
    const harness = makeHarness();
    const transportRow = item(1, "assignment-row");
    let published = false;
    const stop = watch(
      harness.profile.profileItems,
      (rows) => {
        if (!published && rows.some((row) => row.tid === 1)) {
          published = true;
          publishMembership(harness.port, "liked", 1, false);
        }
      },
      { flush: "sync" },
    );

    await loadRows(harness, "liked", [transportRow]);
    stop();

    expect(published).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#7 prevents an outer A assignment/finally from replacing reentrant account B", async () => {
    const harness = makeHarness({ initialUser: { id: "user-a" } });
    const bRequest = deferred<ProfileListResponse>();
    let bLoad: Promise<void> | undefined;
    let switched = false;
    fetchProfileTabMock
      .mockResolvedValueOnce(response([item(1, "account-A")]))
      .mockReturnValueOnce(bRequest.promise);
    const stop = watch(
      harness.profile.profileItems,
      (rows) => {
        if (!switched && rows.some((row) => row.tid === 1)) {
          switched = true;
          harness.profile.resetList();
          harness.user.value = { id: "user-b" };
          bLoad = harness.profile.loadProfileList("liked");
        }
      },
      { flush: "sync" },
    );

    await harness.profile.loadProfileList("liked");

    expect(switched).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listLoading.value).toBe(true);
    const bRow = item(2, "account-B");
    bRequest.resolve(response([bRow]));
    await bLoad;
    stop();
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(bRow);
    expect(harness.profile.listLoading.value).toBe(false);
  });

  it("#7 prevents a post-assignment continuation from reinstalling A during same-account supersession", async () => {
    const harness = makeHarness({ initialUser: { id: "user-a" } });
    const aRequest = deferred<ProfileListResponse>();
    const bRequest = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(aRequest.promise).mockReturnValueOnce(bRequest.promise);
    let bLoad: Promise<void> | undefined;
    let superseded = false;
    const stop = watch(
      harness.profile.profileItems,
      (rows) => {
        if (!superseded && rows.length === 0) {
          superseded = true;
          harness.profile.resetList();
          bLoad = harness.profile.loadProfileList("liked");
        }
      },
      { flush: "sync" },
    );
    const aLoad = harness.profile.loadProfileList("liked");
    publishMembership(harness.port, "liked", 1, false);
    const aRow = item(1, "A-response-candidate");
    aRequest.resolve(response([aRow]));
    await aLoad;

    expect(superseded).toBe(true);
    expect(harness.profile.listLoading.value).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
    publishMembership(harness.port, "liked", 1, true);
    expect(harness.profile.profileItems.value).toEqual([]);

    const bRow = item(2, "same-account-B-response");
    bRequest.resolve(response([bRow]));
    await bLoad;
    stop();
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(bRow);
    expect(harness.profile.listLoading.value).toBe(false);
  });

  it("#8 prefers the response row as the candidate restored after request re-entry", async () => {
    const harness = makeHarness();
    const oldRow = item(1, "old-version");
    await loadRows(harness, "liked", [oldRow]);
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");

    publishMembership(harness.port, "liked", 1, false);
    const responseRow = item(1, "new-response-version", { cover: "new-response-cover" });
    pending.resolve(response([responseRow]));
    await load;
    expect(harness.profile.profileItems.value).toEqual([]);

    publishMembership(harness.port, "liked", 1, true);

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(responseRow);
    expect(toRaw(harness.profile.profileItems.value[0])).not.toBe(oldRow);
    expect(harness.profile.profileItems.value[0].title).toBe("new-response-version");
  });

  it("#9 restores only request-known rows for post-boundary positives", async () => {
    const harness = makeHarness();
    const known = item(1, "known-at-start");
    await loadRows(harness, "liked", [known]);
    const knownProxy = harness.profile.profileItems.value[0];
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");

    publishMembership(harness.port, "liked", 1, true);
    publishMembership(harness.port, "liked", 999, true);
    pending.resolve(response([]));
    await load;

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(toRaw(knownProxy));
    expect(harness.profile.profileItems.value.some((row) => row.tid === 999)).toBe(false);
  });

  it("#9 keeps detached request candidates after committed-list restore", async () => {
    const harness = makeHarness();
    const known = item(1, "known-candidate");
    await loadRows(harness, "liked", [known]);
    const knownProxy = harness.profile.profileItems.value[0];
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");

    publishMembership(harness.port, "liked", 1, false);
    publishMembership(harness.port, "liked", 1, true);
    expect(harness.profile.profileItems.value[0]).toBe(knownProxy);
    pending.resolve(response([]));
    await load;

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(toRaw(knownProxy));
  });

  it("#9 replaces an old committed candidate when a same-tab refresh accepts an empty owner", async () => {
    const harness = makeHarness();
    await loadRows(harness, "liked", [item(1, "old-candidate")]);
    publishMembership(harness.port, "liked", 1, false);
    expect(harness.profile.profileItems.value).toEqual([]);

    await loadRows(harness, "liked", []);
    const replacementOwnerArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "liked", 1, true);

    expect(harness.profile.profileItems.value).toBe(replacementOwnerArray);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#10 treats a settlement before the physical call as non-replayed transport history", async () => {
    const harness = makeHarness();
    publishMembership(harness.port, "liked", 1, false);
    const transportRow = item(1, "transport-authority");

    await loadRows(harness, "liked", [transportRow]);

    expect(harness.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(transportRow);
  });

  it("#10 treats a negative published inside start currentSequence as pre-boundary", async () => {
    const base = createPostReactionSettlementChannel();
    let armed = false;
    let published = false;
    const timing = trackedPort(base, {
      onCurrentSequence: () => {
        if (!armed || published) return;
        published = true;
        publishMembership(base, "liked", 1, false);
      },
    });
    const harness = makeHarness({ settlements: timing.port });
    const transportRow = item(1, "start-boundary-transport-authority");
    const transportRows = [transportRow];
    fetchProfileTabMock.mockResolvedValueOnce(response(transportRows));
    armed = true;

    await harness.profile.loadProfileList("liked");

    expect(published).toBe(true);
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);
    expect(toRaw(harness.profile.profileItems.value)).toBe(transportRows);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(transportRow);
  });

  it("#10 captures a settlement synchronously published inside the physical transport", async () => {
    const harness = makeHarness();
    const staleRow = item(1, "stale-transport-row");
    fetchProfileTabMock.mockImplementationOnce(async () => {
      publishMembership(harness.port, "liked", 1, false);
      return response([staleRow]);
    });

    await harness.profile.loadProfileList("liked");

    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#10 preserves exact raw response-array identity when no membership event applies", async () => {
    const harness = makeHarness();
    const rows = [item(1, "A"), item(2, "B")];

    await loadRows(harness, "liked", rows);

    expect(toRaw(harness.profile.profileItems.value)).toBe(rows);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(rows[0]);
    expect(toRaw(harness.profile.profileItems.value[1])).toBe(rows[1]);
  });

  it.each(["reset", "dispose"] as const)(
    "#10 rejects a physical start when currentSequence synchronously performs %s",
    async (action) => {
      const base = createPostReactionSettlementChannel();
      let armed = false;
      let triggered = false;
      const timing = trackedPort(base, {
        onCurrentSequence: () => {
          if (!armed || triggered) return;
          triggered = true;
          if (action === "reset") harness.profile.resetList();
          else harness.profile.dispose?.();
        },
      });
      const harness = makeHarness({ settlements: timing.port });
      fetchProfileTabMock.mockResolvedValueOnce(response([item(1, "must-not-start")]));
      armed = true;

      const load = harness.profile.loadProfileList("liked");
      await load;

      expect(triggered).toBe(true);
      if (action === "dispose") expect(typeof harness.profile.dispose).toBe("function");
      expect(fetchProfileTabMock).not.toHaveBeenCalled();
      expect(harness.profile.profileItems.value).toEqual([]);
      expect(harness.profile.listLoading.value).toBe(false);
    },
  );

  it("#10 rejects an outer start superseded from currentSequence by a nested load", async () => {
    const base = createPostReactionSettlementChannel();
    let armed = false;
    let triggered = false;
    let savedLoad: Promise<void> | undefined;
    const timing = trackedPort(base, {
      onCurrentSequence: () => {
        if (!armed || triggered) return;
        triggered = true;
        savedLoad = harness.profile.loadProfileList("saved");
      },
    });
    const harness = makeHarness({ settlements: timing.port });
    const savedRow = item(2, "nested-saved");
    fetchProfileTabMock.mockResolvedValueOnce(response([savedRow]));
    armed = true;

    const outerLoad = harness.profile.loadProfileList("liked");
    await Promise.all([outerLoad, savedLoad]);

    expect(triggered).toBe(true);
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);
    expect(fetchProfileTabMock).toHaveBeenCalledWith("saved", [], { contentFilter: "all" });
    expect(harness.profile.activeTab.value).toBe("saved");
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(savedRow);
  });

  it("#10 includes an event synchronously published by the response-floor capture", async () => {
    const base = createPostReactionSettlementChannel();
    let sequenceCalls = 0;
    let armed = false;
    const timing = trackedPort(base, {
      onCurrentSequence: () => {
        if (!armed) return;
        sequenceCalls += 1;
        if (sequenceCalls === 2) publishMembership(base, "liked", 1, false);
      },
    });
    const harness = makeHarness({ settlements: timing.port });
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    armed = true;
    const load = harness.profile.loadProfileList("liked");
    expect(sequenceCalls).toBe(1);
    const staleRow = item(1, "handoff-stale");

    pending.resolve(response([staleRow]));
    await load;

    expect(sequenceCalls).toBe(2);
    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it.each(["reset", "dispose", "supersede"] as const)(
    "#10 rejects a stale response when the response-floor capture performs %s",
    async (action) => {
      const base = createPostReactionSettlementChannel();
      let sequenceCalls = 0;
      let armed = false;
      let triggered = false;
      let stateAfterBoundary: ProfileListItem[] | undefined;
      let supersedingLoad: Promise<void> | undefined;
      let supersedingRequest: ReturnType<typeof deferred<ProfileListResponse>> | undefined;
      const timing = trackedPort(base, {
        onCurrentSequence: () => {
          if (!armed) return;
          sequenceCalls += 1;
          if (sequenceCalls !== 2) return;
          triggered = true;
          if (action === "reset") harness.profile.resetList();
          else if (action === "dispose") harness.profile.dispose?.();
          else supersedingLoad = harness.profile.loadProfileList("saved");
          stateAfterBoundary = harness.profile.profileItems.value;
        },
      });
      const harness = makeHarness({ settlements: timing.port });
      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      if (action === "supersede") {
        supersedingRequest = deferred<ProfileListResponse>();
        fetchProfileTabMock.mockReturnValueOnce(supersedingRequest.promise);
      }
      armed = true;
      const load = harness.profile.loadProfileList("liked");
      expect(sequenceCalls).toBe(1);
      const staleRow = item(1, `stale-after-${action}`);

      pending.resolve(response([staleRow]));
      await load;

      expect(triggered).toBe(true);
      expect(stateAfterBoundary).toBeDefined();
      expect(harness.profile.profileItems.value).toBe(stateAfterBoundary);
      expect(harness.profile.profileItems.value.some((row) => row.tid === 1)).toBe(false);
      if (action === "dispose") expect(typeof harness.profile.dispose).toBe("function");
      if (action === "supersede") {
        expect(harness.profile.activeTab.value).toBe("saved");
        expect(harness.profile.listLoading.value).toBe(true);
        const savedRow = item(2, "superseding-saved-row");
        supersedingRequest?.resolve(response([savedRow]));
        await supersedingLoad;
        expect(toRaw(harness.profile.profileItems.value[0])).toBe(savedRow);
      }
    },
  );

  it("#11 gives a same-account 401 retry a new non-replay physical boundary", async () => {
    const refresh = deferred<ProfileUser | null>();
    const tracked = trackedPort(createPostReactionSettlementChannel());
    const harness = makeHarness({
      initialUser: { id: "user-a", username: "old" },
      refreshCurrentSession: () => refresh.promise,
      settlements: tracked.port,
    });
    expect(tracked.active()).toBe(1);
    await loadRows(harness, "liked", [item(1, "mounted-before-refresh")]);
    const first = deferred<ProfileListResponse>();
    let retryPublished = false;
    const retryRow = item(2, "retry-post-boundary-row");
    fetchProfileTabMock.mockReturnValueOnce(first.promise).mockImplementationOnce(async () => {
      retryPublished = true;
      publishMembership(harness.port, "liked", 2, false);
      return response([retryRow]);
    });
    const load = harness.profile.loadProfileList("liked");
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(2);
    expect(tracked.active()).toBe(1);

    publishMembership(harness.port, "liked", 1, false);
    expect(harness.profile.profileItems.value).toEqual([]);
    first.reject(MISSING_SESSION);
    await flushMicrotasks();
    refresh.resolve({ id: "user-a", username: "refreshed" });
    await load;

    expect(fetchProfileTabMock).toHaveBeenCalledTimes(3);
    expect(tracked.active()).toBe(1);
    expect(retryPublished).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
    const retryArray = harness.profile.profileItems.value;
    publishMembership(harness.port, "liked", 1, true);
    expect(harness.profile.profileItems.value).toBe(retryArray);
    expect(harness.user.value).toEqual({ id: "user-a", username: "refreshed" });
  });

  it.each(["same", "different"] as const)(
    "#12 prevents an old %s-tab request and cleanup from owning the newest load",
    async (mode) => {
      const harness = makeHarness();
      const oldRequest = deferred<ProfileListResponse>();
      const newRequest = deferred<ProfileListResponse>();
      fetchProfileTabMock
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(newRequest.promise);
      const oldLoad = harness.profile.loadProfileList("liked");
      publishMembership(harness.port, "liked", 1, false);
      const nextTab = mode === "same" ? "liked" : "saved";
      const newLoad = harness.profile.loadProfileList(nextTab);

      oldRequest.resolve(response([item(1, "old-response")]));
      await oldLoad;
      expect(harness.profile.activeTab.value).toBe(nextTab);
      expect(harness.profile.profileItems.value).toEqual([]);
      expect(harness.profile.listLoading.value).toBe(true);

      newRequest.resolve(response([]));
      await newLoad;
      expect(harness.profile.profileItems.value).toEqual([]);
      const newestArray = harness.profile.profileItems.value;
      publishMembership(harness.port, nextTab, 1, true);
      expect(harness.profile.profileItems.value).toBe(newestArray);
      expect(harness.profile.listLoading.value).toBe(false);
    },
  );

  it("#13 retires owner, candidate, and request events on an accepted async failure", async () => {
    const harness = makeHarness();
    await loadRows(harness, "liked", [item(1, "mounted")]);
    const request = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(request.promise);
    const load = harness.profile.loadProfileList("liked");
    publishMembership(harness.port, "liked", 1, false);
    let publishedDuringFailureWrite = false;
    const stop = watch(
      harness.profile.profileItems,
      (rows) => {
        if (!publishedDuringFailureWrite && rows.length === 0) {
          publishedDuringFailureWrite = true;
          publishMembership(harness.port, "liked", 1, true);
        }
      },
      { flush: "sync" },
    );
    request.reject(new Error("profile failed"));
    await load;
    stop();

    expect(publishedDuringFailureWrite).toBe(true);
    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listError.value).toContain("profile failed");
    expect(harness.profile.listLoading.value).toBe(false);
    publishMembership(harness.port, "liked", 1, true);
    expect(harness.profile.profileItems.value).toEqual([]);

    const retryRow = item(1, "retry-authority");
    await loadRows(harness, "liked", [retryRow]);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(retryRow);
  });

  it("#13 retires an exact request after a synchronous transport throw", async () => {
    const harness = makeHarness();
    fetchProfileTabMock.mockImplementationOnce(() => {
      publishMembership(harness.port, "liked", 1, false);
      throw new Error("synchronous profile failure");
    });

    await expect(harness.profile.loadProfileList("liked")).resolves.toBeUndefined();

    expect(harness.profile.profileItems.value).toEqual([]);
    expect(harness.profile.listError.value).toContain("synchronous profile failure");
    expect(harness.profile.listLoading.value).toBe(false);
    const retryRow = item(1, "post-throw-retry");
    await loadRows(harness, "liked", [retryRow]);
    expect(toRaw(harness.profile.profileItems.value[0])).toBe(retryRow);
  });

  it("#14 consumes the named singleton only when the settlement option is omitted", async () => {
    const harness = makeHarness({ defaultSettlements: true });
    await loadRows(harness, "liked", [item(1, "default-singleton")]);

    publishMembership(postReactionSettlements, "liked", 1, false);

    expect(harness.profile.profileItems.value).toEqual([]);
  });

  it("#14 isolates an injected real channel from the named singleton and another factory", async () => {
    const injected = createPostReactionSettlementChannel();
    const other = createPostReactionSettlementChannel();
    const harness = makeHarness({ settlements: injected });
    await loadRows(harness, "saved", [item(1, "injected")]);
    const originalArray = harness.profile.profileItems.value;
    publishMembership(postReactionSettlements, "saved", 1, false);
    expect(harness.profile.profileItems.value).toBe(originalArray);
    const singletonEvents: PostReactionSettlement[] = [];
    activeUnsubscribers.push(
      postReactionSettlements.subscribe((event) => singletonEvents.push(event)),
    );

    publishMembership(other, "saved", 1, false);
    expect(harness.profile.profileItems.value).toBe(originalArray);

    const singletonSequence = postReactionSettlements.currentSequence();
    publishMembership(injected, "saved", 1, false);
    expect(harness.profile.profileItems.value).toEqual([]);
    expect(postReactionSettlements.currentSequence()).toBe(singletonSequence);
    expect(singletonEvents).toEqual([]);
  });

  it.each(["resolve", "reject"] as const)(
    "#15 makes explicit disposal terminal and idempotent across a late %s",
    async (lateSettlement) => {
      const base = createPostReactionSettlementChannel();
      const tracked = trackedPort(base);
      const harness = makeHarness({ settlements: tracked.port });
      expect(tracked.active()).toBe(1);
      await loadRows(harness, "liked", [item(1, "mounted")]);
      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      const load = harness.profile.loadProfileList("liked");
      expect(harness.profile.listLoading.value).toBe(true);
      expect(tracked.active()).toBe(1);

      expect(typeof harness.profile.dispose).toBe("function");
      expect(() => harness.profile.dispose?.()).not.toThrow();
      expect(() => harness.profile.dispose?.()).not.toThrow();
      expect(tracked.active()).toBe(0);
      expect(harness.profile.listLoading.value).toBe(false);
      const terminalState = {
        array: harness.profile.profileItems.value,
        error: harness.profile.listError.value,
        tab: harness.profile.activeTab.value,
        loading: harness.profile.listLoading.value,
      };
      expect(() => harness.scope.stop()).not.toThrow();
      expect(() => harness.profile.dispose?.()).not.toThrow();

      publishMembership(base, "liked", 1, false);
      if (lateSettlement === "resolve") {
        pending.resolve(response([item(2, "late-result")]));
      } else {
        pending.reject(new Error("late explicit rejection"));
      }
      await load;
      expect(harness.profile.profileItems.value).toBe(terminalState.array);
      expect(harness.profile.listError.value).toBe(terminalState.error);
      expect(harness.profile.activeTab.value).toBe(terminalState.tab);
      expect(harness.profile.listLoading.value).toBe(terminalState.loading);
    },
  );

  it("#15 rejects a callback retained in delivery after an earlier listener disposes", async () => {
    const port = createPostReactionSettlementChannel();
    let disposed = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind === "like" && !disposed) {
          disposed = true;
          harness.profile.dispose?.();
        }
      }),
    );
    const harness = makeHarness({ settlements: port });
    await loadRows(harness, "liked", [item(1, "retained-callback")]);
    const before = harness.profile.profileItems.value;

    publishMembership(port, "liked", 1, false);

    expect(disposed).toBe(true);
    expect(typeof harness.profile.dispose).toBe("function");
    expect(harness.profile.profileItems.value).toBe(before);
  });

  it("#15 isolates a throwing delegated unsubscribe and still clears all authority", async () => {
    const base = createPostReactionSettlementChannel();
    const tracked = trackedPort(base, { throwAfterUnsubscribe: true });
    const harness = makeHarness({ settlements: tracked.port });
    await loadRows(harness, "liked", [item(1, "throwing-unsubscribe")]);
    const pending = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(pending.promise);
    const load = harness.profile.loadProfileList("liked");
    expect(harness.profile.listLoading.value).toBe(true);
    const before = harness.profile.profileItems.value;

    expect(() => harness.profile.dispose?.()).not.toThrow();

    expect(typeof harness.profile.dispose).toBe("function");
    expect(tracked.active()).toBe(0);
    expect(harness.profile.listLoading.value).toBe(false);
    publishMembership(base, "liked", 1, false);
    pending.resolve(response([item(2, "late-after-throwing-unsubscribe")]));
    await load;
    expect(harness.profile.profileItems.value).toBe(before);
  });

  it.each(["resolve", "reject"] as const)(
    "#15 makes scope-first disposal terminal across a late %s",
    async (lateSettlement) => {
      const base = createPostReactionSettlementChannel();
      const tracked = trackedPort(base);
      const harness = makeHarness({ settlements: tracked.port });
      await loadRows(harness, "liked", [item(1, "scope-first")]);
      const pending = deferred<ProfileListResponse>();
      fetchProfileTabMock.mockReturnValueOnce(pending.promise);
      const load = harness.profile.loadProfileList("liked");
      expect(tracked.active()).toBe(1);
      expect(harness.profile.listLoading.value).toBe(true);

      expect(() => harness.scope.stop()).not.toThrow();

      expect(tracked.active()).toBe(0);
      expect(harness.profile.listLoading.value).toBe(false);
      const terminalState = {
        array: harness.profile.profileItems.value,
        error: harness.profile.listError.value,
        tab: harness.profile.activeTab.value,
        loading: harness.profile.listLoading.value,
      };
      publishMembership(base, "liked", 1, false);
      if (lateSettlement === "resolve") {
        pending.resolve(response([item(2, "late-after-scope-stop")]));
      } else {
        pending.reject(new Error("late scope rejection"));
      }
      await load;
      expect(harness.profile.profileItems.value).toBe(terminalState.array);
      expect(harness.profile.listError.value).toBe(terminalState.error);
      expect(harness.profile.activeTab.value).toBe(terminalState.tab);
      expect(harness.profile.listLoading.value).toBe(terminalState.loading);
      expect(() => harness.profile.dispose?.()).not.toThrow();
      expect(() => harness.profile.dispose?.()).not.toThrow();
    },
  );

  it("#15 releases a never-settling load and makes later public commands prompt no-ops", async () => {
    const base = createPostReactionSettlementChannel();
    const tracked = trackedPort(base);
    const harness = makeHarness({ settlements: tracked.port });
    const never = deferred<ProfileListResponse>();
    fetchProfileTabMock.mockReturnValueOnce(never.promise);
    const load = harness.profile.loadProfileList("liked");
    expect(harness.profile.listLoading.value).toBe(true);
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);

    harness.profile.dispose?.();

    expect(typeof harness.profile.dispose).toBe("function");
    expect(harness.profile.listLoading.value).toBe(false);
    expect(tracked.active()).toBe(0);
    const arrayAfterDispose = harness.profile.profileItems.value;
    const tabAfterDispose = harness.profile.activeTab.value;
    const errorAfterDispose = harness.profile.listError.value;
    const resetResult = harness.profile.resetList();
    const laterLoad = harness.profile.loadProfileList("saved");
    await expect(Promise.resolve(resetResult)).resolves.toBeUndefined();
    await expect(laterLoad).resolves.toBeUndefined();
    expect(fetchProfileTabMock).toHaveBeenCalledTimes(1);
    expect(harness.profile.profileItems.value).toBe(arrayAfterDispose);
    expect(harness.profile.activeTab.value).toBe(tabAfterDispose);
    expect(harness.profile.listError.value).toBe(errorAfterDispose);
    expect(harness.profile.listLoading.value).toBe(false);

    never.resolve(response([item(1, "late-never")]));
    await load;
    expect(harness.profile.profileItems.value).toBe(arrayAfterDispose);
  });

  it("#15 gives a fresh instance no replay or candidate from a disposed instance", async () => {
    const port = createPostReactionSettlementChannel();
    const first = makeHarness({ settlements: port });
    await loadRows(first, "liked", [item(1, "first")]);
    publishMembership(port, "liked", 1, false);
    first.profile.dispose?.();
    const sequenceAfterFirst = port.currentSequence();

    const second = makeHarness({ settlements: port });
    await loadRows(second, "liked", []);
    publishMembership(port, "liked", 1, true);
    expect(second.profile.profileItems.value).toEqual([]);

    const transportRow = item(1, "fresh-transport");
    await loadRows(second, "liked", [transportRow]);

    expect(port.currentSequence()).toBe(sequenceAfterFirst + 1);
    expect(second.profile.profileItems.value).toHaveLength(1);
    expect(toRaw(second.profile.profileItems.value[0])).toBe(transportRow);
  });
});
