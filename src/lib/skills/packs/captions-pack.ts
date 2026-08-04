/**
 * Captions skill pack — a REAL, executed adapter for the education category.
 *
 * Scope, stated plainly: this pack reads and checks **caption files** (WebVTT
 * and SubRip) for recorded lectures and course material. It does not sign into
 * Moodle, Canvas, Blackboard or a video platform, it does not transcribe audio,
 * and it does not upload anything. `coverageNote` says so.
 *
 * Captions are an accessibility requirement, not a nicety, and the ways they
 * fail are specific and measurable: cues that overlap so two lines fight for
 * the same screen, cues that flash past faster than anyone reads, cues out of
 * order so a player shows them in the wrong place. Each check below reports
 * **which cue**, because "12 problems" sends someone scrubbing through an hour
 * of video by hand.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "captions.parse",
    label: "Read a caption file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "captions.check_timing",
    label: "Find overlapping or out-of-order captions",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "captions.check_readability",
    label: "Find captions that pass too fast to read",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const CAPTIONS_PACK: SkillPack = {
  appId: "ocade.captions",
  displayName: "Lecture captions and subtitles",
  category: "education",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Reads and checks WebVTT and SubRip caption files. OCADE cannot sign into Moodle, Canvas, Blackboard or a video platform, does not transcribe audio, and does not upload or publish anything.",
};

export type CaptionsOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Cue {
  /** 1-based position in the file, which is how a person refers to it. */
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/* --------------------------------------------------------------- parsing -- */

/**
 * WebVTT uses `HH:MM:SS.mmm` (hours optional); SubRip uses `HH:MM:SS,mmm`.
 * Both are accepted, because a file that mixes them still plays in most
 * players and the mismatch is not what the user asked about.
 */
const TIMESTAMP = /^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})$/;

function parseTimestamp(s: string): number | null {
  const m = TIMESTAMP.exec(s.trim());
  if (!m) return null;
  const [, h = "0", mm, ss, ms] = m;
  const minutes = Number(mm);
  const seconds = Number(ss);
  // 90 seconds is not a valid timestamp even though it parses as digits.
  if (minutes > 59 || seconds > 59) return null;
  return Number(h) * 3600000 + minutes * 60000 + seconds * 1000 + Number(ms.padEnd(3, "0"));
}

/** Parse WebVTT or SubRip. The format is detected from the content, not the name. */
export function parseCaptions(text: string): CaptionsOutcome<Cue[]> {
  if (!text.trim()) return { ok: false, reason: "That file is empty." };

  // U+FEFF is the byte-order mark real exporters prepend; written as an escape
  // because a literal one is invisible in the source and easily deleted.
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/^\uFEFF/, "")
    .split("\n");
  const isVtt = lines[0].trim().startsWith("WEBVTT");

  const cues: Cue[] = [];
  let i = isVtt ? 1 : 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    // WebVTT NOTE blocks and SubRip numeric indices both sit before the timing
    // line; neither is the timing line itself.
    if (isVtt && /^NOTE\b/.test(lines[i].trim())) {
      while (i < lines.length && lines[i].trim() !== "") i++;
      continue;
    }

    let arrowLine = lines[i];
    if (!arrowLine.includes("-->")) {
      // A SubRip cue number, or a WebVTT cue identifier.
      i++;
      if (i >= lines.length) {
        return {
          ok: false,
          reason: `Cue ${cues.length + 1} has no timing line — the file is truncated.`,
        };
      }
      arrowLine = lines[i];
    }

    const parts = arrowLine.split("-->");
    if (parts.length !== 2) {
      return {
        ok: false,
        reason: `Cue ${cues.length + 1} has no valid timing line (“${arrowLine.trim().slice(0, 40)}”).`,
      };
    }

    // WebVTT allows positioning settings after the end time; they are not part
    // of the timestamp.
    const startMs = parseTimestamp(parts[0]);
    const endMs = parseTimestamp(parts[1].trim().split(/\s+/)[0]);
    if (startMs === null || endMs === null) {
      return {
        ok: false,
        reason: `Cue ${cues.length + 1} has a timestamp OCADE can't read (“${arrowLine.trim().slice(0, 40)}”).`,
      };
    }
    if (endMs < startMs) {
      return {
        ok: false,
        reason: `Cue ${cues.length + 1} ends before it starts, so this file is wrong.`,
      };
    }

    i++;
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      body.push(lines[i]);
      i++;
    }

    cues.push({ index: cues.length + 1, startMs, endMs, text: body.join("\n").trim() });
  }

  if (cues.length === 0) {
    return { ok: false, reason: "This file has no captions in it." };
  }

  const empty = cues.filter((c) => c.text === "").length;
  return {
    ok: true,
    data: cues,
    evidence:
      empty > 0
        ? `${cues.length} captions, ${empty} with no text.`
        : `${cues.length} captions, ending at ${formatMs(cues[cues.length - 1].endMs)}.`,
  };
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- timing -- */

export interface TimingProblem {
  cue: number;
  kind: "overlap" | "out_of_order" | "zero_length" | "gap_too_long";
  detail: string;
}

/**
 * Check cue timing.
 *
 * A gap threshold of 0 disables the gap check rather than flagging every pause
 * in the recording — a lecture legitimately contains silence, and a check that
 * fires on all of it gets ignored along with the real problems.
 */
export function checkTiming(cues: Cue[], maxGapMs = 0): CaptionsOutcome<TimingProblem[]> {
  if (cues.length === 0) return { ok: false, reason: "There are no captions to check." };

  const problems: TimingProblem[] = [];

  for (const cue of cues) {
    if (cue.endMs === cue.startMs) {
      problems.push({
        cue: cue.index,
        kind: "zero_length",
        detail: `Caption ${cue.index} has no duration, so most players never show it.`,
      });
    }
  }

  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const cur = cues[i];

    if (cur.startMs < prev.startMs) {
      problems.push({
        cue: cur.index,
        kind: "out_of_order",
        detail: `Caption ${cur.index} starts before caption ${prev.index}, so the file isn't in time order.`,
      });
      continue; // an out-of-order cue makes the overlap comparison meaningless
    }
    if (cur.startMs < prev.endMs) {
      problems.push({
        cue: cur.index,
        kind: "overlap",
        detail: `Captions ${prev.index} and ${cur.index} overlap by ${prev.endMs - cur.startMs} ms — both compete for the screen.`,
      });
    } else if (maxGapMs > 0 && cur.startMs - prev.endMs > maxGapMs) {
      problems.push({
        cue: cur.index,
        kind: "gap_too_long",
        detail: `There's ${Math.round((cur.startMs - prev.endMs) / 1000)}s with no captions before caption ${cur.index}.`,
      });
    }
  }

  return {
    ok: true,
    data: problems,
    evidence:
      problems.length === 0
        ? `All ${cues.length} captions are in order and don't overlap.`
        : `${problems.length} timing problem${problems.length === 1 ? "" : "s"} — first: ${problems[0].detail}`,
  };
}

/* ----------------------------------------------------------- readability -- */

export interface ReadabilityProblem {
  cue: number;
  charactersPerSecond: number;
  detail: string;
}

/**
 * Find captions that pass too fast to read.
 *
 * 21 characters per second is the widely used broadcast ceiling for adult
 * captions; the default is deliberately that published figure rather than a
 * number chosen here, and it is a parameter because course material for
 * younger or second-language audiences uses a lower one.
 */
export const DEFAULT_MAX_CPS = 21;

export function checkReadability(
  cues: Cue[],
  maxCharactersPerSecond = DEFAULT_MAX_CPS,
): CaptionsOutcome<ReadabilityProblem[]> {
  if (cues.length === 0) return { ok: false, reason: "There are no captions to check." };
  if (maxCharactersPerSecond <= 0) {
    return { ok: false, reason: "The reading-rate limit must be greater than zero." };
  }

  const problems: ReadabilityProblem[] = [];
  for (const cue of cues) {
    const durationMs = cue.endMs - cue.startMs;
    // A zero-length cue is a timing fault, reported by checkTiming. Dividing by
    // it here would yield Infinity and bury the real diagnosis.
    if (durationMs <= 0 || cue.text === "") continue;

    // Line breaks are not read aloud and shouldn't count against the budget.
    const characters = cue.text.replace(/\n/g, " ").length;
    const cps = characters / (durationMs / 1000);
    if (cps > maxCharactersPerSecond) {
      problems.push({
        cue: cue.index,
        charactersPerSecond: Math.round(cps * 10) / 10,
        detail: `Caption ${cue.index} shows ${characters} characters in ${(durationMs / 1000).toFixed(1)}s — ${Math.round(cps)} per second, above the ${maxCharactersPerSecond} limit.`,
      });
    }
  }

  return {
    ok: true,
    data: problems,
    evidence:
      problems.length === 0
        ? `All ${cues.length} captions stay within ${maxCharactersPerSecond} characters per second.`
        : `${problems.length} of ${cues.length} captions pass too fast to read — the worst is caption ${problems.reduce((a, b) => (b.charactersPerSecond > a.charactersPerSecond ? b : a)).cue}.`,
  };
}
