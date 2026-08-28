//#region node_modules/.nitro/vite/services/ssr/assets/store-DGu3SiHe.js
var STORAGE_KEY = "ocade.artifacts.v1";
/**
* SHA-256 via Web Crypto, which exists in browsers and in Node 18+.
*
* Returns a refusal rather than falling back to a weaker hash when it isn't
* available: a digest that silently changed algorithm is worse than none,
* because stored and recomputed values would disagree for the wrong reason.
*/
async function sha256(text) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) return {
		ok: false,
		reason: "This device doesn't expose Web Crypto, so OCADE can't fingerprint the file. It won't substitute a weaker hash and call it the same thing."
	};
	const bytes = new TextEncoder().encode(text);
	const digest = await subtle.digest("SHA-256", bytes);
	const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return {
		ok: true,
		data: hex,
		evidence: `SHA-256 ${hex.slice(0, 12)}…`
	};
}
function read() {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable, so artifacts cannot be read."
	};
	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return {
			ok: true,
			data: [],
			evidence: "No artifacts stored."
		};
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return {
			ok: false,
			reason: "Artifact storage is corrupt. OCADE will not replace it or render it as an empty list."
		};
		const artifacts = parsed.map((artifact) => ({
			...artifact,
			privacyClass: artifact.privacyClass ?? "on_device",
			compatibleApps: Array.isArray(artifact.compatibleApps) && artifact.compatibleApps.length > 0 ? artifact.compatibleApps : compatibleAppsFor(artifact.kind)
		}));
		return {
			ok: true,
			data: artifacts,
			evidence: `${artifacts.length} artifacts read.`
		};
	} catch {
		return {
			ok: false,
			reason: "Artifact storage is corrupt. OCADE will not replace it or render it as an empty list."
		};
	}
}
function write(items) {
	try {
		const storage = globalThis.localStorage;
		if (!storage) return {
			ok: false,
			reason: "Browser storage is unavailable, so the artifact was not saved."
		};
		storage.setItem(STORAGE_KEY, JSON.stringify(items));
		return {
			ok: true,
			data: items.length,
			evidence: `${items.length} artifacts stored.`
		};
	} catch (e) {
		return {
			ok: false,
			reason: `The artifact couldn't be saved: ${e instanceof Error ? e.message : "storage refused it"}. Nothing was changed — delete an older artifact and try again.`
		};
	}
}
/** Store an artifact, fingerprinting its content as it goes. */
async function saveArtifact(input) {
	const name = input.name.trim();
	if (!name) return {
		ok: false,
		reason: "An artifact needs a name."
	};
	if (input.content.length === 0) return {
		ok: false,
		reason: `“${name}” has no content, so there is nothing to keep.`
	};
	if (!input.provenance.producedBy.trim()) return {
		ok: false,
		reason: "An artifact must record what produced it. OCADE won't store a file with no provenance — that's how an unchecked result becomes indistinguishable from a checked one."
	};
	const hash = await sha256(input.content);
	if (!hash.ok) return hash;
	const existingResult = read();
	if (!existingResult.ok) return existingResult;
	const existing = existingResult.data;
	const requestedAt = input.now ?? /* @__PURE__ */ new Date();
	const latestStoredMs = input.now ? Number.NEGATIVE_INFINITY : existing.reduce((latest, item) => {
		const parsed = Date.parse(item.createdAt);
		return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
	}, Number.NEGATIVE_INFINITY);
	const createdAtMs = input.now ? requestedAt.getTime() : Math.max(requestedAt.getTime(), latestStoredMs + 1);
	const artifact = {
		id: input.id ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name,
		kind: input.kind,
		content: input.content,
		createdAt: new Date(createdAtMs).toISOString(),
		provenance: input.provenance,
		sha256: hash.data,
		byteLength: new TextEncoder().encode(input.content).length,
		privacyClass: input.privacyClass ?? "on_device",
		compatibleApps: input.compatibleApps && input.compatibleApps.length > 0 ? [...new Set(input.compatibleApps.map((app) => app.trim()).filter(Boolean))].slice(0, 20) : compatibleAppsFor(input.kind),
		...input.context ? { context: input.context } : {},
		...input.expiresAt !== void 0 ? { expiresAt: input.expiresAt } : {}
	};
	const stored = write([artifact, ...existing]);
	if (!stored.ok) return stored;
	return {
		ok: true,
		data: artifact,
		evidence: input.provenance.verified ? `Saved “${name}” (${artifact.byteLength} bytes), produced by ${input.provenance.producedBy} and confirmed.` : `Saved “${name}” (${artifact.byteLength} bytes). NOT CONFIRMED: ${input.provenance.producedBy} could not verify this result.`
	};
}
function compatibleAppsFor(kind) {
	switch (kind) {
		case "gltf": return ["glTF-compatible 3D tools", "Blender"];
		case "patch": return ["Git", "text editors"];
		case "table": return ["spreadsheet apps", "text editors"];
		case "receipt": return ["OCADE Activity", "JSON/text viewers"];
		case "text": return ["text editors", "Markdown-compatible apps"];
	}
}
/** Strict read for UI/error boundaries that distinguish empty from corrupt. */
function inspectArtifactStore() {
	return read();
}
/**
* Remove one artifact.
*
* Reports whether it was actually there. A delete that returns success for an
* id that never existed lets a UI show "deleted" for something it didn't touch.
*/
function removeArtifact(id) {
	const beforeResult = read();
	if (!beforeResult.ok) return beforeResult;
	const before = beforeResult.data;
	const after = before.filter((a) => a.id !== id);
	if (after.length === before.length) return {
		ok: false,
		reason: "That artifact isn't here — nothing was deleted."
	};
	const stored = write(after);
	if (!stored.ok) return stored;
	return {
		ok: true,
		data: { removed: true },
		evidence: `Deleted. ${after.length} artifacts remain.`
	};
}
function setArtifactRetention(id, days, now = /* @__PURE__ */ new Date()) {
	if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return {
		ok: false,
		reason: "Retention must be between 1 and 3,650 days, or keep until deleted."
	};
	const stored = read();
	if (!stored.ok) return stored;
	const index = stored.data.findIndex((artifact) => artifact.id === id);
	if (index < 0) return {
		ok: false,
		reason: "That artifact isn't here."
	};
	const expiresAt = days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1e3).toISOString();
	const updated = {
		...stored.data[index],
		expiresAt
	};
	const next = [...stored.data];
	next[index] = updated;
	const saved = write(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: updated,
		evidence: expiresAt === null ? "Artifact will be kept until you delete it." : `Artifact will be eligible for deletion after ${expiresAt}.`
	};
}
function purgeExpiredArtifacts(now = /* @__PURE__ */ new Date()) {
	const stored = read();
	if (!stored.ok) return stored;
	const current = now.getTime();
	const remaining = stored.data.filter((artifact) => {
		if (!artifact.expiresAt) return true;
		const expiry = Date.parse(artifact.expiresAt);
		return !Number.isFinite(expiry) || expiry > current;
	});
	const removed = stored.data.length - remaining.length;
	if (removed === 0) return {
		ok: true,
		data: {
			removed: 0,
			remaining: remaining.length
		},
		evidence: "No expired artifacts were deleted."
	};
	const saved = write(remaining);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: {
			removed,
			remaining: remaining.length
		},
		evidence: `Deleted ${removed} expired artifact${removed === 1 ? "" : "s"}.`
	};
}
/**
* Re-hash an artifact's content and compare with what was stored.
*
* The hash is recomputed from the content, never read back and compared with
* itself — that version of the check passes on a truncated file, which is the
* case it exists to catch.
*/
async function verifyIntegrity(id) {
	const stored = read();
	if (!stored.ok) return stored;
	const artifact = stored.data.find((item) => item.id === id) ?? null;
	if (!artifact) return {
		ok: false,
		reason: "That artifact isn't here."
	};
	const actual = await sha256(artifact.content);
	if (!actual.ok) return actual;
	const intact = actual.data === artifact.sha256;
	return {
		ok: true,
		data: {
			intact,
			storedHash: artifact.sha256,
			actualHash: actual.data
		},
		evidence: intact ? `“${artifact.name}” is byte-for-byte what was written.` : `“${artifact.name}” has changed since it was stored. Expected ${artifact.sha256.slice(0, 12)}…, found ${actual.data.slice(0, 12)}…. Don't rely on it.`
	};
}
var EXTENSIONS = {
	gltf: "gltf",
	patch: "diff",
	table: "csv",
	text: "txt",
	receipt: "json"
};
function exportFilename(artifact) {
	return `${artifact.name.replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-") || "artifact"}.${EXTENSIONS[artifact.kind]}`;
}
/**
* One line describing an artifact for a list.
*
* An unverified artifact is labelled every single time it is shown, not once at
* creation — see the module header.
*/
function describeArtifact(a) {
	const base = `${a.byteLength < 1024 ? `${a.byteLength} B` : `${(a.byteLength / 1024).toFixed(1)} kB`} · from ${a.provenance.producedBy}`;
	return a.provenance.verified ? base : `${base} · NOT CONFIRMED`;
}
//#endregion
export { removeArtifact as a, sha256 as c, purgeExpiredArtifacts as i, verifyIntegrity as l, exportFilename as n, saveArtifact as o, inspectArtifactStore as r, setArtifactRetention as s, describeArtifact as t };
