/**
 * In-memory holder for the unwrapped Browser Only Data Encryption Key.
 *
 * The DEK never touches disk, never syncs to Supabase, and auto-locks after
 * inactivity. Any storage write for a browser-only data class routes through
 * this holder — a locked vault surfaces a StorageLockedError instead of
 * silently falling back to plaintext.
 */

import { StorageLockedError } from "./types";

type Listener = () => void;

let dek: CryptoKey | null = null;
let timeoutMs = 15 * 60 * 1000;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

function resetTimer() {
  if (timer) clearTimeout(timer);
  if (dek) timer = setTimeout(() => lock(), timeoutMs);
}

/** The schema's own default, so code and database agree on one number. */
export const DEFAULT_LOCK_TIMEOUT_SECONDS = 900;

/**
 * Set the auto-lock delay from a value a PERSON chose. Strict on purpose:
 * silently accepting nonsense from a settings field hides a broken control.
 */
export function setLockTimeout(seconds: number) {
  if (!Number.isFinite(seconds)) throw new Error("The vault lock timeout is invalid.");
  timeoutMs = Math.max(60, seconds) * 1000;
  resetTimer();
}

/**
 * Set it from a STORED value, which is a different situation entirely.
 *
 * The unlock paths read this column out of the vault's configuration row and
 * fed it straight to the strict setter, at the very end of unlocking — after
 * the key had been derived and the data was already reachable. A row whose
 * timeout was missing or malformed therefore threw, the unlock was abandoned,
 * and the person was told "The vault lock timeout is invalid": a sentence
 * about a preference, in answer to "let me at my work". They cannot fix it,
 * cannot see what it refers to, and every retry fails the same way.
 *
 * The database defaults this column and constrains it, so in practice it is
 * always a sane number. In practice is not the same as always — an older row,
 * a partially-applied migration, a different backend — and none of those are
 * worth locking somebody out of their own encrypted data over. An unusable
 * value falls back to the default here; the auto-lock still happens, on the
 * schema's own timing, and the unlock completes.
 */
export function applyStoredLockTimeout(seconds: unknown) {
  const usable =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 60 && seconds <= 86_400;
  setLockTimeout(usable ? seconds : DEFAULT_LOCK_TIMEOUT_SECONDS);
}

export function unlockWith(key: CryptoKey) {
  dek = key;
  resetTimer();
  notify();
}

export function lock() {
  dek = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  notify();
}

export function isUnlocked(): boolean {
  return dek !== null;
}

export function requireKey(): CryptoKey {
  if (!dek) throw new StorageLockedError();
  resetTimer();
  return dek;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Any user gesture inside the app pokes the timer so an active session
// doesn't lock while the user is working.
if (typeof window !== "undefined") {
  const bump = () => {
    if (dek) resetTimer();
  };
  window.addEventListener("pointerdown", bump, { passive: true });
  window.addEventListener("keydown", bump, { passive: true });
}
