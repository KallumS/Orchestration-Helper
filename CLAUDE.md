# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A ReaScript (Lua) for REAPER: an offline orchestration encyclopaedia. The user
types an instrument, section or composer and gets doublings, pairings and
combinations, each item citing its source. Two data files hold the content; one
script renders them.

Read `README.md` for the user-facing description and the source bibliography.
Read `docs/SESSION-LOG.md` for why things are the way they are — decisions,
rejected alternatives, and the bugs already found and fixed.

## Commands

There is no build step and no linter.

```bash
lua5.4 tests/run.lua              # the whole suite (109 checks); exits non-zero on failure
luac5.4 -p 'Orchestration Helper.lua'   # syntax check without running
luac5.4 -p orchestration_data.lua
```

A fresh container has no Lua: `apt-get install -y lua5.4`.

The suite has no per-test filter. To run one scenario, drive the harness
directly — this is the normal way to investigate behaviour without REAPER:

```lua
dofile("tests/harness.lua")
_H.type("trombone")          -- types the string, then ends the frame
_H.press(_H.K("pgdn"), 4)    -- one keypress per frame, 4 frames
local drawn = _H.run(30)     -- run up to 30 frames, return every drawstr
print(table.concat(drawn, " | "))
```

`tests/harness.lua` is a headless stand-in for the `gfx` and `reaper` APIs.
Helpers it provides: `_H.type`, `_H.press`, `_H.keys`, `_H.raw`, `_H.frame`,
`_H.run`, `_H.drawn`, `_H.clear_drawn`, `_H.frameno`, `_H.setsize`,
`_H.mouse(x,y,capbits)`, `_H.wheel`, `_H.K`, `_H.datapath`, `_H.composerspath`.
`_H.onframe` is not provided but *called if you assign it* — a per-frame hook, the
way to inject a click or resize partway through a run. A `false` in the key queue
is a frame boundary, which is what `_H.type` and `_H.press` append; without it
every queued key is consumed in a single frame.

**The harness approximates font metrics** (character count × size factor). It
verifies structure and behaviour, never appearance. Nothing in this repo has been
run inside REAPER.

## Architecture

### Data drives layout

`layout()` walks the entry's `sec` list and emits rows generically. Adding
entries, sections or items requires **no code changes**. Only these need code:

- a new top-level *family* → add it to the `rank` table inside `layout()`, or it
  sorts to the end of the index
- a new *source tag* → add it to the `order` array in the `sources` view, or it
  will not appear on the Sources page
- a section title containing the substring `"sparingly"` is coloured as a warning
  (`header()` checks for it) — a semantic dependency on the string

### Frame pipeline (order matters)

```
top_geometry()   -- measures the header/search/match strip, draws nothing
draw_body(top, bottom)
draw_top(g)      -- opaque; paints over body content scrolled above `top`
draw_footer(g)   -- opaque; paints over body content below `bottom`
handle_mouse()
```

The body is drawn **first** so the opaque top strip and footer clip it. Do not
reorder these. An earlier version drew the header first and tried to mask with a
small rect, which left scrolled text colliding with the search box; another
version mutated `gfx.h` to fake a viewport, which is not supported.

### Two-stage layout

`layout(w)` builds `st.rows`, a flat list of primitive typed rows (`text`, `kv`,
`chips`, `rule`, `hrule`, `gap`) each with an absolute `y`. `draw_body` draws only
rows inside the viewport. Relayout happens when `st.dirty` is set or the window
width changes — both checked at the top of `draw_body`.

### Scroll clamping lives in exactly one place

`draw_body` clamps `st.scroll` against `st.maxscroll`. Key handlers and the wheel
set **unclamped** targets (`st.scroll = math.huge` for Ctrl+End). This is
deliberate: `maxscroll` is only known after a layout, so a keypress arriving in
the same frame as a view change would otherwise be clamped against a stale value
and silently do nothing.

### Search ranking

`KEYS` is a flat list of `{key, words, entry, pen}` built at load from each
entry's name, id, aliases and family. Lower score wins; ties break
alphabetically. Tiers: exact 0, key-starts-with-query 10, query-starts-with-key
24 (only if the key is ≥60% of the query), key-contains-query 30, all-query-words
present 34, edit distance ≤2 → 40+d.

`pen` is added to every tier. Family keys carry `pen = 25` so typing `strings`
lands on String Section rather than whichever instrument of that family sorts
first. **Both details matter** — removing either reintroduces a real bug (see the
session log).

If nothing matches by name, a fallback searches `en.haystack`, a flattened
lowercase copy of the entry's prose precomputed at load. Do not rebuild it per
keystroke.

### Reverse links

Composer entries carry `instruments = {ids}`. At load the script inverts this
into `target.composers`, which renders as the "Composers noted for it" chip row
on instrument pages. Write the association once, in the composer entry.

### Two databases, merged at load

`orchestration_data.lua` (instruments, sections, cross-group topics) and
`orchestration_composers.lua` (composers) each return `{ENTRIES, SOURCES}`. The
script loads the first and requires it, then loads the second inside `pcall` and
merges — the composers file is optional and its absence is not an error. Entry
ids must be unique **across both files**.

### REAPER compatibility constraints

- **`gfx` only.** No ReaImGui, SWS or js_ReaScriptAPI, so a stock install runs
  it. The bundled REAPER API reference contains no ImGui functions.
- **No bitwise operators.** `gfx.mouse_cap` is tested arithmetically via
  `cap(bit)` so the script runs on every Lua version REAPER has shipped.
- **No clipboard.** Not in the core API (`CF_SetClipboard` is SWS).
- Named keys arrive as packed multi-byte integers; `K("pgdn")` builds them from
  the string rather than hard-coding magic numbers.
- Hotspots are rebuilt into `st.hot` every frame and iterated **backwards** on
  click, so the topmost (last-drawn) target wins.

## Data schema

```lua
e{ id="trombone", name="Trombone", family="Brass", kind="instrument",
   aliases={"trombones","tbn","posaune"},      -- include misspellings people type
   summary="...",                               -- ≥40 chars; the suite checks
   facts={ {"Notes","Non-transposing"} },       -- key/value rows
   sec={                                        -- ordered; renders in this order
     {"Pairings in unison", {
        {"3 Trombones","Extreme power and resonance.","RK p.55"},  -- label, detail, citation
     }},
   },
   instruments={"strings","harp"},              -- composers only; drives reverse links
   related={"tuba","horn"},                     -- clickable "See also"
}
```

Invariants the suite enforces: unique ids across both files; `name`, `family`,
`kind` and a substantial `summary` present; **every item cited**; every citation
naming a tag declared in some `SOURCES` table; every `related` and `instruments`
id resolving.

## Editorial rules

These are project conventions, not preferences. Breaking them corrupts what the
tool is for.

1. **Cite everything.** Every item's third element is a source tag. The suite
   fails on uncited items. If you cannot cite it, do not add it.
2. **Consensus only.** Anything a source calls rare, seldom used, exceptional or
   not recommended is **never** listed as a suggestion. It goes under a
   "Use sparingly" section with the source's own wording. The point is to explain
   why not to do something without recommending what nobody writes.
3. **Disagreement is content.** Where the historical treatises and present-day
   teaching conflict, give both and say so. Oboe + clarinet in unison is the
   worked example.
4. **Cite at the precision the evidence supports.** `RK` and `WP` are cited by
   page. `SIN` page numbers are *approximations* anchored to the volume's
   illustration list, because the Gutenberg transcription has no page breaks —
   use `SIN ch.VIII` where no anchor exists. `BEL`, `OMT`, `IDIO`, `MOD` and
   `FILM` were gathered from search-result summaries rather than full page reads,
   so they are cited by tag only.
5. **Quote intermediaries honestly.** Berlioz, Lavignac, Gevaert, Stone and
   Forsyth appear *as Singleton quotes them*, and are named as such in the text.
6. **Leave gaps rather than guess.** Composers with no citable orchestration
   specifics were omitted and are listed as omitted inside the app, under
   "Composers: How to Use Them".

## Environment notes

- Direct page fetching (`WebFetch`, `curl`) is blocked by the network egress
  proxy. `WebSearch` works and returns substantive summaries — that is how all
  present-day material was gathered, and why it is cited by tag.
- The four reference documents that seeded the database were session uploads and
  are **not in the repo**. See `docs/SESSION-LOG.md` for what each contained.
