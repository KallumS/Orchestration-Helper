# 0011. Share the colour scheme with Starting Blocks, and spend the accent only on state

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The user asked for the window to match their other REAPER project, and supplied that
project's `COLOUR.md`: a dark cool-grey ramp, light grey controls, and one yellow
(`#FFF200`) for whatever is switched on.

The existing palette had **two decorative accents** — amber item labels, blue section
headers — which is two more than the scheme allows. The scheme's own rule is that the
accent marks *state*, not structure: "if a second thing wants the accent, it probably
wants the ramp instead."

That is a real conflict, not a cosmetic one. An encyclopaedia page has a lot of
structure that wants colour.

## Decision

Adopt the scheme, and resolve the conflict in the scheme's favour:

- `C` is keyed by **role**, not shade, and built with `hex(0xRRGGBB)` so it can be
  read against `COLOUR.md` directly.
- **The accent goes on three things only**: the current view's header button, the
  selected match chip, and the text caret.
- Item labels and section headers come off the grey ramp, so hierarchy on an entry
  page rests on **weight, size and lightness** rather than hue.
- **Index chips were deliberately not made light-grey controls**, even though the
  scheme's control fill is light and the chips are clickable. 120 light pills would
  dominate a reading surface; they are frames off the ramp instead.

## Consequences

- The two windows read as one hand, which was the point.
- **Entry pages lost their hue hierarchy.** This is the significant cost. Amber and
  blue were doing real work distinguishing labels from headers, and that work now
  falls on weight and lightness alone. It is the first thing to look at in REAPER.
- Two quieter consequences surfaced only by looking at the result:
  - Section headers at `#BFC5CE` are now **dimmer than the item labels beneath them**
    at `#F2F4F7`. Left as is, because caps, a smaller size and a solid rule already
    mark a divider — it need not also win on brightness.
  - The rule under each header was drawn at **28% alpha of the header colour**, which
    was fine for a saturated blue and invisible for a grey. It now takes `C.line` at
    full alpha.
- **Light controls force dark text**, and that reaches every button, not just the
  chosen one — style only the chosen state and every other control goes unreadable.
- A light theme would need a second ramp and a rethink of that inversion, so there is
  no theme switch.

## Enforcement

`tests/run.lua` parses `C` out of the script source and checks: R < G < B in every
grey (exempting `accent` and `warn`); `accent` and `bg` match the shared values
exactly, so the two projects cannot drift; `warn` is not a shade of the accent, so a
warning can never read as a selection; `control` is lighter than `bg` with `ink`
readable on it; `C.accent` appears at most four times; and `C.accent2` not at all.

What no test can check is appearance. The scheme has been applied but never seen.
