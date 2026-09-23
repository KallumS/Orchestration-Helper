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
Read `COLOUR.md` before touching a colour: the scheme is shared with another
project, and its least obvious rule is the easiest to break.
Read `MUSIC-THEORY.md` for the theory the data files are instances of — the
principles, the disagreements between sources, and the wider harmony, counterpoint
and form vocabulary those sources assume.
Read `docs/adr/` **before changing anything structural or editorial.** Twelve
decision records, one per choice that would be expensive to reverse or that someone
would otherwise undo by accident because the reason is not visible in the code. Each
says what it cost and what it rules out. The session log is the narrative; an ADR
answers only *why is it like this*.

If you make a decision of that kind, add a record rather than only a commit message:
`docs/adr/README.md` has the format, and the index table at the bottom of it needs the
new row. A decision reversible in an afternoon with no consequences does not need one.

## Commands

There is no build step and no linter.

```bash
lua5.4 tests/run.lua              # the whole suite (174 checks); exits non-zero on failure
lua5.4 tests/audit-aliases.lua    # report search keys claimed by >1 entry
lua5.4 tests/audit-sources.lua    # citation coverage per source tag
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
`_H.mouse(x,y,capbits)`, `_H.wheel`, `_H.K`, `_H.datapath`, `_H.composerspath`,
`_H.placed`, `_H.find`.
`_H.onframe` is not provided but *called if you assign it* — a per-frame hook, the
way to inject a click or resize partway through a run. A `false` in the key queue
is a frame boundary, which is what `_H.type` and `_H.press` append; without it
every queued key is consumed in a single frame.

`_H.find("STRINGS")` returns the pen position of the last `drawstr` of exactly
that string, which is how a test clicks something: `gfx.rect` is a no-op in the
harness, so a drawn row leaves no trace but its text and that position. Park the
pointer off the window afterwards (`_H.mouse(-100, -100, 0)`) or the next frame
keeps the hover state.

**The harness approximates font metrics** (character count × size factor). It
verifies structure and behaviour, never appearance. Nothing in this repo has been
run inside REAPER. ADR 0012 records why the harness exists, the two design choices
that carry its value, and the ways it has itself been wrong.

When adding a check, **verify it fails** by deliberately breaking what it guards.
A check that passes on first write may be passing vacuously; both citation checks
were confirmed this way.

## Architecture

### Data drives layout (ADR 0002)

`layout()` walks the entry's `sec` list and emits rows generically. Adding
entries, sections or items requires **no code changes**. Only these need code:

- a new top-level *family* → add it to the `rank` table inside `layout()`, or it
  sorts to the end of the index. Current order: Strings, Woodwind, Brass,
  Percussion, Plucked, Voices, Combining, Craft, Character, Reference, Composers,
  Film Composers.
- a new *source tag* → add it to the `order` array in the `sources` view, or it
  will not appear on the Sources page
- a section title containing the substring `"sparingly"` is coloured as a warning
  (`header()` checks for it) — a semantic dependency on the string

### The index folds (ADR 0010)

The index emits one `fold` row per family and the family's chips only when it is
open. `st.open` maps family name —> `true`; everything else follows from that.

- **Closed is the default.** A first run shows the search box over twelve family
  bands, nothing else. That is the point of the feature, and `tests/run.lua`
  checks it, along with the fact that the closed index fits without scrolling.
- **The open set is persisted** as a tab-separated list of family *names* under
  `ExtState` key `open`, not as a bitmask over the `rank` order. A family added
  later therefore starts closed rather than inheriting a neighbour's saved bit.
- **The whole band is the click target**, not the words: the `fold` row is
  `maxw` wide and registers one hotspot across it.
- **Ctrl+Right / Ctrl+Left** open and close every family. There is no free
  single-key shortcut — every printable character 32—126 goes into the search
  box — so the modifier is not decoration.
- **The disclosure triangle uses `gfx.triangle`**, in `marker()`. The API
  reference confirms it: "Draws a filled triangle, or any convex polygon." It was
  first written as stacked `gfx.rect` calls because the reference had not been
  seen and the call could not be verified; that caution is recorded in the session
  log and is no longer needed.
- A row is only hoverable when it is **wholly inside the viewport**
  (`y >= top and y + h <= bottom`). The body is drawn before the opaque top
  strip and footer, so without that gate a row scrolled underneath either would
  light up under a pointer nowhere near it.

### Frame pipeline (order matters)

```
top_geometry()   -- measures the header/search/match strip, draws nothing
draw_body(top, bottom)
draw_top(g)      -- opaque; paints over body content scrolled above `top`
draw_footer(g)   -- opaque; paints over body content below `bottom`
handle_mouse()
```

The body is drawn **first** so the opaque top strip and footer clip it. Do not
reorder these (ADR 0008). An earlier version drew the header first and tried to
mask with a small rect, which left scrolled text colliding with the search box;
another version mutated `gfx.h` to fake a viewport, which is not supported.

### Two-stage layout

`layout(w)` builds `st.rows`, a flat list of primitive typed rows (`text`, `kv`,
`chips`, `rule`, `hrule`, `gap`) each with an absolute `y`. `draw_body` draws only
rows inside the viewport. Relayout happens when `st.dirty` is set or the window
width changes — both checked at the top of `draw_body`.

### Scroll clamping lives in exactly one place (ADR 0009)

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

### Two databases, merged at load (ADR 0003)

`orchestration_data.lua` (instruments, sections, cross-group topics) and
`orchestration_composers.lua` (composers) each return `{ENTRIES, SOURCES}`. The
script loads the first and requires it, then loads the second inside `pcall` and
merges — the composers file is optional and its absence is not an error. Entry
ids must be unique **across both files**.

### REAPER compatibility constraints (ADR 0001)

- **`gfx` only.** No ReaImGui, SWS or js_ReaScriptAPI, so a stock install runs
  it. The API reference has 59 `gfx.` entries and **zero** matches for `ImGui`,
  so this is a property of the API, not a preference.
- **`gfx` functions available but unused**, worth knowing before writing a
  workaround: `triangle` (filled convex polygon), `roundrect`, `arc`, `circle`,
  `gradrect`, `muladdrect`, `blurto`, `setcursor`, `showmenu` (a real popup menu),
  `loadimg`/`blit`, `getdropfile`, `clienttoscreen`.
- **`drawstr` flags**, since the script passes them as bare numbers: `1` centre
  horizontally, `2` right justify, `4` centre vertically, `8` bottom justify,
  `256` ignore the right/bottom arguments (otherwise the text is clipped to them).
  The common `drawstr(s, 256)` in this script means "no clipping".
- **Ctrl on Windows is Command on macOS.** `gfx.mouse_cap` bit 4 is "Control
  (Windows) or Command (macOS)"; bit 32 is the Windows key, or Control on macOS.
  So the index's Ctrl+Left/Right are Cmd+Left/Right on a Mac. `gfx.getchar` also
  returns Ctrl/Cmd+A..Z as 1..26, below the 32..126 range the search box accepts,
  so they cannot reach the query by accident.
- **No bitwise operators.** `gfx.mouse_cap` is tested arithmetically via
  `cap(bit)` so the script runs on every Lua version REAPER has shipped.
- **No clipboard.** Not in the core API (`CF_SetClipboard` is SWS).
- Named keys arrive as packed multi-byte integers; `K("pgdn")` builds them from
  the string rather than hard-coding magic numbers.
- Hotspots are rebuilt into `st.hot` every frame and iterated **backwards** on
  click, so the topmost (last-drawn) target wins.
- **No widget library, so every state is drawn by hand.** `inrect()` is tested at
  draw time and the fill chosen there; `button()` reads `cap(1)` itself for the
  held state. There is no style stack to push.

### Colour (ADR 0011)

`C` is keyed by role, not by shade, and built with `hex(0xRRGGBB)`. The scheme is
shared with another project and documented in `COLOUR.md`; read it before
changing a value. The two rules that break quietly:

- **R < G < B in every grey.** A neutral grey at the same lightness looks correct
  in a diff and only reads as flat on screen beside the yellow. The suite checks
  the bias, exempting `accent` and `warn`.
- **The accent is spent only on what is switched on** — the current view's
  button, the selected match chip, the caret. Three uses, and the suite fails if
  it grows past four or if a second accent appears. Item labels and section
  headers were amber and blue before the scheme landed; they come off the ramp
  now, so hierarchy rests on weight, size and lightness.
- **Light controls force dark text.** `control` is far lighter than the ground, so
  every header button takes `ink` — the unchosen ones too. Same for the selected
  match chip, which is filled with the accent.

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

`kind` is free text used only for the subtitle line, which renders as
`FAMILY · KIND` — so do not repeat the family in it. Values in use: `instrument`,
`section`, `topic`, `technique`, `composer`, `mood`.

Invariants the suite enforces: unique ids across both files; `name`, `family`,
`kind` and a substantial `summary` present; **every item cited**; every citation
naming a tag declared in some `SOURCES` table; **every `BEL`, `IDIO`, `HUG`, `BERL`
and `ACTOR` citation carrying a locator** (a page, a chapter or a page title), since
all five have been read in full and a bare tag would be an un-upgraded citation
rather than an honest limit; no `BERL`-only item quoting at length (rule 6); every
declared source cited somewhere; no source missing from the Sources page `order`
array; every `related` and `instruments` id resolving.

**Alias collisions** are allowed where both entries are a fair answer (`drums` →
Percussion Section and Timpani; `basses` → Double Bass and Chorus), since the
user can arrow through the matches. They are *not* allowed where a dedicated
entry exists: when the `dynamics` entry was added, the word had to be removed
from `balance`'s aliases or the alphabetical tie-break sent it to the wrong page.
`tests/audit-aliases.lua` reports them:

```bash
lua5.4 tests/audit-aliases.lua      # currently: basses, drums, plucked
```

It must dedupe keys *within* an entry before comparing across entries — an entry
whose name, id and one alias all fold to the same key would otherwise look like a
three-way collision with itself, and the report becomes useless. (A one-liner in
this file did exactly that until it was run and replaced with the script.)

## Editorial rules

These are project conventions, not preferences. Breaking them corrupts what the
tool is for. Rules 2, 3, 4 and 6 have decision records — ADRs 0004, 0006, 0005 and
0007 — which give the reasoning and the cost; this list is the working summary.

1. **Cite everything.** Every item's third element is a source tag. The suite
   fails on uncited items. If you cannot cite it, do not add it.
2. **Consensus only.** Anything a source calls rare, seldom used, exceptional or
   not recommended is **never** listed as a suggestion. It goes under a
   "Use sparingly" section with the source's own wording. The point is to explain
   why not to do something without recommending what nobody writes.
3. **Disagreement is content.** Where the historical treatises and present-day
   teaching conflict, give both and say so. Two worked examples: oboe + clarinet in
   unison (Rimsky-Korsakov scores it freely, much present-day teaching warns against
   it), and **doubling the violins in octaves** — Rimsky-Korsakov recommends
   Vns I / Vns II at the octave `RK p.40`, while Berlioz says that unless the passage
   lies high the unison is far better `BERL The violin`. Both are on the `violin`
   page, next to each other, with the register as the deciding factor. Finding a
   disagreement like this is a *result*, not a problem to resolve away.
4. **Cite at the precision the evidence supports.** This is per-source, and it
   changes when better evidence arrives.
   - `RK`, `BEL` — cited **by page**. `BEL` began as tag-only and was
     upgraded when the author's own 65-page PDF of *Artistic Orchestration* was
     supplied; every existing BEL claim was re-verified against it, one was found
     unsupported and rewritten, and the suite now **fails on a bare `BEL`**
     without a page.
   - `WP` — a web article with no pagination, so cited by tag. Its 48 citations
     carry no page (45 bare `WP`, 3 paired with another tag), and that is
     correct, not a gap; this file claimed `WP` was cited by page until they were
     counted. It supplies the instrumentation shorthand and the bibliography, and
     is the least authoritative source here — prefer `RK` or `BEL` wherever both
     cover a claim.
   - `SIN` — page numbers are *approximations* anchored to the volume's
     illustration list, because the Gutenberg transcription has no page breaks.
     Use `SIN ch.VIII` where no anchor exists.
   - `IDIO`, `HUG`, `ACTOR`, `BERL` — cited by **chapter, page title or instrument**.
     None of the four is paginated, but each names its pages, which is enough to
     find a claim. Two things worth knowing about how they got here:
     - `IDIO` began as tag-only. When the full text arrived every existing claim was
       re-checked and **all fourteen were confirmed**, so the citations were upgraded
       rather than rewritten — the opposite outcome to the `BEL` round, and worth
       remembering as the other possibility. `HUG` and `ACTOR` were split out of the
       `MOD` umbrella on the same principle, once each had been read in full.
     - `BERL` carries the extra constraint in rule 6: the treatise is public domain
       but the translation consulted is not, so those items paraphrase.
   - `OMT`, `MOD`, `FILM` — gathered from search-result summaries rather than full
     page reads, so cited by tag only. **These are the incomplete sources**, and
     between them they carry 136 of the 1,520 items: `FILM` 77, `MOD` 58, `OMT` 1.
     If a full text for any of them arrives, do what was done for `BEL` and
     `IDIO`: re-verify every claim against it first, then upgrade. Note that a
     full *Open Music Theory* was supplied and did **not** contain its
     orchestration chapter, so `OMT` is still un-upgradable.

   `tests/audit-sources.lua` prints the coverage, which is the fastest way to see
   where the evidence is thin. It separates `WP` from the rest: Wikipedia *was*
   read in full and simply has no pages, so its 48 tag-only citations are a
   property of the source, not a gap. Regenerate the table rather than trusting a
   remembered number — a first pass at this counted `SIN ch.VIII` as a source
   called `VIII` and reported `SIN` one item high.

   ```bash
   lua5.4 tests/audit-sources.lua
   ```
5. **Quote intermediaries honestly.** Lavignac, Gevaert, Stone and Forsyth appear
   *as Singleton quotes them*, and are named as such in the text. Berlioz now
   appears both ways: quoted through Singleton (`SIN`), and cited directly from his
   own treatise (`BERL`).
6. **Mind whose words they are, separately from whose ideas.** Berlioz's treatise
   is public domain; the modern English translation consulted for `BERL` is not,
   and reserves all rights. So **`BERL` items state Berlioz's substance in this
   encyclopaedia's own words** rather than reproducing the translator's sentences.
   Facts and ideas are free; a translator's prose is their work. Where Berlioz is
   quoted word for word in this repo it is from the older public-domain translation
   Singleton uses, and the item carries `SIN` as well as `BERL`. The suite enforces
   this: a `BERL`-only item with a quoted run over twelve words fails. The same
   discipline applies to any future source that is a copyrighted translation or
   edition of an old text — cite it, use it, do not copy out of it.
7. **Leave gaps rather than guess.** Composers with no citable orchestration
   specifics were omitted and are listed as omitted inside the app, under
   "Composers: How to Use Them".

## Environment notes

- Direct page fetching (`WebFetch`, `curl`) is blocked by the network egress
  proxy. `WebSearch` works and returns substantive summaries — that is how all
  present-day material was gathered, and why it is cited by tag.
- The reference documents that seeded the database were session uploads and are
  **not in the repo**: two public-domain treatises, the Wikipedia orchestration
  article, the REAPER API reference, a zip of Alan Belkin's materials (seven chapter
  pages plus `bk-O-O.pdf`, the 65-page *Artistic Orchestration*), and later the
  generated REAPER API function reference plus full-site zips of *The Idiomatic
  Orchestra*, Hugill's *The Orchestra: A User's Manual* and *Open Music Theory*.
  See `docs/SESSION-LOG.md` for what each contained. **None of them can be assumed
  present.** If a claim needs re-verifying, ask for the source again rather than
  guessing; that is how the one unresolved `MOD` citation on the String Section page
  came to be left open.
- **`WebSearch` works, `WebFetch` and `curl` do not** — but the useful lesson from the
  later rounds is that a supplied full text beats both, and that the difference is
  visible in the citations: a search summary can only ever earn a bare tag.
- Extracting a PDF here needs a workaround: `poppler-utils` will not install
  (404 from the archive) and `pypdf` crashes on import because the system
  `cryptography` wheel panics under pyo3. Blocking it first works:
  `for n in ("cryptography","cryptography.exceptions","Crypto"): sys.modules[n]=None`
  then `from pypdf import PdfReader`.
- When probing rendered output in the harness, remember it records one entry per
  *wrapped line*, so a phrase spanning a line break will not be found by a
  substring search, and section headers are drawn upper-cased. Cap the output of
  any dump: accumulating 70 frames of a long page prints thousands of lines.
