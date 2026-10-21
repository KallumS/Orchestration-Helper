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
  *Superseded 16 October: it is asked for and checked with `gfx.getfont()`;
  see the final sweep below.*
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

## Final sweep (16 October 2026)

Every guideline on the 19 pages that a custom-drawn window can act on, checked
again against this window. Measured at 100% unless it says otherwise.

| Guideline (page) | Verdict | Here |
| --- | --- | --- |
| The system font (Typography) | **fixed now** | San Francisco on a Mac (`.AppleSystemUIFont`, else `SF Pro Text`), Segoe UI on Windows, each confirmed with `gfx.getfont()`; Helvetica, Arial or DejaVu Sans when it is not given. |
| No more than two typefaces; no light weights (Typography) | met | One face, regular and bold. |
| Text never under 10 points (Typography, Accessibility) | met | The smallest is 11 (citations, fact keys, the footer). |
| Leading for multi-line text (Typography) | met | Line height is the font's plus 3 points, about 1.3×. |
| Text cut short, or hidden at large sizes (Typography, Layout) | **fixed now** | At 200% in a narrow window the footer ran off the edge, "+N more" could fall outside it and the search box's hint was clipped mid-word. The footer wraps, "+N more" keeps its room, and the hint becomes "Search" where the long one does not fit. Nothing is cut with "…", so no tooltip is needed. |
| Restrict the width of text for reading (Layout) | **fixed now** | In a wide window the page is a centred column of about a hundred characters, citations at its right edge. Seventy, the usual figure, was measured: it narrows the default window too and its closed index then needs scrolling (ADR 0010). |
| Nothing unreachable as the window narrows; a minimum size (Layout) | **fixed now** | The header's buttons take a second row when they do not fit, instead of crowding over each other; the smallest window that opens grows with the text size (920 × 720 at 200%). A `gfx` window cannot refuse to be made smaller. |
| Non-text contrast 3:1 (Accessibility, Color) | **fixed now** | The name and match chips had no visible edge (their fill is 1.1:1 on the ground) and the search box's edge was 1.4:1: both take `#6D7581`, 3.2:1. The scrollbar's grab was 2.6:1 on its track, now 3.6:1. The ring is 13.6:1, the fold markers 8:1 or more. |
| Colour never alone (Accessibility, Color) | met | The chosen button and match carry the ink bar; a "Use sparingly" header says so in words; open and closed families differ by the triangle's direction. |
| Icon-only controls named (Icons, Accessibility) | **fixed now** | The Back button was a bare "<"; it now says **Back**. |
| Hit targets (Accessibility) | met | Buttons and chips 28 tall with an edge; a family's whole band is its target. |
| The window's title (Accessibility) | **fixed now** | "Orchestration Helper — Trombone", "— Help", "— Sources", so the Window menu and the Dock name the page. |
| Esc lets go before it clears (Accessibility) | met | Esc drops the ring, then clears the box, then goes to the index; it never closes the window. |
| Hover, pressed and chosen look different (Design principles) | met | |
| Popups lighter than the window (Dark Mode) | not applicable | The only popup is REAPER's own menu (`gfx.showmenu`). |
| White page, flashes, Reduce Motion (Dark Mode, Motion) | not applicable | Always dark; the caret blinks about once in two seconds and nothing else moves. |
| Time limits; sound (Accessibility) | not applicable | Nothing reverts on a timer and nothing plays. |
| Mouse-only actions (Accessibility) | met | Every click has a key; the wheel has Page Up and Page Down. |
| The Mac's own shortcuts (Accessibility) | met | None taken. ⌘← and ⌘→ open and close the families only on the index, where the box is empty; ⌘[ for Back was not added: ⌥← and the **Back** button already go back, and how `gfx.getchar` reports Command with punctuation is not documented. |
| Destructive actions (Design principles) | not applicable | Nothing is edited or deleted; closing every family is undone by opening them. |
| Selection dimmed when the window is not in front (Color) | left | Possible through `gfx.getchar(65536)`, but nothing here is a selection the system would dim but the match, and it would be a change of look nobody asked for. |
| Words: "we", idioms, "OK" (Writing, Inclusion) | met | None in the window's own text. |
| Placeholder in the text field (Writing) | met | |
| VoiceOver, Dynamic Type, Increase Contrast, the system appearance | not possible | As above. |

**Unverified in REAPER**: what `gfx.getfont()` reports for the Mac's system face
(the script accepts any name with "System", "SF" or "AppleSystemUI" in it, and
falls back to Helvetica otherwise); that `gfx.init` with a name alone retitles
the open window, as REAPER's documentation says; how the chip edges look on a
Retina display.

Checked by `tests/run.lua`, section *the final sweep*: the face chosen on a Mac
with and without the system face, on Windows with and without Segoe UI, and
elsewhere; every chip and the search box carrying an edge 3:1 on the ground; the
grab 3:1 on its track; the title on an entry and back on the index; at 200% in a
460-point window every header button shown with none over another and no text
past the edge on the index, a page of matches and Help; the smallest window
grown at 200%; a 1800-point window reading as a centred column. Each of eleven
rules was broken on purpose in a copy and the suite failed.
