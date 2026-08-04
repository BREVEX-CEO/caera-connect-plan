import { describe, it, expect } from "vitest";
import {
  CAPTIONS_PACK,
  parseCaptions,
  checkTiming,
  checkReadability,
  DEFAULT_MAX_CPS,
  type Cue,
} from "../skills/packs/captions-pack";

/** Real WebVTT and SubRip text, in the shapes real exporters produce. */

const VTT = `WEBVTT

NOTE This file was exported from the lecture recording.

1
00:00:01.000 --> 00:00:04.000
Welcome to the course.

2
00:00:04.500 --> 00:00:08.000
Today we're covering
two separate topics.
`;

const SRT = `1
00:00:01,000 --> 00:00:04,000
Welcome to the course.

2
00:00:04,500 --> 00:00:08,000
Today we're covering two topics.
`;

function cues(text: string): Cue[] {
  const r = parseCaptions(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("the pack states its own limits", () => {
  it("says plainly that it cannot transcribe or publish", () => {
    expect(CAPTIONS_PACK.coverageNote).toMatch(/cannot sign into Moodle/i);
    expect(CAPTIONS_PACK.coverageNote).toMatch(/does not transcribe audio/i);
    expect(CAPTIONS_PACK.coverageNote).toMatch(/does not upload or publish/i);
  });
});

describe("reading caption files", () => {
  it("reads WebVTT, including multi-line cue text", () => {
    const c = cues(VTT);
    expect(c).toHaveLength(2);
    expect(c[0].startMs).toBe(1000);
    expect(c[0].endMs).toBe(4000);
    expect(c[1].text).toBe("Today we're covering\ntwo separate topics.");
  });

  it("reads SubRip, which uses a comma before the milliseconds", () => {
    const c = cues(SRT);
    expect(c).toHaveLength(2);
    expect(c[0].startMs).toBe(1000);
    expect(c[1].startMs).toBe(4500);
  });

  /** NOTE blocks are comments, not captions. Counting them shifts every index. */
  it("skips WebVTT NOTE blocks rather than treating them as cues", () => {
    expect(cues(VTT)).toHaveLength(2);
    expect(cues(VTT)[0].text).toBe("Welcome to the course.");
  });

  it("reads hours when present, and defaults to zero when not", () => {
    const withHours = cues("WEBVTT\n\n01:02:03.400 --> 01:02:05.000\nLate.");
    expect(withHours[0].startMs).toBe(3723400);
    const without = cues("WEBVTT\n\n02:03.400 --> 02:05.000\nEarly.");
    expect(without[0].startMs).toBe(123400);
  });

  it("ignores WebVTT positioning settings after the end time", () => {
    const positioned = cues("WEBVTT\n\n00:00:01.000 --> 00:00:02.000 line:0 position:50%\nUp top.");
    expect(positioned[0].endMs).toBe(2000);
  });

  it("strips a byte-order mark, which real exports carry", () => {
    expect(() => cues("\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello.")).not.toThrow();
  });

  it("refuses a timestamp with an impossible minute or second", () => {
    // 00:90:00 parses as digits but is not a time.
    const r = parseCaptions("WEBVTT\n\n00:90:00.000 --> 00:91:00.000\nNope.");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/can't read/i);
  });

  it("refuses a cue that ends before it starts", () => {
    const r = parseCaptions("WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nBackwards.");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/ends before it starts/i);
  });

  it("refuses a file with no captions", () => {
    expect(parseCaptions("WEBVTT\n\n").ok).toBe(false);
    expect(parseCaptions("").ok).toBe(false);
  });

  it("reports cues with no text rather than hiding them", () => {
    const r = parseCaptions(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\n00:00:03.000 --> 00:00:04.000\nHi.",
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/1 with no text/);
  });
});

describe("checking caption timing", () => {
  it("passes a clean file", () => {
    const r = checkTiming(cues(VTT));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(r.evidence).toMatch(/in order and don't overlap/);
  });

  it("finds overlapping captions and says by how much", () => {
    const overlapping = cues(
      "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nFirst.\n\n00:00:04.000 --> 00:00:07.000\nSecond.",
    );
    const r = checkTiming(overlapping);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].kind).toBe("overlap");
    expect(r.data[0].detail).toMatch(/overlap by 1000 ms/);
  });

  /** Back-to-back captions are correct, not an overlap. */
  it("does not flag captions that touch exactly", () => {
    const touching = cues(
      "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst.\n\n00:00:04.000 --> 00:00:07.000\nSecond.",
    );
    const r = checkTiming(touching);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
  });

  it("finds captions written out of time order", () => {
    const jumbled = cues(
      "WEBVTT\n\n00:00:10.000 --> 00:00:12.000\nLater.\n\n00:00:01.000 --> 00:00:03.000\nEarlier.",
    );
    const r = checkTiming(jumbled);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].kind).toBe("out_of_order");
  });

  it("finds zero-length captions that players never show", () => {
    const instant = cues("WEBVTT\n\n00:00:01.000 --> 00:00:01.000\nBlink.");
    const r = checkTiming(instant);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].kind).toBe("zero_length");
  });

  /**
   * A lecture legitimately contains silence. A gap check that fires on all of
   * it gets ignored along with the real problems, so it is off by default.
   */
  it("does not flag silence unless a gap limit is asked for", () => {
    const gappy = cues(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nFirst.\n\n00:05:00.000 --> 00:05:02.000\nMuch later.",
    );
    expect(checkTiming(gappy).ok && checkTiming(gappy).ok).toBe(true);

    const off = checkTiming(gappy);
    if (!off.ok) throw new Error("unreachable");
    expect(off.data).toHaveLength(0);

    const on = checkTiming(gappy, 60_000);
    if (!on.ok) throw new Error("unreachable");
    expect(on.data[0].kind).toBe("gap_too_long");
    expect(on.data[0].detail).toMatch(/298s with no captions/);
  });

  it("refuses when there is nothing to check", () => {
    expect(checkTiming([]).ok).toBe(false);
  });
});

describe("checking captions can actually be read", () => {
  it("uses the published broadcast ceiling by default", () => {
    expect(DEFAULT_MAX_CPS).toBe(21);
  });

  it("passes captions that are comfortably paced", () => {
    const r = checkReadability(cues(VTT));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
  });

  it("finds a caption that flashes past too fast", () => {
    // 60 characters in one second is roughly three times the limit.
    const fast = cues(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${"a".repeat(60)}`);
    const r = checkReadability(fast);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].charactersPerSecond).toBe(60);
    expect(r.data[0].detail).toMatch(/above the 21 limit/);
  });

  it("accepts a lower limit for younger or second-language audiences", () => {
    const moderate = cues(
      "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nA sentence of ordinary length.",
    );
    const atDefault = checkReadability(moderate);
    const atStricter = checkReadability(moderate, 10);
    if (!atDefault.ok || !atStricter.ok) throw new Error("unreachable");
    expect(atDefault.data).toHaveLength(0);
    expect(atStricter.data).toHaveLength(1);
  });

  it("does not count line breaks against the reading budget", () => {
    const twoLines = cues(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n" + "a".repeat(10) + "\n" + "b".repeat(10),
    );
    const r = checkReadability(twoLines, 21);
    if (!r.ok) throw new Error("unreachable");
    // 20 characters + one break; counting the break would push it over.
    expect(r.data).toHaveLength(0);
  });

  /**
   * Dividing by a zero-length cue yields Infinity, which would bury the real
   * diagnosis (a timing fault) under a readability one.
   */
  it("leaves zero-length captions to the timing check", () => {
    const instant = cues("WEBVTT\n\n00:00:01.000 --> 00:00:01.000\nSomething.");
    const r = checkReadability(instant);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(checkTiming(instant).ok).toBe(true);
  });

  it("names the worst offender, so there's somewhere to start", () => {
    const mixed = cues(
      `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${"a".repeat(30)}\n\n00:00:03.000 --> 00:00:04.000\n${"b".repeat(90)}`,
    );
    const r = checkReadability(mixed);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/the worst is caption 2/);
  });

  it("refuses a nonsensical limit", () => {
    expect(checkReadability(cues(VTT), 0).ok).toBe(false);
    expect(checkReadability([]).ok).toBe(false);
  });
});
