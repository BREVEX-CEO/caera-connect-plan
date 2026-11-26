"""A tiny X11 app for the Linux bridge tests: one checkered window that records what reaches it.

No toolkit is needed: Xlib through ctypes, like the bridge. Every key press and every click is
appended to the log file named on the command line, so a test checks the effect on disk, not
the bridge's own report. A click also paints a red square, so the window's picture changes.
"""

import ctypes
import ctypes.util
import os
import sys

TITLE = b"OCADE X11 Fixture"
WIDTH, HEIGHT = 320, 220


class XKey(ctypes.Structure):
    _fields_ = [("type", ctypes.c_int), ("serial", ctypes.c_ulong), ("send_event", ctypes.c_int),
                ("display", ctypes.c_void_p), ("window", ctypes.c_ulong), ("root", ctypes.c_ulong),
                ("subwindow", ctypes.c_ulong), ("time", ctypes.c_ulong), ("x", ctypes.c_int),
                ("y", ctypes.c_int), ("x_root", ctypes.c_int), ("y_root", ctypes.c_int),
                ("state", ctypes.c_uint), ("detail", ctypes.c_uint), ("same_screen", ctypes.c_int)]


class XEvent(ctypes.Union):
    _fields_ = [("type", ctypes.c_int), ("key", XKey), ("pad", ctypes.c_long * 24)]


def main(log_path: str) -> None:
    x = ctypes.CDLL(ctypes.util.find_library("X11"))
    x.XOpenDisplay.restype = ctypes.c_void_p
    x.XCreateSimpleWindow.restype = ctypes.c_ulong
    x.XCreateSimpleWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_uint,
                                      ctypes.c_uint, ctypes.c_uint, ctypes.c_ulong, ctypes.c_ulong]
    x.XDefaultRootWindow.restype = ctypes.c_ulong
    x.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    x.XCreateGC.restype = ctypes.c_void_p
    x.XCreateGC.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p]
    x.XSetForeground.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong]
    x.XFillRectangle.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_int, ctypes.c_int,
                                 ctypes.c_uint, ctypes.c_uint]
    x.XInternAtom.restype = ctypes.c_ulong
    x.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
    x.XChangeProperty.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_int,
                                  ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
    x.XSelectInput.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_long]
    x.XMapWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    x.XNextEvent.argtypes = [ctypes.c_void_p, ctypes.POINTER(XEvent)]
    x.XLookupString.argtypes = [ctypes.POINTER(XKey), ctypes.c_char_p, ctypes.c_int,
                                ctypes.POINTER(ctypes.c_ulong), ctypes.c_void_p]
    x.XKeysymToString.restype = ctypes.c_char_p
    x.XKeysymToString.argtypes = [ctypes.c_ulong]
    x.XFlush.argtypes = [ctypes.c_void_p]

    display = x.XOpenDisplay(None)
    root = x.XDefaultRootWindow(display)
    window = x.XCreateSimpleWindow(display, root, 40, 40, WIDTH, HEIGHT, 0, 0, 0xFFFFFF)
    for name, value in ((b"_NET_WM_NAME", TITLE), (b"WM_NAME", TITLE)):
        kind = x.XInternAtom(display, b"UTF8_STRING" if name == b"_NET_WM_NAME" else b"STRING", False)
        x.XChangeProperty(display, window, x.XInternAtom(display, name, False), kind, 8, 0, value, len(value))
    pid = (ctypes.c_long * 1)(os.getpid())
    x.XChangeProperty(display, window, x.XInternAtom(display, b"_NET_WM_PID", False), 6, 32, 0,
                      ctypes.cast(pid, ctypes.c_void_p), 1)
    x.XSelectInput(display, window, 1 | 4 | (1 << 15))  # key press, button press, expose
    x.XMapWindow(display, window)
    gc = x.XCreateGC(display, window, 0, None)
    painted: list[tuple[int, int]] = []
    log = open(log_path, "a", buffering=1)

    def paint() -> None:
        for row in range(0, HEIGHT, 20):
            for column in range(0, WIDTH, 20):
                x.XSetForeground(display, gc, 0x202020 if (row + column) // 20 % 2 else 0xE0E0E0)
                x.XFillRectangle(display, window, gc, column, row, 20, 20)
        for px, py in painted:
            x.XSetForeground(display, gc, 0xFF0000)
            x.XFillRectangle(display, window, gc, max(0, px - 40), max(0, py - 40), 80, 80)
        x.XFlush(display)

    event = XEvent()
    while True:
        x.XNextEvent(display, ctypes.byref(event))
        if event.type == 12:  # Expose
            paint()
            log.write("ready\n")
        elif event.type == 2:  # KeyPress
            keysym = ctypes.c_ulong()
            x.XLookupString(ctypes.byref(event.key), ctypes.create_string_buffer(16), 16, ctypes.byref(keysym), None)
            name = (x.XKeysymToString(keysym.value) or b"?").decode()
            log.write(f"key {name}{' ctrl' if event.key.state & 4 else ''}{' shift' if event.key.state & 1 else ''}\n")
        elif event.type == 4:  # ButtonPress
            painted.append((event.key.x, event.key.y))
            log.write(f"click {event.key.x} {event.key.y}\n")
            paint()


if __name__ == "__main__":
    main(sys.argv[1])
