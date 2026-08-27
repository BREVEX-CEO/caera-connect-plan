import { n as assertInsideRoot, r as assertNotProtected } from "./local-files-pack-DE27j354.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/manager-C7eiJjX5.js
/**
* File management operations OCADE can perform on a real machine (G1-G4).
*
* WHAT ALREADY EXISTED
* --------------------
* `skills/packs/local-files-pack.ts` covers list, read, write, rename, mkdir
* and delete, with two safety properties worth keeping and reusing rather than
* reimplementing: `assertInsideRoot` resolves BOTH sides with realpath (so a
* symlink cannot escape an approved folder), and writes refuse to overwrite
* unless asked.
*
* WHAT THIS ADDS
* --------------
*   search        - find files without loading a whole tree into memory
*   copy          - with content verified by hash, not by "no error thrown"
*   trash/restore - deletion that is genuinely reversible
*   protected     - a denylist so an approved root inside C:\Windows is still refused
*   batch + stop  - a long operation that can be halted and then reports the truth
*
* THREE RULES THIS MODULE WILL NOT BEND
*
* 1. **An operation is not complete because the OS returned success.** Every
*    mutation is confirmed by reading the result back, and copies are confirmed
*    by comparing content hashes. `rename()` returning without throwing tells
*    you the call was accepted, not that the bytes are where you think.
* 2. **Deletion is reversible or it is refused.** Files move to a trash folder
*    with a manifest recording where they came from and what they hashed to.
*    Nothing here can permanently destroy a file.
* 3. **A stopped batch reports exactly what it did.** Emergency stop leaves a
*    partially-completed operation, and the caller is told precisely which
*    items completed, which did not, and that the state is partial. Reporting
*    "cancelled" without that list is how people lose track of their own data.
*/
var norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
/**
* Turn an OS error into something a person can act on.
*
* "The file could not be read" is true and useless: it does not tell someone
* their document is open in Word. EBUSY and EPERM on a file that plainly exists
* mean another program is holding it, and saying so is the difference between a
* user closing an app and a user filing a bug.
*/
function describeAccessFailure(error, path, verb) {
	const code = error?.code ?? "";
	const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
	if (code === "EBUSY" || code === "EPERM" || code === "EACCES") return `"${name}" is locked by another program, so OCADE could not ${verb} it. Close whatever has it open and try again — nothing was changed.`;
	if (code === "ENOENT") return `"${name}" no longer exists.`;
	return `"${name}" could not be ${verb === "read" ? "read" : "moved"}${code ? ` (${code})` : ""}.`;
}
/**
* Scope check plus protected check.
*
* `assertInsideRoot` now applies the denylist itself, so this is belt and
* braces — but it stays explicit here because these two rules are the entire
* safety story for this module, and a future refactor of one should not be able
* to silently remove the other.
*/
async function guard(fs, root, target) {
	const scope = await assertInsideRoot(fs, root, target);
	if (!scope.ok) return scope;
	const protectedCheck = assertNotProtected(scope.resolved);
	if (!protectedCheck.ok) return {
		ok: false,
		reason: protectedCheck.reason
	};
	return scope;
}
/**
* Find files under an approved root.
*
* Bounded on purpose: a search with no limit on a large tree is a memory
* problem waiting to happen, and an unbounded depth follows directory
* structures nobody intended to walk.
*/
async function searchFiles(fs, root, options) {
	const scope = await assertInsideRoot(fs, root, root);
	if (!scope.ok) return {
		ok: false,
		reason: scope.reason
	};
	const limit = options.limit ?? 500;
	const maxDepth = options.maxDepth ?? 12;
	const test = (name) => typeof options.match === "string" ? name.toLowerCase().includes(options.match.toLowerCase()) : options.match.test(name);
	const hits = [];
	let truncated = false;
	async function walk(dir, depth) {
		if (depth > maxDepth || hits.length >= limit || options.signal?.aborted) return;
		let entries;
		try {
			entries = await fs.readdirTyped(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (options.signal?.aborted) return;
			if (hits.length >= limit) {
				truncated = true;
				return;
			}
			const full = `${dir}/${entry.name}`;
			if (entry.isDirectory) await walk(full, depth + 1);
			else if (entry.isFile && test(entry.name)) try {
				const st = await fs.stat(full);
				hits.push({
					path: full,
					sizeBytes: st.size
				});
			} catch {}
		}
	}
	await walk(norm(root), 0);
	return {
		ok: true,
		hits,
		truncated
	};
}
/**
* Copy a file and prove the copy is identical.
*
* The hash comparison is the point. A copy that "succeeded" but produced
* different bytes — truncated by a full disk, mangled by an encoding layer —
* is worse than one that failed loudly, because nothing announces it.
*/
async function copyFileVerified(fs, root, from, to, opts = {}) {
	for (const p of [from, to]) {
		const g = await guard(fs, root, p);
		if (!g.ok) return {
			ok: false,
			reason: g.reason
		};
	}
	if (!opts.overwrite && await fs.exists(to)) return {
		ok: false,
		reason: "Something already exists at the destination. OCADE won't replace it unless you ask."
	};
	let sourceHash;
	try {
		sourceHash = await fs.hashFile(from);
	} catch {
		return {
			ok: false,
			reason: "The file to copy could not be read."
		};
	}
	try {
		await fs.copyFile(from, to);
	} catch {
		return {
			ok: false,
			reason: "The file could not be copied."
		};
	}
	let destHash;
	try {
		destHash = await fs.hashFile(to);
	} catch {
		return {
			ok: false,
			reason: "The copy was made but could not be read back to confirm."
		};
	}
	if (destHash !== sourceHash) return {
		ok: false,
		reason: `The copy does not match the original (${sourceHash.slice(0, 12)} vs ${destHash.slice(0, 12)}).`
	};
	return {
		ok: true,
		evidence: `Copied to ${to}, verified sha256 ${sourceHash}.`,
		sha256: sourceHash
	};
}
/** Move a file and confirm the source is genuinely gone. */
async function moveFileVerified(fs, root, from, to) {
	for (const p of [from, to]) {
		const g = await guard(fs, root, p);
		if (!g.ok) return {
			ok: false,
			reason: g.reason
		};
	}
	if (await fs.exists(to)) return {
		ok: false,
		reason: "Something already exists at that name."
	};
	let sourceHash;
	try {
		sourceHash = await fs.hashFile(from);
	} catch (error) {
		return {
			ok: false,
			reason: describeAccessFailure(error, from, "read")
		};
	}
	try {
		await fs.rename(from, to);
	} catch (error) {
		return {
			ok: false,
			reason: describeAccessFailure(error, from, "move")
		};
	}
	if (!await fs.exists(to)) return {
		ok: false,
		reason: "The move reported success but the file is not at the destination."
	};
	if (await fs.exists(from)) return {
		ok: false,
		reason: "The file was copied to the destination but still exists at the source."
	};
	if (await fs.hashFile(to) !== sourceHash) return {
		ok: false,
		reason: "The moved file's contents do not match the original."
	};
	return {
		ok: true,
		evidence: `Moved to ${to}, verified sha256 ${sourceHash}.`,
		sha256: sourceHash
	};
}
/**
* Delete reversibly: move to a trash folder and record how to undo it.
*
* Nothing in this module can permanently destroy a file. The hash is captured
* BEFORE the move so a restore can prove the content came back unchanged
* rather than merely that a file reappeared.
*/
async function deleteToTrash(fs, root, trashDir, target, now = () => /* @__PURE__ */ new Date()) {
	const g = await guard(fs, root, target);
	if (!g.ok) return {
		ok: false,
		reason: g.reason
	};
	let st;
	try {
		st = await fs.stat(target);
	} catch {
		return {
			ok: false,
			reason: "That file doesn't exist."
		};
	}
	if (st.isDirectory) return {
		ok: false,
		reason: "That's a folder. OCADE deletes one file at a time, never a folder."
	};
	const sha256 = await fs.hashFile(target);
	const id = `${now().getTime().toString(36)}-${norm(target).split("/").pop()}`;
	const trashPath = `${norm(trashDir)}/${id}`;
	try {
		await fs.mkdir(trashDir);
	} catch {}
	try {
		await fs.rename(target, trashPath);
	} catch {
		return {
			ok: false,
			reason: "The file could not be moved to the trash folder."
		};
	}
	if (await fs.exists(target)) return {
		ok: false,
		reason: "The delete reported success but the file is still in place."
	};
	if (!await fs.exists(trashPath)) return {
		ok: false,
		reason: "The file left its original location but is not in the trash folder."
	};
	return {
		ok: true,
		record: {
			id,
			originalPath: norm(target),
			trashPath,
			sha256,
			sizeBytes: st.size,
			deletedAt: now().toISOString()
		},
		evidence: `Moved to trash; recoverable. sha256 ${sha256}.`
	};
}
/** Put a trashed file back, and prove the content is byte-identical. */
async function restoreFromTrash(fs, root, record) {
	const g = await guard(fs, root, record.originalPath);
	if (!g.ok) return {
		ok: false,
		reason: g.reason
	};
	if (!await fs.exists(record.trashPath)) return {
		ok: false,
		reason: "That deleted file is no longer in the trash folder."
	};
	if (await fs.exists(record.originalPath)) return {
		ok: false,
		reason: "Something already exists where that file used to be, so restoring it would overwrite something."
	};
	try {
		await fs.rename(record.trashPath, record.originalPath);
	} catch {
		return {
			ok: false,
			reason: "The file could not be restored."
		};
	}
	const restoredHash = await fs.hashFile(record.originalPath);
	if (restoredHash !== record.sha256) return {
		ok: false,
		reason: `The file was restored but its contents changed (expected ${record.sha256.slice(0, 12)}, got ${restoredHash.slice(0, 12)}).`
	};
	return {
		ok: true,
		evidence: `Restored to ${record.originalPath}, sha256 matches: ${restoredHash}.`
	};
}
//#endregion
export { copyFileVerified, deleteToTrash, moveFileVerified, restoreFromTrash, searchFiles };
