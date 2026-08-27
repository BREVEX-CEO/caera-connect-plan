import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { B as Search, M as ShieldCheck, On as Download, W as Save, Xn as CircleCheck, f as Upload, m as TriangleAlert, pn as FolderOpen, q as RotateCcw, st as Play, un as GitBranch, xn as FileCodeCorner, y as Terminal } from "../_libs/lucide-react.mjs";
import { a as numberType, c as stringType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CySYIv4d.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { o as saveArtifact } from "./store-DGu3SiHe.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { n as validateGeneratedSandboxRequest } from "./generated-sandbox-Baqi4BRc.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { i as parseUnifiedDiff, n as applyReversibly, r as buildPatchReceipt, t as applyPatch } from "./patch-BTnAw3PV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.code-Cp7S8-RZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EXPORT_DECL = /^export\s+(default\s+)?(async\s+)?(function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;
var EXPORT_LIST = /^export\s+\{([^}]*)\}/;
var IMPORT_FROM = /^import\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/;
var BARE_IMPORT = /^import\s+["']([^"']+)["']/;
function kindOf(keyword) {
	switch (keyword) {
		case "function": return "function";
		case "class": return "class";
		case "type": return "type";
		case "interface": return "interface";
		case "enum": return "enum";
		default: return "const";
	}
}
/**
* Map one file.
*
* Comments and strings can contain the word `export`, so only lines whose FIRST
* non-space token is `export`/`import` are considered — a mid-line match inside
* a template literal is exactly the kind of false symbol this must not invent.
*/
function mapFile(file) {
	if (!/\.(ts|tsx|js|jsx|mts|cts)$/.test(file.path)) return {
		path: file.path,
		parsed: false,
		exports: [],
		imports: [],
		lines: 0
	};
	const lines = file.content.split("\n");
	const exports = [];
	const imports = /* @__PURE__ */ new Set();
	let inBlockComment = false;
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (inBlockComment) {
			if (trimmed.includes("*/")) inBlockComment = false;
			continue;
		}
		if (trimmed.startsWith("/*")) {
			if (!trimmed.includes("*/")) inBlockComment = true;
			continue;
		}
		if (trimmed.startsWith("//")) continue;
		const imp = IMPORT_FROM.exec(trimmed) ?? BARE_IMPORT.exec(trimmed);
		if (imp) {
			imports.add(imp[1]);
			continue;
		}
		const decl = EXPORT_DECL.exec(trimmed);
		if (decl) {
			const isDefault = Boolean(decl[1]);
			exports.push({
				name: decl[4],
				kind: isDefault ? "default" : kindOf(decl[3]),
				line: i + 1
			});
			continue;
		}
		const list = EXPORT_LIST.exec(trimmed);
		if (list) for (const part of list[1].split(",")) {
			const name = part.trim().split(/\s+as\s+/).pop()?.trim();
			if (name && /^[A-Za-z_$][\w$]*$/.test(name)) exports.push({
				name,
				kind: "const",
				line: i + 1
			});
		}
	}
	return {
		path: file.path,
		parsed: true,
		exports,
		imports: [...imports],
		lines: lines.length
	};
}
function buildRepoMap(files) {
	if (files.length === 0) return {
		ok: false,
		reason: "There are no files to map."
	};
	const seen = /* @__PURE__ */ new Set();
	const maps = [];
	for (const f of files) {
		if (seen.has(f.path)) return {
			ok: false,
			reason: `The file “${f.path}” was supplied twice, so the map would double-count it.`
		};
		seen.add(f.path);
		maps.push(mapFile(f));
	}
	const parsed = maps.filter((m) => m.parsed);
	const unparsed = maps.filter((m) => !m.parsed).map((m) => m.path);
	const totalExports = parsed.reduce((n, m) => n + m.exports.length, 0);
	return {
		ok: true,
		data: {
			files: maps,
			totalFiles: maps.length,
			parsedFiles: parsed.length,
			totalExports,
			unparsed
		},
		evidence: unparsed.length === 0 ? `${maps.length} files, ${totalExports} exported symbols.` : `${parsed.length} of ${maps.length} files parsed (${totalExports} exports); ${unparsed.length} not source OCADE reads.`
	};
}
/**
* Find an exported symbol by exact name across the map.
*
* Exact by default: a coding agent searching for `run` must not be handed
* `runStep`, `runAll` and `rerun` and left to guess. A `fuzzy` mode is offered
* explicitly, and labels itself as such in the evidence.
*/
function findSymbol(map, name, opts = {}) {
	const needle = name.trim();
	if (!needle) return {
		ok: false,
		reason: "No symbol name was given."
	};
	const hits = [];
	for (const file of map.files) for (const symbol of file.exports) if (opts.fuzzy ? symbol.name.toLowerCase().includes(needle.toLowerCase()) : symbol.name === needle) hits.push({
		path: file.path,
		symbol
	});
	return {
		ok: true,
		data: hits,
		evidence: hits.length === 0 ? opts.fuzzy ? `No exported symbol contains “${needle}”.` : `No exported symbol named exactly “${needle}”. Try a fuzzy search if you're unsure of the name.` : `${hits.length} ${opts.fuzzy ? "fuzzy" : "exact"} match${hits.length === 1 ? "" : "es"} for “${needle}”.`
	};
}
/**
* Resolve a relative import against the importing file's directory, trying the
* extensions and index conventions a bundler would.
*
* Returns the matched mapped path, or null when nothing in the map matches —
* which is exactly what makes an import "broken" rather than external.
*/
function resolveRelative(fromPath, specifier, known) {
	const segments = `${fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : ""}/${specifier}`.split("/");
	const stack = [];
	for (const seg of segments) {
		if (seg === "." || seg === "") continue;
		if (seg === "..") stack.pop();
		else stack.push(seg);
	}
	const base = stack.join("/");
	return [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}.js`,
		`${base}.jsx`,
		`${base}/index.ts`,
		`${base}/index.tsx`,
		`${base}/index.js`
	].find((c) => known.has(c)) ?? null;
}
var isRelative = (spec) => spec.startsWith("./") || spec.startsWith("../");
/** Build the dependency graph from a repo map. */
function buildDependencyGraph(map) {
	const known = new Set(map.files.map((f) => f.path));
	const edges = /* @__PURE__ */ new Map();
	const brokenImports = [];
	const externals = /* @__PURE__ */ new Set();
	for (const file of map.files) {
		if (!file.parsed) continue;
		const resolved = [];
		for (const spec of file.imports) {
			if (!isRelative(spec)) {
				externals.add(spec);
				continue;
			}
			const target = resolveRelative(file.path, spec, known);
			if (target) resolved.push(target);
			else brokenImports.push({
				from: file.path,
				specifier: spec
			});
		}
		edges.set(file.path, resolved);
	}
	return {
		ok: true,
		data: {
			edges,
			brokenImports,
			externals: [...externals].sort()
		},
		evidence: brokenImports.length === 0 ? `Graph built: ${edges.size} files, ${externals.size} external packages, no broken relative imports.` : `Graph built with ${brokenImports.length} broken relative import${brokenImports.length === 1 ? "" : "s"} — first: ${brokenImports[0].specifier} in ${brokenImports[0].from}.`
	};
}
/**
* Find circular dependencies, each reported as the path that closes the loop.
*
* Uses a depth-first walk with a recursion stack; when it reaches a node
* already on the stack, the slice from that node to the current one IS the
* cycle, and it's returned rather than just a boolean.
*/
function findCycles(graph) {
	const cycles = [];
	const seen = /* @__PURE__ */ new Set();
	const onStack = /* @__PURE__ */ new Set();
	const stack = [];
	const reported = /* @__PURE__ */ new Set();
	const visit = (node) => {
		seen.add(node);
		onStack.add(node);
		stack.push(node);
		for (const next of graph.edges.get(node) ?? []) if (onStack.has(next)) {
			const cycle = stack.slice(stack.indexOf(next));
			const sig = [...cycle].sort().join("|");
			if (!reported.has(sig)) {
				reported.add(sig);
				cycles.push([...cycle, next]);
			}
		} else if (!seen.has(next)) visit(next);
		onStack.delete(node);
		stack.pop();
	};
	for (const node of graph.edges.keys()) if (!seen.has(node)) visit(node);
	return cycles;
}
/**
* Find exported symbols not imported by any mapped file.
*
* These are reported as "unreferenced within the mapped files", NOT as dead
* code — an entry point or public API is exported to be used from outside the
* set, and deleting it would break the thing it exists for. The distinction is
* the whole point.
*
* Note: import specifiers name modules, not symbols, so this reports an export
* as unreferenced only when NOTHING in the map imports its file at all. A file
* that is imported somewhere is assumed to have its exports used — a
* conservative call that avoids the far worse error of calling a used symbol
* dead.
*/
function findUnreferencedExports(map, graph) {
	const importedFiles = /* @__PURE__ */ new Set();
	for (const targets of graph.edges.values()) for (const t of targets) importedFiles.add(t);
	const out = [];
	for (const file of map.files) {
		if (!file.parsed) continue;
		if (importedFiles.has(file.path)) continue;
		for (const symbol of file.exports) out.push({
			path: file.path,
			symbol: symbol.name,
			note: "Unreferenced within the mapped files. This may be an entry point, route, or public API — confirm before removing; it is NOT proven dead."
		});
	}
	return out;
}
function diagnose(map) {
	const graph = buildDependencyGraph(map);
	if (!graph.ok) return graph;
	const cycles = findCycles(graph.data);
	const unreferenced = findUnreferencedExports(map, graph.data);
	const unreferencedFiles = new Set(unreferenced.map((u) => u.path)).size;
	const edgeCount = [...graph.data.edges.values()].reduce((n, t) => n + t.length, 0);
	return {
		ok: true,
		data: {
			files: map.files.length,
			edges: edgeCount,
			externals: graph.data.externals.length,
			brokenImports: graph.data.brokenImports.length,
			cycles: cycles.length,
			unreferencedFiles
		},
		evidence: `${map.files.length} files, ${edgeCount} internal edges, ${cycles.length} cycle(s), ${graph.data.brokenImports.length} broken import(s), ${unreferencedFiles} file(s) unreferenced within the map.`
	};
}
var DECL_KEYWORDS = /\b(function|class|const|let|var|type|interface|enum)\b/;
/**
* Remove line comments, block comments, and string/template literals from a
* line so a name inside them isn't counted as a code reference.
*
* Block-comment state is threaded across lines by the caller. This is
* deliberately conservative: when in doubt it blanks MORE (e.g. an unterminated
* string to end of line), because a false negative (missing a real reference)
* is caught by the caller's review, while a false positive inside a string is
* silent and misleading.
*/
function stripNonCode(line, state) {
	let out = "";
	let i = 0;
	while (i < line.length) {
		if (state.inBlock) {
			const end = line.indexOf("*/", i);
			if (end === -1) return out + " ".repeat(line.length - i);
			state.inBlock = false;
			out += " ".repeat(end + 2 - i);
			i = end + 2;
			continue;
		}
		const two = line.slice(i, i + 2);
		if (two === "//") return out + " ".repeat(line.length - i);
		if (two === "/*") {
			state.inBlock = true;
			out += "  ";
			i += 2;
			continue;
		}
		const c = line[i];
		if (c === "\"" || c === "'" || c === "`") {
			let j = i + 1;
			while (j < line.length && line[j] !== c) {
				if (line[j] === "\\") j++;
				j++;
			}
			out += " ".repeat(Math.min(j, line.length) - i + 1);
			i = j + 1;
			continue;
		}
		out += c;
		i++;
	}
	return out;
}
/**
* Find textual references to `symbol` across the given files.
*
* Returns definitions and uses separately. Unparsed (non-source) files are
* listed in `skipped`, never silently treated as containing no references.
*/
function findReferences(files, symbol) {
	const name = symbol.trim();
	if (!/^[A-Za-z_$][\w$]*$/.test(name)) return {
		ok: false,
		reason: `“${symbol}” isn't a valid identifier to search for.`
	};
	const wordRe = new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`);
	const references = [];
	const definitions = [];
	const skipped = [];
	for (const file of files) {
		if (!/\.(ts|tsx|js|jsx|mts|cts)$/.test(file.path)) {
			skipped.push(file.path);
			continue;
		}
		const state = { inBlock: false };
		file.content.split("\n").forEach((raw, idx) => {
			const code = stripNonCode(raw, state);
			if (!wordRe.test(code)) return;
			const isDeclaration = DECL_KEYWORDS.test(code) && new RegExp(`\\b(function|class|const|let|var|type|interface|enum)\\s+${escapeRegExp(name)}\\b`).test(code);
			const ref = {
				path: file.path,
				line: idx + 1,
				isDeclaration,
				text: raw.trim()
			};
			if (isDeclaration) definitions.push(ref);
			else references.push(ref);
		});
	}
	return {
		ok: true,
		data: {
			symbol: name,
			references,
			definitions,
			skipped
		},
		evidence: references.length === 0 && definitions.length === 0 ? `No textual reference to “${name}” found${skipped.length ? ` (${skipped.length} non-source file(s) skipped)` : ""}.` : `${references.length} textual use(s) and ${definitions.length} definition(s) of “${name}”. These are text matches — a match may be an unrelated identifier of the same name; review before renaming.`
	};
}
function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* OCADE Code workspace.
*
* This module owns the state transition contract for repository work. It does
* not read arbitrary host files or spawn a shell. A browser can supply files
* the user explicitly selected, while a desktop companion can later implement
* `CodeCommandHost`. Both use the same exact-patch, checkpoint, observation,
* and receipt rules.
*
* The workspace is immutable. A refused patch, stale undo, unavailable host,
* thrown command, or malformed observation returns without a replacement
* workspace, which makes "nothing changed" inspectable instead of aspirational.
*/
var MAX_FILES = 500;
var MAX_FILE_CHARACTERS = 2e6;
var MAX_TOTAL_CHARACTERS = 1e7;
var MAX_SEARCH_RESULTS = 200;
function nowIso(now) {
	return (now ?? /* @__PURE__ */ new Date()).toISOString();
}
function generatedId(prefix) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function normalizePath(input) {
	const raw = input.trim().replace(/\\/g, "/");
	if (!raw) return {
		ok: false,
		reason: "A repository file has no path."
	};
	if (raw.includes("\0")) return {
		ok: false,
		reason: `The path ${JSON.stringify(input)} contains a null byte.`
	};
	if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw) || raw.startsWith("//")) return {
		ok: false,
		reason: `The path ${JSON.stringify(input)} is absolute. Repository intake accepts relative paths only.`
	};
	const parts = raw.split("/").filter((part) => part !== "" && part !== ".");
	if (parts.length === 0 || parts.some((part) => part === "..")) return {
		ok: false,
		reason: `The path ${JSON.stringify(input)} escapes or does not identify a repository file.`
	};
	return {
		ok: true,
		data: parts.join("/"),
		evidence: "Relative path validated."
	};
}
async function sha256(content) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) return {
		ok: false,
		reason: "Web Crypto is unavailable, so OCADE cannot checkpoint repository content safely."
	};
	const bytes = new TextEncoder().encode(content);
	const digest = await subtle.digest("SHA-256", bytes);
	return {
		ok: true,
		data: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
		evidence: "SHA-256 calculated."
	};
}
function createCodeWorkspace(input) {
	const name = input.name.trim();
	if (!name) return {
		ok: false,
		reason: "A repository workspace needs a name."
	};
	if (input.files.length === 0) return {
		ok: false,
		reason: "No repository files were supplied."
	};
	if (input.files.length > MAX_FILES) return {
		ok: false,
		reason: `This repository selection contains ${input.files.length} files; the on-device review limit is ${MAX_FILES}. Narrow the selection or use the desktop companion.`
	};
	const seen = /* @__PURE__ */ new Set();
	const files = [];
	let totalCharacters = 0;
	for (const file of input.files) {
		const path = normalizePath(file.path);
		if (!path.ok) return path;
		if (seen.has(path.data)) return {
			ok: false,
			reason: `The repository supplied ${path.data} more than once. Nothing was loaded.`
		};
		if (file.content.includes("\0")) return {
			ok: false,
			reason: `${path.data} contains binary null bytes. OCADE will not reinterpret binary data as source text.`
		};
		if (file.content.length > MAX_FILE_CHARACTERS) return {
			ok: false,
			reason: `${path.data} exceeds the ${MAX_FILE_CHARACTERS.toLocaleString()}-character on-device file limit.`
		};
		totalCharacters += file.content.length;
		if (totalCharacters > MAX_TOTAL_CHARACTERS) return {
			ok: false,
			reason: `The selected files exceed the ${MAX_TOTAL_CHARACTERS.toLocaleString()}-character on-device repository limit.`
		};
		seen.add(path.data);
		files.push({
			path: path.data,
			content: file.content
		});
	}
	files.sort((left, right) => left.path.localeCompare(right.path));
	const at = nowIso(input.now);
	return {
		ok: true,
		data: {
			id: input.id ?? generatedId("repo"),
			name,
			createdAt: at,
			revision: 0,
			files,
			changes: [],
			history: [{
				id: generatedId("history"),
				at,
				kind: "repository",
				label: `Loaded ${name}`,
				status: "verified",
				evidence: `${files.length} user-selected text files loaded into session memory; no host file was changed.`
			}]
		},
		evidence: `${files.length} files loaded into an on-device session workspace.`
	};
}
function applicableInstructions(workspace, targetPath) {
	const normalized = normalizePath(targetPath);
	if (!normalized.ok) return [];
	const targetDirectory = normalized.data.includes("/") ? normalized.data.slice(0, normalized.data.lastIndexOf("/")) : "";
	return workspace.files.filter((file) => file.path === "AGENTS.md" || file.path.endsWith("/AGENTS.md")).filter((file) => {
		const instructionDirectory = file.path === "AGENTS.md" ? "" : file.path.slice(0, -10);
		return instructionDirectory === "" || targetDirectory === instructionDirectory || targetDirectory.startsWith(`${instructionDirectory}/`);
	}).sort((left, right) => {
		return left.path.split("/").length - right.path.split("/").length || left.path.localeCompare(right.path);
	}).map((file) => ({
		path: file.path,
		content: file.content
	}));
}
function searchWorkspaceText(workspace, query, options = {}) {
	const needle = query.trim();
	if (!needle) return {
		ok: false,
		reason: "Enter text to search for."
	};
	if (needle.length > 200) return {
		ok: false,
		reason: "Search text is limited to 200 characters."
	};
	const requestedLimit = options.limit ?? MAX_SEARCH_RESULTS;
	const limit = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Math.floor(requestedLimit)));
	const comparisonNeedle = options.caseSensitive ? needle : needle.toLowerCase();
	const hits = [];
	for (const file of workspace.files) {
		const lines = file.content.split("\n");
		for (let index = 0; index < lines.length; index++) {
			const column = (options.caseSensitive ? lines[index] : lines[index].toLowerCase()).indexOf(comparisonNeedle);
			if (column < 0) continue;
			hits.push({
				path: file.path,
				line: index + 1,
				column: column + 1,
				text: lines[index].trim().slice(0, 500)
			});
			if (hits.length >= limit) return {
				ok: true,
				data: hits,
				evidence: `${hits.length} matches returned; results were capped at ${limit}.`
			};
		}
	}
	return {
		ok: true,
		data: hits,
		evidence: `${hits.length} text match${hits.length === 1 ? "" : "es"} for ${JSON.stringify(needle)}.`
	};
}
function analyseWorkspace(workspace) {
	const map = buildRepoMap(workspace.files);
	if (!map.ok) return map;
	const diagnostics = diagnose(map.data);
	if (!diagnostics.ok) return diagnostics;
	const symbols = map.data.files.flatMap((file) => file.exports.map((symbol) => ({
		path: file.path,
		symbol
	})));
	const primarySymbol = symbols.find((hit) => hit.symbol.kind === "function")?.symbol.name ?? symbols[0]?.symbol.name;
	const references = primarySymbol ? findReferences(workspace.files, primarySymbol) : {
		ok: true,
		data: {
			symbol: "",
			references: [],
			definitions: [],
			skipped: map.data.unparsed
		},
		evidence: "No exported symbol was available for reference analysis."
	};
	if (!references.ok) return references;
	return {
		ok: true,
		data: {
			map: map.data,
			diagnostics: diagnostics.data,
			symbols,
			references: references.data
		},
		evidence: `${map.evidence} ${diagnostics.evidence}`
	};
}
function locatePatchTarget(workspace, diff) {
	const parsed = parseUnifiedDiff(diff);
	if (!parsed.ok) return parsed;
	const path = normalizePath(parsed.data.path);
	if (!path.ok) return path;
	const file = workspace.files.find((candidate) => candidate.path === path.data);
	if (!file) return {
		ok: false,
		reason: `${path.data} is not in this repository snapshot. OCADE will not create or guess a target from an update-only patch.`
	};
	return {
		ok: true,
		data: {
			path: path.data,
			file,
			patch: {
				...parsed.data,
				path: path.data
			}
		},
		evidence: parsed.evidence
	};
}
async function previewCodePatch(workspace, diff) {
	const target = locatePatchTarget(workspace, diff);
	if (!target.ok) return target;
	const applied = applyReversibly(target.data.file.content, target.data.patch);
	if (!applied.ok) return applied;
	return {
		ok: true,
		data: {
			path: target.data.path,
			before: target.data.file.content,
			after: applied.data.content,
			inverse: applied.data.inverse,
			receipt: buildPatchReceipt(target.data.patch, applied.data, true)
		},
		evidence: `${applied.evidence} Preview only; workspace revision ${workspace.revision} is unchanged.`
	};
}
async function applyCodePatch(workspace, diff, options = {}) {
	const preview = await previewCodePatch(workspace, diff);
	if (!preview.ok) return preview;
	const beforeHash = await sha256(preview.data.before);
	if (!beforeHash.ok) return beforeHash;
	const afterHash = await sha256(preview.data.after);
	if (!afterHash.ok) return afterHash;
	const at = nowIso(options.now);
	const change = {
		id: options.id ?? generatedId("change"),
		path: preview.data.path,
		patchText: diff,
		beforeSha256: beforeHash.data,
		afterSha256: afterHash.data,
		undoVerified: preview.data.receipt.undoVerified,
		inverse: preview.data.inverse,
		receipt: preview.data.receipt,
		createdAt: at,
		status: "applied"
	};
	return {
		ok: true,
		data: {
			workspace: {
				...workspace,
				revision: workspace.revision + 1,
				files: workspace.files.map((file) => file.path === preview.data.path ? {
					...file,
					content: preview.data.after
				} : file),
				changes: [...workspace.changes, change],
				history: [...workspace.history, {
					id: generatedId("history"),
					at,
					kind: "patch",
					label: `Applied ${preview.data.path}`,
					status: "verified",
					evidence: preview.data.receipt.evidence,
					path: preview.data.path
				}]
			},
			change
		},
		evidence: `${preview.data.receipt.evidence} Before and after SHA-256 checkpoints recorded.`
	};
}
async function undoCodeChange(workspace, changeId, options = {}) {
	const index = workspace.changes.findIndex((change) => change.id === changeId);
	if (index < 0) return {
		ok: false,
		reason: "That code change is not in this workspace."
	};
	const change = workspace.changes[index];
	if (change.status !== "applied") return {
		ok: false,
		reason: "That code change was already undone."
	};
	const file = workspace.files.find((candidate) => candidate.path === change.path);
	if (!file) return {
		ok: false,
		reason: `${change.path} is no longer in the workspace.`
	};
	const currentHash = await sha256(file.content);
	if (!currentHash.ok) return currentHash;
	if (currentHash.data !== change.afterSha256) return {
		ok: false,
		reason: `${change.path} changed after this checkpoint. Undo was refused so newer work is not overwritten.`
	};
	const undone = applyPatch(file.content, change.inverse);
	if (!undone.ok) return undone;
	const restoredHash = await sha256(undone.data.content);
	if (!restoredHash.ok) return restoredHash;
	if (restoredHash.data !== change.beforeSha256) return {
		ok: false,
		reason: `Undo did not reproduce the recorded before hash for ${change.path}. Nothing was changed.`
	};
	const at = nowIso(options.now);
	const updated = {
		...change,
		status: "undone",
		undoneAt: at
	};
	const changes = [...workspace.changes];
	changes[index] = updated;
	return {
		ok: true,
		data: {
			workspace: {
				...workspace,
				revision: workspace.revision + 1,
				files: workspace.files.map((candidate) => candidate.path === change.path ? {
					...candidate,
					content: undone.data.content
				} : candidate),
				changes,
				history: [...workspace.history, {
					id: generatedId("history"),
					at,
					kind: "undo",
					label: `Restored ${change.path}`,
					status: "verified",
					evidence: `${change.path} restored byte-for-byte to SHA-256 ${change.beforeSha256.slice(0, 12)}….`,
					path: change.path
				}]
			},
			change: updated
		},
		evidence: `${change.path} restored to its recorded before hash.`
	};
}
function validateObservation(observation) {
	if (!Number.isInteger(observation.exitCode)) return {
		ok: false,
		reason: "The command host returned an invalid exit code."
	};
	const started = Date.parse(observation.startedAt);
	const finished = Date.parse(observation.finishedAt);
	if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return {
		ok: false,
		reason: "The command host returned invalid observation timestamps."
	};
	if (typeof observation.observed !== "boolean") return {
		ok: false,
		reason: "The command host did not state whether process exit was observed."
	};
	return {
		ok: true,
		data: observation,
		evidence: "Command observation validated."
	};
}
async function runWorkspaceCommand(workspace, command, host, signal) {
	if (host.kind === "unavailable") return {
		ok: false,
		reason: host.unavailableReason?.trim() || "No command host is connected. OCADE will not simulate terminal output."
	};
	if (signal?.aborted) return {
		ok: false,
		reason: `${command} was cancelled before the command host started.`
	};
	let raw;
	try {
		raw = await host.run({
			command,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			revision: workspace.revision,
			files: workspace.files.map((file) => ({ ...file })),
			signal
		});
	} catch (error) {
		return {
			ok: false,
			reason: `The ${command} host failed before it returned an observable result: ${error instanceof Error ? error.message : "unknown host error"}. No success receipt was recorded.`
		};
	}
	if (signal?.aborted) return {
		ok: false,
		reason: `${command} was cancelled while the host was running. Its completion is unknown, so no success receipt was recorded.`
	};
	const observation = validateObservation(raw);
	if (!observation.ok) return observation;
	const verified = observation.data.observed && observation.data.exitCode === 0;
	const status = observation.data.exitCode !== 0 ? "failed" : verified ? "verified" : "unverified";
	const outputEvidence = observation.data.exitCode === 0 ? `${command} exited 0${observation.data.observed ? " and the host observed process completion" : ", but process completion was not independently observed"}.` : `${command} exited ${observation.data.exitCode}: ${observation.data.stderr.trim().slice(0, 500) || "no stderr was captured"}`;
	const receipt = {
		appId: `ocade.code-host:${host.id}`,
		capabilityId: `code.${command}`,
		method: "cli",
		at: observation.data.finishedAt,
		verified,
		evidence: verified ? outputEvidence : `NOT CONFIRMED: ${outputEvidence}`
	};
	return {
		ok: true,
		data: {
			workspace: {
				...workspace,
				history: [...workspace.history, {
					id: generatedId("history"),
					at: observation.data.finishedAt,
					kind: "command",
					command,
					label: `Ran ${command}`,
					status,
					evidence: receipt.evidence
				}]
			},
			observation: observation.data,
			receipt
		},
		evidence: receipt.evidence
	};
}
/** Exact symbol lookup for the UI without exposing the map's internal shape. */
function searchWorkspaceSymbol(workspace, symbol, fuzzy = false) {
	const map = buildRepoMap(workspace.files);
	if (!map.ok) return map;
	return findSymbol(map.data, symbol, { fuzzy });
}
/** Textual reference candidates remain explicitly labelled as textual. */
function searchWorkspaceReferences(workspace, symbol) {
	return findReferences(workspace.files, symbol);
}
/**
* Generated-code sandbox server function (P21 production wiring).
*
* `createNodePermissionSandboxHost` is the only real isolation boundary in the
* repository — a spawned Node process with the permission model, bounded
* resources and declared outputs. It was imported by nothing but tests, so the
* only host production could reach was the unavailable one, and
* `runGeneratedSandbox` refused every request.
*
* It has to be a server function. The host statically imports
* `node:child_process`, `node:fs/promises` and `node:os`; a client-reachable
* import would either break the browser bundle or, worse, pull Node builtins
* into it. The `await import()` inside the handler guarantees the module is
* only ever resolved on the server.
*
* Executing model-written code is the single most dangerous capability here,
* so the handler adds constraints of its own on top of the sandbox's:
* authentication is required, network access is never granted from this
* entry point, and the limits are capped server-side regardless of what the
* caller asks for.
*/
var sandboxInput = objectType({
	taskId: stringType().min(1).max(200),
	language: enumType(["javascript", "python"]),
	script: stringType().min(1).max(1e5),
	inputs: arrayType(objectType({
		path: stringType().max(200),
		content: stringType().max(1e6)
	})).max(20).default([]),
	outputs: arrayType(objectType({
		path: stringType().max(200),
		mediaType: stringType().max(100).default("application/octet-stream"),
		maxBytes: numberType().int().positive().optional()
	})).max(20).default([]),
	allowedImports: arrayType(stringType().max(100)).max(50).default([]),
	timeoutMs: numberType().int().positive().max(15e3).default(5e3),
	memoryMb: numberType().int().positive().max(256).default(128)
});
var runSandboxScript = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((raw) => sandboxInput.parse(raw)).handler(createSsrRpc("94d4f3644ba1bb4084f97a24df9623e21a5084ee0a9d491a2a0ad0426e889b05"));
var SAMPLE_FILES = [
	{
		path: "AGENTS.md",
		content: "Keep edits minimal.\nRun focused tests before the full suite.\n"
	},
	{
		path: "src/greet.ts",
		content: [
			"export function greet(name: string) {",
			"  return \"hi \" + name;",
			"}",
			""
		].join("\n")
	},
	{
		path: "src/greet.test.ts",
		content: "import { greet } from \"./greet\";\nexport const expected = greet(\"Ada\");\n"
	},
	{
		path: "package.json",
		content: JSON.stringify({
			name: "ocade-temporary-repository",
			scripts: {
				test: "vitest run",
				build: "vite build"
			}
		}, null, 2)
	}
];
var SAMPLE_DIFF = [
	"--- a/src/greet.ts",
	"+++ b/src/greet.ts",
	"@@ -1,3 +1,3 @@",
	" export function greet(name: string) {",
	"-  return \"hi \" + name;",
	"+  return `Hello, ${name}`;",
	" }",
	""
].join("\n");
var TEXT_NAMES = /* @__PURE__ */ new Set([
	"agents.md",
	"readme",
	"readme.md",
	"license",
	"dockerfile",
	"makefile",
	".gitignore",
	".npmrc",
	".editorconfig"
]);
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
	"c",
	"cc",
	"cpp",
	"cs",
	"css",
	"diff",
	"env",
	"go",
	"graphql",
	"h",
	"hpp",
	"html",
	"java",
	"js",
	"json",
	"jsx",
	"kt",
	"kts",
	"md",
	"mjs",
	"mts",
	"patch",
	"php",
	"properties",
	"py",
	"rb",
	"rs",
	"scss",
	"sh",
	"sql",
	"swift",
	"toml",
	"ts",
	"tsx",
	"txt",
	"xml",
	"yaml",
	"yml"
]);
var unavailableHost = {
	id: "desktop-companion",
	kind: "unavailable",
	unavailableReason: "A verified desktop command host is not connected. OCADE will not simulate terminal output; connect the desktop companion after its Code command capability is installed and approved.",
	async run() {
		throw new Error("Unavailable hosts must never be dispatched.");
	}
};
function isTextRepositoryFile(path) {
	const name = path.replace(/\\/g, "/").toLowerCase().split("/").at(-1) ?? "";
	if (TEXT_NAMES.has(name)) return true;
	const extension = name.includes(".") ? name.split(".").at(-1) ?? "" : "";
	return TEXT_EXTENSIONS.has(extension);
}
function download(name, content, type = "text/plain") {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	URL.revokeObjectURL(url);
}
function CodeWorkspacePanel() {
	const runSandbox = useServerFn(runSandboxScript);
	const [sandboxRunning, setSandboxRunning] = (0, import_react.useState)(false);
	const fileInputRef = (0, import_react.useRef)(null);
	const [workspace, setWorkspace] = (0, import_react.useState)(null);
	const [selectedPath, setSelectedPath] = (0, import_react.useState)(null);
	const [analysis, setAnalysis] = (0, import_react.useState)(null);
	const [analysisEvidence, setAnalysisEvidence] = (0, import_react.useState)("");
	const [diff, setDiff] = (0, import_react.useState)(SAMPLE_DIFF);
	const [preview, setPreview] = (0, import_react.useState)(null);
	const [searchMode, setSearchMode] = (0, import_react.useState)("text");
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [searchView, setSearchView] = (0, import_react.useState)({ kind: "none" });
	const [command, setCommand] = (0, import_react.useState)("test");
	const [generatedScript, setGeneratedScript] = (0, import_react.useState)("const input = await sandbox.readText(\"source.txt\");\nawait sandbox.writeText(\"result.txt\", input.toUpperCase());");
	const [sandboxStatus, setSandboxStatus] = (0, import_react.useState)(null);
	const [terminal, setTerminal] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const selectedFile = (0, import_react.useMemo)(() => workspace?.files.find((file) => file.path === selectedPath) ?? null, [selectedPath, workspace]);
	const instructions = (0, import_react.useMemo)(() => workspace && selectedPath ? applicableInstructions(workspace, selectedPath) : [], [selectedPath, workspace]);
	const latestChange = (workspace?.changes.filter((change) => change.status === "applied") ?? []).at(-1) ?? null;
	function installWorkspace(next) {
		setWorkspace(next);
		setSelectedPath(next.files.find((file) => file.path.endsWith(".ts"))?.path ?? next.files[0].path);
		setAnalysis(null);
		setAnalysisEvidence("");
		setPreview(null);
		setSearchView({ kind: "none" });
		setError(null);
		setTerminal((lines) => [...lines, `repository: ${next.name} · ${next.files.length} text files · session memory only`]);
	}
	function loadSample() {
		const created = createCodeWorkspace({
			name: "Temporary greeting repository",
			files: SAMPLE_FILES
		});
		if (!created.ok) {
			setError(created.reason);
			return;
		}
		setDiff(SAMPLE_DIFF);
		installWorkspace(created.data);
	}
	async function loadSelectedFiles(files) {
		if (!files || files.length === 0) return;
		setBusy(true);
		setError(null);
		try {
			const chosen = Array.from(files);
			if (chosen.length > 500) {
				setError("Select at most 500 files for an on-device browser workspace.");
				return;
			}
			const supported = chosen.filter((file) => isTextRepositoryFile(file.webkitRelativePath || file.name));
			const skipped = chosen.length - supported.length;
			const oversized = supported.find((file) => file.size > 2e6);
			if (oversized) {
				setError(`${oversized.name} exceeds the 2 MB on-device text-file limit.`);
				return;
			}
			if (supported.length === 0) {
				setError("No supported text/source files were selected. Binary files were not decoded as code.");
				return;
			}
			const selectedPaths = supported.map((file) => (file.webkitRelativePath || file.name).replace(/\\/g, "/"));
			const selectedRoot = selectedPaths[0].includes("/") ? selectedPaths[0].split("/")[0] : null;
			const hasSharedSelectionRoot = selectedRoot !== null && selectedPaths.every((path) => path.startsWith(`${selectedRoot}/`));
			const sourceFiles = await Promise.all(supported.map(async (file, index) => ({
				path: hasSharedSelectionRoot ? selectedPaths[index].slice(`${selectedRoot}/`.length) : selectedPaths[index],
				content: await file.text()
			})));
			const created = createCodeWorkspace({
				name: selectedRoot ?? "Selected repository",
				files: sourceFiles
			});
			if (!created.ok) {
				setError(created.reason);
				return;
			}
			installWorkspace(created.data);
			if (skipped > 0) setTerminal((lines) => [...lines, `intake: ${skipped} unsupported/binary file${skipped === 1 ? "" : "s"} skipped and not analysed`]);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "The selected repository could not be read.");
		} finally {
			setBusy(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}
	function runAnalysis() {
		if (!workspace) return;
		const result = analyseWorkspace(workspace);
		if (!result.ok) {
			setError(result.reason);
			return;
		}
		setAnalysis(result.data);
		setAnalysisEvidence(result.evidence);
		setError(null);
		setTerminal((lines) => [...lines, `analysis: ${result.evidence}`]);
	}
	function runSearch() {
		if (!workspace) return;
		if (searchMode === "text") {
			const result = searchWorkspaceText(workspace, searchQuery);
			if (!result.ok) {
				setSearchView({
					kind: "error",
					message: result.reason
				});
				return;
			}
			setSearchView({
				kind: "results",
				evidence: result.evidence,
				rows: result.data.map((hit) => ({
					path: hit.path,
					line: hit.line,
					text: hit.text
				}))
			});
			return;
		}
		if (searchMode === "symbol") {
			const result = searchWorkspaceSymbol(workspace, searchQuery);
			if (!result.ok) {
				setSearchView({
					kind: "error",
					message: result.reason
				});
				return;
			}
			setSearchView({
				kind: "results",
				evidence: result.evidence,
				rows: result.data.map((hit) => ({
					path: hit.path,
					line: hit.symbol.line,
					text: `${hit.symbol.kind} ${hit.symbol.name}`
				}))
			});
			return;
		}
		const result = searchWorkspaceReferences(workspace, searchQuery);
		if (!result.ok) {
			setSearchView({
				kind: "error",
				message: result.reason
			});
			return;
		}
		setSearchView({
			kind: "results",
			evidence: result.evidence,
			rows: [...result.data.definitions, ...result.data.references].map((hit) => ({
				path: hit.path,
				line: hit.line,
				text: `${hit.isDeclaration ? "definition" : "textual candidate"} · ${hit.text}`
			}))
		});
	}
	async function previewPatch() {
		if (!workspace) return;
		setBusy(true);
		const result = await previewCodePatch(workspace, diff);
		setBusy(false);
		if (!result.ok) {
			setPreview(null);
			setError(result.reason);
			return;
		}
		setPreview(result.data);
		setSelectedPath(result.data.path);
		setError(null);
		setTerminal((lines) => [...lines, `preview: ${result.evidence}`]);
	}
	async function applyPatch() {
		if (!workspace) return;
		setBusy(true);
		const result = await applyCodePatch(workspace, diff);
		setBusy(false);
		if (!result.ok) {
			setError(result.reason);
			return;
		}
		setWorkspace(result.data.workspace);
		setPreview(null);
		setAnalysis(null);
		setError(null);
		setTerminal((lines) => [
			...lines,
			`patch: ${result.evidence}`,
			`checkpoint: before ${result.data.change.beforeSha256.slice(0, 12)}… · after ${result.data.change.afterSha256.slice(0, 12)}…`
		]);
	}
	async function undoLatest() {
		if (!workspace || !latestChange) return;
		setBusy(true);
		const result = await undoCodeChange(workspace, latestChange.id);
		setBusy(false);
		if (!result.ok) {
			setError(result.reason);
			return;
		}
		setWorkspace(result.data.workspace);
		setAnalysis(null);
		setPreview(null);
		setError(null);
		setTerminal((lines) => [...lines, `undo: ${result.evidence}`]);
	}
	async function runCommand() {
		if (!workspace) return;
		setBusy(true);
		const result = await runWorkspaceCommand(workspace, command, unavailableHost);
		setBusy(false);
		if (!result.ok) {
			setError(result.reason);
			setTerminal((lines) => [...lines, `${command}: unavailable · ${result.reason}`]);
			return;
		}
		setWorkspace(result.data.workspace);
		setTerminal((lines) => [
			...lines,
			`$ ${command}`,
			result.data.observation.stdout,
			result.data.observation.stderr,
			`exit ${result.data.observation.exitCode} · ${result.data.receipt.evidence}`
		]);
	}
	function validateSandboxPlan() {
		const validated = validateGeneratedSandboxRequest({
			taskId: workspace?.id ?? "code-workspace",
			language: "javascript",
			script: generatedScript,
			inputs: [{
				path: "source.txt",
				content: selectedFile?.content ?? ""
			}],
			outputs: [{
				path: "result.txt",
				mediaType: "text/plain",
				maxBytes: 1e5
			}],
			allowedImports: [],
			network: "disabled",
			limits: {
				wallTimeMs: 1e4,
				cpuTimeMs: 1e4,
				memoryMb: 128,
				storageBytes: 1e6,
				outputBytes: 2e5
			}
		});
		setSandboxStatus(validated.ok ? "Plan admitted. Network, imports, child processes and undeclared paths remain denied. Use Execute to run it in the Node permission host." : validated.reason ?? "Sandbox plan was refused.");
	}
	/**
	* Actually run the plan in the Node permission host (P21).
	*
	* Validation only ever proved the request was admissible; execution needed a
	* host, and the only real one was reachable from tests alone. It runs on the
	* server because the host spawns a process — the browser has nothing to
	* spawn — and network stays denied there regardless of what is asked.
	*/
	async function executeSandboxPlan() {
		setSandboxRunning(true);
		setSandboxStatus("Running in the Node permission host…");
		try {
			const res = await runSandbox({ data: {
				taskId: workspace?.id ?? "code-workspace",
				language: "javascript",
				script: generatedScript,
				inputs: [{
					path: "source.txt",
					content: selectedFile?.content ?? ""
				}],
				outputs: [{
					path: "result.txt",
					mediaType: "text/plain",
					maxBytes: 1e5
				}],
				allowedImports: [],
				timeoutMs: 1e4,
				memoryMb: 128
			} });
			setSandboxStatus(res.ok ? `${res.result.status}: ${res.result.diffs.length} declared output(s) changed; undeclared paths were not written.` : `Refused: ${res.reason}`);
		} catch (e) {
			setSandboxStatus(e instanceof Error ? `Could not run: ${e.message}` : "Could not run the sandbox.");
		} finally {
			setSandboxRunning(false);
		}
	}
	async function savePatchArtifact() {
		if (!workspace || !latestChange) return;
		const stored = await saveArtifact({
			name: `Code patch · ${latestChange.path}`,
			kind: "patch",
			content: latestChange.patchText,
			provenance: {
				producedBy: `ocade.code:${workspace.id}`,
				verified: latestChange.undoVerified,
				evidence: latestChange.receipt.evidence
			},
			privacyClass: "on_device",
			compatibleApps: ["Git", "text editors"]
		});
		if (!stored.ok) {
			setError(stored.reason);
			return;
		}
		toast.success("Patch saved to on-device Artifacts.");
		setTerminal((lines) => [...lines, `artifact: ${stored.data.id} · sha256 ${stored.data.sha256.slice(0, 12)}…`]);
	}
	function exportReceipt() {
		if (!workspace) return;
		download(`${workspace.name.replace(/[^\w-]+/g, "-") || "ocade-code"}-receipt.json`, JSON.stringify({
			workspaceId: workspace.id,
			name: workspace.name,
			revision: workspace.revision,
			files: workspace.files.map((file) => file.path),
			changes: workspace.changes,
			history: workspace.history,
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			boundary: "This receipt records the on-device session workspace. Host files were not written by the browser."
		}, null, 2), "application/json");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Repository"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-3xl text-xs text-muted-foreground",
						children: "Load user-selected text files into session memory. The browser does not receive a hidden filesystem or shell, and it does not write the selected directory."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: (node) => {
									fileInputRef.current = node;
									if (node) node.setAttribute("webkitdirectory", "");
								},
								type: "file",
								multiple: true,
								className: "sr-only",
								onChange: (event) => void loadSelectedFiles(event.target.files),
								"aria-label": "Select repository folder"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => fileInputRef.current?.click(),
								disabled: busy,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
									className: "mr-1.5 h-3.5 w-3.5",
									"aria-hidden": true
								}), " Select folder"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "outline",
								onClick: loadSample,
								disabled: busy,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCodeCorner, {
									className: "mr-1.5 h-3.5 w-3.5",
									"aria-hidden": true
								}), " Load temporary sample"]
							})
						]
					})]
				}), workspace ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded border border-border/60 px-2 py-1",
							children: workspace.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "rounded border border-border/60 px-2 py-1",
							children: [workspace.files.length, " files"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "rounded border border-border/60 px-2 py-1",
							children: ["revision ", workspace.revision]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded border border-border/60 px-2 py-1",
							children: "session memory only"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 rounded border border-dashed border-border/70 p-3 text-xs text-muted-foreground",
					children: "No repository loaded. Select a folder or use the bounded temporary sample."
				})]
			}),
			workspace ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
							className: "min-h-[420px] p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
								children: "File tree"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-h-[520px] space-y-0.5 overflow-auto",
								children: workspace.files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									"aria-current": selectedPath === file.path ? "true" : void 0,
									onClick: () => setSelectedPath(file.path),
									className: `block w-full truncate rounded px-2 py-1.5 text-left font-mono text-[11px] ${selectedPath === file.path ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent"}`,
									title: file.path,
									children: file.path
								}, file.path))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
							className: "min-w-0 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "truncate font-mono text-xs font-semibold",
									children: selectedFile?.path ?? "Select a file"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-muted-foreground",
									children: "read-only preview"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "mt-2 max-h-[500px] min-h-[360px] overflow-auto rounded border border-border/60 bg-background/50 p-3 font-mono text-[11px] leading-5 text-foreground",
								children: selectedFile?.content ?? ""
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
							className: "p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-xs font-semibold",
								children: "Applicable instructions"
							}), instructions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 space-y-2",
								children: instructions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded border border-border/60 p-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-mono text-[10px] font-semibold text-foreground",
										children: item.path
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
										className: "mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-muted-foreground",
										children: item.content
									})]
								}, item.path))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-muted-foreground",
								children: "No applicable AGENTS.md file was supplied for this path."
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "flex items-center gap-2 text-sm font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
										className: "h-4 w-4",
										"aria-hidden": true
									}), " Secure generated-code sandbox"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 max-w-3xl text-xs text-muted-foreground",
									children: "Generated JavaScript receives only readText, writeText, log and bounded sleep. Filesystem scope, subprocesses, dynamic code and network access are denied. The browser validates the plan but never pretends it launched the isolated host."
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "outline",
									onClick: validateSandboxPlan,
									children: "Validate sandbox plan"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => void executeSandboxPlan(),
									disabled: sandboxRunning,
									children: sandboxRunning ? "Running…" : "Execute in sandbox"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: generatedScript,
							onChange: (event) => {
								setGeneratedScript(event.target.value);
								setSandboxStatus(null);
							},
							"aria-label": "Generated sandbox script",
							className: "mt-3 min-h-32 font-mono text-[11px]",
							spellCheck: false
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground",
							children: [
								"network denied",
								"imports denied",
								"child processes denied",
								"10 s",
								"128 MB"
							].map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded border border-border/60 px-2 py-1",
								children: label
							}, label))
						}),
						sandboxStatus ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "status",
							className: "mt-2 text-xs text-muted-foreground",
							children: sandboxStatus
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Map and diagnostics"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Imports, exports, cycles, broken relative imports, and conservative unreferenced findings."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: runAnalysis,
								children: "Analyse repository"
							})]
						}), analysis ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "status",
							className: "mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3",
							children: [[
								["Files", analysis.diagnostics.files],
								["Internal edges", analysis.diagnostics.edges],
								["Symbols", analysis.symbols.length],
								["Broken imports", analysis.diagnostics.brokenImports],
								["Cycles", analysis.diagnostics.cycles],
								["Unparsed", analysis.map.unparsed.length]
							].map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded border border-border/60 p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] text-muted-foreground",
									children: label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-base font-semibold",
									children: value
								})]
							}, String(label))), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "col-span-full text-[11px] text-muted-foreground",
								children: analysisEvidence
							})]
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Search"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: searchMode,
										onChange: (event) => setSearchMode(event.target.value),
										"aria-label": "Search mode",
										className: "rounded border border-border bg-background px-2 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "text",
												children: "Text"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "symbol",
												children: "Exact symbol"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "references",
												children: "Textual references"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: searchQuery,
										onChange: (event) => setSearchQuery(event.target.value),
										onKeyDown: (event) => {
											if (event.key === "Enter") runSearch();
										},
										placeholder: searchMode === "text" ? "Search repository text" : "Symbol name",
										"aria-label": "Repository search",
										className: "h-9"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										onClick: runSearch,
										children: "Search"
									})
								]
							}),
							searchView.kind === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "status",
								className: "mt-3 text-xs text-destructive",
								children: searchView.message
							}) : searchView.kind === "results" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								role: "status",
								className: "mt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted-foreground",
									children: searchView.evidence
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 max-h-52 space-y-1 overflow-auto",
									children: searchView.rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setSelectedPath(row.path),
										className: "block w-full rounded border border-border/60 p-2 text-left hover:bg-accent",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-[10px] text-primary",
											children: [
												row.path,
												":",
												row.line
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-2 text-[11px] text-muted-foreground",
											children: row.text
										})]
									}, `${row.path}:${row.line}:${index}`))
								})]
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Exact patch and checkpoint"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Preview and apply only when every hunk matches exactly. Before/after SHA-256 and an exercised inverse are recorded before the change is accepted."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "outline",
										onClick: () => void previewPatch(),
										disabled: busy,
										children: "Preview"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										onClick: () => void applyPatch(),
										disabled: busy,
										children: "Apply in session"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "outline",
										onClick: () => void undoLatest(),
										disabled: busy || !latestChange,
										title: latestChange ? "Restore the latest verified checkpoint" : "No applied change to undo",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
											className: "mr-1.5 h-3.5 w-3.5",
											"aria-hidden": true
										}), " Undo latest"]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: diff,
							onChange: (event) => setDiff(event.target.value),
							"aria-label": "Unified patch",
							className: "mt-3 min-h-52 font-mono text-[11px]",
							spellCheck: false
						}),
						preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							role: "status",
							className: "mt-3 grid gap-3 md:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 rounded border border-border/60 p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] font-semibold uppercase text-muted-foreground",
									children: "Before"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
									className: "mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]",
									children: preview.before
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 rounded border border-primary/30 bg-primary/5 p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] font-semibold uppercase text-muted-foreground",
									children: "After"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
									className: "mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]",
									children: preview.after
								})]
							})]
						}) : null,
						latestChange ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
									className: "h-3.5 w-3.5 text-[color:var(--state-success)]",
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: latestChange.receipt.evidence }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"before ",
									latestChange.beforeSha256.slice(0, 12),
									"…"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"after ",
									latestChange.afterSha256.slice(0, 12),
									"…"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void savePatchArtifact(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {
										className: "mr-1 h-3 w-3",
										"aria-hidden": true
									}), " Save artifact"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => download(`${latestChange.path.replace(/[^\w.-]+/g, "-")}.diff`, latestChange.patchText),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
										className: "mr-1 h-3 w-3",
										"aria-hidden": true
									}), " Export patch"]
								})
							]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Tests, build, and runtime"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Commands require a host that returns the observed exit code and output. The browser has no shell; dispatch is refused until a verified companion host is connected."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: command,
									onChange: (event) => setCommand(event.target.value),
									"aria-label": "Code command",
									className: "rounded border border-border bg-background px-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "test",
											children: "Focused/full tests"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "typecheck",
											children: "Typecheck"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "lint",
											children: "Lint"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "build",
											children: "Build"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "runtime",
											children: "Runtime check"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: () => void runCommand(),
									disabled: busy,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
										className: "mr-1.5 h-3.5 w-3.5",
										"aria-hidden": true
									}), " Request run"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								"aria-label": "Terminal output",
								className: "mt-3 min-h-44 max-h-72 overflow-auto rounded border border-border/60 bg-black/80 p-3 font-mono text-[10px] leading-5 text-foreground",
								children: terminal.length > 0 ? terminal.filter((line) => line !== "").join("\n") : "No command observation yet."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold",
									children: "Plan, history, and recovery"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: "Every accepted state transition is visible; command acknowledgements are not promoted to verified execution."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									onClick: exportReceipt,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
										className: "mr-1.5 h-3.5 w-3.5",
										"aria-hidden": true
									}), " Export receipt"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
								className: "mt-3 space-y-1 text-[11px]",
								children: [
									["Repository and rules inspected", true],
									["Map and diagnostics generated", Boolean(analysis)],
									["Patch previewed exactly", Boolean(preview) || workspace.changes.length > 0],
									["Before/after checkpoint recorded", workspace.changes.length > 0],
									["Undo exercised", workspace.changes.some((change) => change.undoVerified)],
									["Tests/build observed", workspace.history.some((entry) => entry.kind === "command" && entry.status === "verified")],
									["Diff and receipt export available", true]
								].map(([label, done]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3.5 w-3.5 text-[color:var(--state-success)]" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-3.5 w-3.5 rounded-full border border-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: done ? "text-foreground" : "text-muted-foreground",
										children: label
									})]
								}, String(label)))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 max-h-52 space-y-1 overflow-auto border-t border-border/60 pt-3",
								children: workspace.history.slice().reverse().map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded border border-border/60 p-2 text-[10px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-foreground",
											children: entry.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto uppercase text-muted-foreground",
											children: entry.status
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-muted-foreground",
										children: entry.evidence
									})]
								}, entry.id))
							})
						]
					})]
				})
			] }) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "mt-0.5 h-4 w-4 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: error })]
			}) : null
		]
	});
}
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
var searchInput = objectType({
	root: stringType().min(1).max(4096),
	match: stringType().min(1).max(200),
	limit: numberType().int().min(1).max(200).optional()
});
var searchFilesFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(searchInput).handler(createSsrRpc("8bca26ff384851c90aab377c72549bd7407e12018a3f41fccd7eb7be0a0632d4"));
var copyInput = objectType({
	root: stringType().min(1).max(4096),
	from: stringType().min(1).max(4096),
	to: stringType().min(1).max(4096)
});
var copyFileFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(copyInput).handler(createSsrRpc("947f978722fceab4a92d9fefce979439e048c3d0b818e3be3e4242aeaf592613"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(copyInput).handler(createSsrRpc("917be85dfb5b1e13232ea5272a556560b76e648ce0fc22506d97e5ee66123959"));
var deleteInput = objectType({
	root: stringType().min(1).max(4096),
	trashDir: stringType().min(1).max(4096),
	target: stringType().min(1).max(4096)
});
var deleteToTrashFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(deleteInput).handler(createSsrRpc("9291794df69fee9b58e441a474b33c600cdb510832b67c3136ce3c50d6ab45c7"));
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
var restoreFromTrashFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(restoreInput).handler(createSsrRpc("e10ee9206e4b04647fb3d67e2a1ffc29a124ffd7d0a9e67375a0ee713432c967"));
/**
* Production owner for real file management (G1-G4).
*
* The operations underneath were proven against the real filesystem — search,
* read, create, copy, move, rename, reversible delete and restore, with every
* result verified by re-reading the disk and comparing content hashes. This is
* the surface that makes them reachable rather than script-only.
*
* WHAT IT DELIBERATELY WILL NOT DO
*
* There is no permanent delete. Deleting moves the file to a trash folder and
* hands back a record; restoring puts it back and refuses unless the content
* hashes match what was recorded. A file cannot be destroyed from here.
*
* The approved folder is typed by the user, not inferred, and every operation
* is confined to it. System locations are refused even if typed in — that check
* lives in the file layer, not in this component, so it cannot be bypassed by
* calling the server function another way.
*/
function FileManagerPanel() {
	const [root, setRoot] = (0, import_react.useState)("");
	const [query, setQuery] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)(null);
	const [trashed, setTrashed] = (0, import_react.useState)([]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [problem, setProblem] = (0, import_react.useState)(null);
	const short = (p) => p.replace(/\\/g, "/").split("/").slice(-2).join("/");
	const run = (0, import_react.useCallback)(async (label, fn) => {
		setBusy(true);
		setProblem(null);
		try {
			await fn();
		} catch (error) {
			setProblem(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			setBusy(false);
		}
	}, []);
	const search = (0, import_react.useCallback)(() => run("Search", async () => {
		const result = await searchFilesFn({ data: {
			root,
			match: query
		} });
		if (!result.ok) {
			setProblem(result.reason);
			setHits(null);
			return;
		}
		setHits(result.hits);
		if (result.truncated) toast.info("Showing the first matches only.");
	}), [
		root,
		query,
		run
	]);
	const duplicate = (0, import_react.useCallback)((path) => run("Copy", async () => {
		const result = await copyFileFn({ data: {
			root,
			from: path,
			to: `${path}.copy`
		} });
		if (!result.ok) setProblem(result.reason);
		else toast.success("Copied, and the copy was verified byte for byte.");
	}), [root, run]);
	const remove = (0, import_react.useCallback)((path) => run("Delete", async () => {
		const result = await deleteToTrashFn({ data: {
			root,
			trashDir: `${root}/.ocade-trash`,
			target: path
		} });
		if (!result.ok) {
			setProblem(result.reason);
			return;
		}
		setTrashed((t) => [...t, result.record]);
		setHits((h) => h?.filter((x) => x.path !== path) ?? null);
		toast.success("Moved to trash. You can put it back.");
	}), [root, run]);
	const restore = (0, import_react.useCallback)((record) => run("Restore", async () => {
		const result = await restoreFromTrashFn({ data: {
			root,
			record
		} });
		if (!result.ok) {
			setProblem(result.reason);
			return;
		}
		setTrashed((t) => t.filter((r) => r.id !== record.id));
		toast.success("Restored, and the contents match exactly.");
	}), [root, run]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-5 rounded-lg border border-border p-4",
		"aria-labelledby": "files-heading",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				id: "files-heading",
				className: "text-sm font-medium",
				children: "Files"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Works only inside a folder you name here. System folders are refused even if you type one, and deleting always moves to a recoverable trash folder rather than destroying anything."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "sr-only",
						htmlFor: "files-root",
						children: "Approved folder"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "files-root",
						className: "min-w-64 flex-1 rounded border border-border bg-background px-2 py-1 text-xs",
						placeholder: "Folder to work in, e.g. C:\\Users\\you\\Documents\\project",
						value: root,
						onChange: (e) => setRoot(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "sr-only",
						htmlFor: "files-query",
						children: "Search for"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "files-query",
						className: "w-40 rounded border border-border bg-background px-2 py-1 text-xs",
						placeholder: "name contains…",
						value: query,
						onChange: (e) => setQuery(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50",
						onClick: () => void search(),
						disabled: busy || root.trim() === "" || query.trim() === "",
						children: busy ? "Working…" : "Search"
					})
				]
			}),
			problem && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-destructive",
				role: "alert",
				children: problem
			}),
			hits && hits.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: "Nothing matched in that folder."
			}),
			hits && hits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-1",
				children: hits.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						title: hit.path,
						children: short(hit.path)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex shrink-0 gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "rounded border border-border px-2 py-0.5 disabled:opacity-50",
							onClick: () => void duplicate(hit.path),
							disabled: busy,
							children: "Copy"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "rounded border border-border px-2 py-0.5 disabled:opacity-50",
							onClick: () => void remove(hit.path),
							disabled: busy,
							children: "Delete"
						})]
					})]
				}, hit.path))
			}),
			trashed.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-xs font-medium",
					children: "Recently deleted — recoverable"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-1",
					children: trashed.map((record) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							title: record.originalPath,
							children: short(record.originalPath)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "shrink-0 rounded border border-border px-2 py-0.5 disabled:opacity-50",
							onClick: () => void restore(record),
							disabled: busy,
							children: "Put back"
						})]
					}, record.id))
				})]
			})
		]
	});
}
function CodePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Code",
			description: "Inspect a user-selected repository, follow its rules, patch exact context, exercise recovery, and keep observed evidence."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeWorkspacePanel, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileManagerPanel, {})
	] });
}
//#endregion
export { CodePage as component };
