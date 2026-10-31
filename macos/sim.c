/*
  A backend with no window, for running the Mac app's core on Linux:
  fonts measured the way tests/harness.lua measures them, drawing counted
  rather than done. It drives the real script through host.c, so it checks
  the core's gfx and reaper calls, not AppKit.

    sim <script> <frames> [step ...]

  Steps, one per frame from the second on: text to type, @key for a named
  key (@down, @pgdn, @f1, @esc, @ret, @tab, @close), @click:x,y for a left
  click, @wheel:n. After the last frame it prints the strings drawn in it,
  one per line, then a summary line.
*/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "host.h"
#include "backend.h"

static int W = 760, H = 680, opened;
static char title[512];
static struct { char face[128]; double size; int flags; } fonts[256];
static int rects, polys, texts, presents, menus, clears;
static char last_frame[65536];
static char this_frame[65536];

static int slot(int s) { return s < 0 || s > 255 ? 0 : s; }

void be_window(const char *t, int w, int h, int x, int y, int retina)
{
  (void)x; (void)y; (void)retina;
  if (t && *t) snprintf(title, sizeof title, "%s", t);
  if (!opened && w > 0) { W = w; H = h; }
  opened = 1;
}
void be_size(int *w, int *h, double *scale) { *w = W; *h = H; *scale = 1; }
void be_frame(int *x, int *y, int *w, int *h) { *x = 150; *y = 110; *w = W; *h = H; }
void be_clear(double r, double g, double b) { (void)r; (void)g; (void)b; clears++; }
void be_rect(double x, double y, double w, double h, double r, double g,
             double b, double a)
{ (void)x; (void)y; (void)w; (void)h; (void)r; (void)g; (void)b; (void)a; rects++; }
void be_poly(const double *xy, int n, double r, double g, double b, double a)
{ (void)xy; (void)n; (void)r; (void)g; (void)b; (void)a; polys++; }

void be_font(int s, const char *face, double size, int flags, char *got, int n)
{
  s = slot(s);
  /* as the harness does: an unknown face becomes the system's default */
  snprintf(fonts[s].face, sizeof fonts[s].face, "%s",
           strcmp(face, "Helvetica") == 0 ? face : "DejaVu Sans");
  fonts[s].size = size;
  fonts[s].flags = flags;
  snprintf(got, n, "%s", fonts[s].face);
}
void be_font_face(int s, char *got, int n) { snprintf(got, n, "%s", fonts[slot(s)].face); }
static double fsize(int s) { return fonts[slot(s)].size > 0 ? fonts[slot(s)].size : 14; }
double be_line_height(int s) { return fsize(s) + 3; }
double be_measure(int s, const char *u)
{
  /* characters, not bytes, so "—" counts once */
  int n = 0;
  for (; *u; u++) if ((*u & 0xC0) != 0x80) n++;
  return n * fsize(s) * 0.52;
}
void be_text(int s, const char *u, double x, double y, double r, double g,
             double b, double a, int clip, double cx0, double cy0,
             double cx1, double cy1)
{
  (void)s; (void)x; (void)y; (void)r; (void)g; (void)b; (void)a; (void)clip;
  (void)cx0; (void)cy0; (void)cx1; (void)cy1;
  texts++;
  if (strlen(this_frame) + strlen(u) + 2 < sizeof this_frame) {
    strcat(this_frame, u);
    strcat(this_frame, "\n");
  }
}
void be_present(void)
{
  presents++;
  memcpy(last_frame, this_frame, sizeof last_frame);
  this_frame[0] = 0;
}
int be_menu(const char *items, double x, double y)
{
  (void)x; (void)y;
  menus++;
  fprintf(stderr, "menu: %s\n", items);
  return 2;
}
double be_time(void)
{
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec + ts.tv_nsec / 1e9;
}
void be_message(const char *t, const char *m) { fprintf(stderr, "MESSAGE %s: %s\n", t, m); }

static char keys[64][64], vals[64][256];
static int nset;
const char *be_get_setting(const char *k)
{
  int i;
  for (i = 0; i < nset; i++) if (!strcmp(keys[i], k)) return vals[i];
  return NULL;
}
void be_set_setting(const char *k, const char *v)
{
  int i;
  for (i = 0; i < nset; i++) if (!strcmp(keys[i], k)) break;
  if (i == nset) { if (nset == 64) return; nset++; }
  snprintf(keys[i], sizeof keys[i], "%s", k);
  snprintf(vals[i], sizeof vals[i], "%s", v);
}
const char *be_os_name(void) { return getenv("SIM_OS") ? getenv("SIM_OS") : "Other"; }
const char *be_resource_path(void) { return "/tmp"; }

static int packed(const char *s)
{
  int v = 0;
  for (; *s; s++) v = v * 256 + (unsigned char)*s;
  return v;
}

static void step(const char *s)
{
  if (s[0] != '@') { for (; *s; s++) host_key((unsigned char)*s, 0); return; }
  s++;
  if (!strncmp(s, "click:", 6)) {
    double x, y;
    sscanf(s + 6, "%lf,%lf", &x, &y);
    HOST_IN.mouse_x = x; HOST_IN.mouse_y = y; HOST_IN.buttons = 1;
    return;
  }
  if (!strncmp(s, "wheel:", 6)) { HOST_IN.wheel = atof(s + 6); return; }
  if (!strcmp(s, "close")) { HOST_IN.closed = 1; return; }
  if (!strcmp(s, "esc")) { host_key(27, 0); return; }
  if (!strcmp(s, "ret")) { host_key(13, 0); return; }
  if (!strcmp(s, "tab")) { host_key(9, 0); return; }
  if (!strcmp(s, "bigger")) { host_key('=', 4); return; }
  if (!strcmp(s, "right")) { host_key(packed("rght"), 0); return; }
  if (!strcmp(s, "cmdright")) { host_key(packed("rght"), 4); return; }
  host_key(packed(s), 0);
}

int main(int argc, char **argv)
{
  int frames, i, ran = 1, alive;
  if (argc < 3) { fprintf(stderr, "sim <script> <frames> [step ...]\n"); return 2; }
  frames = atoi(argv[2]);
  if (!host_start(argv[1])) return 1;
  for (i = 1; i < frames; i++) {
    if (HOST_IN.buttons) HOST_IN.buttons = 0;     /* a click lasts one frame */
    if (i + 2 < argc) step(argv[i + 2]);
    alive = host_frame();
    ran++;
    if (!alive) break;
  }
  alive = host_running();
  host_stop();
  fputs(last_frame, stdout);
  printf("== frames %d presents %d rects %d polys %d texts %d menus %d "
         "clears %d running %d title \"%s\"\n",
         ran, presents, rects, polys, texts, menus, clears, alive, title);
  for (i = 0; i < nset; i++) printf("setting %s = %s\n", keys[i], vals[i]);
  return 0;
}
