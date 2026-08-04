/**
 * OCADE media inspection orchestrator.
 *
 * A single entry point that routes a file to the right reader — image or video
 * — from its BYTES, and returns a unified description with an
 * extension-honesty check. This is the execution-path consumer that composes
 * the image media pack and the video-metadata reader: neither is used blind;
 * this decides which applies and reports one honest result.
 *
 * The routing rule mirrors the pieces it calls: identify from content, never
 * from the file name, and refuse a file that matches neither reader rather than
 * guessing. The claimed extension is checked against what the bytes actually
 * are, so a `.png` that is really a video — or an executable — is reported as a
 * mismatch to treat as untrusted, not accepted on its name.
 */
import {
  inspectImage,
  checkExtension,
  identifyFormat,
  type ImageInfo,
} from "../skills/packs/media-pack";
import { readVideoMetadata, type VideoMetadata } from "./video-metadata";

export type MediaOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type MediaKind = "image" | "video";

export interface MediaInspection {
  kind: MediaKind;
  image?: ImageInfo;
  video?: VideoMetadata;
  /** True when the file's real type matches what its name claims. */
  extensionMatches: boolean | null;
  /** Human-facing note about the name-vs-content check. */
  extensionNote: string;
}

/** Extensions this orchestrator recognises as video, for the name check. */
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "qt"]);

/**
 * Inspect a media file from its bytes and (optionally) its claimed name.
 *
 * Tries image first, then video; refuses when neither reader recognises the
 * content. The name is used ONLY to check honesty, never to decide the type.
 */
export function inspectMedia(bytes: Uint8Array, fileName?: string): MediaOutcome<MediaInspection> {
  if (bytes.length === 0) return { ok: false, reason: "That file is empty." };

  // Image? identifyFormat reads magic bytes and returns null for non-images.
  if (identifyFormat(bytes) !== null) {
    const img = inspectImage(bytes);
    if (!img.ok) return img;
    const { matches, note } = checkImageName(fileName, bytes);
    return {
      ok: true,
      data: { kind: "image", image: img.data, extensionMatches: matches, extensionNote: note },
      evidence: `${img.evidence}${note ? ` ${note}` : ""}`,
    };
  }

  // Video? readVideoMetadata refuses non-ISO-BMFF, so a clean result means video.
  const vid = readVideoMetadata(bytes);
  if (vid.ok) {
    const { matches, note } = checkVideoName(fileName, vid.data.container);
    return {
      ok: true,
      data: { kind: "video", video: vid.data, extensionMatches: matches, extensionNote: note },
      evidence: `${vid.evidence}${note ? ` ${note}` : ""}`,
    };
  }

  return {
    ok: false,
    reason:
      "This file isn't an image or a video OCADE can read from its contents. It won't guess a type from the file name.",
  };
}

function checkImageName(
  fileName: string | undefined,
  bytes: Uint8Array,
): { matches: boolean | null; note: string } {
  if (!fileName) return { matches: null, note: "" };
  const r = checkExtension(fileName, bytes);
  if (!r.ok) return { matches: null, note: "" };
  return {
    matches: r.data.matches,
    note: r.data.matches ? "" : r.evidence,
  };
}

function checkVideoName(
  fileName: string | undefined,
  container: string,
): { matches: boolean | null; note: string } {
  if (!fileName) return { matches: null, note: "" };
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ext || ext === fileName.toLowerCase()) return { matches: null, note: "" };
  if (!VIDEO_EXTENSIONS.has(ext)) {
    return {
      matches: false,
      note: `“${fileName}” is named .${ext} but its contents are a ${container.toUpperCase()} video. Treat the name as unreliable.`,
    };
  }
  return { matches: true, note: "" };
}

/** One line describing an inspection, for a UI or a receipt. */
export function describeMedia(inspection: MediaInspection): string {
  if (inspection.kind === "image" && inspection.image) {
    const i = inspection.image;
    return `Image: ${i.format.toUpperCase()} ${i.width}×${i.height} (${i.megapixels.toFixed(1)} MP).`;
  }
  if (inspection.kind === "video" && inspection.video) {
    const v = inspection.video;
    return `Video: ${v.container.toUpperCase()}${v.width ? ` ${v.width}×${v.height}` : ""}, ${v.durationSeconds.toFixed(1)}s.`;
  }
  return "Unrecognised media.";
}
