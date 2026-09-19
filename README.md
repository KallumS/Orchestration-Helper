# Orchestration Helper

A ReaScript that turns REAPER into an offline orchestration encyclopaedia.

Type the name of an instrument or a section into the box — `trombone`,
`string section`, `cor anglais`, `percussion` — and you get the doublings,
pairings and combinations that the standard orchestration literature agrees on,
each item carrying a citation back to the work and page it came from.

Everything is stored locally in a single Lua file. The script never touches the
network, and it needs no extensions: no SWS, no ReaImGui, no js_ReaScriptAPI.
It draws with REAPER's built-in `gfx` API, so a stock install runs it.

---

## Install

1. Copy both files into your REAPER Scripts folder, keeping them together:

   ```
   <REAPER resource path>/Scripts/Orchestration Helper/
       Orchestration Helper.lua
       orchestration_data.lua
   ```

   Find the resource path via **Options → Show REAPER resource path in explorer/finder**.

2. In REAPER: **Actions → Show action list → New action → Load ReaScript…** and
   pick `Orchestration Helper.lua`.

3. Optionally bind it to a key or put it on a toolbar.

The two files must stay in the same folder — the script loads its database from
alongside itself. If you move only the `.lua` script, it will tell you so rather
than failing silently.

---

## Using it

| Key | Does |
| --- | --- |
| *type* | searches as you type; the best match is shown immediately |
| `Up` / `Down` | step through the other matches |
| `Enter` | keep the highlighted match, collapse the match list |
| `Esc` | clear the box; press again for the index |
| `Left` / `Right`, `Backspace`, `Delete` | edit the query |
| `Alt`+`Left` | back to the previous entry |
| wheel, `PgUp` / `PgDn`, `Ctrl`+`Home` / `Ctrl`+`End` | scroll |
| `F1` | help |
| click | any name, chip or *See also* link opens that entry |

Searching is forgiving. Aliases are indexed (`tbn`, `cor anglais`, `kettledrums`,
`contrabass`, `french horn`), spelling is tolerated within two characters
(`tromobne` → Trombone), and if nothing matches by name the prose is searched,
so `glissando` or `stopped horns` still lands somewhere useful. Typing a family
name — `brass`, `woodwind` — lands on that section and lists every member as a
further match.

Window size, position and dock state are remembered between runs.

---

## What is in it

50 entries, 792 cited items.

- **Sections** — strings, woodwind, brass, percussion, plucked strings, voices
  and chorus: rosters at full/medium/small size, present-day section sizes,
  formations in pairs / threes / fours, who doubles on which auxiliary, how the
  parts divide.
- **Instruments** — every standard orchestral instrument, each with its pairings
  in unison, doublings in octaves, thirds and sixths, harmonic layouts,
  character, and what to avoid.
- **Cross-group topics** — Strings + Woodwind, Strings + Brass, Woodwind +
  Brass, all three groups combined, the blend bridges between groups, balance
  and relative strength, doubling principles, orchestral range and score order,
  and the modern orchestra's roster.

### The consensus rule

The brief was that rare pairings should be left out rather than suggested. So:

**Anything a source calls rare, seldom used, exceptional or not recommended
never appears in a suggestion list.** It appears — if at all — under
**Use sparingly**, with the source's own wording.

Bassoon + Oboe in unison, for instance, is not offered as a pairing, because
Rimsky-Korsakov says it is "very seldom found except in certain orchestral
tutti"; it is recorded under *Use sparingly* on both the Oboe and Bassoon pages
instead. That keeps the encyclopaedia honest — it will still tell you *why* not
to do something — without recommending what nobody writes.

Where the historical sources and present-day teaching genuinely disagree, both
are given. Oboe + Clarinet in unison is the clearest case: Rimsky-Korsakov
recommends it, much modern teaching warns against it, and Schubert and
Tchaikovsky use it freely. The entry says so.

---

## Sources

Two public-domain treatises supply the bulk of the material and are cited by
page. The present-day references were used to check that the historical advice
still holds and to supply modern section sizes; they are cited by tag.

| Tag | Work |
| --- | --- |
| `RK` | Nikolay Rimsky-Korsakov, *Principles of Orchestration*, ed. Maximilian Steinberg, trans. Edward Agate (Édition Russe de Musique, 1922). Public domain. Page numbers follow Volume I. |
| `SIN` | Esther Singleton, *The Orchestra and Its Instruments* (Symphony Society of New York, 1917). Public domain. Quotes Berlioz, Lavignac, Gevaert, Stone and Forsyth at length; those attributions are preserved in the text. |
| `WP` | Wikipedia, *Orchestration* (CC BY-SA) — for the standard instrumentation shorthand. |
| `BEL` | Alan Belkin, *Theory of Orchestration* (2015) and *Artistic Orchestration* (2001), published free by the author. |
| `OMT` | *Open Music Theory* 2e (Gotham et al.), chapter "Core Principles of Orchestration" — open-access textbook. |
| `IDIO` | *The Idiomatic Orchestra* — online orchestration manual; chapters on Unisono and Doubling, Parallel Doubling, Partial Doubling and Heterophony, Timbre and Sound Combinations. |
| `MOD` | Present-day practice, where several references agree: Andrew Hugill's *The Orchestra: A User's Manual* (with the Philharmonia Orchestra), the Timbre and Orchestration Resource (ACTOR Project), Orchestration Online, and Wikipedia's *Orchestra*, *String section* and *Brass section*. |

Berlioz, Lavignac, Gevaert, Stone and Forsyth are quoted **as Singleton quotes
them**, and are named in the text wherever that is the case — they are not cited
as if consulted directly.

The `BEL`, `OMT`, `IDIO` and `MOD` items were gathered from search results rather
than from the full text of each page, so they are cited by tag rather than by
page, and are phrased no more precisely than that evidence supports. Where a
claim is specifically attributable to one author — Belkin's "planes of tone", his
rule against unnecessary unison doubling — it is attributed to them by name.

---

## Extending it

`orchestration_data.lua` is a plain Lua table. An entry looks like this:

```lua
e{ id="trombone", name="Trombone", family="Brass", kind="instrument",
   aliases={"trombones","tbn","posaune"},
   summary="...",
   facts={ {"Notes","Non-transposing"}, },      -- key/value rows
   sec={
     {"Pairings in unison", {
        -- { label, detail, citation }
        {"3 Trombones","Extreme power and resonance.","RK p.55"},
     }},
   },
   related={"tuba","horn"},                     -- clickable "See also"
}
```

- `sec` is an ordered list, so sections appear in the order you write them.
- A section whose title contains "sparingly" is coloured as a warning.
- Every item should carry a citation; the test suite fails on uncited items.
- `related` ids must resolve to real entries.

The window lays itself out from the data, so new sections and items need no code
changes.

---

## Development

The script was built and tested against a headless stand-in for REAPER's `gfx`
and `reaper` APIs, which allows the search ranking, layout, scrolling and mouse
handling to be exercised without launching REAPER. The checks covered:

- data integrity — 792 items all cited, every citation naming a declared source,
  every `related` id resolving, no duplicate entry ids;
- search ranking against 38 query/expected-result pairs, including aliases,
  prefixes and typos;
- every one of the 50 entries rendered at three window sizes;
- interaction — arrow navigation, Enter, Esc, back, F1, header buttons, chip
  clicks, wheel and page scrolling;
- extreme window sizes down to 60×400 and up to 3000×200.

Caveat worth stating plainly: the stand-in approximates font metrics, so it
verifies structure and behaviour, not pixel-accurate appearance. The layout has
not been looked at inside REAPER itself, so spacing and font choices may want
adjustment on first run.

---

## Licence

The script is licensed under the repository's LICENSE.

The two principal sources are in the public domain. The Wikipedia material is
CC BY-SA. Material drawn from the present-day references is used as short factual
statements with attribution.
