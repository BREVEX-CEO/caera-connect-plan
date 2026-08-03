/**
 * OCADE browser extension protocol (Plan §26).
 *
 * Defines the ONLY messages that may cross between the OCADE page, the
 * extension service worker and a content script, plus the DOM/accessibility
 * summarisation the content script performs.
 *
 * Security posture:
 *  - every message is validated; an unknown shape is rejected, never coerced;
 *  - messages must carry the pairing token issued at connect time, so an
 *    arbitrary page cannot drive the extension;
 *  - page content is UNTRUSTED — summaries are DATA, and protected fields are
 *    never read or reported with values;
 *  - the content script reports structure, never secrets.
 */

export const EXTENSION_PROTOCOL_VERSION = 1;

export type ExtensionRequestKind =
  | "connect"
  | "tabs.list"
  | "tab.activate"
  | "tab.create"
  | "page.summary"
  | "page.a11y"
  | "page.screenshot"
  | "page.navigate"
  | "page.wait"
  | "page.verify"
  | "form.fill"
  | "form.submit"
  | "file.download"
  | "file.upload"
  | "file.drop"
  | "run.progress"
  | "run.cancel"
  | "emergency.stop";

export interface ExtensionRequest {
  v: number;
  token: string;
  kind: ExtensionRequestKind;
  pairingCode?: string;
  tabId?: string;
  url?: string;
  runId?: string;
  operationId?: string;
  confirmed?: boolean;
  fields?: unknown[];
  target?: unknown;
  filename?: string;
  file?: unknown;
  expectation?: unknown;
  timeoutMs?: number;
  maskSelectors?: string[];
}

export interface ExtensionIdentity {
  runtimeId: string;
  name: string;
  version: string;
  manifestVersion: 3;
}

export type ExtensionResponse =
  { ok: true; kind: ExtensionRequestKind; data: unknown } | { ok: false; error: string };

/** Fields whose VALUES must never leave the page. */
const PROTECTED_INPUT =
  /(password|passwd|pwd|otp|one-?time|verification|2fa|mfa|captcha|cvv|cvc|card|iban|ssn|secret|token|pin|recovery)/i;

const PROTECTED_TYPES = new Set(["password", "hidden"]);

export function isProtectedInputName(nameOrType: string): boolean {
  return PROTECTED_INPUT.test(nameOrType) || PROTECTED_TYPES.has(nameOrType.toLowerCase());
}

/**
 * Validate an inbound request. Returns the reason it was rejected, or null when
 * it may proceed. Pure — no DOM access.
 */
export function validateRequest(
  raw: unknown,
  expectedToken: string,
  expectedPairingCode?: string,
): { ok: true; request: ExtensionRequest } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "Malformed message." };
  }
  const r = raw as Partial<ExtensionRequest>;
  if (r.v !== EXTENSION_PROTOCOL_VERSION) {
    return { ok: false, reason: "Unsupported protocol version." };
  }
  const kinds: ExtensionRequestKind[] = [
    "connect",
    "tabs.list",
    "tab.activate",
    "tab.create",
    "page.summary",
    "page.a11y",
    "page.screenshot",
    "page.navigate",
    "page.wait",
    "page.verify",
    "form.fill",
    "form.submit",
    "file.download",
    "file.upload",
    "file.drop",
    "run.progress",
    "run.cancel",
    "emergency.stop",
  ];
  if (typeof r.kind !== "string" || !kinds.includes(r.kind as ExtensionRequestKind)) {
    return { ok: false, reason: "Unsupported request." };
  }
  if (r.kind === "connect") {
    if (
      !expectedPairingCode ||
      typeof r.pairingCode !== "string" ||
      !/^\d{6}$/.test(r.pairingCode) ||
      r.pairingCode !== expectedPairingCode
    ) {
      return { ok: false, reason: "The pairing code is invalid or expired." };
    }
    return { ok: true, request: r as ExtensionRequest };
  }
  if (typeof r.token !== "string" || r.token.length < 16) {
    return { ok: false, reason: "Missing or invalid pairing token." };
  }
  if (!expectedToken || r.token !== expectedToken) {
    return { ok: false, reason: "This page is not paired with the OCADE extension." };
  }
  if (
    "runId" in r &&
    r.runId !== undefined &&
    (typeof r.runId !== "string" || r.runId.length < 1 || r.runId.length > 200)
  )
    return { ok: false, reason: "Invalid browser run id." };
  if (
    "operationId" in r &&
    r.operationId !== undefined &&
    (typeof r.operationId !== "string" || r.operationId.length < 1 || r.operationId.length > 200)
  )
    return { ok: false, reason: "Invalid browser operation id." };
  return { ok: true, request: r as ExtensionRequest };
}

/* ---------------------------------------------------- page summarisation -- */

export interface FieldSummary {
  /** Field label or name — never its value. */
  name: string;
  type: string;
  /** True when OCADE refuses to read or fill it. */
  protected: boolean;
}

export interface PageSummary {
  url: string;
  title: string;
  headings: string[];
  /** Visible text, bounded. */
  text: string;
  fields: FieldSummary[];
  links: { text: string; href: string }[];
  frames?: { src: string; title: string; sameOrigin: boolean }[];
  openShadowRoots?: number;
}

export interface AccessibilityNodeSummary {
  role: string;
  name: string;
  disabled: boolean;
  protected: boolean;
}

export interface AccessibilitySnapshot {
  url: string;
  title: string;
  nodes: AccessibilityNodeSummary[];
  frames?: { src: string; title: string; sameOrigin: boolean }[];
  openShadowRoots?: number;
}

export const MAX_PAGE_TEXT = 20_000;

/** Minimal DOM shape the summariser needs — keeps this unit-testable. */
export interface DomLike {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  fields: { name: string; type: string }[];
  links: { text: string; href: string }[];
  frames?: { src: string; title: string; sameOrigin: boolean }[];
  openShadowRoots?: number;
}

/**
 * Build a page summary. Protected fields are listed by NAME ONLY and flagged,
 * so OCADE can see a login form exists without ever seeing what is in it.
 */
export function summarisePage(dom: DomLike): PageSummary {
  const text = dom.bodyText.replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_TEXT);
  return {
    url: dom.url,
    title: dom.title,
    headings: dom.headings
      .map((h) => h.trim())
      .filter(Boolean)
      .slice(0, 50),
    text,
    fields: dom.fields.map((f) => ({
      name: f.name,
      type: f.type,
      protected: isProtectedInputName(f.name) || isProtectedInputName(f.type),
    })),
    links: dom.links
      .filter((l) => /^https?:/i.test(l.href))
      .map((l) => ({ text: l.text.trim().slice(0, 120), href: l.href }))
      .slice(0, 100),
    frames: (dom.frames ?? []).slice(0, 100).map((frame) => ({
      src: frame.src.slice(0, 2_000),
      title: frame.title.trim().slice(0, 120),
      sameOrigin: frame.sameOrigin === true,
    })),
    openShadowRoots: Math.max(0, Math.min(1_000, dom.openShadowRoots ?? 0)),
  };
}

/**
 * Normalise the extension's accessibility channel without pretending it is a
 * DOM snapshot. Names are bounded and protected nodes remain name-only.
 */
export function summariseAccessibility(raw: AccessibilitySnapshot): AccessibilitySnapshot {
  return {
    url: raw.url,
    title: raw.title.trim().slice(0, 300),
    nodes: raw.nodes.slice(0, 500).map((node) => ({
      role: node.role.trim().slice(0, 80),
      name: node.name.trim().slice(0, 120),
      disabled: node.disabled === true,
      protected: node.protected === true,
    })),
    frames: (raw.frames ?? []).slice(0, 100),
    openShadowRoots: Math.max(0, Math.min(1_000, raw.openShadowRoots ?? 0)),
  };
}

/** True when the page contains a field OCADE must never touch. */
export function hasProtectedFields(summary: PageSummary): boolean {
  return summary.fields.some((f) => f.protected);
}

/* -------------------------------------------------------- screenshot -------- */

export interface ScreenshotRedaction {
  /** Selectors the extension must blur/black out before capture. */
  maskSelectors: string[];
  reason: string;
}

/**
 * Screenshots must never capture credential fields. This returns the masking
 * instructions the content script applies BEFORE the capture happens.
 */
export function screenshotRedaction(summary: PageSummary): ScreenshotRedaction {
  const masked = summary.fields.filter((f) => f.protected).map((f) => `[name="${f.name}"]`);
  return {
    maskSelectors: [
      'input[type="password"]',
      'input[autocomplete*="one-time"]',
      'input[autocomplete*="cc-"]',
      ...masked,
    ],
    reason:
      masked.length > 0
        ? "Protected fields on this page are masked before capture."
        : "Standard credential fields are masked before capture.",
  };
}

/** Build a rejection response with a user-safe reason. */
export function refuse(reason: string): ExtensionResponse {
  return { ok: false, error: reason };
}

export function reply(kind: ExtensionRequestKind, data: unknown): ExtensionResponse {
  return { ok: true, kind, data };
}
