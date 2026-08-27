/**
 * Vault lifecycle — setup, unlock, rotate, recovery.
 *
 * Wraps the Data Encryption Key with a Key Encryption Key derived from
 * either a passphrase (PBKDF2-SHA256) or a WebAuthn PRF output. A
 * one-time recovery key can always unwrap the DEK independently, and
 * losing both means the encrypted browser data is unrecoverable — by
 * design.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  b64decode,
  b64encode,
  createPrfCredential,
  deriveKeyFromPassphrase,
  evaluatePrf,
  exportRawKey,
  formatRecoveryKit,
  generateDek,
  generateRecoveryKey,
  importRawKey,
  keyFromMaterial,
  parseRecoveryKit,
  randomBytes,
  sha256,
  webauthnPrfSupported,
} from "./vault-crypto";
import { applyStoredLockTimeout, lock, setLockTimeout, unlockWith } from "./vault-session";

type VaultRow = {
  user_id: string;
  credential_kind: "passphrase" | "webauthn_prf";
  kdf_algo: string;
  kdf_salt: string;
  kdf_iterations: number;
  wrapped_dek: string;
  wrapped_dek_iv: string;
  webauthn_credential_id: string | null;
  webauthn_prf_salt: string | null;
  recovery_wrapped_dek: string | null;
  recovery_wrapped_dek_iv: string | null;
  recovery_salt: string | null;
  recovery_verifier: string | null;
  lock_timeout_seconds: number;
};

/*
 * THE VAULT'S OWN CONFIGURATION HAS TO BE READABLE OFFLINE.
 *
 * Everything else about this vault is local: the ciphertext is in IndexedDB on
 * this machine, the key is derived on this machine, and the whole promise is
 * that the data is yours and here. The one piece that lived only in Supabase
 * was the row describing how to unwrap it — salt, iteration count, wrapped
 * DEK. So with the network down you could not unlock your own local data. The
 * product said "works offline" and meant "works offline, once you have been
 * online to ask permission".
 *
 * WHAT CACHING IT COSTS, STATED PLAINLY. This row is the material an offline
 * attacker would want: someone who takes the disk can now attempt passphrases
 * against the wrapped DEK without also holding an account session. That is a
 * real reduction, and it is the reduction the KDF exists to absorb — PBKDF2-
 * SHA256 at 600,000 iterations is chosen for exactly this threat, and the
 * recovery kit is a high-entropy random key rather than anything guessable.
 * It is also the bargain every offline-capable encrypted store makes; the
 * alternative on offer was not "safer", it was "unusable on a train".
 *
 * The cache is per user and is dropped when the vault is reconfigured, so a
 * rotated passphrase cannot be defeated by an older copy: `rotatePassphrase`
 * writes the new row through this same function.
 */
const CONFIG_CACHE = "ocade.vault.config.v1";

function cacheKey(userId: string) {
  return `${CONFIG_CACHE}:${userId}`;
}

function cachedConfig(userId: string): VaultRow | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as VaultRow) : null;
  } catch {
    return null;
  }
}

function cacheConfig(userId: string, row: VaultRow | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (row) localStorage.setItem(cacheKey(userId), JSON.stringify(row));
    else localStorage.removeItem(cacheKey(userId));
  } catch {
    /* Private browsing or a full quota: the online path still works. */
  }
}

export async function loadVaultConfig(userId: string): Promise<VaultRow | null> {
  /*
   * Known to be offline and there is a copy here: use it rather than waiting
   * for a request that cannot succeed. A stale row is not a risk — a rotated
   * passphrase rewrites this cache at the moment it rotates.
   */
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const offline = cachedConfig(userId);
    if (offline) return offline;
  }
  try {
    const { data, error } = await supabase
      .from("vault_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = (data as VaultRow | null) ?? null;
    /*
     * Only remember a positive answer. "No row" from an unreachable server is
     * indistinguishable from "no vault", and writing that down would delete
     * somebody's ability to unlock while they are on a train.
     */
    if (row) cacheConfig(userId, row);
    return row;
  } catch (cause) {
    const offline = cachedConfig(userId);
    if (offline) return offline;
    throw cause;
  }
}

export async function isVaultConfigured(userId: string): Promise<boolean> {
  return (await loadVaultConfig(userId)) !== null;
}

async function wrapDek(kek: CryptoKey, dekRaw: Uint8Array) {
  const { iv, ciphertext } = await aesGcmEncrypt(kek, dekRaw);
  return { wrapped: b64encode(ciphertext), iv: b64encode(iv) };
}
async function unwrapDek(kek: CryptoKey, wrappedB64: string, ivB64: string): Promise<CryptoKey> {
  const raw = await aesGcmDecrypt(kek, b64decode(ivB64), b64decode(wrappedB64));
  return importRawKey(raw);
}

// ---------- Setup ----------

export interface SetupResult {
  recoveryKit: string; // display once, never stored
  credentialKind: "passphrase" | "webauthn_prf";
}

export async function setupWithPassphrase(
  userId: string,
  passphrase: string,
): Promise<SetupResult> {
  if (passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const dek = await generateDek();
  const dekRaw = await exportRawKey(dek);
  const salt = randomBytes(16);
  const iterations = 600_000;
  const kek = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  const wrap = await wrapDek(kek, dekRaw);
  const recovery = await buildRecoveryWrap(dekRaw);

  const { error } = await supabase.from("vault_config").insert({
    user_id: userId,
    credential_kind: "passphrase",
    kdf_algo: "PBKDF2-SHA256",
    kdf_salt: b64encode(salt),
    kdf_iterations: iterations,
    wrapped_dek: wrap.wrapped,
    wrapped_dek_iv: wrap.iv,
    webauthn_credential_id: null,
    webauthn_prf_salt: null,
    recovery_wrapped_dek: recovery.wrapped,
    recovery_wrapped_dek_iv: recovery.iv,
    recovery_salt: b64encode(recovery.salt),
    recovery_verifier: b64encode(recovery.verifier),
    last_rotated_at: new Date().toISOString(),
  });
  if (error) throw error;
  unlockWith(dek);
  return { recoveryKit: recovery.kit, credentialKind: "passphrase" };
}

export async function setupWithWebAuthn(userId: string, label: string): Promise<SetupResult> {
  if (!webauthnPrfSupported()) throw new Error("WebAuthn is not available in this browser.");
  const prfSalt = randomBytes(32);
  const { credentialId, prfOutput } = await createPrfCredential(userId, label, prfSalt);
  const dek = await generateDek();
  const dekRaw = await exportRawKey(dek);
  const kekSalt = randomBytes(16);
  const kek = await keyFromMaterial(prfOutput, kekSalt);
  const wrap = await wrapDek(kek, dekRaw);
  const recovery = await buildRecoveryWrap(dekRaw);

  const { error } = await supabase.from("vault_config").insert({
    user_id: userId,
    credential_kind: "webauthn_prf",
    kdf_algo: "HKDF-SHA256",
    kdf_salt: b64encode(kekSalt),
    kdf_iterations: 1,
    wrapped_dek: wrap.wrapped,
    wrapped_dek_iv: wrap.iv,
    webauthn_credential_id: b64encode(credentialId),
    webauthn_prf_salt: b64encode(prfSalt),
    recovery_wrapped_dek: recovery.wrapped,
    recovery_wrapped_dek_iv: recovery.iv,
    recovery_salt: b64encode(recovery.salt),
    recovery_verifier: b64encode(recovery.verifier),
    last_rotated_at: new Date().toISOString(),
  });
  if (error) throw error;
  unlockWith(dek);
  return { recoveryKit: recovery.kit, credentialKind: "webauthn_prf" };
}

async function buildRecoveryWrap(dekRaw: Uint8Array) {
  const recoveryRaw = generateRecoveryKey();
  const salt = randomBytes(16);
  const kek = await keyFromMaterial(recoveryRaw, salt);
  const { iv, ciphertext } = await aesGcmEncrypt(kek, dekRaw);
  const verifier = await sha256(recoveryRaw);
  return {
    wrapped: b64encode(ciphertext),
    iv: b64encode(iv),
    salt,
    verifier,
    kit: formatRecoveryKit(recoveryRaw),
  };
}

/**
 * Record that the vault was opened. Deliberately not awaited by the unlock.
 *
 * This is a timestamp for the user's own security log, and it used to sit
 * behind an `await` at the end of every unlock path. The key was already in
 * memory by then and the data already readable, so a failed or hanging write
 * could not undo the unlock — it could only make a successful unlock look like
 * a failure, which is exactly what happened with no network: the vault opened
 * and the panel said it had not.
 */
function touchLastUnlocked(userId: string) {
  return Promise.resolve(
    supabase
      .from("vault_config")
      .update({ last_unlocked_at: new Date().toISOString() })
      .eq("user_id", userId),
  ).catch(() => {
    /* Offline, or the row is gone. Neither changes that the vault is open. */
  });
}

// ---------- Unlock ----------

export async function unlockWithPassphrase(userId: string, passphrase: string): Promise<void> {
  const cfg = await loadVaultConfig(userId);
  if (!cfg) throw new Error("No vault configured.");
  if (cfg.credential_kind !== "passphrase")
    throw new Error("This vault uses a different unlock method.");
  const kek = await deriveKeyFromPassphrase(
    passphrase,
    b64decode(cfg.kdf_salt),
    cfg.kdf_iterations,
  );
  const dek = await unwrapDek(kek, cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
    throw new Error("Wrong passphrase.");
  });
  applyStoredLockTimeout(cfg.lock_timeout_seconds);
  unlockWith(dek);
  void touchLastUnlocked(userId);
}

export async function unlockWithWebAuthn(userId: string): Promise<void> {
  const cfg = await loadVaultConfig(userId);
  if (
    !cfg ||
    cfg.credential_kind !== "webauthn_prf" ||
    !cfg.webauthn_credential_id ||
    !cfg.webauthn_prf_salt
  )
    throw new Error("This vault does not use WebAuthn.");
  const prf = await evaluatePrf(
    b64decode(cfg.webauthn_credential_id),
    b64decode(cfg.webauthn_prf_salt),
  );
  const kek = await keyFromMaterial(prf, b64decode(cfg.kdf_salt));
  const dek = await unwrapDek(kek, cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
    throw new Error("Authenticator did not unlock this vault.");
  });
  applyStoredLockTimeout(cfg.lock_timeout_seconds);
  unlockWith(dek);
  void touchLastUnlocked(userId);
}

export async function unlockWithRecoveryKit(userId: string, kit: string): Promise<void> {
  const raw = parseRecoveryKit(kit);
  if (!raw) throw new Error("Recovery kit format is invalid.");
  const cfg = await loadVaultConfig(userId);
  if (
    !cfg ||
    !cfg.recovery_wrapped_dek ||
    !cfg.recovery_wrapped_dek_iv ||
    !cfg.recovery_salt ||
    !cfg.recovery_verifier
  )
    throw new Error("No recovery kit is registered on this vault.");
  const verifier = await sha256(raw);
  if (b64encode(verifier) !== cfg.recovery_verifier)
    throw new Error("Recovery kit does not match.");
  const kek = await keyFromMaterial(raw, b64decode(cfg.recovery_salt));
  const dek = await unwrapDek(kek, cfg.recovery_wrapped_dek, cfg.recovery_wrapped_dek_iv);
  applyStoredLockTimeout(cfg.lock_timeout_seconds);
  unlockWith(dek);
}

// ---------- Rotate ----------

/** Re-wrap the SAME DEK with a fresh KEK — keeps existing ciphertext valid. */
export async function rotatePassphrase(userId: string, next: string): Promise<void> {
  if (next.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const cfg = await loadVaultConfig(userId);
  if (!cfg) throw new Error("Vault not configured.");
  // Requires an unlocked session — read DEK back out.
  const salt = randomBytes(16);
  const iterations = 600_000;
  const kek = await deriveKeyFromPassphrase(next, salt, iterations);
  const { requireKey } = await import("./vault-session");
  const dekRaw = await exportRawKey(requireKey());
  const wrap = await wrapDek(kek, dekRaw);
  const { error } = await supabase
    .from("vault_config")
    .update({
      credential_kind: "passphrase",
      kdf_algo: "PBKDF2-SHA256",
      kdf_salt: b64encode(salt),
      kdf_iterations: iterations,
      wrapped_dek: wrap.wrapped,
      wrapped_dek_iv: wrap.iv,
      last_rotated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
  // The cached copy describes how to unwrap, and it no longer does.
  cacheConfig(userId, {
    ...cfg,
    credential_kind: "passphrase",
    kdf_algo: "PBKDF2-SHA256",
    kdf_salt: b64encode(salt),
    kdf_iterations: iterations,
    wrapped_dek: wrap.wrapped,
    wrapped_dek_iv: wrap.iv,
  });
}

export async function updateLockTimeout(userId: string, seconds: number) {
  if (!Number.isFinite(seconds)) throw new Error("Choose a valid auto-lock timeout.");
  const clamped = Math.min(86400, Math.max(60, Math.round(seconds)));
  const { error } = await supabase
    .from("vault_config")
    .update({ lock_timeout_seconds: clamped })
    .eq("user_id", userId);
  if (error) throw error;
  setLockTimeout(clamped);
}

export { lock } from "./vault-session";
export { isUnlocked, subscribe } from "./vault-session";
