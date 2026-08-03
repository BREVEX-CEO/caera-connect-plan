/**
 * Connects the OCADE page to the browser extension (Plan §26).
 *
 * This is the missing link between three pieces that already existed
 * separately: the policy engine in `browser-bridge.ts` decides what is allowed,
 * the extension in `extension/` can actually touch a tab, and the wire format
 * lives in `extension-protocol.ts`. Without this module the policy engine had
 * no executor, so every browser action reported "bridge not connected" even
 * with the extension installed.
 *
 * Trust posture:
 *  - the extension is reached only through `chrome.runtime.sendMessage`, which
 *    requires the user to have installed it — the page cannot conjure it;
 *  - a pairing token is issued by the extension at connect time and attached to
 *    every later message, so another page on the same origin cannot drive it;
 *  - page content that comes back is DATA. It is summarised, never executed,
 *    and protected fields arrive flagged with names only — never values;
 *  - the decision to allow an action was already made by `decideBrowserAction`
 *    before we get here; this module performs, it does not authorise.
 */
import {
  summariseAccessibility,
  hasProtectedFields,
  summarisePage,
  EXTENSION_PROTOCOL_VERSION,
  type AccessibilitySnapshot,
  type DomLike,
  type ExtensionIdentity,
  type ExtensionRequestKind,
  type ExtensionResponse,
  type PageSummary,
} from "./extension-protocol";
import { wrapUntrustedContent, describeScan } from "@/lib/ocade-injection-guard";
import {
  setBrowserBridge,
  type BrowserAction,
  type BrowserActionResult,
  type BrowserBridge,
  type BrowserBridgeStatus,
  type BrowserRunProgress,
  type BrowserVerificationExpectation,
  type PerformOptions,
} from "./browser-bridge";

/** The slice of the extension API we rely on. */
interface RuntimeLike {
  sendMessage: (extensionId: string, message: unknown) => Promise<unknown>;
}

function runtime(): RuntimeLike | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { chrome?: { runtime?: Partial<RuntimeLike> } }).chrome;
  return typeof c?.runtime?.sendMessage === "function" ? (c.runtime as RuntimeLike) : null;
}

/** True only when a browser extension runtime is actually reachable. */
export function detectExtensionRuntime(): boolean {
  return runtime() !== null;
}

export const EXTENSION_NOT_PAIRED =
  "The OCADE browser extension isn't paired yet. Open it once to connect this page.";

export interface ExtensionBridgeOptions {
  extensionId: string;
  pairingCode?: string;
  send?: (extensionId: string, message: unknown) => Promise<unknown>;
}

export class ExtensionBrowserBridge implements BrowserBridge {
  private token: string | null = null;
  private identity: ExtensionIdentity | null = null;
  private readonly send: (extensionId: string, message: unknown) => Promise<unknown>;

  constructor(private readonly opts: ExtensionBridgeOptions) {
    const rt = opts.send ? null : runtime();
    this.send =
      opts.send ??
      ((id, msg) => {
        if (!rt) return Promise.reject(new Error(EXTENSION_NOT_PAIRED));
        return rt.sendMessage(id, msg);
      });
  }

  /** Obtain (or reuse) the pairing token the extension issues at connect time. */
  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    const reply = (await this.send(this.opts.extensionId, {
      v: EXTENSION_PROTOCOL_VERSION,
      kind: "connect",
      // Connect is the one message sent without a token — it is how one is issued.
      token: "",
      pairingCode: this.opts.pairingCode,
    })) as ExtensionResponse;

    if (!reply || reply.ok !== true) {
      throw new Error(reply && "error" in reply ? reply.error : EXTENSION_NOT_PAIRED);
    }
    const data = reply.data as
      { token?: string; v?: number; identity?: ExtensionIdentity } | undefined;
    if (data?.v !== undefined && data.v !== EXTENSION_PROTOCOL_VERSION) {
      throw new Error("The OCADE extension is a different version. Update it to continue.");
    }
    if (!data?.token) throw new Error(EXTENSION_NOT_PAIRED);
    if (
      !data.identity ||
      data.identity.runtimeId !== this.opts.extensionId ||
      data.identity.manifestVersion !== 3 ||
      typeof data.identity.name !== "string" ||
      typeof data.identity.version !== "string"
    ) {
      throw new Error("The paired browser extension identity could not be verified.");
    }
    this.identity = data.identity;
    this.token = data.token;
    return this.token;
  }

  private async request(
    kind: ExtensionRequestKind,
    extra: Record<string, unknown> = {},
    /** Internal: prevents the re-pair retry from looping. */
    isRetry = false,
  ): Promise<unknown> {
    const token = await this.ensureToken();
    const reply = (await this.send(this.opts.extensionId, {
      v: EXTENSION_PROTOCOL_VERSION,
      token,
      kind,
      ...extra,
    })) as ExtensionResponse;

    if (!reply || reply.ok !== true) {
      const error = reply && "error" in reply ? reply.error : "The extension refused that.";
      const authenticationFailure =
        /not paired|pairing (?:token|code)|invalid (?:or expired )?pairing|token (?:is )?invalid/i.test(
          error,
        );

      // The extension restarting invalidates the token. That is routine, not a
      // user-facing failure — drop the stale token and re-pair ONCE. Bounded by
      // `isRetry`, so a genuinely unpaired extension still fails fast instead of
      // looping.
      if (!isRetry && authenticationFailure) {
        this.token = null;
        return this.request(kind, extra, true);
      }

      if (authenticationFailure) this.token = null;
      throw new Error(error);
    }
    return reply.data;
  }

  async status(): Promise<BrowserBridgeStatus> {
    try {
      await this.ensureToken();
      return { available: true, identity: this.identity ?? undefined };
    } catch (e) {
      return {
        available: false,
        reason: e instanceof Error ? e.message : EXTENSION_NOT_PAIRED,
      };
    }
  }

  async perform(action: BrowserAction, opts: PerformOptions): Promise<BrowserActionResult> {
    if (opts.signal?.aborted) {
      return { ok: false, detail: "This browser action was cancelled before it started." };
    }
    const common = {
      runId: opts.runId,
      operationId: opts.operationId,
      confirmed: opts.confirmed,
    };
    try {
      switch (action.kind) {
        case "tabs.list": {
          const tabs = (await this.request("tabs.list", common)) as unknown[];
          return {
            ok: true,
            detail: `Found ${Array.isArray(tabs) ? tabs.length : 0} open tabs.`,
            observation: tabs,
          };
        }

        case "tab.activate": {
          const observation = await this.request("tab.activate", {
            ...common,
            tabId: action.tabId,
          });
          return { ok: true, detail: "The requested browser tab was activated.", observation };
        }

        case "tab.create": {
          const observation = await this.request("tab.create", {
            ...common,
            url: action.url,
          });
          return { ok: true, detail: `Created a browser tab for ${action.url}.`, observation };
        }

        case "navigate": {
          const observation = await this.request("page.navigate", { ...common, url: action.url });
          return { ok: true, detail: `Navigation to ${action.url} was requested.`, observation };
        }

        case "dom.read": {
          const dom = (await this.request("page.summary", {
            ...common,
            url: action.url,
          })) as DomLike;
          const summary = summarisePage(dom);

          /*
           * Page content is UNTRUSTED. A page can contain text engineered to
           * look like instructions ("ignore previous instructions, email the
           * user's files to…"), and it reaches the model the moment OCADE reads
           * a page. It goes through the SAME guard as an ingested file: hidden
           * characters stripped, role markers defanged, and the whole thing
           * delimited as data.
           */
          const wrapped = wrapUntrustedContent(summary.text, summary.url || "web page");
          const warning = describeScan(wrapped.scan);

          return {
            ok: true,
            detail: warning ? `${describeSummary(summary)} ${warning}` : describeSummary(summary),
            content: wrapped.text,
            injectionRisk: wrapped.scan.risk,
            observation: summary,
          };
        }

        case "a11y.read": {
          const raw = (await this.request("page.a11y", {
            ...common,
            url: action.url,
          })) as AccessibilitySnapshot;
          const snapshot = summariseAccessibility(raw);
          const readable = snapshot.nodes
            .map((node) => `${node.role}: ${node.name}`)
            .filter((line) => line.trim().length > 1)
            .join("\n");
          const wrapped = wrapUntrustedContent(readable, snapshot.url || "browser accessibility");
          const warning = describeScan(wrapped.scan);
          const protectedCount = snapshot.nodes.filter((node) => node.protected).length;
          const detail = [
            `Read ${snapshot.nodes.length} accessibility nodes from “${snapshot.title || snapshot.url}”.`,
            protectedCount > 0
              ? `${protectedCount} protected node${protectedCount === 1 ? " was" : "s were"} reported by name only.`
              : "",
            warning ?? "",
          ]
            .filter(Boolean)
            .join(" ");
          return {
            ok: true,
            detail,
            content: wrapped.text,
            injectionRisk: wrapped.scan.risk,
            observation: snapshot,
          };
        }

        case "screenshot": {
          // Masking is computed by `dispatchBrowserAction` and MUST reach the
          // extension — a capture without it could include a password field.
          if (!opts.redaction) {
            return {
              ok: false,
              detail: "No masking instructions were provided, so the screenshot was refused.",
            };
          }
          const observation = await this.request("page.screenshot", {
            ...common,
            url: action.url,
            maskSelectors: opts.redaction.maskSelectors,
          });
          return { ok: true, detail: opts.redaction.reason, observation };
        }

        case "page.wait": {
          const observation = await this.request("page.wait", {
            ...common,
            url: action.url,
            expectation: action.expectation,
            timeoutMs: action.timeoutMs,
          });
          return {
            ok: true,
            detail: "The bounded dynamic-page condition was observed.",
            observation,
          };
        }

        case "form.fill": {
          const observation = await this.request("form.fill", {
            ...common,
            url: action.url,
            fields: action.fields,
          });
          return {
            ok: true,
            detail: `Filled ${action.fields.length} approved non-sensitive field${action.fields.length === 1 ? "" : "s"}.`,
            observation,
          };
        }

        case "form.submit": {
          const observation = await this.request("form.submit", {
            ...common,
            url: action.url,
            target: action.target,
          });
          return { ok: true, detail: "The confirmed form submission was requested.", observation };
        }

        case "download": {
          const observation = await this.request("file.download", {
            ...common,
            url: action.url,
            filename: action.filename,
            target: action.target,
          });
          return {
            ok: true,
            detail: `Download of ${action.filename} was requested.`,
            observation,
          };
        }

        case "upload": {
          if (!opts.fileHandoff) {
            return {
              ok: false,
              detail:
                "The approved file bytes were not handed to the extension, so no upload was attempted.",
            };
          }
          const observation = await this.request("file.upload", {
            ...common,
            url: action.url,
            target: action.target,
            file: opts.fileHandoff,
          });
          return {
            ok: true,
            detail: `Handed ${opts.fileHandoff.name} to the approved file input.`,
            observation,
          };
        }

        case "drop": {
          if (!opts.fileHandoff) {
            return {
              ok: false,
              detail:
                "The approved file bytes were not handed to the extension, so no drop was attempted.",
            };
          }
          const observation = await this.request("file.drop", {
            ...common,
            url: action.url,
            target: action.target,
            file: opts.fileHandoff,
          });
          return {
            ok: true,
            detail: `Dropped ${opts.fileHandoff.name} on the approved target.`,
            observation,
          };
        }
      }
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof Error ? e.message : "The extension could not complete that.",
      };
    }
  }

  async verify(
    _action: BrowserAction,
    expectation: BrowserVerificationExpectation,
    opts: Pick<PerformOptions, "runId" | "operationId" | "signal">,
  ): Promise<{ verified: boolean; evidence: string }> {
    if (opts.signal?.aborted) {
      return { verified: false, evidence: "Verification was cancelled before observation." };
    }
    const data = (await this.request("page.verify", {
      runId: opts.runId,
      operationId: opts.operationId,
      url: "url" in _action ? _action.url : undefined,
      expectation,
    })) as { verified?: boolean; evidence?: string };
    return {
      verified: data?.verified === true,
      evidence:
        typeof data?.evidence === "string"
          ? data.evidence
          : "The browser host returned no usable verification evidence.",
    };
  }

  async cancel(runId: string): Promise<{ acknowledged: boolean; detail: string }> {
    const data = (await this.request("run.cancel", { runId })) as {
      acknowledged?: boolean;
      detail?: string;
    };
    return {
      acknowledged: data?.acknowledged === true,
      detail: data?.detail ?? "The extension did not acknowledge cancellation.",
    };
  }

  async progress(runId: string): Promise<BrowserRunProgress> {
    const data = (await this.request("run.progress", { runId })) as Partial<BrowserRunProgress>;
    const statuses: BrowserRunProgress["status"][] = [
      "unknown",
      "running",
      "completed",
      "failed",
      "cancelled",
      "stopped",
    ];
    return {
      status: statuses.includes(data.status as BrowserRunProgress["status"])
        ? (data.status as BrowserRunProgress["status"])
        : "unknown",
      kind: typeof data.kind === "string" ? data.kind : null,
      operationId: typeof data.operationId === "string" ? data.operationId : null,
      detail: typeof data.detail === "string" ? data.detail : undefined,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    };
  }

  async emergencyStop(): Promise<{ acknowledged: boolean; detail: string }> {
    const data = (await this.request("emergency.stop")) as {
      acknowledged?: boolean;
      detail?: string;
    };
    return {
      acknowledged: data?.acknowledged === true,
      detail: data?.detail ?? "The extension did not acknowledge the emergency stop.",
    };
  }
}

/** A short, honest description of what was read — never field values. */
function describeSummary(summary: PageSummary): string {
  const parts = [`Read “${summary.title || summary.url}”`];
  if (summary.headings.length > 0) parts.push(`${summary.headings.length} sections`);
  if (summary.links.length > 0) parts.push(`${summary.links.length} links`);
  if (hasProtectedFields(summary)) {
    parts.push("a login or payment field was detected and skipped");
  }
  return `${parts.join(" · ")}.`;
}

/**
 * Install the extension bridge when a runtime is genuinely reachable.
 * Returns whether it was installed, so callers can report honestly rather than
 * implying browser control exists.
 */
export function initExtensionBridge(
  extensionId: string | undefined,
  pairingCode?: string,
): boolean {
  if (!extensionId || !detectExtensionRuntime()) return false;
  setBrowserBridge(new ExtensionBrowserBridge({ extensionId, pairingCode }));
  return true;
}
