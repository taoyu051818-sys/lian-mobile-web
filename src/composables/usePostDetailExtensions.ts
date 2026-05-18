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
 */

import { computed, ref, watch, type Ref } from "vue";
import {
  EVENT_JOIN_SUCCESS,
  EVENT_CANCEL_SUCCESS,
  HELP_VOTE_SUCCESS,
  HELP_UNVOTE_SUCCESS,
  HELP_MANAGE_LINK_SUCCESS,
  HELP_MANAGE_RESOLVE_SUCCESS,
  HELP_MANAGE_CLOSE_SUCCESS,
} from "../config/brand";
import type { PostDetail } from "../types/post";
import type { EventPostExtension, HelpPostExtension } from "../types/post-extensions";
import type { FeedItemId } from "../types/feed";
import { useEventActions } from "./useEventActions";
import { useHelpVote } from "./useHelpVote";
import { useHelpManage } from "./useHelpManage";

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

  // V0.1 surface — backend authoritative for action permission. The publish
  // composable already gates create-event by audience.isAllowed; on the read
  // side we trust the eligibility the backend implies by returning the post
  // and let the join endpoint return a typed error if the viewer is
  // ineligible. Keeping this true means UI does not double-gate.
  const eventActions = useEventActions({
    event: liveEvent,
    hasJoined: eventJoined,
    isAuthenticated,
    isEligibleForScope: () => true,
    onChange: ({ event, joined }) => {
      eventLocalEvent.value = event;
      eventJoined.value = joined;
    },
    onMessage,
  });

  function handleEventAct() {
    const mode = eventActions.plan.value.mode;
    if (mode === "join") void eventActions.act(EVENT_JOIN_SUCCESS);
    else if (mode === "cancel") void eventActions.act(EVENT_CANCEL_SUCCESS);
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

  function reset(next: PostDetail | null) {
    eventLocalEvent.value = undefined;
    eventJoined.value = Boolean(next?.eventJoined);
    helpLocal.value = undefined;
    helpVoted.value = Boolean(next?.helpVoted);
  }

  watch(post, reset, { immediate: true });

  return {
    liveEvent,
    eventPlan: eventActions.plan,
    eventBusy: eventActions.busy,
    eventActionError: eventActions.actionError,
    handleEventAct,

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
  };
}
