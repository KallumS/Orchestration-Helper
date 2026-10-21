--[[
  Headless stand-in for the parts of REAPER's gfx and reaper APIs that
  Orchestration Helper uses, so the script can be driven from plain Lua.

  Font metrics are approximated (character count times a per-size factor), so
  this verifies structure and behaviour rather than pixel-accurate appearance.

  Run the suite with:  lua5.4 tests/run.lua
]]--

-- Resolve the script under test relative to this harness, so the suite runs
-- from any checkout location.
local HERE = (debug.getinfo(1, "S").source:match("^@(.*)[/\\]") or ".")
local SCRIPT = HERE .. "/../Orchestration Helper.lua"
local DATA   = HERE .. "/../orchestration_data.lua"
local COMPOSERS = HERE .. "/../orchestration_composers.lua"

_H = {}

local keyqueue = {}
local drawn = {}        -- every drawstr that happened this frame
local placed = {}       -- the same calls, with the pen position they used
local rects = {}       -- every gfx.rect this frame, with the colour set
local frames = 0
local MAXFRAMES = 0
local clock = 0         -- reaper.time_precise: a thirtieth of a second a frame

gfx = {
  r=0,g=0,b=0,a=1,mode=0,w=760,h=680,x=0,y=0,texth=14,
  mouse_x=-100, mouse_y=-100, mouse_cap=0, mouse_wheel=0,
  ext_retina=1, clear=0, dest=-1,
}
local curfont = 0
local fontsz = {}
-- As REAPER documents it: called again with a name alone, an open window is
-- retitled and keeps its size. The title is kept in _H.title.
function gfx.init(name,w,h,d,x,y)
  if name and name ~= "" then _H.title = name end
  if w and w > 0 then gfx.w = w elseif not _H.opened then gfx.w = 760 end
  if h and h > 0 then gfx.h = h elseif not _H.opened then gfx.h = 680 end
  _H.opened = true
  return 1
end
-- The faces "the system has": a face not in the list is quietly replaced by
-- the first, as the OS does, and gfx.getfont reports what was really used.
-- _H.faces[idx] is the face each font slot ended up with.
local fontface = {}
function gfx.setfont(idx, face, sz, flags)
  curfont = idx
  if sz then fontsz[idx] = sz end
  if face then
    local have = _H.systemfonts or { "DejaVu Sans" }
    local got = have[1]
    for _, f in ipairs(have) do
      if f:lower() == face:lower() then got = f end
    end
    fontface[idx] = got
    _H.faces = _H.faces or {}
    _H.faces[idx] = got
  end
  gfx.texth = (fontsz[idx] or 14) + 3
end
function gfx.getfont() return curfont, fontface[curfont] end
function gfx.measurestr(s)
  local sz = fontsz[curfont] or 14
  return #tostring(s) * sz * 0.52, gfx.texth
end
function gfx.measurechar(c) return (fontsz[curfont] or 14)*0.52, gfx.texth end
function gfx.drawstr(s, flags, r, b)
  drawn[#drawn+1] = tostring(s)
  -- Same call, with where the pen was. Tests that need to click on something
  -- have no other way to find it: gfx.rect is a no-op here, so the only trace a
  -- drawn row leaves is the text and this position.
  placed[#placed+1] = { s = tostring(s), x = gfx.x, y = gfx.y, frame = frames,
                        r = gfx.r, g = gfx.g, b = gfx.b,
                        w = (gfx.measurestr(s)) }
  gfx.x = gfx.x + (gfx.measurestr(s))
end
function gfx.drawnumber(n,d) gfx.drawstr(tostring(n)) end
function gfx.printf(f,...) gfx.drawstr(tostring(f)) end
function gfx.rect(x,y,w,h,f)
  rects[#rects+1] = { x = x, y = y, w = w, h = h, fill = f ~= 0,
                      r = gfx.r, g = gfx.g, b = gfx.b, frame = frames }
end
function gfx.roundrect() end
function gfx.line() end
function gfx.lineto() end
function gfx.circle() end
function gfx.triangle() end
function gfx.arc() end
function gfx.set(r,g,b,a,m,d,a2) gfx.r,gfx.g,gfx.b=r,g,b; gfx.a=a or 1 end
function gfx.update()
  frames = frames + 1
  clock = clock + 1 / 30
  if _H and _H.onframe then _H.onframe(frames) end
  if frames >= MAXFRAMES then keyqueue = {-1} end
end
function gfx.quit() end
function gfx.dock(v,a,b,c,d) return 0, 100, 100, gfx.w, gfx.h end
-- A false in the queue is a frame boundary: getchar returns 0 there, so the
-- script's key-drain loop ends and the frame is drawn before more keys arrive.
function gfx.getchar(c)
  if #keyqueue == 0 then return 0 end
  if keyqueue[1] == false then table.remove(keyqueue, 1); return 0 end
  return table.remove(keyqueue, 1)
end
-- The menu string is recorded; the answer is whatever a test put in
-- _H.menupick (1-based, as REAPER counts), used once. 0 means dismissed.
function gfx.showmenu(s)
  _H.menu = s
  local pick = _H.menupick or 0
  _H.menupick = nil
  return pick
end
function gfx.getdropfile() return 0 end

local deferred = nil
local extstate = {}
reaper = {
  get_action_context = function() return false, SCRIPT, -1, -1, -1, -1, -1, "" end,
  GetOS = function() return "Other" end,
  GetExtState = function(s,k) return extstate[s.."/"..k] or "" end,
  SetExtState = function(s,k,v,p) extstate[s.."/"..k] = v end,
  HasExtState = function() return false end,
  ShowMessageBox = function(msg, title, t) error("MESSAGEBOX: "..msg) end,
  ShowConsoleMsg = function(m) io.write(m) end,
  atexit = function(f) end,
  defer = function(f) deferred = f end,
  time_precise = function() return clock end,
}

-- Public helpers for the test driver.
function _H.keys(list) for _,k in ipairs(list) do keyqueue[#keyqueue+1]=k end end
function _H.raw(list) for _,k in ipairs(list) do keyqueue[#keyqueue+1]=k end end
function _H.frame() keyqueue[#keyqueue+1] = false end
function _H.type(s)
  for i=1,#s do keyqueue[#keyqueue+1]=s:byte(i) end
  keyqueue[#keyqueue+1] = false
end
function _H.press(k, n)
  for _=1,(n or 1) do keyqueue[#keyqueue+1]=k; keyqueue[#keyqueue+1]=false end
end
function _H.run(maxframes)
  MAXFRAMES = maxframes or 200
  frames = 0
  drawn = {}
  placed = {}
  rects = {}
  deferred = nil
  _H.opened, _H.title, _H.faces = false, nil, {}
  local chunk = assert(loadfile(SCRIPT))
  chunk()
  local guard = 0
  while deferred and guard < (maxframes or 200) + 5 do
    local f = deferred
    deferred = nil
    f()
    guard = guard + 1
  end
  return drawn, frames
end
function _H.drawn() return drawn end
function _H.placed() return placed end
-- The last recorded position of an exact string, or nil. Frame-agnostic, so it
-- reports where the thing ended up once the view settled.
function _H.find(s)
  for i = #placed, 1, -1 do
    if placed[i].s == s then return placed[i] end
  end
end
function _H.frameno() return frames end
function _H.clear_drawn() drawn = {}; placed = {}; rects = {} end
function _H.rects() return rects end
function _H.extstate() return extstate end
function _H.setsize(w,h) gfx.w, gfx.h = w, h end
function _H.mouse(x,y,capbits) gfx.mouse_x=x; gfx.mouse_y=y; gfx.mouse_cap=capbits or 0 end
function _H.wheel(v) gfx.mouse_wheel = v end
function _H.K(s) local v=0 for i=1,#s do v=v*256+s:byte(i) end return v end

function _H.datapath() return DATA end
function _H.composerspath() return COMPOSERS end
