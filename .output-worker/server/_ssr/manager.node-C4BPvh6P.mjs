import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
//#region node_modules/.nitro/vite/services/ssr/assets/manager.node-C4BPvh6P.js
/**
* Real filesystem adapter for the file manager (G1-G4). Node-only.
*
* The policy in `manager.ts` is platform-free and takes an injected filesystem.
* This is the implementation that touches actual disk, kept separate for the
* same reason as `runtime-supervisor.node.ts`: the browser cannot do any of it,
* and Node builtins must not reach the client bundle.
*/
function nodeFileSystem() {
	return {
		realpath: (p) => realpath(p),
		async stat(p) {
			const s = await stat(p);
			return {
				isFile: s.isFile(),
				isDirectory: s.isDirectory(),
				size: s.size
			};
		},
		readFile: (p) => readFile(p, "utf8"),
		writeFile: (p, data) => writeFile(p, data, "utf8"),
		readdir: (p) => readdir(p),
		async readdirTyped(p) {
			return (await readdir(p, { withFileTypes: true })).map((e) => ({
				name: e.name,
				isDirectory: e.isDirectory(),
				isFile: e.isFile()
			}));
		},
		mkdir: async (p) => {
			await mkdir(p, { recursive: true });
		},
		rename: (from, to) => rename(from, to),
		unlink: (p) => unlink(p),
		copyFile: (from, to) => copyFile(from, to),
		async exists(p) {
			try {
				await stat(p);
				return true;
			} catch {
				return false;
			}
		},
		/** Streamed, so a large file does not have to fit in memory to be hashed. */
		async hashFile(p) {
			const hash = createHash("sha256");
			for await (const chunk of createReadStream(p)) hash.update(chunk);
			return hash.digest("hex");
		}
	};
}
//#endregion
export { nodeFileSystem };
