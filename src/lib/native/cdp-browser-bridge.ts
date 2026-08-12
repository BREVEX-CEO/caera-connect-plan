/** Extensionless BrowserBridge backed by the companion-supervised Playwright/CDP host. */
import { describeScan, wrapUntrustedContent } from "@/lib/ocade-injection-guard";
import { summarisePage, type DomLike } from "./browser-dom";
import {
  setBrowserBridge,
  type BrowserAction,
  type BrowserActionResult,
  type BrowserBridge,
  type BrowserBridgeStatus,
  type BrowserVerificationExpectation,
  type PerformOptions,
} from "./browser-bridge";

export const MANAGED_BROWSER_PROTOCOL_VERSION = 1;

export interface BrowserHostReply<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface BrowserHostTransport {
  /** Authenticated native IPC. Implementations must never expose a public listener. */
  request<T = unknown>(
    request: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<BrowserHostReply<T>>;
}

export interface ManagedBrowserConfig {
  sessionId: string;
  browser: "chrome" | "edge";
  approvedOrigins: string[] | (() => string[]);
  approvedFileRoots?: string[];
  downloadRoot?: string;
  headless?: boolean;
  userDataDir?: string;
  explicitProfileApproval?: boolean;
  connectEndpoint?: string;
  explicitAttachApproval?: boolean;
}

interface HostObservation {
  url: string;
  title: string;
  verified: boolean;
  failures: string[];
}

interface HostActionReply {
  output?: unknown;
  observation: HostObservation;
}

interface HostPageSummary extends Omit<DomLike, "bodyText"> {
  text: string;
}

function target(target: { selector?: string; role?: string; name?: string; text?: string } = {}) {
  return {
    ...(target.selector ? { selector: target.selector } : {}),
    ...(target.role && target.name ? { role: target.role, name: target.name } : {}),
    ...(target.text ? { text: target.text } : {}),
  };
}

function expectation(value?: BrowserVerificationExpectation): Record<string, unknown> {
  if (!value) return {};
  return {
    ...(value.url ? { url: value.url } : {}),
    ...(value.text ? { text: value.text } : {}),
  };
}

export class ManagedCdpBrowserBridge implements BrowserBridge {
  constructor(
    private readonly transport: BrowserHostTransport,
    private readonly config: ManagedBrowserConfig,
  ) {}

  private async request<T>(
    command: string,
    extra: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const reply = await this.transport.request<T>(
      {
        version: MANAGED_BROWSER_PROTOCOL_VERSION,
        command,
        sessionId: this.config.sessionId,
        ...extra,
      },
      signal,
    );
    if (!reply.ok || reply.data === undefined) {
      throw new Error(reply.error || "The OCADE managed browser host refused the request.");
    }
    return reply.data;
  }

  async connect(): Promise<BrowserBridgeStatus> {
    try {
      await this.request(this.config.connectEndpoint ? "connect" : "launch", {
        browser: this.config.browser,
        headless: this.config.headless === true,
        ...(this.config.userDataDir ? { userDataDir: this.config.userDataDir } : {}),
        ...(this.config.explicitProfileApproval ? { explicitProfileApproval: true } : {}),
        ...(this.config.connectEndpoint ? { connectEndpoint: this.config.connectEndpoint } : {}),
        ...(this.config.explicitAttachApproval ? { explicitAttachApproval: true } : {}),
      });
      return this.status();
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "Browser host failed.",
      };
    }
  }

  async status(): Promise<BrowserBridgeStatus> {
    try {
      const status = await this.request<{ connected: boolean; browser?: "chrome" | "edge" }>(
        "status",
      );
      return status.connected
        ? {
            available: true,
            identity: {
              host: "ocade-managed-browser",
              protocolVersion: MANAGED_BROWSER_PROTOCOL_VERSION,
              browser: status.browser,
              sessionId: this.config.sessionId,
            },
          }
        : { available: false, reason: "The OCADE-managed browser session is not connected." };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "Browser host failed.",
      };
    }
  }

  private async performHost(
    action: Record<string, unknown>,
    opts: PerformOptions,
    verification?: BrowserVerificationExpectation,
  ): Promise<HostActionReply> {
    return this.request<HostActionReply>(
      "perform",
      {
        runId: opts.runId || opts.operationId || crypto.randomUUID(),
        approvedOrigins:
          typeof this.config.approvedOrigins === "function"
            ? this.config.approvedOrigins()
            : this.config.approvedOrigins,
        approvedFileRoots: this.config.approvedFileRoots ?? [],
        allowDownloads: Boolean(this.config.downloadRoot && opts.confirmed),
        ...(this.config.downloadRoot ? { downloadRoot: this.config.downloadRoot } : {}),
        action,
        expectation: expectation(verification ?? opts.verification),
      },
      opts.signal,
    );
  }

  async perform(action: BrowserAction, opts: PerformOptions): Promise<BrowserActionResult> {
    if (opts.signal?.aborted)
      return { ok: false, detail: "This browser action was cancelled before it started." };
    try {
      if (action.kind === "form.fill") {
        let last: HostActionReply | null = null;
        for (const field of action.fields) {
          last = await this.performHost(
            {
              kind: "type",
              value: field.value,
              target: target(field.target ?? { selector: `[name="${field.name}"]` }),
            },
            opts,
          );
        }
        return {
          ok: true,
          detail: `Filled ${action.fields.length} approved field(s).`,
          observation: last?.observation,
        };
      }

      const hostAction: Record<string, unknown> =
        action.kind === "tabs.list"
          ? { kind: "tab.list" }
          : action.kind === "tab.activate"
            ? { kind: "tab.activate", target: { pageIndex: Number(action.tabId) } }
            : action.kind === "tab.create"
              ? { kind: "tab.new" }
              : action.kind === "navigate"
                ? { kind: "navigate", url: action.url }
                : action.kind === "dom.read" || action.kind === "a11y.read"
                  ? { kind: "page.read" }
                  : action.kind === "screenshot"
                    ? { kind: "screenshot", fullPage: true }
                    : action.kind === "page.wait"
                      ? {
                          kind: "wait",
                          timeoutMs: action.timeoutMs,
                          ...(action.expectation.text ? { text: action.expectation.text } : {}),
                          ...(action.expectation.target
                            ? { target: target(action.expectation.target) }
                            : {}),
                        }
                      : action.kind === "form.submit"
                        ? { kind: "click", target: target(action.target) }
                        : action.kind === "download"
                          ? { kind: "download", target: target(action.target) }
                          : action.kind === "upload" || action.kind === "drop"
                            ? { kind: "upload", path: action.path, target: target(action.target) }
                            : { kind: "unsupported" };

      if (action.kind === "tab.create") {
        await this.performHost(hostAction, opts);
        const navigated = await this.performHost({ kind: "navigate", url: action.url }, opts);
        return {
          ok: true,
          detail: `Created and verified a managed tab for ${action.url}.`,
          observation: navigated.observation,
        };
      }

      const reply = await this.performHost(hostAction, opts);
      if (action.kind === "dom.read" || action.kind === "a11y.read") {
        const raw = reply.output as Partial<HostPageSummary> | undefined;
        if (!raw || typeof raw.text !== "string")
          throw new Error("The browser host returned no readable page summary.");
        const summary = summarisePage({
          url: String(raw.url ?? reply.observation.url),
          title: String(raw.title ?? reply.observation.title),
          headings: Array.isArray(raw.headings) ? raw.headings : [],
          bodyText: raw.text,
          fields: Array.isArray(raw.fields) ? raw.fields : [],
          links: Array.isArray(raw.links) ? raw.links : [],
          frames: Array.isArray(raw.frames) ? raw.frames : [],
          openShadowRoots: typeof raw.openShadowRoots === "number" ? raw.openShadowRoots : 0,
        });
        const wrapped = wrapUntrustedContent(summary.text, summary.url || "managed browser page");
        const warning = describeScan(wrapped.scan);
        return {
          ok: true,
          detail:
            warning || `Read and bounded ${summary.text.length} characters from the managed page.`,
          content: wrapped.text,
          injectionRisk: wrapped.scan.risk,
          observation: summary,
        };
      }
      return {
        ok: reply.observation.verified,
        detail: reply.observation.verified
          ? `Managed browser action ${action.kind} was independently observed.`
          : `Managed browser action ${action.kind} could not be verified: ${reply.observation.failures.join(" ")}`,
        observation: { ...reply.observation, output: reply.output },
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Managed browser action failed.",
      };
    }
  }

  async verify(
    _action: BrowserAction,
    verify: BrowserVerificationExpectation,
    opts: Pick<PerformOptions, "runId" | "operationId" | "signal">,
  ): Promise<{ verified: boolean; evidence: string }> {
    try {
      const reply = await this.performHost(
        { kind: "page.read" },
        { ...opts, confirmed: false },
        verify,
      );
      return {
        verified: reply.observation.verified,
        evidence: reply.observation.failures.join(" ") || "Post-action state observed through CDP.",
      };
    } catch (error) {
      return {
        verified: false,
        evidence: error instanceof Error ? error.message : "Browser verification failed.",
      };
    }
  }

  async cancel(runId: string): Promise<{ acknowledged: boolean; detail: string }> {
    return this.request("cancel", { runId });
  }

  async emergencyStop(): Promise<{ acknowledged: boolean; detail: string }> {
    return this.request("emergency_stop");
  }
}

export async function installManagedCdpBrowserBridge(
  transport: BrowserHostTransport,
  config: ManagedBrowserConfig,
): Promise<BrowserBridgeStatus> {
  const bridge = new ManagedCdpBrowserBridge(transport, config);
  const status = await bridge.connect();
  if (status.available) setBrowserBridge(bridge);
  return status;
}
