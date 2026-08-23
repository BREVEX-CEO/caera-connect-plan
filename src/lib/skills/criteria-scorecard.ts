/**
 * Criteria scorecard.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT.
 *
 * This scores OCADE against eight named criteria for agentic work: correctness,
 * verified completion, offline capability, approval safety, controllability,
 * recovery, efficiency, and auditability. For each one it points at the
 * specific mechanism in this repository and the test that proves the mechanism
 * behaves as claimed.
 *
 * It is **not** a comparison against any other product. Nobody here has run
 * Claude Cowork, or any competitor, on a shared benchmark; a "parity %" or
 * "superiority %" derived without doing that would be a number invented to fill
 * a slot, and every honest thing in this codebase — the refusals, the
 * `coverageNote`s, the unverified receipts — exists to prevent exactly that. A
 * scorecard that fabricated its own headline figure would discredit the
 * refusals it sits beside.
 *
 * What IS here is falsifiable: each criterion names a module and a test file,
 * and `criteria-scorecard.test.ts` checks on disk that every one of them still
 * exists. Delete a mechanism and the suite goes red. That makes the score decay
 * when the code stops backing it, which a hand-written percentage never does.
 */
import { PackRegistry, coverageReport } from "./pack-registry";

export type CriterionId =
  | "correctness"
  | "verified_completion"
  | "offline"
  | "approval_safety"
  | "controllability"
  | "recovery"
  | "efficiency"
  | "auditability";

export interface Criterion {
  id: CriterionId;
  /** What is being judged, in the user's terms. */
  label: string;
  /** The mechanism that delivers it. */
  mechanism: string;
  /** Modules that implement it — checked to still exist by the test suite. */
  modules: string[];
  /** Test files that prove it. */
  provenBy: string[];
  /** Honest statement of what is still missing for this criterion. */
  gap: string;
}

export const CRITERIA: Criterion[] = [
  {
    id: "correctness",
    label: "Wrong actions and false successes",
    mechanism:
      'Every capability declares how its result is verified. A capability whose verifyBy is "none" cannot be reported as succeeded, and an unverified result is written into the receipt as NOT CONFIRMED rather than omitted.',
    modules: ["lib/skills/work-session.ts", "lib/skills/executor-registry.ts"],
    provenBy: ["work-session.test.ts", "executor-registry.test.ts", "data-workbench.test.ts"],
    gap: 'Verification is only as good as the check each pack performs. A pack whose verifyBy is "ui" trusts the application\'s own display.',
  },
  {
    id: "verified_completion",
    label: "Completion backed by evidence",
    mechanism:
      "Every run produces a receipt carrying the method used, the capability, and the evidence — including for refusals and failures. An executor that is unavailable produces no receipt at all rather than an empty one.",
    modules: ["lib/skills/skill-pack.ts", "lib/skills/executor-registry.ts"],
    provenBy: ["skill-pack.test.ts", "executor-registry.test.ts"],
    gap: "Receipts are not yet persisted across devices; they live for the session.",
  },
  {
    id: "offline",
    label: "Work that continues without a network",
    mechanism:
      "The data capabilities are pure JavaScript and run in the browser with no companion and no network. The executor registry registers ONLY those, so a control that would fail offline is never shown.",
    modules: ["lib/skills/default-executors.ts", "lib/skills/packs/data-pack.ts"],
    provenBy: ["default-executors.test.ts", "data-workbench-render.test.tsx"],
    gap: "File, git, archive and integrity work needs the signed companion, which has never been linked in this environment.",
  },
  {
    id: "approval_safety",
    label: "Approvals that bound what can happen",
    mechanism:
      "One scoped approval per task, expiring after 30 minutes, checked BEFORE anything else in the planning sequence. Protected input cannot be covered by any approval — escalation is refused outright, not offered.",
    modules: ["lib/skills/task-scope.ts", "lib/skills/session-recording.ts"],
    provenBy: ["task-scope.test.ts", "session-recording.test.ts", "data-workbench.test.ts"],
    gap: "Scope renewal is per-surface; there is no single place to review every live approval at once.",
  },
  {
    id: "controllability",
    label: "Pause, cancel, undo and replay",
    mechanism:
      "Planned steps are inspectable before they run, mutating capabilities are marked as such, and the work-session panel exposes replay and undo over the recorded steps.",
    modules: ["lib/skills/work-session.ts", "components/ocade/WorkSessionPanel.tsx"],
    provenBy: ["work-session.test.ts"],
    gap: "Undo depends on the pack providing an inverse; the file and git packs do, the read-only packs have nothing to undo.",
  },
  {
    id: "recovery",
    label: "Recovering from a failing route",
    mechanism:
      "Adapter health tracks failures per control method, marks a method failing after two, and re-checks ALL outstanding preconditions rather than only the one that failed. A single success clears the record.",
    modules: ["lib/skills/adapter-health.ts"],
    provenBy: ["adapter-health.test.ts"],
    gap: "Health is per-session; a method that failed yesterday starts clean today.",
  },
  {
    id: "efficiency",
    label: "Not re-scanning what it already knows",
    mechanism:
      "An inspected application is fingerprinted (version, window title, control count, locale) and its map cached. The map is reused until the fingerprint changes, and a fresh map raises confidence — but only by a capped amount, so a learned map never equals a tested pack.",
    modules: ["lib/skills/app-map.ts", "lib/skills/skill-pack.ts"],
    provenBy: ["app-map.test.ts", "skill-pack.test.ts"],
    gap: "Maps are stored per-device in local storage, so a second machine re-learns from scratch.",
  },
  {
    id: "auditability",
    label: "Privacy and a reviewable record",
    mechanism:
      "Recordable input is filtered before it reaches the DOM, protected fields are never captured, raw model identity is redacted on persist, generation never leaves the device at all, and the clinical pack proves the strongest form of this: it reports THAT a patient identifier is present without ever emitting its value.",
    modules: [
      "lib/skills/session-recording.ts",
      "lib/skills/packs/clinical-pack.ts",
      "lib/prompt/assemble.ts",
    ],
    provenBy: ["session-recording.test.ts", "clinical-pack.test.ts", "ocade-identity.test.ts"],
    gap: "Audit records are local; there is no exportable signed audit trail yet.",
  },
];

export interface ScorecardRow extends Criterion {
  /** True when the criterion has both a mechanism and a test naming it. */
  backed: boolean;
}

export interface Scorecard {
  rows: ScorecardRow[];
  /** Criteria with a mechanism proven by at least one test. */
  backedCount: number;
  total: number;
  /** Categories OCADE drives, versus those it only reads files for. */
  categoriesDriven: number;
  categoriesFileOnly: number;
  categoriesTotal: number;
}

export function buildScorecard(registry = new PackRegistry()): Scorecard {
  const coverage = coverageReport(registry);
  const rows: ScorecardRow[] = CRITERIA.map((c) => ({
    ...c,
    backed: c.modules.length > 0 && c.provenBy.length > 0,
  }));

  return {
    rows,
    backedCount: rows.filter((r) => r.backed).length,
    total: rows.length,
    categoriesDriven: coverage.filter((r) => r.supported && !r.formatOnly).length,
    categoriesFileOnly: coverage.filter((r) => r.formatOnly).length,
    categoriesTotal: coverage.length,
  };
}

/**
 * The sentence this scorecard is allowed to say, and the one it is not.
 *
 * Kept as a single exported string so the disclaimer cannot drift away from the
 * numbers it qualifies — a caller that shows the figures gets this with them.
 */
export const SCORECARD_SCOPE =
  "These figures describe OCADE against the eight criteria listed here, each tied to code and a test. They are not a comparison with any other product: no competing agent has been run on a shared benchmark from this repository, so any parity or superiority percentage would be invented rather than measured.";

/** One line for the UI, carrying both numbers and never merging them. */
export function describeScorecard(s: Scorecard): string {
  return `${s.backedCount} of ${s.total} criteria are backed by a named mechanism and a test. OCADE drives the software in ${s.categoriesDriven} of ${s.categoriesTotal} categories and reads files in ${s.categoriesFileOnly} more.`;
}
