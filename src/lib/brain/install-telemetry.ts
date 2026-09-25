/**
 * THE SHAPE OF AN INSTALL EVENT, AND NOTHING THAT STORES ONE.
 *
 * WHY THIS TYPE EXISTS. "Make it fast" is not a thing anybody can do without
 * knowing which stage is slow, and the stages have completely different fixes:
 * a slow device check is a probe doing too much, a slow transfer is a
 * distribution problem, a slow load is a runtime problem, and a high retry
 * count is a network problem masquerading as all three.
 *
 * WHAT IS DELIBERATELY NOT IN HERE, and cannot be added by accident. There is
 * no free-text field on any event. The union below is exhaustive and every
 * value is a number, a boolean, or a member of a small closed set. So there is
 * nowhere for a prompt, a conversation, a model's output, a file name, a URL,
 * or a user identifier to be put — not because a reviewer would notice, but
 * because the type would not compile.
 *
 * `reason` on the two failure events is the one string, and it is a message
 * this codebase wrote for a screen, never anything the user or the model
 * produced.
 *
 * THERE IS NO SINK HERE ANY MORE. This module used to keep a sixty-event ring
 * and a set of listeners, and nothing ever read the ring or subscribed to the
 * set — a bounded memory leak and a maintenance surface with no operational
 * value. The authority takes a `telemetry` dependency, so anything that wants
 * these events asks for them; until something does, they are not produced.
 */

export type InstallTelemetry =
  | { kind: "device_checked"; ms: number; paths: number }
  | { kind: "adopted_existing"; version: string }
  | {
      kind: "downloaded";
      version: string;
      ms: number;
      bytes: number;
      resumedBytes: number;
      retries: number;
      sourceKind: "ocade";
      ranged: boolean;
      concurrency: number;
      bytesPerSecond: number | null;
    }
  | { kind: "digest_mismatch"; version: string }
  | { kind: "loaded"; path: string; ms: number }
  | { kind: "threads"; path: string; multithreaded: boolean; threads: number }
  | { kind: "ready"; path: string; msFromStart: number | null }
  | { kind: "path_failed"; path: string; reason: string }
  | { kind: "failed"; stage: string; reason: string }
  | { kind: "uninstalled"; removed: number };
