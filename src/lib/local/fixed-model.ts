/**
 * The fixed local model, per platform. One decision, made once.
 *
 * WHAT THIS REPLACES
 * ------------------
 * Selection used to be a negotiation with the hardware: `router-policy.ts`
 * filtered on `totalRamBytes`, excluded tiers without a discrete GPU, consulted
 * a benchmark ledger for the "fastest MEASURED model", and fell back to a
 * device-matched tier chosen by yet another policy. Four separate places could
 * change which model answered, and they disagreed with each other — the code
 * says so itself: "the router and the tier policy came to choose different
 * models for the same machine".
 *
 * Every one of those inputs is a proxy for a question nobody actually asked.
 * A user does not want the largest model that fits, or the fastest model
 * measured last Tuesday. They want OCADE to behave the same way on Monday as it
 * did on Friday, and the same way on their laptop as in the documentation.
 *
 * So the rule is now: THERE IS ONE MODEL, AND NOTHING CHOOSES.
 *
 *   every platform → Qwen2.5 3B, Q4_K_M, ~1.9 GB   (`qwen2.5:3b`)
 *
 * Images are the one exception, and it is capability, not preference: the fixed
 * engine is text-only, so a request carrying an image may use an installed
 * vision model (`qwen2.5vl:7b`). See "WHAT IS NOT TOUCHED" below.
 *
 * ONE MODEL RATHER THAN ONE PER FORM FACTOR, and that changed for a reason.
 * A desktop 8B and a mobile 1.7B meant Control + Work behaved differently on a
 * phone than on a laptop: the small model narrated actions instead of emitting
 * them, and the tool protocol that worked on one silently failed on the other.
 * A product whose central claim is "OCADE operates your computer" cannot have
 * that claim be true on some devices. So the same weights everywhere, and the
 * form factor decides only HOW the model is hosted — an HTTP runtime on a
 * desktop, an in-process build on a phone — never WHICH model answers.
 *
 * WHY 3B RATHER THAN THE 7B IT REPLACED. Measured on this machine: the 7B took
 * 138-183 s for a two-step Control + Work task and over two minutes just to
 * load. 1.9 GB rather than 4.7 GB is the difference between a model a phone can
 * host and one it cannot — and the whole point of a single model is that the
 * phone and the laptop run the same thing.
 *
 * WHY A NON-THINKING MODEL. This is the reverse of the earlier decision, and it
 * is measured, not stylistic: qwen3:4b cannot be stopped from reasoning, which
 * turned Control + Work tool calls into a two-minute wait or no tool call at
 * all. Qwen2.5 has no forced thinking block and supports Ollama tool calling.
 * The full numbers are under "WHY THIS IS QWEN2.5 AND NOT QWEN3" below.
 * `thinkingFor` still governs where deliberation is allowed and lives here so
 * the two halves of the decision cannot drift apart.
 *
 * WHAT IS DELIBERATELY KEPT
 * -------------------------
 * The four checks that are about SAFETY rather than preference, because
 * skipping them turns a clear setup screen into a silent failure:
 *
 *   1. platform            — which of the two models this install gets
 *   2. available storage   — can the download and its overhead land at all
 *   3. download integrity  — is what arrived what was published
 *   4. runtime + openable  — is there a runtime, and does it accept the file
 *
 * None of those choose BETWEEN models. They decide whether the one model this
 * platform gets can be installed and used, which is a different question.
 *
 * WHAT IS NOT TOUCHED
 * -------------------
 * Models the user already installed for their own reasons. OCADE lists them,
 * never deletes them, and never routes to them just because they are bigger,
 * newer or faster. The single exception is capability, not size: a request
 * carrying an image needs a model that can read images, and the fixed text
 * model cannot. That is a hard requirement — handing a picture to a text-only
 * model produces a confident answer about nothing — so vision requests may use
 * an installed vision model, and the receipt says plainly that it did.
 */

/** Platforms OCADE ships to. `linux` rides with desktop. */
export type OcadePlatform = "windows" | "macos" | "linux" | "android" | "ios";

export type OcadeFormFactor = "desktop" | "mobile";

/**
 * A runtime family, not a product.
 *
 * Named this way so the gateway stays uncoupled from one implementation: on
 * desktop any `gguf_http` runtime (Ollama, LM Studio, a bare llama.cpp server)
 * can serve the same spec, and mobile binds to an in-process llama.cpp build
 * because no such server exists on a phone and pretending otherwise is how a
 * mobile build ships broken.
 */
export type RuntimeKind = "gguf_http" | "gguf_embedded";

export interface FixedModelSpec {
  /** Runtime id, e.g. what `/api/tags` reports. Internal — never shown raw. */
  readonly id: string;
  /** Family name for display and for matching an equivalent local install. */
  readonly family: string;
  readonly parameters: string;
  readonly quantisation: "Q4_K_M";
  /**
   * Published size in bytes. Used for the storage preflight and for progress,
   * never as a selection input.
   */
  readonly approxBytes: number;
  readonly runtime: RuntimeKind;
  readonly formFactor: OcadeFormFactor;
  /** True only for models that can read images. Both fixed models are text. */
  readonly vision: false;
}

/**
 * ~1.9 GB. Every OCADE installation, on every platform, gets exactly this.
 *
 * The id is the runtime's own name for it and is never shown to a user; the
 * interface says "OCADE Local" and nothing else. Changing this constant changes
 * the model for the whole product, which is the point — there is no second
 * place to look.
 *
 * WHY THIS IS QWEN2.5 AND NOT QWEN3
 * ---------------------------------
 * qwen3:4b cannot be stopped from reasoning. Its chat template ends the
 * generation prompt with an unconditional `<think>` — no guard on the line —
 * so every single generation begins inside a reasoning block whatever the
 * request asks for, and Ollama's `think` field only decides which field the
 * reasoning is filed under. Driving `/api/generate` with `raw:true` and a
 * prompt that closes the block immediately did not help either: still 40
 * seconds of "Okay, let's see, the user wants..." before anything usable.
 *
 * For Chat that is a cost. For Control + Work it was a defect, because the
 * reasoning consumed the whole token budget before the tool call was written:
 *
 *     num_predict 300    no tool call at all      24 s
 *     num_predict 800    no tool call at all      83 s
 *     num_predict 2000   tool call, finally       125 s  (+94 s next turn)
 *
 * A tool call that never arrives is not a slow success. Qwen2.5 has no forced
 * thinking block, supports Ollama tool calling, and at 3B is smaller than the
 * model it replaces — so the reasoning tax disappears and the weights are
 * ~600 MB lighter to download on first run.
 *
 * `scripts/measure-thinking-modes.mjs` is how these numbers were taken, and
 * how to re-take them before changing this line again.
 */
export const OCADE_MODEL_ID = "qwen2.5:3b";

export const FIXED_MODEL: FixedModelSpec = {
  id: OCADE_MODEL_ID,
  family: "Qwen2.5",
  parameters: "3B",
  quantisation: "Q4_K_M",
  approxBytes: 1_929_000_000,
  runtime: "gguf_http",
  formFactor: "desktop",
  vision: false,
};

/**
 * The two rooms OCADE answers in, and the only thing that differs between them.
 */
export type OcadeSurface = "chat" | "control";

/**
 * Whether the model reasons before answering, per surface.
 *
 * THE `think` FIELD DOES NOT CONTROL THINKING ON THIS MODEL
 * ---------------------------------------------------------
 * Measured against qwen3:4b on the target machine with `scripts/measure-
 * thinking-modes.mjs`: three warm-up turns, five timed runs per mode, one
 * instruction ("Open Notepad") and one tool.
 *
 *   mode                       native tool_calls   median
 *   think:false                        0/5         22.4 s
 *   think:true                         0/5         21.2 s
 *   think omitted                      0/5         21.6 s
 *   /no_think in the system prompt     5/5         14.4 s
 *
 * Two things follow, and the second one was a live defect.
 *
 * First: the `think` field changes only WHERE the reasoning is put, never
 * whether it happens. `think:false` leaves ~865 characters of "Okay, the user
 * wants me to..." in `content`; `think:true` moves the same reasoning to the
 * separate `thinking` field. Neither is faster. The `/no_think` TOKEN is what
 * actually suppresses it, and doing so is ~35% quicker.
 *
 * Second: with reasoning on, this model narrates the tool call as prose
 * INSTEAD of emitting one. `ocade-local.ts` reads `message.tool_calls` and has
 * no content-JSON fallback, so those turns produced nothing to execute. The
 * agent turn shipped `think: false` and was therefore getting zero tool calls
 * from a model that looked, in the logs, like it was answering.
 *
 * An earlier revision of this comment concluded the opposite. It measured
 * whether `content` parsed as JSON, which the loop does not read.
 *
 * So: Control + Work suppresses thinking with the token, because a turn that
 * cannot be executed is not a slower success, it is a failure. Chat keeps it,
 * because a person is reading the answer and the reasoning improves it — and
 * there the reasoning goes to its own field, out of the reply.
 *
 * The real latency win for control is not this flag at all. It is not calling
 * the model: `work/fast-router.ts` answers deterministic instructions in under
 * a millisecond, against 14 s here.
 *
 * A FUNCTION, NOT A CONSTANT, because the day a model handles `think:false`
 * properly this is the one line to change — and the script above is how to
 * re-take the measurement before changing it.
 */
export function thinkingFor(surface: OcadeSurface, preference?: boolean): boolean {
  // Control never deliberates: it has to emit a call the loop can run.
  if (surface === "control") return false;
  // Chat is the user's choice, and deliberates unless they turn it off.
  return preference ?? true;
}

/**
 * Whether Ollama's `think` field may be sent for this model at all.
 *
 * IT MAY NOT, AND SENDING IT IS A 400 RATHER THAN A NO-OP.
 *
 *   POST /api/chat  {"model":"qwen2.5:3b","think":true}
 *   → 400 {"error":"\"qwen2.5:3b\" does not support thinking"}
 *
 * Qwen2.5 has no reasoning mode to switch, so Ollama rejects the field rather
 * than ignoring it. `think:false` happens to be accepted today, but relying on
 * one of two values being tolerated is relying on an implementation detail —
 * and the failure is a hard error that would take Chat down entirely, not a
 * degraded answer somebody notices later.
 *
 * So the field is not sent. This function exists so that decision is made in
 * one place with the evidence attached, rather than as an omission somebody
 * later "fixes" by adding the flag back.
 */
export function supportsThinkingField(modelId: string = OCADE_MODEL_ID): boolean {
  // Qwen3 accepts it (and ignores it in practice — see the note above).
  // Qwen2.5 rejects it outright. Anything unknown is assumed not to.
  return /^qwen3[:-]/i.test(modelId);
}

/**
 * The system-prompt clause that makes Chat's thinking switch a real thing.
 *
 * WHY A PROMPT CLAUSE AND NOT A FLAG
 * -----------------------------------
 * The switch has to change what the model is actually asked, or it is
 * decoration. On a model with a native reasoning mode the flag does that. On
 * qwen2.5 there is no such mode and the flag is refused, so the honest
 * equivalent is an instruction: it changes the request bytes, it changes the
 * answer, and the user can see the difference.
 *
 * Deliberately NOT "think step by step and show your working" — that produces
 * a wall of reasoning in the reply, which is the thing the reasoning field
 * existed to keep out. It asks for the deliberation to happen and the answer
 * to arrive whole.
 */
export function deliberationClause(thinking: boolean): string {
  return thinking
    ? " Work the question through carefully before answering, considering the" +
        " cases that could make a quick answer wrong. Give the reasoned answer" +
        " itself, not a transcript of arriving at it."
    : " Answer directly and briefly. Do not deliberate at length.";
}

/**
 * Qwen3's own suppression token.
 *
 * IT GOES IN THE SYSTEM MESSAGE, NEVER IN THE USER'S TEXT.
 *
 * Appending it to the prompt works equally well and cost a real bug: a search
 * once ran for the literal string "/no_think" because the token had been glued
 * onto the end of what the user typed and nothing downstream knew it was not
 * part of the query. Keeping it in the system message means user text is never
 * something that has to be cleaned up afterwards.
 */
export const NO_THINK_TOKEN = "/no_think";

/**
 * The system-message suffix that enforces `thinking` for one turn.
 *
 * Returns the token when reasoning must be off, and an empty string otherwise,
 * so callers can append unconditionally.
 */
export function thinkingSuffix(thinking: boolean): string {
  return thinking ? "" : ` ${NO_THINK_TOKEN}`;
}

export function formFactorOf(platform: OcadePlatform): OcadeFormFactor {
  return platform === "android" || platform === "ios" ? "mobile" : "desktop";
}

/**
 * The one function that says which model OCADE uses. It takes a platform and
 * ignores it for the WEIGHTS, using it only to say how they are hosted.
 *
 * Kept as a function rather than exporting the constant directly so every
 * caller keeps going through one place — and so the day a platform genuinely
 * cannot host this model, there is somewhere to say so rather than a constant
 * scattered through forty files.
 */
export function resolveFixedModel(platform: OcadePlatform): FixedModelSpec {
  const formFactor = formFactorOf(platform);
  if (formFactor === "desktop") return FIXED_MODEL;
  // Same weights, same quantisation, same id. A phone has no local HTTP model
  // server, so the runtime is in-process; that is a hosting difference, not a
  // different model, and the receipt reflects it as such.
  return { ...FIXED_MODEL, runtime: "gguf_embedded", formFactor: "mobile" };
}

/**
 * Detect the platform from the running environment.
 *
 * Capacitor is checked FIRST. A Capacitor app is a web view, so every
 * browser-shaped check below would answer "desktop" on a phone and hand a
 * 5 GB download to a device that cannot take it.
 */
export function detectPlatform(env?: {
  capacitorPlatform?: string | null;
  nodePlatform?: string | null;
  userAgent?: string | null;
}): OcadePlatform {
  const capacitor = env?.capacitorPlatform ?? readCapacitorPlatform();
  if (capacitor === "android") return "android";
  if (capacitor === "ios") return "ios";

  const node = env?.nodePlatform ?? readNodePlatform();
  if (node === "win32") return "windows";
  if (node === "darwin") return "macos";
  if (node === "linux") return "linux";

  const agent = (env?.userAgent ?? readUserAgent() ?? "").toLowerCase();
  if (/android/.test(agent)) return "android";
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  if (/mac os x|macintosh/.test(agent)) return "macos";
  if (/linux/.test(agent)) return "linux";
  return "windows";
}

function readCapacitorPlatform(): string | null {
  if (typeof globalThis === "undefined") return null;
  const capacitor = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const platform = capacitor?.getPlatform?.();
  return platform && platform !== "web" ? platform : null;
}

function readNodePlatform(): string | null {
  const proc = (globalThis as { process?: { platform?: string; versions?: { node?: string } } })
    .process;
  // `process` exists in some bundled browser shims without a real platform.
  return proc?.versions?.node && proc.platform ? proc.platform : null;
}

function readUserAgent(): string | null {
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent ?? null;
}

/* ------------------------------------------------------------ storage -- */

/**
 * Head-room multiplier over the published size.
 *
 * A download needs the finished file AND the partial file at the same time
 * during atomic promotion, plus manifest and chunk bookkeeping. Sizing the
 * check at exactly the model size passes the preflight and then fails at the
 * final rename, which is the worst possible moment — several gigabytes have
 * already been pulled over the user's connection.
 */
export const STORAGE_OVERHEAD_FACTOR = 1.35;
/** Never let a machine be filled to the last byte. */
export const STORAGE_FLOOR_BYTES = 1_073_741_824;

export interface StorageDecision {
  ok: boolean;
  requiredBytes: number;
  availableBytes: number;
  /** Zero when there is enough. Positive is the shortfall to explain. */
  shortfallBytes: number;
  reason?: string;
}

/**
 * Decide whether the fixed model can be installed here.
 *
 * Returns a shortfall rather than a boolean so the setup screen can say
 * "needs 7.1 GB, you have 4.3 GB, free up 2.8 GB" — the three numbers a person
 * needs in order to act. A bare "not enough space" makes them guess.
 */
export function storagePreflight(spec: FixedModelSpec, availableBytes: number): StorageDecision {
  const requiredBytes = Math.ceil(spec.approxBytes * STORAGE_OVERHEAD_FACTOR) + STORAGE_FLOOR_BYTES;
  if (!Number.isFinite(availableBytes) || availableBytes < 0) {
    return {
      ok: false,
      requiredBytes,
      availableBytes: 0,
      shortfallBytes: requiredBytes,
      reason: "The amount of free space on this device could not be read.",
    };
  }
  const shortfallBytes = Math.max(0, requiredBytes - availableBytes);
  if (shortfallBytes > 0) {
    return {
      ok: false,
      requiredBytes,
      availableBytes,
      shortfallBytes,
      reason: `OCADE needs ${formatBytes(requiredBytes)} to install its engine and this device has ${formatBytes(availableBytes)} free — ${formatBytes(shortfallBytes)} short.`,
    };
  }
  return { ok: true, requiredBytes, availableBytes, shortfallBytes: 0 };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/* -------------------------------------------------------- selection -- */

/** Minimum shape this module needs from an installed model listing. */
export interface InstalledModel {
  id: string;
  vision?: boolean;
  sizeBytes?: number;
  /** A ":cloud" pointer is a remote alias, not an on-device model. */
  isCloudPointer?: boolean;
}

export type FixedSelectionBasis =
  "fixed" | "fixed_vision_substitute" | "not_installed" | "vision_unavailable";

export interface FixedSelection {
  ok: boolean;
  /** The runtime id to send. Null when nothing can serve. */
  modelId: string | null;
  spec: FixedModelSpec;
  basis: FixedSelectionBasis;
  /** A sentence for the user when `ok` is false. Never an error code. */
  reason?: string;
  /**
   * Models present but not chosen, with why. Kept so a user who has ten models
   * installed and sees OCADE use one of them can find out why, without the
   * answer ever being "because it was the biggest".
   */
  notChosen: { modelId: string; why: string }[];
}

const NOT_CHOSEN_REASON = "OCADE always uses its own configured engine on this platform.";

/**
 * Choose the model for a request.
 *
 * Size, RAM, GPU and measured latency are not inputs and cannot be passed in.
 * The only branch is capability: an image needs a vision model.
 */
export function selectFixedModel(input: {
  platform: OcadePlatform;
  installed: InstalledModel[];
  visionRequired?: boolean;
}): FixedSelection {
  const spec = resolveFixedModel(input.platform);
  const usable = input.installed.filter((m) => !m.isCloudPointer);
  const notChosen = usable
    .filter((m) => m.id !== spec.id)
    .map((m) => ({ modelId: m.id, why: NOT_CHOSEN_REASON }));

  if (input.visionRequired) {
    /*
     * Capability, not preference. The fixed model is text-only, so a request
     * carrying an image either finds an installed vision model or is refused
     * with the reason — it is never quietly answered by a model that cannot
     * see the picture it was sent.
     */
    const vision = usable.find((m) => m.vision === true);
    if (!vision) {
      return {
        ok: false,
        modelId: null,
        spec,
        basis: "vision_unavailable",
        reason:
          "This request includes an image, and no engine on this device can read images. Install a vision engine, or remove the image.",
        notChosen,
      };
    }
    return {
      ok: true,
      modelId: vision.id,
      spec,
      basis: "fixed_vision_substitute",
      notChosen: notChosen.filter((m) => m.modelId !== vision.id),
    };
  }

  const present = usable.some((m) => m.id === spec.id);
  if (!present) {
    return {
      ok: false,
      modelId: null,
      spec,
      basis: "not_installed",
      reason: `OCADE's engine (${spec.family} ${spec.parameters}) is not installed on this device yet.`,
      notChosen,
    };
  }

  return { ok: true, modelId: spec.id, spec, basis: "fixed", notChosen };
}
