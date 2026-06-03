# BLCU locale coverage and RTL scope

This note records the shipped LIAN mobile-web locale coverage after the merged BLCU international-student locale waves. It is documentation only; runtime source remains authoritative for the registered locale list and document-direction behavior.

## Shipped locale inventory

The shipped mobile-web UI locale set is defined by `src/locales/resolveLocale.ts` and wired through `src/locales/index.ts`.

- Shipped locales: zh-CN, zh-TW, en, ja, ko, ru, vi, id, es, fr, ar, de, it, pt, tr, th, mn, kk
- Pre-BLCU baseline: zh-CN, zh-TW, en, ja
- BLCU wave 1: ko, ru, vi, id, es, fr, ar
- BLCU wave 2: de, it, pt, tr, th, mn, kk
- RTL locales: ar

## Wave lineage

- PR #955 shipped the BLCU wave 1 expansion by adding `fr` and `ar`, preserving the already-supported BLCU target locales `ko`, `ru`, `vi`, `id`, and `es`, and adding the Arabic document-direction switch.
- PR #961 shipped BLCU wave 2 by adding `de`, `it`, `pt`, `tr`, `th`, `mn`, and `kk`, bringing the registered set from 11 to 18 locales.

Both waves keep message-key parity against `zh-CN` for their registered locale files, guarded by `tests/locales/i18n-blcu-parity.test.ts`.

## RTL and document-direction boundary

RTL scope is limited to setting `<html lang>` and `<html dir>` from the active locale; only Arabic (`ar`) ships with `dir="rtl"` today. This means the app exposes the correct document language and direction metadata for Arabic, but this note does not claim a full component-by-component RTL visual mirroring audit or CSS logical-property conversion.

Merchant/errand domain constants that still live outside `src/locales/` are not claimed as localized by this coverage note.

## Implementation references

- `src/locales/resolveLocale.ts` owns `SUPPORTED_LOCALES`, `RTL_LOCALES`, locale matching, and the `isRtlLocale()` helper.
- `src/locales/index.ts` registers locale messages and mirrors the active locale onto the document root.
- `tests/locales/i18n-blcu-parity.test.ts` checks BLCU locale key parity and keeps this documentation aligned with the shipped locale and RTL lists.
- `tests/e2e/i18n-blcu-expansion.spec.ts` verifies the Arabic runtime path sets `document.documentElement.dir` to `rtl`.
