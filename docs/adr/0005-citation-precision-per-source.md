# 0005. Cite at the precision the evidence supports, and upgrade when it improves

- **Status:** Accepted
- **Date:** 2026-09-19, extended 2026-09-22

## Context

The sources reached this project in very different states. Two public-domain treatises
arrived as full text. Several present-day references could only be consulted through
search-result summaries, because the environment blocks direct page fetching. One
source is a web article with no pagination at all. Later rounds supplied full texts
for sources that had started as summaries.

A single citation format across all of those would either overstate the weak evidence
or understate the strong. Worse, it would hide *which* claims a reader should check.

## Decision

Citation precision is **per source, and changes when better evidence arrives**:

- Read in full and paginated → cite by page (`RK p.40`, `BEL p.34`).
- Read in full, not paginated → cite by chapter, page title or instrument
  (`IDIO Perfect Unison`, `HUG Brass Section`, `BERL The violin`).
- Read in full with no locator possible → cite by tag, and say why (`WP` is a web
  article; its 48 bare citations are correct, not a gap).
- Not read in full → cite by tag, phrase no more precisely than the evidence supports,
  and treat it as a debt (`MOD`, `FILM`, `OMT`).

**When a full text arrives, re-verify every existing claim against it before
upgrading the citations.** Both outcomes have happened and both must be expected:

- `BEL` — one of six claims was found unsupported and was rewritten.
- `IDIO` — all fourteen claims were confirmed, several word for word, so the citations
  were upgraded rather than rewritten.

A source that has been read in full may also be **split out of an umbrella tag**:
`HUG` and `ACTOR` were both extracted from `MOD` once their texts were supplied, which
narrows what `MOD` still stands for.

## Consequences

- A reader can see at a glance how much weight a claim carries. That is the whole
  point.
- `tests/audit-sources.lua` can report the project's evidential position as a number:
  currently 136 of 1,520 items (9%) rest on a source never read in full.
- **It creates a standing obligation.** Every arriving source means re-reading old
  claims, not just adding new ones. That is more work than appending, and it is where
  the errors get caught.
- A bare tag means two different things depending on the source, which is why the
  audit script separates `WP` from the genuinely unread ones.
- The audit script has itself been wrong twice — once counting `SIN ch.VIII` as a
  source called `VIII`, once treating title-based citations as bare. Regenerate the
  table rather than trusting a remembered figure.

## Enforcement

`tests/run.lua` fails on a bare `BEL`, `IDIO`, `HUG`, `BERL` or `ACTOR` tag, since all
five have been read in full. It also checks that every declared source is cited
somewhere and that none is missing from the Sources page. `tests/audit-sources.lua`
prints live coverage per tag.
