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

## Current implementation stage

The first implementation stage uses a transition overlay:

- `FeedItemCard.vue` exposes motion anchors through `data-motion-role` attributes.
- `card-camera-transition.css` controls the overlay moving from card rect to center.
- Tag, time, and reply are currently represented by overlay styling and pseudo-elements to validate timing and direction.

Future stages should replace pseudo-elements with real DOM morph targets and connect values from the selected feed item rather than static placeholder text.
