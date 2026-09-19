--[[
  Orchestration Helper
  ====================
  A local, offline orchestration encyclopaedia for REAPER.

  Type the name of an instrument or a section and get the doublings, pairings
  and combinations that the standard orchestration literature agrees on -
  every item carrying a citation back to its source.

  Requires nothing but REAPER itself: no internet connection, no extensions,
  no SWS, no ReaImGui. Drawing uses REAPER's built-in gfx API.

  Keys
  ----
    type            search
    Up / Down       move through the matches
    Enter           open the highlighted match
    Esc             clear the box (again: back to the index)
    Backspace       delete; Left / Right move the caret
    Alt + Left      back
    mouse wheel     scroll
    PgUp / PgDn     scroll a page
    F1              help
]]--

------------------------------------------------------------------------------
-- BOOTSTRAP
------------------------------------------------------------------------------

local _, SCRIPT_FILE = reaper.get_action_context()
local SEP = package.config:sub(1, 1)
SCRIPT_FILE = tostring(SCRIPT_FILE or "")
local SCRIPT_DIR = SCRIPT_FILE:match("^(.*)[/\\]")
if not SCRIPT_DIR or SCRIPT_DIR == "" then
  -- Not launched from a file we can locate (unusual); fall back to the
  -- Scripts folder of the resource path.
  SCRIPT_DIR = reaper.GetResourcePath() .. SEP .. "Scripts"
end
local DATA_FILE = SCRIPT_DIR .. SEP .. "orchestration_data.lua"

local ok, DATA = pcall(dofile, DATA_FILE)
if not ok or type(DATA) ~= "table" or type(DATA.ENTRIES) ~= "table" then
  reaper.ShowMessageBox(
    "Orchestration Helper could not load its database.\n\n" ..
    "Expected to find:\n" .. DATA_FILE .. "\n\n" ..
    "Keep 'orchestration_data.lua' in the same folder as this script.\n\n" ..
    (type(DATA) == "string" and ("Error: " .. DATA) or ""),
    "Orchestration Helper", 0)
  return
end

local ENTRIES = DATA.ENTRIES
local SOURCES = DATA.SOURCES

------------------------------------------------------------------------------
-- INDEX
------------------------------------------------------------------------------

local BY_ID, KEYS = {}, {}

-- Fold a string down to bare lowercase letters and digits so that
-- "Cor Anglais", "cor-anglais" and "COR ANGLAIS!" all match.
local function fold(s)
  return (tostring(s):lower():gsub("[^%w]+", ""))
end
-- Same, but keep single spaces, for word-by-word matching.
local function foldw(s)
  local t = tostring(s):lower():gsub("[^%w]+", " ")
  return (t:gsub("^%s+", ""):gsub("%s+$", ""))
end

for i, en in ipairs(ENTRIES) do
  en.index = i
  BY_ID[en.id] = en
  local seen = {}
  -- pen(alty) keeps a family-name hit from beating an entry's own name: typing
  -- "strings" must land on the String Section, not on whichever instrument of
  -- that family happens to sort first.
  local function addkey(s, pen)
    local f = fold(s)
    if #f > 0 and not seen[f] then
      seen[f] = true
      KEYS[#KEYS + 1] = { key = f, words = foldw(s), entry = en, pen = pen or 0 }
    end
  end
  addkey(en.name)
  addkey(en.id)
  for _, a in ipairs(en.aliases or {}) do addkey(a) end
  -- The family name is searchable too ("brass", "woodwind" ...), but weakly.
  if en.family then addkey(en.family, 25) end

  -- Flattened prose, built once, so the fallback search over the body text
  -- costs nothing per keystroke.
  local parts = { foldw(en.summary or "") }
  for _, f in ipairs(en.facts or {}) do
    parts[#parts + 1] = foldw(f[1]) .. " " .. foldw(f[2])
  end
  for _, sec in ipairs(en.sec or {}) do
    parts[#parts + 1] = foldw(sec[1])
    for _, it in ipairs(sec[2]) do
      parts[#parts + 1] = foldw(it[1]) .. " " .. foldw(it[2] or "")
    end
  end
  en.haystack = table.concat(parts, " ")
end

-- Levenshtein distance, capped: we only care about "within 2 typos".
local function editdist(a, b, cap)
  local la, lb = #a, #b
  if math.abs(la - lb) > cap then return cap + 1 end
  local prev, cur = {}, {}
  for j = 0, lb do prev[j] = j end
  for i = 1, la do
    cur[0] = i
    local best = cur[0]
    local ca = a:byte(i)
    for j = 1, lb do
      local cost = (ca == b:byte(j)) and 0 or 1
      local v = math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      cur[j] = v
      if v < best then best = v end
    end
    if best > cap then return cap + 1 end
    prev, cur = cur, prev
  end
  return prev[lb]
end

-- Rank every entry against the query. Lower score = better.
local function search(query)
  local q = fold(query)
  local qw = foldw(query)
  if #q == 0 then return {} end

  local best = {}   -- entry.index -> score
  local function bid(en, score)
    local k = en.index
    if best[k] == nil or score < best[k] then best[k] = score end
  end

  for _, k in ipairs(KEYS) do
    local key, words, pen = k.key, k.words, k.pen
    if key == q then
      bid(k.entry, 0 + pen)                           -- exact
    elseif key:sub(1, #q) == q then
      bid(k.entry, 10 + pen + (#key - #q) / 100)      -- key starts with query
    elseif #key > 2 and q:sub(1, #key) == key and #key >= #q * 0.6 then
      -- query starts with the key, and the key is most of the query, so
      -- "bass" does not claim a query of "bassson"
      bid(k.entry, 24 + pen)
    elseif key:find(q, 1, true) then
      bid(k.entry, 30 + pen + (#key - #q) / 100)      -- key contains query
    else
      -- every query word appears somewhere in the key's words
      local all, n = true, 0
      for w in qw:gmatch("%S+") do
        n = n + 1
        if not words:find(w, 1, true) then all = false end
      end
      if all and n > 0 then
        bid(k.entry, 34 + pen)
      elseif #q >= 4 then
        local d = editdist(q, key, 2)                 -- typo tolerance
        if d <= 2 then bid(k.entry, 40 + pen + d) end
      end
    end
  end

  -- Last resort: look inside the prose, so "stopped horns" or "glissando"
  -- finds the entries that discuss it.
  if next(best) == nil and #q >= 4 then
    for _, en in ipairs(ENTRIES) do
      if en.haystack:find(qw, 1, true) then bid(en, 60) end
    end
  end

  local out = {}
  for idx, score in pairs(best) do out[#out + 1] = { e = ENTRIES[idx], s = score } end
  table.sort(out, function(a, b)
    if a.s ~= b.s then return a.s < b.s end
    return a.e.name < b.e.name
  end)
  local res = {}
  for i = 1, math.min(#out, 40) do res[i] = out[i].e end
  return res
end

------------------------------------------------------------------------------
-- THEME
------------------------------------------------------------------------------

local C = {
  bg      = { 0.106, 0.114, 0.129 },
  panel   = { 0.133, 0.145, 0.165 },
  panel2  = { 0.165, 0.180, 0.204 },
  line    = { 0.208, 0.224, 0.251 },
  text    = { 0.847, 0.863, 0.886 },
  dim     = { 0.545, 0.576, 0.612 },
  faint   = { 0.400, 0.427, 0.459 },
  title   = { 0.949, 0.957, 0.965 },
  accent  = { 0.878, 0.659, 0.416 },   -- amber: item labels
  accent2 = { 0.498, 0.698, 0.851 },   -- blue: section headers
  warn    = { 0.851, 0.545, 0.498 },   -- muted red: "use sparingly"
  sel     = { 0.196, 0.263, 0.333 },
}

local function setcol(c, a)
  gfx.set(c[1], c[2], c[3], a or 1)
end

local FONTFACE = (function()
  local os = reaper.GetOS() or ""
  if os:match("^Win") then return "Arial" end
  if os:match("OSX") or os:match("macOS") then return "Helvetica" end
  return "DejaVu Sans"
end)()

local F = { TITLE = 1, HEAD = 2, LABEL = 3, BODY = 4, SMALL = 5, INPUT = 6, SUB = 7 }
local SCALE = 1

local function initfonts()
  local s = SCALE
  gfx.setfont(F.TITLE, FONTFACE, math.floor(21 * s), string.byte("b"))
  gfx.setfont(F.HEAD,  FONTFACE, math.floor(12 * s), string.byte("b"))
  gfx.setfont(F.LABEL, FONTFACE, math.floor(14 * s), string.byte("b"))
  gfx.setfont(F.BODY,  FONTFACE, math.floor(14 * s))
  gfx.setfont(F.SMALL, FONTFACE, math.floor(11 * s))
  gfx.setfont(F.INPUT, FONTFACE, math.floor(17 * s))
  gfx.setfont(F.SUB,   FONTFACE, math.floor(13 * s))
  gfx.setfont(F.BODY)
end

local function S(n) return math.floor(n * SCALE + 0.5) end

------------------------------------------------------------------------------
-- STATE
------------------------------------------------------------------------------

local EXT = "OrchestrationHelper"

local st = {
  query    = "",
  caret    = 0,
  sugg     = {},
  sel      = 1,
  entry    = nil,
  view     = "index",      -- "index" | "entry" | "help" | "sources"
  scroll   = 0,
  maxscroll= 0,
  history  = {},
  dirty    = true,
  laidout_w= -1,
  rows     = {},
  hot      = {},
  blink    = 0,
}

local function go(view, entry, remember)
  if remember and st.view == "entry" and st.entry then
    st.history[#st.history + 1] = st.entry.id
    if #st.history > 60 then table.remove(st.history, 1) end
  end
  st.view = view
  st.entry = entry
  st.scroll = 0
  st.dirty = true
end

local function openid(id)
  local en = BY_ID[id]
  if en then go("entry", en, true) end
end

local function back()
  local id = table.remove(st.history)
  if id and BY_ID[id] then
    st.view, st.entry, st.scroll, st.dirty = "entry", BY_ID[id], 0, true
  else
    st.query, st.caret, st.sugg, st.sel = "", 0, {}, 1
    go("index", nil, false)
  end
end

local function requery()
  st.sugg = search(st.query)
  st.sel = 1
  if #st.sugg > 0 then
    st.view, st.entry = "entry", st.sugg[1]
  elseif st.query == "" then
    st.view, st.entry = "index", nil
  else
    st.view, st.entry = "noresult", nil
  end
  st.scroll = 0
  st.dirty = true
end

------------------------------------------------------------------------------
-- LAYOUT
------------------------------------------------------------------------------

local rows        -- being built
local function row(t) rows[#rows + 1] = t end

local function textw(s) return (gfx.measurestr(s)) end

-- Break a string into lines that fit maxw with the current font.
local function wrap(s, maxw)
  local out = {}
  s = tostring(s or "")
  if s == "" then return { "" } end
  local cur = ""
  for word in s:gmatch("%S+") do
    -- a single word wider than the column has to be split
    while textw(word) > maxw and #word > 1 do
      local cut = #word
      while cut > 1 and textw(word:sub(1, cut)) > maxw do cut = cut - 1 end
      if cur ~= "" then out[#out + 1] = cur; cur = "" end
      out[#out + 1] = word:sub(1, cut)
      word = word:sub(cut + 1)
    end
    local try = (cur == "") and word or (cur .. " " .. word)
    if textw(try) <= maxw or cur == "" then
      cur = try
    else
      out[#out + 1] = cur
      cur = word
    end
  end
  if cur ~= "" then out[#out + 1] = cur end
  if #out == 0 then out[1] = "" end
  return out
end

-- Emit wrapped text as a run of rows.
local function para(s, font, col, x, maxw, cite)
  gfx.setfont(font)
  local lh = gfx.texth + S(3)
  local lines = wrap(s, maxw)
  for i, ln in ipairs(lines) do
    row{ t = "text", s = ln, f = font, c = col, x = x, h = lh,
         cite = (i == 1) and cite or nil }
  end
end

local function gap(h) row{ t = "gap", h = S(h) } end
local function rule(pad)
  row{ t = "rule", h = S(pad or 12) }
end

-- Chip rows: clickable pills that navigate to another entry.
local function chips(list, x, maxw, label)
  if #list == 0 then return end
  gfx.setfont(F.SMALL)
  local ch = gfx.texth + S(8)
  local padx = S(9)
  local gapx = S(6)
  local cx, line = x, {}
  local function flush()
    if #line > 0 then
      row{ t = "chips", h = ch + S(6), items = line }
      line = {}
      cx = x
    end
  end
  for _, c in ipairs(list) do
    local w = textw(c.label) + padx * 2
    if cx + w > x + maxw and #line > 0 then flush() end
    line[#line + 1] = { label = c.label, id = c.id, x = cx, w = w, h = ch }
    cx = cx + w + gapx
  end
  flush()
end

local function header(s, maxw, x)
  gap(14)
  gfx.setfont(F.HEAD)
  local col = s:lower():find("sparingly") and C.warn or C.accent2
  row{ t = "text", s = s:upper(), f = F.HEAD, c = col, x = x, h = gfx.texth + S(4) }
  row{ t = "hrule", h = S(7), x = x, w = maxw, c = col }
end

-- Build the row list for whatever the current view is.
local function layout(w)
  rows = {}
  local PAD = S(20)
  local x = PAD
  local maxw = w - PAD * 2
  if maxw < S(120) then maxw = S(120) end

  if st.view == "index" then
    para("Orchestration Helper", F.TITLE, C.title, x, maxw)
    gap(2)
    para("Type an instrument or a section in the box above - \"trombone\", " ..
         "\"string section\", \"cor anglais\", \"percussion\" - and you get the " ..
         "doublings and pairings that the standard literature agrees on. " ..
         "Everything is stored locally; nothing is ever fetched from the internet.",
         F.BODY, C.dim, x, maxw)
    gap(6)
    para("Press F1 for the keys, or click a name below.", F.SMALL, C.faint, x, maxw)

    local fams, order = {}, {}
    for _, en in ipairs(ENTRIES) do
      local f = en.family or "Other"
      if not fams[f] then fams[f] = {}; order[#order + 1] = f end
      local list = fams[f]
      list[#list + 1] = en
    end
    local rank = { Strings = 1, Woodwind = 2, Brass = 3, Percussion = 4,
                   Plucked = 5, Voices = 6, Combining = 7, Reference = 8 }
    table.sort(order, function(a, b)
      return (rank[a] or 50) < (rank[b] or 50)
    end)
    for _, f in ipairs(order) do
      header(f, maxw, x)
      local list = {}
      table.sort(fams[f], function(a, b) return a.name < b.name end)
      for _, en in ipairs(fams[f]) do
        list[#list + 1] = { label = en.name, id = en.id }
      end
      chips(list, x, maxw)
    end
    gap(10)
    rule(6)
    para(("%d entries. Sources: click SOURCES in the header."):format(#ENTRIES),
         F.SMALL, C.faint, x, maxw)
    gap(16)

  elseif st.view == "noresult" then
    para("Nothing found for \"" .. st.query .. "\"", F.TITLE, C.title, x, maxw)
    gap(4)
    para("Try a plainer word - \"horn\", \"strings\", \"timpani\" - or clear the " ..
         "box with Esc to see the whole index. Spelling is forgiving, but the " ..
         "encyclopaedia only covers the orchestra.", F.BODY, C.dim, x, maxw)
    gap(16)

  elseif st.view == "help" then
    para("How to use it", F.TITLE, C.title, x, maxw)
    gap(6)
    local keys = {
      { "type", "search as you type; the best match is shown straight away" },
      { "Up / Down", "move through the other matches" },
      { "Enter", "keep the highlighted match and close the match list" },
      { "Esc", "clear the box; press again for the index" },
      { "Left / Right", "move the caret;  Backspace / Delete to edit" },
      { "Alt + Left", "back to the previous entry" },
      { "wheel, PgUp / PgDn", "scroll" },
      { "F1", "this page" },
      { "click", "any name or chip opens that entry" },
    }
    for _, k in ipairs(keys) do
      gfx.setfont(F.LABEL)
      local kw = S(150)
      row{ t = "text", s = k[1], f = F.LABEL, c = C.accent, x = x, h = gfx.texth + S(3) }
      para(k[2], F.BODY, C.text, x + kw, maxw - kw)
      gap(2)
    end
    header("What is in here", maxw, x)
    para("Doublings and pairings in unison, in octaves, in thirds and sixths, and " ..
         "in harmony; section rosters and how they divide; relative strengths for " ..
         "balancing a doubling; and the blend bridges between the groups.",
         F.BODY, C.text, x, maxw)
    gap(8)
    para("Rare combinations are deliberately kept out of the suggestion lists. " ..
         "Where a source explicitly warns against something, or calls it rare, it " ..
         "appears under \"Use sparingly\" instead - so the advice stays honest " ..
         "without recommending what nobody writes.", F.BODY, C.text, x, maxw)
    header("Citations", maxw, x)
    para("Every item is tagged with the work and page it comes from. The tags are " ..
         "spelled out on the SOURCES page.", F.BODY, C.text, x, maxw)
    gap(16)

  elseif st.view == "sources" then
    para("Sources", F.TITLE, C.title, x, maxw)
    gap(4)
    para("Every statement in this encyclopaedia is drawn from the works below and " ..
         "tagged with the page it came from.", F.BODY, C.dim, x, maxw)
    local order = { "RK", "SIN", "WP", "BEL", "OMT", "IDIO", "MOD" }
    for _, tag in ipairs(order) do
      local s = SOURCES[tag]
      if s then
        header(s.tag .. "  -  " .. s.short, maxw, x)
        para(s.full, F.BODY, C.text, x, maxw)
      end
    end
    header("A note on the reading", maxw, x)
    para("Rimsky-Korsakov and Singleton are quoted directly and cited by page. " ..
         "Berlioz, Lavignac, Gevaert, Stone and Forsyth appear as Singleton quotes " ..
         "them, and are named in the text where that is the case. The present-day " ..
         "references were consulted to check that the historical advice still holds " ..
         "and to supply modern section sizes; they are cited by tag rather than page.",
         F.BODY, C.text, x, maxw)
    gap(16)

  elseif st.view == "entry" and st.entry then
    local en = st.entry
    para(en.name, F.TITLE, C.title, x, maxw)
    gfx.setfont(F.SMALL)
    row{ t = "text", s = ((en.family or "") .. "  ·  " .. (en.kind or "")):upper(),
         f = F.SMALL, c = C.faint, x = x, h = gfx.texth + S(8) }
    if en.summary then
      para(en.summary, F.BODY, C.text, x, maxw)
    end
    if en.facts and #en.facts > 0 then
      gap(10)
      local kw = math.min(S(170), math.floor(maxw * 0.34))
      for _, f in ipairs(en.facts) do
        gfx.setfont(F.SMALL)
        local klines = wrap(f[1]:upper(), kw - S(12))
        gfx.setfont(F.SUB)
        local lh = gfx.texth + S(3)
        local vlines = wrap(f[2], maxw - kw)
        for i = 1, math.max(#klines, #vlines) do
          row{ t = "kv", key = klines[i], val = vlines[i],
               keyx = x, valx = x + kw, h = lh }
        end
        gap(5)
      end
    end

    for _, sec in ipairs(en.sec or {}) do
      header(sec[1], maxw, x)
      for _, it in ipairs(sec[2]) do
        local label, detail, cite = it[1], it[2], it[3]
        local citew = 0
        if cite and cite ~= "" then
          gfx.setfont(F.SMALL)
          citew = textw(cite) + S(14)
        end
        para(label, F.LABEL, C.accent, x, maxw - citew, cite)
        if detail and detail ~= "" then
          para(detail, F.BODY, C.text, x + S(14), maxw - S(14))
        end
        gap(9)
      end
    end

    if en.related and #en.related > 0 then
      header("See also", maxw, x)
      local list = {}
      for _, id in ipairs(en.related) do
        local r = BY_ID[id]
        if r then list[#list + 1] = { label = r.name, id = r.id } end
      end
      chips(list, x, maxw)
    end
    gap(20)
  end

  -- resolve y positions
  local y = 0
  for _, r in ipairs(rows) do
    r.y = y
    y = y + (r.h or 0)
  end
  st.rows = rows
  st.content_h = y
end

------------------------------------------------------------------------------
-- DRAW
------------------------------------------------------------------------------

-- gfx.mouse_cap is a bitfield. Test it arithmetically so the script runs on
-- every Lua version REAPER has shipped.
local function cap(bit)
  return (gfx.mouse_cap % (bit * 2)) >= bit
end
local function inrect(x, y, w, h)
  return gfx.mouse_x >= x and gfx.mouse_x <= x + w
     and gfx.mouse_y >= y and gfx.mouse_y <= y + h
end
local function hot(x, y, w, h, action)
  st.hot[#st.hot + 1] = { x = x, y = y, w = w, h = h, action = action }
end

-- Work out the whole top strip - header bar, search box, match chips - and
-- return its geometry. Nothing is drawn yet: the body needs to know how tall
-- this is, and the body is drawn first so that the strip can paint over it.
local function top_geometry()
  local w = gfx.w
  local g = { pad = S(20) }

  gfx.setfont(F.SMALL)
  g.btn_h = S(22)
  g.header_h = g.btn_h + S(14)

  gfx.setfont(F.INPUT)
  g.search_h = gfx.texth + S(14)
  g.search_y = g.header_h + S(10)
  g.search_x = g.pad
  g.search_w = w - g.pad * 2

  local y = g.search_y + g.search_h + S(10)

  -- match chips, laid out over at most two rows
  g.chips = {}
  g.more = nil
  if #st.sugg >= 2 then
    gfx.setfont(F.SMALL)
    local ch = gfx.texth + S(9)
    local x0, maxw = g.pad, w - g.pad * 2
    local cx, line, drawn = x0, 1, 0
    for i, en in ipairs(st.sugg) do
      local cw = textw(en.name) + S(18)
      if cx + cw > x0 + maxw and drawn > 0 then
        if line >= 2 then
          g.more = { s = ("+%d more"):format(#st.sugg - drawn), x = cx, y = y }
          break
        end
        line = line + 1
        cx = x0
        y = y + ch + S(5)
      end
      g.chips[#g.chips + 1] =
        { label = en.name, x = cx, y = y, w = cw, h = ch, i = i, entry = en }
      cx = cx + cw + S(5)
      drawn = drawn + 1
    end
    y = y + ch + S(8)
  end

  g.top_h = y

  gfx.setfont(F.SMALL)
  g.footer_h = gfx.texth + S(8)
  return g
end

local function button(label, bx, by, bw, bh, on, action)
  local over = inrect(bx, by, bw, bh)
  setcol(over and C.panel2 or C.panel)
  gfx.rect(bx, by, bw, bh, 1)
  setcol(on and C.accent or (over and C.text or C.dim))
  gfx.setfont(F.SMALL)
  gfx.x, gfx.y = bx, by + math.floor((bh - gfx.texth) / 2)
  gfx.drawstr(label, 1, bx + bw, by + bh)
  hot(bx, by, bw, bh, action)
end

local function draw_top(g)
  local w = gfx.w

  -- opaque backdrop, so body text scrolled up here is covered
  setcol(C.bg)
  gfx.rect(0, 0, w, g.top_h, 1)

  -- header bar
  setcol(C.panel)
  gfx.rect(0, 0, w, g.header_h, 1)
  setcol(C.line)
  gfx.rect(0, g.header_h - 1, w, 1, 1)

  local by = S(7)
  local bx = S(8)
  button("<", bx, by, S(34), g.btn_h, false, back)

  gfx.setfont(F.HEAD)
  setcol(C.dim)
  gfx.x, gfx.y = bx + S(34) + S(8), by + math.floor((g.btn_h - gfx.texth) / 2)
  gfx.drawstr("ORCHESTRATION HELPER", 0, w - S(230), by + g.btn_h)

  gfx.setfont(F.SMALL)
  local w3 = textw("SOURCES") + S(18)
  local w2 = textw("INDEX") + S(18)
  local w1 = textw("HELP") + S(18)
  local rx = w - S(8) - w3
  button("SOURCES", rx, by, w3, g.btn_h, st.view == "sources",
         function() go("sources", nil, true) end)
  rx = rx - S(6) - w2
  button("INDEX", rx, by, w2, g.btn_h, st.view == "index", function()
    st.query, st.caret, st.sugg, st.sel = "", 0, {}, 1
    go("index", nil, true)
  end)
  rx = rx - S(6) - w1
  button("HELP", rx, by, w1, g.btn_h, st.view == "help",
         function() go("help", nil, true) end)

  -- search box
  local sx, sy, sw, sh = g.search_x, g.search_y, g.search_w, g.search_h
  setcol(C.panel2)
  gfx.rect(sx, sy, sw, sh, 1)
  setcol(C.line)
  gfx.rect(sx, sy, sw, sh, 0)

  gfx.setfont(F.INPUT)
  local tx = sx + S(12)
  local ty = sy + math.floor((sh - gfx.texth) / 2)
  if st.query == "" then
    setcol(C.faint)
    gfx.x, gfx.y = tx, ty
    gfx.drawstr("Search an instrument or section...", 0, sx + sw - S(100), sy + sh)
  else
    setcol(C.text)
    gfx.x, gfx.y = tx, ty
    gfx.drawstr(st.query, 0, sx + sw - S(100), sy + sh)
  end

  st.blink = st.blink + 1
  if (st.blink % 64) < 40 then
    local cx = tx + textw(st.query:sub(1, st.caret))
    setcol(C.accent)
    gfx.rect(cx, ty, math.max(1, S(1)), gfx.texth, 1)
  end

  if #st.sugg > 0 then
    gfx.setfont(F.SMALL)
    setcol(C.faint)
    local s = (#st.sugg == 1) and "1 match" or (#st.sugg .. " matches")
    gfx.x = sx + sw - S(12) - textw(s)
    gfx.y = sy + math.floor((sh - gfx.texth) / 2)
    gfx.drawstr(s)
  end
  hot(sx, sy, sw, sh, function() st.caret = #st.query end)

  -- match chips
  gfx.setfont(F.SMALL)
  for _, c in ipairs(g.chips) do
    local sel = (c.i == st.sel)
    setcol(sel and C.sel or C.panel)
    gfx.rect(c.x, c.y, c.w, c.h, 1)
    if sel then
      setcol(C.accent)
      gfx.rect(c.x, c.y, c.w, c.h, 0)
    end
    setcol(sel and C.title or C.dim)
    gfx.x, gfx.y = c.x, c.y + math.floor((c.h - gfx.texth) / 2)
    gfx.drawstr(c.label, 1, c.x + c.w, c.y + c.h)
    hot(c.x, c.y, c.w, c.h, function()
      st.sel = c.i
      st.view, st.entry, st.scroll, st.dirty = "entry", c.entry, 0, true
    end)
  end
  if g.more then
    setcol(C.faint)
    gfx.setfont(F.SMALL)
    gfx.x, gfx.y = g.more.x, g.more.y + S(4)
    gfx.drawstr(g.more.s)
  end
end

local function draw_body(top, bottom)
  local w = gfx.w
  local viewh = bottom - top
  if viewh < S(40) then return end

  if st.dirty or st.laidout_w ~= w then
    layout(w)
    st.laidout_w = w
    st.dirty = false
  end

  st.maxscroll = math.max(0, st.content_h - viewh + S(10))
  if st.scroll > st.maxscroll then st.scroll = st.maxscroll end
  if st.scroll < 0 then st.scroll = 0 end

  for _, r in ipairs(st.rows) do
    local y = top + r.y - st.scroll
    local rh = r.h or 0
    if y + rh >= -S(40) and y <= bottom + S(40) then
      if r.t == "text" then
        gfx.setfont(r.f)
        setcol(r.c)
        gfx.x, gfx.y = r.x, y
        gfx.drawstr(r.s, 256)
        if r.cite then
          gfx.setfont(F.SMALL)
          setcol(C.faint)
          gfx.x, gfx.y = w - S(20) - textw(r.cite), y + S(3)
          gfx.drawstr(r.cite, 256)
        end
      elseif r.t == "kv" then
        if r.key then
          gfx.setfont(F.SMALL)
          setcol(C.faint)
          gfx.x, gfx.y = r.keyx, y + S(2)
          gfx.drawstr(r.key, 256)
        end
        if r.val then
          gfx.setfont(F.SUB)
          setcol(C.text)
          gfx.x, gfx.y = r.valx, y
          gfx.drawstr(r.val, 256)
        end
      elseif r.t == "hrule" then
        setcol(r.c, 0.28)
        gfx.rect(r.x, y + S(2), r.w, 1, 1)
      elseif r.t == "rule" then
        setcol(C.line)
        gfx.rect(S(20), y + math.floor(rh / 2), w - S(40), 1, 1)
      elseif r.t == "chips" then
        gfx.setfont(F.SMALL)
        for _, c in ipairs(r.items) do
          local visible = (y >= top and y + c.h <= bottom)
          local over = visible and inrect(c.x, y, c.w, c.h)
          setcol(over and C.sel or C.panel)
          gfx.rect(c.x, y, c.w, c.h, 1)
          setcol(over and C.title or C.accent2)
          gfx.x, gfx.y = c.x, y + math.floor((c.h - gfx.texth) / 2)
          gfx.drawstr(c.label, 1, c.x + c.w, y + c.h)
          if visible then
            hot(c.x, y, c.w, c.h, function() openid(c.id) end)
          end
        end
      end
    end
  end

  if st.maxscroll > 0 then
    local tx = w - S(6)
    setcol(C.panel)
    gfx.rect(tx, top, S(4), viewh, 1)
    local knobh = math.max(S(30),
      math.floor(viewh * (viewh / (st.content_h + S(10)))))
    local knoby = top + math.floor((viewh - knobh) * (st.scroll / st.maxscroll))
    setcol(C.faint)
    gfx.rect(tx, knoby, S(4), knobh, 1)
  end
end

local function draw_footer(g)
  local y = gfx.h - g.footer_h
  setcol(C.panel)
  gfx.rect(0, y, gfx.w, g.footer_h, 1)
  setcol(C.line)
  gfx.rect(0, y, gfx.w, 1, 1)
  setcol(C.faint)
  gfx.setfont(F.SMALL)
  gfx.x, gfx.y = S(20), y + S(4)
  gfx.drawstr("Up/Down matches   Enter open   Esc clear   Alt+Left back   " ..
              "F1 help   -   works offline", 256)
end

------------------------------------------------------------------------------
-- INPUT
------------------------------------------------------------------------------

-- REAPER returns the named keys as multi-byte values; pack the names to match.
local function K(s)
  local v = 0
  for i = 1, #s do v = v * 256 + s:byte(i) end
  return v
end
local KEY = {
  up = K("up"), down = K("down"), left = K("left"), right = K("rght"),
  pgup = K("pgup"), pgdn = K("pgdn"), home = K("home"), fin = K("end"),
  del = K("del"), f1 = K("f1"),
}

local mouse_was_down = false

local function handle_mouse()
  local down = cap(1)
  if down and not mouse_was_down then
    -- last hotspot registered is the topmost one, so walk backwards
    for i = #st.hot, 1, -1 do
      local hs = st.hot[i]
      if inrect(hs.x, hs.y, hs.w, hs.h) then
        hs.action()
        break
      end
    end
  end
  mouse_was_down = down

  if gfx.mouse_wheel ~= 0 then
    st.scroll = st.scroll - (gfx.mouse_wheel / 120) * S(64)
    gfx.mouse_wheel = 0
  end
end

local function clear_query()
  st.query, st.caret, st.sugg, st.sel = "", 0, {}, 1
end

local function insert(s)
  st.query = st.query:sub(1, st.caret) .. s .. st.query:sub(st.caret + 1)
  st.caret = st.caret + #s
  requery()
end

-- Returns false once the window has been closed.
local function handle_keys()
  while true do
    local c = gfx.getchar()
    if c == -1 then return false end
    if c == 0 then return true end

    local ctrl = cap(4)
    local alt  = cap(16)

    if c == 27 then                                    -- Esc
      if st.query ~= "" then
        clear_query()
        requery()
      else
        clear_query()
        go("index", nil, false)
      end
    elseif c == 13 then                                -- Enter
      if #st.sugg > 0 then
        local en = st.sugg[st.sel]
        st.sugg, st.sel = { en }, 1
        st.view, st.entry, st.scroll, st.dirty = "entry", en, 0, true
      end
    elseif c == 8 then                                 -- Backspace
      if st.caret > 0 then
        st.query = st.query:sub(1, st.caret - 1) .. st.query:sub(st.caret + 1)
        st.caret = st.caret - 1
        requery()
      end
    elseif c == KEY.del then
      if st.caret < #st.query then
        st.query = st.query:sub(1, st.caret) .. st.query:sub(st.caret + 2)
        requery()
      end
    elseif c == KEY.left then
      if alt then back()
      elseif st.caret > 0 then st.caret = st.caret - 1 end
    elseif c == KEY.right then
      if st.caret < #st.query then st.caret = st.caret + 1 end
    elseif c == KEY.home then
      if ctrl then st.scroll = 0 else st.caret = 0 end
    elseif c == KEY.fin then
      if ctrl then st.scroll = math.huge else st.caret = #st.query end
    elseif c == KEY.up then
      if #st.sugg > 1 then
        st.sel = (st.sel - 2) % #st.sugg + 1
        st.view, st.entry, st.scroll, st.dirty = "entry", st.sugg[st.sel], 0, true
      else
        st.scroll = st.scroll - S(48)
      end
    elseif c == KEY.down then
      if #st.sugg > 1 then
        st.sel = st.sel % #st.sugg + 1
        st.view, st.entry, st.scroll, st.dirty = "entry", st.sugg[st.sel], 0, true
      else
        st.scroll = st.scroll + S(48)
      end
    elseif c == KEY.pgup then
      st.scroll = st.scroll - math.max(S(80), gfx.h - S(160))
    elseif c == KEY.pgdn then
      st.scroll = st.scroll + math.max(S(80), gfx.h - S(160))
    elseif c == KEY.f1 then
      go("help", nil, true)
    elseif c >= 32 and c <= 126 then
      insert(string.char(c))
    end
  end
end

------------------------------------------------------------------------------
-- WINDOW
------------------------------------------------------------------------------

local function num(s, dflt)
  return tonumber(s) or dflt
end

local win_w = math.max(460, num(reaper.GetExtState(EXT, "w"), 760))
local win_h = math.max(360, num(reaper.GetExtState(EXT, "h"), 680))
local win_x = num(reaper.GetExtState(EXT, "x"), 150)
local win_y = num(reaper.GetExtState(EXT, "y"), 110)
local win_d = num(reaper.GetExtState(EXT, "dock"), 0)

gfx.ext_retina = 1
gfx.init("Orchestration Helper", win_w, win_h, win_d, win_x, win_y)
if gfx.ext_retina and gfx.ext_retina > 1 then SCALE = gfx.ext_retina end
initfonts()

reaper.atexit(function()
  local d, wx, wy, ww, wh = gfx.dock(-1, 0, 0, 0, 0)
  reaper.SetExtState(EXT, "dock", tostring(d or 0), true)
  if ww and ww > 100 and wh and wh > 100 then
    reaper.SetExtState(EXT, "w", tostring(math.floor(ww)), true)
    reaper.SetExtState(EXT, "h", tostring(math.floor(wh)), true)
    reaper.SetExtState(EXT, "x", tostring(math.floor(wx)), true)
    reaper.SetExtState(EXT, "y", tostring(math.floor(wy)), true)
  end
  gfx.quit()
end)

requery()

local last_retina = gfx.ext_retina

local function loop()
  if not handle_keys() then return end

  -- follow the window between displays of different pixel density
  if gfx.ext_retina and gfx.ext_retina ~= last_retina then
    last_retina = gfx.ext_retina
    SCALE = (gfx.ext_retina > 1) and gfx.ext_retina or 1
    initfonts()
    st.dirty = true
  end

  gfx.clear = math.floor(C.bg[1] * 255)
            + math.floor(C.bg[2] * 255) * 256
            + math.floor(C.bg[3] * 255) * 65536

  st.hot = {}
  local g = top_geometry()
  -- body first, then the opaque header strip and footer paint over it
  draw_body(g.top_h, gfx.h - g.footer_h)
  draw_top(g)
  draw_footer(g)

  handle_mouse()
  gfx.update()
  reaper.defer(loop)
end

loop()
