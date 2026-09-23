# 0012. Test through a headless harness rather than by hand in REAPER

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The script only runs inside REAPER, which means the obvious testing loop is: edit,
switch to REAPER, re-run the action, look. That is slow, it cannot be automated, it
cannot be repeated identically, and it does not run in this environment at all.

Meanwhile the things most likely to break are not visual. Search ranking, scroll
clamping, data integrity across 1,520 cited items, and the interaction between a
keypress and a view change are all decidable without a screen.

## Decision

`tests/harness.lua` is a headless stand-in for the parts of `gfx` and `reaper` the
script uses. The script runs unmodified against it.

Two design choices carry most of the value:

- **A `false` in the key queue is a frame boundary.** Without it every queued key is
  consumed in one frame, which is precisely the condition that hides the scroll
  clamping bug of ADR 0009. The sentinel makes "one keypress per frame" expressible.
- **Every `drawstr` is recorded twice** — as a bare string in `drawn`, and with its
  pen position in `placed`. The positions let a "page" be reconstructed as text by
  sorting draws by `y` then `x`, and let a test *click* something: `gfx.rect` is a
  no-op here, so a drawn row leaves no other trace.

## Consequences

- 174 checks run in under a second, every time, with no REAPER.
- Nine bugs were found this way before the script was ever run for real, including
  four that a casual manual test would have missed.
- **The harness approximates font metrics** (character count × a size factor). It
  verifies structure and behaviour and says nothing about appearance. Every visual
  decision in this repo is therefore unverified, which is stated in `CLAUDE.md`, the
  README and ADR 0011.
- **The harness can be wrong, and has been.** It stubs `gfx.rect` as a no-op, so it
  cannot see overpainting — which is exactly what ADR 0008 depends on. Its own
  claims need checking: the session log records that §5 asserted `placed` existed
  before it did.
- Probing it has two standing traps: it records one entry per *wrapped line*, so a
  phrase spanning a line break will not be found by substring search; and section
  headers are drawn upper-cased.
- Adding a `gfx` call to the script means adding a stub, or the suite fails with a nil
  call rather than a useful message.

## Enforcement

Self-enforcing: the suite is the thing. The discipline that needs stating is the one
applied to the citation checks — **verify a new check fails** by deliberately breaking
what it guards, rather than trusting it because it passed. Both the bare-tag check and
the quotation-length check were confirmed that way.
