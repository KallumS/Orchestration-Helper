# 0015. The Mac app runs the unchanged script

- **Status:** Accepted
- **Date:** 2026-10-24

## Context

The user asked for Orchestration Helper as a native Mac app for Apple Silicon,
built by GitHub Actions. The program is a Lua script drawing with REAPER's
`gfx` API (ADR 0001), and its behaviour is pinned down by 219 checks run
through a headless stand-in for that API (ADR 0012).

A rewrite (Swift, SwiftUI) would have meant two programs to keep in step, a
second implementation of search ranking, scroll clamping and the HIG work, and
no test suite for the second one.

## Decision

The app is a small host for the script. `macos/host.c` implements the parts of
`gfx` and `reaper` the script uses (about twenty calls) around an embedded Lua
5.4, following REAPER's reference and, where that is silent,
`tests/harness.lua`. `macos/mac.m` is the Mac side: an `NSWindow`, a
CoreGraphics bitmap at the screen's density (so `gfx.ext_retina` is 2 on a
Retina screen, as in REAPER), CoreText for text in the system face, `NSMenu`
for `gfx.showmenu`, `NSUserDefaults` for ExtState, and a 30 Hz timer for
`reaper.defer`. The script and both databases are copied into the app bundle
as they are.

`macos/sim.c` is a backend with no window that runs the same core on Linux;
the workflow's test job types a search through it before the Mac job builds.

## Consequences

- One program. A change to the script or the data reaches REAPER and the app
  alike, and the suite covers both.
- The app looks like the ReaScript, not like a SwiftUI app: the window is drawn
  by the script, so there are no native controls, no VoiceOver for the page,
  and the menu bar has only what the script's own keys can do (Text Size, Paste
  into the search box, Help).
- It is not signed or notarised (no Apple developer account), so the first open
  needs Control-click → Open. Signing would need the account's certificate as
  repository secrets and a `codesign`/`notarytool` step.
- A new `gfx` call in the script needs a matching function in `host.c` (and, if
  it draws, in `backend.h`, `mac.m` and `sim.c`), or the app stops with a Lua
  error naming it.

## Enforcement

The workflow fails if the core cannot run the script to a search result and
save its settings on close (`test` job), or if the built app is not universal,
does not stay open, or does not quit cleanly (`app` job).
