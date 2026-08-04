/**
 * Streaming skill pack — a REAL, executed adapter for the games/streaming
 * category.
 *
 * Scope, stated plainly: this pack reads **HLS playlists** (`.m3u8`), the
 * manifest format every major streaming platform serves. It does not sign into
 * Twitch, YouTube or a game client, does not start or stop a broadcast, does
 * not download media, and does not play games. `coverageNote` says so.
 *
 * The checks here are the ones that explain a bad viewing experience: a bitrate
 * ladder out of order so players pick badly, segments longer than the declared
 * target duration so buffers underrun, a live playlist missing its end marker.
 * All of it is text, all of it is verifiable, and none of it requires touching
 * the video.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "streaming.parse_playlist",
    label: "Read a stream playlist",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "streaming.check_ladder",
    label: "Check the quality options make sense",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "streaming.check_segments",
    label: "Find segments that will stall playback",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const STREAMING_PACK: SkillPack = {
  appId: "ocade.streaming",
  displayName: "Stream playlists",
  category: "games_streaming",
  // Pinned to the HLS playlist version this implements.
  testedVersions: ["3", "4", "5", "6", "7"],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Reads HLS .m3u8 playlists. OCADE cannot sign into Twitch, YouTube or a game client, cannot start, stop or moderate a broadcast, and does not download or play media.",
};

export type StreamingOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Variant {
  bandwidth: number;
  resolution: string | null;
  codecs: string | null;
  uri: string;
}

export interface Segment {
  durationSeconds: number;
  uri: string;
  /** 0-based position, used to point at the right line. */
  index: number;
}

export type Playlist =
  | { kind: "master"; variants: Variant[] }
  | { kind: "media"; targetDurationSeconds: number; segments: Segment[]; ended: boolean };

/* --------------------------------------------------------------- parsing -- */

function parseAttributes(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Values may be quoted and contain commas (CODECS="avc1.4d401f,mp4a.40.2"),
  // so a plain split on comma corrupts them.
  const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out[m[1]] = m[3] ?? m[2];
  return out;
}

/**
 * Parse an HLS playlist, master or media.
 *
 * Refuses a file that declares both variants and segments: that is not a valid
 * playlist, and guessing which half to believe would produce a confident report
 * about a file no player will accept.
 */
export function parsePlaylist(text: string): StreamingOutcome<Playlist> {
  if (!text.trim()) return { ok: false, reason: "That file is empty." };

  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  if (lines[0] !== "#EXTM3U") {
    return {
      ok: false,
      reason:
        "That isn't an HLS playlist — it doesn't start with #EXTM3U. OCADE won't guess from the file extension.",
    };
  }

  const variants: Variant[] = [];
  const segments: Segment[] = [];
  let targetDuration: number | null = null;
  let ended = false;
  let pendingVariant: Record<string, string> | null = null;
  let pendingDuration: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") continue;

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      pendingVariant = parseAttributes(line.slice("#EXT-X-STREAM-INF:".length));
      continue;
    }
    if (line.startsWith("#EXT-X-TARGETDURATION:")) {
      const v = Number(line.slice("#EXT-X-TARGETDURATION:".length));
      if (!Number.isFinite(v) || v <= 0) {
        return { ok: false, reason: `Line ${i + 1} declares an invalid target duration.` };
      }
      targetDuration = v;
      continue;
    }
    if (line === "#EXT-X-ENDLIST") {
      ended = true;
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      const v = Number(line.slice("#EXTINF:".length).split(",")[0]);
      if (!Number.isFinite(v) || v < 0) {
        return { ok: false, reason: `Line ${i + 1} declares an invalid segment duration.` };
      }
      pendingDuration = v;
      continue;
    }
    if (line.startsWith("#")) continue; // a tag this pack doesn't act on

    // A bare line is a URI, belonging to whichever tag preceded it.
    if (pendingVariant) {
      const bandwidth = Number(pendingVariant.BANDWIDTH);
      if (!Number.isFinite(bandwidth) || bandwidth <= 0) {
        return {
          ok: false,
          reason: `The quality option ending at line ${i + 1} declares no usable BANDWIDTH.`,
        };
      }
      variants.push({
        bandwidth,
        resolution: pendingVariant.RESOLUTION ?? null,
        codecs: pendingVariant.CODECS ?? null,
        uri: line,
      });
      pendingVariant = null;
      continue;
    }
    if (pendingDuration !== null) {
      segments.push({ durationSeconds: pendingDuration, uri: line, index: segments.length });
      pendingDuration = null;
      continue;
    }
  }

  /*
   * A tag left without its URI means the file was cut off mid-entry. This is
   * checked BEFORE the "nothing in here" case: when the only entry is the
   * truncated one, falling through would report "this playlist has nothing in
   * it", which sends someone looking for a packaging fault instead of a
   * truncated download.
   */
  if (pendingVariant) {
    return {
      ok: false,
      reason: "This playlist ends with a quality option that has no URI — it's truncated.",
    };
  }
  if (pendingDuration !== null) {
    return {
      ok: false,
      reason: "This playlist ends with a segment that has no URI — it's truncated.",
    };
  }

  if (variants.length > 0 && segments.length > 0) {
    return {
      ok: false,
      reason:
        "This playlist lists both quality options and media segments. That isn't valid HLS, and OCADE won't guess which half to report on.",
    };
  }

  if (variants.length > 0) {
    return {
      ok: true,
      data: { kind: "master", variants },
      evidence: `Master playlist with ${variants.length} quality option${variants.length === 1 ? "" : "s"}, from ${Math.round(Math.min(...variants.map((v) => v.bandwidth)) / 1000)} to ${Math.round(Math.max(...variants.map((v) => v.bandwidth)) / 1000)} kbps.`,
    };
  }

  if (segments.length === 0) {
    return { ok: false, reason: "This playlist has neither quality options nor segments in it." };
  }
  if (targetDuration === null) {
    return {
      ok: false,
      reason:
        "This media playlist has no EXT-X-TARGETDURATION, which players require. OCADE won't check segments against a limit that isn't declared.",
    };
  }

  const total = segments.reduce((a, s) => a + s.durationSeconds, 0);
  return {
    ok: true,
    data: { kind: "media", targetDurationSeconds: targetDuration, segments, ended },
    evidence: `${ended ? "Complete" : "Live"} playlist, ${segments.length} segments, ${Math.round(total)}s total.`,
  };
}

/* ---------------------------------------------------------------- ladder -- */

export interface LadderProblem {
  kind: "out_of_order" | "duplicate_bandwidth" | "missing_resolution" | "too_few_options";
  detail: string;
}

/**
 * Check a bitrate ladder.
 *
 * Players walk the ladder in the order it is written; an out-of-order rung
 * makes adaptive switching pick badly, which viewers experience as buffering
 * that "shouldn't" happen on a fast connection.
 */
export function checkLadder(playlist: Playlist): StreamingOutcome<LadderProblem[]> {
  if (playlist.kind !== "master") {
    return {
      ok: false,
      reason:
        "This is a media playlist, not a master playlist — it has no quality options to check.",
    };
  }

  const problems: LadderProblem[] = [];
  const { variants } = playlist;

  if (variants.length < 2) {
    problems.push({
      kind: "too_few_options",
      detail: `Only ${variants.length} quality option${variants.length === 1 ? "" : "s"}, so players can't adapt to a slower connection.`,
    });
  }

  for (let i = 1; i < variants.length; i++) {
    if (variants[i].bandwidth < variants[i - 1].bandwidth) {
      problems.push({
        kind: "out_of_order",
        detail: `Quality option ${i + 1} (${Math.round(variants[i].bandwidth / 1000)} kbps) is listed after a higher one (${Math.round(variants[i - 1].bandwidth / 1000)} kbps).`,
      });
    }
  }

  const seen = new Set<number>();
  for (const v of variants) {
    if (seen.has(v.bandwidth)) {
      problems.push({
        kind: "duplicate_bandwidth",
        detail: `Two quality options both declare ${Math.round(v.bandwidth / 1000)} kbps, so a player can't tell them apart.`,
      });
    }
    seen.add(v.bandwidth);
  }

  const noResolution = variants.filter((v) => v.resolution === null).length;
  if (noResolution > 0) {
    problems.push({
      kind: "missing_resolution",
      detail: `${noResolution} quality option${noResolution === 1 ? " declares" : "s declare"} no RESOLUTION, so players can't match one to the screen.`,
    });
  }

  return {
    ok: true,
    data: problems,
    evidence:
      problems.length === 0
        ? `${variants.length} quality options, in ascending order, all fully described.`
        : `${problems.length} problem${problems.length === 1 ? "" : "s"} with the quality ladder — first: ${problems[0].detail}`,
  };
}

/* -------------------------------------------------------------- segments -- */

export interface SegmentProblem {
  segment: number;
  detail: string;
}

/**
 * Find segments that will stall playback.
 *
 * HLS requires every segment to be no longer than the declared target
 * duration, rounded to the nearest integer. Players size their buffers from
 * that number, so a segment that exceeds it underruns the buffer — and the
 * playlist still looks perfectly well-formed.
 */
export function checkSegments(playlist: Playlist): StreamingOutcome<SegmentProblem[]> {
  if (playlist.kind !== "media") {
    return {
      ok: false,
      reason: "This is a master playlist — its segments live in the individual quality playlists.",
    };
  }

  const problems: SegmentProblem[] = [];
  for (const s of playlist.segments) {
    if (Math.round(s.durationSeconds) > playlist.targetDurationSeconds) {
      problems.push({
        segment: s.index + 1,
        detail: `Segment ${s.index + 1} is ${s.durationSeconds}s, over the declared target of ${playlist.targetDurationSeconds}s — players will underrun their buffer.`,
      });
    }
    if (s.durationSeconds === 0) {
      problems.push({ segment: s.index + 1, detail: `Segment ${s.index + 1} has zero duration.` });
    }
  }

  return {
    ok: true,
    data: problems,
    evidence:
      problems.length === 0
        ? `All ${playlist.segments.length} segments are within the ${playlist.targetDurationSeconds}s target.${playlist.ended ? "" : " This playlist is still live, so more may follow."}`
        : `${problems.length} segment${problems.length === 1 ? "" : "s"} will stall playback — first: ${problems[0].detail}`,
  };
}
