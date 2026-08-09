import {
  getCompanion,
  guardAction,
  type CompanionAction,
  type NativeCompanionAdapter,
} from "../native/companion-bridge";
import {
  readBrowserSitePolicy,
  runBrowserAction,
  type BrowserAction,
  type SitePolicy,
} from "../native/browser-bridge";
import type { LiveWorldTool, LiveWorldToolResult } from "./live-world-loop";
import { normalizeWorldState, type ScreenGraph, type WorldState } from "./world-state";
import { PackRegistry } from "../skills/pack-registry";

export interface DesktopLiveWorldRuntime {
  tools: LiveWorldTool[];
  observe(signal: AbortSignal): Promise<Partial<WorldState>>;
  ready(): Promise<{ ready: boolean; reason?: string }>;
}

interface FabricOptions {
  companion?: NativeCompanionAdapter;
  browserPolicy?: () => SitePolicy;
  /** Must reflect a real contextual approval from the authenticated GUI. */
  confirmed?: () => boolean;
  voiceState?: () => Partial<WorldState["voice"]>;
  now?: () => Date;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});
const stringSchema = { type: "string", minLength: 1, maxLength: 2_000 };

function safe(value: unknown, max = 2_000): string {
  return typeof value === "string"
    ? [...value]
        .map((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127 ? " " : character;
        })
        .join("")
        .trim()
        .slice(0, max)
    : "";
}

function operationId(prefix: string): string {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function failed(detail: string): LiveWorldToolResult {
  const normalized = safe(detail, 1_000) || "The typed adapter failed.";
  if (/confirmation|permission|allowed sites|granted/i.test(normalized))
    return { status: "permission_required", evidence: normalized };
  if (/not connected|unavailable|does not support|requires the signed/i.test(normalized))
    return { status: "unsupported", evidence: normalized };
  if (/changed|stale|fingerprint/i.test(normalized))
    return { status: "state_changed", evidence: normalized };
  return { status: "retryable_failure", evidence: normalized };
}

function graphFromAccessibility(
  nodes: Array<{ role: string; name: string; enabled: boolean }>,
): ScreenGraph {
  const elements = nodes.slice(0, 400).map((node, index) => ({
    id: `a11y-${index}-${safe(node.role, 40)}-${safe(node.name, 80)}`,
    role: safe(node.role, 80),
    label: safe(node.name, 300),
    enabled: node.enabled === true,
    confidence: 1,
    sources: ["accessibility"],
    actions: node.enabled ? ["activate"] : [],
  }));
  const fingerprint = elements
    .map((element) => `${element.role}:${element.label}:${element.enabled}`)
    .join("|")
    .slice(0, 4_000);
  return {
    fingerprint: `a11y:${fingerprint}`,
    elements,
    visibleText: [...new Set(elements.map((element) => element.label).filter(Boolean))].slice(
      0,
      120,
    ),
  };
}

function browserActionFrom(name: string, args: Record<string, unknown>): BrowserAction | null {
  const url = safe(args.url);
  const target = {
    ...(safe(args.targetRole, 120) ? { role: safe(args.targetRole, 120) } : {}),
    ...(safe(args.targetName, 300) ? { name: safe(args.targetName, 300) } : {}),
    ...(safe(args.targetText, 300) ? { text: safe(args.targetText, 300) } : {}),
  };
  const hasTarget = Object.keys(target).length > 0;
  switch (name) {
    case "browser.tabs.list":
      return { kind: "tabs.list" };
    case "browser.tab.activate":
      return safe(args.tabId, 200) ? { kind: "tab.activate", tabId: safe(args.tabId, 200) } : null;
    case "browser.tab.create":
      return url ? { kind: "tab.create", url } : null;
    case "browser.navigate":
      return url ? { kind: "navigate", url } : null;
    case "browser.dom.read":
      return url ? { kind: "dom.read", url } : null;
    case "browser.accessibility.read":
      return url ? { kind: "a11y.read", url } : null;
    case "browser.media.read":
      return url ? { kind: "media.read", url } : null;
    case "browser.screenshot":
      return url ? { kind: "screenshot", url } : null;
    case "browser.page.wait": {
      const text = safe(args.text, 500);
      const timeoutMs =
        typeof args.timeoutMs === "number" && Number.isInteger(args.timeoutMs)
          ? Math.max(250, Math.min(30_000, args.timeoutMs))
          : 10_000;
      return url && (text || hasTarget)
        ? {
            kind: "page.wait",
            url,
            expectation: {
              ...(text ? { text } : {}),
              ...(hasTarget ? { target } : {}),
            },
            timeoutMs,
          }
        : null;
    }
    case "browser.form.fill": {
      const fieldName = safe(args.fieldName, 200);
      const value = safe(args.value, 2_000);
      return url && fieldName && value
        ? {
            kind: "form.fill",
            url,
            fields: [{ name: fieldName, value, ...(hasTarget ? { target } : {}) }],
          }
        : null;
    }
    case "browser.form.submit":
      return url && typeof args.consequential === "boolean"
        ? {
            kind: "form.submit",
            url,
            consequential: args.consequential,
            ...(hasTarget ? { target } : {}),
          }
        : null;
    case "browser.download": {
      const filename = safe(args.filename, 300);
      return url && filename
        ? { kind: "download", url, filename, ...(hasTarget ? { target } : {}) }
        : null;
    }
    case "browser.upload": {
      const path = safe(args.path);
      return url && path ? { kind: "upload", url, path, ...(hasTarget ? { target } : {}) } : null;
    }
    case "browser.drop": {
      const path = safe(args.path);
      return url && path && hasTarget ? { kind: "drop", url, path, target } : null;
    }
    default:
      return null;
  }
}

function companionTool(
  companion: NativeCompanionAdapter,
  config: {
    name: string;
    description: string;
    permission: string;
    mutating: boolean;
    parameters: Record<string, unknown>;
    action(args: Record<string, unknown>): CompanionAction | null;
    confirmed(): boolean;
  },
): LiveWorldTool {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    permission: config.permission,
    mutating: config.mutating,
    async execute(args, context) {
      const action = config.action(args);
      if (!action)
        return { status: "blocked", evidence: "The model supplied malformed typed arguments." };
      const confirmed = config.confirmed();
      const refusal = guardAction(action, { confirmed });
      if (refusal) return failed(refusal);
      const result = await companion.execute(action, {
        runId: context.missionId,
        operationId: operationId(config.name),
        confirmed,
        signal: context.signal,
      });
      if (!result.ok) return failed(result.detail);
      if (!config.mutating)
        return {
          status: "success",
          verified: true,
          evidence: result.detail,
          data: result.output,
          route: "native",
        };

      if (action.kind === "app.open") {
        const apps = (await companion.applications?.()) ?? [];
        const verified = apps.some(
          (app) => app.appId.toLowerCase() === action.appId.toLowerCase() && app.processId > 0,
        );
        return {
          status: verified ? "success" : "retryable_failure",
          verified,
          evidence: verified
            ? `${result.detail} Independent application inventory found ${action.appId}.`
            : `${result.detail} The application was not present in the fresh inventory.`,
          route: "native",
        };
      }
      if (action.kind === "selection.replace") {
        const observed = await companion.execute(
          { kind: "selection.read" },
          {
            runId: context.missionId,
            operationId: operationId("selection.verify"),
            signal: context.signal,
          },
        );
        const verified = observed.output?.kind === "text" && observed.output.value === action.text;
        return {
          status: verified ? "success" : "retryable_failure",
          verified,
          evidence: verified
            ? `${result.detail} Independent selection readback matched.`
            : `${result.detail} Selection readback did not match.`,
          route: "accessibility",
        };
      }
      return {
        status: "retryable_failure",
        verified: false,
        evidence: `${result.detail} This action needs a stronger independent post-action observer before completion.`,
        route: "native",
        nextSafeRoute: "accessibility.reobserve",
      };
    },
  };
}

/** Compose the live agent from the adapters already installed by the Tauri GUI. */
export function createDesktopLiveWorldRuntime(
  options: FabricOptions = {},
): DesktopLiveWorldRuntime {
  const companion = options.companion ?? getCompanion();
  const policy = options.browserPolicy ?? readBrowserSitePolicy;
  const confirmed = options.confirmed ?? (() => false);
  const hasVoiceState = options.voiceState !== undefined;
  const voiceState: NonNullable<FabricOptions["voiceState"]> = options.voiceState ?? (() => ({}));
  const packs = new PackRegistry();
  const tools: LiveWorldTool[] = [
    {
      name: "skills.library.list",
      description:
        "List OCADE's tested system and application Skill Pack capabilities and preferred routes.",
      permission: "skills.read",
      mutating: false,
      parameters: objectSchema({}),
      async execute() {
        return {
          status: "success",
          verified: true,
          evidence: "Read the bounded OCADE-owned Skill Pack registry.",
          data: packs.list().map((pack) => ({
            appId: pack.appId,
            displayName: pack.displayName,
            testedVersions: pack.testedVersions,
            coverageNote: pack.coverageNote,
            capabilities: pack.capabilities
              .filter((capability) => capability.tested)
              .map((capability) => ({
                id: capability.id,
                methods: capability.methods,
                mutating: capability.mutating,
                verifyBy: capability.verifyBy,
              })),
          })),
          route: "skill-registry",
        };
      },
    },
    {
      name: "voice.state.read",
      description: "Read the current OCADE microphone, recognizer, speech and mute state.",
      permission: "voice.read",
      mutating: false,
      parameters: objectSchema({}),
      async execute() {
        if (!hasVoiceState) {
          return {
            status: "unsupported",
            evidence: "No authenticated conversation surface supplied current voice state.",
          };
        }
        return {
          status: "success",
          verified: true,
          evidence: "Read voice state from the active authenticated conversation surface.",
          data: voiceState(),
          route: "gui-state",
        };
      },
    },
    {
      name: "system.diagnostics.read",
      description:
        "Read bounded companion health, permissions, applications and window state for diagnostics.",
      permission: "diagnostics.read",
      mutating: false,
      parameters: objectSchema({}),
      async execute(_args, context) {
        const runId = operationId("diagnostics");
        const [status, applications, windows] = await Promise.all([
          companion.status(),
          companion.applications?.().catch(() => []) ?? Promise.resolve([]),
          companion.execute(
            { kind: "window.list" },
            { runId, operationId: operationId("diagnostics.windows"), signal: context.signal },
          ),
        ]);
        if (!status.available)
          return failed(status.reason ?? "The native companion is unavailable.");
        if (!windows.ok) return failed(windows.detail);
        return {
          status: "success",
          verified: true,
          evidence: "Read fresh diagnostics directly from the authenticated native companion.",
          data: { status, applications, windows: windows.output },
          route: "native",
        };
      },
    },
    companionTool(companion, {
      name: "world.screen.read",
      description: "Capture the permitted current screen for on-demand visual inspection.",
      permission: "screen.read",
      mutating: false,
      parameters: objectSchema({}),
      action: () => ({ kind: "screen.read" }),
      confirmed,
    }),
    companionTool(companion, {
      name: "world.accessibility.read",
      description: "Read the current accessibility structure and visible semantic controls.",
      permission: "accessibility.read",
      mutating: false,
      parameters: objectSchema({}),
      action: () => ({ kind: "accessibility.read" }),
      confirmed,
    }),
    companionTool(companion, {
      name: "application.open",
      description: "Open an installed application by semantic application id.",
      permission: "applications.open",
      mutating: true,
      parameters: objectSchema({ appId: stringSchema }, ["appId"]),
      action: (args) =>
        safe(args.appId, 200) ? { kind: "app.open", appId: safe(args.appId, 200) } : null,
      confirmed,
    }),
    companionTool(companion, {
      name: "window.focus",
      description: "Focus a running application window by title or application label.",
      permission: "windows.control",
      mutating: true,
      parameters: objectSchema({ target: stringSchema }, ["target"]),
      action: (args) =>
        safe(args.target, 300) ? { kind: "window.focus", target: safe(args.target, 300) } : null,
      confirmed,
    }),
    companionTool(companion, {
      name: "window.arrange",
      description: "Arrange a window using a semantic target and a bounded standard layout.",
      permission: "windows.control",
      mutating: true,
      parameters: objectSchema(
        {
          layout: { type: "string", enum: ["left", "right", "maximize", "restore"] },
          target: stringSchema,
        },
        ["layout"],
      ),
      action: (args) => {
        const layout = safe(args.layout, 20);
        if (!["left", "right", "maximize", "restore"].includes(layout)) return null;
        const target = safe(args.target, 300);
        return {
          kind: "window.arrange",
          layout: layout as "left" | "right" | "maximize" | "restore",
          ...(target ? { target } : {}),
        };
      },
      confirmed,
    }),
    companionTool(companion, {
      name: "file.open",
      description: "Open a user-approved local file in the best associated application.",
      permission: "files.open",
      mutating: true,
      parameters: objectSchema({ path: stringSchema }, ["path"]),
      action: (args) => (safe(args.path) ? { kind: "file.open", path: safe(args.path) } : null),
      confirmed,
    }),
    companionTool(companion, {
      name: "selection.read",
      description: "Read the user's current selection in the focused application.",
      permission: "selection.read",
      mutating: false,
      parameters: objectSchema({}),
      action: () => ({ kind: "selection.read" }),
      confirmed,
    }),
    companionTool(companion, {
      name: "text.type",
      description: "Type non-protected text into the currently focused semantic control.",
      permission: "input.write",
      mutating: true,
      parameters: objectSchema({ text: stringSchema }, ["text"]),
      action: (args) => (safe(args.text) ? { kind: "text.type", text: safe(args.text) } : null),
      confirmed,
    }),
    companionTool(companion, {
      name: "clipboard.read",
      description: "Read the current clipboard after the user has granted clipboard access.",
      permission: "clipboard.read",
      mutating: false,
      parameters: objectSchema({}),
      action: () => ({ kind: "clipboard.read" }),
      confirmed,
    }),
    companionTool(companion, {
      name: "clipboard.write",
      description: "Write non-protected text to the clipboard.",
      permission: "clipboard.write",
      mutating: true,
      parameters: objectSchema({ text: stringSchema }, ["text"]),
      action: (args) =>
        safe(args.text) ? { kind: "clipboard.write", text: safe(args.text) } : null,
      confirmed,
    }),
    companionTool(companion, {
      name: "selection.replace",
      description: "Replace the current non-protected selection with supplied text.",
      permission: "selection.write",
      mutating: true,
      parameters: objectSchema({ text: stringSchema }, ["text"]),
      action: (args) =>
        safe(args.text) ? { kind: "selection.replace", text: safe(args.text, 20_000) } : null,
      confirmed,
    }),
  ];

  for (const name of [
    "browser.tabs.list",
    "browser.tab.activate",
    "browser.tab.create",
    "browser.navigate",
    "browser.dom.read",
    "browser.accessibility.read",
    "browser.media.read",
    "browser.screenshot",
    "browser.page.wait",
    "browser.form.fill",
    "browser.form.submit",
    "browser.download",
    "browser.upload",
    "browser.drop",
  ] as const) {
    const mutating = [
      "browser.tab.activate",
      "browser.tab.create",
      "browser.navigate",
      "browser.form.fill",
      "browser.form.submit",
      "browser.download",
      "browser.upload",
      "browser.drop",
    ].includes(name);
    const targetProperties = {
      targetRole: stringSchema,
      targetName: stringSchema,
      targetText: stringSchema,
    };
    const parameters = (() => {
      switch (name) {
        case "browser.tabs.list":
          return objectSchema({});
        case "browser.tab.activate":
          return objectSchema({ tabId: stringSchema }, ["tabId"]);
        case "browser.page.wait":
          return objectSchema(
            {
              url: stringSchema,
              text: stringSchema,
              timeoutMs: { type: "number", minimum: 250, maximum: 30_000 },
              ...targetProperties,
            },
            ["url"],
          );
        case "browser.form.fill":
          return objectSchema(
            {
              url: stringSchema,
              fieldName: stringSchema,
              value: stringSchema,
              ...targetProperties,
            },
            ["url", "fieldName", "value"],
          );
        case "browser.form.submit":
          return objectSchema(
            { url: stringSchema, consequential: { type: "boolean" }, ...targetProperties },
            ["url", "consequential"],
          );
        case "browser.download":
          return objectSchema({ url: stringSchema, filename: stringSchema, ...targetProperties }, [
            "url",
            "filename",
          ]);
        case "browser.upload":
          return objectSchema({ url: stringSchema, path: stringSchema, ...targetProperties }, [
            "url",
            "path",
          ]);
        case "browser.drop":
          return objectSchema({ url: stringSchema, path: stringSchema, ...targetProperties }, [
            "url",
            "path",
            "targetName",
          ]);
        default:
          return objectSchema({ url: stringSchema }, ["url"]);
      }
    })();
    tools.push({
      name,
      description: `${mutating ? "Control" : "Observe"} the managed extensionless browser using ${name.replace("browser.", "").replaceAll(".", " ")}.`,
      permission: "browser.control",
      mutating,
      parameters,
      async execute(args, context) {
        const action = browserActionFrom(name, args);
        if (!action)
          return { status: "blocked", evidence: "The browser tool arguments were malformed." };
        const expectedUrl = "url" in action ? action.url : undefined;
        const result = await runBrowserAction(action, policy(), {
          runId: context.missionId,
          operationId: operationId(name),
          confirmed: confirmed(),
          signal: context.signal,
          ...(mutating ? { verification: expectedUrl ? { url: expectedUrl } : {} } : {}),
        });
        if (!result.result.ok) return failed(result.result.detail);
        return {
          status: result.receipt.status === "completed_verified" ? "success" : "retryable_failure",
          verified: result.receipt.status === "completed_verified",
          evidence: [result.receipt.executionEvidence, result.receipt.verificationEvidence]
            .filter(Boolean)
            .join(" "),
          data: result.result.content ?? result.result.observation,
          route: "dom",
          ...(result.receipt.status !== "completed_verified"
            ? { nextSafeRoute: "browser.accessibility.read" }
            : {}),
        };
      },
    });
  }

  const observe = async (signal: AbortSignal): Promise<Partial<WorldState>> => {
    const runId = operationId("observe");
    const currentVoice = voiceState();
    const [status, applications, windows, accessibility, tabs] = await Promise.all([
      companion.status(),
      companion.applications?.().catch(() => []) ?? Promise.resolve([]),
      companion
        .execute({ kind: "window.list" }, { runId, operationId: operationId("windows"), signal })
        .catch(() => null),
      companion
        .execute(
          { kind: "accessibility.read" },
          { runId, operationId: operationId("a11y"), signal },
        )
        .catch(() => null),
      runBrowserAction({ kind: "tabs.list" }, policy(), {
        runId,
        operationId: operationId("tabs"),
        signal,
      }).catch(() => null),
    ]);
    const titles = windows?.output?.kind === "windows" ? windows.output.titles : [];
    const nodes = accessibility?.output?.kind === "accessibility" ? accessibility.output.nodes : [];
    const observedTabs =
      tabs?.result.observation && typeof tabs.result.observation === "object"
        ? ((
            tabs.result.observation as {
              tabs?: Array<{ id?: unknown; title?: unknown; url?: unknown; active?: unknown }>;
            }
          ).tabs ?? [])
        : [];
    return normalizeWorldState({
      revision: 0,
      applications: applications.map((app) => ({
        appId: app.appId,
        label: app.label,
        running: app.processId > 0,
        processId: app.processId,
      })),
      windows: titles.map((title, index) => ({
        windowId: `native-window-${index}`,
        appId: applications.find((app) => app.windowTitle === title)?.appId ?? "unknown",
        title,
        // The V1 window-list contract has no foreground bit. Do not turn
        // enumeration order into a false active-window claim.
        active: false,
      })),
      browser: {
        tabs: observedTabs.map((tab, index) => ({
          id: safe(tab.id, 160) || `tab-${index}`,
          title: safe(tab.title, 300),
          url: safe(tab.url),
          active: tab.active === true,
        })),
      },
      screen: {
        monitors: [],
        changedRegions: [],
        ...(nodes.length ? { graph: graphFromAccessibility(nodes) } : {}),
      },
      input: { heldKeys: [], heldButtons: [], controller: "shared" },
      voice: {
        listening: currentVoice.listening === true,
        speaking: currentVoice.speaking === true,
        muted: currentVoice.muted === true,
        recognizerAvailable: currentVoice.recognizerAvailable === true,
      },
      media: [],
      network: { online: typeof navigator === "undefined" ? true : navigator.onLine },
      devices: [],
      task: { status: "observed" },
      permissions: (status.permissions ?? []).map((permission) => ({
        scope: permission.id,
        state:
          permission.state === "granted" || permission.state === "not_required"
            ? "granted"
            : permission.state === "denied"
              ? "denied"
              : "prompt",
      })),
      recentActions: [],
    });
  };

  return {
    tools,
    observe,
    async ready() {
      const status = await companion.status();
      return status.available ? { ready: true } : { ready: false, reason: status.reason };
    },
  };
}
