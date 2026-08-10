import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, watch, type EffectScope, type Ref } from "vue";
import {
  PUBLISH_DRAFT_SCOPE_ANONYMOUS,
  readPublishDraft,
  savePublishDraft,
} from "../../src/features/publish/publishDraftSession";
import { usePublishDraftSession } from "../../src/features/publish/usePublishDraftSession";
import {
  consumePendingPublishLocation,
  setPendingPublishLocation,
  type PublishMapPickerLocationHandoff,
} from "../../src/features/publish/usePublishLocationHandoff";

interface InstrumentedStorage extends Storage {
  getOperations: () => StorageOperation[];
  getReads: () => number;
  getWrites: () => number;
  recordMarker: (label: string) => void;
  resetActivity: () => void;
}

interface StorageOperation {
  type: "clear" | "get" | "marker" | "remove" | "set";
  key: string;
  value?: string;
}

interface DraftHarness {
  scope: EffectScope;
  title: Ref<string>;
  body: Ref<string>;
  tagInput: Ref<string>;
  placeName: Ref<string>;
  visibility: Ref<"public" | "campus" | "school" | "private">;
  selectedFiles: Ref<File[]>;
  selectedMapLocation: Ref<null>;
  mapPickerBinding: Ref<PublishMapPickerLocationHandoff | null>;
  locationSearch: Ref<string>;
  locationPanelOpen: Ref<boolean>;
  publishing: Ref<boolean>;
  userId: Ref<string | null>;
  identityLoaded: Ref<boolean>;
  resetTransientState: ReturnType<typeof vi.fn>;
  resetObservedTitles: string[];
  discardedHandoffs: PublishMapPickerLocationHandoff[];
  discardObservedGenerations: Array<number | null>;
  session: ReturnType<typeof usePublishDraftSession> & {
    restoreGeneration?: Readonly<Ref<number>>;
  };
}

const ALICE_BINDING: PublishMapPickerLocationHandoff = {
  version: 2,
  source: "map_picker",
  coordinateSystem: "gcj02",
  kind: "place",
  locationId: "location-alice",
  placeId: "place-alice",
  name: "Alice place",
  lat: 18.31,
  lng: 109.91,
};

const BOB_BINDING: PublishMapPickerLocationHandoff = {
  version: 2,
  source: "map_picker",
  coordinateSystem: "gcj02",
  kind: "place",
  locationId: "location-bob",
  placeId: "place-bob",
  name: "Bob place",
  lat: 18.42,
  lng: 110.03,
};

const PENDING_BINDING: PublishMapPickerLocationHandoff = {
  version: 2,
  source: "map_picker",
  coordinateSystem: "gcj02",
  kind: "place",
  locationId: "location-pending",
  placeId: "place-pending",
  name: "Pending place",
  lat: 18.5,
  lng: 110.1,
};

let activeScopes: EffectScope[] = [];

function createMemoryStorage(): InstrumentedStorage {
  const store = new Map<string, string>();
  let operations: StorageOperation[] = [];
  let reads = 0;
  let writes = 0;

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
      writes += 1;
      operations.push({ type: "clear", key: "*" });
    },
    getItem(key: string) {
      reads += 1;
      operations.push({ type: "get", key });
      return store.has(key) ? store.get(key)! : null;
    },
    getOperations() {
      return [...operations];
    },
    getReads() {
      return reads;
    },
    getWrites() {
      return writes;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
      writes += 1;
      operations.push({ type: "remove", key });
    },
    recordMarker(label: string) {
      operations.push({ type: "marker", key: label });
    },
    resetActivity() {
      reads = 0;
      writes = 0;
      operations = [];
    },
    setItem(key: string, value: string) {
      store.set(key, value);
      writes += 1;
      operations.push({ type: "set", key, value });
    },
  };
}

function seedDraft(
  scope: string,
  title: string,
  body: string,
  mapPickerBinding: PublishMapPickerLocationHandoff | null = null,
) {
  savePublishDraft(
    {
      title,
      body,
      tagInput: `#${title.toLowerCase()}`,
      placeName:
        mapPickerBinding?.kind === "place" ? mapPickerBinding.name : mapPickerBinding?.label || "",
      visibility: "public",
      selectedMapLocation: null,
      mapPickerBinding,
      selectedFileCount: 0,
    },
    scope,
  );
}

function createHarness(options: { userId: string | null; identityLoaded: boolean }): DraftHarness {
  const title = ref("");
  const body = ref("");
  const tagInput = ref("");
  const placeName = ref("");
  const visibility = ref<"public" | "campus" | "school" | "private">("public");
  const selectedFiles = ref<File[]>([]);
  const selectedMapLocation = ref<null>(null);
  const mapPickerBinding = ref<PublishMapPickerLocationHandoff | null>(null);
  const locationSearch = ref("");
  const locationPanelOpen = ref(false);
  const publishing = ref(false);
  const userId = ref<string | null>(options.userId);
  const identityLoaded = ref(options.identityLoaded);
  const resetObservedTitles: string[] = [];
  const discardedHandoffs: PublishMapPickerLocationHandoff[] = [];
  const discardObservedGenerations: Array<number | null> = [];
  let session!: DraftHarness["session"];
  const resetTransientState = vi.fn(() => {
    (sessionStorage as InstrumentedStorage).recordMarker("resetTransientState");
    resetObservedTitles.push(title.value);
    const pending = consumePendingPublishLocation();
    if (pending?.source === "map_picker") {
      discardedHandoffs.push(pending);
      discardObservedGenerations.push(session?.restoreGeneration?.value ?? null);
    }
    selectedFiles.value = [];
  });
  const transitionOptions = { resetTransientState };
  const scope = effectScope();

  scope.run(() => {
    session = usePublishDraftSession({
      title,
      body,
      tagInput,
      placeName,
      visibility,
      selectedFiles,
      selectedMapLocation,
      mapPickerBinding,
      locationSearch,
      locationPanelOpen,
      publishing,
      loadIdentity: vi.fn(),
      loadMapLocations: vi.fn(),
      userId,
      identityLoaded,
      ...transitionOptions,
    }) as DraftHarness["session"];
  });
  activeScopes.push(scope);

  return {
    scope,
    title,
    body,
    tagInput,
    placeName,
    visibility,
    selectedFiles,
    selectedMapLocation,
    mapPickerBinding,
    locationSearch,
    locationPanelOpen,
    publishing,
    userId,
    identityLoaded,
    resetTransientState,
    resetObservedTitles,
    discardedHandoffs,
    discardObservedGenerations,
    session,
  };
}

async function flushScopeTransition() {
  await nextTick();
  await nextTick();
  await nextTick();
}

beforeEach(() => {
  activeScopes = [];
  const storage = createMemoryStorage();
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("window", {
    sessionStorage: storage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  for (const scope of activeScopes) scope.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePublishDraftSession account-scope re-entry", () => {
  it("does not read or write any scope before identity has loaded", async () => {
    seedDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, "Guest", "Guest body");
    seedDraft("u:alice", "Alice", "Alice body");
    const storage = sessionStorage as InstrumentedStorage;
    storage.resetActivity();

    const h = createHarness({ userId: null, identityLoaded: false });
    h.title.value = "typed while identity is pending";
    await flushScopeTransition();

    expect({
      title: h.title.value,
      reads: storage.getReads(),
      writes: storage.getWrites(),
      settled: h.session.restoreSettled.value,
    }).toEqual({
      title: "typed while identity is pending",
      reads: 0,
      writes: 0,
      settled: false,
    });
  });

  it("restores A again after A -> B -> A and keeps watcher writes in their owner scope", async () => {
    seedDraft("u:alice", "Alice", "Alice body", ALICE_BINDING);
    seedDraft("u:bob", "Bob", "Bob body", BOB_BINDING);
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();

    h.title.value = "Alice latest";
    h.userId.value = "bob";
    await flushScopeTransition();
    const bobEntry = {
      title: h.title.value,
      binding: h.mapPickerBinding.value,
      storedAlice: readPublishDraft("u:alice"),
    };

    h.userId.value = "alice";
    await flushScopeTransition();
    const aliceReentry = {
      title: h.title.value,
      binding: h.mapPickerBinding.value,
    };

    h.body.value = "Alice changed after re-entry";
    await flushScopeTransition();

    expect({
      bobEntry,
      aliceReentry,
      storedAlice: readPublishDraft("u:alice"),
      storedBob: readPublishDraft("u:bob"),
    }).toMatchObject({
      bobEntry: {
        title: "Bob",
        binding: BOB_BINDING,
        storedAlice: { title: "Alice latest", body: "Alice body" },
      },
      aliceReentry: {
        title: "Alice latest",
        binding: ALICE_BINDING,
      },
      storedAlice: {
        title: "Alice latest",
        body: "Alice changed after re-entry",
        mapPickerBinding: ALICE_BINDING,
      },
      storedBob: {
        title: "Bob",
        body: "Bob body",
        mapPickerBinding: BOB_BINDING,
      },
    });
  });

  it("assigns an edit after an identity change in the same tick only to the target scope", async () => {
    seedDraft("u:alice", "Alice", "Alice body", ALICE_BINDING);
    seedDraft("u:bob", "Bob", "Bob body", BOB_BINDING);
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();

    h.userId.value = "bob";
    h.title.value = "Bob immediate edit";
    await flushScopeTransition();

    expect({
      visibleTitle: h.title.value,
      storedAlice: readPublishDraft("u:alice"),
      storedBob: readPublishDraft("u:bob"),
    }).toMatchObject({
      visibleTitle: "Bob immediate edit",
      storedAlice: {
        title: "Alice",
        body: "Alice body",
        mapPickerBinding: ALICE_BINDING,
      },
      storedBob: {
        title: "Bob immediate edit",
        body: "Bob body",
        mapPickerBinding: BOB_BINDING,
      },
    });
  });

  it("treats anonymous as a re-readable scope across guest -> A -> guest -> A", async () => {
    seedDraft(PUBLISH_DRAFT_SCOPE_ANONYMOUS, "Guest", "Guest body");
    seedDraft("u:alice", "Alice", "Alice body");
    const h = createHarness({ userId: null, identityLoaded: true });
    await flushScopeTransition();
    const firstGuest = h.title.value;

    h.userId.value = "alice";
    await flushScopeTransition();
    const firstAlice = h.title.value;

    h.userId.value = null;
    await flushScopeTransition();
    const secondGuest = h.title.value;

    h.userId.value = "alice";
    await flushScopeTransition();
    const secondAlice = h.title.value;

    expect({ firstGuest, firstAlice, secondGuest, secondAlice }).toEqual({
      firstGuest: "Guest",
      firstAlice: "Alice",
      secondGuest: "Guest",
      secondAlice: "Alice",
    });
  });

  it("keeps a target with no snapshot empty on every entry", async () => {
    seedDraft("u:alice", "Alice", "Alice body");
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();

    h.userId.value = "bob";
    await flushScopeTransition();
    const firstBob = h.title.value;

    h.userId.value = "alice";
    await flushScopeTransition();
    const secondAlice = h.title.value;

    h.userId.value = "bob";
    await flushScopeTransition();
    const secondBob = h.title.value;

    expect({ firstBob, secondAlice, secondBob }).toEqual({
      firstBob: "",
      secondAlice: "Alice",
      secondBob: "",
    });
  });

  it("persists pending image metadata, then clears File objects through the transition reset", async () => {
    seedDraft("u:alice", "Alice", "Alice body");
    seedDraft("u:bob", "Bob", "Bob body");
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();
    h.resetTransientState.mockClear();

    h.selectedFiles.value = [{ name: "alice-private.jpg" } as File];
    await flushScopeTransition();
    h.userId.value = "bob";
    await flushScopeTransition();

    expect({
      resetCalls: h.resetTransientState.mock.calls.length,
      resetObservedTitles: h.resetObservedTitles,
      selectedFileCount: h.selectedFiles.value.length,
      targetTitle: h.title.value,
      storedAlicePendingImages: readPublishDraft("u:alice")?.pendingImageCount,
      storedBobPendingImages: readPublishDraft("u:bob")?.pendingImageCount,
    }).toEqual({
      resetCalls: 1,
      resetObservedTitles: ["Alice"],
      selectedFileCount: 0,
      targetTitle: "Bob",
      storedAlicePendingImages: 1,
      storedBobPendingImages: 0,
    });
  });

  it("orders outgoing persistence, reset, target restore, ownership, and later target-only writes", async () => {
    seedDraft("u:alice", "Alice", "Alice body", ALICE_BINDING);
    seedDraft("u:bob", "Bob", "Bob body", BOB_BINDING);
    const storage = sessionStorage as InstrumentedStorage;
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();

    const restoreGeneration = h.session.restoreGeneration;
    if (restoreGeneration) {
      h.scope.run(() => {
        watch(
          restoreGeneration,
          (generation) => {
            storage.recordMarker(`restoreGeneration:${generation}`);
          },
          { flush: "sync" },
        );
      });
    }
    storage.resetActivity();

    h.title.value = "Alice latest before switch";
    h.userId.value = "bob";
    await flushScopeTransition();

    const transitionOperations = storage.getOperations();
    const resetIndex = transitionOperations.findIndex(
      (operation) => operation.type === "marker" && operation.key === "resetTransientState",
    );
    const generationIndex = transitionOperations.findIndex(
      (operation) => operation.type === "marker" && operation.key === "restoreGeneration:2",
    );
    const aliceWriteIndexes = transitionOperations.flatMap((operation, index) =>
      operation.type === "set" && operation.key.endsWith("::u:alice") ? [index] : [],
    );
    const bobReadIndexes = transitionOperations.flatMap((operation, index) =>
      operation.type === "get" && operation.key.endsWith("::u:bob") ? [index] : [],
    );
    const bobWriteIndexes = transitionOperations.flatMap((operation, index) =>
      operation.type === "set" && operation.key.endsWith("::u:bob") ? [index] : [],
    );
    const transitionDraftMutations = transitionOperations
      .filter(
        (operation) =>
          (operation.type === "set" || operation.type === "remove") &&
          operation.key.startsWith("lian.publishDraft.sameSession::"),
      )
      .map((operation) => ({
        type: operation.type,
        key: operation.key,
        payload: operation.value ? JSON.parse(operation.value) : null,
      }));

    storage.resetActivity();
    h.body.value = "Bob edit after ownership";
    await flushScopeTransition();
    const laterDraftMutations = storage
      .getOperations()
      .filter(
        (operation) =>
          (operation.type === "set" || operation.type === "remove") &&
          operation.key.startsWith("lian.publishDraft.sameSession::"),
      )
      .map((operation) => ({
        type: operation.type,
        key: operation.key,
        payload: operation.value ? JSON.parse(operation.value) : null,
      }));

    expect({
      outgoingPersistedBeforeReset:
        resetIndex >= 0 && aliceWriteIndexes.some((index) => index < resetIndex),
      noOutgoingWriteAfterReset:
        resetIndex >= 0 && aliceWriteIndexes.every((index) => index < resetIndex),
      targetReadAfterResetBeforeOwnership:
        resetIndex >= 0 &&
        generationIndex > resetIndex &&
        bobReadIndexes.some((index) => index > resetIndex && index < generationIndex),
      noTargetWriteBeforeOwnership:
        generationIndex >= 0 && bobWriteIndexes.every((index) => index > generationIndex),
      targetTitle: h.title.value,
      transitionDraftMutations,
      laterDraftMutations,
    }).toEqual({
      outgoingPersistedBeforeReset: true,
      noOutgoingWriteAfterReset: true,
      targetReadAfterResetBeforeOwnership: true,
      noTargetWriteBeforeOwnership: true,
      targetTitle: "Bob",
      transitionDraftMutations: [
        {
          type: "set",
          key: "lian.publishDraft.sameSession::u:alice",
          payload: {
            title: "Alice latest before switch",
            body: "Alice body",
            tagInput: "#alice",
            placeName: "Alice place",
            visibility: "public",
            selectedMapLocation: null,
            mapPickerBinding: ALICE_BINDING,
            pendingImageCount: 0,
          },
        },
        {
          type: "set",
          key: "lian.publishDraft.sameSession::u:bob",
          payload: {
            title: "Bob",
            body: "Bob body",
            tagInput: "#bob",
            placeName: "Bob place",
            visibility: "public",
            selectedMapLocation: null,
            mapPickerBinding: BOB_BINDING,
            pendingImageCount: 0,
          },
        },
      ],
      laterDraftMutations: [
        {
          type: "set",
          key: "lian.publishDraft.sameSession::u:bob",
          payload: {
            title: "Bob",
            body: "Bob edit after ownership",
            tagInput: "#bob",
            placeName: "Bob place",
            visibility: "public",
            selectedMapLocation: null,
            mapPickerBinding: BOB_BINDING,
            pendingImageCount: 0,
          },
        },
      ],
    });
  });

  it("keeps an initial pending handoff for the existing mount consume path", async () => {
    seedDraft("u:alice", "Alice", "Alice body", ALICE_BINDING);
    setPendingPublishLocation(PENDING_BINDING);

    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();
    const consumedByMountPath = consumePendingPublishLocation();

    expect({
      generation: h.session.restoreGeneration?.value ?? null,
      resetCalls: h.resetTransientState.mock.calls.length,
      title: h.title.value,
      binding: h.mapPickerBinding.value,
      consumedByMountPath,
      consumedAgain: consumePendingPublishLocation(),
    }).toEqual({
      generation: 1,
      resetCalls: 0,
      title: "Alice",
      binding: ALICE_BINDING,
      consumedByMountPath: PENDING_BINDING,
      consumedAgain: null,
    });
  });

  it("discards an unowned pending handoff before target restore and restore-generation notice", async () => {
    seedDraft("u:alice", "Alice", "Alice body", ALICE_BINDING);
    seedDraft("u:bob", "Bob", "Bob body", BOB_BINDING);
    const h = createHarness({ userId: "alice", identityLoaded: true });
    await flushScopeTransition();

    let postRestoreConsumeCount = 0;
    const restoreNotificationTitles: string[] = [];
    const restoreGeneration = h.session.restoreGeneration;
    if (restoreGeneration) {
      h.scope.run(() => {
        watch(restoreGeneration, () => {
          if (!h.session.restoreSettled.value) return;
          restoreNotificationTitles.push(h.title.value);
          const pending = consumePendingPublishLocation();
          if (!pending || pending.source !== "map_picker") return;
          postRestoreConsumeCount += 1;
          h.mapPickerBinding.value = pending;
          h.placeName.value = pending.kind === "place" ? pending.name : pending.label || "";
        });
      });
    }

    setPendingPublishLocation(PENDING_BINDING);
    h.userId.value = "bob";
    await flushScopeTransition();

    expect({
      generation: restoreGeneration?.value ?? null,
      discardedHandoffs: h.discardedHandoffs,
      discardObservedTitles: h.resetObservedTitles,
      discardObservedGenerations: h.discardObservedGenerations,
      postRestoreConsumeCount,
      restoreNotificationTitles,
      currentBinding: h.mapPickerBinding.value,
      storedAliceBinding: readPublishDraft("u:alice")?.mapPickerBinding,
      storedBobBinding: readPublishDraft("u:bob")?.mapPickerBinding,
    }).toEqual({
      generation: 2,
      discardedHandoffs: [PENDING_BINDING],
      discardObservedTitles: ["Alice"],
      discardObservedGenerations: [1],
      postRestoreConsumeCount: 0,
      restoreNotificationTitles: ["Bob"],
      currentBinding: BOB_BINDING,
      storedAliceBinding: ALICE_BINDING,
      storedBobBinding: BOB_BINDING,
    });
  });
});
