--[[
  Orchestration Helper - test suite.

  Runs the script against the headless REAPER stand-in in harness.lua and
  checks data integrity, search ranking, rendering and interaction.

      lua5.4 tests/run.lua
]]--

local HERE = (debug.getinfo(1, "S").source:match("^@(.*)[/\\]") or ".")
local HARNESS = HERE .. "/harness.lua"

local pass, fail = 0, 0
local function check(name, cond, detail)
  if cond then
    pass = pass + 1
  else
    fail = fail + 1
    print(("  FAIL  %s%s"):format(name, detail and ("  -- " .. detail) or ""))
  end
end
local function section(s) print("\n" .. s) end

-- Fresh interpreter state for each scenario: reload the harness, feed keys,
-- run frames, return everything that was drawn.
local function scenario(feed, nframes)
  dofile(HARNESS)
  if feed then feed() end
  local drawn = _H.run(nframes or 20)
  return table.concat(drawn, " | "), drawn
end

------------------------------------------------------------------------------
section("Data integrity")
------------------------------------------------------------------------------
dofile(HARNESS)
local MAIN = dofile(_H.datapath())
local COMP = dofile(_H.composerspath())

-- The script merges the two databases at load time; validate the merged set.
local D = { ENTRIES = {}, SOURCES = {} }
for _, en in ipairs(MAIN.ENTRIES) do D.ENTRIES[#D.ENTRIES + 1] = en end
for _, en in ipairs(COMP.ENTRIES) do D.ENTRIES[#D.ENTRIES + 1] = en end
for t, v in pairs(MAIN.SOURCES) do D.SOURCES[t] = v end
for t, v in pairs(COMP.SOURCES) do if D.SOURCES[t] == nil then D.SOURCES[t] = v end end

check("entries present", #D.ENTRIES >= 90, ("%d entries"):format(#D.ENTRIES))
check("composers loaded", #COMP.ENTRIES >= 40, ("%d composers"):format(#COMP.ENTRIES))

local ids = {}
local dup = nil
for _, e in ipairs(D.ENTRIES) do
  if ids[e.id] then dup = e.id end
  ids[e.id] = e
end
check("no duplicate ids", dup == nil, dup)

local missing = {}
for _, e in ipairs(D.ENTRIES) do
  if not (e.name and e.family and e.kind) then missing[#missing+1] = e.id end
  if not e.summary or #e.summary < 40 then missing[#missing+1] = e.id .. "(summary)" end
end
check("every entry has name/family/kind/summary", #missing == 0,
      table.concat(missing, ","))

local badrel = {}
for _, e in ipairs(D.ENTRIES) do
  for _, r in ipairs(e.related or {}) do
    if not ids[r] then badrel[#badrel+1] = e.id .. "->" .. r end
  end
end
check("every 'related' id resolves", #badrel == 0, table.concat(badrel, ","))

-- Composer entries point at the instruments they are known for; those ids feed
-- the reverse "Composers noted for it" links, so they must resolve too.
local badinst = {}
for _, e in ipairs(D.ENTRIES) do
  for _, r in ipairs(e.instruments or {}) do
    if not ids[r] then badinst[#badinst+1] = e.id .. "->" .. r end
  end
end
check("every composer 'instruments' id resolves", #badinst == 0,
      table.concat(badinst, ","))

local tags = {}
for t in pairs(D.SOURCES) do tags[t] = true end
local cited, uncited, badcite = 0, {}, {}
for _, e in ipairs(D.ENTRIES) do
  for _, sec in ipairs(e.sec or {}) do
    for _, it in ipairs(sec[2]) do
      local c = it[3]
      if not c or c == "" then
        uncited[#uncited+1] = e.id .. "/" .. tostring(it[1])
      else
        cited = cited + 1
        local known = false
        for t in c:gmatch("%a+") do if tags[t] then known = true end end
        if not known then badcite[#badcite+1] = e.id .. ":" .. c end
      end
    end
  end
end
check("every item is cited", #uncited == 0,
      (#uncited > 0) and (uncited[1] .. " (+" .. (#uncited-1) .. " more)") or nil)
check("every citation names a declared source", #badcite == 0,
      table.concat(badcite, ","))
print(("  %d entries, %d cited items, %d sources")
  :format(#D.ENTRIES, cited, (function() local n=0 for _ in pairs(D.SOURCES) do n=n+1 end return n end)()))

------------------------------------------------------------------------------
section("Search ranking")
------------------------------------------------------------------------------
local names = {}
for _, e in ipairs(D.ENTRIES) do names[e.name] = true end

local function topmatch(q)
  dofile(HARNESS)
  _H.type(q)
  local drawn = _H.run(8)
  for _, s in ipairs(drawn) do
    if names[s] then return s end
  end
  return "(none)"
end

local cases = {
  {"trombone", "Trombone"}, {"trombones", "Trombone"}, {"tbn", "Trombone"},
  {"string section", "String Section"}, {"strings", "String Section"},
  {"cor anglais", "English Horn (Cor Anglais)"},
  {"english horn", "English Horn (Cor Anglais)"},
  {"cello", "Violoncello"}, {"violoncello", "Violoncello"},
  {"double bass", "Double Bass"}, {"contrabass", "Double Bass"},
  {"french horn", "Horn"}, {"horn", "Horn"},
  {"timpani", "Timpani (Kettledrums)"}, {"kettledrums", "Timpani (Kettledrums)"},
  {"percussion", "Percussion Section"}, {"woodwind", "Woodwind Section"},
  {"brass", "Brass Section"}, {"harp", "Harp"}, {"celesta", "Celesta"},
  {"cor anglai", "English Horn (Cor Anglais)"},
  {"tromobne", "Trombone"}, {"clarinett", "Clarinet"}, {"bassson", "Bassoon"},
  {"pizzicato", "Pizzicato"}, {"chorus", "Chorus with Orchestra"},
  {"balance", "Balance and Relative Strength"},
  {"doubling", "Doubling: General Principles"},
  {"blend", "Blend Bridges Between Groups"},
  {"score order", "Orchestral Range and Score Order"},
  {"orchestra", "The Modern Orchestra"},
  {"eb clarinet", "E-flat Clarinet (Small Clarinet)"},
  {"contrabassoon", "Contrabassoon"}, {"tuba", "Tuba"},
  {"snare drum", "Side Drum (Snare Drum)"}, {"tam tam", "Gong (Tam-tam)"},
  {"xylophone", "Xylophone"}, {"voice", "Solo Voice with Orchestra"},
  -- composers, including the misspellings people actually type
  {"bernard hermann", "Bernard Herrmann"}, {"herrmann", "Bernard Herrmann"},
  {"hermann", "Bernard Herrmann"}, {"bach", "Johann Sebastian Bach"},
  {"js bach", "Johann Sebastian Bach"}, {"mozart", "Wolfgang Amadeus Mozart"},
  {"beethoven", "Ludwig van Beethoven"}, {"wagner", "Richard Wagner"},
  {"berlioz", "Hector Berlioz"}, {"debussy", "Claude Debussy"},
  {"ravel", "Maurice Ravel"}, {"mahler", "Gustav Mahler"},
  {"tchaikovsky", "Pyotr Ilyich Tchaikovsky"},
  {"tschaikowsky", "Pyotr Ilyich Tchaikovsky"},
  {"rimsky korsakov", "Nikolay Rimsky-Korsakov"},
  {"john williams", "John Williams"}, {"williams", "John Williams"},
  {"goldsmith", "Jerry Goldsmith"}, {"morricone", "Ennio Morricone"},
  {"zimmer", "Hans Zimmer"}, {"elfman", "Danny Elfman"},
  {"howard shore", "Howard Shore"}, {"desplat", "Alexandre Desplat"},
  {"greenwood", "Jonny Greenwood"}, {"korngold", "Erich Wolfgang Korngold"},
  {"rozsa", "Miklos Rozsa"}, {"max steiner", "Max Steiner"},
  {"john barry", "John Barry"}, {"stravinsky", "Igor Stravinsky"},
  {"weber", "Carl Maria von Weber"}, {"mendelssohn", "Felix Mendelssohn"},
  {"haydn", "Joseph Haydn"}, {"handel", "George Frideric Handel"},
  {"gluck", "Christoph Willibald Gluck"}, {"rameau", "Jean-Philippe Rameau"},
}
for _, c in ipairs(cases) do
  local got = topmatch(c[1])
  check(("query %q"):format(c[1]), got == c[2], "got " .. got)
end

------------------------------------------------------------------------------
section("Rendering")
------------------------------------------------------------------------------
for _, sz in ipairs{ {760, 680}, {470, 380}, {1400, 900} } do
  local errors, thin = 0, 0
  for _, e in ipairs(D.ENTRIES) do
    dofile(HARNESS)
    _H.setsize(sz[1], sz[2])
    _H.type(e.name)
    local ok = pcall(function() _H.run(10) end)
    if not ok then errors = errors + 1
    elseif #_H.drawn() < 12 then thin = thin + 1 end
  end
  check(("all %d entries render at %dx%d"):format(#D.ENTRIES, sz[1], sz[2]),
        errors == 0 and thin == 0,
        ("%d errors, %d thin"):format(errors, thin))
end

for _, sz in ipairs{ {200, 150}, {120, 120}, {60, 400}, {3000, 200} } do
  dofile(HARNESS)
  _H.setsize(sz[1], sz[2])
  local ok = pcall(function()
    _H.type("english horn"); _H.press(_H.K("pgdn"), 3); _H.run(12)
  end)
  check(("survives %dx%d"):format(sz[1], sz[2]), ok)
end

------------------------------------------------------------------------------
section("Interaction")
------------------------------------------------------------------------------
local s = scenario(function() _H.run = _H.run end, 3)
check("index view renders", s:find("Orchestration Helper", 1, true)
  and s:find("STRINGS", 1, true) ~= nil)

s = scenario(function() _H.type("trombone") end, 12)
check("entry shows a section header", s:find("PAIRINGS IN UNISON", 1, true) ~= nil)
check("entry shows a citation", s:find("RK p.", 1, true) ~= nil)

s = scenario(function() _H.type("trombone"); _H.press(_H.K("pgdn"), 12) end, 40)
check("scrolls to the end of a long entry",
      s:find("USE SPARINGLY", 1, true) and s:find("SEE ALSO", 1, true) ~= nil)

s = scenario(function() _H.type("drums"); _H.press(_H.K("down"), 1) end, 20)
check("Down steps through matches", s:find("matches", 1, true) ~= nil)

s = scenario(function() _H.type("drums"); _H.press(13, 1) end, 20)
check("Enter collapses the match list", s:find("1 match", 1, true) ~= nil)

s = scenario(function() _H.type("horn"); _H.press(27, 1); _H.press(27, 1) end, 20)
check("Esc twice returns to the index",
      s:find("Search an instrument", 1, true) and s:find("STRINGS", 1, true) ~= nil)

s = scenario(function() _H.press(_H.K("f1"), 1) end, 8)
check("F1 opens help", s:find("How to use it", 1, true) ~= nil)

s = scenario(function() _H.type("zzzqqqx") end, 8)
check("unknown query explains itself", s:find("Nothing found", 1, true) ~= nil)

s = scenario(function() _H.type("glissando") end, 10)
check("prose fallback finds a topic", s:find("Harp", 1, true) ~= nil)

do -- click SOURCES, then back
  dofile(HARNESS)
  _H.onframe = function(n)
    if n == 1 then _H.type("horn") end
    if n == 4 then _H.mouse(gfx.w - 40, 18, 1) end
    if n == 6 then _H.mouse(20, 18, 1) end
    if n == 8 then _H.mouse(-100, -100, 0); _H.clear_drawn() end
  end
  local d = _H.run(14)
  local str = table.concat(_H.drawn(), " | ")
  check("clicking SOURCES then back returns to the entry",
        str:find("Horn", 1, true) ~= nil)
end

do -- reverse links from an instrument to the composers noted for it
  dofile(HARNESS)
  _H.type("horn"); _H.press(13, 1); _H.press(_H.K("pgdn"), 14)
  local str = table.concat(_H.run(45), " | ")
  check("instrument page lists composers noted for it",
        str:find("COMPOSERS NOTED FOR IT", 1, true) ~= nil)
  check("those composer chips are real names",
        str:find("Carl Maria von Weber", 1, true)
        and str:find("John Williams", 1, true) ~= nil)
end

do -- a film composer entry renders its own sections
  dofile(HARNESS)
  _H.type("bernard hermann"); _H.press(13, 1)
  local str = table.concat(_H.run(14), " | ")
  check("film composer entry renders", str:find("Bernard Herrmann", 1, true) ~= nil)
  check("film composer entry is cited", str:find("FILM", 1, true) ~= nil)
end

do -- wheel
  dofile(HARNESS)
  _H.type("strings"); _H.frame(); _H.wheel(-600); _H.frame()
  local ok = pcall(function() _H.run(30) end)
  check("wheel scrolling", ok)
end

------------------------------------------------------------------------------
section("Punctuation and odd input")
------------------------------------------------------------------------------
local crashed = {}
for _, q in ipairs{"%", "%%", "(", ")", "[", "]", "-", ".*", "^horn$", "a+b",
                   "?", "\\", "100%", "trombone!!!", "  ", "...", "c#"} do
  dofile(HARNESS)
  local ok = pcall(function() _H.type(q); _H.run(8) end)
  if not ok then crashed[#crashed+1] = q end
end
check("pattern metacharacters in the query are safe", #crashed == 0,
      table.concat(crashed, " "))

for _, c in ipairs{ {"b-flat clarinet", "Clarinet"},
                    {"'cello", "Violoncello"},
                    {"cor-anglais", "English Horn (Cor Anglais)"},
                    {"e-flat clarinet", "E-flat Clarinet (Small Clarinet)"} } do
  local got = topmatch(c[1])
  check(("punctuated query %q"):format(c[1]), got == c[2], "got " .. got)
end

------------------------------------------------------------------------------
print(("\n%d passed, %d failed"):format(pass, fail))
os.exit(fail == 0 and 0 or 1)
