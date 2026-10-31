/*
  Orchestration Helper as a Mac app: the AppKit side of backend.h.

  The script draws a frame at a time into a pixel buffer (a CoreGraphics
  bitmap at the screen's density); gfx.update hands a snapshot of it to the
  view. Text is CoreText, in the system face when the script asks for it.
  A timer runs the script's deferred function thirty times a second, as
  REAPER does. Settings go to the app's own preferences (NSUserDefaults).
*/
#import <Cocoa/Cocoa.h>
#import <CoreText/CoreText.h>
#include <ctype.h>
#include "host.h"
#include "backend.h"

static NSWindow *win;
static NSView *view;
static CGContextRef bmp;
static CGImageRef shown;           /* the last finished frame */
static int bmp_w, bmp_h;
static double bmp_scale = 1;
static int retina_ok;
static int frame_cache[4] = { 150, 110, 760, 680 };
static double clear_rgb[3];
static int fresh_buttons, release_buttons;
static int stopped;

static struct {
  CTFontRef font;
  double ascent, height;
  char face[128];
} fonts[256];

static int fslot(int s) { return s < 0 || s > 255 ? 0 : s; }

static int packed(const char *s)
{
  int v = 0;
  for (; *s; s++) v = v * 256 + (unsigned char)*s;
  return v;
}

static int mods_of(NSEventModifierFlags f)
{
  int m = 0;
  if (f & NSEventModifierFlagCommand) m |= 4;
  if (f & NSEventModifierFlagShift) m |= 8;
  if (f & NSEventModifierFlagOption) m |= 16;
  if (f & NSEventModifierFlagControl) m |= 32;
  return m;
}

/* ---- the view ------------------------------------------------------------*/

@interface OHView : NSView
@end

@implementation OHView
- (BOOL)isFlipped { return YES; }
- (BOOL)acceptsFirstResponder { return YES; }
- (BOOL)acceptsFirstMouse:(NSEvent *)e { (void)e; return YES; }
- (BOOL)isOpaque { return YES; }

- (void)drawRect:(NSRect)dirty
{
  (void)dirty;
  [[NSColor colorWithSRGBRed:clear_rgb[0] green:clear_rgb[1] blue:clear_rgb[2]
                       alpha:1] setFill];
  NSRectFill(self.bounds);
  if (!shown) return;
  NSSize sz = NSMakeSize(CGImageGetWidth(shown) / bmp_scale,
                         CGImageGetHeight(shown) / bmp_scale);
  NSImage *img = [[NSImage alloc] initWithCGImage:shown size:sz];
  [img drawInRect:NSMakeRect(0, 0, sz.width, sz.height)
         fromRect:NSZeroRect
        operation:NSCompositingOperationCopy
         fraction:1
   respectFlipped:YES
            hints:@{ NSImageHintInterpolation : @(NSImageInterpolationNone) }];
}

- (void)updateTrackingAreas
{
  for (NSTrackingArea *t in [self.trackingAreas copy]) [self removeTrackingArea:t];
  [self addTrackingArea:[[NSTrackingArea alloc]
      initWithRect:self.bounds
           options:NSTrackingMouseMoved | NSTrackingMouseEnteredAndExited |
                   NSTrackingActiveInKeyWindow | NSTrackingInVisibleRect
             owner:self userInfo:nil]];
  [super updateTrackingAreas];
}

- (void)track:(NSEvent *)e
{
  NSPoint p = [self convertPoint:e.locationInWindow fromView:nil];
  HOST_IN.mouse_x = floor(p.x * bmp_scale);
  HOST_IN.mouse_y = floor(p.y * bmp_scale);
  HOST_IN.mods = mods_of(e.modifierFlags);
}

/* A click can come and go between two frames; the button then stays down
   until a frame has seen it. */
- (void)press:(NSEvent *)e bit:(int)b
{
  [self track:e];
  HOST_IN.buttons |= b;
  fresh_buttons |= b;
}
- (void)release:(NSEvent *)e bit:(int)b
{
  [self track:e];
  if (fresh_buttons & b) release_buttons |= b;
  else HOST_IN.buttons &= ~b;
}

- (void)mouseDown:(NSEvent *)e { [self press:e bit:1]; }
- (void)mouseUp:(NSEvent *)e { [self release:e bit:1]; }
- (void)rightMouseDown:(NSEvent *)e { [self press:e bit:2]; }
- (void)rightMouseUp:(NSEvent *)e { [self release:e bit:2]; }
- (void)otherMouseDown:(NSEvent *)e { [self press:e bit:64]; }
- (void)otherMouseUp:(NSEvent *)e { [self release:e bit:64]; }
- (void)mouseMoved:(NSEvent *)e { [self track:e]; }
- (void)mouseDragged:(NSEvent *)e { [self track:e]; }
- (void)rightMouseDragged:(NSEvent *)e { [self track:e]; }
- (void)otherMouseDragged:(NSEvent *)e { [self track:e]; }
- (void)mouseExited:(NSEvent *)e
{
  (void)e;
  if (!HOST_IN.buttons) HOST_IN.mouse_x = HOST_IN.mouse_y = -10000;
}

- (void)scrollWheel:(NSEvent *)e
{
  /* gfx counts 120 a notch and the script scrolls 64 points a notch, so a
     trackpad's points become 120/64 of a notch each */
  double dy = e.scrollingDeltaY;
  HOST_IN.wheel += e.hasPreciseScrollingDeltas ? dy * 120.0 / 64.0 : dy * 120.0;
}

- (void)flagsChanged:(NSEvent *)e { HOST_IN.mods = mods_of(e.modifierFlags); }

- (void)keyDown:(NSEvent *)e
{
  int mods = mods_of(e.modifierFlags);
  NSString *bare = e.charactersIgnoringModifiers;
  unichar c = bare.length ? [bare characterAtIndex:0] : 0;
  int code = 0;
  HOST_IN.mods = mods;
  switch (c) {
    case NSUpArrowFunctionKey:    code = packed("up"); break;
    case NSDownArrowFunctionKey:  code = packed("down"); break;
    case NSLeftArrowFunctionKey:  code = packed("left"); break;
    case NSRightArrowFunctionKey: code = packed("rght"); break;
    case NSPageUpFunctionKey:     code = packed("pgup"); break;
    case NSPageDownFunctionKey:   code = packed("pgdn"); break;
    case NSHomeFunctionKey:       code = packed("home"); break;
    case NSEndFunctionKey:        code = packed("end"); break;
    case NSInsertFunctionKey:     code = packed("ins"); break;
    case NSDeleteFunctionKey:     code = packed("del"); break;
    case 0x7F: case 0x08:         code = 8; break;     /* Delete (backspace) */
    case 0x0D: case 0x03:         code = 13; break;    /* Return, Enter */
    case 0x09: case 0x19:         code = 9; break;     /* Tab, Shift+Tab */
    case 0x1B:                    code = 27; break;
    default:
      if (c >= NSF1FunctionKey && c <= NSF12FunctionKey) {
        char name[8];
        snprintf(name, sizeof name, "f%d", c - NSF1FunctionKey + 1);
        code = packed(name);
      }
  }
  if (code) { host_key(code, mods); return; }

  if (mods & (4 | 32)) {
    /* Command or Control: letters arrive as 1..26, as REAPER gives Ctrl+A */
    unichar l = (unichar)tolower(c);
    if (l >= 'a' && l <= 'z') host_key(l - 'a' + 1, mods);
    else if (c) host_key(c, mods);
    return;
  }

  NSString *typed = e.characters;
  NSUInteger i = 0;
  while (i < typed.length) {
    NSRange r = [typed rangeOfComposedCharacterSequenceAtIndex:i];
    UTF32Char cp = 0;
    [typed getBytes:&cp maxLength:4 usedLength:NULL encoding:NSUTF32LittleEndianStringEncoding
            options:0 range:r remainingRange:NULL];
    if (cp >= 32 && cp < 127) host_key((int)cp, mods);
    else if (cp >= 160) host_key(0x75000000 + (int)cp, mods);   /* 'u' + code point */
    i = NSMaxRange(r);
  }
}
@end

/* ---- the surface ---------------------------------------------------------*/

static void ensure_bitmap(void)
{
  if (!view) return;
  double scale = retina_ok ? win.backingScaleFactor : 1;
  if (scale < 1) scale = 1;
  NSSize sz = view.bounds.size;
  int w = (int)lround(sz.width * scale), h = (int)lround(sz.height * scale);
  if (w < 1) w = 1;
  if (h < 1) h = 1;
  if (bmp && w == bmp_w && h == bmp_h && scale == bmp_scale) return;
  if (bmp) CGContextRelease(bmp);
  CGColorSpaceRef cs = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  bmp = CGBitmapContextCreate(NULL, w, h, 8, 0, cs,
                              kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Host);
  CGColorSpaceRelease(cs);
  bmp_w = w; bmp_h = h; bmp_scale = scale;
  CGContextTranslateCTM(bmp, 0, h);          /* y down, as gfx has it */
  CGContextScaleCTM(bmp, 1, -1);
  CGContextSetShouldAntialias(bmp, true);
  CGContextSetTextMatrix(bmp, CGAffineTransformMakeScale(1, -1));
}

static void fill(double r, double g, double b, double a)
{
  CGColorRef c = CGColorCreateSRGB(r, g, b, a);
  CGContextSetFillColorWithColor(bmp, c);
  CGColorRelease(c);
}

void be_clear(double r, double g, double b)
{
  ensure_bitmap();
  clear_rgb[0] = r; clear_rgb[1] = g; clear_rgb[2] = b;
  CGContextSaveGState(bmp);
  CGContextSetBlendMode(bmp, kCGBlendModeCopy);
  fill(r, g, b, 1);
  CGContextFillRect(bmp, CGRectMake(0, 0, bmp_w, bmp_h));
  CGContextRestoreGState(bmp);
}

void be_rect(double x, double y, double w, double h,
             double r, double g, double b, double a)
{
  ensure_bitmap();
  fill(r, g, b, a);
  CGContextFillRect(bmp, CGRectMake(x, y, w, h));
}

void be_poly(const double *xy, int n, double r, double g, double b, double a)
{
  ensure_bitmap();
  fill(r, g, b, a);
  CGContextBeginPath(bmp);
  CGContextMoveToPoint(bmp, xy[0], xy[1]);
  for (int i = 1; i < n; i++) CGContextAddLineToPoint(bmp, xy[i * 2], xy[i * 2 + 1]);
  CGContextClosePath(bmp);
  CGContextFillPath(bmp);
}

void be_present(void)
{
  if (!bmp) return;
  if (shown) CGImageRelease(shown);
  shown = CGBitmapContextCreateImage(bmp);
  [view setNeedsDisplay:YES];
}

/* ---- fonts ---------------------------------------------------------------*/

static int has_flag(int flags, char f)
{
  for (; flags; flags >>= 8) if ((flags & 255) == f) return 1;
  return 0;
}

void be_font(int slot, const char *face, double size, int flags,
             char *got, int gotlen)
{
  slot = fslot(slot);
  if (size < 1) size = 1;
  if (fonts[slot].font) CFRelease(fonts[slot].font);
  NSString *name = [NSString stringWithUTF8String:face ? face : ""];
  NSString *lc = name.lowercaseString;
  int bold = has_flag(flags, 'b'), italic = has_flag(flags, 'i');
  CTFontRef font;
  if (lc.length == 0 || [lc isEqualToString:@".applesystemuifont"] ||
      [lc isEqualToString:@"system"] || [lc hasPrefix:@"sf pro"]) {
    NSFont *nf = [NSFont systemFontOfSize:size
                                   weight:bold ? NSFontWeightBold : NSFontWeightRegular];
    font = (CTFontRef)CFBridgingRetain(nf);
  } else {
    font = CTFontCreateWithName((__bridge CFStringRef)name, size, NULL);
    if (bold) {
      CTFontRef b = CTFontCreateCopyWithSymbolicTraits(font, 0, NULL,
                        kCTFontBoldTrait, kCTFontBoldTrait);
      if (b) { CFRelease(font); font = b; }
    }
  }
  if (italic) {
    CTFontRef i = CTFontCreateCopyWithSymbolicTraits(font, 0, NULL,
                      kCTFontItalicTrait, kCTFontItalicTrait);
    if (i) { CFRelease(font); font = i; }
  }
  fonts[slot].font = font;
  fonts[slot].ascent = CTFontGetAscent(font);
  fonts[slot].height = ceil(CTFontGetAscent(font) + CTFontGetDescent(font) +
                            CTFontGetLeading(font));
  NSString *family = CFBridgingRelease(CTFontCopyFamilyName(font));
  snprintf(fonts[slot].face, sizeof fonts[slot].face, "%s",
           family.UTF8String ? family.UTF8String : "");
  snprintf(got, gotlen, "%s", fonts[slot].face);
}

static CTFontRef font_at(int slot)
{
  slot = fslot(slot);
  if (!fonts[slot].font) {
    char got[128];
    be_font(slot, ".AppleSystemUIFont", 13, 0, got, sizeof got);
  }
  return fonts[slot].font;
}

void be_font_face(int slot, char *got, int gotlen)
{
  font_at(slot);
  snprintf(got, gotlen, "%s", fonts[fslot(slot)].face);
}

double be_line_height(int slot) { font_at(slot); return fonts[fslot(slot)].height; }

static CTLineRef make_line(int slot, const char *utf8, CGColorRef colour)
{
  NSString *s = [NSString stringWithUTF8String:utf8];
  if (!s) s = [NSString stringWithCString:utf8 encoding:NSMacOSRomanStringEncoding];
  if (!s) s = @"";
  NSMutableDictionary *attrs = [NSMutableDictionary dictionary];
  attrs[(__bridge NSString *)kCTFontAttributeName] = (__bridge id)font_at(slot);
  if (colour) attrs[(__bridge NSString *)kCTForegroundColorAttributeName] = (__bridge id)colour;
  NSAttributedString *as = [[NSAttributedString alloc] initWithString:s attributes:attrs];
  return CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)as);
}

double be_measure(int slot, const char *utf8)
{
  CTLineRef line = make_line(slot, utf8, NULL);
  double w = CTLineGetTypographicBounds(line, NULL, NULL, NULL);
  CFRelease(line);
  return ceil(w);
}

void be_text(int slot, const char *utf8, double x, double y,
             double r, double g, double b, double a,
             int clip, double cx0, double cy0, double cx1, double cy1)
{
  ensure_bitmap();
  CGColorRef c = CGColorCreateSRGB(r, g, b, a);
  CTLineRef line = make_line(slot, utf8, c);
  CGColorRelease(c);
  CGContextSaveGState(bmp);
  if (clip) CGContextClipToRect(bmp, CGRectMake(cx0, cy0, cx1 - cx0, cy1 - cy0));
  CGContextSetTextMatrix(bmp, CGAffineTransformMakeScale(1, -1));
  CGContextSetTextPosition(bmp, x, y + fonts[fslot(slot)].ascent);
  CTLineDraw(line, bmp);
  CGContextRestoreGState(bmp);
  CFRelease(line);
}

/* ---- the window ----------------------------------------------------------*/

@interface OHApp : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property NSInteger picked;
@end

static double primary_height(void)
{
  NSArray *screens = [NSScreen screens];
  return screens.count ? [screens[0] frame].size.height : 900;
}

static void cache_frame(void)
{
  if (!win) return;
  NSRect fr = win.frame;
  NSRect content = [win contentRectForFrameRect:fr];
  frame_cache[0] = (int)lround(fr.origin.x);
  frame_cache[1] = (int)lround(primary_height() - (fr.origin.y + fr.size.height));
  frame_cache[2] = (int)lround(content.size.width);
  frame_cache[3] = (int)lround(content.size.height);
}

void be_window(const char *title, int w, int h, int x, int y, int retina)
{
  NSString *t = [NSString stringWithUTF8String:title ? title : ""];
  if (!win) {
    retina_ok = retina;
    win = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, w, h)
                  styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                            NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
                    backing:NSBackingStoreBuffered
                      defer:NO];
    win.releasedWhenClosed = NO;
    win.tabbingMode = NSWindowTabbingModeDisallowed;
    win.contentMinSize = NSMakeSize(400, 300);
    win.collectionBehavior = NSWindowCollectionBehaviorFullScreenPrimary;
    win.delegate = (id<NSWindowDelegate>)NSApp.delegate;
    view = [[OHView alloc] initWithFrame:NSMakeRect(0, 0, w, h)];
    win.contentView = view;
    win.acceptsMouseMovedEvents = YES;

    /* x, y is the top-left corner; keep it only if it is on a screen */
    BOOL placed = NO;
    if (x >= 0 && y >= 0) {
      NSRect fr = win.frame;
      fr.origin.x = x;
      fr.origin.y = primary_height() - y - fr.size.height;
      for (NSScreen *s in [NSScreen screens]) {
        if (NSIntersectsRect(NSInsetRect(s.visibleFrame, 40, 40), fr)) {
          [win setFrame:fr display:NO];
          placed = YES;
          break;
        }
      }
    }
    if (!placed) [win center];
    [win makeKeyAndOrderFront:nil];
    [win makeFirstResponder:view];
    ensure_bitmap();
    cache_frame();
  }
  if (t.length) win.title = t;
}

void be_size(int *w, int *h, double *scale)
{
  ensure_bitmap();
  *w = bmp_w; *h = bmp_h; *scale = bmp_scale;
}

void be_frame(int *x, int *y, int *w, int *h)
{
  if (win && win.visible) cache_frame();
  *x = frame_cache[0]; *y = frame_cache[1];
  *w = frame_cache[2]; *h = frame_cache[3];
}

/* ---- the popup menu ------------------------------------------------------*/

int be_menu(const char *items, double x, double y)
{
  OHApp *app = (OHApp *)NSApp.delegate;
  NSMenu *root = [[NSMenu alloc] initWithTitle:@""];
  NSMutableArray *stack = [NSMutableArray arrayWithObject:root];
  NSInteger n = 0;
  root.autoenablesItems = NO;
  app.picked = 0;

  NSString *all = [NSString stringWithUTF8String:items] ?: @"";
  for (NSString *field in [all componentsSeparatedByString:@"|"]) {
    NSMenu *menu = stack.lastObject;
    if (field.length == 0) { [menu addItem:[NSMenuItem separatorItem]]; continue; }
    BOOL grey = NO, check = NO, sub = NO, last = NO;
    NSUInteger i = 0;
    for (; i < field.length; i++) {
      unichar c = [field characterAtIndex:i];
      if (c == '#') grey = YES;
      else if (c == '!') check = YES;
      else if (c == '>') sub = YES;
      else if (c == '<') last = YES;
      else break;
    }
    NSString *label = [field substringFromIndex:i];
    NSMenuItem *it = [[NSMenuItem alloc] initWithTitle:label action:NULL keyEquivalent:@""];
    it.enabled = !grey;
    it.state = check ? NSControlStateValueOn : NSControlStateValueOff;
    [menu addItem:it];
    if (sub) {
      NSMenu *m = [[NSMenu alloc] initWithTitle:label];
      m.autoenablesItems = NO;
      it.submenu = m;
      [stack addObject:m];
    } else {
      it.tag = ++n;
      it.target = app;
      it.action = @selector(pick:);
    }
    if (last && stack.count > 1) [stack removeLastObject];
  }
  [root popUpMenuPositioningItem:nil
                      atLocation:NSMakePoint(x / bmp_scale, y / bmp_scale)
                          inView:view];
  return (int)app.picked;
}

/* ---- the rest of backend.h -----------------------------------------------*/

double be_time(void) { return [NSProcessInfo processInfo].systemUptime; }

void be_message(const char *title, const char *msg)
{
  NSAlert *a = [[NSAlert alloc] init];
  a.messageText = [NSString stringWithUTF8String:title ? title : ""] ?: @"";
  a.informativeText = [NSString stringWithUTF8String:msg ? msg : ""] ?: @"";
  [a addButtonWithTitle:@"OK"];
  [a runModal];
}

const char *be_get_setting(const char *key)
{
  static char buf[4096];
  NSString *v = [[NSUserDefaults standardUserDefaults]
                    stringForKey:[NSString stringWithUTF8String:key]];
  if (!v) return NULL;
  snprintf(buf, sizeof buf, "%s", v.UTF8String);
  return buf;
}

void be_set_setting(const char *key, const char *value)
{
  [[NSUserDefaults standardUserDefaults]
      setObject:[NSString stringWithUTF8String:value] ?: @""
         forKey:[NSString stringWithUTF8String:key]];
}

const char *be_os_name(void)
{
#if defined(__arm64__) || defined(__aarch64__)
  return "macOS-arm64";
#else
  return "OSX64";
#endif
}

const char *be_resource_path(void)
{
  static char buf[2048];
  NSURL *u = [[NSFileManager defaultManager] URLForDirectory:NSApplicationSupportDirectory
      inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:nil];
  u = [u URLByAppendingPathComponent:@"Orchestration Helper"];
  [[NSFileManager defaultManager] createDirectoryAtURL:u
      withIntermediateDirectories:YES attributes:nil error:nil];
  snprintf(buf, sizeof buf, "%s", u.path.UTF8String ?: "/tmp");
  return buf;
}

/* ---- the application -----------------------------------------------------*/

@implementation OHApp {
  NSTimer *timer;
}

- (void)pick:(NSMenuItem *)it { self.picked = it.tag; }

- (void)finish
{
  if (stopped) return;
  stopped = 1;
  [timer invalidate];
  cache_frame();
  host_stop();
}

- (void)tick:(NSTimer *)t
{
  (void)t;
  if (stopped) return;
  int alive = host_frame();
  fresh_buttons = 0;
  HOST_IN.buttons &= ~release_buttons;
  release_buttons = 0;
  if (!alive && host_running() == 0) {
    [self finish];
    [NSApp terminate:nil];
  }
}

- (void)applicationDidFinishLaunching:(NSNotification *)n
{
  (void)n;
  NSString *script = [[NSBundle mainBundle] pathForResource:@"Orchestration Helper"
                                                     ofType:@"lua"];
  HOST_IN.mouse_x = HOST_IN.mouse_y = -10000;
  if (!script || !host_start(script.fileSystemRepresentation) || !host_running()) {
    stopped = 1;
    [NSApp terminate:nil];
    return;
  }
  timer = [NSTimer timerWithTimeInterval:1.0 / 30 target:self selector:@selector(tick:)
                                userInfo:nil repeats:YES];
  [[NSRunLoop currentRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
  [NSApp activateIgnoringOtherApps:YES];
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)a
{
  (void)a;
  if (!stopped) {
    /* let the script see its window go, so it saves where it was */
    cache_frame();
    HOST_IN.closed = 1;
    host_frame();
    [self finish];
  }
  return NSTerminateNow;
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)a
{
  (void)a;
  return YES;
}

- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)a
{
  (void)a;
  return YES;
}

- (BOOL)windowShouldClose:(NSWindow *)w
{
  (void)w;
  cache_frame();
  HOST_IN.closed = 1;
  return YES;
}

/* Menu commands that are the script's own keys, so the menu bar and the
   keyboard do one thing. */
- (void)bigger:(id)s { (void)s; host_key('=', 4); }
- (void)smaller:(id)s { (void)s; host_key('-', 4); }
- (void)actual:(id)s { (void)s; host_key('0', 4); }
- (void)showHelp:(id)s { (void)s; host_key(packed("f1"), 0); }
- (void)paste:(id)s
{
  (void)s;
  NSString *t = [[NSPasteboard generalPasteboard] stringForType:NSPasteboardTypeString];
  for (NSUInteger i = 0; i < t.length && i < 200; i++) {
    unichar c = [t characterAtIndex:i];
    if (c >= 32 && c < 127) host_key(c, 0);
  }
}
@end

static NSMenuItem *item(NSMenu *m, NSString *title, SEL action, NSString *key,
                        NSEventModifierFlags mods, id target)
{
  NSMenuItem *it = [m addItemWithTitle:title action:action keyEquivalent:key];
  it.keyEquivalentModifierMask = mods;
  if (target) it.target = target;
  return it;
}

static NSMenu *submenu(NSMenu *bar, NSString *title)
{
  NSMenuItem *top = [bar addItemWithTitle:title action:NULL keyEquivalent:@""];
  NSMenu *m = [[NSMenu alloc] initWithTitle:title];
  top.submenu = m;
  return m;
}

static void build_menus(OHApp *app)
{
  NSEventModifierFlags cmd = NSEventModifierFlagCommand;
  NSMenu *bar = [[NSMenu alloc] init];
  NSString *name = @"Orchestration Helper";

  NSMenu *appm = submenu(bar, name);
  item(appm, [@"About " stringByAppendingString:name],
       @selector(orderFrontStandardAboutPanel:), @"", 0, nil);
  [appm addItem:[NSMenuItem separatorItem]];
  item(appm, [@"Hide " stringByAppendingString:name], @selector(hide:), @"h", cmd, nil);
  item(appm, @"Hide Others", @selector(hideOtherApplications:), @"h",
       cmd | NSEventModifierFlagOption, nil);
  item(appm, @"Show All", @selector(unhideAllApplications:), @"", 0, nil);
  [appm addItem:[NSMenuItem separatorItem]];
  item(appm, [@"Quit " stringByAppendingString:name], @selector(terminate:), @"q", cmd, nil);

  NSMenu *edit = submenu(bar, @"Edit");
  item(edit, @"Paste", @selector(paste:), @"v", cmd, app);

  NSMenu *v = submenu(bar, @"View");
  item(v, @"Bigger Text", @selector(bigger:), @"=", cmd, app);
  item(v, @"Smaller Text", @selector(smaller:), @"-", cmd, app);
  item(v, @"Actual Size", @selector(actual:), @"0", cmd, app);
  [v addItem:[NSMenuItem separatorItem]];

  NSMenu *w = submenu(bar, @"Window");
  item(w, @"Minimize", @selector(performMiniaturize:), @"m", cmd, nil);
  item(w, @"Zoom", @selector(performZoom:), @"", 0, nil);
  [w addItem:[NSMenuItem separatorItem]];
  item(w, @"Close", @selector(performClose:), @"w", cmd, nil);
  NSApp.windowsMenu = w;

  NSMenu *h = submenu(bar, @"Help");
  item(h, [name stringByAppendingString:@" Help"], @selector(showHelp:), @"?", cmd, app);
  NSApp.helpMenu = h;

  NSApp.mainMenu = bar;
}

int main(int argc, const char **argv)
{
  (void)argc; (void)argv;
  @autoreleasepool {
    NSApplication *app = [NSApplication sharedApplication];
    OHApp *d = [[OHApp alloc] init];
    app.activationPolicy = NSApplicationActivationPolicyRegular;
    app.delegate = d;
    build_menus(d);
    [app run];
  }
  return 0;
}
