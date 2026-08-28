//#region node_modules/.nitro/vite/services/ssr/assets/local-files-pack-DE27j354.js
var LOCAL_FILES_PACK = {
	appId: "ocade.files.local",
	displayName: "Local files",
	category: "os_utilities",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "files.list",
			label: "List a folder",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "files.read",
			label: "Read a text file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "files.write",
			label: "Write a text file",
			methods: ["file"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "files.rename",
			label: "Rename or move a file",
			methods: ["file"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "files.mkdir",
			label: "Create a folder",
			methods: ["file"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "files.delete",
			label: "Delete a single file",
			methods: ["file"],
			mutating: true,
			verifyBy: "file",
			tested: true
		}
	],
	requiresLicensedInstall: false
};
/**
* Locations nothing may touch, however the path is expressed or approved.
*
* Scoping to an approved root is NOT sufficient on its own, and this was found
* the hard way: approving `C:\Windows` as the root and writing to a file that
* did not yet exist created a real file in the real Windows directory. The
* scope check passed, correctly — the target genuinely was inside the approved
* root. The root was the problem.
*
* So this is a second, independent lock, applied at the same choke point every
* operation already goes through. It is checked against the RESOLVED real path,
* so `..` and symlinks cannot dodge it, and it applies to reads as well as
* writes — `C:\Windows\System32\config\SAM` is not something to hand back
* either.
*/
var PROTECTED_PATTERNS = [
	{
		pattern: /^[a-z]:\/windows(\/|$)/i,
		what: "the Windows system folder"
	},
	{
		pattern: /^[a-z]:\/program files( \(x86\))?(\/|$)/i,
		what: "an installed-programs folder"
	},
	{
		pattern: /^[a-z]:\/programdata(\/|$)/i,
		what: "the shared program data folder"
	},
	{
		pattern: /^[a-z]:\/\$recycle\.bin(\/|$)/i,
		what: "the recycle bin"
	},
	{
		pattern: /^[a-z]:\/system volume information(\/|$)/i,
		what: "a system volume folder"
	},
	{
		pattern: /^\/(etc|bin|sbin|usr\/bin|usr\/sbin|boot|sys|proc|dev)(\/|$)/i,
		what: "a system folder"
	},
	{
		pattern: /^\/system(\/|$)/i,
		what: "the macOS system folder"
	},
	{
		pattern: /^\/library\/(launchdaemons|launchagents)(\/|$)/i,
		what: "a system startup folder"
	},
	{
		pattern: /(^|\/)\.ssh(\/|$)/i,
		what: "an SSH key folder"
	},
	{
		pattern: /(^|\/)\.aws(\/|$)/i,
		what: "a cloud-credentials folder"
	},
	{
		pattern: /(^|\/)\.git(\/|$)/i,
		what: "a Git internals folder"
	}
];
/** Pure, so it is cheap to test exhaustively. Expects a resolved real path. */
function assertNotProtected(resolvedPath) {
	const p = resolvedPath.replace(/\\/g, "/").replace(/\/+$/, "");
	for (const { pattern, what } of PROTECTED_PATTERNS) if (pattern.test(p)) return {
		ok: false,
		reason: `That path is inside ${what}, which OCADE will not touch even if the folder was approved.`
	};
	return { ok: true };
}
/**
* Confirm a path is genuinely inside the approved root AND not protected.
*
* Uses the RESOLVED real path on both sides, so a symlink pointing outside the
* root is caught. A string-prefix check on the unresolved path would pass a
* symlink straight through, which is the classic sandbox escape.
*/
async function assertInsideRoot(fs, root, target) {
	let realRoot;
	try {
		realRoot = await fs.realpath(root);
	} catch {
		return {
			ok: false,
			reason: "The approved folder could not be found."
		};
	}
	let resolved;
	try {
		resolved = await fs.realpath(target);
	} catch {
		const cut = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
		const parent = cut > 0 ? target.slice(0, cut) : root;
		const leaf = cut >= 0 ? target.slice(cut + 1) : target;
		if (leaf === "" || leaf === "." || leaf === "..") return {
			ok: false,
			reason: "That location doesn't exist."
		};
		let realParent;
		try {
			realParent = await fs.realpath(parent);
		} catch {
			return {
				ok: false,
				reason: "That location doesn't exist."
			};
		}
		const sep = realParent.includes("\\") && !realParent.includes("/") ? "\\" : "/";
		resolved = `${realParent.replace(/[\\/]+$/, "")}${sep}${leaf}`;
	}
	const rootKey = toPosix(realRoot);
	const targetKey = toPosix(resolved);
	if (!(targetKey === rootKey || targetKey.startsWith(`${rootKey}/`))) return {
		ok: false,
		reason: "That path is outside the folder you approved for this task."
	};
	const notProtected = assertNotProtected(resolved);
	if (!notProtected.ok) return {
		ok: false,
		reason: notProtected.reason
	};
	return {
		ok: true,
		resolved
	};
}
/** Separator-normalised form used ONLY for comparison, never for filesystem calls. */
function toPosix(p) {
	return p.replace(/\\/g, "/").replace(/\/+$/, "");
}
//#endregion
export { assertInsideRoot as n, assertNotProtected as r, LOCAL_FILES_PACK as t };
