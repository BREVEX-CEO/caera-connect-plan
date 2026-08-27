import { n as supabase } from "./client-YIOAnk22.mjs";
import { a as setLockTimeout, s as unlockWith, t as applyStoredLockTimeout } from "./vault-session-Bh1128Qc.mjs";
import { _ as randomBytes, c as evaluatePrf, d as generateDek, f as generateRecoveryKey, g as parseRecoveryKit, h as keyFromMaterial, i as b64encode, l as exportRawKey, n as aesGcmEncrypt, o as createPrfCredential, p as importRawKey, r as b64decode, s as deriveKeyFromPassphrase, t as aesGcmDecrypt, u as formatRecoveryKit, v as sha256, y as webauthnPrfSupported } from "./vault-crypto-CDLLjPFZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vault-Ciia7Xhf.js
/**
* Vault lifecycle — setup, unlock, rotate, recovery.
*
* Wraps the Data Encryption Key with a Key Encryption Key derived from
* either a passphrase (PBKDF2-SHA256) or a WebAuthn PRF output. A
* one-time recovery key can always unwrap the DEK independently, and
* losing both means the encrypted browser data is unrecoverable — by
* design.
*/
async function loadVaultConfig(userId) {
	const { data, error } = await supabase.from("vault_config").select("*").eq("user_id", userId).maybeSingle();
	if (error) throw error;
	return data ?? null;
}
async function isVaultConfigured(userId) {
	return await loadVaultConfig(userId) !== null;
}
async function wrapDek(kek, dekRaw) {
	const { iv, ciphertext } = await aesGcmEncrypt(kek, dekRaw);
	return {
		wrapped: b64encode(ciphertext),
		iv: b64encode(iv)
	};
}
async function unwrapDek(kek, wrappedB64, ivB64) {
	return importRawKey(await aesGcmDecrypt(kek, b64decode(ivB64), b64decode(wrappedB64)));
}
async function setupWithPassphrase(userId, passphrase) {
	if (passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
	const dek = await generateDek();
	const dekRaw = await exportRawKey(dek);
	const salt = randomBytes(16);
	const iterations = 6e5;
	const wrap = await wrapDek(await deriveKeyFromPassphrase(passphrase, salt, iterations), dekRaw);
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
		last_rotated_at: (/* @__PURE__ */ new Date()).toISOString()
	});
	if (error) throw error;
	unlockWith(dek);
	return {
		recoveryKit: recovery.kit,
		credentialKind: "passphrase"
	};
}
async function setupWithWebAuthn(userId, label) {
	if (!webauthnPrfSupported()) throw new Error("WebAuthn is not available in this browser.");
	const prfSalt = randomBytes(32);
	const { credentialId, prfOutput } = await createPrfCredential(userId, label, prfSalt);
	const dek = await generateDek();
	const dekRaw = await exportRawKey(dek);
	const kekSalt = randomBytes(16);
	const wrap = await wrapDek(await keyFromMaterial(prfOutput, kekSalt), dekRaw);
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
		last_rotated_at: (/* @__PURE__ */ new Date()).toISOString()
	});
	if (error) throw error;
	unlockWith(dek);
	return {
		recoveryKit: recovery.kit,
		credentialKind: "webauthn_prf"
	};
}
async function buildRecoveryWrap(dekRaw) {
	const recoveryRaw = generateRecoveryKey();
	const salt = randomBytes(16);
	const { iv, ciphertext } = await aesGcmEncrypt(await keyFromMaterial(recoveryRaw, salt), dekRaw);
	const verifier = await sha256(recoveryRaw);
	return {
		wrapped: b64encode(ciphertext),
		iv: b64encode(iv),
		salt,
		verifier,
		kit: formatRecoveryKit(recoveryRaw)
	};
}
async function unlockWithPassphrase(userId, passphrase) {
	const cfg = await loadVaultConfig(userId);
	if (!cfg) throw new Error("No vault configured.");
	if (cfg.credential_kind !== "passphrase") throw new Error("This vault uses a different unlock method.");
	const dek = await unwrapDek(await deriveKeyFromPassphrase(passphrase, b64decode(cfg.kdf_salt), cfg.kdf_iterations), cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
		throw new Error("Wrong passphrase.");
	});
	applyStoredLockTimeout(cfg.lock_timeout_seconds);
	unlockWith(dek);
	await supabase.from("vault_config").update({ last_unlocked_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", userId);
}
async function unlockWithWebAuthn(userId) {
	const cfg = await loadVaultConfig(userId);
	if (!cfg || cfg.credential_kind !== "webauthn_prf" || !cfg.webauthn_credential_id || !cfg.webauthn_prf_salt) throw new Error("This vault does not use WebAuthn.");
	const dek = await unwrapDek(await keyFromMaterial(await evaluatePrf(b64decode(cfg.webauthn_credential_id), b64decode(cfg.webauthn_prf_salt)), b64decode(cfg.kdf_salt)), cfg.wrapped_dek, cfg.wrapped_dek_iv).catch(() => {
		throw new Error("Authenticator did not unlock this vault.");
	});
	applyStoredLockTimeout(cfg.lock_timeout_seconds);
	unlockWith(dek);
	await supabase.from("vault_config").update({ last_unlocked_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", userId);
}
async function unlockWithRecoveryKit(userId, kit) {
	const raw = parseRecoveryKit(kit);
	if (!raw) throw new Error("Recovery kit format is invalid.");
	const cfg = await loadVaultConfig(userId);
	if (!cfg || !cfg.recovery_wrapped_dek || !cfg.recovery_wrapped_dek_iv || !cfg.recovery_salt || !cfg.recovery_verifier) throw new Error("No recovery kit is registered on this vault.");
	if (b64encode(await sha256(raw)) !== cfg.recovery_verifier) throw new Error("Recovery kit does not match.");
	const dek = await unwrapDek(await keyFromMaterial(raw, b64decode(cfg.recovery_salt)), cfg.recovery_wrapped_dek, cfg.recovery_wrapped_dek_iv);
	applyStoredLockTimeout(cfg.lock_timeout_seconds);
	unlockWith(dek);
}
/** Re-wrap the SAME DEK with a fresh KEK — keeps existing ciphertext valid. */
async function rotatePassphrase(userId, next) {
	if (next.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
	if (!await loadVaultConfig(userId)) throw new Error("Vault not configured.");
	const salt = randomBytes(16);
	const iterations = 6e5;
	const kek = await deriveKeyFromPassphrase(next, salt, iterations);
	const { requireKey } = await import("./vault-session-Bh1128Qc.mjs").then((n) => n.c).then((n) => n.c);
	const wrap = await wrapDek(kek, await exportRawKey(requireKey()));
	const { error } = await supabase.from("vault_config").update({
		credential_kind: "passphrase",
		kdf_algo: "PBKDF2-SHA256",
		kdf_salt: b64encode(salt),
		kdf_iterations: iterations,
		wrapped_dek: wrap.wrapped,
		wrapped_dek_iv: wrap.iv,
		last_rotated_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("user_id", userId);
	if (error) throw error;
}
async function updateLockTimeout(userId, seconds) {
	if (!Number.isFinite(seconds)) throw new Error("Choose a valid auto-lock timeout.");
	const clamped = Math.min(86400, Math.max(60, Math.round(seconds)));
	const { error } = await supabase.from("vault_config").update({ lock_timeout_seconds: clamped }).eq("user_id", userId);
	if (error) throw error;
	setLockTimeout(clamped);
}
//#endregion
export { setupWithWebAuthn as a, unlockWithWebAuthn as c, setupWithPassphrase as i, updateLockTimeout as l, loadVaultConfig as n, unlockWithPassphrase as o, rotatePassphrase as r, unlockWithRecoveryKit as s, isVaultConfigured as t };
