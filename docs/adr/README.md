# Architecture decision records

One file per decision that would be expensive to reverse, or that someone would
otherwise undo by accident because the reason is not visible in the code.

These are **not** a changelog. `docs/SESSION-LOG.md` is the narrative — what happened,
in order, with the bugs and the dead ends. An ADR answers a narrower question: *why is
it like this, and what did we give up?* If a decision could be reversed in an
afternoon with no consequences, it does not need a record.

## Format

Each record is `NNNN-short-title.md` and carries:

- **Status** — Accepted, Superseded by NNNN, or Reversed.
- **Date** — when the decision was taken, not when the file was written.
- **Context** — the forces in play. What made this a decision rather than a default.
- **Decision** — what was chosen, stated so it can be checked against the code.
- **Consequences** — what this costs, and what it rules out. The important half.
- **Enforcement** — how the codebase stops the decision being undone silently, where
  that is possible. Several of these are checked by `tests/run.lua`.

## The records

| | Decision | Status |
| --- | --- | --- |
| [0001](0001-gfx-only.md) | `gfx` only, no ReaImGui or extensions | Accepted |
| [0002](0002-data-separate-from-code.md) | Data files separate from the renderer | Accepted |
| [0003](0003-two-databases-merged-at-load.md) | Two databases, merged at load, composers optional | Accepted |
| [0004](0004-consensus-only.md) | Consensus only, with a "Use sparingly" escape hatch | Accepted |
| [0005](0005-citation-precision-per-source.md) | Cite at the precision the evidence supports | Accepted |
| [0006](0006-disagreement-is-content.md) | Record disagreement rather than resolving it | Accepted |
| [0007](0007-paraphrase-copyrighted-translations.md) | Paraphrase copyrighted translations of public-domain texts | Accepted |
| [0008](0008-frame-pipeline-order.md) | Body drawn before the opaque strips | Accepted |
| [0009](0009-scroll-clamping-in-one-place.md) | Scroll clamped only in `draw_body` | Accepted |
| [0010](0010-index-folds-closed-by-default.md) | Index folds, closed by default, persisted by name | Accepted |
| [0011](0011-shared-colour-scheme.md) | Colour scheme shared with Starting Blocks | Accepted |
| [0012](0012-headless-harness.md) | A headless harness instead of manual testing in REAPER | Accepted |
