import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-YIOAnk22.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, Nt as MessageSquare, Wt as LoaderCircle, mn as FolderKanban, yn as FileOutput } from "../_libs/lucide-react.mjs";
import { t as useSession } from "./session-C8v4p4SE.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { i as resolveAdapter, t as getModeFor } from "./resolver-BwyMoUKb.mjs";
import { d as isLocalProjectKey, l as isConversationKey, u as isLocalOutputKey } from "./local-projects-CdfYsRJa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.search-D0zuoo9B.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Search that reads this device first.
*
* WHAT WAS WRONG. `ocade.search.tsx` issued six Supabase queries and nothing
* else. Three consequences followed, and all three contradict what the rest of
* the product now promises:
*
*  - A Browser Only conversation is never uploaded, by design. So it could not
*    be found. The one privacy mode whose whole point is that the data stays
*    here made that data unsearchable.
*  - Offline, Search threw. Every conversation was sitting in the vault a few
*    milliseconds away.
*  - A Private Sync message written seconds ago but not yet drained from the
*    outbox did not exist upstream, so Search could not see what Chat was
*    already showing.
*
* Ranking is deliberately simple and explainable rather than a scoring model:
* a title match beats a body match, an earlier match beats a later one, and
* recency breaks ties. Someone who typed three letters wants the thing they
* were just working on.
*/
/** Case-insensitive index of `needle` in `hay`, or -1. */
function indexOfCI(hay, needle) {
	return hay.toLowerCase().indexOf(needle.toLowerCase());
}
/**
* A window of text around the match, with the match itself inside it.
*
* Returning the first 220 characters of a long message — which is what the
* Supabase version did — routinely showed a snippet not containing the word
* the person searched for, which reads as a wrong result.
*/
function snippetAround(text, query, width = 180) {
	const at = indexOfCI(text, query);
	if (at < 0) return text.slice(0, width);
	const start = Math.max(0, at - Math.floor(width / 3));
	const end = Math.min(text.length, start + width);
	return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
/**
* Score one candidate.
*
* Title matches outrank body matches because a conversation called "Tax
* return" is a better answer to "tax" than a message mentioning it once. An
* earlier position scores higher because a match in the first few words is
* usually the subject rather than an aside.
*/
function scoreMatch(title, body, query) {
	const inTitle = indexOfCI(title, query);
	const inBody = indexOfCI(body, query);
	if (inTitle < 0 && inBody < 0) return 0;
	let score = 0;
	if (inTitle >= 0) score += 100 - Math.min(50, inTitle);
	if (inBody >= 0) score += 40 - Math.min(30, Math.floor(inBody / 40));
	if (inTitle === 0) score += 25;
	return score;
}
/** Pure, so every ranking rule is testable without a browser or a database. */
function searchLocalRecords(query, deps) {
	const q = query.trim();
	if (q.length < 2) return [];
	const titles = new Map(deps.conversations.map((c) => [c.id, c.title]));
	const out = [];
	for (const c of deps.conversations) {
		if (c.deleted_at) continue;
		const score = scoreMatch(c.title ?? "", "", q);
		if (score <= 0) continue;
		out.push({
			key: `conversation:${c.id}`,
			kind: "conversation",
			title: c.title || "Untitled conversation",
			createdAt: c.updated_at,
			conversationId: c.id,
			score,
			local: true
		});
	}
	for (const m of deps.messages) {
		const score = scoreMatch("", m.content ?? "", q);
		if (score <= 0) continue;
		out.push({
			key: `message:${m.id}`,
			kind: "message",
			title: titles.get(m.conversation_id) || "Untitled conversation",
			excerpt: snippetAround(m.content ?? "", q),
			createdAt: m.created_at,
			conversationId: m.conversation_id,
			score,
			local: true
		});
	}
	for (const project of deps.projects ?? []) {
		if (project.deleted_at) continue;
		const score = scoreMatch(project.name, project.instructions ?? "", q);
		if (score <= 0) continue;
		out.push({
			key: `project:${project.id}`,
			kind: "project",
			title: project.name,
			excerpt: project.instructions ? snippetAround(project.instructions, q) : void 0,
			createdAt: project.updated_at,
			score,
			local: true
		});
	}
	for (const output of deps.outputs ?? []) {
		if (output.deleted_at) continue;
		const score = scoreMatch(output.title, output.content ?? "", q);
		if (score <= 0) continue;
		out.push({
			key: `output:${output.id}`,
			kind: "output",
			title: output.title,
			excerpt: output.content ? snippetAround(output.content, q) : void 0,
			createdAt: output.updated_at,
			score,
			local: true
		});
	}
	return sortResults(out);
}
/** Score first, then recency. Stable and explainable. */
function sortResults(rows) {
	return [...rows].sort((a, b) => b.score - a.score || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}
/**
* Fold server rows in without duplicating what the device already has.
*
* Keyed by the result key, which for a conversation or message is its id — and
* ids are generated on the device now, so the same record genuinely carries
* the same key on both sides. The local copy wins because it may contain an
* edit that has not drained from the outbox yet.
*/
function mergeSearchResults(local, remote) {
	const byKey = new Map(local.map((r) => [r.key, r]));
	for (const r of remote) if (!byKey.has(r.key)) byKey.set(r.key, r);
	return sortResults([...byKey.values()]);
}
/** Read everything this device holds for the signed-in user. */
async function readLocalCorpus(userId) {
	const [chatAdapter, fileAdapter] = await Promise.all([resolveAdapter(userId, "chats"), resolveAdapter(userId, "files")]);
	const [rows, fileRows] = await Promise.all([chatAdapter.list("chats"), fileAdapter.list("files")]);
	const conversations = [];
	const messages = [];
	const projects = [];
	const outputs = [];
	for (const row of rows) {
		if (!row.value) continue;
		if (isConversationKey(row.id)) conversations.push(row.value);
		else messages.push(row.value);
	}
	for (const row of fileRows) {
		if (!row.value) continue;
		if (isLocalProjectKey(row.id)) projects.push(row.value);
		if (isLocalOutputKey(row.id)) outputs.push(row.value);
	}
	return {
		conversations,
		messages,
		projects,
		outputs
	};
}
/** Escape LIKE wildcards while keeping the value inside typed filter calls. */
function escapedLike(raw) {
	return raw.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
/**
* Search only through Supabase's parameterized filter methods.
*
* `.or()` accepts raw PostgREST filter grammar. Interpolating search text into
* that string lets punctuation such as commas or parentheses alter the filter
* expression even when LIKE wildcards are escaped. Separate typed queries keep
* the user's text as data, then de-duplicate matching records by id.
*/
/**
* The REMOTE half only. Runs when Private Sync is on and the network answers.
*
* Kept as separate typed queries rather than one `.or()` because `.or()` takes
* raw PostgREST grammar, and interpolating a person's search text into that
* lets punctuation alter the filter expression even with LIKE wildcards
* escaped. The user's text stays data.
*/
async function searchRemote(raw) {
	const q = raw.trim();
	if (q.length < 2) return [];
	const pattern = `%${escapedLike(q)}%`;
	const [conversations, messages, projectsByName, projectsByInstructions, outputsByTitle, outputsByContent] = await Promise.all([
		supabase.from("ocade_conversations").select("id, title, updated_at").ilike("title", pattern).limit(20),
		supabase.from("ocade_messages").select("id, conversation_id, role, content, created_at").ilike("content", pattern).limit(30),
		supabase.from("ocade_projects").select("id, name, instructions, updated_at").ilike("name", pattern).limit(20),
		supabase.from("ocade_projects").select("id, name, instructions, updated_at").ilike("instructions", pattern).limit(20),
		supabase.from("ocade_outputs").select("id, title, content, kind, created_at").ilike("title", pattern).limit(20),
		supabase.from("ocade_outputs").select("id, title, content, kind, created_at").ilike("content", pattern).limit(20)
	]);
	const firstError = [
		conversations,
		messages,
		projectsByName,
		projectsByInstructions,
		outputsByTitle,
		outputsByContent
	].find((response) => response.error)?.error;
	if (firstError) throw firstError;
	const projects = /* @__PURE__ */ new Map();
	for (const row of [...projectsByName.data ?? [], ...projectsByInstructions.data ?? []]) projects.set(row.id, row);
	const outputs = /* @__PURE__ */ new Map();
	for (const row of [...outputsByTitle.data ?? [], ...outputsByContent.data ?? []]) outputs.set(row.id, row);
	return [
		...(conversations.data ?? []).map((row) => ({
			key: `conversation:${row.id}`,
			kind: "conversation",
			title: row.title || "Untitled conversation",
			createdAt: row.updated_at,
			conversationId: row.id,
			score: scoreMatch(row.title ?? "", "", q),
			local: false
		})),
		...(messages.data ?? []).map((row) => ({
			key: `message:${row.id}`,
			kind: "message",
			title: `${row.role === "assistant" ? "OCADE" : "You"} message`,
			excerpt: snippetAround(row.content ?? "", q),
			createdAt: row.created_at,
			conversationId: row.conversation_id,
			score: scoreMatch("", row.content ?? "", q),
			local: false
		})),
		...[...projects.values()].map((row) => ({
			key: `project:${row.id}`,
			kind: "project",
			title: row.name,
			excerpt: row.instructions ? snippetAround(row.instructions, q) : void 0,
			createdAt: row.updated_at,
			score: scoreMatch(row.name ?? "", row.instructions ?? "", q),
			local: false
		})),
		...[...outputs.values()].map((row) => ({
			key: `output:${row.id}`,
			kind: "output",
			title: row.title,
			excerpt: row.content ? snippetAround(row.content, q) : void 0,
			createdAt: row.created_at,
			score: scoreMatch(row.title ?? "", row.content ?? "", q),
			local: false
		}))
	];
}
function SearchPage() {
	const { user } = useSession();
	const userId = user?.id ?? "";
	const [query, setQuery] = (0, import_react.useState)("");
	const normalized = (0, import_react.useMemo)(() => query.trim(), [query]);
	const results = useQuery({
		queryKey: [
			"ocade-universal-search",
			normalized,
			userId
		],
		enabled: normalized.length >= 2 && userId.length > 0,
		queryFn: async () => {
			const corpus = await readLocalCorpus(userId);
			const local = searchLocalRecords(normalized, corpus);
			const mode = await getModeFor(userId, "chats").catch(() => "browser_only");
			const online = typeof navigator === "undefined" ? true : navigator.onLine;
			if (mode !== "private_sync" || !online) return local;
			try {
				return mergeSearchResults(local, await searchRemote(normalized));
			} catch {
				return local;
			}
		},
		staleTime: 1e4
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "Search",
		description: "Search your actual conversations, message text, projects and saved outputs. Results are protected by the same RLS rules as the source records."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-6 max-w-3xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
				className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				autoFocus: true,
				value: query,
				onChange: (event) => setQuery(event.target.value),
				placeholder: "Search OCADE…",
				className: "pl-9",
				"aria-label": "Search OCADE"
			})]
		}), normalized.length < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-muted-foreground",
			children: "Type at least two characters."
		}) : results.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 flex items-center gap-2 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Searching your workspace…"]
		}) : results.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive",
			children: [
				"Search failed:",
				" ",
				results.error instanceof Error ? results.error.message : String(results.error)
			]
		}) : results.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted-foreground",
			children: "No matching OCADE content."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-4 overflow-hidden p-0",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: results.data.map((result) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultRow, { result }, result.key))
			})
		})]
	})] });
}
function ResultRow({ result }) {
	const Icon = result.kind === "project" ? FolderKanban : result.kind === "output" ? FileOutput : MessageSquare;
	const to = result.kind === "project" ? "/ocade/projects" : result.kind === "output" ? "/ocade/artifacts" : "/ocade";
	const search = result.conversationId ? { conversation: result.conversationId } : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to,
		...search ? { search } : {},
		className: "flex gap-3 px-4 py-3 hover:bg-accent/40",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0 flex-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-sm font-medium text-foreground",
					children: result.title
				}),
				result.excerpt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground",
					children: result.excerpt
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70",
					children: [result.kind, result.createdAt ? ` · ${new Date(result.createdAt).toLocaleString()}` : ""]
				})
			]
		})]
	}) });
}
//#endregion
export { SearchPage as component };
