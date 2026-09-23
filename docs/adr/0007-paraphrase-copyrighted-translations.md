# 0007. Paraphrase copyrighted translations of public-domain texts

- **Status:** Accepted
- **Date:** 2026-09-22

## Context

Berlioz's *Treatise on Instrumentation and Orchestration* (1843, revised 1855) is
public domain. The English translation supplied for it is not: it is a modern
translation whose site reserves all rights explicitly.

These are two different rights in the same file. Facts and ideas are not
copyrightable, so Berlioz's *substance* is free to use however old the text. A
translator's prose is their own creative work.

The project already quotes Rimsky-Korsakov and Singleton freely, because both are
public-domain translations. Applying the same habit here would have meant copying out
a living translator's sentences, which is a different act even where the underlying
author died in 1869.

## Decision

**`BERL` items state Berlioz's substance in this encyclopaedia's own words** rather
than reproducing the translator's sentences.

Where Berlioz is quoted word for word anywhere in the repository, it is from the older
public-domain translation Singleton uses, and the item carries `SIN` as well as
`BERL`.

The rule is written to generalise: **any source that is a copyrighted translation or
edition of an old text gets the same treatment** — cite it, use it, do not copy out of
it.

## Consequences

- `BERL` items read differently from `RK` and `SIN` items, which are full of
  quotation. That is a visible inconsistency in the app's voice, and it is the right
  one: it reflects a real difference in what may be reproduced.
- Berlioz's own phrasing — much of it very good — is lost from those items. The
  substance is not.
- It complicates verification. When the treatise arrived, none of the existing
  Berlioz quotations could be confirmed by string search, because the app has the 1917
  translation and the new file has a modern one. The claims had to be re-read and
  compared by meaning. Expect that whenever a source arrives in a different edition
  from the one already cited.
- Hugill's site also reserves all rights, but is the author's own English, so `HUG`
  uses short attributed quotations rather than paraphrase. The distinction is
  translation, not copyright alone.

## Enforcement

`tests/run.lua` fails any `BERL`-only item containing a quoted run of more than twelve
words. The check was verified by planting one, rather than trusted because it passed.
