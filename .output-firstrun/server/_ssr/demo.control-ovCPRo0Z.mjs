import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { l as warningMessage, r as formatResetRemaining } from "./session-CBMwV_c3.mjs";
import { l as stopAllLocalMissionsFn } from "./execute-DC2ZA7Xg.mjs";
import { t as ChatSidebar } from "./ChatSidebar-BRmHqYxd.mjs";
import { n as useMissionBrain, t as ControlWorkPanel } from "./use-mission-brain-Bv4mIVZw.mjs";
import { a as useDemoSession, i as DemoSidebarNav, n as DemoControlNav, r as DemoSessionBadge, t as ChatShell } from "./use-demo-session-BwnVOsZH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/demo.control-ovCPRo0Z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* PC control, in the demo, with no account.
*
* WHY THIS EXISTS AND WHY IT IS NOT RECKLESS
* -------------------------------------------
* The whole claim of this product is that OCADE can work your computer. A demo
* that shows a chat window and asks you to sign up to find out whether the
* claim is true is a demo of a text box. So this is the real thing: the same
* agent loop, the same tools, the same verification.
*
* It is safe for exactly one reason, and it is not a UI reason. The server only
* grants unauthenticated control when the browser and the server are the same
* machine — see `control-access.node.ts`. On a hosted deployment this screen
* loads and then says it cannot reach a computer, which is the truth. Nothing
* here can talk it into anything else, because the decision is not made here.
*
* WHEN THE CLOCK RUNS OUT, THE COMPUTER IS HANDED BACK FIRST.
* The demo ending while OCADE is mid-task is the case that matters most: the
* expiry path stops the mission, releases any held key or mouse button, and
* only then clears the session and leaves. An expiry that navigated away first
* would leave a Python host and possibly a browser running on somebody's
* machine, with Shift held down, and no interface left to fix it from.
*/
function DemoControlWork() {
	const navigate = useNavigate();
	const { brain, warm } = useMissionBrain();
	(0, import_react.useEffect)(() => {
		warm();
	}, [warm]);
	const endedRef = (0, import_react.useRef)(false);
	const finish = (0, import_react.useCallback)(async () => {
		if (endedRef.current) return;
		endedRef.current = true;
		try {
			await stopAllLocalMissionsFn({ data: { reason: "The demo session ended." } });
		} catch {}
		toast.info("Your 28-minute demo has ended. Nothing was saved.", {
			description: "OCADE stopped local control. Sign in to continue.",
			duration: 9e3
		});
		navigate({
			to: "/auth",
			search: {
				next: "/home",
				message: "Your 28-minute demo ended. Sign in to continue."
			},
			replace: true
		});
	}, [navigate]);
	const { session } = useDemoSession({
		autoStart: true,
		onWarn: (state) => toast.warning(warningMessage(state.remainingMs), { duration: 1e4 }),
		onExpire: () => void finish(),
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
	(0, import_react.useEffect)(() => {
		return () => {
			stopAllLocalMissionsFn({ data: { reason: "The user left Control + Work." } }).catch(() => void 0);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatShell, {
		sidebarLabel: "Demo",
		sidebar: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatSidebar, {
			conversations: [],
			activeId: null,
			onNewChat: () => void navigate({ to: "/demo/ocade" }),
			emptyLabel: "This session is temporary.",
			primaryAction: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoControlNav, { active: "control" }),
			footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoSidebarNav, { active: "control" })
		}),
		header: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-[14px] font-medium text-foreground",
						children: "OCADE Control + Work"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-[11px] text-muted-foreground",
						children: "8-domain command constellation · 28 live objects"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoSessionBadge, {
					session,
					className: "shrink-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/demo/ocade",
					className: "shrink-0 rounded-full border border-border/60 px-3 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: "Chat"
				})
			]
		}),
		composer: null,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-full min-h-0 overflow-hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlWorkPanel, {
				brain,
				headerNote: "No account · this computer only · nothing is saved"
			})
		})
	});
}
//#endregion
export { DemoControlWork as component };
