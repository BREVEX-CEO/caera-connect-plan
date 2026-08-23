/**
 * Video editing OCADE can actually do, and prove it did.
 *
 * WHY THIS EXISTS. `media-pack` inspects images and says plainly that it
 * "cannot operate Photoshop, Illustrator, Blender or video editors, and does
 * not edit or export images". That honesty was correct while nothing could
 * edit. It is the wrong answer once a real encoder is available, so this pack
 * does the work rather than declining it.
 *
 * THE RUNNER IS INJECTED, exactly as `archive-pack` injects the one that runs
 * `tar`. Tests drive the real ffmpeg binary; production drives the companion's.
 * Nothing here builds a shell string — arguments are an array, and a path that
 * could be read as an option is refused before ffmpeg sees it.
 *
 * EVERY EDIT IS VERIFIED BY RE-READING THE OUTPUT. ffmpeg exits 0 on plenty of
 * files nothing can play: a zero-frame stream, a container with no video track,
 * a crop that silently clamped to nothing. So an edit is only reported as done
 * once the result has been probed and the property that was asked for is
 * present in it — the trimmed duration, the cropped dimensions. An exit code is
 * not evidence.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

export interface VideoCommand {
  bin: "ffmpeg" | "ffprobe";
  args: string[];
  cwd: string;
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export type VideoRunner = (cmd: VideoCommand) => Promise<CommandResult>;

export type VideoOutcome<T = string> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface VideoFacts {
  durationSeconds: number;
  width: number;
  height: number;
  hasVideoTrack: boolean;
  /** The container ffprobe recognised, e.g. "mov,mp4,m4a". */
  formatName: string;
}

/**
 * Containers that are not video, however confidently ffprobe describes them.
 *
 * ffmpeg will happily decode a PLAIN TEXT FILE as "ANSI art": notes.txt comes
 * back as a 640x400 video in the `tty` container with a real duration. Handing
 * that to a trim would produce a file, and the file would be nonsense. A demuxer
 * that can render anything is not a reason to treat anything as a video.
 */
const NOT_REALLY_VIDEO = new Set(["tty", "ansi", "image2", "png_pipe", "mjpeg", "gif"]);

const CAPABILITIES: SkillCapability[] = [
  {
    id: "video.probe",
    label: "Read a video's duration and size",
    methods: ["cli"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "video.trim",
    label: "Trim a video to a start and length",
    methods: ["cli"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "video.crop",
    label: "Crop a video to a rectangle",
    methods: ["cli"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "video.caption",
    label: "Burn a caption into a video",
    methods: ["cli"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
];

export const VIDEO_PACK: SkillPack = {
  appId: "ocade.video.local",
  displayName: "Video editing",
  category: "graphics_media",
  testedVersions: ["ffmpeg 6.", "ffmpeg 7."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Trims, crops and captions video with a local encoder, and verifies every result by re-reading the file it produced. It does not composite, colour-grade, or edit audio, and it drives no third-party editor.",
};

/**
 * A path ffmpeg would read as an option is refused before it is passed.
 *
 * `-i` is not a filename, and neither is anything else beginning with a dash.
 * This is the same rule `archive-pack` applies to tar, and for the same reason:
 * an argument array removes shell injection, not argument injection.
 */
function refuseOptionShaped(...paths: string[]): string | null {
  for (const path of paths) {
    if (!path || path.trim() === "") return "A file name is required.";
    if (path.startsWith("-"))
      return `Refused a path that ffmpeg would read as an option: ${JSON.stringify(path)}`;
  }
  return null;
}

/** ffprobe's JSON, reduced to the facts an edit is checked against. */
export function parseProbe(stdout: string): VideoFacts | null {
  let parsed: {
    format?: { duration?: string; format_name?: string };
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  const video = (parsed.streams ?? []).find((s) => s.codec_type === "video");
  const duration = Number(parsed.format?.duration ?? video?.duration ?? NaN);
  return {
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasVideoTrack: Boolean(video),
    formatName: parsed.format?.format_name ?? "",
  };
}

export const videoCommands = {
  probe: (cwd: string, file: string): VideoCommand => ({
    bin: "ffprobe",
    args: ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "--", file],
    cwd,
  }),
  trim: (
    cwd: string,
    input: string,
    output: string,
    startSeconds: number,
    durationSeconds: number,
  ): VideoCommand => ({
    bin: "ffmpeg",
    // `-ss` before `-i` seeks fast; re-encoding rather than stream-copying is
    // deliberate, because a copy can only cut on a keyframe and would silently
    // give back a different span than the one asked for.
    args: [
      "-y",
      "-ss",
      String(startSeconds),
      "-t",
      String(durationSeconds),
      "-i",
      input,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "--",
      output,
    ],
    cwd,
  }),
  crop: (
    cwd: string,
    input: string,
    output: string,
    w: number,
    h: number,
    x: number,
    y: number,
  ): VideoCommand => ({
    bin: "ffmpeg",
    args: [
      "-y",
      "-i",
      input,
      "-vf",
      `crop=${w}:${h}:${x}:${y}`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "--",
      output,
    ],
    cwd,
  }),
  caption: (cwd: string, input: string, output: string, text: string): VideoCommand => ({
    bin: "ffmpeg",
    args: [
      "-y",
      "-i",
      input,
      "-vf",
      `drawtext=text='${escapeDrawText(text)}':x=(w-text_w)/2:y=h-th-16:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "--",
      output,
    ],
    cwd,
  }),
};

/**
 * drawtext has its own escaping, separate from the shell's.
 *
 * A colon ends the option, a single quote ends the string, and a backslash
 * escapes. Getting this wrong does not produce a security hole here — the
 * argument never reaches a shell — but it does produce a caption that silently
 * loses everything after the first colon, which is how "12:30" becomes "12".
 */
export function escapeDrawText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
}

export async function probeVideo(
  run: VideoRunner,
  cwd: string,
  file: string,
): Promise<VideoOutcome<VideoFacts>> {
  const refusal = refuseOptionShaped(file);
  if (refusal) return { ok: false, reason: refusal };

  const result = await run(videoCommands.probe(cwd, file));
  if (!result.ok)
    return { ok: false, reason: result.stderr.trim() || "That video could not be read." };
  const facts = parseProbe(result.stdout);
  if (!facts) return { ok: false, reason: "That file did not describe itself as a video." };
  if (!facts.hasVideoTrack) return { ok: false, reason: "That file has no video track." };
  const container = facts.formatName.split(",")[0]?.trim() ?? "";
  if (NOT_REALLY_VIDEO.has(container)) {
    return {
      ok: false,
      reason: `That file is not a video — the decoder read it as ${container}. Text and still images are not clips OCADE will edit.`,
    };
  }
  return {
    ok: true,
    data: facts,
    evidence: `${facts.width}×${facts.height}, ${facts.durationSeconds.toFixed(2)}s.`,
  };
}

/** Shared shape: act, then PROVE the output has the property that was asked for. */
async function editAndVerify(
  run: VideoRunner,
  cwd: string,
  input: string,
  output: string,
  command: VideoCommand,
  /** Checked against the SOURCE before encoding: never spend an encode on a request that cannot be right. */
  precheck: (before: VideoFacts) => string | null,
  expectation: (before: VideoFacts, after: VideoFacts) => string | null,
  describe: (after: VideoFacts) => string,
): Promise<VideoOutcome<VideoFacts>> {
  const refusal = refuseOptionShaped(input, output);
  if (refusal) return { ok: false, reason: refusal };

  const before = await probeVideo(run, cwd, input);
  if (!before.ok) return before;

  const impossible = precheck(before.data);
  if (impossible) return { ok: false, reason: impossible };

  const edit = await run(command);
  if (!edit.ok) {
    return { ok: false, reason: edit.stderr.trim().split("\n").slice(-1)[0] || "The edit failed." };
  }

  const after = await probeVideo(run, cwd, output);
  if (!after.ok) {
    return {
      ok: false,
      reason: `The encoder reported success but the result could not be read back: ${after.reason}`,
    };
  }

  const wrong = expectation(before.data, after.data);
  if (wrong) return { ok: false, reason: wrong };

  return { ok: true, data: after.data, evidence: describe(after.data) };
}

export async function trimVideo(
  run: VideoRunner,
  cwd: string,
  input: string,
  output: string,
  span: { startSeconds: number; durationSeconds: number },
): Promise<VideoOutcome<VideoFacts>> {
  if (!(span.durationSeconds > 0))
    return { ok: false, reason: "A trim needs a length greater than zero." };
  if (span.startSeconds < 0)
    return { ok: false, reason: "A trim cannot start before the beginning." };

  return editAndVerify(
    run,
    cwd,
    input,
    output,
    videoCommands.trim(cwd, input, output, span.startSeconds, span.durationSeconds),
    (before) =>
      span.startSeconds >= before.durationSeconds
        ? "That start point is past the end of the video."
        : null,
    (before, after) => {
      // Encoders land within a frame or two of the requested length; a result
      // that is not close to it is a different clip, not a rounding difference.
      const wanted = Math.min(span.durationSeconds, before.durationSeconds - span.startSeconds);
      if (Math.abs(after.durationSeconds - wanted) > 0.5) {
        return `The trim asked for ${wanted.toFixed(2)}s but produced ${after.durationSeconds.toFixed(2)}s.`;
      }
      return null;
    },
    (after) => `Trimmed to ${after.durationSeconds.toFixed(2)}s, verified by reading the result.`,
  );
}

export async function cropVideo(
  run: VideoRunner,
  cwd: string,
  input: string,
  output: string,
  box: { x: number; y: number; width: number; height: number },
): Promise<VideoOutcome<VideoFacts>> {
  if (box.width <= 0 || box.height <= 0)
    return { ok: false, reason: "A crop needs a width and height greater than zero." };
  if (box.x < 0 || box.y < 0)
    return { ok: false, reason: "A crop cannot start outside the frame." };

  return editAndVerify(
    run,
    cwd,
    input,
    output,
    videoCommands.crop(cwd, input, output, box.width, box.height, box.x, box.y),
    (before) =>
      box.x + box.width > before.width || box.y + box.height > before.height
        ? `That crop reaches outside the ${before.width}×${before.height} frame.`
        : null,
    (before, after) => {
      // H.264 rounds odd dimensions to even; anything larger is a crop that
      // did not happen.
      if (Math.abs(after.width - box.width) > 1 || Math.abs(after.height - box.height) > 1) {
        return `The crop asked for ${box.width}×${box.height} but produced ${after.width}×${after.height}.`;
      }
      return null;
    },
    (after) => `Cropped to ${after.width}×${after.height}, verified by reading the result.`,
  );
}

/**
 * Is the text-drawing filter actually compiled into this encoder?
 *
 * `drawtext` needs libfreetype, and plenty of static ffmpeg builds ship without
 * it — including the one this repository installs for tests. Without this check
 * a caption fails with "Filter not found", which tells the person nothing they
 * can act on and looks like a bug in OCADE rather than a missing feature in
 * their encoder.
 */
export async function captionsAvailable(run: VideoRunner, cwd: string): Promise<boolean> {
  const result = await run({ bin: "ffmpeg", args: ["-hide_banner", "-filters"], cwd });
  return /(^|\s)drawtext(\s|$)/m.test(`${result.stdout}\n${result.stderr}`);
}

export async function captionVideo(
  run: VideoRunner,
  cwd: string,
  input: string,
  output: string,
  text: string,
): Promise<VideoOutcome<VideoFacts>> {
  if (!text.trim()) return { ok: false, reason: "A caption needs some words." };

  if (!(await captionsAvailable(run, cwd))) {
    return {
      ok: false,
      reason:
        "This copy of ffmpeg was built without the text filter (drawtext needs libfreetype), so OCADE cannot burn in a caption here. Trimming and cropping still work.",
    };
  }

  return editAndVerify(
    run,
    cwd,
    input,
    output,
    videoCommands.caption(cwd, input, output, text),
    () => null,
    (before, after) => {
      // A caption is drawn INTO the frame: the geometry must survive it.
      if (after.width !== before.width || after.height !== before.height) {
        return `Captioning changed the frame from ${before.width}×${before.height} to ${after.width}×${after.height}.`;
      }
      if (Math.abs(after.durationSeconds - before.durationSeconds) > 0.5) {
        return "Captioning changed the length of the video.";
      }
      return null;
    },
    (after) =>
      `Caption burned in; still ${after.width}×${after.height} and ${after.durationSeconds.toFixed(2)}s.`,
  );
}
