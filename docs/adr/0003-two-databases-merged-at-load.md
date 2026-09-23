# 0003. Two databases, merged at load, with the composers file optional

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The composer entries arrived as a second request after the instrument and section
database was finished. They are a different kind of content — biographical and
interpretive rather than technical — and there were eventually 50 of them against the 70
the data file then held (73 today). Keeping everything in one file would have made a 6,000-line table; a hard
dependency on a second file would make the script fail for anyone who took only the
first.

## Decision

Both files `return { ENTRIES, SOURCES }`. The script loads
`orchestration_data.lua` and **requires** it, then loads
`orchestration_composers.lua` inside `pcall` and merges. The composers file is
optional and its absence is not an error.

Entry ids must be unique **across both files**.

## Consequences

- The script degrades rather than breaking if the composers file is missing or
  malformed. That is the point of the `pcall`.
- **The uniqueness constraint spans a file boundary the code does not enforce at
  authoring time.** Two people could add the same id in different files and each would
  be individually valid.
- Merging `SOURCES` needs a precedence rule. The first file wins; the composers file
  only contributes tags the first does not declare. That is why `FILM` is declared in
  the composers file and everything else in the data file.
- Splitting further — a third file per family, say — would work the same way, but each
  added `pcall` is another silent-failure path. Two is enough.

## Enforcement

`tests/run.lua` builds the merged set the same way the script does and checks for
duplicate ids across both files, plus that every `related` and `instruments` id
resolves against the merge rather than against either file alone.
