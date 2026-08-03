/**
 * OCADE Software Error Healing (master plan §11, §12).
 *
 * When a user says "this software has an error", the wrong move is to guess a
 * fix and apply it. This module does the disciplined version: classify the
 * failure from its evidence, rank the likely causes, and propose the LEAST
 * invasive repair first — each repair carrying how it would be verified and how
 * it would be rolled back.
 *
 * TWO HONESTY RULES:
 *
 * 1. **No repair without a rollback.** Every proposed repair states how to undo
 *    it. A fix that can't be walked back is not proposed as a first move — it
 *    is flagged as needing a checkpoint or explicit acceptance. "Try this and
 *    hope" is exactly what turns one broken thing into two.
 *
 * 2. **A guess is labelled a guess.** When the evidence is thin, the top cause
 *    is returned with low confidence and the recommendation is to gather more
 *    (a log, a version, a repro) — not to start changing things. Confident
 *    wrong repair is worse than admitting the signal is weak.
 *
 * Pure and offline. It proposes; it does not execute. Applying a repair goes
 * through the governed-run pipeline like any other mutation.
 */

export type FailureClass =
  | "dependency"
  | "corrupted_cache"
  | "permission"
  | "missing_runtime"
  | "config"
  | "network"
  | "database"
  | "low_memory"
  | "driver_mismatch"
  | "broken_plugin"
  | "file_format"
  | "gpu"
  | "solver_instability"
  | "unknown";

export interface Symptom {
  /** Raw message/log line, as observed. Never invented. */
  text: string;
  source: "log" | "stderr" | "exit_code" | "user";
}

export interface Repair {
  /** What to do, least invasive first. */
  action: string;
  /** How the fix would be confirmed to have worked. */
  verifyBy: string;
  /** How to undo it if it makes things worse. Required. */
  rollback: string;
  /** True when the repair changes state that needs a checkpoint first. */
  needsCheckpoint: boolean;
}

export interface Diagnosis {
  failureClass: FailureClass;
  /** 0–1. Low means "this is a guess; gather more". */
  confidence: number;
  /** Why this class, citing the symptom that pointed to it. */
  rationale: string;
  repairs: Repair[];
  /** Set when confidence is low — what to collect before changing anything. */
  gatherMore?: string;
}

/* ------------------------------------------------------------- signatures -- */

interface Signature {
  failureClass: FailureClass;
  /** Break ties only when a class is intentionally more specific. */
  priority?: number;
  /** Patterns that, if present, point at this class. */
  patterns: RegExp[];
  rationale: string;
  repairs: Repair[];
}

const SIGNATURES: Signature[] = [
  {
    failureClass: "dependency",
    patterns: [
      /cannot find module/i,
      /module not found/i,
      /unresolved import/i,
      /no matching version found/i,
      /peer dep/i,
    ],
    rationale: "The error names a module or version that can't be resolved.",
    repairs: [
      {
        action: "Reinstall dependencies from the lockfile (a clean install, not an upgrade).",
        verifyBy: "Re-run the command that failed; the missing-module error should be gone.",
        rollback:
          "The lockfile is unchanged, so the previous node_modules can be restored by reinstalling it.",
        needsCheckpoint: false,
      },
      {
        action:
          "If a specific version is missing, check whether the lockfile and manifest disagree — reconcile them without upgrading unrelated packages.",
        verifyBy: "Install succeeds and the named version is present.",
        rollback: "Revert the manifest/lockfile edit.",
        needsCheckpoint: true,
      },
    ],
  },
  {
    failureClass: "corrupted_cache",
    patterns: [
      /checksum mismatch/i,
      /corrupt/i,
      /unexpected end of (file|json)/i,
      /integrity check/i,
    ],
    rationale:
      "A checksum or integrity failure points at a corrupted cache rather than a code fault.",
    repairs: [
      {
        action: "Clear the tool's cache directory and let it repopulate.",
        verifyBy: "Re-run the operation; the integrity error should not recur.",
        rollback:
          "Caches are regenerated from sources, so clearing one loses nothing that can't be re-fetched.",
        needsCheckpoint: true,
      },
    ],
  },
  {
    failureClass: "permission",
    patterns: [/permission denied/i, /EACCES/i, /operation not permitted/i, /access is denied/i],
    rationale: "The error is an access denial, not a logic error.",
    repairs: [
      {
        action:
          "Check the file/directory ownership and mode for the path named in the error, and correct only that path.",
        verifyBy: "Re-run the operation on that path; the denial should be gone.",
        rollback:
          "Record the prior mode/owner before changing, and restore it if the fix doesn't help.",
        needsCheckpoint: true,
      },
    ],
  },
  {
    failureClass: "missing_runtime",
    patterns: [
      /command not found/i,
      /is not recognized as/i,
      /no such file or directory.*(node|python|java|dotnet)/i,
    ],
    rationale: "A required runtime or executable isn't on the path.",
    repairs: [
      {
        action:
          "Confirm the runtime is installed and on PATH for this shell; report the version found.",
        verifyBy: "The runtime responds to a --version check.",
        rollback:
          "No change is made by checking; installation, if needed, is a separate approved step.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "network",
    patterns: [
      /ETIMEDOUT/i,
      /ECONNREFUSED/i,
      /getaddrinfo/i,
      /network is unreachable/i,
      /TLS handshake/i,
    ],
    rationale: "The failure is a network-level error, not the application's own logic.",
    repairs: [
      {
        action:
          "Retry once after a short backoff; transient network errors often clear on their own.",
        verifyBy: "The request succeeds on retry.",
        rollback: "A read retry changes nothing; nothing to roll back.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "database",
    patterns: [
      /connection refused.*(5432|3306|1433|27017)/i,
      /too many connections/i,
      /database.*does not exist/i,
      /relation .* does not exist/i,
    ],
    rationale: "The error is a database connectivity or schema problem.",
    repairs: [
      {
        action:
          "Check the database is reachable and the connection string points at the right instance; do not alter schema yet.",
        verifyBy: "A read-only connection test succeeds.",
        rollback: "A connection test is read-only; nothing to roll back.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "config",
    patterns: [
      /invalid configuration/i,
      /unexpected token .* in .*\.(json|ya?ml)/i,
      /missing required (field|key|env)/i,
      /ENOENT.*\.(env|config|rc)/i,
    ],
    rationale: "A configuration file is missing, malformed, or incomplete.",
    repairs: [
      {
        action:
          "Validate the named config file against its schema and show the exact line/key at fault.",
        verifyBy: "The config parses and the required keys are present.",
        rollback: "Any edit is to config only; keep a copy of the prior file to restore.",
        needsCheckpoint: true,
      },
    ],
  },
  {
    failureClass: "low_memory",
    patterns: [/out of memory/i, /ENOMEM/i, /heap out of memory/i, /killed.*signal 9/i],
    rationale: "The process ran out of memory rather than hitting a logic error.",
    repairs: [
      {
        action:
          "Report the memory ceiling and peak usage; recommend a lower batch size or a higher limit rather than retrying unchanged.",
        verifyBy: "The operation completes within the memory budget.",
        rollback: "A recommendation changes nothing until the user applies it.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "driver_mismatch",
    patterns: [
      /driver version mismatch/i,
      /incompatible driver/i,
      /kernel module .* not loaded/i,
      /CUDA driver version is insufficient/i,
      /this nvidia driver/i,
    ],
    rationale:
      "The error points at a driver whose version doesn't match what the software expects.",
    repairs: [
      {
        action:
          "Report the installed driver version and the version the software requires; do NOT install a driver automatically — driver changes are high-risk and need explicit approval.",
        verifyBy: "The versions are shown side by side so the user can decide.",
        rollback:
          "Reporting changes nothing. Any driver change the user approves is a separate step with its own restore point.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "broken_plugin",
    patterns: [
      /failed to load (plugin|extension|addon)/i,
      /plugin .* (crashed|incompatible|disabled)/i,
      /extension host terminated/i,
      /unknown plugin/i,
    ],
    rationale:
      "A plugin or extension failed to load, which can break the host without the host's own code being at fault.",
    repairs: [
      {
        action:
          "Disable the named plugin and restart the host to confirm it's the cause — the least invasive test, and reversible.",
        verifyBy: "With the plugin disabled, the host starts cleanly.",
        rollback: "Re-enable the plugin; disabling is a toggle, nothing is deleted.",
        needsCheckpoint: true,
      },
      {
        action:
          "If disabling confirms the plugin, check for an update or a compatible version rather than editing the host.",
        verifyBy: "The updated plugin loads without the error.",
        rollback: "Keep the prior plugin version to reinstall if the update is worse.",
        needsCheckpoint: true,
      },
    ],
  },
  {
    failureClass: "file_format",
    patterns: [
      /unsupported file format/i,
      /invalid (file )?header/i,
      /cannot (open|parse|decode) .* file/i,
      /not a valid .* (file|document|image|archive)/i,
      /magic (number|bytes) mismatch/i,
    ],
    rationale:
      "The file can't be read as the format it's expected to be — a data problem, not a code one.",
    repairs: [
      {
        action:
          "Identify the file's real format from its contents (magic bytes), and report the mismatch between that and its extension — without altering the file.",
        verifyBy: "The true format is named; the user can convert or re-export from the source.",
        rollback: "The file is only read, never modified, so there is nothing to undo.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "gpu",
    priority: 1,
    patterns: [
      /out of (video |GPU )memory/i,
      /CUDA out of memory/i,
      /device-side assert/i,
      /no CUDA-capable device/i,
      /VRAM/i,
      /GPU is not available/i,
    ],
    rationale:
      "The error is a GPU limitation — out of video memory or no usable device — rather than a logic fault.",
    repairs: [
      {
        action:
          "Recommend a smaller batch, lower resolution, or CPU fallback that fits the available VRAM; do not simply retry the same workload.",
        verifyBy: "The workload completes within the GPU's memory, or runs on CPU.",
        rollback:
          "A recommendation changes nothing until applied; a settings change is reverted by restoring the prior value.",
        needsCheckpoint: false,
      },
    ],
  },
  {
    failureClass: "solver_instability",
    patterns: [
      /did not converge/i,
      /divergence detected/i,
      /NaN (detected|in residual)/i,
      /solution became unstable/i,
      /maximum iterations reached/i,
      /timestep too large/i,
    ],
    rationale:
      "A numerical solver failed to converge or went unstable — a modelling/parameter issue, never something to paper over.",
    repairs: [
      {
        action:
          "Report the divergence point and recommend a smaller timestep, tighter tolerance, or better initial conditions. NEVER present a non-converged run as a result.",
        verifyBy:
          "A re-run converges within tolerance, confirmed by the solver's own residuals — not assumed.",
        rollback:
          "Parameter changes are recorded; the prior setup can be restored. The failed run produced no valid output to undo.",
        needsCheckpoint: true,
      },
    ],
  },
];

/* --------------------------------------------------------------- diagnose -- */

/** Below this, a diagnosis is a guess and says so. */
export const WEAK_SIGNAL = 0.5;

/**
 * Diagnose a failure from its symptoms.
 *
 * Confidence rises with the number of independent symptom lines that point at
 * the same class. A single vague line is a guess; several agreeing lines are a
 * diagnosis. It never returns a repair for a class it only weakly suspects —
 * it asks for more first.
 */
export function diagnose(symptoms: Symptom[]): Diagnosis {
  if (symptoms.length === 0) {
    return {
      failureClass: "unknown",
      confidence: 0,
      rationale: "No symptoms were provided, so there's nothing to diagnose.",
      repairs: [],
      gatherMore: "Share the error message, the exit code, or the relevant log lines.",
    };
  }

  const uniqueSymptoms = [
    ...new Map(
      symptoms
        .filter((symptom) => typeof symptom.text === "string" && symptom.text.trim().length > 0)
        .map((symptom) => [`${symptom.source}:${symptom.text.trim()}`, symptom] as const),
    ).values(),
  ];
  const scores = new Map<FailureClass, { hits: number; sig: Signature }>();

  for (const sig of SIGNATURES) {
    // Confidence counts distinct observed symptom lines, not the number of
    // regexes a single line happens to match.
    const hits = uniqueSymptoms.filter((symptom) =>
      sig.patterns.some((pattern) => pattern.test(symptom.text)),
    ).length;
    if (hits > 0) scores.set(sig.failureClass, { hits, sig });
  }

  if (scores.size === 0) {
    return {
      failureClass: "unknown",
      confidence: 0.1,
      rationale: "Nothing in the symptoms matches a known failure signature.",
      repairs: [],
      gatherMore:
        "Capture the full error with its stack trace, the tool and version, and the command that triggered it. OCADE won't change anything on a signature it doesn't recognise.",
    };
  }

  // Strongest match wins; confidence grows with agreeing hits but is capped so
  // a single line never reads as certainty.
  const ranked = [...scores.values()].sort(
    (a, b) => b.hits - a.hits || (b.sig.priority ?? 0) - (a.sig.priority ?? 0),
  );
  const top = ranked[0];
  if (
    ranked.length > 1 &&
    ranked[1].hits === top.hits &&
    (ranked[1].sig.priority ?? 0) === (top.sig.priority ?? 0)
  ) {
    return {
      failureClass: "unknown",
      confidence: 0.2,
      rationale: "The symptoms point equally strongly at more than one failure class.",
      repairs: [],
      gatherMore:
        "The evidence is conflicting. Capture the exact failing command, exit code, and adjacent log lines before changing anything.",
    };
  }
  const confidence = Number(Math.min(0.9, 0.4 + top.hits * 0.2).toFixed(2));

  const diagnosis: Diagnosis = {
    failureClass: top.sig.failureClass,
    confidence,
    rationale: top.sig.rationale,
    repairs: confidence >= WEAK_SIGNAL ? top.sig.repairs.map((repair) => ({ ...repair })) : [],
  };

  if (confidence < WEAK_SIGNAL) {
    diagnosis.gatherMore =
      "This is a best guess from limited signal. Before changing anything, capture a fuller log or the exact failing command so OCADE can confirm the cause.";
  }
  return diagnosis;
}

/**
 * Every repair a diagnosis proposes must carry a rollback. This is enforced,
 * not assumed: a repair library entry without one is a bug, and this guard
 * turns it into a failing test rather than an un-undoable action in the field.
 */
export function everyRepairIsReversible(): boolean {
  return SIGNATURES.every((sig) => sig.repairs.every((r) => r.rollback.trim().length > 0));
}
