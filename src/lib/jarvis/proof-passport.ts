/**
 * PROOF PASSPORT (plan 28.1.7 T12-07): a portable record of what a JARVIS task changed, what was
 * checked and what remains uncertain, built only from the task's own records (checks, step
 * outcomes, delivered files and their SHA-256 as the computer reported them). A versioned JSON
 * manifest with an integrity hash of its own content, plus a short readable report. Portable
 * exports carry only structured evidence because task text can contain private information.
 */
import { OPERATIONS, outcomeCheck } from "./contracts.ts";

export type PassportStatus =
  | "VERIFIED"
  | "PARTIALLY VERIFIED"
  | "FAILED"
  | "UNKNOWN EFFECT"
  | "USER-ATTESTED"
  | "NOT FINISHED";

export interface PassportInput {
  id: string;
  status: string;
  mode?: string;
  checks: { kind?: string; state: string }[];
  steps: {
    operation?: string;
    status: string;
    disposition: string | null;
    resolution?: string | null;
    lane?: number;
  }[];
  artifactFiles: { sha256: string }[];
  timing: { acceptedAt: string; finishedAt: string | null };
}

export function passportStatus(task: PassportInput): PassportStatus {
  if (task.steps.some((step) => step.disposition === "outcome unknown")) return "UNKNOWN EFFECT";
  if (!["completed", "blocked", "failed", "stopped"].includes(task.status)) return "NOT FINISHED";
  if (task.checks.some((check) => check.state === "failed")) return "FAILED";
  if (task.steps.some((step) => step.resolution === "applied")) return "USER-ATTESTED";
  if (
    task.checks.length > 0 &&
    task.checks.every((check) => check.state === "passed") &&
    task.status === "completed"
  )
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
    format: "ocade-proof-passport/2",
    taskId: task.id,
    status: passportStatus(task),
    rehearsal: task.mode === "rehearsal",
    acceptedAt: task.timing.acceptedAt,
    finishedAt: task.timing.finishedAt,
    generatedAt: generatedAt.toISOString(),
    checks: task.checks.map(({ kind, state }, index) => ({
      number: index + 1,
      method: outcomeCheck.shape.kind.safeParse(kind).data ?? null,
      state: ["passed", "failed", "unverified"].includes(state) ? state : "unchecked",
    })),
    steps: task.steps.map(({ operation, resolution, disposition, status, lane }, index) => {
      const outcome = disposition ?? status;
      return {
        number: index + 1,
        operation: operation && Object.hasOwn(OPERATIONS, operation) ? operation : null,
        outcome:
          resolution === "applied"
            ? "user-attested"
            : [
                  "outcome unknown",
                  "verified",
                  "executed",
                  "refused",
                  "failed",
                  "cancelled",
                ].includes(outcome)
              ? outcome
              : "unchecked",
        agent:
          typeof lane === "number" && Number.isInteger(lane) && lane >= 0 && lane <= 3
            ? lane + 1
            : null,
      };
    }),
    files: task.artifactFiles
      .filter(({ sha256 }) => /^[0-9a-f]{64}$/.test(sha256))
      .map(({ sha256 }, index) => ({ number: index + 1, sha256 })),
    limits: "This unsigned report contains OCADE's check results and recorded file hashes.",
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
    ...(passport.rehearsal ? ["Rehearsal results only"] : []),
    `Task ${passport.taskId}`,
    `Accepted ${passport.acceptedAt}. Finished ${passport.finishedAt ?? "not yet"}.`,
    "",
    "Checks",
    ...(passport.checks.length
      ? passport.checks.map(
          (check) =>
            `- Check ${check.number} · ${check.method?.replaceAll("_", " ") ?? "method unavailable"} · ${check.state}`,
        )
      : ["- None recorded"]),
    "",
    "Recorded file hashes (SHA-256)",
    ...(passport.files.length
      ? passport.files.map((file) => `- File ${file.number}  ${file.sha256}`)
      : ["- None recorded"]),
    "",
    "Steps",
    ...(passport.steps.length
      ? passport.steps.map(
          (step) =>
            `- Step ${step.number} · ${step.operation?.replace(/[._]/g, " ") ?? "action unavailable"} · ${step.outcome}`,
        )
      : ["- None recorded"]),
    passport.limits,
    `Manifest integrity SHA-256: ${passport.integrity.sha256}`,
  ].join("\n");
}
