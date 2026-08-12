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

import { NativeHostClient, type HostReply } from "../native/native-host-client.node";
import { fail, ok, type ToolOutcome } from "./outcomes";
import type { ToolCall } from "./loop";

export interface AdapterConfig {
  /** Absolute path to the OCADE-owned Python interpreter. */
  pythonExecutable: string;
  /** Directory containing the `ocade_host` package. */
  pythonHostDir: string;
  /** Absolute path to `native/browser-host/index.mjs`. */
  browserHostEntry: string;
  /** Absolute path to the control engine's headless bridge. */
  engineBridgeEntry: string;
  nodeExecutable?: string;
  /** Folders the user has approved for file work. Nothing outside is reachable. */
  approvedFolders?: string[];
  /** Origins the browser may navigate to, when the caller wants to restrict it. */
  approvedOrigins?: string[];
}

/** Map a host's own refusal code onto the loop's closed outcome set. */
function outcomeFor(reply: HostReply, fallbackDetail: string): ToolOutcome {
  const detail = reply.error ?? fallbackDetail;
  switch (reply.code) {
    case "blocked":
      return fail("blocked", detail);
    case "unsupported":
      return fail("unsupported", detail);
    case "state_changed":
      return fail("state_changed", detail);
    case "offline":
      return fail("offline", detail);
    default:
      return fail("retryable_failure", detail);
  }
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required and must be text.`);
  }
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
function humanCheckIn(reply: HostReply): ToolOutcome | null {
  const observation = (
    reply.data as {
      observation?: { humanCheck?: { present?: boolean; kind?: string } };
    }
  )?.observation;
  if (!observation?.humanCheck?.present) return null;
  return fail(
    "blocked",
    "That site is asking for human verification, and OCADE does not complete those. " +
      "Take over in the browser window if you want to continue there, or ask OCADE to try a different source.",
  );
}

export class OcadeAdapters {
  private python: NativeHostClient | null = null;
  private browser: NativeHostClient | null = null;
  private engine: NativeHostClient | null = null;
  private browserSession: string | null = null;

  constructor(private readonly config: AdapterConfig) {}

  private pythonHost(): NativeHostClient {
    this.python ??= new NativeHostClient({
      command: this.config.pythonExecutable,
      args: ["-m", "ocade_host"],
      cwd: this.config.pythonHostDir,
      label: "The computer-control host",
      // UIA walks and OCR are genuinely slow on a cold COM apartment.
      timeoutMs: 45_000,
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
  private engineHost(): NativeHostClient {
    this.engine ??= new NativeHostClient({
      command: this.config.pythonExecutable,
      args: [this.config.engineBridgeEntry],
      cwd: this.config.pythonHostDir,
      label: "The control engine",
      timeoutMs: 45_000,
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
  private async viaEngine<T = unknown>(
    command: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<HostReply<T> | null> {
    const reply = await this.engineHost().request<T>(command, payload, { timeoutMs });
    if (!reply.ok && (reply.code === "unsupported" || reply.code === "retryable_failure")) {
      return null;
    }
    return reply;
  }

  private browserHost(): NativeHostClient {
    this.browser ??= new NativeHostClient({
      command: this.config.nodeExecutable ?? process.execPath,
      args: [this.config.browserHostEntry],
      label: "The managed browser",
      timeoutMs: 60_000,
    });
    return this.browser;
  }

  dispose(): void {
    this.python?.dispose();
    this.browser?.dispose();
    this.engine?.dispose();
    this.python = null;
    this.browser = null;
    this.engine = null;
    this.browserSession = null;
  }

  /* --------------------------------------------------------- routing -- */

  async execute(call: ToolCall, signal?: AbortSignal): Promise<ToolOutcome> {
    if (signal?.aborted) return fail("cancelled", "The task was stopped before this step ran.");
    const started = Date.now();
    try {
      const outcome = await this.dispatch(call, signal);
      return { ...outcome, elapsedMs: Date.now() - started };
    } catch (error) {
      return {
        ...fail("retryable_failure", error instanceof Error ? error.message : String(error)),
        elapsedMs: Date.now() - started,
      };
    }
  }

  private async dispatch(call: ToolCall, signal?: AbortSignal): Promise<ToolOutcome> {
    const a = call.arguments ?? {};
    switch (call.name) {
      case "screen_observe":
        return this.screenObserve(a);
      case "window_list":
        return this.windowList();
      case "window_focus":
        return this.windowFocus(a);
      case "app_list_installed":
        return this.installedApps();
      case "app_open":
        return this.appOpen(a);
      case "app_focus":
        return this.appFocus(a);
      case "display_list":
        return this.displayList();
      case "window_arrange":
        return this.windowArrange(a);
      case "system_status":
        return this.systemStatus();
      case "control_find":
        return this.controlFind(a);
      case "control_activate":
        return this.controlActivate(a);
      case "control_set_text":
        return this.controlSetText(a);
      case "type_text":
        return this.typeText(a);
      case "press_key":
        return this.pressKey(a);
      case "workspace_list":
        return this.workspaceList(a);
      case "workspace_read":
        return this.workspaceRead(a);
      case "workspace_write":
        return this.workspaceWrite(a);
      case "workspace_open":
        return this.workspaceOpen(a);
      case "workspace_discard":
        return this.workspaceDiscard(a);
      case "file_search":
        return this.fileSearch(a);
      case "file_read":
        return this.fileRead(a);
      case "file_copy":
        return this.fileCopy(a);
      case "file_move":
        return this.fileMove(a);
      case "file_trash":
        return this.fileTrash(a);
      case "file_restore":
        return this.fileRestore(a);
      case "browser_type":
        return this.browserType(a);
      case "browser_scroll":
        return this.browserScroll(a);
      case "browser_key":
        return this.browserKey(a);
      case "browser_media":
        return this.browserMedia(a);
      case "browser_open":
        return this.browserOpen(a);
      case "browser_navigate":
        return this.browserNavigate(a, signal);
      case "browser_read":
        return this.browserRead();
      case "browser_click":
        return this.browserClick(a);
      case "browser_tabs":
        return this.browserTabs();
      case "web_search":
        return this.webSearch(a);
      case "youtube_search":
        return this.youtubeSearch(a);
      default:
        return fail("unsupported", `${call.name} is not connected on this device yet.`);
    }
  }

  /* ------------------------------------------------------ perception -- */

  /**
   * The answer to "what's on my screen?".
   *
   * Structure first and pixels second, in one call, because the model should
   * not have to know which of three sources happened to work. A window that
   * exposes a rich accessibility tree never pays for OCR; a custom-drawn one
   * falls through to it automatically and the reply says which source answered.
   */
  private async screenObserve(args: Record<string, unknown>): Promise<ToolOutcome> {
    /*
     * The engine's screen read runs the same ladder — UI Automation first, a
     * capture only when the window described itself with fewer than ten nodes —
     * and returns the open-window list in the same call, so the loop sees the
     * whole picture in one round trip instead of three.
     */
    const viaEngine = await this.viaEngine<{ detail: string; elementCount: number }>(
      "screen.observe",
      {
        ...(typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {}),
        ...(args.includeText === "yes" ? { includeText: "yes" } : {}),
      },
    );
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "The screen could not be read.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Read the screen."),
        observation: viaEngine.data,
      };
    }

    const host = this.pythonHost();
    const wanted = typeof args.windowTitle === "string" ? args.windowTitle.toLowerCase() : null;

    const windows = await host.request<{
      windows: { hwnd: number; title: string; process: string }[];
    }>("window.list");
    if (!windows.ok) return outcomeFor(windows, "The list of windows could not be read.");

    const list = windows.data?.windows ?? [];
    const active = await host.request<{ hwnd: number; title: string; process: string }>(
      "window.active",
    );
    const chosen = wanted
      ? list.find((w) => w.title.toLowerCase().includes(wanted))
      : active.ok
        ? active.data
        : list[0];

    if (!chosen) {
      return fail("state_changed", "No matching window is open on this computer right now.");
    }

    const tree = await host.request<{ elements: unknown[]; count: number; truncated: boolean }>(
      "accessibility.tree",
      { hwnd: chosen.hwnd },
    );

    const structural = tree.ok ? (tree.data?.count ?? 0) : 0;
    /*
     * Ten is the line between "this window described itself" and "this window
     * returned its title bar". Electron and custom-drawn applications routinely
     * expose a handful of chrome nodes and nothing else, and treating that as a
     * successful read is how an agent concludes a screen is empty.
     */
    const needsText = structural < 10 || args.includeText === "yes";
    const ocr = needsText
      ? await host.request<{ text: string; lineCount: number }>("screen.ocr", { hwnd: chosen.hwnd })
      : null;

    return ok(
      {
        window: chosen,
        openWindows: list.map((w) => ({ title: w.title, application: w.process })),
        elements: tree.ok ? tree.data?.elements : [],
        elementCount: structural,
        elementsTruncated: tree.ok ? tree.data?.truncated : false,
        visibleText: ocr?.ok ? ocr.data?.text : null,
        textSource: ocr?.ok ? "ocr" : tree.ok && structural > 0 ? "accessibility" : "none",
      },
      `Read the screen: ${chosen.title}. ${structural} interface elements${ocr?.ok ? `, plus ${ocr.data?.lineCount ?? 0} lines of visible text` : ""}.`,
    );
  }

  private async windowList(): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{ windows: unknown[]; count: number }>(
      "window.list",
    );
    if (!reply.ok) return outcomeFor(reply, "The list of windows could not be read.");
    return ok(reply.data, `${reply.data?.count ?? 0} windows are open.`);
  }

  private async installedApps(): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{ applications: unknown[]; count: number }>(
      "system.applications",
    );
    if (!reply.ok)
      return outcomeFor(reply, "The list of installed applications could not be read.");
    return ok(reply.data, `${reply.data?.count ?? 0} applications are installed on this computer.`);
  }

  private async systemStatus(): Promise<ToolOutcome> {
    const host = this.pythonHost();
    const [snapshot, processes] = await Promise.all([
      host.request("system.snapshot"),
      host.request("system.processes", { by: "memory" }),
    ]);
    if (!snapshot.ok) return outcomeFor(snapshot, "The system status could not be read.");
    return ok(
      { ...(snapshot.data as object), topProcesses: processes.ok ? processes.data : null },
      "Read this computer's processor, memory, disk and battery state.",
    );
  }

  private async windowFocus(args: Record<string, unknown>): Promise<ToolOutcome> {
    const host = this.pythonHost();
    const wanted = text(args.windowTitle, "windowTitle").toLowerCase();
    const windows = await host.request<{ windows: { hwnd: number; title: string }[] }>(
      "window.list",
    );
    if (!windows.ok) return outcomeFor(windows, "The list of windows could not be read.");
    const match = (windows.data?.windows ?? []).find((w) => w.title.toLowerCase().includes(wanted));
    if (!match)
      return fail("state_changed", `No open window has "${args.windowTitle}" in its title.`);

    const reply = await host.request<{ verified: boolean; detail: string }>("window.focus", {
      hwnd: match.hwnd,
    });
    if (!reply.ok) return outcomeFor(reply, "That window could not be brought to the front.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Focused the window."),
      verified: reply.data?.verified,
    };
  }

  /* ------------------------------------ applications and placement -- */

  /**
   * Open an application by NAME, never by path.
   *
   * The host resolves the name against what this machine reports as installed;
   * nothing here hands it a string to execute. That is the whole distinction
   * between an application launcher and remote code execution, and it lives on
   * the host side so this adapter cannot weaken it by accident.
   */
  private async appOpen(args: Record<string, unknown>): Promise<ToolOutcome> {
    const name = text(args.name, "name");

    /*
     * THE ENGINE FIRST. Its `open_app` normalises names across three platforms
     * and knows about store apps and shell verbs; the bridge then confirms a
     * window that was not there before now is. That is a better launcher AND a
     * real verification, so it leads.
     */
    const viaEngine = await this.viaEngine<{
      detail: string;
      verified: boolean;
      title: string;
    }>("app.open", { name }, 30_000);
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, `${name} could not be opened.`);
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? `Opened ${name}.`),
        verified: viaEngine.data?.verified,
        observation: viaEngine.data,
      };
    }

    const reply = await this.pythonHost().request<{
      application: string;
      detail: string;
      verified: boolean | null;
      reused: boolean;
      // Sixty rather than thirty. A cold application launch on a machine that
      // is already short of memory is genuinely slow, and the first live run
      // reported a failure for a Notepad that had in fact opened. The host's
      // own wait is short and it answers "started, no window yet" rather than
      // blocking, so this ceiling is now a backstop rather than the schedule.
    }>("app.launch", { name, reuse: args.reuse !== false }, { timeoutMs: 60_000 });
    if (!reply.ok) return outcomeFor(reply, `${name} could not be opened.`);
    return {
      ...ok(reply.data, reply.data?.detail ?? `Opened ${name}.`),
      // The host verifies by waiting for a real window, not by a process
      // spawning. `null` means the platform cannot check, and stays undefined.
      verified: reply.data?.verified ?? undefined,
      observation: reply.data,
    };
  }

  private async appFocus(args: Record<string, unknown>): Promise<ToolOutcome> {
    const name = text(args.name, "name");

    const viaEngine = await this.viaEngine<{ detail: string; verified: boolean | null }>(
      "app.focus",
      { name },
    );
    if (viaEngine) {
      if (!viaEngine.ok)
        return outcomeFor(viaEngine, "That application could not be brought to the front.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
        verified: viaEngine.data?.verified ?? undefined,
        observation: viaEngine.data,
      };
    }

    const reply = await this.pythonHost().request<{ detail: string; verified: boolean }>(
      "app.focus",
      { name },
    );
    if (!reply.ok) return outcomeFor(reply, `${name} could not be brought to the front.`);
    return {
      ...ok(reply.data, reply.data?.detail ?? `${name} is now in front.`),
      verified: reply.data?.verified,
    };
  }

  private async displayList(): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{ displays: unknown[]; count: number }>(
      "display.list",
    );
    if (!reply.ok) return outcomeFor(reply, "The displays could not be read.");
    const count = reply.data?.count ?? 0;
    return ok(reply.data, `This computer has ${count} display${count === 1 ? "" : "s"}.`);
  }

  private async windowArrange(args: Record<string, unknown>): Promise<ToolOutcome> {
    const viaEngine = await this.viaEngine<{ detail: string; verified: boolean | null }>(
      "window.arrange",
      {
        layout: typeof args.layout === "string" ? args.layout : "maximise",
        ...(typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {}),
      },
    );
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "That window could not be moved.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
        verified: viaEngine.data?.verified ?? undefined,
        observation: viaEngine.data,
      };
    }

    const hwnd = await this.resolveWindow(args);
    if (hwnd === null) return fail("state_changed", "That window is not open.");
    const display = Number(args.display);
    const reply = await this.pythonHost().request<{ detail: string; verified: boolean }>(
      "window.arrange",
      {
        hwnd,
        layout: typeof args.layout === "string" ? args.layout : "maximise",
        ...(Number.isFinite(display) && display > 0 ? { display: Math.trunc(display) } : {}),
      },
    );
    if (!reply.ok) return outcomeFor(reply, "That window could not be moved.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Moved the window."),
      verified: reply.data?.verified,
      observation: reply.data,
    };
  }

  /* ------------------------------------------------ keyboard and text -- */

  private async typeText(args: Record<string, unknown>): Promise<ToolOutcome> {
    // The engine's bridge runs the UI-Automation-first ladder and reads the
    // field back through a separate walk, which is exactly the discipline this
    // tool needs, so it leads here too.
    const viaEngine = await this.viaEngine<{
      detail: string;
      verified: boolean | null;
      method: string;
    }>("input.type", {
      text: text(args.text, "text"),
      ...(typeof args.windowTitle === "string" ? { windowTitle: args.windowTitle } : {}),
    });
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "That text could not be typed.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Typed the text."),
        verified: viaEngine.data?.verified ?? undefined,
        observation: viaEngine.data,
      };
    }

    const hwnd = await this.resolveWindow(args);
    const reply = await this.pythonHost().request<{
      detail: string;
      verified: boolean;
      method: string;
      typed: number;
    }>("input.type", { text: text(args.text, "text"), ...(hwnd ? { hwnd } : {}) });
    if (!reply.ok) return outcomeFor(reply, "That text could not be typed.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Typed the text."),
      verified: reply.data?.verified,
      observation: reply.data,
    };
  }

  private async pressKey(args: Record<string, unknown>): Promise<ToolOutcome> {
    const raw = args.modifiers;
    const modifiers =
      typeof raw === "string"
        ? raw
            .split(/[+,\s]+/)
            .map((part) => part.trim().toLowerCase())
            .filter(Boolean)
        : Array.isArray(raw)
          ? raw.map((part) => String(part).toLowerCase())
          : [];
    const reply = await this.pythonHost().request<{ detail: string; verified: boolean }>(
      "input.key",
      { key: text(args.key, "key"), modifiers },
    );
    if (!reply.ok) return outcomeFor(reply, "That key could not be pressed.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Pressed the key."),
      verified: reply.data?.verified,
    };
  }

  /* ----------------------------------------------- the temporary folder -- */

  private async workspaceList(args: Record<string, unknown>): Promise<ToolOutcome> {
    const viaEngine = await this.viaEngine<{ detail: string; verified: boolean }>("workspace", {
      action: "list",
      ...{},
    });
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "The folder could not be read.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
        verified: viaEngine.data?.verified,
        observation: viaEngine.data,
      };
    }

    const reply = await this.pythonHost().request<{ detail: string; count: number }>(
      "workspace.list",
      { match: typeof args.match === "string" ? args.match : "" },
    );
    if (!reply.ok) return outcomeFor(reply, "The folder could not be read.");
    return ok(reply.data, reply.data?.detail ?? "Listed the folder.");
  }

  private async workspaceRead(args: Record<string, unknown>): Promise<ToolOutcome> {
    const viaEngine = await this.viaEngine<{ detail: string; verified: boolean }>("workspace", {
      action: "read",
      ...{ name: text(args.name, "name") },
    });
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "That file could not be read.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
        verified: viaEngine.data?.verified,
        observation: viaEngine.data,
      };
    }

    const reply = await this.pythonHost().request<{ detail: string; content: string }>(
      "workspace.read",
      { name: text(args.name, "name") },
    );
    if (!reply.ok) return outcomeFor(reply, "That file could not be read.");
    return ok(reply.data, reply.data?.detail ?? "Read the file.");
  }

  private async workspaceWrite(args: Record<string, unknown>): Promise<ToolOutcome> {
    const viaEngine = await this.viaEngine<{ detail: string; verified: boolean }>("workspace", {
      action: "write",
      ...{ name: text(args.name, "name"), content: text(args.content, "content") },
    });
    if (viaEngine) {
      if (!viaEngine.ok) return outcomeFor(viaEngine, "That file could not be written.");
      return {
        ...ok(viaEngine.data, viaEngine.data?.detail ?? "Done."),
        verified: viaEngine.data?.verified,
        observation: viaEngine.data,
      };
    }

    const reply = await this.pythonHost().request<{ detail: string; verified: boolean }>(
      "workspace.write",
      { name: text(args.name, "name"), content: text(args.content, "content") },
    );
    if (!reply.ok) return outcomeFor(reply, "That file could not be written.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Wrote the file."),
      verified: reply.data?.verified,
    };
  }

  private async workspaceOpen(args: Record<string, unknown>): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{
      detail: string;
      verified: boolean | null;
      title: string;
    }>("workspace.open", { name: text(args.name, "name") }, { timeoutMs: 30_000 });
    if (!reply.ok) return outcomeFor(reply, "That file could not be opened.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Opened the file."),
      verified: reply.data?.verified ?? undefined,
      observation: reply.data,
    };
  }

  private async workspaceDiscard(args: Record<string, unknown>): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{ detail: string; verified: boolean }>(
      "workspace.discard",
      { name: text(args.name, "name") },
    );
    if (!reply.ok) return outcomeFor(reply, "That file could not be discarded.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Moved the file to the recycle bin."),
      verified: reply.data?.verified,
    };
  }

  /* --------------------------------------------------- the user's files -- */

  /*
   * These six were registered, described to the model, and had no dispatch arm
   * at all: every call fell through to `default` and came back "not connected
   * on this device yet". A planner cannot route around a tool that claims to
   * exist, so it would pick one, fail, and try again — which is how a task
   * burns its whole step budget without touching a file.
   *
   * They run against the engine's `files` command, which takes a folder NAME
   * out of a closed set rather than a path. Nothing here can name a directory
   * the vocabulary does not contain.
   */

  private async fileCommand(
    payload: Record<string, unknown>,
    whenItFails: string,
    timeoutMs?: number,
  ): Promise<ToolOutcome> {
    const reply = await this.engineHost().request<{ detail?: string; verified?: boolean }>(
      "files",
      payload,
      timeoutMs ? { timeoutMs } : undefined,
    );
    if (!reply.ok) return outcomeFor(reply, whenItFails);
    return {
      ...ok(reply.data, reply.data?.detail ?? "Done."),
      verified: reply.data?.verified,
      observation: reply.data,
    };
  }

  private async fileSearch(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      { action: "search", folder: text(args.folder, "folder"), match: text(args.match, "match") },
      "That folder could not be searched.",
      30_000,
    );
  }

  private async fileRead(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      { action: "read", folder: text(args.folder, "folder"), path: text(args.path, "path") },
      "That file could not be read.",
    );
  }

  private async fileCopy(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      {
        action: "copy",
        folder: text(args.folder, "folder"),
        from: text(args.from, "from"),
        to: text(args.to, "to"),
      },
      "That file could not be copied.",
      60_000,
    );
  }

  private async fileMove(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      {
        action: "move",
        folder: text(args.folder, "folder"),
        from: text(args.from, "from"),
        to: text(args.to, "to"),
      },
      "That file could not be moved.",
      60_000,
    );
  }

  private async fileTrash(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      { action: "trash", folder: text(args.folder, "folder"), path: text(args.path, "path") },
      "That file could not be moved to the recycle bin.",
    );
  }

  private async fileRestore(args: Record<string, unknown>): Promise<ToolOutcome> {
    return this.fileCommand(
      { action: "restore", id: text(args.id, "id") },
      "That file could not be restored.",
      30_000,
    );
  }

  /* ------------------------------------------------ voice and hearing -- */

  /**
   * Say something aloud with the voice this operating system already owns.
   *
   * Not a model tool, and deliberately so: this is called by the Control + Work
   * runtime when the user has asked for spoken replies. A tool the model could
   * reach for on its own initiative is a product that talks unprompted.
   */
  async speak(sentence: string, language = "en"): Promise<ToolOutcome> {
    const reply = await this.pythonHost().request<{ engine: string; voice: { name?: string } }>(
      "voice.speak",
      { text: sentence, language },
      { timeoutMs: 30_000 },
    );
    if (!reply.ok) return outcomeFor(reply, "OCADE could not speak on this computer.");
    return ok(reply.data, `Spoken with ${reply.data?.voice?.name ?? "the system voice"}.`);
  }

  /** What this device can say and hear, without claiming anything untested. */
  async voiceCapability(): Promise<{ speech: HostReply; microphone: HostReply }> {
    const host = this.pythonHost();
    const [speech, microphone] = await Promise.all([
      host.request("voice.list"),
      host.request("audio.microphones", {}, { timeoutMs: 20_000 }),
    ]);
    return { speech, microphone };
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
  async preflight(): Promise<{
    reachable: boolean;
    detail: string;
    snapshot: unknown;
    activeWindow: unknown;
    action: { name: string; ok: boolean; detail: string } | null;
  }> {
    const host = this.pythonHost();
    const snapshot = await host.request<Record<string, unknown>>("system.snapshot");
    if (!snapshot.ok) {
      return {
        reachable: false,
        detail: snapshot.error ?? "The computer-control host did not answer.",
        snapshot: null,
        activeWindow: null,
        action: null,
      };
    }
    const active = await host.request<Record<string, unknown>>("window.active");
    const released = await host.request<{ detail: string }>("input.release");
    return {
      reachable: true,
      detail: "OCADE reached this computer, read its state, and completed one real action.",
      snapshot: snapshot.data,
      activeWindow: active.ok ? active.data : null,
      action: {
        name: "input.release",
        ok: released.ok,
        detail: released.ok
          ? (released.data?.detail ?? "Released all held keys and mouse buttons.")
          : (released.error ?? "The action did not complete."),
      },
    };
  }

  /* ---------------------------------------------------------- action -- */

  private async resolveWindow(args: Record<string, unknown>): Promise<number | null> {
    const host = this.pythonHost();
    if (typeof args.windowTitle === "string" && args.windowTitle.trim()) {
      const wanted = args.windowTitle.toLowerCase();
      const windows = await host.request<{ windows: { hwnd: number; title: string }[] }>(
        "window.list",
      );
      const match = (windows.data?.windows ?? []).find((w) =>
        w.title.toLowerCase().includes(wanted),
      );
      return match?.hwnd ?? null;
    }
    const active = await host.request<{ hwnd: number }>("window.active");
    return active.ok ? (active.data?.hwnd ?? null) : null;
  }

  private async controlFind(args: Record<string, unknown>): Promise<ToolOutcome> {
    const hwnd = await this.resolveWindow(args);
    if (hwnd === null) return fail("state_changed", "That window is not open.");
    const reply = await this.pythonHost().request<{ matches: unknown[]; count: number }>(
      "control.find",
      { hwnd, name: text(args.name, "name"), role: args.role },
    );
    if (!reply.ok) return outcomeFor(reply, "That control could not be looked for.");
    const count = reply.data?.count ?? 0;
    return ok(
      reply.data,
      count > 0
        ? `Found ${count} control${count === 1 ? "" : "s"} matching "${String(args.name)}".`
        : `Nothing called "${String(args.name)}" is present in that window.`,
    );
  }

  private async controlActivate(args: Record<string, unknown>): Promise<ToolOutcome> {
    const hwnd = await this.resolveWindow(args);
    if (hwnd === null) return fail("state_changed", "That window is not open.");
    const reply = await this.pythonHost().request<{
      detail: string;
      verified: boolean;
      screenChanged: boolean;
    }>("control.invoke", { hwnd, name: text(args.name, "name"), role: args.role });
    if (!reply.ok) return outcomeFor(reply, "That control could not be activated.");
    return {
      ...ok(reply.data, reply.data?.detail ?? "Activated the control."),
      verified: reply.data?.verified,
      observation: reply.data,
    };
  }

  private async controlSetText(args: Record<string, unknown>): Promise<ToolOutcome> {
    const hwnd = await this.resolveWindow(args);
    if (hwnd === null) return fail("state_changed", "That window is not open.");
    const reply = await this.pythonHost().request<{
      verified: boolean | null;
      written: number;
      detail: string;
    }>("control.set_text", {
      hwnd,
      name: text(args.name, "name"),
      role: typeof args.role === "string" ? args.role : undefined,
      value: text(args.value, "value"),
    });
    if (!reply.ok) return outcomeFor(reply, "That field could not be filled in.");
    return {
      // The host's own sentence names the field it actually wrote into and says
      // whether it read the value back. Replacing that with a generic count
      // threw away the only part the user could check.
      ...ok(reply.data, reply.data?.detail ?? `Wrote ${reply.data?.written ?? 0} characters.`),
      verified: reply.data?.verified ?? undefined,
      observation: reply.data,
    };
  }

  /* --------------------------------------------------------- browser -- */

  private async browserOpen(args: Record<string, unknown>): Promise<ToolOutcome> {
    const kind = args.browser === "edge" ? "edge" : "chrome";

    /*
     * ALREADY OPEN IS A SUCCESS, NOT A REASON TO OPEN ANOTHER.
     *
     * Measured on a live run: the model called this on three consecutive turns
     * because each reply read like a fresh start, and the user got three Chrome
     * windows for one task. The old code reused the session ID but still sent
     * `launch` every time, so the host opened another context each round.
     *
     * Now an existing, answering session short-circuits — and the reply says so
     * plainly, which is what stops the model trying again.
     */
    if (this.browserSession) {
      const status = await this.browserHost().raw(
        { command: "status", sessionId: this.browserSession },
        { timeoutMs: 10_000 },
      );
      if (status.ok) {
        return {
          ...ok(status.data, "The browser is already open — no need to open it again."),
          verified: true,
        };
      }
      // The session died (the user closed the window). Fall through and start a
      // new one rather than reporting a browser that is not there.
      this.browserSession = null;
    }

    const sessionId = `ocade${Date.now().toString(36)}`;
    const launched = await this.browserHost().raw(
      { command: "launch", sessionId, browser: kind, headless: false },
      { timeoutMs: 90_000 },
    );
    if (!launched.ok) return outcomeFor(launched, "The managed browser could not be started.");
    this.browserSession = sessionId;
    return { ...ok(launched.data, `Opened a managed ${kind} window.`), verified: true };
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
  private async youtubeSearch(args: Record<string, unknown>): Promise<ToolOutcome> {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!/[\p{L}\p{N}]/u.test(query)) {
      return fail(
        "unsupported",
        "A YouTube search needs something to search for, and none was given. OCADE did not open a blank search.",
      );
    }
    if (!this.browserSession) {
      const opened = await this.browserOpen({});
      if (opened.kind !== "success") return opened;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const reply = await this.browserPerform(
      { kind: "navigate", url },
      { approvedOrigins: ["https://www.youtube.com"] },
    );
    if (!reply.ok) return outcomeFor(reply, "That YouTube search could not be run.");

    const observation = (reply.data as { observation?: { url?: string; title?: string } })
      ?.observation;
    // Read the query back out of the address the browser actually landed on.
    const landed = observation?.url ?? "";
    const echoed = /search_query=([^&]*)/.exec(landed)?.[1] ?? "";
    const verified = decodeURIComponent(echoed.replace(/\+/g, " ")).trim().length > 0;

    return {
      ...ok(
        { query, url: landed, title: observation?.title },
        verified
          ? `Searched YouTube for “${query}”.`
          : "The page opened but does not show that search.",
      ),
      verified,
      observation: { query, url: landed, title: observation?.title },
    };
  }

  private async browserPerform(
    action: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ): Promise<HostReply> {
    if (!this.browserSession) {
      return { ok: false, code: "state_changed", error: "No managed browser window is open yet." };
    }
    return this.browserHost().raw(
      {
        command: "perform",
        sessionId: this.browserSession,
        runId: `r${Date.now().toString(36)}`,
        action,
        ...extra,
      },
      { timeoutMs: 90_000 },
    );
  }

  private async browserNavigate(
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<ToolOutcome> {
    const url = text(args.url, "url");
    let origin: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return fail("blocked", "Only ordinary web addresses can be opened.");
      }
      origin = parsed.origin;
    } catch {
      return fail("unsupported", "That is not a valid web address.");
    }
    const approved = this.config.approvedOrigins ?? [origin];
    const reply = await this.browserPerform(
      { kind: "navigate", url },
      { approvedOrigins: approved },
    );
    if (!reply.ok) return outcomeFor(reply, "That page could not be opened.");
    const challenge = humanCheckIn(reply);
    if (challenge) return challenge;
    const observation = (reply.data as { observation?: { url?: string; title?: string } })
      ?.observation;
    return {
      ...ok(observation, `Opened ${observation?.title ?? url}.`),
      verified: Boolean(observation?.url),
      observation,
    };
  }

  private async browserRead(): Promise<ToolOutcome> {
    const reply = await this.browserPerform({ kind: "page.read" });
    if (!reply.ok) return outcomeFor(reply, "The page could not be read.");
    const output = (reply.data as { output?: { title?: string; text?: string } })?.output;
    return ok(output, `Read the page: ${output?.title ?? "untitled"}.`);
  }

  private async browserClick(args: Record<string, unknown>): Promise<ToolOutcome> {
    const label = text(args.text, "text");
    const before = await this.browserPerform({ kind: "page.read" });
    const beforeUrl = (before.data as { observation?: { url?: string } })?.observation?.url;
    const target =
      typeof args.role === "string" ? { role: args.role, name: label } : { text: label };
    const reply = await this.browserPerform({ kind: "click", target });
    if (!reply.ok) return outcomeFor(reply, `Nothing on the page matched "${label}".`);
    const observation = (reply.data as { observation?: { url?: string; title?: string } })
      ?.observation;
    const changed = Boolean(observation?.url && observation.url !== beforeUrl);
    return {
      ...ok(
        observation,
        changed ? `Clicked "${label}" and the page changed.` : `Clicked "${label}".`,
      ),
      // A click that navigates is confirmed by the address changing. A click
      // that does not navigate genuinely cannot be confirmed this way, so it
      // reports undefined rather than claiming a verification it did not do.
      verified: changed ? true : undefined,
      observation,
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
  private async browserType(args: Record<string, unknown>): Promise<ToolOutcome> {
    const selector = text(args.selector, "selector");
    const value = text(args.value, "value");
    const reply = await this.browserPerform({
      kind: "type",
      target: { selector },
      value,
    });
    if (!reply.ok) return outcomeFor(reply, `Nothing on the page matched "${selector}".`);

    const readback = await this.browserPerform({ kind: "page.read" });
    const fields = (
      readback.data as { output?: { fields?: { selector?: string; value?: string }[] } }
    )?.output?.fields;
    const landed = fields?.find((field) => field.selector === selector)?.value;
    // A field OCADE cannot find again reports undefined, not false: unreadable
    // and empty are different facts, and only one of them is a failure.
    const verified = landed === undefined ? undefined : landed.includes(value.slice(0, 40));

    return {
      ...ok(
        reply.data,
        verified === false
          ? `Typed into "${selector}" but the field does not hold it.`
          : `Typed into "${selector}".`,
      ),
      verified,
      observation: (reply.data as { observation?: unknown })?.observation,
    };
  }

  private async browserScroll(args: Record<string, unknown>): Promise<ToolOutcome> {
    const direction = args.direction === "up" ? "up" : "down";
    const reply = await this.browserPerform({ kind: "scroll", direction, amount: 700 });
    if (!reply.ok) return outcomeFor(reply, "The page could not be scrolled.");
    const output = (reply.data as { output?: { moved?: boolean; atEnd?: boolean } })?.output;
    return {
      ...ok(
        output,
        output?.moved
          ? `Scrolled ${direction}.`
          : output?.atEnd
            ? "The page is already at the end."
            : "The page did not move.",
      ),
      // Scrolling verifies itself: the position either changed or it did not.
      verified: output?.moved,
      observation: output,
    };
  }

  private async browserKey(args: Record<string, unknown>): Promise<ToolOutcome> {
    const wanted = text(args.key, "key");
    const key = wanted.charAt(0).toUpperCase() + wanted.slice(1);
    const reply = await this.browserPerform({ kind: "key", key });
    if (!reply.ok) return outcomeFor(reply, `${wanted} could not be sent to the page.`);
    const output = (reply.data as { output?: { urlChanged?: boolean } })?.output;
    return {
      ...ok(output, `Pressed ${key} on the page.`),
      verified: output?.urlChanged ? true : undefined,
    };
  }

  private async browserMedia(args: Record<string, unknown>): Promise<ToolOutcome> {
    const action = text(args.action, "action").toLowerCase();
    const reply = await this.browserPerform({ kind: "media", action });
    if (!reply.ok) return outcomeFor(reply, "The media on that page could not be controlled.");
    const output = (
      reply.data as {
        output?: { found?: number; applied?: boolean; paused?: boolean; muted?: boolean };
      }
    )?.output;
    if (!output?.applied) {
      return fail("state_changed", "There is no video or audio on that page.");
    }
    return {
      ...ok(
        output,
        `${action === "play" ? "Playing" : action === "pause" ? "Paused" : action === "mute" ? "Muted" : "Unmuted"} the media on that page.`,
      ),
      // Read back from the element itself, not assumed from the call.
      verified:
        action === "play"
          ? output.paused === false
          : action === "pause"
            ? output.paused === true
            : action === "mute"
              ? output.muted === true
              : output.muted === false,
      observation: output,
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
  private async webSearch(args: Record<string, unknown>): Promise<ToolOutcome> {
    const query = text(args.query, "query");
    if (!this.browserSession) {
      const opened = await this.browserOpen({});
      if (opened.kind !== "success") return opened;
    }

    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    const navigated = await this.browserPerform(
      { kind: "navigate", url },
      { approvedOrigins: ["https://duckduckgo.com"] },
    );
    if (!navigated.ok) return outcomeFor(navigated, "That search could not be run.");

    const read = await this.browserPerform({ kind: "page.read" });
    const challenge = humanCheckIn(navigated);
    if (challenge) return challenge;

    if (!read.ok) return outcomeFor(read, "The results could not be read.");
    const output = (
      read.data as {
        output?: { title?: string; text?: string; links?: { text: string; href: string }[] };
      }
    )?.output;

    // Bounded hard. A results page is mostly chrome, and the model has a
    // context window to spend on the task rather than on a navigation bar.
    const body = (output?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 2_000);
    const sources = (output?.links ?? [])
      .filter((link) => /^https?:\/\//.test(link.href) && !link.href.includes("duckduckgo.com"))
      .slice(0, 8)
      .map((link) => ({ title: link.text.slice(0, 120), url: link.href }));

    return {
      ...ok(
        { query, results: body, sources, address: url },
        `Searched the web for “${query}” and read the results.`,
      ),
      verified: body.length > 0,
      observation: { query, results: body, sources },
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
  async releaseHeldInput(): Promise<boolean> {
    try {
      const reply = await this.pythonHost().request("input.release", {}, { timeoutMs: 8_000 });
      return reply.ok;
    } catch {
      return false;
    }
  }

  private async browserTabs(): Promise<ToolOutcome> {
    const reply = await this.browserPerform({ kind: "tab.list" });
    if (!reply.ok) return outcomeFor(reply, "The open tabs could not be listed.");
    const output = (reply.data as { output?: unknown[] })?.output ?? [];
    return ok(output, `${Array.isArray(output) ? output.length : 0} tabs are open.`);
  }
}
