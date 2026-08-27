import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { J as Reply, M as ShieldCheck, Mn as CornerDownRight, Nn as Copy, Rn as CloudOff, Tr as ArrowDown, Wt as LoaderCircle, Y as RefreshCw, _ as ThumbsUp, ar as CheckCheck, c as Volume2, dt as Pencil, gr as Bookmark, h as Trash2, ir as Check, jn as Cpu, m as TriangleAlert, nn as Image, q as RotateCcw, un as GitBranch, v as ThumbsDown, vn as FileText } from "../_libs/lucide-react.mjs";
import { n as preparationState, r as subscribeToPreparation, t as describePreparation } from "./use-brain-DcsqzQLQ.mjs";
import { n as summarise$1, t as preflight } from "./preflight-BxhjuTtu.mjs";
import { t as Markdown } from "../_libs/react-markdown+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-DMXgv3Ap.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* One turn of the conversation.
*
* THREE DECISIONS WORTH STATING
*
* 1. **Actions are always in the DOM, not conditionally mounted.** They fade in
*    on hover, but they are reachable by keyboard at all times. Hover-only
*    controls that do not exist until the pointer arrives are unusable without
*    a mouse, and this is where most chat interfaces quietly fail.
* 2. **A failed message keeps its text and offers a real retry.** Losing what
*    you wrote because the engine hiccuped is the single most infuriating
*    thing a chat app can do.
* 3. **The streaming turn gets a caret, not a spinner.** A spinner says "wait";
*    a caret on live text says "this is happening", which is what is true.
*/
function ActionButton({ label, onClick, children, destructive, pressed }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		title: label,
		"aria-label": label,
		"aria-pressed": pressed,
		className: cn("inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition", "hover:bg-accent hover:text-foreground", "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", destructive && "hover:text-destructive", pressed && "bg-accent text-foreground"),
		children
	});
}
function CopyButton({ text }) {
	const [copied, setCopied] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
		label: copied ? "Copied" : "Copy message",
		onClick: () => {
			navigator.clipboard.writeText(text).then(() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1600);
			}).catch(() => setCopied(false));
		},
		children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3.5 w-3.5 text-[color:var(--state-success)]" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" })
	});
}
function Attachments({ items }) {
	if (items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mb-2 flex flex-wrap gap-2",
		children: items.map((a, i) => {
			return a.kind === "image" && a.dataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: a.dataUrl,
				alt: a.name,
				className: "max-h-44 rounded-lg border border-border/60 object-cover"
			}, `${a.name}-${i}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[12px] text-muted-foreground",
				children: [a.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, {
					className: "h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {
					className: "h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: a.name
				})]
			}, `${a.name}-${i}`);
		})
	});
}
var MessageBubble = (0, import_react.memo)(function MessageBubble({ message, actions, showTimestamp, renderMarkdown = true, density = "comfortable" }) {
	const isUser = message.role === "user";
	const time = showTimestamp ? formatTime(message.createdAt) : null;
	const [touchActionsOpen, setTouchActionsOpen] = (0, import_react.useState)(false);
	const gestureRef = (0, import_react.useRef)(null);
	const longPressRef = (0, import_react.useRef)(null);
	const clearLongPress = () => {
		if (longPressRef.current) clearTimeout(longPressRef.current);
		longPressRef.current = null;
	};
	(0, import_react.useEffect)(() => () => {
		if (longPressRef.current) clearTimeout(longPressRef.current);
	}, []);
	const onPointerDown = (event) => {
		if (event.pointerType === "mouse") return;
		gestureRef.current = {
			x: event.clientX,
			y: event.clientY
		};
		clearLongPress();
		longPressRef.current = setTimeout(() => setTouchActionsOpen(true), 450);
	};
	const onPointerMove = (event) => {
		const start = gestureRef.current;
		if (!start) return;
		if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12) clearLongPress();
	};
	const onPointerEnd = (event) => {
		const start = gestureRef.current;
		clearLongPress();
		gestureRef.current = null;
		if (!start || !actions.onReply || event.pointerType === "mouse") return;
		const dx = event.clientX - start.x;
		const dy = Math.abs(event.clientY - start.y);
		if (dx >= 64 && dy <= 48) {
			actions.onReply(message);
			setTouchActionsOpen(true);
		}
	};
	const rowActions = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex items-center gap-0.5 transition-opacity", touchActionsOpen || message.reaction ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100", isUser && "justify-end"),
		children: [
			message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, { text: message.content }) : null,
			actions.onReply ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Reply to message",
				onClick: () => actions.onReply?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reply, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onEdit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Edit and resend",
				onClick: () => actions.onEdit?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onRegenerate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Regenerate answer",
				onClick: () => actions.onRegenerate?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onContinue ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Continue this answer",
				onClick: () => actions.onContinue?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDownRight, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onBranch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Branch from here",
				onClick: () => actions.onBranch?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onSpeak ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Read aloud",
				onClick: () => actions.onSpeak?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onSave ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Save this answer",
				onClick: () => actions.onSave?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "h-3.5 w-3.5" })
			}) : null,
			actions.onDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Delete message",
				destructive: true,
				onClick: () => actions.onDelete?.(message),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" })
			}) : null,
			!isUser && actions.onReact ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Helpful",
				pressed: message.reaction === "helpful",
				onClick: () => actions.onReact?.(message, "helpful"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsUp, { className: "h-3.5 w-3.5" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActionButton, {
				label: "Not helpful",
				pressed: message.reaction === "not_helpful",
				onClick: () => actions.onReact?.(message, "not_helpful"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "h-3.5 w-3.5" })
			})] }) : null
		]
	});
	if (isUser) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: cn("group flex touch-pan-y flex-col items-end", density === "compact" ? "gap-1" : "gap-1.5"),
		"aria-label": "Your message",
		"aria-description": "Swipe right to reply. Long press for message actions.",
		"data-touch-actions-open": touchActionsOpen ? "true" : "false",
		onPointerDown,
		onPointerMove,
		onPointerUp: onPointerEnd,
		onPointerCancel: () => {
			clearLongPress();
			gestureRef.current = null;
		},
		children: [
			time ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[11px] text-muted-foreground",
				children: time
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-[min(46rem,88%)] rounded-2xl rounded-br-md bg-secondary/80 px-4 py-2.5 text-[14.5px] leading-relaxed text-foreground",
				children: [message.attachments ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Attachments, { items: message.attachments }) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "whitespace-pre-wrap break-words",
					children: message.content
				})]
			}),
			message.deliveryState ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
				role: "status",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, {
					className: "h-3 w-3",
					"aria-hidden": true
				}), deliveryLabel(message.deliveryState)]
			}) : null,
			rowActions
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: cn("group flex touch-pan-y flex-col", density === "compact" ? "gap-1" : "gap-1.5"),
		"aria-label": "OCADE reply",
		"aria-description": "Swipe right to reply. Long press for message actions.",
		"data-touch-actions-open": touchActionsOpen ? "true" : "false",
		onPointerDown,
		onPointerMove,
		onPointerUp: onPointerEnd,
		onPointerCancel: () => {
			clearLongPress();
			gestureRef.current = null;
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-ocade)]",
						children: "OCADE"
					}),
					message.engineLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-muted-foreground",
						children: message.engineLabel
					}) : null,
					time ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-muted-foreground",
						children: time
					}) : null
				]
			}),
			message.attachments ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Attachments, { items: message.attachments }) : null,
			message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-[min(52rem,100%)] text-[14.5px] leading-[1.7] text-foreground",
				children: [renderMarkdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "prose prose-sm prose-invert max-w-none break-words [&_code]:text-[13px] [&_h1]:mt-4 [&_h2]:mt-4 [&_li]:my-0.5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:rounded-lg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, { children: message.content })
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "whitespace-pre-wrap break-words font-mono text-[13px]",
					children: message.content
				}), message.streaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-[color:var(--accent-ocade)]",
					"aria-hidden": true
				}) : null]
			}) : null,
			message.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "flex max-w-[min(52rem,100%)] items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-destructive",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-foreground",
						children: message.error
					}), actions.onRetry ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => actions.onRetry?.(message),
						className: "mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[12px] font-medium text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), "Try again"]
					}) : null]
				})]
			}) : null,
			!message.streaming ? rowActions : null
		]
	});
});
/** Local time, or nothing. "Invalid Date" in a transcript looks like a crash. */
function formatTime(iso) {
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return null;
	return new Date(ms).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function deliveryLabel(state) {
	if (state === "processed") return "Processed by OCADE";
	if (state === "processing") return "OCADE is processing";
	return "Sent";
}
/**
* The transcript.
*
* THE SCROLL RULE, which is the only hard part of a chat transcript:
* follow the newest text ONLY while the reader is already at the bottom. The
* moment they scroll up to re-read something, streaming must stop yanking them
* back down. Almost every chat interface gets this wrong in one direction or
* the other — either it never follows, or it follows so aggressively you cannot
* read the previous answer while the next one arrives.
*
* When the reader has scrolled away, a "jump to latest" control appears, so
* the behaviour is discoverable rather than a mystery.
*/
var AT_BOTTOM_SLACK_PX = 80;
/**
* BOUNDED RENDERING.
*
* A long conversation used to mount every message forever, and each one parses
* Markdown, highlights code and renders receipts. Past a few hundred turns the
* composer itself starts to lag, because every keystroke re-renders a tree that
* never stops growing.
*
* Windowing from the END rather than measuring pixel offsets is deliberate.
* These rows have wildly variable heights (a one-word reply and a 300-line code
* block), so an absolutely-positioned virtualiser needs measurement caches that
* fight with streaming content and destroy scroll anchoring mid-answer. Keeping
* a recent slice in normal document flow keeps the browser's own scroll
* anchoring — which is what makes bottom-follow feel right — and bounds the
* work. Older turns stay one click away and are never lost.
*/
var WINDOW_SIZE = 60;
var WINDOW_STEP = 60;
function MessageList({ messages, actions, showTimestamps, renderMarkdown, density = "comfortable", emptyState, renderFooter, conversationKey }) {
	const endRef = (0, import_react.useRef)(null);
	const scrollerRef = (0, import_react.useRef)(null);
	const [pinned, setPinned] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		const el = scrollerRef.current?.closest("main");
		if (!el) return;
		const onScroll = () => {
			const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
			setPinned(distance <= AT_BOTTOM_SLACK_PX);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);
	const lastContent = messages.at(-1)?.content ?? "";
	(0, import_react.useEffect)(() => {
		if (!pinned) return;
		endRef.current?.scrollIntoView({ block: "end" });
	}, [
		messages.length,
		lastContent,
		pinned
	]);
	const jump = () => {
		setPinned(true);
		endRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end"
		});
	};
	const identity = conversationKey ?? messages[0]?.id;
	const [limit, setLimit] = (0, import_react.useState)(WINDOW_SIZE);
	(0, import_react.useEffect)(() => setLimit(WINDOW_SIZE), [identity]);
	/**
	* ACCESSIBILITY: announce a completed assistant turn once, never each token.
	*
	* Putting `aria-live` around the transcript makes a streaming answer read out
	* again on every DOM mutation. Instead this tiny region changes only when a
	* new assistant message moves out of its streaming state. Historical answers
	* are silently adopted when a conversation opens, so switching chats does not
	* suddenly read old content. Screen-reader users can then navigate the normal
	* transcript to read the completed answer at their own pace.
	*/
	const latestAssistant = (0, import_react.useMemo)(() => [...messages].reverse().find((message) => message.role === "assistant") ?? null, [messages]);
	const announcementConversationRef = (0, import_react.useRef)(void 0);
	const announcedMessageRef = (0, import_react.useRef)(null);
	const [completionAnnouncement, setCompletionAnnouncement] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (announcementConversationRef.current !== identity) {
			announcementConversationRef.current = identity;
			announcedMessageRef.current = latestAssistant && !latestAssistant.streaming ? latestAssistant.id : null;
			setCompletionAnnouncement("");
			return;
		}
		if (!latestAssistant || latestAssistant.streaming) return;
		if (announcedMessageRef.current === latestAssistant.id) return;
		announcedMessageRef.current = latestAssistant.id;
		setCompletionAnnouncement("OCADE response complete.");
	}, [identity, latestAssistant]);
	const hidden = Math.max(0, messages.length - limit);
	const visible = hidden > 0 ? messages.slice(hidden) : messages;
	if (messages.length === 0 && emptyState) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: scrollerRef,
		children: emptyState
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: scrollerRef,
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sr-only",
				"aria-live": "polite",
				"aria-atomic": "true",
				children: completionAnnouncement
			}),
			hidden > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setLimit((n) => n + WINDOW_STEP),
					className: "w-full rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: [
						"Show earlier messages (",
						hidden,
						" above)"
					]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: cn("mx-auto w-full max-w-3xl px-4 py-6 sm:px-6", density === "compact" ? "space-y-4" : "space-y-7"),
				children: visible.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageBubble, {
					message,
					actions,
					showTimestamp: showTimestamps,
					renderMarkdown,
					density
				}), renderFooter?.(message)] }, message.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: endRef,
				className: "h-px",
				"aria-hidden": true
			}),
			!pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: jump,
				className: "sticky bottom-4 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 text-[12px] font-medium text-foreground shadow-lg transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), "Jump to latest"]
			}) : null
		]
	});
}
/**
* Where this conversation's answers come from.
*
* This badge is the product's central privacy claim rendered as one small
* control, so it never says anything it cannot back:
*
*  - "On this device" appears only when a local engine is actually serving.
*    It is the strongest claim OCADE makes and the easiest to get wrong.
*  - A missing local engine is shown as unavailable, never replaced by a
*    public-cloud fallback.
*  - While the engine is still being fetched it says so, because a badge that
*    reads "ready" during a download is a lie with a two-minute lifespan.
*
* Offline is shown as a STATE, not an error: with a local engine, being
* offline changes nothing at all, and OCADE should look confident about that.
*/
function EngineBadge({ status, className, onClick }) {
	const local = status.locality === "local";
	const Icon = status.preparing ? LoaderCircle : local ? Cpu : CloudOff;
	const tone = status.preparing ? "text-muted-foreground" : local ? "text-[color:var(--state-success)]" : "text-[color:var(--state-warning)]";
	const text = status.preparing ? "Preparing engine" : local ? "On this device" : status.online ? "Local engine unavailable" : "Offline";
	const title = status.detail ?? (local ? "Answers are generated on this computer. Nothing is sent anywhere." : "No local engine is reachable right now.");
	const content = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: cn("h-3.5 w-3.5 shrink-0", tone, status.preparing && "animate-spin"),
			"aria-hidden": true
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate",
			children: text
		}),
		local && !status.preparing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
			className: "h-3 w-3 shrink-0 text-[color:var(--state-success)]",
			"aria-label": "private"
		}) : null
	] });
	const shared = cn("inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[12px] font-medium text-foreground backdrop-blur", className);
	if (!onClick) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: shared,
		title,
		children: content
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		title,
		className: cn(shared, "transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"),
		children: content
	});
}
/**
* Visible first-run model preparation shared by demo and signed-in Chat.
*
* The adapters have always reported real download/load progress. Keeping this
* subscriber beside the composer makes that report reachable at the moment a
* person is waiting, without exposing model filenames or runtime jargon.
*/
function PreparationStatus({ className }) {
	const state = (0, import_react.useSyncExternalStore)(subscribeToPreparation, preparationState, preparationState);
	if (state.stage === "idle" || state.stage === "ready") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		role: "status",
		"aria-live": "polite",
		className: cn("mb-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-[12px] text-muted-foreground", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-foreground",
			children: describePreparation(state)
		}), state.fraction !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("progress", {
			"aria-label": "Preparing OCADE Intelligence",
			className: "mt-1.5 h-1.5 w-full accent-[color:var(--accent-ocade)]",
			max: 1,
			value: Math.max(0, Math.min(1, state.fraction))
		}) : null]
	});
}
/** Hosts that never leave the machine, whatever port they are on. */
var LOOPBACK$1 = /^(localhost|127(?:\.\d+){3}|\[::1\]|::1|.*\.localhost)$/i;
/**
* Paths that carry the user's content, borrowed from the service worker's own
* never-cache list so the two cannot drift apart.
*/
var DATA_PATHS = [
	/^\/api\//,
	/^\/_serverFn\//,
	/^\/auth\//
];
function classify(url, ownOrigin) {
	if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("filesystem:")) return {
		origin: "(this device)",
		kind: "this_device"
	};
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return {
			origin: "(unknown)",
			kind: "third_party"
		};
	}
	if (parsed.origin !== ownOrigin) return {
		origin: parsed.origin,
		kind: LOOPBACK$1.test(parsed.hostname) ? "loopback" : "third_party"
	};
	return {
		origin: parsed.origin,
		kind: DATA_PATHS.some((p) => p.test(parsed.pathname)) ? "data" : "own_assets"
	};
}
/** What this measurement cannot see, for honest presentation. */
function limits() {
	return [
		"Requests made by the native managed-browser host are outside this page and are not counted.",
		"Requests from other tabs are not counted.",
		"This records which servers were contacted, not what was sent to them."
	];
}
/**
* The window itself.
*
* `start()` snapshots the resource log, `stop()` reads what was appended. No
* patching, no interception — only a before-and-after read of a log the browser
* maintains for its own reasons.
*/
var NetworkWitness = class {
	scope;
	observer = null;
	seen = [];
	startedAt = 0;
	failure = null;
	/** Injected so the whole class is testable without a browser. */
	constructor(scope = globalThis) {
		this.scope = scope;
	}
	start() {
		this.seen = [];
		this.failure = null;
		this.startedAt = this.now();
		const Observer = this.scope.PerformanceObserver;
		if (typeof Observer !== "function") {
			this.failure = "This browser does not record network timing, so OCADE cannot check.";
			return;
		}
		try {
			this.observer = new Observer((list) => {
				for (const entry of list.getEntries()) this.seen.push(entry);
			});
			this.observer.observe({
				type: "resource",
				buffered: false
			});
		} catch {
			this.observer = null;
			this.failure = "This browser refused to report network timing, so OCADE cannot check.";
		}
	}
	stop() {
		this.observer?.disconnect();
		this.observer = null;
		if (this.failure) return {
			silent: false,
			contacts: [],
			requests: 0,
			measured: false,
			unmeasuredReason: this.failure
		};
		const ownOrigin = this.ownOrigin();
		const byKey = /* @__PURE__ */ new Map();
		for (const entry of this.seen) {
			if (entry.startTime < this.startedAt) continue;
			const { origin, kind } = classify(entry.name, ownOrigin);
			const key = `${origin}|${kind}`;
			const existing = byKey.get(key);
			const bytes = typeof entry.transferSize === "number" ? entry.transferSize : null;
			if (existing) {
				existing.count += 1;
				if (bytes !== null) existing.transferredBytes = (existing.transferredBytes ?? 0) + bytes;
			} else byKey.set(key, {
				origin,
				kind,
				count: 1,
				transferredBytes: bytes
			});
		}
		const contacts = [...byKey.values()].sort((a, b) => b.count - a.count);
		const requests = contacts.reduce((total, c) => total + c.count, 0);
		return {
			silent: contacts.filter((c) => c.kind === "data" || c.kind === "third_party").length === 0,
			contacts,
			requests,
			measured: true
		};
	}
	now() {
		const perf = this.scope.performance;
		return perf ? perf.now() : 0;
	}
	ownOrigin() {
		return this.scope.location?.origin ?? "";
	}
};
/**
* SHA-256 of a string, using the platform's own crypto.
*
* Separated from `receipt.ts` so the receipt module stays free of environment
* checks, and so the failure mode is decided in one place.
*
* A MISSING DIGEST IS NOT AN EMPTY STRING. When Web Crypto is unavailable —
* an insecure origin, a locked-down runtime — this returns a marker rather
* than a hash-shaped value. A receipt whose fingerprint silently became `""`
* would still compare equal to another unhashable receipt, which is exactly
* how a verification routine ends up approving anything.
*/
var UNAVAILABLE = "unavailable:no-web-crypto";
async function sha256OfText(text) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) return UNAVAILABLE;
	try {
		const bytes = new TextEncoder().encode(text);
		const digest = await subtle.digest("SHA-256", bytes);
		return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	} catch {
		return UNAVAILABLE;
	}
}
/** True when a value is a real digest rather than the unavailable marker. */
function isRealDigest(value) {
	return /^[0-9a-f]{64}$/.test(value);
}
/**
* A receipt for one answer: what produced it, what it read, and what left.
*
* THE GAP THIS FILLS. Every assistant tells you what it thinks. None of them
* tell you what they *did*. Ask a cloud assistant "did you actually read my
* whole document, or a fragment of it?", "which of my files did this come
* from?", "was any of this sent anywhere?" — and there is no answer available
* even in principle, because the work happened on a machine the user cannot
* inspect and the vendor's reassurance is unfalsifiable by construction.
*
* OCADE can answer all three, because the work happens on the user's own
* hardware. That is a structural advantage, not a better prompt, and this is
* where it becomes a feature the user can hold.
*
* A RECEIPT IS ONLY WORTH HAVING IF IT CAN BE WRONG. Two rules follow:
*
* 1. EVERY FIELD IS A MEASUREMENT, NOT A SETTING. `leftDevice` comes from the
*    browser's own resource-timing log (see `network-witness.ts`), not from
*    the privacy mode the user selected. A receipt that simply echoed the
*    configuration would agree with itself in exactly the case where the
*    configuration was not honoured — the only case anyone cares about.
*
* 2. UNKNOWN IS ITS OWN VALUE. Where something could not be observed the
*    receipt says so rather than defaulting to the flattering answer. A
*    receipt that cannot distinguish "nothing was sent" from "we did not
*    check" is worse than no receipt, because it launders the second into
*    the first.
*/
/**
* Build a receipt from what was actually observed.
*
* Async only because digesting uses Web Crypto. Never throws: a receipt that
* fails to build must not take the answer down with it.
*/
async function buildReceipt(input) {
	const [promptSha256, answerSha256] = await Promise.all([sha256OfText(input.prompt), sha256OfText(input.answer)]);
	const revealing = input.observation.contacts.filter((c) => c.kind === "data" || c.kind === "third_party");
	const explicitContacts = (input.networkUses ?? []).flatMap((use) => use.contacted);
	const leftDevice = explicitContacts.length > 0 ? true : input.observation.measured ? revealing.length > 0 : null;
	return {
		messageId: input.messageId,
		producedOn: input.producedOn,
		engineLabel: input.engineLabel,
		promptSha256,
		answerSha256,
		sources: input.sources,
		...input.networkUses && input.networkUses.length > 0 ? { networkUses: input.networkUses } : {},
		leftDevice,
		contacted: [.../* @__PURE__ */ new Set([...input.observation.measured ? revealing.map((c) => c.origin) : [], ...explicitContacts])],
		localServer: input.observation.contacts.find((c) => c.kind === "loopback")?.origin ?? null,
		blindSpots: input.blindSpots,
		startedAt: input.startedAt.toISOString(),
		durationMs: Math.max(0, Math.round(input.durationMs)),
		version: 1
	};
}
/**
* The one-line verdict.
*
* Ordered by what would alarm a person most, so the worst true thing is the
* thing they read first.
*/
function verdict(receipt) {
	if (receipt.leftDevice === null) return {
		tone: "unknown",
		headline: "OCADE could not check whether anything was sent for this answer."
	};
	if (receipt.leftDevice) {
		const research = receipt.networkUses?.find((use) => use.purpose === "current_information");
		if (research) return {
			tone: "sent",
			headline: `The answer was generated on this device after OCADE used ${research.provider} to retrieve current information from ${research.contacted.length} ${research.contacted.length === 1 ? "source" : "sources"}. No hosted AI received the prompt.`
		};
		return {
			tone: "sent",
			headline: `This answer used ${receipt.engineLabel}, and your browser recorded requests to ${receipt.contacted.join(", ")}.`
		};
	}
	if (receipt.localServer) return {
		tone: "private",
		headline: `This answer was produced on this computer, by an engine running at ${receipt.localServer}. Nothing left the machine.`
	};
	return {
		tone: "private",
		headline: "This answer was produced entirely on this device. Your browser recorded no network requests while it ran."
	};
}
/**
* How much of each source was actually consulted.
*
* The honest version of "I read your document". A 200-page report that
* contributed four sections is not a document that was read, and saying so is
* the difference between a citation and a claim.
*/
function describeSourceUse(use) {
	if (use.category === "internet_evidence") {
		const date = use.publishedAt ?? use.retrievedAt;
		return `${use.name} — current-information evidence from ${use.domain ?? "the web"}${date ? ` (${date})` : ""}.`;
	}
	const prefix = use.category === "project_context" ? "Project context: " : "";
	if (use.passagesTotal === 0) return `${prefix}${use.name} — nothing readable was extracted.`;
	if (use.passagesUsed >= use.passagesTotal) return `${prefix}${use.name} — read in full (${use.passagesTotal} ${use.passagesTotal === 1 ? "section" : "sections"}).`;
	return `${prefix}${use.name} — ${use.passagesUsed} of ${use.passagesTotal} sections were used; the rest were searched and did not match.`;
}
/**
* A digest OVER the receipt, so two people can compare one answer.
*
* Field order is fixed explicitly rather than taken from `JSON.stringify` of
* the object, because key order is an implementation detail and a digest that
* changes when a field is reordered proves nothing about the content.
*/
async function receiptDigest(receipt) {
	return await sha256OfText([
		receipt.version,
		receipt.messageId,
		receipt.producedOn,
		receipt.engineLabel,
		receipt.promptSha256,
		receipt.answerSha256,
		receipt.leftDevice === null ? "unknown" : String(receipt.leftDevice),
		[...receipt.contacted].sort().join(","),
		receipt.localServer ?? "",
		receipt.sources.map((s) => `${s.category ?? "attached_document"}:${s.name}:${s.sha256}:${s.passagesUsed}/${s.passagesTotal}:${s.url ?? ""}:${s.retrievedAt ?? ""}`).sort().join("|"),
		(receipt.networkUses ?? []).map((use) => `${use.purpose}:${use.provider}:${use.querySent}:${[...use.contacted].sort().join(",")}:${use.retrievedAt}`).sort().join("|"),
		receipt.startedAt
	].join("\n"));
}
/** Plain text, for pasting into a ticket or an audit trail. */
function receiptToText(receipt, digest) {
	const lines = [
		"OCADE ANSWER RECEIPT",
		`Issued        ${receipt.startedAt}`,
		`Answer id     ${receipt.messageId}`,
		`Produced on   ${receipt.producedOn.replace(/_/g, " ")} (${receipt.engineLabel})`,
		`Took          ${receipt.durationMs} ms`,
		`Question hash ${receipt.promptSha256}`,
		`Answer hash   ${receipt.answerSha256}`,
		"",
		verdict(receipt).headline
	];
	if (receipt.sources.length > 0) {
		lines.push("", "What it read:");
		for (const source of receipt.sources) lines.push(`  - ${describeSourceUse(source)}`);
	}
	if (receipt.networkUses?.length) {
		lines.push("", "Network retrieval:");
		for (const use of receipt.networkUses) lines.push(`  - ${use.provider}: ${use.querySent ? "query sent" : "query not sent"}; ${use.contacted.join(", ")}`);
	}
	if (receipt.blindSpots.length > 0) {
		lines.push("", "What this check cannot see:");
		for (const limit of receipt.blindSpots) lines.push(`  - ${limit}`);
	}
	lines.push("", `Receipt fingerprint ${digest}`);
	return lines.join("\n");
}
/**
* A conversation you can prove was not edited.
*
* WHY THIS MATTERS MORE THAN IT SOUNDS. Chat transcripts are already being used
* as evidence — of what advice was given, what a model was asked to do, what a
* person disclosed. Every mainstream assistant stores that history on the
* vendor's servers in a mutable database, and offers an "export" that is simply
* whatever the database currently says. Nothing about that export distinguishes
* a faithful record from one where a turn was quietly edited, inserted or
* dropped — not for a court, not for an auditor, and not for the user arguing
* with the vendor about what was actually said.
*
* A hash chain fixes that without needing anyone to be trusted. Each entry
* commits to the one before it, so changing any turn changes every hash after
* it. You do not have to trust OCADE, the storage, or the person who handed you
* the file: you recompute the chain and see for yourself.
*
* WHAT THIS IS NOT. It is tamper-EVIDENT, not tamper-proof. Someone with the
* file can rewrite every entry and produce a consistent chain — this proves
* internal consistency, not authorship. Making it unforgeable needs a signing
* key, and a key in a browser is a key the browser's owner controls, which
* would prove nothing extra while implying a great deal. `chainLimits()` says
* this out loud rather than letting "cryptographic" do misleading work.
*/
var GENESIS = "genesis";
/** Canonical serialisation, so the digest depends on content and not key order. */
function canonical(entry) {
	return [
		entry.index,
		entry.role,
		entry.contentSha256,
		entry.at,
		entry.previous
	].join("\0");
}
/**
* Append one turn to the chain.
*
* Takes the whole chain rather than just the tail so it cannot be called with
* a stale `previous` — passing the wrong link is the one mistake that would
* make the chain useless while still looking correct.
*/
async function append(chain, turn) {
	const previous = chain.length === 0 ? GENESIS : chain[chain.length - 1].hash;
	const base = {
		index: chain.length,
		role: turn.role,
		contentSha256: await sha256OfText(turn.content),
		at: turn.at.toISOString(),
		previous
	};
	return {
		...base,
		hash: await sha256OfText(canonical(base))
	};
}
/**
* Recompute the whole chain and report every fault, not just the first.
*
* Stopping at the first break would hide the shape of the tampering — whether
* one turn was edited or the second half was rewritten — which is exactly what
* somebody examining a disputed transcript needs to know.
*/
async function verifyChain(chain, messages) {
	const faults = [];
	for (let i = 0; i < chain.length; i += 1) {
		const entry = chain[i];
		if (entry.index !== i) faults.push({
			kind: "out_of_order",
			index: i,
			detail: `Entry claims position ${entry.index} but sits at ${i}. A turn was inserted or removed.`
		});
		const expectedPrevious = i === 0 ? GENESIS : chain[i - 1].hash;
		if (entry.previous !== expectedPrevious) faults.push({
			kind: "broken_link",
			index: i,
			detail: i === 0 ? "The first entry does not start the chain." : "This entry does not follow the one before it. Something was changed earlier in the conversation."
		});
		if (!isRealDigest(entry.hash) || !isRealDigest(entry.contentSha256)) {
			faults.push({
				kind: "unverifiable",
				index: i,
				detail: "This entry has no usable fingerprint, so it cannot be checked."
			});
			continue;
		}
		if (await sha256OfText(canonical(entry)) !== entry.hash) faults.push({
			kind: "altered_entry",
			index: i,
			detail: "This entry's own fingerprint does not match its contents. It was edited."
		});
		if (messages && messages[i] !== void 0) {
			if (await sha256OfText(messages[i]) !== entry.contentSha256) faults.push({
				kind: "content_mismatch",
				index: i,
				detail: "The message text does not match what the ledger recorded for this turn."
			});
		}
	}
	const intact = faults.length === 0;
	return {
		intact,
		faults,
		checked: chain.length,
		summary: intact ? chain.length === 0 ? "This conversation has no entries yet." : `All ${chain.length} ${chain.length === 1 ? "turn" : "turns"} are intact and in order.` : describeFaults(faults, chain.length)
	};
}
function describeFaults(faults, total) {
	const first = Math.min(...faults.map((f) => f.index));
	return `This conversation has been altered. The record is consistent up to turn ${first}, and ${total - first} ${total - first === 1 ? "turn is" : "turns are"} no longer trustworthy.`;
}
/** What the chain does and does not prove. */
function chainLimits() {
	return [
		"This proves the record is internally consistent, not who wrote it.",
		"Anyone who can rewrite the whole file can produce a consistent chain.",
		"It records fingerprints of messages, not the messages themselves."
	];
}
/** A portable record. Deliberately plain JSON — no custom container. */
function exportChain(chain) {
	return JSON.stringify({
		format: "ocade-ledger",
		version: 1,
		entries: chain
	}, null, 2);
}
function emptyTree() {
	return {
		nodes: /* @__PURE__ */ new Map(),
		headId: null
	};
}
/**
* Add a message at the current head.
*
* Returns a NEW tree rather than mutating, so a caller holding the previous one
* still has it — which is the whole point of the structure and would be
* undermined by in-place edits.
*/
function addMessage(tree, message) {
	const node = {
		id: message.id,
		parentId: tree.headId,
		role: message.role,
		content: message.content,
		at: message.at.toISOString(),
		label: message.label
	};
	const nodes = new Map(tree.nodes);
	nodes.set(node.id, node);
	return {
		nodes,
		headId: node.id
	};
}
/**
* The path from the root to a node, in order.
*
* This is what actually gets sent to the engine: one branch of the tree,
* flattened. Guarded against cycles — a corrupted file with a parent loop would
* otherwise hang the tab rather than reporting a broken conversation.
*/
function pathTo(tree, nodeId) {
	const path = [];
	const seen = /* @__PURE__ */ new Set();
	let current = tree.nodes.get(nodeId) ?? null;
	while (current) {
		if (seen.has(current.id)) break;
		seen.add(current.id);
		path.push(current);
		current = current.parentId ? tree.nodes.get(current.parentId) ?? null : null;
	}
	return path.reverse();
}
/** Direct children of a node — more than one means a branch point. */
function childrenOf(tree, nodeId) {
	return [...tree.nodes.values()].filter((n) => n.parentId === nodeId).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
/** Every point where the conversation forked. */
function branchPoints(tree) {
	const points = [];
	const parents = /* @__PURE__ */ new Set([null, ...[...tree.nodes.values()].map((n) => n.id)]);
	for (const parentId of parents) {
		const children = childrenOf(tree, parentId);
		if (children.length > 1) points.push({
			node: parentId ? tree.nodes.get(parentId) ?? null : null,
			branches: children
		});
	}
	return points;
}
function stats(tree) {
	const leaves = [...tree.nodes.values()].filter((n) => childrenOf(tree, n.id).length === 0);
	const depth = leaves.reduce((max, leaf) => Math.max(max, pathTo(tree, leaf.id).length), 0);
	return {
		messages: tree.nodes.size,
		branchPoints: branchPoints(tree).length,
		depth,
		leaves: leaves.length
	};
}
/** One line for the interface. */
function describeTree(tree) {
	const s = stats(tree);
	if (s.messages === 0) return "This conversation is empty.";
	if (s.branchPoints === 0) return `${s.messages} ${s.messages === 1 ? "message" : "messages"}, in a single line.`;
	return `${s.messages} messages across ${s.leaves} ${s.leaves === 1 ? "version" : "versions"}, branching at ${s.branchPoints} ${s.branchPoints === 1 ? "point" : "points"}. Nothing you tried has been discarded.`;
}
/**
* What a seal still lets through, and why each exception is safe.
*
* WHY THIS FILE EXISTS. Sealed mode used to be installed only around the
* `generate()` call, for the milliseconds an answer was being produced — while
* the button said "Sealed" and the toast said "Nothing can leave this device
* until you unseal it". Measured in the running app, `fetch`,
* `XMLHttpRequest`, `WebSocket` and `navigator.sendBeacon` were all still the
* native ones the whole time the UI claimed otherwise. The mechanism was
* complete and correct; nothing had connected it to the surface making the
* promise.
*
* Making the promise true means keeping the seal up for as long as the user
* says. A seal that blocks literally everything cannot stay up — the moment you
* navigate, the app asks for its next route chunk, is refused, and the page
* breaks. So the real question is not "block everything" versus "block during a
* send": it is to define exactly what CANNOT carry a conversation off the
* machine, allow precisely that, and refuse the rest indefinitely.
*
* TWO EXCEPTIONS, both narrow:
*
* 1. SAME-ORIGIN STATIC ASSETS — the script, stylesheet and font files the app
*    serves itself. They are fetched by URL with no request body, and the URL
*    is a build path, so there is nowhere for conversation text to ride along.
*    Anything with a body, a non-GET method, or a content path is not an asset:
*    `/api/`, `/_serverFn/` and `/auth/` are refused precisely because they are
*    the same-origin paths that DO carry content.
*
* 2. LOOPBACK — the on-device engine listens on `localhost`. A request there
*    never reaches a network interface, which is the whole claim being made.
*    The pattern is deliberately the one `provenance/network-witness.ts` uses
*    to classify a contact as `this_device`, so the seal and the receipt cannot
*    end up disagreeing about what "left the device" means.
*
* Everything else — every cross-origin host, every POST, every beacon — is
* refused and recorded.
*
* FAILS CLOSED. Anything this cannot parse or cannot categorise is refused. An
* allowlist that guesses in the permissive direction is not an allowlist.
*/
/** Same definition the provenance witness uses for `this_device`. */
var LOOPBACK = /^(localhost|127(?:\.\d+){3}|\[::1\]|::1|.*\.localhost)$/i;
/** Paths that carry content rather than code, even on our own origin. */
var CONTENT_PATHS = [
	/^\/api\//,
	/^\/_serverFn\//,
	/^\/auth\//
];
var ASSET_EXTENSION = /\.(js|mjs|cjs|css|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|ico|wasm|map)$/i;
/** Directories the build and the dev server serve modules from. */
var ASSET_DIRECTORIES = /^\/(src|assets|_build|node_modules|@vite|@fs|@id)\//;
function isLoopbackHost(hostname) {
	return LOOPBACK.test(hostname);
}
/**
* The page-level policy: static assets and loopback only.
*
* `origin` is injected rather than read from `location`, so every branch is
* reachable from a test on one machine — including the cross-origin one, which
* is the branch that actually matters.
*/
function allowAssetsAndLoopback(origin) {
	return (request) => {
		let url;
		try {
			url = new URL(request.url, origin);
		} catch {
			return false;
		}
		if (isLoopbackHost(url.hostname)) return true;
		if (url.origin !== origin) return false;
		const method = (request.method ?? "GET").toUpperCase();
		if (method !== "GET" && method !== "HEAD") return false;
		if (request.hasBody) return false;
		if (CONTENT_PATHS.some((p) => p.test(url.pathname))) return false;
		return ASSET_EXTENSION.test(url.pathname) || ASSET_DIRECTORIES.test(url.pathname);
	};
}
/**
* The default: nothing at all may leave.
*
* Used by the send-time seal, which wraps a single `generate()` call and has no
* reason to let even an asset through.
*/
var allowNothing = () => false;
/**
* Install a conversation-long seal, and hand back how to lift it.
*
* WHY THIS IS A FUNCTION AND NOT FOUR LINES INSIDE A `useEffect`. The defect
* that led here was never in `Seal` — that class was correct, complete and
* covered by a mutation the suite catches. The defect was that no screen ever
* called it outside a send, so the button said "Sealed" over an unsealed page.
* A guarantee living only inside a component effect is a guarantee no test can
* reach: this project has no DOM renderer, so an effect is unreachable from
* vitest by construction.
*
* Pulling the body out here makes the wiring itself testable with a fake scope,
* which is the part that was actually broken. Both chat surfaces call this, so
* they cannot drift apart either.
*
* @returns the cleanup to run when the seal should lift, or undefined when
*   nothing was installed — matching what a `useEffect` body must return.
*/
function installConversationSeal(sealed, make, origin) {
	if (!sealed || !origin) return void 0;
	const seal = make(allowAssetsAndLoopback(origin));
	seal.seal();
	return () => {
		seal.unseal();
	};
}
/**
* Sealed mode: a conversation that cannot reach the network.
*
* WHY THIS IS NOT A SETTING. Every assistant has a privacy toggle, and every
* one of them means "we intend not to send this". Intent is implemented as a
* branch somewhere in the code, and a branch can be wrong: a retry path, an
* error reporter, a telemetry ping, an analytics beacon added two years later
* by somebody who never read the privacy design. The user cannot audit any of
* it, and neither, honestly, can the team shipping it.
*
* Sealed mode is a different kind of object. It does not ask the application to
* behave; it removes the ability to misbehave, by installing a barrier in front
* of every network primitive the page has. A telemetry call added later does
* not quietly succeed — it throws, loudly, and the seal records the attempt.
*
* THE ATTEMPTS ARE THE POINT. A seal that silently swallowed blocked calls
* would hide exactly the information worth having. `attempts` is a list of what
* tried to leave, so "nothing was sent" can be accompanied by "and here is what
* wanted to". That is a claim no cloud assistant can make at all — there is no
* boundary on a server that the user is on the right side of.
*
* WHAT IT HONESTLY CANNOT DO, and the interface must say so:
*  - The native managed-browser host runs outside the page and is not affected.
*  - Another tab is a different context with its own primitives.
*  - Code that captured a reference to `fetch` BEFORE the seal was applied
*    still holds the original. `capturedEarly()` reports whether that risk is
*    live rather than pretending it is not.
*
* Sealing is therefore a strong local guarantee, not a sandbox, and it is
* described as one.
*
* HOW LONG IT STAYS UP is the caller's decision, and it used to be far shorter
* than the interface implied: the only callers wrapped a single `generate()`
* call, so the barrier existed for the milliseconds an answer was produced
* while the button read "Sealed" and the toast said "until you unseal it".
* Measured in the running app, every primitive was still the native one. A
* seal can now carry a policy (`SealAllow`), which is what lets one stay up for
* a whole conversation without breaking the page — see `seal-policy.ts`.
*/
/**
* The URL string out of a URL-ish value: a string, a `URL`, or a `Request`.
*
* Separate from `originOf` because the policy needs the PATH — an asset
* allowlist cannot decide anything from an origin alone — while the attempt log
* deliberately keeps only the origin, so a refusal record never itself becomes
* a copy of what the user was doing.
*/
function urlOf(input) {
	return typeof input === "string" ? input : input instanceof URL ? input.href : typeof input?.url === "string" ? input.url : "";
}
/** Origin of a URL-ish value, without retaining the path. */
function originOf(input) {
	const raw = urlOf(input);
	if (!raw) return "(unknown)";
	try {
		return new URL(raw, globalThis.location?.href ?? "http://localhost").origin;
	} catch {
		return "(unknown)";
	}
}
/**
* The error a blocked call receives.
*
* A named class so callers can distinguish "the seal refused this" from "the
* network is down". Treating the two the same is how a blocked telemetry call
* ends up retried forever in a backoff loop.
*/
var SealedModeError = class extends Error {
	transport;
	constructor(transport) {
		super("This conversation is sealed: nothing may leave this device. Unseal it in the conversation menu to allow network access.");
		this.name = "SealedModeError";
		this.transport = transport;
	}
};
/**
* Who has patched which scope, so overlapping seals cannot corrupt the restore.
*
* THE BUG THIS FIXES, which was in the first version of this file. Sealing is
* monkey-patching, and monkey-patching does not nest by itself:
*
*   a.seal()    // a saves the REAL fetch, installs wrapper A
*   b.seal()    // b saves WRAPPER A, believing it is the original
*   a.unseal()  // a restores the real fetch
*   b.unseal()  // b restores wrapper A — over the top of the real one
*
* The page is left permanently sealed. Every request throws `SealedModeError`
* forever, with no seal active to explain why, and the only recovery is a
* reload. That is far worse than the problem sealing solves, and it is exactly
* the failure mode this module warns about elsewhere.
*
* Reference counting fixes it: the FIRST seal on a scope patches and stores the
* genuine originals; later seals join without re-patching; only the last one to
* leave restores. Each instance still keeps its own attempt log, because two
* conversations sealed at once should each report what THEY blocked.
*
* Keyed by scope so tests using injected scopes cannot interfere with each
* other, or with a real page.
*/
var patched = /* @__PURE__ */ new WeakMap();
/**
* Decide whether a request may proceed, given EVERY seal currently in force.
*
* Overlapping seals intersect: most restrictive wins. Without this, the
* reference counting above would silently loosen a strict seal — the second
* seal to arrive joins rather than re-patching, so a send-time seal installed
* while a permissive page-level seal was already up would inherit the page's
* allowlist instead of its own. That is the exact opposite of what the caller
* asked for, and it would be invisible.
*/
function permitted(scope, request) {
	const active = listeners.get(scope);
	if (!active || active.size === 0) return false;
	for (const seal of active) if (!seal.allow(request)) return false;
	return true;
}
/**
* Every seal currently in force on a scope.
*
* The wrapper is installed once, by the first seal, so it needs to know who to
* report a blocked attempt to. All of them: each is in force, so each is
* entitled to say what was refused while it was up.
*/
var listeners = /* @__PURE__ */ new WeakMap();
var Seal = class {
	scope;
	originals = {};
	attempts = [];
	sealedAt = 0;
	active = false;
	/** Captured at construction, so `capturedEarly` can compare identities. */
	fetchAtBoot;
	/**
	* What this seal still permits. Defaults to nothing at all, which is what a
	* send-time seal wants; the page-level seal passes an asset/loopback policy
	* so it can stay up without breaking navigation.
	*/
	allow;
	constructor(scope = globalThis, allow = allowNothing) {
		this.scope = scope;
		this.allow = allow;
		this.fetchAtBoot = scope.fetch;
	}
	isActive() {
		return this.active;
	}
	/**
	* Install the barrier.
	*
	* Idempotent: sealing twice must not stack wrappers, or unsealing once would
	* leave a wrapper behind and the page permanently offline.
	*/
	seal() {
		if (this.active) return;
		const scope = this.scope;
		this.attempts = [];
		this.sealedAt = Date.now();
		this.active = true;
		const existing = patched.get(scope);
		if (existing) {
			existing.depth += 1;
			listeners.get(scope)?.add(this);
			return;
		}
		const record = (transport, target) => {
			const origin = originOf(target);
			const at = Date.now();
			for (const seal of listeners.get(scope) ?? []) seal.attempts.push({
				transport,
				origin,
				at
			});
			return new SealedModeError(transport);
		};
		listeners.set(scope, /* @__PURE__ */ new Set([this]));
		patched.set(scope, {
			depth: 1,
			originals: this.originals
		});
		if (typeof scope.fetch === "function") {
			const original = scope.fetch;
			this.originals.fetch = original;
			scope.fetch = ((input, init) => {
				const asRequest = input;
				const request = {
					url: urlOf(input),
					method: init?.method ?? asRequest?.method,
					hasBody: init?.body != null || asRequest?.body != null
				};
				if (permitted(scope, request)) return original(input, init);
				return Promise.reject(record("fetch", input));
			});
		}
		if (typeof scope.XMLHttpRequest === "function") {
			this.originals.XMLHttpRequest = scope.XMLHttpRequest;
			const Original = this.originals.XMLHttpRequest;
			class SealedXHR extends Original {
				open(method, url, ...rest) {
					if (!permitted(scope, {
						url: urlOf(url),
						method,
						hasBody: true
					})) throw record("xhr", url);
					super.open(method, url, ...rest);
				}
			}
			scope.XMLHttpRequest = SealedXHR;
		}
		if (scope.navigator && typeof scope.navigator.sendBeacon === "function") {
			this.originals.sendBeacon = scope.navigator.sendBeacon;
			const originalBeacon = scope.navigator.sendBeacon.bind(scope.navigator);
			scope.navigator.sendBeacon = (url, data) => {
				if (permitted(scope, {
					url: urlOf(url),
					method: "POST",
					hasBody: true
				})) return originalBeacon(url, data);
				record("beacon", url);
				return false;
			};
		}
		if (typeof scope.WebSocket === "function") {
			const OriginalWs = scope.WebSocket;
			this.originals.WebSocket = OriginalWs;
			scope.WebSocket = function SealedWebSocket(url, protocols) {
				if (permitted(scope, {
					url: urlOf(url),
					method: "GET",
					hasBody: true
				})) return new OriginalWs(url, protocols);
				throw record("websocket", url);
			};
		}
		if (typeof scope.EventSource === "function") {
			const OriginalEs = scope.EventSource;
			this.originals.EventSource = OriginalEs;
			scope.EventSource = function SealedEventSource(url, init) {
				if (permitted(scope, {
					url: urlOf(url),
					method: "GET",
					hasBody: true
				})) return new OriginalEs(url, init);
				throw record("eventsource", url);
			};
		}
	}
	/**
	* Leave the seal. The primitives are restored only when the LAST holder goes.
	*
	* Restoring on every `unseal` would unseal the page while another
	* conversation still believed it was protected — a silent failure of the one
	* guarantee this class exists to make.
	*/
	unseal() {
		const report = this.report();
		if (!this.active) return report;
		const scope = this.scope;
		this.active = false;
		listeners.get(scope)?.delete(this);
		const state = patched.get(scope);
		if (!state) return report;
		state.depth -= 1;
		if (state.depth > 0) return report;
		const originals = state.originals;
		if (originals.fetch) scope.fetch = originals.fetch;
		if (originals.XMLHttpRequest) scope.XMLHttpRequest = originals.XMLHttpRequest;
		if (originals.sendBeacon && scope.navigator) scope.navigator.sendBeacon = originals.sendBeacon;
		if (originals.WebSocket) scope.WebSocket = originals.WebSocket;
		if (originals.EventSource) scope.EventSource = originals.EventSource;
		patched.delete(scope);
		listeners.delete(scope);
		this.originals = {};
		return report;
	}
	report() {
		return {
			active: this.active,
			attempts: [...this.attempts],
			heldMs: this.sealedAt ? Date.now() - this.sealedAt : 0
		};
	}
	/**
	* Could something still get out through a reference taken before sealing?
	*
	* Any module that did `const f = window.fetch` at import time holds the
	* original and is unaffected by the barrier. This cannot be prevented from
	* inside the page, so it is REPORTED instead — an honest limit stated up
	* front is worth more than a guarantee that quietly has a hole in it.
	*/
	capturedEarly() {
		return this.fetchAtBoot !== void 0 && this.fetchAtBoot !== this.originals.fetch;
	}
};
/** One sentence describing what the seal held. */
function describeSeal(report) {
	if (report.attempts.length === 0) return "Nothing attempted to leave this device while the conversation was sealed.";
	const origins = [...new Set(report.attempts.map((a) => a.origin))];
	return `${report.attempts.length} network ${report.attempts.length === 1 ? "attempt was" : "attempts were"} blocked while sealed${origins.length ? `, aimed at ${origins.join(", ")}` : ""}.`;
}
/**
* What an answer actually cost — in money, energy and time.
*
* When the compute is yours, the arithmetic is yours too. A local answer costs
* electricity and nothing else, and that is a number this can actually derive:
* measured wall-clock time, a declared power draw for the machine class, and
* the user's own tariff.
*
* WHY THIS IS A FEATURE AND NOT A GIMMICK. It reframes the product's central
* claim from a slogan into arithmetic. "Unlimited local use" is marketing;
* "this conversation cost 0.03 p and stayed on this device" is a fact the user
* can check against their own electricity bill and the runtime receipt.
*
* EVERY FIGURE IS LABELLED. Power draw is a class estimate, not a measurement —
* browsers cannot read a wattmeter. The interface says "estimated" and shows
* the assumption, because a precise-looking number derived from a guess is
* worse than an honest range.
*/
/** Rough sustained draw while generating, by machine class, in watts. */
var POWER_CLASS = {
	phone: 4,
	laptop_integrated: 22,
	laptop_discrete: 65,
	desktop_discrete: 180
};
function measureRun(input) {
	const seconds = Math.max(0, input.durationMs) / 1e3;
	const tokens = input.outputTokens ?? null;
	const tokensPerSecond = tokens !== null && seconds > 0 ? tokens / seconds : null;
	const energyWh = POWER_CLASS[input.powerClass ?? "laptop_integrated"] * seconds / 3600;
	const tariff = input.tariffMinorPerKwh ?? 28;
	const costMinor = energyWh / 1e3 * tariff;
	return {
		where: "local",
		durationMs: input.durationMs,
		outputTokens: tokens,
		tokensPerSecond,
		energyWh,
		costMinor,
		currency: input.currency ?? "GBP"
	};
}
function total(runs) {
	return {
		runs: runs.length,
		local: runs.length,
		energyWh: runs.reduce((n, r) => n + r.energyWh, 0),
		costMinor: runs.reduce((n, r) => n + r.costMinor, 0),
		currency: runs[0]?.currency ?? "GBP"
	};
}
/** Money, at a precision that does not pretend to more accuracy than it has. */
function formatCost(minor, currency) {
	const symbol = currency === "GBP" ? "p" : "";
	if (minor < .01) return `under 0.01${symbol || " " + currency}`;
	if (minor < 1) return `${minor.toFixed(2)}${symbol || " " + currency}`;
	return symbol === "p" ? `£${(minor / 100).toFixed(2)}` : `${(minor / 100).toFixed(2)} ${currency}`;
}
/** Energy in units a person can picture. */
function formatEnergy(wh) {
	if (wh < .001) return "under 0.001 Wh";
	if (wh < 1) return `${wh.toFixed(3)} Wh`;
	return `${wh.toFixed(2)} Wh`;
}
/**
* What this conversation actually cost, on this machine.
*
* What a person can act on is what their own hardware did, so that is what is
* reported — and the honest limit of it is stated in `energyAssumption`.
*/
function describeTotals(totals) {
	if (totals.runs === 0) return "Nothing has been asked yet in this conversation.";
	if (totals.local === 0) return "Nothing has been generated on this device yet in this conversation.";
	return `${totals.local} ${totals.local === 1 ? "answer" : "answers"} ran on your own hardware, using about ${formatEnergy(totals.energyWh)} of electricity — roughly ${formatCost(totals.costMinor, totals.currency)}. Nothing was metered and nothing left this device.`;
}
/**
* Rough token estimate.
*
* ~4 characters per token is the usual English approximation. It is wrong for
* code, wrong for CJK, and wrong for heavily punctuated text — which is exactly
* why every number derived from it is presented as "about".
*/
function estimateTokens(text) {
	if (text.length === 0) return 0;
	return Math.max(1, Math.ceil(text.length / 4));
}
var REMEDIES = {
	older_turn: "Start a new conversation, or pin the part you need.",
	middle_of_document: "Ask about a specific section by name so it can be searched instead.",
	low_relevance: "Mention the document by name in your question to raise its priority.",
	duplicate: "This was already included once; nothing is missing.",
	attachment_unreadable: "No text could be read from this file, so it could not be included."
};
/**
* Decide what fits.
*
* Drops lowest priority first, and reports each removal with a reason and a
* remedy. The order is stable so the same conversation produces the same plan —
* a budget that shuffled would make the disclosure impossible to trust.
*/
function planBudget(items, limitTokens) {
	const pinned = items.filter((i) => i.pinned);
	const optional = items.filter((i) => !i.pinned);
	const pinnedTokens = pinned.reduce((n, i) => n + i.tokens, 0);
	if (pinnedTokens > limitTokens) return {
		included: [],
		dropped: [],
		usedTokens: pinnedTokens,
		limitTokens,
		complete: false,
		impossible: true,
		summary: `This message is too long for the engine on its own — about ${pinnedTokens.toLocaleString()} tokens against a limit of ${limitTokens.toLocaleString()}. Shorten the question or use an engine with more room.`
	};
	const ranked = [...optional].map((item, index) => ({
		item,
		index
	})).sort((a, b) => b.item.priority - a.item.priority || a.index - b.index);
	const included = [...pinned];
	const dropped = [];
	let used = pinnedTokens;
	for (const { item } of ranked) if (used + item.tokens <= limitTokens) {
		included.push(item);
		used += item.tokens;
	} else {
		const reason = reasonFor(item);
		dropped.push({
			id: item.id,
			label: item.label,
			kind: item.kind,
			tokens: item.tokens,
			reason,
			remedy: REMEDIES[reason]
		});
	}
	const order = new Map(items.map((item, index) => [item.id, index]));
	included.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
	const complete = dropped.length === 0;
	return {
		included,
		dropped,
		usedTokens: used,
		limitTokens,
		complete,
		impossible: false,
		summary: complete ? `Everything fits — about ${used.toLocaleString()} of ${limitTokens.toLocaleString()} tokens used.` : describeDropped(dropped, used, limitTokens)
	};
}
function reasonFor(item) {
	if (item.kind === "turn") return "older_turn";
	if (item.kind === "document") return item.tokens > 0 ? "low_relevance" : "attachment_unreadable";
	return "low_relevance";
}
function describeDropped(dropped, used, limit) {
	const docs = dropped.filter((d) => d.kind === "document").length;
	const turns = dropped.filter((d) => d.kind === "turn").length;
	const parts = [];
	if (docs > 0) parts.push(`${docs} ${docs === 1 ? "document" : "documents"}`);
	if (turns > 0) parts.push(`${turns} earlier ${turns === 1 ? "message" : "messages"}`);
	return `${parts.length > 0 ? parts.join(" and ") : `${dropped.length} items`} did not fit and were left out of this answer. About ${used.toLocaleString()} of ${limit.toLocaleString()} tokens were used.`;
}
/**
* The one line that goes under the answer.
*
* Returns null when nothing was dropped, so a normal answer carries no notice.
* A warning on every message is a warning nobody reads.
*/
function truncationNotice(plan) {
	if (plan.complete || plan.impossible) return null;
	const documents = plan.dropped.filter((d) => d.kind === "document");
	if (documents.length > 0) return `This answer did not include ${documents.map((d) => d.label).join(", ")} — ${documents.length === 1 ? "it" : "they"} did not fit in the engine's context.`;
	return `Earlier messages were left out of this answer to fit the engine's context.`;
}
/**
* Answers you can reproduce, and differences you can see.
*
* THE PROBLEM WITH A CLOUD ASSISTANT AS A TOOL OF RECORD. Ask the same question
* twice and you may get different answers — different sampling, and often a
* different model, because the vendor upgrades continuously and does not tell
* you when. Nothing is pinned. If an answer informed a decision in March, there
* is no way in June to establish what the system actually said, or to show that
* the change came from the model rather than from you.
*
* That rules those tools out of anything that needs a defensible record:
* clinical notes, compliance review, legal drafting, safety analysis, audit.
*
* OCADE holds the weights. The model is a file with a digest, it does not
* change under you, and the sampler runs locally — so a run can be pinned to a
* SEED and a MODEL DIGEST and repeated exactly. This module is the bookkeeping
* that makes that usable: pin a run, repeat it, and get a precise account of
* what differed if anything did.
*
* HONESTY ABOUT DETERMINISM. Identical output needs identical weights, sampler,
* seed AND numerics. GPU kernels are not always bit-reproducible across drivers
* or hardware, so `RunPin` records the backend too, and a mismatch is reported
* as "conditions differed" rather than silently blamed on the model. Claiming
* determinism we cannot deliver would be the same failure as everything else
* this codebase refuses to do.
*/
/**
* A seed from a prompt, when the caller does not supply one.
*
* Derived rather than random so that "run this again" is possible from the
* pin alone. A random seed nobody recorded is the same as no seed.
*/
function seedFor(prompt) {
	let hash = 2166136261;
	for (let i = 0; i < prompt.length; i += 1) {
		hash ^= prompt.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 1;
}
async function pinRun(input) {
	const [promptSha256, answerSha256] = await Promise.all([sha256OfText(input.prompt), sha256OfText(input.answer)]);
	return {
		pin: {
			promptSha256,
			modelKey: input.modelKey,
			modelSha256: input.modelSha256,
			seed: input.seed ?? seedFor(input.prompt),
			temperature: input.temperature,
			topP: input.topP,
			backend: input.backend
		},
		answer: input.answer,
		answerSha256,
		at: (input.at ?? /* @__PURE__ */ new Date()).toISOString()
	};
}
/**
* Compare a repeat against its pin.
*
* The order of reporting is deliberate: CONDITIONS FIRST. A different answer
* under different conditions is not a surprise and should not be presented as
* one. A different answer under identical conditions is the interesting case,
* and it is the only one worth alarming about.
*/
function compareRuns(original, repeat) {
	const changes = [];
	for (const { key, explains } of [
		{
			key: "promptSha256",
			explains: true
		},
		{
			key: "modelSha256",
			explains: true
		},
		{
			key: "modelKey",
			explains: true
		},
		{
			key: "seed",
			explains: true
		},
		{
			key: "temperature",
			explains: true
		},
		{
			key: "topP",
			explains: true
		},
		{
			key: "backend",
			explains: true
		}
	]) if (original.pin[key] !== repeat.pin[key]) changes.push({
		field: key,
		before: original.pin[key],
		after: repeat.pin[key],
		explainsDifference: explains
	});
	const identical = isRealDigest(original.answerSha256) && original.answerSha256 === repeat.answerSha256;
	const conditionsMatched = changes.length === 0;
	return {
		identical,
		conditionsMatched,
		changes,
		summary: summarise(identical, conditionsMatched, changes)
	};
}
function summarise(identical, conditionsMatched, changes) {
	if (identical && conditionsMatched) return "Reproduced exactly. Same question, same engine, same settings, same answer.";
	if (identical && !conditionsMatched) return `The answer is identical even though the conditions changed: ${changes.map((c) => readable(c.field)).join(", ")}.`;
	if (!conditionsMatched) return `The answer differs, and so did the conditions: ${changes.map((c) => readable(c.field)).join(", ")}. Match those to compare like for like.`;
	return "The answer differs under identical conditions. On this engine that means sampling is not deterministic here — pin the seed and check the backend.";
}
function readable(field) {
	switch (field) {
		case "promptSha256": return "the question";
		case "modelKey": return "which engine";
		case "modelSha256": return "the engine file";
		case "seed": return "the seed";
		case "temperature": return "temperature";
		case "topP": return "top-p";
		case "backend": return "the hardware path";
	}
}
/**
* A word-level diff of two answers.
*
* Word granularity rather than character: a character diff of prose produces
* unreadable confetti, and the question being asked here is "what did it say
* differently", not "which bytes moved".
*
* Longest-common-subsequence, which is O(n·m). Answers are bounded by the
* context window, so this is fine — and a heuristic diff that occasionally
* mis-aligns would undermine the one thing this view is for.
*/
function diffAnswers(before, after) {
	const a = before.split(/(\s+)/).filter((t) => t.length > 0);
	const b = after.split(/(\s+)/).filter((t) => t.length > 0);
	const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
	const spans = [];
	const push = (kind, text) => {
		const last = spans[spans.length - 1];
		if (last && last.kind === kind) last.text += text;
		else spans.push({
			kind,
			text
		});
	};
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) if (a[i] === b[j]) {
		push("same", a[i]);
		i += 1;
		j += 1;
	} else if (table[i + 1][j] >= table[i][j + 1]) {
		push("removed", a[i]);
		i += 1;
	} else {
		push("added", b[j]);
		j += 1;
	}
	while (i < a.length) push("removed", a[i++]);
	while (j < b.length) push("added", b[j++]);
	return spans;
}
/** How much of the answer actually changed, 0–1. */
function driftRatio(spans) {
	const total = spans.reduce((n, s) => n + s.text.length, 0);
	if (total === 0) return 0;
	return spans.filter((s) => s.kind !== "same").reduce((n, s) => n + s.text.length, 0) / total;
}
/**
* The guarantees, composed into one send.
*
* Each module beside this one does a single job — seal the network, scan for
* secrets, budget the context, meter the cost, chain the transcript, pin the
* run. This is where they become a conversation rather than a toolbox.
*
* WHY A COORDINATOR AND NOT SEVEN CALLS IN THE COMPONENT. The order is load
* bearing and it is not obvious:
*
*   1. PREFLIGHT before anything else. Scanning after the seal is up would be
*      pointless (nothing can leave anyway) and scanning after a cloud send has
*      started would be an apology rather than a control.
*   2. BUDGET before generating, because what was dropped has to be disclosed
*      with the answer, not discovered afterwards.
*   3. WITNESS opened around generation only. Wider and it captures unrelated
*      page traffic; narrower and it misses the request that matters.
*   4. METER, LEDGER and PIN after, from what actually happened.
*
* Getting that order wrong produces features that appear to work and quietly
* guarantee nothing, which is the failure this whole area exists to avoid. It
* belongs in one tested place rather than in every screen that sends a message.
*/
/**
* Everything that must happen BEFORE a single token is generated.
*
* Returns `proceed: false` rather than throwing: a refusal is an ordinary
* outcome here, and an exception would push every caller into a try/catch that
* treats "we protected you" the same as "something broke".
*/
function prepareSend(input) {
	const { text, items, guards } = input;
	const findings = guards.scanOutgoing && !guards.sealed ? preflight(text) : [];
	const plan = planBudget(items, guards.contextLimitTokens);
	if (plan.impossible) return {
		proceed: false,
		blockedReason: plan.summary,
		findings,
		plan,
		truncation: null
	};
	if (findings.filter((f) => f.severity === "critical").length > 0) return {
		proceed: false,
		blockedReason: summarise$1(findings),
		findings,
		plan,
		truncation: truncationNotice(plan)
	};
	return {
		proceed: true,
		findings,
		plan,
		truncation: truncationNotice(plan)
	};
}
/**
* Record a turn in the branching history.
*
* Kept here rather than in the component so the ledger and the tree are always
* appended together. They answer different questions — "was this altered?" and
* "what else did I try?" — and a surface that updated one without the other
* would produce a history whose two halves disagreed.
*/
function recordTurn(tree, turn) {
	const next = addMessage(tree, turn);
	return {
		tree: next,
		shape: describeTree(next)
	};
}
/**
* A guarded generation, start to finish.
*
* `generate` is injected rather than imported so this stays testable without an
* engine, and so the seal is demonstrably around the REAL call — a wrapper that
* sealed, returned, and then let the caller generate would prove nothing.
*/
async function runGuarded(input) {
	const clock = input.now ?? (() => Date.now());
	const seal = input.guards.sealed ? new Seal(input.scope) : null;
	const witness = new NetworkWitness(input.scope);
	const startedAt = /* @__PURE__ */ new Date();
	const startedMs = clock();
	seal?.seal();
	witness.start();
	let answer = "";
	let sealReport = null;
	try {
		answer = await input.generate();
	} finally {
		sealReport = seal?.unseal() ?? null;
	}
	const observation = witness.stop();
	const durationMs = clock() - startedMs;
	const [receipt, entry, pinned] = await Promise.all([
		buildReceipt({
			messageId: input.messageId,
			producedOn: "this_device",
			engineLabel: input.engineLabel,
			prompt: input.prompt,
			answer,
			sources: input.sources ?? [],
			observation,
			blindSpots: limits(),
			startedAt,
			durationMs
		}),
		append(input.chain, {
			role: "assistant",
			content: answer,
			at: startedAt
		}),
		pinRun({
			prompt: input.prompt,
			answer,
			modelKey: input.modelKey,
			modelSha256: input.modelSha256,
			temperature: input.temperature,
			topP: input.topP,
			backend: input.backend,
			at: startedAt
		})
	]);
	const cost = measureRun({
		durationMs,
		powerClass: input.guards.powerClass,
		tariffMinorPerKwh: input.guards.tariffMinorPerKwh
	});
	return {
		answer,
		receipt,
		cost,
		entry,
		pinned,
		seal: sealReport
	};
}
/** Default guards: sealed off, scanning on, a conservative context budget. */
function defaultGuards() {
	return {
		sealed: false,
		scanOutgoing: true,
		contextLimitTokens: 4096
	};
}
//#endregion
export { stats as A, measureRun as C, recordTurn as D, receiptToText as E, verdict as M, verifyChain as N, runGuarded as O, limits as S, receiptDigest as T, driftRatio as _, Seal as a, exportChain as b, buildReceipt as c, defaultGuards as d, describeSeal as f, diffAnswers as g, describeTree as h, PreparationStatus as i, total as j, sha256OfText as k, chainLimits as l, describeTotals as m, MessageList as n, append as o, describeSourceUse as p, NetworkWitness as r, branchPoints as s, EngineBadge as t, compareRuns as u, emptyTree as v, prepareSend as w, installConversationSeal as x, estimateTokens as y };
