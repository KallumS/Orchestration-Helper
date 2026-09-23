# 0008. Draw the body before the opaque top strip and footer

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

`gfx` has no viewport, no clipping rectangle and no scroll container (ADR 0001). The
window has a fixed header with the search box and match chips at the top, a footer of
key hints at the bottom, and scrolling content between them. Something has to stop the
scrolling content from being drawn over the header.

Two earlier attempts failed:

1. **Draw the header first, then mask.** A small rect was painted to cover the gap.
   Scrolled text still collided with the search box, because the mask only covered
   where the author expected the collision to be.
2. **Mutate `gfx.h` to fake a viewport.** Not supported; `gfx.h` is the window height,
   not a clip bound, and writing to it does not constrain drawing.

## Decision

The frame runs in this order, and the order is load-bearing:

```
top_geometry()   -- measures the header/search/match strip, draws nothing
draw_body(top, bottom)
draw_top(g)      -- opaque; paints over body content scrolled above `top`
draw_footer(g)   -- opaque; paints over body content below `bottom`
handle_mouse()
```

The body is drawn **first**, and the top strip and footer are **opaque**, so they
overpaint anything that scrolled under them. `top_geometry()` exists as a separate
measuring pass because the body needs to know how tall the strip is before the strip
is drawn.

## Consequences

- Clipping is achieved with no clipping API, at the cost of overdrawing a band at the
  top and bottom of every frame. Measured cost is negligible.
- **Hover must be gated on full visibility.** A row scrolled under the opaque strip is
  still *logically* at a mouse position the pointer might occupy, so without a check it
  lights up while invisible. Chips and fold rows test
  `y >= top and y + h <= bottom` before testing the pointer. This bug reappeared when
  the `fold` row type was added (ADR 0010), which is the clearest evidence the
  constraint is easy to forget.
- Any new row type that responds to the mouse inherits the same obligation.
- Reordering these four calls silently reintroduces the original collision. There is no
  error, just text over the search box.

## Enforcement

Nothing mechanical catches a reorder — the harness stubs `gfx.rect`, so it cannot see
overpainting. `CLAUDE.md` says "do not reorder these" and the session log records both
failed attempts. This is the decision in this list most exposed to accidental reversal.
