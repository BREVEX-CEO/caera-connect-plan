import { a as numberType, c as stringType, o as objectType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/files.functions-C6C_O6sI.js
/**
* File management server functions (G1-G4 production wiring).
*
* Node-only for the same reason as `sandbox.functions.ts`: the implementation
* imports `node:fs`, and a client-reachable import would pull Node builtins
* into the browser bundle. The `await import()` inside each handler keeps it on
* the server.
*
* TWO THINGS THE CALLER DOES NOT GET TO DECIDE
*
* 1. **The approved root is not a free-text parameter.** A client that could
*    name its own root could name `C:\`. Callers pass a root, but it is checked
*    against the same denylist and scope rules the file manager enforces, and
*    the protected-path list refuses system locations regardless.
* 2. **Deletion is always reversible.** There is no permanent-delete function
*    exposed here at all. Files move to a trash folder with a record of where
*    they came from and what they hashed to.
*/
/** Bounds the client cannot raise. A request is not an instruction. */
var MAX_SEARCH_HITS = 200;
var MAX_DEPTH = 8;
var searchInput = objectType({
	root: stringType().min(1).max(4096),
	match: stringType().min(1).max(200),
	limit: numberType().int().min(1).max(MAX_SEARCH_HITS).optional()
});
var searchFilesFn_createServerFn_handler = createServerRpc({
	id: "8bca26ff384851c90aab377c72549bd7407e12018a3f41fccd7eb7be0a0632d4",
	name: "searchFilesFn",
	filename: "src/lib/files.functions.ts"
}, (opts) => searchFilesFn.__executeServer(opts));
var searchFilesFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(searchInput).handler(searchFilesFn_createServerFn_handler, async ({ data }) => {
	const { searchFiles } = await import("./manager-C7eiJjX5.mjs");
	const { nodeFileSystem } = await import("./manager.node-C4BPvh6P.mjs");
	return searchFiles(nodeFileSystem(), data.root, {
		match: data.match,
		limit: Math.min(data.limit ?? MAX_SEARCH_HITS, MAX_SEARCH_HITS),
		maxDepth: MAX_DEPTH
	});
});
var copyInput = objectType({
	root: stringType().min(1).max(4096),
	from: stringType().min(1).max(4096),
	to: stringType().min(1).max(4096)
});
var copyFileFn_createServerFn_handler = createServerRpc({
	id: "947f978722fceab4a92d9fefce979439e048c3d0b818e3be3e4242aeaf592613",
	name: "copyFileFn",
	filename: "src/lib/files.functions.ts"
}, (opts) => copyFileFn.__executeServer(opts));
var copyFileFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(copyInput).handler(copyFileFn_createServerFn_handler, async ({ data }) => {
	const { copyFileVerified } = await import("./manager-C7eiJjX5.mjs");
	const { nodeFileSystem } = await import("./manager.node-C4BPvh6P.mjs");
	return copyFileVerified(nodeFileSystem(), data.root, data.from, data.to);
});
var moveFileFn_createServerFn_handler = createServerRpc({
	id: "917be85dfb5b1e13232ea5272a556560b76e648ce0fc22506d97e5ee66123959",
	name: "moveFileFn",
	filename: "src/lib/files.functions.ts"
}, (opts) => moveFileFn.__executeServer(opts));
var moveFileFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(copyInput).handler(moveFileFn_createServerFn_handler, async ({ data }) => {
	const { moveFileVerified } = await import("./manager-C7eiJjX5.mjs");
	const { nodeFileSystem } = await import("./manager.node-C4BPvh6P.mjs");
	return moveFileVerified(nodeFileSystem(), data.root, data.from, data.to);
});
var deleteInput = objectType({
	root: stringType().min(1).max(4096),
	trashDir: stringType().min(1).max(4096),
	target: stringType().min(1).max(4096)
});
var deleteToTrashFn_createServerFn_handler = createServerRpc({
	id: "9291794df69fee9b58e441a474b33c600cdb510832b67c3136ce3c50d6ab45c7",
	name: "deleteToTrashFn",
	filename: "src/lib/files.functions.ts"
}, (opts) => deleteToTrashFn.__executeServer(opts));
var deleteToTrashFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(deleteInput).handler(deleteToTrashFn_createServerFn_handler, async ({ data }) => {
	const { deleteToTrash } = await import("./manager-C7eiJjX5.mjs");
	const { nodeFileSystem } = await import("./manager.node-C4BPvh6P.mjs");
	return deleteToTrash(nodeFileSystem(), data.root, data.trashDir, data.target);
});
var restoreInput = objectType({
	root: stringType().min(1).max(4096),
	record: objectType({
		id: stringType(),
		originalPath: stringType(),
		trashPath: stringType(),
		sha256: stringType(),
		sizeBytes: numberType(),
		deletedAt: stringType()
	})
});
var restoreFromTrashFn_createServerFn_handler = createServerRpc({
	id: "e10ee9206e4b04647fb3d67e2a1ffc29a124ffd7d0a9e67375a0ee713432c967",
	name: "restoreFromTrashFn",
	filename: "src/lib/files.functions.ts"
}, (opts) => restoreFromTrashFn.__executeServer(opts));
var restoreFromTrashFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(restoreInput).handler(restoreFromTrashFn_createServerFn_handler, async ({ data }) => {
	const { restoreFromTrash } = await import("./manager-C7eiJjX5.mjs");
	const { nodeFileSystem } = await import("./manager.node-C4BPvh6P.mjs");
	return restoreFromTrash(nodeFileSystem(), data.root, data.record);
});
//#endregion
export { copyFileFn_createServerFn_handler, deleteToTrashFn_createServerFn_handler, moveFileFn_createServerFn_handler, restoreFromTrashFn_createServerFn_handler, searchFilesFn_createServerFn_handler };
