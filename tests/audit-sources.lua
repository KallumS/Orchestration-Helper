--[[
  Citation coverage per source, so "which sources are thin?" is answered by
  counting rather than by memory.

      lua5.4 tests/audit-sources.lua

  A source is "located" when its citation names a page or a chapter. Tag-only
  sources are the ones gathered from search-result summaries rather than a full
  text: see editorial rule 4 in CLAUDE.md. They are not wrong, but they are the
  first thing to upgrade if the full text ever arrives.
]]--

local HERE = (debug.getinfo(1, "S").source:match("^@(.*)[/\\]") or ".")
local FILES = { HERE .. "/../orchestration_data.lua",
                HERE .. "/../orchestration_composers.lua" }

-- Read in full, but with nothing to cite a page from. Being tag-only here is a
-- property of the source, not a gap in the reading, so these are reported apart
-- from the ones that were only ever seen as search-result summaries.
local PAGELESS = { WP = "no pagination to cite" }

local entries, tags = {}, {}
for _, f in ipairs(FILES) do
  local D = dofile(f)
  for _, e in ipairs(D.ENTRIES) do entries[#entries + 1] = e end
  for tag in pairs(D.SOURCES or {}) do tags[tag] = true end
end

-- Only declared tags count. "SIN ch.VIII" would otherwise report VIII as a
-- source of its own, which is how a first pass at this got its numbers wrong.
local ordered = {}
for t in pairs(tags) do ordered[#ordered + 1] = t end
table.sort(ordered)

local stat = {}
for _, t in ipairs(ordered) do stat[t] = { n = 0, located = 0, entries = {} } end

local total = 0
for _, e in ipairs(entries) do
  for _, sec in ipairs(e.sec or {}) do
    for _, it in ipairs(sec[2]) do
      local cite = it[3] or ""
      total = total + 1
      for _, t in ipairs(ordered) do
        -- a tag is present when it appears as a whole word
        if cite:find("%f[%w]" .. t .. "%f[%W]") then
          local st = stat[t]
          st.n = st.n + 1
          -- Located = the tag is followed by something that narrows it down: a
          -- page, a chapter, or a page title. A web source with no pagination
          -- can still be located by the title of the page carrying the claim,
          -- which is how IDIO and HUG are cited.
          if cite:find(t .. "%s+[%w']") then
            st.located = st.located + 1
          end
          if not st.entries[e.id] then
            st.entries[e.id] = true
            st.nentries = (st.nentries or 0) + 1
          end
        end
      end
    end
  end
end

print(("%-6s %7s %9s %8s  %s"):format("tag", "items", "located", "entries", "precision"))
print(("-"):rep(58))
local thin = {}
for _, t in ipairs(ordered) do
  local st = stat[t]
  local pct = st.n > 0 and math.floor(st.located / st.n * 100 + 0.5) or 0
  local how
  if st.n == 0 then how = "declared but unused"
  elseif pct == 100 then how = "located (page, chapter or title)"
  elseif PAGELESS[t] then how = "tag only - " .. PAGELESS[t]
  elseif pct == 0 then how = "TAG ONLY - no full text read"
  else how = "mixed" end
  if pct < 100 and st.n > 0 and not PAGELESS[t] then thin[#thin + 1] = t end
  print(("%-6s %7d %8d%% %8d  %s")
        :format(t, st.n, pct, st.nentries or 0, how))
end
print(("-"):rep(58))

local n = 0
for _, t in ipairs(thin) do n = n + stat[t].n end
print(("%d items in total; %d of them (%d%%) rest on a source that was never read "
    .. "in full")
      :format(total, n, math.floor(n / total * 100 + 0.5)))
if #thin > 0 then
  print("send a full text for these and the citations can be upgraded: "
        .. table.concat(thin, ", "))
end
