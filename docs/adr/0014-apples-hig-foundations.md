# 0014. Apple's HIG Foundations are the standard for the window

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The user asked for every one of their apps to follow Apple's Human Interface
Guidelines, as Transient Shuffler does, and sent the 19 Foundations pages. Writing
was already done (ADR 0013). Checked against the rest
([`docs/apple-hig-review.md`](../apple-hig-review.md)), the window fell short in
five places:

- **Contrast.** Citations and fact keys (`dim`, `#8A919C`) were 4.7:1 on the
  ground, the quietest text (`faint`, `#6D7581`) about 3.2:1, and the "Use
  sparingly" headers (`warn`, `#D2483F`) 3.4:1. Apple asks for 7:1 for small text
  in a dark window, and the citations are 11 pixels.
- **Text size.** One size, set by the display's pixel density alone.
- **Control size.** Header buttons 22 pixels tall, 6 apart; chips about 21 tall.
  Apple's Mac default is 28 points, about 12 apart.
- **The keyboard.** Every entry could be reached by typing, but not the Text Size
  choice, the Sources page, a family on the index or a name on a page.
- **Colour alone.** The current view's button and the chosen match were marked
  only by being yellow.

The sister scripts are ReaImGui windows and took Midi Suggester's 0009, which
leans on ReaImGui's keyboard navigation and menu bar. This window is `gfx` only
(ADR 0001), so each of those had to be drawn by hand.

## Decision

- **Every line of text is at least 7:1 on the ground.** `dim` is `#BAC0C9`
  (8.2:1), `faint` `#B0B6C0` (7.4:1), and a warning in words takes `warn_text`
  `#FF9E96` (7.6:1). The house red `#D2483F` stays for the rule under a warning
  header, which is not text.
- **Text Size: 100%, 125%, 150% or 200%.** A **Text Size** button at the top
  opens a menu (`gfx.showmenu`), and Ctrl with `=`, `-` and `0` (Cmd on a Mac)
  make the text bigger, smaller and 100%. It multiplies `SCALE`, which every
  measure already goes through, so the whole page grows with it. Saved as a
  percentage under the ExtState key `textsize`; anything else loads as 100%.
- **Controls 28 points tall, 12 apart**: the header buttons, the match chips and
  every name chip on a page. Button labels are 13 points (`F.SUB`), the Mac's
  default, up from 11.
- **Tab and Shift+Tab move a ring** round the header buttons, the matches and
  every family and name on the page, in reading order, scrolling a name into
  view. **Return or Space presses** the ringed one; Esc drops the ring before it
  clears the box, and typing drops it and goes to the box. The ring is the
  near-white `#F2F4F7`, two pixels outside the control: yellow means *on*, and a
  ringed control need not be.
- **A chosen control carries an ink bar** under its label, as well as being
  yellow.
- **Clicks are ignored for a quarter of a second after the menu closes.** The
  click that chose an item can come back to the window once a modal menu closes;
  ScaleView for REAPER found it reaching the window up to three frames late.

## Consequences

- At 200% in a narrow window the header buttons need about 500 pixels; below
  that the window's name is left out first, then the buttons crowd. The window
  can be widened; nothing is lost.
- The footer stays at the bottom. Apple advises against putting anything
  important there; it only repeats keys the Help page lists.
- **The caret still blinks.** It is the system's own convention and the only
  motion in the window, so there is no Reduce Motion setting.
- The font is still Helvetica on a Mac (the system face is not named to `gfx`
  reliably), Arial on Windows, DejaVu Sans elsewhere.
- Not met, because a `gfx` window can't: VoiceOver, Voice Control, Dynamic Type,
  Increase Contrast.
- Unverified in REAPER: whether Ctrl/Cmd with `=`, `-` and `0` reach the window
  as those characters with Ctrl set in `mouse_cap` (the Text Size button does the
  same either way), and how `gfx.showmenu` places the menu.
- The harness now records every `gfx.rect` (position, fill and colour) and
  answers `gfx.showmenu` from `_H.menupick`, with a clock for
  `reaper.time_precise`. That is how the ring, the bar and the sizes are checked;
  it does not yet catch the reordering ADR 0008 warns about, though it now could.

## Enforcement

`tests/run.lua`, section *Apple's HIG Foundations*: every string drawn on five
pages (the index with every family open, Help, no result, a page with a "Use
sparingly" header, and several matches) is 7:1 or better on the ground, or on
the control for the ink; Ctrl+=, Ctrl+- and Ctrl+0 change the size, stop at
200%, are remembered and scale the page, and `=` alone still types; a nonsense
saved size loads as 100%; the menu ticks the current size and sets the chosen
one; a click straight after the menu is ignored and one a moment later is not;
the header buttons and every name chip are 28 tall and 12 apart; only the chosen
button carries the ink bar; Tab rings the first button, Space and Return press,
Shift+Tab goes back round, Tab scrolls a name into view, Esc and typing drop the
ring; Help names the keys. Each of 21 rules was broken on purpose and the suite
failed.
