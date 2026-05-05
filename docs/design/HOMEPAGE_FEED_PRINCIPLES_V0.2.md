# LIAN Homepage Feed Principles V0.2

This note overrides the earlier homepage-heavy interpretation in `LIAN-Campus-UI-UX-Guidelines-V0.1.md`.

The LIAN homepage should be simple. It is not a portal page, feature grid, map entry page, search page, promotion page, or large hero page. It is primarily a card stream.

## Core principle

```text
Cards carry information. The recommendation system distributes information. UI only provides restrained signals.
```

## Homepage answer

The homepage answers:

```text
What should I look at now?
```

That answer should come from the feed itself, not from stacked modules.

## Default shape

```text
Light distribution context
Restrained feed tabs
Recommended card stream
```

The homepage should not default to:

```text
large hero
feature grid
heavy search block
large daily-news block
large map entry
large publish entry
promotion banner
```

Search, map, and publish can exist, but they should not compete with the feed. Search can be a light affordance. Map should mostly be reached through the bottom tab or location chips. Publish should live in the publish tab or a restrained floating action when needed.

## Feed channels

Initial channels should stay small:

```text
推荐
热帖
经验
讨论
饭堂
附近
```

A channel is a distribution context, not a decorative tab.

## Algorithm and UI split

| Layer | Responsibility |
|---|---|
| Recommendation | order, diversity, cold start, interest matching, location relevance, quality balance |
| Card structure | present one clear main idea |
| Small UI signals | lightly distinguish type, place, trust, identity, and time |
| Navigation | switch context without turning the homepage into a dashboard |

The UI should not compensate for weak recommendation logic by adding heavy homepage modules.

## Card rule

Homepage cards should be more similar than different.

Allowed compact shape:

```text
image
#primary-tag
title
place · alias / author · time
```

Allowed fuller shape:

```text
title
summary / image / content module
[type] [place] [state]
alias · identity / contribution
time · comments · saves · sedimentation state
```

Do not use full-card background colors to distinguish content type.

Use small chips, icons, light accents, labels, and card modules instead.

## Homepage checklist

```text
1. Does the first screen serve the card stream?
2. Did we avoid large hero, feature grid, and heavy search blocks?
3. Are type, place, identity, and state signals restrained?
4. Is recommendation doing the main distribution work?
5. Are tabs few and clear?
6. Do publish, map, and search avoid stealing the feed's priority?
```

## Implementation notes

1. Keep homepage as a simple card stream.
2. Remove normal-user deployment/debug probes from the homepage.
3. Keep `TagChip`, `IdentityBadge`, and `LocationChip` visually restrained.
4. Preserve card interaction priority: button > chip > image > identity > card body.
5. Let recommendation logic do the distribution work; do not add heavy homepage modules to compensate.
