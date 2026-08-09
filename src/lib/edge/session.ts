/**
 * The guarantees, composed into one send.
 *
 * Each module beside this one does a single job — seal the network, scan for
 * secrets, budget the context, meter the cost, chain the transcript, pin the
 * run. This is where they become a conversation rather than a toolbox.
 *
 * WHY A COORDINATOR AND NOT SEVEN CALLS IN THE COMPONENT. The order is load
 * bearing and it is not obvious:
 *
 *   1. PREFLIGHT before anything else. Scanning after the seal is up would be
 *      pointless (nothing can leave anyway) and scanning after a cloud send has
 *      started would be an apology rather than a control.
 *   2. BUDGET before generating, because what was dropped has to be disclosed
 *      with the answer, not discovered afterwards.
 *   3. WITNESS opened around generation only. Wider and it captures unrelated
 *      page traffic; narrower and it misses the request that matters.
 *   4. METER, LEDGER and PIN after, from what actually happened.
 *
 * Getting that order wrong produces features that appear to work and quietly
 * guarantee nothing, which is the failure this whole area exists to avoid. It
 * belongs in one tested place rather than in every screen that sends a message.
 */

import { NetworkWitness, limits as networkLimits } from "../provenance/network-witness";
import { buildReceipt, type AnswerReceipt, type SourceUse } from "../provenance/receipt";
import { Seal, type SealReport } from "./sealed-mode";
import { preflight, summarise as summarisePreflight, type Finding } from "./preflight";
import { planBudget, truncationNotice, type BudgetItem, type BudgetPlan } from "./context-budget";
import { measureRun, type RunCost, type PowerClass } from "./meter";
import { append, type LedgerEntry } from "./ledger";
import { pinRun, type PinnedRun } from "./reproducible";
import { addMessage, describeTree, type Tree } from "./checkpoints";

export interface SendGuards {
  /** Nothing may leave the device for this conversation. */
  sealed: boolean;
  /** Scan the outgoing text for credentials and personal data. */
  scanOutgoing: boolean;
  powerClass?: PowerClass;
  tariffMinorPerKwh?: number;
  contextLimitTokens: number;
}

export interface PreparedSend {
  /** False when the send must not proceed as-is. */
  proceed: boolean;
  /** Why not, when it must not. */
  blockedReason?: string;
  findings: Finding[];
  plan: BudgetPlan;
  /** Shown with the answer when context was dropped. */
  truncation: string | null;
}

/**
 * Everything that must happen BEFORE a single token is generated.
 *
 * Returns `proceed: false` rather than throwing: a refusal is an ordinary
 * outcome here, and an exception would push every caller into a try/catch that
 * treats "we protected you" the same as "something broke".
 */
export function prepareSend(input: {
  text: string;
  items: readonly BudgetItem[];
  guards: SendGuards;
}): PreparedSend {
  const { text, items, guards } = input;

  /*
   * Scanning is skipped when sealed, and that is not laziness. Sealed means
   * nothing can leave by construction, so a credential in the text is not
   * going anywhere — warning about it would train the user to dismiss the
   * warning in exactly the situation where it is harmless, which is how the
   * warning stops working for the situation where it is not.
   */
  const findings = guards.scanOutgoing && !guards.sealed ? preflight(text) : [];

  const plan = planBudget(items, guards.contextLimitTokens);

  if (plan.impossible) {
    return {
      proceed: false,
      blockedReason: plan.summary,
      findings,
      plan,
      truncation: null,
    };
  }

  const critical = findings.filter((f) => f.severity === "critical");
  if (critical.length > 0) {
    // Blocked, not warned. A critical finding means the message would put a
    // working credential into somebody's logs; that deserves a decision, not a
    // notification the user scrolls past.
    return {
      proceed: false,
      blockedReason: summarisePreflight(findings),
      findings,
      plan,
      truncation: truncationNotice(plan),
    };
  }

  return { proceed: true, findings, plan, truncation: truncationNotice(plan) };
}

export interface CompletedSend {
  receipt: AnswerReceipt;
  cost: RunCost;
  entry: LedgerEntry;
  pinned: PinnedRun;
  seal: SealReport | null;
}

/**
 * Record a turn in the branching history.
 *
 * Kept here rather than in the component so the ledger and the tree are always
 * appended together. They answer different questions — "was this altered?" and
 * "what else did I try?" — and a surface that updated one without the other
 * would produce a history whose two halves disagreed.
 */
export function recordTurn(
  tree: Tree,
  turn: { id: string; role: "user" | "assistant"; content: string; at: Date; label?: string },
): { tree: Tree; shape: string } {
  const next = addMessage(tree, turn);
  return { tree: next, shape: describeTree(next) };
}

/**
 * A guarded generation, start to finish.
 *
 * `generate` is injected rather than imported so this stays testable without an
 * engine, and so the seal is demonstrably around the REAL call — a wrapper that
 * sealed, returned, and then let the caller generate would prove nothing.
 */
export async function runGuarded(input: {
  prompt: string;
  chain: readonly LedgerEntry[];
  guards: SendGuards;
  engineLabel: string;
  modelKey: string;
  modelSha256: string;
  temperature: number;
  topP: number;
  backend: string;
  sources?: SourceUse[];
  messageId: string;
  generate: () => Promise<string>;
  now?: () => number;
  scope?: typeof globalThis;
}): Promise<CompletedSend & { answer: string }> {
  const clock = input.now ?? (() => Date.now());
  const seal = input.guards.sealed ? new Seal(input.scope) : null;
  const witness = new NetworkWitness(input.scope);

  const startedAt = new Date();
  const startedMs = clock();

  seal?.seal();
  witness.start();

  let answer = "";
  let sealReport: SealReport | null = null;
  try {
    answer = await input.generate();
  } finally {
    /*
     * `finally`, so a thrown generation still lifts the seal. A crash that left
     * the page permanently offline would be a far worse bug than the one that
     * caused it, and it would look like the seal itself was broken.
     */
    sealReport = seal?.unseal() ?? null;
  }
  const observation = witness.stop();
  const durationMs = clock() - startedMs;

  const [receipt, entry, pinned] = await Promise.all([
    buildReceipt({
      messageId: input.messageId,
      producedOn: "this_device",
      engineLabel: input.engineLabel,
      prompt: input.prompt,
      answer,
      sources: input.sources ?? [],
      observation,
      blindSpots: networkLimits(),
      startedAt,
      durationMs,
    }),
    append(input.chain, { role: "assistant", content: answer, at: startedAt }),
    pinRun({
      prompt: input.prompt,
      answer,
      modelKey: input.modelKey,
      modelSha256: input.modelSha256,
      temperature: input.temperature,
      topP: input.topP,
      backend: input.backend,
      at: startedAt,
    }),
  ]);

  const cost = measureRun({
    // Taken from the RECEIPT, not from the settings — the receipt is the one
    // derived from measurement, and a cost line that disagreed with the
    // privacy line would undermine both.
    where: receipt.leftDevice ? "cloud" : "local",
    durationMs,
    powerClass: input.guards.powerClass,
    tariffMinorPerKwh: input.guards.tariffMinorPerKwh,
  });

  return { answer, receipt, cost, entry, pinned, seal: sealReport };
}

/** Default guards: sealed off, scanning on, a conservative context budget. */
export function defaultGuards(): SendGuards {
  return {
    sealed: false,
    // On by default. A protection nobody switches on protects nobody, and this
    // one costs a few milliseconds of local string matching.
    scanOutgoing: true,
    contextLimitTokens: 4096,
  };
}
