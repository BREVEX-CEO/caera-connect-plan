/**
 * OCADE software-control adapter SDK (Plan §25, decisions #8, #9).
 *
 * A capability-based registry so new software integrations can be added without
 * rewriting the core. Each adapter DECLARES the capabilities it supports; the
 * registry routes an action to the first adapter that supports it, refuses
 * anything unsupported with an honest report, and enforces the risk/consent
 * rules from the companion bridge before anything executes.
 *
 * V1 adapters: browser, approved files/folders, window management. All of them
 * ultimately execute through the signed Native Companion — until that is
 * connected, execution fails loudly rather than pretending to succeed.
 */
import {
  guardAction,
  redactForAudit,
  riskOf,
  type ActionRisk,
  type CompanionAction,
  type ExecuteOptions,
  type ExecuteResult,
} from "./companion-bridge";

export type AdapterId = "browser" | "files" | "windows" | (string & {});

export interface AdapterCapability {
  /** Action kind this adapter can perform, e.g. "window.focus". */
  kind: CompanionAction["kind"];
  /** Human label used in permission prompts and the capability list. */
  label: string;
}

export interface SoftwareAdapter {
  id: AdapterId;
  label: string;
  capabilities: AdapterCapability[];
  /** True when the adapter's backing runtime is connected and usable. */
  isAvailable(): Promise<boolean>;
  execute(action: CompanionAction, opts: ExecuteOptions): Promise<ExecuteResult>;
}

export type DispatchOutcome =
  | { status: "ok"; result: ExecuteResult }
  | { status: "refused"; reason: string; risk: ActionRisk }
  | { status: "unsupported"; reason: string }
  | { status: "unavailable"; adapterId: AdapterId; reason: string }
  | { status: "failed"; reason: string };

export class AdapterRegistry {
  private adapters = new Map<AdapterId, SoftwareAdapter>();

  register(adapter: SoftwareAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter "${adapter.id}" is already registered.`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: AdapterId): SoftwareAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): SoftwareAdapter[] {
    return [...this.adapters.values()];
  }

  /** Every action kind any registered adapter can perform. */
  supportedKinds(): CompanionAction["kind"][] {
    const kinds = new Set<CompanionAction["kind"]>();
    for (const a of this.adapters.values()) {
      for (const c of a.capabilities) kinds.add(c.kind);
    }
    return [...kinds];
  }

  supports(kind: CompanionAction["kind"]): boolean {
    return this.supportedKinds().includes(kind);
  }

  findFor(kind: CompanionAction["kind"]): SoftwareAdapter | undefined {
    for (const a of this.adapters.values()) {
      if (a.capabilities.some((c) => c.kind === kind)) return a;
    }
    return undefined;
  }

  /**
   * Route an action: guard it (risk + consent + protected-input prohibition),
   * confirm an adapter supports it and is available, then execute. Never
   * silently substitutes a different action or fakes success.
   */
  async dispatch(action: CompanionAction, opts: ExecuteOptions): Promise<DispatchOutcome> {
    const refusal = guardAction(action, { confirmed: opts.confirmed });
    if (refusal) {
      return { status: "refused", reason: refusal, risk: riskOf(action) };
    }

    const adapter = this.findFor(action.kind);
    if (!adapter) {
      return {
        status: "unsupported",
        reason: `OCADE has no adapter for "${action.kind}" yet.`,
      };
    }

    if (!(await adapter.isAvailable())) {
      return {
        status: "unavailable",
        adapterId: adapter.id,
        reason: `${adapter.label} isn't connected. Computer control needs the CAERA Native Companion.`,
      };
    }

    try {
      const result = await adapter.execute(action, opts);
      return { status: "ok", result };
    } catch (e) {
      return {
        status: "failed",
        reason: redactForAudit(e instanceof Error ? e.message : String(e)),
      };
    }
  }
}

/* ------------------------------------------------------------ V1 adapters -- */

/**
 * Adapters declare real capabilities but delegate execution to the companion.
 * `executor` is supplied by the desktop build once a signed companion exists;
 * without it the adapter reports unavailable (never a simulated action).
 */
export function createCompanionBackedAdapter(input: {
  id: AdapterId;
  label: string;
  capabilities: AdapterCapability[];
  executor?: {
    isAvailable(): Promise<boolean>;
    execute(action: CompanionAction, opts: ExecuteOptions): Promise<ExecuteResult>;
  };
}): SoftwareAdapter {
  return {
    id: input.id,
    label: input.label,
    capabilities: input.capabilities,
    isAvailable: async () => (input.executor ? input.executor.isAvailable() : false),
    execute: async (action, opts) => {
      if (!input.executor) {
        throw new Error(`${input.label} has no connected executor.`);
      }
      return input.executor.execute(action, opts);
    },
  };
}

export const BROWSER_CAPABILITIES: AdapterCapability[] = [
  { kind: "screen.read", label: "Read the visible page" },
  { kind: "text.type", label: "Type approved text into a field" },
  { kind: "clipboard.read", label: "Read the clipboard" },
  { kind: "clipboard.write", label: "Write to the clipboard" },
];

export const FILES_CAPABILITIES: AdapterCapability[] = [
  { kind: "file.open", label: "Open an approved file or folder" },
];

export const WINDOWS_CAPABILITIES: AdapterCapability[] = [
  { kind: "window.list", label: "List open windows" },
  { kind: "window.focus", label: "Focus a window" },
  { kind: "window.arrange", label: "Move or resize a window" },
  { kind: "app.open", label: "Open an approved application" },
];

/** Build the V1 registry (browser + files + windows). */
export function createDefaultRegistry(executors?: {
  browser?: Parameters<typeof createCompanionBackedAdapter>[0]["executor"];
  files?: Parameters<typeof createCompanionBackedAdapter>[0]["executor"];
  windows?: Parameters<typeof createCompanionBackedAdapter>[0]["executor"];
}): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register(
    createCompanionBackedAdapter({
      id: "browser",
      label: "Browser control",
      capabilities: BROWSER_CAPABILITIES,
      executor: executors?.browser,
    }),
  );
  reg.register(
    createCompanionBackedAdapter({
      id: "files",
      label: "Files and folders",
      capabilities: FILES_CAPABILITIES,
      executor: executors?.files,
    }),
  );
  reg.register(
    createCompanionBackedAdapter({
      id: "windows",
      label: "Window management",
      capabilities: WINDOWS_CAPABILITIES,
      executor: executors?.windows,
    }),
  );
  return reg;
}
