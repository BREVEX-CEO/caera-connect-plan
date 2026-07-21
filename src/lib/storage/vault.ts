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
  aesGcmDecrypt, aesGcmEncrypt, b64decode, b64encode,
  createPrfCredential, deriveKeyFromPassphrase, evaluatePrf,
  exportRawKey, formatRecoveryKit, generateDek, generateRecoveryKey,
  importRawKey, keyFromMaterial, parseRecoveryKit, randomBytes, sha256,
  webauthnPrfSupported,
} from "./vault-crypto";
import { lock, setLockTimeout, unlockWith } from "./vault-session";

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

export async function loadVaultConfig(userId: string): Promise<VaultRow | null> {
  const { data } = await supabase.from("vault_config").select("*").eq("user_id", userId).maybeSingle();
  return (data as VaultRow | null) ?? null;
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
  recoveryKit: string;      // display once, never stored
  credentialKind: "passphrase" | "webauthn_prf";
}

export async function setupWithPassphrase(userId: string, passphrase: string): Promise<SetupResult> {
  if (passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const dek = await generateDek();
  const dekRaw = await exportRawKey(dek);
  const salt = randomBytes(16);
  const iterations = 600_000;
  const kek = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  const wrap = await wrapDek(kek, dekRaw);
  const recovery = await buildRecoveryWrap(dekRaw);

  const { error } = await supabase.from("vault_config").upsert({
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

  const { error } = await supabase.from("vault_config").upsert({
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

// ---------- Unlock ----------

export async function unlockWithPassphrase(userId: string, passphrase: string): Promise<void> {
  const cfg = await loadVaultConfig(userId);
  if (!cfg) throw new Error("No vault configured.");
  if (cfg.credential_kind !== "passphrase") throw new Error("This vault uses a different unlock method.");
  const kek = await deriveKeyFromPassphrase(passphrase, b64decode(cfg.kdf_salt), cfg.kdf_iterations);
  const dek = await unwrapDek(kek, cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
    throw new Error("Wrong passphrase.");
  });
  setLockTimeout(cfg.lock_timeout_seconds);
  unlockWith(dek);
  await supabase.from("vault_config").update({ last_unlocked_at: new Date().toISOString() }).eq("user_id", userId);
}

export async function unlockWithWebAuthn(userId: string): Promise<void> {
  const cfg = await loadVaultConfig(userId);
  if (!cfg || cfg.credential_kind !== "webauthn_prf" || !cfg.webauthn_credential_id || !cfg.webauthn_prf_salt)
    throw new Error("This vault does not use WebAuthn.");
  const prf = await evaluatePrf(b64decode(cfg.webauthn_credential_id), b64decode(cfg.webauthn_prf_salt));
  const kek = await keyFromMaterial(prf, b64decode(cfg.kdf_salt));
  const dek = await unwrapDek(kek, cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
    throw new Error("Authenticator did not unlock this vault.");
  });
  setLockTimeout(cfg.lock_timeout_seconds);
  unlockWith(dek);
  await supabase.from("vault_config").update({ last_unlocked_at: new Date().toISOString() }).eq("user_id", userId);
}

export async function unlockWithRecoveryKit(userId: string, kit: string): Promise<void> {
  const raw = parseRecoveryKit(kit);
  if (!raw) throw new Error("Recovery kit format is invalid.");
  const cfg = await loadVaultConfig(userId);
  if (!cfg || !cfg.recovery_wrapped_dek || !cfg.recovery_wrapped_dek_iv || !cfg.recovery_salt || !cfg.recovery_verifier)
    throw new Error("No recovery kit is registered on this vault.");
  const verifier = await sha256(raw);
  if (b64encode(verifier) !== cfg.recovery_verifier) throw new Error("Recovery kit does not match.");
  const kek = await keyFromMaterial(raw, b64decode(cfg.recovery_salt));
  const dek = await unwrapDek(kek, cfg.recovery_wrapped_dek, cfg.recovery_wrapped_dek_iv);
  setLockTimeout(cfg.lock_timeout_seconds);
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
  const { error } = await supabase.from("vault_config").update({
    credential_kind: "passphrase",
    kdf_algo: "PBKDF2-SHA256",
    kdf_salt: b64encode(salt),
    kdf_iterations: iterations,
    wrapped_dek: wrap.wrapped,
    wrapped_dek_iv: wrap.iv,
    last_rotated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (error) throw error;
}

export async function updateLockTimeout(userId: string, seconds: number) {
  const clamped = Math.min(86400, Math.max(60, Math.round(seconds)));
  const { error } = await supabase.from("vault_config").update({ lock_timeout_seconds: clamped }).eq("user_id", userId);
  if (error) throw error;
  setLockTimeout(clamped);
}

export { lock } from "./vault-session";
export { isUnlocked, subscribe } from "./vault-session";
