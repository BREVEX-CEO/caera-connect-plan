/**
 * THE canonical OCADE system prompt, and the only place it is loaded.
 *
 * WHY THIS FILE EXISTS. Five different places in this repository used to write
 * their own system message: the agent loop, the cloud chat route, the
 * signed-in chat screen (an inline template literal), the demo screen, and the
 * prompt-improver. They disagreed. The signed-in chat surface — the one real
 * customers use — carried an identity line and no safety policy at all, while
 * the safety policy sat in a module that surface never imported. A behavioural
 * constitution that only some surfaces load is not a constitution.
 *
 * So there is now one prompt, one loader and one assembler. Every surface that
 * talks to a model builds its system message here or does not build one.
 *
 * WHY `?raw` RATHER THAN A FETCH. The prompt has to be identical in the
 * browser bundle, the server bundle and the test runner, and it has to be
 * impossible for it to be missing at runtime. Inlining the bytes at build time
 * gives all three. A fetch would give a network dependency on the one thing
 * that must never depend on the network.
 */
import CANONICAL from "@/prompts/OCADE_SYSTEM_PROMPT.md?raw";

/**
 * The prompt exactly as written in `src/prompts/OCADE_SYSTEM_PROMPT.md`.
 *
 * Trailing whitespace is trimmed and nothing else is touched. Callers must not
 * edit, truncate, summarise or reorder it: the regression test compares what
 * arrives at the engine against this string, and any surface that alters it
 * fails that test by design.
 */
export const OCADE_SYSTEM_PROMPT: string = CANONICAL.trim();

/**
 * A short, stable fingerprint of the prompt.
 *
 * Used by tests and by the runtime health view to say *which* constitution is
 * loaded without printing 117 KB of it. Deliberately not a cryptographic
 * digest: this is an identity check between two copies in one process, not a
 * defence against an attacker who can already edit the bundle.
 */
export function promptFingerprint(text: string = OCADE_SYSTEM_PROMPT): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Length in characters. Cheap sanity check for "did the whole file load?". */
export const OCADE_SYSTEM_PROMPT_LENGTH = OCADE_SYSTEM_PROMPT.length;
