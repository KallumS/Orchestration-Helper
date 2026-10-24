/*
  What the core (host.c) needs from the system: a window, a pixel surface to
  draw on, fonts, a popup menu, a clock and somewhere to keep settings.
  mac.m implements it with AppKit, CoreGraphics and CoreText; sim.c with
  nothing at all, for testing on Linux.

  Every coordinate is in pixels with y down, as gfx has them. Colours are
  0..1 with alpha, blended over what is there.
*/
#ifndef OH_BACKEND_H
#define OH_BACKEND_H

/* Open the window (first call) or retitle it (w <= 0). Sizes are points,
   x, y the top-left corner on the screen. retina: the script asked for
   pixel-density drawing (gfx.ext_retina = 1 before gfx.init). */
void be_window(const char *title, int w, int h, int x, int y, int retina);
/* Pixel size of the surface and its density (2 on a Retina screen, 1 if
   retina was not asked for). */
void be_size(int *w, int *h, double *scale);
/* The window's frame in points, top-left origin, for gfx.dock(-1). */
void be_frame(int *x, int *y, int *w, int *h);

void be_clear(double r, double g, double b);
void be_rect(double x, double y, double w, double h,
             double r, double g, double b, double a);
void be_poly(const double *xy, int n, double r, double g, double b, double a);

/* Fonts live in numbered slots, as gfx's do. be_font defines a slot and
   writes the face the system really gave into got. */
void be_font(int slot, const char *face, double size, int flags,
             char *got, int gotlen);
void be_font_face(int slot, char *got, int gotlen);
double be_line_height(int slot);
double be_measure(int slot, const char *utf8);
/* Draws with the top-left of the line at x, y; clipped to the box when
   clip is set. */
void be_text(int slot, const char *utf8, double x, double y,
             double r, double g, double b, double a,
             int clip, double cx0, double cy0, double cx1, double cy1);

void be_present(void);

/* gfx.showmenu: REAPER's menu string, at pixel x, y. Returns the 1-based item
   or 0. Modal; the core guards against frames arriving while it is open. */
int be_menu(const char *items, double x, double y);

double be_time(void);
void be_message(const char *title, const char *msg);

/* Settings that survive a restart (REAPER's ExtState, persist = true). The
   returned string is the backend's; copy it. */
const char *be_get_setting(const char *key);
void be_set_setting(const char *key, const char *value);

const char *be_os_name(void);        /* "macOS-arm64", "OSX64", ... */
const char *be_resource_path(void);  /* a writable folder of the app's own */

#endif
