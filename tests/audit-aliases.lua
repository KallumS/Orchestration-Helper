--[[
  Alias collision audit.

      lua5.4 tests/audit-aliases.lua

  Lists every search key claimed by more than one entry, across both databases.
  Collisions are not automatically wrong: `drums` legitimately means both the
  Percussion Section and the Timpani, and the user can arrow between the matches.
  They ARE wrong when a dedicated entry exists for the word and something else
  outranks it on the alphabetical tie-break - that is how the `dynamics` bug
  happened (see docs/SESSION-LOG.md 6a).

  Exits 0 always; this is a report, not a test.
]]--

local HERE = (debug.getinfo(1, "S").source:match("^@(.*)[/\\]") or ".")
local FILES = { "orchestration_data.lua", "orchestration_composers.lua" }

local function fold(s)
  return (tostring(s):lower():gsub("[^%w]+", ""))
end

local claims = {}   -- key -> list of entry ids
for _, f in ipairs(FILES) do
  local db = dofile(HERE .. "/../" .. f)
  for _, e in ipairs(db.ENTRIES) do
    -- Dedupe within the entry first: an entry whose name, id and one alias all
    -- fold to the same key must count once, not three times. Leaving this out
    -- makes the report useless - nearly every entry appears to collide with
    -- itself.
    local seen = {}
    local function claim(s)
      local k = fold(s)
      if #k > 0 and not seen[k] then
        seen[k] = true
        claims[k] = claims[k] or {}
        table.insert(claims[k], e.id)
      end
    end
    claim(e.name)
    claim(e.id)
    for _, a in ipairs(e.aliases or {}) do claim(a) end
  end
end

local rows = {}
for key, ids in pairs(claims) do
  if #ids > 1 then rows[#rows + 1] = { key = key, ids = ids } end
end
table.sort(rows, function(a, b) return a.key < b.key end)

for _, r in ipairs(rows) do
  print(("%-18s %s"):format(r.key, table.concat(r.ids, ", ")))
end
print(("\n%d colliding key%s"):format(#rows, #rows == 1 and "" or "s"))
