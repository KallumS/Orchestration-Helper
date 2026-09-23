# 0006. Record disagreement between sources rather than resolving it

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

An encyclopaedia of consensus (ADR 0004) has an obvious failure mode: when the sources
genuinely conflict, picking one and presenting it as settled is a lie of omission. The
conflicts are also not rare — the sources here span 1843 to 2024, and the instruments,
halls and teaching all changed underneath them.

The alternative temptation is worse: quietly dropping a claim because another source
contradicts it, which loses information in both directions.

## Decision

Where the sources conflict, **give both, name the conflict, and give the reader the
deciding factor** where one exists. A disagreement is a result, not a problem to be
resolved away.

The worked examples, all live in the app:

- **Doubling the violins in octaves.** Rimsky-Korsakov calls Vns I / Vns II at the
  octave "a very common process" (`RK p.40`); Berlioz says that unless the passage lies
  high, all the violins in unison is far better (`BERL The violin`). Both sit on the
  `violin` page with register as the deciding factor.
- **Oboe + clarinet in unison.** Scored freely by Rimsky-Korsakov, Schubert and
  Tchaikovsky; warned against in much present-day teaching. Recorded on both
  instruments' pages.
- **Whether a trombone may carry the bass line.** Berlioz: the most vulgar thing in
  orchestration. Rimsky-Korsakov: relaxed about it.

## Consequences

- The user gets the shape of the evidence, not a false verdict.
- It is the strongest argument for ADR 0005: without per-source citation, "sources
  disagree" is unfalsifiable hand-waving. With it, the reader can go and look.
- **It means reading each new source against what the app already claims**, not only
  for new material. The Berlioz/Rimsky-Korsakov find only surfaced because of that,
  and it was the single most useful thing the treatise contributed.
- Entries get longer, and some pages carry two answers where the user might have
  preferred one. Accepted: an encyclopaedia that pretends to certainty it does not have
  is worth less than a longer honest one.

## Enforcement

None mechanical. The discipline is procedural: when a new source arrives, diff its
claims against the existing items before adding anything.
