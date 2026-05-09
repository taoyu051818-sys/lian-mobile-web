# Badge & Chip Presenter — Test Checklist

Issue: #188
Contract: `docs/frontend/contracts/badge-chip-presenter-contract.md`
Date: 2026-05-08
Status: Draft

Test checklist for badge/chip presenter contract validation. Each section maps 1:1 to a contract section. Tests verify presenter mapping correctness, unknown fallback behavior, accessibility labels, contrast expectations, and UI primitive boundary guardrails.

---

## How to Use

- Each item is a checkbox (`- [ ]`). Check off when verified.
- Items use descriptive IDs: `T1a`, `T2b`, `FC-1`, etc.
- Run against both lanes where applicable: `legacy` (4300) and `vue-canary` (4301).

---

## T1 — Presenter Mapping Correctness (Contract §1, §2)

- [ ] **T1a.** Call `presentContentType("experience")`. Verify output: `{ label: "经验", tone: "success", icon: ..., ariaLabel: ..., copyKey: ... }`.
- [ ] **T1b.** Call `presentContentType("ai")`. Verify output tone is `"ai"`, label is `"AI 摘要"`.
- [ ] **T1c.** Call `presentContentType("official")`. Verify output tone is `"official"`, label is `"官方"`.
- [ ] **T1d.** Call `presentTrustStatus("confirmed")`. Verify output tone is `"success"`, label is `"已确认"`.
- [ ] **T1e.** Call `presentTrustStatus("disputed")`. Verify output tone is `"danger"`, label is `"有争议"`.
- [ ] **T1f.** Call `presentPlaceType("dining")`. Verify output: `{ label: "食堂", tone: "brand", ... }`.
- [ ] **T1g.** Call `presentVisibility("private")`. Verify output: `{ label: "仅自己", ... }`.
- [ ] **T1h.** Call `presentSourceKind("aiGenerated")`. Verify output label is `"AI 生成"`.
- [ ] **T1i.** Call `presentSourceKind("aiAssisted")`. Verify output label is `"AI 辅助"`.
- [ ] **T1j.** Call `presentSourceKind("aiSummary")`. Verify output label is `"AI 整理"`.
- [ ] **T1k.** Call `presentPermissionState("granted")`. Verify output tone is `"success"`.
- [ ] **T1l.** Call `presentPermissionState("denied")`. Verify output tone is `"danger"`.
- [ ] **T1m.** Call `presentPermissionState("restricted")`. Verify output tone is `"warning"`.
- [ ] **T1n.** Call `presentPermissionState("pending")`. Verify output tone is `"info"`.
- [ ] **T1o.** Call `presentPermissionState("expired")`. Verify output tone is `"neutral"`.
- [ ] **T1p.** Call `presentPermissionState("public")`. Verify output tone is `"neutral"`.

## T2 — Unknown Enum Fallback (Contract §3)

- [ ] **T2a.** Call `presentContentType("nonexistent_value")`. Verify output matches `UNKNOWN_FALLBACK`: `{ label: "其他", tone: "neutral", icon: "", description: "未识别的类型", ariaLabel: "未识别的类型", copyKey: "common.unknown" }`.
- [ ] **T2b.** Call `presentTrustStatus("nonexistent_value")`. Verify same fallback output.
- [ ] **T2c.** Call `presentPlaceType("nonexistent_value")`. Verify same fallback output.
- [ ] **T2d.** Call `presentVisibility("nonexistent_value")`. Verify same fallback output.
- [ ] **T2e.** Call `presentSourceKind("nonexistent_value")`. Verify same fallback output.
- [ ] **T2f.** Call `presentPermissionState("nonexistent_value")`. Verify same fallback output.
- [ ] **T2g.** Call each presenter with `undefined` and `null`. Verify fallback output (not throw, not empty).
- [ ] **T2h.** In dev mode, verify unknown values produce a diagnostics log with the raw unrecognized value.
- [ ] **T2i.** Verify the fallback chip/badge renders visibly (not hidden) in the UI.

## T3 — AI Badge Semantics (Contract §4.1)

- [ ] **T3a.** Render a post with `sourceKind: "aiSummary"`. Verify badge shows `"AI 摘要"` with `tone: "ai"`.
- [ ] **T3b.** Render a post with `sourceKind: "aiAssisted"`. Verify badge shows `"AI 辅助"` with `tone: "ai"`.
- [ ] **T3c.** Render a post with `sourceKind: "aiGenerated"`. Verify badge shows `"AI 生成"` with `tone: "ai"`.
- [ ] **T3d.** Verify AI badge description includes source count or uncertainty note.
- [ ] **T3e.** Verify AI badge does NOT appear on non-AI content (`sourceKind: "user"`, `"merchant"`, etc.).
- [ ] **T3f.** Verify AI content without sources renders as draft, not as badge.

## T4 — Official Badge Semantics (Contract §4.2)

- [ ] **T4a.** Render a post with backend-authorized `official` flag. Verify badge shows `"官方"` with `tone: "official"`.
- [ ] **T4b.** Verify official badge does NOT appear when frontend infers official status without backend flag.
- [ ] **T4c.** Verify official badge does NOT appear on user-generated content.

## T5 — Trust Badge State Mapping (Contract §4.3)

- [ ] **T5a.** Render trust badge with `tone: "confirmed"`. Verify label is `"已确认"`, tone is `"success"`.
- [ ] **T5b.** Render trust badge with `tone: "pending"`. Verify label is `"待确认"`, tone is `"warning"`.
- [ ] **T5c.** Render trust badge with `tone: "disputed"`. Verify label is `"有争议"`, tone is `"danger"`.
- [ ] **T5d.** Render trust badge with `tone: "expired"`. Verify label is `"已过期"`, tone is `"neutral"`.
- [ ] **T5e.** Verify each trust badge description explains what the state means and what the user can do next.

## T6 — Accessibility Labels (Contract §5)

- [ ] **T6a.** Verify every rendered badge/chip has an `ariaLabel` attribute.
- [ ] **T6b.** Verify `ariaLabel` describes state, not appearance (e.g., "内容由 AI 辅助生成" not "紫色标签").
- [ ] **T6c.** Verify `ariaLabel` does not duplicate the visible label verbatim — it adds context.
- [ ] **T6d.** Verify `presentTrustStatus("pending")` produces `ariaLabel` containing "待确认 — 用户投稿，暂未核实" or equivalent.
- [ ] **T6e.** Verify `presentTrustStatus("disputed")` produces `ariaLabel` containing "有争议 — 存在不同说法".
- [ ] **T6f.** Verify `presentTrustStatus("expired")` produces `ariaLabel` containing "已过期 — 信息可能不再准确".
- [ ] **T6g.** Verify `presentTrustStatus("ai")` produces `ariaLabel` containing "AI 整理 — 可能不准确".
- [ ] **T6h.** Verify `presentPermissionState("denied")` produces `ariaLabel` containing "无权限".
- [ ] **T6i.** Verify `presentPermissionState("restricted")` produces `ariaLabel` containing "受限访问".
- [ ] **T6j.** Verify all `description` values include the *why*, not just the label.
- [ ] **T6k.** Verify `ariaLabel` is in the user's current locale (Chinese for zh-CN).

## T7 — Contrast and Color Independence (Contract §5.4, §6)

- [ ] **T7a.** Verify each semantic tone has distinct visual treatment (not color alone): icon, text label, or border difference.
- [ ] **T7b.** In high-contrast mode (`prefers-contrast: more`), verify badges remain distinguishable.
- [ ] **T7c.** Verify light mode token values match contract §6.1 table.
- [ ] **T7d.** Verify dark mode token values match contract §6.1 table.
- [ ] **T7e.** Verify no two distinct states share identical color + icon + label combination.

## T8 — UI Primitive Boundary Guardrails (Contract §1.7)

- [ ] **T8a.** Grep `src/ui/**` for imports of `ContentType`, `TrustStatus`, `PlaceType`, `Visibility`, `PermissionState`, `SourceKind`. Verify zero matches.
- [ ] **T8b.** Grep `src/ui/**` for string literals matching domain enum values (e.g., `"experience"`, `"confirmed"`, `"dining"`). Verify zero matches.
- [ ] **T8c.** Verify `TypeChip.vue` accepts `tone: SemanticTone`, not `type: ContentType`.
- [ ] **T8d.** Verify `TrustBadge.vue` accepts `tone: SemanticTone`, not `trustStatus: TrustStatus`.
- [ ] **T8e.** Verify `LocationChip.vue` accepts `tone: SemanticTone`, not `placeType: PlaceType`.
- [ ] **T8f.** Verify `TagChip.vue` accepts `tone: SemanticTone`, not domain enums.
- [ ] **T8g.** Verify `IdentityBadge.vue` accepts `tone: SemanticTone`, not domain enums.
- [ ] **T8h.** Verify presenters are pure functions — same input always produces same output, no side effects.

## T9 — Per-Card Limits (Contract §7)

- [ ] **T9a.** Render a feed card. Verify at most 1 `TypeChip`.
- [ ] **T9b.** Render a feed card. Verify at most 1 `LocationChip`.
- [ ] **T9c.** Render a feed card. Verify at most 1 `TrustBadge`.
- [ ] **T9d.** Render a feed card with 5 tags. Verify only 2–3 `TagChip` visible, rest collapsed.
- [ ] **T9e.** Render a card with `IdentityBadge` + `ContributionLabel`. Verify at most 2 total.

---

## Running This Checklist

1. Start both lanes: `npm start`
2. Open `http://127.0.0.1:4301` (Vue canary) in Chrome DevTools
3. For T1–T2: Call presenter functions directly in the console or via a test harness
4. For T3–T5: Use Vue DevTools to set component props and verify rendered output
5. For T6: Use Chrome DevTools Accessibility panel to inspect `ariaLabel` and `description`
6. For T7: Toggle `prefers-contrast: more` in Chrome DevTools Rendering tab
7. For T8: Run `grep -r "ContentType\|TrustStatus\|PlaceType\|Visibility\|PermissionState\|SourceKind" src/ui/`
8. For T9: Render sample feed cards and count chip/badge instances
9. Repeat critical tests (T1, T2, T6, T8) against `http://127.0.0.1:4300` (legacy lane)

---

## Not Covered Here

- Runtime performance of presenter functions (future — benchmark after implementation)
- E2E tests across real devices (future — #133)
- Visual regression testing of badge/chip rendering (future — screenshot tests)
- Backend contract for `official` flag authorization (see `docs/agent/contracts/api-contract.md`)

---

## Issue Linkage

Part of #188. Related to #188. Does not close #188 — this checklist documents test expectations, not runtime implementation.
