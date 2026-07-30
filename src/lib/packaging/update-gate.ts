/**
 * Joins the two halves of the update decision (P21).
 *
 * `planUpdate` decides whether an update SHOULD be applied — version ordering,
 * channel, rollback policy — and checks only that a signature is PRESENT. Its
 * own source says so: "this is a PRESENCE check. Whether the signature is
 * genuine is decided by `verifyUpdateSignature`".
 *
 * That function existed, was tested, and was imported by nothing. So the only
 * update path reachable from production checked that a signature field was
 * non-empty and never verified it — which a malicious manifest satisfies by
 * writing any string at all.
 *
 * This is the gate that runs both, in the order that matters: plan first
 * (cheap, and refuses most bad updates without any crypto), verify second, and
 * apply only if BOTH agree.
 */
import { planUpdate, type UpdateDecision, type UpdateManifest, type UpdatePolicy } from "./update-plan";
import { verifyUpdateSignature } from "./update-signature";

export type GateDecision =
  | { readonly action: "apply"; readonly from: string; readonly to: string; readonly url?: string; readonly evidence: string }
  | { readonly action: "skip"; readonly reason: string }
  | { readonly action: "refuse"; readonly reason: string };

export interface UpdateGateInput {
  readonly manifest: UpdateManifest;
  readonly policy: UpdatePolicy;
  /** Ed25519 public key shipped with the application, base64. */
  readonly publicKeyBase64: string;
  /**
   * SHA-256 of the artifact AS DOWNLOADED, computed by the host from the bytes
   * on disk. Never taken from the manifest: a digest supplied by whoever
   * supplied the signature proves nothing.
   */
  readonly artifactSha256: string | null;
}

/**
 * Decide whether an update may be applied.
 *
 * Fails closed at every step. An update is applied only when the plan says
 * apply AND the signature verifies against a digest the host computed itself.
 */
export async function gateUpdate(input: UpdateGateInput): Promise<GateDecision> {
  const planned: UpdateDecision = planUpdate(input.manifest, input.policy);
  if (planned.action !== "apply") return planned;

  // The plan wants to apply. Now the part the plan explicitly does not do.
  const signature = input.manifest.signature?.trim();
  if (!signature) {
    return {
      action: "refuse",
      reason: "The update is unsigned, so it cannot be verified or applied.",
    };
  }
  if (!input.publicKeyBase64 || input.publicKeyBase64.includes("REPLACE_WITH")) {
    /*
     * A placeholder key would make every verification fail at runtime, which
     * looks like a broken product rather than an unconfigured one. Say which
     * it is.
     */
    return {
      action: "refuse",
      reason:
        "No update signing key is configured in this build, so update signatures cannot be checked. Updates stay disabled until a real key ships.",
    };
  }
  if (!input.artifactSha256) {
    return {
      action: "refuse",
      reason:
        "The downloaded artifact has not been hashed, so there is nothing to verify the signature against.",
    };
  }

  const verdict = await verifyUpdateSignature({
    publicKeyBase64: input.publicKeyBase64,
    signatureBase64: signature,
    artifactSha256: input.artifactSha256,
  });

  if (!verdict.ok) {
    return { action: "refuse", reason: `Update signature rejected: ${verdict.reason}` };
  }

  return {
    action: "apply",
    from: planned.from,
    to: planned.to,
    url: planned.url,
    evidence: verdict.evidence,
  };
}
