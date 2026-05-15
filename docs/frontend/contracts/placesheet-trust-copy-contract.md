# PlaceSheet Trust, Correction, and Empty-State Copy Contract

Date: 2026-05-11
Status: Draft documentation slice for #397. Runtime implementation remains tracked separately under #63, #67, #129, and #141.
Scope: `docs/frontend/**`, `docs/qa/**`, and issue-task traceability docs only. No backend, moderation-flow, map-editing, or large UI redesign work.

Related to #397.
Related to #63.
Related to #67.
Related to #129.
Related to #141.
Related to taoyu051818-sys/lian-platform-server#121.
Does not close #397.
Does not close #63.
Does not close #67.
Does not close #129.
Does not close #141.

## 1. Purpose

This contract defines the user-facing wording for PlaceSheet trust states, correction-needed states, AI-assisted summary disclosure, and safe empty states.

It is grounded in the campus place baseline from `taoyu051818-sys/lian-platform-server` issue #121 and `docs/agent/content-ops/CAMPUS_PLACE_OPS_FOUNDATION.md`, especially:

- durable place-level summaries;
- conservative time-sensitivity language;
- explicit correction-needed language when facts may be stale;
- privacy-safe place descriptions that do not imply official approval.

This document does not claim that PlaceSheet runtime acceptance is complete. It only defines wording and state boundaries so implementation can stay truthful.

## 2. Copy principles

1. Place-level facts must sound useful, calm, and reversible.
2. Trust copy must distinguish confidence from moderation or enforcement status.
3. Time-sensitive uncertainty must be phrased conservatively, not as live telemetry.
4. Correction language must invite help without implying a full report/moderation product already exists.
5. AI-assisted summary copy must stay visually and semantically separate from verified place facts.
6. Empty states must distinguish no content, temporary unavailability, and visibility limits.
7. Action labels must not promise notifications, subscriptions, or review timelines that the runtime does not support yet.

## 3. Trust state contract

The runtime may render trust state as a badge, inline note, or header support line, but the wording must preserve these meanings.

| State key | When to use | Primary zh-CN copy | Supporting copy | Avoid |
|---|---|---|---|---|
| `high-confidence` | Core place facts match a stable source such as campus signage, current LIAN map labels, or a recently verified operator source | `信息已核实` | `地点名称和基础信息已按当前资料核对。` | Do not say `官方认证` unless a separate official-program rule exists. |
| `needs-review` | The PlaceSheet is useful but has not received a fresh verification pass, or some details came from older operator knowledge | `信息待复核` | `这份地点说明可以先参考，我们仍在补充最新核对。` | Do not say the information is wrong or unsafe by default. |
| `may-be-stale` | Hours, service scope, access notes, or event-bound details may have drifted | `部分信息可能已过时` | `涉及时间或安排的内容可能变动，请把这里当作方向性参考。` | Do not imply live status or guaranteed freshness. |
| `correction-pending` | A correction was requested or a known mismatch exists, but review is not finished yet | `纠错处理中` | `我们已标记这条地点信息，完成复核前请以现场或最新来源为准。` | Do not promise a response time or approval path. |

### 3.1 Trust-state placement

- The primary trust state should appear near the PlaceSheet title or summary, not buried inside a footer.
- Only one primary trust state should be shown at a time.
- If a state is `correction-pending`, it takes precedence over `needs-review` and `may-be-stale`.
- If a state is `may-be-stale`, it may be paired with a narrower field-level note, but the page should not stack multiple alarming warnings.

## 4. Correction-needed contract

Correction copy is for place facts that may be wrong, stale, or bound to the wrong location. It is not a moderation or abuse-report flow.

| Surface | Required wording | Notes |
|---|---|---|
| Inline warning note | `这里有信息可能不准确。` | Keep the first sentence short and factual. |
| Support line | `如果你发现地点名称、位置或说明有误，可以帮我们纠正。` | Limit scope to place facts, not general complaints. |
| CTA label | `帮助纠正` | Preferred over `举报` or `投诉`. |
| Pending-state note | `这条纠正建议正在复核。` | Must not promise queue order or ETA. |
| Escalated stale note | `和开放时间、活动安排有关的内容可能已经变化。` | Use only for time-sensitive details. |

### 4.1 Correction boundary rules

- Use `帮助纠正` for factual fixes such as wrong names, wrong bindings, or stale details.
- Do not use copy that implies legal, disciplinary, or moderation review.
- Do not imply that every correction request becomes public content or triggers notifications.
- If no correction UI exists yet, placeholder copy should remain descriptive only: `发现信息有误时，稍后可以从这里提交纠正。`

## 5. AI-assisted summary disclosure

PlaceSheet may include helpful summary text, but verified place facts and AI-assisted summaries must remain distinct.

| Surface | Required wording | Meaning |
|---|---|---|
| Summary label | `AI 整理` | The summary text was machine-assisted from existing place information. |
| Disclosure line | `这段简介由现有地点资料整理而成，可能不完整，请优先参考已核实的地点信息。` | Keeps AI summary separate from verified facts. |
| Fallback disclosure for low-confidence summary | `这段简介仍需人工复核。` | Use when the summary exists but has not received a manual quality pass. |

### 5.1 AI-summary rules

- AI disclosure applies only to summary or helper text, not to the entire PlaceSheet.
- AI disclosure must not replace trust state. A PlaceSheet can be `信息已核实` while its summary block still carries `AI 整理`.
- AI summary copy must not say or imply that AI confirmed correctness.
- If no AI-generated or AI-assisted summary is present, do not show any AI disclosure copy.

## 6. Empty and limited-content states

PlaceSheet must distinguish absent content from unavailable content.

| State key | When to use | Primary zh-CN copy | Supporting copy |
|---|---|---|---|
| `no-related-content-yet` | The place exists, but no recent posts, highlights, or related content are attached yet | `这里还没有相关内容` | `地点信息已建立，之后会补充与这里相关的动态和经验。` |
| `temporarily-unavailable` | Related content or hooks cannot be loaded right now because of a temporary fetch/runtime problem | `相关内容暂时不可用` | `稍后再试，地点基础信息仍然可以继续查看。` |
| `visibility-limited` | Related content exists but cannot be shown to the current viewer because of visibility or permission rules | `部分内容暂不对你显示` | `这不是地点错误，相关内容会按可见范围展示。` |
| `discovery-not-ready` | The place exists, but recommendation hooks or discovery tie-ins are intentionally not ready yet | `地点内容入口还在准备中` | `这里的基础地点说明已经可用，更多关联内容会在后续开放。` |

### 6.1 Empty-state rules

- `no-related-content-yet` is the default safe state for a new but valid place.
- `temporarily-unavailable` should only be used for transient technical failure, not for empty data.
- `visibility-limited` should avoid blame language such as `你没有权限查看` unless the product already uses that tone consistently elsewhere.
- `discovery-not-ready` is preferred when the lack of content reflects rollout sequencing rather than a fetch failure.

## 7. Save / follow / placeholder action wording

PlaceSheet actions must stay conservative until product behavior is real and stable.

| Action state | Allowed label | Helper copy | Forbidden implication |
|---|---|---|---|
| Local revisit/save | `保存地点` | `把这个地点留到以后再看。` | Must not imply alerts, reminders, or social following. |
| Placeholder future action | `关注地点` only if a real follow model exists | `后续如果开放地点关注，再说明会收到什么更新。` | Do not use this label as a live action until notification behavior exists. |
| Fallback neutral action | `稍后查看` | `先记下这个地点，后续再回来查看信息。` | Do not imply account sync if it is local-only. |

### 7.1 Action naming rule

Until notification or subscription behavior is implemented, prefer `保存地点` over `关注地点`.

## 8. Alignment with content-ops baseline

This copy contract stays aligned with the existing place-ops baseline by enforcing these translation rules:

| Baseline rule from #121 | Frontend wording rule |
|---|---|
| Durable place-level summaries | Summary copy describes what the place is for, not rumors, crowd mood, or personal anecdotes. |
| Conservative time-sensitivity wording | Use `部分信息可能已过时` and similar directional phrasing instead of live-status language. |
| Correction-needed language | Use `帮助纠正` and `纠错处理中` for factual fixes, not punishment or moderation wording. |
| Privacy-safe place description | Keep copy at place level only. Do not mention resident, student-identifying, or room-level detail. |

## 9. Implementation guardrails

When this contract is implemented in runtime:

- trust state copy should be driven by stable state keys, not ad hoc strings spread across components;
- AI disclosure must be rendered as a separate summary-level label/note;
- empty-state copy should come from a presenter or view-model layer so the same state stays consistent across PlaceSheet entry points;
- runtime code should not reuse correction copy for moderation/report flows unless #129 explicitly broadens the contract.

## 10. Out of scope

This contract does not:

- approve moderation policy;
- define backend data mutation or correction queue behavior;
- declare PlaceSheet runtime acceptance complete;
- define search ranking or map-point editing behavior;
- authorize notification promises for save/follow actions.

## 11. References

- `taoyu051818-sys/lian-platform-server` issue #121
- `taoyu051818-sys/lian-platform-server/docs/agent/content-ops/CAMPUS_PLACE_OPS_FOUNDATION.md`
- `taoyu051818-sys/lian-mobile-web` issues #63, #67, #129, #141, #397
- `docs/qa/placesheet-trust-copy-test-checklist.md`
