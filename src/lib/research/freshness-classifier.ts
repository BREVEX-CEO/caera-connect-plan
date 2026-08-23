/**
 * Decide whether an ordinary Chat question needs current-information retrieval.
 *
 * This is deliberately deterministic. A small local model must not be asked to
 * decide whether its own stored knowledge is current: that is the exact case in
 * which it cannot know that it is stale. The classifier is conservative around
 * explicit time language and volatile subjects, while keeping timeless writing,
 * arithmetic and explanation requests entirely on-device.
 */

export type FreshnessRoute = "local" | "current_information";
export type FreshnessVolatility = "realtime" | "hourly" | "daily" | "stable";

export interface FreshnessDecision {
  route: FreshnessRoute;
  volatility: FreshnessVolatility;
  reason: string;
  matched: string[];
}

const EXPLICIT_CURRENT = [
  /\b(?:today|tonight|right now|as of now|currently|current|latest|newest|recent|recently|live|real[- ]time|breaking|this (?:week|month|year))\b/i,
  /\b(?:what(?:'s| is) new|up[- ]to[- ]date|still (?:available|valid|supported|open|in office))\b/i,
];

const REALTIME_SUBJECT = [
  /\b(?:weather|forecast|temperature|air quality|traffic|train status|flight status|outage|service status)\b/i,
  /\b(?:score|standings|fixture|match result|election result|poll results?)\b/i,
  /\b(?:stock|share|crypto|bitcoin|exchange rate|market price|price of|trading at)\b/i,
];

const CHANGEABLE_SUBJECT = [
  /\b(?:president|prime minister|chief minister|governor|mayor|ceo|chair(?:man|person)?|office holder)\b/i,
  /\b(?:law|regulation|rule|policy|visa|tax|gst|interest rate|compliance requirement)\b/i,
  /\b(?:software|library|framework|browser|phone|laptop|model|api)\b.*\b(?:version|release|support|price|spec|documentation)\b/i,
  /\b(?:news|announcement|release date|availability|opening hours|schedule|deadline)\b/i,
];

const TIMELESS_TRANSFORM = [
  /^\s*(?:rewrite|rephrase|summari[sz]e|translate|proofread|format|shorten|expand)\b/i,
  /^\s*(?:calculate|compute|solve)\b/i,
];

function matches(patterns: RegExp[], text: string): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[0]) found.push(match[0].toLowerCase());
  }
  return [...new Set(found)];
}

export function classifyFreshness(query: string): FreshnessDecision {
  const text = query.trim();
  if (!text) {
    return { route: "local", volatility: "stable", reason: "The prompt is empty.", matched: [] };
  }

  const explicit = matches(EXPLICIT_CURRENT, text);
  const realtime = matches(REALTIME_SUBJECT, text);
  const changeable = matches(CHANGEABLE_SUBJECT, text);

  if (explicit.length > 0) {
    return {
      route: "current_information",
      volatility: realtime.length > 0 ? "realtime" : "hourly",
      reason: "The question explicitly asks for information that may have changed.",
      matched: [...explicit, ...realtime, ...changeable],
    };
  }

  // A direct transformation of user-provided text does not become a web query
  // merely because that text contains a volatile noun such as "price".
  if (TIMELESS_TRANSFORM.some((pattern) => pattern.test(text))) {
    return {
      route: "local",
      volatility: "stable",
      reason: "The request transforms supplied text and does not need external facts.",
      matched: [],
    };
  }

  if (realtime.length > 0) {
    return {
      route: "current_information",
      volatility: "realtime",
      reason: "The subject changes too quickly for stored model knowledge to be reliable.",
      matched: realtime,
    };
  }

  if (changeable.length > 0) {
    return {
      route: "current_information",
      volatility: "daily",
      reason: "The subject is likely to change between model releases.",
      matched: changeable,
    };
  }

  return {
    route: "local",
    volatility: "stable",
    reason: "No explicit freshness dependency or volatile subject was detected.",
    matched: [],
  };
}
