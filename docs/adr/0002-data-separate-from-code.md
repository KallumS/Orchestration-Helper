# 0002. Data files separate from the renderer, and layout driven by the data

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The content is an encyclopaedia: at the time of writing 123 entries and 1,520 cited
items, and growing every time a source arrives. The interesting work is editorial, not
graphical. If adding an entry means touching the renderer, the editorial work is gated
behind programming, and the renderer accretes a special case per entry.

## Decision

Content lives in `orchestration_data.lua` and `orchestration_composers.lua` as plain
Lua tables. `layout()` walks an entry's `sec` list and emits **primitive typed rows**
generically — `text`, `kv`, `chips`, `rule`, `hrule`, `gap`, `fold` — each with an
absolute `y`. It never asks what the entry is about.

Adding entries, sections or items requires **no code changes**. Only three things do:

1. a new top-level **family** → add it to the `rank` table inside `layout()`, or it
   sorts to the end of the index;
2. a new **source tag** → add it to the `order` array in the `sources` view, or it
   will not appear on the Sources page;
3. a section title containing `"sparingly"` is coloured as a warning, which is a
   semantic dependency on a substring.

## Consequences

- Editorial work is unblocked: eight rounds of source material have been absorbed
  without the renderer changing much beyond adding row types.
- The renderer cannot lay out anything the row vocabulary does not cover, so a new
  presentational idea means a new row type rather than a special case. This has proven
  the right trade: `fold` was added in one pass (ADR 0010).
- **The `"sparingly"` substring dependency is a wart.** It is load-bearing and
  invisible: rename a section to "Use with care" and the warning colour silently
  disappears. It survives because the alternative — a flag on every section — would
  clutter 1,520 items to serve a dozen.
- The `rank` table and the `order` array are both places where data can be added and
  silently mis-sorted or dropped.

## Enforcement

`tests/run.lua` renders **every entry at three window sizes** plus four extreme ones,
so a malformed entry fails the suite rather than the user's first search. The Sources
page `order` array is checked against the declared sources, so a new tag cannot be
added without appearing there.
