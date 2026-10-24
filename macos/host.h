/*
  The Mac app's core: REAPER's gfx and reaper calls, as Orchestration Helper
  uses them, around an embedded Lua. Portable C; the window, the drawing and
  the saved settings are the backend's (backend.h), so the same core runs
  under AppKit (mac.m) and under the Linux test driver (sim.c).
*/
#ifndef OH_HOST_H
#define OH_HOST_H

/* What the backend tells the core between frames. Coordinates are pixels,
   y down, as gfx has them. */
typedef struct {
  double mouse_x, mouse_y;
  int buttons;          /* 1 left, 2 right, 64 middle */
  int mods;             /* 4 Command, 8 Shift, 16 Option, 32 Control */
  double wheel;         /* accumulated, 120 a notch; the core hands it over */
  int closed;           /* the window was closed */
} host_input;

extern host_input HOST_IN;

/* Keys, as gfx.getchar returns them, with the modifiers held when pressed. */
void host_key(int code, int mods);

/* Load the script and run it to its first defer. 0 on failure (reported). */
int host_start(const char *script_path);
/* One frame: the deferred function, if any. Returns 0 once the script has
   stopped deferring (closed or failed). Safe to call while a menu is open:
   a frame already running makes it return 1 at once. */
int host_frame(void);
/* The script's atexit, then the Lua state goes. */
void host_stop(void);
int host_running(void);

#endif
