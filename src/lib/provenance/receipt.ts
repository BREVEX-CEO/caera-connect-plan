/**
 * A receipt for one answer: what produced it, what it read, and what left.
 *
 * THE GAP THIS FILLS. Every assistant tells you what it thinks. None of them
 * tell you what they *did*. Ask a cloud assistant "did you actually read my
 * whole document, or a fragment of it?", "which of my files did this come
 * from?", "was any of this sent anywhere?" — and there is no answer available
 * even in principle, because the work happened on a machine the user cannot
 * inspect and the vendor's reassurance is unfalsifiable by construction.
 *
 * OCADE can answer all three, because the work happens on the user's own
 * hardware. That is a structural advantage, not a better prompt, and this is
 * where it becomes a feature the user can hold.
 *
 * A RECEIPT IS ONLY WORTH HAVING IF IT CAN BE WRONG. Two rules follow:
 *
 * 1. EVERY FIELD IS A MEASUREMENT, NOT A SETTING. `leftDevice` comes from the
 *    browser's own resource-timing log (see `network-witness.ts`), not from
 *    the privacy mode the user selected. A receipt that simply echoed the
 *    configuration would agree with itself in exactly the case where the
 *    configuration was not honoured — the only case anyone cares about.
 *
 * 2. UNKNOWN IS ITS OWN VALUE. Where something could not be observed the
 *    receipt says so rather than defaulting to the flattering answer. A
 *    receipt that cannot distinguish "nothing was sent" from "we did not
 *    check" is worse than no receipt, because it launders the second into
 *    the first.
 */

import { sha256OfText } from "./digest";
import type { NetworkObservation } from "./network-witness";

/** Where the answer was produced. */
export type ProducedOn = "this_device" | "ocade_cloud" | "paired_computer";

export interface SourceUse {
  /** File or page name as the user knows it. */
  name: string;
  /** Digest of the exact text considered, so a changed file is detectable. */
  sha256: string;
  /** Sections actually put in front of the engine. */
  passagesUsed: number;
  /** Sections the document was split into. */
  passagesTotal: number;
  category?: "attached_document" | "project_context" | "internet_evidence";
  url?: string;
  domain?: string;
  publishedAt?: string | null;
  retrievedAt?: string;
}

export interface NetworkUse {
  purpose: "current_information";
  provider: string;
  contacted: string[];
  querySent: boolean;
  retrievedAt: string;
}

export interface AnswerReceipt {
  /** Stable id of the answer this describes. */
  messageId: string;
  producedOn: ProducedOn;
  /** Capability label — never a vendor or model name in the user's view. */
  engineLabel: string;
  /** Digest of the exact prompt, so the same question is recognisable. */
  promptSha256: string;
  /** Digest of the answer as delivered. */
  answerSha256: string;
  sources: SourceUse[];
  /** Explicit server-side retrieval that browser resource timing cannot see. */
  networkUses?: NetworkUse[];
  /**
   * Whether anything left this device while the answer was produced.
   *
   * `null` means it could not be observed — never quietly false.
   */
  leftDevice: boolean | null;
  /** Origins contacted during generation, when measured. Off-machine only. */
  contacted: string[];
  /**
   * A server on this machine that produced the answer, when there was one.
   *
   * Separate from `contacted` because it is not a place data went — it is a
   * place data stayed. Ollama on `localhost:11434` is on the user's own
   * computer; listing it as a destination would be a false alarm.
   */
  localServer: string | null;
  /** What the measurement could not see. Shown, not hidden. */
  blindSpots: string[];
  startedAt: string;
  durationMs: number;
  /** Version of the receipt format, so an old receipt stays readable. */
  version: 1;
}

export interface ReceiptInput {
  messageId: string;
  producedOn: ProducedOn;
  engineLabel: string;
  prompt: string;
  answer: string;
  sources: SourceUse[];
  networkUses?: NetworkUse[];
  observation: NetworkObservation;
  blindSpots: string[];
  startedAt: Date;
  durationMs: number;
}

/**
 * Build a receipt from what was actually observed.
 *
 * Async only because digesting uses Web Crypto. Never throws: a receipt that
 * fails to build must not take the answer down with it.
 */
export async function buildReceipt(input: ReceiptInput): Promise<AnswerReceipt> {
  const [promptSha256, answerSha256] = await Promise.all([
    sha256OfText(input.prompt),
    sha256OfText(input.answer),
  ]);

  /*
   * `leftDevice` is derived from the measurement and nothing else.
   *
   * Note what is NOT consulted here: the conversation's privacy mode, the
   * engine preference, or which adapter the router chose. Those are intentions.
   * A receipt exists to report what happened, and the only interesting case is
   * the one where the two disagree.
   */
  const revealing = input.observation.contacts.filter(
    (c) => c.kind === "data" || c.kind === "third_party",
  );
  const explicitContacts = (input.networkUses ?? []).flatMap((use) => use.contacted);
  const leftDevice =
    explicitContacts.length > 0 ? true : input.observation.measured ? revealing.length > 0 : null;

  return {
    messageId: input.messageId,
    producedOn: input.producedOn,
    engineLabel: input.engineLabel,
    promptSha256,
    answerSha256,
    sources: input.sources,
    ...(input.networkUses && input.networkUses.length > 0
      ? { networkUses: input.networkUses }
      : {}),
    leftDevice,
    // Only the contacts that could have carried content OFF the machine.
    // Listing the app's own asset requests, or an engine on localhost, would
    // put an on-device address in a "sent to" line.
    contacted: [
      ...new Set([
        ...(input.observation.measured ? revealing.map((c) => c.origin) : []),
        ...explicitContacts,
      ]),
    ],
    localServer: input.observation.contacts.find((c) => c.kind === "loopback")?.origin ?? null,
    blindSpots: input.blindSpots,
    startedAt: input.startedAt.toISOString(),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    version: 1,
  };
}

/**
 * The one-line verdict.
 *
 * Ordered by what would alarm a person most, so the worst true thing is the
 * thing they read first.
 */
export function verdict(receipt: AnswerReceipt): {
  tone: "private" | "sent" | "unknown";
  headline: string;
} {
  if (receipt.leftDevice === null) {
    return {
      tone: "unknown",
      headline: "OCADE could not check whether anything was sent for this answer.",
    };
  }
  if (receipt.leftDevice) {
    const research = receipt.networkUses?.find((use) => use.purpose === "current_information");
    if (research) {
      return {
        tone: "sent",
        headline: `The answer was generated on this device after OCADE used ${research.provider} to retrieve current information from ${research.contacted.length} ${research.contacted.length === 1 ? "source" : "sources"}. No hosted AI received the prompt.`,
      };
    }
    return {
      tone: "sent",
      headline: `This answer used ${receipt.engineLabel}, and your browser recorded requests to ${receipt.contacted.join(", ")}.`,
    };
  }
  if (receipt.localServer) {
    /*
     * Still private in the sense that matters — nothing reached a network —
     * but produced by a program OCADE did not write. Saying so is the
     * difference between a receipt and a reassurance.
     */
    return {
      tone: "private",
      headline: `This answer was produced on this computer, by an engine running at ${receipt.localServer}. Nothing left the machine.`,
    };
  }
  return {
    tone: "private",
    headline:
      "This answer was produced entirely on this device. Your browser recorded no network requests while it ran.",
  };
}

/**
 * How much of each source was actually consulted.
 *
 * The honest version of "I read your document". A 200-page report that
 * contributed four sections is not a document that was read, and saying so is
 * the difference between a citation and a claim.
 */
export function describeSourceUse(use: SourceUse): string {
  if (use.category === "internet_evidence") {
    const date = use.publishedAt ?? use.retrievedAt;
    return `${use.name} — current-information evidence from ${use.domain ?? "the web"}${date ? ` (${date})` : ""}.`;
  }
  const prefix = use.category === "project_context" ? "Project context: " : "";
  if (use.passagesTotal === 0) return `${prefix}${use.name} — nothing readable was extracted.`;
  if (use.passagesUsed >= use.passagesTotal) {
    return `${prefix}${use.name} — read in full (${use.passagesTotal} ${
      use.passagesTotal === 1 ? "section" : "sections"
    }).`;
  }
  return `${prefix}${use.name} — ${use.passagesUsed} of ${use.passagesTotal} sections were used; the rest were searched and did not match.`;
}

/**
 * A digest OVER the receipt, so two people can compare one answer.
 *
 * Field order is fixed explicitly rather than taken from `JSON.stringify` of
 * the object, because key order is an implementation detail and a digest that
 * changes when a field is reordered proves nothing about the content.
 */
export async function receiptDigest(receipt: AnswerReceipt): Promise<string> {
  const canonical = [
    receipt.version,
    receipt.messageId,
    receipt.producedOn,
    receipt.engineLabel,
    receipt.promptSha256,
    receipt.answerSha256,
    receipt.leftDevice === null ? "unknown" : String(receipt.leftDevice),
    [...receipt.contacted].sort().join(","),
    receipt.localServer ?? "",
    receipt.sources
      .map(
        (s) =>
          `${s.category ?? "attached_document"}:${s.name}:${s.sha256}:${s.passagesUsed}/${s.passagesTotal}:${s.url ?? ""}:${s.retrievedAt ?? ""}`,
      )
      .sort()
      .join("|"),
    (receipt.networkUses ?? [])
      .map(
        (use) =>
          `${use.purpose}:${use.provider}:${use.querySent}:${[...use.contacted].sort().join(",")}:${use.retrievedAt}`,
      )
      .sort()
      .join("|"),
    receipt.startedAt,
  ].join("\n");
  return await sha256OfText(canonical);
}

/**
 * Re-derive a receipt's digest and compare.
 *
 * The point of exporting a receipt is that somebody else can check it. This is
 * that check: tamper with any field the digest covers and it stops matching.
 */
export async function verifyReceipt(
  receipt: AnswerReceipt,
  expectedDigest: string,
): Promise<{ ok: boolean; reason: string }> {
  const actual = await receiptDigest(receipt);
  if (actual === expectedDigest) {
    return { ok: true, reason: "This receipt matches its fingerprint and has not been altered." };
  }
  return {
    ok: false,
    reason: "This receipt does not match its fingerprint. It has been altered since it was issued.",
  };
}

/** Plain text, for pasting into a ticket or an audit trail. */
export function receiptToText(receipt: AnswerReceipt, digest: string): string {
  const lines = [
    "OCADE ANSWER RECEIPT",
    `Issued        ${receipt.startedAt}`,
    `Answer id     ${receipt.messageId}`,
    `Produced on   ${receipt.producedOn.replace(/_/g, " ")} (${receipt.engineLabel})`,
    `Took          ${receipt.durationMs} ms`,
    `Question hash ${receipt.promptSha256}`,
    `Answer hash   ${receipt.answerSha256}`,
    "",
    verdict(receipt).headline,
  ];
  if (receipt.sources.length > 0) {
    lines.push("", "What it read:");
    for (const source of receipt.sources) lines.push(`  - ${describeSourceUse(source)}`);
  }
  if (receipt.networkUses?.length) {
    lines.push("", "Network retrieval:");
    for (const use of receipt.networkUses) {
      lines.push(
        `  - ${use.provider}: ${use.querySent ? "query sent" : "query not sent"}; ${use.contacted.join(", ")}`,
      );
    }
  }
  if (receipt.blindSpots.length > 0) {
    lines.push("", "What this check cannot see:");
    for (const limit of receipt.blindSpots) lines.push(`  - ${limit}`);
  }
  lines.push("", `Receipt fingerprint ${digest}`);
  return lines.join("\n");
}
