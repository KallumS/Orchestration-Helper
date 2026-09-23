# 0001. `gfx` only, no ReaImGui or extensions

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

REAPER offers several ways to put a window on screen. `gfx` is built into ReaScript
and always present. ReaImGui gives a real widget toolkit — layout, scrolling, text
input, styling — but is a third-party extension the user must install through ReaPack.
SWS and js_ReaScriptAPI add further conveniences, including clipboard access.

The brief was an offline reference the user could open and type into. Anything that
makes a stock REAPER install insufficient is a barrier between the user and the
first search.

The generated API reference settles the factual part: **59 `gfx.` entries and zero
matches for `ImGui`.** ReaImGui is not part of the API; it is a plug-in that adds to
it.

## Decision

Use `gfx` and the core `reaper` API only. No ReaImGui, no SWS, no js_ReaScriptAPI.
A stock REAPER install runs the script with no dependencies at all.

## Consequences

Everything a widget toolkit provides has to be built:

- **Layout** — hence ADR 0002 and the two-stage row list.
- **Scrolling** — hand-rolled, with a hand-drawn scrollbar and the clamping rule of
  ADR 0009.
- **Text input** — the search box is a string, a caret index and a blink counter.
- **Every hover and pressed state** — `inrect()` is tested at draw time and the fill
  chosen there; `button()` reads `cap(1)` itself. There is no style stack to push.
- **No clipboard.** `CF_SetClipboard` is SWS, so entries cannot be copied out. This is
  a real loss and there is no workaround within the constraint.
- **No bitwise operators**, so `gfx.mouse_cap` is tested arithmetically via `cap(bit)`.
  That keeps the script running on every Lua version REAPER has shipped, including
  the 5.3 in REAPER 6.x and earlier.

In exchange the script is a single file plus two data files, and it will run on any
install without the user being asked to fetch anything.

## Enforcement

Nothing mechanical — a reviewer has to notice. The list of `gfx` functions that exist
but are unused is kept in `CLAUDE.md` precisely so the next person reaches for one of
those rather than for an extension. When in doubt the API reference is the authority,
and if it is not to hand, prefer the primitive already used in the file (see the
`gfx.triangle` episode in the session log, §6b and §6c).
