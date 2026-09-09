/**
 * SAVING AN ANSWER AS AN ARTIFACT, AND THE RECORD THAT IT HAPPENED.
 *
 * ONE ROW, NOT TWO. This module used to write the artifact and then a separate
 * activity entry in `localStorage`, and roll the artifact back if the ledger
 * write failed — an elaborate dance around a problem it had created for itself.
 * Every field of that entry is derivable from the artifact: its digest, its
 * size, whether the producer confirmed it, and the conversation, message,
 * project and source files it was made from are all recorded on the row.
 *
 * So the ledger is now a PROJECTION of the artifacts themselves. There is no
 * split to reconcile, no rollback to get wrong, and no way for the Activity
 * screen to disagree with the Artifacts screen — the failure the rollback
 * existed to prevent is now unrepresentable.
 */
import {
  inspectArtifactStore,
  removeArtifact,
  saveArtifact,
  sha256,
  verifyIntegrity,
  type Artifact,
  type IntegrityResult,
} from "./store";
import type { Outcome } from "../outcome";

export interface OutputActivity {
  id: string;
  at: string;
  action: "ocade.output.saved";
  artifactId: string;
  outputName: string;
  outputSha256: string;
  outputBytes: number;
  result: "verified" | "not_confirmed";
  conversationId: string;
  messageId: string;
  projectId?: string;
  projectName?: string;
  sourceFiles: Array<{ name: string; sha256: string }>;
}

export interface ChatOutputInput {
  title: string;
  content: string;
  conversationId: string;
  messageId: string;
  project?: {
    id: string;
    name?: string;
    instructions?: string | null;
  };
  files: Array<{
    name: string;
    content: string;
  }>;
  producerEvidence: string;
  /**
   * True only when an independent producer check established correctness.
   * Integrity re-hashing alone proves storage integrity, not factual truth.
   */
  producerVerified?: boolean;
}

export interface SavedChatOutput {
  artifact: Artifact;
  integrity: IntegrityResult;
  activity: OutputActivity;
}

/** The activity entry an artifact IS. */
export function activityFor(artifact: Artifact): OutputActivity {
  const context = artifact.context;
  return {
    // The artifact's own id: an activity entry and the thing it describes are
    // the same row, so giving them different identities would only invite them
    // to be treated as separable again.
    id: artifact.id,
    at: artifact.createdAt,
    action: "ocade.output.saved",
    artifactId: artifact.id,
    outputName: artifact.name,
    outputSha256: artifact.sha256,
    outputBytes: artifact.byteLength,
    result: artifact.provenance.verified ? "verified" : "not_confirmed",
    conversationId: context?.conversationId ?? "",
    messageId: context?.messageId ?? "",
    ...(context?.projectId ? { projectId: context.projectId } : {}),
    ...(context?.projectName ? { projectName: context.projectName } : {}),
    sourceFiles: context?.files ?? [],
  };
}

/**
 * Every output this account has saved from a conversation, newest first.
 *
 * Artifacts produced by other surfaces are excluded: this is the record of
 * answers turned into files, and padding it with everything else would make it
 * harder to find the entry somebody came looking for.
 */
export async function listOutputActivity(): Promise<Outcome<OutputActivity[]>> {
  const stored = await inspectArtifactStore();
  if (!stored.ok) return stored;
  const entries = stored.data
    .filter((artifact) => artifact.provenance.producedBy.startsWith("ocade.chat:"))
    .map(activityFor);
  return {
    ok: true,
    data: entries,
    evidence: `${entries.length} saved ${entries.length === 1 ? "output" : "outputs"}.`,
  };
}

/**
 * Persist an assistant output and immediately re-hash it.
 *
 * The re-hash is not ceremony: it reads the content back from where it was
 * stored and fingerprints it again, so a truncated or altered write is caught
 * now rather than by somebody relying on the file weeks later. An artifact that
 * fails its own integrity check is removed rather than kept with a warning —
 * there is nothing to keep, because the bytes are not the ones that were
 * produced.
 */
export async function saveChatOutput(input: ChatOutputInput): Promise<Outcome<SavedChatOutput>> {
  const sourceFiles: Array<{ name: string; sha256: string }> = [];
  for (const file of input.files) {
    const digest = await sha256(file.content);
    if (!digest.ok) return digest;
    sourceFiles.push({ name: file.name, sha256: digest.data });
  }

  const saved = await saveArtifact({
    name: input.title,
    kind: "text",
    content: input.content,
    conversationId: input.conversationId,
    projectId: input.project?.id ?? null,
    provenance: {
      producedBy: `ocade.chat:${input.conversationId}`,
      verified: input.producerVerified === true,
      evidence: input.producerEvidence,
    },
    context: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      ...(input.project
        ? {
            projectId: input.project.id,
            ...(input.project.name ? { projectName: input.project.name } : {}),
            ...(input.project.instructions
              ? { projectInstructions: input.project.instructions }
              : {}),
          }
        : {}),
      files: sourceFiles,
    },
  });
  if (!saved.ok) return saved;

  const integrity = await verifyIntegrity(saved.data.id);
  if (!integrity.ok || !integrity.data.intact) {
    const removal = await removeArtifact(saved.data.id);
    if (integrity.ok) {
      return {
        ok: false,
        reason: removal.ok
          ? "The saved output failed its immediate integrity check and was removed."
          : `The saved output failed its immediate integrity check and could not be removed: ${removal.reason}`,
      };
    }
    return integrity;
  }

  return {
    ok: true,
    data: {
      artifact: saved.data,
      integrity: integrity.data,
      activity: activityFor(saved.data),
    },
    evidence: `Saved and re-hashed “${saved.data.name}”.`,
  };
}
