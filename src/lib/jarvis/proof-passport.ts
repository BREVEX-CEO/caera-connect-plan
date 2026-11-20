/**
 * PROOF PASSPORT (plan 28.1.7 T12-07): a portable record of what a JARVIS task changed, what was
 * checked and what remains uncertain, built only from the task's own records (checks, step
 * outcomes, delivered files and their SHA-256 as the computer reported them). A versioned JSON
 * manifest with an integrity hash of its own content, plus a short readable report. It is not
 * signed (no trusted signing key exists yet) and says so; it never certifies more than its checks.
 */
export type PassportStatus =
  "VERIFIED" | "PARTIALLY VERIFIED" | "FAILED" | "UNKNOWN EFFECT" | "NOT FINISHED";

export interface PassportInput {
  id: string;
  title: string;
  status: string;
  device?: string | null;
  checks: { id: string; description: string; state: string }[];
  steps: { summary: string; status: string; disposition: string | null; lane?: number }[];
  artifactFiles: { path: string; sha256: string }[];
  timing: { acceptedAt: string; finishedAt: string | null };
}

export function passportStatus(task: PassportInput): PassportStatus {
  if (task.steps.some((step) => step.disposition === "outcome unknown")) return "UNKNOWN EFFECT";
  if (!["completed", "blocked", "failed", "stopped"].includes(task.status)) return "NOT FINISHED";
  if (!task.checks.length || task.checks.some((check) => check.state === "failed")) return "FAILED";
  if (task.checks.every((check) => check.state === "passed") && task.status === "completed")
    return "VERIFIED";
  return task.checks.some((check) => check.state === "passed") ? "PARTIALLY VERIFIED" : "FAILED";
}

/** Canonical JSON: keys sorted at every level, so the same content always hashes the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildPassport(task: PassportInput, generatedAt = new Date()) {
  const body = {
    format: "ocade-proof-passport/1",
    taskId: task.id,
    outcome: task.title,
    status: passportStatus(task),
    device: task.device ?? null,
    acceptedAt: task.timing.acceptedAt,
    finishedAt: task.timing.finishedAt,
    generatedAt: generatedAt.toISOString(),
    checks: task.checks.map(({ id, description, state }) => ({ id, description, state })),
    steps: task.steps.map((step) => ({
      summary: step.summary,
      outcome: step.disposition ?? step.status,
      ...(step.lane ? { agent: step.lane + 1 } : {}),
    })),
    files: task.artifactFiles.map(({ path, sha256 }) => ({ path, sha256 })),
    // Sent, published or submitted effects cannot be undone by OCADE; they are recorded only.
    limits:
      "Checks are OCADE's own independent checks on this computer's results. Not signed by a third party.",
    signature: null,
  };
  return { ...body, integrity: { sha256: await sha256(canonical(body)) } };
}

/** Whether a manifest is unaltered: its integrity hash matches its content. */
export async function passportIntact(manifest: Record<string, unknown>): Promise<boolean> {
  const { integrity, ...body } = manifest as { integrity?: { sha256?: string } };
  return (
    typeof integrity?.sha256 === "string" && integrity.sha256 === (await sha256(canonical(body)))
  );
}

export function passportReport(passport: Awaited<ReturnType<typeof buildPassport>>): string {
  return [
    `OCADE Proof Passport — ${passport.status}`,
    `Outcome: ${passport.outcome}`,
    `Task ${passport.taskId}${passport.device ? ` on ${passport.device}` : ""}`,
    `Accepted ${passport.acceptedAt}; finished ${passport.finishedAt ?? "not yet"}`,
    "",
    "Checks:",
    ...passport.checks.map((check) => `- [${check.state}] ${check.description}`),
    "",
    "Files delivered (SHA-256):",
    ...(passport.files.length
      ? passport.files.map((file) => `- ${file.path}  ${file.sha256}`)
      : ["- none"]),
    "",
    `Steps: ${passport.steps.length}`,
    passport.limits,
    `Manifest integrity SHA-256: ${passport.integrity.sha256}`,
  ].join("\n");
}
