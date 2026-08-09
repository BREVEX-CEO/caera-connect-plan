import type { ScreenRect, SetOfMarkPlan } from "../control/perception";

export type WorldActionStatus =
  | "success"
  | "retryable_failure"
  | "blocked"
  | "cancelled"
  | "permission_required"
  | "state_changed"
  | "unsupported";

export interface WorldElement {
  id: string;
  role: string;
  label: string;
  bounds?: ScreenRect;
  enabled: boolean;
  confidence: number;
  sources: string[];
  actions: string[];
  state?: string;
}

export interface ScreenGraph {
  fingerprint: string;
  windowId?: string;
  elements: WorldElement[];
  visibleText: string[];
}

export interface WorldState {
  schemaVersion: 1;
  revision: number;
  observedAt: string;
  active?: {
    appId: string;
    processId?: number;
    executable?: string;
    version?: string;
    windowId?: string;
    title?: string;
    bounds?: ScreenRect;
  };
  applications: Array<{ appId: string; label: string; running: boolean; processId?: number }>;
  windows: Array<{
    windowId: string;
    appId: string;
    title: string;
    active: boolean;
    bounds?: ScreenRect;
  }>;
  browser: {
    tabs: Array<{ id: string; title: string; url: string; active: boolean }>;
    pageFingerprint?: string;
  };
  screen: {
    monitors: Array<{ id: string; bounds: ScreenRect; scale: number }>;
    graph?: ScreenGraph;
    changedRegions: ScreenRect[];
  };
  cursor?: { x: number; y: number };
  input: {
    heldKeys: string[];
    heldButtons: string[];
    lastPhysicalInputAt?: string;
    controller: "user" | "ocade" | "shared";
  };
  voice: {
    listening: boolean;
    speaking: boolean;
    muted: boolean;
    recognizerAvailable: boolean;
  };
  media: Array<{
    appId: string;
    title?: string;
    playing: boolean;
    advert?: "skippable" | "unskippable" | "none" | "unknown";
  }>;
  network: { online: boolean; metered?: boolean };
  devices: Array<{ id: string; kind: string; label: string; connected: boolean }>;
  task: { missionId?: string; status: string; pendingGoal?: string };
  permissions: Array<{ scope: string; state: "granted" | "denied" | "prompt" | "unavailable" }>;
  recentActions: Array<{
    at: string;
    capability: string;
    status: WorldActionStatus;
    evidence: string;
  }>;
}

export interface WorldStateDelta {
  fromRevision: number;
  toRevision: number;
  changes: string[];
  addedElements: WorldElement[];
  removedElementIds: string[];
  changedElements: WorldElement[];
}

const LIMITS = {
  apps: 128,
  windows: 128,
  tabs: 64,
  elements: 400,
  visibleText: 120,
  text: 500,
  recentActions: 24,
  devices: 64,
  permissions: 64,
  changedRegions: 32,
} as const;

function text(value: unknown, max: number = LIMITS.text): string {
  return typeof value === "string"
    ? [...value]
        .map((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127 ? " " : character;
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function rect(value: unknown): ScreenRect | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ScreenRect>;
  if (
    !finite(candidate.x) ||
    !finite(candidate.y) ||
    !finite(candidate.width) ||
    !finite(candidate.height) ||
    candidate.width <= 0 ||
    candidate.height <= 0 ||
    candidate.width > 100_000 ||
    candidate.height > 100_000
  )
    return undefined;
  return { x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height };
}

function boundedStrings(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => text(item, 160))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function safeRevision(value: unknown): number {
  return finite(value) && value >= 0 ? Math.floor(value) : 0;
}

function date(value: unknown, fallback: string): string {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Convert a fused perception plan into the compact graph the planner sees. */
export function screenGraphFromPlan(plan: SetOfMarkPlan): ScreenGraph {
  const marks = new Map(plan.markers.map((marker) => [marker.targetKey, marker.number]));
  const elements = plan.elements.slice(0, LIMITS.elements).map((element) => ({
    id: text(element.targetKey, 200),
    role: text(element.role, 80),
    label: text(element.name, 300),
    bounds: rect(element.boundsPhysical),
    enabled: element.enabled,
    confidence: Math.max(0, Math.min(1, element.confidence)),
    sources: element.sources.map((source) => source.source).slice(0, 4),
    actions: element.interactive
      ? ["activate", ...(element.role === "textbox" ? ["write"] : [])]
      : [],
    ...(element.state ? { state: text(element.state, 160) } : {}),
    ...(marks.has(element.targetKey) ? { state: `mark:${marks.get(element.targetKey)}` } : {}),
  }));
  return {
    fingerprint: text(plan.fingerprint, 200),
    windowId: text(plan.window.windowId, 200) || undefined,
    elements,
    visibleText: [...new Set(elements.map((element) => element.label).filter(Boolean))].slice(
      0,
      LIMITS.visibleText,
    ),
  };
}

/**
 * Treat every host observation as untrusted and compact it before model use.
 * This is also the context-growth boundary: no raw screenshot or full tree is
 * retained here.
 */
export function normalizeWorldState(input: Partial<WorldState>, now = new Date()): WorldState {
  const observedAt = now.toISOString();
  const active = input.active;
  const normalizedActive =
    active && text(active.appId, 160)
      ? {
          appId: text(active.appId, 160),
          ...(finite(active.processId) ? { processId: Math.floor(active.processId) } : {}),
          ...(text(active.executable, 260) ? { executable: text(active.executable, 260) } : {}),
          ...(text(active.version, 80) ? { version: text(active.version, 80) } : {}),
          ...(text(active.windowId, 160) ? { windowId: text(active.windowId, 160) } : {}),
          ...(text(active.title, 300) ? { title: text(active.title, 300) } : {}),
          ...(rect(active.bounds) ? { bounds: rect(active.bounds) } : {}),
        }
      : undefined;
  const graph = input.screen?.graph;
  const normalizedGraph =
    graph && text(graph.fingerprint, 200)
      ? {
          fingerprint: text(graph.fingerprint, 200),
          ...(text(graph.windowId, 160) ? { windowId: text(graph.windowId, 160) } : {}),
          elements: uniqueBy(
            (graph.elements ?? []).slice(0, LIMITS.elements).map((element) => ({
              id: text(element.id, 200),
              role: text(element.role, 80),
              label: text(element.label, 300),
              ...(rect(element.bounds) ? { bounds: rect(element.bounds) } : {}),
              enabled: element.enabled === true,
              confidence: finite(element.confidence)
                ? Math.max(0, Math.min(1, element.confidence))
                : 0,
              sources: boundedStrings(element.sources, 6),
              actions: boundedStrings(element.actions, 12),
              ...(text(element.state, 160) ? { state: text(element.state, 160) } : {}),
            })),
            (element) => element.id,
          ),
          visibleText: boundedStrings(graph.visibleText, LIMITS.visibleText),
        }
      : undefined;

  return {
    schemaVersion: 1,
    revision: safeRevision(input.revision),
    observedAt: date(input.observedAt, observedAt),
    ...(normalizedActive ? { active: normalizedActive } : {}),
    applications: uniqueBy(
      (input.applications ?? []).slice(0, LIMITS.apps).map((app) => ({
        appId: text(app.appId, 160),
        label: text(app.label, 200),
        running: app.running === true,
        ...(finite(app.processId) ? { processId: Math.floor(app.processId) } : {}),
      })),
      (app) => app.appId,
    ),
    windows: uniqueBy(
      (input.windows ?? []).slice(0, LIMITS.windows).map((window) => ({
        windowId: text(window.windowId, 160),
        appId: text(window.appId, 160),
        title: text(window.title, 300),
        active: window.active === true,
        ...(rect(window.bounds) ? { bounds: rect(window.bounds) } : {}),
      })),
      (window) => window.windowId,
    ),
    browser: {
      tabs: uniqueBy(
        (input.browser?.tabs ?? []).slice(0, LIMITS.tabs).map((tab) => ({
          id: text(tab.id, 160),
          title: text(tab.title, 300),
          url: text(tab.url, 2_000),
          active: tab.active === true,
        })),
        (tab) => tab.id,
      ),
      ...(text(input.browser?.pageFingerprint, 200)
        ? { pageFingerprint: text(input.browser?.pageFingerprint, 200) }
        : {}),
    },
    screen: {
      monitors: uniqueBy(
        (input.screen?.monitors ?? []).slice(0, 16).flatMap((monitor) => {
          const bounds = rect(monitor.bounds);
          const id = text(monitor.id, 80);
          return bounds && id
            ? [
                {
                  id,
                  bounds,
                  scale: finite(monitor.scale) ? Math.max(0.25, Math.min(8, monitor.scale)) : 1,
                },
              ]
            : [];
        }),
        (monitor) => monitor.id,
      ),
      ...(normalizedGraph ? { graph: normalizedGraph } : {}),
      changedRegions: (input.screen?.changedRegions ?? [])
        .slice(0, LIMITS.changedRegions)
        .flatMap((region) => (rect(region) ? [rect(region)!] : [])),
    },
    ...(input.cursor && finite(input.cursor.x) && finite(input.cursor.y)
      ? { cursor: { x: input.cursor.x, y: input.cursor.y } }
      : {}),
    input: {
      heldKeys: boundedStrings(input.input?.heldKeys, 32),
      heldButtons: boundedStrings(input.input?.heldButtons, 8),
      ...(text(input.input?.lastPhysicalInputAt, 80)
        ? { lastPhysicalInputAt: date(input.input?.lastPhysicalInputAt, observedAt) }
        : {}),
      controller: ["user", "ocade", "shared"].includes(input.input?.controller ?? "")
        ? input.input!.controller
        : "shared",
    },
    voice: {
      listening: input.voice?.listening === true,
      speaking: input.voice?.speaking === true,
      muted: input.voice?.muted === true,
      recognizerAvailable: input.voice?.recognizerAvailable === true,
    },
    media: (input.media ?? []).slice(0, 32).map((item) => ({
      appId: text(item.appId, 160),
      ...(text(item.title, 300) ? { title: text(item.title, 300) } : {}),
      playing: item.playing === true,
      advert: ["skippable", "unskippable", "none", "unknown"].includes(item.advert ?? "")
        ? item.advert
        : "unknown",
    })),
    network: {
      online: input.network?.online === true,
      ...(input.network?.metered !== undefined ? { metered: input.network.metered === true } : {}),
    },
    devices: uniqueBy(
      (input.devices ?? []).slice(0, LIMITS.devices).map((device) => ({
        id: text(device.id, 160),
        kind: text(device.kind, 80),
        label: text(device.label, 200),
        connected: device.connected === true,
      })),
      (device) => device.id,
    ),
    task: {
      ...(text(input.task?.missionId, 160) ? { missionId: text(input.task?.missionId, 160) } : {}),
      status: text(input.task?.status, 80) || "idle",
      ...(text(input.task?.pendingGoal, 1_000)
        ? { pendingGoal: text(input.task?.pendingGoal, 1_000) }
        : {}),
    },
    permissions: uniqueBy(
      (input.permissions ?? []).slice(0, LIMITS.permissions).map((permission) => ({
        scope: text(permission.scope, 160),
        state: ["granted", "denied", "prompt", "unavailable"].includes(permission.state)
          ? permission.state
          : "unavailable",
      })),
      (permission) => permission.scope,
    ),
    recentActions: (input.recentActions ?? []).slice(-LIMITS.recentActions).map((action) => ({
      at: date(action.at, observedAt),
      capability: text(action.capability, 160),
      status: [
        "success",
        "retryable_failure",
        "blocked",
        "cancelled",
        "permission_required",
        "state_changed",
        "unsupported",
      ].includes(action.status)
        ? action.status
        : "blocked",
      evidence: text(action.evidence, 500),
    })),
  };
}

export function diffWorldState(previous: WorldState, current: WorldState): WorldStateDelta {
  const changes: string[] = [];
  if (
    previous.active?.windowId !== current.active?.windowId ||
    previous.active?.title !== current.active?.title
  ) {
    changes.push(
      `active window changed from ${previous.active?.title || "none"} to ${current.active?.title || "none"}`,
    );
  }
  if (previous.browser.tabs.length !== current.browser.tabs.length) {
    changes.push(
      `browser tab count changed from ${previous.browser.tabs.length} to ${current.browser.tabs.length}`,
    );
  }
  if (
    previous.media.some((media) => media.playing) !== current.media.some((media) => media.playing)
  ) {
    changes.push(
      current.media.some((media) => media.playing)
        ? "media playback started"
        : "media playback stopped",
    );
  }
  if (previous.network.online !== current.network.online)
    changes.push(
      current.network.online ? "network became available" : "network became unavailable",
    );
  if (
    previous.input.controller !== current.input.controller ||
    previous.voice.listening !== current.voice.listening ||
    previous.voice.speaking !== current.voice.speaking
  ) {
    changes.push("human-agent input or voice state changed");
  }

  const before = new Map(
    (previous.screen.graph?.elements ?? []).map((element) => [element.id, element]),
  );
  const after = new Map(
    (current.screen.graph?.elements ?? []).map((element) => [element.id, element]),
  );
  const addedElements = [...after]
    .filter(([id]) => !before.has(id))
    .map(([, element]) => element)
    .slice(0, 80);
  const removedElementIds = [...before.keys()].filter((id) => !after.has(id)).slice(0, 80);
  const changedElements = [...after]
    .filter(
      ([id, element]) =>
        before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(element),
    )
    .map(([, element]) => element)
    .slice(0, 80);
  if (addedElements.length) changes.push(`${addedElements.length} screen element(s) appeared`);
  if (removedElementIds.length)
    changes.push(`${removedElementIds.length} screen element(s) disappeared`);
  if (changedElements.length) changes.push(`${changedElements.length} screen element(s) changed`);
  if (
    changes.length === 0 &&
    previous.screen.graph?.fingerprint !== current.screen.graph?.fingerprint
  ) {
    changes.push("screen pixels changed without a structural element change");
  }
  return {
    fromRevision: previous.revision,
    toRevision: current.revision,
    changes,
    addedElements,
    removedElementIds,
    changedElements,
  };
}

export function compactWorldState(
  state: WorldState,
  delta?: WorldStateDelta,
): Record<string, unknown> {
  return {
    revision: state.revision,
    observedAt: state.observedAt,
    active: state.active,
    runningApps: state.applications.filter((app) => app.running).slice(0, 32),
    windows: state.windows
      .filter((window) => window.active)
      .concat(state.windows.filter((window) => !window.active).slice(0, 12)),
    browserTabs: state.browser.tabs,
    screen: state.screen.graph
      ? {
          fingerprint: state.screen.graph.fingerprint,
          elements: state.screen.graph.elements.slice(0, 120),
          visibleText: state.screen.graph.visibleText.slice(0, 50),
        }
      : undefined,
    media: state.media,
    cursor: state.cursor,
    input: state.input,
    voice: state.voice,
    network: state.network,
    devices: state.devices,
    task: state.task,
    permissions: state.permissions,
    recentActions: state.recentActions.slice(-8),
    delta: delta
      ? {
          changes: delta.changes,
          addedElements: delta.addedElements.slice(0, 30),
          removedElementIds: delta.removedElementIds.slice(0, 30),
          changedElements: delta.changedElements.slice(0, 30),
        }
      : undefined,
  };
}
