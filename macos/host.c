/*
  REAPER's gfx and reaper APIs, as much of them as Orchestration Helper uses,
  so the script and its two databases run unchanged outside REAPER.

  gfx is a plain Lua table, as the script sees it in REAPER: the script reads
  and writes gfx.x, gfx.y, gfx.r .. gfx.a, gfx.clear, gfx.mouse_wheel and
  gfx.ext_retina itself, and the core fills in w, h, the mouse and texth.
  Semantics follow REAPER's ReaScript reference; where it is silent they
  follow tests/harness.lua, which the suite has held the script to.
*/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "lua.h"
#include "lauxlib.h"
#include "lualib.h"
#include "host.h"
#include "backend.h"

host_input HOST_IN;

static lua_State *L;
static int deferred_ref = LUA_NOREF;
static int atexit_ref = LUA_NOREF;
static int in_frame;              /* a frame (or a menu inside one) is running */
static int window_open;
static int want_retina;
static int cur_font;
static int needs_clear = 1;       /* cleared lazily, with this frame's gfx.clear */
static char script_path[4096];

/* ---- the key queue -------------------------------------------------------*/

#define KEYQ 256
static struct { int code, mods; } keyq[KEYQ];
static int keyq_head, keyq_len;

void host_key(int code, int mods)
{
  if (keyq_len == KEYQ) return;
  keyq[(keyq_head + keyq_len) % KEYQ].code = code;
  keyq[(keyq_head + keyq_len) % KEYQ].mods = mods;
  keyq_len++;
}

/* ---- helpers -------------------------------------------------------------*/

static double getnum(const char *field, double dflt)
{
  double v;
  lua_getglobal(L, "gfx");
  lua_getfield(L, -1, field);
  v = lua_isnumber(L, -1) ? lua_tonumber(L, -1) : dflt;
  lua_pop(L, 2);
  return v;
}

static void setnum(const char *field, double v)
{
  lua_getglobal(L, "gfx");
  lua_pushnumber(L, v);
  lua_setfield(L, -2, field);
  lua_pop(L, 1);
}

static void setint(const char *field, lua_Integer v)
{
  lua_getglobal(L, "gfx");
  lua_pushinteger(L, v);
  lua_setfield(L, -2, field);
  lua_pop(L, 1);
}

static void colour(double *r, double *g, double *b, double *a)
{
  *r = getnum("r", 1); *g = getnum("g", 1); *b = getnum("b", 1);
  *a = getnum("a", 1);
}

/* The first drawing of a frame clears to gfx.clear as the script set it for
   this frame (REAPER clears after each gfx.update; clearing on first use
   gives the same picture and the right colour on the very first frame). */
static void clear_if_needed(void)
{
  double c;
  if (!needs_clear) return;
  needs_clear = 0;
  c = getnum("clear", 0);
  if (c >= 0) {
    long v = (long)c;
    be_clear((v & 255) / 255.0, ((v >> 8) & 255) / 255.0,
             ((v >> 16) & 255) / 255.0);
  }
}

static void refresh_size(void)
{
  int w = 0, h = 0;
  double scale = 1;
  if (!window_open) return;
  be_size(&w, &h, &scale);
  setint("w", w);
  setint("h", h);
  if (want_retina) setnum("ext_retina", scale);
}

/* ---- gfx -----------------------------------------------------------------*/

static int g_init(lua_State *l)
{
  const char *name = luaL_optstring(l, 1, "");
  int w = (int)luaL_optinteger(l, 2, 0);
  int h = (int)luaL_optinteger(l, 3, 0);
  int x = (int)luaL_optinteger(l, 5, -1);
  int y = (int)luaL_optinteger(l, 6, -1);
  if (!window_open) {
    want_retina = getnum("ext_retina", 0) > 0;
    if (w <= 0) w = 640;
    if (h <= 0) h = 480;
  }
  be_window(name, w, h, x, y, want_retina);
  window_open = 1;
  refresh_size();
  lua_pushinteger(l, 1);
  return 1;
}

static int g_set(lua_State *l)
{
  double r = luaL_checknumber(l, 1);
  double g = luaL_optnumber(l, 2, r);
  double b = luaL_optnumber(l, 3, r);
  double a = luaL_optnumber(l, 4, 1);
  setnum("r", r); setnum("g", g); setnum("b", b); setnum("a", a);
  return 0;
}

static int g_rect(lua_State *l)
{
  double x = luaL_checknumber(l, 1), y = luaL_checknumber(l, 2);
  double w = luaL_checknumber(l, 3), h = luaL_checknumber(l, 4);
  int filled = lua_isnoneornil(l, 5) ? 1 : (lua_tonumber(l, 5) != 0);
  double r, g, b, a;
  if (w <= 0 || h <= 0) return 0;
  clear_if_needed();
  colour(&r, &g, &b, &a);
  if (filled) {
    be_rect(x, y, w, h, r, g, b, a);
  } else {                                   /* a one-pixel frame inside it */
    be_rect(x, y, w, 1, r, g, b, a);
    if (h > 1) be_rect(x, y + h - 1, w, 1, r, g, b, a);
    if (h > 2) {
      be_rect(x, y + 1, 1, h - 2, r, g, b, a);
      if (w > 1) be_rect(x + w - 1, y + 1, 1, h - 2, r, g, b, a);
    }
  }
  return 0;
}

static int g_triangle(lua_State *l)
{
  double xy[64];
  int n = lua_gettop(l) / 2, i;
  double r, g, b, a;
  if (n > 32) n = 32;
  if (n < 3) return 0;
  for (i = 0; i < n * 2; i++) xy[i] = luaL_checknumber(l, i + 1);
  clear_if_needed();
  colour(&r, &g, &b, &a);
  be_poly(xy, n, r, g, b, a);
  return 0;
}

static int g_setfont(lua_State *l)
{
  int slot = (int)luaL_checkinteger(l, 1);
  char got[256];
  cur_font = slot;
  if (lua_isstring(l, 2)) {
    const char *face = lua_tostring(l, 2);
    double size = luaL_optnumber(l, 3, 14);
    int flags = (int)luaL_optinteger(l, 4, 0);
    be_font(slot, face, size, flags, got, sizeof got);
  }
  setnum("texth", be_line_height(slot));
  lua_pushinteger(l, 1);
  return 1;
}

static int g_getfont(lua_State *l)
{
  char got[256];
  be_font_face(cur_font, got, sizeof got);
  lua_pushinteger(l, cur_font);
  lua_pushstring(l, got);
  return 2;
}

static int g_measurestr(lua_State *l)
{
  const char *s = luaL_tolstring(l, 1, NULL);
  lua_pushnumber(l, be_measure(cur_font, s));
  lua_pushnumber(l, be_line_height(cur_font));
  return 2;
}

/* gfx.drawstr(str[, flags, right, bottom]): flags 1 centre across, 2 right,
   4 centre down, 8 bottom, 256 do not clip to the box. The pen moves to the
   end of what was drawn. */
static int g_drawstr(lua_State *l)
{
  int flags = (int)luaL_optinteger(l, 2, 0);
  int box = !lua_isnoneornil(l, 3) && !lua_isnoneornil(l, 4);
  double right = box ? luaL_checknumber(l, 3) : 0;
  double bottom = box ? luaL_checknumber(l, 4) : 0;
  const char *s = luaL_tolstring(l, 1, NULL);   /* pushes: read args first */
  double x0 = getnum("x", 0), y0 = getnum("y", 0);
  double w = be_measure(cur_font, s), h = be_line_height(cur_font);
  double x = x0, y = y0;
  double r, g, b, a;
  if (box) {
    if (flags & 1) x = x0 + (right - x0 - w) / 2;
    else if (flags & 2) x = right - w;
    if (flags & 4) y = y0 + (bottom - y0 - h) / 2;
    else if (flags & 8) y = bottom - h;
  }
  clear_if_needed();
  colour(&r, &g, &b, &a);
  be_text(cur_font, s, x, y, r, g, b, a,
          box && !(flags & 256), x0, y0, right, bottom);
  setnum("x", x + w);
  return 0;
}

static int g_update(lua_State *l)
{
  (void)l;
  clear_if_needed();
  be_present();
  needs_clear = 1;
  return 0;
}

static int g_getchar(lua_State *l)
{
  if (!lua_isnoneornil(l, 1)) {
    /* gfx.getchar(65536): window state. 1 = open, 2 = focused, 4 = visible */
    lua_pushinteger(l, HOST_IN.closed ? -1 : 7);
    return 1;
  }
  if (HOST_IN.closed || !window_open) { lua_pushinteger(l, -1); return 1; }
  if (keyq_len == 0) { lua_pushinteger(l, 0); return 1; }
  {
    int code = keyq[keyq_head].code, mods = keyq[keyq_head].mods;
    int btn = HOST_IN.buttons;
    keyq_head = (keyq_head + 1) % KEYQ;
    keyq_len--;
    /* the modifiers as they were when the key went down */
    setint("mouse_cap", btn | mods);
    lua_pushinteger(l, code);
  }
  return 1;
}

static int g_showmenu(lua_State *l)
{
  const char *s = luaL_checkstring(l, 1);
  int pick = be_menu(s, getnum("x", 0), getnum("y", 0));
  /* the mouse went up inside the menu; the window never heard it */
  HOST_IN.buttons = 0;
  lua_pushinteger(l, pick);
  return 1;
}

static int g_dock(lua_State *l)
{
  int x = 0, y = 0, w = 0, h = 0;
  be_frame(&x, &y, &w, &h);
  lua_pushinteger(l, 0);
  lua_pushinteger(l, x);
  lua_pushinteger(l, y);
  lua_pushinteger(l, w);
  lua_pushinteger(l, h);
  return 5;
}

static int g_quit(lua_State *l) { (void)l; return 0; }

/* ---- reaper --------------------------------------------------------------*/

static int r_defer(lua_State *l)
{
  luaL_checktype(l, 1, LUA_TFUNCTION);
  luaL_unref(l, LUA_REGISTRYINDEX, deferred_ref);
  lua_pushvalue(l, 1);
  deferred_ref = luaL_ref(l, LUA_REGISTRYINDEX);
  return 0;
}

static int r_atexit(lua_State *l)
{
  luaL_checktype(l, 1, LUA_TFUNCTION);
  luaL_unref(l, LUA_REGISTRYINDEX, atexit_ref);
  lua_pushvalue(l, 1);
  atexit_ref = luaL_ref(l, LUA_REGISTRYINDEX);
  return 0;
}

static int r_get_action_context(lua_State *l)
{
  lua_pushboolean(l, 0);
  lua_pushstring(l, script_path);
  lua_pushinteger(l, -1); lua_pushinteger(l, -1); lua_pushinteger(l, -1);
  lua_pushinteger(l, -1); lua_pushinteger(l, -1);
  lua_pushstring(l, "");
  return 8;
}

static void extkey(lua_State *l, char *buf, size_t n)
{
  snprintf(buf, n, "%s/%s", luaL_checkstring(l, 1), luaL_checkstring(l, 2));
}

static int r_getextstate(lua_State *l)
{
  char key[512];
  const char *v;
  extkey(l, key, sizeof key);
  v = be_get_setting(key);
  lua_pushstring(l, v ? v : "");
  return 1;
}

static int r_setextstate(lua_State *l)
{
  char key[512];
  extkey(l, key, sizeof key);
  be_set_setting(key, luaL_checkstring(l, 3));
  return 0;
}

static int r_hasextstate(lua_State *l)
{
  char key[512];
  const char *v;
  extkey(l, key, sizeof key);
  v = be_get_setting(key);
  lua_pushboolean(l, v && *v);
  return 1;
}

static int r_showmessagebox(lua_State *l)
{
  be_message(luaL_optstring(l, 2, "Orchestration Helper"),
             luaL_checkstring(l, 1));
  lua_pushinteger(l, 1);
  return 1;
}

static int r_showconsolemsg(lua_State *l)
{
  fputs(luaL_checkstring(l, 1), stderr);
  return 0;
}

static int r_time_precise(lua_State *l) { lua_pushnumber(l, be_time()); return 1; }
static int r_getos(lua_State *l) { lua_pushstring(l, be_os_name()); return 1; }
static int r_getresourcepath(lua_State *l)
{
  lua_pushstring(l, be_resource_path());
  return 1;
}

/* ---- running it ----------------------------------------------------------*/

static int traceback(lua_State *l)
{
  luaL_traceback(l, l, luaL_tolstring(l, 1, NULL), 1);
  return 1;
}

static int call_protected(int nargs)
{
  int base = lua_gettop(L) - nargs;
  int rc;
  lua_pushcfunction(L, traceback);
  lua_insert(L, base);
  rc = lua_pcall(L, nargs, 0, base);
  lua_remove(L, base);
  if (rc != LUA_OK) {
    be_message("Orchestration Helper stopped",
               lua_tostring(L, -1) ? lua_tostring(L, -1) : "Unknown error.");
    lua_pop(L, 1);
    return 0;
  }
  return 1;
}

static void push_input(void)
{
  refresh_size();
  setnum("mouse_x", HOST_IN.mouse_x);
  setnum("mouse_y", HOST_IN.mouse_y);
  setint("mouse_cap", HOST_IN.buttons | HOST_IN.mods);
  if (HOST_IN.wheel != 0) {
    setnum("mouse_wheel", getnum("mouse_wheel", 0) + HOST_IN.wheel);
    HOST_IN.wheel = 0;
  }
}

int host_start(const char *path)
{
  static const luaL_Reg gfx_fns[] = {
    {"init", g_init}, {"set", g_set}, {"rect", g_rect},
    {"triangle", g_triangle}, {"setfont", g_setfont}, {"getfont", g_getfont},
    {"measurestr", g_measurestr}, {"drawstr", g_drawstr},
    {"update", g_update}, {"getchar", g_getchar}, {"showmenu", g_showmenu},
    {"dock", g_dock}, {"quit", g_quit}, {NULL, NULL}
  };
  static const luaL_Reg reaper_fns[] = {
    {"defer", r_defer}, {"atexit", r_atexit},
    {"get_action_context", r_get_action_context},
    {"GetExtState", r_getextstate}, {"SetExtState", r_setextstate},
    {"HasExtState", r_hasextstate}, {"ShowMessageBox", r_showmessagebox},
    {"ShowConsoleMsg", r_showconsolemsg}, {"time_precise", r_time_precise},
    {"GetOS", r_getos}, {"GetResourcePath", r_getresourcepath},
    {NULL, NULL}
  };

  snprintf(script_path, sizeof script_path, "%s", path);
  L = luaL_newstate();
  luaL_openlibs(L);

  luaL_newlib(L, gfx_fns);
  lua_pushnumber(L, 1); lua_setfield(L, -2, "r");
  lua_pushnumber(L, 1); lua_setfield(L, -2, "g");
  lua_pushnumber(L, 1); lua_setfield(L, -2, "b");
  lua_pushnumber(L, 1); lua_setfield(L, -2, "a");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "x");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "y");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "w");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "h");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "clear");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "mouse_x");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "mouse_y");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "mouse_cap");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "mouse_wheel");
  lua_pushinteger(L, 0); lua_setfield(L, -2, "ext_retina");
  lua_pushinteger(L, 14); lua_setfield(L, -2, "texth");
  lua_setglobal(L, "gfx");

  luaL_newlib(L, reaper_fns);
  lua_setglobal(L, "reaper");

  if (luaL_loadfile(L, path) != LUA_OK) {
    be_message("Orchestration Helper couldn’t start",
               lua_tostring(L, -1));
    lua_pop(L, 1);
    return 0;
  }
  in_frame = 1;
  if (!call_protected(0)) { in_frame = 0; return 0; }
  in_frame = 0;
  return 1;
}

int host_running(void) { return L && deferred_ref != LUA_NOREF; }

int host_frame(void)
{
  int fn;
  if (!L) return 0;
  if (in_frame) return 1;
  if (deferred_ref == LUA_NOREF) return 0;
  fn = deferred_ref;
  deferred_ref = LUA_NOREF;
  in_frame = 1;
  push_input();
  lua_rawgeti(L, LUA_REGISTRYINDEX, fn);
  luaL_unref(L, LUA_REGISTRYINDEX, fn);
  if (!call_protected(0)) luaL_unref(L, LUA_REGISTRYINDEX, deferred_ref),
                          deferred_ref = LUA_NOREF;
  in_frame = 0;
  return deferred_ref != LUA_NOREF;
}

void host_stop(void)
{
  if (!L) return;
  if (atexit_ref != LUA_NOREF) {
    lua_rawgeti(L, LUA_REGISTRYINDEX, atexit_ref);
    luaL_unref(L, LUA_REGISTRYINDEX, atexit_ref);
    atexit_ref = LUA_NOREF;
    call_protected(0);
  }
  lua_close(L);
  L = NULL;
  deferred_ref = LUA_NOREF;
}
