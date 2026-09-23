# 0009. Clamp the scroll position in exactly one place

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

`st.maxscroll` depends on the content height, which is only known **after** a layout
pass. Key handlers and the mouse wheel run in the same frame as the layout they affect.

The obvious implementation — clamp when the scroll changes — produced a real bug:
pressing PgDn in the same frame as a view change did nothing at all. The keypress was
clamped against the *previous* view's `maxscroll`, which was smaller, so the target was
discarded before the new, taller layout existed.

## Decision

`draw_body` clamps `st.scroll` against `st.maxscroll`, and **nothing else clamps**.
Key handlers and the wheel set deliberately **unclamped** targets, including
`st.scroll = math.huge` for Ctrl+End.

## Consequences

- `st.scroll` is temporarily out of range between the keypress and the next
  `draw_body`. That is intended, and looks wrong to anyone reading a handler in
  isolation — hence this record.
- A handler that "helpfully" clamps reintroduces the bug in a form that is hard to
  diagnose, because the symptom is a keypress doing nothing rather than an error.
- `math.huge` as a sentinel works only because the single clamp site resolves it. It
  would be a live float in any other design.
- Any new scroll source — a scrollbar drag, a jump-to-section link — must follow the
  same rule.

## Enforcement

`tests/run.lua` drives PgDn twelve times against a long entry and checks that content
from the bottom of the page is reached, which fails if clamping moves. The
harness's frame-boundary sentinel (a `false` in the key queue) exists so that this
scenario can be reproduced one keypress per frame.
