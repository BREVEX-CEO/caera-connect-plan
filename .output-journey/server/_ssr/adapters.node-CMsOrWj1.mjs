import { i as ok, t as fail } from "./outcomes-wNfoXf5Q.mjs";
import { spawn } from "node:child_process";
//#region node_modules/.nitro/vite/services/ssr/assets/adapters.node-CMsOrWj1.js
/**
* One supervised stdio host, talked to safely. Node-only.
*
* WHY A SHARED CLIENT
* -------------------
* OCADE now runs two sidecars with the same contract — the Playwright browser
* host (`native/browser-host/index.mjs`) and the Python native-control host
* (`native/python-host/ocade_host`). They speak newline-delimited JSON, one
* bounded reply per request, no listening socket. Writing the client twice
* would mean two places to get request pairing, timeouts and process death
* wrong, and those are exactly the bugs that present as "OCADE hangs".
*
* THREE THINGS THIS GUARANTEES
*
* 1. **A request always settles.** Every call carries a deadline. A sidecar
*    that dies, wedges or answers nothing rejects with a sentence rather than
*    leaving an agent loop waiting on a promise that will never resolve.
* 2. **Replies cannot be mismatched.** Requests are queued in order and each
*    reply is handed to the oldest waiter. A crash rejects every outstanding
*    caller instead of silently pairing the next reply with the wrong request.
* 3. **The child never outlives its purpose.** `dispose()` closes stdin and
*    kills the process, and the same happens automatically when the parent
*    exits — an orphaned Python or Chrome process holding a camera, a profile
*    or a file lock is a real cost to the person whose computer it is.
*/
var DEFAULT_TIMEOUT_MS = 3e4;
var NativeHostClient = class {
	options;
	child = null;
	buffer = "";
	waiters = /* @__PURE__ */ new Map();
	nextId = 0;
	closedReason = null;
	constructor(options) {
		this.options = options;
	}
	ensure() {
		if (this.child && !this.child.killed) return this.child;
		if (this.closedReason) throw new Error(this.closedReason);
		const child = spawn(this.options.command, this.options.args, {
			cwd: this.options.cwd,
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			],
			shell: false
		});
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => this.consume(chunk));
		child.on("exit", (code) => this.fail(`${this.options.label} stopped unexpectedly (exit ${code}).`));
		child.on("error", (error) => this.fail(`${this.options.label} could not start: ${error.message}`));
		this.child = child;
		return child;
	}
	consume(chunk) {
		this.buffer += chunk;
		let index;
		while ((index = this.buffer.indexOf("\n")) >= 0) {
			const line = this.buffer.slice(0, index).trim();
			this.buffer = this.buffer.slice(index + 1);
			if (!line) continue;
			let reply;
			try {
				reply = JSON.parse(line);
			} catch {
				continue;
			}
			const id = typeof reply.id === "string" ? reply.id : null;
			if (id === null) continue;
			const waiter = this.waiters.get(id);
			if (!waiter) continue;
			this.waiters.delete(id);
			clearTimeout(waiter.timer);
			waiter.resolve(reply);
		}
	}
	fail(reason) {
		this.child = null;
		for (const [id, waiter] of [...this.waiters]) {
			this.waiters.delete(id);
			clearTimeout(waiter.timer);
			waiter.resolve({
				ok: false,
				code: "retryable_failure",
				error: reason
			});
		}
	}
	/**
	* Send a request whose shape the host already defines.
	*
	* The browser host predates this client and takes its fields at the top level
	* (`{version, command, sessionId, action}`) rather than under `payload`. That
	* host is proven and in use, so the client bends to it instead of the other
	* way round — changing a working protocol to suit a new caller is how proven
	* things stop being proven.
	*/
	async raw(body, options) {
		return this.send({
			version: 1,
			...body
		}, options?.timeoutMs);
	}
	async request(command, payload = {}, options) {
		return this.send({
			version: 1,
			command,
			runId: options?.runId ?? "ocade",
			payload
		}, options?.timeoutMs);
	}
	async send(body, timeout) {
		let child;
		try {
			child = this.ensure();
		} catch (error) {
			return {
				ok: false,
				code: "unsupported",
				error: error.message
			};
		}
		const timeoutMs = timeout ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const id = `${++this.nextId}`;
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.waiters.delete(id);
				resolve({
					ok: false,
					code: "retryable_failure",
					error: `${this.options.label} did not answer within ${Math.round(timeoutMs / 1e3)}s.`
				});
			}, timeoutMs);
			this.waiters.set(id, {
				resolve,
				timer
			});
			child.stdin.write(`${JSON.stringify({
				...body,
				id
			})}\n`);
		});
	}
	dispose(reason = "The native host was closed.") {
		this.closedReason = reason;
		this.fail(reason);
		try {
			this.child?.stdin.end();
			this.child?.kill();
		} catch {}
		this.child = null;
	}
};
/**
* The adapters. Where a tool NAME becomes something that happens.
*
* THE BOUNDARY THIS FILE IS
* -------------------------
* Everything above it is a language model's opinion. Everything below it is a
* real computer. So this is where arguments stop being suggestions: each
* adapter re-validates what it was given against its own rules, regardless of
* what the schema said, because a schema describes what a well-behaved caller
* would send and the caller here is a probabilistic text generator.
*
* WHAT NEVER APPEARS BELOW
* ------------------------
* A path the model chose without an approved root. A command string. A raw
* coordinate as a first resort. Anything that looks like a credential. The
* absence of those is not an oversight to be corrected in a later pass — it is
* the design.
*
* OBSERVE-VERIFY IS BUILT IN, NOT BOLTED ON
* -----------------------------------------
* Mutating adapters return `verified` from a real second look: the Python host
* compares a window's visual fingerprint before and after, and the browser host
* re-reads the page URL and title. An adapter that cannot check its own work
* returns `verified: undefined` rather than `true`, because an unchecked claim
* and a confirmed one must never look the same to the loop.
*/
/** Map a host's own refusal code onto the loop's closed outcome set. */
function outcomeFor(reply, fallbackDetail) {
	const detail = reply.error ?? fallbackDetail;
	switch (reply.code) {
		case "blocked": return fail("blocked", detail);
		case "unsupported": return fail("unsupported", detail);
		case "state_changed": return fail("state_changed", detail);
		case "offline": return fail("offline", detail);
		default: return fail("retryable_failure", detail);
	}
}
function text(value, name) {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required and must be text.`);
	return value.trim();
}
/**
* Turn a detected human-verification challenge into a terminal outcome.
*
* `blocked` rather than `retryable_failure`, deliberately: the loop retries
* retryables, and retrying a CAPTCHA is both futile and exactly the behaviour
* that gets a user's address rate-limited. A blocked outcome ends the step and
* puts the next move where it belongs — with the person.
*/
function humanCheckIn(reply) {
	if (!(reply.data?.observation)?.humanCheck?.present) return null;
	return fail("blocked", "That site is asking for human verification, and OCADE does not complete those. Take over in the browser window if you want to continue there, or ask OCADE to try a different source.");
}
var OcadeAdapters = class OcadeAdapters {
	config;
	python = null;
	browser = null;
	engine = null;
	browserSession = null;
	constructor(config) {
		this.config = config;
	}
	pythonHost() {
		this.python ??= new NativeHostClient({
			command: this.config.pythonExecutable,
			args: ["-m", "ocade_host"],
			cwd: this.config.pythonHostDir,
			label: "The computer-control host",
			timeoutMs: 45e3
		});
		return this.python;
	}
	/**
	* The Mark-L control engine, as OCADE's primary executor.
	*
	* PRIMARY, NOT ADDITIONAL. Where the engine implements an action — opening an
	* application, typing into a window, reading one — it is what runs, and the
	* older `ocade_host` path is the fallback for the case where the engine
	* refuses or is not installed. Two executors racing for the same job is how a
	* product ends up with two behaviours for one button.
	*/
	engineHost() {
		this.engine ??= new NativeHostClient({
			command: this.config.pythonExecutable,
			args: [this.config.engineBridgeEntry],
			cwd: this.config.pythonHostDir,
			label: "The control engine",
			timeoutMs: 45e3
		});
		return this.engine;
	}
	/**
	* Run a command on the engine, falling back only on a REFUSAL OR ABSENCE.
	*
	* A failure that means "the engine cannot do this here" falls through to the
	* old path. A failure that means "this did not work" does NOT: retrying the
	* same impossible thing on a second executor produces two error messages
	* instead of one and hides which layer actually broke.
	*/
	async viaEngine(command, payload, timeoutMs) {
		const reply = await this.engineHost().request(command, payload, { timeoutMs });
		if (!reply.ok && reply.code === "unsupported") return null;
		return reply;
	}
	browserHost() {
		this.browser ??= new NativeHostClient({
			command: this.config.nodeExecutable ?? process.execPath,
			args: [this.config.browserHostEntry],
			label: "The managed browser",
			timeoutMs: 6e4
		});
		return this.browser;
	}
	dispose() {
		this.python?.dispose();
		this.browser?.dispose();
		this.engine?.dispose();
		this.python = null;
		this.browser = null;
		this.engine = null;
		this.browserSession = null;
	}
	/**
	* Run one tool.
	*
	* `approvedByPerson` is the caller saying "a human was asked about THIS call
	* and said yes". It is threaded rather than inferred because exactly one tool
	* needs it — `browser_open`, which reaches the user's signed-in sessions —
	* and inferring it from the risk band would mean the guarantee lived in a
	* different file from the code that relies on it. Absent or false is the safe
	* reading everywhere: the browser falls back to a throwaway profile rather
	* than refusing, so an unattended caller still works, just not signed in.
	*/
	async execute(call, signal, approvedByPerson = false) {
		if (signal?.aborted) return fail("cancelled", "The task was stopped before this step ran.");
		const started = Date.now();
		try {
			return {
				...await this.dispatch(call, signal, approvedByPerson),
				elapsedMs: Date.now() - started
			};
		} catch (error) {
			return {
				...fail("retryable_failure", error instanceof Error ? error.message : String(error)),
				elapsedMs: Date.now() - started
			};
		}
	}
	async dispatch(call, signal, approvedByPerson = false) {
		const a = call.arguments ?? {};
		switch (call.name) {
			case "screen_observe": return this.screenObserve(a);
			case "window_list": return this.windowList();
			case "window_focus": return this.windowFocus(a);
			case "folder_item_open": return this.folderItemOpen(a);
			case "folder_open": return this.folderOpen(a);
			case "app_list_installed": return this.installedApps();
			case "app_open": return this.appOpen(a);
			case "app_focus": return this.appFocus(a);
			case "display_list": return this.displayList();
			case "window_arrange": return this.windowArrange(a);
			case "system_status": return this.systemStatus();
			case "office_read": return this.officeRead(a);
			case "office_write": return this.officeWrite(a);
			case "message_draft": return this.messageDraft(a);
			case "whatsapp_open": return this.whatsapp("open", {});
			case "whatsapp_find_contact": return this.whatsapp("find", { contact: text(a.contact, "contact") });
			case "whatsapp_type": return this.whatsapp("type", { message: text(a.message, "message") });
			case "whatsapp_send": return this.whatsapp("send", { message: text(a.message, "message") });
			case "document_read": return this.simple("file.read", {
				folder: text(a.folder, "folder"),
				name: text(a.name, "name")
			}, "That document could not be read.");
			case "setup_status": return this.simple("setup.status", {}, "Setup status is unavailable.");
			case "screen_map": return this.simple("screen.map", {
				windowTitle: typeof a.windowTitle === "string" ? a.windowTitle : void 0,
				includeText: a.includeText === "yes" ? true : a.includeText === "no" ? false : void 0
			}, "The screen could not be mapped.", 45e3);
			case "screen_do": return this.simple("screen.do", {
				id: typeof a.id === "number" ? a.id : Number(a.id),
				action: text(a.action, "action"),
				text: typeof a.text === "string" ? a.text : void 0,
				token: typeof a.token === "string" ? a.token : void 0,
				submit: a.submit === "yes"
			}, "That action was not completed.", 45e3);
			case "file_list": return this.simple("file.list", {
				folder: text(a.folder, "folder"),
				pattern: typeof a.pattern === "string" ? a.pattern : void 0
			}, "That folder could not be listed.");
			case "clipboard_watch": return this.simple("clipboard.watch", {}, "The clipboard could not be checked.");
			case "screen_watch": return this.simple("screen.watch", { action: text(a.action, "action") }, "The screen watcher did not respond.");
			case "message_pending": return this.simple("message.pending", {}, "Drafts could not be listed.");
			case "message_discard": return this.simple("message.discard", { draftId: text(a.draftId, "draftId") }, "That draft was not discarded.");
			case "message_to": return this.messageTo(a);
			case "message_find_contact": return this.messageFindContact(a);
			case "message_send": return this.messageSend(a);
			case "speak": return this.voiceSpeak(a);
			case "listen": return this.voiceListen(a);
			case "screen_find": return this.screenFind(a);
			case "screen_click": return this.screenClick(a);
			case "parallel_search": return this.parallelSearch(a);
			case "screen_type": return this.screenType(a);
			case "screen_act": return this.screenAct(a);
			case "screen_read": return this.screenRead(a);
			case "app_discover": return this.appDiscover(a);
			case "ui_tree": return this.uiTree(a);
			case "ui_act": return this.uiAct(a);
			case "system_volume": return this.systemVolume(a);
			case "system_brightness": return this.systemBrightness(a);
			case "media_control": return this.mediaControl(a);
			case "bluetooth_status": return this.bluetoothStatus();
			case "audio_devices": return this.audioDevices();
			case "control_find": return this.controlFind(a);
			case "control_activate": return this.controlActivate(a);
			case "control_set_text": return this.controlSetText(a);
			case "type_text": return this.typeText(a);
			case "press_key": return this.pressKey(a);
			case "workspace_list": return this.workspaceList(a);
			case "workspace_read": return this.workspaceRead(a);
			case "workspace_write": return this.workspaceWrite(a);
			case "workspace_open": return this.workspaceOpen(a);
			case "workspace_discard": return this.workspaceDiscard(a);
			case "file_search": return this.fileSearch(a);
			case "file_read": return this.fileRead(a);
			case "file_copy": return this.fileCopy(a);
			case "file_move": return this.fileMove(a);
			case "file_trash": return this.fileTrash(a);
			case "file_restore": return this.fileRestore(a);
			case "browser_type": return this.browserType(a);
			case "browser_scroll": return this.browserScroll(a);
			case "browser_key": return this.browserKey(a);
			case "browser_media": return this.browserMedia(a);
			case "introduce": return this.simple("presence.introduce", { tone: typeof a.tone === "string" ? a.tone : "" }, "OCADE could not introduce itself.");
			case "folder_empty": return this.simple("folder.empty", {
				folder: text(a.folder, "folder"),
				inside: typeof a.inside === "string" ? a.inside : void 0,
				includeFolders: a.includeFolders === "yes"
			}, "That folder was not emptied.", 6e4);
			case "browser_skip_ad": return this.browserSkipAd();
			case "browser_open": return this.browserOpen(a, approvedByPerson);
			case "browser_navigate": return this.browserNavigate(a, signal);
			case "browser_read": return this.browserRead();
			case "browser_click": return this.browserClick(a);
			case "browser_tabs": return this.browserTabs();
			case "web_search": return this.webSearch(a);
			case "youtube_play": return this.youtubePlay(a);
			case "youtube_search": return this.youtubeSearch(a);
			case "memory_remember":
			case "memory_recall":
			case "memory_forget":
			case "memory_project":
			case "memory_identity":
			case "memory_preference":
			case "memory_snapshot":
			case "session_summarise":
			case "morning_briefing":
			case "proactive_check":
			case "topic_watch":
			case "topic_check":
			case "language_note": return this.continuity(call.name, a);
			case "system_wifi": return this.simple("system.wifi", { action: a.action ?? "status" }, "The WiFi state could not be read.");
			case "system_power": return this.systemPower(a);
			case "autostart": return this.autostart(a);
			case "clipboard_read": return this.simple("clipboard", {}, "The clipboard could not be read.");
			case "clipboard_write": return this.simple("clipboard", { text: text(a.text, "text") }, "Nothing was copied.");
			case "clipboard_act": return this.simple("clipboard.act", {
				action: text(a.action, "action"),
				...typeof a.language === "string" && a.language.trim() ? { language: a.language } : {}
			}, "The copied text could not be worked on.", 12e4);
			case "engine_status": return this.engineStatus();
			case "folder_create": return this.fileCommand({
				action: "newfolder",
				folder: text(a.folder, "folder"),
				name: text(a.name, "name")
			}, "That folder could not be created.");
			case "file_info": return this.fileCommand({
				action: "info",
				folder: text(a.folder, "folder"),
				path: text(a.path, "path")
			}, "That file could not be read.");
			case "disk_usage": return this.fileCommand({
				action: "disk",
				folder: typeof a.folder === "string" ? a.folder : "home"
			}, "The disk usage could not be read.");
			case "largest_files": return this.fileCommand({
				action: "largest",
				folder: typeof a.folder === "string" ? a.folder : "downloads",
				count: typeof a.count === "number" ? a.count : 10
			}, "The largest files could not be listed.", 6e4);
			case "desktop_organise": return this.fileCommand({ action: "organise" }, "The desktop could not be tidied.", 12e4);
			case "see": return this.see(a);
			case "camera_list": return this.simple("vision.cameras", {}, "The cameras could not be listed.", 3e4);
			case "reminder_set": return this.simple("reminder.set", {
				message: text(a.message, "message"),
				when: text(a.when, "when")
			}, "The reminder could not be scheduled.", 3e4);
			case "reminder_list": return this.simple("reminder.list", {}, "The reminders could not be listed.", 4e4);
			case "reminder_cancel": return this.simple("reminder.cancel", { task: text(a.task, "task") }, "The reminder could not be cancelled.", 3e4);
			case "game_list": return this.simple("game.list", typeof a.launcher === "string" && a.launcher !== "all" ? { launcher: a.launcher } : {}, "The installed games could not be read.", 3e4);
			case "game_update": return this.simple("game.update", {
				...typeof a.game === "string" && a.game.trim() ? { game: a.game } : {},
				...typeof a.launcher === "string" && a.launcher !== "all" ? { launcher: a.launcher } : {}
			}, "The launcher could not be asked to update.", 6e4);
			case "phone_dashboard": return this.phoneDashboard(a);
			case "search_mode": return this.simple("search.mode", {
				query: text(a.query, "query"),
				mode: text(a.mode, "mode")
			}, "The search could not be run.", 4e4);
			case "flight_search": return this.simple("flights", {
				from: text(a.from, "from"),
				to: text(a.to, "to"),
				...typeof a.when === "string" && a.when.trim() ? { when: a.when } : {}
			}, "No flight information could be read.", 45e3);
			case "weather": return this.simple("weather", typeof a.city === "string" && a.city.trim() ? { city: a.city } : {}, "The weather could not be read.", 4e4);
			case "code_review": return this.codeReview(a);
			default: return fail("unsupported", `${call.name} is not connected on this device yet.`);
		}
	}
	/**
	* What OCADE remembers about this person, for the system prompt.
	*
	* PUBLIC, AND SEPARATE FROM THE `memory_*` TOOLS ON PURPOSE. Those are things
	* the MODEL chooses to do. This is something the mission does before the
	* model gets a turn at all, because a model cannot decide to look up context
	* it does not know exists — by the time it could ask, it has already answered
	* the first message as a stranger.
	*
	* Returns null rather than throwing on any failure. A cold memory file, an
	* engine that is not installed and a malformed store all mean the same thing
	* to the caller — carry on without context — and none of them is a reason to
	* refuse to start a mission.
	*/
	async memoryContext() {
		try {
			const reply = await this.viaEngine("memory.context", {}, 1e4);
			if (!reply?.ok || !reply.data) return null;
			return {
				context: reply.data.context ?? "",
				assistantName: reply.data.assistantName ?? "OCADE",
				address: reply.data.address ?? "",
				language: reply.data.language ?? ""
			};
		} catch {
			return null;
		}
	}
	/**
	* The shape shared by every tool that is one engine command and a receipt.
	*
	* WRITTEN ONCE BECAUSE IT WAS ABOUT TO BE WRITTEN TWENTY-FOUR TIMES. Each of
	* these was five near-identical lines — call, null-check, error-map, carry
	* `detail` through — and twenty-four copies of a five-line pattern is twenty-
	* four chances to forget the null check, which is the one that turns "the
	* engine is not installed" into `Cannot read properties of null`.
	*
	* `detail` is carried from the engine rather than composed here, on purpose:
	* the engine is the only layer that knows what it actually observed, and a
	* sentence written at this level would be a guess dressed as a receipt.
	*/
	async simple(command, payload, whenItFails, timeoutMs) {
		const reply = await this.viaEngine(command, payload, timeoutMs);
		if (!reply) return fail("unsupported", `${whenItFails} The control engine is not available.`);
		if (!reply.ok) return outcomeFor(reply, whenItFails);
		return {
			...ok(reply.data, reply.data?.detail ?? "Done."),
			...typeof reply.data?.verified === "boolean" ? { verified: reply.data.verified } : {}
		};
	}
	/**
	* The continuity tools, which are one command each with a name translation.
	*
	* The tool names are what the model sees and the command names are what the
	* bridge answers to; keeping the map in one object rather than one case each
	* means a new continuity tool is one line here and one entry in the registry.
	*/
	async continuity(tool, a) {
		const COMMANDS = {
			memory_remember: "memory.remember",
			memory_recall: "memory.recall",
			memory_forget: "memory.forget",
			memory_project: "memory.project",
			memory_identity: "memory.identity",
			memory_preference: "memory.preference",
			memory_snapshot: "memory.snapshot",
			session_summarise: "session.summarise",
			morning_briefing: "presence.briefing",
			proactive_check: "presence.proactive",
			topic_watch: "monitor.watch",
			topic_check: "monitor.check",
			language_note: "language"
		};
		const payload = {};
		switch (tool) {
			case "memory_remember":
				payload.fact = text(a.fact, "fact");
				if (typeof a.tag === "string" && a.tag.trim()) payload.tag = a.tag;
				break;
			case "memory_recall":
				if (typeof a.query === "string") payload.query = a.query;
				break;
			case "memory_forget":
				payload.query = text(a.query, "query");
				break;
			case "memory_project":
				payload.name = text(a.name, "name");
				if (typeof a.note === "string" && a.note.trim()) payload.note = a.note;
				break;
			case "memory_identity":
				for (const field of [
					"userName",
					"gender",
					"city",
					"language"
				]) if (typeof a[field] === "string" && a[field].trim()) payload[field] = a[field];
				if (typeof a.assistantName === "string") payload.assistantName = a.assistantName;
				break;
			case "memory_preference":
				if (typeof a.key === "string" && a.key.trim() && a.value !== void 0) {
					payload.key = a.key;
					payload.value = String(a.value);
				}
				break;
			case "session_summarise":
				payload.summary = text(a.summary, "summary");
				if (Array.isArray(a.topics)) payload.topics = a.topics.map(String).slice(0, 8);
				break;
			case "morning_briefing":
				payload.news = a.news !== "no";
				break;
			case "proactive_check":
				if (Array.isArray(a.recentTopics)) payload.recentTopics = a.recentTopics.map(String).slice(0, 6);
				break;
			case "topic_watch":
				if (typeof a.topic === "string" && a.topic.trim()) payload.topic = a.topic;
				if (a.stop === "yes") payload.stop = true;
				break;
			case "language_note":
				payload.detected = text(a.detected, "detected");
				break;
			default: break;
		}
		return this.simple(COMMANDS[tool], payload, "OCADE's memory could not be reached.", tool === "morning_briefing" || tool === "topic_check" ? 6e4 : 2e4);
	}
	/**
	* Sleep, lock, shut down or restart.
	*
	* THE CONFIRMATION IS TRANSLATED, NOT INFERRED. The model sends the string
	* `"yes"` because a 3B model handles a string enum far more reliably than a
	* boolean; the engine wants a real `true`. Mapping it here — and mapping
	* ONLY the exact string — means an absent, misspelled or hallucinated value
	* is a refusal rather than a shutdown.
	*/
	async systemPower(a) {
		const action = text(a.action, "action").toLowerCase();
		return this.simple("system.power", {
			action,
			confirmed: a.confirmed === "yes"
		}, "The power action was refused.", 2e4);
	}
	async autostart(a) {
		const payload = a.enable === "yes" ? { enable: true } : a.enable === "no" ? { enable: false } : {};
		return this.simple("system.autostart", payload, "The start-up setting could not be read.");
	}
	/**
	* Look at the screen or the webcam, and carry the picture back with the words.
	*
	* The long timeout is the vision model generating a paragraph rather than a
	* coordinate — measured at fifteen to forty seconds on this hardware. The
	* default 45s budget cut it off often enough to look broken.
	*/
	async see(a) {
		const source = a.source === "webcam" ? "webcam" : "screen";
		return this.simple("vision.look", {
			source,
			...typeof a.question === "string" && a.question.trim() ? { question: a.question } : {},
			...source === "screen" && typeof a.windowTitle === "string" && a.windowTitle.trim() ? { windowTitle: a.windowTitle } : {}
		}, "Nothing could be seen.", 9e4);
	}
	async phoneDashboard(a) {
		const action = typeof a.action === "string" ? a.action.toLowerCase() : "status";
		const command = action === "start" ? "remote.start" : action === "stop" ? "remote.stop" : "remote.status";
		return this.simple(command, {}, "The phone dashboard could not be reached.", 2e4);
	}
	async codeReview(a) {
		const payload = typeof a.folder === "string" && a.folder.trim() ? {
			folder: a.folder,
			name: text(a.name, "name")
		} : { code: text(a.code, "code") };
		if (typeof a.language === "string" && a.language.trim()) payload.language = a.language;
		if (!payload.folder && typeof a.name === "string" && a.name.trim()) payload.name = a.name;
		return this.simple("code.review", payload, "The code could not be analysed.", 3e4);
	}
	/**
	* The answer to "what's on my screen?".
	*
	* Structure first and pixels second, in one call, because the model should
	* not have to know which of three sources happened to work. A window that
	* exposes a rich accessibility tree never pays for OCR; a custom-drawn one
	* falls through to it automatically and the reply says which source answered.
	*/
	async screenObserve(args) {
		const viaEngine = await this.viaEngine("screen.observe", {
			...typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {},
			...args.includeText === "yes" ? { includeText: "yes" } : {}
		});
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "The screen could not be read.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Read the screen."),
				observation: viaEngine.data
			};
		}
		const host = this.pythonHost();
		const wanted = typeof args.windowTitle === "string" ? args.windowTitle.toLowerCase() : null;
		const windows = await host.request("window.list");
		if (!windows.ok) return outcomeFor(windows, "The list of windows could not be read.");
		const list = windows.data?.windows ?? [];
		const active = await host.request("window.active");
		const chosen = wanted ? list.find((w) => w.title.toLowerCase().includes(wanted)) : active.ok ? active.data : list[0];
		if (!chosen) return fail("state_changed", "No matching window is open on this computer right now.");
		const tree = await host.request("accessibility.tree", { hwnd: chosen.hwnd });
		const structural = tree.ok ? tree.data?.count ?? 0 : 0;
		const ocr = structural < 10 || args.includeText === "yes" ? await host.request("screen.ocr", { hwnd: chosen.hwnd }) : null;
		return ok({
			window: chosen,
			openWindows: list.map((w) => ({
				title: w.title,
				application: w.process
			})),
			elements: tree.ok ? tree.data?.elements : [],
			elementCount: structural,
			elementsTruncated: tree.ok ? tree.data?.truncated : false,
			visibleText: ocr?.ok ? ocr.data?.text : null,
			textSource: ocr?.ok ? "ocr" : tree.ok && structural > 0 ? "accessibility" : "none"
		}, `Read the screen: ${chosen.title}. ${structural} interface elements${ocr?.ok ? `, plus ${ocr.data?.lineCount ?? 0} lines of visible text` : ""}.`);
	}
	async windowList() {
		const reply = await this.pythonHost().request("window.list");
		if (!reply.ok) return outcomeFor(reply, "The list of windows could not be read.");
		return ok(reply.data, `${reply.data?.count ?? 0} windows are open.`);
	}
	async installedApps() {
		const reply = await this.pythonHost().request("system.applications");
		if (!reply.ok) return outcomeFor(reply, "The list of installed applications could not be read.");
		return ok(reply.data, `${reply.data?.count ?? 0} applications are installed on this computer.`);
	}
	async systemStatus() {
		const host = this.pythonHost();
		const [snapshot, processes] = await Promise.all([host.request("system.snapshot"), host.request("system.processes", { by: "memory" })]);
		if (!snapshot.ok) return outcomeFor(snapshot, "The system status could not be read.");
		return ok({
			...snapshot.data,
			topProcesses: processes.ok ? processes.data : null
		}, "Read this computer's processor, memory, disk and battery state.");
	}
	async windowFocus(args) {
		const host = this.pythonHost();
		const wanted = text(args.windowTitle, "windowTitle").toLowerCase();
		const windows = await host.request("window.list");
		if (!windows.ok) return outcomeFor(windows, "The list of windows could not be read.");
		const match = (windows.data?.windows ?? []).find((w) => w.title.toLowerCase().includes(wanted));
		if (!match) return fail("state_changed", `No open window has "${args.windowTitle}" in its title.`);
		const reply = await host.request("window.focus", { hwnd: match.hwnd });
		if (!reply.ok) return outcomeFor(reply, "That window could not be brought to the front.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Focused the window."),
			verified: reply.data?.verified
		};
	}
	/**
	* Open an application by NAME, never by path.
	*
	* The host resolves the name against what this machine reports as installed;
	* nothing here hands it a string to execute. That is the whole distinction
	* between an application launcher and remote code execution, and it lives on
	* the host side so this adapter cannot weaken it by accident.
	*/
	async appOpen(args) {
		const name = text(args.name, "name");
		const viaEngine = await this.viaEngine("app.open", { name }, 3e4);
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, `${name} could not be opened.`);
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? `Opened ${name}.`),
				verified: viaEngine.data?.verified,
				observation: viaEngine.data
			};
		}
		const reply = await this.pythonHost().request("app.launch", {
			name,
			reuse: args.reuse !== false
		}, { timeoutMs: 6e4 });
		if (!reply.ok) return outcomeFor(reply, `${name} could not be opened.`);
		return {
			...ok(reply.data, reply.data?.detail ?? `Opened ${name}.`),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async appFocus(args) {
		const name = text(args.name, "name");
		const viaEngine = await this.viaEngine("app.focus", { name });
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "That application could not be brought to the front.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
				verified: viaEngine.data?.verified ?? void 0,
				observation: viaEngine.data
			};
		}
		const reply = await this.pythonHost().request("app.focus", { name });
		if (!reply.ok) return outcomeFor(reply, `${name} could not be brought to the front.`);
		return {
			...ok(reply.data, reply.data?.detail ?? `${name} is now in front.`),
			verified: reply.data?.verified
		};
	}
	async displayList() {
		const reply = await this.pythonHost().request("display.list");
		if (!reply.ok) return outcomeFor(reply, "The displays could not be read.");
		const count = reply.data?.count ?? 0;
		return ok(reply.data, `This computer has ${count} display${count === 1 ? "" : "s"}.`);
	}
	async windowArrange(args) {
		const viaEngine = await this.viaEngine("window.arrange", {
			layout: typeof args.layout === "string" ? args.layout : "maximise",
			...typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {}
		});
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "That window could not be moved.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
				verified: viaEngine.data?.verified ?? void 0,
				observation: viaEngine.data
			};
		}
		const hwnd = await this.resolveWindow(args);
		if (hwnd === null) return fail("state_changed", "That window is not open.");
		const display = Number(args.display);
		const reply = await this.pythonHost().request("window.arrange", {
			hwnd,
			layout: typeof args.layout === "string" ? args.layout : "maximise",
			...Number.isFinite(display) && display > 0 ? { display: Math.trunc(display) } : {}
		});
		if (!reply.ok) return outcomeFor(reply, "That window could not be moved.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Moved the window."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async typeText(args) {
		const viaEngine = await this.viaEngine("input.type", {
			text: text(args.text, "text"),
			...typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {}
		});
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "That text could not be typed.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Typed the text."),
				verified: viaEngine.data?.verified ?? void 0,
				observation: viaEngine.data
			};
		}
		const hwnd = await this.resolveWindow(args);
		const reply = await this.pythonHost().request("input.type", {
			text: text(args.text, "text"),
			...hwnd ? { hwnd } : {}
		});
		if (!reply.ok) return outcomeFor(reply, "That text could not be typed.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Typed the text."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async pressKey(args) {
		const raw = args.modifiers;
		const modifiers = typeof raw === "string" ? raw.split(/[+,\s]+/).map((part) => part.trim().toLowerCase()).filter(Boolean) : Array.isArray(raw) ? raw.map((part) => String(part).toLowerCase()) : [];
		const reply = await this.pythonHost().request("input.key", {
			key: text(args.key, "key"),
			modifiers
		});
		if (!reply.ok) return outcomeFor(reply, "That key could not be pressed.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Pressed the key."),
			verified: reply.data?.verified
		};
	}
	async workspaceList(args) {
		const viaEngine = await this.viaEngine("workspace", { action: "list" });
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "The folder could not be read.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
				verified: viaEngine.data?.verified,
				observation: viaEngine.data
			};
		}
		const reply = await this.pythonHost().request("workspace.list", { match: typeof args.match === "string" ? args.match : "" });
		if (!reply.ok) return outcomeFor(reply, "The folder could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Listed the folder.");
	}
	async workspaceRead(args) {
		const viaEngine = await this.viaEngine("workspace", {
			action: "read",
			name: text(args.name, "name")
		});
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "That file could not be read.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
				verified: viaEngine.data?.verified,
				observation: viaEngine.data
			};
		}
		const reply = await this.pythonHost().request("workspace.read", { name: text(args.name, "name") });
		if (!reply.ok) return outcomeFor(reply, "That file could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Read the file.");
	}
	async workspaceWrite(args) {
		const viaEngine = await this.viaEngine("workspace", {
			action: "write",
			name: text(args.name, "name"),
			content: text(args.content, "content")
		});
		if (viaEngine) {
			if (!viaEngine.ok) return outcomeFor(viaEngine, "That file could not be written.");
			return {
				...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
				verified: viaEngine.data?.verified,
				observation: viaEngine.data
			};
		}
		const reply = await this.pythonHost().request("workspace.write", {
			name: text(args.name, "name"),
			content: text(args.content, "content")
		});
		if (!reply.ok) return outcomeFor(reply, "That file could not be written.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Wrote the file."),
			verified: reply.data?.verified
		};
	}
	async workspaceOpen(args) {
		const reply = await this.pythonHost().request("workspace.open", { name: text(args.name, "name") }, { timeoutMs: 3e4 });
		if (!reply.ok) return outcomeFor(reply, "That file could not be opened.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Opened the file."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async workspaceDiscard(args) {
		const reply = await this.pythonHost().request("workspace.discard", { name: text(args.name, "name") });
		if (!reply.ok) return outcomeFor(reply, "That file could not be discarded.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Moved the file to the recycle bin."),
			verified: reply.data?.verified
		};
	}
	async fileCommand(payload, whenItFails, timeoutMs) {
		const reply = await this.engineHost().request("files", payload, timeoutMs ? { timeoutMs } : void 0);
		if (!reply.ok) return outcomeFor(reply, whenItFails);
		return {
			...ok(reply.data, reply.data?.detail ?? "Done."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async fileSearch(args) {
		const folder = text(args.folder, "folder");
		const match = typeof args.match === "string" ? args.match.trim() : "";
		const extension = typeof args.extension === "string" ? args.extension.trim() : "";
		if (!match && !extension) return fail("unsupported", "A file search needs part of a name, a file extension, or both.");
		return this.fileCommand(extension ? {
			action: "find",
			folder,
			...match ? { match } : {},
			extension
		} : {
			action: "search",
			folder,
			match
		}, "That folder could not be searched.", 6e4);
	}
	/**
	* Why something failed: the model, the network, or neither.
	*
	* Both reads in one call because the user's question is never "is Ollama up"
	* — it is "why did that not work", and answering half of it sends them
	* looking in the wrong place.
	*/
	async engineStatus() {
		const [model, net] = await Promise.all([this.viaEngine("llm.status", {}, 2e4), this.viaEngine("net.status", {}, 1e4)]);
		if (!model && !net) return fail("unsupported", "The control engine is not available.");
		const modelDetail = model?.ok ? model.data?.detail ?? "" : model?.error ?? "unknown";
		const netDetail = net?.ok ? net.data?.detail ?? "" : net?.error ?? "unknown";
		return {
			...ok({
				model: model?.data ?? null,
				network: net?.data ?? null
			}, `${modelDetail} ${netDetail}`.trim()),
			verified: model?.ok === true && net?.ok === true
		};
	}
	async fileRead(args) {
		return this.fileCommand({
			action: "read",
			folder: text(args.folder, "folder"),
			path: text(args.path, "path")
		}, "That file could not be read.");
	}
	async fileCopy(args) {
		return this.fileCommand({
			action: "copy",
			folder: text(args.folder, "folder"),
			from: text(args.from, "from"),
			to: text(args.to, "to")
		}, "That file could not be copied.", 6e4);
	}
	async fileMove(args) {
		return this.fileCommand({
			action: "move",
			folder: text(args.folder, "folder"),
			from: text(args.from, "from"),
			to: text(args.to, "to")
		}, "That file could not be moved.", 6e4);
	}
	async fileTrash(args) {
		return this.fileCommand({
			action: "trash",
			folder: text(args.folder, "folder"),
			path: text(args.path, "path")
		}, "That file could not be moved to the recycle bin.");
	}
	async fileRestore(args) {
		return this.fileCommand({
			action: "restore",
			id: text(args.id, "id")
		}, "That file could not be restored.", 3e4);
	}
	/**
	* Say something aloud with the voice this operating system already owns.
	*
	* Not a model tool, and deliberately so: this is called by the Control + Work
	* runtime when the user has asked for spoken replies. A tool the model could
	* reach for on its own initiative is a product that talks unprompted.
	*/
	/**
	* Narration, spoken through the engine that "stop" can actually silence.
	*
	* TWO SYNTHESISERS ANSWERED TO ONE COMMAND NAME, AND NARRATION USED THE WRONG
	* ONE. `voice.speak` reached the Python HOST (winsdk speech, played back
	* through `winsound`) here, and the ENGINE (SAPI5, the Zira voice) through
	* the agent's own `speak` tool. Same name, two processes, two voice-selection
	* algorithms.
	*
	* The consequence was not cosmetic. `voice.silence` purges the SAPI queue in
	* the engine; it has no reach into a WAV that `winsound` is already playing.
	* So saying "stop" during a long hands-free answer stopped the task and left
	* the voice talking over the silence -- the single most alarming way for an
	* assistant to respond to being told to stop.
	*
	* Narration now goes to the engine, which is the half that can be interrupted
	* and the half that enforces the female-voice preference by refusing rather
	* than silently substituting.
	*/
	async speak(sentence, language = "en") {
		const reply = await this.viaEngine("voice.speak", {
			text: sentence,
			language
		}, 3e4);
		if (!reply) return fail("unsupported", "Speech needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "OCADE could not speak on this computer.");
		return ok(reply.data, reply.data?.detail ?? `Spoken with ${reply.data?.voice ?? "the OCADE voice"}.`);
	}
	/** What this device can say and hear, without claiming anything untested. */
	async voiceCapability() {
		const host = this.pythonHost();
		const [speech, microphone] = await Promise.all([host.request("voice.list"), host.request("audio.microphones", {}, { timeoutMs: 2e4 })]);
		return {
			speech,
			microphone
		};
	}
	/**
	* Reach the host, read the machine, and take one harmless real action.
	*
	* The action is `input.release` — letting go of any held modifier key or mouse
	* button. It is chosen because it genuinely touches the input stack, so a
	* success here means the control path works end to end, and because its effect
	* on a machine where nothing is held down is precisely nothing. A smoke test
	* that opened an application would prove the same thing while leaving a window
	* on somebody's screen.
	*/
	async preflight() {
		const host = this.pythonHost();
		const snapshot = await host.request("system.snapshot");
		if (!snapshot.ok) return {
			reachable: false,
			detail: snapshot.error ?? "The computer-control host did not answer.",
			snapshot: null,
			activeWindow: null,
			action: null
		};
		const active = await host.request("window.active");
		const released = await host.request("input.release");
		return {
			reachable: true,
			detail: "OCADE reached this computer, read its state, and completed one real action.",
			snapshot: snapshot.data,
			activeWindow: active.ok ? active.data : null,
			action: {
				name: "input.release",
				ok: released.ok,
				detail: released.ok ? released.data?.detail ?? "Released all held keys and mouse buttons." : released.error ?? "The action did not complete."
			}
		};
	}
	async resolveWindow(args) {
		const host = this.pythonHost();
		if (typeof args.windowTitle === "string" && args.windowTitle.trim()) {
			const wanted = args.windowTitle.toLowerCase();
			return ((await host.request("window.list")).data?.windows ?? []).find((w) => w.title.toLowerCase().includes(wanted))?.hwnd ?? null;
		}
		const active = await host.request("window.active");
		return active.ok ? active.data?.hwnd ?? null : null;
	}
	async officeRead(args) {
		const reply = await this.viaEngine("office.read", {
			folder: text(args.folder, "folder"),
			path: text(args.path, "path"),
			previewRows: typeof args.previewRows === "number" ? args.previewRows : void 0
		});
		if (!reply) return fail("unsupported", "Reading office files needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That file could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Read the file.");
	}
	/**
	* Write a spreadsheet or document, carrying the engine's RECEIPT through.
	*
	* `verified` comes from the engine reopening the file and counting what is in
	* it — never from `to_excel` returning without raising. A truncated file and
	* a correct one both complete the call; only the reopen tells them apart.
	*/
	async officeWrite(args) {
		const reply = await this.viaEngine("office.write", {
			folder: text(args.folder, "folder"),
			path: text(args.path, "path"),
			rows: Array.isArray(args.rows) ? args.rows : void 0,
			paragraphs: Array.isArray(args.paragraphs) ? args.paragraphs : void 0,
			title: typeof args.title === "string" ? args.title : void 0,
			sheet: typeof args.sheet === "string" ? args.sheet : void 0
		}, 6e4);
		if (!reply) return fail("unsupported", "Writing office files needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That file could not be written.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Wrote the file."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async messageDraft(args) {
		const reply = await this.viaEngine("message.draft", {
			recipient: text(args.recipient, "recipient"),
			message: text(args.message, "message"),
			app: typeof args.app === "string" ? args.app : void 0
		});
		if (!reply) return fail("unsupported", "Drafting a message needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That message could not be drafted.");
		return ok(reply.data, reply.data?.detail ?? "Drafted the message.");
	}
	/**
	* Send an approved draft.
	*
	* `approved: true` is passed only because reaching this method AT ALL means
	* the loop's permission gate already asked a person and got a yes — a
	* high-risk tool cannot execute otherwise. The engine still re-checks the
	* draft's fingerprint, so the approval is bound to the exact recipient and
	* wording rather than to the draft id alone.
	*/
	/**
	* One door to the WhatsApp skill.
	*
	* The engine owns the sequence — search box, chat row, composer, transcript
	* read-back — because every one of those needed a WhatsApp-specific fact to
	* get right. The adapter only names the step.
	*/
	async whatsapp(action, extra) {
		const reply = await this.viaEngine("whatsapp", {
			action,
			...extra
		}, 45e3);
		if (!reply) return fail("unsupported", "WhatsApp control needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That WhatsApp step did not complete.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Done."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	/**
	* Resolve, open and type in one engine call.
	*
	* `verified` is passed through untouched: the engine confirms the text
	* against the composer after writing it, and a write it could not confirm
	* comes back false. Defaulting that to true here would recreate the exact
	* failure this whole path exists to end -- a receipt saying "typed" over an
	* empty box.
	*/
	async messageTo(args) {
		const reply = await this.viaEngine("message.to", {
			phrase: text(args.phrase, "phrase"),
			send: args.send === "yes" || args.send === true,
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0
		}, 6e4);
		if (!reply) return fail("unsupported", "Messaging needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That message was not prepared.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Prepared."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async messageFindContact(args) {
		const reply = await this.viaEngine("message.findcontact", {
			contact: text(args.contact, "contact"),
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0
		}, 3e4);
		if (!reply) return fail("unsupported", "Opening a conversation needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That conversation was not opened.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Opened the conversation."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async messageSend(args) {
		const reply = await this.viaEngine("message.send", {
			draftId: text(args.draftId, "draftId"),
			approved: true,
			recipient: text(args.recipient, "recipient"),
			message: text(args.message, "message"),
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			fingerprint: typeof args.fingerprint === "string" ? args.fingerprint : void 0
		}, 3e4);
		if (!reply) return fail("unsupported", "Sending a message needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That message was not sent.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Sent the message."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async voiceSpeak(args) {
		const reply = await this.viaEngine("voice.speak", {
			text: text(args.text, "text"),
			wait: args.wait === true
		});
		if (!reply) return fail("unsupported", "Speech needs the control engine, which is not here.");
		if (!reply.ok) return outcomeFor(reply, "OCADE could not speak.");
		return ok(reply.data, reply.data?.detail ?? "Spoke.");
	}
	async voiceListen(args) {
		const reply = await this.viaEngine("voice.listen", {
			silenceMs: typeof args.silenceMs === "number" ? args.silenceMs : void 0,
			maxMs: typeof args.maxMs === "number" ? args.maxMs : void 0
		}, 6e4);
		if (!reply) return fail("unsupported", "Listening needs the control engine, which is not here.");
		if (!reply.ok) return outcomeFor(reply, "OCADE could not listen.");
		return ok(reply.data, reply.data?.detail ?? "Heard nothing.");
	}
	/**
	* Turn always-on interrupt listening on or off.
	*
	* Not a model tool: whether OCADE is listening for "stop" is the user's
	* setting, not something a task should be able to switch off about itself.
	*/
	async setBargeIn(enabled) {
		const reply = await this.viaEngine("voice.bargein", { enabled });
		return reply?.ok === true && reply.data?.listening === enabled;
	}
	/**
	* Has a stop been tripped? This is what the loop polls between steps.
	*
	* Cheap and read-only, so it stays allowed after a stop — asking "did we
	* stop?" must not itself be blocked by having stopped.
	*/
	async stopRequested() {
		const reply = await this.viaEngine("voice.status", {}, 5e3);
		if (!reply?.ok || !reply.data?.stopped) return { stopped: false };
		return {
			stopped: true,
			reason: reply.data.reason ?? "stop requested",
			heard: reply.data.lastHeard || void 0
		};
	}
	/** Every microphone this machine can record from. */
	async audioInputs() {
		const reply = await this.viaEngine("voice.devices", {}, 1e4);
		if (!reply?.ok) return {
			devices: [],
			selected: null,
			micEnabled: false
		};
		return {
			devices: reply.data?.devices ?? [],
			selected: reply.data?.selected ?? null,
			micEnabled: reply.data?.micEnabled ?? false
		};
	}
	/**
	* Turn the microphone on or off, and choose which one.
	*
	* Returns the state the ENGINE reports afterwards, not the state that was
	* asked for. "Mic off" that left the stream open is the failure that matters
	* here, and echoing the request back would hide exactly that.
	*/
	async setMic(input) {
		const payload = {};
		if (typeof input.enabled === "boolean") payload.enabled = input.enabled;
		if (input.deviceId !== void 0) payload.deviceId = input.deviceId;
		const reply = await this.viaEngine("voice.mic", payload, 15e3);
		if (!reply?.ok) return {
			micEnabled: false,
			deviceId: null,
			listening: false,
			ok: false,
			detail: reply?.error ?? "The microphone could not be reached."
		};
		return {
			micEnabled: reply.data?.micEnabled ?? false,
			deviceId: reply.data?.deviceId ?? null,
			listening: reply.data?.listening ?? false,
			ok: reply.data?.verified !== false,
			detail: reply.data?.detail ?? ""
		};
	}
	/** Silence speech, release held input and trip the shared stop. */
	async stopEverything() {
		return (await this.viaEngine("voice.silence", {}, 8e3))?.ok === true;
	}
	/** Clear a tripped stop. Always explicit — never a side effect of new work. */
	async clearStop() {
		return (await this.viaEngine("voice.resume", {}, 5e3))?.ok === true;
	}
	/**
	* The whole actionable UI of a window, as refs.
	*
	* Engine-only on purpose: `ui.tree` lives in the control engine, and there is
	* no `ocade_host` equivalent to fall back to. Reporting that plainly beats
	* degrading to a screenshot, which would hand the model pixels to guess at
	* after it explicitly asked for structure.
	*/
	async uiTree(args) {
		const reply = await this.viaEngine("ui.tree", {
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			query: typeof args.query === "string" ? args.query : void 0,
			limit: typeof args.limit === "number" ? args.limit : void 0
		});
		if (!reply) return fail("unsupported", "Reading the accessibility tree needs the control engine, which is not available here.");
		if (!reply.ok) return outcomeFor(reply, "That window's controls could not be read.");
		return ok(reply.data, reply.data?.detail ?? `Read ${reply.data?.count ?? 0} controls.`);
	}
	/**
	* Operate one control by ref, and carry the host's own verdict through.
	*
	* `verified` comes from the engine's re-read after the action, never from the
	* call returning. A control that accepted the pattern and did nothing must
	* reach the loop as unverified, because the loop's rule is that
	* `verified === false` is not "done".
	*/
	async uiAct(args) {
		const reply = await this.viaEngine("ui.act", {
			ref: text(args.ref, "ref"),
			action: text(args.action, "action"),
			text: typeof args.text === "string" ? args.text : void 0,
			fingerprint: typeof args.fingerprint === "string" ? args.fingerprint : void 0,
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0
		});
		if (!reply) return fail("unsupported", "Operating a control by reference needs the control engine, which is not available here.");
		if (!reply.ok) return outcomeFor(reply, "That control could not be operated.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Operated the control."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	/**
	* Find something on screen, down the perception ladder.
	*
	* The engine reports which rung answered; that is carried through untouched
	* because `needsPointer: false` (UIA) and `needsPointer: true` (OCR or
	* vision) are genuinely different promises about what happens next, and
	* flattening them would hide a pixel click behind a structural-sounding
	* result.
	*/
	/**
	* `allowVision` ARRIVES AS "yes", NOT AS `true`.
	*
	* The tool schema declares it as a string enum of "yes"/"no" — which is the
	* right shape for a small model, since a JSON boolean is the argument these
	* get wrong most often. The adapter tested `args.allowVision === true`, so
	* the model's "yes" compared false and the vision rung was UNREACHABLE from
	* the loop: the only way to reach it was a hand-written call. A capability
	* that cannot be invoked is not a gated capability, it is a dead one.
	*/
	static wantsVision(value) {
		if (value === true) return true;
		return typeof value === "string" && value.trim().toLowerCase() === "yes";
	}
	async screenFind(args) {
		const forced = OcadeAdapters.wantsVision(args.allowVision);
		const reply = await this.viaEngine("screen.find", {
			query: text(args.query, "query"),
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			allowOcr: args.allowOcr !== false,
			...forced ? { allowVision: true } : {}
		}, forced ? 9e4 : 45e3);
		if (!reply) return fail("unsupported", "Screen perception needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "OCADE could not look for that.");
		return ok(reply.data, reply.data?.detail ?? "Looked at the screen.");
	}
	/**
	* The pointer rung, reached only through a target something else found.
	*
	* `verified` is passed through rather than defaulted to true: a click on an
	* estimated coordinate that produced no observable change is exactly the
	* case that must not read as success.
	*/
	async screenClick(args) {
		const target = args.target;
		if (!target || typeof target !== "object" || Array.isArray(target)) return fail("unsupported", "A pointer click needs the target object that screen_find returned, not coordinates.");
		const reply = await this.viaEngine("screen.click", {
			target,
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0
		}, 3e4);
		if (!reply) return fail("unsupported", "Pointer control needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That click was not made.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Clicked."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	/**
	* Every search engine at once, first good answer wins.
	*
	* The timeout is deliberately tighter than the serial path's: a race that
	* has not produced a usable answer in a few seconds is not going to, and
	* saying "I could not find out" quickly is better than saying it slowly.
	*/
	async parallelSearch(args) {
		const reply = await this.viaEngine("web.search.fast", {
			query: text(args.query, "query"),
			maxResults: typeof args.maxResults === "number" ? args.maxResults : 5
		}, 12e3);
		if (!reply) return fail("unsupported", "Live search needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That search did not run.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Searched."),
			verified: reply.data?.status === "ok",
			observation: reply.data
		};
	}
	/**
	* The closed Vision-Action loop: find the field, type, then LOOK.
	*
	* `verified` comes from the engine reading the screen back, never from the
	* call returning. That distinction is the whole feature -- a write that
	* throws no exception into a box that stayed empty is the failure this
	* exists to make visible, and it is what `submit` is gated on.
	*/
	async screenType(args) {
		const forced = OcadeAdapters.wantsVision(args.allowVision);
		const reply = await this.viaEngine("screen.type", {
			field: text(args.field, "field"),
			text: text(args.text, "text"),
			submit: args.submit === true || args.submit === "yes",
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			...forced ? { allowVision: true } : {}
		}, forced ? 12e4 : 6e4);
		if (!reply) return fail("unsupported", "Screen typing needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That text was not typed.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Typed and checked."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async screenAct(args) {
		const forced = OcadeAdapters.wantsVision(args.allowVision);
		const reply = await this.viaEngine("screen.act", {
			what: text(args.what, "what"),
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			...forced ? { allowVision: true } : {}
		}, forced ? 12e4 : 6e4);
		if (!reply) return fail("unsupported", "Screen control needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That was not done.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Done."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async screenRead(args) {
		const reply = await this.viaEngine("screen.read", {
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0,
			bounds: args.bounds && typeof args.bounds === "object" && !Array.isArray(args.bounds) ? args.bounds : void 0
		}, 45e3);
		if (!reply) return fail("unsupported", "Screen reading needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "The screen could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Read the screen.");
	}
	async folderItemOpen(args) {
		const reply = await this.viaEngine("folder.item", {
			item: text(args.item, "item"),
			windowTitle: typeof args.windowTitle === "string" ? args.windowTitle : void 0
		}, 25e3);
		if (!reply) return fail("unsupported", "Opening a folder needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That item was not opened.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Opened it."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async folderOpen(args) {
		const reply = await this.viaEngine("folder.open", { folder: text(args.folder, "folder") }, 2e4);
		if (!reply) return fail("unsupported", "Opening a folder needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That folder was not opened.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Opened the folder."),
			verified: reply.data?.verified ?? void 0
		};
	}
	async appDiscover(args) {
		const reply = await this.viaEngine("app.discover", { name: typeof args.name === "string" ? args.name : void 0 }, 45e3);
		if (!reply) return fail("unsupported", "Application discovery needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "The installed applications could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Listed the applications.");
	}
	async systemBrightness(args) {
		const reply = await this.viaEngine("system.brightness", {
			action: typeof args.action === "string" ? args.action : "get",
			percent: typeof args.percent === "number" ? args.percent : void 0
		});
		if (!reply) return fail("unsupported", "Brightness control needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "The brightness could not be changed.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Read the brightness."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	/**
	* A global media key.
	*
	* `verified` is carried through EXACTLY as the engine reported it, including
	* `null`. Windows gives a media key to whichever app owns the media session
	* and that app reports nothing back, so "nothing was playing and nothing
	* started" is genuinely neither success nor failure — and flattening it to
	* `true` here would be the adapter inventing a result the OS never gave.
	*/
	async mediaControl(args) {
		const reply = await this.viaEngine("system.media", { action: text(args.action, "action") });
		if (!reply) return fail("unsupported", "Media keys need the control engine.");
		if (!reply.ok) return outcomeFor(reply, "That media key could not be sent.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Sent the media key."),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	async bluetoothStatus() {
		const reply = await this.viaEngine("system.bluetooth", {}, 2e4);
		if (!reply) return fail("unsupported", "Bluetooth status needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "Bluetooth status could not be read.");
		return ok(reply.data, reply.data?.detail ?? "Read Bluetooth status.");
	}
	async audioDevices() {
		const reply = await this.viaEngine("system.audiodevices", {}, 2e4);
		if (!reply) return fail("unsupported", "Audio device listing needs the control engine.");
		if (!reply.ok) return outcomeFor(reply, "The audio devices could not be listed.");
		return ok(reply.data, reply.data?.detail ?? "Listed the audio devices.");
	}
	async systemVolume(args) {
		const reply = await this.viaEngine("system.volume", {
			action: text(args.action, "action"),
			level: typeof args.level === "number" ? args.level : void 0,
			by: typeof args.by === "number" ? args.by : void 0
		});
		if (!reply) return fail("unsupported", "Volume control needs the control engine, which is not available here.");
		if (!reply.ok) return outcomeFor(reply, "The volume could not be changed.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Volume changed."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async controlFind(args) {
		const hwnd = await this.resolveWindow(args);
		if (hwnd === null) return fail("state_changed", "That window is not open.");
		const reply = await this.pythonHost().request("control.find", {
			hwnd,
			name: text(args.name, "name"),
			role: args.role
		});
		if (!reply.ok) return outcomeFor(reply, "That control could not be looked for.");
		const count = reply.data?.count ?? 0;
		return ok(reply.data, count > 0 ? `Found ${count} control${count === 1 ? "" : "s"} matching "${String(args.name)}".` : `Nothing called "${String(args.name)}" is present in that window.`);
	}
	async controlActivate(args) {
		const hwnd = await this.resolveWindow(args);
		if (hwnd === null) return fail("state_changed", "That window is not open.");
		const reply = await this.pythonHost().request("control.invoke", {
			hwnd,
			name: text(args.name, "name"),
			role: args.role
		});
		if (!reply.ok) return outcomeFor(reply, "That control could not be activated.");
		return {
			...ok(reply.data, reply.data?.detail ?? "Activated the control."),
			verified: reply.data?.verified,
			observation: reply.data
		};
	}
	async controlSetText(args) {
		const hwnd = await this.resolveWindow(args);
		if (hwnd === null) return fail("state_changed", "That window is not open.");
		const reply = await this.pythonHost().request("control.set_text", {
			hwnd,
			name: text(args.name, "name"),
			role: typeof args.role === "string" ? args.role : void 0,
			value: text(args.value, "value")
		});
		if (!reply.ok) return outcomeFor(reply, "That field could not be filled in.");
		return {
			...ok(reply.data, reply.data?.detail ?? `Wrote ${reply.data?.written ?? 0} characters.`),
			verified: reply.data?.verified ?? void 0,
			observation: reply.data
		};
	}
	/**
	* Open the browser the user is actually signed into.
	*
	* WHAT WAS WRONG, AND IT WAS ONE MISSING FIELD.
	*
	* This used to send `{command:"launch", sessionId, browser, headless:false}`
	* and nothing else. The host reads that as "no profile preference", falls
	* past its signed-in branch and past its CDP branch, and lands in the
	* managed-profile branch — which builds a directory from the session id, and
	* the session id contains `Date.now()`. So every launch got a BRAND NEW EMPTY
	* profile: no cookies, no history, no logins, opening on `about:blank`.
	*
	* That was the whole `about:blank` bug, and it was also why WhatsApp Web
	* showed a QR code and webmail showed a login form. `attachToRealBrowser` in
	* the host had been written to prevent exactly this and was simply never
	* reached, because nothing ever asked it for the real profile.
	*
	* THE APPROVAL IS CARRIED, NOT ASSUMED. `profile:"real"` is only sent
	* alongside a `explicitProfileApproval` that came from a person answering the
	* high-risk card for this call. Without one, the request goes out without
	* either field and the host does what it always did — a throwaway profile —
	* so an unattended caller still gets a working browser, just not a signed-in
	* one. Silently upgrading to the signed-in profile because "the model asked"
	* is the one thing this must never do.
	*/
	async browserOpen(args, approvedByPerson = false) {
		const kind = args.browser === "edge" ? "edge" : "chrome";
		if (this.browserSession) {
			const status = await this.browserHost().raw({
				command: "status",
				sessionId: this.browserSession
			}, { timeoutMs: 1e4 });
			if (status.ok) return {
				...ok(status.data, "The browser is already open — no need to open it again."),
				verified: true
			};
			this.browserSession = null;
		}
		const sessionId = `ocade${Date.now().toString(36)}`;
		const launched = await this.browserHost().raw({
			command: "launch",
			sessionId,
			browser: kind,
			headless: false,
			...approvedByPerson ? {
				profile: "real",
				explicitProfileApproval: true
			} : {}
		}, { timeoutMs: 9e4 });
		if (!launched.ok) return outcomeFor(launched, `${kind} could not be started.`);
		this.browserSession = sessionId;
		const profile = launched.data?.profile;
		const signedIn = profile === "signed-in-cdp" || profile === "signed-in-profile";
		return {
			...ok(launched.data, signedIn ? `Opened your ${kind}, signed in.` : `Opened a separate ${kind} window. It is not signed in to your accounts.`),
			verified: true
		};
	}
	/**
	* Search YouTube, with a query that is guaranteed to be real.
	*
	* THE BUG THIS REPLACES. A live run produced
	* `youtube.com/results?search_query=` — empty — because the query never
	* survived extraction and nothing checked. OCADE opened a blank results page
	* and reported that it had searched. So the check is here, at the boundary,
	* as well as in the contract layer above: an empty query is refused rather
	* than encoded into a URL.
	*
	* Verification reads the query back OUT of the page's address afterwards, so
	* "searched for X" means the browser is genuinely on a results page for X.
	*/
	async youtubeSearch(args) {
		const query = typeof args.query === "string" ? args.query.trim() : "";
		if (!/[\p{L}\p{N}]/u.test(query)) return fail("unsupported", "A YouTube search needs something to search for, and none was given. OCADE did not open a blank search.");
		if (!this.browserSession) {
			const opened = await this.browserOpen({});
			if (opened.kind !== "success") return opened;
		}
		const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
		const reply = await this.browserPerform({
			kind: "navigate",
			url
		}, { approvedOrigins: ["https://www.youtube.com"] });
		if (!reply.ok) return outcomeFor(reply, "That YouTube search could not be run.");
		const observation = reply.data?.observation;
		const landed = observation?.url ?? "";
		const echoed = /search_query=([^&]*)/.exec(landed)?.[1] ?? "";
		const verified = decodeURIComponent(echoed.replace(/\+/g, " ")).trim().length > 0;
		return {
			...ok({
				query,
				url: landed,
				title: observation?.title
			}, verified ? `Searched YouTube for “${query}”.` : "The page opened but does not show that search."),
			verified,
			observation: {
				query,
				url: landed,
				title: observation?.title
			}
		};
	}
	/**
	* Search YouTube and actually PLAY the first result, advert included.
	*
	* "PLAY X" AND "SEARCH FOR X" WERE THE SAME ACTION, AND THAT IS THE BUG.
	* Asked to "play a love song and play it", OCADE opened a results page and
	* stopped — reported live three times. A results page is not a song. The
	* user's sentence has four steps in it and only the first was implemented.
	*
	* The whole sequence is deterministic once you know YouTube's DOM, so none
	* of it is asked of the model:
	*
	*   1. results page for the query
	*   2. the first VIDEO result — `a#video-title`, which is the anchor
	*      YouTube gives every result and which excludes the Shorts carousel
	*      and playlist rows that sit above it
	*   3. the advert, skipped through the existing player-scoped helper that
	*      waits for the Skip control to become pressable
	*   4. a check that a video is genuinely playing, read from the element
	*
	* Every step is verified by re-reading the page, so "played it" means the
	* media element reports itself as playing — not that four clicks resolved.
	*/
	async youtubePlay(args) {
		const query = typeof args.query === "string" ? args.query.trim() : "";
		if (!/[\p{L}\p{N}]/u.test(query)) return fail("unsupported", "Playing something on YouTube needs something to look for.");
		if (!this.browserSession) {
			const opened = await this.browserOpen({});
			if (opened.kind !== "success") return opened;
		}
		const origins = { approvedOrigins: ["https://www.youtube.com", "https://youtube.com"] };
		const searched = await this.browserPerform({
			kind: "navigate",
			url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
		}, origins);
		if (!searched.ok) return outcomeFor(searched, "That YouTube search could not be run.");
		const waited = await this.browserPerform({
			kind: "wait",
			target: { selector: "a#video-title" },
			timeoutMs: 15e3
		}, origins);
		if (!waited.ok) return outcomeFor(waited, `No video results appeared for “${query}”.`);
		const clicked = await this.browserPerform({
			kind: "click",
			target: { selector: "a#video-title" }
		}, origins);
		if (!clicked.ok) return outcomeFor(clicked, "The first result could not be opened.");
		const ad = (await this.browserPerform({
			kind: "site.youtube.skip",
			timeoutMs: 12e3
		}, origins)).data?.output;
		await this.browserPerform({
			kind: "media",
			action: "play"
		}, origins);
		const state = await this.browserPerform({
			kind: "media",
			action: "play"
		}, origins);
		const media = state.data?.output;
		const observation = state.data?.observation;
		const playing = media?.found ? media.paused === false : false;
		return {
			...ok({
				query,
				title: observation?.title,
				url: observation?.url,
				advert: ad?.detail
			}, playing ? `Playing “${observation?.title ?? query}” on YouTube.` + (ad?.skipped ? " Skipped the advert." : "") : `Opened “${observation?.title ?? query}” but could not confirm it is playing.`),
			verified: playing,
			observation: {
				query,
				title: observation?.title,
				url: observation?.url,
				playing
			}
		};
	}
	async browserPerform(action, extra = {}) {
		if (!this.browserSession) return {
			ok: false,
			code: "state_changed",
			error: "No managed browser window is open yet."
		};
		return this.browserHost().raw({
			command: "perform",
			sessionId: this.browserSession,
			runId: `r${Date.now().toString(36)}`,
			action,
			...extra
		}, { timeoutMs: 9e4 });
	}
	async browserNavigate(args, _signal) {
		const url = text(args.url, "url");
		let origin;
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fail("blocked", "Only ordinary web addresses can be opened.");
			origin = parsed.origin;
		} catch {
			return fail("unsupported", "That is not a valid web address.");
		}
		const approved = this.config.approvedOrigins ?? [origin];
		const reply = await this.browserPerform({
			kind: "navigate",
			url
		}, { approvedOrigins: approved });
		if (!reply.ok) return outcomeFor(reply, "That page could not be opened.");
		const challenge = humanCheckIn(reply);
		if (challenge) return challenge;
		const observation = reply.data?.observation;
		return {
			...ok(observation, `Opened ${observation?.title ?? url}.`),
			verified: Boolean(observation?.url),
			observation
		};
	}
	async browserRead() {
		const reply = await this.browserPerform({ kind: "page.read" });
		if (!reply.ok) return outcomeFor(reply, "The page could not be read.");
		const output = reply.data?.output;
		return ok(output, `Read the page: ${output?.title ?? "untitled"}.`);
	}
	async browserClick(args) {
		const label = text(args.text, "text");
		const beforeUrl = (await this.browserPerform({ kind: "page.read" })).data?.observation?.url;
		const target = typeof args.role === "string" ? {
			role: args.role,
			name: label
		} : { text: label };
		const reply = await this.browserPerform({
			kind: "click",
			target
		});
		if (!reply.ok) return outcomeFor(reply, `Nothing on the page matched "${label}".`);
		const observation = reply.data?.observation;
		const changed = Boolean(observation?.url && observation.url !== beforeUrl);
		return {
			...ok(observation, changed ? `Clicked "${label}" and the page changed.` : `Clicked "${label}".`),
			verified: changed ? true : void 0,
			observation
		};
	}
	/**
	* Type into a field on the page.
	*
	* Registered and undispatched until now, which mattered more here than for
	* the file tools: a form is the one thing on a page you cannot finish
	* without typing, so any task that reached one ended there.
	*
	* The host refuses password, OTP and payment fields on its own, and refuses
	* credential-shaped values whatever field they are aimed at. This adds the
	* readback: the field is asked what it holds afterwards, so a fill that
	* silently landed nowhere reports `verified: false` rather than success.
	*/
	async browserType(args) {
		const selector = text(args.selector, "selector");
		const value = text(args.value, "value");
		const reply = await this.browserPerform({
			kind: "type",
			target: { selector },
			value
		});
		if (!reply.ok) return outcomeFor(reply, `Nothing on the page matched "${selector}".`);
		const landed = ((await this.browserPerform({ kind: "page.read" })).data?.output?.fields)?.find((field) => field.selector === selector)?.value;
		const verified = landed === void 0 ? void 0 : landed.includes(value.slice(0, 40));
		return {
			...ok(reply.data, verified === false ? `Typed into "${selector}" but the field does not hold it.` : `Typed into "${selector}".`),
			verified,
			observation: reply.data?.observation
		};
	}
	async browserScroll(args) {
		const direction = args.direction === "up" ? "up" : "down";
		const reply = await this.browserPerform({
			kind: "scroll",
			direction,
			amount: 700
		});
		if (!reply.ok) return outcomeFor(reply, "The page could not be scrolled.");
		const output = reply.data?.output;
		return {
			...ok(output, output?.moved ? `Scrolled ${direction}.` : output?.atEnd ? "The page is already at the end." : "The page did not move."),
			verified: output?.moved,
			observation: output
		};
	}
	async browserKey(args) {
		const wanted = text(args.key, "key");
		const key = wanted.charAt(0).toUpperCase() + wanted.slice(1);
		const reply = await this.browserPerform({
			kind: "key",
			key
		});
		if (!reply.ok) return outcomeFor(reply, `${wanted} could not be sent to the page.`);
		const output = reply.data?.output;
		return {
			...ok(output, `Pressed ${key} on the page.`),
			verified: output?.urlChanged ? true : void 0
		};
	}
	/**
	* Skip an advert, and say plainly when there was nothing to skip.
	*
	* "No skip button" is the ordinary case -- most of the time there is no ad --
	* so it is reported as a fact rather than an error. Treating it as a failure
	* would make a model retry, and retrying a button that does not exist is how
	* a run spends thirty seconds achieving nothing.
	*/
	async browserSkipAd() {
		const reply = await this.browserPerform({ kind: "skip_ad" });
		if (!reply.ok) return outcomeFor(reply, "The page could not be checked for an advert.");
		const output = reply.data?.output;
		return {
			...ok(reply.data, output?.found ? `Skipped the advert${output.label ? ` (“${output.label}”)` : ""}.` : "There was no skip button on the page, so nothing needed skipping."),
			verified: Boolean(output?.found)
		};
	}
	async browserMedia(args) {
		const action = text(args.action, "action").toLowerCase();
		const seconds = typeof args.seconds === "number" ? args.seconds : Number(args.seconds ?? NaN);
		const reply = await this.browserPerform({
			kind: "media",
			action,
			...Number.isFinite(seconds) ? { seconds } : {}
		});
		if (!reply.ok) return outcomeFor(reply, "The media on that page could not be controlled.");
		const output = reply.data?.output;
		if (!output?.applied) return fail("state_changed", "There is no video or audio on that page.");
		const moved = action === "seek" || action === "forward" || action === "back";
		const at = typeof output.currentTime === "number" ? output.currentTime : null;
		return {
			...ok(output, moved ? at !== null ? `Moved to ${at.toFixed(1)} seconds.` : "Moved through the media on that page." : action === "play" ? "Playing the media on that page." : action === "pause" ? "Paused the media on that page." : action === "mute" ? "Muted the media on that page." : "Unmuted the media on that page."),
			verified: moved ? at !== null : action === "play" ? output.paused === false : action === "pause" ? output.paused === true : action === "mute" ? output.muted === true : output.muted === false,
			observation: output
		};
	}
	/**
	* Search the live web, through the same managed browser as everything else.
	*
	* NO SEARCH API, AND THAT IS THE POINT. An API key would mean a third party
	* in the middle of every question the user asks, a bill, and a service that
	* can go away. The managed browser is already here, already permissioned, and
	* returns the page a person would have seen — so the answer is citable
	* against a real address rather than against a JSON blob nobody can check.
	*
	* DuckDuckGo because it answers without a consent wall or a sign-in, which
	* matters when the caller cannot click through one.
	*
	* `web_search` opens the browser itself when nothing is open yet. The model
	* should not have to know that searching requires a browser first; that is an
	* implementation detail leaking into a tool description.
	*/
	async webSearch(args) {
		const query = text(args.query, "query");
		if (!this.browserSession) {
			const opened = await this.browserOpen({});
			if (opened.kind !== "success") return opened;
		}
		const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
		const navigated = await this.browserPerform({
			kind: "navigate",
			url
		}, { approvedOrigins: ["https://duckduckgo.com"] });
		if (!navigated.ok) return outcomeFor(navigated, "That search could not be run.");
		const read = await this.browserPerform({ kind: "page.read" });
		const challenge = humanCheckIn(navigated);
		if (challenge) return challenge;
		if (!read.ok) return outcomeFor(read, "The results could not be read.");
		const output = read.data?.output;
		const body = (output?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 2e3);
		const sources = (output?.links ?? []).filter((link) => /^https?:\/\//.test(link.href) && !link.href.includes("duckduckgo.com")).slice(0, 8).map((link) => ({
			title: link.text.slice(0, 120),
			url: link.href
		}));
		return {
			...ok({
				query,
				results: body,
				sources,
				address: url
			}, `Searched the web for “${query}” and read the results.`),
			verified: body.length > 0,
			observation: {
				query,
				results: body,
				sources
			}
		};
	}
	/**
	* Let go of everything the machine is holding.
	*
	* Called when a mission stops, before the sidecars are disposed. Returns a
	* boolean rather than a `ToolOutcome` because the caller is a shutdown path,
	* not the loop — and a shutdown must not be able to fail in a way that
	* prevents the shutdown.
	*/
	async releaseHeldInput() {
		try {
			return (await this.pythonHost().request("input.release", {}, { timeoutMs: 8e3 })).ok;
		} catch {
			return false;
		}
	}
	async browserTabs() {
		const reply = await this.browserPerform({ kind: "tab.list" });
		if (!reply.ok) return outcomeFor(reply, "The open tabs could not be listed.");
		const output = reply.data?.output ?? [];
		return ok(output, `${Array.isArray(output) ? output.length : 0} tabs are open.`);
	}
};
//#endregion
export { OcadeAdapters };
