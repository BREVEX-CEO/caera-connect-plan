import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Gt as ListChecks, Qn as CircleAlert, Wt as LoaderCircle, Y as RefreshCw, it as Plus, pt as Pause, st as Play, w as Square } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-C8v4p4SE.mjs";
import { a as retryTask, i as removeLocalTask, n as listLocalTasks, r as persistTask, s as transitionTask, t as createUnifiedTask } from "./unified-task-BYmmu_RT.mjs";
import { d as subscribeToRuns, s as reconcileInterruptedRuns } from "./runs-Dy-PZWN-.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogHeader, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { c as pauseAutomationRun, f as updateAutomation, n as cancelAutomationRun, o as listAutomationRuns, s as listAutomations, u as resumeAutomationRun } from "./ocade-automations.functions-CbfKVKvK.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/TasksWorkspace-kWT5Chen.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STORAGE_KEY = "ocade:task-comments:v1";
function readAll() {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function writeAll(comments) {
	if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(comments.slice(-1e3)));
}
function listTaskComments(taskId, includeArchived = false) {
	return readAll().filter((comment) => comment.taskId === taskId && (includeArchived || !comment.archivedAt)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
function createTaskComment(input, at = (/* @__PURE__ */ new Date()).toISOString(), id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
	const body = input.body.trim();
	if (!input.taskId.trim()) throw new Error("A comment needs a task anchor.");
	if (!body) throw new Error("Write a comment before posting.");
	const all = readAll();
	if (input.parentId && !all.some((comment) => comment.id === input.parentId && comment.taskId === input.taskId)) throw new Error("That reply target is no longer available.");
	const comment = {
		id,
		taskId: input.taskId,
		parentId: input.parentId ?? null,
		author: "You on this device",
		body,
		createdAt: at,
		updatedAt: at,
		resolvedAt: null,
		archivedAt: null,
		reacted: false
	};
	writeAll([...all, comment]);
	return comment;
}
function patchComment(id, patch, at = (/* @__PURE__ */ new Date()).toISOString()) {
	const all = readAll();
	const current = all.find((comment) => comment.id === id);
	if (!current) throw new Error("That comment no longer exists.");
	const next = {
		...current,
		...patch,
		updatedAt: at
	};
	writeAll(all.map((comment) => comment.id === id ? next : comment));
	return next;
}
function editTaskComment(id, body, at) {
	const clean = body.trim();
	if (!clean) throw new Error("A comment cannot be empty.");
	return patchComment(id, { body: clean }, at);
}
function setTaskCommentResolved(id, resolved, at = (/* @__PURE__ */ new Date()).toISOString()) {
	return patchComment(id, { resolvedAt: resolved ? at : null }, at);
}
function setTaskCommentArchived(id, archived, at = (/* @__PURE__ */ new Date()).toISOString()) {
	return patchComment(id, { archivedAt: archived ? at : null }, at);
}
function toggleTaskCommentReaction(id, at) {
	const current = readAll().find((comment) => comment.id === id);
	if (!current) throw new Error("That comment no longer exists.");
	return patchComment(id, { reacted: !current.reacted }, at);
}
function deleteTaskComment(id) {
	const all = readAll();
	if (!all.some((comment) => comment.id === id)) return false;
	writeAll(all.filter((comment) => comment.id !== id));
	return true;
}
function mentionsInComment(body) {
	return [...new Set(body.match(/@[a-z0-9][a-z0-9._-]*/gi) ?? [])];
}
function TaskComments({ taskId }) {
	const [comments, setComments] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [replyTo, setReplyTo] = (0, import_react.useState)(null);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [showArchived, setShowArchived] = (0, import_react.useState)(false);
	const refresh = (0, import_react.useCallback)((archived = showArchived) => {
		setComments(listTaskComments(taskId, archived));
	}, [taskId, showArchived]);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	function submit() {
		try {
			if (editing) editTaskComment(editing, draft);
			else createTaskComment({
				taskId,
				body: draft,
				parentId: replyTo
			});
			setDraft("");
			setReplyTo(null);
			setEditing(null);
			refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save the comment.");
		}
	}
	const roots = comments.filter((comment) => !comment.parentId || !comments.some((candidate) => candidate.id === comment.parentId));
	const replies = (id) => comments.filter((comment) => comment.parentId === id);
	function actions(comment) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 flex flex-wrap gap-2 text-[11px]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setReplyTo(comment.id);
						setEditing(null);
						setDraft("");
					},
					className: "underline",
					children: "Reply"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setEditing(comment.id);
						setReplyTo(null);
						setDraft(comment.body);
					},
					className: "underline",
					children: "Edit"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": comment.reacted,
					onClick: () => {
						toggleTaskCommentReaction(comment.id);
						refresh();
					},
					className: "underline",
					children: comment.reacted ? "Remove acknowledgement" : "Acknowledge"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setTaskCommentResolved(comment.id, !comment.resolvedAt);
						refresh();
					},
					className: "underline",
					children: comment.resolvedAt ? "Reopen" : "Resolve"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setTaskCommentArchived(comment.id, !comment.archivedAt);
						refresh();
					},
					className: "underline",
					children: comment.archivedAt ? "Restore" : "Archive"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						if (window.confirm("Delete this on-device comment?")) {
							deleteTaskComment(comment.id);
							refresh();
						}
					},
					className: "underline text-destructive",
					children: "Delete"
				})
			]
		});
	}
	function commentCard(comment, nested = false) {
		const mentions = mentionsInComment(comment.body);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: `${nested ? "ml-5" : ""} rounded-lg border border-border/50 p-3`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						comment.author,
						comment.resolvedAt ? " · resolved" : "",
						comment.archivedAt ? " · archived" : ""
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						dateTime: comment.updatedAt,
						children: new Date(comment.updatedAt).toLocaleString()
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 whitespace-pre-wrap text-sm",
					children: comment.body
				}),
				mentions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					"aria-label": "Mentions",
					className: "mt-1 text-[11px] text-primary",
					children: ["Mentions: ", mentions.join(", ")]
				}) : null,
				actions(comment)
			]
		}, comment.id);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "task-comments-title",
		className: "border-t border-border/50 pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					id: "task-comments-title",
					className: "text-sm font-medium",
					children: ["Comments ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						"aria-label": `${comments.length} comments`,
						children: [
							"(",
							comments.length,
							")"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: showArchived,
						onChange: (event) => setShowArchived(event.target.checked)
					}), "Show archived"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted-foreground",
				children: "Anchored to this task and stored only on this device. No teammate is notified."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 space-y-2",
				children: [roots.map((root) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [commentCard(root), replies(root.id).map((reply) => commentCard(reply, true))]
				}, root.id)), !comments.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground",
					children: "No comments on this task."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [
					editing || replyTo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center justify-between text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: editing ? "Editing comment" : "Replying in thread" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setEditing(null);
								setReplyTo(null);
								setDraft("");
							},
							className: "underline",
							children: "Cancel"
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 flex gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@OCADE `),
							className: "min-h-8 rounded-md border border-border/60 px-2 text-xs",
							children: "Mention OCADE"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						value: draft,
						onChange: (event) => setDraft(event.target.value),
						"aria-label": "Task comment",
						placeholder: "Add an on-device comment",
						rows: 3
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						className: "mt-2",
						disabled: !draft.trim(),
						onClick: submit,
						children: editing ? "Save edit" : replyTo ? "Post reply" : "Post comment"
					})
				]
			})
		]
	});
}
var TASK_BOARD_COLUMNS = [
	{
		id: "queued",
		label: "Queued",
		description: "Ready to plan or start"
	},
	{
		id: "active",
		label: "Active",
		description: "Executing or verifying"
	},
	{
		id: "waiting",
		label: "Waiting",
		description: "Needs permission or input"
	},
	{
		id: "closed",
		label: "Closed",
		description: "Completed, failed or cancelled"
	}
];
function taskBoardColumn(task) {
	if (task.status === "CREATED" || task.status === "PLANNING") return "queued";
	if (task.status === "EXECUTING" || task.status === "VERIFYING") return "active";
	if (task.status === "WAITING_PERMISSION" || task.status === "WAITING_USER") return "waiting";
	return "closed";
}
function moveTaskToColumn(task, destination, at = (/* @__PURE__ */ new Date()).toISOString()) {
	if (taskBoardColumn(task) === destination) return task;
	if (destination === "queued") {
		if (task.status === "FAILED" || task.status === "CANCELLED") return retryTask(task, at);
		throw new Error("Only failed or cancelled tasks can return to Queued.");
	}
	if (destination === "active") {
		if (task.status === "COMPLETED") throw new Error("A completed task cannot be reopened.");
		return transitionTask(task.status === "FAILED" || task.status === "CANCELLED" ? retryTask(task, at) : task, "EXECUTING", {}, at);
	}
	if (destination === "waiting") {
		if (task.status === "COMPLETED") throw new Error("A completed task cannot be reopened.");
		let ready = task;
		if (ready.status === "FAILED" || ready.status === "CANCELLED") ready = retryTask(ready, at);
		if (ready.status === "CREATED") ready = transitionTask(ready, "PLANNING", {}, at);
		if (ready.status === "VERIFYING") ready = transitionTask(ready, "EXECUTING", {}, at);
		if (ready.status === "WAITING_PERMISSION" || ready.status === "WAITING_USER") return ready;
		return transitionTask(ready, "WAITING_USER", {}, at);
	}
	if (task.status === "COMPLETED" || task.status === "FAILED" || task.status === "CANCELLED") return task;
	return transitionTask(task, "CANCELLED", {}, at);
}
function filterAndSortTasks(tasks, query, source, sort) {
	const needle = query.trim().toLowerCase();
	return tasks.filter((task) => (source === "all" || task.source === source) && (!needle || `${task.title} ${task.request ?? ""} ${task.currentStep ?? ""}`.toLowerCase().includes(needle))).sort((a, b) => {
		if (sort === "title") return a.title.localeCompare(b.title);
		if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
		return b.updatedAt.localeCompare(a.updatedAt);
	});
}
function taskSourceGroups(tasks) {
	const groups = /* @__PURE__ */ new Map();
	for (const task of tasks) groups.set(task.source, [...groups.get(task.source) ?? [], task]);
	return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
function taskFeedAuthor(task) {
	if (task.agent?.trim()) return task.agent.trim();
	if (task.source === "automation") return "OCADE Automation";
	if (task.source === "system") return "OCADE System";
	return "You on this device";
}
function paginateTaskFeed(tasks, page, pageSize = 6) {
	const safeSize = Math.max(1, pageSize);
	const pages = Math.max(1, Math.ceil(tasks.length / safeSize));
	const safePage = Math.min(pages, Math.max(1, page));
	return {
		page: safePage,
		pages,
		items: tasks.slice((safePage - 1) * safeSize, safePage * safeSize)
	};
}
function taskAnalytics(tasks, range, now = /* @__PURE__ */ new Date()) {
	const days = range === "all" ? null : Number(range);
	const cutoff = days ? /* @__PURE__ */ new Date(now.getTime() - days * 864e5) : null;
	const current = tasks.filter((task) => !cutoff || new Date(task.createdAt) >= cutoff);
	const prior = days ? tasks.filter((task) => {
		const created = new Date(task.createdAt).getTime();
		return created < cutoff.getTime() && created >= cutoff.getTime() - days * 864e5;
	}) : [];
	const byStatus = [
		"queued",
		"active",
		"waiting",
		"closed"
	].map((column) => ({
		column,
		count: current.filter((task) => taskBoardColumn(task) === column).length
	}));
	const bySource = [...new Set(current.map((task) => task.source))].sort().map((source) => ({
		source,
		count: current.filter((task) => task.source === source).length
	}));
	const completed = current.filter((task) => task.status === "COMPLETED").length;
	return {
		total: current.length,
		completed,
		completionRate: current.length ? Math.round(completed / current.length * 100) : 0,
		priorTotal: prior.length,
		difference: current.length - prior.length,
		byStatus,
		bySource,
		lastUpdated: current.map((task) => task.updatedAt).sort().at(-1) ?? null
	};
}
function timelineDays(anchor, count = 7) {
	const start = new Date(anchor);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - 2);
	return Array.from({ length: Math.max(1, count) }, (_, index) => {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		return date;
	});
}
function scheduleTask(task, day, at = (/* @__PURE__ */ new Date()).toISOString()) {
	const date = new Date(day);
	date.setHours(9, 0, 0, 0);
	return {
		...task,
		scheduledFor: date.toISOString(),
		updatedAt: at
	};
}
function TaskAnalytics({ tasks }) {
	const [range, setRange] = (0, import_react.useState)("30");
	const data = taskAnalytics(tasks, range);
	const max = Math.max(1, ...data.byStatus.map((item) => item.count));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "task-analytics-title",
		className: "mt-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				id: "task-analytics-title",
				className: "text-sm font-medium",
				children: "Task analytics"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Calculated from on-device task records."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "text-xs text-muted-foreground",
				children: ["Date range", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: range,
					onChange: (event) => setRange(event.target.value),
					className: "ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "7",
							children: "Last 7 days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "30",
							children: "Last 30 days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All time"
						})
					]
				})]
			})]
		}), data.total ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid gap-3 sm:grid-cols-4",
				children: [
					["Tasks", data.total],
					["Completed", data.completed],
					["Completion rate", `${data.completionRate}%`],
					["Period change", range === "all" ? "—" : `${data.difference >= 0 ? "+" : ""}${data.difference}`]
				].map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-border/60 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xl font-semibold",
						children: value
					})]
				}, label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
				className: "mt-4 rounded-xl border border-border/60 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
						className: "text-sm font-medium",
						children: "Tasks by status"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"aria-label": "Horizontal axis, task count",
						className: "mt-1 flex justify-between text-[10px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0 tasks" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [max, " tasks"] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 space-y-2",
						children: data.byStatus.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "capitalize",
									children: item.column
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-3 rounded bg-muted",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full rounded bg-primary",
										style: { width: `${item.count / max * 100}%` }
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.count })
							]
						}, item.column))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-sm font-medium",
					children: "Segment breakdown"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 flex flex-wrap gap-2",
					children: data.bySource.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-full border border-border/60 px-3 py-1 text-xs",
						children: [
							item.source,
							": ",
							item.count
						]
					}, item.source))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs text-muted-foreground",
				children: ["Last updated ", data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "—"]
			})
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground",
			children: "No task data exists in this date range."
		})]
	});
}
function TaskTimeline({ tasks, onChange }) {
	const [dragged, setDragged] = (0, import_react.useState)(null);
	const [anchor] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
	const days = (0, import_react.useMemo)(() => timelineDays(anchor), [anchor]);
	const today = (/* @__PURE__ */ new Date()).toDateString();
	const sources = [...new Set(tasks.map((task) => task.source))].sort();
	const taskDay = (task) => new Date(task.scheduledFor ?? task.createdAt).toDateString();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "task-timeline-title",
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				id: "task-timeline-title",
				className: "text-sm font-medium",
				children: "Task timeline"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Drag a task bar to another day. Dates are stored on this device; terminal tasks appear as milestones."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 overflow-x-auto rounded-xl border border-border/60",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-[760px]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-[9rem_repeat(7,minmax(5rem,1fr))] border-b border-border/60 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-2 font-medium",
								children: "Work area"
							}), days.map((day) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-2 text-center ${day.toDateString() === today ? "bg-primary/10 font-medium" : ""}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block",
										children: day.toLocaleDateString(void 0, { weekday: "short" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: day.toLocaleDateString(void 0, {
											month: "short",
											day: "numeric"
										})
									}),
									day.toDateString() === today ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-[10px] text-primary",
										children: "Today"
									}) : null
								]
							}, day.toISOString()))]
						}),
						sources.map((source) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid min-h-20 grid-cols-[9rem_repeat(7,minmax(5rem,1fr))] border-b border-border/40 last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-2 text-xs font-medium capitalize",
								children: source
							}), days.map((day) => {
								const dayTasks = tasks.filter((task) => task.source === source && taskDay(task) === day.toDateString());
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									onDragOver: (event) => event.preventDefault(),
									onDrop: () => {
										const task = tasks.find((item) => item.id === dragged);
										setDragged(null);
										if (task) onChange(scheduleTask(task, day));
									},
									className: `border-l border-border/40 p-1 ${day.toDateString() === today ? "bg-primary/[0.04]" : ""}`,
									children: dayTasks.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										draggable: true,
										onDragStart: () => setDragged(task.id),
										onDragEnd: () => setDragged(null),
										className: "mb-1 rounded-md border border-primary/30 bg-primary/10 p-1.5 text-[10px]",
										title: "Drag to reschedule",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												"aria-hidden": true,
												children: [
													"COMPLETED",
													"FAILED",
													"CANCELLED"
												].includes(task.status) ? "◆ " : ""
											}),
											task.title,
											task.dependencyTaskIds?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mt-1 block text-muted-foreground",
												children: [
													"Depends on ",
													task.dependencyTaskIds.length,
													" task(s)"
												]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "mt-1 block text-muted-foreground",
												children: ["Reschedule", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
													"aria-label": `Reschedule ${task.title}`,
													value: days.findIndex((candidate) => candidate.toDateString() === taskDay(task)),
													onChange: (event) => {
														const target = days[Number(event.target.value)];
														if (target) onChange(scheduleTask(task, target));
													},
													className: "mt-0.5 block w-full bg-background text-foreground",
													children: days.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: index,
														children: option.toLocaleDateString(void 0, {
															month: "short",
															day: "numeric"
														})
													}, option.toISOString()))
												})]
											})
										]
									}, task.id))
								}, day.toISOString());
							})]
						}, source)),
						!tasks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "p-4 text-sm text-muted-foreground",
							children: "No scheduled tasks on this timeline."
						}) : null
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-muted-foreground",
				children: "Dependency labels appear only when a task has explicit dependency task IDs. OCADE does not infer them."
			})
		]
	});
}
var SOURCES = [
	"all",
	"work",
	"automation",
	"code",
	"research",
	"monitor",
	"system"
];
function TaskBoard() {
	const [tasks, setTasks] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [query, setQuery] = (0, import_react.useState)("");
	const [source, setSource] = (0, import_react.useState)("all");
	const [sort, setSort] = (0, import_react.useState)("updated");
	const [group, setGroup] = (0, import_react.useState)("status");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [draggedId, setDraggedId] = (0, import_react.useState)(null);
	const [view, setView] = (0, import_react.useState)("board");
	const [feedPage, setFeedPage] = (0, import_react.useState)(1);
	const [lastSeen, setLastSeen] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let live = true;
		const refresh = () => listLocalTasks().then((items) => {
			if (live) {
				setTasks(items);
				setLoading(false);
			}
		});
		reconcileInterruptedRuns().catch(() => void 0).then(refresh);
		const unsubscribe = subscribeToRuns(() => {
			refresh();
		});
		return () => {
			live = false;
			unsubscribe();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (typeof sessionStorage !== "undefined") {
			setLastSeen(sessionStorage.getItem("ocade:task-feed:last-seen") ?? "");
			sessionStorage.setItem("ocade:task-feed:last-seen", (/* @__PURE__ */ new Date()).toISOString());
		}
	}, []);
	const visible = (0, import_react.useMemo)(() => filterAndSortTasks(tasks, query, source, sort), [
		tasks,
		query,
		source,
		sort
	]);
	const feed = (0, import_react.useMemo)(() => paginateTaskFeed(visible, feedPage), [visible, feedPage]);
	const newCount = visible.filter((task) => !lastSeen || task.updatedAt > lastSeen).length;
	async function addTask() {
		if (!draft.trim()) return;
		const task = createUnifiedTask({
			source: "work",
			title: draft.trim()
		});
		await persistTask(task);
		setTasks((current) => [task, ...current]);
		setDraft("");
		toast.success("Task added to Queued on this device.");
	}
	async function move(task, destination) {
		try {
			const moved = moveTaskToColumn(task, destination);
			await persistTask(moved);
			setTasks((current) => current.map((item) => item.id === moved.id ? moved : item));
			setSelected((current) => current?.id === moved.id ? moved : current);
			toast.success(`Moved “${task.title}” to ${destination}.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "This task cannot move there.");
		}
	}
	async function saveTask(task) {
		await persistTask(task);
		setTasks((current) => current.map((item) => item.id === task.id ? task : item));
		setSelected((current) => current?.id === task.id ? task : current);
	}
	async function editSelectedTitle() {
		if (!selected) return;
		const title = window.prompt("Task title", selected.title)?.trim();
		if (!title || title === selected.title) return;
		await saveTask({
			...selected,
			title,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		toast.success("Task title updated on this device.");
	}
	async function deleteSelected() {
		if (!selected || !window.confirm(`Delete “${selected.title}” from this device?`)) return;
		await removeLocalTask(selected.id);
		setTasks((current) => current.filter((task) => task.id !== selected.id));
		setSelected(null);
		toast.success("Task deleted from this device.");
	}
	function card(task) {
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
			draggable: true,
			onDragStart: () => setDraggedId(task.id),
			onDragEnd: () => setDraggedId(null),
			className: "rounded-xl border border-border/60 bg-background/55 p-3 shadow-sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSelected(task),
				className: "w-full text-left",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm font-medium text-foreground",
						children: task.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-1 block text-[11px] uppercase tracking-wide text-muted-foreground",
						children: [
							task.source,
							" · ",
							task.status.replaceAll("_", " ").toLowerCase()
						]
					}),
					task.currentStep ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-2 block line-clamp-2 text-xs text-muted-foreground",
						children: task.currentStep
					}) : null
				]
			})
		}, task.id);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-labelledby": "task-board-title",
		className: "mt-6 rounded-2xl border border-border/60 bg-card/35 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "task-board-title",
					className: "text-sm font-semibold text-foreground",
					children: "Task board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "On-device tasks only. Closing an unfinished card cancels it; it never fabricates completion."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex w-full max-w-md gap-2",
					onSubmit: (event) => {
						event.preventDefault();
						addTask();
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: draft,
						onChange: (event) => setDraft(event.target.value),
						placeholder: "Quick add a task",
						"aria-label": "Quick add a task"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						disabled: !draft.trim(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "mr-1 h-4 w-4" }), "Add"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center gap-2",
				role: "group",
				"aria-label": "Task view",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": view === "board",
						onClick: () => setView("board"),
						className: "min-h-9 rounded-md border border-border/60 px-3 text-xs",
						children: "Board"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": view === "feed",
						onClick: () => setView("feed"),
						className: "min-h-9 rounded-md border border-border/60 px-3 text-xs",
						children: ["Activity feed", newCount ? ` · ${newCount} new` : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": view === "analytics",
						onClick: () => setView("analytics"),
						className: "min-h-9 rounded-md border border-border/60 px-3 text-xs",
						children: "Analytics"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": view === "timeline",
						onClick: () => setView("timeline"),
						className: "min-h-9 rounded-md border border-border/60 px-3 text-xs",
						children: "Timeline"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Filter tasks", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							type: "search",
							value: query,
							onChange: (event) => setQuery(event.target.value),
							className: "mt-1"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Source", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							value: source,
							onChange: (event) => setSource(event.target.value),
							className: "mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground",
							children: SOURCES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value,
								children: value === "all" ? "All sources" : value
							}, value))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Sort", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: sort,
							onChange: (event) => setSort(event.target.value),
							className: "mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "updated",
									children: "Recently updated"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "oldest",
									children: "Oldest first"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "title",
									children: "Title"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "text-xs text-muted-foreground",
						children: ["Group tasks by", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: group,
							onChange: (event) => setGroup(event.target.value),
							className: "mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "status",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "source",
								children: "Source"
							})]
						})]
					})
				]
			}),
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted-foreground",
				children: "Reading on-device tasks…"
			}) : view === "analytics" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskAnalytics, { tasks: visible }) : view === "timeline" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskTimeline, {
				tasks: visible,
				onChange: (task) => void saveTask(task)
			}) : view === "feed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "task-feed-title",
				className: "mt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							id: "task-feed-title",
							className: "text-sm font-medium",
							children: "Device activity"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							"aria-live": "polite",
							className: "text-xs text-muted-foreground",
							children: newCount ? `${newCount} task updates since this feed was last opened.` : "No new task updates."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [
								"Page ",
								feed.page,
								" of ",
								feed.pages
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-2",
						children: [feed.items.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "rounded-xl border border-border/60 bg-background/35 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: taskFeedAuthor(task)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "mt-1 text-sm font-medium",
										children: task.title
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
										dateTime: task.updatedAt,
										className: "text-xs text-muted-foreground",
										children: new Date(task.updatedAt).toLocaleString()
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted-foreground",
									children: task.currentStep || task.request || `Status changed to ${task.status.replaceAll("_", " ").toLowerCase()}.`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setSelected(task),
										className: "min-h-8 rounded-md border border-border/60 px-3 text-xs",
										children: "Open details"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => void navigator.clipboard?.writeText(task.id),
										className: "min-h-8 rounded-md border border-border/60 px-3 text-xs",
										children: "Copy task reference"
									})]
								})
							]
						}, task.id)), !feed.items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground",
							children: "No task activity matches these filters. Add a task or clear a filter."
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Task activity pages",
						className: "mt-4 flex justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							disabled: feed.page <= 1,
							onClick: () => setFeedPage((page) => Math.max(1, page - 1)),
							children: "Previous"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							disabled: feed.page >= feed.pages,
							onClick: () => setFeedPage((page) => Math.min(feed.pages, page + 1)),
							children: "Next"
						})]
					})
				]
			}) : group === "status" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 grid gap-3 xl:grid-cols-4",
				children: TASK_BOARD_COLUMNS.map((column) => {
					const columnTasks = visible.filter((task) => taskBoardColumn(task) === column.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						"aria-label": `${column.label}, ${columnTasks.length} tasks`,
						onDragOver: (event) => event.preventDefault(),
						onDrop: () => {
							const task = tasks.find((item) => item.id === draggedId);
							setDraggedId(null);
							if (task) move(task, column.id);
						},
						className: "min-h-44 rounded-xl border border-border/50 bg-background/25 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-medium",
								children: column.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground",
								children: column.description
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"aria-label": `${columnTasks.length} tasks`,
								className: "rounded-full bg-muted px-2 py-0.5 text-xs",
								children: columnTasks.length
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [columnTasks.map(card), !columnTasks.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground",
								children: "No tasks in this column."
							}) : null]
						})]
					}, column.id);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid gap-3 xl:grid-cols-3",
				children: [taskSourceGroups(visible).map(([name, items]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-label": `${name}, ${items.length} tasks`,
					className: "rounded-xl border border-border/50 bg-background/25 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-medium capitalize",
							children: name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full bg-muted px-2 py-0.5 text-xs",
							children: items.length
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: items.map(card)
					})]
				}, name)), !visible.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground",
					children: "No task matches these filters."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: !!selected,
				onOpenChange: (open) => !open && setSelected(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: selected?.title }) }), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							"aria-label": "Task location",
							className: "text-xs text-muted-foreground",
							children: ["Task board / ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: selected.title
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "grid grid-cols-[7rem_1fr] gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Source"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: selected.source }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Status"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: selected.status.replaceAll("_", " ") }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Updated"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: new Date(selected.updatedAt).toLocaleString() }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Request"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: selected.request || "No task description." }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Receipts"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: selected.receipts?.length ? selected.receipts.join("; ") : "No receipts recorded." })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void editSelectedTitle(),
								className: "min-h-9 rounded-md border border-border/60 px-3 text-xs",
								children: "Edit title"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void deleteSelected(),
								className: "min-h-9 rounded-md border border-destructive/40 px-3 text-xs text-destructive",
								children: "Delete task"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-xs text-muted-foreground",
							children: ["Move task", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								"aria-label": "Move task",
								value: taskBoardColumn(selected),
								onChange: (event) => void move(selected, event.target.value),
								className: "mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground",
								children: TASK_BOARD_COLUMNS.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: column.id,
									children: column.label
								}, column.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskComments, { taskId: selected.id }, selected.id)
					]
				}) : null] })
			})
		]
	});
}
/**
* Server-backed lists that survive losing the network.
*
* THE FAILURE THIS FIXES
* ----------------------
* OCADE tells people their work stays on their device and that the engine runs
* on their own hardware. Then Tasks, Projects and the rest fetched from the
* server on every render and showed an error when it was not there — so a
* laptop on a plane, holding a local model and a local vault, could hold a
* conversation and could not tell you what it was scheduled to do at nine.
*
* WHAT THIS IS NOT
* ----------------
* It is not a general offline database, and it deliberately does not pretend
* the server's answer is optional. Every read still goes to the server first
* when there is a network; the mirror answers only when that fails. A person
* looking at a mirrored list is TOLD they are, with the time it was taken,
* because a stale schedule presented as current is worse than no schedule.
*
* WHY MUTATIONS ARE QUEUED RATHER THAN APPLIED
* --------------------------------------------
* Pausing an automation offline cannot pause anything: the thing that would run
* it is not on this device. What CAN be honest is recording the intent, showing
* it as pending, and applying it the moment the connection returns. The queue
* is the existing outbox, so it inherits the backoff, the jitter and the
* idempotency key that were already thought through there — a second queue
* would have needed all three thought through again.
*/
var DB_NAME = "ocade-offline-mirror";
var DB_VERSION = 1;
var STORE = "lists";
function openDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
function promisify(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
function scopedKey(key, userId) {
	return `${userId ?? "anonymous"}:${key}`;
}
function mirrorAvailable() {
	return typeof indexedDB !== "undefined";
}
async function writeMirror(key, userId, items) {
	if (!mirrorAvailable()) return;
	try {
		const db = await openDb();
		const row = {
			key: scopedKey(key, userId),
			takenAt: Date.now(),
			items
		};
		await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).put(row));
		db.close();
	} catch {}
}
async function readMirror(key, userId) {
	if (!mirrorAvailable()) return null;
	try {
		const db = await openDb();
		const row = await promisify(db.transaction(STORE, "readonly").objectStore(STORE).get(scopedKey(key, userId)));
		db.close();
		if (!row || !Array.isArray(row.items)) return null;
		return {
			items: row.items,
			takenAt: row.takenAt
		};
	} catch {
		return null;
	}
}
/**
* Fetch, mirroring on success and falling back on failure.
*
* The order is deliberate and is the whole contract: the server is asked first,
* every time, and its answer always wins. A cache-first read would show
* yesterday's schedule to somebody with a perfectly good connection.
*/
async function fetchWithMirror(key, userId, fetcher) {
	try {
		const items = await fetcher();
		writeMirror(key, userId, items);
		return {
			items,
			stale: false
		};
	} catch (error) {
		const mirrored = await readMirror(key, userId);
		if (mirrored) return {
			items: mirrored.items,
			stale: true,
			takenAt: mirrored.takenAt
		};
		throw error;
	}
}
/** How long ago the mirror was taken, in words. */
function describeStaleness(takenAt, now = Date.now()) {
	const minutes = Math.max(0, Math.round((now - takenAt) / 6e4));
	if (minutes < 1) return "just now";
	if (minutes === 1) return "a minute ago";
	if (minutes < 60) return `${minutes} minutes ago`;
	const hours = Math.round(minutes / 60);
	if (hours === 1) return "an hour ago";
	if (hours < 24) return `${hours} hours ago`;
	const days = Math.round(hours / 24);
	return days === 1 ? "yesterday" : `${days} days ago`;
}
/**
* The tasks surface, shared by `/ocade/tasks` and `/settings/tasks`.
*
* It was written inside the settings route, which made Tasks a settings page —
* but a run you can stop is work, not a preference, and OCADE's tool list needs
* the same screen. Extracted rather than copied: two task lists that could
* disagree about whether a run is still live is exactly the kind of drift that
* makes a Stop button untrustworthy.
*
* Everything shown here comes from `ocade_automations` and
* `ocade_automation_runs`. There is no placeholder row: an account with no
* automations sees that it has none.
*/
var LIVE = /* @__PURE__ */ new Set([
	"queued",
	"running",
	"awaiting_approval",
	"paused"
]);
function TasksWorkspace({ backTo, backLabel }) {
	const { user } = useSession();
	const qc = useQueryClient();
	const [error, setError] = (0, import_react.useState)(null);
	const fetchAutomations = useServerFn(listAutomations);
	const fetchRuns = useServerFn(listAutomationRuns);
	const patch = useServerFn(updateAutomation);
	const cancel = useServerFn(cancelAutomationRun);
	const pause = useServerFn(pauseAutomationRun);
	const resume = useServerFn(resumeAutomationRun);
	const [staleAt, setStaleAt] = (0, import_react.useState)(null);
	const automations = useQuery({
		queryKey: [
			"settings-tasks",
			"automations",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: async () => {
			const result = await fetchWithMirror("automations", user?.id ?? null, () => fetchAutomations());
			setStaleAt(result.stale ? result.takenAt : null);
			return result.items;
		}
	});
	const runs = useQuery({
		queryKey: [
			"settings-tasks",
			"runs",
			user?.id
		],
		enabled: !!user?.id,
		queryFn: async () => {
			return (await fetchWithMirror("automation_runs", user?.id ?? null, () => fetchRuns({ data: {} }))).items;
		},
		refetchInterval: 1e4
	});
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["settings-tasks"] });
	};
	const requireNetwork = () => {
		if (staleAt === null) return true;
		setError("OCADE is showing what it last saw. Changes to a schedule need a connection, because the schedule runs in the cloud rather than on this device.");
		return false;
	};
	const toggle = useMutation({
		mutationFn: (v) => {
			if (!requireNetwork()) throw new Error("Offline");
			return patch({ data: v });
		},
		onError: (e) => setError(e instanceof Error ? e.message : String(e)),
		onSuccess: () => {
			setError(null);
			invalidate();
		}
	});
	const runAction = useMutation({
		mutationFn: async (v) => {
			if (!requireNetwork()) throw new Error("Offline");
			if (v.kind === "cancel") return cancel({ data: { runId: v.runId } });
			if (v.kind === "pause") return pause({ data: { runId: v.runId } });
			return resume({ data: { runId: v.runId } });
		},
		onError: (e) => setError(e instanceof Error ? e.message : String(e)),
		onSuccess: () => {
			setError(null);
			invalidate();
		}
	});
	const nameOf = (id) => automations.data?.find((a) => a.id === id)?.name ?? "Removed automation";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Tasks",
			title: "Automations & runs",
			description: "Every scheduled task on this account, and every run it has produced. Pause, resume or stop a run from here.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: backTo,
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground",
				children: ["← ", backLabel]
			})
		}),
		staleAt !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "status",
			className: "mt-4 rounded-md border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-foreground/80",
			children: [
				"OCADE cannot reach your schedule right now, so this is what it last saw",
				" ",
				describeStaleness(staleAt),
				". Anything that has run since is not shown here."
			]
		}) : null,
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "alert",
			className: "mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: error
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskBoard, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-6 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListChecks, {
						className: "h-4 w-4 text-primary",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-foreground",
						children: "Automations"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => void automations.refetch(),
					className: "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" }), " Refresh"]
				})]
			}), automations.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { label: "Reading automations…" }) : automations.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
				message: automations.error instanceof Error ? automations.error.message : "Could not load.",
				onRetry: () => void automations.refetch()
			}) : automations.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: [
					"No automations yet.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/ocade/automations",
						className: "text-foreground underline underline-offset-2",
						children: "Create one in OCADE"
					}),
					"."
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border/40",
				children: automations.data.map((a) => {
					const busy = toggle.isPending && toggle.variables?.id === a.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium text-foreground",
								children: a.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.enabled && !a.paused ? "active" : "planned" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: a.dry_run ? "dry run" : "live" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										"Next",
										" ",
										a.next_run_at ? new Date(a.next_run_at).toLocaleString() : "on demand"
									] })
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-none items-center gap-2",
							children: [
								busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin text-muted-foreground" }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => toggle.mutate({
										id: a.id,
										paused: !a.paused
									}),
									disabled: busy,
									className: "rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60",
									children: a.paused ? "Resume" : "Pause"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => toggle.mutate({
										id: a.id,
										enabled: !a.enabled
									}),
									disabled: busy,
									className: "rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60",
									children: a.enabled ? "Disable" : "Enable"
								})
							]
						})]
					}, a.id);
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-semibold text-foreground",
					children: "Recent runs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: () => void runs.refetch(),
					className: "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3 w-3" }), " Refresh"]
				})]
			}), runs.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { label: "Reading runs…" }) : runs.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorRow, {
				message: runs.error instanceof Error ? runs.error.message : "Could not load.",
				onRetry: () => void runs.refetch()
			}) : runs.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted-foreground",
				children: "Nothing has run yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 divide-y divide-border/40",
				children: runs.data.slice(0, 40).map((r) => {
					const busy = runAction.isPending && runAction.variables?.runId === r.id;
					const live = LIVE.has(r.status);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between gap-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm text-foreground",
								children: nameOf(r.automation_id)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded border border-border/60 px-1.5 py-0.5",
										children: r.status
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["attempt ", r.attempt] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(r.created_at).toLocaleString() }),
									r.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-destructive",
										children: r.error
									}) : r.blocked_reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[color:var(--state-warning)]",
										children: r.blocked_reason
									}) : null
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-none items-center gap-2",
							children: [
								busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin text-muted-foreground" }) : null,
								r.status === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, {
									label: "Resume run",
									disabled: busy,
									onClick: () => runAction.mutate({
										runId: r.id,
										kind: "resume"
									}),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-3.5 w-3.5" })
								}) : live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, {
									label: "Pause run",
									disabled: busy,
									onClick: () => runAction.mutate({
										runId: r.id,
										kind: "pause"
									}),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "h-3.5 w-3.5" })
								}) : null,
								live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, {
									label: "Stop run",
									disabled: busy,
									onClick: () => runAction.mutate({
										runId: r.id,
										kind: "cancel"
									}),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "h-3.5 w-3.5" })
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: r.finished_at ? "finished" : "—"
								})
							]
						})]
					}, r.id);
				})
			})]
		})
	] });
}
function IconButton({ label, onClick, disabled, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		"aria-label": label,
		title: label,
		onClick,
		disabled,
		className: "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60",
		children
	});
}
function Loading({ label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3 flex items-center gap-2 text-sm text-muted-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
				className: "h-4 w-4 animate-spin",
				"aria-hidden": true
			}),
			" ",
			label
		]
	});
}
function ErrorRow({ message, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "alert",
		className: "mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}),
				" ",
				message
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			onClick: onRetry,
			className: "underline underline-offset-2",
			children: "Retry"
		})]
	});
}
//#endregion
export { TasksWorkspace as t };
