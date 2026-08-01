/**
 * Bind EXTERNALLY BLOCKED requirements to the blocker that actually blocks them.
 *
 * WHY THIS IS HONEST EVIDENCE, AND MASS-BACKFILLING TESTS WOULD NOT BE
 * --------------------------------------------------------------------
 * The readiness engine counts a requirement only when it names the evidence and
 * the phase that observed it. 319 rows fail that test. It would be easy — and
 * completely wrong — to sweep a generic sentence across all of them; that would
 * replace one form of overstatement with a better-disguised one.
 *
 * A blocked requirement is different. Its claim is not "this works", it is
 * "this cannot be finished here, for a named reason". That claim IS provable
 * from artefacts already in the repository:
 *
 *   - release/OCADE_RELEASE_BLOCKERS.json records the blocker and what evidence
 *     would clear it;
 *   - the area→blocker mapping below is one-to-one and stated explicitly, not
 *     inferred from word overlap.
 *
 * So this binds only rows whose status is already EXTERNALLY BLOCKED, and only
 * where the area maps unambiguously to a recorded blocker. Anything else is
 * left alone and reported, because "I could not determine this" is a result,
 * not a gap to paper over.
 *
 * Usage: node scripts/bind-blocker-evidence.mjs [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const BLOCKERS = "release/OCADE_RELEASE_BLOCKERS.json";
const write = process.argv.includes("--write");

/**
 * Area prefix → blocker id. Explicit and reviewable.
 *
 * Every entry states a real dependency: the desktop areas cannot be finished
 * without a built and signed companion, the database areas without project
 * authority, and so on. An area absent from this map is NOT bound.
 */
/**
 * Per-requirement overrides, applied BEFORE the area map.
 *
 * Some areas are platform-mixed: "Mobile Application and Native Bridge" and
 * "Desktop Mobile and Extension Packaging" each cover both Android and iOS, so
 * the area alone would cite the Android blocker for an iOS requirement. That
 * would be a false citation — iOS is blocked by Apple signing and provisioning,
 * which is a genuinely different dependency with a different owner action.
 */
const ID_TO_BLOCKER = new Map([
  ["AZ-254", "ios-build-sign-device"], // iOS plugin
  ["AZ-359", "ios-build-sign-device"], // iOS archive
  ["AZ-390", "ios-build-sign-device"], // iOS simulator
]);

const AREA_TO_BLOCKER = [
  ["Desktop Companion Foundation", "desktop-build-sign-update"],
  ["Windows Process Application and Window Control", "desktop-build-sign-update"],
  ["Scoped Keyboard Mouse Clipboard and Files", "desktop-build-sign-update"],
  ["Desktop Mobile and Extension Packaging", "desktop-build-sign-update"],
  ["Signing and Trust Distribution", "desktop-build-sign-update"],
  ["Clean-Machine Installation and First Run", "desktop-build-sign-update"],
  ["Updater Staging Verification and Rollback", "desktop-build-sign-update"],
  ["Database Schema Migrations and Rollback", "supabase-apply-and-rls"],
  ["Staging Database and Controlled Deployment", "supabase-apply-and-rls"],
  ["Cloud Relay and Service Deployment", "web-cloudflare-runtime"],
  ["Relay Service and Remote Sessions", "web-cloudflare-runtime"],
  ["Mobile Application and Native Bridge", "android-build-sign-device"],
  ["Browser Extension and Web Control", "browser-extension-store"],
  ["Supported Application Certification", "real-application-and-device-matrix"],
  ["Accessibility and Semantic UI Control", "desktop-build-sign-update"],
  ["Screen Capture Vision and Set-of-Mark", "desktop-build-sign-update"],
  ["Voice Input Output Wake and Protected Speech", "real-application-and-device-matrix"],
  ["Authentication Accounts and Device Management", "android-build-sign-device"],
];

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const blockerDoc = JSON.parse(readFileSync(BLOCKERS, "utf8"));
const blockerById = new Map(blockerDoc.blockers.map((b) => [b.id, b]));

const bound = (r) =>
  typeof r.evidence === "string" &&
  r.evidence.trim().length >= 20 &&
  typeof r.resolvedInPhase === "string" &&
  r.resolvedInPhase.trim().length >= 2;

let boundCount = 0;
const skipped = [];

for (const req of snapshot.requirements) {
  if (req.status !== "EXTERNALLY BLOCKED" || bound(req)) continue;

  const area = String(req.area ?? "");
  const override = ID_TO_BLOCKER.get(req.id);
  const hit = override
    ? [null, override]
    : AREA_TO_BLOCKER.find(([prefix]) => area.startsWith(prefix));
  if (!hit) {
    skipped.push({ id: req.id, area: area.split(";")[0].trim() });
    continue;
  }
  const blocker = blockerById.get(hit[1]);
  if (!blocker) {
    skipped.push({ id: req.id, area: area.split(";")[0].trim(), why: `unknown blocker ${hit[1]}` });
    continue;
  }

  req.evidence =
    `EXTERNALLY BLOCKED by "${blocker.id}" (${blocker.area}), recorded in release/OCADE_RELEASE_BLOCKERS.json. ` +
    `Clearing it requires: ${(blocker.requiredEvidence ?? []).join("; ")}. ` +
    `This binds the BLOCKED claim only — it is not evidence that the requirement works.`;
  req.resolvedInPhase = "P29-blocker-binding";
  req.caveat =
    "Bound to a recorded external blocker, not to working behaviour. Weight 0.4 reflects source completeness plus a proven external dependency, never runtime proof.";
  boundCount += 1;
}

console.log(`Blocker binding: ${boundCount} requirement(s) bound to a recorded blocker.`);
if (skipped.length > 0) {
  console.log(`\n${skipped.length} blocked requirement(s) left UNBOUND — no unambiguous blocker:`);
  const byArea = {};
  for (const s of skipped) byArea[s.area] = (byArea[s.area] ?? 0) + 1;
  for (const [a, n] of Object.entries(byArea).sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(3)}  ${a}`);
  }
  console.log("  These are reported rather than guessed at.");
}

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${SNAPSHOT}.`);
} else {
  console.log("\nDry run. Pass --write to apply.");
}
