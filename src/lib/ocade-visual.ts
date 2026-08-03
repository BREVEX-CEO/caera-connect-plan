/**
 * OCADE visual responses (Plan §38–41).
 *
 * Turns a finished answer into a structured VISUAL PANEL — steps, code, tables,
 * key figures — presented alongside an original OCADE presence. Nothing here
 * imitates a real person or any copyrighted character: the "presence" is an
 * abstract branded mark rendered from OCADE's own design tokens.
 *
 * Rules encoded here:
 *  - text + voice remain the default; a visual is only ever OFFERED (decision #41);
 *  - protected content is redacted before it can be rendered, saved or exported;
 *  - visuals are TEMPORARY by default — saving is an explicit user action (#40);
 *  - on low resources (or when the components aren't installed) it degrades to
 *    captions + text rather than pretending to render (#39).
 */
/**
 * Display-safe redaction.
 *
 * `redactForAudit` deliberately strips EVERY run of 4+ digits, which is correct
 * for a log but would gut a visual — a metrics panel or chart is mostly
 * numbers. Here we redact values that are actually credential-shaped: anything
 * introduced by a protected keyword, plus card-length digit runs. Ordinary
 * figures ("Revenue: 42000") survive so the visual stays useful.
 */
const PROTECTED_KEYWORD =
  /(password|passcode|passphrase|otp|one[- ]time code|verification code|2fa|mfa|captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|aadhaar|passport number|pin|recovery code|seed phrase|private key|api[- ]?key|secret|token)/gi;

/** 13–19 digits (optionally spaced/dashed) — payment-card shaped. */
const CARD_LIKE = /\b(?:\d[ -]?){13,19}\b/g;

export function redactForDisplay(text: string): string {
  if (!text) return text;
  return (
    text
      // "password is swordfish" / "otp: 483920" / "token = abc123"
      .replace(
        new RegExp(`(${PROTECTED_KEYWORD.source})(\\s*(?:is|:|=)\\s*)(\\S+)`, "gi"),
        (_m, kw: string, sep: string) => `${kw}${sep}[redacted]`,
      )
      .replace(CARD_LIKE, "[redacted]")
  );
}

export type VisualBlockKind =
  "heading" | "steps" | "code" | "table" | "metrics" | "chart" | "diagram" | "text";

/** One plotted value. `display` keeps the original formatting ("42%", "1.2k"). */
export interface ChartPoint {
  label: string;
  value: number;
  display: string;
}

/** A node in a simple left-to-right flow. */
export interface DiagramStep {
  label: string;
}

export interface VisualBlock {
  kind: VisualBlockKind;
  /** Optional block title. */
  title?: string;
  /** Plain lines for text/steps; rows for tables. */
  lines?: string[];
  rows?: string[][];
  /** Language hint for code blocks. */
  language?: string;
  /** Key figures pulled from the answer. */
  metrics?: { label: string; value: string }[];
  /** Plotted series for `chart`. */
  series?: ChartPoint[];
  /** Ordered nodes for `diagram`. */
  steps?: DiagramStep[];
}

/**
 * Parse a numeric value out of a display string.
 *
 * Returns null unless the string is genuinely a single number — "42", "1,024",
 * "3.5%", "$1.2k", "-7". Deliberately strict: charting something that isn't a
 * number would invent data, so anything ambiguous stays a plain table cell.
 */
export function parseNumeric(raw: string): { value: number; display: string } | null {
  const display = (raw ?? "").trim();
  if (!display) return null;

  // Strip one leading currency symbol and any thousands separators.
  const cleaned = display.replace(/^[$£€¥₹]\s?/, "").replace(/,/g, "");
  const m = /^(-?\d+(?:\.\d+)?)\s*([%kKmMbB])?$/.exec(cleaned);
  if (!m) return null;

  let value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  switch (m[2]?.toLowerCase()) {
    case "k":
      value *= 1_000;
      break;
    case "m":
      value *= 1_000_000;
      break;
    case "b":
      value *= 1_000_000_000;
      break;
    default:
      break;
  }
  return { value, display };
}

/**
 * The unit a value is expressed in — currency symbol, percent, or none.
 *
 * Magnitude suffixes (k/M/B) are NOT part of the unit: "1.2k" and "800" are the
 * same unit and compare fine once normalised.
 */
export function unitOf(display: string): string {
  const d = (display ?? "").trim();
  const currency = /^([$£€¥₹])/.exec(d)?.[1] ?? "";
  const percent = /%\s*$/.test(d) ? "%" : "";
  return currency + percent;
}

/**
 * True when every point shares a unit, so a single axis is honest.
 *
 * Plotting "42000" next to "18%" on one scale renders the percentage as an
 * invisible sliver and invites the wrong conclusion — so mixed units are
 * refused and the values are listed instead.
 */
function sameUnit(points: ChartPoint[]): boolean {
  if (points.length === 0) return false;
  const first = unitOf(points[0].display);
  return points.every((p) => unitOf(p.display) === first);
}

/** Arrow forms a flow may use. */
const ARROW = /\s*(?:->|-->|→|=>)\s*/;

/**
 * Extract a left-to-right flow from a line like "Draft → Review → Publish".
 * Requires at least two steps, so an arrow inside prose does not become a
 * diagram.
 */
export function parseDiagram(line: string): DiagramStep[] | null {
  if (!ARROW.test(line)) return null;
  const parts = line
    .split(ARROW)
    .map((p) => p.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
  if (parts.length < 2) return null;
  // A "step" that is really a sentence means this was prose, not a flow.
  if (parts.some((p) => p.length > 40)) return null;
  return parts.map((label) => ({ label }));
}

/**
 * Build a chart from a two-column table when the second column is numeric.
 * Returns null when the data would not plot honestly.
 */
export function chartFromRows(rows: string[][]): ChartPoint[] | null {
  if (rows.length < 2) return null;
  const body = rows.filter((r) => r.length >= 2);
  if (body.length < 2) return null;

  const points: ChartPoint[] = [];
  for (const row of body) {
    const parsed = parseNumeric(row[1]);
    // Skip a header row, but never skip a row that simply isn't numeric —
    // plotting a subset would misrepresent the data.
    if (!parsed) {
      if (points.length === 0) continue;
      return null;
    }
    points.push({ label: row[0], value: parsed.value, display: parsed.display });
  }
  return points.length >= 2 && sameUnit(points) ? points : null;
}

/** Build a chart from key figures when enough of them are numeric. */
export function chartFromMetrics(metrics: { label: string; value: string }[]): ChartPoint[] | null {
  if (metrics.length < 2) return null;
  const points: ChartPoint[] = [];
  for (const m of metrics) {
    const parsed = parseNumeric(m.value);
    if (!parsed) return null;
    points.push({ label: m.label, value: parsed.value, display: parsed.display });
  }
  return points.length >= 2 && sameUnit(points) ? points : null;
}

export interface VisualPlan {
  blocks: VisualBlock[];
  /** Rough cost signal used to choose the reduced-resource path. */
  estimatedCost: "low" | "medium" | "high";
  /** True when the answer has enough structure for a visual to add value. */
  worthVisualising: boolean;
}

const FENCE = /```(\w+)?\n([\s\S]*?)```/g;
const STEP_LINE = /^\s*(?:\d+[.)]|[-*•])\s+(.*\S)/;
const METRIC_LINE = /^\s*([A-Za-z][\w \-/]{1,40}?)\s*[:=]\s*([^\s].{0,60})$/;

/**
 * Parse an answer into visual blocks. Pure; never throws on odd input.
 * All text is redacted so a visual can never leak protected content.
 */
export function planVisualResponse(answer: string): VisualPlan {
  const safe = redactForDisplay(answer ?? "");
  const blocks: VisualBlock[] = [];

  // 1) Extract fenced code first and keep the remaining prose.
  let prose = safe;
  const codeBlocks: VisualBlock[] = [];
  for (const m of safe.matchAll(FENCE)) {
    codeBlocks.push({
      kind: "code",
      language: m[1] || "text",
      lines: m[2].replace(/\s+$/, "").split("\n"),
    });
  }
  prose = prose.replace(FENCE, "\n");

  const rawLines = prose
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  // 2) Markdown tables.
  const tableRows: string[][] = [];
  const nonTable: string[] = [];
  for (const line of rawLines) {
    if (line.includes("|") && line.split("|").length >= 3) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c, i, a) => !(i === 0 || i === a.length - 1) || c);
      // Skip markdown separator rows (---|---).
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      tableRows.push(cells);
    } else {
      nonTable.push(line);
    }
  }

  // 3) Steps, flows, metrics from the remaining prose.
  const steps: string[] = [];
  const metrics: { label: string; value: string }[] = [];
  const diagrams: DiagramStep[][] = [];
  const text: string[] = [];
  for (const line of nonTable) {
    // A flow is checked before a step, so "1. Draft → Review" plots as a flow.
    const flow = parseDiagram(line);
    if (flow) {
      diagrams.push(flow);
      continue;
    }
    const step = STEP_LINE.exec(line);
    if (step) {
      steps.push(step[1]);
      continue;
    }
    const metric = METRIC_LINE.exec(line);
    if (metric) {
      metrics.push({ label: metric[1].trim(), value: metric[2].trim() });
      continue;
    }
    text.push(line);
  }

  const heading = text.find((l) => l.length <= 90);
  if (heading) blocks.push({ kind: "heading", title: heading });

  // Key figures: chart them when they are all numeric, otherwise list them.
  // A chart REPLACES the list rather than duplicating it.
  if (metrics.length > 0) {
    const series = chartFromMetrics(metrics);
    if (series) blocks.push({ kind: "chart", title: "Key figures", series });
    else blocks.push({ kind: "metrics", metrics });
  }

  if (steps.length > 0) blocks.push({ kind: "steps", lines: steps });
  for (const flow of diagrams) blocks.push({ kind: "diagram", steps: flow });

  // A two-column numeric table is shown as a chart AND kept as a table, since
  // the exact values still matter.
  if (tableRows.length > 0) {
    const series = chartFromRows(tableRows);
    if (series) blocks.push({ kind: "chart", series });
    blocks.push({ kind: "table", rows: tableRows });
  }

  blocks.push(...codeBlocks);
  const remaining = text.filter((l) => l !== heading);
  if (remaining.length > 0) blocks.push({ kind: "text", lines: remaining });

  const structural = blocks.filter((b) => b.kind !== "text" && b.kind !== "heading").length;
  const weight = safe.length + codeBlocks.length * 800 + tableRows.length * 120;
  const estimatedCost: VisualPlan["estimatedCost"] =
    weight > 12_000 ? "high" : weight > 4_000 ? "medium" : "low";

  return { blocks, estimatedCost, worthVisualising: structural > 0 };
}

export interface VisualCapabilities {
  /** Rendering components installed/available. */
  renderer: boolean;
  /** Voice output available for narration. */
  speech: boolean;
  /** Device asked for reduced motion / low performance. */
  lowResource: boolean;
}

export type VisualMode =
  | { mode: "full"; narrate: boolean }
  | { mode: "reduced"; reason: string }
  | { mode: "unavailable"; reason: string };

/**
 * Choose how to present a visual. Never claims a renderer it does not have.
 */
export function chooseVisualMode(caps: VisualCapabilities, plan: VisualPlan): VisualMode {
  if (!caps.renderer) {
    return {
      mode: "unavailable",
      reason: "Visual responses need the OCADE visual components, which aren't available here.",
    };
  }
  if (caps.lowResource || plan.estimatedCost === "high") {
    return {
      mode: "reduced",
      reason: caps.lowResource
        ? "Reduced visuals are on because this device asked for low-motion or low-performance mode."
        : "This answer is large, so OCADE is showing a lighter visual to stay responsive.",
    };
  }
  return { mode: "full", narrate: caps.speech };
}

/** Human estimate shown BEFORE any heavy render starts (decision #41). */
export function describeRenderCost(plan: VisualPlan): string {
  switch (plan.estimatedCost) {
    case "high":
      return "Large answer — rendering may take a few seconds and use noticeable CPU.";
    case "medium":
      return "Moderate answer — rendering should take about a second.";
    default:
      return "Small answer — renders instantly.";
  }
}

/** Flatten a plan to plain text for export/saving through Outputs. */
export function visualPlanToText(plan: VisualPlan): string {
  const out: string[] = [];
  for (const b of plan.blocks) {
    switch (b.kind) {
      case "heading":
        out.push(`# ${b.title ?? ""}`);
        break;
      case "metrics":
        out.push(...(b.metrics ?? []).map((m) => `${m.label}: ${m.value}`));
        break;
      case "steps":
        out.push(...(b.lines ?? []).map((l, i) => `${i + 1}. ${l}`));
        break;
      case "table":
        out.push(...(b.rows ?? []).map((r) => r.join(" | ")));
        break;
      case "code":
        out.push("```" + (b.language ?? ""), ...(b.lines ?? []), "```");
        break;
      case "chart":
        // Exported as label/value pairs so the data survives without the render.
        if (b.title) out.push(`## ${b.title}`);
        out.push(...(b.series ?? []).map((p) => `${p.label}: ${p.display}`));
        break;
      case "diagram":
        out.push((b.steps ?? []).map((s) => s.label).join(" → "));
        break;
      default:
        out.push(...(b.lines ?? []));
    }
    out.push("");
  }
  return out.join("\n").trim();
}
