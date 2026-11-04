/**
 * THE JARVIS PROTOCOL, ONCE (plan.md §4.2, §22.3, P01/P05).
 *
 * Every object that crosses a trust boundary — planner to queue, queue to
 * device, device to server, verifier to settlement — is defined here and
 * validated at runtime on both sides. The companion reads the JSON Schema this
 * file exports (`device-agent/protocol.json`), so TypeScript and Python check
 * the same contract. Nothing a device, document or tool description sends can
 * add an operation, raise a risk or grant a permission: the registry below is
 * the only list, and an unknown operation is refused.
 */
import { z } from "zod";

export const PROTOCOL_VERSION = 1;

/**
 * `external_effect` actions wait for the person's confirmation before any device may
 * claim them; irreversible actions (payments, deletion, sends without review) are not
 * in the registry at all.
 */
const RISKS = ["read", "reversible_write", "external_effect"] as const;

/** Shared programs an operation needs on the computer; the device reports which it has. */
export const ENGINES = ["ffmpeg", "browser", "office", "desktop"] as const;

/** Paths are relative to a workspace folder the person chose on the device itself. */
const workspacePath = z
  .string()
  .min(1)
  .max(260)
  .refine((path) => !/\p{Cc}/u.test(path), "control characters");

/** The shell a command is written for; each computer offers its own (the device refuses others). */
const shell = z
  .enum(["powershell", "cmd", "sh", "bash", "zsh"])
  .describe("powershell (default) or cmd on Windows; sh (default), bash or zsh on macOS/Linux");
const jobId = z.string().regex(/^[0-9a-f]{16}$/);

/**
 * Where a new deliverable goes: always a NEW file under the workspace's `OCADE output/`
 * folder (the device's sandbox enforces the same rule and never overwrites a file).
 */
const outputPath = (what = "The new file") =>
  workspacePath
    .regex(/^OCADE output\//, "outputs go under OCADE output/")
    .describe(
      `${what}: a new path that starts with 'OCADE output/', e.g. 'OCADE output/result.ext'`,
    );

/**
 * An app's executable name, as `apps.list` reports it and an `app:` permission names it:
 * `name.exe` on Windows, the bundle's executable name on macOS.
 */
const exe = z
  .string()
  .regex(/^[A-Za-z0-9 ._()+-]{1,80}$/)
  .transform((name) => name.toLowerCase());

/**
 * One top-level window, exactly: a reused PID or HWND, or a restarted app, no
 * longer matches, so a stale observation can never steer input elsewhere.
 */
const windowLease = z.strictObject({
  exe,
  pid: z.number().int().positive(),
  hwnd: z.number().int().positive(),
  started: z.number().positive(),
});

/** An element inside a leased window, found again by what it is, not where it was. */
const element = z
  .strictObject({
    automationId: z.string().max(200).optional(),
    name: z.string().max(200).optional(),
    controlType: z.string().max(40).optional(),
  })
  .refine((e) => e.automationId || e.name, "an element needs an automation id or a name");

const host = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/)
  .max(253);
/** A public https site by name: no localhost, no address literals, no non-default port. */
const httpsUrl = z
  .url({ protocol: /^https$/ })
  .max(2000)
  .refine((url) => {
    try {
      const { hostname, port, username, password } = new URL(url);
      return (
        host.safeParse(hostname).success &&
        !port &&
        !username &&
        !password &&
        !/(^|\.)localhost$/.test(hostname) &&
        !/^[0-9.]+$/.test(hostname)
      );
    } catch {
      return false;
    }
  }, "unsupported host");
const page = z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), site: host });
const selector = z
  .string()
  .min(1)
  .max(500)
  .describe(
    "A control's `selector` exactly as web.open/web.read listed it, or, for visible text that is not listed (a menu item, say), a Playwright selector such as 'text=Save >> visible=true'",
  );

type Target = { app?: string; site?: string; mcp?: string };

/** A call to one tool of an owner-approved external MCP server, checked on the device against its pinned manifest. */
const mcpCall = z.strictObject({
  server: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  tool: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
  arguments: z.record(z.string(), z.unknown()),
});
const mcpTarget = (a: { server: string }): Target => ({ mcp: a.server });

const num = (min: number, max: number) => z.number().min(min).max(max);
const vec3 = z.array(num(-1000, 1000)).length(3);
const rgb = z.array(num(0, 1)).length(3);
const seconds = num(0, 86_400);
const id = z.string().regex(/^[a-z0-9_]{1,40}$/);

/**
 * A 3D scene as data (plan.md M1): parts built from signed-distance shapes
 * combined in order, with materials, lights, an environment and a camera. It is
 * the editable project; `scene.render` turns it into pixels. Units are metres,
 * +Y is up, rotations are XYZ degrees.
 */
const shape = z.strictObject({
  shape: z
    .enum(["sphere", "box", "ellipsoid", "cylinder", "torus", "capsule", "halfspace"])
    .describe(
      "size: sphere [r]; box [half x,y,z]; ellipsoid [radii x,y,z]; cylinder [r, half height] along Y; " +
        "torus [ring r, tube r] around Y; capsule [half length, r] along Y; halfspace [] keeps local y<0",
    ),
  size: z.array(num(0, 100)).max(3).default([]),
  round: num(0, 10).optional().describe("Rounds edges by this radius"),
  shell: num(0, 10).optional().describe("Hollow surface of this thickness"),
  material: id.optional().describe("On a subtraction: the material of the cut surface"),
  op: z
    .enum(["union", "smooth_union", "subtract", "smooth_subtract", "intersect"])
    .optional()
    .describe("How this shape combines with the shapes before it in the part"),
  k: num(0.0001, 10).optional().describe("Blend radius for smooth operations"),
  position: vec3.optional(),
  rotation: vec3.optional(),
  mirror: z
    .array(z.enum(["x", "y", "z"]))
    .max(3)
    .optional()
    .describe("Mirror across these axes"),
  repeat: z
    .strictObject({ axis: z.enum(["x", "y", "z"]), count: z.int().min(2).max(64) })
    .optional()
    .describe("Repeat around this local axis, after placing; then apply offset"),
  offset: vec3.optional(),
});
const scene = z
  .strictObject({
    camera: z.strictObject({
      position: vec3,
      target: vec3,
      fov: num(5, 120).describe("Vertical field of view, degrees"),
      aperture: num(0, 1).optional().describe("Lens radius for depth of field; 0 is sharp"),
      focusDistance: num(0, 1000).optional(),
    }),
    environment: z.strictObject({
      sky: z
        .array(z.array(num(0, 20)).length(3))
        .length(2)
        .describe("[zenith colour, horizon colour]"),
      ground: rgb.optional(),
      floor: z
        .strictObject({ color: rgb, roughness: num(0, 1), reflectance: num(0, 1) })
        .optional()
        .describe("An infinite floor at y = 0"),
      softboxes: z
        .array(
          z.strictObject({
            direction: vec3,
            width: num(1, 180),
            height: num(1, 180),
            intensity: num(0, 100),
            color: rgb.optional(),
          }),
        )
        .max(8)
        .optional()
        .describe(
          "Rectangular studio light panels seen in reflections, by direction and angular size",
        ),
    }),
    lights: z
      .array(
        z.strictObject({
          kind: z.enum(["sun", "point"]),
          direction: vec3.optional(),
          position: vec3.optional(),
          color: rgb,
          intensity: num(0, 1000),
          softness: num(0.001, 1).optional().describe("Shadow softness"),
        }),
      )
      .max(8),
    materials: z
      .array(
        z.strictObject({
          id,
          color: rgb,
          metallic: num(0, 1).optional(),
          roughness: num(0, 1).optional(),
          clearcoat: num(0, 1).optional(),
          emission: rgb.optional(),
          emissionStrength: num(0, 100).optional(),
          pattern: z.enum(["none", "carbon", "grille", "brushed"]).optional(),
          patternScale: num(0.05, 20).optional(),
        }),
      )
      .min(1)
      .max(16),
    parts: z
      .array(
        z.strictObject({
          id,
          shapes: z.array(shape).min(1).max(48),
          position: vec3.optional(),
          rotation: vec3.optional(),
          mirror: z
            .array(z.enum(["x", "y", "z"]))
            .max(3)
            .optional(),
          instances: z
            .array(vec3)
            .max(8)
            .optional()
            .describe("Copies of the whole part at these offsets"),
        }),
      )
      .min(1)
      .max(24),
    render: z.strictObject({
      width: z.int().min(16).max(7680),
      height: z.int().min(16).max(4320),
      samples: z
        .int()
        .min(1)
        .max(64)
        .optional()
        .describe("Samples per pixel; more is smoother and slower"),
      exposure: num(0.05, 10).optional(),
    }),
  })
  .refine(
    (s) => s.parts.reduce((total, part) => total + part.shapes.length, 0) <= 256,
    "at most 256 shapes",
  )
  .refine((s) => {
    const ids = new Set(s.materials.map((m) => m.id));
    return s.parts.every((part) => part.shapes.every((x) => !x.material || ids.has(x.material)));
  }, "every material must be defined")
  .refine(
    (s) => s.lights.every((l) => (l.kind === "sun" ? l.direction : l.position)),
    "a sun needs a direction, a point light a position",
  );

const TRANSITIONS = [
  "cut",
  "fade",
  "fadeblack",
  "fadewhite",
  "dissolve",
  "wipeleft",
  "wiperight",
  "slideleft",
  "slideright",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
  "circleopen",
  "circleclose",
  "zoomin",
  "radial",
  "hlwind",
  "hrwind",
  "squeezeh",
  "squeezev",
  "distance",
  "pixelize",
  "hblur",
  "fadegrays",
] as const;

/** An edit decision list (plan.md M2): the planner chooses every shot, cut, grade, title and sound. */
const timeline = z.strictObject({
  output: outputPath("The finished .mp4"),
  duration: num(1, 3600).describe("Exact length in seconds; shorter edits hold the last frame"),
  width: z.int().min(320).max(7680).optional(),
  height: z.int().min(240).max(4320).optional(),
  fps: z.int().min(12).max(60).optional(),
  clips: z
    .array(
      z.strictObject({
        source: workspacePath,
        in: seconds,
        out: seconds,
        speed: num(0.25, 4).optional().describe("Playback speed; 0.5 is slow motion"),
        grade: z
          .strictObject({
            exposure: num(-3, 3),
            temperature: z.int().min(1000).max(40000),
            contrast: num(0.5, 2),
            saturation: num(0, 3),
            gamma: num(0.3, 3),
            brightness: num(-0.5, 0.5),
            sharpen: num(0, 2),
            vignette: num(0, 1),
          })
          .partial()
          .optional(),
        motion: z
          .strictObject({
            zoomFrom: num(1, 2),
            zoomTo: num(1, 2),
            panX: num(-1, 1),
            panY: num(-1, 1),
          })
          .partial()
          .optional()
          .describe("A virtual camera move over the shot"),
        transition: z
          .strictObject({ type: z.enum(TRANSITIONS), duration: num(0, 3) })
          .optional()
          .describe("How this shot enters from the previous one"),
        audio: z.boolean().optional().describe("Keep this shot's own sound"),
        audioGain: num(-60, 20).optional(),
      }),
    )
    .min(1)
    .max(120),
  titles: z
    .array(
      z.strictObject({
        text: z.string().min(1).max(120),
        start: seconds,
        end: seconds,
        size: z.int().min(12).max(300).optional(),
        position: z.enum(["top", "center", "lower_third", "bottom"]).optional(),
        font: z
          .string()
          .regex(/^[A-Za-z0-9 ._-]{1,60}$/)
          .optional()
          .describe("An installed font family name"),
        color: z
          .string()
          .regex(/^(white|black|#[0-9a-fA-F]{6})$/)
          .optional(),
        fadeIn: num(0, 5).optional(),
        fadeOut: num(0, 5).optional(),
        box: num(0, 1).optional().describe("Opacity of a dark box behind the text"),
      }),
    )
    .max(30)
    .optional(),
  overlays: z
    .array(
      z.strictObject({
        image: workspacePath,
        start: seconds,
        end: seconds,
        width: z.int().min(16).max(7680).optional(),
        x: num(0, 1).optional(),
        y: num(0, 1).optional(),
        fadeIn: num(0, 5).optional(),
        fadeOut: num(0, 5).optional(),
        zoomTo: num(1, 2).optional(),
      }),
    )
    .max(10)
    .optional()
    .describe("Still images (for example a rendered 3D scene) composited over the picture"),
  audio: z
    .array(
      z
        .strictObject({
          source: workspacePath.optional(),
          in: seconds.optional(),
          synth: z
            .strictObject({
              kind: z.enum(["noise", "sine", "sweep"]),
              color: z.enum(["white", "pink", "brown"]).optional(),
              frequency: num(20, 20000).optional(),
              toFrequency: num(20, 20000).optional(),
              decay: num(0, 50).optional(),
            })
            .optional()
            .describe(
              "A generated sound: whoosh (filtered noise), impact (decaying sine), riser (sweep)",
            ),
          start: seconds,
          duration: num(0.05, 3600),
          gain: num(-60, 20).optional(),
          highpass: num(20, 20000).optional(),
          lowpass: num(20, 20000).optional(),
          fadeIn: num(0, 30).optional(),
          fadeOut: num(0, 30).optional(),
          role: z
            .enum(["music", "fx"])
            .optional()
            .describe("Music is ducked under everything else"),
        })
        .refine((layer) => !layer.source !== !layer.synth, "a layer has a source file or a synth"),
    )
    .max(40)
    .optional(),
  clipAudioGain: num(-60, 20).optional(),
  letterbox: num(1, 3).optional().describe("Aspect ratio of black bars, e.g. 2.39"),
  loudness: num(-30, -8).optional().describe("Integrated loudness target, LUFS"),
  fadeIn: num(0, 10).optional(),
  fadeOut: num(0, 10).optional(),
});

/**
 * The typed capability registry: four local roles (plus the separate verifier),
 * each operation with its permission, risk, argument schema and — for apps and
 * websites — the exact target that also needs the person's `app:`/`site:` grant.
 */
export const OPERATIONS = {
  "fs.list": {
    summary: "List the files and folders in a folder of the person’s workspace.",
    role: "fs_sandbox",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath.default(".") }),
  },
  "fs.read_text": {
    summary:
      "Read the text of a workspace file: any plain-text file (scripts, configs, CSV, Markdown, JSON…), Word document, spreadsheet cell values or PDF text.",
    role: "fs_sandbox",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "fs.write_text": {
    summary:
      "Write a new plain-text file (txt, csv, tsv, md, json, xml, html, yaml, ini, log, ps1, py, sql): the person's originals are never changed.",
    role: "fs_sandbox",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      path: outputPath(),
      text: z.string().max(50_000),
    }),
  },
  "fs.replace_text": {
    summary:
      "Replace the whole text of an existing plain-text workspace file (for example to repair a script or config), after the person confirms. Needs the sha256 fs.read_text returned, so a change made since is never overwritten; the original is kept under 'OCADE output/originals/'.",
    role: "fs_sandbox",
    capability: "files",
    risk: "external_effect",
    arguments: z.strictObject({
      path: workspacePath,
      text: z.string().max(50_000),
      expectSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  },
  "fs.edit_text": {
    summary:
      "Change exact passages of an existing plain-text workspace file in place (each `find` must occur exactly once; everything else stays as it was), after the person confirms. Needs the sha256 fs.read_text returned; the original is kept under 'OCADE output/originals/'.",
    role: "fs_sandbox",
    capability: "files",
    risk: "external_effect",
    arguments: z.strictObject({
      path: workspacePath,
      edits: z
        .array(
          z.strictObject({ find: z.string().min(1).max(10_000), replace: z.string().max(10_000) }),
        )
        .min(1)
        .max(20),
      expectSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  },
  "fs.manage": {
    summary:
      "Organise workspace files without a command: copy (to a new file under 'OCADE output/'), move or rename a file or folder (never replacing anything, so it can be moved back), mkdir (create a folder), trash (to the Recycle Bin/Trash, restorable), or set_attributes (executable on macOS/Linux, read-only). Kept originals cannot be moved or trashed.",
    role: "fs_sandbox",
    capability: "files",
    risk: "reversible_write",
    arguments: z
      .strictObject({
        action: z.enum(["copy", "move", "mkdir", "trash", "set_attributes"]),
        path: workspacePath,
        to: workspacePath.optional().describe("copy and move: the new path"),
        executable: z.boolean().optional(),
        readOnly: z.boolean().optional(),
      })
      .refine((a) => !["copy", "move"].includes(a.action) || a.to, "copy and move need `to`")
      .refine(
        (a) => a.action !== "copy" || a.to?.startsWith("OCADE output/"),
        "a copy goes under OCADE output/",
      )
      .refine(
        (a) =>
          a.action !== "set_attributes" || a.executable !== undefined || a.readOnly !== undefined,
        "set_attributes changes executable or readOnly",
      ),
  },
  "media.inspect": {
    summary:
      "Technical facts of an image, audio or video file (png, jpg, mp4, mov, wav, mp3…): dimensions, duration, codecs and streams.",
    role: "media_engine",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "media.trim": {
    summary: "Cut a time range out of an audio or video file into a new file.",
    engine: "ffmpeg",
    role: "media_engine",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      source: workspacePath,
      start: z.number().min(0),
      end: z.number().positive(),
      output: outputPath(),
    }),
  },
  "media.preview": {
    summary:
      "Look at an image, photo, chart, 3D render, screenshot or video (png, jpg, gif, webp, mp4, mov…): returns a picture (a frame contact sheet for video) that you see on your next turn.",
    role: "media_engine",
    // Sending what a file looks like to the online planner is the person's choice.
    capability: "screen",
    risk: "read",
    arguments: z.strictObject({
      path: workspacePath.describe("An image, render, screenshot or video in the workspace"),
      at: z
        .array(num(0, 86_400))
        .max(12)
        .optional()
        .describe("Video only: the seconds to show; default nine evenly spaced frames"),
    }),
  },
  "image.edit": {
    summary:
      "Edit a photo or picture into a NEW image under 'OCADE output/' (the original is never changed): steps applied in order — resize {width,height?}, crop {left,top,right,bottom} in pixels, rotate {degrees} clockwise, flip {direction}, grayscale, brightness/contrast/saturation {factor, 1 = unchanged}, sharpen, blur {radius}, text {text,x,y,size?,color?}.",
    role: "media_engine",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      source: workspacePath,
      output: outputPath("The edited image (.png, .jpg, .webp, .tif, .bmp or .gif)"),
      steps: z
        .array(
          z.strictObject({
            op: z.enum([
              "resize",
              "crop",
              "rotate",
              "flip",
              "grayscale",
              "brightness",
              "contrast",
              "saturation",
              "sharpen",
              "blur",
              "text",
            ]),
            width: z.int().min(1).max(16384).optional(),
            height: z.int().min(1).max(16384).optional(),
            left: z.int().min(0).optional(),
            top: z.int().min(0).optional(),
            right: z.int().min(1).optional(),
            bottom: z.int().min(1).optional(),
            degrees: z.number().min(-360).max(360).optional(),
            direction: z.enum(["horizontal", "vertical"]).optional(),
            factor: z.number().min(0).max(5).optional(),
            radius: z.number().min(0).max(50).optional(),
            text: z.string().min(1).max(200).optional(),
            x: z.int().min(0).optional(),
            y: z.int().min(0).optional(),
            size: z.int().min(6).max(500).optional(),
            color: z
              .string()
              .regex(/^(#[0-9a-fA-F]{6}|[a-z]{3,20})$/)
              .optional(),
          }),
        )
        .min(1)
        .max(20),
    }),
  },
  "media.analyze": {
    summary:
      "Split a video into shots and measure brightness, colour, motion and loudness for each shot.",
    engine: "ffmpeg",
    role: "media_engine",
    capability: "files",
    risk: "read",
    seconds: 1800,
    arguments: z.strictObject({
      path: workspacePath,
      threshold: num(0.05, 0.9)
        .optional()
        .describe("Scene-change sensitivity for splitting shots; lower finds more cuts"),
    }),
  },
  "media.render_timeline": {
    summary:
      "Edit and export video: clips with in and out points, speed, colour grade, camera moves, transitions, titles, image overlays, music and sound-effect layers, rendered to an exact-length MP4 film.",
    engine: "ffmpeg",
    role: "media_engine",
    capability: "files",
    risk: "reversible_write",
    seconds: 3600,
    arguments: timeline,
  },
  "scene.render": {
    summary:
      "Model and render a 3D scene from shapes, materials, lights, environment and camera; saves the editable 3D scene file and a rendered PNG image (any resolution, up to 4K and beyond).",
    engine: "browser",
    role: "media_engine",
    capability: "files",
    risk: "reversible_write",
    seconds: 3600,
    arguments: z.strictObject({
      scene,
      output: outputPath("The rendered still, .png"),
      project: outputPath("Where to save the editable scene file, e.g. .ocade-scene.json"),
    }),
  },
  "office.inspect_workbook": {
    summary: "List a spreadsheet workbook’s sheets, column headers and row counts.",
    role: "sys_core",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({ path: workspacePath }),
  },
  "office.write_document": {
    summary:
      "Write a new editable Word document (.docx) with headings, paragraphs and tables, optionally also exported as PDF.",
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      docx: outputPath("The Word document, .docx"),
      pdf: outputPath("Its PDF copy, .pdf").optional(),
      title: z.string().min(1).max(200),
      sections: z
        .array(
          z.strictObject({
            heading: z.string().min(1).max(200),
            paragraphs: z.array(z.string().max(4000)).max(50).default([]),
            table: z
              .array(z.array(z.string().max(500)).max(12))
              .max(200)
              .optional(),
          }),
        )
        .min(1)
        .max(30),
    }),
  },
  "office.write_workbook": {
    summary:
      "Write a new spreadsheet workbook (.xlsx); cells starting with = are formulas that a real spreadsheet engine recalculates.",
    engine: "office",
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      path: outputPath("The workbook, .xlsx"),
      sheets: z
        .array(
          z.strictObject({
            name: z.string().min(1).max(31),
            rows: z
              .array(z.array(z.union([z.string().max(1000), z.number(), z.null()])).max(50))
              .max(5000),
          }),
        )
        .min(1)
        .max(10),
    }),
  },
  "office.write_presentation": {
    summary:
      "Write a new editable PowerPoint deck (.pptx): slides with a title, bullets, an optional workspace picture and speaker notes (a first slide without bullets is a title slide with an optional subtitle).",
    role: "sys_core",
    capability: "files",
    risk: "reversible_write",
    arguments: z.strictObject({
      path: outputPath("The deck, .pptx"),
      slides: z
        .array(
          z.strictObject({
            title: z.string().min(1).max(200),
            subtitle: z.string().max(300).optional(),
            bullets: z.array(z.string().min(1).max(500)).max(12).optional(),
            image: workspacePath.optional(),
            notes: z.string().max(3000).optional(),
          }),
        )
        .min(1)
        .max(60),
    }),
  },
  "office.edit_document": {
    summary:
      "Change exact passages of an existing Word document (.docx) or PowerPoint deck (.pptx) in place, keeping its styles, tables and layout, after the person confirms (each `find` must occur exactly once). Needs the sha256 fs.read_text returned; the original is kept under 'OCADE output/originals/'.",
    role: "sys_core",
    capability: "files",
    risk: "external_effect",
    arguments: z.strictObject({
      path: workspacePath,
      edits: z
        .array(z.strictObject({ find: z.string().min(1).max(2000), replace: z.string().max(5000) }))
        .min(1)
        .max(20),
      expectSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  },
  "office.edit_workbook": {
    summary:
      "Set cells of an existing spreadsheet (.xlsx) in place (a value, or a formula starting with =), recalculated by a real engine, after the person confirms. Needs the sha256 fs.read_text returned; the original is kept; workbooks with charts, pictures, pivot tables or macros are refused.",
    engine: "office",
    role: "sys_core",
    capability: "files",
    risk: "external_effect",
    arguments: z.strictObject({
      path: workspacePath,
      cells: z
        .array(
          z.strictObject({
            sheet: z.string().min(1).max(31),
            cell: z.string().regex(/^[A-Z]{1,3}[0-9]{1,7}$/),
            value: z.union([z.string().max(1000), z.number(), z.null()]),
          }),
        )
        .min(1)
        .max(200),
      expectSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  },
  "system.inspect": {
    summary:
      "Facts about this computer before installing or repairing anything: OS, version, CPU architecture, free disk space in the workspace, and where each named program (for example python, node, ffmpeg, winget, brew) resolves, without running it.",
    role: "sys_core",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({
      programs: z
        .array(z.string().regex(/^[A-Za-z0-9._+-]{1,60}$/))
        .max(20)
        .default([]),
    }),
  },
  "system.diagnose": {
    summary:
      "Read-only facts for diagnosing a problem on this computer: running processes, services, recent crash/error events, environment variable names and PATH entries (never values), or which program opens a file extension (Windows). Optional filter keeps matching lines.",
    role: "sys_core",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({
      topic: z.enum(["processes", "services", "crashes", "environment", "associations"]),
      filter: z.string().min(1).max(80).optional(),
    }),
  },
  "apps.list": {
    summary: "List the desktop applications installed and the windows open on the computer.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({}),
  },
  "apps.launch": {
    summary: "Start an installed desktop application the person allowed.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "external_effect",
    arguments: z.strictObject({ exe, open: workspacePath.optional() }),
    target: (a: { exe: string }): Target => ({ app: a.exe }),
  },
  "ui.inspect": {
    summary:
      "Read and see one open application window: its controls with names, values, state and each one's box as window fractions, plus an image of the window.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "read",
    arguments: z.strictObject({ window: windowLease }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.invoke": {
    summary:
      "Press or activate a control (button, menu item, link) in an application window by its accessibility identity.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "external_effect",
    arguments: z.strictObject({ window: windowLease, element }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.set_value": {
    summary: "Type or set the value of a text field or control in an application window.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "external_effect",
    arguments: z.strictObject({ window: windowLease, element, value: z.string().max(4000) }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.send_keys": {
    summary:
      "Send keyboard keys to an application window: to the given control (focused first), else to whichever control has focus.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "apps",
    risk: "external_effect",
    arguments: z.strictObject({
      window: windowLease,
      keys: z.string().min(1).max(200),
      element: element.optional(),
    }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "ui.click_point": {
    summary:
      "Click a point (window fractions, for example inside a box ui.inspect reported or a spot seen in its image) when no accessible control can be reached.",
    engine: "desktop",
    role: "ui_bridge",
    capability: "computer_control",
    risk: "external_effect",
    arguments: z.strictObject({
      window: windowLease,
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      expectTitle: z.string().min(1).max(200),
    }),
    target: (a: { window: { exe: string } }): Target => ({ app: a.window.exe }),
  },
  "shell.run": {
    summary:
      "Run one command in the workspace folder to inspect or repair the computer; the person reads and confirms the exact command first. Returns exit code and output within 10 minutes; use job.start for long work that ends. A command must end: to leave a program running, start it detached with its output redirected (nohup … >log 2>&1 &, or Start-Process on Windows). Prefer fs.manage for copying, moving, folders, Trash and attributes.",
    role: "shell",
    capability: "computer_control",
    risk: "external_effect",
    arguments: z.strictObject({
      command: z.string().min(1).max(4000),
      timeoutSeconds: z.int().min(1).max(600).default(60),
      shell: shell.optional(),
    }),
    seconds: 620,
  },
  "job.start": {
    summary:
      "Start one long-running command (a render, export, build or install) as a tracked job that may run for hours; the person confirms the exact command first. Returns a jobId to follow with job.status.",
    role: "shell",
    capability: "computer_control",
    risk: "external_effect",
    arguments: z.strictObject({
      command: z.string().min(1).max(4000),
      timeoutSeconds: z.int().min(10).max(21_600).default(3600),
      shell: shell.optional(),
    }),
    seconds: 30,
  },
  "job.status": {
    summary:
      "Whether a job is running, finished (with its exit code), timed_out, cancelled or lost, how long it has run, and the end of its output.",
    role: "shell",
    capability: "computer_control",
    risk: "read",
    arguments: z.strictObject({ jobId: jobId }),
  },
  "job.cancel": {
    summary: "End a running job and everything it started.",
    role: "shell",
    capability: "computer_control",
    risk: "external_effect",
    arguments: z.strictObject({ jobId: jobId }),
    seconds: 30,
  },
  "web.open": {
    summary:
      "Open a public website page (https) in the browser to read, search, use a web app or find and download material.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ url: httpsUrl }),
    target: (a: { url: string }): Target => ({ site: new URL(a.url).hostname }),
  },
  "web.read": {
    summary: "Read the visible text, links and form fields of an open web page.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ page }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.fill": {
    summary: "Type a value into a field of an open web page.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({
      page,
      selector,
      value: z.string().max(2000),
      frame: selector.optional(),
    }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.select": {
    summary: "Choose an option in a drop-down of an open web page.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({
      page,
      selector,
      option: z.string().min(1).max(200),
      frame: selector.optional(),
    }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.click": {
    summary:
      "Click a button or link on an open web page (an effect outside the computer needs the person’s confirmation).",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({ page, selector, frame: selector.optional() }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.upload": {
    summary: "Upload a workspace file through a file input on an open web page.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({ page, selector, path: workspacePath }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.screenshot": {
    summary: "Save a picture of what an open web page shows.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "reversible_write",
    arguments: z.strictObject({ page, output: outputPath(".png") }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.close": {
    summary: "Close a web page JARVIS opened.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "read",
    arguments: z.strictObject({ page }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "web.download": {
    summary: "Download a file from an open web page into the workspace.",
    engine: "browser",
    role: "web_automation",
    capability: "browser",
    risk: "external_effect",
    arguments: z.strictObject({ page, selector, output: outputPath() }),
    target: (a: { page: { site: string } }): Target => ({ site: a.page.site }),
  },
  "mcp.read": {
    summary: "Call a read-only tool of an approved external tool server.",
    role: "mcp",
    capability: "mcp",
    risk: "read",
    arguments: mcpCall,
    target: mcpTarget,
  },
  "mcp.write": {
    summary: "Call a tool of an approved external tool server that changes local files.",
    role: "mcp",
    capability: "mcp",
    risk: "reversible_write",
    arguments: mcpCall,
    target: mcpTarget,
  },
  "mcp.external": {
    summary:
      "Call a tool of an approved external tool server that has an effect outside the computer.",
    role: "mcp",
    capability: "mcp",
    risk: "external_effect",
    arguments: mcpCall,
    target: mcpTarget,
  },
  "verify.checks": {
    summary:
      "Independently check the task’s outcome checks against the real files, pages and windows.",
    role: "verifier",
    capability: "files",
    risk: "read",
    arguments: z.strictObject({
      checks: z
        .array(z.lazy(() => outcomeCheck))
        .min(1)
        .max(10),
    }),
  },
} as const;

export type Operation = keyof typeof OPERATIONS;
/** Audited local inspections; all other operations may have effects after dispatch. */
export const PURE_READ_OPERATIONS = [
  "fs.list",
  "fs.read_text",
  "office.inspect_workbook",
  "system.inspect",
  "job.status",
] as const satisfies readonly Operation[];
const pureReadOperations: ReadonlySet<string> = new Set(PURE_READ_OPERATIONS);
const operationNames = Object.keys(OPERATIONS) as [Operation, ...Operation[]];

/** One queued action, as stored in `jarvis_activity.action` and sent to the device. */
export const actionIntent = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    key: z.string().regex(/^[a-z0-9_.:-]{1,80}$/),
    operation: z.enum(operationNames),
    capability: z.string(),
    risk: z.enum(RISKS),
    arguments: z.record(z.string(), z.unknown()),
    target: z
      .strictObject({
        app: z.string().optional(),
        site: z.string().optional(),
        mcp: z.string().optional(),
      })
      .optional(),
    deadlineUtc: z.iso.datetime(),
  })
  .strict()
  .superRefine((intent, context) => {
    const spec: {
      capability: string;
      risk: string;
      arguments: z.ZodType;
      target?: (a: never) => Target;
    } = OPERATIONS[intent.operation];
    if (intent.capability !== spec.capability || intent.risk !== spec.risk) {
      context.addIssue({
        code: "custom",
        message: "capability or risk does not match the registry",
      });
    }
    const parsed = spec.arguments.safeParse(intent.arguments);
    if (!parsed.success) {
      context.addIssue({ code: "custom", message: "invalid arguments" });
      return;
    }
    const target = spec.target?.(parsed.data as never);
    if (JSON.stringify(target ?? null) !== JSON.stringify(intent.target ?? null)) {
      context.addIssue({ code: "custom", message: "target does not match the arguments" });
    }
  });
export type ActionIntent = z.infer<typeof actionIntent>;

/** Permissions describe consent; only audited inspection code proves replay is safe. */
export function effectPossible(action: Pick<ActionIntent, "operation" | "risk">): boolean {
  return action.risk !== "read" || !pureReadOperations.has(action.operation);
}

/** Build a registry-consistent intent; the only way the planner makes one. */
export function intent<O extends Operation>(
  operation: O,
  key: string,
  args: z.input<(typeof OPERATIONS)[O]["arguments"]>,
  deadline: Date,
): ActionIntent {
  const spec: {
    capability: string;
    risk: string;
    arguments: z.ZodType;
    target?: (a: never) => Target;
  } = OPERATIONS[operation];
  const parsed = spec.arguments.parse(args) as Record<string, unknown>;
  const target = spec.target?.(parsed as never);
  return actionIntent.parse({
    v: PROTOCOL_VERSION,
    key,
    operation,
    capability: spec.capability,
    risk: spec.risk,
    arguments: parsed,
    ...(target ? { target } : {}),
    deadlineUtc: deadline.toISOString(),
  });
}

/** Evidence is small and typed: hashes, counts, names. Never file bytes or screenshots. */
const evidence = z
  .record(z.string().max(80), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 16_000, "evidence too large");

/** What a device observed. The actor's own "success" is not a status here. */
export const actionReceipt = z
  .object({
    status: z.enum(["observed", "not_applied", "unknown"]),
    maybeChanged: z.boolean(),
    observedAtUtc: z.iso.datetime(),
    evidence: evidence.default({}),
    /** A small JPEG (base64) the planner sees on its next turn; see `media.preview`. */
    preview: z
      .string()
      .max(64_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .optional(),
    errorCode: z
      .string()
      .regex(/^[a-z0-9_]{1,60}$/)
      .optional(),
  })
  .strict();
export type ActionReceipt = z.infer<typeof actionReceipt>;

/**
 * A fixed goal check, set when the task opens (`jarvis_tasks.outcome`). A check
 * with a `kind` is a typed predicate the separate verifier evaluates by reading
 * the real file, window or page; one without is settled by its own workflow's
 * verifier (legacy evidence only; all newly opened tasks require typed checks).
 */
export const outcomeCheck = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,60}$/),
  description: z.string().min(1).max(200),
  kind: z
    .enum([
      "file_exists",
      "file_contains",
      "file_parses",
      "workbook_cell_equals",
      "web_text_contains",
      "window_exists",
      "media_duration",
      "media_quality",
      "image_size",
      "scene_render",
      "script_runnable",
      "workbook_formula",
      "document_headings",
      "local_service_answers",
    ])
    .optional()
    .describe(
      "params — file_exists {path}: a file with content or a folder with something in it; file_contains {path,text}: " +
        "the words appear (letter case and spacing ignored); file_parses {path}: a JSON, Python, XML, TOML, INI or " +
        "CSV file is well-formed for its format (nothing is run); workbook_cell_equals {path,sheet,cell,value}; " +
        "web_text_contains {url,text}; window_exists {exe,text?}; media_duration {path,value}; " +
        "media_quality {path,value,width,height}: playable H.264/AAC stereo of exactly value seconds, at least " +
        "width x height, broadcast loudness, no long black or silent gap; image_size {path,width,height}; " +
        "scene_render {path}: a .png rendered from a valid saved 3D scene project; script_runnable {path}: a " +
        "script starts directly on macOS/Linux (#! line, Unix line endings, executable, parses; nothing is run); " +
        "workbook_formula {path,sheet,cell,value?}: the cell holds a formula, and its saved result is value; " +
        "document_headings {path,headings}: each text is a Title/Heading of the Word document or a slide title of the .pptx; " +
        "local_service_answers {port,text?}: a program on this computer answers http://127.0.0.1:port/ with status 200 " +
        "(and the text, when given)",
    ),
  params: z
    .strictObject({
      path: workspacePath.optional(),
      text: z.string().min(1).max(500).optional(),
      sheet: z.string().max(31).optional(),
      cell: z
        .string()
        .regex(/^[A-Z]{1,3}[0-9]{1,7}$/)
        .optional(),
      value: z.union([z.string().max(500), z.number()]).optional(),
      url: httpsUrl.optional(),
      exe: exe.optional(),
      width: z.int().min(1).max(16384).optional(),
      height: z.int().min(1).max(16384).optional(),
      headings: z.array(z.string().min(1).max(200)).min(1).max(20).optional(),
      port: z.int().min(1024).max(65535).optional(),
    })
    .optional(),
});
export type OutcomeCheck = z.infer<typeof outcomeCheck>;

/** New task acceptance rules must be executable and independently distinguishable. */
export const taskChecks = z
  .array(outcomeCheck.required({ kind: true, params: true }))
  .min(1)
  .max(6)
  .superRefine((checks, context) => {
    const ids = new Set<string>();
    const required = {
      file_exists: ["path"],
      file_contains: ["path", "text"],
      file_parses: ["path"],
      workbook_cell_equals: ["path", "sheet", "cell", "value"],
      web_text_contains: ["url", "text"],
      window_exists: ["exe"],
      media_duration: ["path", "value"],
      media_quality: ["path", "value", "width", "height"],
      script_runnable: ["path"],
      workbook_formula: ["path", "sheet", "cell"],
      document_headings: ["path", "headings"],
      local_service_answers: ["port"],
      image_size: ["path", "width", "height"],
      scene_render: ["path"],
    } as const;
    for (const [index, check] of checks.entries()) {
      if (ids.has(check.id))
        context.addIssue({ code: "custom", path: [index, "id"], message: "duplicate check id" });
      ids.add(check.id);
      for (const field of required[check.kind])
        if (check.params[field] === undefined)
          context.addIssue({
            code: "custom",
            path: [index, "params", field],
            message: "required for this check kind",
          });
      if (
        ["media_duration", "media_quality"].includes(check.kind) &&
        (typeof check.params.value !== "number" || check.params.value < 0)
      )
        context.addIssue({
          code: "custom",
          path: [index, "params", "value"],
          message: "duration must be a nonnegative number",
        });
    }
  });

/** The settlement record: every fixed check lands in exactly one list. */
const verificationResult = z.object({
  passed: z.array(z.string()),
  failed: z.array(z.string()),
  unverified: z.array(z.string()),
  evidence: evidence,
  verifierVersion: z.string().max(40),
});
export type VerificationResult = z.infer<typeof verificationResult>;

/** Device → server requests (signed). */
export const deviceRequest = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("enroll"),
      publicKey: z.string().regex(/^[A-Za-z0-9_-]{80,200}$/),
      name: z.string().trim().min(1).max(120),
      platform: z.string().trim().max(60),
      softwareVersion: z.string().trim().max(40),
    })
    .strict(),
  z.object({ op: z.literal("claim") }).strict(),
  z
    .object({
      op: z.literal("inventory"),
      apps: z.array(z.strictObject({ name: z.string().max(120), exe })).max(300),
      mcp: z
        .array(
          z.strictObject({
            id: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
            publisher: z.string().max(120),
            version: z.string().max(40),
            tools: z
              .array(
                z.strictObject({
                  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
                  risk: z.enum(RISKS),
                  description: z.string().max(200),
                  inputSchema: z.record(z.string(), z.unknown()),
                }),
              )
              .max(64),
          }),
        )
        .max(50)
        .default([]),
      engines: z.array(z.enum(ENGINES)).max(8).default([]),
    })
    .strict(),
  z.object({ op: z.literal("receipt"), activityId: z.uuid(), receipt: actionReceipt }).strict(),
]);

/** The machine-readable contract the companion validates against. */
export function protocolSchema() {
  return {
    version: PROTOCOL_VERSION,
    risks: RISKS,
    pureReads: PURE_READ_OPERATIONS,
    signing: { prefix: "OCADE-JARVIS-1", skewSeconds: 300 },
    operations: Object.fromEntries(
      Object.entries(OPERATIONS).map(([name, spec]) => [
        name,
        {
          role: spec.role,
          capability: spec.capability,
          risk: spec.risk,
          ...("seconds" in spec ? { seconds: spec.seconds } : {}),
          arguments: z.toJSONSchema(spec.arguments, { io: "input" }),
        },
      ]),
    ),
    receipt: z.toJSONSchema(actionReceipt, { io: "input" }),
  };
}
