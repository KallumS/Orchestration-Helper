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

check("entries present", #D.ENTRIES >= 110, ("%d entries"):format(#D.ENTRIES))
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

-- Belkin is cited from his own 65-page PDF, so every BEL citation must carry a
-- page. Catching a bare "BEL" here stops the tag-only habit creeping back.
local belbare = {}
for _, e in ipairs(D.ENTRIES) do
  for _, sec in ipairs(e.sec or {}) do
    for _, it in ipairs(sec[2]) do
      local c = it[3] or ""
      if c:find("BEL") and not c:find("BEL p%.") then
        belbare[#belbare+1] = e.id .. ":" .. c
      end
    end
  end
end
check("every BEL citation names a page", #belbare == 0, table.concat(belbare, " "))

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
  -- Belkin's craft topics
  {"contrast", "Scale of Timbral Contrast"}, {"planes", "Planes of Tone"},
  {"planes of tone", "Planes of Tone"}, {"tutti", "The Tutti"},
  {"resonance", "Sustained vs Dry Sound"},
  {"counterpoint", "Orchestrating Counterpoint"},
  {"accompaniment", "Accompanying a Soloist"},
  {"concerto", "Accompanying a Soloist"},
  {"dynamics", "Orchestrating Dynamics"},
  {"form", "Orchestration and Form"},
  {"good orchestration", "Good and Poor Orchestration"},
  {"poor orchestration", "Good and Poor Orchestration"},
  -- the character glossary: emotion in, orchestration out
  {"character", "Character: Scoring for a Mood"},
  {"mood", "Character: Scoring for a Mood"},
  {"luminous", "Luminous"}, {"mysterious", "Mysterious"}, {"eerie", "Mysterious"},
  {"menacing", "Menacing"}, {"ominous", "Menacing"},
  {"terrifying", "Terrifying, Angry, Savage"}, {"brilliant", "Brilliant"},
  {"triumphant", "Splendid, Rich, Triumphant"},
  {"heroic", "Splendid, Rich, Triumphant"}, {"dramatic", "Dramatic"},
  {"funereal", "Funereal"}, {"playful", "Playful, Funny"},
  {"comic", "Playful, Funny"}, {"sad", "Sad, Melancholy, Poignant"},
  {"melancholy", "Sad, Melancholy, Poignant"},
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
      s:find("Search for an instrument", 1, true) and s:find("STRINGS", 1, true) ~= nil)

s = scenario(function() _H.press(_H.K("f1"), 1) end, 8)
check("F1 opens help", s:find("How to Use It", 1, true) ~= nil)

s = scenario(function() _H.type("zzzqqqx") end, 8)
check("unknown query explains itself", s:find("Nothing Found", 1, true) ~= nil)

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

do -- the contrast scale renders all five of its groups
  dofile(HARNESS)
  _H.type("contrast"); _H.press(13, 1); _H.press(_H.K("pgdn"), 20)
  local str = table.concat(_H.run(60), " | ")
  check("contrast scale shows group 1 and group 5",
        str:find("GROUP 1 — IMPERCEPTIBLE OR VERY MILD", 1, true)
        and str:find("GROUP 5 — EXTREME", 1, true) ~= nil)
end

do -- a character entry gives scoring suggestions, not just prose
  dofile(HARNESS)
  _H.type("mysterious"); _H.press(13, 1)
  local str = table.concat(_H.run(12), " | ")
  check("character entry gives scoring suggestions",
        str:find("Muted strings", 1, true)
        and str:find("String harmonics", 1, true) ~= nil)
  check("character entry is page-cited to Belkin", str:find("BEL p.", 1, true) ~= nil)
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
section("Citation precision")
------------------------------------------------------------------------------
-- A tag-only source is honest; a tag-only source that has been read in full is
-- just an un-upgraded citation. These two were upgraded when their texts
-- arrived, so a bare tag is now a mistake and the suite says so.
for _, tag in ipairs{ "BEL", "IDIO", "HUG", "BERL", "ACTOR" } do
  local bare = {}
  for _, e in ipairs(D.ENTRIES) do
    for _, sec in ipairs(e.sec or {}) do
      for _, it in ipairs(sec[2]) do
        local c = it[3] or ""
        -- present as a whole word, but not followed by a locator
        if c:find("%f[%w]" .. tag .. "%f[%W]") and not c:find(tag .. "%s+[%w\']") then
          bare[#bare + 1] = e.id .. ":" .. c
        end
      end
    end
  end
  check(("every %s citation carries a locator"):format(tag), #bare == 0,
        table.concat(bare, " "))
end

-- Every declared source must actually be used, or the Sources page lists a work
-- nothing rests on.
do
  local used = {}
  for _, e in ipairs(D.ENTRIES) do
    for _, sec in ipairs(e.sec or {}) do
      for _, it in ipairs(sec[2]) do
        for tag in pairs(D.SOURCES) do
          if (it[3] or ""):find("%f[%w]" .. tag .. "%f[%W]") then used[tag] = true end
        end
      end
    end
  end
  local unused = {}
  for tag in pairs(D.SOURCES) do
    if not used[tag] then unused[#unused + 1] = tag end
  end
  check("every declared source is cited somewhere", #unused == 0,
        table.concat(unused, ","))
end

-- HUG was split out of the MOD group when Hugill was read in full. If it ever
-- vanishes from the Sources page order, its entries lose their attribution.
do
  local src = assert(io.open(HERE .. "/../Orchestration Helper.lua")):read("a")
  local order = src:match("local order = (%b{})")
  check("the Sources page lists every tag", order ~= nil)
  local missing = {}
  for tag in pairs(D.SOURCES) do
    if not (order or ""):find('"' .. tag .. '"', 1, true) then
      missing[#missing + 1] = tag
    end
  end
  check("no source is missing from the Sources page order", #missing == 0,
        table.concat(missing, ","))
end

-- The Berlioz translation consulted reserves all rights, so BERL items state his
-- substance in this encyclopaedia's own words. Where Berlioz is quoted verbatim it
-- is from the older public-domain translation Singleton uses, and SIN is cited too.
-- A long quotation on a BERL-only item would be reproducing the live translation.
do
  local risky = {}
  for _, e in ipairs(D.ENTRIES) do
    for _, sec in ipairs(e.sec or {}) do
      for _, it in ipairs(sec[2]) do
        local c = it[3] or ""
        if c:find("%f[%w]BERL%f[%W]") and not c:find("%f[%w]SIN%f[%W]") then
          -- longest run between double quotes in the detail text
          for quoted in (it[2] or ""):gmatch('"([^"]+)"') do
            local words = 0
            for _ in quoted:gmatch("%S+") do words = words + 1 end
            if words > 12 then
              risky[#risky + 1] = e.id .. ": " .. quoted:sub(1, 40)
            end
          end
        end
      end
    end
  end
  check("BERL-only items paraphrase rather than quote at length", #risky == 0,
        table.concat(risky, " | "))
end

------------------------------------------------------------------------------
section("Index folding")
------------------------------------------------------------------------------
local FAMILIES = { "Strings", "Woodwind", "Brass", "Percussion", "Plucked",
                   "Voices", "Combining", "Craft", "Character", "Reference",
                   "Composers", "Film Composers" }

-- The point of folding: the index opens as the search box over a short list of
-- families, with no entry names showing at all.
s = scenario(nil, 3)
check("index opens with every family closed",
      s:find("STRINGS", 1, true) and not s:find("Violoncello", 1, true))

do
  local missing = {}
  for _, f in ipairs(FAMILIES) do
    if not s:find(f:upper(), 1, true) then missing[#missing + 1] = f end
  end
  check("every family is listed on the closed index", #missing == 0,
        table.concat(missing, ","))
end

-- Counts come from the data, so a family gaining an entry needs no edit here.
do
  local n = {}
  for _, e in ipairs(D.ENTRIES) do   -- already the merged set
    n[e.family] = (n[e.family] or 0) + 1
  end
  local bad = {}
  for f, c in pairs(n) do
    if not s:find(" | " .. c .. " | ", 1, true) then bad[#bad + 1] = f end
  end
  check("each family header carries its entry count", #bad == 0,
        table.concat(bad, ","))
end

-- The closed index has to fit without scrolling, or it has not bought anything.
check("the closed index needs no scrolling",
      not s:find("Ctrl+Left closes them all", 1, true))

-- Clicking a family band opens just that family.
local function click_family(name, run2)
  dofile(HARNESS)
  local target = name:upper()
  _H.onframe = function(f)
    local p = _H.find(target)
    if not p then return end
    if f == 2 then _H.mouse(p.x + 10, p.y + 3, 0)
    elseif f == 3 then _H.mouse(p.x + 10, p.y + 3, 1)
    elseif f == 4 then _H.mouse(-100, -100, 0); _H.clear_drawn() end
  end
  local d1 = table.concat(_H.run(8), " | ")
  if not run2 then return d1 end
  _H.onframe = nil
  _H.mouse(-100, -100, 0)
  return d1, table.concat(_H.run(3), " | ")
end

local opened, reloaded = click_family("Strings", true)
check("clicking a family opens it",
      opened:find("Violoncello", 1, true) and opened:find("Double Bass", 1, true)
        and opened:find("Pizzicato", 1, true) ~= nil)
check("opening one family leaves the others closed",
      not opened:find("Trombone", 1, true))
check("what is left open survives a reload",
      reloaded:find("Violoncello", 1, true) ~= nil)

-- Clicking the same band again closes it.
do
  dofile(HARNESS)
  _H.onframe = function(f)
    local p = _H.find("STRINGS")
    if not p then return end
    if f == 3 then _H.mouse(p.x + 10, p.y + 3, 1)
    elseif f == 4 then _H.mouse(p.x + 10, p.y + 3, 0)
    elseif f == 6 then _H.mouse(p.x + 10, p.y + 3, 1)
    elseif f == 7 then _H.mouse(-100, -100, 0); _H.clear_drawn() end
  end
  local d = table.concat(_H.run(10), " | ")
  check("clicking an open family closes it again",
        d:find("STRINGS", 1, true) and not d:find("Violoncello", 1, true))
end

-- Ctrl+Right / Ctrl+Left work the whole index at once.
-- `tobottom` adds a Ctrl+End, which is needed to read the index's own summary
-- line: that line is a body row, so with every family open it sits below the
-- viewport and is never drawn. Entries near the top need the opposite, so the
-- two checks below run the scenario twice rather than compromising on one.
local function all_families(key, tobottom)
  dofile(HARNESS)
  _H.frame(); _H.frame()
  _H.press(_H.K(key), 1)
  local wipe = 4
  if tobottom then _H.press(_H.K("end"), 1); wipe = 5 end
  _H.onframe = function(f)
    _H.mouse(-100, -100, 4)            -- Ctrl held
    if f == wipe then _H.clear_drawn() end
  end
  return table.concat(_H.run(12), " | ")
end

check("Ctrl+Right opens every family",
      all_families("rght", true):find("Ctrl+Left closes them all", 1, true) ~= nil)
s = all_families("rght")
check("Ctrl+Right shows entries from more than one family",
      s:find("Violoncello", 1, true) and s:find("Trombone", 1, true) ~= nil)

do -- open them all, then close them all, in one session
  dofile(HARNESS)
  _H.frame(); _H.frame()
  _H.press(_H.K("rght"), 1)
  _H.press(_H.K("left"), 1)
  _H.onframe = function(f)
    _H.mouse(-100, -100, 4)
    if f == 6 then _H.clear_drawn() end
  end
  local d = table.concat(_H.run(11), " | ")
  check("Ctrl+Left closes every family",
        d:find("STRINGS", 1, true) and not d:find("Violoncello", 1, true)
          and d:find("Ctrl+Right opens them all", 1, true) ~= nil)
end

-- Folding must not touch the search path: it is the primary way in.
s = scenario(function() _H.type("violoncello") end, 12)
check("search still reaches an entry inside a closed family",
      s:find("PAIRINGS IN UNISON", 1, true) ~= nil)

------------------------------------------------------------------------------
section("Colour scheme")
------------------------------------------------------------------------------
-- The scheme is shared with Starting Blocks, and its least obvious property is
-- the easiest to lose: every grey is cool, R < G < B. A neutral grey at the same
-- lightness reads as correct in a diff and only looks flat on screen beside the
-- yellow, so the bias is checked rather than trusted. See COLOUR.md.
do
  local src = assert(io.open(HERE .. "/../Orchestration Helper.lua")):read("a")
  local body = src:match("local C = {(.-)\n}")
  check("the colour table is where the suite expects it", body ~= nil)

  local roles, warm, nroles = {}, {}, 0
  for name, hex in (body or ""):gmatch("([%w_]+)%s*=%s*hex%(0x(%x+)%)") do
    local v = tonumber(hex, 16)
    local r, g, b = math.floor(v / 65536) % 256, math.floor(v / 256) % 256, v % 256
    roles[name] = { r = r, g = g, b = b, hex = hex:upper() }
    nroles = nroles + 1
    -- the accent and the warning (as a rule and in words) are the saturated
    -- colours, and are exempt
    if name ~= "accent" and name ~= "warn" and name ~= "warn_text"
       and not (r < g and g < b) then
      warm[#warm + 1] = name .. "=#" .. hex:upper()
    end
  end

  check("every grey keeps R < G < B", #warm == 0, table.concat(warm, " "))
  check("the ramp has enough steps to build a window from", nroles >= 15,
        nroles .. " roles")

  check("the accent is the shared yellow",
        roles.accent and roles.accent.hex == "FFF200", roles.accent and roles.accent.hex)
  check("the ground is the shared cool grey",
        roles.bg and roles.bg.hex == "23272E", roles.bg and roles.bg.hex)
  check("the warning is not a shade of the accent",
        roles.warn and roles.warn.r > roles.warn.g and roles.warn.g > roles.warn.b,
        roles.warn and roles.warn.hex)

  -- Light controls force dark text. If the control fill is lighter than the
  -- ground, every button needs the ink, not the body text colour.
  local function lum(c) return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b end
  check("controls sit lighter than the ground",
        roles.control and roles.bg and lum(roles.control) > lum(roles.bg) + 60)
  check("the ink is dark enough to read on a control",
        roles.ink and roles.control and lum(roles.control) - lum(roles.ink) > 100)

  -- The accent is spent only on what is switched on. Item labels and section
  -- headers were amber and blue before the scheme landed; they must stay off it.
  local hits = 0
  for _ in src:gmatch("C%.accent") do hits = hits + 1 end
  check("the accent is used sparingly", hits <= 4, hits .. " uses")
  check("item labels no longer take the accent",
        src:find("para(label, F.LABEL, C.title", 1, true) ~= nil)
  check("there is no second accent", src:find("C.accent2", 1, true) == nil)
end

------------------------------------------------------------------------------
section("Wording (Apple's writing guidelines)")
------------------------------------------------------------------------------
do
  -- The header buttons are title-style, not shouted.
  local s = scenario(nil, 4)
  check("header buttons read Help, Index, Sources",
        s:find(" | Help | ", 1, true) and s:find(" | Index | ", 1, true)
          and s:find(" | Sources | ", 1, true) and not s:find("SOURCES", 1, true))
  -- Elsewhere the keys are named in words; on a Mac, with its symbols.
  check("keys in words off the Mac", s:find("Ctrl+Right opens all", 1, true) ~= nil)
  dofile(HARNESS)
  reaper.GetOS = function() return "macOS-arm64" end
  local d = table.concat(_H.run(4), " | ")
  check("keys as Mac symbols on a Mac",
        d:find("⌘→ opens all", 1, true) and not d:find("Ctrl+", 1, true))
  -- No three full stops, spaced hyphens or straight quotes in the window's own
  -- pages. An entry's prose is the encyclopaedia's content and quotes its
  -- sources as written, so it is not held to this.
  local function screens()
    local all = {}
    for _, feed in ipairs{ function() end,
                           function() _H.press(_H.K("f1"), 1) end,
                           function() _H.type("zzzqqqx") end } do
      all[#all + 1] = scenario(feed, 8)
    end
    return table.concat(all, " | ")
  end
  local text = screens()
  check("no ... on screen", not text:find("...", 1, true))
  check("no spaced hyphen as a dash on screen", not text:find(" - ", 1, true))
  check("no straight double quotes on screen", not text:find('"', 1, true))
end

------------------------------------------------------------------------------
section("Apple's HIG Foundations (ADR 0014)")
------------------------------------------------------------------------------
do
  local function lin(c)
    return c <= 0.03928 and c / 12.92 or ((c + 0.055) / 1.055) ^ 2.4
  end
  local function lum(r, g, b) return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) end
  local function ratio(a, b)
    local x, y = lum(a[1], a[2], a[3]), lum(b[1], b[2], b[3])
    if x < y then x, y = y, x end
    return (x + 0.05) / (y + 0.05)
  end
  local function rgb(v)
    return { math.floor(v / 65536) % 256 / 255, math.floor(v / 256) % 256 / 255,
             v % 256 / 255 }
  end
  local GROUND, INK = rgb(0x23272E), rgb(0x14171C)
  local function same(p, c)
    return math.abs(p.r - c[1]) < 1e-6 and math.abs(p.g - c[2]) < 1e-6
       and math.abs(p.b - c[3]) < 1e-6
  end

  -- Every line of text, on every page, at 7:1 on the ground - Apple's target
  -- for small text in a dark window. Text on a control is dark ink, checked
  -- against the control instead. Named by the string, so a failure says which.
  local pages = {
    function() _H.raw{ _H.K("rght") }; _H.frame() end,   -- index, all open
    function() _H.press(_H.K("f1"), 1) end,
    function() _H.type("zzzqqqx") end,
    function() _H.type("string section"); _H.press(_H.K("pgdn"), 8) end,
    function() _H.type("horn") end,                       -- several matches
  }
  local low, seen, sparing = {}, 0, false
  for i, feed in ipairs(pages) do
    dofile(HARNESS)
    if i == 1 then _H.mouse(-100, -100, 4) end
    feed()
    _H.run(8)
    for _, p in ipairs(_H.placed()) do
      seen = seen + 1
      if p.s == "USE SPARINGLY" then sparing = true end
      local r
      if same(p, INK) then r = ratio(INK, rgb(0xA9AFBA))
      else r = ratio({ p.r, p.g, p.b }, GROUND) end
      if r < 7 and #low < 5 then low[#low + 1] = ("%q %.1f:1"):format(p.s, r) end
    end
  end
  check("every line of text is 7:1 or more", #low == 0 and seen > 500,
        table.concat(low, ", "))
  check("the contrast sweep reached a warning header", sparing)

  -- Text Size: Cmd/Ctrl with = - 0, clamped, remembered, and it scales the page.
  dofile(HARNESS)
  _H.run(4)
  local helpx = _H.find("Help").x
  _H.mouse(-100, -100, 4)
  _H.press(61, 1)
  _H.run(4)
  check("Ctrl+= makes the text bigger", _H.extstate()["OrchestrationHelper/textsize"] == "125")
  check("bigger text widens the buttons", _H.find("Help").x < helpx)
  _H.press(61, 6)
  _H.run(10)
  check("Text Size stops at 200%", _H.extstate()["OrchestrationHelper/textsize"] == "200")
  _H.mouse(-100, -100, 0)
  _H.run(4)
  check("Text Size is remembered", _H.extstate()["OrchestrationHelper/textsize"] == "200"
        and _H.find("Help").x < helpx)
  _H.mouse(-100, -100, 4)
  _H.press(45, 1)
  _H.run(4)
  check("Ctrl+- makes it smaller", _H.extstate()["OrchestrationHelper/textsize"] == "150")
  _H.press(48, 1)
  _H.run(4)
  check("Ctrl+0 goes back to 100%", _H.extstate()["OrchestrationHelper/textsize"] == "100"
        and _H.find("Help").x == helpx)
  _H.mouse(-100, -100, 0)
  _H.type("=")
  _H.run(4)
  check("= on its own still types", _H.find("=") ~= nil)

  dofile(HARNESS)
  reaper.SetExtState("OrchestrationHelper", "textsize", "999", true)
  _H.run(4)
  check("a nonsense Text Size loads as 100%", _H.find("Help").x == helpx)

  -- The Text Size button opens a menu with the current size ticked.
  dofile(HARNESS)
  _H.run(3)
  local tsb = _H.find("Text Size")
  _H.menupick = 3
  _H.onframe = function(n)
    if n == 1 then _H.mouse(tsb.x + 4, tsb.y + 4, 1)
    elseif n == 2 then _H.mouse(-100, -100, 0) end
  end
  _H.run(6)
  check("the Text Size menu lists the sizes, the current one ticked",
        _H.menu == "!100%|125%|150%|200%", _H.menu)
  check("choosing 150% from the menu sets it",
        _H.extstate()["OrchestrationHelper/textsize"] == "150")

  -- A click arriving just after the menu closes is the menu's own, not a new one.
  dofile(HARNESS)
  _H.run(3)
  tsb = _H.find("Text Size")
  local src = _H.find("Sources")
  _H.onframe = function(n)
    if n == 1 then _H.mouse(tsb.x + 4, tsb.y + 4, 1)
    elseif n == 2 then _H.mouse(-100, -100, 0)
    elseif n == 3 then _H.mouse(src.x + 4, src.y + 4, 1)
    elseif n == 4 then _H.mouse(-100, -100, 0) end
  end
  _H.clear_drawn()
  _H.run(8)
  check("a click straight after the menu is ignored",
        table.concat(_H.drawn(), "|"):find("Every statement", 1, true) == nil)
  _H.onframe = function(n)
    if n == 2 then _H.mouse(src.x + 4, src.y + 4, 1)
    elseif n == 3 then _H.mouse(-100, -100, 0) end
  end
  _H.run(8)
  check("a click a moment later works",
        table.concat(_H.drawn(), "|"):find("Every statement", 1, true) ~= nil)
  _H.onframe = nil

  -- Controls are 28 points tall, 12 apart; the chosen one carries an ink bar.
  local function rectsOf(colour)
    local out, last = {}, 0
    for _, r in ipairs(_H.rects()) do last = math.max(last, r.frame) end
    for _, r in ipairs(_H.rects()) do
      if r.frame == last and r.fill and same(r, rgb(colour)) then out[#out + 1] = r end
    end
    return out
  end
  dofile(HARNESS)
  _H.mouse(-100, -100, 4)
  _H.raw{ _H.K("rght") }; _H.frame()
  _H.run(4)
  local btns = {}
  for _, c in ipairs{ 0xA9AFBA, 0xFFF200 } do
    for _, r in ipairs(rectsOf(c)) do
      if r.w > 4 and r.y < 60 then btns[#btns + 1] = r end   -- not the caret
    end
  end
  table.sort(btns, function(a, b) return a.x < b.x end)
  local short, close = {}, {}
  for i, r in ipairs(btns) do
    if r.h < 28 then short[#short + 1] = r.h end
    if i > 1 and r.x - (btns[i - 1].x + btns[i - 1].w) < 12 then close[#close + 1] = i end
  end
  check("five header buttons, each 28 tall", #btns == 5 and #short == 0,
        #btns .. " buttons, short: " .. table.concat(short, ","))
  check("header buttons 12 apart", #close == 0)
  local chipsShort, nchips = 0, 0
  for _, r in ipairs(rectsOf(0x1A1D23)) do
    if r.w > 10 and r.h < 200 then
      nchips = nchips + 1
      if r.h < 28 then chipsShort = chipsShort + 1 end
    end
  end
  check("every name on the index is a 28-point control", nchips > 20 and chipsShort == 0,
        nchips .. " chips, " .. chipsShort .. " short")
  local bars = rectsOf(0x14171C)
  local idx
  for _, r in ipairs(rectsOf(0xFFF200)) do if r.w > 4 then idx = r end end
  check("the chosen button carries an ink bar, and only it", #bars == 1 and idx
        and bars[1].x > idx.x and bars[1].x + bars[1].w < idx.x + idx.w
        and bars[1].y > idx.y and bars[1].y < idx.y + idx.h, #bars .. " bars")

  -- Tab rings a control; Return or Space presses it; Esc or typing drops it.
  local RING = rgb(0xF2F4F7)
  local function rings()
    local out, last = {}, 0
    for _, r in ipairs(_H.rects()) do last = math.max(last, r.frame) end
    for _, r in ipairs(_H.rects()) do
      if r.frame == last and not r.fill and same(r, RING) then out[#out + 1] = r end
    end
    return out
  end
  dofile(HARNESS)
  _H.run(3)
  local back = _H.find("<")
  check("no ring before the keyboard is used", #rings() == 0)
  _H.frame()
  _H.press(9, 1)
  _H.run(3)
  local rg = rings()
  check("Tab rings the first button", #rg > 0 and rg[1].x < back.x and rg[1].y < back.y + 4)
  _H.frame()
  _H.press(9, 3)
  _H.press(32, 1)
  _H.run(6)
  check("Space presses the ringed button",
        table.concat(_H.drawn(), "|"):find("How to Use It", 1, true) ~= nil)

  dofile(HARNESS)
  _H.frame()
  _H.press(9, 6)                         -- Back, Text Size, Help, Index, Sources, Strings
  _H.press(13, 1)
  _H.run(10)
  local d = table.concat(_H.drawn(), "|")
  check("Tab reaches a family and Return opens it", d:find("Violin", 1, true) ~= nil
        and _H.extstate()["OrchestrationHelper/open"] == "Strings")

  dofile(HARNESS)
  _H.frame()
  _H.press(9, 1)
  _H.onframe = function(n) _H.mouse(-100, -100, n == 2 and 8 or 0) end
  _H.press(9, 1)
  _H.run(5)
  _H.onframe = nil
  rg = rings()
  check("Shift+Tab goes back round to the last", #rg > 0 and rg[1].y > 100)

  dofile(HARNESS)
  _H.mouse(-100, -100, 4)
  _H.raw{ _H.K("rght") }; _H.frame()
  _H.run(2)
  _H.mouse(-100, -100, 0)
  _H.press(9, 90)
  _H.run(100)
  rg = rings()
  check("Tab scrolls a name below the window into view", #rg > 0
        and rg[1].y > 60 and rg[1].y + rg[1].h < 680,
        #rg > 0 and ("ring at " .. rg[1].y) or "no ring")

  dofile(HARNESS)
  _H.frame()
  _H.press(9, 2)
  _H.press(27, 1)
  _H.run(6)
  check("Esc drops the ring first", #rings() == 0
        and table.concat(_H.drawn(), "|"):find("Orchestration Helper", 1, true) ~= nil)
  dofile(HARNESS)
  _H.frame()
  _H.press(9, 2)
  _H.type("ho")
  _H.run(6)
  check("typing drops the ring and goes to the box", #rings() == 0 and _H.find("ho") ~= nil)

  -- The help page says how.
  local h = scenario(function() _H.press(_H.K("f1"), 1) end, 6)
  check("help names Tab and the Text Size keys",
        h:find("Tab Shift+Tab", 1, true) and h:find("Ctrl+= Ctrl+-", 1, true))
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
