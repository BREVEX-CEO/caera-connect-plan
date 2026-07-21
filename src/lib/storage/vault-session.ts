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

export function setLockTimeout(seconds: number) {
  timeoutMs = Math.max(60, seconds) * 1000;
  resetTimer();
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
