# 0013. The window's text follows Apple's writing guidelines

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The user asked for every one of their apps to follow Apple's Human Interface
Guidelines on writing (developer.apple.com/design/human-interface-guidelines/writing),
as Noterator and Miderator already do (Noterator's decision 0053). This window
had its own habits: header buttons in capitals (`SOURCES`, `INDEX`, `HELP`), a
placeholder ending in three full stops, help lines starting in lower case,
" - " for a dash, straight quotes, "caret" in the help, `Ctrl+Right` shown on a
Mac where the key is Command, and a load failure that began "Error:".

This is an encyclopaedia, so most of what is on screen is **content**: entry
summaries, item details and quoted sources. Those are not the window's words and
quoting a source exactly matters more than typography (ADR 0007 is the same
instinct about whose words they are).

## Decision

One style for each kind of text the window itself writes:

- **Buttons and page titles** in title-style capitals: **Help**, **Index**,
  **Sources**, "How to Use It", "Nothing Found for “…”", "A Note on the Reading".
- **Help lines, hints, the footer and the placeholder** in sentence case; full
  stops on complete sentences, none on fragments; no "…" on a placeholder.
- **Typography**: an em dash between phrases, an en dash in ranges, curly quotes
  and apostrophes. Section headings, fact keys and item labels in the data files
  are labels, so they take the same typography (`Formation — in pairs`,
  `’Cellos`, `Belkin’s verdict`); summaries, details and quoted text do not.
- **Keys are named the way the computer names them**: `KEYNAME` holds the Mac's
  symbols (⌘→, ⌥←, ↑ ↓, Return) when `GetOS` says macOS and words elsewhere
  (Ctrl+Right, Alt+Left, Enter). Ctrl in the code is Command on a Mac (CLAUDE.md).
- **"Cursor"**, not "caret", on screen. The code keeps `st.caret`.
- **The load-failure message** says what happened and what to do, with the Lua
  message under "Details:" for anyone asking for help. REAPER's message box
  chooses its own buttons, so only the text changed.

## Consequences

- Section headings are still drawn in capitals by `header()`; that is a type
  style, not the words, and "sparingly" detection is unchanged.
- Search is unaffected: `fold`/`foldw` strip every non-alphanumeric character, so
  a curly apostrophe folds exactly as a straight one did.
- Entry prose still holds " - " and straight quotes. Changing it is an editorial
  pass on content, not on the window, and is left for the user to ask for.
- The footer is a little longer; its separators were tightened to " · " so it
  fits about as before.

## Enforcement

`tests/run.lua`, section *Wording*: the header buttons read Help, Index and
Sources; keys appear in words off the Mac and as ⌘→ on a Mac (with no "Ctrl+");
and the index, help and no-result pages carry no "...", spaced hyphen or
straight double quote. All four failed against the old script before passing.
