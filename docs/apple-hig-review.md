# Review against Apple's Human Interface Guidelines: Foundations

Orchestration Helper checked against all 19 Foundations pages (the user's copy,
October 2026), the same review Transient Shuffler had. Writing was done first,
on its own ([ADR 0013](adr/0013-window-text-follows-apples-writing-guidelines.md));
this covers the rest ([ADR 0014](adr/0014-apples-hig-foundations.md)).

The window is drawn with REAPER's `gfx` API inside REAPER (ADR 0001), so some
guidance cannot apply: a script cannot reach VoiceOver, Dynamic Type or Increase
Contrast, or read the system's appearance. Where a guideline is not met for that
reason, this says so rather than counting it as met.

## What changed

| Guideline | Before | Now |
| --- | --- | --- |
| **Accessibility, Dark Mode: contrast** | Citations and fact keys 4.7:1, the quietest text about 3.2:1, "Use sparingly" headers 3.4:1. | Every line of text at least 7:1, the target for small text in a dark window: `dim` `#BAC0C9` (8.2:1), `faint` `#B0B6C0` (7.4:1), warnings in words `#FF9E96` (7.6:1). |
| **Accessibility, Typography: larger text** | One size, set by the display alone. | **Text Size** at the top: 100%, 125%, 150% or 200%, also Cmd+=, Cmd+- and Cmd+0 (Ctrl on Windows). Remembered. The whole page grows with it. |
| **Typography: default size** | Button and chip labels 11 points. | 13 points, the Mac's default; body text was already 14. |
| **Accessibility: control size and spacing** | Header buttons 22 tall, 6 apart; chips about 21 tall, 6 apart. | 28 points tall (Apple's Mac default), 12 apart. |
| **Accessibility: the keyboard alone** | Search, arrows, Esc and F1; no way to reach Sources, a family or a name without the mouse. | **Tab** and **Shift+Tab** move a white ring round every button, match, family and name, scrolling to it; **Return** or **Space** presses it. |
| **Accessibility, Color: more than colour alone** | The current view's button and the chosen match were only yellow. | Each also carries a dark bar under its label. |

## Already met

- **Search first, nothing hidden.** The window opens on the search box over the
  folded index; everything is one word away, and the Help page lists every key.
- **No time-boxed elements.** There are no messages that disappear; the only
  message is a load failure, in REAPER's own message box.
- **Motion.** Nothing animates but the text cursor, which blinks as the system's
  does. No Reduce Motion setting is needed.
- **Dark Mode.** Always dark. Apple allows this for apps built around media, and
  advises against an app-only appearance setting; it is also the house scheme.
- **Layout.** Nothing important at the bottom: the footer only repeats keys the
  Help page lists. The page reflows to the window's width.
- **Writing.** ADR 0013.
- **Privacy.** Nothing is fetched or sent; it works offline. Only the window's
  place, the open families and the text size are saved, in REAPER's own settings.
- **Inclusion.** Plain musical words; every item says where it comes from.

## Not met, because a `gfx` script can't

- **VoiceOver, Voice Control and Switch Control** cannot read a `gfx` window.
- **Dynamic Type and Increase Contrast** cannot be read from a script. Text Size
  and the 7:1 colours stand in for them.
- **The system font.** `gfx` takes a face by name; the Mac's system face is not
  reliably named that way, so it stays Helvetica (Arial on Windows).
- **Right to left.** English only.

## Not relevant

Materials (Liquid Glass), app icons, icons and SF Symbols, images, spatial
layout and immersive experiences: the window has none of these.

## Unverified in REAPER

- Whether REAPER hands Cmd+=, Cmd+- and Cmd+0 to the window as those characters
  with Command set (the Text Size button does the same either way).
- Where `gfx.showmenu` opens the Text Size menu (it is asked for under the
  button).
- How a two-pixel outline looks at each display density.

## Checked by

`tests/run.lua`, section *Apple's HIG Foundations*, through the headless harness,
which now records every rectangle drawn: every string on five pages at 7:1, the
sizes and their keys and menu, the 28-point controls 12 apart, the ink bar, and
the ring under Tab, Shift+Tab, Return, Space, Esc and typing. Each of 21 rules
was broken on purpose and the suite failed.
