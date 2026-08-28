//#region node_modules/.nitro/vite/services/ssr/assets/model-store-BPT0fGRD.js
/**
* Where browser-side model weights live.
*
* OPFS (the Origin Private File System) rather than IndexedDB or Cache
* Storage, for reasons that matter at this size:
*
*  - It streams. A 400 MB GGUF can be written chunk by chunk and read back as
*    a Blob without ever holding the whole thing in memory. IndexedDB wants a
*    value; Cache Storage wants a Response. Both push you toward materialising
*    hundreds of megabytes at once, which is how a tab dies on a phone.
*  - It has real files. Resuming a partial download means knowing exactly how
*    many bytes are on disk, which is a `getSize()` call here and a
*    reconstruction exercise anywhere else.
*
* EVERY METHOD DEGRADES RATHER THAN THROWS. A browser without OPFS — or one in
* private mode that refuses it — must leave the product working, just without
* a browser engine. `isSupported()` is the honest gate and the adapters check
* it before promising anything.
*
* NOTHING HERE TALKS TO A SERVER. It is storage, not transfer.
*/
var MODEL_DIRECTORY = "ocade-models";
function opfsAvailable() {
	return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function" && typeof FileSystemFileHandle !== "undefined";
}
/**
* A writer over `createWritable`, batching commits into checkpoints.
*
* `keepExistingData: true` is what makes a resume possible: without it the
* swap file starts empty and committing would truncate everything already
* downloaded. Positioned writes mean chunks may arrive in any order, which is
* exactly what a parallel ranged transfer produces.
*/
var WritableFileWriter = class {
	handle;
	writable = null;
	dirty = false;
	constructor(handle) {
		this.handle = handle;
	}
	async open() {
		if (this.writable) return this.writable;
		try {
			this.writable = await this.handle.createWritable({ keepExistingData: true });
			return this.writable;
		} catch {
			return null;
		}
	}
	async write(chunk, at) {
		const writable = await this.open();
		if (!writable) return false;
		try {
			await writable.write({
				type: "write",
				position: at,
				data: chunk
			});
			this.dirty = true;
			return true;
		} catch {
			await this.discard();
			return false;
		}
	}
	async flush() {
		if (!this.writable || !this.dirty) return true;
		const writable = this.writable;
		this.writable = null;
		this.dirty = false;
		try {
			await writable.close();
			return true;
		} catch {
			return false;
		}
	}
	async close() {
		await this.flush();
	}
	async discard() {
		const writable = this.writable;
		this.writable = null;
		this.dirty = false;
		try {
			await writable?.abort();
		} catch {}
	}
};
/**
* A writer over `FileSystemSyncAccessHandle`, which is the fast path.
*
* Sync access handles write IN PLACE — no swap file, no commit-on-close — and
* expose an explicit `flush()`. That is precisely the shape this transfer
* wants, and it is the reason the installer runs inside a worker: the API is
* only available there.
*
* The handle is exclusive for as long as it is held, which is also why exactly
* one tab may install at a time. That constraint is enforced a level up by the
* installation authority's cross-tab lock rather than discovered here as a
* thrown exception.
*/
var SyncAccessWriter = class {
	handle;
	constructor(handle) {
		this.handle = handle;
	}
	async write(chunk, at) {
		try {
			this.handle.write(chunk, { at });
			return true;
		} catch {
			return false;
		}
	}
	async flush() {
		try {
			this.handle.flush();
			return true;
		} catch {
			return false;
		}
	}
	async close() {
		try {
			this.handle.flush();
		} catch {}
		try {
			this.handle.close();
		} catch {}
	}
};
var ModelStore = class {
	static isSupported() {
		return opfsAvailable();
	}
	async root() {
		if (!opfsAvailable()) return null;
		try {
			return await (await navigator.storage.getDirectory()).getDirectoryHandle(MODEL_DIRECTORY, { create: true });
		} catch {
			return null;
		}
	}
	/**
	* Ask the browser to stop evicting this data.
	*
	* Without it, weights live in "best effort" storage and can be cleared the
	* next time the device is short of space — so a user who downloaded 400 MB
	* on a train discovers it gone. The browser may refuse, and refusing is a
	* legitimate answer that gets reported rather than retried in a loop.
	*/
	async requestPersistence() {
		if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
		try {
			if (await navigator.storage.persisted?.()) return true;
			return await navigator.storage.persist();
		} catch {
			return false;
		}
	}
	/** Bytes already written for this key. 0 when absent — the resume offset. */
	async sizeOf(key) {
		const handle = await this.fileHandle(key, false);
		if (!handle) return 0;
		try {
			return (await handle.getFile()).size;
		} catch {
			return 0;
		}
	}
	async fileHandle(key, create) {
		const root = await this.root();
		if (!root) return null;
		const parts = key.split("/").filter(Boolean);
		const name = parts.pop();
		if (!name) return null;
		let dir = root;
		try {
			for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
			return await dir.getFileHandle(name, { create });
		} catch {
			return null;
		}
	}
	/**
	* Append bytes at the end of the stored file.
	*
	* `at` is passed explicitly rather than inferred so a caller resuming a
	* download cannot accidentally append to the wrong offset after a retry.
	*/
	async append(key, chunk, at) {
		const handle = await this.fileHandle(key, true);
		if (!handle) return false;
		try {
			const writable = await handle.createWritable({ keepExistingData: true });
			await writable.write({
				type: "write",
				position: at,
				data: chunk
			});
			await writable.close();
			return true;
		} catch {
			return false;
		}
	}
	/**
	* Open a file for continuous writing.
	*
	* Prefers a sync access handle — in place, explicitly flushable, and only
	* available inside a worker — and falls back to a checkpointed writable
	* everywhere else. Returns null when there is no storage to write to, which
	* the caller reports rather than working around.
	*/
	async openWriter(key) {
		const handle = await this.fileHandle(key, true);
		if (!handle) return null;
		const createSync = handle.createSyncAccessHandle;
		if (typeof createSync === "function") try {
			return new SyncAccessWriter(await createSync.call(handle));
		} catch {}
		return new WritableFileWriter(handle);
	}
	/**
	* Move a file to a different key, without reading it into memory.
	*
	* `FileSystemFileHandle.move()` where the browser has it — a metadata
	* operation on a gigabyte — and a streamed copy where it does not. The copy
	* reads and writes in bounded pieces for the reason everything else here
	* does: a whole-file `arrayBuffer()` on a phone kills the tab.
	*
	* The source is removed only after the destination is complete, so an
	* interruption leaves the original in place rather than nothing at all.
	*/
	async movePath(from, to) {
		const source = await this.fileHandle(from, false);
		if (!source) return false;
		const movable = source;
		const parts = to.split("/").filter(Boolean);
		const name = parts.pop();
		if (!name) return false;
		if (typeof movable.move === "function") try {
			const root = await this.root();
			if (root) {
				let dir = root;
				for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
				await movable.move(dir, name);
				return true;
			}
		} catch {}
		const writer = await this.openWriter(to);
		if (!writer) return false;
		try {
			const reader = (await source.getFile()).stream().getReader();
			let at = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (!await writer.write(value, at)) {
					await writer.close();
					await this.remove(to);
					return false;
				}
				at += value.length;
			}
			await writer.close();
		} catch {
			await writer.close();
			await this.remove(to);
			return false;
		}
		await this.remove(from);
		return true;
	}
	/** Read the whole model back, for handing to an engine. */
	async readBlob(key) {
		const handle = await this.fileHandle(key, false);
		if (!handle) return null;
		try {
			return await handle.getFile();
		} catch {
			return null;
		}
	}
	async remove(key) {
		const root = await this.root();
		if (!root) return false;
		const parts = key.split("/").filter(Boolean);
		const name = parts.pop();
		if (!name) return false;
		try {
			let dir = root;
			for (const part of parts) dir = await dir.getDirectoryHandle(part);
			await dir.removeEntry(name);
			await this.writeMeta(key, null);
			return true;
		} catch {
			return false;
		}
	}
	metaKey(key) {
		return `ocade.model.meta.${key}`;
	}
	async readMeta(key) {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(this.metaKey(key));
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}
	async writeMeta(key, meta) {
		if (typeof window === "undefined") return;
		try {
			if (meta === null) window.localStorage.removeItem(this.metaKey(key));
			else window.localStorage.setItem(this.metaKey(key), JSON.stringify(meta));
		} catch {}
	}
	/** Everything the storage settings page needs, with unknowns left unknown. */
	async report() {
		if (!opfsAvailable()) return {
			supported: false,
			persistent: false,
			usedBytes: null,
			quotaBytes: null,
			models: [],
			problem: "This browser does not provide the private file storage OCADE needs to keep a model between visits."
		};
		let usedBytes = null;
		let quotaBytes = null;
		try {
			const estimate = await navigator.storage.estimate();
			usedBytes = estimate.usage ?? null;
			quotaBytes = estimate.quota ?? null;
		} catch {}
		let persistent = false;
		try {
			persistent = await navigator.storage.persisted?.() ?? false;
		} catch {
			persistent = false;
		}
		return {
			supported: true,
			persistent,
			usedBytes,
			quotaBytes,
			models: await this.list()
		};
	}
	/** Every model file currently stored, walked depth-first. */
	async list() {
		const root = await this.root();
		if (!root) return [];
		const out = [];
		const walk = async (dir, prefix) => {
			const iterable = dir;
			for await (const [name, handle] of iterable.entries()) {
				const key = prefix ? `${prefix}/${name}` : name;
				if (handle.kind === "directory") await walk(handle, key);
				else try {
					const file = await handle.getFile();
					const meta = await this.readMeta(key);
					out.push({
						key,
						bytes: file.size,
						verified: meta?.verified ?? false
					});
				} catch {}
			}
		};
		try {
			await walk(root, "");
		} catch {
			return out;
		}
		return out.sort((a, b) => a.key.localeCompare(b.key));
	}
	/** Delete everything OCADE stored. Used by Settings › Storage. */
	async clear() {
		const models = await this.list();
		let removed = 0;
		for (const model of models) if (await this.remove(model.key)) removed += 1;
		return removed;
	}
};
var modelStore = new ModelStore();
//#endregion
export { modelStore as n, ModelStore as t };
