/**
 * Types for `protocol.js`.
 *
 * The extension itself is plain JavaScript on purpose: Chrome loads it
 * unpacked, with no build step between the source and what runs, so what is
 * reviewed is exactly what executes. These declarations exist so the OCADE test
 * suite can import the SAME rules the executor enforces instead of restating
 * them — a restated rule that agrees with itself proves nothing.
 */

export const RUNNING: "running";
export const PAUSED: "paused";
export const STOPPED: "stopped";
export const HANDED_OVER: "handed_over";

export interface FieldDescriptor {
  type?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
}

/** True when the field is the user's to fill and OCADE must hand over. */
export function isProtectedField(field: FieldDescriptor): boolean;

/** True only when `url`'s ORIGIN is one the user approved. */
export function isAuthorized(url: string, approvedOrigins: readonly string[]): boolean;

/** Removes instruction-shaped text taken from a page, and counts what it removed. */
export function sanitisePageText(text: unknown): { text: string; injectionAttempts: number };

export const COMMANDS: Set<string>;
export const MUTATING: Set<string>;
