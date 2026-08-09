/** Shared, extensionless DOM and accessibility summaries for browser control. */

const PROTECTED_INPUT =
  /(password|passwd|pwd|otp|one-?time|verification|2fa|mfa|captcha|cvv|cvc|card|iban|ssn|secret|token|pin|recovery)/i;
const PROTECTED_TYPES = new Set(["password", "hidden"]);

export function isProtectedInputName(nameOrType: string): boolean {
  return PROTECTED_INPUT.test(nameOrType) || PROTECTED_TYPES.has(nameOrType.toLowerCase());
}

export interface FieldSummary {
  name: string;
  type: string;
  protected: boolean;
}

export interface PageSummary {
  url: string;
  title: string;
  headings: string[];
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

export function summarisePage(dom: DomLike): PageSummary {
  return {
    url: dom.url,
    title: dom.title,
    headings: dom.headings
      .map((heading) => heading.trim())
      .filter(Boolean)
      .slice(0, 50),
    text: dom.bodyText.replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_TEXT),
    fields: dom.fields.map((field) => ({
      name: field.name,
      type: field.type,
      protected: isProtectedInputName(field.name) || isProtectedInputName(field.type),
    })),
    links: dom.links
      .filter((link) => /^https?:/i.test(link.href))
      .map((link) => ({ text: link.text.trim().slice(0, 120), href: link.href }))
      .slice(0, 100),
    frames: (dom.frames ?? []).slice(0, 100).map((frame) => ({
      src: frame.src.slice(0, 2_000),
      title: frame.title.trim().slice(0, 120),
      sameOrigin: frame.sameOrigin === true,
    })),
    openShadowRoots: Math.max(0, Math.min(1_000, dom.openShadowRoots ?? 0)),
  };
}

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

export function hasProtectedFields(summary: PageSummary): boolean {
  return summary.fields.some((field) => field.protected);
}

export interface ScreenshotRedaction {
  maskSelectors: string[];
  reason: string;
}

export function screenshotRedaction(summary: PageSummary): ScreenshotRedaction {
  const masked = summary.fields
    .filter((field) => field.protected)
    .map((field) => `[name="${field.name}"]`);
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
