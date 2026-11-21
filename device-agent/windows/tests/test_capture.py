"""OCADE Live Vision's shared capture (plan 14F.9-14F.10): one stream per window, shared by every
watcher; only changed frames are kept, at most KEEP of them; a stream nobody uses stops; a native
capture that cannot start falls back to bounded polling, labelled as such; ui.watch reports a
real change, refuses a still window and an ended capture, and shows ordered keyframes on request.
Scripted frame sources only; the native streams are proved on hosted Windows and macOS
(UIA-021, MAC-030)."""

import threading
import time
import unittest

from PIL import Image, ImageDraw

from ocade_agent import capture
from ocade_agent.sandbox import Refused


def picture(mark: int | None = None) -> Image.Image:
    image = Image.new("RGB", (160, 120), "white")
    if mark is not None:
        ImageDraw.Draw(image).rectangle((mark, 60, mark + 40, 119), fill="black")
    return image


class Scripted:
    """A source the test pushes frames into, like a native frame-arrived callback."""

    def __init__(self, backend="scripted"):
        self.backend, self.started, self.stopped = backend, 0, 0

    def __call__(self, arrived, end):
        self.started += 1
        self.arrived, self.end = arrived, end
        return self.backend, self.stop

    def stop(self):
        self.stopped += 1


class StreamTest(unittest.TestCase):
    def test_only_changed_frames_are_kept_and_never_more_than_keep(self):
        source = Scripted()
        stream = capture.Stream(source)
        source.arrived(picture())
        source.arrived(picture())  # the same picture again: not a new frame
        self.assertEqual(stream.latest().seq, 1)
        for mark in range(capture.KEEP + 5):
            source.arrived(picture(mark * 4))
        self.assertEqual(len(stream.since(0)), capture.KEEP, "bounded memory")
        self.assertEqual(stream.latest().seq, capture.KEEP + 6)

    def test_a_waiter_wakes_on_the_next_frame_or_when_the_capture_ends(self):
        source = Scripted()
        stream = capture.Stream(source)
        source.arrived(picture())
        threading.Timer(0.05, lambda: source.arrived(picture(10))).start()
        self.assertEqual(stream.wait(1, 2).seq, 2)
        threading.Timer(0.05, lambda: source.end("window_gone")).start()
        started = time.monotonic()
        self.assertIsNone(stream.wait(2, 2))
        self.assertLess(time.monotonic() - started, 1, "an ended capture does not wait out the timeout")
        self.assertEqual(stream.ended, "window_gone")


class HubTest(unittest.TestCase):
    def test_every_watcher_of_one_window_shares_one_capture(self):
        hub, source = capture.Hub(), Scripted()
        with hub.use("w1", source) as first, hub.use("w1", source) as second:
            self.assertIs(first, second)
            self.assertEqual(first.users, 2)
        self.assertEqual(source.started, 1, "one capture, not one per agent")
        with hub.use("w2", Scripted()) as other:
            self.assertIsNot(other, first)

    def test_a_capture_nobody_uses_stops_and_an_ended_one_is_reopened(self):
        hub, old = capture.Hub(), Scripted()
        with hub.use("w1", old) as stream:
            pass
        stream.idle_since -= capture.IDLE_SECONDS + 1
        fresh = Scripted()
        with hub.use("w2", fresh):
            pass
        self.assertEqual(old.stopped, 1, "idle for IDLE_SECONDS: stopped")
        fresh.end("window_gone")
        again = Scripted()
        with hub.use("w2", again) as reopened:
            self.assertIsNone(reopened.ended)
        self.assertEqual(again.started, 1)

    def test_a_native_capture_that_cannot_start_falls_back_to_labelled_polling(self):
        def broken(arrived, end):
            raise RuntimeError("no Windows.Graphics.Capture on this build")

        frames = iter([picture(), picture(30)] + [picture(30)] * 100)
        stream = capture.Stream(capture.native_or_polling(broken, lambda: next(frames)))
        self.assertEqual(stream.backend, "polling")
        self.assertIsNotNone(stream.wait(1, 3), "the fallback delivers frames")
        stream.close()

    def test_a_refused_native_capture_is_not_replaced(self):
        def refused(arrived, end):
            raise Refused("screen_recording_permission_needed")

        with self.assertRaises(Refused):
            capture.Stream(capture.native_or_polling(refused, lambda: picture()))

    def test_polling_ends_with_the_windows_refusal(self):
        def gone():
            raise Refused("window_gone")

        stream = capture.Stream(capture.polling(gone))
        self.assertIsNone(stream.wait(0, 2))
        self.assertEqual(stream.ended, "window_gone")


class WatchTest(unittest.TestCase):
    def test_a_real_change_is_reported_with_its_regions_and_the_capture_used(self):
        source = Scripted("windows_graphics_capture")
        stream = capture.Stream(source)
        source.arrived(picture())
        threading.Timer(0.05, lambda: source.arrived(picture(100))).start()
        facts = capture.watch(stream, None, 3000)
        self.assertTrue(facts["changed"])
        self.assertEqual(facts["capture"], "windows_graphics_capture")
        self.assertTrue(all(region[0] >= 0.5 for region in facts["regions"]), facts["regions"])
        self.assertNotIn("preview", facts, "no picture unless asked")

    def test_a_change_outside_the_watched_region_is_not_a_change(self):
        source = Scripted()
        stream = capture.Stream(source)
        source.arrived(picture())
        threading.Timer(0.05, lambda: source.arrived(picture(100))).start()
        with self.assertRaises(Refused) as caught:
            capture.watch(stream, [0, 0, 0.5, 1], 400)
        self.assertEqual(caught.exception.code, "not_changed")
        self.assertEqual(caught.exception.detail["frames"], 2)

    def test_a_still_window_and_an_ended_capture_are_refusals(self):
        source = Scripted()
        stream = capture.Stream(source)
        source.arrived(picture())
        with self.assertRaises(Refused) as still:
            capture.watch(stream, None, 300)
        self.assertEqual(still.exception.code, "not_changed")
        threading.Timer(0.05, lambda: source.end("window_gone")).start()
        with self.assertRaises(Refused) as gone:
            capture.watch(stream, None, 3000)
        self.assertEqual(gone.exception.code, "window_gone")

    def test_asked_to_show_the_ordered_keyframes_come_back_as_one_picture(self):
        source = Scripted()
        stream = capture.Stream(source)
        source.arrived(picture())

        def move():
            for mark in (2, 4, 6, 8, 120):  # small moves stay below the bar, then a real change
                time.sleep(0.02)
                source.arrived(picture(mark))

        threading.Thread(target=move).start()
        facts = capture.watch(stream, None, 3000, show=True)
        self.assertTrue(facts["preview"])
        times = facts["keyframesAtMs"]
        self.assertEqual(times[0], 0)
        self.assertEqual(times, sorted(times), "oldest first")
        self.assertLessEqual(len(times), 4)

    def test_keyframes_keep_the_first_and_the_newest(self):
        frames = [capture.Frame(n, n, picture()) for n in range(1, 8)]
        self.assertEqual([f.seq for f in capture.keyframes(frames)], [1, 5, 6, 7])


if __name__ == "__main__":
    unittest.main()
