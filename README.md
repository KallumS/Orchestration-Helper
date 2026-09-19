# Orchestration Helper

A ReaScript that turns REAPER into an offline orchestration encyclopaedia.

Type the name of an instrument, a section or a composer into the box —
`trombone`, `string section`, `cor anglais`, `Bernard Herrmann`, `Bach` — and you
get the doublings, pairings and combinations that the standard orchestration
literature agrees on, each item carrying a citation back to where it came from.

Everything is stored locally in two Lua files. The script never touches the
network, and it needs no extensions: no SWS, no ReaImGui, no js_ReaScriptAPI.
It draws with REAPER's built-in `gfx` API, so a stock install runs it.

---

## Install

1. Copy the files into your REAPER Scripts folder, keeping them together:

   ```
   <REAPER resource path>/Scripts/Orchestration Helper/
       Orchestration Helper.lua
       orchestration_data.lua
       orchestration_composers.lua
   ```

   Find the resource path via **Options → Show REAPER resource path in explorer/finder**.

2. In REAPER: **Actions → Show action list → New action → Load ReaScript…** and
   pick `Orchestration Helper.lua`.

3. Optionally bind it to a key or put it on a toolbar.

The files must stay in the same folder — the script loads its databases from
alongside itself. If you move only the script, it will tell you so rather than
failing silently. `orchestration_composers.lua` is optional: without it the
script still runs, and composers are simply absent.

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
`contrabass`, `french horn`, `tschaikowsky`), spelling is tolerated within two
characters (`tromobne` → Trombone, `Bernard Hermann` → Bernard Herrmann), and if
nothing matches by name the prose is searched, so `glissando` or `stopped horns`
still lands somewhere useful. Typing a family name — `brass`, `woodwind`,
`film composers` — lands on that section and lists every member as a further
match.

Window size, position and dock state are remembered between runs.

---

## What is in it

100 entries, 1,116 cited items, across two databases.

`orchestration_data.lua` — 50 entries:

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

`orchestration_composers.lua` — 50 entries:

- **36 concert composers** — Monteverdi, Bach, Handel, Rameau, Gluck, Haydn,
  Mozart, Beethoven, Weber, Schubert, Mendelssohn, Berlioz, Liszt, Wagner,
  Verdi, Brahms, Glinka, Rimsky-Korsakov, Mussorgsky, Tchaikovsky, Saint-Saëns,
  Dvořák, Grieg, Mahler, Strauss, Elgar, Debussy, Ravel, Stravinsky, Holst,
  Shostakovich, Meyerbeer, Rossini, Humperdinck, Delibes, Bizet.
- **13 film composers** — Steiner, Korngold, Rózsa, Herrmann, Morricone, Barry,
  Goldsmith, Williams, Elfman, Shore, Zimmer, Desplat, Greenwood.

Each composer entry answers one working question: if you want this sound, what
did they actually put together? So Herrmann's page gives you the strings-only
*Psycho*, the nine harps and five organs of *Journey to the Center of the Earth*,
and the twelve flutes and nine trombones of *Torn Curtain*; Wagner's gives the
eight horns for the Rhine, the thirteen brass for Walhalla and the six harps for
the rainbow bridge; Desplat's gives the twelve flutes and nothing else in the
woodwind for *The Shape of Water*.

The link runs both ways. Because composer entries name the instruments they are
known for, every instrument page grows a **Composers noted for it** row — so the
Horn page points you at Weber, Wagner, Haydn, Williams and Goldsmith without that
association being written down twice.

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
| `FILM` | Film-music references consulted together for the film composer entries: score studies from Movie Music UK, the Timbre and Orchestration Resource, Sound on Sound, Soundfly/Flypaper, Classic FM, the Vienna Symphonic Library forum's orchestration threads, programme notes from the LA Phil, Hollywood Bowl and Wise Music Classical, and Wikipedia's articles on the individual scores and composers. |

Berlioz, Lavignac, Gevaert, Stone and Forsyth are quoted **as Singleton quotes
them**, and are named in the text wherever that is the case — they are not cited
as if consulted directly.

The `BEL`, `OMT`, `IDIO`, `MOD` and `FILM` items were gathered from search
results rather than from the full text of each page, because this environment
blocks direct page fetching. They are therefore cited by tag rather than by page,
and are phrased no more precisely than that evidence supports. Where a claim is
specifically attributable to one author — Belkin's "planes of tone", his rule
against unnecessary unison doubling — it is attributed by name.

**Singleton's page numbers are approximate.** The Project Gutenberg transcription
carries no page breaks, so `SIN` page numbers are interpolated from the volume's
own list of illustrations, which gives a facing page for each plate, together
with the chapter page ranges in its table of contents. They will put you within a
page or two, not on the exact line. Where there was no nearby anchor — most of
Chapter VIII, the history of the orchestra — the citation reads `SIN ch.VIII`
instead of inventing a number.

**On the film composers.** Their entries stick to what is well documented and
widely agreed: specific ensembles, named instruments, the composer's own
statements where available. Where a claim is a general characterisation rather
than a verifiable specific, it is written as one. Nothing here is invented to
fill a gap: the composers for whom the sources gave no orchestration specifics
were left out, and are listed as such under **Composers: How to Use Them** in the
app.

---

## Extending it

Both databases are plain Lua tables. An instrument or section entry looks like
this:

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

A composer entry adds one field:

```lua
e{ id="herrmann", name="Bernard Herrmann", family="Film Composers",
   kind="composer",
   aliases={"bernard hermann","hermann"},       -- misspellings people type
   summary="...",
   sec={ {"His signature ensembles", { {"Psycho - strings only","...","FILM"} }} },
   instruments={"strings","harp","flute"},      -- drives the reverse links
   related={"rozsa","goldsmith"},
}
```

- `sec` is an ordered list, so sections appear in the order you write them.
- A section whose title contains "sparingly" is coloured as a warning.
- Every item should carry a citation; the test suite fails on uncited items.
- `related` and `instruments` ids must resolve to real entries in either file.
- `instruments` is what produces the **Composers noted for it** row on the
  instrument's own page — write the association once, in the composer entry.

The window lays itself out from the data, so new entries, sections and items need
no code changes.

---

## Development

The script was built and tested against a headless stand-in for REAPER's `gfx`
and `reaper` APIs, which allows the search ranking, layout, scrolling and mouse
handling to be exercised without launching REAPER. The checks covered:

- data integrity — 1,116 items all cited, every citation naming a declared
  source, every `related` and `instruments` id resolving across both files, no
  duplicate entry ids;
- search ranking against 72 query/expected-result pairs, including aliases,
  prefixes, punctuation and typos (`Bernard Hermann`, `tromobne`, `bassson`);
- every one of the 100 entries rendered at three window sizes;
- interaction — arrow navigation, Enter, Esc, back, F1, header buttons, chip
  clicks, wheel and page scrolling, and the reverse links from an instrument to
  its composers;
- extreme window sizes down to 60×400 and up to 3000×200.

109 checks; run them with `lua5.4 tests/run.lua`.

Caveat worth stating plainly: the stand-in approximates font metrics, so it
verifies structure and behaviour, not pixel-accurate appearance. The layout has
not been looked at inside REAPER itself, so spacing and font choices may want
adjustment on first run.

---

## Licence

The script is licensed under the repository's LICENSE.

The two principal sources are in the public domain. The Wikipedia material is
CC BY-SA. Material drawn from the present-day and film-music references is used
as short factual statements with attribution.
