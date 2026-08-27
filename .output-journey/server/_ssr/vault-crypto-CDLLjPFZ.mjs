//#region node_modules/.nitro/vite/services/ssr/assets/vault-crypto-CDLLjPFZ.js
/**
* Vault cryptography — AES-GCM for record encryption, PBKDF2-SHA256 for
* passphrase derivation, WebAuthn PRF extension for hardware-backed
* wrapping. Unwrapped Data Encryption Keys (DEKs) never leave memory.
*/
var enc = new TextEncoder();
var dec = new TextDecoder();
/** Copy a Uint8Array into a fresh ArrayBuffer so it satisfies SubtleCrypto's
*  strict BufferSource<ArrayBuffer> parameter (TS lib.dom no longer accepts
*  Uint8Array<ArrayBufferLike> after 5.6). */
function ab(u) {
	const out = new ArrayBuffer(u.byteLength);
	new Uint8Array(out).set(u);
	return out;
}
function b64encode(buf) {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}
function b64decode(s) {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function randomBytes(n) {
	const b = new Uint8Array(n);
	crypto.getRandomValues(b);
	return b;
}
async function generateDek() {
	return crypto.subtle.generateKey({
		name: "AES-GCM",
		length: 256
	}, true, ["encrypt", "decrypt"]);
}
async function exportRawKey(key) {
	return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
async function importRawKey(raw, usages = ["encrypt", "decrypt"]) {
	return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM" }, false, usages);
}
/** PBKDF2-SHA256 passphrase → 256-bit AES-GCM key. Iteration count is
*  stored per-user so we can raise it during rotation. */
async function deriveKeyFromPassphrase(passphrase, salt, iterations = 6e5) {
	const material = await crypto.subtle.importKey("raw", ab(enc.encode(passphrase)), { name: "PBKDF2" }, false, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "PBKDF2",
		salt: ab(salt),
		iterations,
		hash: "SHA-256"
	}, material, {
		name: "AES-GCM",
		length: 256
	}, false, [
		"encrypt",
		"decrypt",
		"wrapKey",
		"unwrapKey"
	]);
}
async function aesGcmEncrypt(key, plaintext, aad) {
	const iv = randomBytes(12);
	const alg = {
		name: "AES-GCM",
		iv: ab(iv)
	};
	if (aad) alg.additionalData = ab(aad);
	const ct = await crypto.subtle.encrypt(alg, key, ab(plaintext));
	return {
		iv,
		ciphertext: new Uint8Array(ct)
	};
}
async function aesGcmDecrypt(key, iv, ciphertext, aad) {
	const alg = {
		name: "AES-GCM",
		iv: ab(iv)
	};
	if (aad) alg.additionalData = ab(aad);
	const pt = await crypto.subtle.decrypt(alg, key, ab(ciphertext));
	return new Uint8Array(pt);
}
var jsonToBytes = (v) => enc.encode(JSON.stringify(v));
var bytesToJson = (b) => JSON.parse(dec.decode(b));
function webauthnPrfSupported() {
	return typeof PublicKeyCredential !== "undefined" && typeof navigator !== "undefined" && !!navigator.credentials;
}
async function createPrfCredential(userId, userLabel, prfSalt) {
	const cred = await navigator.credentials.create({ publicKey: {
		challenge: ab(randomBytes(32)),
		rp: { name: "CARCC CADANE" },
		user: {
			id: ab(enc.encode(userId)),
			name: userLabel,
			displayName: userLabel
		},
		pubKeyCredParams: [{
			type: "public-key",
			alg: -7
		}, {
			type: "public-key",
			alg: -257
		}],
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "required"
		},
		timeout: 6e4,
		extensions: { prf: { eval: { first: ab(prfSalt) } } }
	} });
	if (!cred) throw new Error("WebAuthn credential creation failed.");
	const first = cred.getClientExtensionResults().prf?.results?.first;
	if (!first) throw new Error("This authenticator does not support the PRF extension.");
	return {
		credentialId: new Uint8Array(cred.rawId),
		prfOutput: new Uint8Array(first)
	};
}
async function evaluatePrf(credentialId, prfSalt) {
	const assertion = await navigator.credentials.get({ publicKey: {
		challenge: ab(randomBytes(32)),
		allowCredentials: [{
			id: ab(credentialId),
			type: "public-key"
		}],
		userVerification: "required",
		timeout: 6e4,
		extensions: { prf: { eval: { first: ab(prfSalt) } } }
	} });
	if (!assertion) throw new Error("WebAuthn assertion failed.");
	const first = assertion.getClientExtensionResults().prf?.results?.first;
	if (!first) throw new Error("Authenticator did not return PRF output.");
	return new Uint8Array(first);
}
async function keyFromMaterial(material, salt) {
	const km = await crypto.subtle.importKey("raw", ab(material), "HKDF", false, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "HKDF",
		salt: ab(salt),
		hash: "SHA-256",
		info: ab(enc.encode("caera-vault-kek"))
	}, km, {
		name: "AES-GCM",
		length: 256
	}, false, ["encrypt", "decrypt"]);
}
function generateRecoveryKey() {
	return randomBytes(32);
}
var RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var RECOVERY_KEY_BYTES = 32;
var RECOVERY_CODE_CHARS = 52;
function formatRecoveryKit(raw) {
	if (raw.byteLength !== RECOVERY_KEY_BYTES) throw new Error("A recovery kit requires exactly 256 bits of key material.");
	let encoded = "";
	let buffer = 0;
	let bits = 0;
	for (const byte of raw) {
		buffer = buffer << 8 | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			encoded += RECOVERY_ALPHABET[buffer >>> bits & 31];
			buffer &= (1 << bits) - 1;
		}
	}
	if (bits > 0) encoded += RECOVERY_ALPHABET[buffer << 5 - bits & 31];
	return encoded.match(/.{1,4}/g)?.join("-") ?? encoded;
}
function parseRecoveryKit(text) {
	if (typeof text !== "string" || !/^[A-Za-z0-9\s-]+$/.test(text)) return null;
	const cleaned = text.replace(/[\s-]/g, "").toUpperCase();
	if (cleaned.length !== RECOVERY_CODE_CHARS) return null;
	const bytes = [];
	let buffer = 0;
	let bits = 0;
	for (const character of cleaned) {
		const value = RECOVERY_ALPHABET.indexOf(character);
		if (value < 0) return null;
		buffer = buffer << 5 | value;
		bits += 5;
		while (bits >= 8) {
			bits -= 8;
			bytes.push(buffer >>> bits & 255);
			buffer &= (1 << bits) - 1;
		}
	}
	if (bytes.length !== RECOVERY_KEY_BYTES || buffer !== 0) return null;
	return Uint8Array.from(bytes);
}
async function sha256(data) {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", ab(data)));
}
//#endregion
export { randomBytes as _, bytesToJson as a, evaluatePrf as c, generateDek as d, generateRecoveryKey as f, parseRecoveryKit as g, keyFromMaterial as h, b64encode as i, exportRawKey as l, jsonToBytes as m, aesGcmEncrypt as n, createPrfCredential as o, importRawKey as p, b64decode as r, deriveKeyFromPassphrase as s, aesGcmDecrypt as t, formatRecoveryKit as u, sha256 as v, webauthnPrfSupported as y };
