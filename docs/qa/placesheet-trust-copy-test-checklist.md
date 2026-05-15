# PlaceSheet Trust Copy — Test Checklist

Issue: #397
Contract: `docs/frontend/contracts/placesheet-trust-copy-contract.md`
Date: 2026-05-11
Status: Draft

This checklist validates the PlaceSheet wording contract for trust states, correction flows, AI-summary disclosure, and empty/hidden-content states.

## How to use

- Check each item when the implemented PlaceSheet surface matches the contract.
- Use this against PlaceSheet entry points under #63 and #67.
- Keep moderation/report validation separate under #129.

## T1 — Trust states

- [ ] `high-confidence` renders `信息已核实` with support text equivalent to `地点名称和基础信息已按当前资料核对。`
- [ ] `needs-review` renders `信息待复核` without implying the place is broken or unsafe.
- [ ] `may-be-stale` renders `部分信息可能已过时` and limits the warning to time-sensitive details.
- [ ] `correction-pending` renders `纠错处理中` and support text equivalent to `完成复核前请以现场或最新来源为准。`
- [ ] Only one primary trust state is shown at once.
- [ ] `correction-pending` overrides weaker warning states if multiple flags are present.

## T2 — Correction wording

- [ ] The factual-fix CTA uses `帮助纠正`, not `举报` or `投诉`.
- [ ] Inline warning copy matches `这里有信息可能不准确。` or a contract-equivalent sentence.
- [ ] Support copy limits scope to name, location, or description fixes.
- [ ] Pending-state copy does not promise review order or response time.
- [ ] Placeholder correction copy, if shown before the feature exists, stays descriptive and does not imply a live submission workflow.

## T3 — AI-summary disclosure

- [ ] Summary-level AI disclosure uses the `AI 整理` label.
- [ ] The disclosure line keeps AI summary separate from verified place facts.
- [ ] AI disclosure appears only on AI-assisted summary or helper text, not on the entire PlaceSheet container.
- [ ] A PlaceSheet can still show `信息已核实` while the summary block carries `AI 整理`.
- [ ] No AI disclosure copy says or implies that AI verified correctness.

## T4 — Empty and limited-content states

- [ ] New but valid places use `这里还没有相关内容`, not a technical failure message.
- [ ] Temporary fetch/runtime failure uses `相关内容暂时不可用`.
- [ ] Visibility-limited content uses `部分内容暂不对你显示` or contract-equivalent wording that avoids blame language.
- [ ] Rollout-bound discovery gaps use `地点内容入口还在准备中`, not a broken-state message.
- [ ] Empty states clearly distinguish `no content yet`, `temporarily unavailable`, and `visibility-limited`.

## T5 — Save and follow wording

- [ ] The conservative default action label is `保存地点` unless real follow/notification behavior exists.
- [ ] `保存地点` helper text does not promise alerts, reminders, or social following.
- [ ] `关注地点` is not used as a live action unless product behavior for updates is actually implemented.
- [ ] Local-only saving does not imply cloud sync unless the runtime truly supports it.

## T6 — Content-ops baseline alignment

- [ ] Place summaries stay at place level and avoid personal, resident, or room-level detail.
- [ ] Time-sensitive wording remains conservative and does not read like live telemetry.
- [ ] Correction wording matches the factual-fix flow described in `taoyu051818-sys/lian-platform-server#121`.
- [ ] The UI does not imply official certification unless a separate official-program contract exists.

## T7 — Guardrails

- [ ] Runtime copy does not claim #63 or #67 is complete.
- [ ] Runtime copy does not merge correction wording into moderation/report language tracked by #129.
- [ ] Presenter/view-model state keys are stable enough that the same copy can be reused across PlaceSheet entry points.
- [ ] No user-facing text promises notification behavior, moderation outcomes, or review timing that the runtime does not support.

## Issue linkage

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
