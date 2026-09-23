# 0004. Consensus only, with "Use sparingly" as the escape hatch

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The brief was explicit: *"The information should be the general consensus — for example
if there is a rare pairing of two instruments, that info should be ignored and not
incorporated into the script."*

Taken literally that means deleting anything rare. But the sources spend a lot of their
most useful prose on exactly that: Rimsky-Korsakov explaining that flute + bassoon in
unison is "very seldom found except in certain orchestral tutti", Berlioz calling a
trombone on the bass line the most vulgar thing in orchestration. Deleting those
leaves the user unable to find out *why* the thing they were about to do is a bad idea
— and liable to do it.

## Decision

Anything a source calls rare, seldom used, exceptional or not recommended is **never
listed as a suggestion**. It appears, if at all, under a section titled with the
substring `"sparingly"`, in the source's own wording, coloured as a warning.

So the recommendations contain only what the literature agrees on, and the warnings
are still reachable.

## Consequences

- The brief is honoured in substance, not just in letter: a search never returns a
  rare combination *as an answer*.
- The user can still learn why something is excluded, which is most of the educational
  value.
- It creates editorial work on every item: deciding which side of the line a claim
  falls on, and finding the source's own wording for the warning rather than
  paraphrasing it into a recommendation.
- It interacts with ADR 0006: where sources *disagree* about whether something is rare,
  the disagreement is recorded rather than either position being demoted to a warning.
  Oboe + clarinet in unison is the case — warned against in much present-day teaching,
  scored freely by Rimsky-Korsakov, Schubert and Tchaikovsky — and it stays a
  recommendation with the warning attached, not a "Use sparingly".
- The colour dependency on the substring is inherited from ADR 0002 and is a known
  wart.

## Enforcement

No mechanical check is possible — this is a judgement about meaning. What the suite can
enforce is that **every item is cited**, which forces the question "whose claim is
this?" at authoring time, and that is usually where a rare combination gets caught.
