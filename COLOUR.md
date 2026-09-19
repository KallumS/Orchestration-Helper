# The colour scheme

Shared with Starting Blocks, so the two windows look like they came from the same
hand. A dark cool-grey ground, a light grey for the controls raised off it, and
one yellow for whatever is switched on.

This file is **not generated** — it is a reference, kept by hand. If you change a
colour in `Orchestration Helper.lua`, change it here too. The suite checks the
parts that can be checked mechanically (see *What the suite enforces* below); the
rest is judgement, which is what the rest of this file is for.

## The four that carry it

| | value | what it is |
| --- | --- | --- |
| Accent | `#FFF200` | whatever is switched on |
| Controls | `#A9AFBA` | the header buttons, raised off the ground |
| Ground | `#23272E` | the window behind everything |
| Ink | `#14171C` | the text on any button |

## The roles, as the script names them

`C` in `Orchestration Helper.lua` is keyed by role, not by shade, so a call site
reads as intent. `hex()` turns `0xRRGGBB` into the 0–1 triple `gfx.set` wants, so
the table can be written in the same notation as this file.

| role | value | where it lands |
| --- | --- | --- |
| `bg` | `#23272E` | the ground; also `gfx.clear` |
| `panel` | `#1B1F25` | header bar, footer |
| `sunken` | `#1A1D23` | chip rest, search box, scrollbar track |
| `frame_hover` | `#22262D` | chip hover, fold-row hover |
| `panel2` | `#2A2F37` | search box while the pointer is over it |
| `line` | `#3A404A` | separators, the rule under a section header |
| `ink` | `#14171C` | text on the header buttons |
| `text` | `#DDE1E7` | body text, chip labels |
| `head` | `#BFC5CE` | section headers |
| `dim` | `#8A919C` | citations, fact keys, closed fold markers |
| `faint` | `#6D7581` | the quietest text |
| `title` | `#F2F4F7` | page titles, item labels, anything hovered |
| `control` | `#A9AFBA` | header button fill |
| `control_h` | `#C0C6CF` | header button hover |
| `control_a` | `#8F96A2` | header button held |
| `grab` | `#585F6B` | scrollbar grab |
| `accent` | `#FFF200` | the current view's button, the selected match, the caret |
| `warn` | `#D2483F` | "Use sparingly" headers |

## What the accent is spent on

Three things, all of them a state that is *on*:

- the header button for the view you are looking at,
- the selected chip in the match strip,
- the text caret.

Nothing else. This is the part of the scheme most easily lost here, because an
encyclopaedia page has a lot of structure that *wants* colour. Before this scheme
landed, item labels were amber (`#E0A86A`) and section headers blue (`#7FB2D9`) —
two decorative accents, which is two more than the scheme allows. They now come
off the ramp, so hierarchy on an entry page rests on weight, size and lightness:

```
page title        #F2F4F7   21px bold
section header    #BFC5CE   12px bold, UPPERCASED, solid rule under it
item label        #F2F4F7   14px bold
detail            #DDE1E7   14px, indented under the label
citation          #8A919C   11px, right-aligned
```

A section header is dimmer than the item labels below it, which sounds wrong and
is not: the caps, the smaller size and the rule already mark it as a divider, so
it does not need to win on brightness too.

## Two rules worth carrying

**Keep the greys blue.** R < G < B holds in every grey. It is the least obvious
property here and the easiest to lose, because a neutral grey at the same
lightness looks perfectly correct in a diff and only reads as flat once it is on
screen beside the yellow. Taking the scheme elsewhere means taking the bias, not
the hexes.

**Light controls force dark text.** `control` sits far lighter than the ground, so
`text` (`#DDE1E7`) vanishes on it. Every header button takes the `ink`, including
the unchosen ones. This fails quietly: style the chosen state alone and it looks
right while every other button goes unreadable. The same applies to the selected
match chip, which is filled with the accent and so is lettered in ink.

## What `gfx` changes about it

Starting Blocks is a ReaImGui window and sets `Col_*`. This one is `gfx` only —
no ReaImGui, no SWS — so there is no style stack and no widget library. Three
consequences:

- **Every state is drawn by hand.** There is no hover machinery, so `inrect()` is
  tested at draw time and the fill chosen there. `button()` reads `cap(1)` itself
  to get the held state.
- **Hover is only honoured where the row is really visible.** The body is drawn
  before the opaque top strip and footer, so a row scrolled under either would
  otherwise light up under a pointer that is nowhere near it. Chips and fold rows
  check `y >= top and y + h <= bottom` before testing the pointer.
- **No derived shades.** Starting Blocks computes the accent's hover and held
  states with `shade()`. Here the accent never hovers — it only marks state — so
  all twenty values are stored literally and nothing is computed.

## What the suite enforces

`tests/run.lua`, section *Colour scheme*, parses the `C` table out of the script
and checks:

- R < G < B in every role except `accent` and `warn`, the two saturated colours;
- `accent` is `#FFF200` and `bg` is `#23272E`, so the two windows cannot drift;
- `warn` is not a shade of the accent (R > G > B), so a warning can never read as
  a selection;
- `control` is lighter than `bg` by a margin, and `ink` is dark enough against
  `control` to read — the pair that makes the dark-text rule necessary;
- `C.accent` appears at most four times in the whole script, and `C.accent2` not
  at all, so a decorative accent cannot creep back in.

What it cannot check is appearance. Nothing in this repo has been run inside
REAPER, and the harness approximates font metrics, so the scheme has been applied
but never *seen*.
