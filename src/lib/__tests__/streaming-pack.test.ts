import { describe, it, expect } from "vitest";
import {
  STREAMING_PACK,
  parsePlaylist,
  checkLadder,
  checkSegments,
  type Playlist,
} from "../skills/packs/streaming-pack";

/** Real .m3u8 text, in the shape packagers actually emit. */

const MASTER = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"
360p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p.m3u8
`;

const MEDIA = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
seg0.ts
#EXTINF:6.000,
seg1.ts
#EXTINF:4.500,
seg2.ts
#EXT-X-ENDLIST
`;

function playlist(text: string): Playlist {
  const r = parsePlaylist(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("the pack states its own limits", () => {
  it("says plainly that it cannot control a broadcast", () => {
    expect(STREAMING_PACK.coverageNote).toMatch(/cannot sign into Twitch/i);
    expect(STREAMING_PACK.coverageNote).toMatch(/start, stop or moderate a broadcast/i);
    expect(STREAMING_PACK.coverageNote).toMatch(/does not download or play media/i);
  });
});

describe("reading a playlist", () => {
  it("reads a master playlist's quality options", () => {
    const p = playlist(MASTER);
    expect(p.kind).toBe("master");
    if (p.kind !== "master") throw new Error("unreachable");
    expect(p.variants).toHaveLength(3);
    expect(p.variants[0]).toEqual({
      bandwidth: 800000,
      resolution: "640x360",
      codecs: "avc1.4d401e,mp4a.40.2",
      uri: "360p.m3u8",
    });
  });

  /**
   * CODECS values contain commas inside quotes. Splitting the attribute list
   * on comma corrupts them — and the resulting variant still looks valid.
   */
  it("keeps a quoted CODECS value intact", () => {
    const p = playlist(MASTER);
    if (p.kind !== "master") throw new Error("unreachable");
    expect(p.variants[1].codecs).toBe("avc1.4d401f,mp4a.40.2");
  });

  it("reads a media playlist's segments and end marker", () => {
    const p = playlist(MEDIA);
    expect(p.kind).toBe("media");
    if (p.kind !== "media") throw new Error("unreachable");
    expect(p.segments).toHaveLength(3);
    expect(p.targetDurationSeconds).toBe(6);
    expect(p.ended).toBe(true);
  });

  it("tells a live playlist from a finished one", () => {
    const live = playlist(MEDIA.replace("#EXT-X-ENDLIST\n", ""));
    if (live.kind !== "media") throw new Error("unreachable");
    expect(live.ended).toBe(false);
    const r = parsePlaylist(MEDIA.replace("#EXT-X-ENDLIST\n", ""));
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/^Live playlist/);
  });

  it("refuses a file that isn't a playlist", () => {
    const r = parsePlaylist("just some text\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess from the file extension/i);
  });

  /**
   * A media playlist without a target duration cannot be checked against one.
   * Inventing a limit would produce a confident pass or fail from a number
   * nobody declared.
   */
  it("refuses a media playlist with no target duration", () => {
    const r = parsePlaylist("#EXTM3U\n#EXTINF:6.000,\nseg0.ts\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't check segments against a limit that isn't declared/i);
  });

  it("refuses a playlist that is both master and media", () => {
    const hybrid = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-STREAM-INF:BANDWIDTH=800000
360p.m3u8
#EXTINF:6.000,
seg0.ts
`;
    const r = parsePlaylist(hybrid);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess which half/i);
  });

  it("refuses a quality option with no bandwidth", () => {
    const r = parsePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360\n360p.m3u8\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no usable BANDWIDTH/);
  });

  /**
   * When the ONLY entry is the truncated one, the diagnosis must still be
   * "truncated" — reporting "this playlist has nothing in it" sends someone
   * looking for a packaging fault instead of a cut-off download.
   */
  it("refuses a truncated master playlist, even when nothing else parsed", () => {
    const r = parsePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated/i);

    const partial = parsePlaylist(MASTER + "#EXT-X-STREAM-INF:BANDWIDTH=9000000\n");
    expect(partial.ok).toBe(false);
    if (partial.ok) throw new Error("unreachable");
    expect(partial.reason).toMatch(/truncated/i);
  });

  it("refuses a media playlist truncated after a segment's duration", () => {
    const r = parsePlaylist("#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.000,\n");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/segment that has no URI/i);
  });

  it("refuses an empty playlist rather than reporting a healthy stream", () => {
    expect(parsePlaylist("#EXTM3U\n").ok).toBe(false);
    expect(parsePlaylist("").ok).toBe(false);
  });
});

describe("checking the quality ladder", () => {
  it("passes a well-formed ladder", () => {
    const r = checkLadder(playlist(MASTER));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(r.evidence).toMatch(/in ascending order/);
  });

  /**
   * Players walk the ladder in written order. An out-of-order rung makes
   * adaptive switching pick badly — which viewers experience as buffering on a
   * connection that is plainly fast enough.
   */
  it("finds a rung listed out of order", () => {
    const jumbled = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p.m3u8
`;
    const r = checkLadder(playlist(jumbled));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].kind).toBe("out_of_order");
    expect(r.data[0].detail).toMatch(/800 kbps.*after a higher one.*5000 kbps/);
  });

  it("finds two options a player cannot tell apart", () => {
    const duplicate = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
b.m3u8
`;
    const r = checkLadder(playlist(duplicate));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.some((p) => p.kind === "duplicate_bandwidth")).toBe(true);
  });

  it("flags a missing resolution", () => {
    const noRes = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000
a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720
b.m3u8
`;
    const r = checkLadder(playlist(noRes));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.some((p) => p.kind === "missing_resolution")).toBe(true);
  });

  it("flags a stream with nothing to adapt to", () => {
    const single = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\na.m3u8\n";
    const r = checkLadder(playlist(single));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].kind).toBe("too_few_options");
  });

  it("refuses to check a ladder on a media playlist", () => {
    const r = checkLadder(playlist(MEDIA));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no quality options to check/i);
  });
});

describe("checking segments", () => {
  it("passes segments within the declared target", () => {
    const r = checkSegments(playlist(MEDIA));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(r.evidence).toMatch(/within the 6s target/);
  });

  /** The failure that looks like a well-formed playlist and buffers anyway. */
  it("finds a segment longer than the target duration", () => {
    const over = MEDIA.replace("#EXTINF:4.500,", "#EXTINF:9.000,");
    const r = checkSegments(playlist(over));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].segment).toBe(3);
    expect(r.data[0].detail).toMatch(/underrun their buffer/);
  });

  /** HLS compares the ROUNDED duration, so 6.4s against a 6s target is legal. */
  it("rounds before comparing, as the specification requires", () => {
    const justUnder = MEDIA.replace("#EXTINF:4.500,", "#EXTINF:6.400,");
    const justOver = MEDIA.replace("#EXTINF:4.500,", "#EXTINF:6.600,");
    const under = checkSegments(playlist(justUnder));
    const over = checkSegments(playlist(justOver));
    if (!under.ok || !over.ok) throw new Error("unreachable");
    expect(under.data).toHaveLength(0);
    expect(over.data).toHaveLength(1);
  });

  it("finds a zero-duration segment", () => {
    const zero = MEDIA.replace("#EXTINF:4.500,", "#EXTINF:0,");
    const r = checkSegments(playlist(zero));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].detail).toMatch(/zero duration/);
  });

  it("says a live playlist may still grow", () => {
    const live = playlist(MEDIA.replace("#EXT-X-ENDLIST\n", ""));
    const r = checkSegments(live);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/still live, so more may follow/);
  });

  it("refuses to check segments on a master playlist", () => {
    const r = checkSegments(playlist(MASTER));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/individual quality playlists/i);
  });
});
