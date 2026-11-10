/* Orchestration Helper - built by ableton/kit/build.py from ableton/device.json. Do not edit; edit the sources and rebuild. */
var DEVICE = {"main": "Orchestration Helper.lua", "size": [760, 680], "title": "Orchestration Helper"};
DEVICE.files = {"Orchestration Helper.lua": "--[[\n  Orchestration Helper\n  ====================\n  A local, offline orchestration encyclopaedia for REAPER.\n\n  Type the name of an instrument, a section or a composer and get the doublings,\n  pairings and combinations that the standard orchestration literature agrees on\n  - every item carrying a citation back to its source.\n\n  Reads two databases from its own folder: orchestration_data.lua (instruments,\n  sections, cross-group topics) and orchestration_composers.lua (composers,\n  optional).\n\n  Requires nothing but REAPER itself: no internet connection, no extensions,\n  no SWS, no ReaImGui. Drawing uses REAPER's built-in gfx API.\n\n  Keys\n  ----\n    type            search\n    Up / Down       move through the matches\n    Enter           open the highlighted match\n    Esc             clear the box (again: back to the index)\n    Backspace       delete; Left / Right move the caret\n    Alt + Left      back\n    mouse wheel     scroll\n    PgUp / PgDn     scroll a page\n    F1              help\n    Tab / Shift+Tab move between buttons, families and names (Return or\n                    Space presses the one ringed)\n    Ctrl + = / - / 0  text bigger, smaller, back to 100% (Cmd on a Mac)\n]]--\n\n------------------------------------------------------------------------------\n-- BOOTSTRAP\n------------------------------------------------------------------------------\n\nlocal _, SCRIPT_FILE = reaper.get_action_context()\nlocal SEP = package.config:sub(1, 1)\nSCRIPT_FILE = tostring(SCRIPT_FILE or \"\")\nlocal SCRIPT_DIR = SCRIPT_FILE:match(\"^(.*)[/\\\\]\")\nif not SCRIPT_DIR or SCRIPT_DIR == \"\" then\n  -- Not launched from a file we can locate (unusual); fall back to the\n  -- Scripts folder of the resource path.\n  SCRIPT_DIR = reaper.GetResourcePath() .. SEP .. \"Scripts\"\nend\nlocal DATA_FILE = SCRIPT_DIR .. SEP .. \"orchestration_data.lua\"\n\nlocal ok, DATA = pcall(dofile, DATA_FILE)\nif not ok or type(DATA) ~= \"table\" or type(DATA.ENTRIES) ~= \"table\" then\n  reaper.ShowMessageBox(\n    \"Orchestration Helper couldn\u00e2\u0080\u0099t load its database.\\n\\n\" ..\n    \"Put \u00e2\u0080\u009corchestration_data.lua\u00e2\u0080\u009d in the same folder as the script, then run \" ..\n    \"it again. It should be here:\\n\" .. DATA_FILE .. \"\\n\\n\" ..\n    (type(DATA) == \"string\" and (\"Details: \" .. DATA) or \"\"),\n    \"Orchestration Helper\", 0)\n  return\nend\n\nlocal ENTRIES = DATA.ENTRIES\nlocal SOURCES = DATA.SOURCES\n\n-- Optional second database: composers. The script works without it.\ndo\n  local extra_file = SCRIPT_DIR .. SEP .. \"orchestration_composers.lua\"\n  local ok2, EXTRA = pcall(dofile, extra_file)\n  if ok2 and type(EXTRA) == \"table\" then\n    for _, en in ipairs(EXTRA.ENTRIES or {}) do ENTRIES[#ENTRIES + 1] = en end\n    for tag, src in pairs(EXTRA.SOURCES or {}) do\n      if SOURCES[tag] == nil then SOURCES[tag] = src end\n    end\n  end\nend\n\n------------------------------------------------------------------------------\n-- INDEX\n------------------------------------------------------------------------------\n\nlocal BY_ID, KEYS = {}, {}\n\n-- Fold a string down to bare lowercase letters and digits so that\n-- \"Cor Anglais\", \"cor-anglais\" and \"COR ANGLAIS!\" all match.\nlocal function fold(s)\n  return (tostring(s):lower():gsub(\"[^%w]+\", \"\"))\nend\n-- Same, but keep single spaces, for word-by-word matching.\nlocal function foldw(s)\n  local t = tostring(s):lower():gsub(\"[^%w]+\", \" \")\n  return (t:gsub(\"^%s+\", \"\"):gsub(\"%s+$\", \"\"))\nend\n\nfor i, en in ipairs(ENTRIES) do\n  en.index = i\n  BY_ID[en.id] = en\n  local seen = {}\n  -- pen(alty) keeps a family-name hit from beating an entry's own name: typing\n  -- \"strings\" must land on the String Section, not on whichever instrument of\n  -- that family happens to sort first.\n  local function addkey(s, pen)\n    local f = fold(s)\n    if #f > 0 and not seen[f] then\n      seen[f] = true\n      KEYS[#KEYS + 1] = { key = f, words = foldw(s), entry = en, pen = pen or 0 }\n    end\n  end\n  addkey(en.name)\n  addkey(en.id)\n  for _, a in ipairs(en.aliases or {}) do addkey(a) end\n  -- The family name is searchable too (\"brass\", \"woodwind\" ...), but weakly.\n  if en.family then addkey(en.family, 25) end\n\n  -- Flattened prose, built once, so the fallback search over the body text\n  -- costs nothing per keystroke.\n  local parts = { foldw(en.summary or \"\") }\n  for _, f in ipairs(en.facts or {}) do\n    parts[#parts + 1] = foldw(f[1]) .. \" \" .. foldw(f[2])\n  end\n  for _, sec in ipairs(en.sec or {}) do\n    parts[#parts + 1] = foldw(sec[1])\n    for _, it in ipairs(sec[2]) do\n      parts[#parts + 1] = foldw(it[1]) .. \" \" .. foldw(it[2] or \"\")\n    end\n  end\n  en.haystack = table.concat(parts, \" \")\nend\n\n-- Composer entries name the instruments they are known for; turn that round so\n-- each instrument page can list the composers worth studying for it. Doing it\n-- here means the association is written once, in the composer entry.\nfor _, en in ipairs(ENTRIES) do\n  for _, iid in ipairs(en.instruments or {}) do\n    local target = BY_ID[iid]\n    if target and target ~= en then\n      target.composers = target.composers or {}\n      target.composers[#target.composers + 1] = en.id\n    end\n  end\nend\n\n-- Levenshtein distance, capped: we only care about \"within 2 typos\".\nlocal function editdist(a, b, cap)\n  local la, lb = #a, #b\n  if math.abs(la - lb) > cap then return cap + 1 end\n  local prev, cur = {}, {}\n  for j = 0, lb do prev[j] = j end\n  for i = 1, la do\n    cur[0] = i\n    local best = cur[0]\n    local ca = a:byte(i)\n    for j = 1, lb do\n      local cost = (ca == b:byte(j)) and 0 or 1\n      local v = math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)\n      cur[j] = v\n      if v < best then best = v end\n    end\n    if best > cap then return cap + 1 end\n    prev, cur = cur, prev\n  end\n  return prev[lb]\nend\n\n-- Rank every entry against the query. Lower score = better.\nlocal function search(query)\n  local q = fold(query)\n  local qw = foldw(query)\n  if #q == 0 then return {} end\n\n  local best = {}   -- entry.index -> score\n  local function bid(en, score)\n    local k = en.index\n    if best[k] == nil or score < best[k] then best[k] = score end\n  end\n\n  for _, k in ipairs(KEYS) do\n    local key, words, pen = k.key, k.words, k.pen\n    if key == q then\n      bid(k.entry, 0 + pen)                           -- exact\n    elseif key:sub(1, #q) == q then\n      bid(k.entry, 10 + pen + (#key - #q) / 100)      -- key starts with query\n    elseif #key > 2 and q:sub(1, #key) == key and #key >= #q * 0.6 then\n      -- query starts with the key, and the key is most of the query, so\n      -- \"bass\" does not claim a query of \"bassson\"\n      bid(k.entry, 24 + pen)\n    elseif key:find(q, 1, true) then\n      bid(k.entry, 30 + pen + (#key - #q) / 100)      -- key contains query\n    else\n      -- every query word appears somewhere in the key's words\n      local all, n = true, 0\n      for w in qw:gmatch(\"%S+\") do\n        n = n + 1\n        if not words:find(w, 1, true) then all = false end\n      end\n      if all and n > 0 then\n        bid(k.entry, 34 + pen)\n      elseif #q >= 4 then\n        local d = editdist(q, key, 2)                 -- typo tolerance\n        if d <= 2 then bid(k.entry, 40 + pen + d) end\n      end\n    end\n  end\n\n  -- Last resort: look inside the prose, so \"stopped horns\" or \"glissando\"\n  -- finds the entries that discuss it.\n  if next(best) == nil and #q >= 4 then\n    for _, en in ipairs(ENTRIES) do\n      if en.haystack:find(qw, 1, true) then bid(en, 60) end\n    end\n  end\n\n  local out = {}\n  for idx, score in pairs(best) do out[#out + 1] = { e = ENTRIES[idx], s = score } end\n  table.sort(out, function(a, b)\n    if a.s ~= b.s then return a.s < b.s end\n    return a.e.name < b.e.name\n  end)\n  local res = {}\n  for i = 1, math.min(#out, 40) do res[i] = out[i].e end\n  return res\nend\n\n------------------------------------------------------------------------------\n-- THEME\n------------------------------------------------------------------------------\n\n-- The shared scheme, carried over from Starting Blocks: a dark cool-grey ground,\n-- a light grey for controls raised off it, and one yellow for whatever is\n-- switched on. See COLOUR.md for the full ramp and the reasoning.\n--\n-- Two rules from that file that are easy to lose here:\n--\n--   R < G < B holds in every grey. A neutral grey at the same lightness looks\n--   correct in a diff and only reads as flat once it is on screen beside the\n--   yellow. The suite checks the bias so it cannot be lost by accident.\n--\n--   The accent is spent only on the state that is *on* - the header button for\n--   the current view, and the selected match chip. Nothing decorative takes it,\n--   which is what makes it read at a glance. Item labels and section headers\n--   used to be amber and blue; they now come off the ramp instead, so hierarchy\n--   on an entry page rests on weight and lightness rather than hue.\nlocal function hex(v)\n  return { math.floor(v / 65536) % 256 / 255,\n           math.floor(v / 256) % 256 / 255,\n           v % 256 / 255 }\nend\n\nlocal C = {\n  bg          = hex(0x23272E),   -- ground: the window behind everything\n  panel       = hex(0x1B1F25),   -- header bar, footer, popups\n  sunken      = hex(0x1A1D23),   -- chip rest, scrollbar track\n  frame_hover = hex(0x22262D),   -- chip and fold hover\n  panel2      = hex(0x2A2F37),   -- frame active\n  line        = hex(0x3A404A),   -- separators and rules\n  ink         = hex(0x14171C),   -- text on any light control\n  text        = hex(0xDDE1E7),   -- body text\n  head        = hex(0xBFC5CE),   -- section headers\n  dim         = hex(0xBAC0C9),   -- secondary text: 8.2:1 on the ground\n  faint       = hex(0xB0B6C0),   -- the quietest text, still 7.4:1 (ADR 0014)\n  title       = hex(0xF2F4F7),   -- titles, item labels, hovered text\n  control     = hex(0xA9AFBA),   -- button fill\n  control_h   = hex(0xC0C6CF),   -- button hover\n  control_a   = hex(0x8F96A2),   -- button held\n  grab        = hex(0x6D7581),   -- scrollbar grab: 3.6:1 on its track (#585F6B was 2.6:1)\n  edge        = hex(0x6D7581),   -- chip and search-box outline: 3.2:1 on the ground\n  accent      = hex(0xFFF200),   -- whatever is switched on\n  warn        = hex(0xD2483F),   -- \"use sparingly\" rule; never a shade of the accent\n  warn_text   = hex(0xFF9E96),   -- the same warning in words: 7.6:1, the red is 3.4:1\n}\n\nlocal function setcol(c, a)\n  gfx.set(c[1], c[2], c[3], a or 1)\nend\n\n-- The system's own face where it can be had (Apple's Typography page): San\n-- Francisco on a Mac, Segoe UI on Windows. gfx takes a face by name and quietly\n-- substitutes another when the name is unknown, so each is asked for and\n-- gfx.getfont() says what was really given; if it is not the one asked for,\n-- the old face stays (Transient Shuffler's pick_font, in Lua). Picked once,\n-- after gfx.init, because getfont needs the window.\nlocal FONTFACE\nlocal function pick_font()\n  local os = reaper.GetOS() or \"\"\n  local tries, fallback\n  if os:match(\"^Win\") then\n    tries, fallback = { { \"Segoe UI\", \"segoe ui\" } }, \"Arial\"\n  elseif os:match(\"OSX\") or os:match(\"macOS\") then\n    -- the system face reports itself under several names\n    tries = { { \".AppleSystemUIFont\", \"system\", \"sf\", \"applesystemui\" },\n              { \"SF Pro Text\", \"sf pro\" } }\n    fallback = \"Helvetica\"\n  else\n    tries, fallback = {}, \"DejaVu Sans\"\n  end\n  for _, t in ipairs(tries) do\n    gfx.setfont(1, t[1], 14)\n    local _, got = gfx.getfont()\n    got = tostring(got or \"\"):lower()\n    for i = 2, #t do\n      if got:find(t[i], 1, true) then return t[1] end\n    end\n  end\n  return fallback\nend\n\n-- Keys are named the way each system writes them: the Mac's symbols there\n-- (Ctrl is Command on a Mac, see CLAUDE.md), words elsewhere.\nlocal MAC = (function()\n  local os = reaper.GetOS() or \"\"\n  return os:match(\"OSX\") ~= nil or os:match(\"macOS\") ~= nil\nend)()\nlocal KEYNAME = MAC and {\n  updown = \"\u00e2\u0086\u0091 \u00e2\u0086\u0093\", leftright = \"\u00e2\u0086\u0090 \u00e2\u0086\u0092\", enter = \"Return\", del = \"Delete\",\n  fwddel = \"Forward Delete\", altleft = \"\u00e2\u008c\u00a5\u00e2\u0086\u0090\", ctrlright = \"\u00e2\u008c\u0098\u00e2\u0086\u0092\", ctrlleft = \"\u00e2\u008c\u0098\u00e2\u0086\u0090\",\n  bigger = \"\u00e2\u008c\u0098=\", smaller = \"\u00e2\u008c\u0098-\", actual = \"\u00e2\u008c\u00980\", backtab = \"\u00e2\u0087\u00a7Tab\",\n} or {\n  updown = \"Up / Down\", leftright = \"Left / Right\", enter = \"Enter\",\n  del = \"Backspace\", fwddel = \"Delete\", altleft = \"Alt+Left\",\n  ctrlright = \"Ctrl+Right\", ctrlleft = \"Ctrl+Left\",\n  bigger = \"Ctrl+=\", smaller = \"Ctrl+-\", actual = \"Ctrl+0\", backtab = \"Shift+Tab\",\n}\n\nlocal F = { TITLE = 1, HEAD = 2, LABEL = 3, BODY = 4, SMALL = 5, INPUT = 6, SUB = 7 }\n-- Everything is measured through S(), so one number scales the whole window:\n-- the display's pixel density times the Text Size the user chose (ADR 0014).\nlocal TEXT_SIZES = { 100, 125, 150, 200 }\nlocal RETINA, TEXTSIZE = 1, 1     -- TEXTSIZE indexes TEXT_SIZES\nlocal SCALE = 1\n\nlocal function initfonts()\n  local s = SCALE\n  FONTFACE = FONTFACE or pick_font()\n  gfx.setfont(F.TITLE, FONTFACE, math.floor(21 * s), string.byte(\"b\"))\n  gfx.setfont(F.HEAD,  FONTFACE, math.floor(12 * s), string.byte(\"b\"))\n  gfx.setfont(F.LABEL, FONTFACE, math.floor(14 * s), string.byte(\"b\"))\n  gfx.setfont(F.BODY,  FONTFACE, math.floor(14 * s))\n  gfx.setfont(F.SMALL, FONTFACE, math.floor(11 * s))\n  gfx.setfont(F.INPUT, FONTFACE, math.floor(17 * s))\n  gfx.setfont(F.SUB,   FONTFACE, math.floor(13 * s))\n  gfx.setfont(F.BODY)\nend\n\nlocal function S(n) return math.floor(n * SCALE + 0.5) end\n\nlocal function rescale()\n  SCALE = RETINA * TEXT_SIZES[TEXTSIZE] / 100\n  initfonts()\nend\n\n------------------------------------------------------------------------------\n-- STATE\n------------------------------------------------------------------------------\n\nlocal EXT = \"OrchestrationHelper\"\n\nlocal st = {\n  query    = \"\",\n  caret    = 0,\n  sugg     = {},\n  sel      = 1,\n  entry    = nil,\n  view     = \"index\",      -- \"index\" | \"entry\" | \"help\" | \"sources\"\n  scroll   = 0,\n  maxscroll= 0,\n  history  = {},\n  dirty    = true,\n  laidout_w= -1,\n  rows     = {},\n  hot      = {},\n  blink    = 0,\n  open     = {},         -- index view: family name -> true when expanded\n  focus    = nil,        -- key of the control Tab has ringed, nil when none\n  focusables = {},       -- what Tab can reach, rebuilt every frame\n  menu_closed = -1,      -- when the Text Size menu last closed\n}\n\nlocal function set_text_size(i)\n  i = math.max(1, math.min(#TEXT_SIZES, i))\n  if i == TEXTSIZE then return end\n  TEXTSIZE = i\n  rescale()\n  st.dirty = true\n  reaper.SetExtState(EXT, \"textsize\", tostring(TEXT_SIZES[i]), true)\nend\n\nlocal function load_text_size()\n  local pct = tonumber(reaper.GetExtState(EXT, \"textsize\"))\n  TEXTSIZE = 1\n  for i, p in ipairs(TEXT_SIZES) do\n    if p == pct then TEXTSIZE = i end\n  end\nend\n\nlocal function go(view, entry, remember)\n  if remember and st.view == \"entry\" and st.entry then\n    st.history[#st.history + 1] = st.entry.id\n    if #st.history > 60 then table.remove(st.history, 1) end\n  end\n  st.view = view\n  st.entry = entry\n  st.scroll = 0\n  st.dirty = true\nend\n\nlocal function openid(id)\n  local en = BY_ID[id]\n  if en then go(\"entry\", en, true) end\nend\n\nlocal function back()\n  local id = table.remove(st.history)\n  if id and BY_ID[id] then\n    st.view, st.entry, st.scroll, st.dirty = \"entry\", BY_ID[id], 0, true\n  else\n    st.query, st.caret, st.sugg, st.sel = \"\", 0, {}, 1\n    go(\"index\", nil, false)\n  end\nend\n\n-- Which index families are expanded. Stored as a tab-separated list of family\n-- names, so a family added later simply starts closed rather than inheriting\n-- some neighbour's saved bit.\nlocal function save_open()\n  local names = {}\n  for f, on in pairs(st.open) do\n    if on then names[#names + 1] = f end\n  end\n  table.sort(names)\n  reaper.SetExtState(EXT, \"open\", table.concat(names, \"\\t\"), true)\nend\n\nlocal function load_open()\n  st.open = {}\n  local saved = reaper.GetExtState(EXT, \"open\") or \"\"\n  for f in saved:gmatch(\"[^\\t]+\") do st.open[f] = true end\nend\n\nlocal function toggle_family(f)\n  st.open[f] = not st.open[f] or nil\n  st.dirty = true\n  save_open()\nend\n\n-- Every family at once. `on` false closes them all, which is the first-run\n-- state: the window opens as the search box over a short list of families.\nlocal function set_all_families(on)\n  st.open = {}\n  if on then\n    for _, en in ipairs(ENTRIES) do st.open[en.family or \"Other\"] = true end\n  end\n  st.scroll = 0\n  st.dirty = true\n  save_open()\nend\n\nlocal function requery()\n  st.sugg = search(st.query)\n  st.sel = 1\n  if #st.sugg > 0 then\n    st.view, st.entry = \"entry\", st.sugg[1]\n  elseif st.query == \"\" then\n    st.view, st.entry = \"index\", nil\n  else\n    st.view, st.entry = \"noresult\", nil\n  end\n  st.scroll = 0\n  st.dirty = true\nend\n\n------------------------------------------------------------------------------\n-- LAYOUT\n------------------------------------------------------------------------------\n\nlocal rows        -- being built\nlocal COL_R = 0   -- the right edge of the reading column, for citations\nlocal function row(t) rows[#rows + 1] = t end\n\nlocal function textw(s) return (gfx.measurestr(s)) end\n\n-- Break a string into lines that fit maxw with the current font.\nlocal function wrap(s, maxw)\n  local out = {}\n  s = tostring(s or \"\")\n  if s == \"\" then return { \"\" } end\n  local cur = \"\"\n  for word in s:gmatch(\"%S+\") do\n    -- a single word wider than the column has to be split\n    while textw(word) > maxw and #word > 1 do\n      local cut = #word\n      while cut > 1 and textw(word:sub(1, cut)) > maxw do cut = cut - 1 end\n      if cur ~= \"\" then out[#out + 1] = cur; cur = \"\" end\n      out[#out + 1] = word:sub(1, cut)\n      word = word:sub(cut + 1)\n    end\n    local try = (cur == \"\") and word or (cur .. \" \" .. word)\n    if textw(try) <= maxw or cur == \"\" then\n      cur = try\n    else\n      out[#out + 1] = cur\n      cur = word\n    end\n  end\n  if cur ~= \"\" then out[#out + 1] = cur end\n  if #out == 0 then out[1] = \"\" end\n  return out\nend\n\n-- Emit wrapped text as a run of rows.\nlocal function para(s, font, col, x, maxw, cite)\n  gfx.setfont(font)\n  local lh = gfx.texth + S(3)\n  local lines = wrap(s, maxw)\n  for i, ln in ipairs(lines) do\n    row{ t = \"text\", s = ln, f = font, c = col, x = x, h = lh,\n         cite = (i == 1) and cite or nil, right = COL_R }\n  end\nend\n\nlocal function gap(h) row{ t = \"gap\", h = S(h) } end\nlocal function rule(pad)\n  row{ t = \"rule\", h = S(pad or 12) }\nend\n\n-- Chip rows: clickable pills that navigate to another entry.\nlocal function chips(list, x, maxw, label)\n  if #list == 0 then return end\n  gfx.setfont(F.SUB)\n  local ch = math.max(S(28), gfx.texth + S(8))   -- Apple's control height\n  local padx = S(12)\n  local gapx = S(12)                              -- and its spacing\n  local cx, line = x, {}\n  local function flush()\n    if #line > 0 then\n      row{ t = \"chips\", h = ch + S(12), items = line }\n      line = {}\n      cx = x\n    end\n  end\n  for _, c in ipairs(list) do\n    local w = textw(c.label) + padx * 2\n    if cx + w > x + maxw and #line > 0 then flush() end\n    line[#line + 1] = { label = c.label, id = c.id, x = cx, w = w, h = ch,\n                        key = \"c:\" .. (#rows + 1) .. \":\" .. c.id }\n    cx = cx + w + gapx\n  end\n  flush()\nend\n\nlocal function header(s, maxw, x)\n  gap(14)\n  gfx.setfont(F.HEAD)\n  local warn = s:lower():find(\"sparingly\") ~= nil\n  local col = warn and C.warn_text or C.head\n  row{ t = \"text\", s = s:upper(), f = F.HEAD, c = col, x = x, h = gfx.texth + S(4) }\n  -- The separator comes off the ramp, not from the header's own colour: a grey\n  -- at 28% alpha over the ground is invisible. A warning keeps its red so the\n  -- whole band still reads as one.\n  row{ t = \"hrule\", h = S(7), x = x, w = maxw,\n       c = warn and C.warn or C.line, a = warn and 0.7 or 1 }\nend\n\n-- A family header on the index that opens and closes. One row, drawn as a full\n-- width band so the whole strip is the click target, not just the words.\nlocal function fold(name, n, on, maxw, x)\n  gap(8)\n  gfx.setfont(F.HEAD)\n  row{ t = \"fold\", name = name, n = n, on = on,\n       x = x, w = maxw, h = gfx.texth + S(14) }\nend\n\n-- Build the row list for whatever the current view is.\nlocal function layout(w)\n  rows = {}\n  local PAD = S(20)\n  -- A reading column of about a hundred characters, centred in a wide window\n  -- (Apple's Layout page: restrict the width of text for readability). It is\n  -- measured in the body font, so it grows with Text Size. A hundred rather\n  -- than the typographer's seventy: seventy narrows the default window's page\n  -- too, and its closed index then no longer fits without scrolling (ADR 0010).\n  gfx.setfont(F.BODY)\n  local col = textw(\"Doublings and pairings that the standard literature agrees on, \" ..\n                    \"each one with the page of its source.\")\n  local maxw = math.min(w - PAD * 2, col)\n  if maxw < S(120) then maxw = S(120) end\n  local x = math.max(PAD, math.floor((w - maxw) / 2))\n  COL_R = x + maxw\n\n  if st.view == \"index\" then\n    para(\"Orchestration Helper\", F.TITLE, C.title, x, maxw)\n    gap(2)\n    para(\"Type an instrument, a section, a composer \u00e2\u0080\u0094 or a mood \u00e2\u0080\u0094 in the box \" ..\n         \"above: \u00e2\u0080\u009ctrombone\u00e2\u0080\u009d, \u00e2\u0080\u009cstring section\u00e2\u0080\u009d, \u00e2\u0080\u009ccor anglais\u00e2\u0080\u009d, \u00e2\u0080\u009cBernard \" ..\n         \"Herrmann\u00e2\u0080\u009d, \u00e2\u0080\u009cBach\u00e2\u0080\u009d, \u00e2\u0080\u009cmysterious\u00e2\u0080\u009d. You get the doublings and pairings \" ..\n         \"that the standard literature agrees on. Everything is stored locally; \" ..\n         \"nothing is ever fetched from the internet.\",\n         F.BODY, C.dim, x, maxw)\n    gap(6)\n    para(\"Or click a family below to open it. Press F1 to see the keyboard shortcuts.\",\n         F.SMALL, C.faint, x, maxw)\n\n    local fams, order = {}, {}\n    for _, en in ipairs(ENTRIES) do\n      local f = en.family or \"Other\"\n      if not fams[f] then fams[f] = {}; order[#order + 1] = f end\n      local list = fams[f]\n      list[#list + 1] = en\n    end\n    local rank = { Strings = 1, Woodwind = 2, Brass = 3, Percussion = 4,\n                   Plucked = 5, Voices = 6, Combining = 7, Craft = 8,\n                   Character = 9, Reference = 10,\n                   Composers = 11, [\"Film Composers\"] = 12 }\n    table.sort(order, function(a, b)\n      return (rank[a] or 50) < (rank[b] or 50)\n    end)\n    local nopen = 0\n    for _, f in ipairs(order) do\n      local on = st.open[f] and true or false\n      if on then nopen = nopen + 1 end\n      fold(f, #fams[f], on, maxw, x)\n      if on then\n        local list = {}\n        table.sort(fams[f], function(a, b) return a.name < b.name end)\n        for _, en in ipairs(fams[f]) do\n          list[#list + 1] = { label = en.name, id = en.id }\n        end\n        gap(2)\n        chips(list, x, maxw)\n        gap(4)\n      end\n    end\n    gap(10)\n    rule(6)\n    para((\"%d entries in %d families. %s \u00c2\u00b7 To see the sources, click Sources at the top.\")\n         :format(#ENTRIES, #order,\n                 nopen == #order and (KEYNAME.ctrlleft .. \" closes them all.\")\n                                 or (KEYNAME.ctrlright .. \" opens them all.\")),\n         F.SMALL, C.faint, x, maxw)\n    gap(16)\n\n  elseif st.view == \"noresult\" then\n    para(\"Nothing Found for \u00e2\u0080\u009c\" .. st.query .. \"\u00e2\u0080\u009d\", F.TITLE, C.title, x, maxw)\n    gap(4)\n    para(\"Try a plainer word \u00e2\u0080\u0094 \u00e2\u0080\u009chorn\u00e2\u0080\u009d, \u00e2\u0080\u009cstrings\u00e2\u0080\u009d, \u00e2\u0080\u009ctimpani\u00e2\u0080\u009d, \u00e2\u0080\u009cMozart\u00e2\u0080\u009d, \" ..\n         \"\u00e2\u0080\u009cmenacing\u00e2\u0080\u009d \u00e2\u0080\u0094 or clear the box with Esc to see the whole index. Spelling \" ..\n         \"is forgiving, but the encyclopaedia only covers the orchestra, the \" ..\n         \"composers who wrote for it, and the craft of scoring for it.\",\n         F.BODY, C.dim, x, maxw)\n    gap(16)\n\n  elseif st.view == \"help\" then\n    para(\"How to Use It\", F.TITLE, C.title, x, maxw)\n    gap(6)\n    local keys = {\n      { \"Type\", \"Search as you type; the best match is shown straight away.\" },\n      { KEYNAME.updown, \"Move through the other matches.\" },\n      { KEYNAME.enter, \"Keep the highlighted match and close the list of matches.\" },\n      { \"Esc\", \"Clear the box; press it again to go to the index.\" },\n      { KEYNAME.leftright, \"Move the cursor; \" .. KEYNAME.del .. \" and \" ..\n        KEYNAME.fwddel .. \" edit.\" },\n      { KEYNAME.altleft, \"Go back to the previous entry.\" },\n      { \"Scroll wheel, Page Up, Page Down\", \"Scroll.\" },\n      { \"F1\", \"Show this page.\" },\n      { \"Tab \" .. KEYNAME.backtab, \"Move a white ring between the buttons, families \" ..\n        \"and names; \" .. KEYNAME.enter .. \" or Space presses the one ringed.\" },\n      { KEYNAME.bigger .. \" \" .. KEYNAME.smaller, \"Make the text bigger or smaller, \" ..\n        \"up to twice the size; \" .. KEYNAME.actual .. \" goes back to 100%. Text Size \" ..\n        \"at the top does the same, and it is remembered.\" },\n      { \"Click a name\", \"Open that entry.\" },\n      { \"Click a family\", \"On the index, open or close it; what you leave \" ..\n        \"open is remembered.\" },\n      { KEYNAME.ctrlright .. \" \" .. KEYNAME.ctrlleft,\n        \"On the index, open or close every family.\" },\n    }\n    for _, k in ipairs(keys) do\n      gfx.setfont(F.LABEL)\n      local kw = S(150)\n      row{ t = \"text\", s = k[1], f = F.LABEL, c = C.title, x = x, h = gfx.texth + S(3) }\n      para(k[2], F.BODY, C.text, x + kw, maxw - kw)\n      gap(2)\n    end\n    header(\"What\u00e2\u0080\u0099s in Here\", maxw, x)\n    para(\"Doublings and pairings in unison, in octaves, in thirds and sixths, and \" ..\n         \"in harmony; section rosters and how they divide; relative strengths for \" ..\n         \"balancing a doubling; and the blend bridges between the groups.\",\n         F.BODY, C.text, x, maxw)\n    gap(8)\n    para(\"Composers too, concert and film. Each composer entry answers one working \" ..\n         \"question: if you want this sound, what did they actually put together? \" ..\n         \"And because those entries name the instruments a composer is known for, \" ..\n         \"every instrument page lists the composers worth studying for it.\",\n         F.BODY, C.text, x, maxw)\n    gap(8)\n    para(\"It also works backwards. Type a mood \u00e2\u0080\u0094 \u00e2\u0080\u009cmysterious\u00e2\u0080\u009d, \u00e2\u0080\u009cmenacing\u00e2\u0080\u009d, \" ..\n         \"\u00e2\u0080\u009ctriumphant\u00e2\u0080\u009d \u00e2\u0080\u0094 and you get the orchestral resources that produce it. \" ..\n         \"Those entries come from Belkin\u00e2\u0080\u0099s character glossary; read his caveats on \" ..\n         \"the Character page before leaning on them, because used as a recipe book \" ..\n         \"they turn into clich\u00c3\u00a9s.\", F.BODY, C.text, x, maxw)\n    gap(8)\n    para(\"Rare combinations are deliberately kept out of the suggestion lists. \" ..\n         \"Where a source explicitly warns against something, or calls it rare, it \" ..\n         \"appears under \u00e2\u0080\u009cUse sparingly\u00e2\u0080\u009d instead \u00e2\u0080\u0094 so the advice stays honest \" ..\n         \"without recommending what nobody writes.\", F.BODY, C.text, x, maxw)\n    header(\"Citations\", maxw, x)\n    para(\"Every item is tagged with the work and page it comes from. The tags are \" ..\n         \"spelled out on the Sources page.\", F.BODY, C.text, x, maxw)\n    gap(16)\n\n  elseif st.view == \"sources\" then\n    para(\"Sources\", F.TITLE, C.title, x, maxw)\n    gap(4)\n    para(\"Every statement in this encyclopaedia is drawn from the works below and \" ..\n         \"tagged with the page it came from.\", F.BODY, C.dim, x, maxw)\n    local order = { \"RK\", \"BERL\", \"SIN\", \"WP\", \"BEL\", \"HUG\", \"IDIO\", \"ACTOR\",\n                    \"OMT\", \"MOD\", \"FILM\" }\n    for _, tag in ipairs(order) do\n      local s = SOURCES[tag]\n      if s then\n        header(s.tag .. \" \u00e2\u0080\u0094 \" .. s.short, maxw, x)\n        para(s.full, F.BODY, C.text, x, maxw)\n      end\n    end\n    header(\"A Note on the Reading\", maxw, x)\n    para(\"Rimsky-Korsakov and Singleton are quoted directly and cited by page. \" ..\n         \"Berlioz, Lavignac, Gevaert, Stone and Forsyth appear as Singleton quotes \" ..\n         \"them, and are named in the text where that is the case. The present-day \" ..\n         \"references were consulted to check that the historical advice still holds \" ..\n         \"and to supply modern section sizes; they are cited by tag rather than page.\",\n         F.BODY, C.text, x, maxw)\n    gap(16)\n\n  elseif st.view == \"entry\" and st.entry then\n    local en = st.entry\n    para(en.name, F.TITLE, C.title, x, maxw)\n    gfx.setfont(F.SMALL)\n    row{ t = \"text\", s = ((en.family or \"\") .. \"  \u00c2\u00b7  \" .. (en.kind or \"\")):upper(),\n         f = F.SMALL, c = C.faint, x = x, h = gfx.texth + S(8) }\n    if en.summary then\n      para(en.summary, F.BODY, C.text, x, maxw)\n    end\n    if en.facts and #en.facts > 0 then\n      gap(10)\n      local kw = math.min(S(170), math.floor(maxw * 0.34))\n      for _, f in ipairs(en.facts) do\n        gfx.setfont(F.SMALL)\n        local klines = wrap(f[1]:upper(), kw - S(12))\n        gfx.setfont(F.SUB)\n        local lh = gfx.texth + S(3)\n        local vlines = wrap(f[2], maxw - kw)\n        for i = 1, math.max(#klines, #vlines) do\n          row{ t = \"kv\", key = klines[i], val = vlines[i],\n               keyx = x, valx = x + kw, h = lh }\n        end\n        gap(5)\n      end\n    end\n\n    for _, sec in ipairs(en.sec or {}) do\n      header(sec[1], maxw, x)\n      for _, it in ipairs(sec[2]) do\n        local label, detail, cite = it[1], it[2], it[3]\n        local citew = 0\n        if cite and cite ~= \"\" then\n          gfx.setfont(F.SMALL)\n          citew = textw(cite) + S(14)\n        end\n        para(label, F.LABEL, C.title, x, maxw - citew, cite)  -- bold; detail below is lighter weight and indented\n        if detail and detail ~= \"\" then\n          para(detail, F.BODY, C.text, x + S(14), maxw - S(14))\n        end\n        gap(9)\n      end\n    end\n\n    if en.composers and #en.composers > 0 then\n      header(\"Composers noted for it\", maxw, x)\n      local list = {}\n      local seen = {}\n      for _, id in ipairs(en.composers) do\n        local c = BY_ID[id]\n        if c and not seen[id] then\n          seen[id] = true\n          list[#list + 1] = { label = c.name, id = id }\n        end\n      end\n      chips(list, x, maxw)\n    end\n\n    if en.related and #en.related > 0 then\n      header(\"See also\", maxw, x)\n      local list = {}\n      for _, id in ipairs(en.related) do\n        local r = BY_ID[id]\n        if r then list[#list + 1] = { label = r.name, id = r.id } end\n      end\n      chips(list, x, maxw)\n    end\n    gap(20)\n  end\n\n  -- resolve y positions\n  local y = 0\n  for _, r in ipairs(rows) do\n    r.y = y\n    y = y + (r.h or 0)\n  end\n  st.rows = rows\n  st.content_h = y\nend\n\n------------------------------------------------------------------------------\n-- DRAW\n------------------------------------------------------------------------------\n\n-- gfx.mouse_cap is a bitfield. Test it arithmetically so the script runs on\n-- every Lua version REAPER has shipped.\nlocal function cap(bit)\n  return (gfx.mouse_cap % (bit * 2)) >= bit\nend\nlocal function inrect(x, y, w, h)\n  return gfx.mouse_x >= x and gfx.mouse_x <= x + w\n     and gfx.mouse_y >= y and gfx.mouse_y <= y + h\nend\nlocal function hot(x, y, w, h, action)\n  st.hot[#st.hot + 1] = { x = x, y = y, w = w, h = h, action = action }\nend\n\n-- The ring Tab draws round a control: near-white, two pixels, outside it.\n-- Not the accent - yellow means switched on, and a ringed control need not be.\nlocal function ring(key, x, y, w, h)\n  if st.focus ~= key then return end\n  setcol(C.title)\n  local t = math.max(2, S(2))\n  for i = 1, t do\n    gfx.rect(x - S(1) - i, y - S(1) - i, w + 2 * (S(1) + i), h + 2 * (S(1) + i), 0)\n  end\nend\n\n-- A chosen control is not shown by colour alone: it also carries a short ink\n-- bar under its label.\nlocal function chosen_bar(x, y, w, h)\n  setcol(C.ink)\n  gfx.rect(x + S(8), y + h - S(5), w - S(16), math.max(2, S(2)), 1)\nend\n\n-- The Text Size menu. gfx.showmenu opens at gfx.x, gfx.y and is modal; the\n-- click that chose an item can come back once it closes, so clicks are\n-- ignored for a quarter of a second after (ScaleView for REAPER learned this).\nlocal function text_size_menu(b)\n  local items = {}\n  for i, p in ipairs(TEXT_SIZES) do\n    items[i] = (i == TEXTSIZE and \"!\" or \"\") .. p .. \"%\"\n  end\n  gfx.x, gfx.y = b.x, b.y + b.h\n  local pick = gfx.showmenu(table.concat(items, \"|\"))\n  st.menu_closed = reaper.time_precise()\n  if pick and pick > 0 then set_text_size(pick) end\nend\n\n-- The disclosure triangle on a fold row: right-pointing when closed, down when\n-- open. gfx.triangle is confirmed present in the REAPER API reference\n-- (\"Draws a filled triangle, or any convex polygon\"), so it is used directly.\n-- An earlier version stacked gfx.rect because the reference had not been seen\n-- and the call could not be verified; that caution is no longer needed.\n-- (cx, cy) is the marker's centre; the colour is whatever is already set.\nlocal function marker(cx, cy, down)\n  local long, short = S(9), S(6)\n  local hl, hs = long / 2, short / 2\n  if down then\n    gfx.triangle(cx - hl, cy - hs, cx + hl, cy - hs, cx, cy + hs)\n  else\n    gfx.triangle(cx - hs, cy - hl, cx - hs, cy + hl, cx + hs, cy)\n  end\nend\n\n-- Work out the whole top strip - header bar, search box, match chips - and\n-- return its geometry. Nothing is drawn yet: the body needs to know how tall\n-- this is, and the body is drawn first so that the strip can paint over it.\nlocal function top_geometry()\n  local w = gfx.w\n  local g = { pad = S(20) }\n\n  -- header buttons, right to left, 28 points tall and 12 apart\n  gfx.setfont(F.SUB)\n  g.btn_h = math.max(S(28), gfx.texth + S(8))\n  g.header_h = g.btn_h + S(16)\n  local by, top_by = S(8), S(8)\n  local specs = {\n    { \"b:sources\", \"Sources\", st.view == \"sources\",\n      function() go(\"sources\", nil, true) end },\n    { \"b:index\", \"Index\", st.view == \"index\", function()\n        st.query, st.caret, st.sugg, st.sel = \"\", 0, {}, 1\n        go(\"index\", nil, true)\n      end },\n    { \"b:help\", \"Help\", st.view == \"help\", function() go(\"help\", nil, true) end },\n    { \"b:size\", \"Text Size\", false, text_size_menu },\n  }\n  -- Back is named in words, not drawn as a bare \"<\" that would need a tooltip.\n  local backw = math.max(textw(\"Back\") + S(24), g.btn_h)\n  local leftmost = S(8) + backw + S(12)\n  g.buttons = {}\n  local rx, inrow = w - S(8), 0\n  g.title_right = nil\n  for _, sp in ipairs(specs) do\n    local bw = textw(sp[2]) + S(24)\n    -- a narrow window (or large text) puts the rest on a row of their own,\n    -- so no button is ever drawn over another (Apple's Layout: nothing\n    -- becomes unreachable as the window narrows)\n    if rx - bw < leftmost and inrow > 0 then\n      g.title_right = g.title_right or rx\n      by = by + g.btn_h + S(12)\n      rx, inrow = w - S(8), 0\n    end\n    rx = rx - bw\n    table.insert(g.buttons, 1, { key = sp[1], label = sp[2], on = sp[3],\n      fn = sp[4], x = rx, y = by, w = bw, h = g.btn_h })\n    rx = rx - S(12)\n    inrow = inrow + 1\n  end\n  g.title_right = g.title_right or rx\n  table.insert(g.buttons, 1, { key = \"b:back\", label = \"Back\", on = false,\n    fn = back, x = S(8), y = top_by, w = backw, h = g.btn_h })\n  for _, b in ipairs(g.buttons) do\n    b.action = function() b.fn(b) end\n  end\n  g.header_h = by + g.btn_h + S(8)\n  table.sort(g.buttons, function(a, b)       -- Tab goes in reading order\n    if a.y ~= b.y then return a.y < b.y end\n    return a.x < b.x\n  end)\n\n  gfx.setfont(F.INPUT)\n  g.search_h = gfx.texth + S(14)\n  g.search_y = g.header_h + S(10)\n  g.search_x = g.pad\n  g.search_w = w - g.pad * 2\n\n  local y = g.search_y + g.search_h + S(10)\n\n  -- match chips, laid out over at most two rows\n  g.chips = {}\n  g.more = nil\n  if #st.sugg >= 2 then\n    gfx.setfont(F.SMALL)\n    local morew = textw((\"+%d more\"):format(#st.sugg)) + S(12)\n    gfx.setfont(F.SUB)\n    local ch = math.max(S(28), gfx.texth + S(8))\n    local x0, maxw = g.pad, w - g.pad * 2\n    local cx, line, drawn = x0, 1, 0\n    for i, en in ipairs(st.sugg) do\n      local cw = textw(en.name) + S(24)\n      -- on the last row, leave room for \"+N more\" so it stays in the window\n      local function fits()\n        local room = (line >= 2 and i < #st.sugg) and morew or 0\n        return cx + cw + room <= x0 + maxw\n      end\n      if not fits() and drawn > 0 then\n        if line == 1 then\n          line = 2\n          cx = x0\n          y = y + ch + S(12)\n        end\n        if not fits() then\n          g.more = { s = (\"+%d more\"):format(#st.sugg - drawn), x = cx, y = y }\n          break\n        end\n      end\n      g.chips[#g.chips + 1] =\n        { label = en.name, x = cx, y = y, w = cw, h = ch, i = i, entry = en,\n          key = \"m:\" .. en.id, action = function()\n            st.sel = i\n            st.view, st.entry, st.scroll, st.dirty = \"entry\", en, 0, true\n          end }\n      cx = cx + cw + S(12)\n      drawn = drawn + 1\n    end\n    y = y + ch + S(12)\n  end\n\n  g.top_h = y\n\n  -- the footer wraps rather than running off the window's edge\n  gfx.setfont(F.SMALL)\n  g.footer_lines = wrap(st.view == \"index\"\n    and (\"Click a family to open it \u00c2\u00b7 \" .. KEYNAME.ctrlright .. \" opens all \u00c2\u00b7 \" ..\n         KEYNAME.ctrlleft .. \" closes all \u00c2\u00b7 F1 for help \u00c2\u00b7 Works offline\")\n     or (KEYNAME.updown .. \" matches \u00c2\u00b7 \" .. KEYNAME.enter .. \" opens \u00c2\u00b7 \" ..\n         \"Esc clears \u00c2\u00b7 \" .. KEYNAME.altleft .. \" goes back \u00c2\u00b7 F1 for help \u00c2\u00b7 \" ..\n         \"Works offline\"), w - S(40))\n  g.footer_lh = gfx.texth + S(2)\n  g.footer_h = #g.footer_lines * g.footer_lh + S(6)\n  return g\nend\n\n-- Header buttons are the one place this window has real controls, so they take\n-- the scheme's control greys - which sit lighter than the ground, and therefore\n-- force dark text on every one of them, not just the chosen one. `on` marks the\n-- current view, and that is what the accent is for.\nlocal function button(b)\n  local label, bx, by, bw, bh, on = b.label, b.x, b.y, b.w, b.h, b.on\n  local over = inrect(bx, by, bw, bh)\n  local down = over and cap(1)\n  if on then\n    setcol(C.accent)\n  else\n    setcol(down and C.control_a or (over and C.control_h or C.control))\n  end\n  gfx.rect(bx, by, bw, bh, 1)\n  setcol(C.ink)\n  gfx.setfont(F.SUB)\n  gfx.x, gfx.y = bx, by + math.floor((bh - gfx.texth) / 2)\n  gfx.drawstr(label, 1, bx + bw, by + bh)\n  if on then chosen_bar(bx, by, bw, bh) end\n  ring(b.key, bx, by, bw, bh)\n  hot(bx, by, bw, bh, b.action)\nend\n\nlocal function draw_top(g)\n  local w = gfx.w\n\n  -- opaque backdrop, so body text scrolled up here is covered\n  setcol(C.bg)\n  gfx.rect(0, 0, w, g.top_h, 1)\n\n  -- header bar\n  setcol(C.panel)\n  gfx.rect(0, 0, w, g.header_h, 1)\n  setcol(C.line)\n  gfx.rect(0, g.header_h - 1, w, 1, 1)\n\n  for _, b in ipairs(g.buttons) do button(b) end\n\n  -- the name, between Back and the buttons, if there is room for it\n  local backb = g.buttons[1]\n  gfx.setfont(F.HEAD)\n  setcol(C.dim)\n  local tx0 = backb.x + backb.w + S(12)\n  local name = \"ORCHESTRATION HELPER\"\n  if textw(name) <= g.title_right - tx0 then\n    gfx.x, gfx.y = tx0, backb.y + math.floor((g.btn_h - gfx.texth) / 2)\n    gfx.drawstr(name, 0, g.title_right, backb.y + g.btn_h)\n  end\n\n  -- search box\n  local sx, sy, sw, sh = g.search_x, g.search_y, g.search_w, g.search_h\n  setcol(inrect(sx, sy, sw, sh) and C.panel2 or C.sunken)\n  gfx.rect(sx, sy, sw, sh, 1)\n  setcol(C.edge)                        -- an input's edge, 3:1 or more\n  gfx.rect(sx, sy, sw, sh, 0)\n\n  gfx.setfont(F.INPUT)\n  local tx = sx + S(12)\n  local ty = sy + math.floor((sh - gfx.texth) / 2)\n  if st.query == \"\" then\n    setcol(C.faint)\n    gfx.x, gfx.y = tx, ty\n    -- never cut short: the long hint where it fits, else the plain word\n    local hint = \"Search for an instrument, section, composer or mood\"\n    if textw(hint) > sw - S(112) then hint = \"Search\" end\n    gfx.drawstr(hint, 0, sx + sw - S(100), sy + sh)\n  else\n    setcol(C.text)\n    gfx.x, gfx.y = tx, ty\n    gfx.drawstr(st.query, 0, sx + sw - S(100), sy + sh)\n  end\n\n  st.blink = st.blink + 1\n  if (st.blink % 64) < 40 then\n    local cx = tx + textw(st.query:sub(1, st.caret))\n    setcol(C.accent)\n    gfx.rect(cx, ty, math.max(1, S(1)), gfx.texth, 1)\n  end\n\n  if #st.sugg > 0 then\n    gfx.setfont(F.SMALL)\n    setcol(C.faint)\n    local s = (#st.sugg == 1) and \"1 match\" or (#st.sugg .. \" matches\")\n    gfx.x = sx + sw - S(12) - textw(s)\n    gfx.y = sy + math.floor((sh - gfx.texth) / 2)\n    gfx.drawstr(s)\n  end\n  hot(sx, sy, sw, sh, function() st.caret = #st.query end)\n\n  -- match chips\n  gfx.setfont(F.SUB)\n  for _, c in ipairs(g.chips) do\n    local sel = (c.i == st.sel)\n    local over = inrect(c.x, c.y, c.w, c.h)\n    -- the chosen match is the state that is on, so it alone takes the accent -\n    -- filled, which means dark ink on it\n    setcol(sel and C.accent or (over and C.frame_hover or C.sunken))\n    gfx.rect(c.x, c.y, c.w, c.h, 1)\n    if not sel then\n      setcol(C.edge)\n      gfx.rect(c.x, c.y, c.w, c.h, 0)\n    end\n    setcol(sel and C.ink or (over and C.title or C.text))\n    gfx.x, gfx.y = c.x, c.y + math.floor((c.h - gfx.texth) / 2)\n    gfx.drawstr(c.label, 1, c.x + c.w, c.y + c.h)\n    if sel then chosen_bar(c.x, c.y, c.w, c.h) end\n    ring(c.key, c.x, c.y, c.w, c.h)\n    hot(c.x, c.y, c.w, c.h, c.action)\n  end\n  if g.more then\n    setcol(C.faint)\n    gfx.setfont(F.SMALL)\n    gfx.x, gfx.y = g.more.x, g.more.y + S(4)\n    gfx.drawstr(g.more.s)\n  end\nend\n\nlocal function draw_body(top, bottom)\n  local w = gfx.w\n  local viewh = bottom - top\n  if viewh < S(40) then return end\n\n  if st.dirty or st.laidout_w ~= w then\n    layout(w)\n    st.laidout_w = w\n    st.dirty = false\n  end\n\n  st.maxscroll = math.max(0, st.content_h - viewh + S(10))\n  if st.scroll > st.maxscroll then st.scroll = st.maxscroll end\n  if st.scroll < 0 then st.scroll = 0 end\n\n  for _, r in ipairs(st.rows) do\n    local y = top + r.y - st.scroll\n    local rh = r.h or 0\n    if y + rh >= -S(40) and y <= bottom + S(40) then\n      if r.t == \"text\" then\n        gfx.setfont(r.f)\n        setcol(r.c)\n        gfx.x, gfx.y = r.x, y\n        gfx.drawstr(r.s, 256)\n        if r.cite then\n          gfx.setfont(F.SMALL)\n          setcol(C.faint)\n          gfx.x, gfx.y = r.right - textw(r.cite), y + S(3)\n          gfx.drawstr(r.cite, 256)\n        end\n      elseif r.t == \"kv\" then\n        if r.key then\n          gfx.setfont(F.SMALL)\n          setcol(C.faint)\n          gfx.x, gfx.y = r.keyx, y + S(2)\n          gfx.drawstr(r.key, 256)\n        end\n        if r.val then\n          gfx.setfont(F.SUB)\n          setcol(C.text)\n          gfx.x, gfx.y = r.valx, y\n          gfx.drawstr(r.val, 256)\n        end\n      elseif r.t == \"hrule\" then\n        setcol(r.c, r.a or 1)\n        gfx.rect(r.x, y + S(2), r.w, 1, 1)\n      elseif r.t == \"rule\" then\n        setcol(C.line)\n        gfx.rect(S(20), y + math.floor(rh / 2), w - S(40), 1, 1)\n      elseif r.t == \"fold\" then\n        local visible = (y >= top and y + rh <= bottom)\n        local over = visible and inrect(r.x, y, r.w, rh)\n        if over then\n          setcol(C.frame_hover)\n          gfx.rect(r.x, y, r.w, rh, 1)\n        end\n        setcol(r.on and C.title or C.dim)\n        marker(r.x + S(5), y + math.floor(rh / 2), r.on)\n        gfx.setfont(F.HEAD)\n        setcol(over and C.title or C.head)\n        gfx.x, gfx.y = r.x + S(18), y + math.floor((rh - gfx.texth) / 2)\n        gfx.drawstr(r.name:upper(), 256)\n        ring(\"f:\" .. r.name, r.x, y, r.w, rh)\n        gfx.setfont(F.SMALL)\n        setcol(C.faint)\n        local cn = tostring(r.n)\n        gfx.x = r.x + r.w - textw(cn)\n        gfx.y = y + math.floor((rh - gfx.texth) / 2)\n        gfx.drawstr(cn, 256)\n        setcol(C.line)\n        gfx.rect(r.x, y + rh - 1, r.w, 1, 1)\n        if visible then\n          hot(r.x, y, r.w, rh, function() toggle_family(r.name) end)\n        end\n      elseif r.t == \"chips\" then\n        gfx.setfont(F.SUB)\n        for _, c in ipairs(r.items) do\n          local visible = (y >= top and y + c.h <= bottom)\n          local over = visible and inrect(c.x, y, c.w, c.h)\n          setcol(over and C.frame_hover or C.sunken)\n          gfx.rect(c.x, y, c.w, c.h, 1)\n          setcol(C.edge)                -- its fill alone is 1.1:1 on the ground\n          gfx.rect(c.x, y, c.w, c.h, 0)\n          setcol(over and C.title or C.text)\n          gfx.x, gfx.y = c.x, y + math.floor((c.h - gfx.texth) / 2)\n          gfx.drawstr(c.label, 1, c.x + c.w, y + c.h)\n          ring(c.key, c.x, y, c.w, c.h)\n          if visible then\n            hot(c.x, y, c.w, c.h, function() openid(c.id) end)\n          end\n        end\n      end\n    end\n  end\n\n  if st.maxscroll > 0 then\n    local tx = w - S(6)\n    setcol(C.sunken)\n    gfx.rect(tx, top, S(4), viewh, 1)\n    local knobh = math.max(S(30),\n      math.floor(viewh * (viewh / (st.content_h + S(10)))))\n    local knoby = top + math.floor((viewh - knobh) * (st.scroll / st.maxscroll))\n    setcol(C.grab)\n    gfx.rect(tx, knoby, S(4), knobh, 1)\n  end\nend\n\n-- Everything Tab can reach, in reading order: the header's buttons, the\n-- matches, then the page's families and names. Body items keep their place on\n-- the page (y), so one scrolled out of sight can be brought into view.\nlocal function build_focus(g)\n  local list = {}\n  for _, b in ipairs(g.buttons) do\n    list[#list + 1] = { key = b.key, action = b.action }\n  end\n  for _, c in ipairs(g.chips) do\n    list[#list + 1] = { key = c.key, action = c.action }\n  end\n  for _, r in ipairs(st.rows) do\n    if r.t == \"fold\" then\n      local name = r.name\n      list[#list + 1] = { key = \"f:\" .. name, y = r.y, h = r.h,\n                          action = function() toggle_family(name) end }\n    elseif r.t == \"chips\" then\n      for _, c in ipairs(r.items) do\n        local id = c.id\n        list[#list + 1] = { key = c.key, y = r.y, h = c.h,\n                            action = function() openid(id) end }\n      end\n    end\n  end\n  st.focusables = list\n  st.view_top, st.view_bottom = g.top_h, gfx.h - g.footer_h\nend\n\nlocal function focused()\n  for i, f in ipairs(st.focusables) do\n    if f.key == st.focus then return f, i end\n  end\nend\n\nlocal function move_focus(back_wards)\n  local L = st.focusables\n  if #L == 0 then return end\n  local _, cur = focused()\n  local n\n  if back_wards then\n    n = (not cur or cur <= 1) and #L or cur - 1\n  else\n    n = cur and (cur % #L + 1) or 1\n  end\n  local f = L[n]\n  st.focus = f.key\n  -- bring a page item into view\n  if f.y and st.view_top then\n    local viewh = st.view_bottom - st.view_top\n    if f.y < st.scroll then\n      st.scroll = math.max(0, f.y - S(12))\n    elseif f.y + f.h > st.scroll + viewh then\n      st.scroll = f.y + f.h - viewh + S(12)\n    end\n  end\nend\n\nlocal function draw_footer(g)\n  local y = gfx.h - g.footer_h\n  setcol(C.panel)\n  gfx.rect(0, y, gfx.w, g.footer_h, 1)\n  setcol(C.line)\n  gfx.rect(0, y, gfx.w, 1, 1)\n  setcol(C.faint)\n  gfx.setfont(F.SMALL)\n  for i, ln in ipairs(g.footer_lines) do\n    gfx.x, gfx.y = S(20), y + S(4) + (i - 1) * g.footer_lh\n    gfx.drawstr(ln, 256)\n  end\nend\n\n------------------------------------------------------------------------------\n-- INPUT\n------------------------------------------------------------------------------\n\n-- REAPER returns the named keys as multi-byte values; pack the names to match.\nlocal function K(s)\n  local v = 0\n  for i = 1, #s do v = v * 256 + s:byte(i) end\n  return v\nend\nlocal KEY = {\n  up = K(\"up\"), down = K(\"down\"), left = K(\"left\"), right = K(\"rght\"),\n  pgup = K(\"pgup\"), pgdn = K(\"pgdn\"), home = K(\"home\"), fin = K(\"end\"),\n  del = K(\"del\"), f1 = K(\"f1\"),\n}\n\nlocal mouse_was_down = false\n\nlocal function handle_mouse()\n  local down = cap(1)\n  local settled = reaper.time_precise() - st.menu_closed > 0.25\n  if down and not mouse_was_down and settled then\n    st.focus = nil\n    -- last hotspot registered is the topmost one, so walk backwards\n    for i = #st.hot, 1, -1 do\n      local hs = st.hot[i]\n      if inrect(hs.x, hs.y, hs.w, hs.h) then\n        hs.action()\n        break\n      end\n    end\n  end\n  mouse_was_down = down\n\n  if gfx.mouse_wheel ~= 0 then\n    st.scroll = st.scroll - (gfx.mouse_wheel / 120) * S(64)\n    gfx.mouse_wheel = 0\n  end\nend\n\nlocal function clear_query()\n  st.query, st.caret, st.sugg, st.sel = \"\", 0, {}, 1\nend\n\nlocal function insert(s)\n  st.query = st.query:sub(1, st.caret) .. s .. st.query:sub(st.caret + 1)\n  st.caret = st.caret + #s\n  requery()\nend\n\n-- Returns false once the window has been closed.\nlocal function handle_keys()\n  while true do\n    local c = gfx.getchar()\n    if c == -1 then return false end\n    if c == 0 then return true end\n\n    local ctrl = cap(4)\n    local alt  = cap(16)\n    local f = st.focus and focused()\n\n    if ctrl and (c == 61 or c == 43) then              -- Ctrl/Cmd + = (or +)\n      set_text_size(TEXTSIZE + 1)\n    elseif ctrl and c == 45 then                       -- Ctrl/Cmd + -\n      set_text_size(TEXTSIZE - 1)\n    elseif ctrl and c == 48 then                       -- Ctrl/Cmd + 0\n      set_text_size(1)\n    elseif c == 9 then                                 -- Tab, Shift+Tab\n      move_focus(cap(8))\n    elseif f and (c == 13 or c == 32) then             -- press the ringed one\n      f.action()\n    elseif c == 27 and st.focus then                   -- Esc: drop the ring first\n      st.focus = nil\n    elseif c == 27 then                                -- Esc\n      if st.query ~= \"\" then\n        clear_query()\n        requery()\n      else\n        clear_query()\n        go(\"index\", nil, false)\n      end\n    elseif c == 13 then                                -- Enter\n      if #st.sugg > 0 then\n        local en = st.sugg[st.sel]\n        st.sugg, st.sel = { en }, 1\n        st.view, st.entry, st.scroll, st.dirty = \"entry\", en, 0, true\n      end\n    elseif c == 8 then                                 -- Backspace\n      if st.caret > 0 then\n        st.query = st.query:sub(1, st.caret - 1) .. st.query:sub(st.caret + 1)\n        st.caret = st.caret - 1\n        requery()\n      end\n    elseif c == KEY.del then\n      if st.caret < #st.query then\n        st.query = st.query:sub(1, st.caret) .. st.query:sub(st.caret + 2)\n        requery()\n      end\n    elseif c == KEY.left then\n      if alt then back()\n      elseif ctrl and st.view == \"index\" then set_all_families(false)\n      elseif st.caret > 0 then st.caret = st.caret - 1 end\n    elseif c == KEY.right then\n      if ctrl and st.view == \"index\" then set_all_families(true)\n      elseif st.caret < #st.query then st.caret = st.caret + 1 end\n    elseif c == KEY.home then\n      if ctrl then st.scroll = 0 else st.caret = 0 end\n    elseif c == KEY.fin then\n      if ctrl then st.scroll = math.huge else st.caret = #st.query end\n    elseif c == KEY.up then\n      if #st.sugg > 1 then\n        st.sel = (st.sel - 2) % #st.sugg + 1\n        st.view, st.entry, st.scroll, st.dirty = \"entry\", st.sugg[st.sel], 0, true\n      else\n        st.scroll = st.scroll - S(48)\n      end\n    elseif c == KEY.down then\n      if #st.sugg > 1 then\n        st.sel = st.sel % #st.sugg + 1\n        st.view, st.entry, st.scroll, st.dirty = \"entry\", st.sugg[st.sel], 0, true\n      else\n        st.scroll = st.scroll + S(48)\n      end\n    elseif c == KEY.pgup then\n      st.scroll = st.scroll - math.max(S(80), gfx.h - S(160))\n    elseif c == KEY.pgdn then\n      st.scroll = st.scroll + math.max(S(80), gfx.h - S(160))\n    elseif c == KEY.f1 then\n      go(\"help\", nil, true)\n    elseif c >= 32 and c <= 126 then\n      st.focus = nil                                   -- typing goes to the box\n      insert(string.char(c))\n    end\n  end\nend\n\n------------------------------------------------------------------------------\n-- WINDOW\n------------------------------------------------------------------------------\n\nlocal function num(s, dflt)\n  return tonumber(s) or dflt\nend\n\nload_text_size()\n-- The smallest window that opens grows with the text size, so the header's\n-- buttons and a few lines of the page always fit when it first appears.\nlocal grow = TEXT_SIZES[TEXTSIZE] / 100\nlocal win_w = math.max(math.floor(460 * grow), num(reaper.GetExtState(EXT, \"w\"), 760))\nlocal win_h = math.max(math.floor(360 * grow), num(reaper.GetExtState(EXT, \"h\"), 680))\nlocal win_x = num(reaper.GetExtState(EXT, \"x\"), 150)\nlocal win_y = num(reaper.GetExtState(EXT, \"y\"), 110)\nlocal win_d = num(reaper.GetExtState(EXT, \"dock\"), 0)\n\nload_open()\n\ngfx.ext_retina = 1\ngfx.init(\"Orchestration Helper\", win_w, win_h, win_d, win_x, win_y)\nif gfx.ext_retina and gfx.ext_retina > 1 then RETINA = gfx.ext_retina end\nrescale()\n\nreaper.atexit(function()\n  local d, wx, wy, ww, wh = gfx.dock(-1, 0, 0, 0, 0)\n  reaper.SetExtState(EXT, \"dock\", tostring(d or 0), true)\n  if ww and ww > 100 and wh and wh > 100 then\n    reaper.SetExtState(EXT, \"w\", tostring(math.floor(ww)), true)\n    reaper.SetExtState(EXT, \"h\", tostring(math.floor(wh)), true)\n    reaper.SetExtState(EXT, \"x\", tostring(math.floor(wx)), true)\n    reaper.SetExtState(EXT, \"y\", tostring(math.floor(wy)), true)\n  end\n  gfx.quit()\nend)\n\nrequery()\n\nlocal last_retina = gfx.ext_retina\n\n-- The window's title says what is open (gfx.init with a name alone retitles an\n-- open window), so the Window menu and the Dock name the page, not just the app.\nlocal shown_title = \"Orchestration Helper\"\nlocal function retitle()\n  local t = \"Orchestration Helper\"\n  if st.view == \"entry\" and st.entry then t = t .. \" \u00e2\u0080\u0094 \" .. st.entry.name\n  elseif st.view == \"help\" then t = t .. \" \u00e2\u0080\u0094 Help\"\n  elseif st.view == \"sources\" then t = t .. \" \u00e2\u0080\u0094 Sources\" end\n  if t ~= shown_title then\n    shown_title = t\n    gfx.init(t)\n  end\nend\n\nlocal function loop()\n  if not handle_keys() then return end\n\n  -- follow the window between displays of different pixel density\n  if gfx.ext_retina and gfx.ext_retina ~= last_retina then\n    last_retina = gfx.ext_retina\n    RETINA = (gfx.ext_retina > 1) and gfx.ext_retina or 1\n    rescale()\n    st.dirty = true\n  end\n\n  gfx.clear = math.floor(C.bg[1] * 255)\n            + math.floor(C.bg[2] * 255) * 256\n            + math.floor(C.bg[3] * 255) * 65536\n\n  st.hot = {}\n  local g = top_geometry()\n  -- body first, then the opaque header strip and footer paint over it\n  draw_body(g.top_h, gfx.h - g.footer_h)\n  draw_top(g)\n  draw_footer(g)\n  build_focus(g)\n  retitle()\n\n  handle_mouse()\n  gfx.update()\n  reaper.defer(loop)\nend\n\nloop()\n", "orchestration_composers.lua": "--[[\n  orchestration_composers.lua\n  Composer entries for Orchestration Helper - who favoured what, and why.\n\n  Loaded automatically by the main script if it sits alongside it. The script\n  works without this file; composers are simply absent.\n\n  Same editorial rule as the main database: cited claims only, and a combination\n  a source calls rare or exceptional is never presented as a recommendation.\n\n  A note on what these entries are for. They are not biographies. Each one\n  answers a working question: if I want this composer's sound, what did they\n  actually put together, and what would I reach for?\n\n  CITATION TAGS beyond those in orchestration_data.lua:\n    FILM - film-music references, see D.SOURCES.FILM below.\n]]--\n\nlocal D = { ENTRIES = {}, SOURCES = {} }\nlocal function e(t) D.ENTRIES[#D.ENTRIES + 1] = t; return t end\n\nD.SOURCES.FILM = {\n  tag   = \"FILM\",\n  short = \"Film-music references\",\n  full  = \"Present-day film-music references consulted together for the film \"\n       .. \"composer entries: score studies and analyses from Movie Music UK, the \"\n       .. \"Timbre and Orchestration Resource (ACTOR Project), Sound on Sound, \"\n       .. \"Soundfly/Flypaper, Classic FM, the Vienna Symphonic Library forum's \"\n       .. \"orchestration threads, publishers' and orchestras' programme notes \"\n       .. \"(LA Phil, Hollywood Bowl, Wise Music Classical), and Wikipedia's \"\n       .. \"articles on the individual scores and composers. Cited by tag, not by \"\n       .. \"page: see README.md on how these were consulted.\",\n}\n\n-- ============================================================================\n-- INDEX ENTRY\n-- ============================================================================\n\ne{ id=\"composers\", name=\"Composers: How to Use Them\", family=\"Reference\", kind=\"topic\",\n  aliases={\"composers\",\"composer\",\"who used\",\"famous composers\",\"study scores\",\n           \"learn from composers\",\"composer index\"},\n  summary=\"Every composer entry answers one working question: if you want this \"\n       .. \"sound, what did they actually put together? Look up a composer to get \"\n       .. \"their favoured combinations, their signature colours, and the specific \"\n       .. \"thing worth stealing.\",\n  sec={\n    {\"How to read a composer entry\", {\n      {\"Favoured combinations\",\"The doublings and pairings they returned to. \"\n        .. \"Cross-check these against the instrument pages: a combination that \"\n        .. \"appears on both is about as safe as orchestration gets.\",\"MOD\"},\n      {\"Signature colours\",\"The sound they are recognised by, and the \"\n        .. \"instrumentation that produces it.\",\"MOD\"},\n      {\"What to take from them\",\"The transferable lesson, separated from the \"\n        .. \"period style.\",\"MOD\"},\n    }},\n    {\"Rimsky-Korsakov\u00e2\u0080\u0099s advice on whom to study\", {\n      {\"Study the fairly modern, not the ancient\",\"\\\"Fairly modern music will \"\n        .. \"teach the student how to score - classical music will prove of \"\n        .. \"negative value to him... It is useless for a Berlioz or a Gevaert to \"\n        .. \"quote examples from the works of Gluck. The musical idiom is too \"\n        .. \"old-fashioned and strange to modern ears.\\\" He names Weber, \"\n        .. \"Mendelssohn, Meyerbeer, Berlioz, Glinka, Wagner, Liszt and the modern \"\n        .. \"French and Russians as the best guides.\",\"RK p.3-4\"},\n      {\"Beethoven stands apart\",\"\\\"His music abounds in countless leonine leaps \"\n        .. \"of orchestral imagination, but his technique, viewed in detail, \"\n        .. \"remains much inferior to his titanic conception\\\" - his trumpets stand \"\n        .. \"out above the orchestra, his horn intervals are difficult and unhappy. \"\n        .. \"Expect to \\\"stumble upon a thousand and one points in \"\n        .. \"contradiction\\\".\",\"RK p.4\"},\n      {\"The four phases a student passes through\",\"\\\"1. the phase during which he \"\n        .. \"puts his entire faith in percussion instruments... 2. the period when \"\n        .. \"he acquires a passion for the harp... 3. the stage during which he \"\n        .. \"adores the wood-wind and horns... 4. the more advanced period, when he \"\n        .. \"has come to recognise that the string group is the richest and most \"\n        .. \"expressive of all.\\\" Try to skip the first three.\",\"RK p.4\"},\n      {\"How to study\",\"\\\"The best plan is to study full-scores, and listen to an \"\n        .. \"orchestra, score in hand.\\\"\",\"RK p.4\"},\n    }},\n    {\"Belkin\u00e2\u0080\u0099s order for studying scores\", {\n      {\"1. Mendelssohn\",\"\\\"An excellent starting point... His orchestration is classical \"\n        .. \"in spirit, economical, simple, and always effective. Mendelssohn's part \"\n        .. \"writing is straightforward, his orchestration perfectly balanced, and his \"\n        .. \"figuration imaginative without being overly elaborate.\\\"\",\"BEL p.60\"},\n      {\"2. Tchaikovsky\",\"\\\"A logical next step, similar in technique to Mendelssohn, but \"\n        .. \"with a larger orchestra. Again, his orchestration is effective, clear, and \"\n        .. \"easily understood.\\\"\",\"BEL p.61\"},\n      {\"3. Bizet\u00e2\u0080\u0099s Carmen\",\"\\\"A basic text for orchestration with voices.\\\"\",\"BEL p.61\"},\n      {\"4. Mozart\",\"\\\"Although he uses an orchestra smaller than Mendelssohn's, has more \"\n        .. \"complex and refined methods of part writing, and therefore should follow, \"\n        .. \"rather than precede the latter.\\\"\",\"BEL p.61\"},\n      {\"5. Beethoven\",\"\\\"Introduces many novel orchestral ideas, and, properly \"\n        .. \"understood, his approach to the orchestra will greatly increase the student's \"\n        .. \"sophistication.\\\"\",\"BEL p.61\"},\n      {\"6. Wagner\",\"\\\"More advanced orchestration begins with Wagner, in particular the \"\n        .. \"richness of his orchestral polyphony as a norm, and the way he uses the \"\n        .. \"enlarged orchestral families.\\\"\",\"BEL p.61\"},\n      {\"7. Then Ravel, Mahler, Strauss\",\"Only after the rest have been assimilated. \"\n        .. \"\\\"Composers like Mahler and Ravel, wonderful orchestrators though they are, \"\n        .. \"are not suitable for beginners since their textures are often very rich and \"\n        .. \"complex.\\\"\",\"BEL p.60-61\"},\n    }},\n    {\"Where the two authorities disagree\", {\n      {\"They agree on Mendelssohn\",\"Both put him among the first composers a student \"\n        .. \"should study.\",\"RK p.4; BEL p.60\"},\n      {\"They disagree sharply about the classics\",\"Rimsky-Korsakov: \\\"Fairly modern \"\n        .. \"music will teach the student how to score - classical music will prove of \"\n        .. \"negative value to him\\\", and Mozart and Haydn are of \\\"no further use \"\n        .. \"today\\\". Belkin puts Mozart fourth in a graded sequence and Beethoven fifth, \"\n        .. \"as steps that increase sophistication.\",\"RK p.4; BEL p.61\"},\n      {\"And about where Wagner sits\",\"Rimsky-Korsakov lists Wagner among the basic \"\n        .. \"guides for a student. Belkin makes him the threshold of *advanced* study.\",\"RK p.4; BEL p.61\"},\n      {\"How to read the disagreement\",\"Rimsky-Korsakov was arguing in 1891 against a \"\n        .. \"conservatoire tradition that taught scoring from Gluck and Mozart, and \"\n        .. \"against an idiom he found too remote to imitate. Belkin is grading by \"\n        .. \"technical complexity for a student who will study all of it eventually. The \"\n        .. \"two are answering different questions.\",\"MOD\"},\n    }},\n    {\"Also worth studying, though not given entries here\", {\n      {\"Not covered, deliberately\",\"Nino Rota, Georges Delerue, Elmer Bernstein, \"\n        .. \"Maurice Jarre, Alfred Newman, Franz Waxman, James Horner, Thomas \"\n        .. \"Newman, Michael Giacchino, Hildur Gudnadottir, Ludwig Goransson; and \"\n        .. \"among the concert composers Sibelius, Copland, Britten, Bartok, \"\n        .. \"Prokofiev, Respighi, Janacek, Vaughan Williams, Messiaen and Ligeti. \"\n        .. \"They are omitted not for lack of interest but because this \"\n        .. \"encyclopaedia only records what it can cite, and the sources to hand \"\n        .. \"gave no orchestration specifics for them. Better an honest gap than a \"\n        .. \"confident guess.\",\"MOD\"},\n    }},\n  },\n  related={\"doubling\",\"blend\",\"balance\",\"orchestra\"},\n}\n\n-- ============================================================================\n-- CONCERT COMPOSERS\n-- ============================================================================\n\ne{ id=\"monteverdi\", name=\"Claudio Monteverdi\", family=\"Composers\", kind=\"composer\",\n  aliases={\"monteverdi\",\"monteverde\",\"claudio monteverdi\",\"claudio monteverde\"},\n  summary=\"The first composer to treat instrumentation as a choice rather than an \"\n       .. \"accident. Where earlier scores often left the instruments to the leader, \"\n       .. \"Monteverdi specified them.\",\n  facts={ {\"Dates\",\"1567-1643\"}, {\"Look at\",\"Orfeo (1607), Il Combattimento, \"\n          .. \"L'Incoronazione di Poppea\"} },\n  sec={\n    {\"His orchestra\", {\n      {\"Plucked continuo in quantity\",\"Chitarroni, theorbo and lutes formed the \"\n        .. \"backbone - instruments of five and six feet in length carrying six pairs \"\n        .. \"of unisons on the fingerboard and seven or eight open bass strings.\",\"SIN p.136-140\"},\n      {\"Strings already central\",\"Venetian and Roman orchestras of the period ran \"\n        .. \"to bodies of violins with alto violas, tenor, bass and contrabass, \"\n        .. \"against a handful of winds - flutes for pastoral scenes, trumpets for \"\n        .. \"the choral ones, cornets and trombones for the infernal ones.\",\"SIN p.155\"},\n    }},\n    {\"What to take from him\", {\n      {\"Assign the colour deliberately\",\"The habit of naming which instrument plays \"\n        .. \"which line - the root of everything in this encyclopaedia - starts here.\",\"MOD\"},\n    }},\n  },\n  instruments={\"plucked\",\"harp\",\"trombone\",\"strings\"},\n  related={\"composers\",\"plucked\",\"orchestra\"},\n}\n\ne{ id=\"bach\", name=\"Johann Sebastian Bach\", family=\"Composers\", kind=\"composer\",\n  aliases={\"bach\",\"js bach\",\"j s bach\",\"johann sebastian bach\",\"jsbach\"},\n  summary=\"\\\"Bach's contribution to the development of the Orchestra is that he \"\n       .. \"treated each separate instrument lovingly and as if it were an individual, \"\n       .. \"so that he prepared the way for the occasional solos in orchestral \"\n       .. \"compositions.\\\" Stravinsky: \\\"What incomparable instrumental writing is \"\n       .. \"Bach's. You can smell the resin in his violin parts, and taste the reeds \"\n       .. \"in the oboes.\\\"\",\n  facts={ {\"Dates\",\"1685-1750\"},\n          {\"Look at\",\"Magnificat BWV 243, Cantatas BWV 65 and 67, St John Passion, \"\n            .. \"Brandenburg Concertos\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Muted strings + flutes\",\"The accompaniment to 'et misericordia' from the \"\n        .. \"Magnificat: muted strings doubled by flutes, \\\"a subtle combination of \"\n        .. \"mellow instrumental timbres\\\".\",\"WP\"},\n      {\"Agitated strings handing over to sustained woodwind\",\"In Cantata BWV 67 the \"\n        .. \"strings dovetail with sustained woodwind chords to accompany the solo \"\n        .. \"singer - an effect John Eliot Gardiner likens to \\\"a cinematic \"\n        .. \"dissolve\\\".\",\"WP\"},\n      {\"Oboes and flutes in lyrical dialogue over a tremulant bass\",\"The opening of \"\n        .. \"the St John Passion: reiterated bass, sighing violas, swirling violins, \"\n        .. \"and above that ferment pairs of oboes and flutes locked together with \"\n        .. \"anguished dissonances.\",\"WP\"},\n      {\"Recorders, oboes da caccia, horns and strings together\",\"The opening chorus \"\n        .. \"of Cantata BWV 65 puts all four in eight bars, ranging from two horns \"\n        .. \"over a string pedal to the whole body spread across five octaves.\",\"WP\"},\n      {\"Many trumpets of different sizes\",\"\\\"The scores of Bach and Handel often \"\n        .. \"call for many trumpets. In their day it was necessary to use a number of \"\n        .. \"trumpets of different size, because no one instrument could play all the \"\n        .. \"notes required.\\\"\",\"SIN p.112\"},\n    }},\n    {\"Characteristic instruments\", {\n      {\"The obsolescent ones\",\"He wrote for a great many instruments already going \"\n        .. \"out of fashion: oboe d'amore, oboe da caccia, viola d'amore, viola da \"\n        .. \"gamba.\",\"SIN p.187\"},\n      {\"The violin as a self-sufficient voice\",\"With Bach \\\"the violin became a solo \"\n        .. \"instrument which could speak unaided for itself\\\"; his unaccompanied \"\n        .. \"violin works are \\\"the most stupendous works ever written by anybody for \"\n        .. \"a single instrument\\\".\",\"SIN p.186-187\"},\n      {\"Horn and flute\",\"He scored frequently for the horn, newly admitted to the \"\n        .. \"orchestra around 1720, and wrote six sonatas for the flute.\",\"SIN p.104 & p.77\"},\n    }},\n    {\"What to take from him\", {\n      {\"But not his colour scheme\",\"\\\"Bach's Orchestra and Handel's Orchestra were \"\n        .. \"both neutral in tint; or, if we prefer, black and white. The instruments \"\n        .. \"all played their separate parts, but their individual voices had as yet \"\n        .. \"hardly been discovered.\\\" Take the part-writing, not the palette.\",\"SIN p.192\"},\n      {\"Obbligato thinking\",\"One instrument set against the voice as an equal partner \"\n        .. \"- the ancestor of every solo-instrument-with-singer pairing.\",\"MOD\"},\n    }},\n  },\n  instruments={\"violin\",\"oboe\",\"flute\",\"englishhorn\",\"trumpet\",\"horn\",\"cello\"},\n  related={\"composers\",\"handel\",\"violin\",\"oboe\",\"strings_wind\"},\n}\n\ne{ id=\"handel\", name=\"George Frideric Handel\", family=\"Composers\", kind=\"composer\",\n  aliases={\"handel\",\"haendel\",\"george frideric handel\",\"georg friedrich handel\"},\n  summary=\"His scores look thin on the page because they were never the whole story: \"\n       .. \"he improvised at the keyboard and expected the gaps to be filled. What he \"\n       .. \"did fix in writing was the technique of individual instruments, through \"\n       .. \"obbligato arias.\",\n  facts={ {\"Dates\",\"1685-1759\"},\n          {\"Look at\",\"Messiah, Esther, Acis and Galatea, Il Penseroso, Rinaldo\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"One obbligato instrument against the voice\",\"\\\"As a rule, these arias are \"\n        .. \"accompanied by several instruments supporting one that plays an obbligato \"\n        .. \"part; and these show what Handel did to develop and exhibit the technique \"\n        .. \"of various instruments.\\\"\",\"SIN ch.VIII\"},\n      {\"Flute imitating a bird\",\"The obbligato to \\\"Sweet bird that shun'st the noise \"\n        .. \"of folly\\\" in Il Penseroso.\",\"SIN p.77\"},\n      {\"High flute with a bass voice\",\"\\\"O ruddier than the Cherry\\\" in Acis and \"\n        .. \"Galatea - written for the flute, now played on the piccolo, and given a \"\n        .. \"pastoral character.\",\"SIN p.79-80\"},\n      {\"Harp with theorbo\",\"In Esther (1720), \\\"Breathe soft, ye winds\\\" - one of the \"\n        .. \"first orchestral uses of the harp.\",\"SIN p.288\"},\n      {\"Violoncello obbligato\",\"He \\\"took great pleasure in the violoncello\\\" and gave \"\n        .. \"it obbligati in several oratorio and cantata arias.\",\"SIN p.58\"},\n    }},\n    {\"His orchestra\", {\n      {\"Woodwind-heavy balance\",\"\\\"The balance of Handel's Orchestra was very \"\n        .. \"different from ours, because of the overwhelming number of woodwind \"\n        .. \"instruments.\\\"\",\"SIN ch.VIII\"},\n      {\"Three bodies of strings\",\"A concertino of first violin, second violin and \"\n        .. \"solo 'cello; a concerto grosso of 8+8 violins, 6 violas, 4-6 'cellos and \"\n        .. \"4 basses; and a ripieno band of 6+6 violins, 4 violas, 3-4 'cellos and 3 \"\n        .. \"basses to fill in harmonies and support the solos.\",\"SIN p.190\"},\n      {\"Contrabassoon\",\"In use in his orchestra already.\",\"SIN p.101\"},\n    }},\n    {\"What to take from him\", {\n      {\"Terraced dynamics\",\"He made \\\"great use of crescendo and diminuendo\\\" at a \"\n        .. \"time when that was new; the effect came from adding and removing bodies of \"\n        .. \"players, not from players swelling.\",\"SIN ch.VIII; MOD\"},\n    }},\n  },\n  instruments={\"flute\",\"piccolo\",\"cello\",\"harp\",\"trumpet\",\"oboe\",\"contrabassoon\"},\n  related={\"composers\",\"bach\",\"harp\",\"flute\",\"strings\"},\n}\n\ne{ id=\"rameau\", name=\"Jean-Philippe Rameau\", family=\"Composers\", kind=\"composer\",\n  aliases={\"rameau\",\"jean philippe rameau\",\"jean-philippe rameau\"},\n  summary=\"\\\"He gave to the different members of the Orchestra an individual role; he \"\n       .. \"extended the technique of the violins; he made an increasing use of \"\n       .. \"arpeggios; and he was the first to use pizzicato chords with all the strings \"\n       .. \"at once. He also made a delicate and light use of the woodwind.\\\" Famous for \"\n       .. \"\\\"the eloquence of his orchestral writing... with a feeling for colour that \"\n       .. \"is altogether 'modern'\\\".\",\n  facts={ {\"Dates\",\"1683-1764\"},\n          {\"Look at\",\"Les Boreades, Hippolyte et Aricie, Castor et Pollux\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Bassoon scales through a string texture\",\"'The Entrance of Polymnie' from Les \"\n        .. \"Boreades: the predominant string texture \\\"is shot through with descending \"\n        .. \"scale figures on the bassoon, creating an exquisite blend of timbres\\\".\",\"WP\"},\n      {\"Two flutes + solo violin over sustained strings\",\"'Rossignols amoureux' from \"\n        .. \"Hippolyte et Aricie evokes lovelorn nightingales by blending two flutes \"\n        .. \"with a solo violin while the rest of the violins sustain in the background.\",\"WP\"},\n      {\"Pizzicato chords across the whole string body\",\"His innovation, and still a \"\n        .. \"useful attack.\",\"SIN p.166\"},\n    }},\n    {\"What to take from him\", {\n      {\"Light woodwind, not thick\",\"His woodwind use is \\\"delicate and light\\\" - a \"\n        .. \"corrective if your wind writing has gone stodgy.\",\"SIN p.166\"},\n    }},\n  },\n  instruments={\"bassoon\",\"flute\",\"violin\",\"pizzicato\",\"woodwind\"},\n  related={\"composers\",\"gluck\",\"bassoon\",\"flute\",\"pizzicato\"},\n}\n\ne{ id=\"gluck\", name=\"Christoph Willibald Gluck\", family=\"Composers\", kind=\"composer\",\n  aliases={\"gluck\",\"christoph gluck\",\"christoph willibald gluck\"},\n  summary=\"\\\"Gluck gave the Orchestra a new life, assigning the first place to it in \"\n       .. \"some cases, letting it express the feeling that captivates the listener. \"\n       .. \"With him violins, oboes and trombones are not merely sonorous agents; they \"\n       .. \"are living entities, personages of action... Gluck's great gift to the \"\n       .. \"Orchestra was to make it speak.\\\"\",\n  facts={ {\"Dates\",\"1714-1787\"}, {\"Look at\",\"Orfeo ed Euridice, Alceste, Armide, \"\n          .. \"Iphigenie en Tauride\"} },\n  sec={\n    {\"What he added and removed\", {\n      {\"Out went the harpsichord\",\"He removed the continuo keyboard from the \"\n        .. \"orchestra - the single change that forced everything else to carry the \"\n        .. \"harmony.\",\"SIN ch.VIII\"},\n      {\"In came harp and trombones\",\"And he employed the clarinets, then new.\",\"SIN ch.VIII\"},\n    }},\n    {\"Favoured combinations\", {\n      {\"Oboe with flute, and oboe with violin\",\"\\\"Perhaps the most beautiful use of \"\n        .. \"the oboe in all music is in Gluck's opera of Orfeo, in which it plays an \"\n        .. \"exquisite minuet with the flute and a beautiful ballet with the violin.\\\"\",\"SIN p.88\"},\n      {\"Flute alone in the Elysian Fields\",\"\\\"Its pure and ethereal voice, heard in a \"\n        .. \"solo of ravishing beauty, lifts us out of the everyday world.\\\"\",\"SIN p.77-78\"},\n      {\"Two stopped horns muting each other\",\"Charon's conch in Alceste: two horns in \"\n        .. \"D on middle C with both bells closed, so that \\\"the two instruments serve \"\n        .. \"mutually as a sordino; and the sounds, interclashing, assume a distant \"\n        .. \"accent and a cavernous quality of tone of the most strange and dramatic \"\n        .. \"effect\\\" (Berlioz).\",\"SIN p.105-106\"},\n      {\"Double basses doubled with violas and \u00e2\u0080\u0099cellos\",\"For the howling of Cerberus \"\n        .. \"in Orfeo - the first time anyone gave the double bass a characterising \"\n        .. \"role.\",\"SIN p.69\"},\n      {\"Clarinet instead of flute for desolation\",\"In Alceste's 'Ah, malgre moi' he had \"\n        .. \"first written the ritornello for flute, then moved it to clarinet, finding \"\n        .. \"the flute \\\"too weak and lacked the nobility necessary\\\".\",\"SIN p.100\"},\n      {\"Piccolo in unison, written in sixths\",\"In the tempest of Iphigenie en Tauride, \"\n        .. \"a fourth above the first violins, producing elevenths - \\\"the harshness of \"\n        .. \"which is here of the very best effect\\\" (Berlioz).\",\"SIN p.80\"},\n    }},\n    {\"Use sparingly\", {\n      {\"His horn writing generally\",\"\\\"The horn is of all orchestral instruments the \"\n        .. \"one which Gluck wrote least well for\\\" (Berlioz) - the Charon effect being \"\n        .. \"the exception.\",\"SIN p.105\"},\n      {\"And a warning from Rimsky-Korsakov\",\"He thought Gluck's idiom \\\"too \"\n        .. \"old-fashioned and strange to modern ears\\\" to serve as a model, however \"\n        .. \"much he admired the man.\",\"RK p.4\"},\n    }},\n  },\n  instruments={\"oboe\",\"flute\",\"clarinet\",\"horn\",\"trombone\",\"harp\",\"doublebass\",\"piccolo\"},\n  related={\"composers\",\"rameau\",\"haydn\",\"oboe\",\"horn\"},\n}\n\ne{ id=\"haydn\", name=\"Joseph Haydn\", family=\"Composers\", kind=\"composer\",\n  aliases={\"haydn\",\"joseph haydn\",\"papa haydn\",\"franz joseph haydn\"},\n  summary=\"Called the Father of the Orchestra, and by Rimsky-Korsakov's reckoning the \"\n       .. \"greatest of all masters of orchestration. He had what few composers ever \"\n       .. \"have: a standing orchestra he could test ideas on the same afternoon he had \"\n       .. \"them.\",\n  facts={ {\"Dates\",\"1732-1809\"},\n          {\"His orchestra\",\"String quartet, 2 flutes, 2 oboes, 2 clarinets, 2 \"\n            .. \"bassoons, 2 horns, 2 trumpets and kettledrums\"},\n          {\"Look at\",\"Symphonies 94 (Surprise), 97, 100 (Military), The Creation\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Kettledrums and trumpets pianissimo\",\"The minuet of Symphony 97 renders a \"\n        .. \"German dance band \\\"with the utmost refinement, amazingly by kettledrums \"\n        .. \"and trumpets pianissimo\\\", the rustic glissando given \\\"a finicky elegance \"\n        .. \"by the grace notes in the horns\\\".\",\"WP\"},\n      {\"Melody doubled an octave up by a solo violin\",\"In the same movement - and \"\n        .. \"these details \\\"are not intended to blend, but to be set in relief; they \"\n        .. \"are individually exquisite\\\".\",\"WP\"},\n      {\"Oboes and bassoons over sustained strings\",\"The close of Symphony 94's second \"\n        .. \"movement: oboes and bassoons take the theme while the strings accompany \"\n        .. \"with \\\"soft, but very dissonant harmony\\\", flute, horns and timpani added \"\n        .. \"to the mix.\",\"WP\"},\n      {\"High bassoon as a principal voice\",\"In the minuet of the Military Symphony a \"\n        .. \"bassoon melody reaches the treble A - one of \\\"the most prominent voices of \"\n        .. \"his orchestra\\\".\",\"SIN p.96\"},\n      {\"A trio for flutes\",\"In The Creation.\",\"SIN p.77\"},\n      {\"Contrabassoon\",\"Also in The Creation.\",\"SIN p.101\"},\n    }},\n    {\"Characteristic instruments\", {\n      {\"The kettledrums\",\"\\\"His practical knowledge of the kettledrums made him very \"\n        .. \"partial to them; and he was the first to give this instrument an \"\n        .. \"individuality and artistic part in the Orchestra.\\\" He played them as a \"\n        .. \"boy.\",\"SIN p.200-201\"},\n      {\"Percussion as an exception\",\"The Military Symphony's big drum, triangle and \"\n        .. \"cymbals were exceptional for him - and for the period.\",\"SIN p.219\"},\n      {\"Two horns as standard\",\"He and Mozart \\\"generally called for two horns in \"\n        .. \"their scores\\\" and were the first to write real music rather than fanfares \"\n        .. \"for them.\",\"SIN p.104\"},\n    }},\n    {\"What to take from him\", {\n      {\"Know the instrument before you write the note\",\"\\\"As soon as his imagination \"\n        .. \"supplied him with a passage, a chord, or a single note, he immediately saw \"\n        .. \"by what instrument it should be executed, in order to produce the most \"\n        .. \"sonorous and agreeable effect.\\\" Where he was unsure, he called a rehearsal \"\n        .. \"and had it played three ways.\",\"SIN p.196\"},\n      {\"Relief, not blend\",\"Much of his best scoring sets a detail deliberately apart \"\n        .. \"from the texture rather than folding it in.\",\"WP\"},\n    }},\n  },\n  instruments={\"timpani\",\"bassoon\",\"flute\",\"horn\",\"oboe\",\"trumpet\",\"contrabassoon\",\n               \"triangle\",\"cymbals\",\"strings\"},\n  related={\"composers\",\"mozart\",\"beethoven\",\"timpani\",\"bassoon\"},\n}\n\ne{ id=\"mozart\", name=\"Wolfgang Amadeus Mozart\", family=\"Composers\", kind=\"composer\",\n  aliases={\"mozart\",\"wolfgang mozart\",\"wolfgang amadeus mozart\",\"wa mozart\"},\n  summary=\"\\\"What did Mozart do towards the development of our modern Orchestra? The \"\n       .. \"question is easily answered. Mozart gave the Orchestra tone-color.\\\" Before \"\n       .. \"him a melody could go to almost any instrument; after him each instrument \"\n       .. \"had to \\\"speak for itself and with its own true voice\\\".\",\n  facts={ {\"Dates\",\"1756-1791\"},\n          {\"Look at\",\"Symphonies 39, 40 and 41, Don Giovanni, Piano Concerto K482, \"\n            .. \"Clarinet Concerto, Requiem\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Strings answered by woodwind\",\"The opening of Symphony 39 contains \\\"a \"\n        .. \"charming dialogue between strings and woodwind\\\" - first and second violins \"\n        .. \"weaving parallel lines a tenth apart over a double-bass pedal and a \"\n        .. \"sustained horn octave, the wind answering two bars later against a spidery \"\n        .. \"chromatic line in the 'cellos.\",\"WP\"},\n      {\"Clarinets and bassoons with the lower strings supplying the bass\",\"The \"\n        .. \"continuation of that passage.\",\"WP\"},\n      {\"Pizzicato \u00e2\u0080\u0099cellos and basses under bowed violins and violas in thirds\",\"A few \"\n        .. \"bars later - the same material, a new colour.\",\"WP\"},\n      {\"Violins as the bass for solo clarinets\",\"In the Piano Concerto K482: \\\"the \"\n        .. \"unusual sound on the violins providing the bass for the solo clarinets. The \"\n        .. \"simplicity of the sequence concentrates all our interest on \"\n        .. \"tone-colour.\\\"\",\"WP\"},\n      {\"Antiphony between wind and strings\",\"In the trio of Symphony 41's minuet, \"\n        .. \"flute, bassoons and horn exchange phrases with the strings, the first violin \"\n        .. \"doubled at the octave by the first oboe.\",\"WP\"},\n      {\"Horns and bassoon answering the full tutti\",\"The opening of K482: two bars of \"\n        .. \"tutti answered by horns and bassoon alone.\",\"WP\"},\n      {\"Basset horn with the voice\",\"The obbligato to 'Non piu di fiori' in La Clemenza \"\n        .. \"di Tito; two basset horns in the Requiem.\",\"SIN p.101\"},\n      {\"Flute and harp\",\"He wrote a concerto for the pair.\",\"SIN p.288\"},\n    }},\n    {\"Characteristic instruments\", {\n      {\"The clarinet\",\"\\\"Mozart was the first to appreciate the beauties and \"\n        .. \"capabilities of the clarinet.\\\" His Symphony in E-flat is so full of it that \"\n        .. \"it is called the Clarinet Symphony. On first hearing clarinets at Mannheim: \"\n        .. \"\\\"Oh, if we only had clarinets! You cannot think what a splendid effect a \"\n        .. \"symphony makes with flutes, oboes and clarinets!\\\"\",\"SIN p.99 & p.212\"},\n      {\"The viola\",\"\\\"Mozart gave the viola its proper place in the Orchestra, making \"\n        .. \"it something more than a large violin filling up a gap between soprano and \"\n        .. \"bass.\\\" Listen to it under Zerlina's 'Vedrai carino'.\",\"SIN p.49-50\"},\n      {\"The bassoon\",\"\\\"Until Mozart's time the bassoon was little else but an \"\n        .. \"instrument for doubling the bass of the Strings; but Mozart did great things \"\n        .. \"with it.\\\"\",\"SIN p.96\"},\n      {\"Trombones held in reserve\",\"Kept out of Don Giovanni until the statue scene, so \"\n        .. \"they arrive as a climax; also for the priests' march in The Magic Flute.\",\"SIN p.115\"},\n    }},\n    {\"What to take from him\", {\n      {\"Spacing\",\"\\\"A meticulous attitude towards the spacing of chords\\\" - and a \"\n        .. \"density that is \\\"part of his density of thought\\\".\",\"WP\"},\n      {\"Orchestrate the repeat differently\",\"His habit of restating four bars with a \"\n        .. \"fresh colour is the cheapest variety in orchestration and still the most \"\n        .. \"effective.\",\"WP; MOD\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Study him after Mendelssohn, not before\",\"\\\"Although he uses an orchestra \"\n        .. \"smaller than Mendelssohn's, [he] has more complex and refined methods of part \"\n        .. \"writing, and therefore should follow, rather than precede the latter.\\\"\",\"BEL p.61\"},\n      {\"Why his scoring stays fresh\",\"\\\"Color is less the result of exotic timbres than \"\n        .. \"of novelty in the context of the piece. Even a familiar timbre like an oboe \"\n        .. \"can sound striking and novel, provided it has not been heard for a while. \"\n        .. \"This is why Mozart's orchestration is always so fresh, despite its limited \"\n        .. \"number of colors.\\\"\",\"BEL p.33\"},\n      {\"Heterophony in a tutti\",\"The Figaro overture keeps a tutti \\\"light and \"\n        .. \"transparent\\\" because upper winds and strings follow the same outline with \"\n        .. \"different detail, rather than doubling literally.\",\"BEL p.38\"},\n    }},\n  },\n  instruments={\"clarinet\",\"viola\",\"bassoon\",\"horn\",\"flute\",\"oboe\",\"trombone\",\"harp\",\n               \"strings\",\"pizzicato\"},\n  related={\"composers\",\"haydn\",\"beethoven\",\"clarinet\",\"viola\",\"bassoon\"},\n}\n\ne{ id=\"beethoven\", name=\"Ludwig van Beethoven\", family=\"Composers\", kind=\"composer\",\n  aliases={\"beethoven\",\"ludwig van beethoven\",\"ludwig beethoven\"},\n  summary=\"He brought instrument after instrument forward into a soloist's role - and \"\n       .. \"wrote for them so demandingly that players had to improve their technique to \"\n       .. \"keep up. Rimsky-Korsakov admired the imagination and distrusted the \"\n       .. \"technique.\",\n  facts={ {\"Dates\",\"1770-1827\"},\n          {\"Look at\",\"Symphonies 3, 5, 6, 9; Piano Concerto 5; Egmont and Leonore \"\n            .. \"overtures\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Violas + \u00e2\u0080\u0099cellos carrying the melody\",\"The Andante of the Fifth. \\\"The first \"\n        .. \"critics who heard this Symphony noticed to their amazement that the \"\n        .. \"violoncellos gained roundness and purity of tone from their association with \"\n        .. \"the viola!\\\" Violas also sing with 'cellos and bassoons in the Egmont \"\n        .. \"Overture.\",\"SIN p.50\"},\n      {\"\u00e2\u0080\u0099Cello + double bass alone\",\"The opening of the Fifth's Scherzo as a solo for \"\n        .. \"the two - \\\"the people who first heard such a strange innovation were aghast \"\n        .. \"and horrified\\\".\",\"SIN p.70\"},\n      {\"Horns in unison with strings, over a bassoon pedal\",\"The Emperor Concerto's \"\n        .. \"second subject: horns legato on the tune, sustained bassoon pedal beneath, \"\n        .. \"violins simultaneously playing an elaborated version, timpani and pizzicato \"\n        .. \"lower strings adding colour. The same theme appears in five different \"\n        .. \"orchestrations across the movement.\",\"WP\"},\n      {\"Bassoon against \u00e2\u0080\u0099cellos and violins in unison\",\"The opening of the Ninth's \"\n        .. \"Finale - the theme in 'cellos and violins, accompanied by \\\"a long \"\n        .. \"independent melody of the greatest ingenuity\\\" in the first bassoon.\",\"SIN p.96-97\"},\n      {\"Two bassoons working independently, then joining two clarinets\",\"The First \"\n        .. \"Symphony's slow movement and the trio's \\\"curious dialogue between strings \"\n        .. \"and reeds\\\".\",\"SIN p.96\"},\n      {\"Bird calls by instrument\",\"In the Pastoral: flute the nightingale, oboe the \"\n        .. \"quail, two clarinets the cuckoo.\",\"SIN p.99\"},\n      {\"Extreme contrast bar by bar\",\"The Scherzo of the Second: \\\"we have first the \"\n        .. \"full orchestra, then a single violin, then two horns, then two violins, then \"\n        .. \"the full orchestra again, all within the space of half-a-dozen bars\\\".\",\"WP\"},\n    }},\n    {\"What he added\", {\n      {\"Piccolo, trombones and contrabassoon\",\"All three make their first appearance in \"\n        .. \"his symphonies in the Fifth.\",\"SIN p.229\"},\n      {\"Three horns\",\"The Eroica - \\\"perhaps the first appearance of three horns in the \"\n        .. \"Orchestra\\\".\",\"SIN p.220\"},\n      {\"Timpani as a solo instrument\",\"He changed only how they were tuned, and \\\"that \"\n        .. \"made all the difference in the world\\\": a minor sixth in the Seventh's \"\n        .. \"Scherzo, octaves in the Ninth's finale, the dominant rather than the tonic in \"\n        .. \"the First.\",\"SIN p.120 & p.219\"},\n      {\"The double bass as a voice\",\"In the Ninth he uses it with the viola \\\"as a kind \"\n        .. \"of bridge leading from the sounds of instruments to human voices\\\".\",\"SIN p.70\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Don\u00e2\u0080\u0099t copy his brass or horn intervals\",\"Rimsky-Korsakov: \\\"His use of the \"\n        .. \"trumpets, standing out above the rest of the orchestra, the difficult and \"\n        .. \"unhappy intervals he gives to the horns, the distinctive features of the \"\n        .. \"string parts and his often highly-coloured employment of the wood-wind - \"\n        .. \"these features will combine causing the student of Beethoven to stumble upon \"\n        .. \"a thousand and one points in contradiction.\\\"\",\"RK p.4\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Fifth in the study order\",\"\\\"Introduces many novel orchestral ideas, and, \"\n        .. \"properly understood, his approach to the orchestra will greatly increase the \"\n        .. \"student's sophistication.\\\" A milder view than Rimsky-Korsakov's.\",\"BEL p.61\"},\n      {\"The textbook orchestral crescendo\",\"The Ninth's opening: \\\"the magnificent \"\n        .. \"crescendo is achieved by gradually adding instruments: violin 1, double bass, \"\n        .. \"viola, clarinet, oboe, flute, bassoon\\\".\",\"BEL p.27\"},\n      {\"The soft tutti\",\"The Ninth's first movement, bar 469 - Belkin's example of a \"\n        .. \"quiet tutti sounding \\\"like a great power restrained\\\".\",\"BEL p.49\"},\n      {\"Counterpoint kept in one family\",\"The Seventh's second movement puts all the \"\n        .. \"counterpoint in the strings - the simplest way to balance \"\n        .. \"polyphony.\",\"BEL p.47\"},\n    }},\n  },\n  instruments={\"viola\",\"cello\",\"doublebass\",\"bassoon\",\"timpani\",\"horn\",\"piccolo\",\n               \"trombone\",\"contrabassoon\",\"clarinet\",\"flute\",\"oboe\"},\n  related={\"composers\",\"mozart\",\"haydn\",\"weber\",\"viola\",\"timpani\",\"bassoon\"},\n}\n\ne{ id=\"weber\", name=\"Carl Maria von Weber\", family=\"Composers\", kind=\"composer\",\n  aliases={\"weber\",\"carl maria von weber\",\"von weber\",\"carl weber\"},\n  summary=\"\\\"Weber's instrumentation was founded on Beethoven's. He introduced no new \"\n       .. \"instruments. What he did was to develop the woodwind and make new and lovely \"\n       .. \"combinations.\\\" He is also, by Berlioz's reckoning and everyone else's, the \"\n       .. \"composer of the horn - and \\\"the composer, par excellence, of the clarinet\\\".\",\n  facts={ {\"Dates\",\"1786-1826\"},\n          {\"Look at\",\"Der Freischutz, Oberon, Euryanthe\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Four horns as a forest\",\"The introduction to the Der Freischutz overture - \\\"an \"\n        .. \"exquisite introduction for four horns, descriptive of the forest\\\". In \"\n        .. \"Preciosa he calls for eight.\",\"SIN p.104 & p.109\"},\n      {\"Two piccolos in thirds\",\"\\\"Everyone has remarked the diabolic sneer of the two \"\n        .. \"piccolo flutes in thirds in the drinking-song of Freischutz. It is one of \"\n        .. \"Weber's happiest orchestral inventions\\\" (Berlioz).\",\"SIN p.81\"},\n      {\"Clarinet over a string tremolo\",\"\\\"The dreamy phrase of the clarinet accompanied \"\n        .. \"by a tremolo of stringed instruments in the midst of the Allegro of the \"\n        .. \"Overture to Freischutz\\\" - Berlioz's chosen example of the clarinet's power \"\n        .. \"to produce distance and twilight.\",\"SIN p.99\"},\n      {\"Clarinet arpeggios with flute\",\"The \\\"drops of water\\\" figures.\",\"SIN p.100\"},\n      {\"Low clarinet for terror\",\"\\\"It was reserved for Weber to discover all that there \"\n        .. \"is of the terrible in the quality of tone of these low sounds.\\\"\",\"SIN p.100\"},\n    }},\n    {\"What to take from him\", {\n      {\"The horn as a character, not a section\",\"Berlioz: \\\"No master, in my opinion, has \"\n        .. \"ever known how to avail himself of its powers more originally, more \"\n        .. \"poetically, and, at the same time, more completely than Weber. In his three \"\n        .. \"finest works - Oberon, Euryanthe and Freischutz - he causes the horn to speak \"\n        .. \"a language as admirable as it is novel.\\\"\",\"SIN p.105\"},\n      {\"Learn the instrument from its player\",\"Weber toured with the clarinettist \"\n        .. \"Baermann and \\\"learned much from the latter about the resources of this \"\n        .. \"instrument\\\".\",\"SIN ch.VIII\"},\n      {\"And Rimsky-Korsakov\u00e2\u0080\u0099s endorsement\",\"Weber heads his list of the composers a \"\n        .. \"student should actually study for scoring.\",\"RK p.4\"},\n    }},\n  },\n  instruments={\"horn\",\"clarinet\",\"piccolo\",\"flute\",\"woodwind\",\"strings\"},\n  related={\"composers\",\"beethoven\",\"mendelssohn\",\"horn\",\"clarinet\",\"piccolo\"},\n}\n\ne{ id=\"schubert\", name=\"Franz Schubert\", family=\"Composers\", kind=\"composer\",\n  aliases={\"schubert\",\"franz schubert\"},\n  summary=\"\\\"Schubert's gift to the Orchestra was his novel way of writing for the \"\n       .. \"trombones and for his use of the woodwind. He gave a conversational treatment \"\n       .. \"of oboe, flute and clarinet.\\\"\",\n  facts={ {\"Dates\",\"1797-1828\"},\n          {\"Look at\",\"Symphony 8 (Unfinished), Symphony 9 in C (the Great)\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Clarinet and oboe in unison\",\"The Unfinished Symphony's famous unison \"\n        .. \"clarinet-and-oboe melody - the standard counter-example to the modern warning \"\n        .. \"against doubling those two.\",\"MOD\"},\n      {\"Two horns in unison, unaccompanied\",\"The Symphony in C opens with eight bars for \"\n        .. \"the pair.\",\"SIN p.104\"},\n      {\"Conversational woodwind\",\"Oboe, flute and clarinet handing a line between them \"\n        .. \"rather than doubling it.\",\"SIN ch.VIII\"},\n      {\"Oboe in the slow movement\",\"\\\"Schubert uses it charmingly in the second movement \"\n        .. \"of his Symphony in C-major.\\\"\",\"SIN p.88\"},\n      {\"Trombones used melodically\",\"\\\"Schubert uses them strikingly in his Symphony in \"\n        .. \"C.\\\"\",\"SIN p.115\"},\n    }},\n    {\"His orchestra\", {\n      {\"Symphony 5, without trumpets or drums\",\"2 violins, viola, 'cello, double bass, \"\n        .. \"one flute, 2 oboes, 2 bassoons, 2 horns - worth studying as a deliberately \"\n        .. \"reduced palette.\",\"SIN ch.VIII\"},\n      {\"Symphony 9 in C\",\"2 violins, viola, 'cello, double bass; 2 flutes, 2 oboes, 2 \"\n        .. \"clarinets, 2 bassoons, 2 horns, 2 trumpets and drums.\",\"SIN ch.VIII\"},\n    }},\n  },\n  instruments={\"clarinet\",\"oboe\",\"horn\",\"trombone\",\"flute\",\"woodwind\"},\n  related={\"composers\",\"beethoven\",\"weber\",\"clarinet\",\"oboe\",\"trombone\"},\n}\n\ne{ id=\"mendelssohn\", name=\"Felix Mendelssohn\", family=\"Composers\", kind=\"composer\",\n  aliases={\"mendelssohn\",\"felix mendelssohn\",\"mendelsohn\"},\n  summary=\"\\\"Mendelssohn's orchestration is noted for its perfect balance, its clarity \"\n       .. \"and its polish. He seems to have cared less for the brass than the other \"\n       .. \"groups.\\\" The model to study if your scoring is muddy.\",\n  facts={ {\"Dates\",\"1809-1847\"},\n          {\"Look at\",\"A Midsummer Night's Dream, Hebrides Overture, Elijah, Violin \"\n            .. \"Concerto, Scotch Symphony\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Horns in soft close harmony\",\"The Nocturne of A Midsummer Night's Dream - \\\"a \"\n        .. \"most poetic and dreamy use\\\". The overture's opening chords are \\\"the horns of \"\n        .. \"Elfland faintly blowing\\\".\",\"SIN p.104 & p.6\"},\n      {\"Sustained flute chords\",\"In the Midsummer Night's Dream overture, with a \"\n        .. \"celebrated flute passage in the Scherzo.\",\"SIN p.77\"},\n      {\"Two bassoons in thirds, comically\",\"The Clown's March in the same work; and the \"\n        .. \"Funeral March imitates \\\"a small country band, consisting of clarinet and \"\n        .. \"bassoon, the latter ending unexpectedly and humorously on a solitary low \"\n        .. \"C\\\".\",\"SIN p.97\"},\n      {\"Bassoon with trombones\",\"\\\"The grand chords of the Overture to Ruy Blas\\\"; and he \"\n        .. \"used the bassoon's low register at the opening of the Scotch Symphony.\",\"SIN p.97\"},\n      {\"Clarinet for water\",\"\\\"Mendelssohn also used the clarinet for the idea of water. \"\n        .. \"It is very evident in the Hebrides Overture and in the Overture of Melusine it \"\n        .. \"suggests the rolling waves.\\\"\",\"SIN p.100\"},\n      {\"\u00e2\u0080\u0099Cello obbligato with a solo voice\",\"\\\"It is Enough\\\" in Elijah - finer even than \"\n        .. \"the solo in Saint Paul.\",\"SIN p.58-59\"},\n      {\"Flute obbligato in a vocal quartet\",\"\\\"O Rest in the Lord\\\" in Elijah.\",\"SIN p.77\"},\n      {\"Contrabassoon\",\"In the Hebrides Overture.\",\"SIN p.101\"},\n    }},\n    {\"What to take from him\", {\n      {\"Balance first\",\"Clarity and polish are his subject. If a passage of yours does \"\n        .. \"not come through, the fault is usually spacing and doubling, not choice of \"\n        .. \"instrument - and he is the clearest demonstration of that.\",\"SIN ch.VIII; MOD\"},\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s endorsement\",\"Another of the handful he names as a model for \"\n        .. \"students of scoring.\",\"RK p.4\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Where to start\",\"\\\"An excellent starting point\\\" for learning orchestration \"\n        .. \"from the repertoire: \\\"classical in spirit, economical, simple, and always \"\n        .. \"effective\\\", with straightforward part-writing, perfectly balanced \"\n        .. \"orchestration, and \\\"figuration imaginative without being overly \"\n        .. \"elaborate\\\".\",\"BEL p.60\"},\n    }},\n  },\n  instruments={\"horn\",\"flute\",\"clarinet\",\"bassoon\",\"cello\",\"violin\",\"contrabassoon\"},\n  related={\"composers\",\"weber\",\"schubert\",\"horn\",\"flute\",\"clarinet\",\"balance\"},\n}\n\ne{ id=\"berlioz\", name=\"Hector Berlioz\", family=\"Composers\", kind=\"composer\",\n  aliases={\"berlioz\",\"hector berlioz\"},\n  summary=\"\\\"The Father of Modern Orchestration\\\", and the first composer for whom \"\n       .. \"orchestration \\\"was intrinsic to composition, not something applied to \"\n       .. \"finished music\\\". He wrote the Treatise on Instrumentation that every later \"\n       .. \"author, including Rimsky-Korsakov, argues with.\",\n  facts={ {\"Dates\",\"1803-1869\"},\n          {\"Look at\",\"Symphonie fantastique, Romeo et Juliette, Harold en Italie, \"\n            .. \"La Damnation de Faust, L'Enfance du Christ\"} },\n  sec={\n    {\"What he discovered\", {\n      {\"Pianissimo brass\",\"He \\\"discovered the value of pianissimo brass effects\\\" - a \"\n        .. \"colour the earlier orchestra had barely used.\",\"SIN p.247\"},\n      {\"Divided violins\",\"\\\"The ethereal charm of harmonies on divided violins\\\", and he \"\n        .. \"divided the strings into many parts.\",\"SIN p.247\"},\n      {\"The viola\",\"\\\"He discovered the true worth of the viola\\\" and wrote Harold en \"\n        .. \"Italie around a solo one for Paganini's Stradivari.\",\"SIN p.247 & p.50\"},\n      {\"The harp in the symphony orchestra\",\"His introduction.\",\"SIN p.247\"},\n      {\"Instruments grouped as families\",\"\\\"He grouped instruments into families and got \"\n        .. \"from them rich chords in different shades of the same tone-color\\\" - the \"\n        .. \"principle Wagner then built on.\",\"SIN p.247\"},\n      {\"The tuba over the ophicleide\",\"He advocated the swap.\",\"SIN p.247\"},\n      {\"The hidden orchestra\",\"He advocated the sunken pit that Wagner built at \"\n        .. \"Bayreuth.\",\"SIN p.247\"},\n    }},\n    {\"Favoured combinations\", {\n      {\"Timpani + double basses in thick low chords against muted brass\",\"The opening of \"\n        .. \"the March to the Scaffold - \\\"chords in close position in the low register of \"\n        .. \"the double basses\\\", against snarling muted brass, which runs \\\"counter to the \"\n        .. \"rules of composition in general\\\".\",\"WP\"},\n      {\"Low clarinet + high harps + antique cymbals\",\"The end of the Queen Mab scherzo: \"\n        .. \"\\\"the sounds become more ethereal and fairylike... some of the most ethereally \"\n        .. \"brilliant music ever penned\\\".\",\"WP\"},\n      {\"Two flutes and harp\",\"The trio in L'Enfance du Christ; he also uses two flutes \"\n        .. \"and harp for the Cris des Ismaelites.\",\"SIN p.288 & p.78\"},\n      {\"Three piccolos\",\"In the Minuet of the Will o' the Wisps in La Damnation de \"\n        .. \"Faust.\",\"SIN p.81\"},\n      {\"Piccolo for gilding\",\"He liked the piccolo as ornamentation on the top of the \"\n        .. \"woodwind - but condemned using it merely to sharpen the orchestra \\\"for the \"\n        .. \"sake of noise only\\\" as \\\"a stupid method of instrumentation\\\".\",\"SIN p.79-81\"},\n    }},\n    {\"What to take from him\", {\n      {\"Orchestration is composition\",\"\\\"In his hands timbre became something that could \"\n        .. \"be used in free combinations, as an artist might use his palette, without \"\n        .. \"bowing to the demands of line, and this leads to the rich orchestral resource \"\n        .. \"of Debussy and Ravel\\\" (New Grove).\",\"WP\"},\n      {\"Delicacy, not just scale\",\"Queen Mab is \\\"Berlioz's supreme exercise in light \"\n        .. \"orchestral texture, a brilliant, gossamer fabric, prestissimo and pianissimo \"\n        .. \"almost without pause\\\" - the answer to anyone who thinks him only a \"\n        .. \"monster-orchestra man.\",\"WP\"},\n    }},\n  },\n  instruments={\"viola\",\"harp\",\"timpani\",\"doublebass\",\"clarinet\",\"piccolo\",\"flute\",\n               \"cymbals\",\"brass\",\"strings\"},\n  related={\"composers\",\"wagner\",\"liszt\",\"viola\",\"harp\",\"strings_brass\"},\n}\n\ne{ id=\"liszt\", name=\"Franz Liszt\", family=\"Composers\", kind=\"composer\",\n  aliases={\"liszt\",\"franz liszt\"},\n  summary=\"\\\"In his orchestration Liszt followed Beethoven, Berlioz and Wagner. It is \"\n       .. \"always rich and heavy and full of color. Liszt makes great use of the harp and \"\n       .. \"his Hungarian blood shows itself in his marvellous and stirring rhythms.\\\"\",\n  facts={ {\"Dates\",\"1811-1886\"},\n          {\"Look at\",\"Mazeppa, Hungarian Rhapsodies, Piano Concerto in E-flat\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"The harp, everywhere\",\"\\\"Liszt treats the harp most poetically; and it occurs in \"\n        .. \"almost all of his works.\\\"\",\"SIN p.288\"},\n      {\"Triangle as a near-soloist\",\"\\\"Liszt made almost a solo part for this instrument \"\n        .. \"in the accompaniment to his Concerto for the Pianoforte in E-flat.\\\"\",\"SIN p.124\"},\n      {\"Bass clarinet\",\"\\\"Liszt has a good part for it in his Mazeppa.\\\"\",\"SIN p.101\"},\n      {\"Flute in the foreground\",\"Conspicuous in the Hungarian Rhapsody No. 2.\",\"SIN p.78\"},\n      {\"Col legno strings\",\"He calls for it in Mazeppa.\",\"SIN p.15\"},\n    }},\n    {\"What to take from him\", {\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s endorsement\",\"Named among the best guides for a student of \"\n        .. \"scoring.\",\"RK p.4\"},\n    }},\n  },\n  instruments={\"harp\",\"triangle\",\"bassclarinet\",\"flute\",\"strings\"},\n  related={\"composers\",\"berlioz\",\"wagner\",\"harp\",\"triangle\"},\n}\n\ne{ id=\"wagner\", name=\"Richard Wagner\", family=\"Composers\", kind=\"composer\",\n  aliases={\"wagner\",\"richard wagner\"},\n  summary=\"\\\"Wagner is the greatest master of orchestration that the world has ever \"\n       .. \"seen.\\\" His governing idea was to complete each family of wind so that every \"\n       .. \"group could produce full chords in its own timbre, without mixture unless he \"\n       .. \"chose - and then to move his themes around those pure colours.\",\n  facts={ {\"Dates\",\"1813-1883\"},\n          {\"Look at\",\"Lohengrin, Tristan und Isolde, Die Meistersinger, the Ring, \"\n            .. \"Parsifal\"} },\n  sec={\n    {\"His organising principle\", {\n      {\"Complete each family for full chords\",\"\\\"Wagner rarely employs instruments \"\n        .. \"unknown to Beethoven, but he completes each group or family of wind-instruments \"\n        .. \"with a view to getting full chords from each group.\\\" Two clarinets become \"\n        .. \"three plus a bass clarinet; two oboes become three plus a cor anglais; two \"\n        .. \"bassoons become three plus a contrabassoon; two trumpets become three plus a \"\n        .. \"bass trumpet.\",\"SIN ch.VIII\"},\n      {\"Then keep the timbres unmixed\",\"\\\"Each set of instruments can thus produce \"\n        .. \"complete chords and can be employed in full harmony without mixture of \"\n        .. \"timbre unless the composer so chooses.\\\"\",\"SIN ch.VIII\"},\n      {\"Simple methods, large forces\",\"\\\"Notwithstanding the large number of performers \"\n        .. \"he requires, he never has recourse to complicated methods in his \"\n        .. \"orchestration. The combinations are always clear and simple, resulting in a \"\n        .. \"sonority that is both plain and powerful.\\\"\",\"SIN ch.VIII\"},\n      {\"A theme, an instrument\",\"The leitmotifs move all around the orchestra, \\\"but, \"\n        .. \"nevertheless, each one has a fondness for one special instrument, or one group \"\n        .. \"of instruments, which agrees with its character, on which it is first heard and \"\n        .. \"to which it returns whenever it must be heard again with preponderating \"\n        .. \"importance\\\".\",\"SIN ch.VIII\"},\n    }},\n    {\"Favoured combinations\", {\n      {\"Eight horns for moving water\",\"The opening of Das Rheingold: to get \\\"the full, \"\n        .. \"smooth wavelike motion upon the notes of a single chord\\\", two or four horns \"\n        .. \"are not enough, so he takes eight.\",\"SIN ch.VIII\"},\n      {\"Thirteen brass, piano, for Walhalla\",\"Trumpets, trombones and tuba supplemented by \"\n        .. \"a bass trumpet, two tenor and two bass tubas, a contrabass trombone and a \"\n        .. \"contrabass tuba - \\\"one of the simplest and noblest effects of sonority in \"\n        .. \"existence\\\".\",\"SIN ch.VIII\"},\n      {\"Six harps for the rainbow bridge\",\"One harp \\\"would appear trivial, or would \"\n        .. \"hardly be audible against the full Orchestra\\\", so he writes six separate \"\n        .. \"parts.\",\"SIN ch.VIII\"},\n      {\"Violins divided into four, five or eight\",\"The Lohengrin prelude, in the high \"\n        .. \"register, using harmonics on a long-held chord - \\\"it is undoubtedly an A major \"\n        .. \"chord, but it is also high strings, harmonics, long notes\\\".\",\"SIN p.49; WP\"},\n      {\"A unison line shared out so you cannot name the instruments\",\"The Parsifal prelude: \"\n        .. \"\\\"the violins are halved, then doubled by the cellos, a clarinet, and a \"\n        .. \"bassoon, as well as, for the peak of the phrase, an alto oboe [cor \"\n        .. \"anglais]\\\".\",\"WP\"},\n      {\"\u00e2\u0080\u0099Cellos supported by wind\",\"The opening phrase of the Tristan prelude; when it \"\n        .. \"returns at the end, cor anglais and bass clarinet colour it, with the timpani \"\n        .. \"rumbling beneath.\",\"WP\"},\n      {\"Six horns offstage and two in the pit\",\"The hunting horns of Tristan Act II - \"\n        .. \"\\\"faint far-away horns and their echoes ringing through the moonlight\\\". He \"\n        .. \"called for sixteen hunting-horns in Tannhauser Act I.\",\"SIN p.109\"},\n      {\"Viola as the fiery voice\",\"The Venusberg motive in the Tannhauser overture - \"\n        .. \"Wagner \\\"was the first to exhibit the viola in such a role\\\".\",\"SIN p.51\"},\n      {\"Glockenspiel and triangle in fire music\",\"The close of Die Walkure: the \"\n        .. \"glockenspiel makes \\\"brilliant tips of light to the soaring plumes of flame\\\", \"\n        .. \"the triangle \\\"vivid points of heat and light\\\". Arpeggiated wind chords against \"\n        .. \"contrary-motion strings give \\\"an oscillation of tone-colours almost literally \"\n        .. \"matching the visual flickering of the flames\\\".\",\"SIN p.127; WP\"},\n      {\"Two clarinets in duet for thirty bars\",\"Act I scene 3 of Gotterdammerung.\",\"SIN p.100\"},\n      {\"Eighteen anvils in nine parts\",\"Das Rheingold's Nibelungs, in three sizes.\",\"SIN p.130\"},\n    }},\n    {\"What he added\", {\n      {\"Wagner tubas and the bass trumpet\",\"\\\"A family intermediate between horns and \"\n        .. \"trumpets\\\" which \\\"singularly enriches the group of brasses without rendering \"\n        .. \"his instrumentation any more noisy\\\". Four of his horn players switch to them.\",\"SIN ch.VIII & p.118-119\"},\n    }},\n    {\"Use sparingly\", {\n      {\"His extra low brass\",\"Rimsky-Korsakov: the tenor and bass tubas and contrabass \"\n        .. \"trombone of the Ring \\\"sometimes weigh too heavily on the other groups, and at \"\n        .. \"other times they render the rest of the brass ineffective\\\" - Wagner himself \"\n        .. \"dropped them for Parsifal.\",\"RK p.22-23\"},\n      {\"His vocal demands\",\"Rimsky-Korsakov thought the Wagnerian voice types asked \"\n        .. \"\\\"something little short of the miraculous\\\", and that singers who chase them \"\n        .. \"lose \\\"correct intonation, beauty of tone, and all subtlety of nuances\\\".\",\"RK p.138-139\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Where advanced orchestration begins\",\"\\\"More advanced orchestration begins with \"\n        .. \"Wagner, in particular the richness of his orchestral polyphony as a norm, and \"\n        .. \"the way he uses the enlarged orchestral families.\\\"\",\"BEL p.61\"},\n      {\"His tutti method\",\"The Meistersinger prelude: each family has independent \"\n        .. \"part-writing, the winds starting by doubling the violins and \\\"by m. 7 they \"\n        .. \"are already adding details of their own\\\".\",\"BEL p.50\"},\n    }},\n  },\n  instruments={\"horn\",\"tuba\",\"trumpet\",\"trombone\",\"harp\",\"viola\",\"cello\",\"clarinet\",\n               \"bassclarinet\",\"englishhorn\",\"glockenspiel\",\"triangle\",\"strings\",\"brass\"},\n  related={\"composers\",\"berlioz\",\"strauss\",\"mahler\",\"horn\",\"tuba\",\"harp\",\"brass\"},\n}\n\ne{ id=\"verdi\", name=\"Giuseppe Verdi\", family=\"Composers\", kind=\"composer\",\n  aliases={\"verdi\",\"giuseppe verdi\"},\n  summary=\"An orchestrator of dramatic economy: he reaches for an instrument because a \"\n       .. \"character needs it, not to fill the texture.\",\n  facts={ {\"Dates\",\"1813-1901\"}, {\"Look at\",\"Otello, Falstaff, Il Trovatore, Requiem\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Double bass as a murderer\u00e2\u0080\u0099s voice\",\"Otello's entrance into Desdemona's chamber - \"\n        .. \"\\\"here the double-bass darkly and wickedly mutters all that is in Otello's \"\n        .. \"savage heart and tells us just what he means to do\\\". He considered the \"\n        .. \"instrument \\\"a dark, morbid personality, particularly fitted for tragedy\\\".\",\"SIN p.69-70\"},\n      {\"Piccolo in a drinking song\",\"Iago's, in Otello.\",\"SIN p.81\"},\n      {\"Anvils\",\"The Anvil Chorus in Il Trovatore, played on steel bars rather than real \"\n        .. \"anvils.\",\"SIN p.130\"},\n      {\"A bell offstage\",\"The prison bell in Il Trovatore.\",\"SIN p.130\"},\n    }},\n  },\n  instruments={\"doublebass\",\"piccolo\",\"percussion\",\"bells\"},\n  related={\"composers\",\"wagner\",\"doublebass\",\"percussion\"},\n}\n\ne{ id=\"brahms\", name=\"Johannes Brahms\", family=\"Composers\", kind=\"composer\",\n  aliases={\"brahms\",\"johannes brahms\"},\n  summary=\"The great test case for whether orchestral colour is the point of \"\n       .. \"orchestration. Rimsky-Korsakov's verdict is worth having in full: \\\"Was Brahms \"\n       .. \"ignorant of orchestration? And yet, nowhere in his works do we find evidence \"\n       .. \"of brilliant tone or picturesque fancy. The truth is that his thoughts did not \"\n       .. \"turn towards colour; his mind did not exact it.\\\"\",\n  facts={ {\"Dates\",\"1833-1897\"}, {\"Look at\",\"Symphony 1 in C minor, Symphony 4, \"\n          .. \"Violin Concerto, Variations on a Theme by Haydn\"} },\n  sec={\n    {\"Characteristic instruments\", {\n      {\"Bassoon\",\"\\\"Brahms shows it off well in his C-minor Symphony.\\\"\",\"SIN p.97\"},\n      {\"Contrabassoon\",\"Also in the C-minor Symphony - one of the works that brought the \"\n        .. \"instrument back after its post-Beethoven neglect.\",\"SIN p.101\"},\n    }},\n    {\"What to take from him\", {\n      {\"Colour is optional; sound is not\",\"\\\"More than one classical and modern composer \"\n        .. \"has lacked the capacity to orchestrate with imagination and power; the secret \"\n        .. \"of colour has remained outside the range of his creative faculty. Does it \"\n        .. \"follow that these composers do not know how to orchestrate? Many among them \"\n        .. \"have had greater knowledge of the subject than the mere colourist.\\\"\",\"RK p.2\"},\n      {\"The underlying lesson\",\"Rimsky-Korsakov's companion point: \\\"unsatisfactory \"\n        .. \"resonance is often solely the outcome of faulty handling of parts, and such a \"\n        .. \"composition will continue to sound badly whatever choice of instruments is \"\n        .. \"made\\\". Brahms is proof that sound part-writing carries a score without \"\n        .. \"colour; the reverse is not true.\",\"RK p.63\"},\n    }},\n  },\n  instruments={\"bassoon\",\"contrabassoon\",\"horn\",\"strings\"},\n  related={\"composers\",\"balance\",\"doubling\",\"bassoon\"},\n}\n\ne{ id=\"glinka\", name=\"Mikhail Glinka\", family=\"Composers\", kind=\"composer\",\n  aliases={\"glinka\",\"mikhail glinka\",\"michael glinka\"},\n  summary=\"The father of the Russian school, and the composer Rimsky-Korsakov names \"\n       .. \"among the handful worth studying for scoring. Notable for refusing to pad his \"\n       .. \"orchestra with extra players.\",\n  facts={ {\"Dates\",\"1804-1857\"}, {\"Look at\",\"A Life for the Tsar, Rousslan and Ludmilla\"} },\n  sec={\n    {\"Habits worth noting\", {\n      {\"No extras\",\"Where Meyerbeer freely added extra players for short stretches, \"\n        .. \"\\\"other composers, Glinka for example, refrain from increasing the number of \"\n        .. \"performers by employing extras\\\" - the English horn part in Rousslan is taken \"\n        .. \"by an existing player.\",\"RK p.14\"},\n      {\"Piano in the orchestra\",\"He used it with the harp to imitate the guzli, a popular \"\n        .. \"plucked instrument - the beginning of a Russian habit.\",\"RK p.30\"},\n      {\"Stage bands\",\"One of the composers who put brass, or brass and woodwind, on the \"\n        .. \"stage itself in the mid-19th century.\",\"RK p.129\"},\n    }},\n    {\"What to take from him\", {\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s endorsement\",\"Named alongside Weber, Mendelssohn, Berlioz, \"\n        .. \"Wagner and Liszt as the best guides for a student of orchestration.\",\"RK p.4\"},\n    }},\n  },\n  instruments={\"piano\",\"harp\",\"englishhorn\",\"brass\"},\n  related={\"composers\",\"rimskykorsakov\",\"mussorgsky\",\"piano\",\"harp\"},\n}\n\ne{ id=\"rimskykorsakov\", name=\"Nikolay Rimsky-Korsakov\", family=\"Composers\", kind=\"composer\",\n  aliases={\"rimsky korsakov\",\"rimsky-korsakov\",\"rimsky\",\"korsakov\",\"nikolay rimsky korsakov\",\n           \"rimskykorsakov\"},\n  summary=\"The author of this encyclopaedia's principal source, and its most consistent \"\n       .. \"practitioner - nearly every combination recommended in these pages is \"\n       .. \"illustrated from his own scores. His own summary of his method: obtain a new \"\n       .. \"timbre of definite colour, strengthen the strings, soften the woodwind.\",\n  facts={ {\"Dates\",\"1844-1908\"},\n          {\"Look at\",\"Sheherazade, Capriccio espagnol, Russian Easter Festival Overture, \"\n            .. \"The Golden Cockerel, Sadko, Snegourotchka\"},\n          {\"His own formations\",\"Mlada alone uses woodwind in fours; Sadko, Tsar Saltan, \"\n            .. \"Kitesh, The Golden Cockerel and Ivan the Terrible use threes; the rest \"\n            .. \"pairs with extras\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Violas + \u00e2\u0080\u0099cellos + English horn\",\"His signature warm middle voice, returned to \"\n        .. \"again and again in Snegourotchka - and he notes that \\\"the addition of the Eng. \"\n        .. \"horn makes no essential difference to the compound tone; the 'cellos stand out \"\n        .. \"above the rest\\\".\",\"RK p.39\"},\n      {\"Violins + \u00e2\u0080\u0099cellos + English horn\",\"The same melody, fuller: \\\"the Eng. horn is \"\n        .. \"absorbed in the musical texture, the principal colour being that of the \"\n        .. \"'cellos. Still more powerful in resonance.\\\"\",\"RK p.40\"},\n      {\"Violas + English horn\",\"A favourite for short characteristic phrases, in Sadko \"\n        .. \"and Sheherazade.\",\"RK p.59\"},\n      {\"Stopped horns + oboes and English horn\",\"Muted brass approaching the reeds in \"\n        .. \"quality: 2 oboes + English horn + 3 muted trumpets, or 3 stopped horns under \"\n        .. \"oboes and English horn.\",\"RK p.89 & p.93\"},\n      {\"2 horns + tuba on the bass, trombones above\",\"His own preferred heavy brass \"\n        .. \"layout: \\\"I have often adopted the following combination of brass instruments, \"\n        .. \"and consider it eminently satisfactory.\\\"\",\"RK p.83\"},\n      {\"Alto trumpet with two ordinary trumpets\",\"His own invention, first used in Mlada: \"\n        .. \"the three \\\"produce greater smoothness and equality in resonance than three \"\n        .. \"ordinary trumpets\\\".\",\"RK p.23\"},\n      {\"Harp + glockenspiel + piccolo far above a single bass\",\"Snegourotchka - a figure \"\n        .. \"four octaves clear of the bass, with flutes filling the gap. \\\"The general \"\n        .. \"effect is fanciful.\\\"\",\"RK p.106-107\"},\n      {\"Two solo violins above the section\",\"A single desk or two carrying the top octave \"\n        .. \"while the rest play below, so the highest notes lose their piercing \"\n        .. \"quality.\",\"RK p.42 & p.106\"},\n    }},\n    {\"What to take from him\", {\n      {\"Economy\",\"\\\"Neither musical feeling nor the ear itself can stand, for long, the \"\n        .. \"full resources of the orchestra combined together.\\\" And: \\\"the constant use of \"\n        .. \"compound timbres... produces a dull, neutral texture, whereas the employment of \"\n        .. \"simple, elementary combinations gives infinitely greater scope for variety in \"\n        .. \"colour.\\\"\",\"RK p.118 & p.35\"},\n      {\"His three axioms\",\"\\\"In the orchestra there is no such thing as ugly quality of \"\n        .. \"tone.\\\" \\\"Orchestral writing should be easy to play.\\\" \\\"A work should be \"\n        .. \"written for the size of orchestra that is to perform it.\\\"\",\"RK p.3\"},\n      {\"And his warning\",\"\\\"To orchestrate is to create, and this is something which \"\n        .. \"cannot be taught... The power of subtle orchestration is a secret impossible to \"\n        .. \"transmit, and the composer who possesses this secret should value it highly, and \"\n        .. \"never debase it to the level of a mere collection of formulae learned by \"\n        .. \"heart.\\\"\",\"RK p.1-2\"},\n    }},\n    {\"His own admitted mistakes\", {\n      {\"Two he pointed out himself\",\"Tsar Saltan [[220]] bar 7 - the brass theme is not \"\n        .. \"prominent enough because the trombones are tacet. The Golden Cockerel [[233]] \"\n        .. \"bars 10-14 - if the brass dynamics are observed, the viola and 'cello \"\n        .. \"counter-melody will hardly be heard.\",\"RK p.x (Steinberg's preface)\"},\n    }},\n  },\n  instruments={\"englishhorn\",\"viola\",\"cello\",\"horn\",\"trumpet\",\"tuba\",\"trombone\",\"harp\",\n               \"glockenspiel\",\"violin\",\"strings\",\"woodwind\"},\n  related={\"composers\",\"glinka\",\"mussorgsky\",\"englishhorn\",\"viola\",\"blend\",\"doubling\"},\n}\n\ne{ id=\"mussorgsky\", name=\"Modest Mussorgsky\", family=\"Composers\", kind=\"composer\",\n  aliases={\"mussorgsky\",\"moussorgsky\",\"modest mussorgsky\",\"musorgsky\"},\n  summary=\"Studied less for his own orchestration than for what others made of it - his \"\n       .. \"scores are the most-reorchestrated in the repertoire, which makes them an \"\n       .. \"unusually direct lesson in how much the choice of instruments changes.\",\n  facts={ {\"Dates\",\"1839-1881\"}, {\"Look at\",\"Boris Godunov, Khovanshchina, Pictures at \"\n          .. \"an Exhibition (in Ravel's orchestration)\"} },\n  sec={\n    {\"Why he is useful to study\", {\n      {\"The same music, two orchestrations\",\"Ravel's orchestration of Pictures at an \"\n        .. \"Exhibition - a solo piano work - is one of the two standard examples of \"\n        .. \"orchestration as a separate art from composition.\",\"WP\"},\n      {\"Strings and brass, done well\",\"Rimsky-Korsakov's editor singles out \\\"the \"\n        .. \"introduction to the 2nd scene of the 4th act of Khovanstchina by Moussorgsky, \"\n        .. \"orchestrated by Rimsky-Korsakov\\\" as a splendid example of combining the two \"\n        .. \"groups - normally an awkward pairing.\",\"RK p.95 n.\"},\n      {\"Piano in the orchestra\",\"Boris Godunov is one of the two scores Rimsky-Korsakov's \"\n        .. \"translator names as particularly interesting for orchestral piano.\",\"RK p.30 n.\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Orchestrating music never meant for orchestra\",\"Rimsky-Korsakov's own view of the \"\n        .. \"practice, despite doing it himself: \\\"to score a composition never intended for \"\n        .. \"the orchestra is an undesirable practice... In any case this is the lowest form \"\n        .. \"of instrumentation, akin to colour photography.\\\"\",\"RK p.2\"},\n    }},\n  },\n  instruments={\"piano\",\"strings\",\"brass\"},\n  related={\"composers\",\"rimskykorsakov\",\"ravel\",\"strings_brass\",\"piano\"},\n}\n\ne{ id=\"tchaikovsky\", name=\"Pyotr Ilyich Tchaikovsky\", family=\"Composers\", kind=\"composer\",\n  aliases={\"tchaikovsky\",\"tschaikowsky\",\"tchaikowsky\",\"chaikovsky\",\"pyotr tchaikovsky\",\n           \"peter tchaikovsky\"},\n  summary=\"\\\"A remarkable feature of his scoring is the extreme modern effect secured \"\n       .. \"with comparatively modest means.\\\" For the Pathetique he used the Beethoven \"\n       .. \"orchestra plus a tuba - nothing more.\",\n  facts={ {\"Dates\",\"1840-1893\"},\n          {\"Look at\",\"Symphonies 4, 5 and 6; The Nutcracker; Romeo and Juliet; \"\n            .. \"Francesca da Rimini; Marche Slave\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Low woodwind with the violas\",\"\\\"He made prominent use of low woodwind, which \"\n        .. \"were constantly combined with the violas, and he evinced peculiar predilection \"\n        .. \"for clarinets in their low range and bassoons in their upper range.\\\"\",\"SIN ch.VIII\"},\n      {\"Bassoon in unison with violas\",\"\\\"In his Marche Slave it is very effective in \"\n        .. \"unison with the violas.\\\"\",\"SIN p.97\"},\n      {\"Bassoon exposed\",\"\\\"A notable example is in Tschaikowsky's Pathetic Symphony and \"\n        .. \"in the waltz movement of his Fifth Symphony.\\\"\",\"SIN p.97\"},\n      {\"Clarinet solo\",\"In Francesca da Rimini.\",\"SIN p.100\"},\n      {\"Celesta\",\"He introduced it to the orchestra - famously in the Nutcracker's Dance \"\n        .. \"of the Sugar Plum Fairy - and, with Strauss, gave it its popularity.\",\"RK p.31; SIN p.128\"},\n      {\"Bass clarinet\",\"Conspicuous in the Danse de la Fee Dragee of the Nutcracker.\",\"SIN p.101\"},\n      {\"Flute in the foreground\",\"\\\"An exceptionally striking use of the flute is in the \"\n        .. \"Danse des Mirlitons and Danse Chinoise in the Nut-cracker Suite\\\"; he played \"\n        .. \"the flute himself.\",\"SIN p.78\"},\n      {\"Oboe and clarinet in unison\",\"He scores the pairing freely, in both harmony and \"\n        .. \"melody, despite the common modern warning against it.\",\"MOD\"},\n      {\"Pizzicato scherzo\",\"The Scherzo of his F-minor Symphony, following Beethoven's \"\n        .. \"Fifth.\",\"SIN p.15\"},\n    }},\n    {\"What to take from him\", {\n      {\"Modest forces, modern effect\",\"The lesson is that a distinctive orchestral voice \"\n        .. \"comes from consistent choices of register and combination, not from adding \"\n        .. \"instruments.\",\"SIN ch.VIII; MOD\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"The second composer to study\",\"\\\"A logical next step, similar in technique to \"\n        .. \"Mendelssohn, but with a larger orchestra. Again, his orchestration is \"\n        .. \"effective, clear, and easily understood.\\\"\",\"BEL p.61\"},\n      {\"His clarinet and oboe interlocking\",\"Tchaikovsky's Fifth, first movement, is \"\n        .. \"Belkin's example of clarinets and oboes \\\"interlocked for better blend, in a \"\n        .. \"standard classical technique\\\".\",\"BEL p.40\"},\n      {\"His tutti method\",\"The Fifth's finale gives each musical element to a distinct \"\n        .. \"family: strings on the melody in octaves, horns and winds on two \"\n        .. \"counterpoints, repeated notes in low brass and basses.\",\"BEL p.51\"},\n    }},\n  },\n  instruments={\"bassoon\",\"clarinet\",\"bassclarinet\",\"viola\",\"celesta\",\"flute\",\"tuba\",\n               \"pizzicato\",\"woodwind\"},\n  related={\"composers\",\"rimskykorsakov\",\"celesta\",\"bassoon\",\"clarinet\",\"viola\"},\n}\n\ne{ id=\"saintsaens\", name=\"Camille Saint-Saens\", family=\"Composers\", kind=\"composer\",\n  aliases={\"saint saens\",\"saint-saens\",\"saintsaens\",\"camille saint-saens\",\"camille saint saens\"},\n  summary=\"\\\"The greatest name in the development of Orchestral music since Berlioz is \"\n       .. \"that of Saint-Saens, whose orchestration, although rich and elaborate, is \"\n       .. \"always clear and polished to the last degree.\\\"\",\n  facts={ {\"Dates\",\"1835-1921\"}, {\"Look at\",\"Le Rouet d'Omphale, Danse Macabre, Samson \"\n          .. \"et Dalila, Carnival of the Animals\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Xylophone as bones\",\"Danse Macabre - \\\"in which it represents the clattering of \"\n        .. \"the bones of the dancing skeletons\\\". The xylophone is \\\"only suited to \"\n        .. \"grotesque music\\\", and this is the defining example.\",\"SIN p.129\"},\n      {\"Harp instead of a bell\",\"The midnight chime in Danse Macabre is twelve notes \"\n        .. \"plucked on the harp - a lesson in suggesting an instrument you have not \"\n        .. \"got.\",\"SIN p.131\"},\n      {\"Col legno strings\",\"Also in Danse Macabre.\",\"SIN p.15\"},\n      {\"Castanets\",\"In Samson et Dalila.\",\"SIN p.126\"},\n    }},\n    {\"What to take from him\", {\n      {\"Rich but clear\",\"His example is that elaborate scoring and transparency are not \"\n        .. \"opposites; Le Rouet d'Omphale \\\"is not merely a beautiful piece of descriptive \"\n        .. \"writing, but it is beautifully scored\\\".\",\"SIN ch.VIII\"},\n    }},\n  },\n  instruments={\"xylophone\",\"harp\",\"castanets\",\"strings\"},\n  related={\"composers\",\"berlioz\",\"debussy\",\"xylophone\",\"harp\"},\n}\n\ne{ id=\"dvorak\", name=\"Antonin Dvorak\", family=\"Composers\", kind=\"composer\",\n  aliases={\"dvorak\",\"antonin dvorak\",\"dvorzak\"},\n  summary=\"Best known orchestrally for one of the repertoire's most famous solo \"\n       .. \"wind-and-strings combinations.\",\n  facts={ {\"Dates\",\"1841-1904\"}, {\"Look at\",\"Symphony 9 (From the New World), \"\n          .. \"'Cello Concerto\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"English horn over muted strings\",\"The Largo of the New World Symphony - \\\"having \"\n        .. \"a melody in the Largo with accompaniment of strings con sordini\\\". The \"\n        .. \"reference case for the instrument.\",\"SIN p.90\"},\n      {\"Flute with oboe\",\"\\\"It is important in the Largo of Dvorak's New World Symphony, \"\n        .. \"where it plays with the oboe.\\\"\",\"SIN p.78\"},\n      {\"Clarinet\",\"Also conspicuous in the New World.\",\"SIN p.100\"},\n    }},\n  },\n  instruments={\"englishhorn\",\"flute\",\"oboe\",\"clarinet\",\"cello\",\"strings\"},\n  related={\"composers\",\"englishhorn\",\"strings_wind\"},\n}\n\ne{ id=\"grieg\", name=\"Edvard Grieg\", family=\"Composers\", kind=\"composer\",\n  aliases={\"grieg\",\"edvard grieg\"},\n  summary=\"A miniaturist's orchestration - small gestures, clearly coloured.\",\n  facts={ {\"Dates\",\"1843-1907\"}, {\"Look at\",\"Peer Gynt suites, Piano Concerto\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Solo flute as dawn\",\"\\\"It sings in the Morning of Grieg's Peer Gynt Suite\\\" - a \"\n        .. \"standard reference for the flute's pastoral character.\",\"SIN p.78\"},\n    }},\n  },\n  instruments={\"flute\",\"strings\",\"oboe\"},\n  related={\"composers\",\"flute\"},\n}\n\ne{ id=\"mahler\", name=\"Gustav Mahler\", family=\"Composers\", kind=\"composer\",\n  aliases={\"mahler\",\"gustav mahler\"},\n  summary=\"He expanded the orchestra not to get louder but to get more gradations. \"\n       .. \"\\\"Mahler only occasionally required all his vast orchestra to play together, \"\n       .. \"and his music was as often soft as loud. Its colours were continually shifting, \"\n       .. \"blending or contrasting with each other.\\\"\",\n  facts={ {\"Dates\",\"1860-1911\"},\n          {\"Symphony 2\u00e2\u0080\u0099s wind and brass\",\"4 flutes, 4 oboes, 5 clarinets, 4 bassoons; \"\n            .. \"10 horns, 8 trumpets, 4 trombones, tuba; 2 sets of timpani + 4 \"\n            .. \"percussion, 2 harps, organ, strings\"},\n          {\"Look at\",\"Symphonies 2, 4, 5 and 9\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Chamber groups inside a huge orchestra\",\"His symphonic writing is characterised \"\n        .. \"by \\\"massive tutti effects\\\" contrasted with \\\"chamber-music procedures\\\" \"\n        .. \"(Adorno). In the first movement of the Fourth, only the opening bar is a full \"\n        .. \"ensemble; the rest is small, highly differentiated groups.\",\"WP\"},\n      {\"Calibrated dynamics inside one chord\",\"In that passage, the low harp note is \"\n        .. \"marked forte, the clarinets mezzo-forte, the horns piano - three dynamics in \"\n        .. \"one bar so that the balance comes out as intended.\",\"WP\"},\n      {\"A perfect fourth in two flutes\",\"The closing bars of the Fourth's slow movement - \"\n        .. \"\\\"an instance of inspired orchestration... the unusual spacing of the chord... \"\n        .. \"and the placing of the perfect fourth in the two flutes. The effect is quite \"\n        .. \"unexpected and magical\\\" (Walter Piston).\",\"WP\"},\n    }},\n    {\"What to take from him\", {\n      {\"Write the dynamics per instrument, not per bar\",\"\\\"Mahler cared about the finest \"\n        .. \"nuances of loudness and tempo and worked tirelessly to fix these details in his \"\n        .. \"scores.\\\" His conductor's ear told him that balance is notated, not hoped \"\n        .. \"for.\",\"WP\"},\n      {\"The purpose of a big orchestra\",\"\\\"The rational basis of Mahler's orchestration \"\n        .. \"was to enable us to comprehend his music by hearing precisely what was going \"\n        .. \"on\\\" (Donald Mitchell). More instruments meant more distinguishable lines, not \"\n        .. \"a thicker wall.\",\"WP\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Not for beginners\",\"With Ravel, \\\"not suitable for beginners since their \"\n        .. \"textures are often very rich and complex\\\".\",\"BEL p.60\"},\n      {\"Rate of change as character\",\"In the Fourth's second movement the nervous \"\n        .. \"character comes from \\\"the frequent, prominent, changes of timbre\\\" - and the \"\n        .. \"third movement's calm \\\"results from remaining entirely within the string \"\n        .. \"choir\\\".\",\"BEL p.23\"},\n      {\"Piece-meal doubling\",\"In the Ninth, the first horn is an inner counterpoint, \"\n        .. \"then doubles the 'cello, then the first trombone - creating a new line without \"\n        .. \"adding polyphony.\",\"BEL p.38\"},\n      {\"Sustained chords rescue tutti counterpoint\",\"The Fifth's third movement: \"\n        .. \"\\\"vigorous, tutti counterpoint is drawn into a rich whole by the sustained \"\n        .. \"trombone chords\\\".\",\"BEL p.47\"},\n    }},\n  },\n  instruments={\"harp\",\"clarinet\",\"horn\",\"flute\",\"percussion\",\"woodwind\",\"brass\",\"strings\"},\n  related={\"composers\",\"wagner\",\"strauss\",\"balance\",\"doubling\",\"orchestra\"},\n}\n\ne{ id=\"strauss\", name=\"Richard Strauss\", family=\"Composers\", kind=\"composer\",\n  aliases={\"strauss\",\"richard strauss\",\"r strauss\"},\n  summary=\"\\\"The greatest technical master of the Orchestra, making of it a vibrating \"\n       .. \"dynamic machine, a humming mountain of fire.\\\" His method is to divide the \"\n       .. \"instrumental choirs and set them against each other: \\\"his Orchestra flashes \"\n       .. \"like a canvas of Monet\\\".\",\n  facts={ {\"Dates\",\"1864-1949\"},\n          {\"Look at\",\"Don Quixote, Till Eulenspiegel, Ein Heldenleben, Don Juan, \"\n            .. \"Sinfonia Domestica, Also sprach Zarathustra\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Instruments as characters\",\"Don Quixote: the solo 'cello is the knight, the solo \"\n        .. \"viola his squire. \\\"With great poetic judgment Strauss selected the violoncello \"\n        .. \"and the viola as the most suitable instruments to convey these \"\n        .. \"impressions.\\\"\",\"SIN p.66\"},\n      {\"Divided choirs in opposition\",\"\\\"He intricately divides his various instrumental \"\n        .. \"choirs: setting one group in opposition, or juxtaposition, to another; producing \"\n        .. \"the most marvellous, unexpected effects by acoustical mirroring and transmutation \"\n        .. \"of motives.\\\"\",\"SIN ch.VIII\"},\n      {\"Four horns on a four-part shake\",\"In Till Eulenspiegel - \\\"a very peculiar way\\\" \"\n        .. \"of using them.\",\"SIN p.109\"},\n      {\"Celesta\",\"He and Tchaikovsky gave the instrument its popularity; in Sinfonia \"\n        .. \"Domestica seven little taps on the glockenspiel tell the hour.\",\"SIN p.128 & p.131\"},\n      {\"Bass clarinet, bassoon, cor anglais as soloists\",\"Bass clarinet conspicuous in Don \"\n        .. \"Quixote; bassoon in Heldenleben, Till and Don Juan; cor anglais prominent in \"\n        .. \"Heldenleben.\",\"SIN p.101, p.97, p.90\"},\n      {\"Wind machine and rattle\",\"The Windmill adventure of Don Quixote uses the wind \"\n        .. \"machine; Till Eulenspiegel uses the watchman's rattle.\",\"SIN p.129\"},\n      {\"Flutter tongue on the flute\",\"Also the Windmill variation - \\\"a new way of rolling \"\n        .. \"the tongue\\\", Strauss \\\"always goes a little farther than anybody else\\\".\",\"SIN p.78\"},\n      {\"Col legno strings\",\"In Also sprach Zarathustra.\",\"SIN p.15\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Five trumpets\",\"Rimsky-Korsakov notes, with reserve, that \\\"some present-day \"\n        .. \"composers (Richard Strauss, Scriabine) write for as many as five \"\n        .. \"trumpets\\\".\",\"RK p.22\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"For the advanced student only\",\"Grouped with Ravel and Mahler as the last stage \"\n        .. \"of study.\",\"BEL p.61\"},\n      {\"Several rising figures instead of one doubled line\",\"Die Frau ohne Schatten, \"\n        .. \"first act: \\\"a wispy image of a rising shadow is created by using several \"\n        .. \"different rising figures simultaneously (combined with held notes for \"\n        .. \"resonance)\\\".\",\"BEL p.42\"},\n      {\"The phrase he gave us\",\"Writing of Wagner's polyphony, Strauss called for the \"\n        .. \"\\\"spiritual participation of the players\\\" - which Belkin makes one of his \"\n        .. \"criteria for good orchestration.\",\"BEL p.36 & p.58\"},\n    }},\n  },\n  instruments={\"cello\",\"viola\",\"horn\",\"celesta\",\"bassclarinet\",\"bassoon\",\"englishhorn\",\n               \"flute\",\"xylophone\",\"percussion\",\"strings\"},\n  related={\"composers\",\"wagner\",\"mahler\",\"cello\",\"viola\",\"celesta\"},\n}\n\ne{ id=\"elgar\", name=\"Edward Elgar\", family=\"Composers\", kind=\"composer\",\n  aliases={\"elgar\",\"edward elgar\"},\n  summary=\"An orchestrator of fine gradations - his scores are full of very specific \"\n       .. \"instructions about how a sound is to be produced, not merely which instrument \"\n       .. \"produces it.\",\n  facts={ {\"Dates\",\"1857-1934\"}, {\"Look at\",\"Enigma Variations, Pomp and Circumstance \"\n          .. \"marches, 'Cello Concerto, Symphony 1\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Bassoon exposed\",\"\\\"Elgar in his Pomp and Circumstance March and Variations III \"\n        .. \"and IX of the Enigma.\\\"\",\"SIN p.97\"},\n      {\"Viola given real work\",\"\\\"Elgar also gives the viola much to do in his \"\n        .. \"works.\\\"\",\"SIN p.51\"},\n      {\"Street drumsticks on the timpani\",\"His Variations call for ordinary street \"\n        .. \"drumsticks rather than felt, \\\"for very fine crisp rolls\\\" - an example of \"\n        .. \"specifying the stick, not just the note.\",\"SIN p.121\"},\n    }},\n    {\"What to take from him\", {\n      {\"Specify the means\",\"Where a colour depends on how the sound is made - the stick, \"\n        .. \"the bowing, the mute - write it in. The score is the only place the information \"\n        .. \"survives.\",\"MOD\"},\n    }},\n  },\n  instruments={\"bassoon\",\"viola\",\"timpani\",\"cello\",\"strings\"},\n  related={\"composers\",\"timpani\",\"bassoon\",\"viola\"},\n}\n\ne{ id=\"debussy\", name=\"Claude Debussy\", family=\"Composers\", kind=\"composer\",\n  aliases={\"debussy\",\"claude debussy\"},\n  summary=\"\\\"One idea of Debussy's in orchestral writing is to get the greatest effect \"\n       .. \"with the simplest means... His instrumentation, therefore, seems diaphanous, \"\n       .. \"ethereal, and suffused with delicate, opalescent colors.\\\" Boulez thought his \"\n       .. \"orchestration showed \\\"an infinitely fresher imagination\\\" than Strauss's or \"\n       .. \"Mahler's.\",\n  facts={ {\"Dates\",\"1862-1918\"},\n          {\"Faune\u00e2\u0080\u0099s orchestra\",\"3 flutes, oboes, clarinets, 4 horns, 2 harps, antique \"\n            .. \"cymbals and strings - no trumpets, trombones, tuba or timpani at all\"},\n          {\"Look at\",\"Prelude a l'apres-midi d'un faune, Nocturnes, La Mer, Jeux, \"\n            .. \"Pelleas et Melisande\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"A chord split between oboes and clarinets, with a harp glissando\",\"The opening of \"\n        .. \"the Faune: a half-diminished seventh \\\"spread between oboes and clarinets, \"\n        .. \"reinforced by a glissando on the harp\\\".\",\"WP\"},\n      {\"Unaccompanied flute\",\"The Faune's opening bars - the most imitated gesture in \"\n        .. \"French orchestration.\",\"SIN p.270\"},\n      {\"Harp varying the flute line\",\"Later in the Faune, \\\"the first harp varies the \"\n        .. \"flute parts in almost the same way that the smallest bells of a Javanese gamelan \"\n        .. \"vary the slower basic melody\\\".\",\"WP\"},\n      {\"Harp doubling horns, with celesta\",\"The opening of Jeux: divided strings spread \"\n        .. \"wide, a harp doubling horns, \\\"with the addition of the bell-like celesta in the \"\n        .. \"5th bar and the sultry voicing of the whole tone chords in the woodwind\\\".\",\"WP\"},\n      {\"Muted strings as a background to wind solos\",\"\\\"The strings, muted or otherwise, \"\n        .. \"are often used as a kind of background to the wind solos, which is most \"\n        .. \"effective.\\\"\",\"SIN ch.VIII\"},\n      {\"Interspersed solos as embroidery\",\"\\\"The interspersed solos for violin, oboe, \"\n        .. \"clarinet, cor anglais, resemble dainty broidery.\\\"\",\"SIN ch.VIII\"},\n      {\"Antique cymbals\",\"In the Faune - a rare, specific colour rather than a rhythm \"\n        .. \"instrument.\",\"SIN p.270\"},\n    }},\n    {\"What to take from him\", {\n      {\"Leave instruments out\",\"The Faune's power comes substantially from what is absent: \"\n        .. \"no heavy brass, no timpani. Subtraction is an orchestration technique.\",\"SIN p.270; MOD\"},\n      {\"Timbre without glare\",\"Of Jeux he wrote: \\\"I am thinking of that orchestral colour \"\n        .. \"which seems to be illuminated from behind\\\" - \\\"to produce timbre without glare, \"\n        .. \"subdued... but to do so with clarity and precision\\\".\",\"WP\"},\n      {\"The orchestra as atmosphere\",\"In Pelleas \\\"the Orchestra did not annotate, nor \"\n        .. \"emphasize the actions of the persons on the stage, but it became a soft, \"\n        .. \"melodious atmosphere, a delicious web of harmony enfolding the entire work\\\".\",\"SIN p.270\"},\n    }},\n  },\n  instruments={\"flute\",\"harp\",\"celesta\",\"oboe\",\"clarinet\",\"englishhorn\",\"horn\",\"cymbals\",\n               \"strings\"},\n  related={\"composers\",\"ravel\",\"saintsaens\",\"flute\",\"harp\",\"strings\"},\n}\n\ne{ id=\"ravel\", name=\"Maurice Ravel\", family=\"Composers\", kind=\"composer\",\n  aliases={\"ravel\",\"maurice ravel\"},\n  summary=\"The orchestrator's orchestrator. Bolero is, in effect, eighteen \"\n       .. \"orchestrations of one unchanging theme - the single most concentrated lesson in \"\n       .. \"instrumental colour in the repertoire.\",\n  facts={ {\"Dates\",\"1875-1937\"},\n          {\"Look at\",\"Bolero, Daphnis et Chloe, Pictures at an Exhibition \"\n            .. \"(orchestrating Mussorgsky), La Valse, Rapsodie espagnole\"} },\n  sec={\n    {\"Why he is the reference\", {\n      {\"Bolero\",\"\\\"A set of 18 variations on an original two-part theme - or perhaps, more \"\n        .. \"properly speaking, 18 orchestrations of that theme, for the theme itself does \"\n        .. \"not change, though the instruments do.\\\" It \\\"gradually introduces new timbres \"\n        .. \"and textures at each iteration, employing different instrumental solos and \"\n        .. \"combinations, thereby creating a kaleidoscope of sound\\\".\",\"MOD\"},\n      {\"Pictures at an Exhibition\",\"His orchestration of Mussorgsky's piano work is one of \"\n        .. \"the two standard examples of orchestration practised as an art distinct from \"\n        .. \"composition.\",\"WP\"},\n    }},\n    {\"What to take from him\", {\n      {\"One idea, many colours\",\"The Bolero method - restate without changing the notes and \"\n        .. \"let the instrumentation carry the whole development - is directly usable, and is \"\n        .. \"the extreme case of Rimsky-Korsakov's \\\"different ways of orchestrating the same \"\n        .. \"music\\\".\",\"MOD; cf. RK p.97\"},\n      {\"The inheritance\",\"New Grove traces the line: Berlioz's free use of timbre \\\"leads \"\n        .. \"to the rich orchestral resource of Debussy and Ravel\\\".\",\"WP\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"Not for beginners\",\"\\\"Wonderful orchestrators though they are, [Mahler and \"\n        .. \"Ravel] are not suitable for beginners since their textures are often very \"\n        .. \"rich and complex.\\\"\",\"BEL p.60\"},\n      {\"The master of background resonance\",\"The Epilogue of Valses nobles et \"\n        .. \"sentimentales: held strings and harp harmonics give \\\"a shimmering halo \"\n        .. \"surrounding the main motives in the winds. This conception of the background \"\n        .. \"as delicate vibration is omnipresent in Ravel. Indeed, Ravel's orchestral \"\n        .. \"technique is often most sophisticated in his treatment of such sustained \"\n        .. \"sound in the background.\\\"\",\"BEL p.33\"},\n      {\"An organ-stop doubling in Bolero\",\"A horn carrying the line is doubled by \"\n        .. \"celesta in higher octaves and by two piccolos at a twelfth and two octaves \"\n        .. \"plus a major third - \\\"very similar to a common organ combination (the \"\n        .. \"'cornet'), which gives a rich, piercing sound\\\".\",\"BEL p.38\"},\n    }},\n  },\n  instruments={\"woodwind\",\"brass\",\"strings\",\"harp\",\"celesta\",\"percussion\"},\n  related={\"composers\",\"debussy\",\"mussorgsky\",\"berlioz\",\"doubling\",\"blend\"},\n}\n\ne{ id=\"stravinsky\", name=\"Igor Stravinsky\", family=\"Composers\", kind=\"composer\",\n  aliases={\"stravinsky\",\"igor stravinsky\",\"stravinski\"},\n  summary=\"He got new sounds not by adding instruments but by writing for familiar ones \"\n       .. \"in unfamiliar places: \\\"He pushed them to the extreme heights and depths of \"\n       .. \"their ranges. He put them in uncomfortable positions which resulted in that \"\n       .. \"strained, weird quality he was looking for.\\\"\",\n  facts={ {\"Dates\",\"1882-1971\"},\n          {\"Look at\",\"The Rite of Spring, Petrushka, The Firebird, Symphony of Psalms\"} },\n  sec={\n    {\"Favoured methods\", {\n      {\"Extreme registers as colour\",\"The Rite opens with a bassoon at the very top of its \"\n        .. \"compass - the classic case of choosing a register precisely because it strains. \"\n        .. \"Compare Rimsky-Korsakov's more cautious view that the bassoon's high compass is \"\n        .. \"\\\"tense\\\" and \\\"painful, distressed and dejected\\\": Stravinsky wanted exactly \"\n        .. \"that.\",\"MOD; cf. RK p.17 and SIN p.95\"},\n      {\"Uncomfortable writing on purpose\",\"The general principle - the strain is the \"\n        .. \"sound.\",\"MOD\"},\n    }},\n    {\"What he said about others\", {\n      {\"On Bach\",\"\\\"What incomparable instrumental writing is Bach's. You can smell the \"\n        .. \"resin in his violin parts, and taste the reeds in the oboes.\\\"\",\"WP\"},\n    }},\n  },\n  instruments={\"bassoon\",\"woodwind\",\"brass\",\"percussion\",\"strings\"},\n  related={\"composers\",\"bach\",\"bassoon\",\"range\",\"doubling\"},\n}\n\ne{ id=\"holst\", name=\"Gustav Holst\", family=\"Composers\", kind=\"composer\",\n  aliases={\"holst\",\"gustav holst\"},\n  summary=\"A large orchestra used for character rather than weight - each movement of The \"\n       .. \"Planets is built on a distinct instrumental identity.\",\n  facts={ {\"Dates\",\"1874-1934\"}, {\"Look at\",\"The Planets\"} },\n  sec={\n    {\"Favoured methods\", {\n      {\"Broad strokes, simple material\",\"\\\"The music is relatively simple, but the way that \"\n        .. \"Holst manipulates, orchestrates and colours the themes make this movement \"\n        .. \"incredibly exciting.\\\"\",\"MOD\"},\n      {\"Ostinato as the engine\",\"In Mars, \\\"the repeating ostinato rhythm from the strings \"\n        .. \"drives and dominates this whole movement\\\" - including its famous col legno \"\n        .. \"attack.\",\"MOD\"},\n      {\"A big ensemble for colour, not volume\",\"He used the large orchestra \\\"to create a \"\n        .. \"sound world of astonishing color, power, and atmospheric depth\\\", influenced by \"\n        .. \"Stravinsky and Schoenberg.\",\"MOD\"},\n    }},\n  },\n  instruments={\"strings\",\"brass\",\"woodwind\",\"percussion\"},\n  related={\"composers\",\"stravinsky\",\"percussion\",\"strings\"},\n}\n\ne{ id=\"shostakovich\", name=\"Dmitri Shostakovich\", family=\"Composers\", kind=\"composer\",\n  aliases={\"shostakovich\",\"dmitri shostakovich\",\"schostakowitsch\"},\n  summary=\"Orchestration as dramatic function: \\\"its orchestration is dense but clear, \"\n       .. \"with each instrument having a specific dramatic function\\\".\",\n  facts={ {\"Dates\",\"1906-1975\"}, {\"Look at\",\"Symphonies 5, 7, 10; Festive Overture\"} },\n  sec={\n    {\"Favoured methods\", {\n      {\"Extreme dynamic contrast\",\"\\\"Shostakovich's music uses extreme contrasts: \"\n        .. \"whispering passages followed by brutal orchestral explosions.\\\"\",\"MOD\"},\n      {\"Trumpets and trombones as the voice of protest\",\"\\\"Brass instruments play a leading \"\n        .. \"role, especially trumpets and trombones, which 'shout out' repressed \"\n        .. \"emotions.\\\"\",\"MOD\"},\n      {\"Solo winds against near-silence\",\"The whispering end of the contrast - thin \"\n        .. \"textures that make the explosions work.\",\"MOD\"},\n    }},\n  },\n  instruments={\"trumpet\",\"trombone\",\"brass\",\"woodwind\",\"strings\",\"percussion\"},\n  related={\"composers\",\"mahler\",\"brass\",\"balance\"},\n}\n\ne{ id=\"meyerbeer\", name=\"Giacomo Meyerbeer\", family=\"Composers\", kind=\"composer\",\n  aliases={\"meyerbeer\",\"giacomo meyerbeer\"},\n  summary=\"A specialist in the striking effect, and the composer who normalised bringing \"\n       .. \"in extra players for a single scene.\",\n  facts={ {\"Dates\",\"1791-1864\"}, {\"Look at\",\"Robert le Diable, Les Huguenots, Le Prophete\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"A low bell with bassoons and clarinets\",\"The signal for the massacre in Les \"\n        .. \"Huguenots - a big bell in low F \\\"combined with bassoons and clarinets, which \"\n        .. \"give the music a sinister quality that is very impressive\\\".\",\"SIN p.130\"},\n      {\"English horn obbligato with the voice\",\"'Robert, toi que j'aime' in Robert le \"\n        .. \"Diable.\",\"SIN p.90\"},\n      {\"Two double-action harps\",\"He was the first to use the modern harp, calling for two \"\n        .. \"in Robert le Diable.\",\"SIN p.288\"},\n      {\"Piccolo for the infernal and the martial\",\"The infernal waltz in Robert le Diable; \"\n        .. \"Marcel's \\\"Piff Paff\\\" in Les Huguenots.\",\"SIN p.80\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Extras\",\"\\\"Meyerbeer was fond of\\\" introducing extra players for a short period \"\n        .. \"within a big work. Rimsky-Korsakov notes it without approving, contrasting \"\n        .. \"Glinka's refusal to do the same.\",\"RK p.14\"},\n    }},\n    {\"What to take from him\", {\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s endorsement\",\"Named - specifically for Le Prophete - among the \"\n        .. \"scores a student should study.\",\"RK p.4\"},\n    }},\n  },\n  instruments={\"bells\",\"bassoon\",\"clarinet\",\"englishhorn\",\"harp\",\"piccolo\"},\n  related={\"composers\",\"glinka\",\"bells\",\"harp\",\"piccolo\"},\n}\n\ne{ id=\"rossini\", name=\"Gioachino Rossini\", family=\"Composers\", kind=\"composer\",\n  aliases={\"rossini\",\"gioachino rossini\",\"gioacchino rossini\"},\n  summary=\"Notable orchestrally for a handful of famous solo and sectional openings.\",\n  facts={ {\"Dates\",\"1792-1868\"}, {\"Look at\",\"Guillaume Tell, Stabat Mater, \"\n          .. \"Il Barbiere di Siviglia\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Five solo \u00e2\u0080\u0099cellos\",\"The Overture to William Tell opens with five solo \"\n        .. \"violoncellos, accompanied by two more playing pizzicato in first and second \"\n        .. \"parts.\",\"SIN p.65\"},\n      {\"English horn as a cowherd\u00e2\u0080\u0099s call\",\"The \\\"Ranz des vaches\\\" in William Tell - \"\n        .. \"originally written for the oboe da caccia and inherited by the cor anglais when \"\n        .. \"that instrument became obsolete.\",\"SIN p.90\"},\n      {\"Bassoon opening\",\"He opens the Stabat Mater with it.\",\"SIN p.97\"},\n      {\"A bell onstage\",\"In Act II of Guillaume Tell.\",\"SIN p.130\"},\n    }},\n  },\n  instruments={\"cello\",\"englishhorn\",\"bassoon\",\"bells\",\"pizzicato\"},\n  related={\"composers\",\"cello\",\"englishhorn\"},\n}\n\ne{ id=\"humperdinck\", name=\"Engelbert Humperdinck\", family=\"Composers\", kind=\"composer\",\n  aliases={\"humperdinck\",\"engelbert humperdinck\"},\n  summary=\"A Wagnerian technique turned to fairy-tale ends, and a good study in \"\n       .. \"orchestral comedy.\",\n  facts={ {\"Dates\",\"1854-1921\"}, {\"Look at\",\"Hansel und Gretel\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Bassoon as comic commentator\",\"\\\"Humperdinck makes comic use of it in Hansel and \"\n        .. \"Gretel, where it frequently comments on what is happening on the stage.\\\"\",\"SIN p.98\"},\n      {\"The cuckoo\",\"The toy instrument - two tiny wooden pipes on a bellows - appears in \"\n        .. \"Hansel und Gretel, as in Haydn's Toy Symphony.\",\"SIN p.130\"},\n    }},\n  },\n  instruments={\"bassoon\",\"percussion\",\"woodwind\"},\n  related={\"composers\",\"bassoon\",\"percussion\"},\n}\n\ne{ id=\"delibes\", name=\"Leo Delibes\", family=\"Composers\", kind=\"composer\",\n  aliases={\"delibes\",\"leo delibes\",\"l\u00c3\u00a9o delibes\"},\n  summary=\"Ballet orchestration of exceptional clarity, and a model for writing character \"\n       .. \"into a dance.\",\n  facts={ {\"Dates\",\"1836-1891\"}, {\"Look at\",\"Coppelia, Sylvia, Lakme\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Piccolo for the mechanical and grotesque\",\"\\\"It is conspicuous in the grotesque \"\n        .. \"dances of the dolls in the ballet of Coppelia.\\\"\",\"SIN p.81\"},\n    }},\n  },\n  instruments={\"piccolo\",\"strings\",\"woodwind\"},\n  related={\"composers\",\"piccolo\"},\n}\n\ne{ id=\"bizet\", name=\"Georges Bizet\", family=\"Composers\", kind=\"composer\",\n  aliases={\"bizet\",\"georges bizet\"},\n  summary=\"Bright, economical scoring with a strong taste for characteristic percussion \"\n       .. \"and wind colour.\",\n  facts={ {\"Dates\",\"1838-1875\"}, {\"Look at\",\"Carmen, L'Arlesienne suites\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Ophicleide\",\"He wrote for it in Carmen - one of the last composers to do so before \"\n        .. \"the tuba displaced it.\",\"SIN p.117\"},\n      {\"Characteristic Spanish percussion\",\"Carmen is the standard reference for \"\n        .. \"tambourine and castanets used for local colour rather than rhythm alone.\",\"MOD; cf. SIN p.126\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s verdict\", {\n      {\"The text for voices\",\"\\\"Bizet's Carmen is a basic text for orchestration with \"\n        .. \"voices.\\\"\",\"BEL p.61\"},\n      {\"A model of transparency\",\"Carmen's first act: \\\"Short string chords accompany \"\n        .. \"high violins in a light, triplet figure, and a simple woodwind counterpoint \"\n        .. \"in half notes. The effect is rich but extremely transparent.\\\"\",\"BEL p.57\"},\n    }},\n  },\n  instruments={\"tuba\",\"tambourine\",\"castanets\",\"flute\",\"woodwind\"},\n  related={\"composers\",\"castanets\",\"tambourine\",\"percussion\"},\n}\n\n-- ============================================================================\n-- FILM COMPOSERS\n-- ============================================================================\n\ne{ id=\"steiner\", name=\"Max Steiner\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"steiner\",\"max steiner\"},\n  summary=\"One of the emigre composers who invented the Hollywood orchestral sound out of \"\n       .. \"Central European late Romanticism. \\\"Steiner's lush, emotionally direct style \"\n       .. \"drew on late Romantic techniques, using large orchestras and unabashed sentiment \"\n       .. \"to underscore dramatic moments.\\\"\",\n  facts={ {\"Dates\",\"1888-1971\"}, {\"Look at\",\"King Kong, Gone with the Wind, Casablanca, \"\n          .. \"Now, Voyager\"} },\n  sec={\n    {\"Favoured methods\", {\n      {\"Late-Romantic full orchestra\",\"Large string body, full wind and brass, used as a \"\n        .. \"19th-century symphonist would - the reason a Golden Age score sounds like \"\n        .. \"Wagner's grandchild.\",\"FILM\"},\n      {\"Leitmotif\",\"Wagnerian theme-and-character association carried wholesale into \"\n        .. \"film.\",\"FILM\"},\n      {\"Strings carrying the sentiment\",\"The emotional weight sits in the strings, with wind \"\n        .. \"and brass for colour and punctuation.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"The pattern the rest inherited\",\"Nearly every convention of orchestral film scoring \"\n        .. \"- theme, orchestra, and the string section as the emotional centre - is his and \"\n        .. \"his contemporaries'. Study him for the grammar, later composers for the \"\n        .. \"vocabulary.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"strings\",\"brass\",\"woodwind\",\"horn\"},\n  related={\"composers\",\"korngold\",\"rozsa\",\"wagner\",\"strings\"},\n}\n\ne{ id=\"korngold\", name=\"Erich Wolfgang Korngold\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"korngold\",\"erich korngold\",\"erich wolfgang korngold\"},\n  summary=\"A concert-hall prodigy who brought an intact late-Romantic technique to \"\n       .. \"Hollywood: \\\"Korngold applied full Romantic orchestration, Wagnerian leitmotifs, \"\n       .. \"and sophisticated harmonic language to his film scores.\\\"\",\n  facts={ {\"Dates\",\"1897-1957\"}, {\"Look at\",\"The Adventures of Robin Hood, The Sea Hawk, \"\n          .. \"Kings Row, Violin Concerto\"} },\n  sec={\n    {\"Favoured methods\", {\n      {\"Full Romantic orchestra, opera technique\",\"He scored films as he scored operas - \"\n        .. \"which is literally what he called them.\",\"FILM\"},\n      {\"Heroic brass over running strings\",\"The swashbuckler sound: horns and trumpets \"\n        .. \"carrying the theme above busy string figuration.\",\"FILM\"},\n      {\"Sophisticated harmony under simple themes\",\"The harmonic language does the work that \"\n        .. \"a plainer scorer would ask the orchestration to do.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"Reuse across media\",\"His film scores fed his concert works and back again - the \"\n        .. \"Violin Concerto is largely built from film material. Orchestral craft does not \"\n        .. \"care which medium it was learnt in.\",\"FILM\"},\n    }},\n  },\n  instruments={\"horn\",\"trumpet\",\"strings\",\"brass\",\"woodwind\",\"harp\",\"celesta\"},\n  related={\"composers\",\"steiner\",\"wagner\",\"williams\",\"horn\",\"brass\"},\n}\n\ne{ id=\"rozsa\", name=\"Miklos Rozsa\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"rozsa\",\"miklos rozsa\",\"mikl\u00c3\u00b3s r\u00c3\u00b3zsa\",\"r\u00c3\u00b3zsa\"},\n  summary=\"\\\"A more austere, intellectual approach while maintaining classical \"\n       .. \"foundations\\\" than his Golden Age contemporaries - and the composer who put the \"\n       .. \"theremin into the orchestra.\",\n  facts={ {\"Dates\",\"1907-1995\"}, {\"Look at\",\"Spellbound, Ben-Hur, Double Indemnity, \"\n          .. \"The Thief of Bagdad\"} },\n  sec={\n    {\"Favoured combinations\", {\n      {\"Theremin with full orchestra\",\"Spellbound was \\\"the first score to use a theremin \"\n        .. \"supported by a full orchestra within a motion picture\\\", for the protagonist's \"\n        .. \"phobia. Hitchcock had asked for \\\"a big sweeping love theme... and a 'new sound' \"\n        .. \"for the paranoia\\\". It won the 1945 Oscar.\",\"FILM\"},\n      {\"Two themes, two sound worlds\",\"The love theme in the orchestra, the phobia theme in \"\n        .. \"the theremin - a clean demonstration of using instrumentation, not melody, to \"\n        .. \"separate two ideas.\",\"FILM\"},\n      {\"Austere large-scale brass and chorus\",\"Ben-Hur's processional writing.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"One unfamiliar timbre goes a long way\",\"A single strange instrument against a \"\n        .. \"conventional orchestra reads far more strongly than a generally strange \"\n        .. \"orchestra.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"strings\",\"brass\",\"woodwind\",\"percussion\"},\n  related={\"composers\",\"steiner\",\"korngold\",\"herrmann\",\"blend\"},\n}\n\ne{ id=\"herrmann\", name=\"Bernard Herrmann\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"herrmann\",\"bernard herrmann\",\"bernard hermann\",\"hermann\",\"herman\",\n           \"bernard herman\"},\n  summary=\"The most radical orchestrator in film music. He rarely wrote for the standard \"\n       .. \"orchestra at all: he built a bespoke ensemble for each picture, frequently \"\n       .. \"leaving out whole families. \\\"Herrmann's orchestrations were entirely original, \"\n       .. \"daring and inventive; always appropriate for the context and subsequently \"\n       .. \"incredibly influential in film scoring.\\\"\",\n  facts={ {\"Dates\",\"1911-1975\"},\n          {\"Look at\",\"Citizen Kane, The Day the Earth Stood Still, Vertigo, North by \"\n            .. \"Northwest, Psycho, Fahrenheit 451, Taxi Driver\"} },\n  sec={\n    {\"His signature ensembles\", {\n      {\"Psycho \u00e2\u0080\u0094 strings only\",\"Scored for string orchestra alone, to match Hitchcock's \"\n        .. \"black-and-white photography with a \\\"black and white\\\" sound. The most famous \"\n        .. \"single orchestration decision in film music.\",\"FILM\"},\n      {\"Journey to the Center of the Earth \u00e2\u0080\u0094 no violins, five organs\",\"Woodwind, brass, a \"\n        .. \"large percussion ensemble, nine harps, and five organs (one pipe, four \"\n        .. \"electronic).\",\"FILM\"},\n      {\"Torn Curtain \u00e2\u0080\u0094 no strings at all\",\"A large brass section including nine trombones, \"\n        .. \"percussion, and twelve flutes as the entire woodwind.\",\"FILM\"},\n      {\"The Day the Earth Stood Still \u00e2\u0080\u0094 electronics and brass\",\"Brass ensemble, harps, \"\n        .. \"electronic organ, theremin and electric violin - the founding science-fiction \"\n        .. \"palette.\",\"FILM\"},\n      {\"Vertigo \u00e2\u0080\u0094 harp and vibraphone\",\"The pairing that gives the score its vertiginous \"\n        .. \"shimmer.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"Choose the ensemble, then compose\",\"His method inverts the usual order: decide what \"\n        .. \"the film's sound world is, build an orchestra that can only make that sound, and \"\n        .. \"write inside it. Rimsky-Korsakov's principle taken to its limit - \\\"a work \"\n        .. \"should be written for the size of orchestra that is to perform it\\\".\",\"FILM; cf. RK p.3\"},\n      {\"Subtraction as the strongest move\",\"Removing a family - strings, or everything but \"\n        .. \"strings - changes a score more than any addition can.\",\"FILM; MOD\"},\n      {\"Multiples of one instrument\",\"Nine harps, twelve flutes, nine trombones: a section \"\n        .. \"of one colour behaves like a new instrument, not like a louder old one. Compare \"\n        .. \"Wagner's six harps and Rimsky-Korsakov's note that three or four harps are needed \"\n        .. \"to be heard at all.\",\"FILM; cf. RK p.29\"},\n      {\"Sustained low ostinati\",\"His habit of building tension on repeated low figures \"\n        .. \"rather than on melody.\",\"FILM\"},\n    }},\n  },\n  instruments={\"strings\",\"harp\",\"brass\",\"trombone\",\"flute\",\"percussion\",\"celesta\",\"woodwind\"},\n  related={\"composers\",\"rozsa\",\"goldsmith\",\"elfman\",\"strings\",\"harp\",\"plucked\"},\n}\n\ne{ id=\"morricone\", name=\"Ennio Morricone\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"morricone\",\"ennio morricone\"},\n  summary=\"\\\"He treated the orchestra not as a homogeneous bloc but as a collection of \"\n       .. \"distinctive timbres.\\\" His orchestration \\\"often calls for an unusual combination \"\n       .. \"of instruments, voices, and whistling\\\" - and much of it began as a way round a \"\n       .. \"small budget.\",\n  facts={ {\"Dates\",\"1928-2020\"},\n          {\"Look at\",\"The Good, the Bad and the Ugly; Once Upon a Time in the West; The \"\n            .. \"Mission; Cinema Paradiso; The Untouchables\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Human whistling as a lead instrument\",\"Alessandro Alessandroni's whistle in the \"\n        .. \"Dollars trilogy \\\"became a shorthand for danger. It was no longer just a tune; it \"\n        .. \"was a character in itself.\\\"\",\"FILM\"},\n      {\"Wordless soprano as an orchestral layer\",\"Edda Dell'Orso's voice. Constrained to a \"\n        .. \"small orchestra, \\\"one idea he had was to replace instruments with human \"\n        .. \"voices\\\"; she \\\"pioneered the model of the voice as an atmospheric, non-verbal \"\n        .. \"layer of the orchestration\\\".\",\"FILM\"},\n      {\"Electric guitar with orchestra\",\"The then-new Fender, set against traditional \"\n        .. \"forces.\",\"FILM\"},\n      {\"Harmonica, acoustic and electric guitar\",\"The Western palette, blended with \"\n        .. \"\\\"experimental elements like slide-whistle, woodblock, and male \"\n        .. \"whistling\\\".\",\"FILM\"},\n      {\"Found and non-musical sounds\",\"Gunshots, whips, cracks - treated as instruments in \"\n        .. \"the score, not as sound effects.\",\"FILM\"},\n      {\"Oboe as the voice of innocence\",\"The Mission's Gabriel's Oboe - the reference \"\n        .. \"modern use of the instrument's pastoral character.\",\"FILM; cf. SIN p.85\"},\n    }},\n    {\"What to take from him\", {\n      {\"A budget limit is a style\",\"The whole approach came from not having a full orchestra \"\n        .. \"available. Constraint produced a recognisable voice where abundance might not \"\n        .. \"have.\",\"FILM\"},\n      {\"Treat the voice as a wind instrument\",\"Wordless soprano doubles and blends like a \"\n        .. \"woodwind - and Rimsky-Korsakov's rules for doubling women's voices (violins, \"\n        .. \"violas, clarinets, oboes) apply directly.\",\"FILM; cf. RK p.122\"},\n    }},\n  },\n  instruments={\"oboe\",\"voice\",\"strings\",\"trumpet\",\"percussion\",\"woodwind\"},\n  related={\"composers\",\"voice\",\"oboe\",\"percussion\",\"herrmann\"},\n}\n\ne{ id=\"barry\", name=\"John Barry\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"barry\",\"john barry\",\"john barry prendergast\"},\n  summary=\"A jazz arranger's ear applied to the orchestra: \\\"fusing romantic string \"\n       .. \"melodies with explosive outbursts of brass\\\". His palette is \\\"jazz and blues \"\n       .. \"tinged harmonic language, alternately brooding and stabbing brass chords, \"\n       .. \"sustained string lines, florid violin arabesques, and jabbing percussion\\\".\",\n  facts={ {\"Dates\",\"1933-2011\"}, {\"Look at\",\"the James Bond scores, Out of Africa, \"\n          .. \"Dances with Wolves, Midnight Cowboy\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Low electric guitar figure under brass\",\"His own description of the Bond theme: \\\"a \"\n        .. \"peculiar mixture of that low rock guitar figure, the brass sound, and a bridge \"\n        .. \"that was almost like a Dizzy Gillespie bebop phrase. It was kind of a hybrid of \"\n        .. \"all these things.\\\"\",\"FILM\"},\n      {\"Stabbing muted brass chords\",\"The Bond punctuation - brass used rhythmically rather \"\n        .. \"than melodically.\",\"FILM\"},\n      {\"Long sustained string lines\",\"His romantic manner, often a single unbroken melody \"\n        .. \"over slow harmony.\",\"FILM\"},\n      {\"Jabbing percussion\",\"Sharp, dry hits rather than rolls or swells.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"A rhythm-section instrument inside an orchestra\",\"Electric guitar or drum kit \"\n        .. \"treated as a normal member of the ensemble, not a novelty - the model for most \"\n        .. \"later hybrid scoring.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"brass\",\"trumpet\",\"trombone\",\"strings\",\"percussion\"},\n  related={\"composers\",\"zimmer\",\"brass\",\"strings\",\"percussion\"},\n}\n\ne{ id=\"goldsmith\", name=\"Jerry Goldsmith\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"goldsmith\",\"jerry goldsmith\"},\n  summary=\"\\\"Extremely sensitive to orchestral timbre while exploring unusual instrumental \"\n       .. \"combinations\\\", and the most inventive extender of orchestral technique in film. \"\n       .. \"\\\"He never shied away from utilizing unusual instrumentation, found sounds, \"\n       .. \"emerging technologies, and extended techniques in harmony with more traditional \"\n       .. \"orchestral elements.\\\"\",\n  facts={ {\"Dates\",\"1929-2004\"}, {\"Look at\",\"Planet of the Apes, Alien, Chinatown, \"\n          .. \"Patton, The Omen, Star Trek: The Motion Picture\"} },\n  sec={\n    {\"His signature methods\", {\n      {\"Instruments played wrongly on purpose\",\"Planet of the Apes: \\\"horns blown without \"\n        .. \"mouthpieces\\\", and woodwind players \\\"fingering their keys without using any \"\n        .. \"air\\\" - the orchestra made to imitate the apes' grunting.\",\"FILM\"},\n      {\"Orchestra through an echoplex\",\"Drums looped into an echoplex in Planet of the \"\n        .. \"Apes; string pizzicati filtered through one in Alien to create \\\"alien\\\" \"\n        .. \"sounds.\",\"FILM\"},\n      {\"Extended string techniques as biology\",\"Alien's col legno, sul ponticello and \"\n        .. \"harmonics \\\"create sounds that don't register as music as much as they do \"\n        .. \"biological processes\\\".\",\"FILM\"},\n      {\"Antique and non-orchestral instruments\",\"Alien's orchestra was augmented by shofar, \"\n        .. \"steel drum, serpent (the medieval bass cornet), didgeridoo, whistles and \"\n        .. \"rattles.\",\"FILM\"},\n      {\"Twelve-tone rows as an alien language\",\"Planet of the Apes is written wholesale in \"\n        .. \"an avant-garde idiom, its tone rows creating \\\"an alien musical language that \"\n        .. \"perfectly matched the film's inverted world\\\".\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"The serpent is in this book for a reason\",\"Singleton records the serpent as the \"\n        .. \"obsolete bass of the cornet family, \\\"now obsolete\\\", hanging on a workshop wall. \"\n        .. \"Goldsmith put it in a 1979 film score. Nothing in the orchestra is permanently \"\n        .. \"dead.\",\"FILM; cf. SIN p.117\"},\n      {\"Extend before you add\",\"Most of his strangest sounds come from ordinary instruments \"\n        .. \"played unusually, which any orchestra can do, rather than from instruments you \"\n        .. \"have to find.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"horn\",\"woodwind\",\"strings\",\"pizzicato\",\"percussion\",\"brass\",\"cornet\"},\n  related={\"composers\",\"herrmann\",\"strauss\",\"stravinsky\",\"percussion\",\"pizzicato\"},\n}\n\ne{ id=\"williams\", name=\"John Williams\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"williams\",\"john williams\",\"john t williams\"},\n  summary=\"The late-Romantic orchestra maintained as a living idiom. \\\"Williams is a master \"\n       .. \"not just of composition but of the mechanics of the orchestra, with precise \"\n       .. \"indications of dynamics and articulations being particularly important to his \"\n       .. \"orchestrations.\\\"\",\n  facts={ {\"Dates\",\"b. 1932\"},\n          {\"Star Wars\u00e2\u0080\u0099 orchestra\",\"Triple woodwind, five horns and the usual brass\"},\n          {\"Look at\",\"Star Wars, E.T., Jaws, Schindler's List, Harry Potter, \"\n            .. \"Horn Concerto (2003)\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Horns in unison with other brass, not in octaves\",\"When he transposes a theme into \"\n        .. \"a key comfortable for horns, \\\"he writes them as unison parts with other brass \"\n        .. \"(like trumpets) rather than in octaves, producing a noble, heroic sound\\\". Note \"\n        .. \"that this is Rimsky-Korsakov's brass-unison practice, not his octave \"\n        .. \"practice.\",\"FILM; cf. RK p.55\"},\n      {\"The horn as the leading voice\",\"He has named the French horn as one of his great \"\n        .. \"loves; \\\"brass writing has been his signature at least from Star Wars \"\n        .. \"onward\\\".\",\"FILM\"},\n      {\"Precise articulation and dynamics\",\"The detail in his parts is where the sound comes \"\n        .. \"from - the same lesson as Mahler's per-instrument dynamics.\",\"FILM\"},\n      {\"Careful woodwind balance\",\"\\\"While strings generally balance themselves regardless \"\n        .. \"of voicing, woodwinds require careful attention to achieve proper blend and \"\n        .. \"balance.\\\"\",\"FILM\"},\n      {\"Celesta, harp and high woodwind for magic\",\"The Harry Potter manner - the \"\n        .. \"light-plucked-and-struck group used as a colour block.\",\"FILM; MOD\"},\n      {\"Solo violin as elegy\",\"Schindler's List - the concert-soloist convention brought \"\n        .. \"into a score.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"The tradition still works\",\"His career is the practical demonstration that the \"\n        .. \"19th-century orchestra and the doublings in this encyclopaedia remain a living \"\n        .. \"technique rather than a historical one.\",\"FILM; MOD\"},\n      {\"Write for the players you will get\",\"Five horns rather than four, triple woodwind, \"\n        .. \"and parts that professional orchestras can read at speed.\",\"FILM; cf. RK p.3\"},\n    }},\n  },\n  instruments={\"horn\",\"trumpet\",\"brass\",\"celesta\",\"harp\",\"violin\",\"woodwind\",\"strings\",\n               \"piccolo\",\"timpani\"},\n  related={\"composers\",\"korngold\",\"wagner\",\"horn\",\"brass\",\"celesta\",\"balance\"},\n}\n\ne{ id=\"elfman\", name=\"Danny Elfman\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"elfman\",\"danny elfman\"},\n  summary=\"A gothic-carnival palette: \\\"Elfman's signature sound is often characterized by \"\n       .. \"unique timbres like celesta and choirs that evoke gothic elements\\\".\",\n  facts={ {\"Dates\",\"b. 1953\"}, {\"Look at\",\"Edward Scissorhands, Batman, Beetlejuice, \"\n          .. \"The Nightmare Before Christmas, Mars Attacks!\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Celesta\",\"The instrument most associated with him - used melodically, not as \"\n        .. \"decoration.\",\"FILM\"},\n      {\"Boy soprano and wordless choir\",\"\\\"An array of 'exotic' sounds, including solos for \"\n        .. \"boy soprano\\\" - Edward Scissorhands being the defining case.\",\"FILM\"},\n      {\"Theremin\",\"Used extensively in Mars Attacks!, \\\"harkening back to Bernard \"\n        .. \"Herrmann's score for The Day the Earth Stood Still\\\".\",\"FILM\"},\n      {\"Idioms outside the orchestra\",\"He also draws on \\\"the German music hall tradition, \"\n        .. \"1930's swing, bluegrass, and African percussion styles\\\".\",\"FILM\"},\n      {\"Low brass and bass voices against high bells\",\"The gothic contrast: something very \"\n        .. \"dark at the bottom, something glittering at the top, little in the middle. \"\n        .. \"Compare Rimsky-Korsakov on widely separated extremes, which he calls good for \"\n        .. \"\\\"strange and grotesque effects\\\".\",\"FILM; cf. RK p.106-107\"},\n    }},\n  },\n  instruments={\"celesta\",\"glockenspiel\",\"voice\",\"chorus\",\"brass\",\"percussion\",\"harp\",\n               \"strings\"},\n  related={\"composers\",\"herrmann\",\"celesta\",\"chorus\",\"glockenspiel\"},\n}\n\ne{ id=\"shore\", name=\"Howard Shore\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"shore\",\"howard shore\"},\n  summary=\"The most systematic use of instrumentation as world-building in film music: in \"\n       .. \"The Lord of the Rings each culture has its own instruments, so that the \"\n       .. \"orchestration tells you where you are before the theme does.\",\n  facts={ {\"Dates\",\"b. 1946\"}, {\"Look at\",\"The Lord of the Rings trilogy, The Hobbit, \"\n          .. \"The Fly, Hugo, Crash\"} },\n  sec={\n    {\"Instruments as places\", {\n      {\"The Shire \u00e2\u0080\u0094 British and Irish folk instruments\",\"Mandolin, Celtic harp, musette (a \"\n        .. \"kind of accordion) and bodhran, \\\"reflecting how Tolkien saw the Shire\\\".\",\"FILM\"},\n      {\"Rohan \u00e2\u0080\u0094 Hardanger fiddle\",\"The Norwegian fiddle for the horse-riders.\",\"FILM\"},\n      {\"Gollum \u00e2\u0080\u0094 Hungarian cimbalom\",\"\\\"A creepy theme on the Hungarian cimbalom (similar to \"\n        .. \"a hammered dulcimer)\\\".\",\"FILM\"},\n      {\"The Ents \u00e2\u0080\u0094 woody percussion\",\"Log drums and marimba.\",\"FILM\"},\n      {\"Antiquity \u00e2\u0080\u0094 ethnic flutes and djembe\",\"\\\"The haunting sounds of ethnic flutes and \"\n        .. \"djembe drums introduce a sense of ancient mystery.\\\"\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"Let the instrument carry the identity\",\"A theme can be moved anywhere; an instrument \"\n        .. \"cannot be mistaken. Assigning a culture, character or place its own timbre is \"\n        .. \"Wagner's leitmotif principle applied to orchestration rather than to \"\n        .. \"melody.\",\"FILM; cf. SIN ch.VIII\"},\n      {\"Folk instruments inside an orchestral texture\",\"Rimsky-Korsakov made the same point \"\n        .. \"about guitar, domra, zither, mandoline and oriental tambourine - \\\"employed from \"\n        .. \"time to time for descriptive-aesthetic purposes\\\".\",\"FILM; cf. RK p.118\"},\n    }},\n  },\n  instruments={\"harp\",\"plucked\",\"percussion\",\"flute\",\"strings\",\"brass\",\"chorus\"},\n  related={\"composers\",\"wagner\",\"plucked\",\"percussion\",\"flute\"},\n}\n\ne{ id=\"zimmer\", name=\"Hans Zimmer\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"zimmer\",\"hans zimmer\"},\n  summary=\"\\\"A minimalist composer with a sort of maximalist production sense.\\\" He \"\n       .. \"\\\"cultivated a hybrid electronic-orchestral aesthetic that uses analog and \"\n       .. \"digital oscillators, filters, and amplifiers to twist and augment solo instrument \"\n       .. \"samples into a synthesized whole\\\" - orchestration as sound design.\",\n  facts={ {\"Dates\",\"b. 1957\"}, {\"Look at\",\"Gladiator, The Dark Knight, Inception, \"\n          .. \"Interstellar, Dune\"} },\n  sec={\n    {\"His signature methods\", {\n      {\"\u00e2\u0080\u0099Cello and low string ostinato\",\"\\\"Low-frequency synths or cellos often underpin \"\n        .. \"rhythmic motifs to create urgency, and repeating rhythmic cells in strings, \"\n        .. \"percussion or synths provide propulsion and allow harmonic shifts above a fixed \"\n        .. \"groove.\\\"\",\"FILM\"},\n      {\"Orchestra blended with synthesizers\",\"\\\"Blending classic orchestral instruments - \"\n        .. \"strings, brass, and percussion - with modern synthesizers and sound design, \"\n        .. \"digital textures and ambient pads.\\\"\",\"FILM\"},\n      {\"Extended techniques for edge\",\"\\\"Bowed cymbal, col legno strings, muted brass, sul \"\n        .. \"ponticello, breathy choir, and granularly treated piano sounds are common to add \"\n        .. \"edge and atmosphere.\\\"\",\"FILM\"},\n      {\"Massed brass on very few notes\",\"The maximalist-minimalist signature: enormous \"\n        .. \"forces on simple material.\",\"FILM\"},\n      {\"Organ as an orchestral instrument\",\"Interstellar - a colour largely absent from the \"\n        .. \"concert orchestra brought back as a lead.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"The balance rules still apply\",\"Massed low brass over a fixed ostinato is a \"\n        .. \"distribution problem like any other - and Rimsky-Korsakov's warning that widely \"\n        .. \"separated extremes with an empty middle sound strange is exactly what this style \"\n        .. \"exploits.\",\"FILM; cf. RK p.106-107\"},\n      {\"Orchestrating for the microphone\",\"Much of the sound is made after the players \"\n        .. \"leave, in processing and mixing. That is a real technique, but it is not \"\n        .. \"transferable to a concert score.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"cello\",\"doublebass\",\"brass\",\"percussion\",\"strings\",\"chorus\",\"piano\"},\n  related={\"composers\",\"barry\",\"cello\",\"brass\",\"balance\",\"range\"},\n}\n\ne{ id=\"desplat\", name=\"Alexandre Desplat\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"desplat\",\"alexandre desplat\"},\n  summary=\"\\\"Playful themes, insistent accompaniments, unusual orchestration and an innate \"\n       .. \"understanding of screen drama.\\\" The most woodwind-forward of the major film \"\n       .. \"composers.\",\n  facts={ {\"Dates\",\"b. 1961\"}, {\"Look at\",\"The Grand Budapest Hotel, The Shape of Water, \"\n          .. \"Harry Potter and the Deathly Hallows, The Painted Veil, Little Women\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Twelve flutes and nothing else in the woodwind\",\"The Shape of Water: \\\"the woodwind \"\n        .. \"section is comprised entirely of flutes - 12 of them across the entire sonic \"\n        .. \"range - but no oboes, no bassoons, no clarinets. This was a conscious choice... \"\n        .. \"to give his woodwind section a specific timbre that represents the sound of \"\n        .. \"water.\\\" Compare Herrmann's twelve flutes in Torn Curtain, and Mendelssohn's and \"\n        .. \"Weber's older association of woodwind with water.\",\"FILM\"},\n      {\"Woodwind trills as an action device\",\"\\\"The familiar woodwind trills that abound are \"\n        .. \"a hallmark and have underpinned Desplat's action material throughout his \"\n        .. \"career.\\\" Note Rimsky-Korsakov's pairing of woodwind and violin trills with a \"\n        .. \"triangle or tambourine tremolo.\",\"FILM; cf. RK p.117\"},\n      {\"Plucked and struck instruments as rhythm\",\"Harp, celesta, pizzicato and light \"\n        .. \"percussion carrying the pulse instead of drums.\",\"FILM\"},\n      {\"Chamber-scale colours inside a film orchestra\",\"Small, clearly identifiable groups \"\n        .. \"rather than tutti.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"A family of one instrument\",\"Building a whole section from one instrument across its \"\n        .. \"range - twelve flutes - produces a colour no mixed section can. The same logic as \"\n        .. \"Herrmann's nine harps.\",\"FILM; MOD\"},\n    }},\n  },\n  instruments={\"flute\",\"woodwind\",\"harp\",\"celesta\",\"pizzicato\",\"percussion\",\"strings\"},\n  related={\"composers\",\"herrmann\",\"debussy\",\"flute\",\"woodwind\",\"harp\"},\n}\n\ne{ id=\"greenwood\", name=\"Jonny Greenwood\", family=\"Film Composers\", kind=\"composer\",\n  aliases={\"greenwood\",\"jonny greenwood\",\"johnny greenwood\"},\n  summary=\"A composer who came to film from rock and brought concert-hall modernism with \"\n       .. \"him - Penderecki and Messiaen rather than Korngold.\",\n  facts={ {\"Dates\",\"b. 1971\"}, {\"Look at\",\"There Will Be Blood, The Master, Phantom \"\n          .. \"Thread, You Were Never Really Here, Norwegian Wood\"} },\n  sec={\n    {\"His signature colours\", {\n      {\"Ondes Martenot\",\"\\\"The Martenot has featured in almost all of his film scores, and \"\n        .. \"it has come to embody his voice.\\\" His interest comes from Messiaen, and the \"\n        .. \"Turangalila Symphony in particular.\",\"FILM\"},\n      {\"Aleatoric string writing\",\"\\\"Greenwood shows his taste for aleatoric techniques in \"\n        .. \"string writing, used in conjunction with the use of motif\\\" - clusters and \"\n        .. \"controlled indeterminacy rather than tunes.\",\"FILM\"},\n      {\"Strings played for texture, not line\",\"Extended techniques used so the string body \"\n        .. \"reads as material rather than melody.\",\"FILM\"},\n    }},\n    {\"What to take from him\", {\n      {\"Where the strings can still go\",\"The one group Rimsky-Korsakov says we can listen to \"\n        .. \"indefinitely without tiring is also the one with the most unexplored technique. \"\n        .. \"Greenwood is the current demonstration.\",\"FILM; cf. RK p.35\"},\n    }},\n  },\n  instruments={\"strings\",\"violin\",\"viola\",\"cello\",\"percussion\"},\n  related={\"composers\",\"stravinsky\",\"strings\",\"violin\"},\n}\n\nreturn D\n", "orchestration_data.lua": "--[[\n  orchestration_data.lua\n  Knowledge base for Orchestration Helper.\n\n  Every statement here is drawn from the reference works listed in SOURCES\n  below. Citation tags on each item point back to source + page.\n\n  EDITORIAL RULE (consensus only)\n  -------------------------------\n  Combinations that the sources describe as rare, exceptional, seldom used or\n  not recommended are NEVER listed as suggestions. They appear, if at all, only\n  under \"Use sparingly\", so the encyclopaedia stays honest without recommending\n  something no one actually writes.\n]]--\n\nlocal D = {}\n\nD.SOURCES = {\n  RK = {\n    tag   = \"RK\",\n    short = \"Rimsky-Korsakov, Principles of Orchestration\",\n    full  = \"Nikolay Rimsky-Korsakov, 'Principles of Orchestration, with Musical \"\n         .. \"Examples Drawn from His Own Works', ed. Maximilian Steinberg, \"\n         .. \"trans. Edward Agate (Paris: Edition Russe de Musique, 1922). Public \"\n         .. \"domain. Page numbers follow Volume I of that edition.\",\n  },\n  SIN = {\n    tag   = \"SIN\",\n    short = \"Singleton, The Orchestra and Its Instruments\",\n    full  = \"Esther Singleton, 'The Orchestra and Its Instruments' (New York: \"\n         .. \"The Symphony Society of New York, 1917). Public domain. Quotes \"\n         .. \"Berlioz, Lavignac, Gevaert, Forsyth and Stone at length; those \"\n         .. \"attributions are kept in the text.\",\n  },\n  WP = {\n    tag   = \"WP\",\n    short = \"Wikipedia, \u00e2\u0080\u009cOrchestration\u00e2\u0080\u009d\",\n    full  = \"Wikipedia contributors, 'Orchestration', Wikipedia, The Free \"\n         .. \"Encyclopedia (CC BY-SA). Used for the standard instrumentation \"\n         .. \"shorthand and for the orchestration bibliography.\",\n  },\n}\n\n-- e = entry constructor sugar; keeps the table literal below readable.\nD.ENTRIES = {}\nlocal function e(t) D.ENTRIES[#D.ENTRIES+1] = t; return t end\n\n-- ============================================================================\n-- SECTIONS\n-- ============================================================================\n\ne{ id=\"strings\", name=\"String Section\", family=\"Strings\", kind=\"section\",\n  aliases={\"strings\",\"string\",\"string group\",\"string quartet\",\"string orchestra\",\n           \"bowed strings\",\"stringed instruments\"},\n  summary=\"The five-part core of the orchestra and the group Rimsky-Korsakov ranks \"\n       .. \"first for expression: \\\"We can listen to strings for an almost indefinite \"\n       .. \"period of time without getting tired, so varied are their characteristics.\\\" \"\n       .. \"Unlike the wind, its number of parts is constant whatever the size of the score.\",\n  facts={\n    {\"Parts\",\"Violins I, Violins II, Violas, Violoncellos, Double basses\"},\n    {\"Choir\",\"Violins = soprano (I) and mezzo-soprano (II), Violas = alto/tenor, \"\n          .. \"Violoncellos = tenor/bass, Double basses = deeper bass\"},\n  },\n  sec={\n    {\"Standard roster\", {\n      {\"Violins I\",\"16 (full) / 12 (medium) / 8 (small)\",\"RK p.6\"},\n      {\"Violins II\",\"14 / 10 / 6\",\"RK p.6\"},\n      {\"Violas\",\"12 / 8 / 4\",\"RK p.6\"},\n      {\"Violoncellos\",\"10 / 6 / 3\",\"RK p.6\"},\n      {\"Double basses\",\"8-10 / 4-6 / 2-3\",\"RK p.6\"},\n      {\"Write for the medium body\",\"\\\"Played by a larger orchestra a work will be \"\n        .. \"heard to greater advantage; played by a smaller one, the harm done will \"\n        .. \"be minimised.\\\" Fewer than 8 first violins destroys the balance against \"\n        .. \"the wind; more than 20 obliges you to reinforce the wind.\",\"RK p.6-7\"},\n    }},\n    {\"Pairings in unison\", {\n      {\"Violins I + Violins II\",\"No change of colour at all - pure string quartet \"\n        .. \"tone, enriched and amplified. The weight of violins keeps any doubling \"\n        .. \"woodwind from predominating.\",\"RK p.39\"},\n      {\"Violins + Violas\",\"No special new character; the violins stay predominant \"\n        .. \"and the resonance is rich and full.\",\"RK p.39\"},\n      {\"Violas + Violoncellos\",\"Rich, full resonance with the 'cello quality on top.\",\"RK p.39\"},\n      {\"Violins + Violoncellos\",\"Similar to the above but fuller; the 'cello tone \"\n        .. \"prevails.\",\"RK p.40\"},\n      {\"Vns I + Vns II + Violas + \u00e2\u0080\u0099Cellos\",\"Only possible in the alto-tenor register. \"\n        .. \"Complex, very tense and powerful in forte; extremely full and rich in piano.\",\"RK p.40\"},\n      {\"Violoncellos + Double basses\",\"Rich and full; used for phrases in the very \"\n        .. \"low register.\",\"RK p.40\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Vns I / Vns II\",\"Very common, above all for figures in the very high register, \"\n        .. \"which otherwise stand too isolated from the ensemble. Secures expression, \"\n        .. \"fullness and firmness.\",\"RK p.40\"},\n      {\"Vns / Violas\",\"Common, especially when the lower octave falls below the \"\n        .. \"violin's open G.\",\"RK p.41\"},\n      {\"Vns I + II / Violas\",\"Use for greater brilliance in the upper part.\",\"RK p.41\"},\n      {\"Vns I / Vns II + Violas\",\"Use to give the lower part a fuller, more \"\n        .. \"cantabile quality.\",\"RK p.41\"},\n      {\"Violas / \u00e2\u0080\u0099Cellos\",\"Of special use when the violins are otherwise employed.\",\"RK p.41\"},\n      {\"Vns / \u00e2\u0080\u0099Cellos\",\"For very expressive passages with the 'cellos on the A or D \"\n        .. \"string; more resonant than violas/'cellos, and frequent.\",\"RK p.42\"},\n      {\"\u00e2\u0080\u0099Cellos / D. basses\",\"The normal construction of the bass. Examples are \"\n        .. \"\\\"to be found everywhere\\\"; the bass part is sometimes simplified.\",\"RK p.42\"},\n      {\"Vns I + II / Violas + \u00e2\u0080\u0099Cellos\",\"Each octave doubled in unison. \\\"Constantly \"\n        .. \"found\\\", and produces a beautiful tone, somewhat severe in character. For \"\n        .. \"melodies in the middle orchestral range.\",\"RK p.43\"},\n    }},\n    {\"Register rule\", {\n      {\"Very high melodies\",\"Above the middle of the 5th octave, double an octave \"\n        .. \"below.\",\"RK p.43\"},\n      {\"Very low melodies\",\"Below the middle of the 1st octave, double an octave \"\n        .. \"above.\",\"RK p.43\"},\n    }},\n    {\"Dividing the parts (divisi)\", {\n      {\"Usual pairs\",\"Vns I / Vns II  \u00c2\u00b7  Vns II / Violas  \u00c2\u00b7  Violas / 'Cellos  \u00c2\u00b7  \"\n        .. \"'Cellos / D. basses.\",\"RK p.7\"},\n      {\"Less frequent\",\"Vns I / Violas  \u00c2\u00b7  Vns II / 'Cellos  \u00c2\u00b7  Violas / D. basses.\",\"RK p.7\"},\n      {\"Prefer Vns II / Violas\",\"Their numbers are nearly the same (14-10-6 against \"\n        .. \"12-8-4), their roles are allied, and second violins normally sit nearer \"\n        .. \"the violas - so power and execution stay unified.\",\"RK p.8\"},\n      {\"Marking\",\"Always write how the passage divides: \\\"Vns I, 1, 2, 3 desks\\\", \"\n        .. \"\\\"6 'Cellos div. a 3\\\". Division into four or more parts is rare and suits \"\n        .. \"piano passages, as it greatly reduces volume.\",\"RK p.7\"},\n    }},\n    {\"Balance against the wind\", {\n      {\"Piano\",\"One whole department (all Vns I, all Vns II ...) = one wind \"\n        .. \"instrument.\",\"RK p.33\"},\n      {\"Forte\",\"One whole department = two wind instruments, e.g. Violins I = 2 \"\n        .. \"Flutes = 1 Oboe + 1 Clarinet.\",\"RK p.33\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Divided strings of the same kind in octaves\",\"Violas I / Violas II, \"\n        .. \"'Cellos I / 'Cellos II, D. basses I / D. basses II: generally to be \"\n        .. \"avoided, because the parts fall on strings that do not correspond and \"\n        .. \"unity of tone is impaired. Violins are the exception.\",\"RK p.44\"},\n      {\"Violas / D. basses in octaves\",\"Seldom arises; only when the 'cellos are \"\n        .. \"otherwise employed.\",\"RK p.42\"},\n      {\"Violins divisi in octaves\",\"Halves the number of players and so drains the \"\n        .. \"melody of resonance - noticeable above all in small orchestras. Usable \"\n        .. \"when the woodwind doubles the strings.\",\"RK p.40-41\"},\n      {\"Vns I / Vns II / Violas / \u00e2\u0080\u0099Cellos / D. basses in 4 octaves\",\"Very seldom \"\n        .. \"found, and as a rule only when supported by wind.\",\"RK p.45\"},\n      {\"Solo double bass\",\"\\\"Practically unknown\\\"; the solo viola is also seldom \"\n        .. \"found. Violin and 'cello solos are the usual ones.\",\"RK p.104\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s practical notes\", {\n      {\"Compare it with the choir\",\"\\\"Like the vocal choir, the string family offers \"\n        .. \"excellent homogeneity of timbre, and can play anything from the simplest \"\n        .. \"monophonic line to the richest polyphony. Virtually anything that is \"\n        .. \"suitable for choir will also sound well in strings\\\" - with a much wider \"\n        .. \"range, greater mobility, more varied articulation, and chords.\",\"BEL p.6\"},\n      {\"Cross the parts freely\",\"\\\"Unlike choral writing, string writing normally \"\n        .. \"abounds in crossing. This allows the lower instruments to play the main line \"\n        .. \"from time to time, and, most importantly, gives all the individual sections \"\n        .. \"in the family freedom to move... Given the easy blend within the family, \"\n        .. \"such crossing creates no special problems.\\\"\",\"BEL p.6\"},\n      {\"Pizzicato is percussion, not strings\",\"\\\"They are best thought of as percussion \"\n        .. \"sounds. While produced by string instruments, they have no timbral affinity \"\n        .. \"with bowed strings.\\\" Treat plucked strings as pitched percussion when \"\n        .. \"judging blend and contrast.\",\"BEL p.7 & p.25\"},\n      {\"They balance themselves\",\"Unlike the woodwind, \\\"strings generally balance \"\n        .. \"themselves regardless of voicing\\\".\",\"MOD\"},\n    }},\n  },\n  related={\"violin\",\"viola\",\"cello\",\"doublebass\",\"pizzicato\",\"woodwind\",\"brass\"},\n}\n\ne{ id=\"woodwind\", name=\"Woodwind Section\", family=\"Woodwind\", kind=\"section\",\n  aliases={\"woodwind\",\"woodwinds\",\"wood-wind\",\"wood wind\",\"winds\",\"wind section\",\n           \"woodwind section\",\"wws\"},\n  summary=\"Unlike the strings, the woodwind group varies in both the number of parts \"\n       .. \"and its volume of tone, and the composer chooses the formation. The \"\n       .. \"difference in register and quality between flutes, oboes, clarinets and \"\n       .. \"bassoons is \\\"striking to a degree\\\".\",\n  facts={\n    {\"Natural order\",\"Flutes, Oboes, Clarinets, Bassoons - the order used in full \"\n       .. \"scores and the one that produces the most natural resonance\"},\n    {\"Two colour classes\",\"Nasal and dark: oboes, bassoons (+ English horn, \"\n       .. \"contrabassoon). Bright 'chest-voice': flutes, clarinets (+ piccolo, \"\n       .. \"alto flute, E-flat clarinet, bass clarinet)\"},\n  },\n  sec={\n    {\"Formation \u00e2\u0080\u0094 in pairs\", {\n      {\"Flutes\",\"2 (II takes piccolo)\",\"RK p.13\"},\n      {\"Oboes\",\"2 (II takes English horn)\",\"RK p.13\"},\n      {\"Clarinets\",\"2 (II takes bass clarinet)\",\"RK p.13\"},\n      {\"Bassoons\",\"2\",\"RK p.13\"},\n    }},\n    {\"Formation \u00e2\u0080\u0094 in threes\", {\n      {\"Flutes\",\"3 (III takes piccolo, II takes alto flute)\",\"RK p.13\"},\n      {\"Oboes\",\"2 + 1 English horn (III)\",\"RK p.13\"},\n      {\"Clarinets\",\"3 (II takes E-flat clarinet, III takes bass clarinet)\",\"RK p.13\"},\n      {\"Bassoons\",\"2 + 1 contrabassoon (III)\",\"RK p.13\"},\n    }},\n    {\"Formation \u00e2\u0080\u0094 in fours\", {\n      {\"Flutes\",\"1 piccolo (IV) + 3 flutes (III takes alto flute)\",\"RK p.13\"},\n      {\"Oboes\",\"3 + 1 English horn (IV)\",\"RK p.13\"},\n      {\"Clarinets\",\"3 (II takes E-flat clarinet) + 1 bass clarinet (IV)\",\"RK p.13\"},\n      {\"Bassoons\",\"3 + 1 contrabassoon (IV)\",\"RK p.13\"},\n    }},\n    {\"Who changes instruments\", {\n      {\"Never the firsts\",\"The first flute, first oboe, first clarinet and first \"\n        .. \"bassoon never change instrument - their parts are too important to turn \"\n        .. \"from one mouthpiece to another.\",\"RK p.12\"},\n      {\"The specials\",\"Piccolo, alto flute, English horn, E-flat clarinet, bass \"\n        .. \"clarinet and contrabassoon go to the second and third players, who are \"\n        .. \"used to them.\",\"RK p.12\"},\n    }},\n    {\"Pairings in unison\", {\n      {\"Flute + Oboe\",\"Fuller than the flute, sweeter than the oboe. Played softly \"\n        .. \"the flute predominates low, the oboe in the upper register.\",\"RK p.47\"},\n      {\"Flute + Clarinet\",\"Fuller than the flute, duller than the clarinet. Flute \"\n        .. \"predominates lower, clarinet higher.\",\"RK p.47\"},\n      {\"Oboe + Clarinet\",\"Fuller than either alone. The dark nasal oboe prevails low, \"\n        .. \"the bright 'chest' clarinet high.\",\"RK p.47\"},\n      {\"Flute + Oboe + Clarinet\",\"Very full. Flute predominates low, oboe in the \"\n        .. \"middle, clarinet high.\",\"RK p.48\"},\n      {\"Bassoon + Clarinet\",\"Very full. The clarinet's gloom prevails low, the \"\n        .. \"bassoon's thinner quality higher.\",\"RK p.48\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Natural order (upper / lower)\",\"Fl/Ob  \u00c2\u00b7  Fl/Cl  \u00c2\u00b7  Ob/Cl  \u00c2\u00b7  Ob/Fag  \u00c2\u00b7  \"\n        .. \"Cl/Fag. Deviating from it - bassoon above clarinet or oboe, clarinet \"\n        .. \"above oboe or flute - confuses the registers and the relationship \"\n        .. \"between the tone qualities is lost.\",\"RK p.49\"},\n      {\"Same branch, always good\",\"Fag / C-Fag  \u00c2\u00b7  Cl / Bass cl  \u00c2\u00b7  Ob / Eng horn  \"\n        .. \"\u00c2\u00b7  E-flat cl / Cl  \u00c2\u00b7  Fl / Alto fl  \u00c2\u00b7  Picc / Fl.\",\"RK p.50\"},\n      {\"Extreme high compass\",\"Double an octave lower: Picc/Fl, Picc/Ob, Picc/Cl.\",\"RK p.50\"},\n      {\"Extreme low compass\",\"Double an octave higher: Fag/C-Fag, Bass cl/Fag, \"\n        .. \"Cl/Fag, Cl/Bass cl.\",\"RK p.50\"},\n      {\"Mixed timbres in octaves\",\"Fully available, following the same rules, e.g. \"\n        .. \"Cl+Ob / Cl+Eng horn, or 2 Fl+Ob / 2 Cl+Eng horn.\",\"RK p.50-51\"},\n      {\"Three octaves\",\"Fl/Ob/Cl  \u00c2\u00b7  Ob/Cl/Fag  \u00c2\u00b7  Fl/Cl/Fag  \u00c2\u00b7  Fl/Ob/Fag.\",\"RK p.51\"},\n      {\"Four octaves\",\"Fl/Ob/Cl/Fag.\",\"RK p.51\"},\n    }},\n    {\"Thirds and sixths\", {\n      {\"For thirds, use one colour\",\"2 Flutes, 2 Oboes, 2 Clarinets or 2 Bassoons - \"\n        .. \"best for equality of tone.\",\"RK p.52\"},\n      {\"For sixths, mix colours\",\"In natural register order: Fl/Ob, Fl/Cl, Ob/Cl, \"\n        .. \"Cl/Fag, Ob/Fag.\",\"RK p.52\"},\n      {\"Doubled thirds and sixths\",\"Fl+Ob / Fl+Ob, Fl+Cl / Fl+Cl, or Fl+Ob / Fl+Cl. \"\n        .. \"Tripled: Fl+Ob+Cl / Fl+Ob+Cl, or Ob+2Fl / Ob+2Cl.\",\"RK p.52-53\"},\n    }},\n    {\"Harmony\", {\n      {\"Keep writing close\",\"Modern practice allows no void in the intermediate \"\n        .. \"parts. Widely-divided harmony is rare and belongs to piano passages; \"\n        .. \"close writing is the more frequent form, forte or piano.\",\"RK p.78\"},\n      {\"In pairs, mix the doubled timbres\",\"When the wind is in pairs it is a good \"\n        .. \"plan to mix doubled timbres as much as possible. Each chord should be \"\n        .. \"made entirely of doubled or entirely of undoubled parts.\",\"RK p.77-79\"},\n      {\"Overlaying beats crossing\",\"Of overlaying, crossing and enclosure of parts, \"\n        .. \"overlaying (strict natural order) is the best default. Three-part chords \"\n        .. \"go to two instruments of one timbre and a third of another - never to \"\n        .. \"three different timbres.\",\"RK p.72-75\"},\n      {\"Four different timbres\",\"Fine in widely-divided four-part harmony (and the \"\n        .. \"higher the registers, the less the gaps show), but to be avoided in \"\n        .. \"close four-part harmony, where the registers will not correspond.\",\"RK p.74\"},\n      {\"Concords to like instruments\",\"Give octaves, thirds and sixths to instruments \"\n        .. \"of the same kind or colour, and discords to different ones - especially \"\n        .. \"with the penetrating oboe.\",\"RK p.72\"},\n    }},\n    {\"Playing characteristics\", {\n      {\"Most flexible\",\"Flutes, then clarinets; but the clarinet beats both for \"\n        .. \"expressive power and subtlety, being able to reduce tone to a breath.\",\"RK p.19\"},\n      {\"Legato vs staccato\",\"Flutes and clarinets excel in sustained legato; oboes \"\n        .. \"and bassoons in distinct, penetrating staccato.\",\"RK p.19\"},\n      {\"Double tonguing\",\"Only on the flute, the reedless instrument.\",\"RK p.19\"},\n      {\"Awkward leaps\",\"The clarinet is not well adapted to sudden octave leaps; \"\n        .. \"these are easier on flute, oboe and bassoon.\",\"RK p.20\"},\n      {\"Arpeggios\",\"Rapid alternation of two intervals legato sounds well on flutes \"\n        .. \"and clarinets, but not on oboes and bassoons.\",\"RK p.20\"},\n      {\"Breathing\",\"Wind players cannot manage extremely long sustained passages - \"\n        .. \"give them rest from time to time. String players need none.\",\"RK p.20\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Bassoon + Oboe, Bassoon + Flute\",\"\\\"Very seldom found except in certain \"\n        .. \"orchestral tutti\\\", where they add resonance without creating a fresh \"\n        .. \"atmosphere. The same applies to Bassoon+Clarinet+Oboe and \"\n        .. \"Bassoon+Clarinet+Flute.\",\"RK p.48\"},\n      {\"All four in unison\",\"Bassoon + Clarinet + Oboe + Flute is \\\"equally rare\\\"; \"\n        .. \"the colour is rich but hard to define.\",\"RK p.48\"},\n      {\"Flute + Bassoon in octaves\",\"Rare, because the two registers lie so far \"\n        .. \"apart.\",\"RK p.49\"},\n      {\"Two of the same instrument in octaves\",\"2 Flutes, 2 Clarinets or 2 Bassoons \"\n        .. \"in octaves is \\\"certainly not to be recommended\\\" - the two registers do \"\n        .. \"not correspond. Safe only when strings (arco or pizz.) double both, \"\n        .. \"especially in the middle compass, for repeated or sustained notes.\",\"RK p.49-50\"},\n      {\"Over-doubling generally\",\"Combining timbres adds resonance, sweetness and \"\n        .. \"power but restricts variety of colour and expression: \\\"Individual \"\n        .. \"timbres lose their characteristics when associated with others.\\\" Give \"\n        .. \"phrases needing diverse expression to solo instruments.\",\"RK p.48\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s practical notes\", {\n      {\"Each woodwind is three instruments\",\"\\\"A good policy is to consider each \"\n        .. \"woodwind as being three instruments in one: a high, a middle, and a low \"\n        .. \"timbre. Combinations that work well in one register can be quite odd in \"\n        .. \"another.\\\"\",\"BEL p.7\"},\n      {\"Each type is its own choir\",\"\\\"Each type of woodwind is, in effect, a member of \"\n        .. \"a separate choir: For example, clarinets are available from contrabass to \"\n        .. \"piccolo.\\\" The double reeds - oboe, English horn, bassoon - can be treated \"\n        .. \"as one family.\",\"BEL p.7\"},\n      {\"Chords are the hard part\",\"\\\"The main problem in writing for woodwinds occurs \"\n        .. \"when they are used in chords, due to their disparity of timbres.\\\" No \"\n        .. \"woodwind chord \\\"blends in the way a string or a brass chord would\\\"; \"\n        .. \"Rimsky-Korsakov's overlapping and enclosure \\\"work by making it difficult to \"\n        .. \"decipher who is doing what, in effect fooling the ear\\\".\",\"BEL p.7-8\"},\n      {\"A different timbre per note is crude\",\"\\\"The common beginner's mistake, of \"\n        .. \"writing a chord with each note in a different timbre - e.g. four timbres for \"\n        .. \"a four note chord - is very crude.\\\" Stacked arrangements are the worst; \"\n        .. \"overlapping ones blend best.\",\"BEL p.7-8\"},\n      {\"The oboe decides the blend\",\"\\\"When writing for massed woodwinds, the oboe is \"\n        .. \"the instrument most likely to hurt the overall blend. It will definitively \"\n        .. \"color any combination, for better or for worse.\\\" The same chord scored with \"\n        .. \"oboes is \\\"considerably more pungent\\\".\",\"BEL p.8\"},\n      {\"With strings, the job is thickness\",\"\\\"When used in the same plane of tone with \"\n        .. \"strings, the main function of woodwinds is to add volume ('thickness').\\\" An \"\n        .. \"octave above the strings they can instead add luminosity.\",\"BEL p.8-9\"},\n      {\"With brass, the job is the top of the chord\",\"\\\"When used in chords, in the same \"\n        .. \"plane of tone with the brass, the winds' main function is to complete the top \"\n        .. \"of the harmony above, since doubling at the unison is virtually \"\n        .. \"imperceptible.\\\"\",\"BEL p.10\"},\n    }},\n  },\n  related={\"flute\",\"oboe\",\"clarinet\",\"bassoon\",\"piccolo\",\"englishhorn\",\"bassclarinet\",\n           \"contrabassoon\",\"strings\",\"brass\",\"blend\"},\n}\n\ne{ id=\"brass\", name=\"Brass Section\", family=\"Brass\", kind=\"section\",\n  aliases={\"brass\",\"brasswind\",\"brass-wind\",\"brass section\",\"brass group\",\"horns and trumpets\"},\n  summary=\"The most resonant group. \\\"Though far less flexible than the wood-wind, \"\n       .. \"brass instruments heighten the effect of other orchestral groups by their \"\n       .. \"powerful resonance.\\\" Uniform in resonance throughout, but less suited to \"\n       .. \"expressive playing than the woodwind - energetic power, simplicity and \"\n       .. \"eloquence are its valuable qualities.\",\n  facts={\n    {\"Score order\",\"Trumpets, Horns, Trombones, Tuba\"},\n    {\"Swell\",\"\\\"Brass instruments possess a remarkable capacity for swelling from \"\n       .. \"pianissimo to fortissimo, and reducing the tone inversely\\\" - the sf > p \"\n       .. \"effect is excellent\"},\n  },\n  sec={\n    {\"Formation\", {\n      {\"With woodwind in pairs\",\"2 Trumpets, 4 Horns, 3 Trombones, 1 Tuba.\",\"RK p.22\"},\n      {\"With woodwind in threes\",\"3 Trumpets (III takes alto trumpet, or use 2 \"\n        .. \"Cornets + 2 Trumpets), 4 Horns, 3 Trombones, 1 Tuba.\",\"RK p.22\"},\n      {\"With woodwind in fours\",\"3 Trumpets (II takes small trumpet, III alto or \"\n        .. \"bass trumpet), 6 or 8 Horns, 3 Trombones, 1 Tuba.\",\"RK p.22\"},\n    }},\n    {\"Balance \u00e2\u0080\u0094 the key ratio\", {\n      {\"1 Trumpet = 1 Trombone = 1 Tuba = 2 Horns\",\"In forte the horns are only \"\n        .. \"half as strong as the rest of the brass. To balance a forte you need two \"\n        .. \"horns to one trumpet or trombone.\",\"RK p.23 & p.33\"},\n      {\"Mark the horns louder\",\"If the trumpets and trombones play pp, mark the \"\n        .. \"horns p. In piano all wind, wood and brass, are of fairly equal weight.\",\"RK p.23\"},\n      {\"Against the woodwind\",\"1 Horn = 2 Clarinets = 2 Oboes = 2 Flutes = 2 \"\n        .. \"Bassoons in forte.\",\"RK p.33\"},\n      {\"Cornets\",\"Not quite the force of trumpets and trombones.\",\"RK p.23\"},\n    }},\n    {\"Pairings in unison\", {\n      {\"3 Trombones\",\"Frequently met with; extreme power and resonance.\",\"RK p.55\"},\n      {\"4 Horns\",\"Frequently met with; the standard way to give the horn group \"\n        .. \"melodic weight.\",\"RK p.55\"},\n      {\"2 or 3 Trumpets\",\"Used for fanfares and flourishes, which \\\"fall specially \"\n        .. \"to the lot of the trumpets and horns\\\".\",\"RK p.54-55\"},\n      {\"4 Horns + 2 Trumpets\",\"A standard reinforcement of the same line.\",\"RK p.55\"},\n    }},\n    {\"Doublings in octaves, thirds, sixths\", {\n      {\"The strongest brass doubling\",\"Octaves between timbrally matched instruments - \"\n        .. \"trumpets with trombones - give the most powerful brass doubling. Matching the \"\n        .. \"timbre is what does it; this is the case where like with like wins.\",\n        \"ACTOR Brass: Introduction\"},\n      {\"Normal register order\",\"Trumpet / 2 Horns  \u00c2\u00b7  Trumpet / Trombone  \u00c2\u00b7  \"\n        .. \"Trombone / Tuba  \u00c2\u00b7  2 Trombones / Trombone + Tuba  \u00c2\u00b7  2 Trumpets / 2 \"\n        .. \"Trombones  \u00c2\u00b7  2 Horns / Tuba. \\\"Likewise successful whether the \"\n        .. \"instruments are doubled or not.\\\"\",\"RK p.56\"},\n      {\"Same kind in octaves\",\"Because the group grades so evenly from dark low to \"\n        .. \"bright high, using brass of the same kind in octaves, thirds or sixths \"\n        .. \"\\\"invariably leads to satisfactory results\\\".\",\"RK p.55-56\"},\n      {\"Horns above trombones\",\"2 Horns / 1 Trombone, or 4 Horns / 2 Trombones, \"\n        .. \"exclusively in octaves. Possible, \\\"though not so reliable\\\".\",\"RK p.56\"},\n    }},\n    {\"Harmony\", {\n      {\"The horn quartet\",\"4 Horns give every facility for perfectly balanced \"\n        .. \"four-part harmony without doubling the bass in octaves.\",\"RK p.82\"},\n      {\"Best heavy layout\",\"2 Horns + Tuba forming the bass in octaves, the three \"\n        .. \"other parts on the trombones: \\\"beautiful full resonance\\\".\",\"RK p.83\"},\n      {\"Trombone quartet\",\"The third trombone and tuba usually take the bass in \"\n        .. \"octaves, the three upper parts going to the two remaining trombones \"\n        .. \"reinforced by a trumpet or two horns in unison.\",\"RK p.82-83\"},\n      {\"High four-part\",\"Two trumpets on the upper parts, completed by two trombones \"\n        .. \"or four horns in pairs. With 3 trumpets, give the fourth part to one \"\n        .. \"trombone or two horns in unison.\",\"RK p.83\"},\n      {\"Three-part\",\"Best on trombones, horns or trumpets in threes. If the \"\n        .. \"instruments are mixed, double the number of horns.\",\"RK p.84\"},\n      {\"Several parts\",\"When the whole group plays, double the horns.\",\"RK p.84\"},\n      {\"Discords\",\"Sevenths and seconds are better entrusted to instruments of \"\n        .. \"different tone colour.\",\"RK p.84\"},\n      {\"Duplication\",\"Place a horn chord beside the same chord on trumpets or \"\n        .. \"trombones: the soft round horns intensify the tone and moderate the \"\n        .. \"penetrating timbre.\",\"RK p.85\"},\n      {\"Sustained octaves\",\"Usually 2 trumpets, or 2 or 4 horns. The trombone, \"\n        .. \"with its ponderous tone, rarely takes part.\",\"RK p.86\"},\n    }},\n    {\"Stopped and muted brass\", {\n      {\"Where possible\",\"Stopped notes only on trumpets, cornets and horns - the \"\n        .. \"shape of trombones and tubas stops the hand entering the bell. Mutes are \"\n        .. \"used on all brass, though tubas rarely have them.\",\"RK p.25\"},\n      {\"The resulting colour\",\"Tone is deadened, wild and 'crackling' in forte, \"\n        .. \"tender and dull in piano; resonance is greatly reduced, the silvery \"\n        .. \"quality lost, and a timbre resembling oboe and English horn is approached. \"\n        .. \"Muted brass produces an effect of distance.\",\"RK p.25\"},\n      {\"On the trumpet\",\"Muting a note produces a better tone than stopping it. On \"\n        .. \"the horn, single notes are stopped in short phrases and muted in longer \"\n        .. \"ones.\",\"RK p.25\"},\n    }},\n    {\"What suits the brass\", {\n      {\"Fanfares and flourishes\",\"The natural-scale figures - trumpet calls - are \"\n        .. \"\\\"best adapted to the character of brass instruments\\\", and the full, \"\n        .. \"clear, ringing middle and upper registers of horns and trumpets suit \"\n        .. \"them best.\",\"RK p.53-54\"},\n      {\"Diatonic and unmodulated\",\"After fanfares, the melodies that best suit brass \"\n        .. \"are unmodulated and diatonic - rousing and triumphant in major, dark and \"\n        .. \"gloomy in minor.\",\"RK p.54\"},\n      {\"Not passion or geniality\",\"\\\"As a general rule, brass instruments lack the \"\n        .. \"capacity to express passion or geniality. Phrases charged with these \"\n        .. \"sentiments become sickly and insipid when confided to the brass.\\\"\",\"RK p.55\"},\n      {\"Chromatic writing\",\"Much less suitable, though vigorous chromatic fanfares \"\n        .. \"\\\"sound singularly beautiful on the brass\\\".\",\"RK p.54-55\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Trumpets + trombones in juxtaposition\",\"Less common than pairing either with \"\n        .. \"horns, since it unites the two most powerful agents in the group.\",\"RK p.85\"},\n      {\"Re-entry after a rest\",\"Trombones, trumpets and tuba are often tacet for long \"\n        .. \"periods. When they return it should be at a characteristic intensity, pp \"\n        .. \"or ff - a mezzo-forte re-entry \\\"produces a colourless and common-place \"\n        .. \"effect\\\".\",\"RK p.118\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s practical notes\", {\n      {\"More homogeneous than the woodwind\",\"\\\"Brass are more homogeneous than \"\n        .. \"woodwind, but less agile. They can play melodic, rhythmic, contrapuntal, and \"\n        .. \"harmonic roles equally well. They also reproduce choral writing better than \"\n        .. \"woodwind; in much early music, brass, especially trombones, simply double \"\n        .. \"the voices.\\\"\",\"BEL p.10-11\"},\n      {\"Horns are alto instruments\",\"\\\"Beginners often place them much too low or let \"\n        .. \"them wander too high.\\\" The best arrangement in harmony: \\\"three or four \"\n        .. \"horns, in close position, in the range of the alto voice\\\", sometimes with \"\n        .. \"the fourth doubling the first an octave lower.\",\"BEL p.11\"},\n      {\"High and low horn specialists\",\"Horns 1 and 3 are the high players, 2 and 4 the \"\n        .. \"low, seated alternately. \\\"Thus, the 'high' horns are uncomfortable on the \"\n        .. \"bottom notes, and the 'low' horns are uncomfortable on the top notes.\\\"\",\"BEL p.11\"},\n      {\"Low horns for pedals only\",\"\\\"The horns' lowest notes are best reserved for slow \"\n        .. \"moving pedal passages; they are not suitable for mobile bass lines, which \"\n        .. \"they tend to render ponderous.\\\"\",\"BEL p.11\"},\n      {\"Write in the spirit of the natural instrument\",\"Piston's advice, which Belkin \"\n        .. \"endorses: prefer open intervals like fifths and octaves, and generally \"\n        .. \"diatonic lines. \\\"Although horns are now of course chromatic instruments, \"\n        .. \"extreme agility is not in their nature\\\" - and the same is true of \"\n        .. \"trumpets, though both manage rapid repeated notes.\",\"BEL p.11-12\"},\n      {\"Trumpets need close spacing, trombones do not\",\"\\\"Trumpets sound oddly empty in \"\n        .. \"wide spacing; trombones, on the other hand, sound full in both open and \"\n        .. \"closed positions.\\\"\",\"BEL p.12\"},\n      {\"Trombones are lighter than horns in the baritone register\",\"\\\"A useful fact to \"\n        .. \"remember when using brass to accompany solo instruments, or the human \"\n        .. \"voice.\\\"\",\"BEL p.12\"},\n      {\"Muted brass is a separate family\",\"\\\"So different is their timbre from open \"\n        .. \"brass. When soft, muted brass are quite close to double reeds in sound; when \"\n        .. \"loud, their strident sound puts them in a class of their own.\\\" This is the \"\n        .. \"modern statement of Rimsky-Korsakov's oboe/English-horn \"\n        .. \"affinity.\",\"BEL p.13; cf. RK p.36\"},\n    }},\n  },\n  related={\"horn\",\"trumpet\",\"trombone\",\"tuba\",\"cornet\",\"woodwind\",\"strings\",\"blend\"},\n}\n\ne{ id=\"percussion\", name=\"Percussion Section\", family=\"Percussion\", kind=\"section\",\n  aliases={\"percussion\",\"percussion section\",\"battery\",\"drums\",\"drum section\"},\n  summary=\"Two families: instruments of determinate pitch (timpani, glockenspiel, \"\n       .. \"celesta, xylophone, bells) and instruments of indeterminate pitch, which \"\n       .. \"\\\"do not take any harmonic or melodic part in the orchestra\\\" and are \"\n       .. \"purely rhythmic and ornamental. Singleton calls the whole group the \"\n       .. \"\\\"Battery\\\".\",\n  facts={\n    {\"Determinate pitch\",\"Timpani, glockenspiel, celesta, xylophone, tubular bells, piano\"},\n    {\"Indeterminate pitch\",\"Triangle, castanets, little bells, tambourine, rute, \"\n       .. \"side drum, cymbals, bass drum, gong\"},\n  },\n  sec={\n    {\"Register classes (for matching to the harmony)\", {\n      {\"High\",\"Triangle, castanets, little bells.\",\"RK p.32\"},\n      {\"Medium\",\"Tambourine, rute (switch), side drum, cymbals.\",\"RK p.32\"},\n      {\"Deep\",\"Bass drum, Chinese gong.\",\"RK p.32\"},\n    }},\n    {\"Standard pairings\", {\n      {\"Triangle or tambourine tremolo\",\"+ trills in woodwind and violins.\",\"RK p.117\"},\n      {\"Side drum tremolo, or cymbals struck with drum sticks\",\"+ sustained chords \"\n        .. \"on trumpets and horns.\",\"RK p.117\"},\n      {\"Bass drum or gong tremolo\",\"+ chords on trombones, or low sustained notes on \"\n        .. \"'cellos and double basses.\",\"RK p.117\"},\n      {\"Match register to register\",\"Triangle, side drum and tambourine go best with \"\n        .. \"harmony in the upper register; cymbals, bass drum and gong with harmony in \"\n        .. \"the lower.\",\"RK p.117\"},\n      {\"Plucked strings + percussion\",\"\\\"Excellent; the two blend perfectly, and the \"\n        .. \"consequent increase in resonance yields an admirable effect.\\\"\",\"RK p.34\"},\n      {\"Wind clarifies percussion\",\"Wood and brass strengthen and clarify pizzicato \"\n        .. \"strings, harp, timpani and percussion generally, while the percussion \"\n        .. \"lends a touch of relief to the woodwind.\",\"RK p.34\"},\n    }},\n    {\"Use with rhythm\", {\n      {\"Always double a rhythmic figure\",\"\\\"Whenever some portion of the orchestra \"\n        .. \"executes a rhythmic figure, percussion instruments should always be \"\n        .. \"employed concurrently.\\\"\",\"RK p.117\"},\n      {\"Match the rhythm to the instrument\",\"An insignificant and playful rhythm \"\n        .. \"suits triangle, tambourine, castanets and side drum; a vigorous and \"\n        .. \"straightforward one the bass drum, cymbals and gong.\",\"RK p.117\"},\n      {\"Where the strokes fall\",\"Almost invariably on strong beats, highly-accented \"\n        .. \"syncopations, or disconnected sforzandi. The triangle, side drum and \"\n        .. \"tambourine can manage various rhythmic figures.\",\"RK p.117\"},\n    }},\n    {\"Writing for the players, not just the instruments\", {\n      {\"Leave time to move\",\"\\\"A common mistake is to allow insufficient time for \"\n        .. \"players to change instrument or pick up new beaters.\\\" Pay attention to the \"\n        .. \"physical requirements of the section - the choreography of both players and \"\n        .. \"beaters.\",\"HUG Percussion Section\"},\n      {\"Count the players, not the instruments\",\"Any number of percussion instruments \"\n        .. \"may appear in a score, but they are covered by a fixed number of \"\n        .. \"percussionists, and the timpanist is not one of them.\",\"HUG Percussion Section\"},\n    }},\n    {\"Economy\", {\n      {\"Use it seldom\",\"\\\"The percussion is seldom employed, and practically never \"\n        .. \"all together, but in single instruments or in two's and three's.\\\" In \"\n        .. \"national dances or ballad style it may be used more freely.\",\"RK p.118\"},\n      {\"Order of frequency\",\"Strings, woodwind, brass, timpani, harps, pizzicato, \"\n        .. \"then percussion - and within percussion: triangle, cymbals, bass drum, \"\n        .. \"side drum, tambourine, gong. Celesta, glockenspiel and xylophone stand \"\n        .. \"further off still, being too characteristic to use often.\",\"RK p.118\"},\n      {\"Careful \u00e2\u0080\u0094 they win\",\"Bass drum, cymbals, gong and a fortissimo side-drum \"\n        .. \"tremolo are each \\\"sufficient to overpower any orchestral tutti\\\".\",\"RK p.117\"},\n      {\"Against the voice\",\"Percussion rarely accompanies a singer; a timpani figure \"\n        .. \"or tremolo, sometimes the triangle, less often cymbals.\",\"RK p.124\"},\n    }},\n    {\"Bowing that imitates percussion\", {\n      {\"Col legno\",\"Strings played with the wood of the bow produce a sound similar \"\n        .. \"to the xylophone, gaining in quality as the number of players increases.\",\"RK p.32\"},\n    }},\n\n    {\"The five functions percussion can serve\", {\n      {\"Accent\",\"\\\"Adding percussion sharpens the accents, adding impact and power.\\\" \"\n        .. \"Countless classical final chords add timpani for exactly this.\",\"BEL p.13-14\"},\n      {\"Melody\",\"A marimba line \\\"emerges easily over the mysterious chord played by \"\n        .. \"divided strings\\\". Shostakovich's Fifteenth gives the timpani a passacaglia \"\n        .. \"theme while pitched percussion dances around it.\",\"BEL p.14-15\"},\n      {\"Rhythm\",\"Bartok's Concerto for Orchestra opens its second movement with the \"\n        .. \"snare drum, snares off, presenting a theme.\",\"BEL p.15\"},\n      {\"Resonance\",\"\\\"Without the quiet cymbal roll, the flute line would sound patchy \"\n        .. \"and empty.\\\" Note that rolls can be \\\"composed in overlapping waves\\\" rather \"\n        .. \"than left continuous.\",\"BEL p.15\"},\n      {\"Transition between dynamics\",\"A diminuendo timpani roll \\\"provides a smooth \"\n        .. \"transition between the loud tutti which precedes it, and the very quiet \"\n        .. \"passage which follows\\\" - Bruckner's Ninth, first movement.\",\"BEL p.16\"},\n    }},\n    {\"Classify by material, not by name\", {\n      {\"Metal is wet\",\"\\\"Normally 'wet', with substantial reverberation, and therefore \"\n        .. \"not well suited to quick, precise rhythms. On the other hand, they can \"\n        .. \"supply background ambiance very well.\\\"\",\"BEL p.13\"},\n      {\"Wood is dry\",\"\\\"Best used where clarity and definition are important.\\\"\",\"BEL p.13\"},\n      {\"Membranes are in between\",\"\\\"When low, they can reverberate quite long; as they \"\n        .. \"get higher, their sound resembles that of the wooden percussion.\\\"\",\"BEL p.13\"},\n      {\"Match the register\",\"\\\"When percussion is combined with other families in the \"\n        .. \"same plane of tone, it should correspond in register to the music around \"\n        .. \"it\\\" - the same rule Rimsky-Korsakov gives.\",\"BEL p.16; cf. RK p.117\"},\n    }},\n  },\n  related={\"timpani\",\"triangle\",\"cymbals\",\"bassdrum\",\"sidedrum\",\"tambourine\",\n           \"glockenspiel\",\"celesta\",\"xylophone\",\"harp\"},\n}\n\ne{ id=\"plucked\", name=\"Plucked Strings (group)\", family=\"Plucked\", kind=\"section\",\n  aliases={\"plucked strings\",\"plucked\",\"pizzicato group\",\"harp and pizzicato\"},\n  summary=\"Rimsky-Korsakov treats the string quartet played pizzicato together with \"\n       .. \"the harp as a separate group with its own quality of tone, because both \"\n       .. \"produce sound the same way. \\\"More an instrument of colour than \"\n       .. \"expression.\\\"\",\n  sec={\n    {\"Members\", {\n      {\"Core\",\"Violins I, Violins II, Violas, 'Cellos, D. basses played pizzicato, \"\n        .. \"plus the harp.\",\"RK p.26\"},\n      {\"Also classifiable here\",\"Guitar, zither, balalaika, and quill-plucked \"\n        .. \"instruments such as the domra and mandoline - all usable in an orchestra.\",\"RK p.26\"},\n    }},\n    {\"Pairings\", {\n      {\"+ Woodwind or brass\",\"Wind strengthens and clarifies pizzicato strings and \"\n        .. \"harp; the plucked group in turn lends relief to the woodwind.\",\"RK p.34\"},\n      {\"+ Percussion\",\"Excellent - \\\"the two blend perfectly\\\".\",\"RK p.34\"},\n      {\"+ Harp and piano\",\"Harp with piano imitates a popular plucked instrument or \"\n        .. \"a soft peal of bells.\",\"RK p.30\"},\n      {\"Tutti pizzicato\",\"The pizzicato quartet, sometimes reinforced by harp and \"\n        .. \"piano, can form a tutti of its own - medium power but fairly brilliant; \"\n        .. \"it only attains real strength with woodwind support.\",\"RK p.103\"},\n      {\"Best setting for a singer\",\"Strings pizzicato + harp \\\"forms a setting \"\n        .. \"eminently favourable for the voice\\\".\",\"RK p.120\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ Bowed strings\",\"Uniting plucked with bowed strings \\\"does not produce such \"\n        .. \"a satisfactory blend, both qualities being heard independently\\\".\",\"RK p.34\"},\n      {\"Pizzicato chords on open strings\",\"Better avoided - open strings sound more \"\n        .. \"brilliant than covered ones. Four-note chords allow the freest, most \"\n        .. \"vigorous attack.\",\"RK p.27\"},\n      {\"Speed\",\"Pizzicato can never be as quick as arco, and is slower the thicker \"\n        .. \"the string - much slower on double basses than violins.\",\"RK p.27\"},\n    }},\n  },\n  related={\"pizzicato\",\"harp\",\"percussion\",\"strings\"},\n}\n\n-- ============================================================================\n-- CROSS-GROUP TOPICS\n-- ============================================================================\n\ne{ id=\"strings_wind\", name=\"Strings + Woodwind\", family=\"Combining\", kind=\"topic\",\n  aliases={\"strings and woodwind\",\"strings + woodwind\",\"strings with woodwind\",\n           \"woodwind and strings\",\"string wind combination\"},\n  summary=\"\\\"All combinations of strings and wood-wind are good.\\\" A wind instrument \"\n       .. \"in unison with a string group increases its resonance and amplifies its \"\n       .. \"tone, while the strings soften the wind. Every combination refines the \"\n       .. \"character of each instrument taken separately - the woodwind losing more \"\n       .. \"than the strings.\",\n  sec={\n    {\"Best unison pairs (matched registers)\", {\n      {\"Violins + Flute\",\"Also alto flute or piccolo.\",\"RK p.58\"},\n      {\"Violins + Oboe\",\"\",  \"RK p.58\"},\n      {\"Violins + Clarinet\",\"Also E-flat clarinet.\",\"RK p.58\"},\n      {\"Violas + Oboe\",\"Also English horn.\",\"RK p.58\"},\n      {\"Violas + Clarinet\",\"\",  \"RK p.58\"},\n      {\"Violas + Bassoon\",\"\",  \"RK p.58\"},\n      {\"\u00e2\u0080\u0099Cellos + Clarinet\",\"Also bass clarinet.\",\"RK p.58\"},\n      {\"\u00e2\u0080\u0099Cellos + Bassoon\",\"\",  \"RK p.58\"},\n      {\"D. basses + Bassoon\",\"Also bass clarinet or contrabassoon.\",\"RK p.58\"},\n    }},\n    {\"Why do it\", {\n      {\"Three objects\",\"(a) to obtain a new timbre of definite colour; (b) to \"\n        .. \"strengthen the resonance of the strings; (c) to soften the quality of \"\n        .. \"the wood-wind.\",\"RK p.58\"},\n      {\"Who wins\",\"With instruments of equal power the strings predominate (violins \"\n        .. \"with an oboe, bassoon with the 'cellos). If several winds play in unison \"\n        .. \"against one string group, the strings are overpowered.\",\"RK p.58\"},\n    }},\n    {\"Absorption \u00e2\u0080\u0094 wind swallows the strings\", {\n      {\"2 Fl + 2 Ob + Violins I\",\"One department of strings added to woodwind in \"\n        .. \"unison gives a sweet coherent quality with the wind timbre still \"\n        .. \"predominating.\",\"RK p.34\"},\n      {\"2 Ob + 2 Cl + Violas\",\"As above.\",\"RK p.34\"},\n      {\"2 Cl + 2 Fag + \u00e2\u0080\u0099Cellos\",\"As above.\",\"RK p.34\"},\n    }},\n    {\"Thickening \u00e2\u0080\u0094 strings swallow the wind\", {\n      {\"Vns I + Vns II + 1 Oboe\",\"Adding a single wind to all or part of the strings \"\n        .. \"in unison \\\"only thickens the resonance of the latter, the wood-wind \"\n        .. \"timbre being lost in the process\\\".\",\"RK p.34\"},\n      {\"Violas + \u00e2\u0080\u0099Cellos + 1 Clarinet\",\"As above.\",\"RK p.34\"},\n      {\"\u00e2\u0080\u0099Cellos + D. basses + 1 Bassoon\",\"As above.\",\"RK p.34\"},\n    }},\n    {\"Octaves\", {\n      {\"Prefer wind in both octaves\",\"When only one of two octaves is doubled and \"\n        .. \"the melody is in the soprano register, let the woodwind take both octaves \"\n        .. \"and double only the lower part with strings: Picc / Fl + Vns, or Fl / Ob \"\n        .. \"(Cl) + Vns.\",\"RK p.60\"},\n      {\"Sweet low register\",\"'Cellos + Bassoon / D. basses, the double basses \"\n        .. \"undoubled.\",\"RK p.60\"},\n      {\"In three and four octaves\",\"e.g. Vns + 3 Fl / Violas + 2 Ob / 'Cellos + 2 \"\n        .. \"Fag, or Vns I + Picc / Vns II + Fl + Ob / Violas + 'Cellos + 2 Cl + Eng \"\n        .. \"horn + Fag.\",\"RK p.59\"},\n    }},\n    {\"In harmony\", {\n      {\"Natural layout\",\"Fl / Ob (Cl) + Vns divisi; Cl / Fag + 'Cellos + Violas \"\n        .. \"divisi. Frequently used as comparison of one timbre with another over \"\n        .. \"sustained notes or string tremolando.\",\"RK p.94\"},\n      {\"Sforzando-piano\",\"As the woodwind begins a piano chord, let the strings \"\n        .. \"attack it sforzando (arco or pizz.) - a compound chord for preference. \"\n        .. \"Reverse the order for a cresc.-sf effect.\",\"RK p.111\"},\n    }},\n    {\"Use sparingly\", {\n      {\"One group above the other in octaves\",\"Fl / Vns, Ob / 'Cellos and the like - \"\n        .. \"\\\"not to be recommended, as the tone quality of the two groups is so \"\n        .. \"widely different\\\" (Steinberg's note; used by the classics for balance, \"\n        .. \"and revived by younger French composers).\",\"RK p.60 n.\"},\n      {\"Muted strings + woodwind\",\"They \\\"do not combine so well\\\", the two \"\n        .. \"qualities remaining distinct and separate.\",\"RK p.34\"},\n    }},\n  },\n  related={\"strings\",\"woodwind\",\"strings_brass\",\"three_groups\",\"blend\"},\n}\n\ne{ id=\"strings_brass\", name=\"Strings + Brass\", family=\"Combining\", kind=\"topic\",\n  aliases={\"strings and brass\",\"strings + brass\",\"brass and strings\",\"string brass combination\"},\n  summary=\"\\\"Owing to the dissimilarity between the quality of string and brass tone, \"\n       .. \"the combination of these two groups in unison can never yield such a \"\n       .. \"perfect blend as that produced by the union of strings and wood-wind.\\\" \"\n       .. \"Each instrument is still heard separately - so match the registers and \"\n       .. \"choose the effect deliberately.\",\n  sec={\n    {\"Pairs that work (matched registers)\", {\n      {\"Violin + Trumpet\",\"The nearest corresponding registers in the two groups.\",\"RK p.61\"},\n      {\"Viola + Horn\",\"\",  \"RK p.61\"},\n      {\"\u00e2\u0080\u0099Cellos / D. basses + Trombones / Tuba\",\"For heavy, massive effects.\",\"RK p.61\"},\n      {\"Horns + \u00e2\u0080\u0099Cellos\",\"\\\"Frequently employed, produces a beautifully blended, \"\n        .. \"soft quality of tone.\\\" This is the one combination of the two groups \"\n        .. \"Rimsky-Korsakov singles out for praise.\",\"RK p.61\"},\n      {\"Horns + divided Violas or \u00e2\u0080\u0099Cellos\",\"\\\"The splendid effect of horns doubled by \"\n        .. \"divided violas or 'cellos\\\" - the exception worth seeking out in harmony.\",\"RK p.95\"},\n    }},\n    {\"In harmony\", {\n      {\"Keep them apart, not interleaved\",\"Juxtaposition, crossing and enclosure of \"\n        .. \"parts between strings and brass are \\\"seldom employed\\\", for lack of any \"\n        .. \"affinity in tone quality.\",\"RK p.94-95\"},\n      {\"When juxtaposition works\",\"When the strings form the harmony tremolando and \"\n        .. \"the brass sustains chords; or when the strings play short disconnected \"\n        .. \"chords sforzando.\",\"RK p.95\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Doubling the voice with brass\",\"\\\"Trombones and trumpets overpower the voice \"\n        .. \"and cannot be used for this purpose.\\\"\",\"RK p.122\"},\n    }},\n  },\n  related={\"strings\",\"brass\",\"strings_wind\",\"three_groups\",\"blend\"},\n}\n\ne{ id=\"wind_brass\", name=\"Woodwind + Brass\", family=\"Combining\", kind=\"topic\",\n  aliases={\"woodwind and brass\",\"wind and brass\",\"woodwind + brass\",\"brass and woodwind\",\n           \"wind brass combination\"},\n  summary=\"\\\"The combination of a wood-wind and brass instrument produces a complex \"\n       .. \"resonance in which the tone of the brass predominates\\\" - more powerful \"\n       .. \"than either alone, but slightly sweeter than the brass by itself. The wind \"\n       .. \"blends with the brass, softens and rarefies it, and yields a finer legato \"\n       .. \"than the brass alone.\",\n  sec={\n    {\"Pairings in unison\", {\n      {\"Trumpet + Clarinet\",\"The trumpet is the brass instrument most frequently \"\n        .. \"doubled; also Trumpet + Oboe, Trumpet + Flute, and Trumpet + Cl + Ob + \"\n        .. \"Fl. Instances are numerous, especially in forte.\",\"RK p.56\"},\n      {\"Horn + Clarinet\",\"Less often doubled than the trumpet; also Horn + Bassoon.\",\"RK p.57\"},\n      {\"Trombone + Bassoon\",\"Also Tuba + Bassoon.\",\"RK p.57\"},\n      {\"Trombone + English horn\",\"Combining English horn, bass clarinet and \"\n        .. \"contrabassoon with the brass in corresponding registers shows the same \"\n        .. \"characteristics; also 3 Trombones + Bass clarinet.\",\"RK p.57\"},\n      {\"Chord blocks in unison\",\"2 or 3 Trumpets + the same number of Fl, Ob or Cl.  \"\n        .. \"2 or 3 Horns + the same number of Fag or Cl. Also 2 Horns + 2 Fag + 2 Cl.\",\"RK p.88\"},\n      {\"Full brass + full woodwind\",\"A chord for full brass doubled by the same chord \"\n        .. \"for full woodwind in pairs \\\"produces a magnificent and uniform tone\\\".\",\"RK p.88\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Woodwind above one horn\",\"2 Ob, or 2 Cl, or 2 Fl above 1 Horn - this often \"\n        .. \"replaces 1 Trumpet / 1 Horn when you want a richer upper octave than the \"\n        .. \"trumpet can give. Also 1 Ob + 1 Cl / 1 Horn.\",\"RK p.57\"},\n      {\"Woodwind above two horns\",\"If two horns play the lower octave in unison you \"\n        .. \"need three or four wind instruments above, especially in forte: 2 Fl + 2 \"\n        .. \"Cl / 2 Horns.\",\"RK p.57\"},\n      {\"Doubling a trumpet an octave up\",\"Three or four wind instruments are needed - \"\n        .. \"but in the top register two flutes will suffice.\",\"RK p.58\"},\n    }},\n    {\"In harmony\", {\n      {\"Bassoon and horn are the bridge\",\"\\\"The bassoon and horn are the two \"\n        .. \"instruments best capable of reconciling the groups of wood-wind and \"\n        .. \"brass.\\\" Four-part harmony on 2 Bassoons + 2 Horns yields a finely \"\n        .. \"balanced tone recalling a horn quartet but slightly more transparent - \"\n        .. \"in soft passages.\",\"RK p.90\"},\n      {\"Cross them for blend\",\"In that combination give the concords to the horns and \"\n        .. \"the discords to the bassoons. Bassoons may also be written inside the \"\n        .. \"horns, but not the reverse.\",\"RK p.90-91\"},\n      {\"Completing a horn chord\",\"In the upper register and the higher harmonic \"\n        .. \"parts, a piano chord of four horns may be completed by clarinets as \"\n        .. \"effectively as by oboes or flutes, with a bassoon doubling the bass an \"\n        .. \"octave below.\",\"RK p.92\"},\n      {\"Balance in forte\",\"Played forte the horns are stronger than the woodwind; \"\n        .. \"restore balance by doubling the upper harmonic parts. In difficult cases \"\n        .. \"mark the woodwind one degree louder than the brass.\",\"RK p.92 & p.94\"},\n      {\"Who moves, who holds\",\"In a chain of consecutive chords, entrust the \"\n        .. \"stationary parts to the brass and the moving parts to the woodwind.\",\"RK p.91\"},\n      {\"Above the trumpets\",\"If trumpets and trombones take part in a chord, put \"\n        .. \"flutes, oboes and clarinets in the harmonic part above the trumpets.\",\"RK p.93\"},\n      {\"Flute thirds between trumpet octaves\",\"In soft passages, thirds in the low \"\n        .. \"register of the flutes - sometimes with clarinets - \\\"produce a beautiful \"\n        .. \"mysterious effect between trumpets in octaves\\\".\",\"RK p.91\"},\n    }},\n    {\"Stopped and muted brass with reeds\", {\n      {\"Muted brass + oboe / English horn\",\"Stopped or muted trumpets and horns \"\n        .. \"resemble the oboe and English horn in quality; \\\"the combination of these \"\n        .. \"instruments produces a magnificent tone\\\".\",\"RK p.89\"},\n      {\"Stopped horns + clarinet\",\"\\\"A beautiful dark tone is derived from the \"\n        .. \"combination of middle notes in stopped horns and deep notes in the \"\n        .. \"clarinet.\\\" Substituting bassoons for clarinets loses part of the \"\n        .. \"character.\",\"RK p.89\"},\n      {\"Muted trumpets as an echo\",\"\\\"Muted trumpets are eminently suited to echo a \"\n        .. \"theme in the oboes\\\"; flutes may imitate clarinets and oboes successfully. \"\n        .. \"A woodwind instrument cannot echo the strings, or the reverse.\",\"RK p.110\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Woodwind above a trombone\",\"\\\"Wood-wind instruments should not be used to \"\n        .. \"double a trombone in the octave above; trumpets are more suitable.\\\"\",\"RK p.58\"},\n      {\"3 Trombones + 3 Bassoons / 3 Clarinets\",\"\\\"Very rare.\\\"\",\"RK p.88\"},\n      {\"Clarinets inside the horns\",\"\\\"On account of their tone quality\\\" clarinets \"\n        .. \"should rarely be set inside the horns.\",\"RK p.92\"},\n      {\"2 Bassoons + 2 Horns in forte\",\"The horns overwhelm the bassoons - \\\"it is \"\n        .. \"wiser to employ four horns alone\\\".\",\"RK p.90\"},\n    }},\n  },\n  related={\"woodwind\",\"brass\",\"horn\",\"bassoon\",\"trumpet\",\"three_groups\",\"blend\"},\n}\n\ne{ id=\"three_groups\", name=\"All Three Groups Combined\", family=\"Combining\", kind=\"topic\",\n  aliases={\"three groups\",\"all three groups\",\"strings woodwind brass\",\"full combination\",\n           \"combining the three groups\",\"tutti combination\"},\n  summary=\"\\\"The combination of the three different timbres in unison produces a rich, \"\n       .. \"mellow and coherent tone\\\" - the woodwind's presence is what makes the \"\n       .. \"blend full and even. Which group predominates depends on how many \"\n       .. \"instruments you use. Reserve these groupings for loud passages or a heavy \"\n       .. \"piano effect.\",\n  sec={\n    {\"The standard groupings\", {\n      {\"Violins + Oboe (or Flute, Clarinet) + Trumpet\",\"The soprano grouping.\",\"RK p.61\"},\n      {\"Violas (or \u00e2\u0080\u0099Cellos) + Clarinet (or English horn) + Horn\",\"The alto-tenor \"\n        .. \"grouping.\",\"RK p.61\"},\n      {\"\u00e2\u0080\u0099Cellos / D. basses + 2 Bassoons + 3 Trombones + Tuba\",\"The bass grouping.\",\"RK p.61\"},\n    }},\n    {\"In harmony\", {\n      {\"Side by side\",\"Setting strings, woodwind and brass side by side \\\"produces a \"\n        .. \"full, round and firm tone\\\".\",\"RK p.95\"},\n      {\"What matters most\",\"Balance and distribution matter far more in long \"\n        .. \"sustained or rhythmic chords than in short disconnected ones - though the \"\n        .. \"latter should not be neglected entirely.\",\"RK p.95-96\"},\n    }},\n    {\"Tutti\", {\n      {\"Full tutti\",\"All three melodic groups - strings, wind, brass - together. \"\n        .. \"\\\"All\\\" is relative: in the extreme high register the piccolo may be \"\n        .. \"essential, in the low register the flutes unnecessary, and the passage is \"\n        .. \"still a tutti.\",\"RK p.101-102\"},\n      {\"Partial tutti\",\"Only part of the brass takes part, e.g. 2 horns alone, or 2 \"\n        .. \"horns with 1-3 trombones and no tuba, trumpets or remaining horns.\",\"RK p.101\"},\n      {\"Tutti in the wind\",\"Woodwind and brass alone, most often with horn support. \"\n        .. \"Adding timpani and percussion gives what the Germans call \"\n        .. \"\\\"Janitscharenmusik\\\". Wind tutti is not very powerful in forte; brass \"\n        .. \"tutti alone can reach extraordinary volume.\",\"RK p.103\"},\n      {\"Sharpening wind tutti\",\"'Cello and double bass pizzicato notes, the rest of \"\n        .. \"the strings and the harps are often added - this renders the sustained \"\n        .. \"woodwind notes more distinct.\",\"RK p.103\"},\n      {\"Dynamic\",\"The tutti is used essentially in forte and fortissimo, rarely in \"\n        .. \"piano and pianissimo.\",\"RK p.102\"},\n    }},\n    {\"Building and unwinding\", {\n      {\"Crescendo order\",\"Add instruments in this order: strings, wood-wind, brass.\",\"RK p.112\"},\n      {\"Diminuendo order\",\"Remove them in reverse: brass, wood-wind, strings.\",\"RK p.112\"},\n      {\"Amplification\",\"While the first group makes its crescendo gradually, the \"\n        .. \"second enters piano and crescendos faster, so a simple timbre becomes a \"\n        .. \"complex one and the whole process tightens.\",\"RK p.109\"},\n    }},\n    {\"Economy\", {\n      {\"The warning\",\"\\\"Neither musical feeling nor the ear itself can stand, for \"\n        .. \"long, the full resources of the orchestra combined together.\\\" A group \"\n        .. \"that has been silent gains fresh interest on reappearing.\",\"RK p.118\"},\n      {\"Against constant mixing\",\"\\\"The constant use of compound timbres, in pair's, \"\n        .. \"in three's etc. eliminates characteristics of tone, and produces a dull, \"\n        .. \"neutral texture, whereas the employment of simple, elementary combinations \"\n        .. \"gives infinitely greater scope for variety in colour.\\\"\",\"RK p.35\"},\n    }},\n  },\n  related={\"strings_wind\",\"strings_brass\",\"wind_brass\",\"balance\",\"blend\",\"strings\"},\n}\n\ne{ id=\"blend\", name=\"Blend Bridges Between Groups\", family=\"Combining\", kind=\"topic\",\n  aliases={\"blend\",\"bridges\",\"blend bridges\",\"links between groups\",\"what blends with what\",\n           \"affinity\",\"timbre bridges\"},\n  summary=\"Rimsky-Korsakov names the specific points of contact where one group's \"\n       .. \"colour shades into another's. These are the most reliable seams to write \"\n       .. \"across when you want a join nobody hears.\",\n  sec={\n    {\"The bridges\", {\n      {\"String harmonics \u00e2\u0080\u0093 Flute / Piccolo\",\"\\\"The relationship which exists between \"\n        .. \"string harmonics and the flute or piccolo constitutes a link between the \"\n        .. \"two groups in the upper range of the orchestra.\\\"\",\"RK p.35\"},\n      {\"Viola \u00e2\u0080\u0093 Bassoon (middle) / Clarinet (lowest)\",\"\\\"The timbre of the viola may \"\n        .. \"be vaguely compared to the middle register of the bassoon and the lowest \"\n        .. \"compass of the clarinet; hence, in the medium orchestral range, a point of \"\n        .. \"contact is established between the quartet of strings and the wood-wind.\\\"\",\"RK p.35-36\"},\n      {\"Bassoon \u00e2\u0080\u0093 Horn\",\"\\\"The bassoon and horn provide the connection between \"\n        .. \"wood-wind and brass, these two instruments being somewhat analogous in \"\n        .. \"character when played piano or mezzo-forte.\\\" The horn \\\"serves as a link \"\n        .. \"between the brass and wood-wind\\\".\",\"RK p.36 & p.24\"},\n      {\"Low Flute \u00e2\u0080\u0093 pianissimo Trumpet\",\"\\\"The flute also, in its lowest register, \"\n        .. \"recalls the pianissimo trumpet tone.\\\"\",\"RK p.36\"},\n      {\"Stopped / muted Horns and Trumpets \u00e2\u0080\u0093 Oboe / English horn\",\"\\\"Similar in \"\n        .. \"quality to the oboe and Eng. horn, and blend tolerably well with the \"\n        .. \"latter instrument.\\\"\",\"RK p.36\"},\n    }},\n    {\"What the groups do to each other\", {\n      {\"Wind thickens strings, softens brass\",\"\\\"Re-inforcing both, the wind \"\n        .. \"thickens the strings and softens the brass.\\\"\",\"RK p.35\"},\n      {\"Strings and brass stay separate\",\"\\\"The strings do not blend so well with the \"\n        .. \"brass, and when the two groups are placed side by side, each is heard too \"\n        .. \"distinctly.\\\"\",\"RK p.35\"},\n      {\"All three in unison\",\"\\\"Produces a rich, mellow and coherent tone.\\\"\",\"RK p.35\"},\n    }},\n    {\"Berlioz\u00e2\u0080\u0099s statement of the aim\", {\n      {\"What combining is for\",\"He sets out two purposes: modifying the sound of some \"\n        .. \"instruments by others, and drawing from the ensemble a sound that none of \"\n        .. \"them could produce alone or with others of its own family. The second is the \"\n        .. \"ambition behind everything on this page - and, written in 1843, it is the \"\n        .. \"mixture principle described under Doubling, a century before it was analysed \"\n        .. \"as such.\",\"BERL Introduction\"},\n      {\"And what cannot be taught\",\"Berlioz thought the invention of beautiful \"\n        .. \"orchestral effects could not be explained - a gift practice and observation \"\n        .. \"develop rather than supply. What can be taught, he says, is how to assemble \"\n        .. \"an orchestra fit to render a given work faithfully. This encyclopaedia is on \"\n        .. \"the teachable side of that line, and does not pretend otherwise.\",\n        \"BERL The Orchestra\"},\n    }},\n    {\"Ranking for expression\", {\n      {\"The order\",\"Strings first, then woodwind, brass, plucked strings, percussion \"\n        .. \"of definite pitch, percussion of indefinite pitch. \\\"As regards \"\n        .. \"expression, the strings come first, and the expressive capacity of the \"\n        .. \"other groups diminishes in the above order, colour being the only \"\n        .. \"attribute of the last group.\\\"\",\"RK p.35\"},\n    }},\n  },\n  related={\"strings_wind\",\"wind_brass\",\"strings_brass\",\"balance\",\"three_groups\"},\n}\n\ne{ id=\"spectrum\", name=\"Overtones, Formants and Penetration\", family=\"Craft\", kind=\"topic\",\n  aliases={\"overtones\",\"overtone\",\"formants\",\"formant\",\"spectrum\",\"spectra\",\n           \"penetration\",\"penetrating\",\"harmonics of a sound\",\"timbre acoustics\",\n           \"why is it loud\",\"cuts through\",\"brightness\",\"hiss\"},\n  summary=\"Why one instrument cuts through a tutti and another vanishes, when both are \"\n       .. \"marked forte. The answer is usually not power but the shape of the sound's \"\n       .. \"overtone spectrum - and it changes from register to register on the same \"\n       .. \"instrument, sometimes from note to note.\",\n  facts={\n    {\"The rule of thumb\",\"Strong, high overtones penetrate. Few overtones blend, and \"\n        .. \"can be masked by the overtones of instruments below.\"},\n    {\"Why it matters\",\"Knowledge of volume and timbre across an instrument's registers \"\n        .. \"is \\\"a fundamental requirement for any instrumentation\\\".\"},\n  },\n  sec={\n    {\"Sounds that cut through\", {\n      {\"Where it comes from\",\"Formants - powerful high-pitched peaks or clusters in \"\n        .. \"the spectrum. They are audible as a kind of \\\"hiss\\\" in the sound, and they \"\n        .. \"are what makes a tone intense and penetrating.\",\"IDIO ch.12\"},\n      {\"The list\",\"Oboe; sharply muted brass, especially loud; stopped horn; the \"\n        .. \"clarinet's low chalumeau register; the violin's G string; the 'cello's A \"\n        .. \"string; low contrabassoon, and to some extent low bassoon.\",\"IDIO ch.12\"},\n      {\"Sul ponticello\",\"Bowing at the bridge - or near the soundboard on the harp - \"\n        .. \"produces high, powerful formants which the player can modulate by bow \"\n        .. \"placement and pressure, to the point where the fundamental disappears \"\n        .. \"entirely.\",\"IDIO ch.12\"},\n    }},\n    {\"Sounds that blend\", {\n      {\"Where it comes from\",\"Few or weak overtones. Nothing high and sharp to \"\n        .. \"announce the instrument, so it merges into whatever it is doubling.\",\n        \"IDIO ch.12\"},\n      {\"The list\",\"Flute; string harmonics; the clarinet's weak middle-register \"\n        .. \"\\\"filling in\\\" notes (written G, G-sharp, A and A-sharp above the treble \"\n        .. \"staff's second line); alternative woodwind fingerings; overblowing on a \"\n        .. \"different fundamental; the celesta. Sul tasto weakens or removes overtones \"\n        .. \"as well.\",\"IDIO ch.12\"},\n      {\"What to use them for\",\"Exactly this quality makes them the right choice for \"\n        .. \"mixture - see Doubling. They can supply an artificial overtone without \"\n        .. \"being heard as an added part.\",\"IDIO ch.12\"},\n    }},\n    {\"Register turns the rule around\", {\n      {\"Flute\",\"Very soft and of limited penetration at the bottom, because it has so \"\n        .. \"few overtones there; easily penetrating at the top.\",\"IDIO Dynamics and Balance\"},\n      {\"Piccolo\",\"A high-pitched piccolo solo \\\"will often be easily audible even in a \"\n        .. \"full orchestral tutti\\\".\",\"IDIO Dynamics and Balance\"},\n      {\"Oboe, the other way round\",\"\\\"A low oboe is far more penetrating than the same \"\n        .. \"instrument in its highest register.\\\" The intuition that high means \"\n        .. \"piercing is simply wrong here.\",\"IDIO Dynamics and Balance\"},\n      {\"Adjacent notes can differ\",\"On some instruments \\\"even adjacent notes may \"\n        .. \"involve considerable differences\\\" in volume and timbre.\",\"IDIO Dynamics and Balance\"},\n    }},\n    {\"Protecting a weak instrument\", {\n      {\"The real risk is masking, not volume\",\"The flute's few overtones mean that \"\n        .. \"overtones from lower instruments can drown it in its middle register, and \"\n        .. \"the bottom register is at greater risk still.\",\"IDIO ch.12\"},\n      {\"The fix is a clear register\",\"\\\"As long as one makes sure that they are not \"\n        .. \"drowned out by other instruments in the same register or by overtones from \"\n        .. \"lower instruments, even very low flutes will most often be audible.\\\" Leave \"\n        .. \"the register empty rather than marking the part louder.\",\"IDIO ch.12\"},\n    }},\n    {\"Bolero as the textbook\", {\n      {\"What Ravel is doing\",\"The order of solos in the first half is a step-by-step \"\n        .. \"increase in intensity by spectrum: a flute at the bottom of its range with \"\n        .. \"few overtones, a clarinet in the neutral middle, a high bassoon, a high \"\n        .. \"E-flat clarinet. The oboe - intense, overtone-rich - is deliberately held \"\n        .. \"back, and the oboe d'amore used instead where that colour is wanted.\",\n        \"IDIO Parallel Doubling\"},\n      {\"When the oboe finally arrives\",\"Bar 167, almost exactly halfway, and not as a \"\n        .. \"soloist: it appears inside a timbral mixture, in parallel fifths with oboe \"\n        .. \"d'amore, English horn and clarinets.\",\"IDIO Parallel Doubling\"},\n    }},\n  },\n  related={\"blend\",\"balance\",\"doubling\",\"flute\",\"oboe\",\"clarinet\",\"range\"},\n}\n\ne{ id=\"listening\", name=\"Where to Hear These Combinations\", family=\"Reference\", kind=\"topic\",\n  aliases={\"listening\",\"hear it\",\"examples\",\"score examples\",\"repertoire\",\n           \"where to hear\",\"recordings\",\"heard in\",\"find it in a score\",\n           \"which piece\",\"real examples\",\"listen\"},\n  summary=\"The doublings in this encyclopaedia described as standard are standard because \"\n       .. \"they are everywhere in the repertoire. These are places to hear them, taken \"\n       .. \"from Andrew Hugill's index of the Philharmonia Orchestra's recorded archive, \"\n       .. \"which gives work, movement and bar or rehearsal figure. Follow with the score \"\n       .. \"open if you can; a recording tells you what it sounds like, the score tells \"\n       .. \"you why.\",\n  facts={\n    {\"Locators\",\"MI, MII = movement; b or bb = bar; Fig. or a letter = rehearsal mark\"},\n    {\"Why these pieces\",\"Hugill indexes what the Philharmonia had recorded, so the list \"\n        .. \"runs from Beethoven to Lindberg rather than being a canon\"},\n  },\n  sec={\n    {\"Woodwind in unison and octaves\", {\n      {\"Cor anglais + bassoon in unison\",\"Saint-Saens, Symphony 3, MI 11 before I - \"\n        .. \"answered by three flutes.\",\"HUG Woodwind Section: Standard Combinations\"},\n      {\"Flutes + oboe in unison\",\"Debussy, Nocturnes 2 'Fetes', Fig. 1.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Clarinet + bassoon in octaves\",\"Tchaikovsky, Symphony 5, MI.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Oboes + clarinets in octaves\",\"Ravel, Bolero, Fig. 9 - the pairing modern \"\n        .. \"teaching often warns against, in the most studied orchestration there is.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Cor anglais + oboe + bassoon in octaves\",\"Debussy, La Mer, III Fig. 46.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Flute + clarinet + bassoon in octaves\",\"Saint-Saens, Symphony 3, MII 3 before R.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Clarinets + high bassoon in octaves\",\"Stravinsky, Petrushka, Fig. 223-225.\",\n        \"HUG Woodwind Section: Standard Combinations\"},\n      {\"Two high clarinets in unison\",\"Stravinsky, Petrushka, Fig. 188-190 - the \"\n        .. \"stridently penetrating effect.\",\"HUG Woodwind Section: Standard Combinations\"},\n    }},\n    {\"Wind with brass\", {\n      {\"Horn + bassoons\",\"Stravinsky, Petrushka, Fig. 132-134 - the bridge doubling.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Horn with woodwind, filling a countermelody\",\"Mahler, Symphony 4, MI b63-65. \"\n        .. \"\\\"Horns frequently combine with woodwind in this way.\\\"\",\n        \"HUG Section Combinations in twos\"},\n      {\"Solo horn with flutes and oboes in close harmony\",\"Holst, The Planets: Venus, \"\n        .. \"opening.\",\"HUG Section Combinations in twos\"},\n      {\"Trumpet + flute in octaves\",\"Ravel, Bolero, Fig. 5 - the artificial oboe \"\n        .. \"described under Doubling.\",\"HUG Section Combinations in twos\"},\n      {\"Trumpet + cor anglais in unison\",\"Debussy, La Mer, I three bars before Fig. 1.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Horn + celesta + two piccolos in octaves\",\"Ravel, Bolero, Fig. 8 - the organ \"\n        .. \"mixture, and the clearest case of an invented instrument in the repertoire.\",\n        \"HUG Section Combinations in twos\"},\n    }},\n    {\"Wind with strings\", {\n      {\"Violas + clarinets\",\"Mahler, Symphony 5, M3 b.39-47 - the standard blend pair.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Pizzicato strings + bassoon\",\"Mahler, Symphony 5, M3 b.308-328.\",\n        \"HUG Section Combinations in twos\"},\n      {\"\u00e2\u0080\u0099Cellos + basses + bassoons in octaves\",\"Holst, The Planets: Mars, 4 after VI.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Violas + horn + bassoon in unison\",\"Elgar, Symphony 1, Fig. 137.\",\n        \"HUG Section Combinations in threes\"},\n      {\"Violas + flutes + clarinets + bassoons in octaves\",\"Elgar, Symphony 1, opening.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Oboes + clarinet + violins in unison, \u00e2\u0080\u0099cellos an octave below\",\"Mahler, \"\n        .. \"Symphony 5, MI b96-104.\",\"HUG Section Combinations in twos\"},\n      {\"Bass clarinet + bassoon + muted strings\",\"Elgar, Symphony 1, IV.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Violins I with upper woodwind in octaves\",\"Ravel, Bolero, Fig. 12.\",\n        \"HUG Section Combinations in twos\"},\n    }},\n    {\"Horns with strings\", {\n      {\"Violas + \u00e2\u0080\u0099cellos + 8 horns in unison\",\"Holst, The Planets: Jupiter, opening - \"\n        .. \"the big-tune version of the horn/'cello blend.\",\"HUG Section Combinations in twos\"},\n      {\"Horn + 1st violin in unison\",\"Stravinsky, Petrushka, Fig. 176-178.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Violins I and II in unison over four horns\",\"Holst, The Planets: Venus, 5 \"\n        .. \"before II - the horn quartet as background harmony.\",\n        \"HUG Section Combinations in twos\"},\n      {\"Two muted horns with second violins\",\"Debussy, Prelude a l'apres-midi d'un \"\n        .. \"faune, bb. 106-107.\",\"HUG Section Combinations in twos\"},\n    }},\n    {\"Brass on its own\", {\n      {\"Trombone trio, joined by trumpet trio\",\"Holst, The Planets: Saturn, 3 after I, \"\n        .. \"over low pizzicato strings - three-part trombones, the standard use.\",\n        \"HUG Brass Section: solos and groups\"},\n      {\"Muted trumpets in octaves\",\"Stravinsky, The Rite of Spring, Fig. 132.\",\n        \"HUG Brass Section: solos and groups\"},\n      {\"Open horns alternating with stopped\",\"Mahler, Symphony 5, M3 b.296-307.\",\n        \"HUG Brass Section: solos and groups\"},\n      {\"Classic natural-horn writing\",\"Beethoven, Symphony 7, MIV bb. 231-248 - the \"\n        .. \"harmonic series and the high register.\",\"HUG Brass Section: solos and groups\"},\n    }},\n    {\"Strings on their own\", {\n      {\"Violas + \u00e2\u0080\u0099cellos in unison\",\"Beethoven, Symphony 7, MII bb. 27-34.\",\n        \"HUG String Section\"},\n      {\"Violins + violas in octaves\",\"Tchaikovsky, Symphony 5, MII.\",\"HUG String Section\"},\n      {\"Strings in octaves\",\"Sibelius, Symphony 5, Molto moderato 2 after M.\",\n        \"HUG String Section\"},\n      {\"All strings in close harmony\",\"Saint-Saens, Symphony 3, MI letter M.\",\n        \"HUG String Section\"},\n      {\"\u00e2\u0080\u0099Cellos high, joined by violas\",\"Debussy, La Mer, II Fig. 26.\",\"HUG String Section\"},\n    }},\n    {\"Whole-orchestra scoring\", {\n      {\"Typical romantic tutti\",\"Mahler, Symphony 4, MI b264-266 - violins carrying the \"\n        .. \"melody with a prominent horn countermelody.\",\"HUG Section Combinations in threes\"},\n      {\"Horns softened by doubled strings\",\"Sibelius, Symphony 5, Allegro molto 14 after \"\n        .. \"D - melody on flute, oboes, clarinets and 'cellos in octaves, the famous \"\n        .. \"horn theme lent a shimmer by the strings.\",\"HUG Section Combinations in threes\"},\n      {\"Piccolo colouring the top of a chord\",\"Holst, The Planets: Mars, 6 after VII, in \"\n        .. \"a build to tutti.\",\"HUG Tuttis\"},\n      {\"Trombones doubled by bassoons and strings\",\"Elgar, Symphony 1, Fig. 45, with \"\n        .. \"horns doubled by cor anglais.\",\"HUG Section Combinations in threes\"},\n      {\"A tutti that is not a climax\",\"Lindberg, Cantigas, bb. 475-490 - instrumental \"\n        .. \"groups in layers, \\\"clearly distinct rather than climactic\\\".\",\"HUG Tuttis\"},\n    }},\n    {\"How to use this list\", {\n      {\"Check a recommendation before you trust it\",\"A combination this encyclopaedia \"\n        .. \"calls standard should be findable in the repertoire. If you cannot hear why \"\n        .. \"it is recommended, the fault may be in the recommendation.\",\"HUG Tuttis\"},\n      {\"A tutti is not everyone playing\",\"\\\"A full orchestral tutti does not necessarily \"\n        .. \"mean every single instrument is playing. However, the great majority of \"\n        .. \"instruments will join in. To make a controlled climax using a tutti is a \"\n        .. \"great skill in orchestration.\\\"\",\"HUG Tuttis\"},\n    }},\n  },\n  related={\"doubling\",\"blend\",\"balance\",\"spectrum\",\"composers\",\"three_groups\"},\n}\n\ne{ id=\"idiomatic\", name=\"Writing Playable Music\", family=\"Craft\", kind=\"topic\",\n  aliases={\"idiomatic\",\"playable\",\"playability\",\"difficulty\",\"hard to play\",\n           \"unidiomatic\",\"writing for players\",\"practical\",\"will they play it\",\n           \"too difficult\",\"technique\",\"performability\"},\n  summary=\"Almost anything is possible with enough rehearsal, and that is not the same \"\n       .. \"as practical. The question is not whether a passage can be played but whether \"\n       .. \"it will be played well by the players you actually have, in the time they \"\n       .. \"actually get - and small changes often buy a great deal of it back.\",\n  facts={\n    {\"The trade\",\"Difficult writing may be exactly what the music needs. The price is \"\n        .. \"that it may not be played correctly, or at all.\"},\n    {\"Where it bites hardest\",\"Large ensembles rehearse less per player than chamber \"\n        .. \"groups, so the same passage is riskier in an orchestra.\"},\n  },\n  sec={\n    {\"Possible is not the same as practical\", {\n      {\"The precedent cuts both ways\",\"Tchaikovsky's First Piano Concerto was called \"\n        .. \"unplayable and is now repertoire, and Ferneyhough's music gets performed and \"\n        .. \"recorded. So difficulty is not a veto. But \\\"just because something is \"\n        .. \"possible does not mean that it is practical or idiomatic\\\".\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Difficulty accumulates\",\"A hard passage that works in isolation may be near \"\n        .. \"impossible strung together with a series of other acrobatic demands. Budget \"\n        .. \"difficulty across a movement, not per bar.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"\u00e2\u0080\u009cProfessional\u00e2\u0080\u009d does not mean flawless\",\"It means the players are paid. Top \"\n        .. \"players still face the same challenge, with less rehearsal time than an \"\n        .. \"amateur group might give you. Write for the players you have, knowing their \"\n        .. \"strengths and how long they will have.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n    }},\n    {\"Write what the practice room rewards\", {\n      {\"Scales and arpeggios\",\"String players practise them obsessively, so a scalar or \"\n        .. \"arpeggiated passage will come off convincingly even at a quick tempo - where \"\n        .. \"frequent large leaps, string crossings or irregular melodic patterns will \"\n        .. \"not.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Change a note or two\",\"Slightly varying an unidiomatic passage can make it \"\n        .. \"\\\"exponentially easier to execute, while preserving the desired effect and \"\n        .. \"essence\\\". If two versions sound equivalent and one is far easier, there is no \"\n        .. \"argument for the harder one.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Distribute what one player cannot do\",\"Berlioz splits a theme of wide fast leaps \"\n        .. \"between the violins so no desk has to make them; Ravel modifies Bolero's \"\n        .. \"triple-tonguing for the woodwind while the horns play it straight. See \"\n        .. \"Doubling.\",\"IDIO Partial Doubling\"},\n      {\"Let the less agile instrument simplify\",\"Where 'cellos and basses share a line, \"\n        .. \"the basses take a plainer version. Berlioz gives the same reason for \"\n        .. \"separating them at all: figuration quicker than the basses could manage \"\n        .. \"cleanly.\",\"IDIO Partial Doubling; BERL The cello\"},\n    }},\n    {\"Look after the player, not just the part\", {\n      {\"Do not start cold on an exposure\",\"The piccolo's first entrance in Tchaikovsky's \"\n        .. \"Fourth is a fortissimo octave doubling in the third movement - musically \"\n        .. \"effective, and \\\"physically and psychologically unfriendly to the piccolo \"\n        .. \"player\\\". An inconsequential warm-up passage a few bars earlier would make it \"\n        .. \"far less alarming.\",\"ACTOR Woodwinds: Scoring Excerpts\"},\n      {\"Leave time to move\",\"Percussionists need time to change instrument or pick up \"\n        .. \"different beaters; not allowing for it is a common mistake. Think about the \"\n        .. \"choreography of the section.\",\"HUG Percussion Section\"},\n      {\"Cover the principal where you can\",\"A fifth horn may be engaged to take the less \"\n        .. \"important passages in the first part so the principal can save themselves for \"\n        .. \"the solos. You do not write this, but it explains why a demanding first horn \"\n        .. \"part is less unreasonable than it looks.\",\"HUG Brass Section\"},\n    }},\n    {\"Say what you want in the score\", {\n      {\"Descriptors carry what notation cannot\",\"Adjectives - boldly, whispering, \"\n        .. \"crunchy, like a bad joke - give players insight no combination of notes, \"\n        .. \"rhythms, dynamics and articulations will. The more character the descriptor \"\n        .. \"suggests, the more use it is.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Details define character\",\"Notes and rhythms supply the material; the expressive \"\n        .. \"markings define what it is. Treating dynamics, articulations, inflections and \"\n        .. \"descriptors as a last-minute layer is a missed opportunity, not a tidy \"\n        .. \"workflow.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Do not mark every note the same\",\"\\\"Some orchestrators fall into the trap of an \"\n        .. \"articulation area, in which every note has the same marking.\\\" Consistency may \"\n        .. \"be right; uniformity by default is not.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Write the layout down too\",\"Where a dialogue depends on the groups being far \"\n        .. \"apart, Berlioz says the composer should indicate the seating he wants in the \"\n        .. \"score. See The Modern Orchestra.\",\"BERL The Orchestra\"},\n    }},\n    {\"Register changes the instrument, not just the pitch\", {\n      {\"The general trend\",\"Instruments tend to sound dark at the bottom of their range \"\n        .. \"and brighter as the pitch rises - but the character changes, not only the \"\n        .. \"brightness.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"The same note, two instruments\",\"Middle C sits at the bottom of the flute's range \"\n        .. \"and sounds rich and colourful; the same sounding pitch is extremely high, thin \"\n        .. \"and pinched on contrabassoon. Choose the instrument for where the note falls \"\n        .. \"in its range, not for the note.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"And check the exceptions\",\"A low oboe penetrates more than a high one. See \"\n        .. \"Overtones, Formants and Penetration.\",\"IDIO Dynamics and Balance\"},\n    }},\n  },\n  related={\"quality\",\"dynamics\",\"doubling\",\"spectrum\",\"percussion\",\"horn\",\"orchestra\"},\n}\n\ne{ id=\"balance\", name=\"Balance and Relative Strength\", family=\"Combining\", kind=\"topic\",\n  aliases={\"balance\",\"relative strength\",\"loudness\",\"power\",\"how loud\",\n           \"instrument strength\",\"weight\",\"balancing\"},\n  summary=\"The numbers you need to make a doubling actually balance. All of these are \"\n       .. \"Rimsky-Korsakov's forte ratios unless noted; in piano, all wind - wood and \"\n       .. \"brass alike - are of fairly equal weight.\",\n  sec={\n    {\"Within the brass\", {\n      {\"1 Trumpet = 1 Trombone = 1 Tuba = 2 Horns\",\"In loud passages the horns are \"\n        .. \"only half as strong.\",\"RK p.33\"},\n      {\"Cornets\",\"Slightly less force than trumpets and trombones.\",\"RK p.23\"},\n      {\"Marking\",\"Horns should be marked one degree stronger than the rest of the \"\n        .. \"brass: trumpets and trombones pp, horns p.\",\"RK p.23\"},\n    }},\n    {\"Brass against woodwind\", {\n      {\"1 Horn = 2 Clarinets = 2 Oboes = 2 Flutes = 2 Bassoons\",\"\\\"Wood-wind \"\n        .. \"instruments, in forte passages, are twice as weak as the horns.\\\"\",\"RK p.33\"},\n      {\"Equal families\",\"Flutes, oboes, clarinets and bassoons may be taken as of \"\n        .. \"equal power. The special instruments (piccolo, alto flute, English horn, \"\n        .. \"E-flat clarinet, bass clarinet, contrabassoon) may not be.\",\"RK p.19\"},\n    }},\n    {\"Wind against strings\", {\n      {\"Piano\",\"Violins I = 1 Flute; one whole string department equals one wind \"\n        .. \"instrument.\",\"RK p.33\"},\n      {\"Forte\",\"Violins I = 2 Flutes = 1 Oboe + 1 Clarinet.\",\"RK p.33\"},\n      {\"Caveat\",\"This assumes a medium-sized body of strings - everything depends on \"\n        .. \"the number of players.\",\"RK p.33\"},\n    }},\n    {\"Instruments of little sustaining power\", {\n      {\"Easily overpowered\",\"The combined force of the sustaining groups easily \"\n        .. \"overpowers strings pizzicato or col legno, a softly played piano, or the \"\n        .. \"celesta.\",\"RK p.34\"},\n      {\"Easily overpowering\",\"Glockenspiel, bells and xylophone \\\"will easily prevail \"\n        .. \"over other groups in combination\\\" - as will the timpani.\",\"RK p.34\"},\n      {\"Harps\",\"At least three, and preferably four, harps in unison are needed to be \"\n        .. \"heard against a full orchestra playing forte. The faster a glissando, the \"\n        .. \"louder it sounds.\",\"RK p.29\"},\n      {\"Percussion that wins outright\",\"Bass drum, cymbals, gong, and a fortissimo \"\n        .. \"side-drum tremolo will each overpower any orchestral tutti.\",\"RK p.117\"},\n    }},\n    {\"Balance in chords\", {\n      {\"The acoustic rescue\",\"\\\"In every chord the parts in octaves strengthen one \"\n        .. \"another, the harmonic sounds in the lowest register coinciding with and \"\n        .. \"supporting those in the highest\\\" - which compensates for inequalities \"\n        .. \"you could not avoid.\",\"RK p.94\"},\n      {\"Which parts are weakest\",\"In four-part wind harmony \\\"the two extreme parts \"\n        .. \"are the thinnest and weakest in tone, the intermediate parts the fullest \"\n        .. \"and strongest\\\".\",\"RK p.77\"},\n      {\"Last resort\",\"Where balance cannot be secured by distribution, secure it by \"\n        .. \"dynamic grading - marking the woodwind one degree louder than the brass.\",\"RK p.94\"},\n    }},\n\n    {\"Counting a chord \u00e2\u0080\u0094 the balance ratio\", {\n      {\"The whole system, in four numbers\",\"One string group (e.g. all 1st violins) = \"\n        .. \"2  ~  one woodwind instrument = 1  ~  one horn, or one saxophone = 2  ~  \"\n        .. \"one other brass instrument = 4. Add up each note of a chord and compare. \"\n        .. \"This is Rimsky-Korsakov's experience reduced to something you can count \"\n        .. \"with, and it is the only tool of its kind in the literature.\",\n        \"IDIO Dynamics and Balance\"},\n      {\"The number that surprises people\",\"It takes four clarinets to match one \"\n        .. \"trumpet. Counter-intuitive, and \\\"largely confirmed by practical \"\n        .. \"experience, although they admittedly are beyond scientific proof\\\".\",\n        \"IDIO Dynamics and Balance\"},\n      {\"Use it in forte\",\"Forte is the reliable basis, because instrumental power \"\n        .. \"varies far more in piano - muted brass or a string group can play \"\n        .. \"extremely softly, while very soft is awkward for a low oboe, a very high \"\n        .. \"clarinet or an unmuted high trumpet.\",\"IDIO Dynamics and Balance\"},\n      {\"Counting divisi and double stops\",\"Each divisi note counts 2, the same as a \"\n        .. \"whole group. For double stops, count each sustained note.\",\"IDIO Chords\"},\n      {\"What to leave out\",\"Timpani: their dynamic range is effectively unlimited so \"\n        .. \"no ratio fits, and in classical and romantic scoring they mark the root \"\n        .. \"anyway, which only reinforces it. Harp and piano chords are also left out \"\n        .. \"unless they exist to create a deliberately unusual balance.\",\"IDIO Chords\"},\n      {\"Where it does not reach\",\"Short chords, where balance matters less; and \"\n        .. \"ranking one segment against another, because the ear does not weigh \"\n        .. \"segments by power alone. In a Heldenleben tutti the busy woodwind flurry \"\n        .. \"scores only 6-7 while the trombone melody scores 16 - and elsewhere a \"\n        .. \"1st-violin countermelody scoring 2 still emerges over a main subject \"\n        .. \"scoring 12, because the subject is a near-immobile ostinato.\",\"IDIO Chords\"},\n    }},\n    {\"What a balanced final chord looks like\", {\n      {\"The root takes most of it\",\"Measured as fifth/third/root, the last chord of \"\n        .. \"Brahms's 2nd symphony is 9/8/35 - that is 17/15/67 per cent, so two \"\n        .. \"thirds of the sound power is on the root. His 1st gives 22/22/57 and his \"\n        .. \"4th gives 8/23/70. Root predominance is the norm across the classical and \"\n        .. \"romantic repertoire.\",\"IDIO Chords\"},\n      {\"Reinforce rather than thin out\",\"Ending Ein Heldenleben, Strauss diminuendos \"\n        .. \"to piano but does not remove instruments: he adds four horns and moves a \"\n        .. \"trumpet and three trombones off the fifth and third onto the root. The \"\n        .. \"chord gets quieter and more focused at once.\",\"IDIO Chords\"},\n      {\"Weighting the third on purpose\",\"Mahler's 6th - \\\"a battle between minor and \"\n        .. \"major\\\" - ends 13/24/19, weighting the third rather than the root, so the \"\n        .. \"minor third is unmistakably the victor. Break the rule when the piece is \"\n        .. \"about the thing you are breaking it for.\",\"IDIO Chords\"},\n    }},\n    {\"Loudness is not the same as thickness\", {\n      {\"Koechlin\u00e2\u0080\u0099s distinction\",\"\\\"By 'volume' he means the thickness of a given sound. \"\n        .. \"For example, at any dynamic level, a horn will always sound thicker, or \"\n        .. \"'fatter', than a violin. Acoustically, thick sounds tend to have stronger \"\n        .. \"fundamentals than thin sounds.\\\"\",\"BEL p.34\"},\n      {\"Two ways to get a fat sound\",\"As a chosen timbre - horn, tuba - or as the \"\n        .. \"result of unison doubling, which \\\"adds more volume than loudness\\\".\",\"BEL p.34-35\"},\n      {\"Sixteen violins are not sixteen times one\",\"Doubling the sound pressure does \"\n        .. \"not double what the ear hears. A large string group reads as a different \"\n        .. \"kind of sound rather than a louder one - \\\"full, rich, more mellow and far \"\n        .. \"more dense\\\". This is why a single soloist can be heard over thirty-two of \"\n        .. \"them at all.\",\"IDIO Dynamics and Balance\"},\n      {\"Balance is not only power\",\"\\\"A melodic line (or the highest part) always \"\n        .. \"attracts attention - activity and movement capture more attention than, \"\n        .. \"for example, sustained notes.\\\" Contrast of sonority or register shifts \"\n        .. \"perceived dynamics as much as the dynamic marks do.\",\"IDIO Dynamics and Balance\"},\n      {\"Successive balance\",\"\\\"This is a problem mainly when passing from very thick \"\n        .. \"sounds to very thin ones: The thin sound can seem disagreeable by comparison \"\n        .. \"with the previous richness... after a loud, full brass passage, an oboe will \"\n        .. \"sound thinner than usual, by contrast.\\\"\",\"BEL p.35-36\"},\n    }},\n    {\"What the ear picks out, all else being equal\", {\n      {\"The top line\",\"\\\"The top line normally attracts the most attention.\\\"\",\"BEL p.36\"},\n      {\"Whatever is moving\",\"\\\"The ear normally follows activity: If, say, in the string \"\n        .. \"choir, all the parts except the viola are static, the movement in the viola \"\n        .. \"will stand out.\\\"\",\"BEL p.36\"},\n      {\"Activity can also obscure\",\"Koechlin again: strings are ideal for accompanying a \"\n        .. \"voice, \\\"but if they are playing vigorous counterpoint they will cover the \"\n        .. \"voice much more easily than if they have long held notes. In other words, \"\n        .. \"balance is not just a function of the choice of instruments, but also of what \"\n        .. \"they are doing.\\\"\",\"BEL p.36\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Two solo violins in perfect unison\",\"Doubling all the 1st and 2nd violins in \"\n        .. \"unison gives greater density and is standard; but two solo violins in \"\n        .. \"perfect unison \\\"often sound poor, if not to say 'impoverished'\\\". The \"\n        .. \"effect that works with a section does not scale down to a pair.\",\n        \"IDIO Dynamics and Balance\"},\n      {\"Solo strings against solo brass\",\"In a sinfonietta-sized ensemble this needs \"\n        .. \"meticulous care. String instruments have been essentially unchanged since \"\n        .. \"the end of the 1700s, while brass instruments have changed substantially \"\n        .. \"and are considerably more powerful today - so a classical-era balance does \"\n        .. \"not transfer to a modern chamber orchestra.\",\"IDIO Dynamics and Balance\"},\n      {\"Measuring it in decibels\",\"\\\"Practically useless\\\" for music: manufacture, \"\n        .. \"playing style, hall acoustics, seating and the players' own instinctive \"\n        .. \"adjustment all change constantly. Use the ratios and your ears, not a \"\n        .. \"meter.\",\"IDIO Dynamics and Balance\"},\n    }},\n  },\n  related={\"blend\",\"three_groups\",\"brass\",\"woodwind\",\"strings\",\"range\"},\n}\n\ne{ id=\"range\", name=\"Orchestral Range and Score Order\", family=\"Reference\", kind=\"topic\",\n  aliases={\"range\",\"score order\",\"limits\",\"orchestral range\",\"compass\",\"layout\",\n           \"score layout\",\"order of the score\",\"register\"},\n  summary=\"How the orchestra is laid out on the page, and how far it reaches at the \"\n       .. \"top and bottom.\",\n  sec={\n    {\"Score order (top to bottom)\", {\n      {\"Woodwind\",\"Flutes, Oboes, Clarinets, Bassoons - the natural order of \"\n        .. \"register and the order of the full score.\",\"RK p.46\"},\n      {\"Brass\",\"Trumpets, Horns, Trombones, Tuba.\",\"RK p.22\"},\n      {\"Then\",\"Percussion (timpani first), harp, then strings: Violins I, Violins II, \"\n        .. \"Violas, Violoncellos, Double basses.\",\"SIN p.276\"},\n      {\"Reading it\",\"Singleton's walk-through of a page of Beethoven's Fifth notes \"\n        .. \"the clef and key problem: flutes and oboes in treble, clarinets in treble \"\n        .. \"but a different key, bassoons in bass, horns in another key again, timpani, \"\n        .. \"then the strings - violas in alto or tenor clef, 'cellos in bass, tenor \"\n        .. \"or treble.\",\"SIN p.276\"},\n    }},\n    {\"Limits of the range\", {\n      {\"The whole scale\",\"Modern limits run up to the high C of the 7th octave and \"\n        .. \"down to the low 16-foot C, which is why the piccolo is indispensable and \"\n        .. \"the contrabassoon valuable.\",\"RK p.18\"},\n      {\"All in the top\",\"Seldom done; use flutes and piccolo with the upper notes of \"\n        .. \"the violins, soli or divisi. Gives brilliant colour.\",\"RK p.106\"},\n      {\"All in the bottom\",\"Still rarer, because close harmonic intervals down there \"\n        .. \"create a bad effect. Use contrabassoon, low bassoons, bass clarinet, \"\n        .. \"horns, trombones, tuba. Dark and gloomy - and the reverse of these two \"\n        .. \"cases is \\\"fundamentally impossible\\\".\",\"RK p.106\"},\n      {\"Empty middle\",\"Widely separated extremes without the intermediate octaves \"\n        .. \"filled in is contrary to proper distribution - but the unusual resonance \"\n        .. \"serves for strange and grotesque effects.\",\"RK p.106-107\"},\n    }},\n    {\"Distributing a chord\", {\n      {\"Follow the harmonic series\",\"Wide intervals (octaves, sixths) in the bass, \"\n        .. \"lesser ones (fifths, fourths) in the middle, close ones (thirds, seconds) \"\n        .. \"in the upper register.\",\"RK p.67 & p.79\"},\n      {\"Bass spacing\",\"The bass should rarely lie more than an octave from the part \"\n        .. \"directly above it, and should never mix with the other parts.\",\"RK p.64 & p.67\"},\n      {\"Duplication\",\"Harmony that looks like 5, 6, 7 or 8 parts is usually four-part \"\n        .. \"harmony with the upper parts doubled in the octave above - the bass only \"\n        .. \"ever doubled in the octave below.\",\"RK p.64\"},\n      {\"In widely-spaced writing\",\"Only the soprano and alto may be doubled in \"\n        .. \"octaves; doubling the tenor produces close writing, and doubling the bass \"\n        .. \"creates heaviness.\",\"RK p.64\"},\n      {\"Why that spacing works\",\"The strongest overtones of a very low note land in \"\n        .. \"the middle of the hearing range, where the ear resolves pitch most \"\n        .. \"precisely. Wide intervals low down keep those overtones from colliding \"\n        .. \"dissonantly with the notes actually written in that register - which is \"\n        .. \"why the low register is dominated by the octave, then the fifth, and why \"\n        .. \"the third with its dissonant overtones appears there only in deliberately \"\n        .. \"unusual chords.\",\"IDIO Chords\"},\n      {\"It is not only a tonal rule\",\"\\\"All chords, tonal or atonal, triadic or not, \"\n        .. \"tend to be structured in such a way that the largest intervals are placed \"\n        .. \"in the bass register.\\\" The weight of a balanced orchestral chord usually \"\n        .. \"sits in that central area, whatever the harmonic language.\",\"IDIO Chords\"},\n    }},\n    {\"How harsh a dissonance sounds\", {\n      {\"Spread it and it softens\",\"\\\"The further apart two notes are placed from each \"\n        .. \"other in terms of register, the less intense or obtrusive the dissonance \"\n        .. \"between them will be perceived.\\\" Register does as much work as the \"\n        .. \"interval itself.\",\"IDIO Chords\"},\n      {\"The instrument decides the bite\",\"Powerful high overtones make a piercing \"\n        .. \"dissonance. A minor second \\\"seems far less harsh when played by two low \"\n        .. \"flutes than by two low oboes\\\" - the same interval, a different result.\",\n        \"IDIO Chords\"},\n      {\"Where the ear hears intonation most clearly\",\"Pitch is resolved most precisely \"\n        .. \"in the centre of the hearing range and less so at the extremes. The \"\n        .. \"violin's high register sits where the ear is more forgiving; the 'cello's \"\n        .. \"high register sits right in the middle, so slight intonation trouble there \"\n        .. \"is immediately noticeable.\",\"IDIO Chords\"},\n      {\"Mind the diminuendo too\",\"A low oboe has very little room for diminuendo, \"\n        .. \"while a string instrument or a low clarinet has almost no limit. If a \"\n        .. \"chord is marked to fade, check that every instrument in it can.\",\"IDIO Chords\"},\n    }},\n    {\"Instrumentation shorthand\", {\n      {\"The formula\",\"Flute . Oboe . Clarinet . Bassoon - Horn . Trumpet . Trombone . \"\n        .. \"Tuba. A dot separates one player from another, a slash indicates doubling; \"\n        .. \"timpani and percussion are written tmp+n.\",\"WP\"},\n      {\"Worked example\",\"3[1.2.3/pic] 2[1.Eh] 3[1.2.3/Ebcl/bcl] 3[1.2/cbn.cbn] tmp+2 \"\n        .. \"= 3 flutes (3rd doubling piccolo), 2 oboes (2nd on English horn \"\n        .. \"throughout), 3 clarinets (3rd also on E-flat and bass clarinet), 3 \"\n        .. \"bassoons (2nd doubling contra, 3rd on contra only), timpani + 2 \"\n        .. \"percussion.\",\"WP\"},\n    }},\n\n    {\"Belkin on register planning\", {\n      {\"Why register matters most\",\"\\\"Register planning is essential to good \"\n        .. \"orchestration, since a change of register is obvious even to a \"\n        .. \"non-musician.\\\"\",\"BEL p.28\"},\n      {\"Follow the overtone series for a blended mass\",\"\\\"Wider in the lower range and \"\n        .. \"more compact getting higher, with no large gaps in the middle - such gaps \"\n        .. \"tend to divide the sound mass into separate planes.\\\" Where you *want* \"\n        .. \"differentiation, as in some counterpoint, the gaps become useful.\",\"BEL p.28\"},\n      {\"Leave part of the range empty sometimes\",\"\\\"It is advisable not to fill the \"\n        .. \"entire audible range all the time: Occasional passages in the higher or the \"\n        .. \"lower range alone provide valuable contrast and relief for the ear.\\\"\",\"BEL p.28\"},\n      {\"Fewer instruments are needed at the extremes\",\"\\\"Even in a large tutti, one \"\n        .. \"piccolo in its highest register will penetrate without difficulty.\\\" \"\n        .. \"Extremes fatigue the ear, so do not stay there.\",\"BEL p.29\"},\n      {\"Hollow textures work softly\",\"\\\"Textures with large gaps can occasionally be \"\n        .. \"quite effective, although the ear tires of this effect rather quickly. This \"\n        .. \"sonority also works better in softer dynamics: Loud passages with holes in \"\n        .. \"the middle tend to sound feeble.\\\"\",\"BEL p.30\"},\n      {\"Registral progressions as direction\",\"Widening out from the middle in both \"\n        .. \"directions, or piling up high or low material, are \\\"powerful sources of \"\n        .. \"musical direction\\\", especially into and out of climaxes.\",\"BEL p.31\"},\n      {\"Strain within the range reads as intensity\",\"Trumpets and horns not high in \"\n        .. \"absolute terms but high *for them* create \\\"an effect of intensity and \"\n        .. \"strain\\\".\",\"BEL p.30\"},\n    }},\n  },\n  related={\"woodwind\",\"brass\",\"strings\",\"percussion\",\"orchestra\"},\n}\n\n-- Additional sources: present-day practice. These corroborate and update the\n-- historical treatises. See README.md for how they were consulted.\nD.SOURCES.BEL = {\n  tag=\"BEL\", short=\"Belkin, Artistic Orchestration\",\n  full=\"Alan Belkin, 'Artistic Orchestration' (c) Alan Belkin 2001, 2008 - the \"\n    .. \"third volume of his free online series on musical technique, published by \"\n    .. \"the author at alanbelkinmusic.com. 65 pages; cited by page from the \"\n    .. \"author's PDF. Belkin states: \\\"The material may be used free of charge \"\n    .. \"provided that the author's name is included.\\\" His own debts, which he \"\n    .. \"names, are chiefly to Koechlin's 'Traite de l'Orchestration', and to \"\n    .. \"Rimsky-Korsakov, Piston and Adler.\",\n}\nD.SOURCES.BERL = {\n  tag=\"BERL\", short=\"Berlioz, Treatise on Instrumentation and Orchestration\",\n  full=\"Hector Berlioz, 'Grand traite d'instrumentation et d'orchestration \"\n    .. \"modernes' (Paris, 1843; second edition 1855). The underlying text is public \"\n    .. \"domain. Consulted in the English translation by Michel Austin on the Hector \"\n    .. \"Berlioz Website, which is a *selection* - roughly the third of the book \"\n    .. \"given to technical range and mechanism is omitted, leaving the material on \"\n    .. \"timbre, character and combination, which is the part this encyclopaedia \"\n    .. \"needs. That translation reserves all rights, so BERL items paraphrase \"\n    .. \"Berlioz's substance rather than reproducing the translator's sentences; \"\n    .. \"where Berlioz is quoted word for word in this encyclopaedia it is from the \"\n    .. \"older public-domain translation Singleton uses, and is tagged SIN as well. \"\n    .. \"Cited by the instrument or chapter heading.\",\n}\nD.SOURCES.ACTOR = {\n  tag=\"ACTOR\", short=\"Freund & Cutler, Extreme Orchestration\",\n  full=\"Don Freund and David Cutler, 'Extreme Orchestration' (published February \"\n    .. \"2024), on the Timbre and Orchestration Resource of the ACTOR Project \"\n    .. \"(Analysis, Creation and Teaching of Orchestration). Cited by chapter title. \"\n    .. \"Split out of the MOD group when the full text was supplied: it is the \"\n    .. \"present-day teaching text MOD was standing in for. Its particular \"\n    .. \"contribution is on dynamics, idiomatic writing, and why piling on \"\n    .. \"instruments reduces colour rather than adding it.\",\n}\nD.SOURCES.OMT = {\n  tag=\"OMT\", short=\"Open Music Theory, \u00e2\u0080\u009cCore Principles of Orchestration\u00e2\u0080\u009d\",\n  full=\"Gotham et al. (eds.), 'Open Music Theory' 2e, chapter 'Core Principles of \"\n    .. \"Orchestration' - open-access music theory textbook.\",\n}\nD.SOURCES.IDIO = {\n  tag=\"IDIO\", short=\"The Idiomatic Orchestra\",\n  full=\"'The Idiomatic Orchestra' (theidiomaticorchestra.net), an online \"\n    .. \"orchestration manual. Cited by chapter or page title: the pages have no \"\n    .. \"numbering, but each claim can be found in the named chapter. It began \"\n    .. \"here as a tag-only source gathered from search summaries; when the full \"\n    .. \"text was supplied every existing claim was re-checked against it and all \"\n    .. \"were confirmed, so the citations were upgraded rather than rewritten. Its \"\n    .. \"particular contribution is the balance-ratio method, which it takes from \"\n    .. \"Rimsky-Korsakov and states in a usable form, and a careful separation of \"\n    .. \"sound power from sound density - a distinction it credits to Koechlin's \"\n    .. \"'Traite de l'Orchestration', which it notes has never been translated.\",\n}\nD.SOURCES.HUG = {\n  tag=\"HUG\", short=\"Hugill, The Orchestra: A User\u00e2\u0080\u0099s Manual\",\n  full=\"Andrew Hugill, 'The Orchestra: A User's Manual' (c) Andrew Hugill 2015, \"\n    .. \"written with the Philharmonia Orchestra. Cited by page title. Split out \"\n    .. \"of the MOD group when the full site was supplied: it is mostly an index \"\n    .. \"of the Philharmonia's recorded archive, giving composer, work, recording \"\n    .. \"and bar or figure number for a great many scorings, plus prose on each \"\n    .. \"section. Claims previously cited to MOD that this text supports have been \"\n    .. \"re-cited here. All rights reserved by the author; used as short factual \"\n    .. \"statements with attribution.\",\n}\nD.SOURCES.MOD = {\n  tag=\"MOD\", short=\"Present-day practice (several sources)\",\n  full=\"Consensus of present-day orchestration references consulted together: \"\n    .. \"the Timbre and Orchestration Resource (ACTOR Project); Orchestration \"\n    .. \"Online; Wikipedia, 'Orchestra', 'String section', 'Brass section'; and \"\n    .. \"film-score and programme notes where no better source exists. Used for \"\n    .. \"present-day section sizes and standard practice. Cited by tag only: \"\n    .. \"these were gathered from search-result summaries rather than full page \"\n    .. \"reads. Hugill was originally part of this group and is now cited \"\n    .. \"separately as HUG, having been read in full.\",\n}\n\ne{ id=\"orchestra\", name=\"The Modern Orchestra\", family=\"Reference\", kind=\"section\",\n  aliases={\"orchestra\",\"modern orchestra\",\"symphony orchestra\",\"full orchestra\",\n           \"orchestra size\",\"roster\",\"the orchestra\",\"standard orchestra\"},\n  summary=\"What a full symphony orchestra actually contains today, and how it is \"\n       .. \"laid out. Roughly a hundred permanent players, in four groups plus harp \"\n       .. \"and keyboards.\",\n  facts={\n    {\"Four groups\",\"Strings, Woodwind, Brass, Percussion - each a choir of soprano, \"\n       .. \"alto, tenor and bass\"},\n    {\"Outside the groups\",\"Harp, piano and celesta stand apart; Singleton notes the \"\n       .. \"harp \\\"does not belong to any family\\\" and comes from the minstrels and \"\n       .. \"bards, not the violin tribe\"},\n  },\n  sec={\n    {\"Berlioz: build the orchestra to the work\", {\n      {\"The principle\",\"Unless the available forces are fixed, assemble the players \"\n        .. \"according to the style and character of the piece and the effects it needs - \"\n        .. \"the reverse of writing for a standard roster and hoping. For the Requiem he \"\n        .. \"put four brass orchestras at the four corners of the main one, with ten \"\n        .. \"players on eight pairs of timpani, and says plainly that no other \"\n        .. \"arrangement could have produced the effect.\",\"BERL The Orchestra\"},\n      {\"Haydn and Mozart want fewer strings\",\"The modest wind of an opera-comique \"\n        .. \"orchestra suits their symphonies, and a larger string body would often be \"\n        .. \"too loud for the delicate effects they give to flutes, oboes and bassoons \"\n        .. \"alone. Beethoven's symphonies, Weber's overtures and anything in a grand and \"\n        .. \"passionate style need the full string body instead.\",\"BERL The Orchestra\"},\n      {\"His own ideal concert orchestra\",\"21 first violins, 20 seconds, 18 violas, 8 \"\n        .. \"first 'cellos, 7 second 'cellos, 11 double basses, 4 harps, and wind \"\n        .. \"including 2 piccolos, cor anglais, bass clarinet, 4 bassoons, 4 valve horns, \"\n        .. \"2 valve trumpets, 2 cornets, 4 trombones, ophicleide or tuba, two pairs of \"\n        .. \"timpani with four players. Note the 'cellos divided into firsts and seconds.\",\n        \"BERL The Orchestra\"},\n      {\"The other system\",\"The string-dominant scheme is not the only one that works. \"\n        .. \"Invert it and the strings become the bridge to a wind-and-brass orchestra - \"\n        .. \"too few to dominate, they soften the brilliance of the brass, or lend warmth \"\n        .. \"and impetus, their tremolo able to make even a drum roll musical by blending \"\n        .. \"with it.\",\"BERL The Orchestra\"},\n    }},\n    {\"Where the players sit\", {\n      {\"Tiers, not a flat floor\",\"The best arrangement raises the players one above \"\n        .. \"another so each row projects to the audience with nothing in the way. An \"\n        .. \"opera pit gives up most of that advantage, being low, central and flat - \"\n        .. \"which is why, Berlioz says, delicate effects are lost in the theatre, and \"\n        .. \"why a dramatic score should not be written exactly like a concert work.\",\n        \"BERL The Orchestra\"},\n      {\"Distance is a compositional choice\",\"Groups meant to question and answer each \"\n        .. \"other only read as dialogue if they are far enough apart, and the composer \"\n        .. \"should mark the layout he wants in the score. Percussion playing an ordinary \"\n        .. \"rhythm together can sit together; percussion in rhythmic dialogue is better \"\n        .. \"split to the two ends of the orchestra.\",\"BERL The Orchestra\"},\n      {\"Keep percussion near the conductor\",\"They drag at a distance, and need to be \"\n        .. \"close enough to respond instantly to the beat.\",\"BERL The Orchestra\"},\n      {\"Uniform placement is a habit, not a law\",\"Berlioz calls the constant uniformity \"\n        .. \"in placing masses of instruments one of the greatest obstacles to genuinely \"\n        .. \"new large-scale work, imposed by habit, routine and laziness more than by \"\n        .. \"cost.\",\"BERL The Orchestra\"},\n      {\"There is no open-air music\",\"Reflectors are indispensable, and the nearer they \"\n        .. \"are to the source the better they work. A thousand wind players and two \"\n        .. \"thousand voices in an open plain would not have a twentieth of the effect of \"\n        .. \"eighty players and a hundred voices in a good hall. Street bands appear to \"\n        .. \"contradict this and in fact confirm it: the tall houses, trees and facades \"\n        .. \"are the reflectors, and the music evaporates the moment the band marches \"\n        .. \"out into open ground.\",\"BERL The Orchestra\"},\n    }},\n    {\"Present-day string sizes\", {\n      {\"Common professional layout\",\"14 first violins / 12 seconds / 10 violas / 8 \"\n        .. \"'cellos / 6 basses - written \\\"14/12/10/8/6\\\".\",\"MOD\"},\n      {\"Typical professional section\",\"16 firsts / 14 seconds / 12 violas / 10 \"\n        .. \"'cellos / 8 basses - the Philharmonia's usual strength, and the same \"\n        .. \"proportions Rimsky-Korsakov gives for a full orchestra. Numbers vary with \"\n        .. \"the piece, the venue and the conductor.\",\"HUG String Section; cf. RK p.6\"},\n      {\"Full-scale (c.100 players)\",\"16-18 firsts / 16 seconds / 12 violas / 12 \"\n        .. \"'cellos / 8 basses. Strauss \\\"and many others\\\" generally required 16-18 \"\n        .. \"first violins and 16 seconds for a full-scale symphony orchestra.\",\n        \"IDIO Dynamics and Balance\"},\n      {\"How much variation there really is\",\"Standard classical works are performed \"\n        .. \"today with anywhere from about 20 to more than 60 string players, and \"\n        .. \"composers rarely specify a number in the score.\",\"IDIO Dynamics and Balance\"},\n      {\"Rule of thumb\",\"Subtract about 2 for each next-lower string section to keep \"\n        .. \"the proportions balanced.\",\"MOD\"},\n      {\"Why bigger than 1922\",\"Modern halls are larger and the wind more powerful, so \"\n        .. \"the strings must be increased to keep the ensemble in balance - exactly \"\n        .. \"the trend Rimsky-Korsakov complained about.\",\"MOD; cf. RK p.6 & p.48\"},\n    }},\n    {\"Present-day wind and brass\", {\n      {\"Double woodwind\",\"2 flutes, 2 oboes, 2 clarinets, 2 bassoons. No auxiliary \"\n        .. \"instruments.\",\"HUG Woodwind Section\"},\n      {\"Triple woodwind\",\"2 flutes + piccolo, 2 oboes + English horn, 2 clarinets + \"\n        .. \"bass clarinet, 2 bassoons + contrabassoon - so three players per family, \"\n        .. \"the third taking the auxiliary. \\\"This is the standard lineup for most \"\n        .. \"symphony orchestras.\\\"\",\"HUG Woodwind Section\"},\n      {\"Quadruple woodwind\",\"3 flutes + piccolo, 3 oboes + English horn, 3 clarinets \"\n        .. \"+ bass clarinet, 3 bassoons + contrabassoon - four players per family. \"\n        .. \"Saxophones may be added to any of the three.\",\"HUG Woodwind Section\"},\n      {\"Brass\",\"4 horns, 3 trumpets, 3 trombones (the third a bass trombone), 1 tuba \"\n        .. \"- \\\"probably the most common orchestral combination\\\", with numerous \"\n        .. \"variations and occasional massive expansions.\",\"HUG Brass Section; cf. RK p.21\"},\n      {\"Percussion\",\"Timpani plus 2-4 percussionists, and one or two harps.\",\"MOD\"},\n    }},\n    {\"Seating (Singleton\u00e2\u0080\u0099s 1917 description, still recognisable)\", {\n      {\"Left of the conductor\",\"First violins, with the 'cellos beside them and the \"\n        .. \"double basses behind.\",\"SIN p.9\"},\n      {\"Right of the conductor\",\"Second violins, with the violas beside them.\",\"SIN p.9\"},\n      {\"Centre, facing the conductor\",\"Clarinets by the violas; then oboes and English \"\n        .. \"horn; then flutes. Bassoons behind the flutes; horns behind the oboes and \"\n        .. \"clarinets.\",\"SIN p.9\"},\n      {\"Back row\",\"Trombones, trumpets, drums, triangle, cymbals and the rest of the \"\n        .. \"percussion. Harp on the right behind the first violins.\",\"SIN p.9\"},\n    }},\n    {\"Historic rosters, for reference\", {\n      {\"Haydn\",\"String quartet, 2 flutes, 2 oboes, 2 clarinets, 2 bassoons, 2 horns, \"\n        .. \"2 trumpets and kettledrums. He was the first to give the timpani an \"\n        .. \"artistic part.\",\"SIN p.200\"},\n      {\"Mozart / Haydn inheritance\",\"Strings, 2 flutes, 2 oboes, 2 bassoons, 2 horns, \"\n        .. \"2 trumpets, kettledrums and occasionally 2 clarinets. Neither used \"\n        .. \"trombones in a symphony.\",\"SIN p.219\"},\n      {\"Beethoven\u00e2\u0080\u0099s Fifth\",\"First appearance in his symphonies of piccolo, trombones \"\n        .. \"and contrabassoon.\",\"SIN p.229\"},\n      {\"Beethoven\u00e2\u0080\u0099s Ninth\",\"2 flutes, 2 oboes, 2 clarinets, 2 bassoons, 4 horns, 2 \"\n        .. \"trumpets, 2 drums and strings; with 3 trombones, contrabassoon, piccolo, \"\n        .. \"triangle, cymbals and bass drum in some movements.\",\"SIN p.240\"},\n      {\"Debussy, Prelude a l\u00e2\u0080\u0099apres-midi d\u00e2\u0080\u0099un faune\",\"3 flutes, oboes, clarinets, 4 \"\n        .. \"horns, 2 harps, antique cymbals and strings - no trumpets, trombones, \"\n        .. \"timpani or tuba at all.\",\"SIN p.270\"},\n      {\"Cesti, Il Pomo d\u00e2\u0080\u0099oro (1666)\",\"Thirty players: 6 violins, 12 alto violas, \"\n        .. \"tenor, bass, contrabass, 2 flutes, trumpets, 2 cornets, 3 trombones, a \"\n        .. \"bassoon and a little organ - strings accompanied the voices, flutes did \"\n        .. \"the pastoral scenes, trumpets the choral scenes, cornets and trombones \"\n        .. \"the infernal ones.\",\"SIN p.155\"},\n    }},\n  },\n  related={\"strings\",\"woodwind\",\"brass\",\"percussion\",\"range\",\"doubling\"},\n}\n\ne{ id=\"doubling\", name=\"Doubling: General Principles\", family=\"Combining\", kind=\"topic\",\n  aliases={\"doubling\",\"doublings\",\"how to double\",\"unison doubling\",\"octave doubling\",\n           \"when to double\",\"coupling\",\"mixture\",\"parallel doubling\",\"partial doubling\",\n           \"artificial overtone\",\"perfect unison\"},\n  summary=\"The general rules that govern every specific pairing in this book - when \"\n       .. \"to double at all, what doubling costs you, and how to keep planes of tone \"\n       .. \"distinct.\",\n  sec={\n    {\"When to double\", {\n      {\"To make a risky note secure\",\"A doubling can exist for the player's sake rather \"\n        .. \"than the listener's. In Strauss, first and second horns at the top of their \"\n        .. \"range are given security by a unison doubling from the third trumpet - the \"\n        .. \"note is guaranteed whether or not the horns land it cleanly. Worth \"\n        .. \"remembering whenever you write near the top of a brass part.\",\n        \"ACTOR Brass: Introduction\"},\n      {\"The elementary rule\",\"\\\"Do not double at the unison, unless there is a \"\n        .. \"definite need for more volume, or unless the particular color is exactly \"\n        .. \"what is needed for the musical character.\\\"\",\"BEL p.35\"},\n      {\"What you lose\",\"Combining timbres adds resonance, sweetness and power but \"\n        .. \"\\\"possesses the disadvantage of restricting the variety of colour and \"\n        .. \"expression. Individual timbres lose their characteristics when associated \"\n        .. \"with others.\\\" Give phrases needing diverse expression to solo \"\n        .. \"instruments.\",\"RK p.48\"},\n      {\"A solo line stays solo\",\"\\\"A line whose character requires a solo sound will \"\n        .. \"be less effective when doubled.\\\" An instrument \\\"enjoys greater \"\n        .. \"independence and freedom when used as a solo than when it is doubled.\\\"\",\"BEL p.7; RK p.48\"},\n      {\"Where doubling belongs\",\"Doubling and mixed timbres are naturally more \"\n        .. \"frequent in loud than in soft passages, and where the expression is broad \"\n        .. \"rather than intimate.\",\"RK p.48\"},\n      {\"Making a line stand out\",\"Melody in the upper parts stands out by position \"\n        .. \"alone, and to a lesser degree in the low register. In the middle of the \"\n        .. \"orchestral range it needs help: contrast of timbre, doubling, tripling, or \"\n        .. \"crossing of parts.\",\"RK p.36\"},\n    }},\n    {\"Planes of tone\", {\n      {\"What a plane of tone is\",\"\\\"By 'plane of tone' (D. F. Tovey's term) we \"\n        .. \"refer to one instrument, or a blended group of instruments, not \"\n        .. \"necessarily from the same family, sharing one rhythmic outline. A plane \"\n        .. \"may consist of one line or a textural mass.\\\" Decide the role of each \"\n        .. \"plane first: \\\"otherwise, confusion will result.\\\"\",\"BEL p.39-40\"},\n      {\"Blend within a plane\",\"\\\"Within a plane of tone, blend is achieved by \"\n        .. \"similarity of timbre and rhythm, close spacing (no large gaps), and \"\n        .. \"balance (all elements fairly equal in force).\\\"\",\"BEL p.40\"},\n      {\"Separate the planes\",\"\\\"Between planes of tone, clear differentiation is \"\n        .. \"essential. This is achieved by contrast of register, timbre, and/or \"\n        .. \"rhythm.\\\"\",\"BEL p.40\"},\n      {\"Interlock to blend, space to separate\",\"For a blended sound use integrated \"\n        .. \"\\\"interlocking\\\" voicing balanced to each instrument's strength in that \"\n        .. \"register; for a different colour on each note, use wider spacing.\",\"OMT\"},\n    }},\n    {\"Unison vs octave\", {\n      {\"Perfect unison\",\"Fuses tone colour and increases the density of the sound - but \\\"volume (amplitude) is only partly affected\\\". If you want it louder, this is not the doubling that does it.\",\"IDIO Perfect Unison\"},\n      {\"Two of the same instrument\",\"Gains power and weight, keeps its individuality, \"\n        .. \"but loses expressive capacity. Two identical instruments in unison may \"\n        .. \"have intonation trouble; three or more turn into a small chorus - three \"\n        .. \"oboes are not twice as loud as one, but the quality changes.\",\"RK p.48; BEL p.7\"},\n      {\"Octaves\",\"\\\"Octave doubling will always result in an increase in volume, and \"\n        .. \"is by far the most common type of doubling.\\\" This is the one to reach for \"\n        .. \"when you want more sound, and the one that also clarifies the relation \"\n        .. \"between melody and accompaniment by spreading it across registers.\",\n        \"IDIO Octaves\"},\n      {\"Octaves are easier to hear as two things\",\"Octave doublings, and unison \"\n        .. \"doublings between timbrally diverse instruments, fuse less readily than \"\n        .. \"unisons of similar instruments.\",\"MOD; cf. IDIO Perfect Unison\"},\n      {\"Within-family first\",\"Orchestral practice favours doubling within a family; \"\n        .. \"'cello and double bass are the closest-allied pair in the whole orchestra, \"\n        .. \"playing the same pitch class in the great majority of sonorities where \"\n        .. \"both sound - they played from identical parts as a matter of course well \"\n        .. \"into the 19th century.\",\"MOD; IDIO Unisono and Doubling\"},\n      {\"A line too wide for one instrument\",\"When a unison line runs through more \"\n        .. \"octaves than any one player can cover, instruments change lanes - jumping \"\n        .. \"an octave to carry on. Stagger those shifts: they must not all happen at \"\n        .. \"once, but \\\"smoothly and carefully graduated\\\".\",\"IDIO Octaves\"},\n    }},\n    {\"Parallel doubling \u00e2\u0080\u0094 other intervals\", {\n      {\"What it does\",\"Doubling at intervals other than the octave - most often the \"\n        .. \"third, fifth or sixth, adjusted to fit the current key or scale. \\\"Even \"\n        .. \"more than octave doubling, parallel doubling results in increased volume \"\n        .. \"and density.\\\" It is the heaviest of the three, so spend it deliberately.\",\n        \"IDIO Parallel Doubling\"},\n      {\"It still reads as one line\",\"Identity survives a good deal of divergence. In \"\n        .. \"a Messiaen example most instruments descend a major second while the 2nd \"\n        .. \"violins rise an augmented fourth, and the passage is still heard as a \"\n        .. \"single line - because the rhythm, articulation and contour agree. Shared \"\n        .. \"rhythm holds a doubling together more strongly than shared intervals.\",\n        \"IDIO Parallel Doubling\"},\n      {\"Where it shades into polyphony\",\"\\\"Borderline situations between extended \"\n        .. \"parallel doubling and polyphony are not rare.\\\" Judge it by weighing \"\n        .. \"independent melodic movement against rhythmic unison: the first splits a \"\n        .. \"texture into segments, the second ties it into one.\",\"IDIO Parallel Doubling\"},\n      {\"Growing habit since 1900\",\"Interest in parallel doublings beyond the octave, \"\n        .. \"third and sixth is noticeably greater in music from the early 20th century \"\n        .. \"onward - Bolero saturates nearly the whole texture with them once it \"\n        .. \"reaches forte.\",\"IDIO Parallel Doubling\"},\n    }},\n    {\"Mixture \u00e2\u0080\u0094 building an instrument that does not exist\", {\n      {\"The idea\",\"Doubling does not only blend colours; it can synthesise one. Add \"\n        .. \"instruments on a note's own overtones, soft enough that the ear takes them \"\n        .. \"for overtones rather than notes, and the result is a timbre no player \"\n        .. \"possesses - \\\"invented instruments, so to say\\\". The organ mixture stop is \"\n        .. \"the model.\",\"IDIO Parallel Doubling\"},\n      {\"The worked example\",\"In Bolero, a horn melody is joined by two piccolos on \"\n        .. \"its 2nd and 4th overtones and a celesta on its 1st and 3rd. Because \"\n        .. \"overtones are fixed intervals independent of tonality, Ravel notates the \"\n        .. \"2nd overtone of a C major melody in G major and the 4th in E major, and \"\n        .. \"marks individual dynamics so the added parts stay below the threshold of \"\n        .. \"being heard as themselves.\",\"IDIO Parallel Doubling\"},\n      {\"The cheap version\",\"A muted trumpet with a flute an octave above: the flute \"\n        .. \"supplies an artificial first overtone and the pair passes for a gentle \"\n        .. \"oboe. Ravel uses it in Bolero to postpone the real oboe. Note that this \"\n        .. \"needs a straight mute, which enhances high overtones; a cup or velvet mute \"\n        .. \"reduces them and gives a closed, less oboe-like sound.\",\"IDIO Parallel Doubling\"},\n      {\"What to double with\",\"Instruments whose own spectra are weak in overtones, so \"\n        .. \"they disappear into the sound they are colouring: flute, string harmonics, \"\n        .. \"celesta, the clarinet's weak middle-register notes.\",\"IDIO ch.12\"},\n    }},\n    {\"Partial doubling\", {\n      {\"Don\u00e2\u0080\u0099t double everything\",\"Complete doubling produces a heavy, massive sound. \"\n        .. \"Partial doubling - woodwind partly doubling the high strings while horns \"\n        .. \"partly double the lower ones - keeps weight without clogging.\",\"IDIO Partial Doubling\"},\n      {\"Modify as you double\",\"A bassoon and flute may double the first violins' \"\n        .. \"melody with tiny modifications, dropping embellishments or notes in a \"\n        .. \"strained register so the melodic line keeps its elegance.\",\"IDIO Partial Doubling\"},\n      {\"Let the less agile part simplify\",\"Where two instruments do not share the same \"\n        .. \"agility - 'cellos and basses being the standard case - the slower one plays \"\n        .. \"a simpler version of the line. This is not a compromise; it is how the \"\n        .. \"pairing has always worked.\",\"IDIO Partial Doubling\"},\n      {\"Split a passage to make it playable\",\"Large intervals, high and fast, invite \"\n        .. \"intonation trouble. Berlioz distributes such a theme between the violins \"\n        .. \"so no one desk has to leap - orchestration solving a technical problem \"\n        .. \"rather than a colouristic one. Ravel does the same for the triple-tonguing \"\n        .. \"in Bolero, modifying it for the woodwind while the horns play it straight.\",\n        \"IDIO Partial Doubling\"},\n      {\"Dividing a group costs density, not volume\",\"Splitting a string group into two \"\n        .. \"equal parts \\\"does not noticeably influence the volume of each half, but \"\n        .. \"can reduce the density of sound to a certain degree\\\". Divide freely for \"\n        .. \"texture; do not expect each half to sound half as loud.\",\"IDIO Partial Doubling\"},\n      {\"Orchestrated gesture\",\"Rapid runs in the most agile instruments - strings, \"\n        .. \"flute, clarinet, piano, harp - written differently for each to mark an \"\n        .. \"overall sweep rather than a line. Doubling them exactly \\\"would sound \"\n        .. \"unnecessarily weighty or overly defined\\\".\",\"IDIO Partial Doubling\"},\n      {\"Transference\",\"When a phrase outruns one instrument's range, hand it on: make \"\n        .. \"the last note of each part coincide with the first note of the next.\",\"RK p.107\"},\n    }},\n    {\"The wind/string equivalences\", {\n      {\"Rough family mapping\",\"Violins answer to flutes and oboes, viola to clarinet, \"\n        .. \"'cello to bassoon - a serviceable first guess when choosing which wind to \"\n        .. \"add to which string group.\",\"MOD\"},\n      {\"Standard blended pairs\",\"Low clarinet + viola; horn + 'cello (or all horns \"\n        .. \"with all low strings); oboes + trumpets at soft dynamics; bassoons + \"\n        .. \"string pizzicato; horn + bassoon in the middle register for a slimmer, \"\n        .. \"more focused horn sound.\",\"IDIO ch.12\"},\n    }},\n\n    {\"Why more instruments is not more colour\", {\n      {\"The paint analogy\",\"Mixing many colours of paint gives grey or black, and \"\n        .. \"combining many instruments cancels the unique qualities of each. Flute, \"\n        .. \"clarinet, trumpet, marimba and violin in unison do not sound five times as \"\n        .. \"colourful; they sound generic. This is the mechanism behind the grayness \"\n        .. \"Belkin warns of below.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Colour is contextual, not absolute\",\"\\\"A single clarinet sounds much less \"\n        .. \"colorful when draped over a backdrop of saxophones than it does when combined \"\n        .. \"with a string choir.\\\" And the dense combination that sounds generic on its \"\n        .. \"own can be striking if it follows a long passage of solo writing. Judge a \"\n        .. \"colour against what precedes and surrounds it.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Mixed timbres penetrate further than matched ones\",\"In an octave doubling, \\\"the \"\n        .. \"mix of the different timbres in each octave is more penetrating than doubles \"\n        .. \"of the same timbre a2\\\" - so oboes and clarinets each in octaves project \"\n        .. \"better than either pair doubled in unison. Tchaikovsky's Fourth uses exactly \"\n        .. \"this for its strongest lines.\",\"ACTOR Woodwinds: Scoring Excerpts\"},\n      {\"The flute is the exception\",\"Its weak low register means a flute taken down to \"\n        .. \"double an oboe contributes less than it would playing a2 in the higher \"\n        .. \"octave. In the middle octave, though, flutes add body to oboes for a full but \"\n        .. \"less brilliant sound.\",\"ACTOR Woodwinds: Scoring Excerpts\"},\n      {\"How many sounds an instrument has\",\"Not one. A clarinet alone offers low, \"\n        .. \"middle and high, staccato and legato, sustained, loud and soft - before any \"\n        .. \"combination. A woodwind quintet has far more than five sounds, and thinking \"\n        .. \"of an instrument as a single colour is the beginner's error.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n    }},\n    {\"Doubling without grayness\", {\n      {\"The problem with literal doubling\",\"\\\"Too frequent literal doubling leads to \"\n        .. \"heaviness and a rather gray sound.\\\" Grayness - too much unison doubling - is \"\n        .. \"one of Belkin's named symptoms of poor orchestration.\",\"BEL p.37 & p.18\"},\n      {\"Double at intervals other than the unison\",\"\\\"Doubling at the octave allows for \"\n        .. \"greater transparency of color, and also fills the musical space in more \"\n        .. \"interesting and varied ways. Occasional doubling at other intervals, \"\n        .. \"especially in the higher octaves, can also create interesting synthetic \"\n        .. \"timbres (like mutation stops on the organ).\\\" Bolero doubles a horn at the \"\n        .. \"twelfth and two octaves plus a third.\",\"BEL p.37-38\"},\n      {\"Heterophony\",\"\\\"Rather than literal doubling, each doubled part can be an \"\n        .. \"ornamental variation on the same basic contour. This keeps the overall design \"\n        .. \"clear, but allows for individuality.\\\" Mozart's Figaro overture stays light in \"\n        .. \"a tutti this way.\",\"BEL p.38\"},\n      {\"Let doubling become counterpoint\",\"\\\"An instrument can begin a phrase as a \"\n        .. \"doubling, and at some musically meaningful point - a change of motive, a \"\n        .. \"climax, a cadence - become more contrapuntal, or vice versa.\\\"\",\"BEL p.38\"},\n      {\"Piece-meal doubling\",\"Doubling that moves between several lines in turn, \"\n        .. \"\\\"creating new lines, which do not, however, add significant polyphony to the \"\n        .. \"texture\\\". Mahler's Ninth: the first horn is an inner counterpoint, then \"\n        .. \"doubles the 'cello, then the first trombone.\",\"BEL p.38\"},\n      {\"Partial doubling\",\"Double only the highlights - the beginning, the end, or a few \"\n        .. \"motives. \\\"The doubling can then drop out, or become background resonance, \"\n        .. \"settling down on a held note. The opposite (a held note becomes a doubling) is \"\n        .. \"also possible.\\\"\",\"BEL p.38\"},\n      {\"Why it is worth the trouble\",\"\\\"By individualizing doublings in these ways - \"\n        .. \"creating a sort of pseudo-counterpoint rather than simply duplicating lines \"\n        .. \"mechanically - the overall effect gains in subtlety and nuance. The players' \"\n        .. \"parts are also more individual and interesting to play.\\\"\",\"BEL p.39\"},\n    }},\n  },\n  related={\"blend\",\"balance\",\"strings_wind\",\"wind_brass\",\"three_groups\",\"strings_brass\"},\n}\n\n-- ============================================================================\n-- STRINGS\n-- ============================================================================\n\ne{ id=\"violin\", name=\"Violin\", family=\"Strings\", kind=\"instrument\",\n  aliases={\"violin\",\"violins\",\"violin i\",\"violin ii\",\"violins i\",\"violins ii\",\n           \"first violins\",\"second violins\",\"vn\",\"vns\",\"fiddle\",\"vln\"},\n  summary=\"\\\"Pre-eminently a melodic instrument - the splendid sparkling soprano of \"\n       .. \"the stringed tribe, the richest in varied effects, the most agile and the \"\n       .. \"most impassioned of orchestral elements\\\" (Lavignac). Melody in the \"\n       .. \"soprano-alto register and above usually falls to the first violins.\",\n  facts={\n    {\"Strings\",\"G - D - A - E\"},\n    {\"In the choir\",\"Violins I sing soprano, Violins II mezzo-soprano\"},\n    {\"Numbers\",\"16/12/8 firsts and 14/10/6 seconds (full/medium/small, RK); 14/12 \"\n      .. \"firsts/seconds is a common professional layout today\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Violins II\",\"Gains power and richness without altering colour; the tone \"\n        .. \"stays that of the string quartet, enriched. The weight of violins prevents \"\n        .. \"any doubling woodwind from predominating.\",\"RK p.39\"},\n      {\"+ Violas\",\"Violins remain predominant; rich, full resonance.\",\"RK p.39\"},\n      {\"+ \u00e2\u0080\u0099Cellos\",\"The 'cello tone prevails and the resonance is fuller.\",\"RK p.40\"},\n      {\"+ Flute\",\"One of the best and most natural string/wind combinations - \"\n        .. \"registers correspond closely. Also with alto flute or piccolo.\",\"RK p.58\"},\n      {\"+ Oboe\",\"A classic: the oboe gives the violins bite and definite colour, the \"\n        .. \"violins soften the oboe.\",\"RK p.58\"},\n      {\"+ Clarinet\",\"As above, warmer; also with E-flat clarinet.\",\"RK p.58\"},\n      {\"+ Trumpet\",\"The best-matched string/brass pair by register - though the two \"\n        .. \"are always heard distinctly.\",\"RK p.61\"},\n      {\"+ Oboe (or Flute, Clarinet) + Trumpet\",\"The standard soprano grouping of all \"\n        .. \"three orchestral groups, for loud passages or heavy piano.\",\"RK p.61\"},\n      {\"+ 2 Fl + 2 Ob (absorbed)\",\"With that much wind in unison, the wind timbre \"\n        .. \"predominates and the violins are absorbed into a sweet coherent quality.\",\"RK p.34\"},\n      {\"+ 1 Oboe only (thickened)\",\"A single wind added to the whole violin body only \"\n        .. \"thickens the strings; the wind timbre is lost.\",\"RK p.34\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Vns I / Vns II\",\"\\\"A very common process used for all kinds of melodic \"\n        .. \"figures, in particular those in the very high register\\\", which otherwise \"\n        .. \"stand too isolated. Secures expression, fullness and firmness of timbre. \"\n        .. \"The classic orchestral sound: high octave to the firsts, lower to the \"\n        .. \"seconds.\",\"RK p.40; ACTOR Woodwinds: Scoring Excerpts\"},\n      {\"But Berlioz prefers the unison\",\"He grants that doubling the firsts with the \"\n        .. \"seconds an octave below is the common way to give a violin passage power - \"\n        .. \"and says that unless the passage lies high, putting all the violins in \"\n        .. \"unison is far better, incomparably more powerful and beautiful. He cites \"\n        .. \"the end of the first movement of Beethoven's Fifth, whose electrifying \"\n        .. \"effect he attributes to violins in unison. Rimsky-Korsakov recommends the \"\n        .. \"octave; Berlioz recommends the unison below the top of the range. Both are \"\n        .. \"in the repertoire, so decide by register: high, octave; otherwise, try the \"\n        .. \"unison first.\",\"BERL The violin; cf. RK p.40\"},\n      {\"Vns / Violas\",\"Common, especially when the lower octave goes below the open G.\",\"RK p.41\"},\n      {\"Violins in unison + Violas an octave below\",\"Berlioz warns against it: having \"\n        .. \"reached a violin unison, reinforcing it with violas an octave down is too \"\n        .. \"weak and out of proportion to the part above, and adds a superfluous \"\n        .. \"buzzing that obscures the violins rather than strengthening them. If the \"\n        .. \"viola part cannot be made distinctive, put the violas in unison with the \"\n        .. \"'cellos instead - as Beethoven does in the same movement.\",\"BERL The viola\"},\n      {\"Vns / \u00e2\u0080\u0099Cellos\",\"For very expressive passages, with the 'cellos on the A or D \"\n        .. \"string. More resonant than violas/'cellos; instances are frequent.\",\"RK p.42\"},\n      {\"Vns I + II / Violas + \u00e2\u0080\u0099Cellos\",\"Each octave doubled in unison; \\\"constantly \"\n        .. \"found\\\" for melodies in the middle range, beautiful and somewhat severe.\",\"RK p.43\"},\n      {\"Picc / Fl + Vns\",\"When only one of two octaves may be doubled in a soprano \"\n        .. \"melody, let the woodwind take both octaves and double just the lower one \"\n        .. \"with violins. Also Fl / Ob (Cl) + Vns.\",\"RK p.60\"},\n    }},\n    {\"Thirds and sixths\", {\n      {\"Thirds\",\"Use the same colour in both parts; write thirds doubled in octaves \"\n        .. \"with firsts and seconds - despite unequal numbers the thirds will not \"\n        .. \"sound unbalanced.\",\"RK p.45\"},\n      {\"Sixths\",\"Different timbres may be used. A striking inversion: 'Cellos above, \"\n        .. \"Violins I + II on the G string below, in sixths - \\\"distinctly original in \"\n        .. \"character\\\".\",\"RK p.45-46\"},\n      {\"Second violins as harmony\",\"Rather than doubling, the seconds often take a \"\n        .. \"harmony part in thirds and sixths below the melody.\",\"WP\"},\n    }},\n    {\"Technique and colour\", {\n      {\"The E string\",\"Diminishes in fullness the higher it climbs above the soprano \"\n        .. \"voice - a reason to double high figures an octave below.\",\"RK p.40\"},\n      {\"Extreme high register\",\"Playable but piercing; one or two desks on the top \"\n        .. \"octave with the rest of the firsts an octave below diminishes the shrillness \"\n        .. \"and strengthens the expressive lower octave.\",\"RK p.42 n.\"},\n      {\"Muted (con sordini)\",\"Gives a dull, ethereal quality - but muted strings do \"\n        .. \"not combine well with woodwind, the qualities staying distinct.\",\"RK p.36-37 & p.34\"},\n      {\"Harmonics\",\"Related in quality to the flute and piccolo; that relationship is \"\n        .. \"the link between the two groups in the orchestra's upper range.\",\"RK p.35\"},\n      {\"Col legno\",\"Struck with the wood of the bow, the sound resembles a xylophone \"\n        .. \"and improves as more players join.\",\"RK p.32\"},\n      {\"Solo violin\",\"One of the two string solos that are reasonably frequent (with \"\n        .. \"the 'cello). Needs a light, transparent accompaniment; avoid writing \"\n        .. \"difficult virtuoso solos, which draw too much attention.\",\"RK p.104-105\"},\n      {\"Solo violin + Flute or Piccolo\",\"Two solo violins, or solo violin + flute, are \"\n        .. \"often enough to double a melody in the upper register while keeping the \"\n        .. \"solo timbre.\",\"RK p.105-106\"},\n    }},\n    {\"Divisi\", {\n      {\"Score alike across the section\",\"A good rule is all divisi or none, so no \"\n        .. \"string group is unduly heavy against another. A standard approach keeps the \"\n        .. \"firsts in unison and divides seconds, violas and 'cellos as voice leading \"\n        .. \"requires.\",\"MOD\"},\n      {\"Balanced six/seven-part harmony\",\"If the whole group divides the same way - \"\n        .. \"Vns I div., Vns II div., Violas div. - the balance is completely \"\n        .. \"satisfactory; ease the undivided 'cellos and basses by marking them down \"\n        .. \"or reducing players.\",\"RK p.70\"},\n      {\"Not divided in octaves\",\"Violins divisi in octaves halves the players and \"\n        .. \"drains resonance; usable when the woodwind doubles them.\",\"RK p.40-41\"},\n    }},\n  },\n  related={\"strings\",\"viola\",\"cello\",\"flute\",\"oboe\",\"clarinet\",\"trumpet\",\"strings_wind\"},\n}\n\ne{ id=\"viola\", name=\"Viola\", family=\"Strings\", kind=\"instrument\",\n  aliases={\"viola\",\"violas\",\"alto violin\",\"vla\",\"vlas\"},\n  summary=\"\\\"Of all instruments in the Orchestra the one whose excellent qualities \"\n       .. \"have been longest misappreciated\\\" (Berlioz). Melody in the alto-tenor \"\n       .. \"register and above; better fitted for short characteristic phrases than \"\n       .. \"long cantabile, and usually doubled by other strings or by woodwind.\",\n  facts={\n    {\"Strings\",\"C - G - D - A (a fifth below the violin, an octave above the 'cello)\"},\n    {\"In the choir\",\"Alto / tenor\"},\n    {\"Numbers\",\"12/8/4 (full/medium/small, RK); around 10-12 today\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ \u00e2\u0080\u0099Cellos\",\"Rich, full resonance with the 'cello quality predominating.\",\"RK p.39\"},\n      {\"+ Violins\",\"No special new character; the violins stay predominant.\",\"RK p.39\"},\n      {\"+ Oboe or English horn\",\"One of the best-matched string/wind pairs.\",\"RK p.58\"},\n      {\"+ Clarinet\",\"Especially the clarinet's low register: the viola's timbre is \"\n        .. \"comparable to the lowest compass of the clarinet, making this one of the \"\n        .. \"standard blended doublings.\",\"RK p.58 & p.35-36; IDIO ch.12\"},\n      {\"+ Bassoon\",\"The viola also resembles the bassoon's middle register; \"\n        .. \"Tchaikovsky's Marche Slave uses bassoon with violas \\\"very effectively\\\".\",\"RK p.58 & p.35-36; SIN p.97\"},\n      {\"+ Horn\",\"The best-matched string/brass pair in the alto-tenor range; muted \"\n        .. \"violas with horn is a favourite effect.\",\"RK p.61\"},\n      {\"+ Clarinet (or Eng. horn) + Horn\",\"The standard alto-tenor grouping of all \"\n        .. \"three groups.\",\"RK p.61\"},\n      {\"+ 2 Ob + 2 Cl (absorbed)\",\"With that much wind, the wind timbre predominates.\",\"RK p.34\"},\n      {\"+ \u00e2\u0080\u0099Cellos + 1 Clarinet (thickened)\",\"A single wind added to the string body \"\n        .. \"only thickens it; the wind timbre disappears.\",\"RK p.34\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Vns / Violas\",\"Common, especially when the lower octave falls below the \"\n        .. \"violin's open G. Vns I + II / Violas gives brilliance above; Vns I / Vns II \"\n        .. \"+ Violas gives a fuller, more cantabile lower octave.\",\"RK p.41\"},\n      {\"Violas / \u00e2\u0080\u0099Cellos\",\"Of special use when the violins are otherwise employed; \"\n        .. \"often doubled by bassoons.\",\"RK p.41\"},\n      {\"Violas + 2 Cl / \u00e2\u0080\u0099Cellos + D. basses + 2 Fag\",\"A fully scored low-middle \"\n        .. \"octave doubling.\",\"RK p.59\"},\n    }},\n    {\"Character\", {\n      {\"Berlioz\",\"\\\"No less agile than the violin. The sound of its strings is \"\n        .. \"peculiarly telling. Its upper notes are distinguished by their mournfully \"\n        .. \"passionate accent; and its quality of tone, altogether of profound \"\n        .. \"melancholy, differs from that of other instruments played with a bow.\\\"\",\"SIN p.51\"},\n      {\"Berlioz, on the high strings\",\"\\\"Melodies on the high strings of the viola \"\n        .. \"have a marvellous beauty in scenes of a religious and unique character.\\\"\",\"SIN p.51\"},\n      {\"Range of sentiment\",\"\\\"From sad reverie to agonized pathos.\\\" Slightly nasal \"\n        .. \"in quality.\",\"SIN p.52; RK p.37\"},\n      {\"How many you need\",\"Berlioz: its tone \\\"so strongly attracts and captivates \"\n        .. \"the attention that it is not necessary to have in the Orchestra quite so \"\n        .. \"many violas as second violins\\\".\",\"SIN p.51\"},\n      {\"The repertoire that made the case\",\"Berlioz's Harold en Italie (solo viola as \"\n        .. \"Childe Harold); Wagner's Venusberg motive in the Tannhauser overture; \"\n        .. \"Strauss's Sancho Panza in Don Quixote.\",\"SIN p.50-51\"},\n    }},\n    {\"Berlioz on how many, and how to divide them\", {\n      {\"You need fewer than the second violins\",\"Its tone is distinctive enough that a \"\n        .. \"section need not match the seconds in number - the colour carries without \"\n        .. \"the weight.\",\"BERL The viola\"},\n      {\"Divide only if you have the players\",\"Berlioz approves dividing violas into \"\n        .. \"firsts and seconds where the numbers are adequate, and warns that with only \"\n        .. \"four or five it can only damage a group already weak and easily overwhelmed.\",\n        \"BERL The viola\"},\n      {\"Check the instruments are real violas\",\"He complains that many violas then in \"\n        .. \"French orchestras were undersized - effectively violins strung as violas - \"\n        .. \"and so lacked the tonal power of the real instrument, draining colour and \"\n        .. \"energy from the low notes especially.\",\"BERL The viola\"},\n    }},\n    {\"Use sparingly\", {\n      {\"A whole work built on violas\",\"Mehul wrote Uthal for violas with no violins at \"\n        .. \"all, to match the dreamy character of Ossianic poetry; contemporaries found \"\n        .. \"it unbearably monotonous and it damaged the work. Gretry is said to have \"\n        .. \"offered a louis to hear an E string. Berlioz's verdict is that the viola's \"\n        .. \"tone, valuable when contrasted with others, becomes wearisome quickly: it \"\n        .. \"is too short of variety and too tinged with sadness to sustain a whole \"\n        .. \"piece.\",\"BERL The viola\"},\n      {\"Solo viola\",\"\\\"The solo viola is seldom found\\\" - unlike violin and 'cello \"\n        .. \"solos.\",\"RK p.104\"},\n      {\"Violas / D. basses in octaves\",\"Seldom arises; only when the 'cellos are \"\n        .. \"otherwise employed.\",\"RK p.42\"},\n      {\"Long cantabile\",\"Cantabile melodies go less often to violas than to violins \"\n        .. \"and 'cellos, both because the tone is slightly nasal and because there are \"\n        .. \"fewer players.\",\"RK p.37\"},\n    }},\n  },\n  related={\"strings\",\"violin\",\"cello\",\"clarinet\",\"englishhorn\",\"horn\",\"bassoon\"},\n}\n\ne{ id=\"cello\", name=\"Violoncello\", family=\"Strings\", kind=\"instrument\",\n  aliases={\"cello\",\"cellos\",\"violoncello\",\"violoncellos\",\"vc\",\"vlc\",\"'cello\",\"'cellos\"},\n  summary=\"\\\"A ravishing instrumental tenor, of pure, warm timbre, ecstatic or \"\n       .. \"passionate, but always distinguished and captivating\\\" (Lavignac). More \"\n       .. \"often entrusted with tense, passionate cantabile than with rapid figures; \"\n       .. \"such melodies are usually laid out for the top (A) string.\",\n  facts={\n    {\"Strings\",\"C - G - D - A (an octave below the viola)\"},\n    {\"In the choir\",\"Tenor and bass; \\\"usually it gives, reinforced by the double \"\n      .. \"bass, the bass of the harmony. This is its natural work.\\\"\"},\n    {\"Numbers\",\"10/6/3 (full/medium/small, RK); 8-12 today\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Double basses\",\"Rich, full resonance; the standard bass. Empirically the \"\n        .. \"closest-allied pair in the whole orchestra.\",\"RK p.40; MOD\"},\n      {\"+ Violas\",\"Rich and full, with the 'cello on top.\",\"RK p.39\"},\n      {\"+ Violins\",\"The 'cello tone prevails and the resonance is fuller.\",\"RK p.40\"},\n      {\"+ Bassoon\",\"One of the best-matched string/wind pairs; bassoons added to \"\n        .. \"'cello and bass parts clarify and reinforce them.\",\"RK p.58; MOD\"},\n      {\"+ Clarinet or Bass clarinet\",\"As above, for a darker colour.\",\"RK p.58\"},\n      {\"+ Horns\",\"\\\"Frequently employed, produces a beautifully blended, soft quality \"\n        .. \"of tone\\\" - the one string/brass combination Rimsky-Korsakov singles out, \"\n        .. \"and a standard blended pair in modern practice too.\",\"RK p.61; IDIO ch.12\"},\n      {\"+ Trombones / Tuba (with D. basses)\",\"For heavy, massive effects.\",\"RK p.61\"},\n      {\"+ 2 Fag + 3 Trombones + Tuba (with D. basses)\",\"The standard bass grouping of \"\n        .. \"all three groups.\",\"RK p.61\"},\n      {\"+ 2 Cl + 2 Fag (absorbed)\",\"With that much wind in unison the wind timbre \"\n        .. \"predominates.\",\"RK p.34\"},\n      {\"+ English horn (with violins or violas)\",\"Rimsky-Korsakov's own favourite \"\n        .. \"recipe - 'Cellos + Violas + Eng. horn, or Vns + 'Cellos + Eng. horn.\",\"RK p.58-59\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"\u00e2\u0080\u0099Cellos / D. basses\",\"\\\"The bass is usually constructed in this manner. \"\n        .. \"Examples of it are to be found everywhere.\\\" The bass part is sometimes \"\n        .. \"simplified against the 'cello part.\",\"RK p.42\"},\n      {\"Vns / \u00e2\u0080\u0099Cellos\",\"For very expressive passages with the 'cellos on the A or D \"\n        .. \"string; more resonant than violas/'cellos, and frequent.\",\"RK p.42\"},\n      {\"Violas / \u00e2\u0080\u0099Cellos\",\"When the violins are otherwise employed.\",\"RK p.41\"},\n      {\"\u00e2\u0080\u0099Cellos + Bassoon / D. basses\",\"For a low melody needing a sweet, soft tone - \"\n        .. \"the basses left undoubled.\",\"RK p.60\"},\n      {\"\u00e2\u0080\u0099Cellos + Bass cl / D. basses + C-Fag\",\"A fully reinforced low octave.\",\"RK p.59\"},\n    }},\n    {\"When to separate from the basses\", {\n      {\"The default, and why to leave it\",\"Orchestral practice gives 'cellos and \"\n        .. \"double basses the same part, in unison or an octave apart. Berlioz lists \"\n        .. \"four reasons to separate them, and says the cases are numerous: to let the \"\n        .. \"'cellos sing a melody on their upper strings; to put them below the basses \"\n        .. \"for an open-string or harmonic effect; or to give them the bass line with \"\n        .. \"figuration quicker than the basses could manage cleanly.\",\n        \"BERL The cello; cf. RK p.42\"},\n    }},\n    {\"Character\", {\n      {\"Berlioz\",\"\\\"Violoncellos together to the number of eight, or ten, are \"\n        .. \"essentially melodious; their quality on the upper strings is one of the \"\n        .. \"most expressive in the Orchestra. Nothing is more voluptuously melancholy \"\n        .. \"or more suited to the utterance of tender, languishing themes than a mass \"\n        .. \"of violoncellos playing in unison upon their first string.\\\"\",\"SIN p.65\"},\n      {\"Also\",\"\\\"Excellent for airs of a religious character.\\\" The two lower strings \"\n        .. \"are smooth and deep, but too low to carry melodies.\",\"SIN p.65\"},\n      {\"Solo \u00e2\u0080\u0099cello\",\"With the violin, one of the two string solos reasonably often \"\n        .. \"used. A solo 'cello combined with violins gives the latter a touch of \"\n        .. \"'cello timbre.\",\"RK p.104 & p.40\"},\n      {\"Clefs\",\"Bass clef for the lower and middle registers, tenor clef above that, \"\n        .. \"treble for the top notes.\",\"SIN p.62\"},\n    }},\n  },\n  related={\"strings\",\"doublebass\",\"viola\",\"bassoon\",\"horn\",\"clarinet\",\"trombone\"},\n}\n\ne{ id=\"doublebass\", name=\"Double Bass\", family=\"Strings\", kind=\"instrument\",\n  aliases={\"double bass\",\"double-bass\",\"doublebass\",\"double basses\",\"basses\",\"contrabass\",\n           \"bass\",\"db\",\"cb\",\"string bass\",\"d. basses\"},\n  summary=\"\\\"Dull in tone and of little flexibility, chiefly employed in unison or in \"\n       .. \"octaves with the violoncellos.\\\" It doubles - it plays the bass an octave \"\n       .. \"below whatever instrument carries it. \\\"Its heavy notes are for the good of \"\n       .. \"the community.\\\"\",\n  facts={\n    {\"Strings\",\"E - A - D - G, tuned in fourths (inherited from the viol family)\"},\n    {\"Notation\",\"Bass clef, written an octave above the real sound\"},\n    {\"Numbers\",\"8-10/4-6/2-3 (full/medium/small, RK); 6-8 today\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ \u00e2\u0080\u0099Cellos\",\"Rich and full; the standard low-register combination, and the \"\n        .. \"closest-allied pair in the orchestra.\",\"RK p.40; MOD\"},\n      {\"+ Bassoon\",\"One of the best-matched string/wind pairs in the bass.\",\"RK p.58\"},\n      {\"+ Contrabassoon\",\"For the true bottom of the orchestra.\",\"RK p.58\"},\n      {\"+ Bass clarinet\",\"As above, darker and smoother.\",\"RK p.58\"},\n      {\"+ Trombones / Tuba (with \u00e2\u0080\u0099cellos)\",\"For heavy, massive effects.\",\"RK p.61\"},\n      {\"+ 2 Fag + 3 Trombones + Tuba (with \u00e2\u0080\u0099cellos)\",\"The standard bass grouping of \"\n        .. \"all three groups; the tuba is \\\"eminently useful for doubling, an octave \"\n        .. \"lower, the bass of the group to which it belongs\\\".\",\"RK p.61 & p.24\"},\n      {\"+ \u00e2\u0080\u0099Cellos + D. basses + 1 Bassoon (thickened)\",\"One wind added to the string \"\n        .. \"bass only thickens it; the bassoon timbre is lost.\",\"RK p.34\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"\u00e2\u0080\u0099Cellos / D. basses\",\"The normal bass; the bass part is sometimes simplified.\",\"RK p.42\"},\n      {\"\u00e2\u0080\u0099Cellos + Fag / D. basses\",\"For a sweet, soft low melody - leave the basses \"\n        .. \"undoubled. Sometimes obligatory when no contrabassoon is available.\",\"RK p.60\"},\n      {\"\u00e2\u0080\u0099Cellos + Bass cl / D. basses + C-Fag\",\"Fully reinforced.\",\"RK p.59\"},\n      {\"Violas / \u00e2\u0080\u0099Cellos / D. basses\",\"In double octaves, for the low register and \"\n        .. \"rough, severe phrases.\",\"RK p.44\"},\n    }},\n    {\"Character\", {\n      {\"Verdi and Wagner\",\"Verdi treated it as \\\"a dark, morbid personality, \"\n        .. \"particularly fitted for tragedy\\\" (Otello's entrance into Desdemona's \"\n        .. \"chamber). Stanford praised Die Meistersinger for \\\"the most economical and \"\n        .. \"perfectly proportionate use of that dangerous rogue-elephant, the \"\n        .. \"double-bass\\\".\",\"SIN p.69-70\"},\n      {\"Best notes\",\"Open strings; harmonics are frequent and effective.\",\"SIN p.69\"},\n      {\"Against the voice\",\"Frequent long sustained bass notes are unfavourable to a \"\n        .. \"singer - the combination \\\"produces a peculiar throbbing effect\\\".\",\"RK p.121\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Solo double bass\",\"\\\"Practically unknown\\\"; Rimsky-Korsakov writes no \"\n        .. \"important phrase for it \\\"without the support of 'cellos or bassoons\\\".\",\"RK p.104 & p.38\"},\n      {\"Broad cantabile\",\"Its muffled resonance makes it little capable of broad \"\n        .. \"cantabile except in unison or octaves with the 'cellos.\",\"RK p.38\"},\n      {\"Pizzicato speed\",\"Much slower than on the violins - the thicker the string, \"\n        .. \"the slower the pizzicato.\",\"RK p.27\"},\n    }},\n  },\n  related={\"strings\",\"cello\",\"bassoon\",\"contrabassoon\",\"tuba\",\"bassclarinet\"},\n}\n\ne{ id=\"pizzicato\", name=\"Pizzicato\", family=\"Strings\", kind=\"technique\",\n  aliases={\"pizzicato\",\"pizz\",\"plucked\",\"pizzicati\",\"plucking\"},\n  summary=\"\\\"Although capable of every degree of power from ff to pp, pizzicato \"\n       .. \"playing has but small range of expression, and is used chiefly as a colour \"\n       .. \"effect.\\\" Rimsky-Korsakov classes it with the harp as a separate group of \"\n       .. \"plucked strings.\",\n  sec={\n    {\"Pairings\", {\n      {\"+ Woodwind or brass\",\"Wind strengthens and clarifies pizzicato strings; the \"\n        .. \"black (dry, resonance-less) top notes \\\"should only be used when doubled \"\n        .. \"with the wood-wind\\\".\",\"RK p.34 & p.31\"},\n      {\"+ Percussion\",\"Excellent - \\\"the two blend perfectly, and the consequent \"\n        .. \"increase in resonance yields an admirable effect\\\".\",\"RK p.34\"},\n      {\"+ Harp\",\"The natural partner; together they form the plucked group.\",\"RK p.26\"},\n      {\"+ Bassoons\",\"One of the standard blended pairs - close enough in colour that the combination reads as a single sound.\",\"IDIO ch.12\"},\n      {\"+ same woodwind in octaves\",\"Two of the same woodwind in octaves - normally \"\n        .. \"not recommended - becomes safe when pizzicato (or arco) strings double both \"\n        .. \"members, especially in the middle compass.\",\"RK p.50\"},\n      {\"Sforzando-piano\",\"As the woodwind begins a piano chord, the strings attack it \"\n        .. \"sforzando pizzicato - a compound chord for preference.\",\"RK p.111\"},\n      {\"For a singer\",\"Strings pizzicato + harp \\\"forms a setting eminently favourable \"\n        .. \"for the voice\\\"; complicated figures are better given partly to pizzicato \"\n        .. \"and harp, which have little chance of overpowering it.\",\"RK p.120 & p.122\"},\n    }},\n    {\"Writing it\", {\n      {\"Speed\",\"Never as fast as arco, and slower the thicker the string.\",\"RK p.27\"},\n      {\"Tone\",\"Resonant and heavy on open strings, shorter and duller on stopped \"\n        .. \"strings, dry and hard in high positions.\",\"RK p.27\"},\n      {\"Chords\",\"Avoid open strings, which are more brilliant than covered ones. \"\n        .. \"Four-note chords allow the greatest freedom and vigour of attack.\",\"RK p.27\"},\n      {\"Harmonics pizzicato\",\"\\\"Create a charming effect\\\"; weak in tone, and most \"\n        .. \"successful on the 'cello.\",\"RK p.27\"},\n      {\"Tutti pizzicato\",\"The pizzicato quartet with harp and piano can form its own \"\n        .. \"tutti - medium power, fairly brilliant, and only really strong with \"\n        .. \"woodwind support.\",\"RK p.103\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ Bowed strings\",\"Uniting plucked with bowed strings \\\"does not produce such a \"\n        .. \"satisfactory blend, both qualities being heard independently\\\".\",\"RK p.34\"},\n    }},\n  },\n  related={\"strings\",\"harp\",\"plucked\",\"percussion\"},\n}\n\n-- ============================================================================\n-- WOODWIND\n-- ============================================================================\n\ne{ id=\"flute\", name=\"Flute\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"flute\",\"flutes\",\"fl\",\"concert flute\",\"transverse flute\"},\n  summary=\"\\\"Cold in quality, specially suitable, in the major key, to melodies of \"\n       .. \"light and graceful character; in the minor key, to slight touches of \"\n       .. \"transient sorrow.\\\" With the clarinet, the most flexible of the woodwind, \"\n       .. \"and the only one capable of double tonguing.\",\n  facts={\n    {\"Class\",\"Bright 'chest-voice' quality, with the clarinets\"},\n    {\"Registers\",\"Low: dull, cold.  Very high: brilliant\"},\n    {\"Notes\",\"Non-transposing. No way has been found to mute it\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Oboe\",\"Fuller than the flute alone, sweeter than the oboe alone. Played \"\n        .. \"softly the flute predominates low, the oboe in the upper register.\",\"RK p.47\"},\n      {\"+ Clarinet\",\"Fuller than the flute, duller than the clarinet; flute \"\n        .. \"predominates lower, clarinet higher. In the clarinet's clarino register the \"\n        .. \"two have a particular affinity, and in octaves their combined resonance \"\n        .. \"turns almost organ-like.\",\"RK p.47; MOD\"},\n      {\"+ Oboe + Clarinet\",\"Very full; flute low, oboe middle, clarinet high.\",\"RK p.48\"},\n      {\"+ Violins\",\"One of the best and most natural string/wind combinations.\",\"RK p.58\"},\n      {\"+ Trumpet\",\"One of the trumpet doublings Rimsky-Korsakov lists as fairly \"\n        .. \"numerous, especially in forte; also Trumpet + Cl + Ob + Fl.\",\"RK p.56\"},\n      {\"+ Solo violin\",\"Violin + flute, or 2 solo violins, often suffice to double a \"\n        .. \"melody in the upper register while keeping the solo character.\",\"RK p.105-106\"},\n      {\"2 Flutes\",\"Gains power, keeps its individuality, but loses expressive capacity \"\n        .. \"- as with any pair of like instruments.\",\"RK p.48\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Picc / Fl\",\"Same-branch octaves \\\"always produce a good effect\\\", and this is \"\n        .. \"the standard way to extend the top of the orchestra.\",\"RK p.50\"},\n      {\"Fl / Ob  and  Fl / Cl\",\"The natural resonance order, flute on top.\",\"RK p.49\"},\n      {\"Fl / Alto flute\",\"Same-branch octaves.\",\"RK p.50\"},\n      {\"Picc / Fl / Ob or Cl\",\"Three-octave layouts with the flute in the middle.\",\"RK p.51\"},\n      {\"2 Flutes above a trumpet\",\"To double a trumpet an octave up normally needs \"\n        .. \"three or four wind instruments - \\\"but in the top register two flutes will \"\n        .. \"suffice\\\".\",\"RK p.58\"},\n      {\"2 Fl above 1 Horn\",\"One of the standard woodwind-above-horn octave doublings, \"\n        .. \"used to give the upper octave a richness the trumpet cannot supply.\",\"RK p.57\"},\n      {\"Low flute thirds between trumpet octaves\",\"In soft passages, thirds in the low \"\n        .. \"flutes - sometimes with clarinets - \\\"produce a beautiful mysterious \"\n        .. \"effect\\\" between trumpets an octave apart.\",\"RK p.91\"},\n    }},\n    {\"As an artificial overtone\", {\n      {\"Why it works\",\"The flute's first overtone - the octave - is powerfully \"\n        .. \"present, which gives it a near-sine tone and makes it the ideal instrument \"\n        .. \"for supplying an overtone another instrument lacks.\",\"IDIO ch.12\"},\n      {\"Two octaves above the fundamental\",\"Doubling a clarinet or bassoon two octaves \"\n        .. \"up - the third overtone - goes back to the classical period and Mozart, and \"\n        .. \"\\\"nearly became a trademark for Sibelius\\\". Despite the high register the \"\n        .. \"flute \\\"increases the fullness of sound without becoming overly prominent in \"\n        .. \"itself\\\".\",\"IDIO ch.12\"},\n      {\"An octave above a muted trumpet\",\"The flute supplies the trumpet's artificial \"\n        .. \"first overtone and the pair reads as a gentle oboe. Needs a straight mute: a \"\n        .. \"cup or velvet mute removes the high overtones the effect depends on.\",\n        \"IDIO Parallel Doubling\"},\n      {\"Guard its register\",\"Having few overtones of its own, the flute is masked by \"\n        .. \"the overtones of lower instruments in its middle register, and more easily \"\n        .. \"still at the bottom. Keep the register clear rather than marking it louder.\",\n        \"IDIO ch.12\"},\n    }},\n    {\"Character and use\", {\n      {\"Singleton\",\"\\\"The nightingale, the thrush, the lark, the oriole, the \"\n        .. \"mocking-bird of the Orchestra. It warbles.\\\" Its voice is gentle, ethereal, \"\n        .. \"pure, sweet and soothing - used for poetic and tender sentiment, religious \"\n        .. \"scenes, and to suggest beautiful dreams.\",\"SIN p.73\"},\n      {\"Lavignac\",\"\\\"The ethereal, suave, transparent timbre of the flute, with its \"\n        .. \"placidity and its poetic charm, produces an auditive sensation similar to \"\n        .. \"the visual impression of the color blue, a fine blue, pure and luminous as \"\n        .. \"the azure of the sky.\\\"\",\"SIN p.74\"},\n      {\"With the first violins\",\"\\\"Very often it doubles the first violins in the \"\n        .. \"melody, running along with them smoothly and sweetly.\\\"\",\"SIN p.73\"},\n      {\"Blend bridge\",\"Its lowest register recalls the pianissimo trumpet; string \"\n        .. \"harmonics relate closely to the flute and piccolo, linking strings and \"\n        .. \"woodwind at the top of the orchestra.\",\"RK p.36 & p.35\"},\n      {\"As an echo\",\"\\\"Flutes also may imitate clarinets and oboes successfully.\\\"\",\"RK p.110\"},\n      {\"Modern scoring\",\"\\\"Modern compositions usually call for two flutes and a \"\n        .. \"piccolo.\\\"\",\"SIN p.78\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ Bassoon\",\"\\\"Very seldom found except in certain orchestral tutti\\\" in unison, \"\n        .. \"and rare in octaves because the registers lie so far apart. (Some modern \"\n        .. \"writers find flute and bassoon work better than oboe and bassoon.)\",\"RK p.48-49; MOD\"},\n      {\"2 Flutes in octaves\",\"\\\"Certainly not to be recommended\\\" - the two registers \"\n        .. \"do not correspond. Safe when strings double both parts.\",\"RK p.49-50\"},\n      {\"Below the oboes or bassoons\",\"Placing flutes below oboes and clarinets, and \"\n        .. \"especially below the bassoons, \\\"creates a far-fetched, unnatural tone\\\".\",\"RK p.46\"},\n      {\"Doubling a trombone an octave up\",\"Use trumpets instead.\",\"RK p.58\"},\n    }},\n  },\n  related={\"woodwind\",\"piccolo\",\"altoflute\",\"oboe\",\"clarinet\",\"violin\",\"strings_wind\"},\n}\n\ne{ id=\"piccolo\", name=\"Piccolo\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"piccolo\",\"piccolos\",\"picc\",\"piccolo flute\",\"ottavino\"},\n  summary=\"\\\"The duty of the piccolo and small clarinet is, principally, to extend the \"\n       .. \"range of the ordinary flute and clarinet in the high register.\\\" Its \"\n       .. \"whistling, piercing top compass is extraordinarily powerful but will not \"\n       .. \"take moderate shades of expression; it and the contrabassoon are the two \"\n       .. \"instruments with no \\\"scope of greatest expression\\\" at all.\",\n  facts={\n    {\"Notation\",\"Treble clef, written an octave below the real pitch\"},\n    {\"Range\",\"Over two octaves; almost every player has high B and C\"},\n    {\"Low register\",\"Corresponds to the flute's, but so much weaker as to be of \"\n      .. \"little service\"},\n  },\n  sec={\n    {\"Pairings and doublings\", {\n      {\"Picc / Fl in octaves\",\"The standard extension of the flute upward, and one of \"\n        .. \"the same-branch octave pairs that \\\"always produce a good effect\\\".\",\"RK p.50\"},\n      {\"Picc / Ob  \u00c2\u00b7  Picc / Cl\",\"Double a piccolo line an octave lower with flute, \"\n        .. \"oboe or clarinet - as a rule, always double a melody lying in the extremely \"\n        .. \"high compass an octave below.\",\"RK p.50\"},\n      {\"Picc / E-flat clarinet\",\"The two shrillest instruments in octaves, for \"\n        .. \"deliberately piercing colour.\",\"RK p.50\"},\n      {\"Picc + Vns I (top of a 3-octave melody)\",\"e.g. Vns I + Picc / Vns II + Fl + \"\n        .. \"Ob / Violas + 'Cellos + 2 Cl + Eng horn + Fag.\",\"RK p.59\"},\n      {\"Solo violin + Piccolo\",\"Used to gild a solo line without losing it.\",\"RK p.105-106\"},\n      {\"+ Celesta\",\"A modern pairing: a piccolo melody doubled by celesta gains a \"\n        .. \"bright, chiming edge.\",\"WP\"},\n    }},\n    {\"Character and use\", {\n      {\"Gilt edging\",\"\\\"The piccolo is often used to brighten the upper notes of the \"\n        .. \"other members of the Woodwind Family in all kinds of combinations. This \"\n        .. \"method of using the piccolo might be likened to brightening up an article \"\n        .. \"with gold leaf.\\\"\",\"SIN p.79\"},\n      {\"Berlioz on its proper use\",\"\\\"In pieces of a joyous character, the sounds of \"\n        .. \"the second octave are suitable in all their gradations; while the upper \"\n        .. \"notes are excellent fortissimo for violent and tearing effects: in a storm, \"\n        .. \"for instance, or in a scene of fierce, or infernal, character.\\\"\",\"SIN p.80\"},\n      {\"Berlioz\u00e2\u0080\u0099s warning\",\"He calls it \\\"a stupid method of instrumentation\\\" to use \"\n        .. \"the piccolo to double a baritone line in triple octave, to cast its \"\n        .. \"squeaking voice into religious harmony, or to sharpen the top of the \"\n        .. \"orchestra \\\"for the sake of noise only\\\".\",\"SIN p.81\"},\n      {\"Also usable softly\",\"\\\"The piccolo flute may have a very happy effect in soft \"\n        .. \"passages; and it is mere prejudice to think that it should only be played \"\n        .. \"loud.\\\"\",\"SIN p.81\"},\n      {\"With cymbals\",\"Spontini's discovery: a short piercing piccolo cry joined to a \"\n        .. \"cymbal stroke - \\\"it cuts and rends instantaneously\\\". Augment it with an \"\n        .. \"abrupt timpani stroke and a brief chord from the rest of the orchestra.\",\"SIN p.80\"},\n      {\"Extending the flute invisibly\",\"Used to continue the flute's scale upward so \"\n        .. \"\\\"it may appear that there is only one flute of extraordinary compass\\\".\",\"SIN p.81\"},\n      {\"Indispensable\",\"Now that the orchestral range reaches the high C of the 7th \"\n        .. \"octave, the piccolo \\\"forms an indispensable constituent of the \"\n        .. \"wind-group\\\".\",\"RK p.18\"},\n      {\"Nickname\",\"\\\"The imp, or demon, of the Orchestra, or the flash of lightning, \"\n        .. \"or the darting flame, or the whistling wind.\\\"\",\"SIN p.82\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Its low and middle register\",\"Too weak to be of service - that is what the \"\n        .. \"flute is for.\",\"RK p.18\"},\n      {\"No mute\",\"\\\"It has not yet been discovered how to mute the flutes; such a \"\n        .. \"discovery would render great service to the piccolo.\\\"\",\"RK p.21\"},\n    }},\n  },\n  related={\"flute\",\"woodwind\",\"clarinet_eb\",\"cymbals\",\"celesta\"},\n}\n\ne{ id=\"altoflute\", name=\"Alto Flute (Bass Flute)\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"alto flute\",\"bass flute\",\"altoflute\",\"flute in g\",\"alto fl\"},\n  summary=\"Rimsky-Korsakov's \\\"bass flute\\\" - the alto flute in G. \\\"It possesses the \"\n       .. \"same features as the flute, but it is colder in colour, and crystalline in \"\n       .. \"the middle and high regions.\\\" Seldom used even then, and valued for its own \"\n       .. \"distinctive timbre as much as for extending the flute downward.\",\n  facts={{\"Pitch\",\"In F or G\"}},\n  sec={\n    {\"Pairings and doublings\", {\n      {\"Fl / Alto flute in octaves\",\"A same-branch pair, which \\\"always produce a good \"\n        .. \"effect\\\".\",\"RK p.50\"},\n      {\"Fl + Alto fl / Cl + Bass cl\",\"A mixed low-register octave doubling from Mlada.\",\"RK p.51\"},\n      {\"+ Violins\",\"Listed with flute and piccolo among the good string/wind unison \"\n        .. \"pairs.\",\"RK p.58\"},\n    }},\n    {\"Use\", {\n      {\"Exposed solo\",\"Like the English horn and bass clarinet, it has \\\"its own \"\n        .. \"distinctive peculiarities of timbre\\\" and is often used as a solo \"\n        .. \"instrument, clearly exposed - not merely as an extension.\",\"RK p.20\"},\n      {\"Who plays it\",\"The second or third flute, not the first.\",\"RK p.12\"},\n    }},\n  },\n  related={\"flute\",\"woodwind\",\"piccolo\"},\n}\n\ne{ id=\"oboe\", name=\"Oboe\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"oboe\",\"oboes\",\"ob\",\"hautbois\"},\n  summary=\"\\\"Artless and gay in the major, pathetic and sad in the minor.\\\" First of \"\n       .. \"all a melodic instrument, valued for tone quality rather than brilliant \"\n       .. \"passages. Less mobile than flute and clarinet because of its double reed, \"\n       .. \"but excellent in distinct, penetrating staccato.\",\n  facts={\n    {\"Class\",\"Nasal and dark, with the bassoons\"},\n    {\"Registers\",\"Low: wild, thick and rough.  Very high: hard and dry\"},\n    {\"Notes\",\"Non-transposing. Can be muted - so deadened it reaches an extreme \"\n      .. \"pianissimo, though its lowest notes become impossible\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Flute\",\"Fuller than the flute, sweeter than the oboe; flute predominates \"\n        .. \"low, oboe in the upper register.\",\"RK p.47\"},\n      {\"+ Clarinet\",\"Fuller than either alone. The dark, nasal oboe prevails low, the \"\n        .. \"bright 'chest' clarinet high. Modern writers often warn against this \"\n        .. \"doubling, yet many great works use it - Schubert's Unfinished has a famous \"\n        .. \"unison clarinet-and-oboe melody, and Tchaikovsky scores it freely.\",\"RK p.47; MOD\"},\n      {\"+ Flute + Clarinet\",\"Very full; flute low, oboe middle, clarinet high.\",\"RK p.48\"},\n      {\"+ Violins\",\"One of the best-matched string/wind pairs.\",\"RK p.58\"},\n      {\"+ Violas (or with English horn)\",\"Rimsky-Korsakov's own Violas + Ob + Eng horn.\",\"RK p.58-59\"},\n      {\"+ Trumpet\",\"One of the frequent trumpet doublings; at soft dynamics oboes and \"\n        .. \"trumpets are a standard blended pair.\",\"RK p.56; IDIO ch.12\"},\n      {\"+ stopped or muted Horns / Trumpets\",\"Stopped brass approaches the oboe and \"\n        .. \"English horn in quality, so \\\"the combination of these instruments produces \"\n        .. \"a magnificent tone\\\".\",\"RK p.89\"},\n      {\"+ 1 Ob + 1 Cl instead of a trumpet\",\"When a fanfare figure lies too high for \"\n        .. \"the trumpets, oboes and clarinets in unison are the closest substitute \\\"both \"\n        .. \"in character and power\\\".\",\"RK p.98\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Ob / Eng horn\",\"Same-branch octaves; \\\"always produce a good effect\\\".\",\"RK p.50\"},\n      {\"Fl / Ob\",\"Natural order, flute above.\",\"RK p.49\"},\n      {\"Ob / Cl  \u00c2\u00b7  Ob / Fag\",\"Natural order, oboe above.\",\"RK p.49\"},\n      {\"Picc / Ob\",\"Doubling an extreme high line an octave below.\",\"RK p.50\"},\n      {\"2 Ob above 1 Horn\",\"One of the standard woodwind-above-horn octave doublings.\",\"RK p.57\"},\n    }},\n    {\"Thirds and sixths\", {\n      {\"2 Oboes in thirds\",\"For thirds, one colour in both parts gives the best \"\n        .. \"equality of tone.\",\"RK p.52\"},\n      {\"Ob / Cl  \u00c2\u00b7  Ob / Fag  \u00c2\u00b7  Fl / Ob in sixths\",\"Different colours suit sixths, \"\n        .. \"kept in natural register order.\",\"RK p.52\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"The timbre is thin and nasal, very piercing in its forte \"\n        .. \"passages, of exquisite refinement in its piano passages; harsh and of bad \"\n        .. \"quality in its very high and very low notes. The oboe is artless and rustic \"\n        .. \"in its expression; it is pastoral and melancholy... its natural tone is of \"\n        .. \"a gentle sadness and a resigned endurance.\\\"\",\"SIN p.85\"},\n      {\"Berlioz\",\"\\\"Candor, artless grace, soft joy, or the grief of a fragile being \"\n        .. \"suits the oboe's accents.\\\" But \\\"care should be taken not to urge it into \"\n        .. \"utterance of passion - a rash outburst of anger, threat, or even heroism; \"\n        .. \"for then its small acid-sweet voice becomes uneffectual and absolutely \"\n        .. \"grotesque.\\\"\",\"SIN p.86-87\"},\n      {\"Breathing\",\"The player must take the lips off the reed to exhale, so long \"\n        .. \"sustained passages need pauses - the difficulty is refilling the lungs, not \"\n        .. \"the air supply.\",\"SIN p.88\"},\n    }},\n    {\"Register \u00e2\u0080\u0094 against the intuition\", {\n      {\"Low is the penetrating end\",\"\\\"A low oboe is far more penetrating than the same \"\n        .. \"instrument in its highest register.\\\" If you want the oboe to cut through, \"\n        .. \"the bottom of its range does it, not the top.\",\"IDIO Dynamics and Balance\"},\n      {\"Why\",\"Formants - strong high-pitched peaks in its spectrum - which also make it \"\n        .. \"one of the sharpest sounds in the orchestra. See Overtones, Formants and \"\n        .. \"Penetration.\",\"IDIO ch.12\"},\n      {\"Little room to fade\",\"A low oboe \\\"has very limited room for diminuendo\\\", \"\n        .. \"unlike a string instrument or a low clarinet, which have almost none. Check \"\n        .. \"any chord you have marked to die away.\",\"IDIO Chords\"},\n      {\"The soft alternative\",\"Where the oboe's intensity is too much, the oboe d'amore \"\n        .. \"has fewer high, penetrating overtones - Ravel's choice in Bolero precisely \"\n        .. \"to avoid the oboe's intense solo sound.\",\"IDIO Parallel Doubling\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ Bassoon\",\"\\\"Very seldom found except in certain orchestral tutti\\\", where it \"\n        .. \"adds resonance without a fresh colour.\",\"RK p.48\"},\n      {\"Discords on like instruments\",\"With its penetrating tone, the rule against \"\n        .. \"giving fifths, fourths, seconds and sevenths to instruments of the same \"\n        .. \"colour \\\"should be specially observed in writing for the oboe\\\".\",\"RK p.72\"},\n      {\"Oboe in the high register within a chord\",\"Enclosing parts can leave the oboe \"\n        .. \"\\\"too piercing\\\" - check the register of every isolated chord.\",\"RK p.73\"},\n    }},\n\n    {\"In a woodwind chord\", {\n      {\"It decides the blend\",\"\\\"When writing for massed woodwinds, the oboe is the \"\n        .. \"instrument most likely to hurt the overall blend. It will definitively color \"\n        .. \"any combination, for better or for worse.\\\" The same chord scored with oboes \"\n        .. \"is \\\"considerably more pungent\\\" - which may be exactly what you \"\n        .. \"want.\",\"BEL p.8\"},\n      {\"Watch a dissonant interval in the oboe\",\"In Belkin's comparison of woodwind \"\n        .. \"chord layouts, the worst are those where \\\"the oboe's dissonant 4th sticks \"\n        .. \"out\\\".\",\"BEL p.8\"},\n      {\"After heavy brass it will sound thin\",\"A consequence of successive balance: \"\n        .. \"\\\"after a loud, full brass passage, an oboe will sound thinner than usual, by \"\n        .. \"contrast\\\".\",\"BEL p.36\"},\n    }},\n  },\n  related={\"woodwind\",\"englishhorn\",\"flute\",\"clarinet\",\"bassoon\",\"trumpet\",\"violin\"},\n}\n\ne{ id=\"englishhorn\", name=\"English Horn (Cor Anglais)\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"english horn\",\"cor anglais\",\"englishhorn\",\"eng horn\",\"eh\",\"alto oboe\",\n           \"cor anglais (english horn)\",\"corno inglese\"},\n  summary=\"The alto oboe, in F. \\\"Similar in tone to the ordinary oboe, the listless, \"\n       .. \"dreamy quality of its timbre being sweet in the extreme. In the low register \"\n       .. \"it is fairly penetrating.\\\" Called \\\"an oboe in mourning\\\".\",\n  facts={\n    {\"Transposition\",\"In F - written a fifth above the real sounds\"},\n    {\"Played by\",\"The second or third oboist; any good oboist can play it, the \"\n      .. \"technique being practically the same\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Violas\",\"A best-matched string/wind pair; also Violas + Ob + Eng horn, and \"\n        .. \"Violas + Ob + Eng horn in Sheherazade.\",\"RK p.58-59\"},\n      {\"+ \u00e2\u0080\u0099Cellos and/or Violins\",\"Rimsky-Korsakov's recurring recipe: 'Cellos + Violas \"\n        .. \"+ Eng horn, and Vns I + II + 'Cellos + Eng horn - the English horn is \"\n        .. \"absorbed into the texture while the 'cellos stand out.\",\"RK p.39-40 & p.58-59\"},\n      {\"+ Trombone\",\"Listed among the brass/reed unison combinations that share the \"\n        .. \"brass doubling characteristics.\",\"RK p.57\"},\n      {\"+ stopped or muted Horns / Trumpets\",\"Stopped brass approaches the English \"\n        .. \"horn's quality; 2 Ob + Eng horn + 3 muted trumpets is one of his own \"\n        .. \"combinations.\",\"RK p.89\"},\n      {\"+ Clarinets and Bassoon\",\"Eng horn + 2 Cl + Fag, and Eng horn + 2 Cl + Bass cl \"\n        .. \"+ Fag, as harmonic basis.\",\"RK p.80-81\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Ob / Eng horn\",\"Same-branch octaves; always effective.\",\"RK p.50\"},\n      {\"Fl / Eng horn\",\"Used repeatedly in Snegourotchka and Sadko.\",\"RK p.49\"},\n      {\"Cl + Ob / Cl + Eng horn\",\"A mixed-timbre octave doubling.\",\"RK p.50-51\"},\n      {\"2 Ob + Eng horn / 3 stopped Horns\",\"A striking octave pairing of reeds with \"\n        .. \"stopped brass.\",\"RK p.93\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"Its tone is essentially sad, melancholy, sorrowful. The cor \"\n        .. \"anglais exactly suits the expression of mental suffering.\\\"\",\"SIN p.89\"},\n      {\"Berlioz\",\"\\\"A melancholy, dreamy, and rather noble voice, of which the \"\n        .. \"sonorousness has something vague and remote about it which renders it \"\n        .. \"superior to all others in exciting regret and reviving images and \"\n        .. \"sentiments of the past.\\\" Where melancholy prevails, \\\"the frequent use of \"\n        .. \"the cor anglais hidden in the midst of the great mass of instruments is \"\n        .. \"perfectly suited\\\".\",\"SIN p.89\"},\n      {\"Its limits\",\"Berlioz: less able than the oboe to give rustic gaiety, and \"\n        .. \"\\\"accents of keen grief are almost beyond its powers\\\".\",\"SIN p.89\"},\n      {\"With a voice\",\"A solo English horn accompanying a contralto is one of \"\n        .. \"Rimsky-Korsakov's named pairings for characterisation.\",\"RK p.124\"},\n      {\"The famous solo\",\"Act III of Tristan und Isolde - the shepherd's long sad \"\n        .. \"melody given to \\\"the saddest voice in the orchestra\\\".\",\"SIN p.90\"},\n    }},\n  },\n  related={\"oboe\",\"woodwind\",\"viola\",\"cello\",\"horn\",\"bassclarinet\"},\n}\n\ne{ id=\"clarinet\", name=\"Clarinet\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"clarinet\",\"clarinets\",\"cl\",\"clarinette\",\"klarinette\",\"b flat clarinet\",\n           \"a clarinet\"},\n  summary=\"\\\"Pliable and expressive, suitable, in the major, to melodies of a joyful \"\n       .. \"or contemplative character, or to outbursts of mirth; in the minor, to sad \"\n       .. \"and reflective melodies or impassioned and dramatic passages.\\\" For \"\n       .. \"expressive power and subtlety of nuance it surpasses even the flute - \\\"this \"\n       .. \"instrument can reduce volume of tone to a mere breath\\\".\",\n  facts={\n    {\"Class\",\"Bright 'chest-voice' quality, with the flutes\"},\n    {\"Registers\",\"Four, clearly defined: chalumeau (deepest), medium (warm and \"\n      .. \"expressive), high (brilliant and energetic), very high (biting and strident)\"},\n    {\"Transposition\",\"In B-flat or A\"},\n    {\"Mute\",\"Unnecessary - \\\"they can play quite softly enough without artificial means\\\"\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Bassoon\",\"Very full. The clarinet's gloom prevails in the lower register, \"\n        .. \"the bassoon's thinner quality higher.\",\"RK p.48\"},\n      {\"+ Flute\",\"Fuller than the flute, duller than the clarinet. In the clarino \"\n        .. \"register the two have a special affinity, and their combined resonance in \"\n        .. \"octaves turns almost organ-like.\",\"RK p.47; MOD\"},\n      {\"+ Oboe\",\"Fuller than either alone; oboe prevails low, clarinet high. Often \"\n        .. \"warned against in modern teaching, but used by Schubert (the Unfinished) and \"\n        .. \"freely by Tchaikovsky - and clarinets \\\"interlock quite well with \"\n        .. \"middle-register oboes\\\".\",\"RK p.47; MOD\"},\n      {\"+ Flute + Oboe\",\"Very full; clarinet on top of the register scheme.\",\"RK p.48\"},\n      {\"+ Violins\",\"One of the best-matched string/wind pairs; also with the E-flat \"\n        .. \"clarinet.\",\"RK p.58\"},\n      {\"+ Violas\",\"Especially the clarinet's low register - the viola's timbre is \"\n        .. \"comparable to the clarinet's lowest compass, making this a standard blended \"\n        .. \"doubling in modern practice too.\",\"RK p.58 & p.35-36; IDIO ch.12\"},\n      {\"+ \u00e2\u0080\u0099Cellos\",\"With bass clarinet as the darker alternative.\",\"RK p.58\"},\n      {\"+ Trumpet\",\"\\\"The trumpet is the instrument most frequently doubled\\\", and \"\n        .. \"Trumpet + Cl heads Rimsky-Korsakov's list; also Trumpet + Cl + Ob + Fl.\",\"RK p.56\"},\n      {\"+ Horn\",\"Horn + Cl is the commonest horn/woodwind doubling; also 2 or 3 Horns \"\n        .. \"+ the same number of clarinets as a chord block.\",\"RK p.57 & p.88\"},\n      {\"+ stopped Horns (low clarinet notes)\",\"\\\"A beautiful dark tone is derived from \"\n        .. \"the combination of middle notes in stopped horns and deep notes in the \"\n        .. \"clarinet.\\\" Substituting bassoons loses part of the character.\",\"RK p.89\"},\n      {\"+ 1 Ob + 1 Cl instead of a trumpet\",\"When a fanfare lies too high for the \"\n        .. \"trumpets, oboes and clarinets in unison come closest in character and power.\",\"RK p.98\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Cl / Bass clarinet\",\"Same-branch octaves; \\\"always produce a good effect\\\".\",\"RK p.50\"},\n      {\"E-flat clarinet / Cl\",\"As above, upward.\",\"RK p.50\"},\n      {\"Fl / Cl  \u00c2\u00b7  Ob / Cl\",\"Natural order, clarinet below.\",\"RK p.49\"},\n      {\"Cl / Fag\",\"Natural order, clarinet above - a very common pairing.\",\"RK p.49\"},\n      {\"Cl / Bass cl / C-Fag\",\"Three-octave low doubling.\",\"RK p.51\"},\n      {\"Cl / Fag  or  Cl / Bass cl\",\"To double an extreme low line an octave higher.\",\"RK p.50\"},\n      {\"2 Cl above 1 Horn\",\"One of the standard woodwind-above-horn octave doublings; \"\n        .. \"2 Fl + 2 Cl above 2 Horns for forte.\",\"RK p.57\"},\n      {\"2 Cl / \u00e2\u0080\u0099Cellos + 2 Horns\",\"A mixed octave doubling from Sheherazade.\",\"RK p.60\"},\n    }},\n    {\"Thirds and sixths\", {\n      {\"2 Clarinets in thirds\",\"One colour gives the best equality of tone in thirds.\",\"RK p.52\"},\n      {\"Cl / Fag in sixths\",\"Different colours suit sixths, in natural register order.\",\"RK p.52\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"One of the most beautiful voices in the orchestra... the richest \"\n        .. \"in varied timbres of all the wind instruments. Almost as agile as the flute, \"\n        .. \"as tender as, and more passionate than, the oboe, the clarinet is infinitely \"\n        .. \"more energetic and richer in color.\\\"\",\"SIN p.96-97\"},\n      {\"Berlioz\",\"\\\"It is an epic instrument, like horns, trumpets and trombones. The \"\n        .. \"voice is like that of heroic love.\\\" And: \\\"It is the one of all the wind \"\n        .. \"instruments which can best breathe forth, swell, diminish and die away. \"\n        .. \"Thence the precious faculty of producing distance, echo, the echo of echo, \"\n        .. \"and a twilight sound.\\\"\",\"SIN p.99-100\"},\n      {\"Diminuendo specialist\",\"\\\"Clarinets specialise in diminuendo effects and are \"\n        .. \"capable of decreasing their tone to a breath (morendo).\\\"\",\"RK p.112\"},\n      {\"Low register\",\"Ringing and threatening; Weber was the first \\\"to discover all \"\n        .. \"that there is of the terrible in the quality of tone of these low sounds\\\".\",\"RK p.17; SIN p.100\"},\n      {\"With a voice\",\"Listed among the solo instruments that accompany a cantabile \"\n        .. \"aria beautifully.\",\"RK p.124\"},\n    }},\n    {\"High clarinets in unison\", {\n      {\"The effect\",\"Two or more clarinets in the high or highest register in perfect \"\n        .. \"unison give a \\\"very characteristic, stridently penetrating sound\\\" - a \"\n        .. \"reminder that etymologically clarinet means \\\"little trumpet\\\". Mahler, \"\n        .. \"Stravinsky and Debussy all use it, and it is \\\"very impressive when used \"\n        .. \"with clear intent\\\".\",\"IDIO ch.12\"},\n      {\"The opposite end of the same instrument\",\"The weak middle-register \\\"filling \"\n        .. \"in\\\" notes have so few overtones that they blend into anything - which is \"\n        .. \"what makes them useful for mixture. Same instrument, opposite job.\",\n        \"IDIO ch.12\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Octave leaps\",\"\\\"On account of its construction the clarinet is not well \"\n        .. \"adapted to sudden leaps from one octave to another.\\\"\",\"RK p.20\"},\n      {\"In a 4-way tutti mix\",\"In Bassoon + Clarinet + Oboe + Flute the clarinet, weak \"\n        .. \"in the middle compass, \\\"will not stand out prominently\\\".\",\"RK p.48\"},\n      {\"2 Clarinets in octaves\",\"\\\"Certainly not to be recommended\\\" unless strings \"\n        .. \"double both parts.\",\"RK p.49-50\"},\n      {\"Inside the horns\",\"\\\"On account of their tone quality\\\" clarinets should rarely \"\n        .. \"be set inside a horn chord - though in the upper register they may complete \"\n        .. \"one as well as oboes or flutes.\",\"RK p.92\"},\n      {\"Doubling for a singer\",\"Two clarinets in unison forming one harmonic part is \"\n        .. \"among the combinations to avoid when accompanying a voice.\",\"RK p.121\"},\n    }},\n  },\n  related={\"woodwind\",\"bassclarinet\",\"clarinet_eb\",\"flute\",\"oboe\",\"bassoon\",\"horn\",\"viola\"},\n}\n\ne{ id=\"clarinet_eb\", name=\"E-flat Clarinet (Small Clarinet)\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"e flat clarinet\",\"eb clarinet\",\"small clarinet\",\"piccolo clarinet\",\n           \"d clarinet\",\"sopranino clarinet\",\"clarinet_eb\"},\n  summary=\"Extends the clarinet upward. \\\"The small clarinet in its highest register is \"\n       .. \"more penetrating than the ordinary clarinet.\\\" Rarely employed, and only for \"\n       .. \"colour effects.\",\n  facts={{\"Transposition\",\"In E-flat or D\"}},\n  sec={\n    {\"Pairings and doublings\", {\n      {\"E-flat cl / Cl in octaves\",\"Same-branch octaves; always good.\",\"RK p.50\"},\n      {\"Picc / E-flat cl in octaves\",\"The two most piercing instruments together, for \"\n        .. \"deliberately shrill colour.\",\"RK p.50\"},\n      {\"+ Violins\",\"Listed with the clarinet among good string/wind unison pairs.\",\"RK p.58\"},\n      {\"+ 2 Vns + Flute\",\"In The Christmas Night, 2 Vns + Fl + small Cl doubling a solo \"\n        .. \"line.\",\"RK p.105\"},\n    }},\n    {\"Use\", {\n      {\"Rare by design\",\"\\\"The small clarinet is rarely employed and only for colour \"\n        .. \"effects.\\\" Its low and middle range is much weaker than the ordinary \"\n        .. \"clarinet's and of little service.\",\"RK p.18\"},\n      {\"Who plays it\",\"The second clarinet.\",\"RK p.12\"},\n      {\"On stage\",\"One of the instruments Rimsky-Korsakov specifies for the wings - \"\n        .. \"small clarinets and piccolos in Mlada; Serov used the E-flat clarinet to \"\n        .. \"imitate a fife in a carnival procession.\",\"RK p.130-131\"},\n    }},\n  },\n  related={\"clarinet\",\"woodwind\",\"piccolo\"},\n}\n\ne{ id=\"bassclarinet\", name=\"Bass Clarinet\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"bass clarinet\",\"bassclarinet\",\"bass cl\",\"bcl\",\"contrabass clarinet\",\n           \"pedal clarinet\"},\n  summary=\"\\\"Though strongly resembling the ordinary clarinet, it is of darker colour \"\n       .. \"in the low register and lacks the silvery quality in the upper notes; it is \"\n       .. \"incapable of joyful expression.\\\" Like the English horn and alto flute, it \"\n       .. \"has its own distinctive timbre and is often used as an exposed solo.\",\n  facts={\n    {\"Transposition\",\"In B-flat or A\"},\n    {\"Played by\",\"The second or third clarinet (a dedicated fourth player when the \"\n      .. \"wind is in fours)\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ \u00e2\u0080\u0099Cellos\",\"One of the best-matched string/wind pairs in the low register.\",\"RK p.58\"},\n      {\"+ D. basses\",\"For the bottom of the orchestra, with bassoon and contrabassoon.\",\"RK p.58\"},\n      {\"+ 3 Trombones\",\"One of Rimsky-Korsakov's own low-brass/reed combinations \"\n        .. \"(Mlada); also Trombone + Bass cl.\",\"RK p.57\"},\n      {\"+ Horn\",\"Bass cl + Horn / D. basses + C-Fag + Tuba in Ivan the Terrible.\",\"RK p.62\"},\n      {\"+ Clarinets (harmony)\",\"2 Cl + Bass cl is a recurring three-part harmonic \"\n        .. \"basis; also Cl + Bass cl + Fag + C-Fag.\",\"RK p.80-81\"},\n      {\"+ solo \u00e2\u0080\u0099cello\",\"'Cello + Bass cl as a doubled solo line, and Bass cl + C-Fag \"\n        .. \"doubling a solo double bass.\",\"RK p.105\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Cl / Bass clarinet\",\"Same-branch octaves; always good.\",\"RK p.50\"},\n      {\"Bass cl / Fag  \u00c2\u00b7  Cl / Bass cl\",\"To double an extremely low line an octave \"\n        .. \"higher.\",\"RK p.50\"},\n      {\"2 Cl / Bass cl / C-Fag\",\"A three-octave low doubling from Kitesh.\",\"RK p.51\"},\n      {\"Fl + Alto fl / Cl + Bass cl\",\"Mixed-timbre octaves in the low register.\",\"RK p.51\"},\n      {\"Trombone + Bass cl / Tuba + C-Fag\",\"Mixed wood-and-brass octaves.\",\"RK p.58\"},\n    }},\n    {\"Use\", {\n      {\"Widely-divided three-part harmony\",\"Three instruments of one timbre sound \"\n        .. \"inferior in widely-divided three-part harmony - unless the third is a \"\n        .. \"low-register instrument such as the bass clarinet, alto flute, English horn \"\n        .. \"or contrabassoon, when \\\"the resonance will be satisfactory\\\".\",\"RK p.75-76\"},\n      {\"With a voice\",\"Among the solo instruments listed for accompanying a cantabile \"\n        .. \"aria; Rimsky-Korsakov pairs a baritone with bass clarinet.\",\"RK p.124\"},\n      {\"Modern users\",\"\\\"Wagner uses it a great deal\\\"; conspicuous in the Danse de la \"\n        .. \"Fee Dragee of Tchaikovsky's Nutcracker and in Strauss's Don Quixote.\",\"SIN p.101\"},\n      {\"Its double\",\"\\\"The bass-clarinet is doubled by the contrabass clarinet\\\", an \"\n        .. \"octave below - a rival to the contrabassoon.\",\"SIN p.101-102\"},\n    }},\n  },\n  related={\"clarinet\",\"woodwind\",\"bassoon\",\"contrabassoon\",\"cello\",\"doublebass\",\"trombone\"},\n}\n\ne{ id=\"bassoon\", name=\"Bassoon\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"bassoon\",\"bassoons\",\"fagotto\",\"fagott\",\"fag\",\"bsn\",\"bn\"},\n  summary=\"\\\"In the major, an atmosphere of senile mockery; a sad, ailing quality in \"\n       .. \"the minor.\\\" The bass of the oboe group, and - with the horn - one of the two \"\n       .. \"instruments that reconcile the woodwind and brass. Increasingly used as a \"\n       .. \"tenor or even alto voice, doubling the high 'cello or the low viola.\",\n  facts={\n    {\"Class\",\"Nasal and dark, with the oboes\"},\n    {\"Registers\",\"Low: sinister, \\\"solemn and pontifical, like an organ pedal\\\".  \"\n      .. \"Very high: tense, the sweet \\\"vox humana notes\\\"\"},\n    {\"Notes\",\"Non-transposing; bass and tenor clefs. Can be muted, though its lowest \"\n      .. \"notes then become impossible\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Clarinet\",\"Very full. The clarinet's gloom prevails low, the bassoon's \"\n        .. \"thinner quality higher. The one woodwind pairing with the bassoon that \"\n        .. \"Rimsky-Korsakov recommends outright.\",\"RK p.48\"},\n      {\"+ \u00e2\u0080\u0099Cellos\",\"One of the best-matched string/wind pairs; bassoons added to 'cello \"\n        .. \"and bass parts clarify and reinforce them.\",\"RK p.58; MOD\"},\n      {\"+ Violas\",\"The viola's timbre is comparable to the bassoon's middle register; \"\n        .. \"Tchaikovsky's Marche Slave uses the two together \\\"very effectively\\\".\",\"RK p.58 & p.35-36; SIN p.97\"},\n      {\"+ D. basses\",\"With contrabassoon and bass clarinet, the bass reinforcement.\",\"RK p.58\"},\n      {\"+ Horn\",\"Horn + Fag - the bridge doubling. \\\"The middle notes resemble those of \"\n        .. \"the bassoon and the two instruments blend well together.\\\" In the middle \"\n        .. \"register this gives a slimmer, more focused horn sound.\",\"RK p.57 & p.24; IDIO ch.12\"},\n      {\"+ Trombone or Tuba\",\"Trombone + Fag and Tuba + Fag; the bassoon is also the \"\n        .. \"usual instrument for doubling a brass bass in octaves, in place of the \"\n        .. \"too-resonant trombone or tuba.\",\"RK p.57 & p.82\"},\n      {\"+ 2 Fag + 3 Trombones + Tuba + \u00e2\u0080\u0099Cellos/D. basses\",\"The standard bass grouping \"\n        .. \"of all three orchestral groups.\",\"RK p.61\"},\n      {\"+ string pizzicato\",\"One of the standard blended pairs - close enough in colour that the combination reads as a single sound.\",\"IDIO ch.12\"},\n      {\"+ \u00e2\u0080\u0099Cellos + D. basses (thickened)\",\"One bassoon added to the string bass only \"\n        .. \"thickens it; the bassoon timbre is lost.\",\"RK p.34\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Fag / Contrabassoon\",\"Same-branch octaves; always good.\",\"RK p.50\"},\n      {\"Ob / Fag  \u00c2\u00b7  Cl / Fag\",\"Natural order, bassoon below - very common.\",\"RK p.49\"},\n      {\"Fag / C-Fag  \u00c2\u00b7  Bass cl / Fag  \u00c2\u00b7  Cl / Fag\",\"To double an extremely low line an \"\n        .. \"octave higher.\",\"RK p.50\"},\n      {\"\u00e2\u0080\u0099Cellos + Fag / D. basses\",\"For a sweet, soft low melody, the basses undoubled.\",\"RK p.60\"},\n      {\"Violas + Fag / \u00e2\u0080\u0099Cellos + Fag / D. basses\",\"A three-octave low scheme from Tsar \"\n        .. \"Saltan.\",\"RK p.60\"},\n    }},\n    {\"In harmony \u00e2\u0080\u0094 the bridge\", {\n      {\"2 Bassoons + 2 Horns\",\"\\\"The bassoon and horn are the two instruments best \"\n        .. \"capable of reconciling the groups of wood-wind and brass.\\\" Four-part \"\n        .. \"harmony on this quartet yields a finely balanced tone recalling a horn \"\n        .. \"quartet but slightly more transparent - in soft passages.\",\"RK p.90\"},\n      {\"Cross the parts\",\"Give the concords to the horns and the discords to the \"\n        .. \"bassoons. Bassoons may be written inside the horns, but not the reverse.\",\"RK p.90-91\"},\n      {\"Doubling the brass bass\",\"When a brass chord's bass needs doubling in octaves, \"\n        .. \"the duplication \\\"is effected by the bassoon\\\" rather than by trombone or \"\n        .. \"tuba.\",\"RK p.82\"},\n      {\"2 Fag as the bass\",\"A frequent role in mixed-timbre woodwind chords.\",\"RK p.80\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"Its lowest tones are solemn and pontifical, like an organ pedal. \"\n        .. \"Its medium register has a sweet sonority of some richness but little \"\n        .. \"strength; and its high register has the most expression, but is painful, \"\n        .. \"distressed and dejected. At the same time this instrument has comic \"\n        .. \"possibilities.\\\"\",\"SIN p.95\"},\n      {\"As tenor\",\"\\\"It has gradually risen to the position of a tenor, or even alto, \"\n        .. \"frequently doubling the high notes of the violoncello, or the lower register \"\n        .. \"of the viola\\\" - the extreme high notes are the \\\"vox humana notes\\\" (Stone).\",\"SIN p.95-96\"},\n      {\"Comic and rustic\",\"Mendelssohn's two bassoons lead the Clown's March in thirds \"\n        .. \"in the Midsummer Night's Dream music, and imitate a small country band with \"\n        .. \"clarinet in the Funeral March.\",\"SIN p.97\"},\n      {\"Staccato\",\"With the oboe, best suited to distinct and penetrating staccato.\",\"RK p.19\"},\n      {\"With a voice\",\"Listed among the solo instruments that accompany a cantabile \"\n        .. \"aria; bassoons also double men's voices well.\",\"RK p.124 & p.122\"},\n    }},\n    {\"Berlioz on writing the parts\", {\n      {\"Four bassoons, three parts\",\"Bassoons are normally written in two parts, but a \"\n        .. \"large orchestra has four. Berlioz's preference is not four real parts but \"\n        .. \"three, with the lowest doubled an octave below, which puts the extra weight \"\n        .. \"where it does most good - on the bass line.\",\"BERL The bassoon\"},\n      {\"The top of the range has a character\",\"He describes the upper notes as pained, \"\n        .. \"suffering, close to pitiful - and says that is exactly why they work in a \"\n        .. \"slow melody or an accompanying figure, used deliberately.\",\"BERL The bassoon\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ Oboe or Flute in unison\",\"\\\"Very seldom found except in certain orchestral \"\n        .. \"tutti\\\", where they produce increased resonance \\\"without creating a fresh \"\n        .. \"atmosphere\\\". The same applies to Fag+Cl+Ob and Fag+Cl+Fl, and all four \"\n        .. \"together is \\\"equally rare\\\".\",\"RK p.48\"},\n      {\"Flute + Bassoon in octaves\",\"Rare - the registers lie too far apart.\",\"RK p.49\"},\n      {\"Above the clarinets or oboes\",\"Placing bassoons above clarinets and oboes \"\n        .. \"inverts the natural order and \\\"creates an unnatural resonance occasioned by \"\n        .. \"the confusion of registers\\\".\",\"RK p.49 & p.46\"},\n      {\"2 Bassoons in octaves\",\"Not recommended unless strings double both parts.\",\"RK p.49-50\"},\n      {\"Against 4 forte horns\",\"In forte the horns overwhelm the bassoons - \\\"it is \"\n        .. \"wiser to employ four horns alone\\\".\",\"RK p.90\"},\n      {\"Substituted for clarinet under stopped horns\",\"Loses part of the character of \"\n        .. \"that dark combination.\",\"RK p.89\"},\n    }},\n  },\n  related={\"woodwind\",\"contrabassoon\",\"oboe\",\"clarinet\",\"horn\",\"cello\",\"doublebass\",\"wind_brass\"},\n}\n\ne{ id=\"contrabassoon\", name=\"Contrabassoon\", family=\"Woodwind\", kind=\"instrument\",\n  aliases={\"contrabassoon\",\"contra bassoon\",\"double bassoon\",\"double-bassoon\",\"c-fag\",\n           \"contrafagotto\",\"cbn\",\"contra\"},\n  summary=\"Extends the bassoon downward an octave. \\\"The very deep notes of the double \"\n       .. \"bassoon are remarkably thick and dense in quality, very powerful in piano \"\n       .. \"passages.\\\" With the piccolo, it is one of the two instruments that have no \"\n       .. \"\\\"scope of greatest expression\\\" - highly coloured, but not expressive.\",\n  facts={\n    {\"Notation\",\"Written an octave higher than it sounds\"},\n    {\"Reach\",\"Down to the 16-foot C\"},\n  },\n  sec={\n    {\"Pairings and doublings\", {\n      {\"Fag / C-Fag in octaves\",\"Same-branch octaves; always good, and the standard way \"\n        .. \"to extend the bassoon down.\",\"RK p.50\"},\n      {\"+ D. basses\",\"\\\"Like the double bass and double bassoon, the tuba is eminently \"\n        .. \"useful for doubling, an octave lower, the bass of the group to which it \"\n        .. \"belongs\\\" - the contrabassoon does the same job for the woodwind.\",\"RK p.58 & p.24\"},\n      {\"\u00e2\u0080\u0099Cellos + Bass cl / D. basses + C-Fag\",\"A fully reinforced low octave.\",\"RK p.59\"},\n      {\"+ Tuba (+ D. basses)\",\"Tuba + C-Fag / D. basses in Ivan the Terrible.\",\"RK p.62\"},\n      {\"Doubled an octave up\",\"By bassoon, clarinet or bass clarinet - always double a \"\n        .. \"melody lying in the extreme low compass an octave higher.\",\"RK p.50\"},\n      {\"+ solo double bass\",\"The contrabassoon doubling a double-bass solo is one of \"\n        .. \"the rare ways to give that instrument a line.\",\"RK p.38 & p.105\"},\n      {\"In widely-divided three-part harmony\",\"As the low member of three instruments \"\n        .. \"of one timbre, it makes the resonance satisfactory where it would otherwise \"\n        .. \"be poor.\",\"RK p.75-76\"},\n    }},\n    {\"Use\", {\n      {\"Its middle and top\",\"\\\"By no means so useful\\\" as the low register - use it for \"\n        .. \"the bottom.\",\"RK p.18\"},\n      {\"Historically\",\"Neglected after Beethoven's death, it reappeared towards the end \"\n        .. \"of the 19th century and is \\\"capable of supplying valuable assistance\\\".\",\"RK p.18\"},\n    }},\n  },\n  related={\"bassoon\",\"woodwind\",\"doublebass\",\"tuba\",\"bassclarinet\"},\n}\n\n-- ============================================================================\n-- BRASS\n-- ============================================================================\n\ne{ id=\"horn\", name=\"Horn\", family=\"Brass\", kind=\"instrument\",\n  aliases={\"horn\",\"horns\",\"french horn\",\"french horns\",\"hn\",\"hns\",\"cor\",\"waldhorn\",\n           \"corno\",\"f horn\"},\n  summary=\"\\\"The tone of this instrument is soft, poetical, and full of beauty. In the \"\n       .. \"lower register it is dark and brilliant; round and full in the upper. The \"\n       .. \"middle notes resemble those of the bassoon and the two instruments blend well \"\n       .. \"together. The horn, therefore, serves as a link between the brass and \"\n       .. \"wood-wind.\\\" It doubles with almost anything.\",\n  facts={\n    {\"Transposition\",\"In F\"},\n    {\"Strength\",\"Half as strong as trumpet, trombone or tuba in forte; equal to them \"\n      .. \"in piano. Two horns balance one trumpet or trombone\"},\n    {\"Marking\",\"Mark the horns one degree louder than the rest of the brass\"},\n    {\"Four-part convention\",\"Horns 1 and 3 take the high parts, 2 and 4 the low; 1 the \"\n      .. \"highest, 4 the lowest\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"4 Horns\",\"Frequently met with; the standard way to give the group melodic \"\n        .. \"weight. Also 4 Horns + 2 Trumpets, and 6 Horns in Mlada.\",\"RK p.55\"},\n      {\"+ \u00e2\u0080\u0099Cellos\",\"\\\"Frequently employed, produces a beautifully blended, soft quality \"\n        .. \"of tone\\\" - the one string/brass combination Rimsky-Korsakov singles out for \"\n        .. \"praise, and a standard blended pair today.\",\"RK p.61; IDIO ch.12\"},\n      {\"+ Violas\",\"The best-matched string/brass pair by register; muted violas with \"\n        .. \"horn is a favourite effect.\",\"RK p.61\"},\n      {\"+ Bassoon\",\"The bridge doubling - the two blend well, and in the middle \"\n        .. \"register this gives a slimmer, more focused horn sound.\",\"RK p.57 & p.24; IDIO ch.12\"},\n      {\"+ Clarinet\",\"Horn + Cl is the commonest horn/woodwind doubling; also 2-3 Horns \"\n        .. \"with the same number of clarinets as a chord block, or 2 Horns + 2 Fag + 2 Cl.\",\"RK p.57 & p.88\"},\n      {\"+ Clarinet (or Eng. horn) + Violas or \u00e2\u0080\u0099Cellos\",\"The standard alto-tenor grouping \"\n        .. \"of all three orchestral groups.\",\"RK p.61\"},\n      {\"Divided violas or \u00e2\u0080\u0099cellos\",\"\\\"The splendid effect of horns doubled by divided \"\n        .. \"violas or 'cellos\\\" - the exception worth seeking in string/brass harmony.\",\"RK p.95\"},\n      {\"Stopped horns + Clarinet (low notes)\",\"\\\"A beautiful dark tone.\\\" Substituting \"\n        .. \"bassoons loses part of the character.\",\"RK p.89\"},\n      {\"Stopped horns + Oboe / English horn\",\"Stopped and muted horns resemble the oboe \"\n        .. \"and English horn, so the three may share one chord played p or sfp.\",\"RK p.93\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Trumpet / 2 Horns\",\"The normal-register brass octave pairing.\",\"RK p.56\"},\n      {\"2 Horns / Tuba\",\"As above, at the bottom.\",\"RK p.56\"},\n      {\"2 Ob or 2 Cl or 2 Fl / 1 Horn\",\"Woodwind above one horn - this often replaces \"\n        .. \"1 Trumpet / 1 Horn when you want an upper octave richer than the trumpet can \"\n        .. \"give. Also 1 Ob + 1 Cl / 1 Horn.\",\"RK p.57\"},\n      {\"2 Fl + 2 Cl / 2 Horns\",\"With two horns in unison below, you need three or four \"\n        .. \"wind instruments above, especially in forte.\",\"RK p.57\"},\n      {\"2 Horns / 1 Trombone  \u00c2\u00b7  4 Horns / 2 Trombones\",\"Horns above trombones, \"\n        .. \"exclusively in octaves - \\\"possible, though not so reliable\\\".\",\"RK p.56\"},\n      {\"2 Cl / \u00e2\u0080\u0099Cellos + 2 Horns\",\"A mixed string/wind/brass octave doubling.\",\"RK p.60\"},\n      {\"2 Ob + Eng horn / 3 stopped Horns\",\"Reeds above stopped brass.\",\"RK p.93\"},\n    }},\n    {\"Writing the parts\", {\n      {\"High and low alternate\",\"Horns 1 and 3 take the high parts, 2 and 4 the low, \"\n        .. \"with 1 the highest and 4 the lowest. Write to that convention and the \"\n        .. \"section can read it without negotiation.\",\"HUG Brass Section; cf. RK p.24\"},\n      {\"The bumper\",\"\\\"A fifth horn may well be used even when only four are required \"\n        .. \"by the score, to cover the less important passages in the Horn 1 part, \"\n        .. \"allowing the principal to concentrate on important solos.\\\" You do not \"\n        .. \"write for this player; the section arranges it. But it explains why a \"\n        .. \"demanding first-horn part is less unreasonable than it looks.\",\n        \"HUG Brass Section\"},\n      {\"Weaker than the rest of the brass\",\"Horns \\\"generally have a weaker sound than \"\n        .. \"the other brass\\\", which is why they are so often grouped with the woodwind \"\n        .. \"rather than against it.\",\"HUG Brass Section; cf. RK p.33\"},\n    }},\n    {\"In harmony\", {\n      {\"The horn quartet\",\"4 Horns give \\\"every facility for four-part harmony, \"\n        .. \"perfectly balanced in tone, without doubling the bass in octaves\\\" - the \"\n        .. \"single most reliable brass chord in the orchestra.\",\"RK p.82\"},\n      {\"As background harmony\",\"\\\"A quartet of horns will be very effective and \"\n        .. \"unobtrusive when carrying the harmonic background to a passage\\\" - the \"\n        .. \"quality that makes it the default choice for sustained inner harmony.\",\n        \"HUG Brass Section\"},\n      {\"2 Horns + Tuba + 3 Trombones\",\"2 horns and tuba take the bass in octaves, the \"\n        .. \"trombones the three upper parts: \\\"beautiful full resonance\\\".\",\"RK p.83\"},\n      {\"As the 4th part\",\"With 3 trumpets, give the fourth part to one trombone or two \"\n        .. \"horns in unison; with 2 trumpets on the upper parts, complete the chord with \"\n        .. \"two trombones or four horns in pairs.\",\"RK p.83\"},\n      {\"Always double the horns when mixing\",\"\\\"If the instruments are mixed the number \"\n        .. \"of horns should be doubled\\\", and when the whole brass group plays.\",\"RK p.84\"},\n      {\"Softening the others\",\"A horn chord placed beside the same chord on trumpets or \"\n        .. \"trombones intensifies the tone and moderates their penetrating timbre.\",\"RK p.85\"},\n      {\"Completed by woodwind\",\"In the upper register a piano chord of four horns may be \"\n        .. \"completed by clarinets as effectively as by oboes or flutes, with a bassoon \"\n        .. \"doubling the bass an octave below.\",\"RK p.92\"},\n      {\"With only 2 trumpets\",\"The horns then cannot proceed in pairs; mark them one \"\n        .. \"degree louder than the other instruments to secure balance.\",\"RK p.85\"},\n      {\"In widely-divided chords\",\"The horns' register need not be doubled - lay the \"\n        .. \"chord out like a chorale for double or triple choir.\",\"RK p.85\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"It is heroic or rustic; savage or exquisitely poetic; and it is, \"\n        .. \"perhaps, in the expression of tenderness and emotion that it best develops \"\n        .. \"its mysterious qualities.\\\"\",\"SIN p.108\"},\n      {\"Berlioz\",\"\\\"A noble and melancholy instrument. It blends easily with the general \"\n        .. \"harmony.\\\" No one used it better than Weber, who \\\"causes the horn to speak a \"\n        .. \"language as admirable as it is novel\\\".\",\"SIN p.105\"},\n      {\"Piano melodies\",\"\\\"The genial and poetic tone of the horn in piano passages \"\n        .. \"affords greater scope in the choice of melodies and phrases that may be \"\n        .. \"entrusted to this instrument.\\\"\",\"RK p.54\"},\n      {\"Mobility\",\"\\\"In spite of valves the horn has but little mobility and would seem \"\n        .. \"to produce its tone in a languid and lazy manner.\\\"\",\"RK p.24\"},\n      {\"Never singly\",\"\\\"In the Orchestra the horn is seldom played singly. A pair of \"\n        .. \"horns, or four horns (two pairs), are usually employed.\\\"\",\"SIN p.109\"},\n      {\"Fanfares\",\"With the trumpet, the natural home of fanfare and flourish figures; \"\n        .. \"if a fanfare lies too low for the trumpets, give it to the horns.\",\"RK p.53-54 & p.98\"},\n      {\"Doubling voices\",\"One of the instruments that double men's voices naturally, and \"\n        .. \"listed for accompanying a cantabile aria.\",\"RK p.122 & p.124\"},\n      {\"Muted\",\"Produces an effect of distance and \\\"a dreamy effect\\\"; single notes are \"\n        .. \"stopped in short phrases, muted in longer ones.\",\"RK p.25; SIN p.107\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Clarinets inside a horn chord\",\"Rarely - the tone quality does not suit.\",\"RK p.92\"},\n      {\"Against bassoons in forte\",\"The horns overwhelm them; use four horns alone.\",\"RK p.90\"},\n      {\"Doubling a singer with 2 horns in unison\",\"Among the combinations to avoid when \"\n        .. \"accompanying the voice.\",\"RK p.121\"},\n      {\"Mezzo-forte re-entry\",\"After a long rest, bring the horns back at pp or ff - \"\n        .. \"mf or mp \\\"produces a colourless and common-place effect\\\".\",\"RK p.118\"},\n    }},\n  },\n  related={\"brass\",\"trumpet\",\"trombone\",\"tuba\",\"bassoon\",\"clarinet\",\"cello\",\"viola\",\n           \"wind_brass\",\"blend\"},\n}\n\ne{ id=\"trumpet\", name=\"Trumpet\", family=\"Brass\", kind=\"instrument\",\n  aliases={\"trumpet\",\"trumpets\",\"tpt\",\"tpts\",\"tromba\",\"clarino\",\"alto trumpet\",\n           \"small trumpet\",\"bass trumpet\"},\n  summary=\"\\\"Clear and fairly penetrating in tone, stirring and rousing in forte \"\n       .. \"passages; in piano phrases the high notes are full and silvery, the low notes \"\n       .. \"troubled, as though threatening danger.\\\" The brass instrument most frequently \"\n       .. \"doubled by the woodwind.\",\n  facts={\n    {\"Transposition\",\"In B-flat or A (alto trumpet in F; small trumpet in E-flat or D)\"},\n    {\"Strength\",\"1 Trumpet = 1 Trombone = 1 Tuba = 2 Horns in forte\"},\n    {\"Agility\",\"With the cornet, one of the only brass that can double-tongue and play \"\n      .. \"rapid tremolando\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"+ Clarinet\",\"\\\"The trumpet is the instrument most frequently doubled: Trumpet + \"\n        .. \"Cl., Trumpet + Ob., Trumpet + Fl., as well as Trumpet + Cl. + Ob. + Fl.\\\" \"\n        .. \"Instances are numerous, especially in forte, and the wind gives a finer \"\n        .. \"legato than the brass alone.\",\"RK p.56-57\"},\n      {\"+ Oboe\",\"As above; at soft dynamics oboes and trumpets are a standard blended \"\n        .. \"pair in modern practice.\",\"RK p.56; IDIO ch.12\"},\n      {\"+ Flute\",\"As above.\",\"RK p.56\"},\n      {\"2 or 3 Trumpets + 2 or 3 Fl / Ob / Cl\",\"Chord blocks in unison: 2 Trumpets + 2 \"\n        .. \"Fl, 3 Trumpets + 3 Cl, and so on.\",\"RK p.88\"},\n      {\"1, 2 or 3 Trumpets in unison\",\"The standard fanfare reinforcement; also 4 Horns \"\n        .. \"+ 2 Trumpets.\",\"RK p.55\"},\n      {\"+ Violins\",\"The best-matched string/brass pair by register - though the two are \"\n        .. \"always heard distinctly.\",\"RK p.61\"},\n      {\"+ Violins + Oboe (or Fl, Cl)\",\"The standard soprano grouping of all three \"\n        .. \"orchestral groups.\",\"RK p.61\"},\n      {\"Muted trumpets + Oboes / English horn\",\"Stopped and muted trumpets resemble the \"\n        .. \"oboe and English horn: \\\"the combination of these instruments produces a \"\n        .. \"magnificent tone\\\". 2 Ob + Eng horn + 3 muted trumpets is one of his own.\",\"RK p.89\"},\n      {\"Alto trumpet with 2 ordinary trumpets\",\"\\\"Two ordinary trumpets with an alto \"\n        .. \"trumpet produce greater smoothness and equality in resonance than three \"\n        .. \"ordinary trumpets.\\\"\",\"RK p.23\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Trumpet / 2 Horns\",\"The normal-register brass pairing.\",\"RK p.56\"},\n      {\"Trumpet / Trombone\",\"As above.\",\"RK p.56\"},\n      {\"2 Trumpets / 2 Trombones\",\"As above, doubled.\",\"RK p.56\"},\n      {\"Trumpet / Trumpet\",\"Used directly in Sadko.\",\"RK p.56\"},\n      {\"3\u00e2\u0080\u00934 wind above a trumpet\",\"To double a trumpet an octave up you need three or \"\n        .. \"four wind instruments - but in the top register two flutes will suffice.\",\"RK p.58\"},\n      {\"Woodwind above, not below\",\"If trumpets and trombones take part in a chord, put \"\n        .. \"flutes, oboes and clarinets in the harmonic part above the trumpets.\",\"RK p.93\"},\n      {\"Flute thirds between trumpet octaves\",\"In soft passages, thirds in the low \"\n        .. \"flutes, sometimes with clarinets, between trumpets an octave apart - \\\"a \"\n        .. \"beautiful mysterious effect\\\".\",\"RK p.91\"},\n    }},\n    {\"Quiet trumpets\", {\n      {\"Against the routine\",\"Berlioz notes that despite the convention of using \"\n        .. \"trumpets loudly, delightful effects come from them played piano, and credits \"\n        .. \"Gluck with showing it first - the two trumpets holding the dominant in \"\n        .. \"unison in the introduction to Iphigenie en Tauride. Beethoven (the slow \"\n        .. \"movement of the Seventh) and Weber follow him.\",\"BERL The trumpet\"},\n    }},\n    {\"Character and use\", {\n      {\"Lavignac\",\"\\\"A stately and heraldic instrument\\\" - \\\"of great agility, the \"\n        .. \"trumpet is admirably suited to rapid figures, arpeggios and especially to \"\n        .. \"repetitions of notes. Besides noisy fanfares and strident calls, it is able \"\n        .. \"to produce in piano, or pianissimo, effects either fantastic, or of extreme \"\n        .. \"sweetness.\\\"\",\"SIN p.109-111\"},\n      {\"Berlioz\",\"\\\"The quality of the trumpet tone is noble and brilliant. It suits \"\n        .. \"with warlike ideas, with cries of fury and vengeance, as with songs of \"\n        .. \"triumph... It may even figure in a jocund piece, provided the joy assume a \"\n        .. \"character of pomp and grandeur.\\\"\",\"SIN p.111\"},\n      {\"Fanfares\",\"Fanfares and flourishes \\\"fall specially to the lot of the trumpets \"\n        .. \"and horns\\\", using the clear, ringing middle and upper registers.\",\"RK p.53-54\"},\n      {\"When it is too high or too low\",\"Too low for the trumpets, give it to the horns; \"\n        .. \"too high, give it to oboes and clarinets in unison, \\\"this combination \"\n        .. \"possessing the closest resemblance to the trumpet tone both in character and \"\n        .. \"power\\\".\",\"RK p.98\"},\n      {\"As an echo\",\"\\\"Muted trumpets are eminently suited to echo a theme in the oboes.\\\"\",\"RK p.110\"},\n      {\"Sustained notes\",\"The tenuto in two or three octaves is generally given to two \"\n        .. \"trumpets, or two or four horns; the octave is sometimes formed by trumpets and \"\n        .. \"horns acting together.\",\"RK p.86\"},\n      {\"On stage\",\"Trumpets are among the instruments Rimsky-Korsakov specifies for the \"\n        .. \"wings.\",\"RK p.129\"},\n    }},\n    {\"Use sparingly\", {\n      {\"+ trombones side by side\",\"Juxtaposing trumpet and trombone chords \\\"is not so \"\n        .. \"common, as this unites the two most powerful agents in the group\\\".\",\"RK p.85\"},\n      {\"Doubling the voice\",\"\\\"Trombones and trumpets overpower the voice and cannot be \"\n        .. \"used for this purpose.\\\"\",\"RK p.122\"},\n      {\"Stopped notes\",\"On the trumpet, muting gives a better tone than stopping.\",\"RK p.25\"},\n      {\"Mezzo-forte re-entry\",\"After a long rest, return at pp or ff.\",\"RK p.118\"},\n    }},\n  },\n  related={\"brass\",\"horn\",\"trombone\",\"cornet\",\"clarinet\",\"oboe\",\"violin\",\"wind_brass\"},\n}\n\ne{ id=\"cornet\", name=\"Cornet\", family=\"Brass\", kind=\"instrument\",\n  aliases={\"cornet\",\"cornets\",\"cornett\",\"corneta\",\"cornet a pistons\"},\n  summary=\"\\\"Possessing a quality of tone similar to the trumpet, but softer and \"\n       .. \"weaker. It is a beautiful instrument though rarely employed today in theatre \"\n       .. \"or concert room. Expert players can imitate the cornet tone on the trumpet, \"\n       .. \"and vice versa.\\\"\",\n  facts={\n    {\"Transposition\",\"In B-flat or A\"},\n    {\"Strength\",\"Slightly less than trumpet, trombone or tuba\"},\n  },\n  sec={\n    {\"Use\", {\n      {\"In place of trumpets\",\"When the woodwind is in threes, the brass may be 2 \"\n        .. \"Cornets + 2 Trumpets instead of 3 trumpets.\",\"RK p.22\"},\n      {\"Stopped notes and double tonguing\",\"Possible, as on the trumpet - small \"\n        .. \"mouthpiece instruments can double-tongue and play rapid tremolando.\",\"RK p.25 & p.24\"},\n      {\"On stage\",\"Listed among the instruments for the wings.\",\"RK p.130\"},\n      {\"Ancestry\",\"Singleton traces the tuba's line back through the ophicleide and \"\n        .. \"serpent to \\\"the rather commonplace and blatant Cornet Family\\\"; the cornet \"\n        .. \"is \\\"nothing more nor less than a bugle, a development of the old post-horn\\\".\",\"SIN p.116-117\"},\n    }},\n  },\n  related={\"trumpet\",\"brass\",\"tuba\"},\n}\n\ne{ id=\"trombone\", name=\"Trombone\", family=\"Brass\", kind=\"instrument\",\n  aliases={\"trombone\",\"trombones\",\"tbn\",\"posaune\",\"sackbut\",\"bass trombone\",\n           \"tenor trombone\",\"alto trombone\",\"trb\"},\n  summary=\"\\\"Dark and threatening in the deepest register, brilliant and triumphant in \"\n       .. \"the high compass. The piano is full but somewhat heavy, the forte powerful and \"\n       .. \"sonorous.\\\" Berlioz called it \\\"the true chief of that race of wind instruments \"\n       .. \"which I distinguish as epic instruments\\\".\",\n  facts={\n    {\"Notes\",\"Non-transposing - it plays what is written\"},\n    {\"Strength\",\"1 Trombone = 1 Trumpet = 1 Tuba = 2 Horns in forte\"},\n    {\"Numbers\",\"3 in the orchestra, normally all tenors (today the third is a bass \"\n      .. \"trombone); the alto is not used\"},\n    {\"Mobility\",\"Valve trombones are more mobile, but slide trombones are preferred for \"\n      .. \"\\\"nobility and equality of sound\\\"\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"3 Trombones\",\"Frequently met with, and producing extreme power and resonance - \"\n        .. \"the group's characteristic sound.\",\"RK p.55\"},\n      {\"+ Bassoon\",\"Trombone + Fag; the bassoon is also the instrument normally used to \"\n        .. \"double a brass bass an octave below, in place of trombone or tuba.\",\"RK p.57 & p.82\"},\n      {\"+ English horn\",\"One of the reed/brass unison combinations sharing the same \"\n        .. \"characteristics; also 3 Trombones + Bass clarinet.\",\"RK p.57\"},\n      {\"+ \u00e2\u0080\u0099Cellos / D. basses\",\"With the tuba, for heavy massive effects; \\\"cello equals \"\n        .. \"trombones\\\" is a serviceable modern rule of thumb.\",\"RK p.61; MOD\"},\n      {\"+ 2 Fag + Tuba + \u00e2\u0080\u0099Cellos/D. basses\",\"The standard bass grouping of all three \"\n        .. \"orchestral groups.\",\"RK p.61\"},\n      {\"+ divided \u00e2\u0080\u0099cellos\",\"Trombones + 'Cellos divisi, alongside Horn + Violas divisi, \"\n        .. \"is one of the few string/brass harmonies Rimsky-Korsakov praises.\",\"RK p.95\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"Trombone / Tuba\",\"The normal-register brass pairing at the bottom.\",\"RK p.56\"},\n      {\"2 Trombones / Trombone + Tuba\",\"As above, doubled.\",\"RK p.56\"},\n      {\"Trumpet / Trombone  \u00c2\u00b7  2 Trumpets / 2 Trombones\",\"Trumpets above.\",\"RK p.56\"},\n      {\"2 Horns / 1 Trombone  \u00c2\u00b7  4 Horns / 2 Trombones\",\"Horns above trombones, \"\n        .. \"exclusively in octaves - possible \\\"though not so reliable\\\".\",\"RK p.56\"},\n      {\"Trombone + Bass cl / Tuba + C-Fag\",\"Mixed wood-and-brass octaves.\",\"RK p.58\"},\n    }},\n    {\"In harmony\", {\n      {\"Three-part trombones\",\"\\\"The best combination is trombones, horns, or trumpets \"\n        .. \"in three's\\\" - trombones in 3-part harmony is the standard use, often \"\n        .. \"combined with the horns.\",\"RK p.84; MOD\"},\n      {\"With the tuba\",\"Commonly 4-part harmony with the tuba, or bass trombone doubled \"\n        .. \"with tuba.\",\"MOD\"},\n      {\"The best heavy layout\",\"2 Horns + Tuba on the bass in octaves, the three other \"\n        .. \"parts on trombones: \\\"beautiful full resonance\\\".\",\"RK p.83\"},\n      {\"Reinforced trombone quartet\",\"The third trombone and tuba take the bass in \"\n        .. \"octaves, the three upper parts going to the two remaining trombones \"\n        .. \"reinforced by a trumpet or two horns in unison, for perfect balance.\",\"RK p.82-83\"},\n      {\"Softened by horns\",\"A horn chord beside the trombone chord moderates its \"\n        .. \"penetrating timbre.\",\"RK p.85\"},\n    }},\n    {\"Character\", {\n      {\"Lavignac\",\"\\\"Majestic and imposing... sufficiently powerful to dominate a whole \"\n        .. \"Orchestra. It produces above all things the impression of power, a power \"\n        .. \"superhuman... but it can also become terrible, or, even terrific... It is a \"\n        .. \"superb instrument of lofty dramatic power, which should be reserved for great \"\n        .. \"occasions; when properly introduced, its effect is overwhelming.\\\"\",\"SIN p.115\"},\n      {\"Berlioz\",\"\\\"The composer can make it chant like a choir of priests, threaten, \"\n        .. \"lament, ring a funeral knell, raise a hymn of glory, break forth into frantic \"\n        .. \"cries, or sound a dread flourish to awaken the dead, or to doom the living.\\\"\",\"SIN p.116\"},\n      {\"Reserve it\",\"Mozart kept the trombones out of Don Giovanni until the scene with \"\n        .. \"the statue, so that they arrive as a climax.\",\"SIN p.115\"},\n      {\"Fanfares\",\"Fanfare figures belong chiefly to trumpets and horns, \\\"but they may \"\n        .. \"also be given to the trombones\\\".\",\"RK p.53\"},\n      {\"Quick passages\",\"Rarely required, \\\"owing to the special character of their \"\n        .. \"tone\\\".\",\"RK p.24\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Woodwind an octave above a trombone\",\"\\\"Wood-wind instruments should not be used \"\n        .. \"to double a trombone in the octave above; trumpets are more suitable.\\\"\",\"RK p.58\"},\n      {\"3 Trombones + 3 Bassoons / 3 Clarinets\",\"\\\"Very rare.\\\"\",\"RK p.88\"},\n      {\"Trombones + trumpets side by side\",\"Not so common - it unites the two most \"\n        .. \"powerful agents in the group.\",\"RK p.85\"},\n      {\"Doubling the voice\",\"Trombones overpower the voice and cannot be used for it.\",\"RK p.122\"},\n      {\"In sustained octaves\",\"\\\"The trombone with its ponderous tone rarely takes part \"\n        .. \"in such combinations.\\\"\",\"RK p.86\"},\n      {\"Mezzo-forte re-entry\",\"After a long rest, return at pp or ff.\",\"RK p.118\"},\n    }},\n  },\n  related={\"brass\",\"tuba\",\"horn\",\"trumpet\",\"bassoon\",\"cello\",\"wind_brass\"},\n}\n\ne{ id=\"tuba\", name=\"Tuba\", family=\"Brass\", kind=\"instrument\",\n  aliases={\"tuba\",\"tubas\",\"bass tuba\",\"contrabass tuba\",\"wagner tuba\",\"wagner tubas\",\n           \"tuben\",\"ophicleide\"},\n  summary=\"\\\"Thick and rough in quality, less characteristic than the trombone, but \"\n       .. \"valuable for the strength and beauty of its low notes. Like the double bass and \"\n       .. \"double bassoon, the tuba is eminently useful for doubling, an octave lower, the \"\n       .. \"bass of the group to which it belongs.\\\" It has the deepest notes in the \"\n       .. \"orchestra.\",\n  facts={\n    {\"Notes\",\"In C (bass); fairly flexible thanks to its valves\"},\n    {\"Strength\",\"1 Tuba = 1 Trumpet = 1 Trombone = 2 Horns in forte\"},\n    {\"Numbers\",\"1, occasionally 2 (Glazunov's Finnish Fantasia)\"},\n    {\"Mutes\",\"Tubas rarely possess them, and the bell's shape prevents stopped notes\"},\n  },\n  sec={\n    {\"Pairings and doublings\", {\n      {\"Trombone / Tuba in octaves\",\"The normal-register brass pairing at the bottom; \"\n        .. \"also 2 Trombones / Trombone + Tuba.\",\"RK p.56\"},\n      {\"2 Horns / Tuba in octaves\",\"As above.\",\"RK p.56\"},\n      {\"+ Bassoon\",\"Tuba + Fag in unison.\",\"RK p.57\"},\n      {\"+ \u00e2\u0080\u0099Cellos / D. basses (with trombones)\",\"For heavy massive effects; most \"\n        .. \"commonly the tuba doubles other bass instruments for stability, in unison or \"\n        .. \"an octave below.\",\"RK p.61; MOD\"},\n      {\"+ 2 Fag + 3 Trombones + \u00e2\u0080\u0099Cellos/D. basses\",\"The standard bass grouping of all \"\n        .. \"three orchestral groups.\",\"RK p.61\"},\n      {\"+ Contrabassoon\",\"Tuba + C-Fag / D. basses as a reinforced bottom.\",\"RK p.62\"},\n      {\"Tuba + C-Fag / Trombone + Bass cl\",\"Mixed wood-and-brass octaves.\",\"RK p.58\"},\n    }},\n    {\"In harmony\", {\n      {\"The best heavy layout\",\"2 Horns + Tuba forming the bass in octaves with the \"\n        .. \"three upper parts on trombones: \\\"beautiful full resonance\\\".\",\"RK p.83\"},\n      {\"In the trombone quartet\",\"The third trombone and tuba usually form the bass in \"\n        .. \"octaves.\",\"RK p.82-83\"},\n      {\"With trombones\",\"4-part harmony with the trombones, or bass trombone doubled \"\n        .. \"with tuba.\",\"MOD\"},\n    }},\n    {\"Character\", {\n      {\"Singleton\",\"\\\"The sound of its voice is solemn, mysterious and lugubrious. It is \"\n        .. \"very rich in its deepest notes.\\\" Its tone \\\"might be described as partaking \"\n        .. \"of both the trombone and the organ\\\".\",\"SIN p.117\"},\n      {\"Wagner\u00e2\u0080\u0099s use\",\"The deep dark caverns under the Rhine, the first heavy roll of \"\n        .. \"the waves in Das Rheingold, and the dragon Fafner's voice in Siegfried.\",\"SIN p.117-118\"},\n      {\"Not expressive\",\"With the piccolo, contrabassoon and small trumpet, the tuba is \"\n        .. \"not given to playing with any great amount of expression.\",\"RK p.25\"},\n      {\"Wagner tubas\",\"A separate matter: \\\"a quartet of two high and two low modified \"\n        .. \"horns and one true tuba\\\" (Forsyth). Wagner meant them as a new colour akin to \"\n        .. \"but distinct from the horns, playable by four of his horn players.\",\"SIN p.118-119\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Extra tubas and contrabass trombone\",\"Wagner's additional quartet in the Ring \"\n        .. \"\\\"sometimes weigh too heavily on the other groups, and at other times render \"\n        .. \"the rest of the brass ineffective\\\" - Wagner himself dropped them for Parsifal.\",\"RK p.22-23\"},\n      {\"In close four-part brass\",\"\\\"The quartet of trombones and tuba is not often \"\n        .. \"employed in close four-part harmony.\\\"\",\"RK p.82\"},\n      {\"Mezzo-forte re-entry\",\"After a long rest, return at pp or ff.\",\"RK p.118\"},\n    }},\n  },\n  related={\"brass\",\"trombone\",\"horn\",\"contrabassoon\",\"doublebass\"},\n}\n\n-- ============================================================================\n-- PERCUSSION, HARP, KEYBOARDS\n-- ============================================================================\n\ne{ id=\"timpani\", name=\"Timpani (Kettledrums)\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"timpani\",\"timpano\",\"kettledrum\",\"kettledrums\",\"kettle drums\",\"tympani\",\n           \"timps\",\"drums\"},\n  summary=\"\\\"Kettle-drums, indispensable to every theatre and concert orchestra, occupy \"\n       .. \"the most important place in the group of percussion instruments.\\\" Capable of \"\n       .. \"every dynamic shade from thundering fortissimo to a barely perceptible \"\n       .. \"pianissimo, and of the most gradual crescendo, diminuendo, sfp and morendo in \"\n       .. \"tremolando.\",\n  facts={\n    {\"How many\",\"A pair up to and including Beethoven; from the mid-19th century three \"\n      .. \"or four. Assume three screw drums and a good player who can retune one during \"\n      .. \"a long pause\"},\n    {\"Recommended compass\",\"E2 to G-sharp3, chromatically\"},\n    {\"Muffling\",\"A cloth on the skin: timpani coperti\"},\n  },\n  sec={\n    {\"Pairings\", {\n      {\"+ Bass drum or gong tremolo + trombone chords\",\"The standard low-register \"\n        .. \"percussion-and-brass combination; or with low sustained 'cellos and basses.\",\"RK p.117\"},\n      {\"+ Wind\",\"Wood and brass strengthen and clarify timpani and percussion generally.\",\"RK p.34\"},\n      {\"With plucked strings\",\"Plucked strings and percussion \\\"blend perfectly\\\".\",\"RK p.34\"},\n      {\"+ cymbals + piccolo cry\",\"Spontini's effect - a short piercing piccolo note with \"\n        .. \"a cymbal stroke, its force augmented \\\"by an abrupt stroke of the kettledrums \"\n        .. \"joined to a brief chord of all the other instruments\\\".\",\"SIN p.80\"},\n      {\"Under a voice\",\"One of the few percussion uses in accompaniment: a figure or \"\n        .. \"tremolo on the kettledrums.\",\"RK p.124\"},\n    }},\n    {\"Its place in the section\", {\n      {\"The one constant\",\"Timpani are \\\"the only percussion instrument present in \"\n        .. \"nearly all orchestral music\\\", and are played by a specialist who will not \"\n        .. \"normally play any other percussion.\",\"HUG Percussion Section\"},\n      {\"Left out of balance sums\",\"Their dynamic range is effectively unlimited, so no \"\n        .. \"balance ratio fits them; and in classical and romantic scoring they mark the \"\n        .. \"root, which simply reinforces it.\",\"IDIO Chords\"},\n    }},\n    {\"Character and use\", {\n      {\"Its ringing quality\",\"Along with glockenspiel, bells and xylophone, the timpani's \"\n        .. \"\\\"ringing, resounding quality\\\" will easily prevail over other groups in \"\n        .. \"combination - so it needs no reinforcement.\",\"RK p.34\"},\n      {\"Beethoven\u00e2\u0080\u0099s contribution\",\"He changed only how they were tuned - and \\\"that made \"\n        .. \"all the difference in the world\\\": a minor sixth in the Seventh Symphony's \"\n        .. \"Scherzo, octaves in the Ninth, and the dominant rather than the tonic in the \"\n        .. \"First.\",\"SIN p.120; SIN p.219\"},\n      {\"Sticks\",\"Felt-padded for normal use; wooden balls for special effects; ordinary \"\n        .. \"street drumsticks for very fine crisp rolls (Elgar's Variations); sponge \"\n        .. \"sticks for delicate work.\",\"SIN p.121\"},\n      {\"Only four good notes per drum\",\"Which is why kettledrums are made in about six \"\n        .. \"sizes. Allow bars of rest for retuning.\",\"SIN p.120-121\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Against a singer\",\"A timpani tremolo can overpower a voice even more easily than \"\n        .. \"the doubled wind and brass can.\",\"RK p.121\"},\n    }},\n  },\n  related={\"percussion\",\"bassdrum\",\"cymbals\",\"sidedrum\",\"gong\",\"trombone\"},\n}\n\ne{ id=\"sidedrum\", name=\"Side Drum (Snare Drum)\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"side drum\",\"snare drum\",\"sidedrum\",\"snare\",\"military drum\",\"tamburo\",\n           \"tambour militaire\"},\n  summary=\"The military drum, used in the orchestra for rhythmic effects. A medium-register \"\n       .. \"instrument of indeterminate pitch, and one of the three that can manage \"\n       .. \"genuinely varied rhythmic figures.\",\n  sec={\n    {\"Pairings\", {\n      {\"Tremolo + sustained trumpet and horn chords\",\"The standard pairing - as with \"\n        .. \"cymbals struck with drum sticks.\",\"RK p.117\"},\n      {\"With upper-register harmony\",\"Side drum, triangle and tambourine go best with \"\n        .. \"harmony in the upper register.\",\"RK p.117\"},\n    }},\n    {\"Use\", {\n      {\"Which rhythms\",\"\\\"An insignificant and playful rhythm is suitable to the \"\n        .. \"triangle, tambourine, castanets and side drum.\\\"\",\"RK p.117\"},\n      {\"Strokes\",\"Its technique rests not on a single stroke but on a double alternate \"\n        .. \"stroke with each hand. Besides the Long Roll there are the flam (a short note \"\n        .. \"before a longer one) and the drag (a roll preceding a note).\",\"SIN p.123\"},\n      {\"Careful\",\"A fortissimo side-drum tremolo will overpower any orchestral tutti.\",\"RK p.117\"},\n    }},\n  },\n  related={\"percussion\",\"timpani\",\"bassdrum\",\"cymbals\",\"tambourine\"},\n}\n\ne{ id=\"bassdrum\", name=\"Bass Drum\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"bass drum\",\"bassdrum\",\"gran cassa\",\"big drum\",\"grosse caisse\"},\n  summary=\"A deep instrument of indeterminate pitch. \\\"May be used for noisy moments to \"\n       .. \"imitate the firing of guns and the roll, or crash, of thunder and also to mark \"\n       .. \"crescendos and climaxes. If played very softly, it is solemn and awe-inspiring.\\\"\",\n  sec={\n    {\"Pairings\", {\n      {\"Tremolo + trombone chords\",\"Or with low sustained 'cellos and double basses - the \"\n        .. \"standard low-register pairing, shared with the gong.\",\"RK p.117\"},\n      {\"With lower-register harmony\",\"Bass drum, cymbals and gong go with harmony in the \"\n        .. \"low register.\",\"RK p.117\"},\n      {\"Which rhythms\",\"\\\"A vigourous and straightforward rhythm may be given to the bass \"\n        .. \"drum, cymbals and gong.\\\"\",\"RK p.117\"},\n    }},\n    {\"Use\", {\n      {\"On stage\",\"Bass drum without cymbals, to imitate cannon (Tsar Saltan).\",\"RK p.131\"},\n      {\"Careful\",\"Fortissimo, it will overpower any orchestral tutti.\",\"RK p.117\"},\n    }},\n  },\n  related={\"percussion\",\"cymbals\",\"gong\",\"timpani\",\"trombone\"},\n}\n\ne{ id=\"cymbals\", name=\"Cymbals\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"cymbals\",\"cymbal\",\"piatti\",\"antique cymbals\",\"crotales\",\"suspended cymbal\"},\n  summary=\"A deep-to-medium instrument of indeterminate pitch, used like the triangle to \"\n       .. \"accentuate a climax - but more vigorously.\",\n  sec={\n    {\"Pairings\", {\n      {\"Struck with drum sticks + sustained trumpet and horn chords\",\"The standard \"\n        .. \"pairing, shared with the side-drum tremolo.\",\"RK p.117\"},\n      {\"+ piccolo cry\",\"Spontini's discovery: a short piercing piccolo note joined to a \"\n        .. \"cymbal stroke. \\\"The singular sympathy, which is thus created between these \"\n        .. \"very dissimilar instruments, had not been thought of before. It cuts and rends \"\n        .. \"instantaneously, like the stab of a poignard.\\\"\",\"SIN p.80\"},\n      {\"With lower-register harmony\",\"With bass drum and gong.\",\"RK p.117\"},\n    }},\n    {\"Use\", {\n      {\"Ways of playing\",\"The two-plate stroke with a brushing movement for single notes; \"\n        .. \"rubbing the plates together; the two-plate roll, loud or soft; or hanging one \"\n        .. \"cymbal up and beating it with a stick like a gong.\",\"SIN p.124-125\"},\n      {\"With a voice\",\"Used to accompany a singer less often than the triangle.\",\"RK p.124\"},\n      {\"Careful\",\"Fortissimo, they will overpower any orchestral tutti.\",\"RK p.117\"},\n    }},\n  },\n  related={\"percussion\",\"bassdrum\",\"triangle\",\"gong\",\"piccolo\"},\n}\n\ne{ id=\"triangle\", name=\"Triangle\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"triangle\",\"triangolo\"},\n  summary=\"A high instrument of indeterminate pitch - which means it can be used in all \"\n       .. \"keys and with all chords. \\\"The sound is clear as crystal. Sometimes it even \"\n       .. \"seems silvery. It can play from the lightest pianissimo to the loudest \"\n       .. \"fortissimo.\\\"\",\n  sec={\n    {\"Pairings\", {\n      {\"Tremolo + trills in woodwind and violins\",\"The standard pairing, shared with the \"\n        .. \"tambourine.\",\"RK p.117\"},\n      {\"+ soft strings and woodwind\",\"\\\"Mixed with soft strings and woodwind instruments, \"\n        .. \"the triangle is of charming effect.\\\"\",\"SIN p.124\"},\n      {\"With upper-register harmony\",\"Triangle, side drum and tambourine go best with \"\n        .. \"harmony in the upper register.\",\"RK p.117\"},\n      {\"With glockenspiel, in fire music\",\"Wagner's Walkure fire music - the glockenspiel \"\n        .. \"adds \\\"brilliant tips of light to the soaring plumes of flame\\\" and \\\"here, \"\n        .. \"too, the triangle contributes its white notes like vivid points of heat and \"\n        .. \"light\\\".\",\"SIN p.127\"},\n    }},\n    {\"Use\", {\n      {\"Which rhythms\",\"Suits \\\"an insignificant and playful rhythm\\\"; it can manage \"\n        .. \"complicated rhythms and even a tremolo.\",\"RK p.117; SIN p.124\"},\n      {\"Widor\u00e2\u0080\u0099s remark\",\"\\\"At the climax of a crescendo, when the Orchestra would seem to \"\n        .. \"have reached the height of intensity, the introduction of the Triangle converts \"\n        .. \"red heat into white heat.\\\"\",\"SIN p.124\"},\n      {\"With a voice\",\"The percussion instrument most often used to accompany a singer.\",\"RK p.124\"},\n      {\"Economy\",\"First in the order of percussion frequency, ahead of cymbals, bass \"\n        .. \"drum, side drum, tambourine and gong.\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"cymbals\",\"tambourine\",\"glockenspiel\"},\n}\n\ne{ id=\"tambourine\", name=\"Tambourine\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"tambourine\",\"tambour de basque\",\"tamburino\",\"tambourin\"},\n  summary=\"A medium instrument of indeterminate pitch, used in the orchestra \\\"to give \"\n       .. \"'local color', especially to folk-music of Spain and Italy; to 'gypsy-music'; \"\n       .. \"and to some kinds of dance-music\\\".\",\n  sec={\n    {\"Pairings\", {\n      {\"Tremolo + trills in woodwind and violins\",\"The standard pairing, shared with the \"\n        .. \"triangle.\",\"RK p.117\"},\n      {\"With upper-register harmony\",\"With triangle and side drum.\",\"RK p.117\"},\n      {\"+ castanets\",\"Wagner uses both in the Tannhauser Bacchanale.\",\"SIN p.126\"},\n    }},\n    {\"Use\", {\n      {\"Three ways to play it\",\"Striking the head with the knuckles (detached notes and \"\n        .. \"simple rhythmic groups); shaking the hoop (a rolling noise from the jingles); \"\n        .. \"rubbing the head with the thumb (a hollow, swishing sound with a tremolo of \"\n        .. \"the jingles).\",\"SIN p.125-126\"},\n      {\"Which rhythms\",\"Suits \\\"an insignificant and playful rhythm\\\", and can manage \"\n        .. \"varied rhythmic figures.\",\"RK p.117\"},\n      {\"Also\",\"The tambourin is a different instrument: a long narrow drum from Provence, \"\n        .. \"beaten with one stick while the player holds a flageolet in the other hand.\",\"SIN p.126\"},\n    }},\n  },\n  related={\"percussion\",\"triangle\",\"castanets\",\"sidedrum\"},\n}\n\ne{ id=\"castanets\", name=\"Castanets\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"castanets\",\"castanet\",\"castagnette\"},\n  summary=\"A high instrument of indeterminate pitch, \\\"generally used to accent the rhythm \"\n       .. \"of Spanish dance-music, or to give color to music of a Spanish character\\\". \"\n       .. \"The sound is \\\"a deep, hollow click, which, although not a musical note, is not \"\n       .. \"unpleasing when heard with its appropriate music\\\".\",\n  sec={\n    {\"Use\", {\n      {\"Which rhythms\",\"Suits \\\"an insignificant and playful rhythm\\\", with triangle, \"\n        .. \"tambourine and side drum.\",\"RK p.117\"},\n      {\"With upper-register harmony\",\"Classed among the high percussion with triangle and \"\n        .. \"little bells.\",\"RK p.32\"},\n      {\"+ tambourine\",\"Wagner uses both in the Tannhauser Bacchanale; Saint-Saens calls \"\n        .. \"for castanets in Samson et Dalila.\",\"SIN p.126\"},\n      {\"Spanish practice\",\"The dancer holds a pair in each hand - the right plays the full \"\n        .. \"rhythm (the hembra), the left a simplified rhythm on a larger pair (the marcho).\",\"SIN p.126\"},\n      {\"Economy\",\"Like the piano, \\\"too characteristic in timbre to be employed over \"\n        .. \"frequently\\\".\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"tambourine\",\"triangle\"},\n}\n\ne{ id=\"gong\", name=\"Gong (Tam-tam)\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"gong\",\"tam tam\",\"tam-tam\",\"tamtam\",\"chinese gong\"},\n  summary=\"With the bass drum, the deepest instrument of indeterminate pitch in the \"\n       .. \"orchestra.\",\n  sec={\n    {\"Pairings\", {\n      {\"Tremolo + trombone chords\",\"Or with low sustained 'cellos and basses - the \"\n        .. \"standard low-register pairing, shared with the bass drum.\",\"RK p.117\"},\n      {\"Which rhythms\",\"\\\"A vigourous and straightforward rhythm may be given to the bass \"\n        .. \"drum, cymbals and gong.\\\"\",\"RK p.117\"},\n    }},\n    {\"Use\", {\n      {\"On stage\",\"Used to imitate a church bell (Ivan the Terrible).\",\"RK p.131\"},\n      {\"Careful\",\"Fortissimo, it will overpower any orchestral tutti.\",\"RK p.117\"},\n      {\"Economy\",\"Last in the order of percussion frequency.\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"bassdrum\",\"cymbals\",\"bells\"},\n}\n\ne{ id=\"glockenspiel\", name=\"Glockenspiel\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"glockenspiel\",\"campanelli\",\"bells (glockenspiel)\",\"orchestra bells\",\"carillon\",\n           \"keyed glockenspiel\"},\n  summary=\"Steel or bronze bars struck with small hammers. \\\"The use of the glockenspiel \"\n       .. \"is similar to the celesta, but its tone is more brilliant and penetrating.\\\" \"\n       .. \"The bar type is more satisfactory and more resonant than the keyboard type.\",\n  sec={\n    {\"Pairings and use\", {\n      {\"It wins\",\"With bells and xylophone, its \\\"emphatic tone will easily prevail over \"\n        .. \"other groups in combination\\\" - so use it sparingly and never to force a \"\n        .. \"balance.\",\"RK p.34\"},\n      {\"+ first violins\",\"A melody in the firsts doubled by glockenspiel gains \\\"a \"\n        .. \"sparkling, chime-like colour\\\".\",\"WP\"},\n      {\"+ triangle\",\"Wagner's Walkure fire music: the glockenspiel makes \\\"brilliant tips \"\n        .. \"of light to the soaring plumes of flame\\\", the triangle \\\"vivid points of heat \"\n        .. \"and light\\\".\",\"SIN p.127\"},\n      {\"+ piccolo and harp\",\"In Snegourotchka a piccolo figure doubled by harp and \"\n        .. \"glockenspiel, set four octaves from the bass - \\\"the general effect is \"\n        .. \"fanciful\\\".\",\"RK p.106-107\"},\n      {\"Economy\",\"With celesta and xylophone, \\\"too characteristic in timbre to be \"\n        .. \"employed over frequently\\\".\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"celesta\",\"xylophone\",\"bells\",\"harp\"},\n}\n\ne{ id=\"celesta\", name=\"Celesta\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"celesta\",\"celeste\",\"keyboard glockenspiel\"},\n  summary=\"Small steel plates struck by hammers from a keyboard: \\\"the hammers falling on \"\n       .. \"them produce a delightful sound, very similar to the glockenspiel\\\". Sweet, \"\n       .. \"clear, fairy-like and graceful - and it never goes out of tune.\",\n  facts={{\"Notation\",\"Like piano music, two hands, sounding an octave higher than written\"}},\n  sec={\n    {\"Pairings and use\", {\n      {\"+ piccolo\",\"A piccolo melody doubled by celesta gains a bright tone - a standard \"\n        .. \"modern colour doubling.\",\"WP\"},\n      {\"+ harp\",\"Debussy's Jeux pairs a harp doubling horns with \\\"the bell-like celesta\\\".\",\"WP\"},\n      {\"Easily overpowered\",\"The combined force of the sustaining groups easily overpowers \"\n        .. \"the celesta - so keep the texture thin around it.\",\"RK p.34\"},\n      {\"Substitute\",\"\\\"The celesta is only found in full orchestras; when it is not \"\n        .. \"available it should be replaced by an upright piano, and not the glockenspiel.\\\"\",\"RK p.31\"},\n      {\"Who introduced it\",\"First used by Tchaikovsky - famously in the Nutcracker; \"\n        .. \"Tchaikovsky and Strauss gave it its popularity.\",\"RK p.31; SIN p.128\"},\n      {\"Economy\",\"Too characteristic to use often.\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"glockenspiel\",\"piano\",\"harp\",\"piccolo\"},\n}\n\ne{ id=\"xylophone\", name=\"Xylophone\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"xylophone\",\"xylophon\",\"xilofono\"},\n  summary=\"\\\"A species of harmonica composed of strips or cylinders of wood, struck with \"\n       .. \"two little hammers. It produces a clattering sound, both powerful and piercing.\\\" \"\n       .. \"Dry and hollow, and suited to grotesque music.\",\n  sec={\n    {\"Pairings and use\", {\n      {\"It wins\",\"With glockenspiel and bells, its emphatic tone easily prevails over \"\n        .. \"other groups in combination.\",\"RK p.34\"},\n      {\"Its string equivalent\",\"Strings col legno produce a sound similar to the \"\n        .. \"xylophone, gaining in quality as more players join.\",\"RK p.32\"},\n      {\"Its character role\",\"Saint-Saens's Danse Macabre, \\\"in which it represents the \"\n        .. \"clattering of the bones of the dancing skeletons\\\".\",\"SIN p.129\"},\n      {\"Economy\",\"Too characteristic in timbre to be employed over frequently.\",\"RK p.118\"},\n    }},\n  },\n  related={\"percussion\",\"glockenspiel\",\"celesta\"},\n}\n\ne{ id=\"bells\", name=\"Bells (Tubular Chimes)\", family=\"Percussion\", kind=\"instrument\",\n  aliases={\"bells\",\"tubular bells\",\"chimes\",\"tubular chimes\",\"campane\",\"church bells\"},\n  summary=\"\\\"Big bells in the shape of hollow discs or metal tubes, or real church bells \"\n       .. \"of moderate size may be considered more as theatrical properties than orchestral \"\n       .. \"instruments.\\\" Modern suspended metal plates have \\\"the rare quality of a fairly \"\n       .. \"pure tone\\\" and are portable enough for the concert platform.\",\n  sec={\n    {\"Pairings and use\", {\n      {\"It wins\",\"With glockenspiel and xylophone, its emphatic tone easily prevails over \"\n        .. \"other groups.\",\"RK p.34\"},\n      {\"+ bassoons and clarinets\",\"Meyerbeer's big bell in low F for the massacre of the \"\n        .. \"Huguenots, \\\"combined with bassoons and clarinets, which give the music a \"\n        .. \"sinister quality that is very impressive\\\".\",\"SIN p.130\"},\n      {\"On stage\",\"\\\"Bells in various keys\\\" are among the instruments Rimsky-Korsakov \"\n        .. \"specifies for the wings.\",\"RK p.131\"},\n      {\"Substitutes\",\"Saint-Saens's midnight chime in Danse Macabre is twelve notes \"\n        .. \"plucked on the harp; Strauss tells the hour with taps on the glockenspiel; the \"\n        .. \"bells of Montsalvat in Parsifal are usually played on tubular chimes.\",\"SIN p.131\"},\n      {\"Why they are hard to pitch\",\"Lavignac: of all sound-producing agents the bell \"\n        .. \"\\\"develops the greatest number of over-tones, often discordant even, which \"\n        .. \"sometimes causes a difficulty in discovering which is the fundamental musical \"\n        .. \"tone\\\".\",\"SIN p.130\"},\n    }},\n  },\n  related={\"percussion\",\"glockenspiel\",\"gong\",\"harp\"},\n}\n\ne{ id=\"harp\", name=\"Harp\", family=\"Plucked\", kind=\"instrument\",\n  aliases={\"harp\",\"harps\",\"arpa\",\"concert harp\",\"double action harp\"},\n  summary=\"\\\"In the orchestra, the harp is almost entirely an harmonic or accompanying \"\n       .. \"instrument... The tender poetic quality of the harp is adapted to every dynamic \"\n       .. \"shade, but it is never a very powerful instrument, and the orchestrator should \"\n       .. \"treat it with respect.\\\" Like pizzicato strings, more an instrument of colour \"\n       .. \"than of expression.\",\n  facts={\n    {\"Range\",\"C-flat1 to F-sharp7, but normally only the 1st to 4th octaves are used\"},\n    {\"How many\",\"1 part is usual; 2 or 3 in later scores. 3-4 in unison are needed to be \"\n      .. \"heard against a full forte orchestra\"},\n    {\"Limits\",\"Diatonic by nature - all chromatic passages depend on the pedals. No double \"\n      .. \"sharps or double flats\"},\n  },\n  sec={\n    {\"Pairings\", {\n      {\"+ Brass\",\"Berlioz: \\\"Of all known qualities of tone it is singular that the \"\n        .. \"quality of horns, of trombones, and, generally, of brass instruments mingles \"\n        .. \"best with theirs.\\\"\",\"SIN p.281\"},\n      {\"+ pizzicato strings\",\"The two form the plucked group together; for a singer, \"\n        .. \"\\\"strings pizz. and the harp forms a setting eminently favourable for the \"\n        .. \"voice\\\".\",\"RK p.26 & p.120\"},\n      {\"+ Percussion\",\"Wind clarifies harp and percussion alike, and plucked strings with \"\n        .. \"percussion \\\"blend perfectly\\\".\",\"RK p.34\"},\n      {\"+ Piano\",\"Harp with piano imitates a popular plucked instrument or a soft peal of \"\n        .. \"bells.\",\"RK p.30\"},\n      {\"+ 2 Flutes\",\"Berlioz's trio for two flutes and harp in L'Enfance du Christ; Mozart \"\n        .. \"wrote a concerto for flute and harp.\",\"SIN p.286 & p.288\"},\n      {\"+ Piccolo and glockenspiel\",\"A piccolo figure doubled by harp and glockenspiel, \"\n        .. \"far from the bass - \\\"the general effect is fanciful\\\".\",\"RK p.106-107\"},\n      {\"Accompanying a cantabile aria\",\"Listed among the solo instruments for this.\",\"RK p.124\"},\n    }},\n    {\"Writing for it\", {\n      {\"Chords must be broken\",\"Only four notes per hand at most, written close together, \"\n        .. \"and always arpeggiato unless you mark non arpeggiato.\",\"RK p.28\"},\n      {\"Rapid figures\",\"Only clear in the upper register, where the strings are shorter \"\n        .. \"and harder - lower down, one chord mixes into the next.\",\"RK p.28\"},\n      {\"Glissando\",\"Peculiar to the harp. As a purely musical effect it works only in the \"\n        .. \"upper octaves, quite piano. Forte glissandi through the low and middle strings \"\n        .. \"are permissible only as embellishment; glissandi in sevenths and ninths, got \"\n        .. \"enharmonically, take any dynamic.\",\"RK p.29\"},\n      {\"Modulation\",\"It does not lend itself to rapid modulation - use two harps \"\n        .. \"alternately. Some transitions are only possible enharmonically.\",\"RK p.28\"},\n      {\"Harmonics\",\"Great charm but little resonance; only three notes, close together, \"\n        .. \"two for the left hand and one for the right; possible only quite softly.\",\"RK p.29 & p.29\"},\n      {\"Berlioz on its bass\",\"The veiled, mysterious low strings \\\"have scarcely ever been \"\n        .. \"employed except for bass accompaniments of the left hand; and the more the \"\n        .. \"pity!\\\"\",\"SIN p.281\"},\n      {\"Berlioz on its top\",\"\\\"A delicate, crystalline sound of voluptuous freshness\\\" - \"\n        .. \"but never attacked with violence, or it gives \\\"a dry, hard sound, similar to \"\n        .. \"that of broken glass\\\".\",\"SIN p.282\"},\n      {\"Artificial effect\",\"Long glissandi are more resonant and brilliant than short \"\n        .. \"ones, so composers write glissando notes that do not correspond with what the \"\n        .. \"rest of the orchestra is playing.\",\"RK p.116\"},\n    }},\n  },\n  related={\"plucked\",\"pizzicato\",\"percussion\",\"brass\",\"celesta\",\"piano\"},\n}\n\ne{ id=\"piano\", name=\"Piano in the Orchestra\", family=\"Plucked\", kind=\"instrument\",\n  aliases={\"piano\",\"pianoforte\",\"upright piano\",\"keyboard\",\"harpsichord\",\"cembalo\"},\n  summary=\"\\\"The use of a piano in the orchestra (apart from pianoforte concertos) belongs \"\n       .. \"almost entirely to the Russian school.\\\" Two purposes: to imitate a popular \"\n       .. \"plucked instrument, or a soft peal of bells.\",\n  sec={\n    {\"Pairings and use\", {\n      {\"+ Harp\",\"The standard combination, for a plucked-instrument or bell effect.\",\"RK p.30\"},\n      {\"+ pizzicato strings\",\"Piano and harp can reinforce a tutti pizzicato.\",\"RK p.103\"},\n      {\"Which piano\",\"\\\"When the piano forms part of an orchestra, not as a solo \"\n        .. \"instrument, an upright is preferable to a grand.\\\"\",\"RK p.30\"},\n      {\"Superseded\",\"\\\"Today the piano is gradually being superseded by the celesta\\\" - \"\n        .. \"but where no celesta is available, an upright piano replaces it, not the \"\n        .. \"glockenspiel.\",\"RK p.30-31\"},\n      {\"Easily overpowered\",\"A softly played piano is easily overpowered by the sustaining \"\n        .. \"groups.\",\"RK p.34\"},\n      {\"Economy\",\"With the castanets, too characteristic in timbre to be used often.\",\"RK p.118\"},\n      {\"Historically\",\"\\\"The piano, or harpsichord, ceased to belong to the Orchestra in \"\n        .. \"the days of Haydn\\\" - and in the 20th century composers began experimenting \"\n        .. \"with it as an orchestral instrument again.\",\"SIN p.290\"},\n    }},\n  },\n  related={\"harp\",\"celesta\",\"plucked\",\"percussion\"},\n}\n\n-- ============================================================================\n-- CRAFT (Belkin's Artistic Orchestration)\n-- ============================================================================\n\ne{ id=\"contrast\", name=\"Scale of Timbral Contrast\", family=\"Craft\", kind=\"topic\",\n  aliases={\"contrast\",\"timbral contrast\",\"how much contrast\",\"degree of contrast\",\n           \"scale of contrast\",\"changing instrument\",\"switching instruments\"},\n  summary=\"How big a change the ear actually hears when a line passes from one \"\n       .. \"instrument to another. \\\"The degree of timbral change must correspond to the \"\n       .. \"degree of formal contrast required: A major section break requires more \"\n       .. \"orchestral contrast than a new motive within a phrase.\\\" Beginners \"\n       .. \"habitually misjudge this.\",\n  facts={\n    {\"The governing principle\",\"\\\"Timbres which blend well in chords present little \"\n       .. \"or no contrast when heard in succession; timbres which do not blend in \"\n       .. \"chords make for stronger contrasts\\\"\"},\n    {\"Caveat\",\"Perceived contrast depends on register, articulation and texture too, \"\n       .. \"not timbre alone\"},\n  },\n  sec={\n    {\"Group 1 \u00e2\u0080\u0094 imperceptible or very mild\", {\n      {\"Same instrument, different register\",\"e.g. low flute to high flute, excepting \"\n        .. \"the most extreme registers.\",\"BEL p.24\"},\n      {\"Between adjacent members of the string family\",\"\",  \"BEL p.24\"},\n      {\"Between trumpets and trombones\",\"\",  \"BEL p.24\"},\n    }},\n    {\"Group 2 \u00e2\u0080\u0094 mild to moderate\", {\n      {\"Within the same woodwind sub-family\",\"e.g. flute to alto flute, oboe to \"\n        .. \"English horn.\",\"BEL p.24\"},\n      {\"Within one instrument or sub-family, but into an extreme register\",\"\",  \"BEL p.24\"},\n      {\"Between diverse woodwinds in registers that blend well\",\"e.g. clarinets to \"\n        .. \"bassoons in the middle register, flutes to oboes higher up.\",\"BEL p.24\"},\n      {\"Between woodwind and brass that would blend simultaneously\",\"e.g. bassoons to \"\n        .. \"horns.\",\"BEL p.24\"},\n      {\"Horn to trumpet, or horn to trombone\",\"\",  \"BEL p.24\"},\n    }},\n    {\"Group 3 \u00e2\u0080\u0094 more marked\", {\n      {\"Between diverse woodwinds that would not blend in chords\",\"e.g. low oboe to \"\n        .. \"low flute. \\\"Very often these cases involve the oboe.\\\"\",\"BEL p.24\"},\n      {\"Between woodwind and brass that do not blend simultaneously\",\"\",  \"BEL p.24\"},\n      {\"Between woodwind and strings\",\"\",  \"BEL p.24\"},\n      {\"Between brass and strings\",\"\",  \"BEL p.24\"},\n    }},\n    {\"Group 4 \u00e2\u0080\u0094 contrast outweighs the similarity\", {\n      {\"A completely different nature of sound\",\"e.g. strings arco exchanging with \"\n        .. \"strings pizzicato.\",\"BEL p.24\"},\n    }},\n    {\"Group 5 \u00e2\u0080\u0094 extreme\", {\n      {\"Only one aspect of the phrase survives the exchange\",\"e.g. flute against \"\n        .. \"snare drum: only the rhythm can be imitated.\",\"BEL p.25\"},\n    }},\n    {\"Adjusting the scale\", {\n      {\"A constant background reduces it\",\"\\\"In a passage with more than one plane of \"\n        .. \"tone, contrast will be lessened if the background plane remains constant\\\" \"\n        .. \"- a flute phrase answered by oboe over the same string accompaniment reads \"\n        .. \"as less of a change.\",\"BEL p.25\"},\n      {\"Mixed timbres share their elements\",\"Oboe+flute in unison is closer to \"\n        .. \"oboe+clarinet in unison than oboe alone is to clarinet alone. And \"\n        .. \"\\\"extensive use of mixed timbres makes larger formal contrasts harder to \"\n        .. \"effect, since the colors, not being pure, are less distinct\\\".\",\"BEL p.25\"},\n      {\"Pizzicato counts as percussion\",\"Treat plucked strings as a kind of pitched \"\n        .. \"percussion when judging contrast; percussion itself divides into \"\n        .. \"sub-families by material - woods, metals, skins, pitched and \"\n        .. \"unpitched.\",\"BEL p.25 & p.7\"},\n      {\"Very loud to very soft needs help\",\"\\\"After a fortissimo tutti, the ear \"\n        .. \"requires a moment to adapt to very quiet music; otherwise the first few \"\n        .. \"quiet notes can pass unnoticed.\\\" Hold one or two instruments over from \"\n        .. \"the loud passage for a few beats.\",\"BEL p.25\"},\n    }},\n  },\n  related={\"form\",\"blend\",\"doubling\",\"planes\",\"balance\"},\n}\n\ne{ id=\"form\", name=\"Orchestration and Form\", family=\"Craft\", kind=\"topic\",\n  aliases={\"form\",\"structure\",\"orchestration and form\",\"where to change\",\n           \"rate of change\",\"climax\",\"climaxes\",\"cadence\",\"accents\",\"phrasing\"},\n  summary=\"The subject Belkin wrote his book to cover, because the other treatises do \"\n       .. \"not: orchestration as a structural device rather than a colouring one. \"\n       .. \"\\\"A change of sound creates a formal articulation.\\\"\",\n  sec={\n    {\"Where a change of timbre belongs\", {\n      {\"Between phrases and sections\",\"\\\"The normal place for timbre to change is \"\n        .. \"between phrases, sections, etc.\\\"\",\"BEL p.19\"},\n      {\"Inside a phrase, only at meaningful moments\",\"\\\"Motivic changes, climactic \"\n        .. \"moments, and cadences. Changes at other places sound arbitrary.\\\" Belkin \"\n        .. \"notes that arbitrary mid-phrase changes are \\\"common in student \"\n        .. \"work\\\".\",\"BEL p.19\"},\n      {\"Accents\",\"Usually need a new sound added momentarily, or a change of playing \"\n        .. \"technique - double stops in the strings, a percussive attack. \\\"The change \"\n        .. \"must of course be proportional to degree of accent required\\\", and normally \"\n        .. \"in the same register as the main line.\",\"BEL p.19 & p.25\"},\n      {\"Cadences\",\"\\\"Structural articulations can often be enhanced by some change in \"\n        .. \"the orchestration.\\\"\",\"BEL p.19\"},\n    }},\n    {\"Rate of orchestral change\", {\n      {\"It works like harmonic rhythm\",\"\\\"Like harmonic rhythm - the rate of harmonic \"\n        .. \"change - the rate of orchestral change has an important impact on the \"\n        .. \"music's pacing.\\\" Speeding it up and slowing it down creates tension and \"\n        .. \"relaxation.\",\"BEL p.21\"},\n      {\"Not all changes weigh the same\",\"\\\"Adding a unison flute doubling to a line in \"\n        .. \"the violins does not have the same impact as adding three trumpets playing \"\n        .. \"chords.\\\"\",\"BEL p.21\"},\n      {\"A worked case\",\"Mahler's Fourth, second movement: subtle changes for eight \"\n        .. \"bars, then stopped horns and the theme moved to woodwind create the \"\n        .. \"intensity. The nervous character of that movement comes from frequent \"\n        .. \"prominent timbre changes - and the calm of the third movement comes from \"\n        .. \"\\\"remaining entirely within the string choir\\\".\",\"BEL p.23\"},\n    }},\n    {\"Progressions and climaxes\", {\n      {\"Orchestral progressions\",\"Crescendi and diminuendi; gradually rising or \"\n        .. \"falling passages; texture getting thicker or thinner. All \\\"powerful \"\n        .. \"sources of musical direction\\\".\",\"BEL p.20 & p.31\"},\n      {\"Reserve something for the main climax\",\"\\\"Usually one climax, near the end, \"\n        .. \"stands out more than the others. It is important to reserve some unique \"\n        .. \"orchestral resource for this moment.\\\"\",\"BEL p.20\"},\n      {\"Crescendo by addition, diminuendo by subtraction\",\"\\\"An orchestral crescendo \"\n        .. \"is achieved by adding instruments in a well graduated order, and a \"\n        .. \"diminuendo by subtracting them.\\\" Beethoven's Ninth opens with the \"\n        .. \"textbook case: violin 1, double bass, viola, clarinet, oboe, flute, \"\n        .. \"bassoon.\",\"BEL p.26-27; cf. RK p.112\"},\n      {\"Never contradict the dynamic\",\"\\\"It is especially important not to \"\n        .. \"inadvertently contradict the dynamic evolution of a phrase by doing the \"\n        .. \"opposite, e.g. adding instruments during a diminuendo.\\\"\",\"BEL p.26\"},\n    }},\n  },\n  related={\"contrast\",\"dynamics\",\"planes\",\"quality\",\"three_groups\"},\n}\n\ne{ id=\"dynamics\", name=\"Orchestrating Dynamics\", family=\"Craft\", kind=\"topic\",\n  aliases={\"dynamics\",\"loud\",\"soft\",\"absolute dynamics\",\"relative dynamics\",\n           \"how loud can it play\",\"dynamic marks\",\"pp\",\"ff\"},\n  summary=\"\\\"Orchestrate your dynamics instead of just writing them as textual \"\n       .. \"indications.\\\" Some instruments simply cannot reach some dynamics in some \"\n       .. \"registers, however you mark them.\",\n  sec={\n    {\"Absolute vs relative\", {\n      {\"The distinction\",\"\\\"Every instrument has some relative dynamic control in \"\n        .. \"every register. However, some instruments, in particular registers, simply \"\n        .. \"cannot achieve certain absolute dynamics.\\\" A group of brass high up will \"\n        .. \"never be very soft; a low flute can never be very loud.\",\"BEL p.27\"},\n      {\"Who can start from nothing\",\"\\\"Strings and certain percussion (tam-tam, \"\n        .. \"cymbals, and the lower drums) can start practically inaudibly.\\\" The \"\n        .. \"clarinet can play whisper-soft provided it is not written too high.\",\"BEL p.27\"},\n      {\"Who has the most power\",\"\\\"For sheer power, nothing has the force and impact \"\n        .. \"of high brass plus percussion.\\\"\",\"BEL p.27\"},\n    }},\n    {\"Making a dynamic change register\", {\n      {\"Skip a gradation\",\"\\\"For noticeable contrasts, skip at least one gradation. The \"\n        .. \"difference between mf and f is negligible. Moving from mp to f or mf to ff \"\n        .. \"will have a more dramatic impact.\\\" The concrete version of Belkin's advice to \"\n        .. \"work with four levels.\",\"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Players respond to extremes\",\"An expanded range from ppp to fff gets attention, \"\n        .. \"while p and mp are often ignored or under-played. If you want quiet, write pp \"\n        .. \"or ppp. Musicians answer wide contrasts more readily than subtle ones.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n      {\"Dynamics are relative, not absolute\",\"There is no decibel level that constitutes \"\n        .. \"forte; the loudness that results is set by the context and by the marks \"\n        .. \"around it. This is why orchestrating the level beats marking it.\",\n        \"ACTOR All Instruments: Effective Instrumental Writing\"},\n    }},\n    {\"How to notate them\", {\n      {\"Work with four levels\",\"\\\"A good approach is to act as though there are only \"\n        .. \"four dynamic levels: pp, mf, f, and ff.\\\"\",\"BEL p.27\"},\n      {\"Get the level from the scoring first\",\"\\\"Orchestrate the passage so that the \"\n        .. \"absolute dynamic level desired results naturally from the choice of \"\n        .. \"instruments and registers.\\\" Then treat the mark as a character \"\n        .. \"indication.\",\"BEL p.27\"},\n      {\"Avoid the middle as a starting point\",\"\\\"Avoid the middle dynamics (mp, mf) as \"\n        .. \"starting points: these are what players do when there are no dynamics \"\n        .. \"notated at all.\\\"\",\"BEL p.27\"},\n      {\"Per-instrument dynamics are advanced\",\"\\\"Beginners should avoid writing \"\n        .. \"different dynamics for different instruments; this requires a great deal of \"\n        .. \"experience: Players normally do not see each other's parts, and will not \"\n        .. \"adjust unless the conductor specifies otherwise.\\\" Set against \"\n        .. \"Rimsky-Korsakov's rule that horns be marked a degree louder than the rest \"\n        .. \"of the brass, and Mahler's practice of calibrating every instrument \"\n        .. \"separately: the technique is real, but it is not a beginner's \"\n        .. \"tool.\",\"BEL p.27-28; cf. RK p.23\"},\n    }},\n  },\n  related={\"balance\",\"form\",\"brass\",\"strings\",\"percussion\"},\n}\n\ne{ id=\"planes\", name=\"Planes of Tone\", family=\"Craft\", kind=\"topic\",\n  aliases={\"planes\",\"planes of tone\",\"plane of tone\",\"foreground\",\"background\",\n           \"texture\",\"layers\",\"layering\",\"accompaniment figuration\"},\n  summary=\"Tovey's term, and the organising idea of modern orchestration: \\\"one \"\n       .. \"instrument, or a blended group of instruments, not necessarily from the same \"\n       .. \"family, sharing one rhythmic outline\\\". Think in planes first, then decide \"\n       .. \"what each contains.\",\n  facts={\n    {\"Why it matters\",\"\\\"The listener cannot pay equal attention to several musical \"\n       .. \"strands for any length of time. Even in contrapuntal music, the ear jumps \"\n       .. \"from one part to another rather than following all the parts continuously\\\"\"},\n  },\n  sec={\n    {\"Making a plane hold together\", {\n      {\"Blend inside it\",\"Similarity of timbre and rhythm, close spacing with no large \"\n        .. \"gaps, and balance - all elements fairly equal in force.\",\"BEL p.40\"},\n      {\"Differentiate between them\",\"Contrast of register, timbre and/or rhythm.\",\"BEL p.40\"},\n      {\"Disparate timbres need tricks\",\"\\\"If there are disparate timbres, as in the \"\n        .. \"woodwind, special strategies, such as close overlapping, are required to \"\n        .. \"trick the ear into accepting the result as a unified whole.\\\" This is what \"\n        .. \"Rimsky-Korsakov's overlaying and enclosure are for.\",\"BEL p.40 & p.7\"},\n    }},\n    {\"The hierarchy\", {\n      {\"One foreground only\",\"\\\"Although multiple foreground planes are not possible, \"\n        .. \"multiple background planes can coexist.\\\" The foreground is usually louder, \"\n        .. \"strongly coloured and prominently placed - often on top.\",\"BEL p.41\"},\n      {\"Dialogue between equals\",\"Possible, but the planes must match in loudness \"\n        .. \"*and* in thickness; contrast then comes from colour, register and rhythm.\",\"BEL p.40\"},\n      {\"Two kinds of background\",\"Movement, and resonance.\",\"BEL p.41\"},\n    }},\n    {\"The four types of orchestral movement\", {\n      {\"Trills and tremolos\",\"Wagner's Ride of the Valkyries - trills in the winds \"\n        .. \"adding energy and momentum.\",\"BEL p.41\"},\n      {\"Repeated notes\",\"Beethoven's Fifth, second movement coda: the bassoon theme \"\n        .. \"over repeated string chords alternating with rests.\",\"BEL p.41\"},\n      {\"Scales\",\"Die Meistersinger overture - scales in the strings under a majestic \"\n        .. \"chordal theme in the winds.\",\"BEL p.42\"},\n      {\"Arpeggiation\",\"Brahms's Third, third movement - rocking arpeggio figures in \"\n        .. \"the strings.\",\"BEL p.42\"},\n      {\"How to keep them in their place\",\"\\\"They must not attract too much attention \"\n        .. \"on their own... usually limited to one or two mildly varied motives, with a \"\n        .. \"high degree of consistency, and do not involve too many varied timbres. \"\n        .. \"Often the accompaniment is lightened with rests.\\\"\",\"BEL p.42\"},\n      {\"Movement as direction\",\"Rising and falling passages can be reinforced by fast \"\n        .. \"runs, scales or harp glissandi in the same direction - and \\\"often takes \"\n        .. \"slightly different forms in different instruments, so as to create general \"\n        .. \"momentum rather than one thickly doubled line\\\".\",\"BEL p.42\"},\n    }},\n    {\"Resonance \u00e2\u0080\u0094 the quietest plane\", {\n      {\"It should not be noticed\",\"\\\"Resonance, the quietest of all planes, should not \"\n        .. \"be noticed on its own. Therefore it is characterized by the softest \"\n        .. \"timbres, the dullest registers, and the least activity.\\\"\",\"BEL p.43\"},\n      {\"Put it in the foreground\u00e2\u0080\u0099s register\",\"\\\"Resonance is usually in the same \"\n        .. \"register as the foreground, so as not to draw attention to itself as \"\n        .. \"something apart.\\\"\",\"BEL p.43\"},\n      {\"Depth is the mark of a master\",\"\\\"One sign of a master orchestrator is the \"\n        .. \"refinement and depth of his orchestral backgrounds.\\\" Where a background \"\n        .. \"has several elements, \\\"rests and intermittent motives help to space out \"\n        .. \"details, while maintaining clarity\\\".\",\"BEL p.44\"},\n    }},\n  },\n  related={\"resonance\",\"contrast\",\"doubling\",\"counterpoint\",\"tutti\",\"balance\"},\n}\n\ne{ id=\"resonance\", name=\"Sustained vs Dry Sound\", family=\"Craft\", kind=\"topic\",\n  aliases={\"resonance\",\"sustained\",\"dry\",\"wet\",\"sustain\",\"background resonance\",\n           \"held notes\",\"reverberation\",\"sustaining pedal\"},\n  summary=\"\\\"It is often remarked that the orchestra has no sustaining pedal.\\\" So \"\n       .. \"resonance has to be composed - and a texture with none, kept up for long, is \"\n       .. \"one of the named symptoms of poor orchestration.\",\n  sec={\n    {\"Composing resonance\", {\n      {\"It is a background layer by definition\",\"Literally it means the echo of a live \"\n        .. \"room - \\\"however, resonance can also be deliberately composed \"\n        .. \"orchestrally, and therefore individualized\\\".\",\"BEL p.33\"},\n      {\"Bach got there first\",\"He \\\"already shows sensitivity to the way a long held \"\n        .. \"note can enrich the texture\\\", and goes further, using such notes as \"\n        .. \"points of departure for important lines.\",\"BEL p.33\"},\n      {\"Ravel is the model\",\"The Epilogue of Valses nobles et sentimentales - held \"\n        .. \"strings set off by harp harmonics, \\\"a shimmering halo surrounding the main \"\n        .. \"motives in the winds. This conception of the background as delicate \"\n        .. \"vibration is omnipresent in Ravel.\\\"\",\"BEL p.33\"},\n      {\"Lines can dissolve into it\",\"A line that settles onto a held note becomes \"\n        .. \"resonance; a held note can equally become a doubling.\",\"BEL p.33 & p.38\"},\n    }},\n    {\"Dry sound\", {\n      {\"Effective, but not as a norm\",\"\\\"Although it is not good practice to \"\n        .. \"orchestrate for long without sustained sound, occasional dry passages can \"\n        .. \"be extraordinarily effective.\\\"\",\"BEL p.33\"},\n      {\"Wet and dry percussion\",\"Metal instruments are \\\"wet\\\", with substantial \"\n        .. \"reverberation - poor for quick precise rhythms, excellent for background \"\n        .. \"ambiance. Wooden instruments are \\\"dry\\\", for clarity and definition. \"\n        .. \"Membranes sit in between: low ones reverberate, high ones behave like \"\n        .. \"wood.\",\"BEL p.13 & p.33\"},\n      {\"It translates into articulation\",\"The wet/dry distinction is the same choice \"\n        .. \"as staccato against legato, seen from the rhythmic and motivic side.\",\"BEL p.33\"},\n    }},\n  },\n  related={\"planes\",\"percussion\",\"harp\",\"counterpoint\",\"quality\"},\n}\n\ne{ id=\"counterpoint\", name=\"Orchestrating Counterpoint\", family=\"Craft\", kind=\"topic\",\n  aliases={\"counterpoint\",\"contrapuntal\",\"fugue\",\"polyphony\",\"imitative\",\n           \"orchestrating counterpoint\",\"entries\"},\n  summary=\"Four problems, and Belkin's answers to each: balancing the lines, colouring \"\n       .. \"them, marking the entries, and stopping the result from sounding dry.\",\n  sec={\n    {\"Balancing the lines\", {\n      {\"Simplest strategy \u00e2\u0080\u0094 one family\",\"\\\"Assuming all the lines are of equal \"\n        .. \"importance, the simplest strategy is to give all the lines to the same \"\n        .. \"family, or, if a thicker sound is appropriate, families: Each line is \"\n        .. \"doubled by a similar combination of instruments.\\\" Beethoven's Seventh, \"\n        .. \"second movement, keeps all the counterpoint in the strings.\",\"BEL p.46-47\"},\n      {\"Different colours per line\",\"Requires the colours to be equal in loudness *and* \"\n        .. \"in thickness. \\\"This latter method can be tiring to the ear and is best used \"\n        .. \"for short passages\\\", and suits stratified counterpoint better than \"\n        .. \"consistent imitation.\",\"BEL p.47\"},\n    }},\n    {\"Marking the entries\", {\n      {\"Treat an entry as an accent\",\"\\\"In counterpoint with frequent imitative \"\n        .. \"entries, it is sometimes effective to treat the beginning of an important \"\n        .. \"entry as an accent, orchestrally enhancing the first few notes in some \"\n        .. \"way.\\\" Mahler's Fifth finale doubles the strings' first few notes with a \"\n        .. \"horn in a luminous register.\",\"BEL p.47\"},\n    }},\n    {\"Avoiding dryness\", {\n      {\"Add a harmonic plane behind it\",\"\\\"It is usually a good idea either to add a \"\n        .. \"complete harmonic plane of tone in the background, covering the middle \"\n        .. \"register in particular, or to leave sustained 'trailers' (held notes at the \"\n        .. \"end of a phrase) behind the main lines from time to time.\\\" The Baroque \"\n        .. \"continuo was in part an answer to the same problem.\",\"BEL p.47\"},\n      {\"Let doubling instruments change role\",\"Bassoons switching which line they \"\n        .. \"double, trombones stopping once they have marked an entry, horns leaving a \"\n        .. \"sustained note behind - \\\"thereby avoiding dryness\\\".\",\"BEL p.47\"},\n    }},\n  },\n  related={\"planes\",\"resonance\",\"tutti\",\"doubling\",\"woodwind\"},\n}\n\ne{ id=\"tutti\", name=\"The Tutti\", family=\"Craft\", kind=\"topic\",\n  aliases={\"tutti\",\"full orchestra playing\",\"everyone playing\",\"full tutti\",\n           \"organising a tutti\"},\n  summary=\"\\\"One can speak of a tutti when at least three of the four orchestral \"\n       .. \"families are present.\\\" The paradox: \\\"the more instruments are playing, the \"\n       .. \"less ways there are to combine them\\\", because acoustic balance closes off \"\n       .. \"most of the options.\",\n  sec={\n    {\"The three ways to organise one\", {\n      {\"1. Each family complete, part-writing independent\",\"\\\"This is the most common \"\n        .. \"method; it gives a rich sound, without grayness. The overall harmonic unity \"\n        .. \"guarantees coherence, and the differences between the families create \"\n        .. \"richness of color.\\\" Die Meistersinger's prelude: the winds begin by \"\n        .. \"doubling the violins and are adding their own detail by bar 7.\",\"BEL p.49-50\"},\n      {\"2. Each musical element to a distinct family\",\"\\\"This method has the advantage \"\n        .. \"of bringing out each musical element clearly, differentiating it from the \"\n        .. \"others through timbre.\\\" Tchaikovsky's Fifth finale: strings on the melody \"\n        .. \"in octaves, horns and winds on two counterpoints, repeated notes in low \"\n        .. \"brass and basses.\",\"BEL p.50-51\"},\n      {\"3. Literally double everything in every family\",\"\\\"While occasionally suitable \"\n        .. \"for short, vigorous passages, this method usually sounds heavy and \"\n        .. \"gray.\\\"\",\"BEL p.51-52\"},\n    }},\n    {\"Practicalities\", {\n      {\"Leave the middle empty when the brass is loud\",\"\\\"Sometimes winds and, more \"\n        .. \"rarely, strings, are left empty in the middle register when a large brass \"\n        .. \"section is very fully scored; they would not in any case be audible in this \"\n        .. \"register over the brass.\\\"\",\"BEL p.49\"},\n      {\"Differentiate the rhythm at least mildly\",\"\\\"As the number of instruments \"\n        .. \"increases, if all the instruments are moving on the same rhythmic plane, \"\n        .. \"the effect becomes more and more ponderous. Thus the need, even in a \"\n        .. \"homophonic tutti of any length, for at least mild rhythmic differentiation \"\n        .. \"between parts and families.\\\"\",\"BEL p.41\"},\n      {\"The soft tutti\",\"\\\"Usually tutti passages are loud, but the occasional soft \"\n        .. \"tutti can be very effective; the sound has something menacing about it, \"\n        .. \"like a great power restrained.\\\" Beethoven's Ninth, first movement, bar \"\n        .. \"469.\",\"BEL p.49\"},\n      {\"Everyone should play sometimes\",\"\\\"If one writes for orchestra, all the \"\n        .. \"instruments should play together at least some of the time.\\\" Against which: \"\n        .. \"most of the time only part of the orchestra should be playing.\",\"BEL p.49 & p.37\"},\n    }},\n  },\n  related={\"three_groups\",\"planes\",\"balance\",\"counterpoint\",\"quality\"},\n}\n\ne{ id=\"accompaniment\", name=\"Accompanying a Soloist\", family=\"Craft\", kind=\"topic\",\n  aliases={\"accompaniment\",\"accompanying\",\"soloist\",\"concerto\",\"orchestral accompaniment\",\n           \"accompany a soloist\",\"backing a soloist\"},\n  summary=\"\\\"The main problem is how to make full use of the orchestra, while not \"\n       .. \"drowning out the soloist. If the orchestra is too often reduced to discrete \"\n       .. \"murmuring in the background, the overall effect will be feeble.\\\"\",\n  sec={\n    {\"The principles\", {\n      {\"Win by contrast, not by retreat\",\"Contrast of timbre (violin solo against \"\n        .. \"woodwind), of register (accompany a 'cello solo with upper strings only), or \"\n        .. \"of rhythm (make the solo line more active than the accompaniment).\",\"BEL p.52\"},\n      {\"Aerate the texture\",\"\\\"Lighten the orchestra by aerating the texture with \"\n        .. \"frequent rests, plucked or staccato basses. Limit held notes in the \"\n        .. \"accompaniment to dull or weak registers.\\\"\",\"BEL p.53\"},\n      {\"Activity can substitute for weight\",\"A piano too weak to dominate can still \"\n        .. \"lead by \\\"sheer intensity of activity\\\" - fastest note values, runs covering \"\n        .. \"the orchestra's whole range.\",\"BEL p.53\"},\n      {\"Keep the relationship moving\",\"\\\"Sometimes use dialogue, sometimes have each \"\n        .. \"accompany the other.\\\"\",\"BEL p.54\"},\n      {\"For great force, alternate\",\"\\\"Present the soloist in alternation with the \"\n        .. \"orchestra: This gives the illusion of a confrontation between \"\n        .. \"equals.\\\"\",\"BEL p.55\"},\n      {\"Richness from many thin planes\",\"\\\"To avoid thinness in the orchestral writing, \"\n        .. \"create richness by multiple planes, even if each plane only contains a few \"\n        .. \"notes.\\\"\",\"BEL p.56\"},\n    }},\n    {\"With a singer\", {\n      {\"Double at the octave, not the unison\",\"\\\"Generally such doubling is less \"\n        .. \"obtrusive at the octave than at the unison\\\" - though unison doubling is \"\n        .. \"commoner in opera, partly because the orchestra is in the pit and the voices \"\n        .. \"on the stage.\",\"BEL p.57\"},\n      {\"What never to double\",\"\\\"Elaborate fiorituras should not be doubled, nor should \"\n        .. \"passages where detailed understanding of the words is critical: Doubling \"\n        .. \"obscures detail, and submerges the consonants necessary to clear \"\n        .. \"speech.\\\"\",\"BEL p.57\"},\n      {\"Activity covers a voice faster than volume\",\"Koechlin's point: \\\"normally \"\n        .. \"strings are ideal for accompanying the voice, but if they are playing \"\n        .. \"vigorous counterpoint they will cover the voice much more easily than if \"\n        .. \"they have long held notes\\\".\",\"BEL p.36\"},\n    }},\n  },\n  related={\"voice\",\"planes\",\"balance\",\"strings\",\"quality\"},\n}\n\ne{ id=\"quality\", name=\"Good and Poor Orchestration\", family=\"Craft\", kind=\"topic\",\n  aliases={\"good orchestration\",\"poor orchestration\",\"bad orchestration\",\"checklist\",\n           \"what is good orchestration\",\"mistakes\",\"common mistakes\",\"diagnosis\"},\n  summary=\"Belkin's two checklists, and the reason the second is needed: \\\"if the parts \"\n       .. \"are reasonably playable... it is almost as hard to write glaringly badly for \"\n       .. \"the orchestra as it is to write glowingly well\\\". Poor orchestration does not \"\n       .. \"announce itself - \\\"it only shows itself over fairly long spans or in repeated \"\n       .. \"listening\\\".\",\n  sec={\n    {\"Symptoms of poor orchestration\", {\n      {\"Feebleness of effect\",\"Not using the resources available for the character \"\n        .. \"wanted, or making contradictory gestures - adding instruments during a \"\n        .. \"diminuendo.\",\"BEL p.18\"},\n      {\"Aural fatigue\",\"Overuse of extreme registers or very distinctive colours; lack \"\n        .. \"of blend in harmonic masses.\",\"BEL p.18\"},\n      {\"Grayness\",\"Too much unison doubling.\",\"BEL p.18\"},\n      {\"Heaviness\",\"Too much doubling, or overloading the low register.\",\"BEL p.18\"},\n      {\"Consistently dry sound\",\"No background resonance anywhere. \\\"Dry sound can be \"\n        .. \"effective, but not as a norm.\\\"\",\"BEL p.18\"},\n      {\"Confusion among elements\",\"Poorly differentiated planes of tone.\",\"BEL p.18\"},\n      {\"Formal confusion\",\"Changes of timbre at arbitrary places, or changes not \"\n        .. \"proportional to the contrast required.\",\"BEL p.18\"},\n      {\"Lack of clear character\",\"\",  \"BEL p.18\"},\n    }},\n    {\"What good orchestration does\", {\n      {\"Makes formal sense\",\"Changes arrive at appropriate places with appropriate \"\n        .. \"degrees of contrast.\",\"BEL p.58\"},\n      {\"Supplies variety and freshness of colour\",\"Enough to maintain interest.\",\"BEL p.58\"},\n      {\"Enhances the phrasing\",\"\",  \"BEL p.58\"},\n      {\"Ensures every element is audible\",\"\",  \"BEL p.58\"},\n      {\"Gives every player something individual\",\"What Richard Strauss, writing of \"\n        .. \"Wagner, called \\\"the spiritual participation of the players\\\".\",\"BEL p.58\"},\n      {\"Is as easily playable as possible\",\"\\\"Always using the simplest means to create \"\n        .. \"the desired effect.\\\"\",\"BEL p.58\"},\n      {\"Is aurally rich\",\"Usually through multiple planes of tone.\",\"BEL p.58\"},\n      {\"Expresses a clear character\",\"\",  \"BEL p.58\"},\n      {\"Uses the whole ensemble effectively\",\"\",  \"BEL p.58\"},\n    }},\n    {\"The underlying point\", {\n      {\"Colour is not the main issue\",\"\\\"Color is not as important an issue in \"\n        .. \"orchestration as is commonly thought.\\\" What matters more: \\\"Color is less \"\n        .. \"the result of exotic timbres than of novelty in the context of the piece. \"\n        .. \"Even a familiar timbre like an oboe can sound striking and novel, provided \"\n        .. \"it has not been heard for a while. This is why Mozart's orchestration is \"\n        .. \"always so fresh, despite its limited number of colors.\\\"\",\"BEL p.32-33\"},\n      {\"Orchestration is composition\",\"\\\"Orchestration can bring out and enhance any \"\n        .. \"aspect of the music\\\" - and once that habit forms it becomes \\\"an integral \"\n        .. \"part of composition itself\\\". Compare Rimsky-Korsakov: \\\"orchestration is \"\n        .. \"part of the very soul of the work\\\".\",\"BEL p.58-59; cf. RK p.1\"},\n    }},\n  },\n  related={\"form\",\"planes\",\"contrast\",\"doubling\",\"character\"},\n}\n\n-- ============================================================================\n-- CHARACTER GLOSSARY (Belkin, Artistic Orchestration, Appendix 2)\n-- ============================================================================\n-- Belkin's own caveats apply to every entry below and are reproduced in the\n-- \"character\" entry. Used as a recipe book these become cliches; they are meant\n-- as a point of departure.\n\ne{ id=\"character\", name=\"Character: Scoring for a Mood\", family=\"Character\", kind=\"topic\",\n  aliases={\"character\",\"mood\",\"emotion\",\"feeling\",\"atmosphere\",\"character glossary\",\n           \"how to sound\",\"what sound for\",\"expression\"},\n  summary=\"The reverse lookup: start from the character you want and find the \"\n       .. \"orchestral resources that produce it. Belkin compiled this as a teaching \"\n       .. \"device - \\\"a list of character words, and orchestral suggestions for how to \"\n       .. \"express them\\\" - and warns clearly about how to use it.\",\n  sec={\n    {\"Read these caveats first\", {\n      {\"The words are approximate\",\"\\\"A word like 'lyrical' can imply many different \"\n        .. \"emotions, each of which would be orchestrated somewhat differently.\\\"\",\"BEL p.62\"},\n      {\"A point of departure, not a recipe book\",\"\\\"Used simplistically, the \"\n        .. \"combinations given here easily become cliches. Cliches quickly lose their \"\n        .. \"effect, and can even become inappropriately comic. (Think of the diminished \"\n        .. \"chord tremolos signifying danger, in silent films.)\\\"\",\"BEL p.62\"},\n      {\"Orchestration is not the only dimension\",\"\\\"Other aspects of the music, like \"\n        .. \"harmony, tempo, rhythm, etc., are equally important.\\\" The entries for \"\n        .. \"\\\"terrifying\\\" and \\\"brilliant\\\" are deliberately similar - \\\"the resulting \"\n        .. \"effect will depend strongly on the kind of harmony used\\\".\",\"BEL p.62\"},\n      {\"Everything must pull the same way\",\"\\\"One characteristic of weak music is the \"\n        .. \"way certain aspects of the music contribute nothing, or even distract from \"\n        .. \"the desired effect.\\\"\",\"BEL p.62\"},\n      {\"Make your own\",\"The method matters more than the list: \\\"list every orchestral \"\n        .. \"resource which can contribute to creating a given character\\\". Belkin \"\n        .. \"suggests similar glossaries for harmony, rhythm and the rest.\",\"BEL p.60 & p.62\"},\n    }},\n    {\"The characters covered\", {\n      {\"Search any of these directly\",\"Luminous \u00c2\u00b7 Mysterious \u00c2\u00b7 Menacing \u00c2\u00b7 Terrifying \"\n        .. \"\u00c2\u00b7 Brilliant \u00c2\u00b7 Splendid \u00c2\u00b7 Dramatic \u00c2\u00b7 Funereal \u00c2\u00b7 Playful \u00c2\u00b7 Sad.\",\"BEL p.62-64\"},\n    }},\n  },\n  related={\"luminous\",\"mysterious\",\"menacing\",\"terrifying\",\"brilliant\",\"splendid\",\n           \"dramatic\",\"funereal\",\"playful\",\"sad\"},\n}\n\ne{ id=\"luminous\", name=\"Luminous\", family=\"Character\", kind=\"mood\",\n  aliases={\"luminous\",\"radiant\",\"glowing\",\"shimmering\",\"light\",\"luminosity\"},\n  summary=\"\\\"This character requires two elements: a soft background, usually sustained \"\n       .. \"strings, and another element to add 'light'.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"The background\",\"Soft sustained strings.\",\"BEL p.62\"},\n      {\"Soft medium-high trumpets or horns\",\"One of the three ways to add the light.\",\"BEL p.62\"},\n      {\"Flutes, medium-high, not too loud\",\"\",  \"BEL p.62\"},\n      {\"Touches of high metal percussion\",\"Suspended cymbal, glockenspiel - \\\"again, \"\n        .. \"not too loud\\\".\",\"BEL p.62\"},\n    }},\n    {\"Related craft\", {\n      {\"Woodwind doubling an octave above strings adds luminosity\",\"An oboe doubling \"\n        .. \"the second violins \\\"helps it to emerge more clearly, and makes it \"\n        .. \"brighter\\\".\",\"BEL p.9\"},\n    }},\n  },\n  related={\"character\",\"strings\",\"horn\",\"trumpet\",\"flute\",\"glockenspiel\",\"resonance\"},\n}\n\ne{ id=\"mysterious\", name=\"Mysterious\", family=\"Character\", kind=\"mood\",\n  aliases={\"mysterious\",\"mystery\",\"eerie\",\"veiled\",\"ethereal\",\"enigmatic\",\"misty\"},\n  summary=\"\\\"Mystery comes from lack of clarity. Appropriate sounds include very \"\n       .. \"delicate background resonance (sustained sound) and/or very quiet movement, \"\n       .. \"not too thickly spaced.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Muted strings\",\"\",  \"BEL p.62-63\"},\n      {\"String harmonics\",\"\",  \"BEL p.63\"},\n      {\"Low flutes\",\"\",  \"BEL p.63\"},\n    }},\n    {\"Related craft\", {\n      {\"A gentle cymbal crescendo adds mystery to a background\",\"Belkin's own example \"\n        .. \"pairs a rising harp and clarinet with one.\",\"BEL p.32\"},\n      {\"Held string harmonics as resonance\",\"\\\"Delicate held notes in violins \"\n        .. \"(harmonics) and violas provide mysterious background resonance.\\\"\",\"BEL p.44\"},\n    }},\n  },\n  related={\"character\",\"strings\",\"flute\",\"harp\",\"cymbals\",\"resonance\"},\n}\n\ne{ id=\"menacing\", name=\"Menacing\", family=\"Character\", kind=\"mood\",\n  aliases={\"menacing\",\"threatening\",\"ominous\",\"foreboding\",\"dread\",\"sinister\"},\n  summary=\"\\\"Certain sounds, often starting softly and making a crescendo, which evoke \"\n       .. \"natural threats (e.g. earthquakes, eruptions) are very potent.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Low drums, rolls or rhythmic patterns\",\"\\\"Create an almost primeval, \"\n        .. \"threatening effect.\\\"\",\"BEL p.63\"},\n      {\"Low, closely spaced strings and/or woodwinds, muted brass\",\"\",  \"BEL p.63\"},\n      {\"Extreme low sounds, soft\",\"Tam-tam, bass drum.\",\"BEL p.63\"},\n    }},\n    {\"Related craft\", {\n      {\"The soft tutti\",\"\\\"The occasional soft tutti can be very effective; the sound \"\n        .. \"has something menacing about it, like a great power restrained.\\\"\",\"BEL p.49\"},\n    }},\n  },\n  related={\"character\",\"timpani\",\"bassdrum\",\"gong\",\"strings\",\"brass\",\"tutti\"},\n}\n\ne{ id=\"terrifying\", name=\"Terrifying, Angry, Savage\", family=\"Character\", kind=\"mood\",\n  aliases={\"terrifying\",\"terror\",\"angry\",\"anger\",\"savage\",\"violent\",\"fury\",\"harsh\",\n           \"frightening\"},\n  summary=\"\\\"Loud and piercing sounds, which often resemble animal cries, harsh and \"\n       .. \"strident.\\\" Note that Belkin's scoring for this and for \\\"brilliant\\\" is \"\n       .. \"deliberately similar - the harmony decides which one you get.\",\n  sec={\n    {\"Scoring it\", {\n      {\"High, dissonant woodwinds and/or brass\",\"\\\"Perhaps in insistent repeated notes \"\n        .. \"or trills.\\\"\",\"BEL p.63\"},\n      {\"High, dry percussion\",\"A loud xylophone; cymbal roll crescendos.\",\"BEL p.63\"},\n    }},\n    {\"Related craft\", {\n      {\"Loud muted brass is in a class of its own\",\"\\\"When loud, their strident sound \"\n        .. \"puts them in a class of their own.\\\"\",\"BEL p.13\"},\n      {\"Instruments strained within their range\",\"Trumpets and horns high *for them*, \"\n        .. \"though not high absolutely, create \\\"an effect of intensity and \"\n        .. \"strain\\\".\",\"BEL p.30\"},\n    }},\n  },\n  related={\"character\",\"brilliant\",\"woodwind\",\"brass\",\"xylophone\",\"cymbals\",\"range\"},\n}\n\ne{ id=\"brilliant\", name=\"Brilliant\", family=\"Character\", kind=\"mood\",\n  aliases={\"brilliant\",\"brilliance\",\"dazzling\",\"virtuosic\",\"sparkling\",\"glittering\"},\n  summary=\"\\\"Often suggests a certain virtuosity, speed.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Brass in their high registers, open intervals\",\"\\\"In fast figuration, e.g. \"\n        .. \"repeated notes, trills.\\\"\",\"BEL p.63\"},\n      {\"Brass crescendos\",\"\",  \"BEL p.63\"},\n      {\"Fast rising lines in strings and woodwinds\",\"\",  \"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"One piccolo is enough at the top\",\"\\\"Even in a large tutti, one piccolo in its \"\n        .. \"highest register will penetrate without difficulty.\\\" The number of \"\n        .. \"instruments needed at the extremes is much smaller than in the \"\n        .. \"middle.\",\"BEL p.29\"},\n      {\"Movement in the direction of the line\",\"Fast runs, scales and harp glissandi \"\n        .. \"reinforce a rising or falling passage.\",\"BEL p.42\"},\n    }},\n  },\n  related={\"character\",\"terrifying\",\"brass\",\"piccolo\",\"strings\",\"harp\",\"planes\"},\n}\n\ne{ id=\"splendid\", name=\"Splendid, Rich, Triumphant\", family=\"Character\", kind=\"mood\",\n  aliases={\"splendid\",\"rich\",\"triumphant\",\"majestic\",\"noble\",\"grand\",\"heroic\",\n           \"glorious\"},\n  summary=\"\\\"Requires a mass of instruments, suggesting generosity and richness.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Tutti with sustained brass\",\"\\\"Closely spaced in upper middle register \"\n        .. \"(especially horns, in the range of the alto voice), along with high strings, \"\n        .. \"in octaves.\\\"\",\"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"Why the horns sit there\",\"\\\"The best arrangement for horns in harmony is: three \"\n        .. \"or four horns, in close position, in the range of the alto voice.\\\" \"\n        .. \"Sometimes the fourth doubles the first an octave lower.\",\"BEL p.11\"},\n      {\"Which tutti method\",\"Each family complete but independently written gives \\\"a \"\n        .. \"rich sound, without grayness\\\"; literal doubling of everything \\\"usually \"\n        .. \"sounds heavy and gray\\\".\",\"BEL p.49 & p.51-52\"},\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s heavy brass layout\",\"2 horns + tuba on the bass in octaves, \"\n        .. \"three trombones above: \\\"beautiful full resonance\\\".\",\"RK p.83\"},\n    }},\n  },\n  related={\"character\",\"tutti\",\"horn\",\"brass\",\"strings\",\"three_groups\"},\n}\n\ne{ id=\"dramatic\", name=\"Dramatic\", family=\"Character\", kind=\"mood\",\n  aliases={\"dramatic\",\"drama\",\"theatrical\",\"striking\",\"startling\"},\n  summary=\"\\\"Sudden contrasts in register, timbre, and dynamics.\\\" The shortest entry in \"\n       .. \"Belkin's glossary, and the one that leans hardest on the rest of the book.\",\n  sec={\n    {\"Scoring it\", {\n      {\"Sudden contrast in all three dimensions at once\",\"Register, timbre and \"\n        .. \"dynamics together.\",\"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"Grade the contrast deliberately\",\"Use the five-group scale of timbral contrast \"\n        .. \"- \\\"too great a contrast will create an inappropriate break in the music; \"\n        .. \"too small a contrast will deprive the music of necessary \"\n        .. \"punctuation\\\".\",\"BEL p.23-25\"},\n      {\"High against low sections\",\"\\\"The contrast of low and high chords provides a \"\n        .. \"simple but dramatic contrast\\\" - Brahms's Fourth, third movement.\",\"BEL p.29\"},\n      {\"Help the ear after a fortissimo\",\"Hold one or two instruments over for a few \"\n        .. \"beats, or the first quiet notes will pass unnoticed.\",\"BEL p.25\"},\n    }},\n  },\n  related={\"character\",\"contrast\",\"form\",\"range\",\"dynamics\"},\n}\n\ne{ id=\"funereal\", name=\"Funereal\", family=\"Character\", kind=\"mood\",\n  aliases={\"funereal\",\"funeral\",\"mourning\",\"solemn\",\"lament\",\"dirge\",\"march funebre\"},\n  summary=\"\\\"Heavy, dragging sounds, suggesting a mourning procession.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Low register brass and winds playing slowly\",\"\",  \"BEL p.64\"},\n      {\"Timpani or bass drum dotted rhythms\",\"\",  \"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"Low horns for slow pedals only\",\"\\\"The horns' lowest notes are best reserved \"\n        .. \"for slow moving pedal passages; they are not suitable for mobile bass lines, \"\n        .. \"which they tend to render ponderous.\\\" Here that ponderousness is the \"\n        .. \"point.\",\"BEL p.11\"},\n      {\"The dark low orchestra\",\"Contrabassoon, low bassoons, bass clarinet, horns, \"\n        .. \"trombones and tuba - Rimsky-Korsakov's combination for the bottom of the \"\n        .. \"orchestra, \\\"dark and gloomy\\\".\",\"RK p.106\"},\n    }},\n  },\n  related={\"character\",\"brass\",\"timpani\",\"bassdrum\",\"contrabassoon\",\"range\"},\n}\n\ne{ id=\"playful\", name=\"Playful, Funny\", family=\"Character\", kind=\"mood\",\n  aliases={\"playful\",\"funny\",\"comic\",\"humorous\",\"lightness\",\"scherzando\",\"witty\",\n           \"grotesque\"},\n  summary=\"\\\"The key here is lightness, unless a grotesque effect is wanted.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Lots of rests\",\"\",  \"BEL p.64\"},\n      {\"High, staccato sounds\",\"\",  \"BEL p.64\"},\n      {\"Avoid sustained sounds in brass\",\"\",  \"BEL p.64\"},\n      {\"Pizzicato\",\"\",  \"BEL p.64\"},\n      {\"Bassoon staccato\",\"\",  \"BEL p.64\"},\n      {\"For grotesque, use caricature\",\"\\\"Instruments playing passagework \"\n        .. \"characteristic of others, e.g. a tuba playing a comic line which would \"\n        .. \"normally be given to the bassoon.\\\"\",\"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"The bassoon\u00e2\u0080\u0099s comic register\",\"Its medium and lower staccato notes have \\\"a \"\n        .. \"certain grotesqueness bordering on awkwardness\\\" (Lavignac); Humperdinck has \"\n        .. \"it comment on the stage action in Hansel und Gretel.\",\"SIN p.95 & p.98\"},\n      {\"Gaps are allowed here\",\"Large registral gaps \\\"may be effective in one \"\n        .. \"situation, for example a quiet, playful passage, but not in another, where \"\n        .. \"fullness and richness are required\\\".\",\"BEL p.4\"},\n    }},\n  },\n  related={\"character\",\"bassoon\",\"pizzicato\",\"tuba\",\"woodwind\",\"range\"},\n}\n\ne{ id=\"sad\", name=\"Sad, Melancholy, Poignant\", family=\"Character\", kind=\"mood\",\n  aliases={\"sad\",\"sadness\",\"melancholy\",\"poignant\",\"mournful\",\"wistful\",\"sorrowful\",\n           \"elegiac\",\"plaintive\"},\n  summary=\"\\\"Often suggests an individual (solo) lamenting, or discouragement, \"\n       .. \"weakness.\\\"\",\n  sec={\n    {\"Scoring it\", {\n      {\"Slow, sustained strings in the lower register\",\"\",  \"BEL p.64\"},\n      {\"A wind solo over sustained strings\",\"\\\"Especially oboe or clarinet, or low \"\n        .. \"flute.\\\"\",\"BEL p.64\"},\n    }},\n    {\"Related craft\", {\n      {\"Which solo instrument\",\"The oboe's \\\"natural tone is of a gentle sadness and a \"\n        .. \"resigned endurance\\\" (Lavignac); the English horn is \\\"essentially sad, \"\n        .. \"melancholy, sorrowful\\\", superior to all others \\\"in exciting regret\\\" \"\n        .. \"(Berlioz); the viola runs \\\"from sad reverie to agonized pathos\\\".\",\"SIN p.85, p.89, p.52\"},\n      {\"The reference cases\",\"Dvorak's New World Largo - English horn over muted \"\n        .. \"strings. Tristan Act III - the shepherd's melody on \\\"the saddest voice in \"\n        .. \"the orchestra\\\".\",\"SIN p.90\"},\n      {\"A solo line must stay solo\",\"Doubling it will weaken exactly the quality you \"\n        .. \"want: \\\"a line whose character requires a solo sound will be less effective \"\n        .. \"when doubled\\\".\",\"BEL p.7\"},\n    }},\n  },\n  related={\"character\",\"oboe\",\"englishhorn\",\"clarinet\",\"flute\",\"viola\",\"strings\"},\n}\n\n-- ============================================================================\n-- VOICES\n-- ============================================================================\n\ne{ id=\"voice\", name=\"Solo Voice with Orchestra\", family=\"Voices\", kind=\"section\",\n  aliases={\"voice\",\"voices\",\"singer\",\"solo voice\",\"soprano\",\"mezzo\",\"mezzo-soprano\",\n           \"contralto\",\"alto\",\"tenor\",\"baritone\",\"bass voice\",\"accompanying the voice\",\n           \"aria\"},\n  summary=\"\\\"In accompanying the voice orchestral scoring should be light enough for the \"\n       .. \"singer to make free use of all the dynamic shades of expression without hardness \"\n       .. \"of tone.\\\" The six principal solo voices are soprano, mezzo-soprano, contralto, \"\n       .. \"tenor, baritone and bass.\",\n  sec={\n    {\"Doubling the voice\", {\n      {\"Women\u00e2\u0080\u0099s voices in unison\",\"Violins, violas, clarinets and oboes - \\\"the most \"\n        .. \"natural duplication\\\".\",\"RK p.122\"},\n      {\"Men\u00e2\u0080\u0099s voices in unison\",\"Violas, 'cellos, bassoons and horns.\",\"RK p.122\"},\n      {\"Octaves\",\"Doubling in octaves is usually done in the upper register.\",\"RK p.122\"},\n      {\"Keep it brief\",\"\\\"Uninterrupted or too frequent duplication should be avoided\\\" - \"\n        .. \"it robs the singer of freedom and replaces the rare quality of the human voice \"\n        .. \"with a mixed timbre. Limited to a few phrases it \\\"supports the voice and endows \"\n        .. \"it with beauty and colour\\\".\",\"RK p.122\"},\n      {\"Only in tempo\",\"Doubling in unison or octaves \\\"is only suitable in tempo; to apply \"\n        .. \"it to a passage ad lib. is both ineffective and dangerous\\\".\",\"RK p.122-123\"},\n    }},\n    {\"Transparency \u00e2\u0080\u0094 what is safe to accompany with\", {\n      {\"The order\",\"\\\"The group of strings is the most transparent medium and the one least \"\n        .. \"likely to overpower the voice. Then come the wood-wind and the brass, the latter \"\n        .. \"in the following order: horns, trombones, trumpets.\\\"\",\"RK p.120\"},\n      {\"The best setting\",\"Strings pizzicato + harp.\",\"RK p.120\"},\n      {\"Short beats sustained ones\",\"\\\"As a general rule a singer is more easily overpowered \"\n        .. \"by long sustained notes than by short detached ones.\\\"\",\"RK p.120\"},\n      {\"Where sustained harmony is safe\",\"Between the 2nd octave and the middle of the 3rd \"\n        .. \"it overpowers neither women's nor men's voices.\",\"RK p.121\"},\n      {\"Reduce as the voice does\",\"As the singer moves from cantabile into declamation, thin \"\n        .. \"or drop harmony that has become too heavy; support broad phrases and climaxes \"\n        .. \"with a fuller tone.\",\"RK p.121-122\"},\n    }},\n    {\"Solo instrument with a solo voice\", {\n      {\"Which instruments\",\"Violin, viola, 'cello; flute, oboe, English horn, clarinet, bass \"\n        .. \"clarinet, bassoon, horn, harp. \\\"In combination with the voice... a solo \"\n        .. \"instrument is a powerful expedient for musical characterisation.\\\"\",\"RK p.124\"},\n      {\"Rimsky-Korsakov\u00e2\u0080\u0099s own pairs\",\"Soprano + oboe; contralto + English horn; baritone + \"\n        .. \"bass clarinet; soprano + viola; soprano, 'cello and oboe together.\",\"RK p.124\"},\n    }},\n    {\"Duet spacing\", {\n      {\"Related within an octave\",\"Sopr./Ten., M.-sopr./Bar., C.-alto/Bass - move in tenths, \"\n        .. \"sixths, thirds or octaves; rarely separated by more than a tenth.\",\"RK p.139-140\"},\n      {\"Related in fifths and fourths\",\"Sopr./C.-alto, C.-alto/Ten., Ten./Bass - keep them \"\n        .. \"closer; common in sixths and thirds, rare in tenths, and they may go in unison.\",\"RK p.140\"},\n      {\"Related in thirds\",\"Sopr./M.-sopr., M.-sopr./C.-alto, Ten./Bass, Bar./Bass - unison, \"\n        .. \"thirds and sixths, with much crossing of parts.\",\"RK p.140-141\"},\n      {\"Related in twelfths\",\"Sopr./Bass - avoid close intervals and thirds; use sixths, \"\n        .. \"tenths and thirteenths; no crossing.\",\"RK p.141\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Brass on the melody\",\"Trombones and trumpets overpower the voice and cannot double \"\n        .. \"it.\",\"RK p.122\"},\n      {\"Doubled groups\",\"Strings doubled in wood and brass, and brass doubled by woodwind, \"\n        .. \"\\\"are combinations liable to drown the singer\\\"; so is a timpani tremolo.\",\"RK p.120-121\"},\n      {\"Two like instruments as one part\",\"\\\"Doubling of wood-wind and horns, and the use of \"\n        .. \"two clarinets, two oboes or two horns in unison to form one harmonic part is \"\n        .. \"likewise to be avoided.\\\"\",\"RK p.121\"},\n      {\"Long low bass notes\",\"Frequent sustained double-bass notes under a voice \\\"produce a \"\n        .. \"peculiar throbbing effect\\\".\",\"RK p.121\"},\n      {\"Rhythmic imitation\",\"When the vocal part is busy, do not write rhythmic figures in \"\n        .. \"the orchestra that correspond to it; leave the voice free.\",\"RK p.119\"},\n    }},\n\n    {\"Belkin\u00e2\u0080\u0099s practical notes\", {\n      {\"Plan the climaxes around singable words\",\"\\\"Singing, by nature, strongly \"\n        .. \"distorts words in favor of vowels; consonants function mainly as \"\n        .. \"articulation.\\\" The voice cannot open out on a closed vowel like the French \"\n        .. \"u, so \\\"climactic passages must be planned around important words, which also \"\n        .. \"permit the voice to sing out\\\".\",\"BEL p.16-17\"},\n      {\"Follow the spoken phrase\",\"\\\"The rhythm, accentuation, and contour of the vocal \"\n        .. \"line should follow that of the words, well spoken. They may exaggerate, but \"\n        .. \"should not contradict\\\" it.\",\"BEL p.17\"},\n      {\"Agility is a special effect\",\"\\\"Voices need time to open out to their full sound; \"\n        .. \"therefore very agile and/or staccato writing is a rare, special \"\n        .. \"effect.\\\"\",\"BEL p.17\"},\n      {\"Stay in the middle\",\"\\\"More than any other instrument, voices require writing in \"\n        .. \"the middle of their range most of the time, to avoid discomfort. Very low and \"\n        .. \"(especially) very high writing should be reserved for special \"\n        .. \"moments.\\\"\",\"BEL p.17\"},\n      {\"Trombones are the gentlest brass here\",\"In the baritone register, close-written \"\n        .. \"trombones are lighter than horns - useful when brass must accompany a \"\n        .. \"voice.\",\"BEL p.12\"},\n    }},\n  },\n  related={\"chorus\",\"strings\",\"harp\",\"pizzicato\",\"englishhorn\",\"oboe\",\"cello\"},\n}\n\ne{ id=\"chorus\", name=\"Chorus with Orchestra\", family=\"Voices\", kind=\"section\",\n  aliases={\"chorus\",\"choir\",\"choral\",\"mixed chorus\",\"womens chorus\",\"mens chorus\",\n           \"chorus with orchestra\",\"sopranos\",\"altos\",\"tenors\",\"basses\"},\n  summary=\"\\\"The chorus, possessing much greater unity and power than the solo voice, does \"\n       .. \"not demand such careful handling in the accompaniment. On the contrary, too great \"\n       .. \"a refinement of orchestral treatment will prove harmful to the resonance of the \"\n       .. \"chorus.\\\" Choral scoring follows the rules for purely instrumental writing.\",\n  facts={\n    {\"Numbers\",\"Full chorus: 32 singers to each of the four parts. Medium: 16-20. Small: \"\n      .. \"8-10. Women often predominate, and the firsts outnumber the seconds\"},\n  },\n  sec={\n    {\"Pairings in unison\", {\n      {\"Sopranos + Altos\",\"\\\"The simplest and most natural combination\\\" - ample and \"\n        .. \"vigorous, and good for bringing out a melody in the upper part.\",\"RK p.145\"},\n      {\"Tenors + Basses\",\"As above, for the bass part.\",\"RK p.145\"},\n    }},\n    {\"Doublings in octaves\", {\n      {\"8 [Sopranos / Tenors]\",\"\\\"The most beautiful and natural combinations\\\"; the tone is \"\n        .. \"both brilliant and powerful.\",\"RK p.145\"},\n      {\"8 [Altos / Basses]\",\"As above.\",\"RK p.145\"},\n      {\"8 [Sopr + Altos / Ten + Basses]\",\"\\\"A beautifully round tone.\\\"\",\"RK p.146\"},\n      {\"8 [Sopr/Altos in 3rds / Ten/Basses in 3rds]\",\"\\\"Brilliance and vigour is achieved\\\" \"\n        .. \"when sopranos and altos in thirds are doubled an octave below by tenors and \"\n        .. \"basses in thirds.\",\"RK p.146\"},\n    }},\n    {\"Orchestrating around it\", {\n      {\"Doubling choral parts\",\"\\\"Generally a good plan.\\\" In cantabile passages the \"\n        .. \"duplication may be melodic, with the orchestral design more ornamental than the \"\n        .. \"chorus's.\",\"RK p.126\"},\n      {\"What to double\",\"Not the repeated notes required by declamation - double the melodic \"\n        .. \"or harmonic basis only. Sometimes the choral rhythm is simplified against its \"\n        .. \"orchestral duplication.\",\"RK p.127\"},\n      {\"Isolated exclamations\",\"Melodic doubling is not always suitable; support the voices \"\n        .. \"with harmonic duplication instead.\",\"RK p.127\"},\n      {\"A cappella passages\",\"Choral writing complete in itself often stays undoubled, \"\n        .. \"accompanied only by sustained notes or an independent polyphonic figure.\",\"RK p.127\"},\n      {\"Weight by chorus type\",\"Heavier scoring for a mixed chorus; lighter for men's \"\n        .. \"voices; lighter still for women's alone. A chorus in the wings needs as light an \"\n        .. \"accompaniment as a solo singer.\",\"RK p.128\"},\n      {\"What can beat a chorus\",\"\\\"A ff passage on an enlarged orchestra, comprising \"\n        .. \"wood-wind in fours, and numerous brass (sometimes in three's), is capable of \"\n        .. \"overpowering a large mixed chorus.\\\"\",\"RK p.128\"},\n      {\"Unlike the orchestra\",\"Doubling like instruments in unison - 2 Ob, 2 Cl, 4 Horns, 3 \"\n        .. \"Trombones - is perfectly possible under a chorus, where it would be avoided under \"\n        .. \"a solo voice.\",\"RK p.126\"},\n    }},\n    {\"Balanced forte chord in close harmony\", {\n      {\"The layout\",\"Sopr I / Sopr II / Altos, doubled an octave below by Ten I / Ten II / \"\n        .. \"Basses I, with Basses II independent on the bottom. \\\"In this manner the tenors \"\n        .. \"sing in the soprano octave, the 1st basses in the alto octave and the 2nd basses \"\n        .. \"are independent.\\\"\",\"RK p.147\"},\n      {\"Wide spacing is more natural\",\"Purely harmonic four-part choral writing \\\"is more \"\n        .. \"natural and resonant when the harmony is of the widely divided order\\\", so each \"\n        .. \"voice sits in its proper register.\",\"RK p.146 & p.141\"},\n      {\"Strengthen the middle\",\"In three-part choruses double the middle part; giving the \"\n        .. \"upper part to the firsts and dividing the seconds for the two lower parts \\\"can \"\n        .. \"never be equal\\\".\",\"RK p.148-149 & p.151\"},\n    }},\n    {\"Use sparingly\", {\n      {\"Altos + Tenors in unison\",\"\\\"Produces a peculiar mixed tone quality, somewhat \"\n        .. \"bizarre and seldom used.\\\"\",\"RK p.145\"},\n      {\"Sopr/Altos or Ten/Basses in octaves\",\"\\\"Seldom practised\\\" - the registers do not \"\n        .. \"give the balance you get from voices of distinctive kind.\",\"RK p.145-146\"},\n      {\"Dividing like voices in octaves\",\"8 [Sopr I / Sopr II] etc. is seldom done, except \"\n        .. \"perhaps in the basses where the part-writing demands it.\",\"RK p.146\"},\n      {\"A female chorus\u00e2\u0080\u0099s bass\",\"A women's chorus does not normally carry the real harmonic \"\n        .. \"bass when that lies low; give the harmony to the three upper parts and let the \"\n        .. \"lowest act as accompanying bass - watching for empty fourths and fifths.\",\"RK p.151\"},\n    }},\n  },\n  related={\"voice\",\"strings\",\"woodwind\",\"brass\"},\n}\n\n-- ============================================================================\n\nreturn D\n"};

/* ---- kit/runtime/polyfill.js ---- */
/* What JavaScriptCore lacks and the Lua runtime uses: TextEncoder and
 * TextDecoder, UTF-8 only, as the web defines them (an invalid byte decodes
 * to U+FFFD and decoding goes on). Installed only where they are missing, so
 * Node and browsers keep their own; MiddawUTF8 is the same code, always, for
 * the tests to hold against the real thing.
 */
(function (G) {
  'use strict';
  function encode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        else c = 0xFFFD;
      } else if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  function decode(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    var out = '', i = 0, n = b.length;
    while (i < n) {
      var c = b[i], need = 0, cp = 0, min = 0;
      if (c < 0x80) { out += String.fromCharCode(c); i++; continue; }
      else if (c >= 0xC2 && c <= 0xDF) { need = 1; cp = c & 0x1F; min = 0x80; }
      else if (c >= 0xE0 && c <= 0xEF) { need = 2; cp = c & 0x0F; min = 0x800; }
      else if (c >= 0xF0 && c <= 0xF4) { need = 3; cp = c & 0x07; min = 0x10000; }
      else { out += '�'; i++; continue; }
      var j = 1, ok = true;
      for (; j <= need; j++) {
        if (i + j >= n) { ok = false; break; }
        var x = b[i + j];
        // the second byte's range is narrower for a few leads (no overlongs, no surrogates)
        var lo = 0x80, hi = 0xBF;
        if (j === 1) {
          if (c === 0xE0) lo = 0xA0; else if (c === 0xED) hi = 0x9F;
          else if (c === 0xF0) lo = 0x90; else if (c === 0xF4) hi = 0x8F;
        }
        if (x < lo || x > hi) { ok = false; break; }
        cp = (cp << 6) | (x & 0x3F);
      }
      if (!ok || cp < min) { out += '�'; i += Math.max(1, j); continue; }
      if (cp >= 0x10000) { cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
      else out += String.fromCharCode(cp);
      i += need + 1;
    }
    return out;
  }
  function Enc() {}
  Enc.prototype.encode = function (s) { return encode(String(s === undefined ? '' : s)); };
  function Dec() {}
  Dec.prototype.decode = function (b) { return decode(b); };
  G.MiddawUTF8 = { TextEncoder: Enc, TextDecoder: Dec };
  if (typeof G.TextEncoder === 'undefined') G.TextEncoder = Enc;
  if (typeof G.TextDecoder === 'undefined') G.TextDecoder = Dec;
})(typeof globalThis !== 'undefined' ? globalThis : this);


/* ---- kit/runtime/lua_parse.js ---- */
/* Middaw's Lua 5.4, part 1 of 3: the lexer and the parser.
 *
 * Middaw runs the family's Lua engines (Good Idea, Midi Suggester, Midi
 * Variator, Midi Catalogue, Starting Blocks, DAW Battle Pass...) unchanged, in
 * the browser, with no third-party code: this file reads Lua source into a
 * syntax tree, lua_compile.js turns the tree into JavaScript, lua_runtime.js
 * supplies the values and the standard library. tests/js/test_lua.js holds
 * all three to what the real Lua 5.4 prints for the same programs.
 *
 * Source is a "byte string": one JS character per byte of the file, which is
 * how Lua itself sees a string, so `#s` and string.sub count bytes as Lua does.
 */
(function (NS) {
  'use strict';

  var KEYWORDS = {};
  ('and break do else elseif end false for function goto if in local nil not ' +
   'or repeat return then true until while').split(' ').forEach(function (k) { KEYWORDS[k] = true; });

  function LuaSyntaxError(message, chunk, line) {
    this.message = chunk + ':' + line + ': ' + message;
    this.line = line;
  }
  LuaSyntaxError.prototype = Object.create(Error.prototype);
  LuaSyntaxError.prototype.name = 'LuaSyntaxError';

  function isDigit(c) { return c >= 48 && c <= 57; }
  function isHex(c) { return isDigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); }
  function isAlpha(c) { return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95; }
  function isSpace(c) { return c === 32 || (c >= 9 && c <= 13); }

  // ---------------------------------------------------------------- lexer --
  function lex(src, chunk) {
    var toks = [];
    var i = 0, n = src.length, line = 1;
    function err(msg) { throw new LuaSyntaxError(msg, chunk, line); }
    function longBracketLevel(at) {   // at points to '['; returns level or -1
      var j = at + 1, level = 0;
      while (src.charCodeAt(j) === 61) { level++; j++; }
      return src.charCodeAt(j) === 91 ? level : -1;
    }
    function readLong(at, level) {    // returns [content, end index]
      var start = at + level + 2;
      // a newline straight after the opening bracket is skipped
      if (src[start] === '\r') { start++; if (src[start] === '\n') start++; }
      else if (src[start] === '\n') { start++; if (src[start] === '\r') start++; }
      var close = ']' + '='.repeat(level) + ']';
      var end = src.indexOf(close, start);
      if (end < 0) err('unfinished long string');
      var body = src.slice(start, end);
      for (var k = at; k < end + close.length; k++) if (src.charCodeAt(k) === 10) line++;
      return [body, end + close.length];
    }
    while (i < n) {
      var c = src.charCodeAt(i);
      if (c === 10) { line++; i++; continue; }
      if (isSpace(c)) { i++; continue; }
      if (c === 45 && src.charCodeAt(i + 1) === 45) {           // comment
        i += 2;
        if (src.charCodeAt(i) === 91) {
          var lvl = longBracketLevel(i);
          if (lvl >= 0) { i = readLong(i, lvl)[1]; continue; }
        }
        while (i < n && src.charCodeAt(i) !== 10) i++;
        continue;
      }
      var tline = line;
      if (isAlpha(c)) {
        var j = i + 1;
        while (j < n && (isAlpha(src.charCodeAt(j)) || isDigit(src.charCodeAt(j)))) j++;
        var word = src.slice(i, j);
        toks.push(KEYWORDS[word] ? { t: word, line: tline } : { t: 'name', v: word, line: tline });
        i = j; continue;
      }
      if (isDigit(c) || (c === 46 && isDigit(src.charCodeAt(i + 1)))) {
        var j2 = i, isFloat = false, text;
        if (c === 48 && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
          j2 = i + 2;
          while (j2 < n) {
            var d = src.charCodeAt(j2);
            if (isHex(d) || d === 46) { if (d === 46) isFloat = true; j2++; }
            else if ((d === 112 || d === 80)) {
              isFloat = true; j2++;
              if (src[j2] === '+' || src[j2] === '-') j2++;
            } else break;
          }
        } else {
          while (j2 < n) {
            var e = src.charCodeAt(j2);
            if (isDigit(e) || e === 46) { if (e === 46) isFloat = true; j2++; }
            else if (e === 101 || e === 69) {
              isFloat = true; j2++;
              if (src[j2] === '+' || src[j2] === '-') j2++;
            } else break;
          }
        }
        text = src.slice(i, j2);
        if (j2 < n && (isAlpha(src.charCodeAt(j2)))) err("malformed number near '" + text + src[j2] + "'");
        toks.push({ t: 'number', v: text, line: tline });
        i = j2; continue;
      }
      if (c === 34 || c === 39) {                                // short string
        var q = c, out = [], k = i + 1;
        for (;;) {
          if (k >= n) err('unfinished string');
          var ch = src.charCodeAt(k);
          if (ch === q) { k++; break; }
          if (ch === 10) err('unfinished string');
          if (ch === 92) {
            var x = src[k + 1];
            k += 2;
            switch (x) {
              case 'n': out.push('\n'); break;
              case 't': out.push('\t'); break;
              case 'r': out.push('\r'); break;
              case 'a': out.push('\x07'); break;
              case 'b': out.push('\b'); break;
              case 'f': out.push('\f'); break;
              case 'v': out.push('\v'); break;
              case '\\': out.push('\\'); break;
              case '"': out.push('"'); break;
              case "'": out.push("'"); break;
              case '\n': line++; out.push('\n'); break;
              case 'x': {
                var hx = src.slice(k, k + 2);
                if (!/^[0-9a-fA-F]{2}$/.test(hx)) err('hexadecimal digit expected');
                out.push(String.fromCharCode(parseInt(hx, 16))); k += 2; break;
              }
              case 'z': {
                while (k < n && isSpace(src.charCodeAt(k))) { if (src.charCodeAt(k) === 10) line++; k++; }
                break;
              }
              case 'u': {
                if (src[k] !== '{') err("missing '{' in \\u{xxxx}");
                var close = src.indexOf('}', k);
                var cp = parseInt(src.slice(k + 1, close), 16);
                k = close + 1;
                out.push(utf8Bytes(cp)); break;
              }
              default: {
                if (x !== undefined && isDigit(x.charCodeAt(0))) {
                  var digits = x; var m = 0;
                  while (m < 2 && isDigit(src.charCodeAt(k))) { digits += src[k]; k++; m++; }
                  var val = parseInt(digits, 10);
                  if (val > 255) err('decimal escape too large');
                  out.push(String.fromCharCode(val));
                } else err('invalid escape sequence');
              }
            }
            continue;
          }
          out.push(src[k]); k++;
        }
        toks.push({ t: 'string', v: out.join(''), line: tline });
        i = k; continue;
      }
      if (c === 91) {
        var lv = longBracketLevel(i);
        if (lv >= 0) {
          var r = readLong(i, lv);
          toks.push({ t: 'string', v: r[0], line: tline });
          i = r[1]; continue;
        }
      }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '...') { toks.push({ t: '...', line: tline }); i += 3; continue; }
      if (two === '==' || two === '~=' || two === '<=' || two === '>=' || two === '//' ||
          two === '::' || two === '<<' || two === '>>' || two === '..') {
        toks.push({ t: two, line: tline }); i += 2; continue;
      }
      var one = src[i];
      if ('+-*/%^#&~|<>=(){}[];:,.'.indexOf(one) >= 0) { toks.push({ t: one, line: tline }); i++; continue; }
      err("unexpected symbol near '" + one + "'");
    }
    toks.push({ t: '<eof>', line: line });
    return toks;
  }

  function utf8Bytes(cp) {
    if (cp < 0x80) return String.fromCharCode(cp);
    if (cp < 0x800) return String.fromCharCode(0xC0 | (cp >> 6), 0x80 | (cp & 63));
    if (cp < 0x10000) return String.fromCharCode(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    return String.fromCharCode(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }

  // --------------------------------------------------------------- parser --
  // Binary priorities exactly as lparser.c has them: { left, right }.
  var BINARY = {
    '+': [10, 10], '-': [10, 10], '*': [11, 11], '%': [11, 11], '^': [14, 13],
    '/': [11, 11], '//': [11, 11], '&': [6, 6], '|': [4, 4], '~': [5, 5],
    '<<': [7, 7], '>>': [7, 7], '..': [9, 8],
    '==': [3, 3], '<': [3, 3], '<=': [3, 3], '~=': [3, 3], '>': [3, 3], '>=': [3, 3],
    'and': [2, 2], 'or': [1, 1]
  };
  var UNARY_PRIORITY = 12;

  function parse(src, chunk) {
    chunk = chunk || '?';
    var toks = lex(src, chunk);
    var p = 0;
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function check(t) { return toks[p].t === t; }
    function err(msg, tok) {
      tok = tok || toks[p];
      var near = tok.t === '<eof>' ? '<eof>' : (tok.v !== undefined ? tok.v : tok.t);
      throw new LuaSyntaxError(msg + " near '" + near + "'", chunk, tok.line);
    }
    function expect(t, what) {
      if (toks[p].t !== t) err("'" + t + "' expected" + (what ? ' (to close ' + what + ')' : ''));
      return toks[p++];
    }
    function accept(t) { if (toks[p].t === t) { p++; return true; } return false; }
    function name() {
      if (toks[p].t !== 'name') err('<name> expected');
      return toks[p++].v;
    }

    function blockFollow(withUntil) {
      var t = toks[p].t;
      return t === 'else' || t === 'elseif' || t === 'end' || t === '<eof>' || (withUntil && t === 'until');
    }

    function block() {
      var body = [];
      while (!blockFollow(true)) {
        if (check('return')) { body.push(retstat()); break; }
        var s = statement();
        if (s) body.push(s);
      }
      return body;
    }

    function retstat() {
      var tok = next();
      var exprs = [];
      if (!blockFollow(true) && !check(';')) exprs = exprlist();
      accept(';');
      return { k: 'Return', exprs: exprs, line: tok.line };
    }

    function statement() {
      var tok = peek(), line = tok.line;
      switch (tok.t) {
        case ';': next(); return null;
        case 'if': return ifstat();
        case 'while': {
          next(); var cond = expr(); expect('do'); var b = block(); expect('end', 'while');
          return { k: 'While', cond: cond, body: b, line: line };
        }
        case 'do': { next(); var b2 = block(); expect('end', 'do'); return { k: 'Do', body: b2, line: line }; }
        case 'for': return forstat();
        case 'repeat': {
          next(); var b3 = block(); expect('until', 'repeat'); var c3 = expr();
          return { k: 'Repeat', body: b3, cond: c3, line: line };
        }
        case 'function': {
          next();
          var target = { k: 'Name', name: name(), line: line }, isMethod = false;
          while (check('.') || check(':')) {
            var sep = next().t;
            var key = name();
            target = { k: 'Index', obj: target, key: { k: 'String', v: key }, line: line };
            if (sep === ':') { isMethod = true; break; }
          }
          var f = funcbody(isMethod, line);
          return { k: 'Assign', targets: [target], exprs: [f], line: line };
        }
        case 'local': {
          next();
          if (accept('function')) {
            var nm = name();
            return { k: 'LocalFunction', name: nm, func: funcbody(false, line), line: line };
          }
          var names = [], attribs = [];
          do {
            names.push(name());
            if (accept('<')) { attribs.push(name()); expect('>'); } else attribs.push(null);
          } while (accept(','));
          var exprs = accept('=') ? exprlist() : [];
          return { k: 'Local', names: names, attribs: attribs, exprs: exprs, line: line };
        }
        case '::': { next(); var label = name(); expect('::'); return { k: 'Label', name: label, line: line }; }
        case 'return': return retstat();
        case 'break': next(); return { k: 'Break', line: line };
        case 'goto': next(); return { k: 'Goto', name: name(), line: line };
        default: return exprstat();
      }
    }

    function ifstat() {
      var line = next().line;
      var clauses = [];
      var cond = expr(); expect('then');
      clauses.push({ cond: cond, body: block() });
      var orelse = null;
      for (;;) {
        if (accept('elseif')) { var c = expr(); expect('then'); clauses.push({ cond: c, body: block() }); }
        else if (accept('else')) { orelse = block(); expect('end', 'if'); break; }
        else { expect('end', 'if'); break; }
      }
      return { k: 'If', clauses: clauses, orelse: orelse, line: line };
    }

    function forstat() {
      var line = next().line;
      var n1 = name();
      if (accept('=')) {
        var start = expr(); expect(',');
        var limit = expr();
        var step = accept(',') ? expr() : null;
        expect('do'); var b = block(); expect('end', 'for');
        return { k: 'NumFor', name: n1, start: start, limit: limit, step: step, body: b, line: line };
      }
      var names = [n1];
      while (accept(',')) names.push(name());
      expect('in');
      var exprs = exprlist();
      expect('do'); var body = block(); expect('end', 'for');
      return { k: 'GenFor', names: names, exprs: exprs, body: body, line: line };
    }

    function exprstat() {
      var line = peek().line;
      var e = suffixedexp();
      if (check('=') || check(',')) {
        var targets = [e];
        while (accept(',')) targets.push(suffixedexp());
        expect('=');
        var exprs = exprlist();
        targets.forEach(function (t) { if (t.k !== 'Name' && t.k !== 'Index') err('syntax error'); });
        return { k: 'Assign', targets: targets, exprs: exprs, line: line };
      }
      if (e.k !== 'Call' && e.k !== 'Method') err('syntax error');
      return { k: 'ExprStat', expr: e, line: line };
    }

    function exprlist() {
      var list = [expr()];
      while (accept(',')) list.push(expr());
      return list;
    }

    function funcbody(isMethod, line) {
      var params = isMethod ? ['self'] : [], vararg = false;
      expect('(');
      if (!check(')')) {
        do {
          if (accept('...')) { vararg = true; break; }
          params.push(name());
        } while (accept(','));
      }
      expect(')');
      var b = block();
      var endTok = expect('end', 'function');
      return { k: 'Function', params: params, vararg: vararg, body: b, line: line, endLine: endTok.line };
    }

    function primaryexp() {
      var tok = peek();
      if (tok.t === 'name') { next(); return { k: 'Name', name: tok.v, line: tok.line }; }
      if (tok.t === '(') {
        next(); var e = expr(); expect(')');
        return { k: 'Paren', expr: e, line: tok.line };
      }
      err('unexpected symbol');
    }

    function suffixedexp() {
      var e = primaryexp();
      for (;;) {
        var tok = peek();
        switch (tok.t) {
          case '.': next(); e = { k: 'Index', obj: e, key: { k: 'String', v: name() }, line: tok.line }; break;
          case '[': next(); var key = expr(); expect(']'); e = { k: 'Index', obj: e, key: key, line: tok.line }; break;
          case ':': next(); var m = name(); e = { k: 'Method', obj: e, name: m, args: callargs(), line: tok.line }; break;
          case '(': case 'string': case '{': e = { k: 'Call', fn: e, args: callargs(), line: tok.line }; break;
          default: return e;
        }
      }
    }

    function callargs() {
      var tok = peek();
      if (tok.t === 'string') { next(); return [{ k: 'String', v: tok.v }]; }
      if (tok.t === '{') return [tablecons()];
      expect('(');
      if (accept(')')) return [];
      var args = exprlist();
      expect(')');
      return args;
    }

    function tablecons() {
      var line = expect('{').line;
      var items = [];   // { kind: 'pos'|'named'|'keyed', key, value }
      while (!check('}')) {
        if (check('name') && toks[p + 1].t === '=') {
          var key = next().v; next();
          items.push({ kind: 'keyed', key: { k: 'String', v: key }, value: expr() });
        } else if (check('[')) {
          next(); var k = expr(); expect(']'); expect('=');
          items.push({ kind: 'keyed', key: k, value: expr() });
        } else {
          items.push({ kind: 'pos', value: expr() });
        }
        if (!accept(',') && !accept(';')) break;
      }
      expect('}', 'table');
      return { k: 'Table', items: items, line: line };
    }

    function simpleexp() {
      var tok = peek();
      switch (tok.t) {
        case 'number': next(); return { k: 'Number', v: tok.v, line: tok.line };
        case 'string': next(); return { k: 'String', v: tok.v };
        case 'nil': next(); return { k: 'Nil' };
        case 'true': next(); return { k: 'True' };
        case 'false': next(); return { k: 'False' };
        case '...': next(); return { k: 'Vararg', line: tok.line };
        case '{': return tablecons();
        case 'function': next(); return funcbody(false, tok.line);
        default: return suffixedexp();
      }
    }

    function expr(limit) {
      limit = limit || 0;
      var left, tok = peek();
      if (tok.t === 'not' || tok.t === '-' || tok.t === '#' || tok.t === '~') {
        next();
        left = { k: 'Unop', op: tok.t, expr: expr(UNARY_PRIORITY), line: tok.line };
      } else {
        left = simpleexp();
      }
      for (;;) {
        var op = peek().t, pr = BINARY[op];
        if (!pr || pr[0] <= limit) break;
        var line = next().line;
        var right = expr(pr[1]);
        left = { k: 'Binop', op: op, left: left, right: right, line: line };
      }
      return left;
    }

    var body = block();
    if (!check('<eof>')) err("'<eof>' expected");
    return { k: 'Chunk', body: body };
  }

  NS.lex = lex;
  NS.parse = parse;
  NS.LuaSyntaxError = LuaSyntaxError;
  NS.utf8Bytes = utf8Bytes;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/runtime/lua_runtime.js ---- */
/* Middaw's Lua 5.4, part 3 of 3: values, operators and the standard library.
 *
 * Values, as JavaScript sees them:
 *   nil      undefined
 *   boolean  true / false
 *   number   a JS number. An integral JS number is a Lua *integer*; a
 *            non-integral one (or inf, nan) is a Lua *float*. A float whose
 *            value happens to be integral (4.0, 2/2) is an LFloat, so that it
 *            still prints "4.0" and math.type still says "float".
 *   string   a JS string with one character per byte (0-255)
 *   table    LuaTable
 *   function a JS function: Lua arguments in, and undefined, one value, or a
 *            Multi for two or more results.
 *
 * Wherever the result has to match the real Lua byte for byte - table.sort
 * with ties, the pattern matcher, math.random, number formatting - the code
 * is a port of Lua 5.4's own C, not a lookalike.
 */
(function (NS) {
  'use strict';

  // ------------------------------------------------------------ values ----
  function LFloat(n) { this.n = n; }
  LFloat.prototype.valueOf = function () { return this.n; };

  function mkf(x) { return Number.isInteger(x) ? new LFloat(x) : x; }
  function isNum(v) { return typeof v === 'number' || v instanceof LFloat; }
  function num(v) { return typeof v === 'number' ? v : v.n; }
  function isFloatVal(v) { return v instanceof LFloat || (typeof v === 'number' && !Number.isInteger(v)); }

  function Multi(a) { this.a = a; }
  function first(v) { return v instanceof Multi ? v.a[0] : v; }
  // `return` with no values gives NONE; a bare undefined is one nil.
  var NONE = new Multi([]);
  var NIL1 = Object.freeze([undefined]);
  function sp(v) {
    if (v instanceof Multi) return v.a;
    return v === undefined ? NIL1 : [v];
  }
  function ret(list) {
    if (list.length === 0) return NONE;
    if (list.length === 1) return list[0];
    return new Multi(list);
  }

  var tableIds = 0;
  function LuaTable() { this.arr = []; this.hash = null; this.mt = null; this.id = 0; this.hver = 0; }
  LuaTable.prototype.get = function (k) {
    if (typeof k === 'number') {
      var a = this.arr;
      if (k > 0 && k <= a.length && Number.isInteger(k)) return a[k - 1];
    } else if (typeof k === 'string') {
      return this.hash === null ? undefined : this.hash.get(k);
    } else if (k instanceof LFloat) {
      return this.get(k.n);
    }
    return this.hash === null ? undefined : this.hash.get(k);
  };
  LuaTable.prototype.set = function (k, v) {
    if (typeof k === 'number') {
      if (Number.isInteger(k) && k > 0) {
        var a = this.arr, n = a.length;
        if (k <= n) {
          a[k - 1] = v;
          if (v === undefined && k === n) { while (a.length && a[a.length - 1] === undefined) a.pop(); }
          return;
        }
        if (k === n + 1) {
          if (v === undefined) { if (this.hash !== null) this.hash.delete(k); return; }
          a.push(v);
          if (this.hash !== null && this.hash.size) {
            var h = this.hash;
            while (h.has(a.length + 1)) { var nk = a.length + 1; a.push(h.get(nk)); h.delete(nk); }
          }
          return;
        }
      } else if (k !== k) {
        throw rterror('table index is NaN');
      }
    } else if (k instanceof LFloat) {
      return this.set(k.n, v);
    } else if (k === undefined) {
      throw rterror('table index is nil');
    }
    if (v === undefined) { if (this.hash !== null) this.hash.delete(k); return; }
    if (this.hash === null) this.hash = new Map();
    if (!this.hash.has(k)) this.hver++;
    this.hash.set(k, v);
  };
  LuaTable.prototype.length = function () { return this.arr.length; };

  // ------------------------------------------------------------ errors ----
  // Compiled chunks register their line maps here, so an error can say
  // "gi_idea.lua:1234:" as the real Lua would.
  var lineMaps = {};
  function luaPosition(level) {
    var stack = new Error().stack || '';
    var re = /lua:([^:\s()]+):(\d+):\d+/g, m, found = 0;
    while ((m = re.exec(stack)) !== null) {
      found++;
      if (found >= level) {
        var map = lineMaps[m[1]];
        var line = map ? map[Number(m[2]) - 1] : undefined;
        if (line) return m[1] + ':' + line + ': ';
        return m[1] + ': ';
      }
    }
    return '';
  }
  function LuaError(value, traceback) {
    this.value = value;
    this.message = typeof value === 'string' ? value : tostring(value);
    this.luaTraceback = traceback;
    this.stack = new Error().stack;
  }
  LuaError.prototype = Object.create(Error.prototype);
  LuaError.prototype.name = 'LuaError';
  function rterror(msg) { return new LuaError(luaPosition(1) + msg); }

  function typeName(v) {
    if (v === undefined || v === null) return 'nil';
    switch (typeof v) {
      case 'boolean': return 'boolean';
      case 'number': return 'number';
      case 'string': return 'string';
      case 'function': return 'function';
    }
    if (v instanceof LFloat) return 'number';
    if (v instanceof LuaTable) return 'table';
    return 'userdata';
  }

  // --------------------------------------------------------- numbers ----
  // Exact decimal expansion of a double: x = D * 10^-s, D a BigInt.
  var F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  function exactDecimal(x) {
    F64[0] = x;
    var hi = U32[1], lo = U32[0];
    var exp = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) exp = 1; else mant |= 1n << 52n;
    var e = exp - 1075;
    if (e >= 0) return { D: mant << BigInt(e), s: 0 };
    return { D: mant * (5n ** BigInt(-e)), s: -e };
  }
  function roundDiv(N, div) {      // round N/div half to even
    var q = N / div, r = N % div;
    var twice = r * 2n;
    if (twice > div || (twice === div && (q & 1n) === 1n)) q += 1n;
    return q;
  }
  function fixedDigits(x, f) {     // |x| to f decimals, C-exact; returns string
    var ex = exactDecimal(Math.abs(x));
    var q;
    if (f >= ex.s) q = ex.D * (10n ** BigInt(f - ex.s));
    else q = roundDiv(ex.D, 10n ** BigInt(ex.s - f));
    var s = q.toString();
    if (f === 0) return s;
    while (s.length <= f) s = '0' + s;
    return s.slice(0, s.length - f) + '.' + s.slice(s.length - f);
  }
  function expDigits(x, prec) {    // |x| as d.ddd with prec decimals; returns [mantissa, exponent]
    if (x === 0) return [prec > 0 ? '0.' + '0'.repeat(prec) : '0', 0];
    var ex = exactDecimal(Math.abs(x));
    var D = ex.D.toString();
    var X = D.length - 1 - ex.s;
    var P = prec + 1, q;
    if (D.length > P) {
      q = roundDiv(ex.D, 10n ** BigInt(D.length - P)).toString();
      if (q.length > P) { q = q.slice(0, P); X++; }
    } else q = D + '0'.repeat(P - D.length);
    return [prec > 0 ? q[0] + '.' + q.slice(1) : q, X];
  }
  function fmtExp(x, prec, upper) {
    var r = expDigits(x, prec);
    var X = r[1];
    var s = r[0] + (upper ? 'E' : 'e') + (X < 0 ? '-' : '+') + (Math.abs(X) < 10 ? '0' : '') + Math.abs(X);
    return s;
  }
  function stripZeros(s) {
    if (s.indexOf('.') < 0) return s;
    s = s.replace(/0+$/, '');
    return s.replace(/\.$/, '');
  }
  function fmtG(x, P, upper, alt) {   // C's %g of |x|
    if (P === 0) P = 1;
    if (x === 0) return '0';
    var X = expDigits(x, P - 1)[1];
    var s;
    if (X < -4 || X >= P) {
      var r = expDigits(x, P - 1);
      var m = alt ? r[0] : stripZeros(r[0]);
      s = m + (upper ? 'E' : 'e') + (r[1] < 0 ? '-' : '+') + (Math.abs(r[1]) < 10 ? '0' : '') + Math.abs(r[1]);
    } else {
      s = fixedDigits(x, P - 1 - X);
      if (!alt) s = stripZeros(s);
    }
    return s;
  }
  function floatStr(x) {
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x !== x) return (1 / x) < 0 ? 'nan' : '-nan';
    var neg = x < 0 || (x === 0 && 1 / x < 0);
    var s = (neg ? '-' : '') + fmtG(x, 14, false, false);
    if (/^-?\d+$/.test(s)) s += '.0';
    return s;
  }
  function intStr(n) {
    if (Math.abs(n) <= 9007199254740992) return String(n === 0 ? 0 : n);
    return BigInt(n).toString();
  }
  // io.write prints a float with LUA_NUMBER_FMT alone: 1.0 is "1".
  function writeNum(v) {
    if (!isNum(v)) throw rterror('bad argument to \'write\' (string expected, got ' + typeName(v) + ')');
    if (typeof v === 'number' && Number.isInteger(v)) return intStr(v);
    var x = num(v);
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x !== x) return '-nan';
    return (x < 0 || (x === 0 && 1 / x < 0) ? '-' : '') + fmtG(Math.abs(x), 14, false, false);
  }
  function numStr(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? intStr(v) : floatStr(v);
    return floatStr(v.n);
  }

  // lua_stringtonumber: a whole numeral, spaces either side, or undefined.
  function str2num(s) {
    var t = s.replace(/^[ \f\n\r\t\v]+|[ \f\n\r\t\v]+$/g, '');
    var m;
    if ((m = /^([+-])?0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?$/.exec(t))) {
      var ip = m[2], fp = m[3], ex = m[4];
      if (!ip && !fp) return undefined;
      var neg = m[1] === '-';
      if (fp === undefined && ex === undefined) {
        var big = BigInt.asIntN(64, BigInt('0x' + ip));
        var n = Number(big);
        return neg ? 0 - n : n;
      }
      var val = 0;
      for (var i = 0; i < ip.length; i++) val = val * 16 + parseInt(ip[i], 16);
      var scale = 1 / 16;
      fp = fp || '';
      for (var j = 0; j < fp.length; j++) { val += parseInt(fp[j], 16) * scale; scale /= 16; }
      if (ex) val *= Math.pow(2, Number(ex));
      return mkf(neg ? -val : val);
    }
    if ((m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.exec(t))) {
      var isInt = m[1].indexOf('.') < 0 && !m[2];
      var v = Number(t);
      if (isInt) {
        if (Math.abs(v) <= 9223372036854775807) return v;
        return mkf(v);
      }
      return mkf(v);
    }
    return undefined;
  }

  function toNumberArith(v, op) {
    if (typeof v === 'number') return v;
    if (v instanceof LFloat) return v;
    if (typeof v === 'string') { var n = str2num(v); if (n !== undefined) return n; }
    return null;
  }
  function arithError(op, a, b) {
    var bad = (isNum(a) || (typeof a === 'string' && str2num(a) !== undefined)) ? b : a;
    if (op === 'concat') return rterror('attempt to concatenate a ' + typeName(bad) + ' value');
    if (op === 'bit') return rterror('attempt to perform bitwise operation on a ' + typeName(bad) + ' value');
    return rterror('attempt to perform arithmetic on a ' + typeName(bad) + ' value');
  }
  function metaOf(v) {
    if (v instanceof LuaTable) return v.mt;
    if (typeof v === 'string') return stringMeta;
    return null;
  }
  function metaBin(ev, a, b) {
    var mt = metaOf(a), h = mt && mt.get(ev);
    if (h === undefined) { mt = metaOf(b); h = mt && mt.get(ev); }
    if (h === undefined || h === null) return NOMETA;
    return first(call(h)(a, b));
  }
  var NOMETA = {};

  function arithSlow(op, a, b, ev) {
    var x = toNumberArith(a), y = toNumberArith(b);
    if (x === null || y === null) {
      var r = metaBin(ev, a, b);
      if (r !== NOMETA) return r;
      throw arithError(op, a, b);
    }
    switch (op) {
      case 'add': return add(x, y);
      case 'sub': return sub(x, y);
      case 'mul': return mul(x, y);
      case 'div': return div(x, y);
      case 'mod': return mod(x, y);
      case 'idiv': return idiv(x, y);
      case 'pow': return pow(x, y);
    }
  }
  function add(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a + b;
      return (Number.isInteger(a) && Number.isInteger(b)) ? r : mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) + num(b));
    return arithSlow('add', a, b, '__add');
  }
  function sub(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a - b;
      return (Number.isInteger(a) && Number.isInteger(b)) ? r : mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) - num(b));
    return arithSlow('sub', a, b, '__sub');
  }
  function mul(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a * b;
      if (Number.isInteger(a) && Number.isInteger(b)) return r === 0 ? 0 : r;
      return mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) * num(b));
    return arithSlow('mul', a, b, '__mul');
  }
  function div(a, b) {
    if (isNum(a) && isNum(b)) return mkf(num(a) / num(b));
    return arithSlow('div', a, b, '__div');
  }
  function idiv(a, b) {
    if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
      if (b === 0) throw rterror("attempt to perform 'n//0'");
      var q = Math.floor(a / b);
      return q === 0 ? 0 : q;
    }
    if (isNum(a) && isNum(b)) return mkf(Math.floor(num(a) / num(b)));
    return arithSlow('idiv', a, b, '__idiv');
  }
  function mod(a, b) {
    if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
      if (b === 0) throw rterror("attempt to perform 'n%%0'");
      var r = a % b;
      if (r !== 0 && (r < 0) !== (b < 0)) r += b;
      return r === 0 ? 0 : r;
    }
    if (isNum(a) && isNum(b)) {
      var x = num(a), y = num(b);
      var m;
      if (y === Infinity || y === -Infinity) m = x;
      else m = x % y;
      if ((m > 0) ? y < 0 : (m < 0 && y !== m)) m += y;
      return mkf(m);
    }
    return arithSlow('mod', a, b, '__mod');
  }
  function pow(a, b) {
    if (isNum(a) && isNum(b)) return mkf(Math.pow(num(a), num(b)));
    return arithSlow('pow', a, b, '__pow');
  }
  function unm(a) {
    if (typeof a === 'number') return Number.isInteger(a) ? 0 - a : -a;
    if (a instanceof LFloat) return new LFloat(-a.n);
    var x = toNumberArith(a);
    if (x !== null) return unm(x);
    var mt = metaOf(a), h = mt && mt.get('__unm');
    if (h !== undefined && h !== null) return first(call(h)(a, a));
    throw rterror('attempt to perform arithmetic on a ' + typeName(a) + ' value');
  }

  // Bitwise operations work on 64-bit integers.
  function toInt64(v, a, b) {
    var x = typeof v === 'string' ? str2num(v) : v;
    if (typeof x === 'number' && Number.isInteger(x)) return BigInt(x);
    if (x instanceof LFloat) return BigInt(x.n);
    if (typeof x === 'number') throw rterror('number has no integer representation');
    throw arithError('bit', a, b);
  }
  function fromInt64(big) { return Number(BigInt.asIntN(64, big)); }
  function small(a, b) {
    return typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b;
  }
  function band(a, b) { if (small(a, b)) return a & b; return bitSlow('__band', a, b, function (x, y) { return x & y; }); }
  function bor(a, b) { if (small(a, b)) return a | b; return bitSlow('__bor', a, b, function (x, y) { return x | y; }); }
  function bxor(a, b) { if (small(a, b)) return a ^ b; return bitSlow('__bxor', a, b, function (x, y) { return x ^ y; }); }
  function shiftLeft(x, n) {
    if (n <= -64n || n >= 64n) return 0n;
    if (n >= 0n) return BigInt.asUintN(64, x << n);
    return BigInt.asUintN(64, x) >> (-n);
  }
  function shl(a, b) { return bitSlow('__shl', a, b, function (x, y) { return shiftLeft(x, y); }); }
  function shr(a, b) { return bitSlow('__shr', a, b, function (x, y) { return shiftLeft(x, -y); }); }
  function bnot(a) {
    if (typeof a === 'number' && (a | 0) === a) return ~a;
    var mt = metaOf(a), h = mt && mt.get('__bnot');
    if (h !== undefined && h !== null && !isNum(a)) return first(call(h)(a, a));
    return fromInt64(~toInt64(a, a, a));
  }
  function bitSlow(ev, a, b, f) {
    if (!((isNum(a) || typeof a === 'string') && (isNum(b) || typeof b === 'string'))) {
      var r = metaBin(ev, a, b);
      if (r !== NOMETA) return r;
    }
    return fromInt64(f(toInt64(a, a, b), toInt64(b, a, b)));
  }

  function concat(a, b) {
    var ta = typeof a, tb = typeof b;
    if (ta === 'string' && tb === 'string') return a + b;
    if ((ta === 'string' || isNum(a)) && (tb === 'string' || isNum(b))) {
      return (ta === 'string' ? a : numStr(a)) + (tb === 'string' ? b : numStr(b));
    }
    var r = metaBin('__concat', a, b);
    if (r !== NOMETA) return r;
    throw arithError('concat', a, b);
  }

  function len(v) {
    if (typeof v === 'string') return v.length;
    if (v instanceof LuaTable) {
      if (v.mt !== null) {
        var h = v.mt.get('__len');
        if (h !== undefined) return first(call(h)(v));
      }
      return v.arr.length;
    }
    var mt = metaOf(v), h2 = mt && mt.get('__len');
    if (h2 !== undefined && h2 !== null) return first(call(h2)(v));
    throw rterror('attempt to get length of a ' + typeName(v) + ' value');
  }

  function eq(a, b) {
    if (a === b) return true;
    var ta = typeof a, tb = typeof b;
    if (ta === 'object' || tb === 'object') {
      if (isNum(a) && isNum(b)) return num(a) === num(b);
      if (a instanceof LuaTable && b instanceof LuaTable) {
        var h = (a.mt && a.mt.get('__eq')) || (b.mt && b.mt.get('__eq'));
        if (h) return truthy(first(call(h)(a, b)));
      }
    }
    return false;
  }
  function lt(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (isNum(a) && isNum(b)) return num(a) < num(b);
    if (typeof a === 'string' && typeof b === 'string') return a < b;
    var r = metaBin('__lt', a, b);
    if (r !== NOMETA) return truthy(r);
    throw compareError(a, b);
  }
  function le(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a <= b;
    if (isNum(a) && isNum(b)) return num(a) <= num(b);
    if (typeof a === 'string' && typeof b === 'string') return a <= b;
    var r = metaBin('__le', a, b);
    if (r !== NOMETA) return truthy(r);
    throw compareError(a, b);
  }
  function gt(a, b) { return lt(b, a); }
  function ge(a, b) { return le(b, a); }
  function compareError(a, b) {
    var t1 = typeName(a), t2 = typeName(b);
    if (t1 === t2) return rterror('attempt to compare two ' + t1 + ' values');
    return rterror('attempt to compare ' + t1 + ' with ' + t2);
  }
  function truthy(v) { return v !== undefined && v !== false && v !== null; }

  // ------------------------------------------------------- indexing ----
  function index(o, k, desc) {
    if (o instanceof LuaTable) {
      var v = o.get(k);
      if (v !== undefined || o.mt === null) return v;
      return metaIndex(o, k, desc);
    }
    if (typeof o === 'string') return stringLib.get(k);
    return metaIndex(o, k, desc);
  }
  function metaIndex(o, k, desc) {
    for (var loop = 0; loop < 100; loop++) {
      var h;
      if (o instanceof LuaTable) {
        var v = o.get(k);
        if (v !== undefined) return v;
        if (o.mt === null) return undefined;
        h = o.mt.get('__index');
        if (h === undefined) return undefined;
      } else {
        var mt = metaOf(o);
        h = mt && mt.get('__index');
        if (h === undefined || h === null) {
          throw rterror('attempt to index a ' + typeName(o) + ' value' + (desc ? ' (' + desc + ')' : ''));
        }
      }
      if (typeof h === 'function') return first(h(o, k));
      o = h;
    }
    throw rterror("'__index' chain too long; possible loop");
  }
  function setindex(o, k, v, desc) {
    if (o instanceof LuaTable) {
      if (o.mt === null) { o.set(k, v); return; }
      var h = o.mt.get('__newindex');
      if (h === undefined || o.get(k) !== undefined) { o.set(k, v); return; }
      if (typeof h === 'function') { h(o, k, v); return; }
      return setindex(h, k, v);
    }
    throw rterror('attempt to index a ' + typeName(o) + ' value' + (desc ? ' (' + desc + ')' : ''));
  }

  function call(f, desc) {
    if (typeof f === 'function') return f;
    var mt = metaOf(f), h = mt && mt.get('__call');
    if (typeof h === 'function') return function () {
      var args = [f];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      return h.apply(null, args);
    };
    throw rterror('attempt to call a ' + typeName(f) + ' value' + (desc ? ' (' + desc + ')' : ''));
  }
  function method(o, name) {
    var f = index(o, name, 'method \'' + name + '\'');
    if (typeof f !== 'function') f = call(f, "method '" + name + "'");
    var args = [o];
    for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
    return f.apply(null, args);
  }

  function tbl(list, keyed) {
    var t = new LuaTable();
    if (list.length) {
      var a = list.slice();
      while (a.length && a[a.length - 1] === undefined) a.pop();
      t.arr = a;
    }
    if (keyed) {
      for (var i = 0; i < keyed.length; i += 2) {
        if (keyed[i] === undefined) throw rterror('table index is nil');
        if (keyed[i + 1] !== undefined) t.set(keyed[i], keyed[i + 1]);
      }
    }
    return t;
  }

  // ------------------------------------------------------- iteration ----
  function IpairsIter(t) { this.t = t; this.i = 0; this.a = undefined; this.b = undefined; }
  IpairsIter.prototype.step = function () {
    var i = this.i + 1, v = this.t.get(i);
    if (v === undefined) return false;
    this.i = i; this.a = i; this.b = v; return true;
  };
  function PairsIter(t) { this.t = t; this.i = 0; this.it = null; this.a = undefined; this.b = undefined; }
  PairsIter.prototype.step = function () {
    var arr = this.t.arr;
    while (this.it === null && this.i < arr.length) {
      var v = arr[this.i++];
      if (v !== undefined) { this.a = this.i; this.b = v; return true; }
    }
    if (this.it === null) {
      if (this.t.hash === null) return false;
      this.it = this.t.hash.entries();
    }
    var n = this.it.next();
    if (n.done) return false;
    this.a = n.value[0]; this.b = n.value[1];
    return true;
  };
  function GenIter(f, s, c) { this.f = call(f, 'for iterator'); this.s = s; this.c = c; this.a = undefined; this.b = undefined; this.v = NONE; }
  GenIter.prototype.step = function () {
    var r = this.f(this.s, this.c);
    var v = r instanceof Multi ? r.a : [r];
    if (v[0] === undefined) return false;
    this.c = v[0]; this.a = v[0]; this.b = v[1]; this.v = v;
    return true;
  };
  function iter(f, s, c) {
    if (f === ipairsAux && s instanceof LuaTable && s.mt === null) return new IpairsIter(s);
    if (f === luaNext && s instanceof LuaTable && c === undefined && s.mt === null) return new PairsIter(s);
    return new GenIter(f, s, c);
  }

  function forprep(a, b, c) {
    if (c === undefined) c = 1;
    if (!isNum(a)) throw rterror("'for' initial value must be a number");
    if (!isNum(b)) throw rterror("'for' limit must be a number");
    if (!isNum(c)) throw rterror("'for' step must be a number");
    var x = num(a), lim = num(b), st = num(c);
    if (st === 0) throw rterror("'for' step is zero");
    var intLoop = typeof a === 'number' && Number.isInteger(a) && typeof c === 'number' && Number.isInteger(c);
    if (intLoop) {
      if (!(typeof b === 'number' && Number.isInteger(b))) {
        if (lim !== lim) return [1, 0, 1, false];
        lim = st > 0 ? Math.floor(lim) : Math.ceil(lim);
      }
      return [x, lim, st, false];
    }
    return [x, lim, st, true];
  }

  // ------------------------------------------------------- tostring ----
  function tostring(v) {
    if (v === undefined || v === null) return 'nil';
    switch (typeof v) {
      case 'string': return v;
      case 'number': return numStr(v);
      case 'boolean': return v ? 'true' : 'false';
      case 'function': return 'function: ' + addressOf(v);
    }
    if (v instanceof LFloat) return floatStr(v.n);
    if (v instanceof LuaTable) {
      if (v.mt !== null) {
        var h = v.mt.get('__tostring');
        if (h !== undefined) {
          var s = first(call(h)(v));
          if (typeof s !== 'string') throw rterror("'__tostring' must return a string");
          return s;
        }
        var nm = v.mt.get('__name');
        if (typeof nm === 'string') return nm + ': ' + addressOf(v);
      }
      return 'table: ' + addressOf(v);
    }
    return 'userdata: ' + addressOf(v);
  }
  var addresses = new WeakMap(), nextAddress = 0x55d0c0de0000;
  function addressOf(o) {
    var a = addresses.get(o);
    if (a === undefined) { a = nextAddress; nextAddress += 0x40; addresses.set(o, a); }
    return '0x' + a.toString(16).padStart(14, '0');
  }

  // ===================================================== the library ======
  function argError(n, fname, msg) { return rterror("bad argument #" + n + " to '" + fname + "' (" + msg + ')'); }
  function checkTable(v, n, fname) {
    if (!(v instanceof LuaTable)) throw argError(n, fname, 'table expected, got ' + typeNameArg(v));
    return v;
  }
  function typeNameArg(v) { return v === undefined ? 'no value' : typeName(v); }
  function checkInt(v, n, fname) {
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') { var x = str2num(v); if (x !== undefined) return checkInt(x, n, fname); }
    if (typeof v === 'number') throw argError(n, fname, 'number has no integer representation');
    throw argError(n, fname, 'number expected, got ' + typeNameArg(v));
  }
  function optInt(v, n, fname, d) { return v === undefined ? d : checkInt(v, n, fname); }
  function checkNum(v, n, fname) {
    if (typeof v === 'number') return v;
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') { var x = str2num(v); if (x !== undefined) return num(x); }
    throw argError(n, fname, 'number expected, got ' + typeNameArg(v));
  }
  function checkStr(v, n, fname) {
    if (typeof v === 'string') return v;
    if (isNum(v)) return numStr(v);
    throw argError(n, fname, 'string expected, got ' + typeNameArg(v));
  }

  function rawLen(t) { return t instanceof LuaTable ? t.arr.length : (typeof t === 'string' ? t.length : 0); }

  // ---------------------------------------------------------- base ------
  function luaNext(t, k) {
    checkTable(t, 1, 'next');
    var arr = t.arr, i = 0;
    if (k !== undefined) {
      if (typeof k === 'number' && Number.isInteger(k) && k >= 1 && k <= arr.length) i = k;
      else if (k instanceof LFloat && k.n >= 1 && k.n <= arr.length) i = k.n;
      else i = -1;
    }
    if (i >= 0) {
      for (; i < arr.length; i++) if (arr[i] !== undefined) return new Multi([i + 1, arr[i]]);
      if (t.hash === null) return undefined;
      var it = t.hash.entries().next();
      return it.done ? undefined : new Multi([it.value[0], it.value[1]]);
    }
    if (t.hash === null) throw rterror("invalid key to 'next'");
    if (t._nkver !== t.hver || !t._nk) {
      t._nk = Array.from(t.hash.keys());
      t._nki = new Map();
      for (var j = 0; j < t._nk.length; j++) t._nki.set(t._nk[j], j);
      t._nkver = t.hver;
    }
    var key = k instanceof LFloat ? k.n : k;
    var pos = t._nki.get(key);
    if (pos === undefined) throw rterror("invalid key to 'next'");
    for (pos++; pos < t._nk.length; pos++) {
      var kk = t._nk[pos];
      if (t.hash.has(kk)) return new Multi([kk, t.hash.get(kk)]);
    }
    return undefined;
  }
  function ipairsAux(t, i) {
    i = i + 1;
    var v = index(t, i);
    return v === undefined ? undefined : new Multi([i, v]);
  }

  function makeEnv(host) {
    host = host || {};
    var G = new LuaTable();
    function reg(t, name, f) { t.set(name, f); }

    reg(G, 'print', function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(tostring(arguments[i]));
      (host.print || function (s) { console.log(s); })(parts.join('\t'));
      return NONE;
    });
    reg(G, 'type', function (v) {
      if (arguments.length === 0) throw argError(1, 'type', 'value expected');
      return typeName(v);
    });
    reg(G, 'tostring', function (v) { return tostring(v); });
    reg(G, 'tonumber', function (v, base) {
      if (base === undefined) {
        if (isNum(v)) return v;
        if (typeof v === 'string') return str2num(v);
        if (arguments.length === 0) throw argError(1, 'tonumber', 'value expected');
        return undefined;
      }
      var b = checkInt(base, 2, 'tonumber');
      var s = checkStr(v, 1, 'tonumber').replace(/^\s+|\s+$/g, '').toLowerCase();
      var neg = false;
      if (s[0] === '-') { neg = true; s = s.slice(1); }
      if (!s.length) return undefined;
      var n = 0;
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        var d = c >= 48 && c <= 57 ? c - 48 : (c >= 97 && c <= 122 ? c - 87 : 99);
        if (d >= b) return undefined;
        n = n * b + d;
      }
      return neg ? -n : n;
    });
    reg(G, 'ipairs', function (t) {
      if (arguments.length === 0) throw argError(1, 'ipairs', 'table expected, got no value');
      return new Multi([ipairsAux, t, 0]);
    });
    reg(G, 'pairs', function (t) {
      if (t instanceof LuaTable && t.mt !== null) {
        var h = t.mt.get('__pairs');
        if (h !== undefined) { var r = sp(call(h)(t)); return new Multi([r[0], r[1], r[2]]); }
      }
      checkTable(t, 1, 'pairs');
      return new Multi([luaNext, t, undefined]);
    });
    reg(G, 'next', luaNext);
    reg(G, 'select', function (n) {
      var count = arguments.length - 1;
      if (n === '#') return count;
      var i = checkInt(n, 1, 'select');
      if (i < 0) i = count + i; else if (i === 0) throw argError(1, 'select', 'index out of range');
      else i = i - 1;
      if (i < 0) throw argError(1, 'select', 'index out of range');
      var out = [];
      for (var j = i + 1; j < arguments.length; j++) out.push(arguments[j]);
      return ret(out);
    });
    reg(G, 'rawget', function (t, k) { checkTable(t, 1, 'rawget'); return t.get(k); });
    reg(G, 'rawset', function (t, k, v) { checkTable(t, 1, 'rawset'); t.set(k, v); return t; });
    reg(G, 'rawequal', function (a, b) { return a === b || (isNum(a) && isNum(b) && num(a) === num(b)); });
    reg(G, 'rawlen', function (t) { return rawLen(t); });
    reg(G, 'setmetatable', function (t, mt) {
      checkTable(t, 1, 'setmetatable');
      if (t.mt && t.mt.get('__metatable') !== undefined) throw rterror('cannot change a protected metatable');
      t.mt = mt === undefined ? null : mt;
      return t;
    });
    reg(G, 'getmetatable', function (v) {
      var mt = metaOf(v);
      if (!mt) return undefined;
      var p = mt.get('__metatable');
      return p !== undefined ? p : mt;
    });
    reg(G, 'assert', function (v, msg) {
      if (truthy(v)) { return ret(Array.prototype.slice.call(arguments)); }
      if (arguments.length < 1) throw argError(1, 'assert', 'value expected');
      throw new LuaError(arguments.length >= 2 ? msg : 'assertion failed!');
    });
    reg(G, 'error', function (v, level) {
      var lv = level === undefined ? 1 : num(level);
      if (typeof v === 'string' && lv > 0) v = luaPosition(lv + 1) + v;
      throw new LuaError(v);
    });
    reg(G, 'pcall', function (f) {
      var args = Array.prototype.slice.call(arguments, 1);
      try {
        var r = call(f).apply(null, args);
        return new Multi([true].concat(sp(r)));
      } catch (e) {
        return new Multi([false, errorValue(e)]);
      }
    });
    reg(G, 'xpcall', function (f, handler) {
      var args = Array.prototype.slice.call(arguments, 2);
      try {
        var r = call(f).apply(null, args);
        return new Multi([true].concat(sp(r)));
      } catch (e) {
        return new Multi([false].concat(sp(call(handler)(errorValue(e)))));
      }
    });
    reg(G, 'collectgarbage', function (opt) { return opt === 'count' ? mkf(1024) : 0; });
    reg(G, 'load', function (chunk, name, mode, env) {
      var src = chunk;
      if (typeof chunk === 'function') {
        var pieces = [], piece;
        while ((piece = first(chunk())) !== undefined && piece !== '') pieces.push(piece);
        src = pieces.join('');
      }
      try {
        return NS.load(src, typeof name === 'string' ? name.replace(/^[=@]/, '') : 'chunk', env || G);
      } catch (e) {
        return new Multi([undefined, errorValue(e)]);
      }
    });
    reg(G, 'loadfile', function (path, mode, env) {
      var src = host.readFile ? host.readFile(path) : null;
      if (src === null || src === undefined) return new Multi([undefined, 'cannot open ' + path]);
      try { return NS.load(src, path, env || G); }
      catch (e) { return new Multi([undefined, errorValue(e)]); }
    });
    reg(G, 'dofile', function (path) {
      var src = host.readFile ? host.readFile(path) : null;
      if (src === null || src === undefined) throw rterror('cannot open ' + path);
      return NS.load(src, path, G)();
    });
    reg(G, 'require', function (name) {
      var loaded = G.get('package').get('loaded');
      var v = loaded.get(name);
      if (v !== undefined) return v;
      if (!host.require) throw rterror("module '" + name + "' not found");
      v = host.require(name);
      loaded.set(name, v === undefined ? true : v);
      return v === undefined ? true : v;
    });
    var pkg = new LuaTable(); pkg.set('loaded', new LuaTable()); pkg.set('path', './?.lua');
    G.set('package', pkg);
    G.set('_G', G);
    G.set('_VERSION', 'Lua 5.4');

    G.set('string', stringLib);
    G.set('table', makeTableLib());
    G.set('math', makeMathLib());
    G.set('os', makeOsLib(host));
    G.set('io', makeIoLib(host));
    G.set('utf8', makeUtf8Lib());
    pkg.get('loaded').set('string', stringLib);
    pkg.get('loaded').set('_G', G);
    return G;
  }
  function errorValue(e) {
    if (e instanceof LuaError) return e.value;
    if (e instanceof RangeError) return 'stack overflow';
    if (e && e.name === 'LuaSyntaxError') return e.message;
    return String(e && e.message ? e.message : e);
  }

  // --------------------------------------------------------- table ------
  function makeTableLib() {
    var T = new LuaTable();
    T.set('insert', function (t, a, b) {
      checkTable(t, 1, 'insert');
      var e = len(t) + 1;
      if (arguments.length === 2) { setindex(t, e, a); return NONE; }
      if (arguments.length !== 3) throw rterror("wrong number of arguments to 'insert'");
      var pos = checkInt(a, 2, 'insert');
      if (pos < 1 || pos > e) throw argError(2, 'insert', 'position out of bounds');
      if (t.mt === null && e - 1 === t.arr.length) {
        t.arr.splice(pos - 1, 0, b);
        if (b === undefined) { while (t.arr.length && t.arr[t.arr.length - 1] === undefined) t.arr.pop(); }
        return NONE;
      }
      for (var i = e; i > pos; i--) setindex(t, i, index(t, i - 1));
      setindex(t, pos, b);
      return NONE;
    });
    T.set('remove', function (t, p) {
      checkTable(t, 1, 'remove');
      var size = len(t);
      var pos = p === undefined ? size : checkInt(p, 2, 'remove');
      if (p !== undefined && pos !== size && (pos < 1 || pos > size + 1)) throw argError(2, 'remove', 'position out of bounds');
      var result = index(t, pos);
      if (t.mt === null && size === t.arr.length && pos >= 1 && pos <= size) {
        t.arr.splice(pos - 1, 1);
        while (t.arr.length && t.arr[t.arr.length - 1] === undefined) t.arr.pop();
        return result;
      }
      for (; pos < size; pos++) setindex(t, pos, index(t, pos + 1));
      setindex(t, pos, undefined);
      return result;
    });
    T.set('concat', function (t, sep, i, j) {
      checkTable(t, 1, 'concat');
      sep = sep === undefined ? '' : checkStr(sep, 2, 'concat');
      var a = optInt(i, 3, 'concat', 1), b = j === undefined ? len(t) : checkInt(j, 4, 'concat');
      var parts = [];
      for (var k = a; k <= b; k++) {
        var v = index(t, k);
        if (typeof v === 'string') parts.push(v);
        else if (isNum(v)) parts.push(numStr(v));
        else throw rterror("invalid value (at index " + k + ") in table for 'concat'");
      }
      return parts.join(sep);
    });
    T.set('unpack', function (t, i, j) {
      var a = optInt(i, 2, 'unpack', 1), b = j === undefined ? len(t) : checkInt(j, 3, 'unpack');
      var out = [];
      for (var k = a; k <= b; k++) out.push(index(t, k));
      return ret(out);
    });
    T.set('pack', function () {
      var t = tbl(Array.prototype.slice.call(arguments));
      t.set('n', arguments.length);
      return t;
    });
    T.set('move', function (a1, f, e, t, a2) {
      if (a2 === undefined) a2 = a1;
      f = checkInt(f, 2, 'move'); e = checkInt(e, 3, 'move'); t = checkInt(t, 4, 'move');
      if (e >= f) {
        if (t > e || t <= f || a1 !== a2) for (var i = 0; i <= e - f; i++) setindex(a2, t + i, index(a1, f + i));
        else for (var k = e - f; k >= 0; k--) setindex(a2, t + k, index(a1, f + k));
      }
      return a2;
    });
    T.set('sort', function (t, comp) {
      checkTable(t, 1, 'sort');
      var n = len(t);
      if (n > 1) {
        var a = new Array(n + 1);
        for (var i = 1; i <= n; i++) a[i] = index(t, i);
        var less;
        if (comp !== undefined) {
          var cf = call(comp);
          less = function (x, y) { return truthy(first(cf(x, y))); };
        } else less = lt;
        auxsort(a, 1, n, 0, less);
        for (var j = 1; j <= n; j++) setindex(t, j, a[j]);
      }
      return NONE;
    });
    return T;
  }

  // Lua 5.4's ltablib.c sort, line for line: ties come out in the same
  // order as in the real Lua, which matters to engines that sort with them.
  var RANLIMIT = 100;
  function auxsort(a, lo, up, rnd, less) {
    var t;
    while (lo < up) {
      if (less(a[up], a[lo])) { t = a[lo]; a[lo] = a[up]; a[up] = t; }
      if (up - lo === 1) break;
      var p;
      if (up - lo < RANLIMIT || rnd === 0) p = Math.floor((lo + up) / 2);
      else { var r4 = Math.floor((up - lo) / 4); p = rnd % (r4 * 2) + (lo + r4); }
      if (less(a[p], a[lo])) { t = a[p]; a[p] = a[lo]; a[lo] = t; }
      else if (less(a[up], a[p])) { t = a[p]; a[p] = a[up]; a[up] = t; }
      if (up - lo === 2) break;
      var P = a[p];
      t = a[p]; a[p] = a[up - 1]; a[up - 1] = t;
      // partition
      var i = lo, j = up - 1;
      for (;;) {
        while (less(a[++i], P)) {
          if (i === up - 1) throw rterror('invalid order function for sorting');
        }
        while (less(P, a[--j])) {
          if (j < i) throw rterror('invalid order function for sorting');
        }
        if (j < i) { t = a[up - 1]; a[up - 1] = a[i]; a[i] = t; break; }
        t = a[i]; a[i] = a[j]; a[j] = t;
      }
      p = i;
      var n;
      if (p - lo < up - p) { auxsort(a, lo, p - 1, rnd, less); n = p - lo; lo = p + 1; }
      else { auxsort(a, p + 1, up, rnd, less); n = up - p; up = p - 1; }
      if ((up - lo) / 128 > n) rnd = 0x5bd1e995;   // real Lua randomises here
    }
  }

  // ---------------------------------------------------------- math ------
  function makeMathLib() {
    var M = new LuaTable();
    M.set('pi', Math.PI);
    M.set('huge', Infinity);
    M.set('maxinteger', 9223372036854775807);
    M.set('mininteger', -9223372036854775808);
    M.set('abs', function (x) {
      if (typeof x === 'number') return Number.isInteger(x) ? (x < 0 ? 0 - x : x) : Math.abs(x);
      if (x instanceof LFloat) return new LFloat(Math.abs(x.n));
      return mkfOrInt(Math.abs(checkNum(x, 1, 'abs')), x);
    });
    M.set('floor', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      var r = Math.floor(checkNum(x, 1, 'floor'));
      return r === 0 ? 0 : r;
    });
    M.set('ceil', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      var r = Math.ceil(checkNum(x, 1, 'ceil'));
      return r === 0 ? 0 : r;
    });
    function minmax(isMax, name) {
      return function () {
        if (arguments.length === 0) throw argError(1, name, 'number expected, got no value');
        var best = arguments[0]; checkNum(best, 1, name);
        for (var i = 1; i < arguments.length; i++) {
          var v = arguments[i]; checkNum(v, i + 1, name);
          if (isMax ? lt(best, v) : lt(v, best)) best = v;
        }
        return best;
      };
    }
    M.set('max', minmax(true, 'max'));
    M.set('min', minmax(false, 'min'));
    function fl(f, name) { return function (x) { return mkf(f(checkNum(x, 1, name))); }; }
    M.set('sqrt', fl(Math.sqrt, 'sqrt'));
    M.set('sin', fl(Math.sin, 'sin'));
    M.set('cos', fl(Math.cos, 'cos'));
    M.set('tan', fl(Math.tan, 'tan'));
    M.set('asin', fl(Math.asin, 'asin'));
    M.set('acos', fl(Math.acos, 'acos'));
    M.set('exp', fl(Math.exp, 'exp'));
    M.set('atan', function (y, x) { return mkf(Math.atan2(checkNum(y, 1, 'atan'), x === undefined ? 1 : checkNum(x, 2, 'atan'))); });
    M.set('log', function (x, base) {
      var v = checkNum(x, 1, 'log');
      if (base === undefined) return mkf(Math.log(v));
      var b = checkNum(base, 2, 'log');
      if (b === 2) return mkf(Math.log2(v));
      if (b === 10) return mkf(Math.log10(v));
      return mkf(Math.log(v) / Math.log(b));
    });
    M.set('fmod', function (a, b) {
      if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
        if (b === 0) throw argError(2, 'fmod', 'zero');
        return a % b === 0 ? 0 : a % b;
      }
      return mkf(checkNum(a, 1, 'fmod') % checkNum(b, 2, 'fmod'));
    });
    M.set('modf', function (x) {
      var v = checkNum(x, 1, 'modf');
      var ip = v >= 0 ? Math.floor(v) : Math.ceil(v);
      var fp = (v === Infinity || v === -Infinity) ? 0 : v - ip;
      return new Multi([mkf(ip), mkf(fp)]);
    });
    M.set('tointeger', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      if (x instanceof LFloat) return x.n;
      if (typeof x === 'string') { var n = str2num(x); return n === undefined ? undefined : (typeof n === 'number' && Number.isInteger(n) ? n : (n instanceof LFloat ? n.n : undefined)); }
      return undefined;
    });
    M.set('type', function (x) {
      if (arguments.length === 0) throw argError(1, 'type', 'value expected');
      if (typeof x === 'number') return Number.isInteger(x) ? 'integer' : 'float';
      if (x instanceof LFloat) return 'float';
      return undefined;
    });
    M.set('ult', function (a, b) {
      return BigInt.asUintN(64, BigInt(checkInt(a, 1, 'ult'))) < BigInt.asUintN(64, BigInt(checkInt(b, 2, 'ult')));
    });

    // xoshiro256**, as lmathlib.c has it, on 64-bit BigInts.
    var MASK = (1n << 64n) - 1n;
    var state = [0n, 0n, 0n, 0n];
    function rotl(x, n) { return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK; }
    function nextrand() {
      var s0 = state[0], s1 = state[1], s2 = state[2] ^ s0, s3 = state[3] ^ s1;
      var res = (rotl((s1 * 5n) & MASK, 7) * 9n) & MASK;
      state[0] = s0 ^ s3;
      state[1] = s1 ^ s2;
      state[2] = s2 ^ ((s1 << 17n) & MASK);
      state[3] = rotl(s3, 45);
      return res;
    }
    function setseed(n1, n2) {
      state = [BigInt.asUintN(64, n1), 0xffn, BigInt.asUintN(64, n2), 0n];
      for (var i = 0; i < 16; i++) nextrand();
    }
    setseed(BigInt(Date.now()), 0n);
    function project(ran, n) {
      if ((n & (n + 1n)) === 0n) return ran & n;
      var lim = n;
      lim |= lim >> 1n; lim |= lim >> 2n; lim |= lim >> 4n; lim |= lim >> 8n;
      lim |= lim >> 16n; lim |= lim >> 32n;
      while ((ran &= lim) > n) ran = nextrand();
      return ran;
    }
    M.set('random', function (m, n) {
      var rv = nextrand();
      var low, up;
      switch (arguments.length) {
        case 0: return mkf(Number(rv >> 11n) * Math.pow(2, -53));
        case 1:
          low = 1n; up = BigInt(checkInt(m, 1, 'random'));
          if (up === 0n) return fromInt64(rv);
          break;
        case 2:
          low = BigInt(checkInt(m, 1, 'random')); up = BigInt(checkInt(n, 2, 'random'));
          break;
        default: throw rterror('wrong number of arguments');
      }
      if (!(low <= up)) throw argError(1, 'random', 'interval is empty');
      var p = project(rv, BigInt.asUintN(64, up - low));
      return fromInt64(p + BigInt.asUintN(64, low));
    });
    M.set('randomseed', function (a, b) {
      if (arguments.length === 0) { setseed(BigInt(Date.now()), 0n); return; }
      var n1 = isFloatVal(a) ? BigInt(Math.trunc(num(a))) : BigInt(checkInt(a, 1, 'randomseed'));
      var n2 = b === undefined ? 0n : BigInt(checkInt(b, 2, 'randomseed'));
      setseed(n1, n2);
      return new Multi([fromInt64(n1), fromInt64(n2)]);
    });
    return M;
  }
  function mkfOrInt(r, orig) { return isFloatVal(orig) ? mkf(r) : r; }

  // ------------------------------------------------------------ os ------
  function makeOsLib(host) {
    var O = new LuaTable();
    var now = host.now || function () { return Date.now(); };
    O.set('time', function (t) {
      if (t === undefined) return Math.floor(now() / 1000);
      checkTable(t, 1, 'time');
      function field(k, d) {
        var v = t.get(k);
        if (v === undefined) { if (d === undefined) throw rterror("field '" + k + "' missing in date table"); return d; }
        return num(v);
      }
      var d = new Date(field('year'), field('month') - 1, field('day'), field('hour', 12), field('min', 0), field('sec', 0));
      return Math.floor(d.getTime() / 1000);
    });
    O.set('clock', function () {
      var p = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      return mkf(p / 1000);
    });
    O.set('date', function (fmt, t) {
      fmt = fmt === undefined ? '%c' : checkStr(fmt, 1, 'date');
      var ms = t === undefined ? now() : num(t) * 1000;
      var utc = fmt[0] === '!';
      if (utc) fmt = fmt.slice(1);
      var d = new Date(ms);
      var g = utc
        ? { Y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds(), w: d.getUTCDay() }
        : { Y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), w: d.getDay() };
      var start = utc ? Date.UTC(g.Y, 0, 1) : new Date(g.Y, 0, 1).getTime();
      var cur = utc ? Date.UTC(g.Y, g.m, g.d) : new Date(g.Y, g.m, g.d).getTime();
      var yday = Math.round((cur - start) / 86400000) + 1;
      if (fmt.slice(0, 2) === '*t') {
        var r = new LuaTable();
        r.set('year', g.Y); r.set('month', g.m + 1); r.set('day', g.d);
        r.set('hour', g.H); r.set('min', g.M); r.set('sec', g.S);
        r.set('wday', g.w + 1); r.set('yday', yday); r.set('isdst', false);
        return r;
      }
      var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return fmt.replace(/%(.)/g, function (_, c) {
        switch (c) {
          case 'Y': return String(g.Y);
          case 'y': return p2(g.Y % 100);
          case 'm': return p2(g.m + 1);
          case 'd': return p2(g.d);
          case 'e': return (g.d < 10 ? ' ' : '') + g.d;
          case 'H': return p2(g.H);
          case 'I': return p2(((g.H + 11) % 12) + 1);
          case 'M': return p2(g.M);
          case 'S': return p2(g.S);
          case 'p': return g.H < 12 ? 'AM' : 'PM';
          case 'A': return DAYS[g.w];
          case 'a': return DAYS[g.w].slice(0, 3);
          case 'B': return MONTHS[g.m];
          case 'b': return MONTHS[g.m].slice(0, 3);
          case 'j': return String(yday).padStart(3, '0');
          case 'w': return String(g.w);
          case 'u': return String(g.w === 0 ? 7 : g.w);
          case 'x': return p2(g.m + 1) + '/' + p2(g.d) + '/' + p2(g.Y % 100);
          case 'X': return p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S);
          case 'c': return DAYS[g.w].slice(0, 3) + ' ' + MONTHS[g.m].slice(0, 3) + ' ' + (g.d < 10 ? ' ' : '') + g.d + ' ' + p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S) + ' ' + g.Y;
          case '%': return '%';
          default: return '%' + c;
        }
      });
    });
    O.set('getenv', function () { return undefined; });
    O.set('remove', function (path) {
      if (host.removeFile && host.removeFile(path)) return true;
      return new Multi([undefined, path + ': No such file or directory', 2]);
    });
    O.set('rename', function (a, b) {
      if (host.renameFile && host.renameFile(a, b)) return true;
      return new Multi([undefined, a + ': No such file or directory', 2]);
    });
    O.set('exit', function () { throw new LuaError('os.exit called'); });
    O.set('tmpname', function () { return '/tmp/lua_' + Math.random().toString(36).slice(2); });
    return O;
  }

  // ------------------------------------------------------------ io ------
  // Files live wherever the host keeps them (host.readFile / host.writeFile):
  // Battle Pass keeps its save file this way.
  function makeIoLib(host) {
    var IO = new LuaTable();
    var fileMeta = new LuaTable();
    var fileMethods = new LuaTable();
    fileMeta.set('__index', fileMethods);
    fileMeta.set('__name', 'FILE*');
    function newFile(path, mode, data) {
      var f = new LuaTable();
      f.mt = fileMeta;
      f._path = path; f._mode = mode; f._data = data; f._pos = 0; f._closed = false;
      return f;
    }
    IO.set('open', function (path, mode) {
      path = checkStr(path, 1, 'open');
      mode = mode === undefined ? 'r' : checkStr(mode, 2, 'open');
      var m = mode.replace('b', '');
      if (m[0] === 'r') {
        var data = host.readFile ? host.readFile(path) : null;
        if (data === null || data === undefined) return new Multi([undefined, path + ': No such file or directory', 2]);
        return newFile(path, m, data);
      }
      if (m[0] === 'w') return newFile(path, m, '');
      if (m[0] === 'a') {
        var old = host.readFile ? host.readFile(path) : null;
        var f = newFile(path, m, old || '');
        f._pos = f._data.length;
        return f;
      }
      throw argError(2, 'open', 'invalid mode');
    });
    fileMethods.set('read', function (f) {
      var fmts = Array.prototype.slice.call(arguments, 1);
      if (!fmts.length) fmts = ['l'];
      var out = [];
      for (var i = 0; i < fmts.length; i++) {
        var fm = fmts[i];
        if (isNum(fm)) {
          var n = num(fm);
          if (f._pos >= f._data.length && n > 0) { out.push(undefined); break; }
          out.push(f._data.substr(f._pos, n)); f._pos += n; continue;
        }
        fm = String(fm).replace(/^\*/, '');
        if (fm[0] === 'a') { out.push(f._data.slice(f._pos)); f._pos = f._data.length; continue; }
        if (fm[0] === 'l' || fm[0] === 'L') {
          if (f._pos >= f._data.length) { out.push(undefined); break; }
          var e = f._data.indexOf('\n', f._pos);
          var line = e < 0 ? f._data.slice(f._pos) : f._data.slice(f._pos, fm[0] === 'L' ? e + 1 : e);
          f._pos = e < 0 ? f._data.length : e + 1;
          out.push(line); continue;
        }
        if (fm[0] === 'n') {
          var m = /^\s*[-+]?(0[xX][0-9a-fA-F.]+|\d*\.?\d+(?:[eE][-+]?\d+)?)/.exec(f._data.slice(f._pos));
          if (!m) { out.push(undefined); break; }
          f._pos += m[0].length; out.push(str2num(m[0])); continue;
        }
      }
      return ret(out);
    });
    fileMethods.set('write', function (f) {
      for (var i = 1; i < arguments.length; i++) {
        var v = arguments[i];
        var s = typeof v === 'string' ? v : writeNum(v);
        f._data = f._data.slice(0, f._pos) + s + f._data.slice(f._pos + s.length);
        f._pos += s.length;
      }
      return f;
    });
    fileMethods.set('lines', function (f) {
      return function () { return first(fileMethods.get('read')(f, 'l')); };
    });
    fileMethods.set('seek', function (f, whence, off) {
      whence = whence || 'cur'; off = off === undefined ? 0 : num(off);
      if (whence === 'set') f._pos = off;
      else if (whence === 'end') f._pos = f._data.length + off;
      else f._pos += off;
      return f._pos;
    });
    fileMethods.set('flush', function (f) {
      if (f._mode[0] !== 'r' && host.writeFile) host.writeFile(f._path, f._data);
      return f;
    });
    fileMethods.set('close', function (f) {
      if (!f._closed && f._mode[0] !== 'r' && host.writeFile) host.writeFile(f._path, f._data);
      f._closed = true;
      return true;
    });
    fileMethods.set('setvbuf', function () { return true; });
    IO.set('write', function () {
      var s = '';
      for (var i = 0; i < arguments.length; i++) s += typeof arguments[i] === 'string' ? arguments[i] : writeNum(arguments[i]);
      (host.write || host.print || function (x) { if (typeof process !== 'undefined') process.stdout.write(x); })(s);
      return NONE;
    });
    IO.set('lines', function (path) {
      var data = host.readFile ? host.readFile(path) : null;
      if (data === null || data === undefined) throw rterror(path + ': No such file or directory');
      var f = newFile(path, 'r', data);
      return function () { return first(fileMethods.get('read')(f, 'l')); };
    });
    return IO;
  }

  // ---------------------------------------------------------- utf8 ------
  function makeUtf8Lib() {
    var U = new LuaTable();
    U.set('char', function () {
      var s = '';
      for (var i = 0; i < arguments.length; i++) s += NS.utf8Bytes(checkInt(arguments[i], i + 1, 'char'));
      return s;
    });
    U.set('charpattern', '[\x00-\x7F\xC2-\xFD][\x80-\xBF]*');
    function decodeAt(s, i) {   // i 0-based; returns [codepoint, length] or null
      var c = s.charCodeAt(i);
      if (c < 0x80) return [c, 1];
      var n = c >= 0xF0 ? 4 : c >= 0xE0 ? 3 : c >= 0xC0 ? 2 : 0;
      if (!n) return null;
      var cp = c & (0x7F >> n);
      for (var k = 1; k < n; k++) {
        var cc = s.charCodeAt(i + k);
        if ((cc & 0xC0) !== 0x80) return null;
        cp = (cp << 6) | (cc & 0x3F);
      }
      return [cp, n];
    }
    U.set('len', function (s, i, j) {
      s = checkStr(s, 1, 'len');
      var a = (i === undefined ? 1 : num(i)) - 1, b = j === undefined ? s.length : num(j);
      var n = 0;
      while (a < b) {
        var d = decodeAt(s, a);
        if (!d) return new Multi([undefined, a + 1]);
        a += d[1]; n++;
      }
      return n;
    });
    U.set('codepoint', function (s, i, j) {
      s = checkStr(s, 1, 'codepoint');
      var a = (i === undefined ? 1 : num(i)), b = j === undefined ? a : num(j);
      var out = [], p = a - 1;
      while (p < b) {
        var d = decodeAt(s, p);
        if (!d) throw rterror('invalid UTF-8 code');
        out.push(d[0]); p += d[1];
      }
      return ret(out);
    });
    U.set('offset', function (s, n, i) {
      s = checkStr(s, 1, 'offset');
      n = num(n);
      var p = i === undefined ? (n >= 0 ? 1 : s.length + 1) : num(i);
      p -= 1;
      function cont(k) { return (s.charCodeAt(k) & 0xC0) === 0x80; }
      if (n === 0) { while (p > 0 && cont(p)) p--; return p + 1; }
      if (n > 0) { n--; while (n > 0 && p < s.length) { p++; while (cont(p)) p++; n--; } return n === 0 ? p + 1 : undefined; }
      while (n < 0 && p > 0) { p--; while (p > 0 && cont(p)) p--; n++; }
      return n === 0 ? p + 1 : undefined;
    });
    U.set('codes', function (s) {
      s = checkStr(s, 1, 'codes');
      return new Multi([function (str, i) {
        var p = num(i);
        if (p > 0) { var d0 = decodeAt(str, p - 1); p += d0 ? d0[1] - 1 : 0; }
        if (p >= str.length) return undefined;
        var d = decodeAt(str, p);
        if (!d) throw rterror('invalid UTF-8 code');
        return new Multi([p + 1, d[0]]);
      }, s, 0]);
    });
    return U;
  }

  // ======================================================== strings =======
  var stringLib = new LuaTable();
  var stringMeta = new LuaTable();
  stringMeta.set('__index', stringLib);

  function posrelatI(pos, l) {
    if (pos > 0) return pos;
    if (pos === 0) return 1;
    if (pos < -l) return 1;
    return l + pos + 1;
  }
  function getendpos(pos, l) {
    if (pos > l) return l;
    if (pos >= 0) return pos;
    if (pos < -l) return 0;
    return l + pos + 1;
  }
  stringLib.set('len', function (s) { return checkStr(s, 1, 'len').length; });
  stringLib.set('sub', function (s, i, j) {
    s = checkStr(s, 1, 'sub');
    var l = s.length;
    var st = posrelatI(checkInt(i === undefined ? 1 : i, 2, 'sub'), l);
    var en = getendpos(j === undefined ? -1 : checkInt(j, 3, 'sub'), l);
    if (st < 1) st = 1;
    if (en > l) en = l;
    return st <= en ? s.slice(st - 1, en) : '';
  });
  stringLib.set('upper', function (s) {
    s = checkStr(s, 1, 'upper');
    return s.replace(/[a-z]+/g, function (m) { return m.toUpperCase(); });
  });
  stringLib.set('lower', function (s) {
    s = checkStr(s, 1, 'lower');
    return s.replace(/[A-Z]+/g, function (m) { return m.toLowerCase(); });
  });
  stringLib.set('rep', function (s, n, sep) {
    s = checkStr(s, 1, 'rep'); n = checkInt(n, 2, 'rep');
    if (n <= 0) return '';
    if (sep === undefined || sep === '') return s.repeat(n);
    sep = checkStr(sep, 3, 'rep');
    return Array(n).fill(s).join(sep);
  });
  stringLib.set('reverse', function (s) { return checkStr(s, 1, 'reverse').split('').reverse().join(''); });
  stringLib.set('byte', function (s, i, j) {
    s = checkStr(s, 1, 'byte');
    var l = s.length;
    var pi = posrelatI(optInt(i, 2, 'byte', 1), l);
    var pe = getendpos(j === undefined ? pi : checkInt(j, 3, 'byte'), l);
    if (pi > pe) return undefined;
    var out = [];
    for (var k = pi; k <= pe; k++) out.push(s.charCodeAt(k - 1));
    return ret(out);
  });
  stringLib.set('char', function () {
    var out = '';
    for (var i = 0; i < arguments.length; i++) {
      var c = checkInt(arguments[i], i + 1, 'char');
      if (c < 0 || c > 255) throw argError(i + 1, 'char', 'value out of range');
      out += String.fromCharCode(c);
    }
    return out;
  });

  // string.format, with C's own rounding.
  stringLib.set('format', function (fmt) {
    fmt = checkStr(fmt, 1, 'format');
    var args = arguments, argi = 1;
    var out = '', i = 0, n = fmt.length;
    while (i < n) {
      var c = fmt[i++];
      if (c !== '%') { out += c; continue; }
      if (fmt[i] === '%') { out += '%'; i++; continue; }
      var m = /^([-+ #0]*)(\d*)(?:\.(\d*))?([a-zA-Z])/.exec(fmt.slice(i));
      if (!m) throw rterror("invalid conversion '%" + fmt.slice(i, i + 5) + "' to 'format'");
      i += m[0].length;
      var flags = m[1], width = m[2] ? Number(m[2]) : 0, prec = m[3] === undefined ? undefined : Number(m[3] || 0);
      var conv = m[4];
      var argn = ++argi;
      if (argn > args.length - 1 + 1 && conv !== '%') {
        if (args[argn - 1] === undefined && argn > args.length) throw argError(argn, 'format', 'no value');
      }
      var v = args[argn - 1], body, sign = '';
      switch (conv) {
        case 'd': case 'i': {
          var iv = checkInt(v, argn, 'format');
          body = String(Math.abs(iv) < 1e21 ? Math.abs(iv) : BigInt(iv) * (iv < 0 ? -1n : 1n));
          if (prec !== undefined) { body = body.padStart(prec, '0'); if (prec === 0 && iv === 0) body = ''; }
          sign = iv < 0 ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
          out += pad(sign, body, width, flags, prec === undefined);
          break;
        }
        case 'u': {
          var uv = checkInt(v, argn, 'format');
          body = BigInt.asUintN(64, BigInt(uv)).toString();
          out += pad('', body, width, flags, true);
          break;
        }
        case 'c': out += pad('', String.fromCharCode(checkInt(v, argn, 'format')), width, flags.replace('0', ''), false); break;
        case 'x': case 'X': case 'o': {
          var xv = BigInt.asUintN(64, BigInt(checkInt(v, argn, 'format')));
          body = xv.toString(conv === 'o' ? 8 : 16);
          if (conv === 'X') body = body.toUpperCase();
          if (prec !== undefined) body = body.padStart(prec, '0');
          var pre = (flags.indexOf('#') >= 0 && xv !== 0n) ? (conv === 'o' ? '0' : (conv === 'x' ? '0x' : '0X')) : '';
          out += pad(pre, body, width, flags, prec === undefined);
          break;
        }
        case 'e': case 'E': case 'f': case 'F': case 'g': case 'G': case 'a': case 'A': {
          var fv = checkNum(v, argn, 'format');
          var neg = fv < 0 || (fv === 0 && 1 / fv < 0);
          var ax = Math.abs(fv);
          var up = conv === 'E' || conv === 'G' || conv === 'F' || conv === 'A';
          if (ax === Infinity || fv !== fv) {
            body = fv !== fv ? 'nan' : 'inf';
            if (up) body = body.toUpperCase();
            sign = neg && fv === fv ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
            out += pad(sign, body, width, flags.replace('0', ''), false);
            break;
          }
          var p = prec === undefined ? 6 : prec;
          var alt = flags.indexOf('#') >= 0;
          if (conv === 'f' || conv === 'F') { body = fixedDigits(ax, p); if (alt && p === 0) body += '.'; }
          else if (conv === 'e' || conv === 'E') body = fmtExp(ax, p, up);
          else if (conv === 'g' || conv === 'G') body = fmtG(ax, p, up, alt);
          else body = hexFloat(ax, prec, up);
          sign = neg ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
          out += pad(sign, body, width, flags, true);
          break;
        }
        case 's': {
          var sv = tostring(v);
          if (args.length < argn) throw argError(argn, 'format', 'no value');
          if (prec !== undefined) sv = sv.slice(0, prec);
          out += pad('', sv, width, flags.replace('0', ''), false);
          break;
        }
        case 'q': out += quoteString(v); break;
        default:
          throw rterror("invalid conversion '%" + m[0] + "' to 'format'");
      }
    }
    return out;
  });
  function pad(sign, body, width, flags, zeroOk) {
    var total = sign.length + body.length;
    if (total >= width) return sign + body;
    if (flags.indexOf('-') >= 0) return sign + body + ' '.repeat(width - total);
    if (zeroOk && flags.indexOf('0') >= 0) return sign + '0'.repeat(width - total) + body;
    return ' '.repeat(width - total) + sign + body;
  }
  function hexFloat(x, prec, up) {
    if (x === 0) return up ? '0X0P+0' : '0x0p+0';
    var e = Math.floor(Math.log2(x)), m = x / Math.pow(2, e);
    if (m >= 2) { m /= 2; e++; } else if (m < 1) { m *= 2; e--; }
    var frac = (m - 1).toString(16).slice(2);
    if (prec !== undefined) frac = frac.slice(0, prec).padEnd(prec, '0');
    var s = '0x1' + (frac ? '.' + frac : '') + 'p' + (e >= 0 ? '+' : '') + e;
    return up ? s.toUpperCase() : s;
  }
  function quoteString(v) {
    if (typeof v === 'string') {
      var o = '"';
      for (var i = 0; i < v.length; i++) {
        var c = v.charCodeAt(i), ch = v[i];
        if (ch === '"' || ch === '\\') o += '\\' + ch;
        else if (ch === '\n') o += '\\\n';
        else if (ch === '\r') o += '\\r';
        else if (c === 0) o += (i + 1 < v.length && /\d/.test(v[i + 1])) ? '\\000' : '\\0';
        else if (c < 32 || c === 127) o += '\\' + ((i + 1 < v.length && /\d/.test(v[i + 1])) ? String(c).padStart(3, '0') : c);
        else o += ch;
      }
      return o + '"';
    }
    if (typeof v === 'number' && Number.isInteger(v)) return intStr(v);
    if (isNum(v)) {
      var x = num(v);
      if (x === Infinity) return '1e9999';
      if (x === -Infinity) return '-1e9999';
      if (x !== x) return '(0/0)';
      if (x === Math.floor(x)) return (x < 0 ? '-' : '') + hexFloat(Math.abs(x)) ;
      return (x < 0 ? '-' : '') + hexFloat(Math.abs(x));
    }
    if (v === undefined || typeof v === 'boolean') return tostring(v);
    throw rterror("bad argument to 'format' (value has no literal form)");
  }

  // ----------------------------------------------------- patterns ------
  // lstrlib.c's matcher, ported line for line.
  var L_ESC = 37, CAP_UNFINISHED = -1, CAP_POSITION = -2, MAXCCALLS = 200, MAXCAPTURES = 32;
  function MatchState(src, pat) {
    this.src = src; this.pat = pat; this.level = 0; this.matchdepth = MAXCCALLS;
    this.capInit = new Array(MAXCAPTURES); this.capLen = new Array(MAXCAPTURES);
  }
  function classEnd(ms, p) {
    var pat = ms.pat, pe = pat.length;
    var c = pat.charCodeAt(p++);
    if (c === L_ESC) {
      if (p >= pe) throw rterror("malformed pattern (ends with '%')");
      return p + 1;
    }
    if (c === 91) {   // '['
      if (pat.charCodeAt(p) === 94) p++;
      do {
        if (p >= pe) throw rterror("malformed pattern (missing ']')");
        if (pat.charCodeAt(p++) === L_ESC && p < pe) p++;
      } while (pat.charCodeAt(p) !== 93);
      return p + 1;
    }
    return p;
  }
  function isalpha(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }
  function isdigit(c) { return c >= 48 && c <= 57; }
  function islower(c) { return c >= 97 && c <= 122; }
  function isupper(c) { return c >= 65 && c <= 90; }
  function isspace(c) { return c === 32 || (c >= 9 && c <= 13); }
  function iscntrl(c) { return c < 32 || c === 127; }
  function ispunct(c) { return c >= 33 && c <= 126 && !isalpha(c) && !isdigit(c); }
  function isxdigit(c) { return isdigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); }
  function matchClass(c, cl) {
    var res;
    var low = cl >= 65 && cl <= 90 ? cl + 32 : cl;
    switch (low) {
      case 97: res = isalpha(c); break;            // a
      case 99: res = iscntrl(c); break;            // c
      case 100: res = isdigit(c); break;           // d
      case 103: res = c >= 33 && c <= 126; break;  // g
      case 108: res = islower(c); break;           // l
      case 112: res = ispunct(c); break;           // p
      case 115: res = isspace(c); break;           // s
      case 117: res = isupper(c); break;           // u
      case 119: res = isalpha(c) || isdigit(c); break; // w
      case 120: res = isxdigit(c); break;          // x
      default: return cl === c;
    }
    if (isupper(cl)) res = !res;
    return res;
  }
  function matchBracketClass(ms, c, p, ec) {
    var pat = ms.pat, sig = true;
    if (pat.charCodeAt(p + 1) === 94) { sig = false; p++; }
    while (++p < ec) {
      var pc = pat.charCodeAt(p);
      if (pc === L_ESC) {
        p++;
        if (matchClass(c, pat.charCodeAt(p))) return sig;
      } else if (pat.charCodeAt(p + 1) === 45 && p + 2 < ec) {
        p += 2;
        if (pat.charCodeAt(p - 2) <= c && c <= pat.charCodeAt(p)) return sig;
      } else if (pc === c) return sig;
    }
    return !sig;
  }
  function singleMatch(ms, s, p, ep) {
    if (s >= ms.src.length) return false;
    var c = ms.src.charCodeAt(s);
    var pc = ms.pat.charCodeAt(p);
    switch (pc) {
      case 46: return true;                                  // '.'
      case L_ESC: return matchClass(c, ms.pat.charCodeAt(p + 1));
      case 91: return matchBracketClass(ms, c, p, ep - 1);
      default: return pc === c;
    }
  }
  function matchBalance(ms, s, p) {
    if (p >= ms.pat.length - 1) throw rterror("malformed pattern (missing arguments to '%b')");
    var src = ms.src;
    if (src.charCodeAt(s) !== ms.pat.charCodeAt(p)) return -1;
    var b = ms.pat.charCodeAt(p), e = ms.pat.charCodeAt(p + 1), cont = 1;
    while (++s < src.length) {
      var c = src.charCodeAt(s);
      if (c === e) { if (--cont === 0) return s + 1; }
      else if (c === b) cont++;
    }
    return -1;
  }
  function maxExpand(ms, s, p, ep) {
    var i = 0;
    while (singleMatch(ms, s + i, p, ep)) i++;
    while (i >= 0) {
      var res = doMatch(ms, s + i, ep + 1);
      if (res !== -1) return res;
      i--;
    }
    return -1;
  }
  function minExpand(ms, s, p, ep) {
    for (;;) {
      var res = doMatch(ms, s, ep + 1);
      if (res !== -1) return res;
      else if (singleMatch(ms, s, p, ep)) s++;
      else return -1;
    }
  }
  function startCapture(ms, s, p, what) {
    var level = ms.level;
    if (level >= MAXCAPTURES) throw rterror('too many captures');
    ms.capInit[level] = s; ms.capLen[level] = what;
    ms.level = level + 1;
    var res = doMatch(ms, s, p);
    if (res === -1) ms.level--;
    return res;
  }
  function captureToClose(ms) {
    var level = ms.level;
    for (level--; level >= 0; level--) if (ms.capLen[level] === CAP_UNFINISHED) return level;
    throw rterror('invalid pattern capture');
  }
  function endCapture(ms, s, p) {
    var l = captureToClose(ms);
    ms.capLen[l] = s - ms.capInit[l];
    var res = doMatch(ms, s, p);
    if (res === -1) ms.capLen[l] = CAP_UNFINISHED;
    return res;
  }
  function checkCapture(ms, l) {
    l -= 49;
    if (l < 0 || l >= ms.level || ms.capLen[l] === CAP_UNFINISHED) throw rterror('invalid capture index %' + (l + 1));
    return l;
  }
  function matchCapture(ms, s, l) {
    l = checkCapture(ms, l);
    var len = ms.capLen[l];
    var cap = ms.src.substr(ms.capInit[l], len);
    if (ms.src.length - s >= len && ms.src.substr(s, len) === cap) return s + len;
    return -1;
  }
  function doMatch(ms, s, p) {
    if (ms.matchdepth-- === 0) throw rterror('pattern too complex');
    var pat = ms.pat, pe = pat.length;
    for (;;) {
      if (p === pe) break;
      var pc = pat.charCodeAt(p);
      if (pc === 40) {                                     // '('
        if (pat.charCodeAt(p + 1) === 41) s = startCapture(ms, s, p + 2, CAP_POSITION);
        else s = startCapture(ms, s, p + 1, CAP_UNFINISHED);
        break;
      }
      if (pc === 41) { s = endCapture(ms, s, p + 1); break; }   // ')'
      if (pc === 36 && p + 1 === pe) {                     // '$' at the end
        s = (s === ms.src.length) ? s : -1;
        break;
      }
      if (pc === L_ESC) {
        var nx = pat.charCodeAt(p + 1);
        if (nx === 98) {                                   // %b
          s = matchBalance(ms, s, p + 2);
          if (s !== -1) { p += 4; continue; }
          break;
        }
        if (nx === 102) {                                  // %f
          p += 2;
          if (pat.charCodeAt(p) !== 91) throw rterror("missing '[' after '%f' in pattern");
          var ep0 = classEnd(ms, p);
          var prev = (s === 0) ? 0 : ms.src.charCodeAt(s - 1);
          var cur = s < ms.src.length ? ms.src.charCodeAt(s) : 0;
          if (!matchBracketClass(ms, prev, p, ep0 - 1) && matchBracketClass(ms, cur, p, ep0 - 1)) { p = ep0; continue; }
          s = -1; break;
        }
        if (nx >= 48 && nx <= 57) {                        // %0-%9
          s = matchCapture(ms, s, nx);
          if (s !== -1) { p += 2; continue; }
          break;
        }
      }
      // default: a single class with an optional suffix
      var ep = classEnd(ms, p);
      var epc = pat.charCodeAt(ep);
      if (!singleMatch(ms, s, p, ep)) {
        if (epc === 42 || epc === 63 || epc === 45) { p = ep + 1; continue; }   // * ? -
        s = -1; break;
      }
      if (epc === 63) {                                    // ?
        var res = doMatch(ms, s + 1, ep + 1);
        if (res !== -1) { s = res; break; }
        p = ep + 1; continue;
      }
      if (epc === 43) { s = maxExpand(ms, s + 1, p, ep); break; }   // +
      if (epc === 42) { s = maxExpand(ms, s, p, ep); break; }       // *
      if (epc === 45) { s = minExpand(ms, s, p, ep); break; }       // -
      s++; p = ep;
    }
    ms.matchdepth++;
    return s;
  }
  function getCapture(ms, i, s, e) {
    if (i >= ms.level) {
      if (i !== 0) throw rterror('invalid capture index %' + (i + 1));
      return ms.src.slice(s, e);
    }
    var l = ms.capLen[i];
    if (l === CAP_UNFINISHED) throw rterror('unfinished capture');
    if (l === CAP_POSITION) return ms.capInit[i] + 1;
    return ms.src.substr(ms.capInit[i], l);
  }
  function captures(ms, s, e, wholeIfNone) {
    var n = (ms.level === 0 && wholeIfNone) ? 1 : ms.level;
    var out = [];
    for (var i = 0; i < n; i++) out.push(getCapture(ms, i, s, e));
    return out;
  }
  var SPECIALS = /[\^$*+?.()[\]%-]/;
  function strFindAux(find, s, p, init, plain, fname) {
    s = checkStr(s, 1, fname); p = checkStr(p, 2, fname);
    var ls = s.length;
    var st = posrelatI(optInt(init, 3, fname, 1), ls) - 1;
    if (st > ls) return undefined;
    if (find && (truthy(plain) || !SPECIALS.test(p))) {
      var idx = s.indexOf(p, st);
      if (idx >= 0) return new Multi([idx + 1, idx + p.length]);
      return undefined;
    }
    var anchor = p.charCodeAt(0) === 94;
    var pp = anchor ? p.slice(1) : p;
    var ms = new MatchState(s, pp);
    var s1 = st;
    do {
      ms.level = 0; ms.matchdepth = MAXCCALLS;
      var res = doMatch(ms, s1, 0);
      if (res !== -1) {
        if (find) return new Multi([s1 + 1, res].concat(captures(ms, -1, 0, false)));
        return ret(captures(ms, s1, res, true));
      }
    } while (s1++ < ls && !anchor);
    return undefined;
  }
  stringLib.set('find', function (s, p, init, plain) { return strFindAux(true, s, p, init, plain, 'find'); });
  stringLib.set('match', function (s, p, init) { return strFindAux(false, s, p, init, false, 'match'); });
  stringLib.set('gmatch', function (s, p, init) {
    s = checkStr(s, 1, 'gmatch'); p = checkStr(p, 2, 'gmatch');
    var ls = s.length;
    var src = posrelatI(optInt(init, 3, 'gmatch', 1), ls) - 1;
    if (src > ls) src = ls + 1;
    var ms = new MatchState(s, p), lastmatch = -1;
    return function () {
      for (; src <= ls; src++) {
        ms.level = 0; ms.matchdepth = MAXCCALLS;
        var e = doMatch(ms, src, 0);
        if (e !== -1 && e !== lastmatch) {
          var start = src;
          src = lastmatch = e;
          return ret(captures(ms, start, e, true));
        }
      }
      return undefined;
    };
  });
  stringLib.set('gsub', function (s, p, repl, maxn) {
    s = checkStr(s, 1, 'gsub'); p = checkStr(p, 2, 'gsub');
    var tr = typeName(repl);
    if (!(tr === 'number' || tr === 'string' || tr === 'table' || tr === 'function')) {
      throw argError(3, 'gsub', 'string/function/table expected, got ' + typeNameArg(repl));
    }
    var maxS = maxn === undefined ? s.length + 1 : checkInt(maxn, 4, 'gsub');
    var anchor = p.charCodeAt(0) === 94;
    var pp = anchor ? p.slice(1) : p;
    var ms = new MatchState(s, pp);
    var src = 0, lastmatch = -1, n = 0, out = '';
    var rs = tr === 'string' || tr === 'number' ? (typeof repl === 'string' ? repl : numStr(repl)) : null;
    while (n < maxS) {
      ms.level = 0; ms.matchdepth = MAXCCALLS;
      var e = doMatch(ms, src, 0);
      if (e !== -1 && e !== lastmatch) {
        n++;
        out += addValue(ms, src, e, repl, rs, tr);
        src = lastmatch = e;
      } else if (src < s.length) out += s[src++];
      else break;
      if (anchor) break;
    }
    if (src < s.length) out += s.slice(src);
    return new Multi([out, n]);
  });
  function addValue(ms, s, e, repl, rs, tr) {
    var whole = ms.src.slice(s, e), v;
    if (rs !== null) {
      var o = '';
      for (var i = 0; i < rs.length; i++) {
        var c = rs[i];
        if (c !== '%') { o += c; continue; }
        i++;
        var d = rs[i];
        if (d === '%') o += '%';
        else if (d !== undefined && d >= '0' && d <= '9') {
          var cap = d === '0' ? whole : getCapture(ms, d.charCodeAt(0) - 49, s, e);
          o += typeof cap === 'string' ? cap : numStr(cap);
        } else throw rterror("invalid use of '%' in replacement string");
      }
      return o;
    }
    var caps = captures(ms, s, e, true);
    if (tr === 'table') v = index(repl, caps[0]);
    else v = first(call(repl).apply(null, caps));
    if (v === undefined || v === false) return whole;
    if (typeof v === 'string') return v;
    if (isNum(v)) return numStr(v);
    throw rterror('invalid replacement value (a ' + typeName(v) + ')');
  }

  // ===================================================== conversion =======
  // Between JS values (UTF-16 strings, arrays, objects) and Lua values.
  var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  function toBytes(str) {        // JS string -> Lua byte string
    if (/^[\x00-\x7f]*$/.test(str)) return str;
    var b = encoder.encode(str), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  }
  function fromBytes(s) {        // Lua byte string -> JS string
    if (/^[\x00-\x7f]*$/.test(s)) return s;
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return decoder.decode(b);
  }
  function toLua(v) {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return toBytes(v);
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'function') return v;
    if (v instanceof LuaTable || v instanceof LFloat) return v;
    var t = new LuaTable();
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) t.set(i + 1, toLua(v[i])); return t; }
    Object.keys(v).forEach(function (k) { t.set(toBytes(k), toLua(v[k])); });
    return t;
  }
  function toJS(v, seen) {
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') return fromBytes(v);
    if (!(v instanceof LuaTable)) return v;
    seen = seen || new Map();
    if (seen.has(v)) return seen.get(v);
    var n = v.arr.length, hashSize = v.hash ? v.hash.size : 0;
    if (hashSize === 0) {
      var a = [];
      seen.set(v, a);
      for (var i = 0; i < n; i++) a.push(toJS(v.arr[i], seen));
      return a;
    }
    var o = {};
    seen.set(v, o);
    for (var j = 0; j < n; j++) if (v.arr[j] !== undefined) o[j + 1] = toJS(v.arr[j], seen);
    v.hash.forEach(function (val, key) {
      var k = typeof key === 'string' ? fromBytes(key) : (isNum(key) ? numStr(key) : tostring(key));
      o[k] = toJS(val, seen);
    });
    return o;
  }

  NS.LFloat = LFloat; NS.mkf = mkf; NS.Multi = Multi; NS.first = first; NS.sp = sp; NS.ret = ret;
  NS.LuaTable = LuaTable; NS.NONE = NONE; NS.LuaError = LuaError; NS.lineMaps = lineMaps;
  NS.add = add; NS.sub = sub; NS.mul = mul; NS.div = div; NS.idiv = idiv; NS.mod = mod; NS.pow = pow;
  NS.unm = unm; NS.band = band; NS.bor = bor; NS.bxor = bxor; NS.shl = shl; NS.shr = shr; NS.bnot = bnot;
  NS.concat = concat; NS.len = len; NS.eq = eq; NS.lt = lt; NS.le = le; NS.gt = gt; NS.ge = ge;
  NS.T = truthy; NS.index = index; NS.setindex = setindex; NS.call = call; NS.method = method;
  NS.tbl = tbl; NS.iter = iter; NS.forprep = forprep; NS.tostring = tostring; NS.typeName = typeName;
  NS.makeEnv = makeEnv; NS.toLua = toLua; NS.toJS = toJS; NS.toBytes = toBytes; NS.fromBytes = fromBytes;
  NS.numStr = numStr; NS.str2num = str2num; NS.errorValue = errorValue; NS.rterror = rterror;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/runtime/lua_compile.js ---- */
/* Middaw's Lua 5.4, part 2 of 3: syntax tree in, JavaScript out.
 *
 * Every Lua local becomes a JS `let` with a name of its own ($x, $x$2...), so
 * shadowing and closures behave as in Lua: a fresh binding per declaration,
 * and per loop iteration. Every operator goes through the runtime, so the
 * integer/float distinction and the error messages are Lua's. Each statement
 * starts a new line carrying a marker with its Lua line number, which is how
 * an error raised in the generated code is reported at the Lua line.
 */
(function (NS) {
  'use strict';

  var ARITH = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '^': 'pow', '//': 'idiv',
                '&': 'band', '|': 'bor', '~': 'bxor', '<<': 'shl', '>>': 'shr', '..': 'concat' };
  var COMPARE = { '==': 'eq', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };

  function compile(ast, chunk) {
    var consts = [];
    var nameCounts = Object.create(null);

    function uniqueName(luaName) {
      var n = (nameCounts[luaName] || 0) + 1;
      nameCounts[luaName] = n;
      return n === 1 ? '$' + luaName : '$' + luaName + '$' + n;
    }

    function FuncState(parent, vararg) {
      this.parent = parent; this.vararg = vararg; this.temps = 0; this.scopes = [];
    }
    var fs = null;
    var stmtUid = 0;

    function newTemp() { fs.temps++; return '$$' + fs.temps; }
    function lookup(name) {
      for (var f = fs; f; f = f.parent) {
        for (var i = f.scopes.length - 1; i >= 0; i--) {
          var js = f.scopes[i][name];
          if (js !== undefined) return js;
        }
      }
      return null;
    }
    function declare(name) {
      var js = uniqueName(name);
      fs.scopes[fs.scopes.length - 1][name] = js;
      return js;
    }
    function openScope() { fs.scopes.push(Object.create(null)); }
    function closeScope() { fs.scopes.pop(); }

    function err(msg, line) {
      throw new NS.LuaSyntaxError(msg, chunk, line || 0);
    }

    function str(s) { return JSON.stringify(s); }

    function numberLiteral(text) {
      var v;
      if (/^0[xX]/.test(text)) {
        if (/[.pP]/.test(text)) v = NS.str2num(text);
        else {
          var big = BigInt.asIntN(64, BigInt('0x' + text.slice(2)));
          return String(Number(big));
        }
      } else if (/[.eE]/.test(text)) {
        v = NS.mkf(Number(text));
      } else {
        var n = Number(text);
        if (Math.abs(n) > 9223372036854775807) v = NS.mkf(n);
        else return String(n);
      }
      if (v instanceof NS.LFloat) {
        var idx = consts.length;
        consts.push(v);
        return '$$K[' + idx + ']';
      }
      var s = String(v);
      return s === 'Infinity' ? 'Infinity' : (s === 'NaN' ? 'NaN' : (v < 0 ? '(' + s + ')' : s));
    }

    function describe(e) {
      if (e.k === 'Name') return lookup(e.name) ? "local '" + e.name + "'" : "global '" + e.name + "'";
      if (e.k === 'Index' && e.key.k === 'String') return "field '" + e.key.v + "'";
      if (e.k === 'Method') return "method '" + e.name + "'";
      return '';
    }

    function isMultiExpr(e) { return e.k === 'Call' || e.k === 'Method' || e.k === 'Vararg'; }

    // A JS expression for the raw result of a call: possibly a Multi.
    function callRaw(e) {
      if (e.k === 'Method') {
        var o = ex(e.obj);
        var args = argList(e.args);
        return 'L.method(' + o + ', ' + str(e.name) + (args ? ', ' + args : '') + ')';
      }
      var fn = ex(e.fn), a = argList(e.args), d = describe(e.fn);
      if (/^\$[A-Za-z_][\w$]*$/.test(fn)) {
        return '(typeof ' + fn + " === 'function' ? " + fn + ' : L.call(' + fn + ', ' + str(d) + '))(' + a + ')';
      }
      var t = newTemp();
      return '(typeof (' + t + ' = ' + fn + ") === 'function' ? " + t + ' : L.call(' + t + ', ' + str(d) + '))(' + a + ')';
    }

    function argList(exprs) {
      var out = [];
      for (var i = 0; i < exprs.length; i++) {
        var e = exprs[i], last = i === exprs.length - 1;
        if (last && (e.k === 'Call' || e.k === 'Method')) out.push('...L.sp(' + callRaw(e) + ')');
        else if (last && e.k === 'Vararg') { checkVararg(e); out.push('...$$va'); }
        else out.push(ex(e));
      }
      return out.join(', ');
    }
    function checkVararg(e) {
      if (!fs.vararg) err("cannot use '...' outside a vararg function", e.line);
    }

    // A JS expression for exactly one Lua value.
    function ex(e) {
      switch (e.k) {
        case 'Nil': return 'undefined';
        case 'True': return 'true';
        case 'False': return 'false';
        case 'Number': return numberLiteral(e.v);
        case 'String': return str(e.v);
        case 'Vararg': checkVararg(e); return '$$va[0]';
        case 'Function': return funcExpr(e);
        case 'Paren': return ex(e.expr);
        case 'Name': {
          var js = lookup(e.name);
          if (js) return js;
          return 'L.index($$G, ' + str(e.name) + ')';
        }
        case 'Index':
          return 'L.index(' + ex(e.obj) + ', ' + ex(e.key) + ', ' + str(describe(e.obj)) + ')';
        case 'Call': case 'Method':
          return 'L.first(' + callRaw(e) + ')';
        case 'Table': return tableExpr(e);
        case 'Unop': {
          if (e.op === 'not') return '!' + cond(e.expr);
          if (e.op === '-') {
            if (e.expr.k === 'Number') {
              var lit = numberLiteral(e.expr.v);
              if (/^\d+$/.test(lit)) return lit === '0' ? '0' : '(-' + lit + ')';
              if (/^[\d.e+-]+$/.test(lit)) return '(-' + lit + ')';
            }
            return 'L.unm(' + ex(e.expr) + ')';
          }
          if (e.op === '#') return 'L.len(' + ex(e.expr) + ')';
          if (e.op === '~') return 'L.bnot(' + ex(e.expr) + ')';
          break;
        }
        case 'Binop': {
          if (e.op === 'and') {
            var t = newTemp();
            return '(L.T(' + t + ' = ' + ex(e.left) + ') ? ' + ex(e.right) + ' : ' + t + ')';
          }
          if (e.op === 'or') {
            var t2 = newTemp();
            return '(L.T(' + t2 + ' = ' + ex(e.left) + ') ? ' + t2 + ' : ' + ex(e.right) + ')';
          }
          if (e.op === '~=') return '!L.eq(' + ex(e.left) + ', ' + ex(e.right) + ')';
          if (COMPARE[e.op]) return 'L.' + COMPARE[e.op] + '(' + ex(e.left) + ', ' + ex(e.right) + ')';
          return 'L.' + ARITH[e.op] + '(' + ex(e.left) + ', ' + ex(e.right) + ')';
        }
      }
      err('cannot compile expression ' + e.k, e.line);
    }

    // A JS boolean expression for Lua truth, without building a Lua value.
    function cond(e) {
      switch (e.k) {
        case 'True': return 'true';
        case 'False': case 'Nil': return 'false';
        case 'Paren': return cond(e.expr);
        case 'Unop': if (e.op === 'not') return '!' + cond(e.expr); break;
        case 'Binop':
          if (e.op === 'and') return '(' + cond(e.left) + ' && ' + cond(e.right) + ')';
          if (e.op === 'or') return '(' + cond(e.left) + ' || ' + cond(e.right) + ')';
          if (e.op === '~=' || COMPARE[e.op]) return ex(e);
          break;
      }
      return 'L.T(' + ex(e) + ')';
    }

    function tableExpr(e) {
      var pos = [], keyed = [];
      for (var i = 0; i < e.items.length; i++) {
        var it = e.items[i];
        if (it.kind === 'pos') {
          var lastPos = true;
          for (var j = i + 1; j < e.items.length; j++) if (e.items[j].kind === 'pos') { lastPos = false; break; }
          if (lastPos && (it.value.k === 'Call' || it.value.k === 'Method')) pos.push('...L.sp(' + callRaw(it.value) + ')');
          else if (lastPos && it.value.k === 'Vararg') { checkVararg(it.value); pos.push('...$$va'); }
          else pos.push(ex(it.value));
        } else {
          keyed.push(ex(it.key), ex(it.value));
        }
      }
      if (!keyed.length) return 'L.tbl([' + pos.join(', ') + '])';
      return 'L.tbl([' + pos.join(', ') + '], [' + keyed.join(', ') + '])';
    }

    function funcExpr(f) {
      var saved = fs;
      fs = new FuncState(saved, f.vararg);
      openScope();
      var params = f.params.map(function (p) { return declare(p); });
      if (f.vararg) params.push('...$$va');
      var body = block(f.body);
      closeScope();
      var temps = '';
      if (fs.temps) {
        var names = [];
        for (var i = 1; i <= fs.temps; i++) names.push('$$' + i);
        temps = 'let ' + names.join(', ') + ';';
      }
      fs = saved;
      return 'function (' + params.join(', ') + ') {' + temps + body + '\n/*@' + (f.endLine || f.line) + '*/return L.NONE;}';
    }

    function block(stmts) {
      var out = '';
      for (var i = 0; i < stmts.length; i++) out += statement(stmts[i]);
      return out;
    }
    function scoped(stmts) {
      openScope();
      var b = block(stmts);
      closeScope();
      return b;
    }

    function assignTo(target, value) {
      if (target.k === 'Name') {
        var js = lookup(target.name);
        if (js) return js + ' = ' + value + ';';
        return 'L.setindex($$G, ' + str(target.name) + ', ' + value + ');';
      }
      return 'L.setindex(' + ex(target.obj) + ', ' + ex(target.key) + ', ' + value + ', ' + str(describe(target.obj)) + ');';
    }

    function valuesArray(exprs) { return '[' + argList(exprs) + ']'; }

    function statement(s) {
      var mark = '\n/*@' + (s.line || 0) + '*/';
      switch (s.k) {
        case 'Local': {
          var attrs = s.attribs || [];
          attrs.forEach(function (a) {
            if (a && a !== 'const' && a !== 'close') err("unknown attribute '" + a + "'", s.line);
          });
          if (s.names.length === 1 && s.exprs.length <= 1) {
            var v = s.exprs.length ? ex(s.exprs[0]) : 'undefined';
            return mark + 'let ' + declare(s.names[0]) + ' = ' + v + ';';
          }
          if (s.exprs.length === s.names.length && !s.exprs.some(isMultiExpr)) {
            var vals = s.exprs.map(ex);
            var tmpNames = vals.map(function () { return '$$l' + (++stmtUid); });
            var pre = 'const ' + tmpNames.map(function (t, i) { return t + ' = ' + vals[i]; }).join(', ') + ';';
            var decl = s.names.map(function (n, i) { return declare(n) + ' = ' + tmpNames[i]; });
            return mark + pre + ' let ' + decl.join(', ') + ';';
          }
          var r = '$$r' + (++stmtUid);
          var code = 'const ' + r + ' = ' + valuesArray(s.exprs) + ';';
          var decls = s.names.map(function (n, i) { return declare(n) + ' = ' + r + '[' + i + ']'; });
          return mark + code + ' let ' + decls.join(', ') + ';';
        }
        case 'LocalFunction': {
          var name = declare(s.name);
          return mark + 'let ' + name + '; ' + name + ' = ' + funcExpr(s.func) + ';';
        }
        case 'Assign': {
          if (s.targets.length === 1 && s.exprs.length === 1) {
            return mark + assignTo(s.targets[0], ex(s.exprs[0]));
          }
          var rr = '$$r' + (++stmtUid);
          var c2 = 'const ' + rr + ' = ' + valuesArray(s.exprs) + ';';
          s.targets.forEach(function (t, i) { c2 += ' ' + assignTo(t, rr + '[' + i + ']'); });
          return mark + c2;
        }
        case 'ExprStat':
          return mark + callRaw(s.expr) + ';';
        case 'Do':
          return mark + '{' + scoped(s.body) + '\n}';
        case 'While':
          return mark + 'while (' + cond(s.cond) + ') {' + scoped(s.body) + '\n}';
        case 'Repeat': {
          openScope();
          var body = block(s.body);
          var cnd = cond(s.cond);
          closeScope();
          return mark + 'for (;;) {' + body + '\nif (' + cnd + ') break;\n}';
        }
        case 'If': {
          var o = mark;
          s.clauses.forEach(function (c, i) {
            o += (i ? ' else if (' : 'if (') + cond(c.cond) + ') {' + scoped(c.body) + '\n}';
          });
          if (s.orelse) o += ' else {' + scoped(s.orelse) + '\n}';
          return o;
        }
        case 'NumFor': {
          var u = ++stmtUid;
          var I = '$$i' + u, LIM = '$$m' + u, ST = '$$s' + u, FL = '$$f' + u;
          var start = ex(s.start), limit = ex(s.limit);
          var stepLit = !s.step ? 1 : (s.step.k === 'Number' && /^\d+$/.test(s.step.v) ? Number(s.step.v) : null);
          var step = s.step ? ex(s.step) : '1';
          var intStart = s.start.k === 'Number' && /^\d+$/.test(s.start.v);
          var test = stepLit !== null && stepLit > 0 ? I + ' <= ' + LIM : '(' + ST + ' > 0 ? ' + I + ' <= ' + LIM + ' : ' + I + ' >= ' + LIM + ')';
          openScope();
          var v2 = declare(s.name);
          var bindVal = (intStart && stepLit !== null) ? I : FL + ' ? L.mkf(' + I + ') : ' + I;
          var bd = block(s.body);
          closeScope();
          return mark + 'for (let [' + I + ', ' + LIM + ', ' + ST + ', ' + FL + '] = L.forprep(' + start + ', ' + limit + ', ' + step + '); ' +
                 test + '; ' + I + ' += ' + ST + ') { let ' + v2 + ' = ' + bindVal + ';' + bd + '\n}';
        }
        case 'GenFor': {
          var it = '$$it' + (++stmtUid);
          var head = 'const ' + it + ' = L.iter(' + argList(s.exprs) + ');';
          openScope();
          var binds = s.names.map(function (n, i) {
            var src = i === 0 ? it + '.a' : (i === 1 ? it + '.b' : it + '.v[' + i + ']');
            return declare(n) + ' = ' + src;
          });
          var gb = block(s.body);
          closeScope();
          return mark + '{' + head + ' while (' + it + '.step()) { let ' + binds.join(', ') + ';' + gb + '\n}}';
        }
        case 'Return': {
          var ex0 = s.exprs;
          if (!ex0.length) return mark + 'return L.NONE;';
          if (ex0.length === 1) {
            if (ex0[0].k === 'Call' || ex0[0].k === 'Method') return mark + 'return ' + callRaw(ex0[0]) + ';';
            if (ex0[0].k === 'Vararg') { checkVararg(ex0[0]); return mark + 'return L.ret($$va);'; }
            return mark + 'return ' + ex(ex0[0]) + ';';
          }
          return mark + 'return L.ret(' + valuesArray(ex0) + ');';
        }
        case 'Break': return mark + 'break;';
        case 'Goto': case 'Label':
          err('goto and labels are not supported by Middaw\'s Lua', s.line);
      }
      err('cannot compile statement ' + s.k, s.line);
    }

    fs = new FuncState(null, true);
    openScope();
    var body = block(ast.body);
    closeScope();
    var temps = '';
    if (fs.temps) {
      var names = [];
      for (var i = 1; i <= fs.temps; i++) names.push('$$' + i);
      temps = 'let ' + names.join(', ') + ';';
    }
    return { body: temps + body, consts: consts };
  }

  // The line the first line of a `new Function` body is reported as.
  var lineOffset = null;
  function probeOffset() {
    if (lineOffset !== null) return lineOffset;
    try {
      new Function('throw new Error("probe");\n//# sourceURL=lua:__probe__')();
    } catch (e) {
      var m = /lua:__probe__:(\d+)/.exec(e.stack || '');
      lineOffset = m ? Number(m[1]) - 1 : 0;
    }
    return lineOffset;
  }

  var chunkUid = 0;
  // Lua source (a byte string) -> a JS function, as `load` gives it.
  function load(src, chunkname, env) {
    var name = String(chunkname || 'chunk').replace(/[^A-Za-z0-9_.\/-]/g, '_');
    if (NS.lineMaps[name]) name = name + '#' + (++chunkUid);
    var ast = NS.parse(src, name);
    var out = compile(ast, name);
    var code = 'return function (...$$va) {' + out.body + '\nreturn L.NONE;\n};';
    var offset = probeOffset();
    var lines = code.split('\n'), map = [], cur = 0;
    for (var i = 0; i < offset; i++) map.push(0);
    for (var j = 0; j < lines.length; j++) {
      var m = /^\/\*@(\d+)\*\//.exec(lines[j]);
      if (m) cur = Number(m[1]);
      map.push(cur);
    }
    NS.lineMaps[name.replace(/#/g, '_')] = map;
    var factory = new Function('L', '$$G', '$$K', code + '\n//# sourceURL=lua:' + name.replace(/#/g, '_'));
    return factory(NS, env || NS.defaultEnv(), out.consts);
  }

  var sharedEnv = null;
  NS.defaultEnv = function () { return sharedEnv || (sharedEnv = NS.makeEnv()); };
  NS.compile = compile;
  NS.load = load;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/gfx.js ---- */
/* REAPER's gfx_* drawing, on Max's mgraphics: the host a JSFX's @gfx runs on
 * (MiddawJSFX's runGfx). Each method takes the JSFX first, reads gfx_r, gfx_x
 * and the rest from its variables, and draws as REAPER would: text from its
 * top-left, gfx_x moved on past it, angles from twelve o'clock clockwise.
 *
 * gfx_showmenu cannot wait for a choice inside a frame, so it asks for one:
 * `menu` is set, the frame returns 0, and the device draws the menu. When an
 * item is chosen the device puts the variables back as they were at the start
 * of that frame and runs it again, and this time gfx_showmenu returns the item.
 */
var Gfx = (function () {
  'use strict';
  function Host(g) {
    this.g = g;
    this.fonts = { 0: { name: 'Arial', size: 13, flags: 0 } };
    this.font = 0;
    this.menu = null;        // { text, x, y } asked for this frame
    this.choice = 0;         // the item to give gfx_showmenu on the replayed frame
    this.slots = null;
  }
  Host.prototype.begin = function (g, fx) {
    this.g = g;
    if (!this.slots || this.fx !== fx) {
      this.fx = fx;
      var s = fx.slots;
      this.slots = { r: s.gfx_r, g: s.gfx_g, b: s.gfx_b, a: s.gfx_a, x: s.gfx_x, y: s.gfx_y, texth: s.gfx_texth,
                     mx: s.mouse_x, my: s.mouse_y, clear: s.gfx_clear };
    }
    this.menu = null;
    this.applyFont();
  };
  Host.prototype.v = function (k) { return this.fx.v[this.slots[k]]; };
  Host.prototype.set = function (k, x) { this.fx.v[this.slots[k]] = x; };
  Host.prototype.colour = function () {
    this.g.set_source_rgba(clamp(this.v('r')), clamp(this.v('g')), clamp(this.v('b')), clamp(this.v('a')));
  };
  // EEL2 strings are bytes; REAPER draws them as UTF-8.
  function utf8(s) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : (x || 0); }
  function num(x, d) { return x === undefined || x !== x ? d : x; }

  // ------------------------------------------------------------ colour ---
  Host.prototype.gfx_set = function (fx, r, g, b, a) {
    r = num(r, 0);
    this.set('r', r); this.set('g', num(g, r)); this.set('b', num(b, r)); this.set('a', num(a, 1));
    return 0;
  };

  // ------------------------------------------------------------ shapes ---
  Host.prototype.gfx_rect = function (fx, x, y, w, h, filled) {
    if (!(w > 0 && h > 0)) return 0;
    this.colour();
    if (num(filled, 1)) { this.g.rectangle(x, y, w, h); this.g.fill(); }
    else { this.g.set_line_width(1); this.g.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); this.g.stroke(); }
    return 0;
  };
  Host.prototype.gfx_line = function (fx, x1, y1, x2, y2) {
    this.colour();
    this.g.set_line_width(1);
    this.g.move_to(x1 + 0.5, y1 + 0.5); this.g.line_to(x2 + 0.5, y2 + 0.5); this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_lineto = function (fx, x, y) {
    this.gfx_line(fx, this.v('x'), this.v('y'), x, y);
    this.set('x', x); this.set('y', y);
    return 0;
  };
  Host.prototype.gfx_circle = function (fx, x, y, r, fill) {
    this.colour();
    this.g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (num(fill, 0)) this.g.fill(); else { this.g.set_line_width(1); this.g.stroke(); }
    return 0;
  };
  Host.prototype.gfx_arc = function (fx, x, y, r, a1, a2) {
    this.colour();
    this.g.set_line_width(1);
    this.g.arc(x, y, Math.max(0, r), a1 - Math.PI / 2, a2 - Math.PI / 2);
    this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_roundrect = function (fx, x, y, w, h, radius) {
    this.colour();
    this.g.set_line_width(1);
    this.g.rectangle_rounded(x + 0.5, y + 0.5, w, h, radius * 2, radius * 2);
    this.g.stroke();
    return 0;
  };
  Host.prototype.gfx_triangle = function (fx) {
    var p = Array.prototype.slice.call(arguments, 1);
    if (p.length < 6) return 0;
    this.colour();
    this.g.move_to(p[0], p[1]);
    for (var i = 2; i + 1 < p.length; i += 2) this.g.line_to(p[i], p[i + 1]);
    this.g.close_path();
    this.g.fill();
    return 0;
  };
  Host.prototype.gfx_gradrect = function (fx, x, y, w, h, r, g, b, a) {
    this.g.set_source_rgba(clamp(r), clamp(g), clamp(b), clamp(num(a, 1)));
    this.g.rectangle(x, y, w, h); this.g.fill();
    return 0;
  };

  // -------------------------------------------------------------- text ---
  // gfx_setfont(idx, name, size, flags): flags is a character code, 'b' bold, 'i' italic.
  Host.prototype.gfx_setfont = function (fx, idx, name, size, flags) {
    idx = Math.trunc(num(idx, 0));
    if (name !== undefined && idx > 0) {
      this.fonts[idx] = { name: fx.str(name) || 'Arial', size: num(size, 13), flags: Math.trunc(num(flags, 0)) };
    }
    this.font = this.fonts[idx] ? idx : 0;
    this.applyFont();
    return 1;
  };
  Host.prototype.gfx_getfont = function () { return this.font; };
  Host.prototype.applyFont = function () {
    var f = this.fonts[this.font] || this.fonts[0], fl = f.flags;
    // REAPER's names for the system face are not names Max can ask for
    var face = /^\./.test(f.name) || /^segoe/i.test(f.name) ? 'Arial' : f.name;
    var bold = fl === 98 || ((fl >> 8) & 255) === 98 || ((fl >> 16) & 255) === 98;
    var italic = fl === 105 || ((fl >> 8) & 255) === 105 || ((fl >> 16) & 255) === 105;
    this.g.select_font_face(face, italic ? 'italic' : 'normal', bold ? 'bold' : 'normal');
    this.g.set_font_size(f.size);
    this.size = f.size;
    if (this.slots) this.set('texth', Math.round(f.size));
  };
  Host.prototype.measure = function (s) {
    var m = this.g.text_measure(s);
    return [m[0], Math.max(m[1], this.size)];
  };
  Host.prototype.gfx_measurestr = function (fx, s) { this.fx.gm = this.measure(utf8(fx.str(s))); return this.fx.gm[0]; };
  Host.prototype.gfx_measurechar = function (fx, c) { this.fx.gm = this.measure(String.fromCharCode(c)); return this.fx.gm[0]; };
  Host.prototype.text = function (s, flags, right, bottom) {
    var x = this.v('x'), y = this.v('y'), m = this.measure(s);
    flags = Math.trunc(num(flags, 0));
    if (right !== undefined && !(flags & 256)) {
      if (flags & 1) x = x + (right - x - m[0]) / 2; else if (flags & 2) x = right - m[0];
      if (flags & 4) y = y + (bottom - y - m[1]) / 2; else if (flags & 8) y = bottom - m[1];
    }
    this.colour();
    this.g.move_to(x, y + this.size * 0.8);
    this.g.show_text(s);
    this.set('x', x + m[0]);
    return 0;
  };
  Host.prototype.gfx_drawstr = function (fx, s, flags, right, bottom) { return this.text(utf8(fx.str(s)), flags, right, bottom); };
  Host.prototype.gfx_drawchar = function (fx, c) { return this.text(String.fromCharCode(c)); };
  Host.prototype.gfx_drawnumber = function (fx, n, digits) { return this.text(Number(n).toFixed(Math.max(0, Math.trunc(num(digits, 0))))); };
  Host.prototype.gfx_printf = function (fx, fmt) {
    var args = Array.prototype.slice.call(arguments, 2);
    var s = fx.str(fmt).replace(/%(-?\d*)(?:\.(\d+))?([dfsxXc%])/g, function (m, w, p, k) {
      if (k === '%') return '%';
      var a = args.shift();
      if (k === 's') return fx.str(a);
      if (k === 'c') return String.fromCharCode(a);
      if (k === 'x' || k === 'X') { var h = Math.trunc(a).toString(16); return k === 'X' ? h.toUpperCase() : h; }
      return k === 'd' ? String(Math.trunc(a)) : Number(a).toFixed(p === undefined ? 6 : +p);
    });
    return this.text(utf8(s));
  };

  // ------------------------------------------------------------- input ---
  // gfx_getchar(65536) asks about the window: 1 it has focus, 2 it is shown,
  // 4 the mouse is in it. With no argument it is the next key typed, which the
  // window's [key] hands in (Host.key); with a key it asks whether it is held.
  Host.prototype.gfx_getchar = function (fx, c) {
    if (c === 65536) return 1 | 2 | (this.mouseIn ? 4 : 0);
    if (c) return 0;
    return this.keys && this.keys.length ? this.keys.shift() : 0;
  };
  // Max's key codes as REAPER's gfx_getchar gives them: the arrows and the
  // editing keys are four-letter codes there.
  var KEYS = { 28: 0x6C656674, 29: 0x72676874, 30: 0x7570, 31: 0x646F776E, 127: 0x64656C, 8: 8, 9: 9, 13: 13, 27: 27,
               '-9': 0x6C656674, '-10': 0x72676874, '-11': 0x7570, '-12': 0x646F776E };
  Host.prototype.key = function (code) {
    (this.keys = this.keys || []).push(KEYS[code] !== undefined ? KEYS[code] : code);
    if (this.keys.length > 32) this.keys.shift();
  };
  Host.prototype.gfx_showmenu = function (fx, s) {
    if (this.choice) { var k = this.choice; this.choice = 0; return k; }
    this.menu = { text: utf8(fx.str(s)), x: this.v('x'), y: this.v('y') };
    return 0;
  };
  Host.prototype.gfx_setcursor = function () { return 0; };
  Host.prototype.gfx_getdropfile = function () { return 0; };
  Host.prototype.gfx_update = function () { return 0; };

  // A menu as gfx_showmenu writes it: items split by |, '#' greyed, '!'
  // ticked, '>' opens a submenu, '<' closes one. Numbered as REAPER numbers
  // them: every item that is not a submenu's title, in order, from 1.
  function parseMenu(text) {
    var out = [], depth = 0, n = 0;
    String(text).split('|').forEach(function (raw) {
      var t = raw, grey = false, tick = false, opens = false, closes = false;
      for (;;) {
        var c = t.charAt(0);
        if (c === '#') { grey = true; t = t.slice(1); } else if (c === '!') { tick = true; t = t.slice(1); }
        else if (c === '>') { opens = true; t = t.slice(1); } else if (c === '<') { closes = true; t = t.slice(1); } else break;
      }
      if (opens) { out.push({ label: t, title: true, depth: depth }); depth++; return; }
      if (t === '' && !closes) { out.push({ rule: true, depth: depth }); return; }
      n++;
      out.push({ label: t, index: n, grey: grey, tick: tick, depth: depth });
      if (closes) depth = Math.max(0, depth - 1);
    });
    return out;
  }

  return { Host: Host, parseMenu: parseMenu };
})();


/* ---- kit/lua_device.js ---- */
/* A family ReaScript that draws with gfx, as a Max for Live device: the .lua
 * itself, unchanged, on Middaw's Lua 5.4 runtime, with REAPER's gfx and the
 * parts of the reaper table it uses supplied here.
 *
 * REAPER runs such a script as a loop of reaper.defer callbacks drawing into
 * a window that keeps what was drawn. Here every repaint runs the deferred
 * callback once, its drawing is recorded, and the last frame that drew is
 * shown again until another draws (ScaleView draws only when something
 * changes).
 *
 * gfx.showmenu is modal in REAPER. Middaw's Lua has no coroutines, so a frame
 * that asks for a menu is stopped there (nothing after the call runs) and the
 * menu is drawn; no frame runs while it is open. When an item is chosen the
 * click that opened it is played again at the same place - released, pressed,
 * released - or the same keys typed again, and the menu call it reaches
 * returns the item. That works whether a script acts on the press (Orchestration
 * Helper) or the release (ScaleView), whatever it noted before asking.
 *
 * Expects, before it: Gfx (gfx.js), MiddawLua, and DEVICE = { main, files,
 * size: [w, h], midi }. ExtState and ProjExtState are kept with the Live set.
 * Inlet 0: bang, MIDI bytes, restore, key. Outlets: 0 MIDI bytes (MIDI
 * passes through), 1 the saved state to [pattr], 2 the status line.
 */
inlets = 1;
outlets = 3;
mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var L = MiddawLua;
var R = {
  pending: null, atexit: null, quit: false, ext: {}, proj: {}, lastSaved: '', ready: false, started: false,
  mouse: { x: -1, y: -1, cap: 0, wheel: 0 }, release: false, frameSaw: true,
  menu: null, choice: 0, asking: null, keys: [], frameKeys: [],
  ops: [], lastOps: [], recording: null, midi: [], seq: 0, running: [], error: null,
  host: new Gfx.Host(mgraphics)
};
function say(msg) { outlet(2, 'set', msg || ''); }

// ------------------------------------------------------------ the gfx table --
var G = new L.LuaTable();
function gnum(k) { var v = G.get(k); return v === undefined ? 0 : +(v instanceof L.LFloat ? v.n : v); }
function gset(k, x) { G.set(k, Number.isInteger(x) ? x : L.mkf ? L.mkf(x) : x); }
// gfx.js's Host reads and writes REAPER's variables through fx.v[slot]; for a
// script they are the fields of the gfx table.
var FX = {
  v: new Proxy({}, { get: function (t, k) { return gnum(k); }, set: function (t, k, x) { gset(k, x); return true; } }),
  slots: { gfx_r: 'r', gfx_g: 'g', gfx_b: 'b', gfx_a: 'a', gfx_x: 'x', gfx_y: 'y', gfx_texth: 'texth',
           mouse_x: 'mouse_x', mouse_y: 'mouse_y', gfx_clear: 'clear' },
  str: null,
  gm: [0, 0]
};
FX.str = function (s) { return typeof s === 'string' ? s : (s === undefined ? '' : String(s instanceof L.LFloat ? s.n : s)); };
['r', 'g', 'b'].forEach(function (k) { gset(k, 1); });
gset('a', 1); gset('x', 0); gset('y', 0); gset('clear', 0); gset('ext_retina', 1); gset('texth', 13);
gset('mouse_x', 0); gset('mouse_y', 0); gset('mouse_cap', 0); gset('mouse_wheel', 0); gset('mouse_hwheel', 0);

var MENU_PENDING = { menuPending: true };
function call(name) {
  var a = Array.prototype.slice.call(arguments, 1);
  return R.host[name].apply(R.host, [FX].concat(a));
}
function flagsOf(f) { return typeof f === 'string' ? (f.length ? f.charCodeAt(0) : 0) : (f instanceof L.LFloat ? f.n : f); }
var GFX = {
  init: function (name, w, h) {
    if (w !== undefined) { gset('w', DEVICE.size[0]); gset('h', DEVICE.size[1]); }
    return 1;
  },
  quit: function () { R.quit = true; return L.NONE; },
  update: function () { return L.NONE; },
  dock: function (v) { return new L.Multi([0, 0, 0, DEVICE.size[0], DEVICE.size[1]]); },
  set: function (r, g, b, a) { call('gfx_set', +r, g === undefined ? undefined : +g, b === undefined ? undefined : +b, a === undefined ? undefined : +a); return L.NONE; },
  rect: function (x, y, w, h, filled) { call('gfx_rect', +x, +y, +w, +h, filled === undefined ? 1 : (filled === true ? 1 : filled === false ? 0 : +filled)); return L.NONE; },
  line: function (x1, y1, x2, y2) { call('gfx_line', +x1, +y1, +x2, +y2); return L.NONE; },
  lineto: function (x, y) { call('gfx_lineto', +x, +y); return L.NONE; },
  circle: function (x, y, r, fill) { call('gfx_circle', +x, +y, +r, fill === true ? 1 : fill === false || fill === undefined ? 0 : +fill); return L.NONE; },
  arc: function (x, y, r, a1, a2) { call('gfx_arc', +x, +y, +r, +a1, +a2); return L.NONE; },
  roundrect: function (x, y, w, h, r) { call('gfx_roundrect', +x, +y, +w, +h, +r); return L.NONE; },
  triangle: function () { call.apply(null, ['gfx_triangle'].concat(Array.prototype.map.call(arguments, Number))); return L.NONE; },
  gradrect: function (x, y, w, h, r, g, b, a) { call('gfx_gradrect', +x, +y, +w, +h, +r, +g, +b, +a); return L.NONE; },
  setfont: function (idx, name, size, flags) { call('gfx_setfont', +idx || 0, name, size === undefined ? undefined : +size, flagsOf(flags)); return 1; },
  getfont: function () { var f = R.host.fonts[R.host.font] || R.host.fonts[0]; return new L.Multi([R.host.font, f.name]); },
  measurestr: function (s) { call('gfx_measurestr', s); return new L.Multi([L.mkf(FX.gm[0]), L.mkf(FX.gm[1])]); },
  measurechar: function (c) { call('gfx_measurechar', +c); return new L.Multi([L.mkf(FX.gm[0]), L.mkf(FX.gm[1])]); },
  drawstr: function (s, flags, right, bottom) { call('gfx_drawstr', s, flags === undefined ? undefined : +flags, right === undefined ? undefined : +right, bottom === undefined ? undefined : +bottom); return L.NONE; },
  drawnumber: function (n, d) { call('gfx_drawnumber', +n, +d); return L.NONE; },
  drawchar: function (c) { call('gfx_drawchar', +c); return L.NONE; },
  printf: function (fmt) { var a = Array.prototype.slice.call(arguments, 1); call.apply(null, ['gfx_printf', fmt].concat(a)); return L.NONE; },
  // Keys typed this frame; the frame that asked for a menu sees the same ones again.
  getchar: function (c) {
    if (c !== undefined && +c === 65536) return 1 | 2 | 8;
    if (c !== undefined && +c !== 0) return 0;
    return R.frameKeys.length ? R.frameKeys.shift() : 0;
  },
  showmenu: function (s) {
    if (R.choice) { var k = R.choice; R.choice = 0; R.menu = null; return k; }
    if (!R.menu) R.menu = { items: Gfx.parseMenu(L.fromBytes ? decode(s) : s), x: gnum('x'), y: gnum('y'), hover: -1 };
    throw MENU_PENDING;
  },
  setcursor: function () { return L.NONE; },
  clienttoscreen: function (x, y) { return new L.Multi([x, y]); },
  screentoclient: function (x, y) { return new L.Multi([x, y]); },
  getimgdim: function () { return new L.Multi([0, 0]); },
  blit: function () { return L.NONE; },
  setimgdim: function () { return L.NONE; },
  loadimg: function () { return -1; },
  getdropfile: function () { return 0; },
  getpixel: function () { return new L.Multi([0, 0, 0]); },
  muloffset: function () { return L.NONE; }
};
function decode(s) { try { return decodeURIComponent(escape(String(s))); } catch (e) { return String(s); } }
Object.keys(GFX).forEach(function (k) { G.set(k, GFX[k]); });

// ------------------------------------------------------- the reaper table --
// What the family's gfx scripts use; anything else is nil, as on an old REAPER.
function str(v) { return v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v instanceof L.LFloat ? v.n : v); }
var REAPER = {
  defer: function (f) { R.pending = f; return L.NONE; },
  atexit: function (f) { R.atexit = f; return L.NONE; },
  time_precise: function () { return L.mkf(Date.now() / 1000); },
  GetOS: function () { return 'macOS-arm64'; },
  GetResourcePath: function () { return '/Live'; },
  GetAppVersion: function () { return '7.0/macOS-arm64'; },
  get_action_context: function () { return new L.Multi([false, '/Live/' + DEVICE.main, 0, 0, 0, 0, 0]); },
  set_action_options: function () { return L.NONE; },
  SetToggleCommandState: function () { return true; },
  RefreshToolbar2: function () { return L.NONE; },
  ShowMessageBox: function (msg) { say(decode(str(msg)).split('\n')[0]); return 1; },
  MB: function (msg) { say(decode(str(msg)).split('\n')[0]); return 1; },
  ShowConsoleMsg: function (msg) { post(decode(str(msg))); return L.NONE; },
  GetExtState: function (sec, key) { var v = R.ext[str(sec) + '\u0000' + str(key)]; return v === undefined ? '' : v; },
  HasExtState: function (sec, key) { return R.ext[str(sec) + '\u0000' + str(key)] !== undefined; },
  SetExtState: function (sec, key, val) { R.ext[str(sec) + '\u0000' + str(key)] = str(val); return L.NONE; },
  DeleteExtState: function (sec, key) { delete R.ext[str(sec) + '\u0000' + str(key)]; return L.NONE; },
  GetProjExtState: function (proj, sec, key) {
    var v = R.proj[str(sec) + '\u0000' + str(key)];
    return new L.Multi([v === undefined ? 0 : v.length, v === undefined ? '' : v]);
  },
  SetProjExtState: function (proj, sec, key, val) { R.proj[str(sec) + '\u0000' + str(key)] = str(val); return 1; },
  EnumProjects: function (idx) { return +idx <= 0 ? new L.Multi([PROJECT, 'Live Set']) : undefined; },
  MarkProjectDirty: function () { return L.NONE; },
  // REAPER's recent MIDI input, newest first: what came into the device.
  MIDI_GetRecentInputEvent: function (idx) {
    var e = R.midi[R.midi.length - 1 - (+idx)];
    if (!e) return new L.Multi([0, '', 0, 0, 0, 0]);
    return new L.Multi([e.seq, e.bytes, 0, 0, 0, 0]);
  }
};
var PROJECT = new L.LuaTable();
var RT = new L.LuaTable();
Object.keys(REAPER).forEach(function (k) { RT.set(k, REAPER[k]); });

// ------------------------------------------------------------- the script --
// Files the script reads (dofile) are found by their name, wherever it asks.
function readFile(path) {
  var p = String(path), base = p.replace(/^.*[\/\\]/, '');
  if (DEVICE.files[p] !== undefined) return DEVICE.files[p];
  if (DEVICE.files[base] !== undefined) return DEVICE.files[base];
  return null;
}
var env = L.makeEnv({ print: function (s) { post(String(s) + '\n'); }, readFile: readFile, writeFile: function () {} });
env.set('gfx', G);
env.set('reaper', RT);
// what a Mac's Lua says about its paths (scripts read the separator from it)
env.get('package').set('config', '/\n;\n?\n!\n-\n');

function start() {
  if (R.started) return;
  R.started = true;
  gset('w', DEVICE.size[0]); gset('h', DEVICE.size[1]);
  frame(function () { L.call(L.load(DEVICE.files[DEVICE.main], DEVICE.main, env))(); });
}

// One frame: the deferred callback, its drawing recorded. A frame stopped by a
// menu leaves nothing behind but the menu; it runs again until it is answered.
function frame(f, input) {
  var rec = recorder(mgraphics);
  R.host.begin(rec, FX);
  R.frameKeys = input ? input.keys.slice() : R.keys.splice(0);
  var mouse = input ? input.mouse : { x: R.mouse.x, y: R.mouse.y, cap: R.mouse.cap, wheel: R.mouse.wheel };
  if (!input) R.mouse.wheel = 0;
  gset('mouse_x', mouse.x); gset('mouse_y', mouse.y); gset('mouse_cap', mouse.cap);
  if (mouse.wheel) gset('mouse_wheel', gnum('mouse_wheel') + mouse.wheel);
  var keys = R.frameKeys.slice();
  R.pending = null;
  try {
    f();
    R.asking = null;
    // a frame that drew (not one that only set a font) is the one shown
    if (rec.ops.some(function (op) { return op[0] === 'fill' || op[0] === 'stroke' || op[0] === 'show_text'; })) R.lastOps = rec.ops;
  } catch (e) {
    if (e === MENU_PENDING || (e && e.value === MENU_PENDING)) {
      R.asking = { f: f, mouse: mouse, keys: keys, button: R.button || 1 };
      R.pending = f;
      return;
    }
    R.error = String(e && (e.message || (e.value !== undefined ? L.tostring(e.value) : e)));
    say('The script stopped: ' + R.error);
    post('ReaScript error: ' + R.error + '\n');
  }
  R.frameSaw = true;
  if (R.release) { R.release = false; R.mouse.cap = 0; }
}

// mgraphics, recorded: what is drawn is kept to be drawn again; measuring and
// font changes also reach the real one, so text is measured as it will look.
function recorder(g) {
  var ops = [];
  var r = { ops: ops };
  ['set_source_rgba', 'rectangle', 'rectangle_rounded', 'fill', 'fill_preserve', 'stroke', 'move_to', 'line_to',
   'close_path', 'arc', 'ellipse', 'show_text', 'set_line_width', 'new_path'].forEach(function (m) {
    r[m] = function () { ops.push([m, Array.prototype.slice.call(arguments)]); };
  });
  ['select_font_face', 'set_font_size'].forEach(function (m) {
    r[m] = function () { var a = Array.prototype.slice.call(arguments); ops.push([m, a]); g[m].apply(g, a); };
  });
  r.text_measure = function (s) { return g.text_measure(s); };
  return r;
}

// --------------------------------------------------------------- paint ---
function size() {
  var rc = (typeof box !== 'undefined' && box.rect) ? box.rect : [0, 0, DEVICE.size[0], DEVICE.size[1]];
  return [rc[2] - rc[0], rc[3] - rc[1]];
}
function paint() {
  var g = mgraphics, sz = size();
  gset('w', sz[0]); gset('h', sz[1]);
  if (R.started && !R.quit && R.pending && !R.error && !R.menu) frame(R.pending);
  var c = gnum('clear');
  if (c >= 0) { g.set_source_rgba((c & 255) / 255, ((c >> 8) & 255) / 255, ((c >> 16) & 255) / 255, 1); g.rectangle(0, 0, sz[0], sz[1]); g.fill(); }
  R.lastOps.forEach(function (op) { g[op[0]].apply(g, op[1]); });
  if (R.menu) drawMenu(g, sz);
}

// The menu gfx.showmenu asked for, over the window.
var ITEM_H = 20;
function menuRect(sz) {
  var m = R.menu, w = 40;
  mgraphics.select_font_face('Arial', 'normal', 'normal');
  mgraphics.set_font_size(12);
  m.items.forEach(function (it) { if (it.label) w = Math.max(w, mgraphics.text_measure(it.label)[0] + 40 + it.depth * 12); });
  var h = m.items.length * ITEM_H + 8;
  return [Math.max(0, Math.min(m.x, sz[0] - w - 2)), Math.max(0, Math.min(m.y, sz[1] - h - 2)), w, h];
}
function drawMenu(g, sz) {
  var r = menuRect(sz), m = R.menu;
  g.set_source_rgba(0.165, 0.184, 0.216, 1); g.rectangle(r[0], r[1], r[2], r[3]); g.fill();
  g.set_source_rgba(0.227, 0.251, 0.29, 1); g.set_line_width(1); g.rectangle(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1); g.stroke();
  g.select_font_face('Arial', 'normal', 'normal'); g.set_font_size(12);
  m.items.forEach(function (it, i) {
    var y = r[1] + 4 + i * ITEM_H;
    if (it.rule) { g.set_source_rgba(0.227, 0.251, 0.29, 1); g.rectangle(r[0] + 6, y + ITEM_H / 2, r[2] - 12, 1); g.fill(); return; }
    var on = i === m.hover && it.index && !it.grey;
    if (on) { g.set_source_rgba(1, 0.949, 0, 1); g.rectangle(r[0] + 2, y, r[2] - 4, ITEM_H); g.fill(); }
    var ink = on ? [0.078, 0.09, 0.11] : it.grey || it.title ? [0.714, 0.737, 0.776] : [0.867, 0.882, 0.906];
    g.set_source_rgba(ink[0], ink[1], ink[2], 1);
    g.move_to(r[0] + 22 + it.depth * 12, y + 14);
    g.show_text(it.label);
    if (it.tick) { g.move_to(r[0] + 7 + it.depth * 12, y + 14); g.show_text('✓'); }
  });
}
function menuAt(x, y) {
  var r = menuRect(size());
  if (x < r[0] || x >= r[0] + r[2] || y < r[1] + 4 || y >= r[1] + r[3] - 4) return -1;
  return Math.floor((y - r[1] - 4) / ITEM_H);
}
// An item chosen: the frame that asked runs again and is given it. Clicking
// away gives it 0, as closing REAPER's menu does.
function chooseMenu(i) {
  var it = i >= 0 ? R.menu.items[i] : null;
  if (it && (!it.index || it.grey)) return;          // a title, a rule or a greyed item: the menu stays
  frameAnswer(R.asking ? R.asking.f : R.pending, it ? it.index : 0);
  save();
  mgraphics.redraw();
}
function frameAnswer(f, k) {
  var ask = R.asking, keep = GFX.showmenu, answered = false;
  // the next gfx.showmenu, wherever the script calls it from, is given the answer
  G.set('showmenu', function () { answered = true; G.set('showmenu', keep); return k; });
  R.menu = null; R.asking = null;
  var x = ask.mouse.x, y = ask.mouse.y, steps = ask.keys.length
    ? [{ cap: 0, keys: [] }, { cap: 0, keys: ask.keys }]
    : [{ cap: 0, keys: [] }, { cap: ask.button, keys: [] }, { cap: 0, keys: [] }];
  steps.forEach(function (st) {
    if (answered || R.error) return;
    var g = R.pending || f;
    frame(g, { mouse: { x: x, y: y, cap: st.cap, wheel: 0 }, keys: st.keys });
  });
  G.set('showmenu', keep);
  R.mouse.cap = 0;
}

// --------------------------------------------------------------- input ---
function onclick(x, y, but, cmd, shift, capslock, opt, ctrl) {
  if (R.menu) { chooseMenu(menuAt(x, y)); return; }
  R.mouse.x = x; R.mouse.y = y;
  R.mouse.cap = (ctrl ? 2 : 1) | (cmd ? 4 : 0) | (shift ? 8 : 0) | (opt ? 16 : 0);
  R.button = R.mouse.cap;
  R.frameSaw = false;
  mgraphics.redraw();
}
function ondrag(x, y, but) {
  if (R.menu) return;
  R.mouse.x = x; R.mouse.y = y;
  if (!but) { if (R.frameSaw) R.mouse.cap = 0; else R.release = true; save(); }
  mgraphics.redraw();
}
function onidle(x, y) {
  if (R.menu) { var i = menuAt(x, y); if (i !== R.menu.hover) { R.menu.hover = i; mgraphics.redraw(); } return; }
  R.mouse.x = x; R.mouse.y = y;
}
function onidleout() { if (!R.menu) { R.mouse.x = -1; R.mouse.y = -1; } }
function onwheel(x, y, dx, dy) { R.mouse.wheel += Math.round(dy * 120); mgraphics.redraw(); }
var KEYS = { 28: 0x6C656674, 29: 0x72676874, 30: 0x7570, 31: 0x646F776E, 127: 0x64656C };
function key(code) {
  if (R.menu && code === 27) { chooseMenu(-1); return; }
  R.keys.push(KEYS[code] !== undefined ? KEYS[code] : code);
  if (R.keys.length > 32) R.keys.shift();
  mgraphics.redraw();
}

// ---------------------------------------------------------------- MIDI ---
// Bytes from [midiin]: passed straight on, and kept as REAPER's recent input.
function msg_int(b) {
  b = b & 255;
  outlet(0, b);
  if (b >= 0xF8) return;
  if (b & 0x80) { R.running = [b]; return; }
  if (!R.running.length || R.running[0] >= 0xF0) return;
  R.running.push(b);
  var st = R.running[0] & 0xF0, need = (st === 0xC0 || st === 0xD0) ? 2 : 3;
  if (R.running.length === need) {
    R.midi.push({ seq: ++R.seq, bytes: String.fromCharCode.apply(null, R.running) });
    if (R.midi.length > 4096) R.midi.splice(0, 1024);
    R.running = [R.running[0]];
    mgraphics.redraw();
  }
}

// ----------------------------------------------------------- the device --
var drawTask = null;
function bang() {
  R.ready = true;
  start();
  if (!drawTask) { drawTask = new Task(function () { mgraphics.redraw(); }, this); drawTask.interval = 33; drawTask.repeat(); }
  mgraphics.redraw();
}
// What the script keeps (ExtState, ProjExtState), with the Live set.
function save() {
  var s = JSON.stringify({ v: 1, ext: R.ext, proj: R.proj });
  if (s === R.lastSaved) return;
  R.lastSaved = s;
  outlet(1, 'set', s);
}
function restore(text) {
  var st = null;
  try { st = JSON.parse(String(text)); } catch (e) { return; }
  if (!st || st.v !== 1) return;
  R.ext = st.ext || {}; R.proj = st.proj || {};
  R.lastSaved = JSON.stringify(st);
  // a script reads its state when it starts: start again with it
  if (R.started) { R.started = false; R.pending = null; R.lastOps = []; R.quit = false; R.error = null; start(); }
}
var saveTask = new Task(function () { save(); }, this);
saveTask.interval = 2000;
saveTask.repeat();

