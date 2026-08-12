/**
 * What is about to leave, checked before it can.
 *
 * THE ASYMMETRY THIS EXPLOITS. A cloud assistant cannot offer this feature at
 * all. By the time its servers could scan your message for an API key, the key
 * has already been transmitted, received, logged by a load balancer and written
 * to a request trace. "We detected a secret and discarded it" is an apology,
 * not a control. The check has to happen on the sending side, and only an
 * assistant that runs on the sending side can do it.
 *
 * OCADE is on the sending side. So the scan runs before the first byte moves,
 * and a finding can still change the outcome.
 *
 * DESIGNED AROUND FALSE POSITIVES, because that is what kills these tools. A
 * scanner that flags every long string trains people to click through, and a
 * warning everyone clicks through is worse than none — it launders the risk
 * into a completed dialogue. So:
 *
 *  - patterns are anchored on real credential FORMATS, not entropy alone
 *  - every finding names what it thinks it found and why
 *  - findings are individually dismissible, not one all-or-nothing prompt
 *  - the scan reports what it CANNOT catch, so nobody mistakes it for a
 *    guarantee
 *
 * NOTHING IS SENT TO CHECK IT. The scan is local string matching. A preflight
 * that phoned a service to ask whether your text contained secrets would be a
 * remarkable thing to build.
 */

export type FindingKind =
  | "private_key"
  | "api_key"
  | "aws_key"
  | "jwt"
  | "password_assignment"
  | "connection_string"
  | "email"
  | "card_number"
  | "iban";

export type Severity = "critical" | "high" | "medium";

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  /** Character offset in the scanned text. */
  at: number;
  /** Length of the match, so the caller can redact exactly. */
  length: number;
  /** A masked sample — never the secret itself. */
  preview: string;
  /** What this is, and why it matters, in the user's words. */
  explain: string;
}

interface Rule {
  kind: FindingKind;
  severity: Severity;
  pattern: RegExp;
  explain: string;
  /** Extra check for patterns that need arithmetic, not just shape. */
  confirm?: (match: string) => boolean;
}

/**
 * Luhn check for card numbers.
 *
 * Shape alone matches phone numbers, order ids and timestamps. Without this
 * the scanner would flag a 16-digit invoice number as a payment card, and the
 * second time that happens the user stops reading the warnings.
 */
function luhnValid(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const RULES: Rule[] = [
  {
    kind: "private_key",
    severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    explain:
      "This is a private key. Anyone who has it can act as you — sending it anywhere is equivalent to handing over the account it belongs to.",
  },
  {
    kind: "aws_key",
    severity: "critical",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    explain: "This looks like an AWS access key id, which usually appears next to its secret.",
  },
  {
    kind: "api_key",
    severity: "critical",
    // Common vendor-prefixed key formats. Prefix-anchored on purpose: a bare
    // "long random string" rule flags git hashes and base64 images.
    pattern:
      /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bghp_[A-Za-z0-9]{36}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    explain: "This looks like an API key. Keys in a message tend to end up in logs and history.",
  },
  {
    kind: "jwt",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    explain:
      "This is a signed token. It may still be valid, and it often carries your identity and permissions.",
  },
  {
    kind: "connection_string",
    severity: "critical",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@]+:[^\s@]+@\S+/g,
    explain: "This is a database connection string with a password in it.",
  },
  {
    kind: "password_assignment",
    severity: "high",
    pattern: /\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
    explain: "This looks like a password or secret being assigned to a name.",
  },
  {
    kind: "card_number",
    severity: "critical",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    confirm: luhnValid,
    explain:
      "This passes the checksum used by payment cards, so it is probably a real card number.",
  },
  {
    kind: "iban",
    severity: "high",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    explain: "This looks like an IBAN — a bank account number.",
  },
  {
    kind: "email",
    severity: "medium",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    explain: "This is an email address. It identifies a person.",
  },
];

/** Mask a match so the finding can be shown without repeating the secret. */
function mask(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 4)}${"•".repeat(Math.min(12, trimmed.length - 8))}${trimmed.slice(-4)}`;
}

/**
 * Scan text for things that should not leave without a decision.
 *
 * Pure and synchronous: no network, no storage, no async. The whole point is
 * that this completes before anything is sent.
 */
export function preflight(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    // `lastIndex` is reset because these are module-level /g regexes and a
    // retained index would make the second scan of the same text miss matches.
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      if (match[0].length === 0) break;
      if (rule.confirm && !rule.confirm(match[0])) continue;
      findings.push({
        kind: rule.kind,
        severity: rule.severity,
        at: match.index,
        length: match[0].length,
        preview: mask(match[0]),
        explain: rule.explain,
      });
    }
  }

  /*
   * Overlaps are resolved in favour of the more severe finding. A connection
   * string contains a password assignment; reporting both would present one
   * mistake as two and make the list look padded.
   */
  const rank: Record<Severity, number> = { critical: 3, high: 2, medium: 1 };
  const kept: Finding[] = [];
  for (const finding of findings.sort((a, b) => rank[b.severity] - rank[a.severity])) {
    const overlaps = kept.some(
      (k) => finding.at < k.at + k.length && k.at < finding.at + finding.length,
    );
    if (!overlaps) kept.push(finding);
  }
  return kept.sort((a, b) => a.at - b.at);
}

/** Replace every finding with a marker, preserving everything else. */
export function redact(text: string, findings: Finding[]): string {
  let out = "";
  let cursor = 0;
  for (const finding of [...findings].sort((a, b) => a.at - b.at)) {
    if (finding.at < cursor) continue;
    out += text.slice(cursor, finding.at) + `[${finding.kind.replace(/_/g, " ")} removed]`;
    cursor = finding.at + finding.length;
  }
  return out + text.slice(cursor);
}

/** The headline. Refuses to say "clean" — it says what was checked. */
export function summarise(findings: Finding[]): string {
  if (findings.length === 0) {
    return "Nothing that looks like a credential or personal detail was found in this message.";
  }
  const critical = findings.filter((f) => f.severity === "critical").length;
  if (critical > 0) {
    return `${critical} ${critical === 1 ? "item" : "items"} in this message could give someone access to an account. Sending it will put ${critical === 1 ? "it" : "them"} in a server's logs.`;
  }
  return `${findings.length} personal ${findings.length === 1 ? "detail" : "details"} found in this message.`;
}

/**
 * What the scan cannot catch.
 *
 * Shown alongside a clean result, because "we found nothing" and "there is
 * nothing" are different statements and only one of them is true here.
 */
export function scanLimits(): string[] {
  return [
    "This matches known credential formats. A secret in an unusual format will not be recognised.",
    "It cannot tell whether a name, address or number in your text is sensitive to you.",
    "Anything already inside an attached file is not scanned here.",
  ];
}
