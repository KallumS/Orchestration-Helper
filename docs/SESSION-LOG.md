# Session log — building Orchestration Helper

A record of how this repository came to exist, what was decided and why, what
went wrong on the way, and what is still unverified. Written for whoever picks it
up next, including future Claude sessions.

Built in one session, 19 September 2026, from an empty repository containing only
a LICENSE.

---

## 1. The brief

The user asked for a ReaScript that helps with orchestration decisions: a simple
text box where typing an instrument or section name returns suggested pairings and
doublings. Stated requirements:

- Typing `trombone` → the most common doublings and pairings for it.
- Typing `string section` → the instruments most commonly used in string sections.
- **All information stored locally. No internet connection at any point.**
- Draw on reputable sources for doublings, pairings, and section membership.
- **General consensus only** — "if there is a rare pairing of two instruments,
  that info should be ignored and not incorporated into the script."
- Think of it as an encyclopaedia that saves the user searching the internet.

Two follow-ups arrived mid-turn during the first build:

1. "Could you examine the entirety of the uploaded documents for useful info
   rather than just sections please" — so the reading was widened from the
   combination chapters to the whole of both books.
2. "Please don't rely only on the documents I provided — information will be
   available on the web for you to use too" — so present-day references were
   brought in to corroborate and update the historical advice.

A third request in a later turn added composer entries: "if a user types 'Bernard
Hermann' it'll show his favourite doublings, or 'Johann Sebastian Bach' it'll give
info on his favourite instruments", classical and film both.

---

## 2. Source material

### Session uploads (not in the repo)

Four documents were attached to the session. They are the origin of the database
but were never committed — they are large, and two are copyrighted web pages.

| File | What it is | Size |
| --- | --- | --- |
| `bc618f8e-pg33900.txt` | Rimsky-Korsakov, *Principles of Orchestration*, ed. Steinberg, trans. Agate (1922). Project Gutenberg #33900. Public domain. | 317 KB / 7,594 lines |
| `c6432308-pg73991.txt` | Esther Singleton, *The Orchestra and Its Instruments* (1917). Project Gutenberg #73991. Public domain. | 539 KB / 11,105 lines |
| `e62941a7-Orchestration_-_Wikipedia.html` | Wikipedia, "Orchestration". CC BY-SA. | 339 KB |
| `4c3edd4b-REAPER_API_functions.html` | REAPER ReaScript API reference. | 958 KB / 7,471 lines |

**Both books were read in full**, not sampled. Rimsky-Korsakov is the single most
valuable source: chapters II and III are almost entirely explicit doubling and
combination tables, and chapter I gives section rosters and balance ratios.
Singleton supplies instrument character (quoting Berlioz and Lavignac at length),
seating, historical rosters, and a per-composer "contribution to the orchestra"
summary for most major figures. The Wikipedia page supplied the instrumentation
shorthand and per-composer score analyses (Bach, Rameau, Haydn, Mozart, Beethoven,
Berlioz, Wagner, Mahler, Debussy).

Techniques used to mine them, worth repeating if the sources are re-attached:

- `grep -n` on the table of contents to locate chapters, then read sequentially.
- For composers, a Python script split both books into paragraphs and kept only
  those mentioning a composer **and** an orchestration keyword, then deduplicated.
  That reduced 850 KB to a 120 KB digest of high-signal paragraphs.
- Singleton has a per-composer rhetorical device — "What did X do for the
  Orchestra?" / "X's gift to the Orchestra was…" — which a targeted regex found.

### Web research

Requested by the user in follow-up 2. **Direct page fetching is blocked** in this
environment by the network egress proxy (`WebFetch` and `curl` both return
`EGRESS_BLOCKED` for every external domain; `curl "$HTTPS_PROXY/__agentproxy/status"`
confirms the policy). `WebSearch` works, because it routes through the Anthropic
API rather than the proxy, and returns substantive summaries.

Consequence, recorded honestly in the README and CLAUDE.md: everything from the
web is **cited by tag, not by page**, and phrased no more precisely than a search
summary supports.

Material gathered this way:

- **Present-day practice** (`MOD`, `BEL`, `OMT`, `IDIO`) — modern section sizes
  (14/12/10/8/6 common, 16-18/16/12/12/8 full-scale, "add 2 per smaller
  section"); Belkin's "planes of tone" and his rule against unnecessary unison
  doubling; the standard blended pairs (low clarinet + viola, horn + cello, oboes
  + trumpets at soft dynamics, bassoons + string pizzicato); within-family
  doubling preference and the cello/bass alliance; the horn 1-3-high / 2-4-low
  convention; that two identical instruments in unison risk intonation trouble
  while three or more become a chorus.
- **Film composers** (`FILM`) — specific ensembles and techniques for thirteen
  composers. The richest finds: Herrmann's bespoke ensembles (strings-only
  *Psycho*, nine harps and five organs, twelve flutes and nine trombones with no
  strings in *Torn Curtain*), Goldsmith's extended techniques (horns without
  mouthpieces, echoplex, shofar and serpent in *Alien*), Desplat's twelve flutes
  as an entire woodwind section, Shore's culture-per-instrument scheme.

---

## 3. Key decisions

### `gfx`, not ReaImGui

Checked the bundled REAPER API reference: 243 `gfx.` matches, **zero** `ImGui`
matches. ReaImGui is a third-party extension. Since the brief demanded the tool
just work, the GUI uses the built-in `gfx` API. Also confirmed there is no
clipboard function in the core API, so no copy feature was attempted.

### Data separate from code, and data-driven layout

The renderer walks a generic `sec` list of `{label, detail, citation}` items.
Adding content never touches the script. This was the single most useful decision:
the composer database was added later with only five small patches to the script
(load and merge, reverse links, family rank, one chip row, one source-tag list).

### Two data files

Composers went in `orchestration_composers.lua` rather than swelling the main file
past 4,700 lines. The script requires the first and `pcall`s the second, so the
composers file is optional and its absence is not an error.

### Reverse links instead of duplicated data

Composer entries declare `instruments = {ids}`; the script inverts that at load
into `target.composers` and renders a "Composers noted for it" row on instrument
pages. The association is written once. The alternative — editing 33 instrument
entries to name composers — would have duplicated it and drifted.

### The consensus rule

The user's requirement needed a mechanism, not just good intentions. Rule adopted:
anything a source calls rare, seldom used, exceptional or not recommended is
**never** in a suggestion list; it goes under a "Use sparingly" section with the
source's own wording. So bassoon + oboe in unison is not offered as a pairing
(Rimsky-Korsakov: "very seldom found except in certain orchestral tutti") but is
recorded as a caution on both instruments' pages.

Rationale: silently deleting it would lose genuinely useful information — the user
wants to know *why not*. Presenting it as a suggestion would violate the brief.
The third option satisfies both.

Where sources genuinely disagree, both are given. Oboe + clarinet in unison is the
worked example: Rimsky-Korsakov recommends it, much modern teaching warns against
it, and Schubert's *Unfinished* and Tchaikovsky use it freely.

### Citation precision

Different sources get different precision, stated openly:

- `RK`, `WP` — by page.
- `SIN` — **approximate** pages. The Gutenberg transcription has no page breaks,
  so numbers were interpolated from the volume's own illustration list (which
  gives a facing page per plate) plus the chapter ranges in its contents table.
  Where no anchor exists — most of chapter VIII — the citation reads `SIN ch.VIII`
  rather than inventing a number. This caveat was added after noticing that some
  early cites were interpolated more confidently than the evidence justified.
- `BEL`, `OMT`, `IDIO`, `MOD`, `FILM` — by tag only, because of the fetch block.

Berlioz, Lavignac, Gevaert, Stone and Forsyth are quoted *as Singleton quotes
them* and named as such — not cited as if consulted directly.

### Leaving gaps

Searches returned no orchestration specifics for Rota, Delerue, Elmer Bernstein,
Jarre, Horner, Thomas Newman, Sibelius, Copland, Britten, Bartók and others. They
were omitted and are **listed as omitted** inside the app, under "Composers: How
to Use Them", with the reason. Better an honest gap than a confident guess.

---

## 4. Bugs found and fixed during development

All found by the headless harness, none by inspection alone. Recorded because
several are easy to reintroduce.

1. **`break` not ending its block.** `if not words:find(w) then all = false break end`
   — accepted by Lua 5.4 but fragile. Restructured.

2. **Mutating `gfx.h` to fake a viewport.** The first draft set `gfx.h = saveh - fh`
   around `draw_body`. `gfx.w`/`gfx.h` are framebuffer dimensions and writing them
   is unsupported. Replaced with an explicit `bottom` parameter.

3. **Header drawn before the body.** Scrolled text collided with the search box,
   masked only by an 8px rect. Fixed by drawing the body first and letting the
   opaque top strip and footer clip it. **Do not reorder the frame pipeline.**

4. **Scroll keys clamped against a stale `maxscroll`.** `maxscroll` is only
   computed during a layout, which happens in `draw_body`, *after* key handling.
   A PgDn arriving in the same frame as a view change was clamped to 0 and did
   nothing. Fixed by moving all clamping into `draw_body` and letting handlers set
   unclamped targets. The test that caught this crammed all keys into one frame;
   the harness then gained a frame-boundary sentinel so keys can be delivered one
   per frame, as a real user produces them.

5. **Family names outranking entry names** — the worst of the batch. Every entry
   indexed its family as a search key, so `strings` matched Double Bass, Violin,
   Viola, Cello, Pizzicato *and* String Section all at score 0, and the
   alphabetical tie-break gave **Double Bass**. Same for `percussion` → Bass Drum
   and `woodwind` → Alto Flute. Fixed with a per-key penalty: family keys carry
   `pen = 25`.

6. **A short alias claiming a long query.** `bassson` (a typo for bassoon)
   resolved to **Double Bass**, because the rule "query starts with key" matched
   the alias `bass` at score 15, beating the edit-distance match to Bassoon at 41.
   Fixed by requiring the key to be ≥60% of the query length and raising that
   tier's score to 24.

7. **A long `facts` key silently dropped.** Key lines were attached to rows
   produced for the *value*; if the key wrapped to more lines than the value, the
   extra lines vanished. Replaced with a proper `kv` row type emitting
   `max(#keylines, #vallines)` rows.

8. **Prose haystack rebuilt per keystroke.** The fallback search concatenated
   every entry's summary and all items on every keystroke. Precomputed into
   `en.haystack` at load.

9. **Bitwise operators.** `gfx.mouse_cap & 1` requires Lua 5.3+. Replaced with
   arithmetic `cap(bit)` for maximum compatibility across REAPER versions.

Also hardened without a failure first: `SCRIPT_FILE` nil-guard falling back to the
resource path; word-splitting in `wrap()` for words wider than the column, which
survives a 60px-wide window.

---

## 5. Testing

`tests/harness.lua` is a headless stand-in for the `gfx` and `reaper` APIs — about
120 lines, stubbing drawing, fonts, key queue, mouse, ext-state and the defer
loop. It records every `drawstr` with its position, so a "page" can be
reconstructed as text and inspected. That reconstruction was how layout was
verified: sorting the recorded draws by `y` then `x` prints the composed page.

`tests/run.lua`, 109 checks in five sections:

- **Data integrity** — both databases merged; unique ids; required fields; every
  one of 1,116 items cited; every citation naming a declared source; every
  `related` and `instruments` id resolving.
- **Search ranking** — 73 query/expectation pairs, covering aliases, prefixes,
  punctuation (`b-flat clarinet`, `'cello`) and typos (`tromobne`, `bassson`,
  `Bernard Hermann`).
- **Rendering** — all 100 entries at 760×680, 470×380 and 1400×900, plus survival
  at 200×150, 120×120, 60×400 and 3000×200.
- **Interaction** — arrows, Enter, Esc, Alt+Left, F1, header button clicks, chip
  clicks, wheel and page scrolling, the reverse links, no-result view, prose
  fallback.
- **Punctuation** — 17 pattern-metacharacter queries (`%`, `.*`, `^horn$`, `\`)
  must not break search or the no-result view.

Measured performance (harness, so indicative only): both databases load in 5.6 ms;
steady-state 0.18–0.24 ms per frame; a full relayout ~3 ms. `gfx.measurestr` is
slower in REAPER than in the stub, so expect relayout in the low tens of
milliseconds — it only happens on keystrokes and resizes.

---

## 6. Final shape

| File | Lines | Purpose |
| --- | --- | --- |
(Counts below are as of the first two commits; see §6a for the figures after the
Belkin round.)

| `Orchestration Helper.lua` | GUI, search, layout, input |
| `orchestration_data.lua` | instruments, sections, cross-group topics, craft, character |
| `orchestration_composers.lua` | composers |
| `tests/run.lua` | the check suite |
| `tests/harness.lua` | headless `gfx`/`reaper` stand-in |
| `README.md` | user documentation, bibliography |
| `CLAUDE.md` | guidance for future Claude sessions |

**8 source tags:** `RK`, `SIN`, `WP`, `BEL`, `OMT`, `IDIO`, `MOD`, `FILM`.

By family: Woodwind 11, Percussion 13, Strings 6, Brass 6, Plucked 3, Voices 2,
Combining 7, Reference 3, Composers 36, Film Composers 13.
By kind: 33 instruments, 49 composers, 9 topics, 8 sections, 1 technique.

Commits on `claude/sharp-hawking-kh7a7a`:

- `0a7d3a3` — the script, the instrument/section database, tests, README.
- `222df1c` — composer entries, reverse links, extended tests, README updates.

---

## 6a. Later addition: Belkin's *Artistic Orchestration*

The user supplied a zip of Alan Belkin materials after the composer work was
done: seven chapter pages saved from alanbelkinmusic.com, plus `bk-O-O.pdf` —
the complete 65-page *Artistic Orchestration* (© 2001, 2008), which carries the
author's own permission: "The material may be used free of charge provided that
the author's name is included."

This mattered for two reasons.

**It upgraded a source's precision.** `BEL` had been tag-only, because the
earlier material came from search summaries. With the author's PDF in hand, every
existing `BEL` claim was re-verified:

- Five verified word for word and were upgraded to page citations (p.7, p.35,
  p.40 ×2, and the plane-of-tone definition at p.39–40).
- **One did not.** An item phrased "the single most important principle to grasp
  in orchestration is: Planes of Tone" is not in this book — it came from a
  search summary of a different or earlier Belkin text. It was rewritten to what
  the book actually says, and the term credited to D. F. Tovey, as Belkin credits
  it.

The suite now fails on any bare `BEL` citation without a page, so the tag-only
habit cannot creep back. `CLAUDE.md` rule 4 was rewritten to be per-source and to
say explicitly what to do if a full text for `OMT`, `IDIO`, `MOD` or `FILM` ever
arrives: re-verify, then upgrade.

**It filled real gaps.** Belkin writes about what none of the other sources
systematically covers — his stated reason for writing the book — so almost none
of it duplicated what was already there. Twenty new entries:

- **Craft (9):** orchestration and form; the five-group scale of timbral
  contrast; planes of tone with its four types of background movement; sustained
  vs dry sound; orchestrating counterpoint; the tutti and its three organising
  methods; accompanying a soloist; orchestrating dynamics; and the good/poor
  orchestration checklists.
- **Character (11):** the reverse lookup — type a mood, get the scoring. Ten
  characters from his Appendix 2 plus an index entry carrying his caveats, which
  are emphatic and were reproduced rather than paraphrased: used as a recipe book
  these become clichés.

Ten existing entries also gained page-cited sections: strings (crossing,
pizzicato as percussion), woodwind (each one "three instruments in one", the oboe
deciding the blend, thickness with strings, completing the top of a brass chord),
brass (horns as alto instruments, high/low specialists, trumpets empty in wide
spacing), percussion (the five functions; wet/dry by material), voice, range,
balance (Koechlin's loudness vs volume), doubling (heterophony, partial,
piece-meal) and oboe.

**A third disagreement worth recording.** Belkin's study order —
Mendelssohn, Tchaikovsky, Bizet, Mozart, Beethoven, Wagner, then Ravel/Mahler/
Strauss — conflicts with Rimsky-Korsakov's advice that "classical music will
prove of negative value" to a student and that Mozart and Haydn are of no further
use. Both are now given in the `composers` entry, with a note that they are
answering different questions: Rimsky-Korsakov was arguing in 1891 against a
conservatoire tradition, Belkin is grading by technical complexity.

**One search bug introduced and caught.** Adding a `dynamics` entry created an
exact-alias collision with `balance`, which already claimed the word; the
alphabetical tie-break sent "dynamics" to the wrong page. Fixed by removing the
alias from `balance`. A collision audit over both files found five in total; the
other three (`drums`, `basses`, `plucked`) were left alone because both entries
are a fair answer and the user can arrow between them. The audit one-liner is now
in `CLAUDE.md`.

Environment notes from this round, also recorded in `CLAUDE.md`: `poppler-utils`
would not install (404 from the archive) and `pypdf` crashes on import because
the system `cryptography` wheel panics under pyo3 — blocking that module in
`sys.modules` first makes `pypdf` fall back to its no-encryption provider and
work fine on an unencrypted PDF.

After this round: **120 entries, 1,360 cited items, 8 source tags, 142 checks.**

---

## 7. What is not done

- **Never run inside REAPER.** The harness approximates font metrics, so spacing,
  font choice and colour have not been seen. This is the one thing that needs a
  human with REAPER open. Expect to adjust `S()` paddings and the font sizes in
  `initfonts()`.
- **No dark/light theme switch.** One dark theme, matching REAPER's default.
- **HiDPI is written but untested.** `gfx.ext_retina` is read and `SCALE`
  recomputed when it changes; behaviour on a real Retina display is unverified.
- **No PR opened.** The branch is pushed; the user did not ask for a pull request.
- Possible additions, in rough order of value: instrument ranges as notated
  pitches (the sources give them as engraved tables the plain-text transcription
  drops); a favourites or history list; the omitted composers, if sources can be
  reached; extended-technique entries (sul ponticello, harmonics, flutter tongue)
  which are currently scattered through instrument pages rather than collected.

---

## 8. Environment facts worth remembering

- Fresh container has **no Lua**; `apt-get install -y lua5.4` works.
- **Egress is blocked** for arbitrary domains. `WebSearch` works; `WebFetch` and
  `curl` to external hosts do not. Check with
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"`.
- GitHub access is via the `mcp__github__*` tools, not the `gh` CLI. Plain `git`
  push over HTTPS worked without needing them.
- The repo's remote is `KallumS/Orchestration-Helper`; the working branch is
  `claude/sharp-hawking-kh7a7a`.
