# Card camera transition

This document defines the product motion model for opening a feed card into a detail page.

## Goal

The transition is not a generic page slide. It is a camera/viewpoint transfer.

The user taps a card, the interface freezes a global viewpoint, then the selected card moves toward the visual center, expands, and morphs into the detail surface. Returning from detail reverses the same transformation.

## Fixed chrome rule

Top and bottom floating chrome are fixed global objects.

- Top chrome exits upward and enters from the top.
- Bottom chrome exits downward and enters from the bottom.
- Chrome has fixed size and position.
- Page content adapts to chrome dimensions.
- Page content must not resize or reposition chrome directly.

## Enter transition

1. **Freeze viewpoint**
   - Preserve the current feed viewport visually.
   - Do not immediately replace the whole page.
   - The selected card becomes the transition actor.

2. **Move selected card to center**
   - The card moves from its original rect to the viewport center.
   - The motion is centered around the image.
   - The card scales/expands into a detail-sized surface.

3. **Swap chrome**
   - Home chrome exits first.
   - Detail chrome enters only after the card has started expanding.
   - Chrome swap should not fight the card motion.

4. **Morph card structure into detail structure**
   - Image remains the center anchor.
   - Existing card parts should transform into detail parts rather than disappearing.

## Element morph rules

### Image

The image is the visual anchor. It grows and settles into the detail image window.

### Tag

The tag emerges from below and replaces the original avatar/author area.

### Time / location row

The time row travels from above toward the lower action area. It replaces the original like/action button region before the detail metadata expands.

### Reply affordance

After tag and time replacement, the lower area expands and grows the reply affordance.

### Title/body

The card title expands into the detail title/body stack after the image reaches its detail position.

## Return transition

Returning from detail reverses the same camera path:

1. Reply affordance contracts.
2. Time/location row retreats.
3. Tag collapses back into the card meta area.
4. Detail surface shrinks toward the original card rect.
5. Home chrome returns from the bottom/top according to fixed chrome rules.

## Implementation status

The product motion described above is implemented by `useDetailCardifyMotion.ts` (return-side cardify scale + translate animation back to the original card rect) plus `FeedItemCard.vue` exposing `data-motion-role` anchors that future stages can use for forward-side morph.

### Ownership

- `useFeedDetail.ts` owns detail data lifecycle, history/popstate, close orchestration (`closeDetailWithCardify`), and chrome handoff.
- `useDetailCardifyMotion.ts` owns the return-side animation: scale, translate, and radius interpolation back to `lastOpenSnapshot.rect`.
- Chrome visibility is declarative: feature views emit `PageChromeSpec` with `autoHideOnDetail`, and the shell's `applyPageChrome` handles hiding/showing chrome through `ShellChrome`'s `data-visible` attribute.

### Future stages

Future stages should add a forward-side morph that uses the existing `data-motion-role` anchors as real DOM targets, replacing the current "details just appear" open transition. The return-side animation in `useDetailCardifyMotion.ts` is the reference implementation for what the forward side should look like in reverse.
