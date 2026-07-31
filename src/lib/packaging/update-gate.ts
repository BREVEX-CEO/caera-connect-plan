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
import { verifyUpdateTrust, type UpdateTrustPolicy } from "./update-trust";

export type GateDecision =
  | { readonly action: "apply"; readonly from: string; readonly to: string; readonly url?: string; readonly evidence: string }
  | { readonly action: "skip"; readonly reason: string }
  | { readonly action: "refuse"; readonly reason: string };

export interface UpdateGateInput {
  readonly manifest: UpdateManifest;
  readonly policy: UpdatePolicy;
  /** Rotatable, revocable keyring shipped with the application. */
  readonly trustPolicy: UpdateTrustPolicy;
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

  // Verify the manifest before trusting its expected hash or download URL.
  const verdict = await verifyUpdateTrust(input.manifest, input.trustPolicy);
  if (!verdict.ok) {
    return { action: "refuse", reason: `Update trust rejected: ${verdict.reason}` };
  }

  // The signed manifest is trusted. Now compare it with the bytes the host
  // actually observed rather than accepting the manifest's own digest as fact.
  if (!input.artifactSha256) {
    return {
      action: "refuse",
      reason:
        "The downloaded artifact has not been hashed, so there is nothing to verify the signature against.",
    };
  }

  const expectedSha256 = input.manifest.sha256?.trim().toLowerCase();
  const observedSha256 = input.artifactSha256.trim().toLowerCase();
  if (!expectedSha256 || observedSha256 !== expectedSha256) {
    return {
      action: "refuse",
      reason: "The downloaded artifact hash does not match the signed update manifest.",
    };
  }

  return {
    action: "apply",
    from: planned.from,
    to: planned.to,
    url: planned.url,
    evidence: verdict.evidence,
  };
}
