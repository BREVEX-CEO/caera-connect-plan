//#region node_modules/.nitro/vite/services/ssr/assets/update-signature-CRBJR1Bs.js
var HEX64 = /^[0-9a-f]{64}$/;
var ED25519_PUBLIC_KEY_BYTES = 32;
var ED25519_SIGNATURE_BYTES = 64;
function fromBase64(value) {
	if (typeof value !== "string" || value.trim().length === 0) return null;
	try {
		const binary = atob(value.trim());
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}
/**
* Verify a detached Ed25519 signature over an artifact digest.
*
* The signed message is the digest, not the artifact, so a caller never has to
* hold a whole installer in memory to check it. The digest MUST be the one
* computed from the bytes actually on disk — signing a digest supplied by the
* same party as the signature would prove nothing.
*/
async function verifyUpdateSignature(input) {
	const digest = input.artifactSha256?.trim().toLowerCase();
	if (!digest || !HEX64.test(digest)) return {
		ok: false,
		reason: "The artifact digest is not a valid SHA-256 hex string."
	};
	const publicKeyBytes = fromBase64(input.publicKeyBase64);
	if (!publicKeyBytes || publicKeyBytes.byteLength !== ED25519_PUBLIC_KEY_BYTES) return {
		ok: false,
		reason: `The signing public key is not a ${ED25519_PUBLIC_KEY_BYTES}-byte Ed25519 key. Refusing to verify against an unusable key.`
	};
	const signatureBytes = fromBase64(input.signatureBase64);
	if (!signatureBytes || signatureBytes.byteLength !== ED25519_SIGNATURE_BYTES) return {
		ok: false,
		reason: `The signature is not a ${ED25519_SIGNATURE_BYTES}-byte Ed25519 signature.`
	};
	try {
		const key = await crypto.subtle.importKey("raw", publicKeyBytes, { name: "Ed25519" }, false, ["verify"]);
		const message = new TextEncoder().encode(digest);
		if (!await crypto.subtle.verify({ name: "Ed25519" }, key, signatureBytes, message)) return {
			ok: false,
			reason: "The signature does not match this artifact under the shipped public key. The download was modified, or it was signed by someone else."
		};
		return {
			ok: true,
			evidence: `Ed25519 signature verified over SHA-256 ${digest.slice(0, 12)}… using the shipped public key.`
		};
	} catch (error) {
		return {
			ok: false,
			reason: `Signature verification could not complete: ${error instanceof Error ? error.message : "unknown error"}.`
		};
	}
}
//#endregion
export { verifyUpdateSignature as t };
