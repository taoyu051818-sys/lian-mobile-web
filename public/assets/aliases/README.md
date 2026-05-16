# Alias Identity Assets

This directory contains alias identity SVGs used for user avatar display.

## Cross-Repo Contract

These files are shared with `lian-platform-server`. The backend references these filenames as alias identity keys.

**Do not rename, remove, or reformat files in this directory without backend coordination.**

## Files

| File | Alias Identity |
|---|---|
| `curious-passenger.svg` | Curious Passenger |
| `evening-recorder.svg` | Evening Recorder |
| `island-anonymous.svg` | Island Anonymous |
| `morning-breeze.svg` | Morning Breeze |
| `night-owl.svg` | Night Owl |
| `quiet-observer.svg` | Quiet Observer |

## Rules

- Adding a new alias requires backend `alias-service` update.
- Filenames are identity keys — changing them breaks existing user alias assignments.
- SVG format must be preserved for consistent rendering.
