# Orchestration Helper

A ReaScript that turns REAPER into an offline orchestration encyclopaedia.

Type the name of an instrument, a section, a composer — or a mood — into the box:
`trombone`, `string section`, `cor anglais`, `Bernard Herrmann`, `Bach`,
`mysterious`. You get the doublings, pairings and combinations that the standard
orchestration literature agrees on, each item carrying a citation back to where it
came from.

Everything is stored locally in two Lua files. The script never touches the
network, and it needs no extensions: no SWS, no ReaImGui, no js_ReaScriptAPI.
It draws with REAPER's built-in `gfx` API, so a stock install runs it.

---

## The Mac app

Orchestration Helper also runs on its own, without REAPER, as a Mac app (Apple
Silicon and Intel). It is the same script and the same two databases, so it
says exactly what the ReaScript says.

1. Download `Orchestration-Helper-macOS.zip` from the repository's **Releases**
   (or, for the latest build, from **Actions → Mac app → the newest run →
   Artifacts**) and double-click it.
2. Drag **Orchestration Helper** into **Applications**.
3. The first time only: the app is not signed with an Apple developer
   certificate, so macOS will refuse to open it with a double-click. Control-click
   it, choose **Open**, then **Open** again. (On macOS 15 or later: try to open
   it once, then **System Settings → Privacy & Security → Open Anyway**.)

Everything works as in REAPER, plus a menu bar: **View → Bigger Text / Smaller
Text / Actual Size** (⌘= ⌘- ⌘0), **Edit → Paste** into the search box, and
**Help** (⌘?). The app remembers its size, place and text size.

## Install in REAPER

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
| *type* | Search as you type; the best match is shown straight away. |
| `↑` `↓` (Windows: `Up` / `Down`) | Move through the other matches. |
| `Return` (Windows: `Enter`) | Keep the highlighted match and close the list of matches. |
| `Esc` | Clear the box; press it again to go to the index. |
| `←` `→`, `Delete` (Windows: `Left` / `Right`, `Backspace`, `Delete`) | Move the cursor and edit what you typed. |
| `⌥←` (Windows: `Alt+Left`) | Go back to the previous entry. |
| Scroll wheel, `Page Up` / `Page Down`, `⌘Home` / `⌘End` (Windows: `Ctrl+Home` / `Ctrl+End`) | Scroll. |
| `F1` | Show the help page. |
| Click a name | Open that entry — any name, chip or *See also* link. |
| Click a family | On the index, open or close it. |
| `⌘→` / `⌘←` (Windows: `Ctrl+Right` / `Ctrl+Left`) | On the index, open or close every family. |
| `Tab` / `⇧Tab` (Windows: `Shift+Tab`) | Move a white ring round the buttons, families and names; `Return` or `Space` presses the one ringed. |
| `⌘=` / `⌘-` / `⌘0` (Windows: `Ctrl+=` / `Ctrl+-` / `Ctrl+0`) | Text bigger, smaller, back to 100%. |

The window names the keys the way your computer does: with the Mac's symbols
on a Mac, in words elsewhere. The buttons along the top are **Back**,
**Text Size**, **Help**, **Index** and **Sources**.

The window follows Apple's design guidelines for Mac apps
([what that covers](docs/apple-hig-review.md)): every line of text is easy to
read against the dark ground, **Text Size** makes everything up to twice the
size, the buttons are full-size, the keyboard alone reaches everything, and the
page you are on is marked by a dark bar under its button as well as by yellow.
It uses the Mac's own font (Segoe UI on Windows), every name and the search box
has an outline you can see, the window's title says which page is open, and in a
very wide window the page stays a readable column in the middle.

Searching is forgiving. Aliases are indexed (`tbn`, `cor anglais`, `kettledrums`,
`contrabass`, `french horn`, `tschaikowsky`), spelling is tolerated within two
characters (`tromobne` → Trombone, `Bernard Hermann` → Bernard Herrmann), and if
nothing matches by name the prose is searched, so `glissando` or `stopped horns`
still lands somewhere useful. Typing a family name — `brass`, `woodwind`,
`film composers` — lands on that section and lists every member as a further
match.

The index opens as the search box over the twelve families — Strings,
Woodwind, Brass, Percussion, Plucked, Voices, Combining, Craft, Character,
Reference, Composers, Film Composers — each showing how many entries it holds.
Click one to open it: Strings gives Double Bass, Pizzicato, String Section,
Viola, Violin and Violoncello. Whatever you leave open is still open next time.

Window size, position, dock state, the open families and the text size are
remembered between runs.

---

## What is in it

123 entries, 1,520 cited items, across two databases.

`orchestration_data.lua` — 73 entries:

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
- **Acoustics** — *Overtones, Formants and Penetration*: why one instrument cuts
  through a tutti and another vanishes at the same dynamic, which is almost never a
  matter of power. Which sounds carry formants and which blend, how register
  inverts the intuition (a low oboe penetrates more than a high one), and why the
  real risk to a quiet instrument is masking rather than volume.
- **Playability** — *Writing Playable Music*: the difference between a passage
  that can be played and one that will be, what the practice room rewards, how to
  make a hard passage easier without losing it, and what to write in the score that
  notation alone cannot carry.
- **Listening** — *Where to Hear These Combinations*: for each doubling the
  encyclopaedia calls standard, a place in the repertoire to hear it, with work,
  movement and bar or rehearsal figure. Taken from Hugill's index of the
  Philharmonia's recorded archive.
- **Craft** — the working topics from Belkin's *Artistic Orchestration*:
  orchestration and form, the five-group scale of timbral contrast, planes of
  tone, sustained vs dry sound, orchestrating counterpoint, the tutti,
  accompanying a soloist, orchestrating dynamics, and his two checklists of what
  makes orchestration good or poor.
- **Character** — the reverse lookup. Type a mood, get the scoring: *luminous,
  mysterious, menacing, terrifying, brilliant, splendid, dramatic, funereal,
  playful, sad*. Belkin compiled these as a teaching device and warns that used
  as a recipe book they become clichés; his caveats are reproduced in full.

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
| `BERL` | Hector Berlioz, *Grand traité d'instrumentation et d'orchestration modernes* (1843; 2nd edn 1855). Public domain. Consulted in Michel Austin's translation on the Hector Berlioz Website, which is a selection — the technical range-and-mechanism material is omitted, leaving timbre, character and combination. That translation reserves all rights, so `BERL` items **paraphrase** rather than quote it. **Cited by instrument or chapter.** |
| `WP` | Wikipedia, *Orchestration* (CC BY-SA) — for the standard instrumentation shorthand. |
| `BEL` | Alan Belkin, *Artistic Orchestration* (© Alan Belkin 2001, 2008) — the third volume of his free online series, published by the author at alanbelkinmusic.com. 65 pages, **cited by page**. Belkin's terms: "The material may be used free of charge provided that the author's name is included." |
| `ACTOR` | Don Freund and David Cutler, *Extreme Orchestration* (2024), on the Timbre and Orchestration Resource of the ACTOR Project. **Cited by chapter.** The present-day teaching text `MOD` was standing in for; source of the dynamics and playability material. |
| `OMT` | *Open Music Theory* 2e (Gotham et al.), chapter "Core Principles of Orchestration" — open-access textbook. |
| `IDIO` | *The Idiomatic Orchestra* (theidiomaticorchestra.net) — online orchestration manual, read in full and **cited by chapter**. Source of the balance-ratio method and of the clearest account of what each kind of doubling actually does. |
| `HUG` | Andrew Hugill, *The Orchestra: A User's Manual* (© Andrew Hugill 2015), written with the Philharmonia Orchestra. **Cited by page title.** Largely an index of the Philharmonia's recorded archive giving work, movement and bar or figure for a great many scorings, plus prose on each section. |
| `MOD` | Present-day practice, where several references agree: the Timbre and Orchestration Resource (ACTOR Project), Orchestration Online, and Wikipedia's *Orchestra*, *String section* and *Brass section*. Hugill was part of this group until the full site was supplied; he is now cited separately as `HUG`. |
| `FILM` | Film-music references consulted together for the film composer entries: score studies from Movie Music UK, the Timbre and Orchestration Resource, Sound on Sound, Soundfly/Flypaper, Classic FM, the Vienna Symphonic Library forum's orchestration threads, programme notes from the LA Phil, Hollywood Bowl and Wise Music Classical, and Wikipedia's articles on the individual scores and composers. |

Lavignac, Gevaert, Stone and Forsyth are quoted **as Singleton quotes them**, and
are named in the text wherever that is the case — they are not cited as if
consulted directly. Berlioz now appears both ways: quoted through Singleton, and
cited directly from his own treatise as `BERL`.

The `OMT`, `MOD` and `FILM` items were gathered from search results rather than
from the full text of each page, because this environment blocks direct page
fetching. They are therefore cited by tag rather than by page, and are phrased no
more precisely than that evidence supports. They account for 136 of the 1,520
items — `FILM` 77, `MOD` 59, `OMT` 1 — and they are the part of the database a full
text would most improve. `lua5.4 tests/audit-sources.lua` prints the current
coverage per tag.

`IDIO` was in that group until its full text arrived. Every one of its fourteen
existing claims was re-checked against the real chapters and **all fourteen were
confirmed**, so the citations were upgraded to name chapters rather than rewritten.
`HUG` was split out of `MOD` in the same pass. Between them they now carry 131
items, all located.

`WP` is also cited by tag, but for a different reason: the article was read in
full and simply has no pages to cite.

`BEL` was originally in that group. When the author's own PDF of *Artistic
Orchestration* was supplied, every existing `BEL` claim was re-checked against
it: five verified word for word and were upgraded to page citations, and one —
a line calling planes of tone "the single most important principle" — could not
be found in the book at all, so it was rewritten to what Belkin actually says and
the term credited to Tovey, as he credits it. The test suite now fails on any
`BEL` citation that lacks a page. Where a claim is
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
no code changes. A new *family* needs one: add it to the `rank` table inside
`layout()` or it sorts to the end of the index. It will start collapsed like the
rest, and its entry count comes from the data.

---

## Development

The Mac app is in `macos/`: `host.c` gives the script REAPER's `gfx` and
`reaper` calls around an embedded Lua 5.4, `mac.m` draws them with the Mac's
own frameworks, and `build.sh` makes the app (on a Mac). The workflow in
`.github/workflows/macos-app.yml` runs the test suite, builds the app on
GitHub's Macs for every push, opens it, types a search, and attaches the zip to
the run; pushing a tag such as `v1.0` publishes it as a release.

`CLAUDE.md` holds the architecture notes, the data schema and the editorial rules
— read it before changing anything. `COLOUR.md` is the colour scheme, shared with
another project and kept by hand. `MUSIC-THEORY.md` is the theory the data files are
instances of, including where the sources disagree. `docs/SESSION-LOG.md` records how
the project was built: the sources and how they were mined, the bugs already found and
fixed, and what is still unverified.

`docs/adr/` holds fourteen architecture decision records — one per choice that would be
expensive to reverse, each stating what it cost and what it rules out. Read the
relevant one before changing anything structural or editorial; they are cross-linked
from the sections of `CLAUDE.md` they explain. The ones most worth knowing before you
touch the code:

- **0001** — `gfx` only, so a stock REAPER install runs it. No clipboard, no widgets.
- **0008** — the body is drawn *before* the opaque header and footer, which is how
  clipping works without a clipping API. Reordering those four calls breaks the window
  silently, and no test can catch it.
- **0009** — the scroll position is clamped in exactly one place, and handlers
  deliberately set out-of-range targets.
- **0005** and **0007** — how citations work, and why Berlioz is paraphrased where
  Rimsky-Korsakov is quoted.

Two audits answer questions that are easy to get wrong from memory:

```bash
lua5.4 tests/audit-aliases.lua    # search keys claimed by more than one entry
lua5.4 tests/audit-sources.lua    # citation coverage per source tag
```

The script was built and tested against a headless stand-in for REAPER's `gfx`
and `reaper` APIs, which allows the search ranking, layout, scrolling and mouse
handling to be exercised without launching REAPER. The checks covered:

- data integrity — 1,520 items all cited, every citation naming a declared
  source, every `BEL` citation carrying a page, every `related` and `instruments`
  id resolving across both files, no duplicate entry ids;
- search ranking against 102 query/expected-result pairs, including aliases,
  prefixes, punctuation and typos (`Bernard Hermann`, `tromobne`, `bassson`);
- every one of the 123 entries rendered at three window sizes;
- interaction — arrow navigation, Enter, Esc, back, F1, header buttons, chip
  clicks, wheel and page scrolling, and the reverse links from an instrument to
  its composers;
- extreme window sizes down to 60×400 and up to 3000×200.

- the index folding — closed on a first run, click to open one family, click
  again to close it, Ctrl+Right and Ctrl+Left (⌘→ and ⌘← on a Mac) for all of them, and the open set
  surviving a restart;
- the colour scheme's mechanical rules (see `COLOUR.md`): every grey cool, the
  accent used no more than four times, no second accent.

- the wording (Apple's writing guidelines) — title-style header buttons, keys
  named with the Mac's symbols on a Mac and in words elsewhere, and no three
  full stops, spaced hyphens or straight quotes on the window's own pages;
- Apple's HIG Foundations — every string on five pages at 7:1 contrast, Text
  Size (keys, menu, limits, remembered), 28-point controls 12 apart, the bar
  under the chosen button, and the Tab ring (Shift+Tab, Return, Space, Esc,
  scrolling a name into view);
- citation precision — no bare `BEL`, `IDIO`, `HUG`, `BERL` or `ACTOR` tag, every
  declared source actually cited, no source missing from the Sources page, and no
  `BERL`-only item quoting the copyrighted translation at length.

207 checks; run them with `lua5.4 tests/run.lua`.

Caveat worth stating plainly: the stand-in approximates font metrics, so it
verifies structure and behaviour, not pixel-accurate appearance. The layout has
not been looked at inside REAPER itself, so spacing and font choices may want
adjustment on first run.

---

## Licence

The script is licensed under the repository's LICENSE.

The two principal treatises are in the public domain. The Wikipedia material is
CC BY-SA. Alan Belkin's *Artistic Orchestration* is used on the author's own
stated terms — free of charge with his name included — and he is named in the
source list, in the affected entries, and here. Andrew Hugill's *The Orchestra: A
User's Manual* reserves all rights, so it is used only as short factual statements
and brief quotations with attribution, and he is named on the Sources page and in
every entry that draws on him. Berlioz's treatise is public domain, but the modern
translation consulted is not and reserves all rights — so `BERL` items state his
substance in this repository's own words rather than reproducing the translator's
sentences, and the test suite fails any `BERL`-only item that quotes at length.
Where Berlioz is quoted verbatim here it is from the older public-domain
translation Singleton uses, and the item is tagged `SIN` as well. Material drawn from *The Idiomatic Orchestra* and
the other present-day and film-music references is used the same way.
