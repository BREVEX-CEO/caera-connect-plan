/**
 * Fused screen perception and Set-of-Mark planning.
 *
 * This module has no OS authority. It accepts bounded observations from an
 * approved capture/UIA/OCR/icon/vision host, redacts protected regions, fuses
 * overlapping evidence, creates numbered targets, and binds every target to a
 * complete screen-state fingerprint. Execution must re-observe through a
 * separate callback and a stale fingerprint always causes replanning.
 */
import { isProtectedText } from "../native/companion-bridge";
import { sha256 as sha256Bytes } from "../native/companion-client";

export type PerceptionSource = "accessibility" | "ocr" | "icon" | "vision";

export interface PerceptionRuntimeReadiness {
  sourceReady: true;
  liveReady: boolean;
  missing: string[];
}

/**
 * Project live perception readiness from authenticated companion evidence.
 * Source availability is not runtime availability: callers must explicitly
 * report every external perception provider they have actually connected.
 */
export function perceptionRuntimeReadiness(input: {
  companionAvailable: boolean;
  permissions?: Array<{ id: string; state: string }>;
  providers?: Partial<Record<PerceptionSource, boolean>>;
}): PerceptionRuntimeReadiness {
  const missing: string[] = [];
  if (!input.companionAvailable) {
    missing.push("Signed Native Companion");
  }
  const granted = new Set(
    (input.permissions ?? [])
      .filter((permission) => permission.state === "granted" || permission.state === "not_required")
      .map((permission) => permission.id),
  );
  if (!granted.has("accessibility")) {
    missing.push("accessibility permission");
  }
  if (!granted.has("screen_capture")) {
    missing.push("screen-capture permission");
  }
  for (const source of ["ocr", "icon", "vision"] as const) {
    if (!input.providers?.[source]) missing.push(`${source} provider`);
  }
  return {
    sourceReady: true,
    liveReady: missing.length === 0,
    missing,
  };
}
export type CoordinateSpace =
  "screen_physical" | "window_physical" | "window_logical" | "display_logical";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayObservation {
  displayId: string;
  boundsPhysical: ScreenRect;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface WindowObservation {
  appId: string;
  executable?: string;
  product?: string;
  version?: string;
  windowId: string;
  title: string;
  boundsPhysical: ScreenRect;
  displayId: string;
  displayScale: number;
  activeProjectOrFile?: string;
}

export interface RawPerceptionElement {
  source: PerceptionSource;
  sourceId: string;
  parentId?: string;
  role: string;
  name?: string;
  bounds: ScreenRect;
  coordinateSpace: CoordinateSpace;
  confidence: number;
  interactive: boolean;
  enabled: boolean;
  visible: boolean;
  occluded?: boolean;
  protected?: boolean;
  selected?: boolean;
  focused?: boolean;
  state?: string;
}

export interface ScreenshotObservation {
  sha256: string;
  perceptualHash: string;
  width: number;
  height: number;
  protectedRegions: ScreenRect[];
}

export interface PerceptionFrame {
  observedAt: string;
  display: DisplayObservation;
  window: WindowObservation;
  screenshot: ScreenshotObservation;
  accessibility: RawPerceptionElement[];
  ocr: RawPerceptionElement[];
  icons: RawPerceptionElement[];
  vision: RawPerceptionElement[];
}

export interface FusedPerceptionElement {
  targetKey: string;
  role: string;
  name: string;
  boundsPhysical: ScreenRect;
  confidence: number;
  interactive: boolean;
  enabled: boolean;
  visible: boolean;
  selected: boolean;
  focused: boolean;
  state?: string;
  sources: Array<{ source: PerceptionSource; sourceId: string }>;
}

export interface SetOfMarkTarget {
  markerId: string;
  number: number;
  targetKey: string;
  role: string;
  name: string;
  boundsPhysical: ScreenRect;
  confidence: number;
  sources: PerceptionSource[];
}

export interface SetOfMarkPlan {
  schemaVersion: 1;
  observedAt: string;
  fingerprint: string;
  window: WindowObservation;
  display: DisplayObservation;
  screenshotSha256: string;
  screenshotPerceptualHash: string;
  elements: FusedPerceptionElement[];
  markers: SetOfMarkTarget[];
  redactions: ScreenRect[];
  overlaySvg: string;
  evidence: string[];
}

export type PerceptionOutcome = { ok: true; data: SetOfMarkPlan } | { ok: false; reason: string };

export type TargetResolution =
  | {
      ok: true;
      target: SetOfMarkTarget;
      physicalPoint: { x: number; y: number };
      windowLogicalPoint: { x: number; y: number };
      currentFingerprint: string;
      evidence: string;
    }
  | { ok: false; reason: string; stale: boolean };

export type MarkedExecutionOutcome =
  | {
      status: "completed_verified";
      beforeFingerprint: string;
      afterFingerprint: string;
      evidence: string[];
    }
  | {
      status: "refused" | "failed" | "completed_unverified";
      reason: string;
      evidence: string[];
    };

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const PERCEPTUAL_HASH = /^[a-f0-9]{16,128}$/;
const MAX_ELEMENTS_PER_SOURCE = 2_000;
const MAX_FUSED_ELEMENTS = 4_000;
const MAX_AGE_MS = 5_000;
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validRect(rect: ScreenRect): boolean {
  return (
    isRecord(rect) &&
    finite(rect.x) &&
    finite(rect.y) &&
    finite(rect.width) &&
    finite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.width <= 100_000 &&
    rect.height <= 100_000
  );
}

function canonicalText(value: unknown, max = 300): string {
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

function protectedLabel(value: string): boolean {
  return value.length > 0 && isProtectedText(value);
}

function rectRight(rect: ScreenRect): number {
  return rect.x + rect.width;
}

function rectBottom(rect: ScreenRect): number {
  return rect.y + rect.height;
}

function contains(outer: ScreenRect, inner: ScreenRect, epsilon = 0.5): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    rectRight(inner) <= rectRight(outer) + epsilon &&
    rectBottom(inner) <= rectBottom(outer) + epsilon
  );
}

function intersectionArea(a: ScreenRect, b: ScreenRect): number {
  const width = Math.max(0, Math.min(rectRight(a), rectRight(b)) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(rectBottom(a), rectBottom(b)) - Math.max(a.y, b.y));
  return width * height;
}

function intersectionOverUnion(a: ScreenRect, b: ScreenRect): number {
  const intersection = intersectionArea(a, b);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function overlaps(a: ScreenRect, b: ScreenRect): boolean {
  return intersectionArea(a, b) > 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundedRect(rect: ScreenRect): ScreenRect {
  return {
    x: round(rect.x),
    y: round(rect.y),
    width: round(rect.width),
    height: round(rect.height),
  };
}

function toPhysicalBounds(
  element: RawPerceptionElement,
  frame: PerceptionFrame,
): ScreenRect | null {
  if (!validRect(element.bounds)) return null;
  const scale = frame.window.displayScale;
  let rect: ScreenRect;
  switch (element.coordinateSpace) {
    case "screen_physical":
      rect = { ...element.bounds };
      break;
    case "window_physical":
      rect = {
        x: frame.window.boundsPhysical.x + element.bounds.x,
        y: frame.window.boundsPhysical.y + element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height,
      };
      break;
    case "window_logical":
      rect = {
        x: frame.window.boundsPhysical.x + element.bounds.x * scale,
        y: frame.window.boundsPhysical.y + element.bounds.y * scale,
        width: element.bounds.width * scale,
        height: element.bounds.height * scale,
      };
      break;
    case "display_logical":
      rect = {
        x: frame.display.boundsPhysical.x + element.bounds.x * frame.display.scale,
        y: frame.display.boundsPhysical.y + element.bounds.y * frame.display.scale,
        width: element.bounds.width * frame.display.scale,
        height: element.bounds.height * frame.display.scale,
      };
      break;
    default:
      return null;
  }
  rect = roundedRect(rect);
  return validRect(rect) && contains(frame.window.boundsPhysical, rect) ? rect : null;
}

function relativeBounds(rect: ScreenRect, window: WindowObservation): ScreenRect {
  return roundedRect({
    x: (rect.x - window.boundsPhysical.x) / window.displayScale,
    y: (rect.y - window.boundsPhysical.y) / window.displayScale,
    width: rect.width / window.displayScale,
    height: rect.height / window.displayScale,
  });
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function digest(value: string): string {
  return hex(sha256Bytes(encoder.encode(value)));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateFrame(frame: PerceptionFrame): string | null {
  if (
    !isRecord(frame) ||
    !isRecord(frame.display) ||
    !isRecord(frame.window) ||
    !isRecord(frame.screenshot)
  ) {
    return "The perception frame is malformed.";
  }
  const observed = Date.parse(frame.observedAt);
  if (!Number.isFinite(observed) || new Date(observed).toISOString() !== frame.observedAt) {
    return "The perception timestamp is invalid.";
  }
  if (
    !SAFE_ID.test(frame.display.displayId) ||
    !validRect(frame.display.boundsPhysical) ||
    !finite(frame.display.scale) ||
    frame.display.scale < 0.5 ||
    frame.display.scale > 8 ||
    ![0, 90, 180, 270].includes(frame.display.rotation)
  ) {
    return "The display observation is malformed.";
  }
  const window = frame.window;
  if (
    !SAFE_ID.test(window.appId) ||
    !SAFE_ID.test(window.windowId) ||
    window.displayId !== frame.display.displayId ||
    !canonicalText(window.title) ||
    !validRect(window.boundsPhysical) ||
    !finite(window.displayScale) ||
    window.displayScale < 0.5 ||
    window.displayScale > 8 ||
    !overlaps(window.boundsPhysical, frame.display.boundsPhysical)
  ) {
    return "The target-window observation is malformed or outside its display.";
  }
  const shot = frame.screenshot;
  if (
    !SHA256.test(shot.sha256) ||
    !PERCEPTUAL_HASH.test(shot.perceptualHash) ||
    !Number.isInteger(shot.width) ||
    !Number.isInteger(shot.height) ||
    shot.width < 1 ||
    shot.height < 1 ||
    shot.width > 32_768 ||
    shot.height > 32_768 ||
    !Array.isArray(shot.protectedRegions) ||
    shot.protectedRegions.length > 500 ||
    shot.protectedRegions.some(
      (region) => !validRect(region) || !contains(window.boundsPhysical, region),
    )
  ) {
    return "The screenshot observation is malformed or has unsafe redaction bounds.";
  }
  const groups = [frame.accessibility, frame.ocr, frame.icons, frame.vision];
  if (groups.some((group) => !Array.isArray(group) || group.length > MAX_ELEMENTS_PER_SOURCE)) {
    return "A perception source exceeded its bounded element count.";
  }
  return null;
}

interface NormalizedElement extends FusedPerceptionElement {
  protected: boolean;
}

function normalizeElement(
  raw: RawPerceptionElement,
  expectedSource: PerceptionSource,
  frame: PerceptionFrame,
): NormalizedElement | null {
  if (
    !isRecord(raw) ||
    raw.source !== expectedSource ||
    !SAFE_ID.test(raw.sourceId) ||
    !canonicalText(raw.role, 100) ||
    !finite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1 ||
    typeof raw.interactive !== "boolean" ||
    typeof raw.enabled !== "boolean" ||
    typeof raw.visible !== "boolean"
  ) {
    return null;
  }
  const boundsPhysical = toPhysicalBounds(raw, frame);
  if (!boundsPhysical) return null;
  const unsafeName = canonicalText(raw.name);
  const regionProtected = frame.screenshot.protectedRegions.some((region) =>
    overlaps(region, boundsPhysical),
  );
  const isProtected = raw.protected === true || protectedLabel(unsafeName) || regionProtected;
  const safeName = isProtected ? "[protected]" : unsafeName;
  const relative = relativeBounds(boundsPhysical, frame.window);
  const targetKey = digest(
    stableJson({
      role: canonicalText(raw.role, 100).toLowerCase(),
      name: safeName.toLowerCase(),
      relative,
      source: raw.source,
      sourceId: raw.sourceId,
    }),
  );
  return {
    targetKey,
    role: canonicalText(raw.role, 100),
    name: safeName,
    boundsPhysical,
    confidence: raw.confidence,
    interactive: raw.interactive,
    enabled: raw.enabled,
    visible: raw.visible && raw.occluded !== true,
    selected: raw.selected === true,
    focused: raw.focused === true,
    ...(canonicalText(raw.state, 100) ? { state: canonicalText(raw.state, 100) } : {}),
    sources: [{ source: raw.source, sourceId: raw.sourceId }],
    protected: isProtected,
  };
}

function mergeable(a: NormalizedElement, b: NormalizedElement): boolean {
  const sameSemantic =
    a.role.toLowerCase() === b.role.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
  return (
    intersectionOverUnion(a.boundsPhysical, b.boundsPhysical) >= 0.55 ||
    (sameSemantic && intersectionOverUnion(a.boundsPhysical, b.boundsPhysical) >= 0.2)
  );
}

function mergeElements(
  elements: NormalizedElement[],
  window: WindowObservation,
): NormalizedElement[] {
  const fused: NormalizedElement[] = [];
  for (const candidate of elements) {
    const existing = fused.find((item) => mergeable(item, candidate));
    if (!existing) {
      fused.push({ ...candidate, sources: candidate.sources.map((source) => ({ ...source })) });
      continue;
    }
    const existingHasAccessibility = existing.sources.some(
      (source) => source.source === "accessibility",
    );
    const candidateHasAccessibility = candidate.sources.some(
      (source) => source.source === "accessibility",
    );
    if (candidateHasAccessibility && !existingHasAccessibility) {
      existing.boundsPhysical = { ...candidate.boundsPhysical };
    } else if (!existingHasAccessibility && !candidateHasAccessibility) {
      const total = existing.confidence + candidate.confidence || 1;
      existing.boundsPhysical = roundedRect({
        x:
          (existing.boundsPhysical.x * existing.confidence +
            candidate.boundsPhysical.x * candidate.confidence) /
          total,
        y:
          (existing.boundsPhysical.y * existing.confidence +
            candidate.boundsPhysical.y * candidate.confidence) /
          total,
        width:
          (existing.boundsPhysical.width * existing.confidence +
            candidate.boundsPhysical.width * candidate.confidence) /
          total,
        height:
          (existing.boundsPhysical.height * existing.confidence +
            candidate.boundsPhysical.height * candidate.confidence) /
          total,
      });
    }
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.interactive ||= candidate.interactive;
    existing.enabled &&= candidate.enabled;
    existing.visible &&= candidate.visible;
    existing.selected ||= candidate.selected;
    existing.focused ||= candidate.focused;
    existing.protected ||= candidate.protected;
    if (existing.name.length === 0 && candidate.name.length > 0) existing.name = candidate.name;
    if (!existing.state && candidate.state) existing.state = candidate.state;
    existing.sources.push(...candidate.sources);
    existing.sources.sort((a, b) =>
      `${a.source}:${a.sourceId}`.localeCompare(`${b.source}:${b.sourceId}`),
    );
    existing.targetKey = digest(
      stableJson({
        role: existing.role.toLowerCase(),
        name: existing.name.toLowerCase(),
        relative: relativeBounds(existing.boundsPhysical, window),
        sources: existing.sources,
      }),
    );
  }
  return fused;
}

function fingerprintParts(frame: PerceptionFrame, normalized: NormalizedElement[]) {
  const accessibilitySignature = digest(
    stableJson(
      normalized
        .filter((element) => element.sources.some((source) => source.source === "accessibility"))
        .map((element) => ({
          role: element.role,
          name: element.protected ? "[protected]" : element.name,
          enabled: element.enabled,
          visible: element.visible,
          selected: element.selected,
          focused: element.focused,
          bounds: relativeBounds(element.boundsPhysical, frame.window),
        }))
        .sort((a, b) => stableJson(a).localeCompare(stableJson(b))),
    ),
  );
  const visibleTextSignature = digest(
    normalized
      .filter(
        (element) =>
          !element.protected &&
          element.visible &&
          element.sources.some((source) => source.source === "ocr"),
      )
      .map((element) => element.name)
      .sort()
      .join("\n"),
  );
  return {
    application: {
      appId: frame.window.appId,
      executable: canonicalText(frame.window.executable, 500),
      product: canonicalText(frame.window.product, 200),
      version: canonicalText(frame.window.version, 100),
      windowId: frame.window.windowId,
    },
    windowTitle: canonicalText(frame.window.title, 300),
    windowBounds: roundedRect(frame.window.boundsPhysical),
    displayId: frame.display.displayId,
    displayScale: round(frame.window.displayScale),
    displayRotation: frame.display.rotation,
    accessibilitySignature,
    visibleTextSignature,
    screenshotPerceptualHash: frame.screenshot.perceptualHash,
    activeProjectOrFile: canonicalText(frame.window.activeProjectOrFile, 500),
  };
}

export function deriveScreenStateFingerprint(frame: PerceptionFrame): string | null {
  if (validateFrame(frame)) return null;
  const normalized = collectNormalized(frame);
  if (!normalized) return null;
  return `screen-v1:${digest(stableJson(fingerprintParts(frame, normalized)))}`;
}

function collectNormalized(frame: PerceptionFrame): NormalizedElement[] | null {
  const groups: Array<[PerceptionSource, RawPerceptionElement[]]> = [
    ["accessibility", frame.accessibility],
    ["ocr", frame.ocr],
    ["icon", frame.icons],
    ["vision", frame.vision],
  ];
  const normalized: NormalizedElement[] = [];
  for (const [source, elements] of groups) {
    for (const element of elements) {
      const item = normalizeElement(element, source, frame);
      if (!item) return null;
      normalized.push(item);
    }
  }
  return normalized;
}

function markerSort(a: FusedPerceptionElement, b: FusedPerceptionElement): number {
  return (
    a.boundsPhysical.y - b.boundsPhysical.y ||
    a.boundsPhysical.x - b.boundsPhysical.x ||
    a.role.localeCompare(b.role) ||
    a.name.localeCompare(b.name) ||
    a.targetKey.localeCompare(b.targetKey)
  );
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** Render a transparent numbered overlay. No source labels or screen text enter the SVG. */
export function renderSetOfMarkOverlay(
  window: WindowObservation,
  markers: SetOfMarkTarget[],
): string {
  const width = round(window.boundsPhysical.width);
  const height = round(window.boundsPhysical.height);
  const shapes = markers
    .map((marker) => {
      const x = round(marker.boundsPhysical.x - window.boundsPhysical.x);
      const y = round(marker.boundsPhysical.y - window.boundsPhysical.y);
      const w = round(marker.boundsPhysical.width);
      const h = round(marker.boundsPhysical.height);
      const badgeX = Math.max(10, x + 10);
      const badgeY = Math.max(10, y + 10);
      return `<g data-marker="${escapeXml(marker.markerId)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ff3b30" stroke-width="2"/><circle cx="${badgeX}" cy="${badgeY}" r="10" fill="#ff3b30"/><text x="${badgeX}" y="${round(badgeY + 4)}" text-anchor="middle" fill="#fff" font-size="11">${marker.number}</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${shapes}</svg>`;
}

/** Validate, redact, fuse and mark one approved target-window observation. */
export function fusePerceptionFrame(frame: PerceptionFrame): PerceptionOutcome {
  const issue = validateFrame(frame);
  if (issue) return { ok: false, reason: issue };
  const normalized = collectNormalized(frame);
  if (!normalized) {
    return { ok: false, reason: "A perception source returned malformed or out-of-window data." };
  }
  const merged = mergeElements(normalized, frame.window);
  if (merged.length > MAX_FUSED_ELEMENTS) {
    return { ok: false, reason: "The fused perception result exceeded its bounded element count." };
  }
  const fingerprint = `screen-v1:${digest(stableJson(fingerprintParts(frame, normalized)))}`;
  const safeElements: FusedPerceptionElement[] = merged
    .filter((element) => !element.protected)
    .map(({ protected: _protected, ...element }) => ({
      ...element,
      sources: element.sources.map((source) => ({ ...source })),
      boundsPhysical: { ...element.boundsPhysical },
    }))
    .sort(markerSort);
  const markers: SetOfMarkTarget[] = safeElements
    .filter(
      (element) =>
        element.interactive && element.enabled && element.visible && element.confidence >= 0.4,
    )
    .map((element, index) => ({
      markerId: `mark-${index + 1}`,
      number: index + 1,
      targetKey: element.targetKey,
      role: element.role,
      name: element.name,
      boundsPhysical: { ...element.boundsPhysical },
      confidence: element.confidence,
      sources: [...new Set(element.sources.map((source) => source.source))].sort(),
    }));
  const redactions = [
    ...frame.screenshot.protectedRegions.map((region) => ({ ...region })),
    ...merged
      .filter((element) => element.protected)
      .map((element) => ({ ...element.boundsPhysical })),
  ];
  return {
    ok: true,
    data: {
      schemaVersion: 1,
      observedAt: frame.observedAt,
      fingerprint,
      window: { ...frame.window, boundsPhysical: { ...frame.window.boundsPhysical } },
      display: { ...frame.display, boundsPhysical: { ...frame.display.boundsPhysical } },
      screenshotSha256: frame.screenshot.sha256,
      screenshotPerceptualHash: frame.screenshot.perceptualHash,
      elements: safeElements,
      markers,
      redactions,
      overlaySvg: renderSetOfMarkOverlay(frame.window, markers),
      evidence: [
        `Fused ${normalized.length} bounded observations into ${safeElements.length} redacted-safe elements.`,
        `Created ${markers.length} current numbered target${markers.length === 1 ? "" : "s"}.`,
        `Applied ${redactions.length} protected-region redaction${redactions.length === 1 ? "" : "s"}.`,
      ],
    },
  };
}

/** Resolve a marker only against a fresh, byte-independent current observation. */
export function resolveSetOfMarkTarget(input: {
  planned: SetOfMarkPlan;
  markerId: string;
  current: PerceptionFrame;
  now?: Date;
  maxAgeMs?: number;
}): TargetResolution {
  const plannedTarget = input.planned.markers.find((marker) => marker.markerId === input.markerId);
  if (!plannedTarget) {
    return { ok: false, reason: "The selected Set-of-Mark identifier is unknown.", stale: false };
  }
  const now = input.now ?? new Date();
  const maxAgeMs = Math.min(Math.max(input.maxAgeMs ?? MAX_AGE_MS, 1), 30_000);
  const observedAt = Date.parse(input.current.observedAt);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(observedAt)) {
    return { ok: false, reason: "The current observation time is invalid.", stale: true };
  }
  if (now.getTime() - observedAt < 0 || now.getTime() - observedAt > maxAgeMs) {
    return {
      ok: false,
      reason: "The current screen observation is stale; OCADE must capture and replan.",
      stale: true,
    };
  }
  const current = fusePerceptionFrame(input.current);
  if (!current.ok) return { ok: false, reason: current.reason, stale: true };
  if (current.data.fingerprint !== input.planned.fingerprint) {
    return {
      ok: false,
      reason:
        "The application, window, scale, accessibility tree, visible text, screenshot or active file changed; OCADE must replan.",
      stale: true,
    };
  }
  const currentElement = current.data.elements.find(
    (element) => element.targetKey === plannedTarget.targetKey,
  );
  if (
    !currentElement ||
    !currentElement.interactive ||
    !currentElement.enabled ||
    !currentElement.visible ||
    !contains(input.current.window.boundsPhysical, currentElement.boundsPhysical)
  ) {
    return {
      ok: false,
      reason: "The marked target is no longer current, visible and enabled.",
      stale: true,
    };
  }
  const physicalPoint = {
    x: round(currentElement.boundsPhysical.x + currentElement.boundsPhysical.width / 2),
    y: round(currentElement.boundsPhysical.y + currentElement.boundsPhysical.height / 2),
  };
  return {
    ok: true,
    target: {
      ...plannedTarget,
      boundsPhysical: { ...currentElement.boundsPhysical },
    },
    physicalPoint,
    windowLogicalPoint: {
      x: round(
        (physicalPoint.x - input.current.window.boundsPhysical.x) /
          input.current.window.displayScale,
      ),
      y: round(
        (physicalPoint.y - input.current.window.boundsPhysical.y) /
          input.current.window.displayScale,
      ),
    },
    currentFingerprint: current.data.fingerprint,
    evidence: `Resolved ${plannedTarget.markerId} against current fingerprint ${current.data.fingerprint}.`,
  };
}

/**
 * Execute one marked action, then require an independent fresh observation.
 * The executor acknowledgement is never treated as verification.
 */
export async function executeMarkedTarget(input: {
  planned: SetOfMarkPlan;
  markerId: string;
  current: PerceptionFrame;
  now?: Date;
  signal?: AbortSignal;
  execute(
    target: TargetResolution & { ok: true },
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; evidence: string }>;
  reobserve(signal?: AbortSignal): Promise<PerceptionFrame>;
  verify(
    before: SetOfMarkPlan,
    after: SetOfMarkPlan,
  ): Promise<{ verified: boolean; evidence: string }>;
}): Promise<MarkedExecutionOutcome> {
  if (input.signal?.aborted) {
    return { status: "refused", reason: "The marked action was cancelled.", evidence: [] };
  }
  const resolved = resolveSetOfMarkTarget({
    planned: input.planned,
    markerId: input.markerId,
    current: input.current,
    now: input.now,
  });
  if (!resolved.ok) {
    return { status: "refused", reason: resolved.reason, evidence: [] };
  }
  let execution: { ok: boolean; evidence: string };
  try {
    execution = await input.execute(resolved, input.signal);
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "The marked action executor failed.",
      evidence: [resolved.evidence],
    };
  }
  if (!execution.ok) {
    return {
      status: "failed",
      reason: execution.evidence || "The marked action failed.",
      evidence: [resolved.evidence],
    };
  }
  if (input.signal?.aborted) {
    return {
      status: "completed_unverified",
      reason: "The action returned, but verification was cancelled.",
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  let afterFrame: PerceptionFrame;
  try {
    afterFrame = await input.reobserve(input.signal);
  } catch (error) {
    return {
      status: "completed_unverified",
      reason:
        error instanceof Error
          ? `The independent re-observation failed: ${error.message}`
          : "The independent re-observation failed.",
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  if (Date.parse(afterFrame.observedAt) <= Date.parse(input.current.observedAt)) {
    return {
      status: "completed_unverified",
      reason: "The observer did not provide a newer post-action screen state.",
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  const after = fusePerceptionFrame(afterFrame);
  if (!after.ok) {
    return {
      status: "completed_unverified",
      reason: after.reason,
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  let verification: { verified: boolean; evidence: string };
  try {
    verification = await input.verify(input.planned, after.data);
  } catch (error) {
    return {
      status: "completed_unverified",
      reason:
        error instanceof Error
          ? `The independent verifier failed: ${error.message}`
          : "The independent verifier failed.",
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  if (!verification.verified) {
    return {
      status: "completed_unverified",
      reason: verification.evidence || "The post-action observation did not verify the result.",
      evidence: [resolved.evidence, execution.evidence],
    };
  }
  return {
    status: "completed_verified",
    beforeFingerprint: input.planned.fingerprint,
    afterFingerprint: after.data.fingerprint,
    evidence: [resolved.evidence, execution.evidence, verification.evidence],
  };
}
