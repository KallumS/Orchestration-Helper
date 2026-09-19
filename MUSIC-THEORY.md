# The theory behind Orchestration Helper

What the project taught, gathered in one place. The app answers a narrow working
question — *if I want this instrument doubled, what do I double it with?* — and it
answers it in fragments, one item at a time, each with a citation. This file is the
connected version: the principles those fragments are instances of, plus the wider
music theory the sources assume you already have.

It is a reference, kept by hand. It is not generated from the data files, and it is
not the data files in prose — where the app gives a rule, this gives the reason.

**Every claim here is attributed.** Tags match the app's Sources page:

| Tag | Work | Precision |
| --- | --- | --- |
| `RK` | Rimsky-Korsakov, *Principles of Orchestration* (1922) | by page |
| `SIN` | Singleton, *The Orchestra and Its Instruments* (1917) | by approximate page |
| `BEL` | Belkin, *Artistic Orchestration* (2001/2008) | by page |
| `IDIO` | *The Idiomatic Orchestra* | by chapter |
| `HUG` | Hugill, *The Orchestra: A User's Manual* (2015) | by page title |
| `OMT` | *Open Music Theory* 2e | by chapter |
| `WP` | Wikipedia, *Orchestration* | by tag (no pagination) |
| `MOD`, `FILM` | present-day and film-music references | by tag (not read in full) |

Where sources conflict, both are given and the conflict is named. That is a rule of
the project, not an evasion: disagreement between a treatise and present-day
teaching is information about how confident you should be.

---

## Part one — orchestration

### 1. The one idea the rest hangs off

Orchestration is not decoration applied to finished music. It is the assignment of
a fixed set of physical sound-producing bodies to musical lines, and the sound of
the result is a property of that assignment, not of the notes.

The cleanest demonstration is negative. Britten's *Variations on a Theme of Frank
Bridge* contains a four-part fugue **in perfect unison** — first and second violins,
violas and cellos enter one by one with the theme and add counterpoints, but the
music is written so that no harmony ever results. The listener hears a single line
and, simultaneously, a classical fugue, produced *solely* by the difference in
instrumental colour and the players' positions in the hall. A piano reduction of it
would be meaningless. `IDIO Perfect Unison`

That is why the field needs a theory of its own: "the concepts of classical music
theory fall short" here. `IDIO Perfect Unison`

### 2. Think in planes, not in instruments

Before choosing colours, decide how many independent things are sounding. A *plane
of tone* is "one instrument, or a blended group of instruments, not necessarily from
the same family, sharing one rhythmic outline" — the term is Tovey's, and Belkin
credits him for it. `BEL`

Shared rhythm is what fuses a group into one plane, and it is stronger than shared
pitch. In a Messiaen passage most instruments descend a major second while the
second violins rise an *augmented fourth*, and the ear still hears one line, because
rhythm, articulation and contour agree. `IDIO Parallel Doubling`

Conversely, independent melodic movement splits a texture into separate planes. The
judgement between "an elaborate doubling" and "polyphony" is exactly the weighing of
rhythmic unison against independent motion, and the borderline cases "are not rare."
`IDIO Parallel Doubling`

The practical consequence: an orchestral "line" need not be one instrument or even a
continuous one. *Unisono* in this sense covers anything behaving as a single voice,
including a melody handed between families phrase by phrase (**split unison** — the
second theme of Mozart's 40th) as against one carried throughout (**linear unison** —
its first theme). Push split unison far enough and individual lines dissolve into
points of changing colour: that is *Klangfarbenmelodie*, Schoenberg's term from his
1911 harmony textbook, and Webern's 1935 orchestration of Bach's six-part Ricercare
is the famous case. `IDIO Linear and Split Unison`

### 3. Doubling — the four kinds, and what each actually does

This is the centre of the subject, and the single most useful thing the project
established is that the four kinds do *different* things. They are not degrees of
the same thing.

**Perfect unison** fuses tone colour and increases *density*, while "volume
(amplitude) is only partly affected." If you want it louder, this is the wrong tool.
`IDIO Perfect Unison`

**Octave** doubling "will always result in an increase in volume, and is by far the
most common type of doubling" — hard to imagine an orchestral work without it. It
also clarifies the relation between melody and accompaniment by spreading them
across registers. `IDIO Octaves`

**Parallel** doubling at other intervals — usually third, fifth or sixth, adjusted
to the key — gives, "even more than octave doubling, increased volume and density."
It is the heaviest of the three. Interest in intervals beyond octave, third and
sixth grows markedly from the early twentieth century. `IDIO Parallel Doubling`

**Partial** doubling doubles some of a line and not the rest. Reach for it when
complete doubling "would result in a heavy and massive sound" — Bartók has the
woodwind partly doubling the high strings while the horns partly double the low ones.
`IDIO Partial Doubling`

Three refinements on partial doubling, all of which reframe it from compromise to
technique:

- **Let the less agile instrument simplify.** Cellos and basses are the standard
  case; the basses play a plainer version. This is how the pairing has always worked.
  `IDIO Partial Doubling`
- **Use it to solve playability.** Berlioz splits a theme of wide, fast, high leaps
  between the violins so no desk has to make them — intonation insurance dressed as
  orchestration. Ravel does the same for Bolero's triple-tonguing, modifying it for
  the woodwind while the horns play it straight. `IDIO Partial Doubling`
- **Modify as you double.** A bassoon and flute may take the first violins' melody
  "with tiny modifications that prevent embellishments or pitches in a high or
  somewhat strained register from threatening the elegance of the melody."
  `IDIO Partial Doubling`

And one fact that repeatedly surprises people: **dividing a string group in two does
not halve the volume of each half.** It "does not noticeably influence the volume of
each half, but can reduce the density of sound to a certain degree." Divide for
texture; do not expect a dynamic result. `IDIO Partial Doubling`

#### Mixture — orchestrating an instrument that does not exist

The most sophisticated use of doubling is not blending two colours but synthesising
a third. Add instruments on a note's own overtones, softly enough that the ear takes
them for overtones rather than notes, and you get a timbre no player possesses —
"invented instruments, so to say." The organ mixture stop is the model.
`IDIO Parallel Doubling`

The canonical example is in *Bolero*: a horn melody joined by two piccolos on its
2nd and 4th overtones and a celesta on its 1st and 3rd. Two details make it work,
and both are instructive:

1. Because overtones are fixed intervals **independent of tonality**, Ravel notates
   the 2nd overtone of a C major melody in G major and the 4th in E major. The
   added parts are not in the key; they are in the harmonic series.
2. He marks **individual dynamics**, so the added parts stay below the threshold of
   being heard as themselves. `IDIO Parallel Doubling`

The cheap version is one line long: a muted trumpet with a flute an octave above.
The flute supplies an artificial first overtone and the pair passes for a gentle
oboe — which is how Ravel postpones the real oboe until bar 167. It needs a
*straight* mute, which enhances high overtones; a cup or velvet mute removes exactly
the overtones the illusion depends on. `IDIO Parallel Doubling`

What you double *with* matters: instruments whose own spectra are weak in overtones
disappear into the sound they are colouring. Flute, string harmonics, celesta, and
the clarinet's weak middle-register notes. `IDIO ch.12`

#### Lines that outgrow their instruments

When a unison line runs through more octaves than any player can cover, instruments
change lanes — jumping an octave to continue. Stagger those shifts; they must happen
"smoothly and carefully graduated," never all at once. `IDIO Octaves`

#### The one composer who tried to do without octaves

Schoenberg attempted to avoid octave doubling entirely in his *Variations for
Orchestra* op. 31 (1928), fearing the octave would threaten the identity of the
twelve-tone row. It is a futile ambition: the octave is the first overtone in the
series and is therefore present in almost every instrumental sound already.
`IDIO Octaves`

### 4. Balance — and why it is not loudness

#### Loudness does not add the way you expect

Sixteen violins are not sixteen times one violin. Sound pressure doubles; perceived
loudness barely moves. What changes is the *kind* of sound: "full, rich, more mellow
and far more dense." This is the only reason a single soloist can be heard against
thirty-two of them at all. `IDIO Dynamics and Balance`

Koechlin's distinction, which both Belkin and the Idiomatic Orchestra adopt, is the
right vocabulary: **volume** means thickness or density, independent of **power**. A
horn is thicker than a violin at any dynamic. Thick sounds have stronger
fundamentals. `BEL p.34`, `IDIO Dynamics and Balance`

So there are two ways to get a fat sound: choose a fat timbre (horn, tuba), or
unison-double, which "adds more volume than loudness." `BEL p.34-35`

#### The balance ratio — the one countable tool in the literature

Rimsky-Korsakov's experience, reduced to four numbers:

| | ratio |
| --- | --- |
| One string group (e.g. all 1st violins) | **2** |
| One woodwind instrument | **1** |
| One horn, or one saxophone | **2** |
| One other brass instrument | **4** |

`IDIO Dynamics and Balance`

It takes **four clarinets to match one trumpet.** Counter-intuitive, and "largely
confirmed by practical experience, although they admittedly are beyond scientific
proof." `IDIO Dynamics and Balance`

Rules of use:

- **Forte only.** Power varies far more in piano: muted brass or strings can play
  extremely softly, while very soft is awkward for a low oboe, a very high clarinet
  or an unmuted high trumpet. `IDIO Dynamics and Balance`
- **Each divisi note counts 2**, the same as a whole group. For double stops, count
  each sustained note. `IDIO Chords`
- **Omit timpani.** Their dynamic range is effectively unlimited so no ratio fits,
  and in classical and romantic scoring they mark the root anyway. Harp and piano
  are left out too, unless they exist to create a deliberately unusual balance.
  `IDIO Chords`

Rimsky-Korsakov's own scattered ratios are consistent with this and finer-grained:
1 trumpet = 1 trombone = 1 tuba = 2 horns in forte; 1 horn = 2 clarinets = 2 oboes
= 2 flutes = 2 bassoons in forte; in piano all wind, wood and brass alike, are of
roughly equal weight; and in forte Violins I = 2 flutes = 1 oboe + 1 clarinet.
`RK p.33`

#### Where counting stops working

Balance is not only power. "A melodic line (or the highest part) always attracts
attention — activity and movement capture more attention than, for example,
sustained notes." `IDIO Dynamics and Balance` Belkin puts the same point three ways:
the top line normally attracts most attention; the ear follows activity, so a moving
viola stands out from static strings; but activity also *obscures*, and strings
playing vigorous counterpoint will cover a voice far more easily than strings holding
long notes. `BEL p.36`

Two worked cases show the limit. In a *Heldenleben* tutti the busy woodwind flurry
scores only 6–7 while the trombone melody scores 16 — so the ratios correct a naive
score-reading. But elsewhere a first-violin countermelody scoring **2** emerges over
a main subject scoring **12**, because the subject is a near-immobile ostinato. The
ratio is an input to judgement, not a verdict. `IDIO Chords`

And measuring it in decibels is "practically useless" for music: manufacture,
playing style, hall acoustics, seating and the players' own instinctive adjustments
all vary constantly. `IDIO Dynamics and Balance`

#### Successive balance

Balance also runs in time, not only vertically. "This is a problem mainly when
passing from very thick sounds to very thin ones: The thin sound can seem
disagreeable by comparison with the previous richness… after a loud, full brass
passage, an oboe will sound thinner than usual, by contrast." `BEL p.35-36`

#### Two failures worth knowing

- **Two solo violins in perfect unison** "often sound poor, if not to say
  'impoverished'" — although doubling all the first and second violins in unison is
  standard and merely adds density. The effect does not scale down from section to
  pair. `IDIO Dynamics and Balance`
- **Solo strings against solo brass** in a sinfonietta needs meticulous care.
  Strings are essentially unchanged since the late 1700s; brass instruments have
  changed substantially and are considerably more powerful now. A classical-era
  balance does not transfer. `IDIO Dynamics and Balance`

### 5. Chords — spacing, weighting, and dissonance

#### Spacing follows the harmonic series

Wide intervals (octaves, sixths) in the bass; lesser ones (fifths, fourths) in the
middle; close ones (thirds, seconds) up top. The bass should rarely sit more than an
octave from the part above it, and should never mix with the other parts.
`RK p.67 & p.79`, `RK p.64 & p.67`

The *reason* is acoustic, and it generalises further than Rimsky-Korsakov's tonal
context. The strongest overtones of a very low note land in the middle of the
hearing range, where the ear resolves pitch most precisely. Wide intervals low down
keep those overtones from colliding with what is actually written in that register —
which is why the low register is dominated by the octave, then the fifth, and why
the third, with its dissonant overtones, appears down there only in deliberately
unusual chords. And it is not merely a tonal rule: "all chords, tonal or atonal,
triadic or not, tend to be structured in such a way that the largest intervals are
placed in the bass register." `IDIO Chords`

#### The root takes most of the weight

Measured as fifth/third/root, final chords in the classical and romantic repertoire
put most of the sound power on the root:

| Work | balance ratio | per cent |
| --- | --- | --- |
| Brahms, Symphony 2 | 9 / 8 / 35 | 17 / 15 / 67 |
| Brahms, Symphony 1 | 11 / 11 / 29 | 22 / 22 / 57 |
| Brahms, Symphony 4 | 4 / 12 / 37 | 8 / 23 / 70 |

`IDIO Chords`

Two instructive departures:

- **Reinforce rather than thin out.** Ending *Ein Heldenleben*, Strauss diminuendos
  to piano but does not remove instruments — he *adds* four horns and moves a trumpet
  and three trombones off the fifth and third onto the root. Quieter and more focused
  at once. `IDIO Chords`
- **Weight the third when the piece is about the third.** Mahler's 6th — "a battle
  between minor and major" — ends 13/24/19, weighting the third, so the minor third
  is unmistakably the victor. `IDIO Chords`

#### How harsh a dissonance sounds is orchestration, not harmony

Two factors, neither of which is the interval:

- **Register spread.** "The further apart two notes are placed from each other in
  terms of register, the less intense or obtrusive the dissonance between them will
  be perceived." `IDIO Chords`
- **The instrument's spectrum.** Powerful high overtones make a piercing dissonance.
  A minor second "seems far less harsh when played by two low flutes than by two low
  oboes." `IDIO Chords`

#### Two practical checks before you write a chord

- **Intonation exposure.** The ear resolves pitch best in the centre of its range.
  The violin's high register sits where the ear is more forgiving; the cello's high
  register sits right in the middle, so slight intonation trouble there is
  immediately audible. `IDIO Chords`
- **Can everyone fade?** A low oboe has very little room for diminuendo; a string
  instrument or low clarinet has almost no limit. Check any chord marked to die away.
  `IDIO Chords`

Rimsky-Korsakov adds the acoustic consolation: "in every chord the parts in octaves
strengthen one another, the harmonic sounds in the lowest register coinciding with
and supporting those in the highest" — which compensates for inequalities you could
not avoid. In four-part wind harmony the two extreme parts are thinnest, the
intermediate parts fullest. Where distribution cannot secure balance, grade the
dynamics instead. `RK p.94`, `RK p.77`

### 6. Timbre — overtones, formants, penetration

Why one instrument cuts through a tutti and another vanishes at the same dynamic.
The answer is almost never power; it is the shape of the overtone spectrum, and it
changes from register to register on the same instrument, sometimes note to note.
`IDIO Dynamics and Balance`

**Formants** — powerful high-pitched peaks or clusters in the spectrum — make a tone
intense and penetrating, and are audible as a kind of "hiss." They are present in:
the oboe; sharply muted brass, especially loud; stopped horn; the clarinet's low
chalumeau; the violin's G string; the cello's A string; low contrabassoon, and to
some extent low bassoon. `IDIO ch.12`

**Weak-overtone spectra** blend, and can supply artificial overtones without being
heard: flute; string harmonics; the clarinet's weak middle-register "filling in"
notes; alternative woodwind fingerings; overblowing on a different fundamental;
celesta. `IDIO ch.12`

Bowing position moves an instrument between the two groups. *Sul ponticello*
produces high, powerful formants the player can modulate by bow placement and
pressure, to the point where the fundamental vanishes; *sul tasto* weakens or
removes overtones. `IDIO ch.12`

**Register inverts the intuition.** A low flute is very soft with little penetration
(few overtones); a high flute penetrates easily; a high piccolo solo "will often be
easily audible even in a full orchestral tutti." But **a low oboe is far more
penetrating than the same instrument at the top of its range.**
`IDIO Dynamics and Balance`

**The real risk to a quiet instrument is masking, not volume.** The flute's few
overtones mean the *overtones of lower instruments* can drown it in its middle
register, and worse at the bottom. The fix is a clear register, not a louder mark:
"as long as one makes sure that they are not drowned out by other instruments in the
same register or by overtones from lower instruments, even very low flutes will most
often be audible." `IDIO ch.12`

*Bolero* is the textbook. The order of solos in its first half is a graded increase
in intensity by spectrum: flute at the bottom of its range with few overtones,
clarinet in the neutral middle, high bassoon, high E-flat clarinet. The oboe —
intense, overtone-rich — is deliberately withheld, with the oboe d'amore used where
that colour is wanted, until bar 167, where it appears inside a mixture rather than
as a soloist. `IDIO Parallel Doubling`

### 7. Blend between families

The standard acoustic analogies, which have become textbook material:

- horn + bassoon in the middle register — a "slimmer," more focused sound that keeps
  its horn quality
- low clarinet + viola
- horn + cello, or all horns with all low strings
- oboes + trumpets at soft dynamics
- bassoons + string pizzicato

Less well known: a high bassoon, an alto saxophone, and a trumpet with cup mute are
timbrally close; and muted brass in some registers is hard to distinguish from
woodwind. `IDIO ch.12`

One warning from the same source about the genre this file belongs to: there is a
"special literary niche" of endless tables of well-sounding combinations, "an
ambitious attempt at systematization that only too rarely has proved to be useful in
practice." The app is such a table. It earns its place only if each item is cited
and each recommendation is checkable against a score — which is why the
*Where to Hear These Combinations* entry exists. `IDIO ch.12`

Rimsky-Korsakov's ranking still holds as a first approximation: expressive capacity
diminishes from strings, through woodwind, to brass, to percussion, "colour being
the only attribute of the last group." `RK p.35`

### 8. The apparatus itself

**Strings.** The one consistent component of the orchestra down the ages; the range
of expression and the stamina make them the basic tool. A typical professional
section is 16 firsts / 14 seconds / 12 violas / 10 cellos / 8 basses, though numbers
vary with piece, venue and conductor; the principal first violin is also the leader.
`HUG String Section` Rimsky-Korsakov gives the same proportions, and the advice to
write for the medium body: "played by a larger orchestra a work will be heard to
greater advantage; played by a smaller one, the harm done will be minimised."
`RK p.6-7` Strauss "and many others" required 16–18 firsts and 16 seconds for
full-scale work `IDIO Dynamics and Balance`, and standard repertoire is performed
today with anywhere from 20 to 60-plus string players, with composers rarely
specifying. `IDIO Dynamics and Balance`

**Woodwind**, by lineup — and note that the family names are conventional, since not
all of them are wooden:

| | flutes | oboes | clarinets | bassoons |
| --- | --- | --- | --- | --- |
| Double | 2 | 2 | 2 | 2 |
| Triple | 2 + piccolo | 2 + English horn | 2 + bass clarinet | 2 + contrabassoon |
| Quadruple | 3 + piccolo | 3 + English horn | 3 + bass clarinet | 3 + contrabassoon |

Triple "is the standard lineup for most symphony orchestras." Saxophones may be
added to any of them. `HUG Woodwind Section`

**Brass.** Horns, trumpets, trombones, tubas; "probably the most common orchestral
combination" is 4 horns, 3 trumpets, 3 trombones, 1 tuba, with numerous variations
and occasional massive expansion. Horns "generally have a weaker sound than the
other brass," which is why they group with the woodwind so often. Writing for four:
horns 1 and 3 take the high parts, 2 and 4 the low, with 1 highest and 4 lowest. A
fifth (bumper) horn may be engaged even when the score asks for four, covering the
less important passages in the first part so the principal can concentrate on solos.
And a horn quartet "will be very effective and unobtrusive when carrying the
harmonic background to a passage." `HUG Brass Section`

**Percussion.** Timpani are a special case: the only percussion instrument present
in nearly all orchestral music, played by a specialist who will not normally touch
anything else. Beyond that, any number of instruments may appear, but they are
covered by a fixed number of players — so pay attention to "the choreography of both
players and beaters. A common mistake is to allow insufficient time for players to
change instrument or pick up new beaters." `HUG Percussion Section`

### 9. Imitation as a mark of mastery

"The ability to imitate any acoustic phenomenon by using the possibilities offered
by the orchestra is in itself proof of having mastered the medium." Strauss claimed
one must be able to "orchestrate a dinner party so that the difference between
knives and forks can be heard." `IDIO ch.12`

The list of famous cases is long — Vivaldi's solo violin as a hunting horn, Strauss's
bleating sheep in *Don Quixote*, Stravinsky's creaking barrel organ in *Petrushka*,
Crumb's distant seagull made from a cello glissando in harmonics, Debussy's "virtual"
guitar from pizzicato, harp and timpani in *Fêtes*. The transferable skill is not the
effects but the sensitivity that finds acoustic analogies where they are not obvious:
Stravinsky noticing that staccato piano and trombone are near-identical in the same
register; Strauss making a low piccolo pass for a recorder. `IDIO ch.12`

### 10. Where the authorities disagree

This matters more than any individual rule, because it tells you how much weight to
put on the rest.

- **Oboe + clarinet in unison.** Rimsky-Korsakov scores it freely and describes it as
  fuller than either alone, the dark nasal oboe prevailing low and the bright
  clarinet high `RK p.47`; a good deal of present-day teaching warns against it. It
  is in Schubert's *Unfinished* and used freely by Tchaikovsky. Both positions are
  recorded in the app, on both instruments' pages, because the evidence genuinely
  points both ways.
- **What to study first.** Rimsky-Korsakov was arguing in 1891 against a
  conservatoire tradition that taught scoring from Gluck and Mozart; Belkin
  recommends a different order. The app records both rather than picking.
- **How much a treatise transfers.** Brass instruments are considerably more
  powerful now than in the classical era, while strings are essentially unchanged
  `IDIO Dynamics and Balance`; halls are larger. A balance ratio from 1922 is a
  starting point, not an answer.

### 11. The consensus rule, and why it is the project's backbone

The brief asked that rare pairings be excluded. The way that was honoured is worth
recording as a principle: **anything a source calls rare, seldom used, exceptional
or not recommended is never listed as a suggestion.** It appears, if at all, under a
"Use sparingly" heading, in the source's own wording.

This keeps two things true at once. The recommendations are only what the literature
agrees on; and the reader still learns why the excluded thing is excluded, without
it being recommended. Flute + bassoon in unison is the model case: "very seldom found
except in certain orchestral tutti," and rare in octaves because the registers lie so
far apart. `RK p.48-49`

---

## Part two — the wider theory

*Open Music Theory* supplies what the orchestration sources assume. Its own
orchestration chapter was not in the material supplied, so nothing below is about
scoring; it is the harmonic, contrapuntal and formal vocabulary those sources use
without defining. All of Part two is `OMT` unless noted.

### 12. Pitch, collections and scales

A **collection** is a group of notes — usually five or more — with no implied tonal
centre: "a kind of 'soup' within which pitch-classes float freely." It becomes a
**scale** when a composition privileges one note as tonic. The distinction is the
useful one for twentieth-century music, where the material is often a collection
without a key.

- **Diatonic** — any transposition of the seven white keys, named by sharp/flat
  count ("the 2-flat collection"). Given a tonic it becomes one of the modes:
  Ionian (= major), Dorian, Phrygian, Lydian, Mixolydian, Aeolian (= natural minor),
  Locrian (uncommon outside jazz). These share names with the medieval church modes
  but "function quite differently; the similarity is principally one of name."
- **Pentatonic** — a major scale minus degrees 4 and 7, so it contains no half steps.
  Because of that "halfsteplessness" any member can function as tonal centre, giving
  five scales per collection. The piano's black keys are one.
- **Whole tone** — generated entirely by whole tones; there are only two,
  WT0 = {C, D, E, F♯, G♯, B♭} and WT1 = {C♯, D♯, F, G, A, B}.
- **Octatonic** and the acoustic collections are the other common post-tonal sources.

### 13. Harmony as function

Common-practice harmonies cluster into three **functions**: tonic (T), subdominant
(S, also predominant), dominant (D). Roughly, I/III/VI are tonic, II/IV subdominant,
V/VII dominant — but the finer account is by scale degree, and it is what makes the
theory work on incomplete chords.

Each function has characteristic degrees: T has 1, 3, 5, 6, 7; S has 1, 2, 3, 4, 6;
D has 2, 4, 5, 6, 7. Ian Quinn's refinement sorts these into **triggers**,
**associates** and **dissonances** — for T, triggers 1 and 3, associates 5 and 6,
dissonances 7 (and 5 when 6 is present); for S, triggers 4 and 6, associates 1 and 2,
dissonances 3 (and 1 when 2 is present).

The striking claim is that in common-practice music **a chord's function is
determined by its notes alone**, independent of context. This is *not* true of all
styles — in pop/rock a IV chord can behave quite differently depending on where it
sits.

**Tendency tones** and functional dissonances are what give a function its pull, and
**modal mixture**, **applied (secondary) chords**, the **Neapolitan** and the
**augmented-sixth** chords are the standard chromatic extensions. **Modulation**
comes in several kinds — direct/phrase, pivot-chord, and in popular music the
step-up/pump-up and "truck-driver" varieties.

### 14. Counterpoint and voice leading

Four kinds of motion between two lines, and "differentiating these four types of
motion is essential to generating good voice-leading":

- **parallel** — same direction, same generic interval
- **similar** (direct) — same direction, different intervals
- **contrary** — opposite directions
- **oblique** — one voice stationary, the other moving

Strict voice-leading is taught through species counterpoint, starting from a
**cantus firmus** whose constraints encode the four values it teaches — smoothness,
melodic integrity, variety, and motion towards a goal:

- 8–16 notes, all whole notes (arhythmic)
- begins and ends on *do*, approaching the final tonic by step (usually *re–do*)
- every note-to-note progression a melodic consonance
- range no more than a tenth, usually under an octave

First species adds one note against one. Its rules are all consequences of two
aims — independence of line, and fusion into consonance:

- begin and end on a perfect consonance; a counterpoint above starts on *do* or
  *sol*, below it must start on *do* (starting on *sol* below makes a dissonant
  fourth; on *fa* it makes a fifth but invites hearing *fa–do* as *do–sol*)
- approach the final interval by contrary stepwise motion, so the penultimate
  vertical interval is a minor third or a major sixth
- one climax per line, and **the two climaxes must not coincide**
- no voice crossing and no voice overlap — both blur which line is which
- keep within an octave where possible, never exceed a twelfth: "when the voices are
  too far apart, tonal fusion is diminished"
- unisons only as first and last intervals — too stable to be a midpoint

Then second species (2:1), third (4:1), fourth (suspensions), and free counterpoint.
**Embellishing tones** — passing, neighbour, double neighbour, incomplete neighbour,
suspension, anticipation — are the vocabulary of departure from the frame.

**Thoroughbass** and the galant **schemata** (the Meyer, the Jupiter, the Aprile,
the Prinner, the Pastorella) are the eighteenth century's own way of teaching the
same material as patterns rather than rules — closer to how the music was actually
made.

### 15. Phrase and form

**Cadences** are the punctuation, and are "at once a harmonic, melodic, rhythmic and
formal event." Authentic cadences run V(7)–I; if the melody lands on *do* it is
**perfect** (PAC), on *mi*/*me* (rarely *sol*) **imperfect** (IAC). Ending on V
without resolving is a **half cadence** (HC), where the V is almost invariably a
root-position triad. A second, finer layer classifies by the voice-leading over the
dominant: **simple**, **compound** (repeated bass *sol*, often with a 4–3
suspension) and **double** cadences.

**Theme types** are built from function rather than length:

- **Sentence** — prototypically eight bars. A *presentation phrase* states a basic
  idea and repeats it while prolonging the tonic; a *continuation phrase* gains
  momentum through fragmentation, sequence, faster surface rhythm, accelerating
  harmonic rhythm, and leads to a cadence.
- **Period** — antecedent phrase ending weakly, consequent phrase answering and
  closing more strongly.
- **Hybrids** and **compound** themes combine the two.

Larger forms: small binary, **small ternary** (the rounded-binary variant is the
ancestor of sonata form), minuet, rondo and five-part rondo, sonata, sonata-rondo.

**Sonata form** is both a three-part ABA′ pattern and a two-part one — the first A
being the first "half," B and A′ together the second. Early sonatas repeat both
halves (a double-reprise structure that looks exactly like a rounded binary), later
ones drop the second repeat, later still both. Its thematic modules are the primary
theme (P), transition (TR), subordinate theme (S) and closing module (C), and its
structural points of arrival are the **medial caesura** and **essential expositional
closure**. Expositions are two-part or continuous; the development has its own tonal
and thematic organisation; the recapitulation is analysed through thematic cycle,
essential sonata closure and recomposition.

### 16. Post-tonal theory

Where function no longer organises pitch, the tools become set-theoretic.

**Pitch class** abstracts away octave and spelling (octave and enharmonic
equivalence). **Normal order** is the most compressed ordering of a pitch-class set —
explicitly analogous to root position for a triad, and generalised to any collection.

Sets related by transposition or inversion **share the same interval content**, which
is the whole engine: all major and minor triads have the intervals M3, m3, P5, which
is why majors are transpositionally related to each other and majors and minors
inversionally related. Sets so related belong to one **set class**, represented by a
**prime form**; the **interval-class vector** summarises the content.

The rest of the apparatus: modulo arithmetic, ordered and unordered pitch and
pitch-class intervals, interval class, complements, common tones under transposition,
symmetry and centricity. **Twelve-tone theory** covers the row and its operations,
intervallic structure, invariance, and derived rows.

### 17. Popular music

Treated as a system in its own right rather than a deviation. Harmonically, "chords
in pop/rock music are almost always root-position triads or seventh chords," which
changes the syntax outright: where classical progressions use 6/3 chords, rock uses
5/3, so a classical IV–IV⁶ becomes IV–VI — the same bass line doing the same work,
but a progression that "would break the rules" of classical syntax. There is as yet
"no published theory of rock harmony equal to Quinn's functional theory of classical
harmony," but the practical upshot is that the bass scale degree is usually enough
to identify the chord.

Minor-key songs of recent decades deviate from classical syntax differently again.
Form is described through containers and modules with their own functions, over
strophic, 32-bar AABA, and verse-chorus layouts; and there is a developed account of
**syncopation**, including "straight syncopations" and "fake triplets."

---

## What is still missing

Honest gaps, so nobody mistakes this for complete.

- **`MOD`, `FILM` and `OMT` were never read in full.** 137 of the app's 1,472 cited
  items (9%) rest on search-result summaries. The `OMT` orchestration chapter in
  particular was not in the material supplied, so the single `OMT` citation could not
  be upgraded even though the rest of *Open Music Theory* was read.
- **Koechlin's *Traité de l'orchestration* has not been read.** Both Belkin and the
  Idiomatic Orchestra lean on it, and the latter notes it "has never been
  translated." Everything here credited to Koechlin comes through one of them.
- **Belkin's notated examples are not represented.** The extraction lost them.
- **One citation is unresolved.** An item on the String Section page, under a heading
  reading "Belkin's practical notes", quotes "strings generally balance themselves
  regardless of voicing" but is tagged `MOD`. Either the words are Belkin's and it
  should carry a page, or they are not and the heading is wrong. Resolving it needs
  the Belkin PDF again, which is not in the repository.
- **Instrument ranges are not given as notated pitches.** The sources present them as
  engraved tables, which the plain-text transcriptions drop.
- **Nothing here has been heard.** No part of this project has been run inside
  REAPER, and the orchestral claims are drawn from texts rather than from rehearsals.
