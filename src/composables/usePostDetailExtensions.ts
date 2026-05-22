/**
 * Post detail extension wiring (PRD V0.1 §6.3 / §6.5 / §11.2 / §11.3).
 *
 * Bundles the event / help-vote / help-manage state and handler glue that the
 * PostDetailPanel needs into a single composable, so the panel itself can stay
 * focused on layout and the three independent flows (event, help vote, help
 * manage) are still owned by their dedicated composables underneath.
 *
 * The panel keeps `handleHelpOpenLinkedEvent` because it has to emit `retry`
 * on the panel, which is panel-shaped state.
 *
 * Issue #703 — also derives `eventManageable` (event author OR admin) so the
 * detail view can render the "结束活动" action. The probe runs once per event
 * post; non-event posts skip it entirely.
 */

import { computed, ref, watch, type Ref } from "vue";
import { fetchAdminMe, isAdminMeRoleEligible } from "../api/admin";
import { fetchAuthMe } from "../api/profile";
import {
  EVENT_CANCEL_SUCCESS,
  EVENT_COMPLETE_SUCCESS,
  EVENT_JOIN_SUCCESS,
  HELP_MANAGE_CLOSE_SUCCESS,
  HELP_MANAGE_LINK_SUCCESS,
  HELP_MANAGE_RESOLVE_SUCCESS,
  HELP_UNVOTE_SUCCESS,
  HELP_VOTE_SUCCESS,
} from "../config/brand";
import type { PostDetail } from "../types/post";
import type { EventPostExtension, HelpPostExtension } from "../types/post-extensions";
import type { FeedItemId } from "../types/feed";
import { useEventActions } from "./useEventActions";
import { useHelpVote } from "./useHelpVote";
import { useHelpManage } from "./useHelpManage";
import { useServerChanBinding } from "../features/profile/useServerChanBinding";
import { useServerChanPreferences } from "../features/profile/useServerChanPreferences";
import { useServerChanOptIn } from "../features/profile/useServerChanOptIn";

interface UsePostDetailExtensionsOptions {
  post: Ref<PostDetail | null>;
  postId: Ref<FeedItemId | null>;
  isAuthenticated: Ref<boolean>;
  onMessage: (message: string) => void;
}

export function usePostDetailExtensions(options: UsePostDetailExtensionsOptions) {
  const { post, postId, isAuthenticated, onMessage } = options;

  const eventLocalEvent = ref<EventPostExtension | undefined>(undefined);
  const eventJoined = ref(false);
  const liveEvent = computed<EventPostExtension | undefined>(
    () => eventLocalEvent.value || post.value?.event,
  );

  // Issue #703 — author + admin probe for the "结束活动" surface. Mirrors the
  // pattern in PostDetailTradeManageBlock: trust a server-shipped flag when
  // present, otherwise resolve client-side via /api/auth/me + /api/admin/me.
  // We intentionally only probe when the post has an event extension so
  // non-event detail loads do not fan out admin-me calls.
  const currentUserId = ref<string>("");
  const currentUsername = ref<string>("");
  const isAdminViewer = ref(false);
  const eventManageable = computed<boolean>(() => {
    const currentPost = post.value;
    if (!currentPost?.event) return false;
    if (currentPost.eventManageable !== undefined) return currentPost.eventManageable;
    if (isAdminViewer.value) return true;
    const actor = currentPost.actor;
    if (!actor) return false;
    if (currentUserId.value && actor.id && currentUserId.value === actor.id) return true;
    if (currentUsername.value && actor.username && currentUsername.value === actor.username) {
      return true;
    }
    return false;
  });

  // V0.1 surface — backend authoritative for action permission. The publish
  // composable already gates create-event by audience.isAllowed; on the read
  // side we trust the eligibility the backend implies by returning the post
  // and let the join endpoint return a typed error if the viewer is
  // ineligible. Keeping this true means UI does not double-gate.
  //
  // ps#504 I2 — after a successful join (NOT cancel), if the viewer has bound
  // Server酱 and has not turned on `eventStartingReminder`, prompt them via
  // the opt-in dialog. The dialog state is a singleton driven by
  // `useServerChanOptIn`; the view (PostDetailPanel) renders the actual
  // ServerChanOptInDialog component bound to the same state.
  const serverChanBinding = useServerChanBinding();
  const serverChanPreferences = useServerChanPreferences();
  const serverChanOptIn = useServerChanOptIn({
    binding: serverChanBinding,
    preferences: serverChanPreferences,
  });

  const eventActions = useEventActions({
    event: liveEvent,
    hasJoined: eventJoined,
    isAuthenticated,
    isEligibleForScope: () => true,
    onChange: ({ event, joined }) => {
      const wasJoined = eventJoined.value;
      eventLocalEvent.value = event;
      eventJoined.value = joined;
      // Only when transitioning from "not joined" → "joined" do we offer the
      // reminder. Cancel-join must never trigger the prompt.
      if (!wasJoined && joined) {
        serverChanOptIn.openEventStartDialog();
      }
    },
    onMessage,
  });

  function handleEventAct() {
    const mode = eventActions.plan.value.mode;
    if (mode === "join") void eventActions.act(EVENT_JOIN_SUCCESS);
    else if (mode === "cancel") void eventActions.act(EVENT_CANCEL_SUCCESS);
  }

  function handleEventComplete() {
    if (!eventManageable.value) return;
    void eventActions.complete(EVENT_COMPLETE_SUCCESS);
  }

  const helpLocal = ref<HelpPostExtension | undefined>(undefined);
  const helpVoted = ref(false);
  const liveHelp = computed<HelpPostExtension | undefined>(
    () => helpLocal.value || post.value?.help,
  );

  const helpVote = useHelpVote({
    tid: postId,
    help: liveHelp,
    hasVoted: helpVoted,
    isAuthenticated,
    onChange: ({ help, voted }) => {
      helpLocal.value = help;
      helpVoted.value = voted;
    },
    onMessage,
  });

  function handleHelpAct() {
    const mode = helpVote.plan.value.mode;
    if (mode === "vote") void helpVote.act(HELP_VOTE_SUCCESS);
    else if (mode === "unvote") void helpVote.act(HELP_UNVOTE_SUCCESS);
  }

  const helpManageable = computed(() => Boolean(post.value?.helpManageable));
  const helpManage = useHelpManage({
    help: liveHelp,
    isManageable: helpManageable,
    onChange: (next) => {
      helpLocal.value = next;
    },
    onMessage,
  });

  function handleHelpManageLinkEvent(eventTid: number) {
    void helpManage.linkEvent(eventTid, HELP_MANAGE_LINK_SUCCESS);
  }
  function handleHelpManageUnlinkEvent() {
    void helpManage.unlinkEvent(HELP_MANAGE_LINK_SUCCESS);
  }
  function handleHelpManageResolve() {
    void helpManage.markResolved(HELP_MANAGE_RESOLVE_SUCCESS);
  }
  function handleHelpManageClose() {
    void helpManage.markClosed(HELP_MANAGE_CLOSE_SUCCESS);
  }

  async function probeEventManageable(currentPost: PostDetail | null) {
    currentUserId.value = "";
    currentUsername.value = "";
    isAdminViewer.value = false;
    if (!currentPost?.event) return;
    if (currentPost.eventManageable !== undefined) return; // server already decided
    try {
      const [me, adminMe] = await Promise.all([
        fetchAuthMe().catch(() => null),
        fetchAdminMe().catch(() => null),
      ]);
      if (me) {
        currentUserId.value = me.id || "";
        currentUsername.value = me.username || "";
      }
      isAdminViewer.value = isAdminMeRoleEligible(adminMe);
    } catch {
      // Soft-fail — manageable stays false, and the UI hides the button.
    }
  }

  function reset(next: PostDetail | null) {
    eventLocalEvent.value = undefined;
    eventJoined.value = Boolean(next?.eventJoined);
    helpLocal.value = undefined;
    helpVoted.value = Boolean(next?.helpVoted);
    void probeEventManageable(next);
  }

  watch(post, reset, { immediate: true });

  return {
    liveEvent,
    eventPlan: eventActions.plan,
    eventBusy: eventActions.busy,
    eventActionError: eventActions.actionError,
    handleEventAct,
    eventManageable,
    eventCompleteBusy: eventActions.completeBusy,
    eventCompleteActionError: eventActions.completeActionError,
    handleEventComplete,

    liveHelp,
    helpPlan: helpVote.plan,
    helpBusy: helpVote.busy,
    helpActionError: helpVote.actionError,
    handleHelpAct,

    helpManagePlan: helpManage.plan,
    helpManageBusy: helpManage.busy,
    helpManageActionError: helpManage.actionError,
    handleHelpManageLinkEvent,
    handleHelpManageUnlinkEvent,
    handleHelpManageResolve,
    handleHelpManageClose,

    serverChanOptIn,
  };
}
