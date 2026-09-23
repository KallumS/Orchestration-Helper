# 0010. The index folds, closed by default, with the open set persisted by name

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The index listed every entry as a clickable chip under its family heading. At 120
entries that was a wall of chips several screens deep, and the search box — the
primary way in — was pushed to the top of a long scroll.

The user asked for the families to be collapsible. The question was whether `gfx`
could do it (ADR 0001 rules out any widget library) and what the default should be.

It turned out to need no new REAPER capability at all, because ADR 0002 had already
done the hard part: `layout()` emits rows with absolute `y`, so a fold is simply *do
not emit the chips*.

## Decision

The index emits one `fold` row per family, and the family's chips **only when it is
open**. `st.open` maps family name → `true`; everything else follows.

Four sub-decisions worth recording because each had an alternative:

1. **Closed is the default.** A first run shows the search box over twelve family
   bands and nothing else. That is the point of the change, not a preference.
2. **The open set is persisted by family *name*** — a tab-separated list under
   `ExtState` key `open` — **not as a bitmask over the `rank` order.** A bitmask
   would shift when a family is added, so a new family would inherit whatever its
   neighbour had saved. By name, a new family simply starts closed.
3. **The whole band is the click target**, not the words: the `fold` row spans `maxw`
   and registers one hotspot across it.
4. **Ctrl+Right / Ctrl+Left** open and close every family. No unmodified key was
   available, because every printable character 32–126 goes into the search box.

## Consequences

- The window opens as a search box over a short list, which is what an encyclopaedia
  should look like.
- **The fold does not animate.** `gfx` has no timer-driven redraw worth building on
  for this, so a family snaps open. Judged not worth fixing.
- Adding a family now has two obligations rather than one: the `rank` table (ADR 0002)
  and the knowledge that it will start closed.
- The hover bug from ADR 0008 **reappeared** in the new row type, which is the
  clearest available evidence that the full-visibility gate is easy to forget.
- On macOS these are Cmd+Right / Cmd+Left, because `gfx.mouse_cap` bit 4 is Control on
  Windows and Command on macOS. Worth knowing before someone "fixes" the binding.

## Enforcement

`tests/run.lua` checks that the index opens with every family closed, that the closed
index fits without scrolling, that clicking a band opens only that family, that
clicking again closes it, that Ctrl+Right and Ctrl+Left work the whole index, **and
that the open set survives a reload** — which is the persistence decision tested
directly rather than assumed.
