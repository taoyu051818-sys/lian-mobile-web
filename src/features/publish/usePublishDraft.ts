import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  ERROR_PUBLISH_IMAGE,
  PUBLISH_IMAGE_MAX,
  PUBLISH_IMAGE_UPLOADING,
  PUBLISH_IMAGE_READY,
  PUBLISH_IMAGE_COUNT_SUFFIX,
  PUBLISH_VIS_PUBLIC,
  PUBLISH_VIS_CAMPUS,
  PUBLISH_VIS_SCHOOL,
  PUBLISH_VIS_PRIVATE,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  MAX_PUBLISH_IMAGE_COUNT,
  normalizePublishTag,
  uploadPublishImage,
  validatePublishImageSelection,
} from "../../api/publish";
import { validatePublishForm } from "../../domain/validation/forms";
import type { PublishVisibility } from "../../types/publish";
import type { AudienceVisibility } from "../../types/audience";
import { useAudienceOptions } from "../../composables/useAudienceOptions";
import { usePublishIdentity } from "./usePublishIdentity";
import { usePublishAi } from "./usePublishAi";
import { useMerchantPublishDraft } from "./useMerchantPublishDraft";
import { useTradePublishDraft } from "./useTradePublishDraft";
import type { SuggestedComponent } from "../../types/publishSuggestion";

// PR-3 (#813 follow-up): "event" promoted to a peer of regular / merchant /
// trade so the publishKind switch is the single "what kind of post am I
// making" decision. usePublishSubmit still branches on eventDraft.postType
// === "event" — that ref is kept in sync with publishKind via a watch in
// PublishView so the submit/createEvent contract is unchanged.
export type PublishKind = "regular" | "event" | "merchant" | "trade";

/**
 * Body candidate slot (PRD V0.2 step B).
 *
 * The LLM-polished body lives in `bodyCandidate` until the user explicitly
 * applies it via `applyBodyCandidate`; the previous body is parked in
 * `bodyBeforeCandidate` so a single `revertBodyCandidate` call rolls back.
 *
 * Persistence: transient. The candidate is LLM-derived and can always be
 * regenerated; persisting it across sessions would re-surface stale
 * suggestions (e.g. user edited body offline, candidate is now wrong) and
 * the PRD explicitly reserves storage for what the user typed. Step C will
 * write into this slot from the LLM response — same lifetime, same rules.
 */
export interface PublishBodyCandidateApi {
  body: Ref<string>;
  bodyCandidate: Ref<string | null>;
  bodyBeforeCandidate: Ref<string | null>;
  bodyCandidateApplied: ComputedRef<boolean>;
  bodyCandidateVisible: ComputedRef<boolean>;
  setBodyCandidate: (value: string | null) => void;
  applyBodyCandidate: () => void;
  revertBodyCandidate: () => void;
}

export const PublishBodyCandidateKey: InjectionKey<PublishBodyCandidateApi> =
  Symbol("PublishBodyCandidate");

export function useInjectedBodyCandidate(): PublishBodyCandidateApi {
  const api = inject(PublishBodyCandidateKey, null);
  if (!api) {
    throw new Error(
      "usePublishDraft must be installed (provided) before consuming PublishBodyCandidateKey",
    );
  }
  return api;
}

/**
 * Pure factory for the candidate state machine.
 *
 * Exported so tests can drive the state machine directly without booting a
 * component (the surrounding `usePublishDraft` calls `provide()`, which
 * requires a setup context).
 */
export function createBodyCandidate(body: Ref<string>): PublishBodyCandidateApi {
  const bodyCandidate = ref<string | null>(null);
  const bodyBeforeCandidate = ref<string | null>(null);

  // The candidate's lifecycle relative to `body`:
  //   1. setBodyCandidate(x)       → bodyCandidate = x, body untouched.
  //   2. applyBodyCandidate()      → save body into bodyBeforeCandidate, set
  //                                  body = bodyCandidate. Candidate stays so
  //                                  the bar morphs into "撤回润色" mode.
  //   3. revertBodyCandidate()     → restore body from bodyBeforeCandidate.
  //                                  Both candidate and bodyBeforeCandidate
  //                                  stay so the bar reverts to "帮我润色"
  //                                  mode (still applicable, one-step revert
  //                                  is the only history we keep).
  //   4. user types in body to a   → invalidate the entire candidate (no
  //      third value                 implicit overwrite, typing means
  //                                   "I don't want this suggestion").
  function setBodyCandidate(value: string | null) {
    bodyCandidate.value = value;
    if (value === null) {
      bodyBeforeCandidate.value = null;
    }
  }
  function applyBodyCandidate() {
    if (bodyCandidate.value === null) return;
    bodyBeforeCandidate.value = body.value;
    body.value = bodyCandidate.value;
  }
  function revertBodyCandidate() {
    if (bodyBeforeCandidate.value === null) return;
    body.value = bodyBeforeCandidate.value;
  }
  const bodyCandidateApplied = computed(
    () =>
      bodyCandidate.value !== null &&
      bodyBeforeCandidate.value !== null &&
      body.value === bodyCandidate.value,
  );
  // Bar shows when there is a candidate AND either we're in applied mode
  // (offer revert) or the candidate is a fresh, distinct suggestion the user
  // has not seen yet (different from current body and from any saved
  // pre-apply snapshot — the latter avoids re-suggesting what we just
  // overwrote).
  const bodyCandidateVisible = computed(() => {
    if (bodyCandidate.value === null) return false;
    if (bodyCandidateApplied.value) return true;
    if (bodyCandidate.value === body.value) return false;
    if (bodyBeforeCandidate.value !== null && bodyCandidate.value === bodyBeforeCandidate.value) {
      return false;
    }
    return true;
  });
  // Body-edit invalidates a candidate that no longer reflects user intent.
  // Skip when the new body value is either the candidate (apply just ran)
  // or the saved-previous (revert just ran). Anything else means the user
  // typed.
  watch(
    body,
    (current) => {
      if (bodyCandidate.value === null) return;
      if (current === bodyCandidate.value) return;
      if (current === bodyBeforeCandidate.value) return;
      bodyCandidate.value = null;
      bodyBeforeCandidate.value = null;
    },
    { flush: "sync" },
  );

  return {
    body,
    bodyCandidate,
    bodyBeforeCandidate,
    bodyCandidateApplied,
    bodyCandidateVisible,
    setBodyCandidate,
    applyBodyCandidate,
    revertBodyCandidate,
  };
}

/**
 * Title candidate slot (PRD V0.2 step D).
 *
 * Same state machine as `createBodyCandidate`, just bound to `title`. Kept
 * as a separate factory rather than a generic `createCandidateSlot` because
 * the two slots are likely to diverge (different telemetry channels,
 * different invalidation rules — e.g. title may eventually re-suggest from
 * a body edit, body never does the reverse). Sharing the implementation
 * now would make those independent rules harder to add later.
 *
 * Persistence: transient, identical to body. The PRD reserves localStorage
 * for what the user actually typed; LLM candidates are always re-derivable
 * from a fresh preview tick.
 *
 * Step D scope is the slot + UI only. The actual LLM wiring that fills
 * `titleCandidate` lives in steps E/F.
 */
export interface PublishTitleCandidateApi {
  title: Ref<string>;
  titleCandidate: Ref<string | null>;
  titleBeforeCandidate: Ref<string | null>;
  titleCandidateApplied: ComputedRef<boolean>;
  titleCandidateVisible: ComputedRef<boolean>;
  setTitleCandidate: (value: string | null) => void;
  applyTitleCandidate: () => void;
  revertTitleCandidate: () => void;
}

export const PublishTitleCandidateKey: InjectionKey<PublishTitleCandidateApi> =
  Symbol("PublishTitleCandidate");

export function useInjectedTitleCandidate(): PublishTitleCandidateApi {
  const api = inject(PublishTitleCandidateKey, null);
  if (!api) {
    throw new Error(
      "usePublishDraft must be installed (provided) before consuming PublishTitleCandidateKey",
    );
  }
  return api;
}

/**
 * Suggested-component pipe (PRD V0.2 step E-pre).
 *
 * Holds the most recent `candidates.suggestedComponents` array from the LLM
 * preview tick. `usePublishLlmTick` is the only writer; step E-main is the
 * first reader (rendering inline ghost components in
 * `PublishSuggestedComponents.vue`). Provided here so descendants can
 * `inject` the ref without prop-drilling, mirroring the body/title candidate
 * pattern.
 *
 * Step E-pre scope was the pipe. The hook empties the array between LLM
 * round-trips when the model returns no components, so a stale "5 hints"
 * list never lingers after the user has typed past their relevance.
 */
export const PublishSuggestedComponentsKey: InjectionKey<Ref<SuggestedComponent[]>> = Symbol(
  "PublishSuggestedComponents",
);

export function useInjectedSuggestedComponents(): Ref<SuggestedComponent[]> {
  const ref$ = inject(PublishSuggestedComponentsKey, null);
  if (!ref$) {
    throw new Error(
      "usePublishDraft must be installed (provided) before consuming PublishSuggestedComponentsKey",
    );
  }
  return ref$;
}

/**
 * Suggested-component accept / dismiss API (PRD V0.2 step E-main, §4.2.3).
 *
 * Step E-pre exposed `suggestedComponents` (a writable ref) but no consumer
 * — the pipe was inert. Step E-main introduces:
 *
 *   - `accept(component)` — "实化" the ghost into the publish draft. Each
 *     kind maps to the smallest visible payload mutation that surfaces the
 *     corresponding fields in the existing publish UI:
 *       event_time      → publishKind = "event"        (event panel opens)
 *       merchant_info   → publishKind = "merchant" if merchant_verified
 *       trade_condition → publishKind = "trade"   if campus_verified
 *       price           → merchant if merchant_verified, else trade if
 *                         campus_verified, else no kind change
 *       help_tag        → tagInput defaults to "求助" when blank
 *       location        → no payload mutation; the location panel is owned
 *                         by usePublishLocationOptions outside this slice
 *                         (PRD §2.2 reserves "place" kind for step F)
 *     After mutation the component is removed from the list so it can't be
 *     accepted twice in a row.
 *   - `dismiss(component)` — purely local: removes from the list. The next
 *     LLM tick may re-emit the same kind; that's intended behavior per
 *     PRD §4.2.3 ("用户继续输入或切到下一个 LLM tick 时静默消失").
 *
 * Defensive design: accept uses `===` on `kind` + `label` to identify the
 * target. The same-kind+same-label pair is the contract step E-pre's
 * `parseSuggestedComponents` already enforces (kinds are deduped before
 * insert), so two-of-a-kind never appears in the list.
 *
 * Verification gates (merchant / trade): a defensive UI guard already
 * lives in PublishView (the merchant radio is `v-if`-gated on
 * `merchantVerified` and a watch resets publishKind back to "regular" if
 * verification drops). We layer one more guard here so `accept(merchant_info)`
 * never sets publishKind for an unverified user, even though the server
 * filter (PRD §2.3) makes that case unreachable in practice.
 */
export interface PublishSuggestedComponentsActionsApi {
  components: Ref<SuggestedComponent[]>;
  accept: (component: SuggestedComponent) => void;
  dismiss: (component: SuggestedComponent) => void;
}

export const PublishSuggestedComponentsActionsKey: InjectionKey<PublishSuggestedComponentsActionsApi> =
  Symbol("PublishSuggestedComponentsActions");

export function useInjectedSuggestedComponentsActions(): PublishSuggestedComponentsActionsApi {
  const api = inject(PublishSuggestedComponentsActionsKey, null);
  if (!api) {
    throw new Error(
      "usePublishDraft must be installed (provided) before consuming PublishSuggestedComponentsActionsKey",
    );
  }
  return api;
}

export interface CreateSuggestedComponentsActionsParams {
  components: Ref<SuggestedComponent[]>;
  publishKind: Ref<PublishKind>;
  tagInput: Ref<string>;
  /** /api/auth/me-derived merchant_verified flag. accept(merchant_info) and accept(price) consult this. */
  merchantVerified: Ref<boolean>;
  /** /api/auth/me-derived campus_verified flag. accept(trade_condition) and accept(price) consult this. */
  campusVerified: Ref<boolean>;
}

/**
 * Pure factory for the suggested-component actions API.
 *
 * Exported so tests can drive accept/dismiss directly without booting a
 * component (the wrapping `usePublishDraft` calls `provide()`, which
 * requires a setup context). This is the same code path the composable
 * runs through — see `createBodyCandidate` for prior art.
 */
export function createSuggestedComponentsActions(
  params: CreateSuggestedComponentsActionsParams,
): PublishSuggestedComponentsActionsApi {
  function indexOf(target: SuggestedComponent): number {
    // kind alone would suffice today (the parser dedupes by kind), but
    // matching label too keeps us robust if the dedupe rule is ever
    // relaxed and two same-kind ghosts coexist.
    return params.components.value.findIndex(
      (entry) => entry.kind === target.kind && entry.label === target.label,
    );
  }
  function removeAt(index: number) {
    if (index < 0) return;
    const next = params.components.value.slice();
    next.splice(index, 1);
    params.components.value = next;
  }
  function dismiss(target: SuggestedComponent) {
    removeAt(indexOf(target));
  }
  function accept(target: SuggestedComponent) {
    const idx = indexOf(target);
    // No-op when the ghost is already gone — protects against double-fire
    // from accidentally tapping twice during a slow render frame.
    if (idx < 0) return;
    switch (target.kind) {
      case "event_time":
        params.publishKind.value = "event";
        break;
      case "merchant_info":
        if (params.merchantVerified.value) params.publishKind.value = "merchant";
        break;
      case "trade_condition":
        if (params.campusVerified.value) params.publishKind.value = "trade";
        break;
      case "price":
        // 价格既可属 merchant 也可属 trade。merchant_verified 优先（商家页有
        // 自己的"营业时间 / 联系方式"），否则落 trade（campus_verified 才进
        // trade panel）。两个都不满足时不改 publishKind，但 ghost 仍被消费
        // —— 用户的"忽略一次"意图在视觉上立刻生效。
        if (params.merchantVerified.value) {
          params.publishKind.value = "merchant";
        } else if (params.campusVerified.value) {
          params.publishKind.value = "trade";
        }
        break;
      case "help_tag":
        // Don't clobber a tag the user already typed — that would be the
        // "AI 静默覆盖" reflex the PRD calls out as a reflex to avoid.
        if (params.tagInput.value.trim().length === 0) {
          params.tagInput.value = "求助";
        }
        break;
      case "location":
        // 仅地点 → "place" kind in PRD §2.2, but the publish UI doesn't
        // surface a "place" radio yet (step F territory). The location
        // panel is owned by usePublishLocationOptions one level up; the
        // accept gesture here is a no-op on draft state and the SFC at
        // the call site handles the actual panel-open side effect.
        break;
    }
    removeAt(idx);
  }
  return {
    components: params.components,
    accept,
    dismiss,
  };
}

/**
 * Pure factory for the title-candidate state machine. Lifecycle mirrors the
 * body factory exactly (set / apply / revert / user-typing invalidates).
 * See `createBodyCandidate` for the per-step rationale; the comments aren't
 * duplicated here.
 */
export function createTitleCandidate(title: Ref<string>): PublishTitleCandidateApi {
  const titleCandidate = ref<string | null>(null);
  const titleBeforeCandidate = ref<string | null>(null);

  function setTitleCandidate(value: string | null) {
    titleCandidate.value = value;
    if (value === null) {
      titleBeforeCandidate.value = null;
    }
  }
  function applyTitleCandidate() {
    if (titleCandidate.value === null) return;
    titleBeforeCandidate.value = title.value;
    title.value = titleCandidate.value;
  }
  function revertTitleCandidate() {
    if (titleBeforeCandidate.value === null) return;
    title.value = titleBeforeCandidate.value;
  }
  const titleCandidateApplied = computed(
    () =>
      titleCandidate.value !== null &&
      titleBeforeCandidate.value !== null &&
      title.value === titleCandidate.value,
  );
  const titleCandidateVisible = computed(() => {
    if (titleCandidate.value === null) return false;
    if (titleCandidateApplied.value) return true;
    if (titleCandidate.value === title.value) return false;
    if (
      titleBeforeCandidate.value !== null &&
      titleCandidate.value === titleBeforeCandidate.value
    ) {
      return false;
    }
    return true;
  });
  watch(
    title,
    (current) => {
      if (titleCandidate.value === null) return;
      if (current === titleCandidate.value) return;
      if (current === titleBeforeCandidate.value) return;
      titleCandidate.value = null;
      titleBeforeCandidate.value = null;
    },
    { flush: "sync" },
  );

  return {
    title,
    titleCandidate,
    titleBeforeCandidate,
    titleCandidateApplied,
    titleCandidateVisible,
    setTitleCandidate,
    applyTitleCandidate,
    revertTitleCandidate,
  };
}

/**
 * Composes the three slices of publish-form state — form fields & uploads
 * (this file), identity (`usePublishIdentity`), and AI suggestions
 * (`usePublishAi`) — into the single object PublishView consumes. Splitting
 * out identity/AI is a deliberate carve-out: this file used to mix all three
 * concerns into one 314-line composable that returned 27 fields.
 *
 * Public surface kept stable so PublishView, usePublishSubmit, and
 * usePublishDraftSession don't need to change shape.
 */
export function usePublishDraft() {
  const title = ref("");
  const body = ref("");
  // PRD V0.2 step B — LLM-polished body candidate slot. State machine and
  // body-edit invalidation live in createBodyCandidate (pure factory, easy
  // to drive from tests); this composable just wires it up + provides it.
  const candidate = createBodyCandidate(body);
  // PRD V0.2 step D — title candidate slot. Same state machine as body, just
  // bound to `title`. See createTitleCandidate for why this stays a separate
  // factory rather than a generic slot.
  const titleCandidate = createTitleCandidate(title);
  // PRD V0.2 step E-pre — sink for the LLM tick's suggestedComponents block.
  // `usePublishLlmTick` (mounted from PublishComposer) is the only writer;
  // step E-main is the first reader (PublishSuggestedComponents.vue).
  // Empty array is the natural "no suggestions" state — keeps consumer
  // templates simple (`v-for` over an empty list is a no-op).
  const suggestedComponents = ref<SuggestedComponent[]>([]);
  const tagInput = ref("");
  const placeName = ref("");
  const visibility = ref<PublishVisibility>("public");
  const selectedFiles = ref<File[]>([]);
  const localPreviewUrls = ref<string[]>([]);
  const uploadedImageUrls = ref<string[]>([]);
  const uploading = ref(false);
  const publishing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const lastTid = ref<string | number | null>(null);

  const normalizedTag = computed(() => normalizePublishTag(tagInput.value));

  const tagPanelOpen = ref(false);
  const visibilityPanelOpen = ref(false);

  const visibilityOptions: Array<{ value: PublishVisibility; label: string }> = [
    { value: "public", label: PUBLISH_VIS_PUBLIC },
    { value: "campus", label: PUBLISH_VIS_CAMPUS },
    { value: "school", label: PUBLISH_VIS_SCHOOL },
    { value: "private", label: PUBLISH_VIS_PRIVATE },
  ];

  // Backend-driven audience options (PRD V0.1 §7.4.3). Falls back to public-only
  // when the backend route is missing, so the publish UI degrades gracefully.
  const audience = useAudienceOptions();
  function isVisibilityAllowed(value: PublishVisibility): boolean {
    return audience.isAllowed(value as AudienceVisibility);
  }
  function visibilityDisabledReason(value: PublishVisibility): string {
    return audience.disabledReason(value as AudienceVisibility);
  }

  const identity = usePublishIdentity();

  const merchant = useMerchantPublishDraft();
  const trade = useTradePublishDraft();
  const publishKind = ref<PublishKind>("regular");

  // AI draft (PRD V0.1 Phase 3). Suggestions only fill empty fields, and AI
  // failures stay silent — manual entry always works. Decision lives in
  // domain/publishAiPolicy; this composable just owns the wiring.
  const ai = usePublishAi({
    uploadedImageUrls,
    title,
    body,
    tagInput,
    placeName,
    visibility,
    isAllowed: (value) => audience.isAllowed(value),
  });

  const visibilityLabel = computed(
    () =>
      visibilityOptions.find((item) => item.value === visibility.value)?.label ||
      PUBLISH_VIS_PUBLIC,
  );

  const canSubmit = computed(() => {
    if (title.value.trim().length === 0) return false;
    if (body.value.trim().length === 0) return false;
    if (uploading.value || publishing.value) return false;
    if (publishKind.value === "merchant") return merchant.canSubmit.value;
    if (publishKind.value === "trade") return trade.canSubmit();
    return true;
  });
  const titleCount = computed(() => title.value.length);
  const bodyCount = computed(() => body.value.length);
  const imageStatus = computed(() => {
    if (!selectedFiles.value.length)
      return PUBLISH_IMAGE_MAX.replace("{n}", String(MAX_PUBLISH_IMAGE_COUNT));
    if (uploading.value)
      return `${PUBLISH_IMAGE_UPLOADING} ${uploadedImageUrls.value.length}/${selectedFiles.value.length}`;
    return `${PUBLISH_IMAGE_READY} ${uploadedImageUrls.value.length}/${selectedFiles.value.length} ${PUBLISH_IMAGE_COUNT_SUFFIX}`;
  });

  function revokePreviewUrls() {
    localPreviewUrls.value.forEach((url) => URL.revokeObjectURL(url));
    localPreviewUrls.value = [];
  }

  async function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const selection = validatePublishImageSelection(
      Array.from(input.files || []),
      selectedFiles.value.length,
    );
    input.value = "";

    if (!selection.acceptedFiles.length) {
      if (selection.message) errorMessage.value = selection.message;
      return;
    }

    errorMessage.value = selection.message;
    successMessage.value = "";
    selectedFiles.value = [...selectedFiles.value, ...selection.acceptedFiles];
    localPreviewUrls.value = [
      ...localPreviewUrls.value,
      ...selection.acceptedFiles.map((file) => URL.createObjectURL(file)),
    ];
    await uploadPendingImages();
  }

  async function uploadPendingImages() {
    if (uploading.value) return;
    uploading.value = true;
    try {
      for (
        let index = uploadedImageUrls.value.length;
        index < selectedFiles.value.length;
        index += 1
      ) {
        const url = await uploadPublishImage(selectedFiles.value[index]);
        uploadedImageUrls.value[index] = url;
      }
      uploadedImageUrls.value = uploadedImageUrls.value.filter(Boolean);
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, ERROR_PUBLISH_IMAGE);
    } finally {
      uploading.value = false;
    }
  }

  /**
   * After the first successful upload, surface the location step (PRD §7.4.2).
   * The caller passes a callback rather than coupling this composable to the
   * location-options composable, so this stays publishable in isolation.
   */
  function notifyFirstUploadComplete(openLocation: () => void) {
    if (uploadedImageUrls.value.length === 1 && !uploading.value) {
      openLocation();
    }
  }

  function removeImage(index: number) {
    if (localPreviewUrls.value[index]) URL.revokeObjectURL(localPreviewUrls.value[index]);
    selectedFiles.value.splice(index, 1);
    localPreviewUrls.value.splice(index, 1);
    uploadedImageUrls.value.splice(index, 1);
  }

  function validate() {
    return validatePublishForm({
      title: title.value,
      body: body.value,
      uploading: uploading.value,
      selectedFileCount: selectedFiles.value.length,
      uploadedImageCount: uploadedImageUrls.value.length,
    });
  }

  function toggleTagPanel() {
    tagPanelOpen.value = !tagPanelOpen.value;
  }

  function toggleVisibilityPanel() {
    visibilityPanelOpen.value = !visibilityPanelOpen.value;
  }

  // PRD V0.2 step B — expose the candidate state machine to descendants
  // (PublishCandidateBar) without prop-drilling. Tests can build their own
  // via `createBodyCandidate` directly; mounting components inject it here.
  provide(PublishBodyCandidateKey, candidate);
  // PRD V0.2 step D — same wiring for the title slot. Separate key so the
  // two bars don't have to discriminate at runtime.
  provide(PublishTitleCandidateKey, titleCandidate);
  // PRD V0.2 step E-pre — provide the suggestedComponents pipe so
  // usePublishLlmTick (mounted from PublishComposer) can write to it via
  // inject without prop-drilling, and step E-main's ghost UI can read via
  // the same key.
  provide(PublishSuggestedComponentsKey, suggestedComponents);
  // PRD V0.2 step E-main — accept / dismiss actions for the ghost UI. The
  // factory takes refs (publishKind / tagInput / verification flags) so the
  // mutations land back on the same draft the rest of PublishView reads.
  const suggestedComponentsActions = createSuggestedComponentsActions({
    components: suggestedComponents,
    publishKind,
    tagInput,
    merchantVerified: merchant.merchantVerified,
    campusVerified: trade.campusVerified,
  });
  provide(PublishSuggestedComponentsActionsKey, suggestedComponentsActions);

  function resetForm(clearLocation: () => void) {
    title.value = "";
    body.value = "";
    candidate.setBodyCandidate(null);
    titleCandidate.setTitleCandidate(null);
    tagInput.value = "";
    identity.identityTag.value = "";
    placeName.value = "";
    visibility.value = "public";
    selectedFiles.value = [];
    uploadedImageUrls.value = [];
    tagPanelOpen.value = false;
    visibilityPanelOpen.value = false;
    publishKind.value = "regular";
    merchant.reset();
    trade.reset();
    clearLocation();
    revokePreviewUrls();
  }

  onBeforeUnmount(() => {
    revokePreviewUrls();
  });

  return {
    title,
    body,
    tagInput,
    identityTag: identity.identityTag,
    identityTagOptions: identity.identityTagOptions,
    placeName,
    visibility,
    selectedFiles,
    localPreviewUrls,
    uploadedImageUrls,
    aliasId: identity.aliasId,
    identityName: identity.identityName,
    identityMeta: identity.identityMeta,
    userId: identity.userId,
    identityLoaded: identity.identityLoaded,
    uploading,
    publishing,
    errorMessage,
    successMessage,
    lastTid,
    tagPanelOpen,
    visibilityPanelOpen,
    normalizedTag,
    normalizedIdentityTag: identity.normalizedIdentityTag,
    avatarText: identity.avatarText,
    canSubmit,
    titleCount,
    bodyCount,
    imageStatus,
    visibilityLabel,
    visibilityOptions,
    pageChrome: identity.pageChrome,
    handleFiles,
    removeImage,
    validate,
    loadIdentity: identity.loadIdentity,
    resetForm,
    toggleTagPanel,
    toggleVisibilityPanel,
    audience,
    isVisibilityAllowed,
    visibilityDisabledReason,
    aiLoading: ai.aiLoading,
    aiError: ai.aiError,
    aiRiskFlags: ai.aiRiskFlags,
    aiRefresh: ai.aiRefresh,
    notifyFirstUploadComplete,
    publishKind,
    merchant,
    trade,
    // PRD V0.2 step D — title candidate slot.
    titleCandidate: titleCandidate.titleCandidate,
    titleBeforeCandidate: titleCandidate.titleBeforeCandidate,
    titleCandidateApplied: titleCandidate.titleCandidateApplied,
    titleCandidateVisible: titleCandidate.titleCandidateVisible,
    setTitleCandidate: titleCandidate.setTitleCandidate,
    applyTitleCandidate: titleCandidate.applyTitleCandidate,
    revertTitleCandidate: titleCandidate.revertTitleCandidate,
    // PRD V0.2 step E-pre — suggestedComponents pipe. Step E-main reader
    // (PublishGhostComponent.vue) will consume via inject; this is here so
    // tests / debug surfaces that already hold a `draft` handle can read it
    // without going through inject.
    suggestedComponents,
    setBodyCandidate: candidate.setBodyCandidate,
  };
}
