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

export class OcadeAdapters {
  private python: NativeHostClient | null = null;
  private browser: NativeHostClient | null = null;
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
    this.python = null;
    this.browser = null;
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
      case "system_status":
        return this.systemStatus();
      case "control_find":
        return this.controlFind(a);
      case "control_activate":
        return this.controlActivate(a);
      case "control_set_text":
        return this.controlSetText(a);
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
    const reply = await this.pythonHost().request<{ verified: boolean | null; written: number }>(
      "control.set_text",
      { hwnd, name: text(args.name, "name"), value: text(args.value, "value") },
    );
    if (!reply.ok) return outcomeFor(reply, "That field could not be filled in.");
    return {
      ...ok(reply.data, `Wrote ${reply.data?.written ?? 0} characters into the field.`),
      verified: reply.data?.verified ?? undefined,
    };
  }

  /* --------------------------------------------------------- browser -- */

  private async browserOpen(args: Record<string, unknown>): Promise<ToolOutcome> {
    const kind = args.browser === "edge" ? "edge" : "chrome";
    const sessionId = this.browserSession ?? `ocade${Date.now().toString(36)}`;
    const launched = await this.browserHost().raw(
      { command: "launch", sessionId, browser: kind, headless: false },
      { timeoutMs: 90_000 },
    );
    if (!launched.ok) return outcomeFor(launched, "The managed browser could not be started.");
    this.browserSession = sessionId;
    return ok(launched.data, `Opened a managed ${kind} window.`);
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

  private async browserTabs(): Promise<ToolOutcome> {
    const reply = await this.browserPerform({ kind: "tab.list" });
    if (!reply.ok) return outcomeFor(reply, "The open tabs could not be listed.");
    const output = (reply.data as { output?: unknown[] })?.output ?? [];
    return ok(output, `${Array.isArray(output) ? output.length : 0} tabs are open.`);
  }
}
