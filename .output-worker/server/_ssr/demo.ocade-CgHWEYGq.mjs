import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { At as Mic, Ft as MessageSquarePlus, Ht as LockOpen, Kt as Link2, Mt as MicOff, Vt as Lock, Wt as LoaderCircle, ar as CheckCheck, it as Plus, ln as GitCompare, m as TriangleAlert, mt as Paperclip, rn as ImagePlus, t as X, vn as FileText, w as Square, wr as ArrowLeft, xr as ArrowUp } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as warningMessage, r as formatResetRemaining } from "./session-BA6zzQzb.mjs";
import { t as ChatSidebar } from "./ChatSidebar-BRmHqYxd.mjs";
import { t as ocadeCorePolicy } from "./ocade-core-policy-SZTtH6f8.mjs";
import { n as useLocalChatEngine } from "./use-local-chat-engine-CA9YeR6B.mjs";
import { n as useDictation, t as LANGUAGE_CANDIDATES } from "./use-dictation-4utRaPC4.mjs";
import { a as useDemoSession, i as DemoSidebarNav, n as DemoControlNav, r as DemoSessionBadge, t as ChatShell } from "./use-demo-session-DmzLXuEo.mjs";
import { t as OCADE_IDENTITY } from "./ocade-identity-BWv-E_0R.mjs";
import { n as useChatPrefs } from "./use-chat-prefs-NPtv7oUs.mjs";
import { D as recordTurn, O as runGuarded, _ as driftRatio, a as Seal, d as defaultGuards, g as diffAnswers, i as PreparationStatus, j as total, m as describeTotals, n as MessageList, o as append, t as EngineBadge, u as compareRuns, v as emptyTree, w as prepareSend, x as installConversationSeal, y as estimateTokens } from "./session-0wAV7yob.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/demo.ocade-CgHWEYGq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* The same question, asked twice, with the difference shown.
*
* WHY THIS VIEW IS THE POINT OF REPRODUCIBILITY. Pinning a run is bookkeeping;
* nobody benefits from a stored seed they cannot act on. What people actually
* need is the answer to "is this thing stable?" — and the honest form of that
* answer is not a percentage, it is the words that changed.
*
* No mainstream assistant can show this, and not because they have not thought
* of it: they cannot pin the model. Their weights change under you without
* notice, so a re-run compares two unknowns and any difference is
* uninterpretable. Here both runs name the same engine file by digest, so a
* difference means something specific.
*
* CONDITIONS BEFORE CONTENT, on screen as well as in the data. If the user
* changed the temperature, the headline says so and the diff is context rather
* than evidence. Leading with "the answer changed" would be technically true
* and would misdirect every reader who did not scroll.
*/
function AnswerDiff({ before, after, verdict, className }) {
	const spans = diffAnswers(before, after);
	const drift = driftRatio(spans);
	const tone = verdict.identical ? "identical" : verdict.conditionsMatched ? "unstable" : "explained";
	const Icon = tone === "identical" ? CheckCheck : tone === "unstable" ? TriangleAlert : GitCompare;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Comparison with the previous answer",
		className: cn("rounded-xl border border-border/60 bg-secondary/20 p-3 text-[12px]", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: cn("flex items-start gap-2", tone === "identical" && "text-[color:var(--state-success)]", tone === "unstable" && "text-[color:var(--state-warning)]", tone === "explained" && "text-muted-foreground"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "mt-0.5 h-3.5 w-3.5 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "leading-relaxed",
					children: verdict.summary
				})]
			}),
			verdict.changes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 flex flex-wrap gap-1",
				children: verdict.changes.map((change) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-foreground",
							children: change.field
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums",
							children: [
								String(change.before).slice(0, 10),
								" → ",
								String(change.after).slice(0, 10)
							]
						})
					]
				}, change.field))
			}) : null,
			verdict.identical ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2.5 text-[10.5px] text-muted-foreground",
					children: [(drift * 100).toFixed(0), "% of the wording changed"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 whitespace-pre-wrap break-words leading-relaxed",
					children: spans.map((span, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn(span.kind === "added" && "rounded bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]", span.kind === "removed" && "rounded bg-destructive/15 text-destructive line-through decoration-1"),
						children: span.text
					}, `${span.kind}-${index}`))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-[10.5px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-destructive",
							children: "struck through"
						}),
						" was in the first answer;",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[color:var(--state-success)]",
							children: "highlighted"
						}),
						" is new."
					]
				})
			] })
		]
	});
}
/**
* Deciding what a paste or a drop means.
*
* Split out of `ChatComposer` so the component file exports only a component:
* mixing helpers in defeats fast refresh, and every edit to the composer then
* loses whatever the user had typed. These are also the fiddliest part of drag
* handling, and separating them is what makes them testable without a DOM.
*/
/**
* Is this drag carrying files?
*
* Dragging selected TEXT across the composer also fires drag events, and
* flashing a "drop to attach" overlay for a text drag is a lie about what is
* about to happen. `types` is the only reliable answer during a drag, because
* the file list itself is deliberately unreadable until the drop.
*/
function dragCarriesFiles(types) {
	return types?.includes("Files") ?? false;
}
/**
* The overlay counter.
*
* dragenter/dragleave fire once for EVERY element the pointer crosses, so a
* boolean flag turns the overlay off the moment the cursor moves from the box
* onto the textarea inside it. Counting enters against leaves is what makes
* "has the pointer actually left" answerable. It never goes below zero: a
* stray leave without a matching enter would otherwise leave the count
* negative and the overlay stuck on for the rest of the session.
*/
function dragDepthAfter(current, event) {
	if (event === "enter") return current + 1;
	if (event === "drop") return 0;
	return Math.max(0, current - 1);
}
/**
* May these files be attached?
*
* Refusing while a reply is streaming is not fussiness: the attachment list is
* read when the NEXT message is assembled, so a file added mid-stream would
* appear to belong to the turn already in flight and silently arrive with the
* following one instead.
*/
function acceptsFiles(state) {
	return state.hasHandler && !state.disabled && !state.streaming && state.fileCount > 0;
}
function ComposerMenu({ onNewChat, onUploadImage, onUploadFile, onAddLink, imageDisabledReason, signedIn = true, className }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	/** The label of a gated action the user pressed, or null for the menu. */
	const [gated, setGated] = (0, import_react.useState)(null);
	const triggerRef = (0, import_react.useRef)(null);
	const menuRef = (0, import_react.useRef)(null);
	const menuId = (0, import_react.useId)();
	const actions = [
		onNewChat && {
			id: "new-chat",
			label: "New chat",
			hint: "Start a fresh conversation",
			icon: MessageSquarePlus,
			onSelect: onNewChat
		},
		onUploadImage && {
			id: "image",
			label: "Upload image",
			hint: "OCADE reads it on this device",
			icon: ImagePlus,
			onSelect: onUploadImage,
			disabledReason: signedIn ? imageDisabledReason ?? null : null,
			requiresSignIn: !signedIn
		},
		onUploadFile && {
			id: "file",
			label: "Upload file",
			hint: "Text, Markdown, CSV, JSON, code, PDF, DOCX",
			icon: Paperclip,
			onSelect: onUploadFile,
			requiresSignIn: !signedIn
		},
		onAddLink && {
			id: "link",
			label: "Add link",
			hint: "Needs a connection the first time",
			icon: Link2,
			onSelect: onAddLink,
			requiresSignIn: !signedIn
		}
	].filter(Boolean);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		function onPointerDown(event) {
			const target = event.target;
			if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
			setOpen(false);
		}
		function onKeyDown(event) {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
				triggerRef.current?.focus();
			}
		}
		window.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		(menuRef.current?.querySelector("button:not([disabled])"))?.focus();
	}, [open]);
	if (actions.length === 0) return null;
	function moveFocus(from, delta) {
		const items = Array.from(menuRef.current?.querySelectorAll("button:not([disabled])") ?? []);
		const index = items.indexOf(from);
		if (index === -1) return;
		items[(index + delta + items.length) % items.length]?.focus();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("contents", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			ref: triggerRef,
			type: "button",
			"aria-haspopup": "menu",
			"aria-expanded": open,
			"aria-controls": open ? menuId : void 0,
			"aria-label": "Add to this conversation",
			title: "Add to this conversation",
			onClick: () => setOpen((v) => !v),
			className: cn("inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition", "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", open && "bg-accent text-foreground"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
				className: cn("h-4 w-4 transition-transform duration-200", open && "rotate-45"),
				"aria-hidden": true
			})
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: menuRef,
			id: menuId,
			role: "menu",
			"aria-label": "Add to this conversation",
			className: cn("absolute bottom-full left-0 z-50 mb-2 w-64 origin-bottom-left overflow-hidden rounded-xl", "border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur", "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-1"),
			children: [gated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[13px] font-medium text-foreground",
						children: ["Sign in to ", gated]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[11.5px] leading-snug text-muted-foreground",
						children: "Text chat stays open for the whole demo."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/auth",
							className: "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: "Sign in"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setGated(null),
							className: "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
								className: "h-3 w-3",
								"aria-hidden": true
							}), "Back"]
						})]
					})
				]
			}) : null, !gated && actions.map((action) => {
				const Icon = action.icon;
				const disabled = Boolean(action.disabledReason);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "menuitem",
					disabled,
					title: action.disabledReason ?? void 0,
					onClick: () => {
						if (action.requiresSignIn) {
							setGated(action.label.toLowerCase());
							return;
						}
						setOpen(false);
						action.onSelect();
					},
					onKeyDown: (event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							moveFocus(event.currentTarget, 1);
						} else if (event.key === "ArrowUp") {
							event.preventDefault();
							moveFocus(event.currentTarget, -1);
						}
					},
					className: cn("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", disabled ? "cursor-not-allowed opacity-55" : "hover:bg-accent focus-visible:bg-accent"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[13px] font-medium text-foreground",
							children: action.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[11.5px] leading-snug text-muted-foreground",
							children: action.disabledReason ?? (action.requiresSignIn ? "Needs an account" : action.hint)
						})]
					})]
				}, action.id);
			})]
		}) : null]
	});
}
/**
* The microphone.
*
* FOUR STATES, FOUR APPEARANCES, and the difference matters because a
* microphone that looks identical whether or not it is recording is the single
* most alarming control a product can ship:
*
*   unsupported — struck through, disabled, with the reason on hover.
*   idle        — plain.
*   listening   — a live ring, so "the microphone is open" is unmistakable.
*   hearing     — the ring animates, because words are arriving.
*
* The ring is drawn rather than animated with a shadow so it stays visible
* under `prefers-reduced-motion`, where the pulse is dropped but the ring is
* not. Losing the recording indicator to a motion preference would be a
* privacy failure dressed as an accessibility feature.
*/
function DictateButton({ state, supported, error, onToggle, languageLabel, className }) {
	const active = state === "listening" || state === "hearing";
	const title = !supported ? "This browser has no speech input. Chrome, Edge and Safari support it." : error ? error : active ? `Listening in ${languageLabel} — click to stop` : `Dictate in ${languageLabel}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onToggle,
		disabled: !supported,
		"aria-label": active ? "Stop dictating" : "Dictate a message",
		"aria-pressed": active,
		title,
		className: cn("relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !supported && "cursor-not-allowed text-muted-foreground/40", supported && !active && "text-muted-foreground hover:bg-accent hover:text-foreground", active && "bg-[color:var(--state-danger)]/12 text-[color:var(--state-danger)]", className),
		children: [!supported ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MicOff, {
			className: "h-4 w-4",
			"aria-hidden": true
		}) : state === "hearing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
			className: "h-4 w-4 motion-safe:animate-spin",
			"aria-hidden": true
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, {
			className: "h-4 w-4",
			"aria-hidden": true
		}), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[color:var(--state-danger)]/60",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[color:var(--state-danger)]/40 motion-safe:animate-ping",
			"aria-hidden": true
		})] }) : null]
	});
}
var MAX_ROWS_PX = 200;
function ChatComposer({ value, onChange, onSubmit, onStop, streaming = false, disabled = false, placeholder, attachments = [], onAddFiles, onRemoveAttachment, imageDisabledReason, engine, onOpenEngineSettings, sendKey = "enter", onNewChat, onAddLink, signedIn = true, dictation, onTypingStarted, children }) {
	const textareaRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const imageRef = (0, import_react.useRef)(null);
	const typedOnce = (0, import_react.useRef)(false);
	const [focused, setFocused] = (0, import_react.useState)(false);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const dragDepth = (0, import_react.useRef)(0);
	const acceptDropped = (files) => {
		if (!acceptsFiles({
			hasHandler: !!onAddFiles,
			disabled,
			streaming,
			fileCount: files?.length ?? 0
		})) return;
		onAddFiles(files, false);
	};
	(0, import_react.useEffect)(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
	}, [value]);
	const canSend = !disabled && !streaming && (value.trim().length > 0 || attachments.length > 0);
	const hint = sendKey === "mod_enter" ? "Ctrl+Enter to send · Enter for a new line" : "Enter to send · Shift+Enter for a new line";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6",
		children: [
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				"data-testid": "composer-dropzone",
				className: cn("relative rounded-2xl border bg-card/80 shadow-sm backdrop-blur transition", focused ? "border-[color:var(--accent-ocade)]/50 shadow-md" : "border-border/70", dragging && "border-primary/70"),
				onDragEnter: (e) => {
					if (!onAddFiles || !dragCarriesFiles(e.dataTransfer?.types)) return;
					e.preventDefault();
					dragDepth.current = dragDepthAfter(dragDepth.current, "enter");
					setDragging(true);
				},
				onDragOver: (e) => {
					if (!onAddFiles || !dragCarriesFiles(e.dataTransfer?.types)) return;
					e.preventDefault();
					e.dataTransfer.dropEffect = "copy";
				},
				onDragLeave: () => {
					dragDepth.current = dragDepthAfter(dragDepth.current, "leave");
					if (dragDepth.current === 0) setDragging(false);
				},
				onDrop: (e) => {
					if (!onAddFiles) return;
					e.preventDefault();
					dragDepth.current = dragDepthAfter(dragDepth.current, "drop");
					setDragging(false);
					acceptDropped(e.dataTransfer?.files ?? null);
				},
				children: [
					dragging ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/70 bg-background/85 text-[13px] font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, {
							className: "mr-2 h-4 w-4",
							"aria-hidden": true
						}), "Drop to attach — read on this device"]
					}) : null,
					attachments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-wrap gap-2 border-b border-border/60 p-2.5",
						children: attachments.map((a, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "group relative inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 py-1 pl-2 pr-1.5 text-[12px]",
							children: [
								a.kind === "image" && a.dataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: a.dataUrl,
									alt: "",
									className: "h-6 w-6 rounded object-cover"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {
									className: "h-3.5 w-3.5 shrink-0 text-muted-foreground",
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-foreground",
									children: a.name
								}),
								onRemoveAttachment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => onRemoveAttachment(index),
									"aria-label": `Remove ${a.name}`,
									className: "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3" })
								}) : null
							]
						}, `${a.name}-${index}`))
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "ocade-composer",
						className: "sr-only",
						children: "Message OCADE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						id: "ocade-composer",
						ref: textareaRef,
						value,
						rows: 1,
						disabled,
						placeholder: placeholder ?? "Message OCADE…",
						onFocus: () => setFocused(true),
						onBlur: () => setFocused(false),
						onChange: (e) => {
							onChange(e.target.value);
							if (!typedOnce.current) {
								typedOnce.current = true;
								onTypingStarted?.();
							}
						},
						onPaste: (e) => {
							const files = e.clipboardData?.files;
							if (!files || files.length === 0) return;
							e.preventDefault();
							acceptDropped(files);
						},
						onKeyDown: (e) => {
							if (e.key !== "Enter") return;
							if (sendKey === "mod_enter") {
								if (e.ctrlKey || e.metaKey) {
									e.preventDefault();
									if (canSend) onSubmit();
								}
								return;
							}
							if (!e.shiftKey) {
								e.preventDefault();
								if (canSend) onSubmit();
							}
						},
						className: "max-h-[200px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 px-2 pb-2",
						children: [
							onAddFiles ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: fileRef,
									type: "file",
									multiple: true,
									className: "sr-only",
									"aria-label": "Attach files",
									onChange: (e) => {
										onAddFiles(e.target.files, false);
										e.target.value = "";
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: imageRef,
									type: "file",
									accept: "image/*",
									multiple: true,
									className: "sr-only",
									"aria-label": "Attach images",
									onChange: (e) => {
										onAddFiles(e.target.files, true);
										e.target.value = "";
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComposerMenu, {
									onNewChat,
									onUploadFile: () => fileRef.current?.click(),
									onUploadImage: () => imageRef.current?.click(),
									onAddLink,
									imageDisabledReason,
									signedIn
								})
							] }) : null,
							dictation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DictateButton, {
								state: dictation.state,
								supported: dictation.supported,
								error: dictation.error,
								onToggle: dictation.toggle,
								languageLabel: dictation.languageLabel
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mx-1 min-w-0 flex-1",
								children: engine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineBadge, {
									status: engine,
									onClick: onOpenEngineSettings
								}) : null
							}),
							streaming && onStop ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: onStop,
								"aria-label": "Stop generating",
								className: "inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-[13px] font-medium text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
									className: "h-3.5 w-3.5 fill-current",
									"aria-hidden": true
								}), "Stop"]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onSubmit,
								disabled: !canSend,
								"aria-label": "Send message",
								title: canSend ? "Send message" : "Write a message first",
								className: cn("inline-flex h-9 w-9 items-center justify-center rounded-xl transition", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", canSend ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-4 w-4" })
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-center text-[11px] text-muted-foreground",
				children: hint
			})
		]
	});
}
var DEFAULT_SUGGESTIONS = [
	{
		label: "Explain this error",
		prompt: "Explain this error message and the most likely cause:\n\n",
		hint: "Paste a stack trace"
	},
	{
		label: "Summarise a document",
		prompt: "Summarise the attached document in five bullet points, then list anything that needs a decision.",
		hint: "Attach a file first"
	},
	{
		label: "Read a screenshot",
		prompt: "Read this screenshot and tell me exactly what it says.",
		hint: "Attach an image"
	},
	{
		label: "Draft a reply",
		prompt: "Draft a short, direct reply to this message. Keep it friendly and under 120 words:\n\n"
	}
];
function ChatEmptyState({ greeting, suggestions = DEFAULT_SUGGESTIONS, onPick, privacyLine, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]",
				children: greeting ?? "What can OCADE do for you?"
			}),
			privacyLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-md text-balance text-[13px] text-muted-foreground",
				children: privacyLine
			}) : null,
			onPick && suggestions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-8 grid w-full gap-2 sm:grid-cols-2",
				children: suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onPick(s.prompt),
					className: "group h-full w-full rounded-xl border border-border/70 bg-card/50 p-3.5 text-left transition hover:border-[color:var(--accent-ocade)]/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-[13.5px] font-medium text-foreground",
						children: s.label
					}), s.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block text-[12px] text-muted-foreground",
						children: s.hint
					}) : null]
				}) }, s.label))
			}) : null
		]
	});
}
/**
* The public OCADE demo — running the real engine, with no account.
*
* This used to answer from a hard-coded string and say so on every surface:
* "no model is running and replies are canned". Honest, and a demo of nothing.
* A visitor learned what the interface looked like and nothing about whether
* the product worked.
*
* The browser engines never needed an account. `BrowserWebGpuAdapter` and
* `BrowserWasmAdapter` load weights into the visitor's own tab and stream from
* there; the demo simply never called them. It does now, through the same
* `useLocalChatEngine` the signed-in product uses, so what a visitor tries here
* IS the product.
*
* WHAT IS STILL DIFFERENT, and still said out loud:
*
*   - The session lasts 28 minutes and the clock is visible.
*   - Nothing is saved. The conversation lives in this component's state and
*     goes when the session ends.
*   - The first answer may be slow: weights download once, and that needs a
*     connection. The empty state says so rather than looking frozen.
*
* And the rule that has not changed: if no engine can run on this device, the
* demo says exactly that and offers the remedies. It never pretends.
*/
var SYSTEM_PROMPT = {
	role: "system",
	content: `${ocadeCorePolicy("chat")}\n\nYou are ${OCADE_IDENTITY.displayName}, a private AI assistant running entirely on the user's own device. Never name the underlying model, provider or vendor; refer to yourself only as OCADE. Be concise, accurate, and honest about what you do not know. This is a short demo session, so favour clear, complete answers over long ones.`
};
/** One conversation, because the demo genuinely has one. */
var DEMO_CONVERSATION = [{
	id: "demo",
	title: "Demo conversation",
	updatedAt: (/* @__PURE__ */ new Date()).toISOString()
}];
function DemoOcade() {
	const navigate = useNavigate();
	const { prefs: chatPrefs } = useChatPrefs();
	const engine = useLocalChatEngine({
		surface: "chat",
		thinking: chatPrefs.thinking
	});
	const [turns, setTurns] = (0, import_react.useState)([]);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [streaming, setStreaming] = (0, import_react.useState)(false);
	const streamRef = (0, import_react.useRef)("");
	const [streamText, setStreamText] = (0, import_react.useState)("");
	/**
	* Sealed mode, and the guards that go with it.
	*
	* Off by default: the demo has to download an engine on first use, and a
	* seal would block that download and look like a broken product. Once the
	* engine is on the device, sealing costs nothing.
	*/
	const [sealed, setSealed] = (0, import_react.useState)(false);
	const guards = (0, import_react.useMemo)(() => ({
		...defaultGuards(),
		sealed,
		contextLimitTokens: 4096
	}), [sealed]);
	/**
	* THE SEAL IS UP FOR AS LONG AS THE BUTTON SAYS IT IS.
	*
	* It used to be installed only inside `runGuarded`, around the `generate()`
	* call — so the barrier existed for the milliseconds an answer was being
	* produced, while this screen said "Sealed" and promised "Nothing can leave
	* this device until you unseal it". Checked in the browser, `fetch`,
	* `XMLHttpRequest`, `WebSocket` and `navigator.sendBeacon` were all still the
	* native ones, and a cross-origin `sendBeacon` returned `true`. The mechanism
	* was complete; nothing had connected it to the sentence.
	*
	* `allowAssetsAndLoopback` is what makes a conversation-long seal survivable:
	* route chunks and the on-device engine on `localhost` still work, and
	* everything capable of carrying the conversation off the machine does not.
	* `runGuarded` still installs its own stricter seal for the send itself, and
	* overlapping seals intersect, so that window stays as tight as it ever was.
	*/
	(0, import_react.useEffect)(() => installConversationSeal(sealed, (allow) => new Seal(void 0, allow), typeof window === "undefined" ? void 0 : window.location.origin), [sealed]);
	/** The hash chain, in a ref because it is appended to inside a callback. */
	const ledgerRef = (0, import_react.useRef)([]);
	/** Branching history: what else was tried, kept alongside the hash chain. */
	const treeRef = (0, import_react.useRef)(emptyTree());
	const [costs, setCosts] = (0, import_react.useState)([]);
	/**
	* Bumped whenever the chain or tree changes.
	*
	* Both live in refs, which do not trigger a render. Without this the
	* integrity panel would show a verdict for a conversation two turns behind —
	* a stale "intact" being exactly the wrong thing to be confidently wrong
	* about.
	*/
	const [ledgerVersion, setLedgerVersion] = (0, import_react.useState)(0);
	(0, import_react.useMemo)(() => turns.map((t) => t.content), [turns]);
	const language = (0, import_react.useMemo)(() => {
		const fallback = LANGUAGE_CANDIDATES[0];
		if (typeof navigator === "undefined") return fallback;
		const primary = (navigator.language ?? "en").toLowerCase().split(/[-_]/)[0];
		return LANGUAGE_CANDIDATES.find((c) => c.code === primary) ?? fallback;
	}, []);
	const dictation = useDictation({
		lang: language.preferredTag,
		onTranscript: (text) => setDraft(text)
	});
	/**
	* Clear the conversation, INCLUDING its record.
	*
	* The chain, the tree and the cost tally all describe the turns being
	* discarded. Leaving any of them behind would leave the integrity panel
	* verifying a conversation that is no longer on screen and reporting it
	* intact — a confident claim about something that no longer exists, which is
	* worse than no claim at all.
	*/
	const resetConversation = (0, import_react.useCallback)(() => {
		engine.stop();
		setStreaming(false);
		setStreamText("");
		streamRef.current = "";
		setTurns([]);
		setDraft("");
		ledgerRef.current = [];
		treeRef.current = emptyTree();
		setCosts([]);
		setLedgerVersion((v) => v + 1);
	}, [engine]);
	const { session } = useDemoSession({
		autoStart: true,
		onWarn: (state) => {
			toast.warning(warningMessage(state.remainingMs), { duration: 1e4 });
		},
		onExpire: (0, import_react.useCallback)(() => {
			engine.stop();
			setStreaming(false);
			setStreamText("");
			streamRef.current = "";
			setTurns([]);
			ledgerRef.current = [];
			treeRef.current = emptyTree();
			setCosts([]);
			setLedgerVersion((v) => v + 1);
			toast.info("Your 28-minute demo has ended. Nothing was saved.", {
				description: "Sign in with Google, phone OTP or email OTP to continue and keep your work.",
				duration: 8e3
			});
			navigate({
				to: "/auth",
				search: {
					next: "/home",
					message: "Your 28-minute demo ended. Sign in to continue."
				},
				replace: true
			});
		}, [engine, navigate]),
		onBlocked: (nextEligibleAt) => {
			navigate({
				to: "/auth",
				search: {
					next: "/home",
					message: `This browser's demo resets in ${formatResetRemaining(nextEligibleAt, Date.now())}. Sign in to continue now.`
				},
				replace: true
			});
		}
	});
	const check = engine.check;
	(0, import_react.useEffect)(() => {
		check();
	}, [check]);
	const engineStatus = (0, import_react.useMemo)(() => {
		if (engine.state.status === "unavailable") return {
			locality: "unknown",
			label: "No on-device engine",
			online: true,
			detail: engine.state.reason ?? "OCADE cannot run on this device."
		};
		if (engine.state.status === "checking" || engine.state.status === "idle") return {
			locality: "unknown",
			label: "Checking this device…",
			online: true,
			detail: "OCADE is working out which engine this browser can run."
		};
		return {
			locality: "local",
			label: engine.state.label ?? "OCADE Local",
			online: true,
			detail: "Running in this browser. Nothing you type leaves your device."
		};
	}, [engine.state]);
	const messages = (0, import_react.useMemo)(() => {
		const rendered = turns.map((t) => ({
			id: t.id,
			role: t.role,
			content: t.content,
			createdAt: t.createdAt,
			engineLabel: t.engineLabel
		}));
		if (streaming) rendered.push({
			id: "streaming",
			role: "assistant",
			content: streamText,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			engineLabel: engine.state.label ?? void 0
		});
		return rendered;
	}, [
		turns,
		streaming,
		streamText,
		engine.state.label
	]);
	/**
	* Ask the same question again and compare.
	*
	* The comparison is only meaningful because both runs name the same engine
	* file. A cloud assistant cannot offer this: its weights change without
	* notice, so a re-run compares two unknowns and any difference is
	* uninterpretable.
	*/
	const rerun = (0, import_react.useCallback)(async (answerId) => {
		if (streaming) return;
		const index = turns.findIndex((t) => t.id === answerId);
		const original = turns[index];
		const question = turns[index - 1];
		if (!original || question?.role !== "user") return;
		const history = [
			SYSTEM_PROMPT,
			...turns.slice(0, index - 1).map((t) => ({
				role: t.role,
				content: t.content
			})),
			{
				role: "user",
				content: question.content
			}
		];
		setStreaming(true);
		streamRef.current = "";
		setStreamText("");
		const outcome = await runGuarded({
			prompt: question.content,
			chain: ledgerRef.current,
			guards,
			engineLabel: engine.state.label ?? "OCADE Local",
			modelKey: engine.state.label ?? "local",
			modelSha256: "",
			temperature: .2,
			topP: .9,
			backend: "browser",
			messageId: `${answerId}-rerun`,
			generate: async () => {
				await engine.send({
					messages: history,
					onToken: (chunk) => {
						streamRef.current += chunk;
						setStreamText(streamRef.current);
					}
				});
				return streamRef.current;
			}
		});
		setStreaming(false);
		setStreamText("");
		streamRef.current = "";
		if (!outcome.answer.trim()) return;
		const verdict = original.pinned ? compareRuns(original.pinned, outcome.pinned) : compareRuns(outcome.pinned, outcome.pinned);
		setTurns((prev) => prev.map((t) => t.id === answerId ? {
			...t,
			rerun: {
				answer: outcome.answer,
				verdict,
				receipt: outcome.receipt
			}
		} : t));
	}, [
		turns,
		streaming,
		engine,
		guards
	]);
	const send = (0, import_react.useCallback)(async () => {
		const text = draft.trim();
		if (!text || streaming) return;
		const userTurn = {
			id: `u-${Date.now()}`,
			role: "user",
			content: text,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		const history = [
			SYSTEM_PROMPT,
			...turns.map((t) => ({
				role: t.role,
				content: t.content
			})),
			{
				role: "user",
				content: text
			}
		];
		const prepared = prepareSend({
			text,
			items: [
				{
					id: "system",
					label: "OCADE instructions",
					kind: "system",
					tokens: 120,
					priority: 100,
					pinned: true
				},
				...turns.map((t) => ({
					id: t.id,
					label: t.role === "user" ? "your message" : "an earlier answer",
					kind: "turn",
					tokens: estimateTokens(t.content),
					priority: 5
				})),
				{
					id: "question",
					label: "your question",
					kind: "turn",
					tokens: estimateTokens(text),
					priority: 100,
					pinned: true
				}
			],
			guards
		});
		if (!prepared.proceed) {
			toast.error(prepared.blockedReason ?? "This message was not sent.", {
				description: prepared.findings.map((f) => f.explain)[0],
				duration: 9e3
			});
			return;
		}
		setTurns((prev) => [...prev, userTurn]);
		setDraft("");
		setStreaming(true);
		streamRef.current = "";
		setStreamText("");
		treeRef.current = recordTurn(treeRef.current, {
			id: userTurn.id,
			role: "user",
			content: text,
			at: /* @__PURE__ */ new Date()
		}).tree;
		ledgerRef.current = [...ledgerRef.current, await append(ledgerRef.current, {
			role: "user",
			content: text,
			at: /* @__PURE__ */ new Date()
		})];
		setLedgerVersion((v) => v + 1);
		const answerId = `a-${Date.now()}`;
		const outcome = await runGuarded({
			prompt: text,
			chain: ledgerRef.current,
			guards,
			engineLabel: engine.state.label ?? "OCADE Local",
			modelKey: engine.state.label ?? "local",
			modelSha256: "",
			temperature: .2,
			topP: .9,
			backend: "browser",
			messageId: answerId,
			generate: async () => {
				await engine.send({
					messages: history,
					onToken: (chunk) => {
						streamRef.current += chunk;
						setStreamText(streamRef.current);
					}
				});
				return streamRef.current;
			}
		});
		const produced = outcome.answer;
		setStreaming(false);
		setStreamText("");
		streamRef.current = "";
		if (produced.trim()) {
			ledgerRef.current = [...ledgerRef.current, outcome.entry];
			treeRef.current = recordTurn(treeRef.current, {
				id: answerId,
				role: "assistant",
				content: produced,
				at: /* @__PURE__ */ new Date()
			}).tree;
			setLedgerVersion((v) => v + 1);
			setCosts((prev) => [...prev, outcome.cost]);
			setTurns((prev) => [...prev, {
				id: answerId,
				role: "assistant",
				content: produced,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				engineLabel: engine.state.label ?? void 0,
				receipt: outcome.receipt,
				truncation: prepared.truncation,
				pinned: outcome.pinned
			}]);
			return;
		}
		if (engine.state.status === "unavailable" && engine.state.reason) toast.error(engine.state.reason);
	}, [
		draft,
		streaming,
		turns,
		engine,
		guards
	]);
	const unavailable = engine.state.status === "unavailable";
	const canStartSeal = turns.some((turn) => turn.role === "assistant" && turn.content.trim().length > 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatShell, {
		sidebar: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatSidebar, {
			conversations: DEMO_CONVERSATION,
			activeId: "demo",
			onNewChat: resetConversation,
			emptyLabel: "This conversation is temporary.",
			primaryAction: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoControlNav, { active: "chat" }),
			footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoSidebarNav, { active: "chat" })
		}),
		header: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate text-[14px] font-medium text-foreground",
					children: "Demo conversation"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						if (!sealed && !canStartSeal) return;
						setSealed((v) => !v);
						toast.info(sealed ? "Conversation unsealed. OCADE can reach the network again." : "Conversation sealed. Nothing can leave this device until you unseal it.");
					},
					disabled: !sealed && !canStartSeal,
					title: sealed || canStartSeal ? void 0 : "Send one message first so OCADE can finish preparing its local engine.",
					"aria-pressed": sealed,
					className: cn("ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] transition", sealed ? "border-[color:var(--state-success)]/50 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]" : canStartSeal ? "border-border/60 text-muted-foreground hover:bg-accent" : "cursor-not-allowed border-border/40 text-muted-foreground/55"),
					children: [sealed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
						className: "h-3 w-3",
						"aria-hidden": true
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockOpen, {
						className: "h-3 w-3",
						"aria-hidden": true
					}), sealed ? "Sealed" : "Seal"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoSessionBadge, {
					session,
					className: "shrink-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineBadge, {
					status: engineStatus,
					className: "shrink-0"
				})
			]
		}),
		banner: unavailable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 px-3.5 py-2.5 text-[12.5px] text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium text-foreground",
					children: "OCADE cannot run on this device."
				}),
				" ",
				engine.state.reason,
				engine.state.remedies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-1",
					children: engine.state.remedies.map((r) => engine.remedyLabel(r)).join(" · ")
				}) : null
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl border border-border/60 bg-secondary/25 px-3.5 py-2.5 text-[12.5px] text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium text-foreground",
					children: "This is the real OCADE."
				}),
				" It runs in this browser, on your device. The conversation is temporary and is not saved.",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/auth",
					className: "text-primary underline underline-offset-4",
					children: "Create an account"
				}),
				" ",
				"to keep your work."
			]
		}),
		composer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [costs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-1.5 px-1 text-[11px] leading-relaxed text-muted-foreground",
			children: describeTotals(total(costs))
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatComposer, {
			value: draft,
			onChange: setDraft,
			onSubmit: () => void send(),
			onStop: streaming ? () => {
				engine.stop();
				setStreaming(false);
				setStreamText("");
				streamRef.current = "";
			} : void 0,
			onNewChat: resetConversation,
			signedIn: false,
			onAddFiles: () => {
				toast.info("Attachments need an account.", { description: "Create one to read documents privately on your own device." });
			},
			dictation: {
				state: dictation.state,
				supported: dictation.supported,
				error: dictation.error,
				toggle: dictation.toggle,
				languageLabel: language.nativeLabel
			},
			onTypingStarted: engine.warm,
			streaming,
			disabled: unavailable,
			engine: engineStatus,
			placeholder: unavailable ? "OCADE cannot run on this device." : "Ask OCADE anything…",
			imageDisabledReason: "Attachments are available once you create an account.",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreparationStatus, {})
		})] }),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageList, {
			messages,
			renderFooter: (message) => {
				const turn = turns.find((t) => t.id === message.id);
				if (!turn?.receipt) return null;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pl-1",
					children: [turn.truncation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/5 px-2 py-1 text-[11.5px] text-foreground",
						children: turn.truncation
					}) : null, turn.rerun ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnswerDiff, {
						before: turn.content,
						after: turn.rerun.answer,
						verdict: turn.rerun.verdict,
						className: "mt-1.5"
					}) : null]
				});
			},
			actions: {
				onCopy: () => {},
				onRegenerate: (m) => m.id === turns.at(-1)?.id && m.role === "assistant" ? void rerun(m.id) : void 0
			},
			emptyState: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatEmptyState, {
				greeting: "OCADE, running on your device.",
				privacyLine: unavailable ? "This browser cannot run an on-device engine, so OCADE has nothing to answer with here." : "Nothing you type leaves this computer. The first answer may take a moment while OCADE prepares — that happens once.",
				onPick: setDraft
			})
		})
	});
}
//#endregion
export { DemoOcade as component };
