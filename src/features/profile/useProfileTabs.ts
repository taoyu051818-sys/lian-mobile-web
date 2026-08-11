import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from "vue";
import { fetchProfileTab } from "../../api/profile";
import { accountReadHistoryScope, getRecentReadHistoryIds } from "../../platform/browser-storage";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  EMPTY_HISTORY,
  EMPTY_SAVED,
  EMPTY_LIKED,
  ERROR_LOAD_GENERIC,
  ORDERS_LIST_EMPTY_HEADLINE,
  PROFILE_TAB_HISTORY,
  PROFILE_TAB_SAVED,
  PROFILE_TAB_LIKED,
  PROFILE_TAB_POSTS,
  PROFILE_TAB_REPLIES,
  PROFILE_TAB_DRAFTS,
  PROFILE_TAB_MAP_CONTRIBUTIONS,
  PROFILE_TAB_ORDERS,
  PROFILE_EMPTY_CONTENT,
  PROFILE_LIST_ERROR_PREFIX,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type {
  ProfileListItem,
  ProfileListResponse,
  ProfilePostsContentFilter,
  ProfileTabKey,
  ProfileUser,
} from "../../types/profile";
import {
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../reactions";

type MembershipTab = "liked" | "saved";

interface RemovedRowCandidate {
  row: ProfileListItem;
  slot: number;
  sequence: number;
}

interface CommittedMembershipOwner {
  tab: MembershipTab;
  accountToken: string;
  sequenceFloor: number;
  latestSequenceByTid: Map<number, number>;
  candidates: Map<number, RemovedRowCandidate>;
}

interface PhysicalProfileRequest {
  generation: number;
  tab: ProfileTabKey;
  accountToken: string | null;
  boundary: number;
  membershipEnabled: boolean;
  latestByTid: Map<number, PostReactionSettlement>;
  candidates: Map<number, RemovedRowCandidate>;
}

interface StartedProfileRequest {
  request: PhysicalProfileRequest;
  transport: Promise<ProfileListResponse>;
}

interface SettledProfileRequest {
  request: PhysicalProfileRequest;
  response: ProfileListResponse;
}

export interface UseProfileTabsOptions {
  user: Ref<ProfileUser | null>;
  enterGuestState: () => void;
  isMissingSessionError: (error: unknown) => boolean;
  refreshCurrentSession: () => Promise<ProfileUser | null>;
  resetAccountPresentation: () => void;
  settlements?: PostReactionSettlementPort;
}

function isMembershipTab(tab: ProfileTabKey): tab is MembershipTab {
  return tab === "liked" || tab === "saved";
}

function isValidTid(tid: unknown): tid is number {
  return typeof tid === "number" && Number.isInteger(tid) && tid > 0;
}

function eventMembershipTab(event: PostReactionSettlement): MembershipTab {
  return event.kind === "like" ? "liked" : "saved";
}

function eventIsPresent(event: PostReactionSettlement): boolean {
  return event.kind === "like" ? event.liked : event.bookmarked;
}

export function useProfileTabs(options: UseProfileTabsOptions) {
  const {
    enterGuestState,
    isMissingSessionError,
    refreshCurrentSession,
    resetAccountPresentation,
  } = options;

  const listLoading = ref(false);
  const listError = ref("");
  const activeTab = ref<ProfileTabKey>("history");
  const profileItems = ref<ProfileListItem[]>([]);
  // Only used by the posts tab. Keeping the value while another tab is active
  // preserves the selected chip when the user returns to posts.
  const postsContentFilter = ref<ProfilePostsContentFilter>("all");
  let requestGeneration = 0;
  let terminal = false;
  let activeRequest: PhysicalProfileRequest | null = null;
  let committedOwner: CommittedMembershipOwner | null = null;
  const settlements = options.settlements ?? postReactionSettlements;

  const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
    { key: "history", label: PROFILE_TAB_HISTORY, empty: EMPTY_HISTORY },
    { key: "saved", label: PROFILE_TAB_SAVED, empty: EMPTY_SAVED },
    { key: "liked", label: PROFILE_TAB_LIKED, empty: EMPTY_LIKED },
    { key: "posts", label: PROFILE_TAB_POSTS, empty: PROFILE_EMPTY_CONTENT },
    { key: "replies", label: PROFILE_TAB_REPLIES, empty: PROFILE_EMPTY_CONTENT },
    { key: "drafts", label: PROFILE_TAB_DRAFTS, empty: PROFILE_EMPTY_CONTENT },
    {
      key: "map-contributions",
      label: PROFILE_TAB_MAP_CONTRIBUTIONS,
      empty: PROFILE_EMPTY_CONTENT,
    },
    // Orders owns a separate transport and view block. It remains in this
    // array so tab selection and empty-state metadata keep one public shape.
    { key: "orders", label: PROFILE_TAB_ORDERS, empty: ORDERS_LIST_EMPTY_HEADLINE },
  ];

  const listEmptyText = computed(
    () => tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT,
  );

  function readHistoryIds() {
    const scope = accountReadHistoryScope(options.user.value?.id ?? "");
    return scope ? getRecentReadHistoryIds(scope, localStorage, 50) : [];
  }

  function accountId(profileUser: ProfileUser | null) {
    return accountReadHistoryScope(profileUser?.id ?? "")?.userId ?? null;
  }

  function currentAccountToken() {
    return accountId(options.user.value);
  }

  function fetchCurrentProfileTab(tab: ProfileTabKey) {
    const tids: FeedItemId[] = tab === "history" ? readHistoryIds() : [];
    const contentFilter: ProfilePostsContentFilter =
      tab === "posts" ? postsContentFilter.value : "all";
    return fetchProfileTab(tab, tids, { contentFilter });
  }

  function retirePhysicalRequest(request: PhysicalProfileRequest | null = activeRequest) {
    if (!request) return;
    request.membershipEnabled = false;
    request.latestByTid.clear();
    request.candidates.clear();
    if (activeRequest === request) activeRequest = null;
  }

  function retireCommittedOwner(owner: CommittedMembershipOwner | null = committedOwner) {
    if (!owner) return;
    owner.latestSequenceByTid.clear();
    owner.candidates.clear();
    if (committedOwner === owner) committedOwner = null;
  }

  function requestIsCurrent(request: PhysicalProfileRequest) {
    if (
      terminal ||
      activeRequest !== request ||
      request.generation !== requestGeneration ||
      activeTab.value !== request.tab
    ) {
      return false;
    }
    return request.accountToken === null || request.accountToken === currentAccountToken();
  }

  function copyKnownRowsIntoRequest(request: PhysicalProfileRequest) {
    const owner = committedOwner;
    if (
      !owner ||
      !isMembershipTab(request.tab) ||
      owner.tab !== request.tab ||
      owner.accountToken !== request.accountToken ||
      owner.accountToken !== currentAccountToken() ||
      activeTab.value !== request.tab
    ) {
      return;
    }

    for (const [slot, row] of profileItems.value.entries()) {
      if (!isValidTid(row.tid) || request.candidates.has(row.tid)) continue;
      request.candidates.set(row.tid, { row, slot, sequence: request.boundary });
    }
    for (const [tid, candidate] of owner.candidates) {
      if (!request.candidates.has(tid)) request.candidates.set(tid, { ...candidate });
    }
  }

  function captureRequestSettlement(event: PostReactionSettlement) {
    const request = activeRequest;
    if (
      terminal ||
      !request ||
      !request.membershipEnabled ||
      !isValidTid(event.tid) ||
      !isMembershipTab(request.tab) ||
      eventMembershipTab(event) !== request.tab ||
      request.accountToken === null ||
      request.accountToken !== currentAccountToken() ||
      request.generation !== requestGeneration ||
      activeTab.value !== request.tab ||
      event.sequence <= request.boundary
    ) {
      return;
    }

    const previous = request.latestByTid.get(event.tid);
    if (previous && previous.sequence >= event.sequence) return;

    const owner = committedOwner;
    const canCaptureLiveOwnerRow =
      owner !== null &&
      committedOwner === owner &&
      owner.tab === request.tab &&
      owner.accountToken === request.accountToken &&
      owner.accountToken === currentAccountToken() &&
      activeTab.value === owner.tab;
    if (!eventIsPresent(event) && !request.candidates.has(event.tid) && canCaptureLiveOwnerRow) {
      const slot = profileItems.value.findIndex((row) => row.tid === event.tid);
      if (slot >= 0) {
        request.candidates.set(event.tid, {
          row: profileItems.value[slot],
          slot,
          sequence: event.sequence,
        });
      }
    }
    request.latestByTid.set(event.tid, event);
  }

  function applyCommittedSettlement(event: PostReactionSettlement) {
    const owner = committedOwner;
    if (
      terminal ||
      !owner ||
      !isValidTid(event.tid) ||
      eventMembershipTab(event) !== owner.tab ||
      activeTab.value !== owner.tab ||
      owner.accountToken !== currentAccountToken() ||
      event.sequence <= owner.sequenceFloor ||
      event.sequence <= (owner.latestSequenceByTid.get(event.tid) ?? owner.sequenceFloor)
    ) {
      return;
    }

    // Claim sequence authority before any reactive write can re-enter Profile.
    owner.latestSequenceByTid.set(event.tid, event.sequence);
    const rows = profileItems.value;

    if (!eventIsPresent(event)) {
      const slot = rows.findIndex((row) => row.tid === event.tid);
      if (slot < 0) return;
      owner.candidates.set(event.tid, {
        row: rows[slot],
        slot,
        sequence: event.sequence,
      });
      profileItems.value = rows.filter((row) => row.tid !== event.tid);
      return;
    }

    if (rows.some((row) => row.tid === event.tid)) {
      owner.candidates.delete(event.tid);
      return;
    }
    const candidate = owner.candidates.get(event.tid);
    if (!candidate) return;
    owner.candidates.delete(event.tid);
    const slot = Math.min(Math.max(candidate.slot, 0), rows.length);
    const restored = rows.slice();
    restored.splice(slot, 0, candidate.row);
    profileItems.value = restored;
  }

  function handleSettlement(event: PostReactionSettlement) {
    if (terminal || !isValidTid(event.tid)) return;
    // The request branch must run first so a negative can snapshot the row
    // before immediate committed-list projection removes it.
    captureRequestSettlement(event);
    applyCommittedSettlement(event);
  }

  function startPhysicalRequest(
    generation: number,
    tab: ProfileTabKey,
  ): StartedProfileRequest | null {
    retirePhysicalRequest();
    const request: PhysicalProfileRequest = {
      generation,
      tab,
      accountToken: currentAccountToken(),
      boundary: 0,
      membershipEnabled: false,
      latestByTid: new Map(),
      candidates: new Map(),
    };
    activeRequest = request;

    try {
      request.boundary = settlements.currentSequence();
    } catch (error) {
      retirePhysicalRequest(request);
      throw error;
    }

    if (!requestIsCurrent(request)) {
      retirePhysicalRequest(request);
      return null;
    }

    if (isMembershipTab(tab) && request.accountToken !== null) {
      copyKnownRowsIntoRequest(request);
      if (!requestIsCurrent(request)) {
        retirePhysicalRequest(request);
        return null;
      }
      request.membershipEnabled = true;
    }

    try {
      // No await may separate enabling capture from entering the transport.
      const transport = fetchCurrentProfileTab(tab);
      return { request, transport };
    } catch (error) {
      retirePhysicalRequest(request);
      throw error;
    }
  }

  async function runPhysicalRequest(
    generation: number,
    tab: ProfileTabKey,
  ): Promise<SettledProfileRequest | null> {
    const started = startPhysicalRequest(generation, tab);
    if (!started) return null;
    try {
      const response = await started.transport;
      if (!requestIsCurrent(started.request)) {
        retirePhysicalRequest(started.request);
        return null;
      }
      return { request: started.request, response };
    } catch (error) {
      retirePhysicalRequest(started.request);
      throw error;
    }
  }

  function overlayResponseMembership(
    responseItems: ProfileListItem[],
    latestByTid: ReadonlyMap<number, PostReactionSettlement>,
    knownCandidates: ReadonlyMap<number, RemovedRowCandidate>,
  ) {
    let items = responseItems;
    const candidates = new Map<number, RemovedRowCandidate>();

    for (const [tid, event] of latestByTid) {
      if (!isValidTid(tid)) continue;
      const responseSlot = responseItems.findIndex((row) => row.tid === tid);
      if (!eventIsPresent(event)) {
        const candidate =
          responseSlot >= 0
            ? { row: responseItems[responseSlot], slot: responseSlot, sequence: event.sequence }
            : knownCandidates.get(tid);
        if (candidate) candidates.set(tid, { ...candidate });
        if (items.some((row) => row.tid === tid)) {
          items = items.filter((row) => row.tid !== tid);
        }
        continue;
      }

      if (items.some((row) => row.tid === tid)) continue;
      const candidate = knownCandidates.get(tid);
      if (!candidate) continue;
      const slot = Math.min(Math.max(candidate.slot, 0), items.length);
      const restored = items.slice();
      restored.splice(slot, 0, candidate.row);
      items = restored;
    }

    return { items, candidates };
  }

  function commitPhysicalResponse(settled: SettledProfileRequest) {
    const { request, response } = settled;
    if (!requestIsCurrent(request)) {
      retirePhysicalRequest(request);
      return false;
    }

    const responseItems = response.items || [];
    const membershipEligible = isMembershipTab(request.tab) && request.accountToken !== null;

    if (!membershipEligible) {
      retireCommittedOwner();
      profileItems.value = responseItems;
      retirePhysicalRequest(request);
      return true;
    }

    // currentSequence may synchronously publish. The request remains enabled
    // until after this call, and its maps are snapshotted only afterwards.
    const sequenceFloor = settlements.currentSequence();
    if (!requestIsCurrent(request)) {
      retirePhysicalRequest(request);
      return false;
    }
    const latestByTid = new Map(request.latestByTid);
    const knownCandidates = new Map(request.candidates);
    const overlay = overlayResponseMembership(responseItems, latestByTid, knownCandidates);

    retireCommittedOwner();
    const nextOwner: CommittedMembershipOwner = {
      tab: request.tab as MembershipTab,
      accountToken: request.accountToken as string,
      sequenceFloor,
      latestSequenceByTid: new Map(),
      candidates: overlay.candidates,
    };
    committedOwner = nextOwner;
    // The owner is visible to synchronous ref watchers before the array is.
    profileItems.value = overlay.items;
    retirePhysicalRequest(request);
    return true;
  }

  async function loadProfileList(tab: ProfileTabKey) {
    if (terminal) return;
    const generation = ++requestGeneration;
    retirePhysicalRequest();
    if (tab !== activeTab.value) retireCommittedOwner();
    activeTab.value = tab;
    if (terminal || generation !== requestGeneration) return;

    // Orders is rendered by ProfileErrandOrdersBlock and has no profile-tab
    // endpoint. Admission still retires membership before visible list reset.
    if (tab === "orders") {
      retireCommittedOwner();
      profileItems.value = [];
      if (terminal || generation !== requestGeneration) return;
      listError.value = "";
      if (terminal || generation !== requestGeneration) return;
      listLoading.value = false;
      return;
    }

    listLoading.value = true;
    if (terminal || generation !== requestGeneration) return;
    listError.value = "";
    if (terminal || generation !== requestGeneration) return;

    try {
      let settled: SettledProfileRequest | null;
      try {
        settled = await runPhysicalRequest(generation, tab);
      } catch (error) {
        if (terminal || generation !== requestGeneration) return;
        if (!isMissingSessionError(error)) throw error;

        const refreshedUser = await refreshCurrentSession();
        if (terminal || generation !== requestGeneration) return;
        if (!refreshedUser) throw error;

        const currentId = accountId(options.user.value);
        const refreshedId = accountId(refreshedUser);
        const sameAccount = currentId !== null && refreshedId !== null && currentId === refreshedId;
        if (!sameAccount) {
          resetList();
          if (terminal) return;
          resetAccountPresentation();
          options.user.value = refreshedUser;
          if (terminal) return;
          await loadProfileList(tab);
          return;
        }

        options.user.value = refreshedUser;
        if (terminal || generation !== requestGeneration) return;

        try {
          settled = await runPhysicalRequest(generation, tab);
        } catch (retryError) {
          if (isMissingSessionError(retryError)) {
            throw new Error(
              "登录状态已刷新，但个人列表接口仍返回未授权。请稍后重试，或重新登录后再打开赞过 / 收藏。",
              { cause: retryError },
            );
          }
          throw retryError;
        }
      }

      if (!settled || terminal || generation !== requestGeneration) return;
      commitPhysicalResponse(settled);
    } catch (error) {
      if (terminal || generation !== requestGeneration) return;
      retirePhysicalRequest();
      retireCommittedOwner();
      if (isMissingSessionError(error)) {
        enterGuestState();
      } else {
        listError.value = extractErrorMessage(
          error,
          PROFILE_LIST_ERROR_PREFIX + ERROR_LOAD_GENERIC,
        );
        if (terminal || generation !== requestGeneration) return;
        profileItems.value = [];
      }
    } finally {
      // Only the latest live request owns the shared loading state.
      if (!terminal && generation === requestGeneration) listLoading.value = false;
    }
  }

  async function selectPostsContentFilter(filter: ProfilePostsContentFilter) {
    if (terminal || postsContentFilter.value === filter) return;
    postsContentFilter.value = filter;
    if (terminal || activeTab.value !== "posts") return;
    await loadProfileList("posts");
  }

  function resetList() {
    if (terminal) return;
    const generation = ++requestGeneration;
    retirePhysicalRequest();
    retireCommittedOwner();
    profileItems.value = [];
    if (terminal || generation !== requestGeneration) return;
    listError.value = "";
    if (terminal || generation !== requestGeneration) return;
    listLoading.value = false;
  }

  const unsubscribeSettlements = settlements.subscribe(handleSettlement);
  const stopAccountWatch = watch(
    () => currentAccountToken(),
    (nextToken, previousToken) => {
      if (terminal || nextToken === previousToken) return;
      requestGeneration += 1;
      retirePhysicalRequest();
      retireCommittedOwner();
      listLoading.value = false;
    },
    { flush: "sync" },
  );

  function dispose() {
    if (terminal) return;
    terminal = true;
    try {
      unsubscribeSettlements();
    } catch {
      // Cleanup is best-effort; terminal ownership is already closed.
    }
    requestGeneration += 1;
    retirePhysicalRequest();
    retireCommittedOwner();
    listLoading.value = false;
    try {
      stopAccountWatch();
    } catch {
      // A custom watcher implementation must not reopen terminal authority.
    }
  }

  if (getCurrentScope()) onScopeDispose(dispose);

  return {
    listLoading,
    listError,
    activeTab,
    profileItems,
    tabs,
    listEmptyText,
    postsContentFilter,
    loadProfileList,
    selectPostsContentFilter,
    resetList,
    dispose,
  };
}
