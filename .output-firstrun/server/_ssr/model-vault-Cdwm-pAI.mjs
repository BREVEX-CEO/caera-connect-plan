import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as modelStore, t as ModelStore } from "./model-store-BPT0fGRD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/model-vault-Cdwm-pAI.js
var model_vault_Cdwm_pAI_exports = /* @__PURE__ */ __exportAll({
	n: () => model_vault_exports,
	t: () => modelVault
});
/**
* Versioned model storage: staging, activation, rollback and removal.
*
* WHAT WAS WRONG WITH ONE FILE PER MODEL.
*
* `model-store.ts` stores each engine under a single stable key. That is fine
* while there is exactly one version of one model and it never changes, and it
* fails at every interesting moment:
*
*  - An UPGRADE writes over the working engine. If the new one turns out to be
*    corrupt, the user is left with nothing — the failure destroyed the thing
*    that was working.
*  - A HALF-WRITTEN file is indistinguishable from a resumable one, because
*    "partial download" and "in-progress replacement" share a path.
*  - There is nothing to ROLL BACK TO, because the previous bytes are gone.
*
* THE FIX IS A POINTER, NOT A MOVE. Every version owns a directory named after
* its immutable identity, and ONE small pointer says which version is active.
* So:
*
*   activation  = write the pointer                     (one atomic write)
*   rollback    = write the pointer back                (one atomic write)
*   staging     = any version the pointer does not name (no special state)
*
* Nothing is ever copied or moved to promote a candidate, which is what makes
* promotion genuinely atomic rather than "atomic if the copy finishes". A
* candidate that fails verification is simply never pointed at, and the version
* that was working keeps working throughout — including while its replacement
* is downloading, and including if the browser is closed mid-upgrade.
*
* THE POINTER IS NEVER SET BY THE DOWNLOADER. Only `activate()` sets it, and
* only after the caller has proven the digest. That separation is the whole
* safety property: bytes on disk are inert until something with evidence says
* otherwise.
*/
var model_vault_exports = /* @__PURE__ */ __exportAll$1({
	ModelVault: () => ModelVault,
	modelVault: () => modelVault,
	versionPath: () => versionPath
});
/** Root directory inside OPFS. Sibling of the legacy flat layout. */
var VERSIONS_DIRECTORY = "versions";
var ACTIVE_POINTER_KEY = "ocade.model.active.v1";
var PREVIOUS_POINTER_KEY = "ocade.model.previous.v1";
var VERSION_META_PREFIX = "ocade.model.version.v1.";
function safeLocal() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
/**
* The file path for one version's artifact.
*
* `version` is the tier's immutable identity — change the model, the
* quantisation or the publisher's file and it changes — so two versions can
* never share a directory and an upgrade cannot collide with a cached copy of
* what it replaces.
*/
function versionPath(version, name) {
	return `${VERSIONS_DIRECTORY}/${sanitiseSegment(version)}/${sanitiseSegment(name)}`;
}
/**
* One segment of a storage path, with nothing in it that can escape.
*
* Version strings come from the committed catalogue and artifact names from a
* publisher URL. Neither is attacker-controlled today, and both are sanitised
* anyway: a path traversal in a storage key is not a bug anybody notices until
* it has already deleted something.
*/
function sanitiseSegment(value) {
	const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^\.+/, "");
	return cleaned.length > 0 ? cleaned.slice(0, 128) : "unnamed";
}
var ModelVault = class {
	store;
	storage;
	constructor(deps = {}) {
		this.store = deps.store ?? modelStore;
		this.storage = deps.storage ?? safeLocal();
	}
	static isSupported() {
		return ModelStore.isSupported();
	}
	/** The version currently authorised for use, or null when none is. */
	activeVersion() {
		return this.readPointer(ACTIVE_POINTER_KEY);
	}
	/** The version that was active before the current one. The rollback target. */
	previousVersion() {
		return this.readPointer(PREVIOUS_POINTER_KEY);
	}
	/**
	* Make a version the active one.
	*
	* REFUSES ANYTHING UNVERIFIED, and that refusal is the point of this whole
	* module. A caller that has not proven the digest cannot activate, no matter
	* how complete the file looks, so a truncated or substituted artifact has no
	* path to being loaded — it can only sit in storage until it is repaired or
	* removed.
	*/
	async activate(version) {
		if (!this.readMeta(version)?.verified) return false;
		const current = this.activeVersion();
		if (current === version) return true;
		if (current) this.writePointer(PREVIOUS_POINTER_KEY, current);
		this.writePointer(ACTIVE_POINTER_KEY, version);
		return true;
	}
	/**
	* Go back to the version that was active before.
	*
	* Only possible while the previous version's files are still present, which
	* is why `pruneTo` keeps one generation behind the active one rather than
	* deleting everything that is not current.
	*/
	async rollback() {
		const previous = this.previousVersion();
		if (!previous) return null;
		const meta = this.readMeta(previous);
		if (!meta?.verified) return null;
		if (await this.bytesOf(previous, meta) <= 0) return null;
		const current = this.activeVersion();
		this.writePointer(ACTIVE_POINTER_KEY, previous);
		if (current) this.writePointer(PREVIOUS_POINTER_KEY, current);
		else this.clearPointer(PREVIOUS_POINTER_KEY);
		return previous;
	}
	readMeta(version) {
		if (!this.storage) return null;
		try {
			const raw = this.storage.getItem(VERSION_META_PREFIX + version);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			return typeof parsed === "object" && parsed !== null ? parsed : null;
		} catch {
			return null;
		}
	}
	writeMeta(version, meta) {
		if (!this.storage) return;
		try {
			if (meta === null) this.storage.removeItem(VERSION_META_PREFIX + version);
			else this.storage.setItem(VERSION_META_PREFIX + version, JSON.stringify({
				...meta,
				updatedAt: Date.now()
			}));
		} catch {}
	}
	/** Merge a patch into a version's metadata without restating the rest. */
	patchMeta(version, patch) {
		const next = {
			...this.readMeta(version) ?? {
				verified: false,
				expectedBytes: null
			},
			...patch
		};
		this.writeMeta(version, next);
		return next;
	}
	async bytesOf(version, meta) {
		const name = artifactName(meta ?? this.readMeta(version), version);
		return this.store.sizeOf(versionPath(version, name));
	}
	/** The stored artifact for a version, as a Blob the runtime can load. */
	async readArtifact(version) {
		const meta = this.readMeta(version);
		return this.store.readBlob(versionPath(version, artifactName(meta, version)));
	}
	/** Delete one version's files and its metadata. */
	async removeVersion(version) {
		const meta = this.readMeta(version);
		const removed = await this.store.remove(versionPath(version, artifactName(meta, version)));
		this.writeMeta(version, null);
		if (this.activeVersion() === version) this.clearPointer(ACTIVE_POINTER_KEY);
		if (this.previousVersion() === version) this.clearPointer(PREVIOUS_POINTER_KEY);
		return removed;
	}
	/**
	* Everything stored under the versioned layout.
	*
	* Walks the real directory rather than the metadata index, so a version whose
	* metadata was lost — private mode, a cleared localStorage, a browser that
	* refuses storage — is still found and can still be repaired or removed. A
	* gigabyte the product cannot see is a gigabyte it cannot be honest about.
	*/
	async listVersions() {
		const active = this.activeVersion();
		const files = await this.store.list();
		const byVersion = /* @__PURE__ */ new Map();
		for (const file of files) {
			const parts = file.key.split("/");
			if (parts[0] !== VERSIONS_DIRECTORY || parts.length < 3) continue;
			byVersion.set(parts[1], (byVersion.get(parts[1]) ?? 0) + file.bytes);
		}
		return [...byVersion.entries()].map(([version, bytes]) => ({
			version,
			bytes,
			meta: this.readMeta(version),
			active: version === active
		})).sort((a, b) => a.version.localeCompare(b.version));
	}
	/**
	* Delete versions that are neither active nor the rollback target.
	*
	* Called after a successful activation. Keeping exactly one generation behind
	* is the trade: two copies of an engine is real disk, and having nothing to
	* fall back to when an upgrade turns out to be bad is worse.
	*/
	async pruneTo(keep) {
		const protectedVersions = new Set([
			...keep,
			this.activeVersion(),
			this.previousVersion()
		].filter((v) => typeof v === "string" && v.length > 0));
		const removed = [];
		for (const stored of await this.listVersions()) {
			if (protectedVersions.has(stored.version)) continue;
			if (await this.removeVersion(stored.version)) removed.push(stored.version);
		}
		return removed;
	}
	/**
	* Remove everything OCADE stores as local intelligence.
	*
	* Model artifacts, staging leftovers, version metadata and the pointers —
	* and NOTHING ELSE. Conversations, account data, site preferences and every
	* other origin's storage are untouched, because "remove the engine" and
	* "delete my account" are different requests and a control that quietly did
	* both would be the last one anybody trusted.
	*/
	async removeEverything() {
		const versions = await this.listVersions();
		let versionsRemoved = 0;
		for (const stored of versions) {
			if (await this.removeVersion(stored.version)) versionsRemoved += 1;
			this.writeMeta(stored.version, null);
		}
		this.clearPointer(ACTIVE_POINTER_KEY);
		this.clearPointer(PREVIOUS_POINTER_KEY);
		let legacyRemoved = 0;
		for (const file of await this.store.list()) {
			if (file.key.split("/")[0] === VERSIONS_DIRECTORY) continue;
			if (await this.store.remove(file.key)) legacyRemoved += 1;
		}
		return {
			versionsRemoved,
			legacyRemoved
		};
	}
	/**
	* Adopt a completed pre-versioning install as a version.
	*
	* Somebody who already downloaded the engine under the old flat layout must
	* not be made to download it again because OCADE reorganised its own storage.
	* The bytes are already there and already verified against the same digest,
	* so this records them as the active version.
	*
	* ONLY A VERIFIED LEGACY FILE IS ADOPTED. An unverified or partial one is
	* left where it is and the normal install path runs, because adopting bytes
	* on the strength of their length is exactly the shortcut that ships a
	* corrupt engine.
	*/
	async adoptLegacy(legacyKey, version, expectations) {
		if (this.readMeta(version)?.verified) return false;
		const legacyMeta = await this.store.readMeta(legacyKey);
		if (!legacyMeta?.verified) return false;
		if (expectations.sha256 && legacyMeta.sha256 && legacyMeta.sha256 !== expectations.sha256) return false;
		const bytes = await this.store.sizeOf(legacyKey);
		if (bytes <= 0) return false;
		const name = artifactName(null, version);
		if (!await this.store.movePath(legacyKey, versionPath(version, name))) return false;
		this.writeMeta(version, {
			verified: true,
			expectedBytes: expectations.expectedBytes ?? bytes,
			sha256: expectations.sha256 ?? legacyMeta.sha256
		});
		await this.activate(version);
		await this.store.writeMeta(legacyKey, null);
		return true;
	}
	/** Open a continuously-written file for one version's artifact. */
	async openWriter(version, name) {
		const meta = this.readMeta(version);
		return this.store.openWriter(versionPath(version, name ?? artifactName(meta, version)));
	}
	readPointer(key) {
		if (!this.storage) return null;
		try {
			const raw = this.storage.getItem(key);
			return raw && raw.length > 0 ? raw : null;
		} catch {
			return null;
		}
	}
	writePointer(key, value) {
		if (!this.storage) return;
		try {
			this.storage.setItem(key, value);
		} catch {}
	}
	clearPointer(key) {
		if (!this.storage) return;
		try {
			this.storage.removeItem(key);
		} catch {}
	}
};
/**
* The filename inside a version's directory.
*
* One artifact per version today, named for the version itself, so the
* directory is self-describing on a storage inspector and two versions can
* never produce the same path.
*/
function artifactName(meta, version) {
	return `${sanitiseSegment(version)}.bin`;
}
var modelVault = new ModelVault();
//#endregion
export { model_vault_Cdwm_pAI_exports as n, modelVault as t };
